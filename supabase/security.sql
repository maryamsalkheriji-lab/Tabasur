-- =====================================================================
-- حماية قاعدة بيانات تَبصَّر (Row Level Security)
-- شغّلي هذا الملف كاملًا مرة وحدة من Supabase: SQL Editor ← New query ← Run
-- آمن لو انشغّل أكثر من مرة. لو صار أي خطأ، ما يتغير شي (كله داخل transaction).
--
-- النتيجة:
--   • الزوار يقدرون يسجّلون فقط (إضافة)، وما يقدرون يقرون أو يعدلون أو يحذفون أي شي.
--   • القراءة للأدمن المسجّل في جدول admin_users فقط، بعد تسجيل الدخول.
--   • وقت التسجيل يُكتب من السيرفر، ما يقدر الزائر يزوّره.
--   • سجل إرسال الإيميلات مقفول بالكامل، تستخدمه دالة الإرسال في السيرفر فقط.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) قائمة الأدمن
-- ---------------------------------------------------------------------
create table if not exists public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on table public.admin_users from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.admin_users where user_id = (select auth.uid()));
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 2) وقت التسجيل من السيرفر دائمًا
-- ---------------------------------------------------------------------
create or replace function public.set_created_at_now()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.created_at := now();
  return new;
end;
$$;
revoke all on function public.set_created_at_now() from public, anon, authenticated;

drop trigger if exists registrations_set_created_at on public.registrations;
create trigger registrations_set_created_at
  before insert on public.registrations
  for each row execute function public.set_created_at_now();

drop trigger if exists sponsor_registrations_set_created_at on public.sponsor_registrations;
create trigger sponsor_registrations_set_created_at
  before insert on public.sponsor_registrations
  for each row execute function public.set_created_at_now();

-- ---------------------------------------------------------------------
-- 3) حذف كل القواعد القديمة على الجدولين (ومنها القاعدة اللي كانت تسمح بالقراءة للكل)
-- ---------------------------------------------------------------------
do $$
declare p record;
begin
  for p in
    select policyname, tablename from pg_policies
    where schemaname = 'public' and tablename in ('registrations', 'sponsor_registrations')
  loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

alter table public.registrations enable row level security;
alter table public.sponsor_registrations enable row level security;

-- ما أحد من الموقع يحتاج يعدّل أو يحذف
revoke update, delete, truncate, references, trigger on table public.registrations from anon, authenticated;
revoke update, delete, truncate, references, trigger on table public.sponsor_registrations from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) تسجيل المشاركين: إضافة فقط، مع فحص البيانات
-- ---------------------------------------------------------------------
create policy "public can submit a registration"
  on public.registrations
  for insert
  to anon, authenticated
  with check (
        char_length(btrim(coalesce(full_name::text, ''))) between 2 and 100
    and char_length(coalesce(email::text, '')) between 5 and 254
    and email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and char_length(coalesce(mobile::text, '')) between 9 and 15
    and (city is null or char_length(city::text) <= 100)
    and specialty::text in ('photo', 'video', 'content', 'graphic', 'motion', 'ai', 'editor', 'other')
    and (experience is null or experience::text in ('0-1', '1-3', '3-5', '5-10', '10+'))
    and (ai_experience is null or ai_experience::text in ('yes', 'sometimes', 'no'))
    and (portfolio is null or (char_length(portfolio::text) <= 500 and portfolio::text ~* '^https?://'))
    and (social_account is null or (char_length(social_account::text) <= 500 and social_account::text ~* '^https?://'))
    and char_length(coalesce(notes::text, '')) <= 2000
  );

create policy "admins can read registrations"
  on public.registrations
  for select
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 5) طلبات الرعاية: إضافة فقط، مع فحص البيانات
-- ---------------------------------------------------------------------
create policy "public can submit a sponsor request"
  on public.sponsor_registrations
  for insert
  to anon, authenticated
  with check (
        char_length(btrim(coalesce(organization_name::text, ''))) between 2 and 200
    and char_length(btrim(coalesce(contact_name::text, ''))) between 2 and 100
    and char_length(coalesce(contact_email::text, '')) between 5 and 254
    and contact_email::text ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    and char_length(coalesce(contact_mobile::text, '')) between 9 and 15
  );

create policy "admins can read sponsor requests"
  on public.sponsor_registrations
  for select
  to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------
-- 6) سجل إيميلات التأكيد (للحد من الإرسال) — مقفول على الموقع بالكامل
-- ---------------------------------------------------------------------
create table if not exists public.registration_email_log (
  id      bigint generated always as identity primary key,
  email   text not null,
  kind    text not null check (kind in ('participant', 'sponsor')),
  sent_at timestamptz not null default now()
);
create index if not exists registration_email_log_lookup_idx
  on public.registration_email_log (email, kind, sent_at desc);
alter table public.registration_email_log enable row level security;
revoke all on table public.registration_email_log from anon, authenticated;

commit;

-- =====================================================================
-- 7) إضافة حساب الأدمن (مرة وحدة، بعد إنشاء الحساب)
--    أولًا: Authentication ← Users ← Add user ← Create new user
--           (نفس الإيميل اللي بتحطينه في VITE_ADMIN_EMAIL، مع كلمة مرور قوية، وفعّلي Auto Confirm)
--    بعدها: شيلي علامتي -- من السطرين تحت، وحطي الإيميل، وشغّليهم:
--
-- insert into public.admin_users (user_id)
-- select id from auth.users where email = 'admin-email-here' on conflict do nothing;
-- =====================================================================
