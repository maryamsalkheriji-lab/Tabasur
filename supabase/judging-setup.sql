-- =====================================================================
-- منصة التحكيم — ملف الإعداد الكامل (نُفِّذ فعليًا على المشروع بتاريخ 11 أكتوبر 2026، وآمن لو أُعيد تشغيله)
-- 1) أعمدة: المسار وعدد الفريق + التحليل بالذكاء الاصطناعي   2) مخزن العروض وسياساته
-- 3) معايير المعسكر السبعة (100 درجة)   4) حذف كل البيانات التجريبية (محكّمون، تقييمات، مشاريع)
-- 5) إدراج الفرق التسعة من نموذج التسجيل (8 أكتوبر 2026) حرفيًا   6) إعادة ضبط حالة الفعالية
-- =====================================================================

-- 1) الأعمدة
alter table public.jd_projects
  add column if not exists track       text,
  add column if not exists team_size   integer,
  add column if not exists deck_path   text,
  add column if not exists ai_analysis jsonb,
  add column if not exists ai_stage    public.jd_stage,
  add column if not exists analyzed_at timestamptz;

-- 2) مخزن العروض (خاص، 20MB، PDF/PPTX) — للأدمن فقط
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jd-decks', 'jd-decks', false, 20971520, array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "jd_decks_admin_select" on storage.objects;
drop policy if exists "jd_decks_admin_insert" on storage.objects;
drop policy if exists "jd_decks_admin_update" on storage.objects;
drop policy if exists "jd_decks_admin_delete" on storage.objects;
create policy "jd_decks_admin_select" on storage.objects for select to authenticated using (bucket_id = 'jd-decks' and public.jd_is_admin());
create policy "jd_decks_admin_insert" on storage.objects for insert to authenticated with check (bucket_id = 'jd-decks' and public.jd_is_admin());
create policy "jd_decks_admin_update" on storage.objects for update to authenticated using (bucket_id = 'jd-decks' and public.jd_is_admin()) with check (bucket_id = 'jd-decks' and public.jd_is_admin());
create policy "jd_decks_admin_delete" on storage.objects for delete to authenticated using (bucket_id = 'jd-decks' and public.jd_is_admin());

-- 4) حذف كل البيانات التجريبية في فعالية ai-hackathon (التقييمات ثم المحكّمون ثم المشاريع)
delete from public.jd_scores
where judge_id in (select id from public.jd_judges where event_id = (select id from public.jd_events where slug = 'ai-hackathon'))
   or project_id in (select id from public.jd_projects where event_id = (select id from public.jd_events where slug = 'ai-hackathon'));
delete from public.jd_judges   where event_id = (select id from public.jd_events where slug = 'ai-hackathon');
delete from public.jd_projects where event_id = (select id from public.jd_events where slug = 'ai-hackathon');

-- 3) المعايير السبعة
delete from public.jd_criteria where event_id = (select id from public.jd_events where slug = 'ai-hackathon');
insert into public.jd_criteria (event_id, name, description, weight, sort_order)
select e.id, c.name, c.description, c.weight, c.sort_order
from public.jd_events e
cross join (values
  ('وضوح المشكلة وفهم أسبابها', 'هل حدّد الفريق المشكلة بدقة، ومن يتأثر بها ومتى، وبأي أدلة، وهل عالج أسبابها لا أعراضها فقط؟', 20, 1),
  ('فهم المستفيد والتحقق من احتياجه', 'هل حدّد الفريق المستفيد بدقة، وتحقق من احتياجه ميدانيًا، وعكس ما تعلّمه في قراراته؟', 15, 2),
  ('ملاءمة الفكرة وقيمتها المضافة', 'هل تعالج الفكرة المشكلة المحددة، وما التحسين الملموس مقارنة بالبدائل، وما الذي يدعم احتمال استخدام المستفيد لها؟', 15, 3),
  ('جودة الحد الأدنى من المنتج القابل للتطبيق «MVP»', 'هل يتيح الـMVP تجربة الوظيفة الأساسية بما يكفي لاختبار الافتراض، مع وضوح ما يعمل فعليًا وما يُنفَّذ يدويًا وما لم يُنفَّذ بعد؟', 20, 4),
  ('الاختبار والتعلّم وقياس النتائج', 'ما الافتراض الذي اختبره الفريق، وكيف ومع من، وما مؤشر النجاح المحدد مسبقًا، وما النتائج الفعلية والقرار المبني عليها؟', 15, 5),
  ('إمكانية التنفيذ والاستدامة', 'ما الموارد والعوائق اللازمة لتشغيل الحل، ومن يستخدمه ويشغّله ويدفع تكلفته، وكيف يستمر ماليًا بعد المعسكر؟', 10, 6),
  ('وضوح الفيديو والعرض النهائي', 'هل يوضح العرض المشكلة والمستفيد والقيمة وطريقة عمل الـMVP، ويميّز بين المنجز والمخطط، ويعرض نتائج الاختبار بدقة ضمن المدة؟', 5, 7)
) as c(name, description, weight, sort_order)
where e.slug = 'ai-hackathon';

