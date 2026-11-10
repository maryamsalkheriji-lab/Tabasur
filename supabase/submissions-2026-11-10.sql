-- =====================================================================
-- تسليم فيديوهات معسكر تَبصَّر (فريق واحد = فيديو واحد)
-- يُشغَّل مرة واحدة على مشروع Supabase. آمن لو انشغّل أكثر من مرة.
--
-- النتيجة:
--   • tb_teams / tb_team_members: الفرق وأعضاؤها. الشخص (برقم جواله أو اسمه) في فريق واحد فقط.
--   • tb_settings: إعدادات التسليم (مفتوح/مغلق، الموعد النهائي، مجلدات درايف).
--   • tb_secrets: بيانات ربط Google Drive (يقرأها السيرفر فقط بمفتاح service_role).
--   • tb_inperson: قائمة المقبولين حضوريًا (لتصنيف الفريق: حضوري / أونلاين / مختلط).
--   • tb_upload_log: سجل كل عملية رفع أو حذف.
--   • لا توجد أي سياسة قراءة أو كتابة للزوار أو للمستخدمين المسجّلين: كل شيء عبر /api/submissions.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) مفتاح رقم الجوال: أرقام فقط بالصيغة الدولية بلا +، مثل 9665xxxxxxxx
-- ---------------------------------------------------------------------
create or replace function public.tb_mobile_key(p text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when p is null then null
    when regexp_replace(p, '\D', '', 'g') ~ '^05\d{8}$'     then '966' || substr(regexp_replace(p, '\D', '', 'g'), 2)
    when regexp_replace(p, '\D', '', 'g') ~ '^5\d{8}$'      then '966' || regexp_replace(p, '\D', '', 'g')
    when regexp_replace(p, '\D', '', 'g') ~ '^009665\d{8}$' then substr(regexp_replace(p, '\D', '', 'g'), 3)
    else regexp_replace(regexp_replace(p, '\D', '', 'g'), '^00', '')
  end
$$;
revoke all on function public.tb_mobile_key(text) from public, anon, authenticated;

-- عمود محسوب في جدول التسجيلات حتى يبحث السيرفر برقم الجوال مباشرة.
alter table public.registrations
  add column if not exists mobile_key text generated always as (public.tb_mobile_key(mobile)) stored;
create index if not exists registrations_mobile_key_idx on public.registrations (mobile_key);

-- ---------------------------------------------------------------------
-- 2) الإعدادات والأسرار (السيرفر فقط)
-- ---------------------------------------------------------------------
create table if not exists public.tb_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.tb_settings enable row level security;
revoke all on table public.tb_settings from anon, authenticated;

create table if not exists public.tb_secrets (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.tb_secrets enable row level security;
revoke all on table public.tb_secrets from anon, authenticated;

insert into public.tb_settings (key, value)
values ('submissions', jsonb_build_object('open', true, 'deadline', null, 'max_bytes', 2147483648))
on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- 3) الفرق وأعضاؤها
-- ---------------------------------------------------------------------
create sequence if not exists public.tb_team_code_seq start 1;
revoke all on sequence public.tb_team_code_seq from anon, authenticated;

