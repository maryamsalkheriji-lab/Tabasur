-- =====================================================================
-- تأهيل فيديوهات الفرق من لوحة الإدارة (2026-11-12)
-- يُشغَّل مرة واحدة في SQL Editor. آمن لو انشغّل أكثر من مرة. لا يمسّ التسجيل ولا صفحة التسليم.
--
-- يضيف إلى tb_teams قرار المنظّمة على فيديو كل فريق: pending (بلا قرار) / qualified (متأهل) / rejected (غير متأهل).
-- القرار يُربط بمسار الفيديو الذي اتُّخذ عليه؛ فإذا استبدل الفريق فيديوه عاد تلقائيًا إلى «بلا قرار».
-- لا توجد أي سياسة قراءة للزوار: القرار يظهر في لوحة الإدارة فقط عبر /api/submissions بمفتاح service_role.
-- =====================================================================
begin;

alter table public.tb_teams add column if not exists review_status text not null default 'pending';
alter table public.tb_teams add column if not exists review_at     timestamptz;
alter table public.tb_teams add column if not exists review_by     text;
alter table public.tb_teams add column if not exists review_video  text;
alter table public.tb_teams drop constraint if exists tb_teams_review_status_check;
alter table public.tb_teams add constraint tb_teams_review_status_check check (review_status in ('pending', 'qualified', 'rejected'));

-- تحديث مخطط PostgREST فورًا حتى يرى السيرفر الأعمدة الجديدة
notify pgrst, 'reload schema';

commit;

-- للتأكد: يجب أن تظهر الأعمدة الأربعة
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'tb_teams' and column_name like 'review_%'
order by column_name;
