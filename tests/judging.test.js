import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { CAMP_CRITERIA } from '../src/judging/lib.js'
import { teamReportCSV, fetchAllRows, loadTeamReport } from '../src/judging/reports.js'

const event = '00000000-0000-0000-0000-000000000001'
const otherEvent = '00000000-0000-0000-0000-000000000002'
const project = '00000000-0000-0000-0000-000000000011'
const otherProject = '00000000-0000-0000-0000-000000000012'
const judge = '00000000-0000-0000-0000-000000000021'
const secondJudge = '00000000-0000-0000-0000-000000000022'
const otherJudge = '00000000-0000-0000-0000-000000000023'

test('criteria use the requested seven weights, totaling 100', () => {
  assert.deepEqual(CAMP_CRITERIA.map(c => c.weight), [30, 15, 15, 15, 10, 10, 5])
  assert.equal(CAMP_CRITERIA.reduce((sum, c) => sum + c.weight, 0), 100)
})

test('report exports weighted points, final score, unscored teams and safe Arabic cells', () => {
  const lines = teamReportCSV([
    { team_name: 'فريق "أ"', title: '=1+1', final_score: 80, per_criterion: { [CAMP_CRITERIA[0].name]: 24 }, judges_count: 2 },
    { team_name: 'بدون تقييم', final_score: null, per_criterion: {}, judges_count: 0 },
    { team_name: 'درجة صفر', final_score: 0, per_criterion: {}, judges_count: 1 },
  ], CAMP_CRITERIA)
  assert.match(lines[0], /اكتمال المنتج وعمله فعليًا \(من 30\)/)
  assert.match(lines[1], /"فريق ""أ"""/)
  assert.match(lines[1], /"'=1\+1"/)
  assert.match(lines[1], /"24"/)
  assert.match(lines[1], /"80","تقييم مكتمل"$/)
  assert.match(lines[2], /"","لا يوجد تقييم مكتمل"$/)
  assert.match(lines[3], /"0","تقييم مكتمل"$/)
})

test('exports paginate beyond Supabase response limits and propagate failures', async () => {
  const data = Array.from({ length: 1201 }, (_, id) => ({ id }))
  const calls = []
  assert.deepEqual(await fetchAllRows(() => ({ range: async (a, b) => { calls.push([a, b]); return { data: data.slice(a, b + 1) } } })), data)
  assert.equal(calls.length, 3)
  await assert.rejects(fetchAllRows(() => ({ range: async () => ({ error: new Error('offline') }) })), /offline/)
})

test('team report retains unscored and ineligible projects', async () => {
  const projects = [{ id: 'a', team_name: 'مكتمل' }, { id: 'b', team_name: 'لم يُقيّم' }, { id: 'c', team_name: 'مستبعد', eligible: false }]
  const chain = data => ({ select() { return this }, eq() { return this }, order() { return this }, async range(a, b) { return { data: data.slice(a, b + 1) } } })
  const supabase = { rpc: () => chain([{ project_id: 'a', final_score: 80, judges_count: 1, per_criterion: {} }]), from: table => chain(table === 'jd_projects' ? projects : CAMP_CRITERIA) }
  const report = await loadTeamReport(supabase, { id: event, slug: 'test' })
  assert.equal(report.rows.length, 3)
  assert.equal(report.rows[0].final_score, 80)
  assert.equal(report.rows[1].final_score, null)
  assert.equal(report.rows[2].eligible, false)
})