create table if not exists public.tb_teams (
  id                uuid primary key default gen_random_uuid(),
  code              text not null unique,
  name              text not null,
  name_key          text not null unique,
  track             text not null check (track in ('destination', 'life', 'investment', 'identity')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  -- الفيديو الواحد المعتمد للفريق
  video_file_id     text,
  video_name        text,
  video_title       text,
  video_size        bigint,
  video_mime        text,
  video_md5         text,
  video_web_link    text,
  video_uploaded_at timestamptz,
  consent_version   text,
  consent_lang      text,
  consent_at        timestamptz,
  -- جلسة رفع جارية (تُمسح عند الاكتمال)
  pending_upload    jsonb
);
alter table public.tb_teams enable row level security;
revoke all on table public.tb_teams from anon, authenticated;

create table if not exists public.tb_team_members (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.tb_teams (id) on delete cascade,
  mobile          text not null,
  mobile_key      text not null unique,
  name_key        text not null unique,
  full_name       text not null,
  registration_id bigint references public.registrations (id) on delete set null,
  is_leader       boolean not null default false,
  position        smallint not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists tb_team_members_team_idx on public.tb_team_members (team_id);
alter table public.tb_team_members enable row level security;
revoke all on table public.tb_team_members from anon, authenticated;

create table if not exists public.tb_inperson (
  email       text primary key,
  full_name   text,
  batch       text,
  imported_at timestamptz not null default now()
);
alter table public.tb_inperson enable row level security;
revoke all on table public.tb_inperson from anon, authenticated;

create table if not exists public.tb_upload_log (
  id         bigint generated always as identity primary key,
  team_id    uuid references public.tb_teams (id) on delete set null,
  team_code  text,
  action     text not null,
  file_id    text,
  file_name  text,
  file_size  bigint,
  detail     jsonb,
  created_at timestamptz not null default now()
);
alter table public.tb_upload_log enable row level security;
revoke all on table public.tb_upload_log from anon, authenticated;

-- ---------------------------------------------------------------------
-- 4) تسجيل فريق كامل في عملية واحدة (إما ينجح كله أو لا شيء)
--    p_members: [{mobile, mobile_key, name_key, full_name, registration_id}] والأول هو القائد
-- ---------------------------------------------------------------------
create or replace function public.tb_register_team(p_name text, p_name_key text, p_track text, p_members jsonb)
returns public.tb_teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team public.tb_teams;
  m      jsonb;
  i      int := 0;
begin
  if jsonb_typeof(p_members) <> 'array' or jsonb_array_length(p_members) < 1 or jsonb_array_length(p_members) > 5 then
    raise exception using errcode = 'P0001', message = 'INVALID_MEMBERS';
  end if;
  if exists (select 1 from public.tb_teams where name_key = p_name_key) then
    raise exception using errcode = 'P0001', message = 'TEAM_NAME_TAKEN';
  end if;
  for m in select value from jsonb_array_elements(p_members) loop
    if exists (select 1 from public.tb_team_members tm where tm.mobile_key = m->>'mobile_key') then
      raise exception using errcode = 'P0001', message = 'MOBILE_TAKEN', detail = m->>'mobile_key';
    end if;
    if exists (select 1 from public.tb_team_members tm where tm.name_key = m->>'name_key') then
      raise exception using errcode = 'P0001', message = 'NAME_TAKEN', detail = m->>'mobile_key';
    end if;
  end loop;

  insert into public.tb_teams (code, name, name_key, track)
  values ('TB-' || lpad(nextval('public.tb_team_code_seq')::text, 3, '0'), p_name, p_name_key, p_track)
  returning * into v_team;

  for m in select value from jsonb_array_elements(p_members) loop
    insert into public.tb_team_members (team_id, mobile, mobile_key, name_key, full_name, registration_id, is_leader, position)
    values (v_team.id, m->>'mobile', m->>'mobile_key', m->>'name_key', m->>'full_name',
            nullif(m->>'registration_id', '')::bigint, i = 0, i);
    i := i + 1;
  end loop;
  return v_team;
end
$$;
revoke all on function public.tb_register_team(text, text, text, jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 5) تصنيف العضو: حضوري إذا كان أي تسجيل بنفس رقم الجوال ضمن قائمة المقبولين حضوريًا
-- ---------------------------------------------------------------------
create or replace view public.tb_admin_members
with (security_invoker = false)
as
select tm.id, tm.team_id, t.code as team_code, tm.mobile, tm.mobile_key, tm.full_name, tm.registration_id,
       tm.is_leader, tm.position, tm.created_at,
       exists (
         select 1 from public.registrations r
         join public.tb_inperson ip on lower(ip.email) = lower(r.email)
         where r.mobile_key = tm.mobile_key
       ) as in_person
from public.tb_team_members tm
join public.tb_teams t on t.id = tm.team_id;
revoke all on table public.tb_admin_members from anon, authenticated;

-- تحديث مخطط PostgREST فورًا حتى ترى واجهة Supabase الجداول الجديدة
notify pgrst, 'reload schema';

commit;
