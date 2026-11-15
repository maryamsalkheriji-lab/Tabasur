-- =====================================================================
-- إقرارات الأعضاء (2026-11-15)
-- كل عضو في الفريق يرفع نموذج «إقرار وموافقة على استخدام ونشر الأعمال الإبداعية» معبّأً وموقّعًا
-- (PDF أو صورة) قبل أن يُسمح للفريق برفع الفيديو. الملفات تُحفظ في الحاوية الخاصة submissions تحت المجلد consents/.
-- يُشغَّل مرة واحدة في SQL Editor. آمن لو انشغّل أكثر من مرة. لا يمسّ التسجيل ولا الفيديوهات الحالية.
-- =====================================================================
begin;

create table if not exists public.tb_consents (
  id           uuid primary key default gen_random_uuid(),
  team_id      uuid not null references public.tb_teams (id) on delete cascade,
  member_id    uuid not null unique references public.tb_team_members (id) on delete cascade,
  full_name    text not null,          -- اسم العضو كما سجّله في الموقع
  national_id  text not null,          -- رقم الهوية / الإقامة / الجواز كما كتبه عند الرفع
  mobile       text not null,
  file_id      text not null,          -- مسار الملف داخل الحاوية (consents/<المسار>/<الكود>/...)
  file_name    text not null,          -- اسم العرض عند التنزيل
  file_size    bigint,
  file_mime    text,
  uploaded_by  text,                   -- مفتاح جوال العضو الذي رفع الملف
  uploaded_at  timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
create index if not exists tb_consents_team_idx on public.tb_consents (team_id);
alter table public.tb_consents enable row level security;
revoke all on table public.tb_consents from anon, authenticated;

-- تحديث مخطط PostgREST فورًا حتى يرى السيرفر الجدول الجديد
notify pgrst, 'reload schema';

commit;

-- للتحقق: يجب أن يظهر الجدول بأعمدته
select column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'tb_consents'
order by ordinal_position;