-- 5) الفرق التسعة (أسماء الفرق والمسار وعدد الأعضاء كما في النموذج حرفيًا)
insert into public.jd_projects (event_id, team_name, title, track, team_size, description, demo_url, stage, eligible, sort_order)
select e.id, p.team_name, p.title, p.track, p.team_size, p.description, p.demo_url, p.stage::public.jd_stage, true, p.sort_order
from public.jd_events e
cross join (values
  ('Kinetix', 'مدرب رياضي شخصي بالذكاء الاصطناعي عبر كاميرا الهاتف', 'الرياضة', 3,
   'تطبيق رياضي ذكي يحوّل كاميرا الهاتف إلى مدرب شخصي يعمل بالذكاء الاصطناعي، يراقب حركة المتدرب ويصحح أداءه. الفئة المستهدفة: الرياضيون وخصوصًا المبتدئون. الحالة في النموذج: غير قائم (فكرة). ممثل الفريق: ياسين سمان. العرض: https://drive.google.com/open?id=1PZNzH6ReT59wOMs1BXsqftjd3rjSCozJ',
   null, 'idea', 1),
  ('رِحال', 'مرافق سياحي ذكي لزوار المدينة المنورة', 'السياحة', 5,
   'تطبيق يقدّم مرافقًا سياحيًا ذكيًا يرافق زائر المدينة المنورة ويخطط رحلته ويقترح الأماكن والخدمات بحسب اهتماماته. الفئة المستهدفة: سياح المدينة المنورة. الحالة: فكرة فقط. ممثلة الفريق: عهد الحربي. العرض: https://drive.google.com/open?id=1TSDwQVxtnZiGolmjpm9o7rfgQmkI6EmQ',
   null, 'idea', 2),
  ('المزرعة الذكية', 'منصة رقمية بالذكاء الاصطناعي تربط المزارع بالزائر', 'الزراعة', 6,
   'منصة رقمية مدعومة بالذكاء الاصطناعي تبني منظومة تربط المزارع بالزوار (حجز زيارات وتجارب زراعية) لأصحاب المزارع والمصانع الزراعية. الحالة: قائم — نموذج أولي (بروتوتايب). ممثل الفريق: محمد ابراهيم الاخضر. العرض: https://drive.google.com/open?id=1aHOnj9z1l4Cm9Y_1l22XmOoRFWR2Fnok',
   'https://sensible-madinah-farm-flow.base44.app', 'prototype', 3),
  ('فريق اثر', 'منصة ذكية لدعم استكشاف المياه في الزراعة', 'الزراعة', 5,
   'حل ذكي زراعي: منصة تهدف إلى دعم استكشاف المياه واتخاذ القرارات الزراعية للعاملين في مجال الزراعة. الحالة: فكرة فقط. ممثلة الفريق: نورهان كاتب. العرض: https://drive.google.com/open?id=1PrSLAK_PXH9hIgnfHSlAXA0ECSdw_5cv',
   null, 'idea', 4),
  ('درب النخيل', 'مراقبة مزارع النخيل بصور الأقمار الصناعية والذكاء الاصطناعي', 'الزراعة', 4,
   'منصة ذكية تراقب مزارع النخيل عبر صور الأقمار الصناعية والذكاء الاصطناعي لرصد حالة النخيل وتوجيه أصحاب المزارع. الفئة المستهدفة: ملاك المزارع ووزارة الزراعة والمستثمرون. الحالة: غير قائم (فكرة). ممثل الفريق: يوسف منير عقبي. العرض: https://drive.google.com/open?id=1oNpkD76dE2xMW_rHdfaK6FDUXGRUplgx',
   null, 'idea', 5),
  ('حولك', 'تطبيق ويب بلا تحميل يرافق زائر المدينة المنورة ومكة المكرمة', 'السياحة', 6,
   'تطبيق ويب بلا تحميل يرافق زوار المدينة المنورة ومكة المكرمة ويساعدهم على الوصول للخدمات والأماكن عبر شخصيات متحركة تفاعلية. الحالة: قائم — MVP (تطبيق ويب تجريبي بثلاث شخصيات متحركة). ممثلة الفريق: أريج عيد الباحث. العرض: https://drive.google.com/open?id=1JGQBxBh0Kp5mS1USPdYZrp-HeF2UEczU · رابط التطبيق/الفيديو: https://drive.google.com/open?id=1oW_rvw7LgFKR57JHD8TVFElujpZ2RtU6',
   null, 'mvp', 6),
  ('MEDNOVA AI SPORT', 'نظام ذكي لجمع وتحليل بيانات الإصابات الرياضية', 'الرياضة', 5,
   'نظام ذكي ومنظم لجمع وتحليل معلومات الإصابات الرياضية يعتمد على البيانات التي يدخلها المستخدم ليكون قابلًا للمراجعة من الطبيب أو أخصائي العلاج الطبيعي أو التأهيل. المستفيدون: الرياضيون واللاعبون، والأطباء وأخصائيو العلاج الطبيعي. الحالة: منتج قائم ومطلق فعليًا (علامة تجارية قيد التسجيل). ممثل الفريق: أحمد عبد القادر مقنص. العرض: https://drive.google.com/open?id=1VHPFEFg0UBgG1IeXCy2PpzNopn3U6QsN',
   'https://mednovai-sport.ai.studio', 'complete', 7),
  ('تحويلة', 'وكيل ذكاء اصطناعي صوتي كموظف استقبال على هاتف الغرفة', 'السياحة', 3,
   'وكيل ذكاء اصطناعي صوتي يعمل كموظف استقبال على هاتف غرفة الفندق، يخدم النزيل بلغته ويحيل طلباته. الفئة المستهدفة: الفنادق في المدينة المنورة. الحالة: فكرة فقط. ممثل الفريق: أحمد فواز عزيزي. العرض: https://drive.google.com/open?id=1Y-2nGNtut7P9TNTHQ7ljlN9kmsSVdX8T',
   null, 'idea', 8),
  ('مرحا', 'منصة ذكية للتسويق السياحي وربط الفعاليات بالزوار', 'السياحة', 5,
   'منصة ذكية (Marha) تحوّل التسويق السياحي من محتوى عام إلى تجارب مخصصة، وتربط الفعاليات والمرافق بسكان وزوار المدينة المنورة. الحالة: فكرة فقط. ممثل الفريق: ريان العروي. العرض: https://drive.google.com/open?id=165egG1jfCPxhXOykhu4XvWql1gvRrWds',
   null, 'idea', 9)
) as p(team_name, title, track, team_size, description, demo_url, stage, sort_order)
where e.slug = 'ai-hackathon'
  and not exists (select 1 from public.jd_projects x where x.event_id = e.id and x.team_name = p.team_name);

-- 6) إعادة ضبط الفعالية قبل يوم التحكيم: مغلقة، غير منشورة، خطوة الكشف 0
update public.jd_events set judging_open = false, results_published = false, reveal_step = 0 where slug = 'ai-hackathon';
