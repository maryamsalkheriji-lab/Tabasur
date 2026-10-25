import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { CAMP_CRITERIA } from '../src/judging/lib.js'

test('replace old camp rubric without affecting projects, judges, other events or new scores on retry', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create table jd_events (id uuid primary key default gen_random_uuid(), slug text unique, judging_open boolean default true, results_published boolean default true, reveal_step int default 3);
      create table jd_projects (id uuid primary key default gen_random_uuid(), event_id uuid references jd_events, title text);
      create table jd_judges (id uuid primary key default gen_random_uuid(), event_id uuid references jd_events, name text);
      create table jd_criteria (id uuid primary key default gen_random_uuid(), event_id uuid references jd_events, name text, description text, weight numeric, sort_order int);
      create table jd_scores (id uuid primary key default gen_random_uuid(), criterion_id uuid references jd_criteria, score int);
      insert into jd_events(slug) values ('ai-hackathon'), ('other-event');
      insert into jd_projects(event_id,title) select id, 'مشروع محفوظ' from jd_events;
      insert into jd_judges(event_id,name) select id, 'محكّم محفوظ' from jd_events;
      insert into jd_criteria(event_id,name,weight,sort_order) select id,'معيار قديم',100,1 from jd_events;
      insert into jd_scores(criterion_id,score) select id,4 from jd_criteria;
    `)
    const rows = async table => (await db.query(`select * from ${table} order by id`)).rows
    const projects = await rows('jd_projects'), judges = await rows('jd_judges')
    const otherCriteria = (await db.query("select c.* from jd_criteria c join jd_events e on e.id=c.event_id where e.slug='other-event'")).rows
    const script = await readFile(new URL('../supabase/replace-camp-criteria.sql', import.meta.url), 'utf8')
    // A single prepared statement works without a temporary table or prior session.
    const oldCriteria = await rows('jd_criteria'), oldScores = await rows('jd_scores')
    await db.exec('alter table jd_criteria add constraint simulate_insert_failure check (weight <> 30)')
    await assert.rejects(db.query(script), /simulate_insert_failure/)
    assert.deepEqual(await rows('jd_criteria'), oldCriteria)
    assert.deepEqual(await rows('jd_scores'), oldScores)
    await db.exec('alter table jd_criteria drop constraint simulate_insert_failure')
    await db.query(script)
    const rubric = (await db.query("select c.* from jd_criteria c join jd_events e on e.id=c.event_id where e.slug='ai-hackathon' order by sort_order")).rows
    assert.deepEqual(rubric.map(({name,description,weight,sort_order}) => ({name,description,weight:Number(weight),sort_order})), CAMP_CRITERIA.map(({name,description,weight,sort_order}) => ({name,description,weight,sort_order})))
    assert.deepEqual(await rows('jd_projects'), projects)
    assert.deepEqual(await rows('jd_judges'), judges)
    assert.deepEqual((await db.query("select c.* from jd_criteria c join jd_events e on e.id=c.event_id where e.slug='other-event'")).rows, otherCriteria)
    assert.equal((await rows('jd_scores')).length, 1)
    const state = (await db.query("select * from jd_events where slug='ai-hackathon'")).rows[0]
    assert.equal(state.results_published, false)
    assert.equal(state.judging_open, true)
    await db.query('insert into jd_scores(criterion_id,score) values ($1,5)', [rubric[0].id])
    const newScores = await rows('jd_scores')
    await db.query(script)
    assert.deepEqual(await rows('jd_scores'), newScores)
  } finally { await db.close() }
})
