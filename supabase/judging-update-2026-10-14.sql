-- تعريفات التحكيم المتحقَّق منها على قاعدة الإنتاج بتاريخ 14 أكتوبر 2026.
-- يثبت الدوال والسياسات فقط؛ لا يبدّل المعايير ولا يحذف بيانات.
begin;

CREATE OR REPLACE FUNCTION public.jd_standard_criteria()
 RETURNS TABLE(name text, description text, weight numeric, sort_order integer)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  values
    ('اكتمال المنتج وعمله فعليًا', 'هل يعمل المنتج فعليًا ويتيح إكمال الاستخدام الأساسي من البداية إلى النهاية دون عوائق جوهرية؟', 30::numeric, 1),
    ('معالجة المشكلة وملاءمة الحل', 'هل يعالج المنتج مشكلة واضحة للمستفيد المستهدف ويقدم حلًا ملائمًا مدعومًا بأدلة؟', 15::numeric, 2),
    ('جودة التنفيذ التقني', 'هل التنفيذ التقني منظم وموثوق، وتتكامل مكوناته مع معالجة الأخطاء وحماية البيانات؟', 15::numeric, 3),
    ('الاختبار وإثبات فاعلية المنتج', 'هل اختُبر المنتج مع مستخدمين أو حالات واقعية وأظهرت النتائج فاعليته بمؤشرات واضحة؟', 15::numeric, 4),
    ('توظيف تقنيات الذكاء الاصطناعي', 'هل يوظف المنتج الذكاء الاصطناعي فعليًا في وظيفة مفيدة وملائمة، مع التحقق من جودة المخرجات وحدودها؟', 10::numeric, 5),
    ('الجدوى وقابلية التطوير', 'هل توجد خطة واقعية لتشغيل المنتج واستدامته وتطويره بناءً على الموارد والتكلفة واحتياج السوق؟', 10::numeric, 6),
    ('العرض النهائي والتجربة المباشرة', 'هل يشرح العرض المنتج وقيمته بوضوح ويعرض تجربة مباشرة ودقيقة لما يعمل فعليًا؟', 5::numeric, 7);
$function$
;

CREATE OR REPLACE FUNCTION public.jd_require_admin()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if not coalesce(public.jd_is_admin(), false) or auth.jwt()->>'judge_id' is not null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.jd_apply_standard_criteria(p_event_id uuid, p_replace_scores boolean DEFAULT false)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.jd_require_admin();
  perform 1 from public.jd_events where id = p_event_id for update;
  if not found then raise exception 'event not found'; end if;
  if exists (select 1 from public.jd_events where id = p_event_id and (judging_open or results_published)) then
    raise exception 'أغلق التحكيم وألغِ نشر النتائج قبل استبدال المعايير';
  end if;
  if exists (select 1 from public.jd_scores s join public.jd_criteria c on c.id = s.criterion_id where c.event_id = p_event_id)
     and p_replace_scores is not true then
    raise exception 'توجد تقييمات محفوظة؛ يلزم تأكيد استبدالها من لوحة الأدمن';
  end if;
  delete from public.jd_scores where criterion_id in (select id from public.jd_criteria where event_id = p_event_id);
  delete from public.jd_criteria where event_id = p_event_id;
  insert into public.jd_criteria(event_id, name, description, weight, sort_order)
    select p_event_id, name, description, weight, sort_order from public.jd_standard_criteria();
end;
$function$
;