test('database migration, weighted results, access control and scoped deletion', async t => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      create function public.jd_is_admin() returns boolean language sql stable as $$ select coalesce(auth.jwt()->>'admin' = 'true', false) $$;
      create type public.jd_stage as enum ('idea', 'prototype', 'mvp', 'complete');
      create table public.jd_events(id uuid primary key, slug text unique, judging_open boolean default false, results_published boolean default false, reveal_step integer default 0);
      create table public.jd_projects(id uuid primary key, event_id uuid references jd_events, team_name text, title text, stage jd_stage default 'mvp', eligible boolean default true, sort_order integer default 0);
      create table public.jd_judges(id uuid primary key, event_id uuid references jd_events, revoked boolean default false, expires_at timestamptz);
      create table public.jd_criteria(id uuid primary key default gen_random_uuid(), event_id uuid references jd_events, name text, description text, weight numeric, sort_order integer);
      create table public.jd_scores(judge_id uuid references jd_judges, project_id uuid references jd_projects, criterion_id uuid references jd_criteria, score integer check (score between 1 and 5), primary key(judge_id, project_id, criterion_id));
      create policy existing_scores_policy on jd_scores for all to authenticated using (true) with check (true);
      grant usage on schema public, auth to anon, authenticated;
      grant select, insert, update, delete on all tables in schema public to authenticated;
      create function public.jd_results(p_slug text) returns table(project_id uuid, team_name text, title text, stage jd_stage, final_score numeric, judges_count integer, per_criterion jsonb, rank bigint) language sql as $$ select null::uuid,null::text,null::text,null::jd_stage,0::numeric,0::integer,'{}'::jsonb,0::bigint where false $$;
      insert into jd_events(id,slug) values ('${event}','test'), ('${otherEvent}','other');
      insert into jd_projects(id,event_id,team_name,title) values ('${project}','${event}','فريق أ','منتج أ'), ('${otherProject}','${otherEvent}','فريق ب','منتج ب');
      insert into jd_judges(id,event_id) values ('${judge}','${event}'),('${secondJudge}','${event}'),('${otherJudge}','${otherEvent}');
    `)
    const migration = await readFile(new URL('../supabase/judging-update-2026-10-14.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration) // Existing installation and repeated upgrade.
    const claims = async (value, role = 'authenticated') => {
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claims', $1, false)", [JSON.stringify(value)])
      await db.exec(`set role ${role}`)
    }
    await claims({ admin: true })
    await db.query('select jd_apply_standard_criteria($1)', [event])
    await db.query('select jd_apply_standard_criteria($1)', [otherEvent])
    const criteria = (await db.query('select * from jd_criteria where event_id = $1 order by sort_order', [event])).rows
    assert.deepEqual(criteria.map(c => [c.name, Number(c.weight), c.description]), CAMP_CRITERIA.map(c => [c.name, c.weight, c.description]))
    await db.query('update jd_events set judging_open = true')
    for (const c of criteria) await db.query('insert into jd_scores values ($1,$2,$3,5)', [judge, project, c.id])
    await db.query('insert into jd_scores values ($1,$2,$3,1)', [secondJudge, project, criteria[0].id])
    const baselineProjects = (await db.query('select * from jd_projects order by id')).rows

    await t.test('complete ballots only; weighted final score and per-criterion totals agree', async () => {
      let row = (await db.query("select * from jd_results('test')")).rows[0]
      assert.equal(Number(row.final_score), 100)
      assert.equal(Number(row.judges_count), 1)
      assert.equal(Number(row.per_criterion[CAMP_CRITERIA[0].name]), 30)
      for (const c of criteria.slice(1)) await db.query('insert into jd_scores values ($1,$2,$3,1)', [secondJudge, project, c.id])
      row = (await db.query("select * from jd_results('test')")).rows[0]
      assert.equal(Number(row.final_score), 60)
      assert.equal(Object.values(row.per_criterion).reduce((a,b) => a + Number(b), 0), 60)
      assert.equal(Number(row.judges_count), 2)
    })

    await t.test('judge may select and edit own evaluation but cannot read others or results', async () => {
      await claims({ judge_id: judge, event_id: event })
      assert.equal((await db.query('select * from jd_scores')).rows.length, 7)
      await db.query('update jd_scores set score = 4 where criterion_id = $1', [criteria[0].id])
      await assert.rejects(db.query("select * from jd_results('test')"), /not allowed/)
      await assert.rejects(db.query('select jd_delete_judge($1,$2)', [event, secondJudge]), /not allowed/)
      await assert.rejects(db.query('select jd_reset_scores($1)', [event]), /not allowed/)
      await assert.rejects(db.query('select jd_apply_standard_criteria($1,true)', [event]), /not allowed/)
      await assert.rejects(db.query('insert into jd_scores values ($1,$2,$3,4)', [judge, otherProject, criteria[0].id]), /not allowed|row-level security/)
      assert.equal((await db.query('delete from jd_scores returning *')).rows.length, 0)
    })

    await t.test('public results require publication; judge token stays blocked after publication', async () => {
      await claims({}, 'anon')
      await assert.rejects(db.query("select * from jd_results('test')"), /results not published/)
      await claims({ admin: true })
      await db.query('update jd_events set results_published = true where id = $1', [event])
      await claims({}, 'anon')
      assert.equal((await db.query("select * from jd_results('test')")).rows.length, 1)
      await claims({ judge_id: judge, event_id: event })
      await assert.rejects(db.query("select * from jd_results('test')"), /not allowed/)
    })

    await t.test('revoked/deleted judges cannot reuse an existing token; deletion stays event-scoped', async () => {
      await claims({ admin: true })
      await db.query('update jd_judges set revoked = true where id = $1', [judge])
      await claims({ judge_id: judge, event_id: event })
      assert.equal((await db.query('select * from jd_scores')).rows.length, 0)
      await assert.rejects(db.query('insert into jd_scores values ($1,$2,$3,4) on conflict (judge_id,project_id,criterion_id) do update set score=4', [judge, project, criteria[0].id]), /not allowed|row-level security/)
      await claims({ admin: true })
      await assert.rejects(db.query('select jd_delete_judge($1,$2)', [event, otherJudge]), /judge not found/)
      await db.query('select jd_delete_judge($1,$2)', [event, judge])
      assert.equal((await db.query('select * from jd_scores where judge_id = $1', [judge])).rows.length, 0)
      assert.deepEqual((await db.query('select * from jd_projects order by id')).rows, baselineProjects)
      await claims({ judge_id: judge, event_id: event })
      await assert.rejects(db.query('insert into jd_scores values ($1,$2,$3,4)', [judge, project, criteria[0].id]), /not allowed|row-level security/)
    })

    await t.test('criteria replacement requires closed judging and explicit approval of old scores', async () => {
      await claims({ admin: true })
      await assert.rejects(db.query('select jd_apply_standard_criteria($1,true)', [event]), /أغلق/)
      await db.query('update jd_events set judging_open=false, results_published=false where id=$1', [event])
      await assert.rejects(db.query('select jd_apply_standard_criteria($1)', [event]), /توجد تقييمات/)
      await assert.rejects(db.query('select jd_apply_standard_criteria($1,null)', [event]), /توجد تقييمات/)
      assert.equal((await db.query('select * from jd_scores')).rows.length, 7)
      await db.query('select jd_apply_standard_criteria($1,true)', [event])
      assert.equal((await db.query('select * from jd_scores')).rows.length, 0)
      assert.deepEqual((await db.query('select * from jd_projects order by id')).rows, baselineProjects)
    })

    await t.test('reset clears only this event and preserves projects, judges and criteria', async () => {
      await claims({ admin: true })
      const allCriteria = (await db.query('select * from jd_criteria')).rows
      for (const c of allCriteria) await db.query('insert into jd_scores values ($1,$2,$3,3)', [c.event_id === event ? secondJudge : otherJudge, c.event_id === event ? project : otherProject, c.id])
      await db.query('select jd_reset_scores($1)', [event])
      const remaining = (await db.query('select * from jd_scores')).rows
      assert.equal(remaining.length, 7)
      assert.ok(remaining.every(s => s.project_id === otherProject))
      assert.deepEqual((await db.query('select * from jd_projects order by id')).rows, baselineProjects)
      assert.equal((await db.query('select * from jd_judges')).rows.length, 2)
      assert.equal((await db.query('select * from jd_criteria')).rows.length, 14)
      const ev = (await db.query('select * from jd_events where id=$1', [event])).rows[0]
      assert.equal(ev.judging_open, false)
      assert.equal(ev.results_published, false)
      await claims({ judge_id: secondJudge, event_id: event })
      const criterion = allCriteria.find(c => c.event_id === event)
      await assert.rejects(db.query('insert into jd_scores values ($1,$2,$3,4)', [secondJudge, project, criterion.id]), /not allowed|row-level security/)
    })
  } finally { await db.close() }
})
