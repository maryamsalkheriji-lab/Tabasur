import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { normalizeGuestName, validateGuestName, rsvpPath } from '../src/lib/rsvp.js'

test('RSVP requires a real name and normalizes Arabic names', () => {
  for (const name of ['', '  ', '\u200b\u200f', '1', '1234', 'أ', 'ا'.repeat(121)]) assert.ok(validateGuestName(name))
  assert.equal(normalizeGuestName('  مريم\u200f   صالح  '), 'مريم صالح')
  assert.equal(validateGuestName('مريم صالح'), '')
  assert.equal(validateGuestName('Jo'), '')
  assert.equal(rsvpPath('madinah-tech'), '/rsvp/madinah-tech')
})

test('RSVP migration: real persistence, safe retries, event isolation and private guest data', async t => {
  const db = new PGlite()
  const event = '00000000-0000-0000-0000-000000000001'
  const other = '00000000-0000-0000-0000-000000000002'
  const receipt = '00000000-0000-0000-0000-000000000011'
  const second = '00000000-0000-0000-0000-000000000012'
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
      create function public.jd_is_admin() returns boolean language sql stable as $$ select coalesce(auth.jwt()->>'admin' = 'true', false) $$;
      create table public.jd_events(id uuid primary key, slug text unique);
      insert into public.jd_events values ('${event}','madinah-tech'),('${other}','other');
      grant usage on schema public, auth to anon, authenticated;
    `)
    const migration = await readFile(new URL('../supabase/rsvp-2026-10-26.sql', import.meta.url), 'utf8')
    await db.exec(migration)
    await db.exec(migration)
    const claims = async (value = {}, role = 'authenticated') => {
      await db.exec('reset role')
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify(value)])
      await db.exec(`set role ${role}`)
    }
    const submit = (name, status, id = receipt, slug = 'madinah-tech') => db.query('select jd_submit_rsvp($1,$2,$3,$4)', [slug, id, name, status])

    await t.test('anonymous guests can confirm or decline; retry updates only their receipt', async () => {
      await claims({}, 'anon')
      await submit('مريم صالح', 'attending')
      await submit('مريم صالح', 'attending')
      await submit('سارة محمد', 'declined', second)
      await submit('مريم صالح', 'declined')
      await claims({ admin: true })
      const { rows } = await db.query('select full_name,status from jd_rsvps order by id')
      assert.deepEqual(rows, [{ full_name: 'مريم صالح', status: 'declined' }, { full_name: 'سارة محمد', status: 'declined' }])
    })
    await t.test('invalid responses and missing events never create rows', async () => {
      await claims({}, 'anon')
      for (const name of [null, '', '  ', 'أ', '1234', 'أ'.repeat(121)]) await assert.rejects(submit(name, 'attending'), /invalid response/)
      await assert.rejects(submit('ضيف جديد', null), /invalid response/)
      await assert.rejects(submit('ضيف جديد', 'maybe'), /invalid response/)
      await assert.rejects(submit('ضيف جديد', 'attending', null), /invalid response/)
      await assert.rejects(submit('ضيف جديد', 'attending', second, 'missing'), /event not found/)
      await assert.rejects(submit('ضيف جديد', 'attending', receipt, 'other'), /invalid response/)
    })
    await t.test('anonymous visitors and judges cannot list, directly change or delete responses', async () => {
      await claims({}, 'anon')
      await assert.rejects(db.query('select * from jd_rsvps'), /permission denied/)
      await assert.rejects(db.query("insert into jd_rsvps values(gen_random_uuid(),$1,'مخالف','attending',now(),now())", [event]), /permission denied/)
      for (const identity of [{}, { judge_id: 'judge', admin: true }]) {
        await claims(identity)
        assert.equal((await db.query('select * from jd_rsvps')).rows.length, 0)
        await assert.rejects(db.query("update jd_rsvps set status='attending'"), /permission denied/)
        await assert.rejects(db.query('delete from jd_rsvps'), /permission denied/)
      }
      await claims({ admin: true })
      assert.equal((await db.query('select * from jd_rsvps where event_id=$1', [event])).rows.length, 2)
      assert.equal((await db.query('select * from jd_rsvps where event_id=$1', [other])).rows.length, 0)
    })
  } finally { await db.close() }
})