CREATE OR REPLACE FUNCTION public.jd_delete_judge(p_event_id uuid, p_judge_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.jd_require_admin();
  perform 1 from public.jd_events where id = p_event_id for update;
  perform 1 from public.jd_judges where id = p_judge_id and event_id = p_event_id for update;
  if not found then raise exception 'judge not found'; end if;
  delete from public.jd_scores where judge_id = p_judge_id;
  delete from public.jd_judges where id = p_judge_id and event_id = p_event_id;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.jd_reset_scores(p_event_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  perform public.jd_require_admin();
  perform 1 from public.jd_events where id = p_event_id for update;
  if not found then raise exception 'event not found'; end if;
  update public.jd_events set judging_open = false, results_published = false, reveal_step = 0 where id = p_event_id;
  delete from public.jd_scores where project_id in (select id from public.jd_projects where event_id = p_event_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.jd_active_judge(p_judge_id uuid, p_project_id uuid, p_criterion_id uuid, p_writing boolean)
 RETURNS boolean
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.jd_judges j
    join public.jd_events e on e.id = j.event_id
    join public.jd_projects p on p.event_id = e.id and p.id = p_project_id
    join public.jd_criteria c on c.event_id = e.id and c.id = p_criterion_id
    where j.id = p_judge_id and j.id::text = auth.jwt()->>'judge_id'
      and e.id::text = auth.jwt()->>'event_id'
      and not coalesce(j.revoked, false) and (j.expires_at is null or j.expires_at > now())
      and (not p_writing or (e.judging_open and p.eligible is not false))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.jd_check_score_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_event uuid;
begin
  select event_id into v_event from public.jd_projects where id = new.project_id;
  perform 1 from public.jd_events where id = v_event for share;
  if auth.jwt()->>'judge_id' is not null and not public.jd_active_judge(new.judge_id, new.project_id, new.criterion_id, true) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.jd_calculated_results(p_slug text)
 RETURNS TABLE(project_id uuid, team_name text, title text, stage text, final_score numeric, judges_count bigint, per_criterion jsonb, rank bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare v_event uuid;
begin
  if auth.jwt()->>'judge_id' is not null then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select e.id into v_event from public.jd_events e
    where e.slug = p_slug and (coalesce(public.jd_is_admin(), false) or e.results_published);
  if v_event is null then raise exception 'results not published' using errcode = '42501'; end if;
  return query
  with complete_ballots as (
    select s.project_id, s.judge_id
    from public.jd_scores s
    join public.jd_projects p on p.id = s.project_id and p.event_id = v_event and p.eligible is not false
    join public.jd_criteria c on c.id = s.criterion_id and c.event_id = v_event
    join public.jd_judges j on j.id = s.judge_id and j.event_id = v_event
    group by s.project_id, s.judge_id
    having count(distinct s.criterion_id) = (select count(*) from public.jd_criteria where event_id = v_event)
  ), criterion_points as (
    select s.project_id, c.id, c.name, avg(s.score::numeric / 5 * c.weight) as points
    from public.jd_scores s
    join complete_ballots b on b.project_id = s.project_id and b.judge_id = s.judge_id
    join public.jd_criteria c on c.id = s.criterion_id and c.event_id = v_event
    group by s.project_id, c.id, c.name
  ), totals as (
    select cp.project_id, sum(cp.points) as total, jsonb_object_agg(cp.name, cp.points) as breakdown
    from criterion_points cp group by cp.project_id
  )
  select p.id, p.team_name, p.title, p.stage::text, t.total,
    (select count(*) from complete_ballots b where b.project_id = p.id), t.breakdown,
    row_number() over (order by t.total desc,
      coalesce((t.breakdown->>'الاختبار وإثبات فاعلية المنتج')::numeric, 0) desc,
      coalesce((t.breakdown->>'اكتمال المنتج وعمله فعليًا')::numeric, 0) desc, p.sort_order, p.id)
  from totals t join public.jd_projects p on p.id = t.project_id
  order by 8;
end;
$function$
;

alter table public.jd_scores enable row level security;
drop policy if exists jd_scores_admin_delete_only on public.jd_scores;
create policy jd_scores_admin_delete_only on public.jd_scores as restrictive for DELETE to anon, authenticated using ((COALESCE(jd_is_admin(), false) AND ((auth.jwt() ->> 'judge_id'::text) IS NULL)));
drop policy if exists jd_scores_current_judge_insert on public.jd_scores;
create policy jd_scores_current_judge_insert on public.jd_scores as restrictive for INSERT to anon, authenticated with check (((COALESCE(jd_is_admin(), false) AND ((auth.jwt() ->> 'judge_id'::text) IS NULL)) OR jd_active_judge(judge_id, project_id, criterion_id, true)));
drop policy if exists jd_scores_current_judge_read on public.jd_scores;
create policy jd_scores_current_judge_read on public.jd_scores as restrictive for SELECT to anon, authenticated using (((COALESCE(jd_is_admin(), false) AND ((auth.jwt() ->> 'judge_id'::text) IS NULL)) OR jd_active_judge(judge_id, project_id, criterion_id, false)));
drop policy if exists jd_scores_current_judge_update on public.jd_scores;
create policy jd_scores_current_judge_update on public.jd_scores as restrictive for UPDATE to anon, authenticated using (((COALESCE(jd_is_admin(), false) AND ((auth.jwt() ->> 'judge_id'::text) IS NULL)) OR jd_active_judge(judge_id, project_id, criterion_id, true))) with check (((COALESCE(jd_is_admin(), false) AND ((auth.jwt() ->> 'judge_id'::text) IS NULL)) OR jd_active_judge(judge_id, project_id, criterion_id, true)));

drop trigger if exists jd_check_score_write on public.jd_scores;
create trigger jd_check_score_write before insert or update on public.jd_scores for each row execute function public.jd_check_score_write();

-- Keep the existing public result schema, including enum and rank/count types.
do $$
declare v_return text; v_select text; v_unknown boolean;
begin
  if to_regprocedure('public.jd_results(text)') is null then
    execute 'create function public.jd_results(p_slug text)
      returns table(project_id uuid, team_name text, title text, stage text, final_score numeric, judges_count bigint, per_criterion jsonb, rank bigint)
      language sql stable security definer set search_path = public as ''select * from public.jd_calculated_results(p_slug)''';
  else
    select pg_get_function_result(p.oid),
      string_agg(format('r.%I::%s', p.proargnames[a.i], format_type(p.proallargtypes[a.i], null)), ', ' order by a.i),
      bool_or(p.proargnames[a.i] <> all(array['project_id','team_name','title','stage','final_score','judges_count','per_criterion','rank']))
    into v_return, v_select, v_unknown
    from pg_proc p cross join lateral generate_subscripts(p.proallargtypes, 1) a(i)
    where p.oid = 'public.jd_results(text)'::regprocedure and p.proargmodes[a.i] in ('t', 'o', 'b')
    group by p.oid;
    if v_select is null or v_unknown then raise exception 'Unexpected jd_results signature; migration rolled back'; end if;
    execute format('create or replace function public.jd_results(p_slug text) returns %s language sql stable security definer set search_path = public as %L',
      v_return, 'select ' || v_select || ' from public.jd_calculated_results(p_slug) r');
  end if;
end;
$$;

revoke all on function public.jd_require_admin() from public, anon, authenticated;
revoke all on function public.jd_check_score_write() from public, anon, authenticated;
revoke all on function public.jd_standard_criteria() from public, anon;
revoke all on function public.jd_apply_standard_criteria(uuid, boolean) from public, anon;
revoke all on function public.jd_delete_judge(uuid, uuid) from public, anon;
revoke all on function public.jd_reset_scores(uuid) from public, anon;
grant execute on function public.jd_apply_standard_criteria(uuid, boolean), public.jd_delete_judge(uuid, uuid), public.jd_reset_scores(uuid) to authenticated;
revoke all on function public.jd_calculated_results(text) from public, anon, authenticated;
revoke all on function public.jd_results(text) from public;
grant execute on function public.jd_results(text) to anon, authenticated;
revoke all on function public.jd_active_judge(uuid, uuid, uuid, boolean) from public;
grant execute on function public.jd_active_judge(uuid, uuid, uuid, boolean) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
