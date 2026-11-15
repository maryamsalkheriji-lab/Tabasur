// سيناريوهات «قبل تشغيل ملف SQL» في عملية مستقلة (كل قاعدة PGlite تستهلك نحو غيغابايت من الذاكرة).
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHandler } from '../server/submissions/handler.js'
import { createHarness, NATIONAL_ID, video, consentFile } from './helpers/submissions-harness.mjs'

const { fake, storage, call, uploadBytes, registerTeam, teamReadyForVideo, freshDatabase } = await createHarness()

test('admin review before review-2026-11-12.sql ran: public flow intact, overview says not ready, decision refused with a clear code', async () => {
  const repo = await freshDatabase()
  await repo.db.exec('alter table public.tb_teams drop column review_status, drop column review_at, drop column review_by, drop column review_video')
  const handler = createHandler({ repo, storage: storage(), verifyAdmin: async token => (token === 'admin-token' ? { id: 'u1', email: 'admin@example.com' } : null) })
  const team = await teamReadyForVideo(handler, 'فريق الفجر', 'identity', ['0501111111'])
  const start = await call(handler, { action: 'start', team: { mode: 'existing', code: team.code, mobile: '0501111111' }, video: video() })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  await uploadBytes(start.body.upload)
  assert.equal((await call(handler, { action: 'complete', code: team.code, uploadId: start.body.upload.uploadId })).status, 200)
  assert.equal((await call(handler, { action: 'team', mobile: '0501111111' })).body.team.video.title, 'أسواق المدينة')
  const overview = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.equal(overview.body.review.ready, false)
  assert.deepEqual(overview.body.teams[0].review, { status: 'pending', at: null, by: null, previous: null })
  const refused = await call(handler, { action: 'admin_review', teamId: overview.body.teams[0].id, status: 'qualified' }, { token: 'admin-token' })
  assert.equal(refused.status, 503)
  assert.equal(refused.body.code, 'REVIEW_NOT_MIGRATED')
  // تنظيف الحاوية المشتركة للاختبار التالي
  assert.equal((await call(handler, { action: 'admin_delete_team', teamId: overview.body.teams[0].id }, { token: 'admin-token' })).status, 200)
  assert.deepEqual(fake.videos().map(v => v.key), [])
})

test('declarations before consents-2026-11-15.sql ran: video flow works as before, declaration upload refused with a clear code, admin says not ready', async () => {
  const repo = await freshDatabase()
  await repo.db.exec('drop table public.tb_consents')
  const handler = createHandler({ repo, storage: storage(), verifyAdmin: async token => (token === 'admin-token' ? { id: 'u1', email: 'admin@example.com' } : null) })
  assert.equal((await call(handler, { action: 'config' })).body.consentsReady, false)
  const team = await registerTeam(handler, 'فريق الصباح', 'investment', ['0501111111', '0502222222'])
  assert.deepEqual(team.consents, { ready: false, required: 2, done: 0, complete: true })
  assert.equal(team.members[0].consent, null)
  const refused = await call(handler, { action: 'consent_start', code: team.code, mobile: '0501111111', memberId: team.members[0].id, nationalId: NATIONAL_ID, file: consentFile() })
  assert.deepEqual([refused.status, refused.body.code], [503, 'CONSENTS_NOT_MIGRATED'])
  const start = await call(handler, { action: 'start', team: { mode: 'existing', code: team.code, mobile: '0501111111' }, video: video() })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  await uploadBytes(start.body.upload)
  assert.equal((await call(handler, { action: 'complete', code: team.code, uploadId: start.body.upload.uploadId })).status, 200)
  const overview = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.deepEqual(overview.body.consents, { ready: false, files: 0, bytes: 0 })
  assert.deepEqual([overview.body.stats.consentFiles, overview.body.stats.consentsComplete, overview.body.stats.consentsMissing], [0, 0, 0])
  assert.deepEqual(overview.body.teams[0].consents, { ready: false, required: 2, done: 0, complete: true })
  assert.equal((await call(handler, { action: 'admin_consent_urls', consentIds: ['00000000-0000-0000-0000-000000000000'] }, { token: 'admin-token' })).body.code, 'CONSENTS_NOT_MIGRATED')
  assert.equal((await call(handler, { action: 'admin_delete_team', teamId: overview.body.teams[0].id }, { token: 'admin-token' })).status, 200)
  assert.deepEqual(fake.videos().map(v => v.key), [])
})
