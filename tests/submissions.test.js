import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_MEMBERS } from '../server/submissions/keys.js'
import { startFakeStorage } from './helpers/fake-storage.mjs'
import { mobileKeyFromStored, nameKey, teamNameKey, driveFileName, parseMobile } from '../server/submissions/keys.js'
import { createDevDatabase } from '../server/submissions/dev-db.js'
import { createStorage, resumableEndpoint, TUS_CHUNK_SIZE } from '../server/submissions/storage.js'
import { createHandler, CHUNK_SIZE } from '../server/submissions/handler.js'
import { PUBLICATION_POLICY } from '../src/lib/remote-camp.js'

process.env.VERCEL_ENV = 'test'
const fake = await startFakeStorage()
const storage = () => createStorage(fake.config())

function response() {
  return { headers: {}, statusCode: 0, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = body ? JSON.parse(body) : null; this.writableEnded = true } }
}
async function call(handler, payload, { token, ip = '1.1.1.1' } = {}) {
  const req = { method: 'POST', headers: { 'x-forwarded-for': ip, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) }
  const res = response()
  await handler(req, res)
  return { status: res.statusCode, body: res.body, headers: res.headers }
}
const consent = { accepted: true, version: PUBLICATION_POLICY.version, lang: 'ar' }
const video = (overrides = {}) => ({ fileName: 'city.mp4', size: 7 * 1024 * 1024 + 123, mimeType: 'video/mp4', title: 'أسواق المدينة', ...overrides })
const b64 = value => Buffer.from(String(value), 'utf8').toString('base64')

// يرفع البايتات كما يفعل المتصفح: إنشاء TUS بالتوكن الموقّع ثم قطع 6 ميغابايت متتابعة.
async function uploadBytes(upload, { stopAfterChunks = Infinity } = {}) {
  const created = await fetch(upload.endpoint, {
    method: 'POST',
    headers: {
      'Tus-Resumable': '1.0.0', 'Upload-Length': String(upload.size), 'x-signature': upload.token, 'x-upsert': 'true', authorization: 'Bearer anon-key', apikey: 'anon-key',
      'Upload-Metadata': `bucketName ${b64(upload.bucket)},objectName ${b64(upload.objectPath)},contentType ${b64(upload.mimeType)},cacheControl ${b64('3600')}`,
    },
  })
  assert.equal(created.status, 201, await created.text())
  const location = created.headers.get('location')
  let offset = 0, sent = 0
  while (offset < upload.size && sent < stopAfterChunks) {
    const end = Math.min(upload.size, offset + upload.chunkSize)
    const res = await fetch(location, { method: 'PATCH', headers: { 'Tus-Resumable': '1.0.0', 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' }, body: Buffer.alloc(end - offset, 7) })
    assert.equal(res.status, 204, await res.text())
    offset = Number(res.headers.get('upload-offset'))
    sent += 1
  }
  return { location, offset }
}

test.after(() => fake.close())

test('keys: mobiles, names and display file names normalize predictably', () => {
  assert.equal(mobileKeyFromStored('0501234567'), '966501234567')
  assert.equal(mobileKeyFromStored('+201001234567'), '201001234567')
  assert.equal(parseMobile('٠٥٠١٢٣٤٥٦٧').key, '966501234567')
  assert.equal(parseMobile('+966 50 123 4567').stored, '0501234567')
  assert.equal(parseMobile('12345').ok, false)
  assert.equal(nameKey('سارةُ محمّد الحربي'), nameKey('ساره محمد  الحربى'))
  assert.notEqual(nameKey('سارة محمد الحربي'), nameKey('سارة محمد العمري'))
  assert.equal(teamNameKey(' فريق  النُّور '), 'فريق النور')
  assert.equal(driveFileName('TB-007', 'فريق النور/الإبداع', 'أسواق: المدينة؟', 'mp4'), 'TB-007 - فريق النور الإبداع - أسواق المدينة؟.mp4')
  assert.equal(CHUNK_SIZE, TUS_CHUNK_SIZE)
  assert.equal(resumableEndpoint('https://hmxnubgqtygipxuxyuqt.supabase.co'), 'https://hmxnubgqtygipxuxyuqt.storage.supabase.co/storage/v1/upload/resumable/sign')
  assert.equal(resumableEndpoint('http://127.0.0.1:5000'), 'http://127.0.0.1:5000/storage/v1/upload/resumable/sign')
})

test('full flow: lookup, register a team, resumable upload of one video, replace it, and read the receipt', async () => {
  const repo = await createDevDatabase()
  const handler = createHandler({ repo, storage: storage() })

  const config = await call(handler, { action: 'config' })
  assert.equal(config.status, 200)
  assert.deepEqual([config.body.open, config.body.uploadReady, config.body.chunkSize], [true, true, CHUNK_SIZE])

  const lookup = await call(handler, { action: 'lookup', mobiles: ['0501111111', '0599999999', 'abc', { number: '1001234567', country: 'EG' }] })
  assert.equal(lookup.status, 200)
  assert.deepEqual(lookup.body.results.map(r => r.status), ['ok', 'not_registered', 'invalid', 'ok'])
  assert.equal(lookup.body.results[0].name, 'سارة محمد الحربي')
  assert.equal(lookup.body.results[3].mobile, '+201001234567')

  const start = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق النور', track: 'life', mobiles: ['0501111111', '0504444444'] }, video: video(), consent })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  assert.equal(start.body.created, true)
  assert.equal(start.body.team.code, 'TB-001')
  assert.deepEqual(start.body.team.members.map(m => [m.name, m.leader, m.mobile]), [['سارة محمد الحربي', true, '05•••••111'], ['محمد عبدالله الخيبري', false, '05•••••444']])
  const upload = start.body.upload
  assert.match(upload.objectPath, /^life\/TB-001\/TB-001-[a-z0-9]+\.mp4$/)
  assert.equal(upload.displayName, 'TB-001 - فريق النور - أسواق المدينة.mp4')
  assert.equal(upload.endpoint, `${fake.base}/storage/v1/upload/resumable/sign`)
  assert.equal(upload.bucket, 'submissions')
  assert.ok(upload.token)

  // رفع ناقص (قطعة واحدة من اثنتين) → complete يرفض
  const partial = await uploadBytes(upload, { stopAfterChunks: 1 })
  assert.equal(partial.offset, CHUNK_SIZE)
  const status = await call(handler, { action: 'status', code: 'TB-001', uploadId: upload.uploadId })
  assert.deepEqual([status.body.complete, status.body.found], [false, false])
  const early = await call(handler, { action: 'complete', code: 'TB-001', uploadId: upload.uploadId })
  assert.equal(early.status, 409)
  assert.equal(early.body.code, 'UPLOAD_INCOMPLETE')

  // طلب start لنفس الملف يعيد التوكن والجلسة نفسها (استئناف)
  const again = await call(handler, { action: 'start', team: { mode: 'existing', code: 'tb-001', mobile: '0504444444' }, video: video(), consent })
  assert.equal(again.status, 200)
  assert.equal(again.body.upload.uploadId, upload.uploadId)
  assert.equal(again.body.upload.token, upload.token)

  await uploadBytes(upload)
  const done = await call(handler, { action: 'complete', code: 'TB-001', uploadId: upload.uploadId })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.equal(done.body.team.video.fileName, 'TB-001 - فريق النور - أسواق المدينة.mp4')
  assert.equal(done.body.team.video.size, video().size)
  assert.equal(done.body.team.pending, null)
  assert.deepEqual(fake.videos().map(v => [v.key, v.size]), [[`submissions/${upload.objectPath}`, video().size]])

  const byMobile = await call(handler, { action: 'team', mobile: '0504444444' })
  assert.equal(byMobile.body.team.code, 'TB-001')
  const byCode = await call(handler, { action: 'team', code: 'TB-001' })
  assert.equal(byCode.body.team.video.title, 'أسواق المدينة')

  // استبدال الفيديو: الجديد يُعتمد والقديم يُحذف من الحاوية
  const replace = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0501111111' }, video: video({ fileName: 'better.mov', mimeType: 'video/quicktime', size: 2 * 1024 * 1024, title: 'نسخة أفضل' }), consent })
  assert.equal(replace.status, 200)
  assert.equal(replace.body.upload.replaces, true)
  assert.equal(replace.body.upload.displayName, 'TB-001 - فريق النور - نسخة أفضل.mov')
  assert.match(replace.body.upload.objectPath, /\.mov$/)
  await uploadBytes(replace.body.upload)
  const replaced = await call(handler, { action: 'complete', code: 'TB-001', uploadId: replace.body.upload.uploadId })
  assert.equal(replaced.status, 200)
  assert.equal(replaced.body.team.video.fileName, 'TB-001 - فريق النور - نسخة أفضل.mov')
  assert.deepEqual(fake.videos().map(v => v.key), [`submissions/${replace.body.upload.objectPath}`])

  // الحذف للقائد فقط
  const denied = await call(handler, { action: 'remove_video', code: 'TB-001', mobile: '0504444444' })
  assert.equal(denied.body.code, 'LEADER_ONLY')
  const removed = await call(handler, { action: 'remove_video', code: 'TB-001', mobile: '0501111111' })
  assert.equal(removed.status, 200)
  assert.equal(removed.body.team.video, null)
  assert.deepEqual(fake.videos(), [])

  const log = (await repo.db.query('select action from public.tb_upload_log order by id')).rows.map(r => r.action)
  assert.deepEqual(log, ['team_created', 'upload_started', 'upload_completed', 'upload_started', 'upload_completed', 'previous_removed', 'video_removed'])
})

test('governance: one person in one team only, by mobile and by name, and no two teams share a name', async () => {
  const repo = await createDevDatabase()
  const handler = createHandler({ repo, storage: storage() })
  const first = await call(handler, { action: 'start', team: { mode: 'new', name: 'الفريق الأول', track: 'identity', mobiles: ['0501111111', '0505555555'] }, video: video(), consent })
  assert.equal(first.status, 200, JSON.stringify(first.body))

  const sameMobile = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق آخر', track: 'life', mobiles: ['0502222222', '0501111111'] }, video: video(), consent })
  assert.equal(sameMobile.status, 409)
  assert.deepEqual([sameMobile.body.code, sameMobile.body.mobile, sameMobile.body.teamCode], ['MOBILE_TAKEN', '0501111111', 'TB-001'])

  // ريم فهد القحطاني مسجّلة مرتين برقمين مختلفين: الاسم نفسه لا يدخل فريقًا ثانيًا
  const sameName = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق آخر', track: 'life', mobiles: ['0506666666'] }, video: video(), consent })
  assert.equal(sameName.status, 409)
  assert.equal(sameName.body.code, 'MOBILE_TAKEN')
  const lookup = await call(handler, { action: 'lookup', mobiles: ['0506666666'] })
  assert.equal(lookup.body.results[0].status, 'in_team')

  const sameTeamName = await call(handler, { action: 'start', team: { mode: 'new', name: ' الفريقُ الاول ', track: 'life', mobiles: ['0502222222'] }, video: video(), consent })
  assert.equal(sameTeamName.status, 409)
  assert.equal(sameTeamName.body.code, 'TEAM_NAME_TAKEN')

  const duplicateInForm = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق ثالث', track: 'life', mobiles: ['0502222222', '+966502222222'] }, video: video(), consent })
  assert.equal(duplicateInForm.body.code, 'DUPLICATE_MEMBER')
  const unregistered = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق ثالث', track: 'life', mobiles: ['0502222222', '0598765432'] }, video: video(), consent })
  assert.deepEqual([unregistered.status, unregistered.body.code, unregistered.body.mobile], [400, 'NOT_REGISTERED', '0598765432'])
  // لا عدد محدد للفريق؛ يبقى سقف تقني (MAX_MEMBERS) لا يُعرض للمشاركين
  const tooMany = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق ثالث', track: 'life', mobiles: Array.from({ length: MAX_MEMBERS + 1 }, (_, i) => `05${String(10000000 + i).padStart(8, '0')}`) }, video: video(), consent })
  assert.equal(tooMany.body.code, 'INVALID_MEMBERS')
  const sixMembers = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق ثالث', track: 'life', mobiles: ['0502222222', '0503333333', '0507777777', '0508888888', '0509999999', '0500000000'] }, video: video(), consent })
  assert.notEqual(sixMembers.body.code, 'INVALID_MEMBERS', 'six members are no longer refused for their number')

  const notMember = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0502222222' }, video: video(), consent })
  assert.equal(notMember.body.code, 'NOT_A_MEMBER')
  assert.equal((await call(handler, { action: 'team', code: 'TB-999' })).body.code, 'TEAM_NOT_FOUND')
  assert.equal((await call(handler, { action: 'team', code: 'nope' })).body.code, 'INVALID_CODE')
  assert.equal((await repo.db.query('select count(*)::int as n from public.tb_teams')).rows[0].n, 1)
})

test('validation: video, consent, closed state, deadline, storage not configured, size limit, bad token', async () => {
  const repo = await createDevDatabase()
  const unconfigured = createHandler({ repo, storage: null })
  const team = { mode: 'new', name: 'فريق', track: 'life', mobiles: ['0502222222'] }
  const notReady = await call(unconfigured, { action: 'start', team, video: video(), consent })
  assert.deepEqual([notReady.status, notReady.body.code], [503, 'STORAGE_NOT_CONFIGURED'])
  assert.equal((await call(unconfigured, { action: 'config' })).body.uploadReady, false)

  const handler = createHandler({ repo, storage: storage() })
  assert.equal((await call(handler, { action: 'start', team, video: video({ fileName: 'deck.pdf', mimeType: 'application/pdf' }), consent })).body.code, 'INVALID_VIDEO_TYPE')
  assert.equal((await call(handler, { action: 'start', team, video: video({ size: 3 * 1024 ** 3 }), consent })).body.code, 'VIDEO_TOO_LARGE')
  assert.equal((await call(handler, { action: 'start', team, video: video({ title: 'x' }), consent })).body.code, 'INVALID_TITLE')
  assert.equal((await call(handler, { action: 'start', team, video: video(), consent: { accepted: false } })).body.code, 'CONSENT_REQUIRED')
  assert.equal((await call(handler, { action: 'start', team, video: video(), consent: { accepted: true, version: 'old' } })).body.code, 'CONSENT_OUTDATED')
  assert.equal((await call(handler, { action: 'start', team: { ...team, track: 'food' }, video: video(), consent })).body.code, 'INVALID_TRACK')
  assert.equal((await call(handler, { action: 'start', team: { ...team, name: 'x' }, video: video(), consent })).body.code, 'INVALID_TEAM_NAME')
  assert.equal((await call(handler, { action: 'nope' })).body.code, 'UNKNOWN_ACTION')

  await repo.writeSetting('submissions', { open: false })
  assert.equal((await call(handler, { action: 'start', team, video: video(), consent })).body.code, 'SUBMISSIONS_CLOSED')
  await repo.writeSetting('submissions', { open: true, deadline: '2020-01-01T00:00:00.000Z' })
  assert.equal((await call(handler, { action: 'start', team, video: video(), consent })).body.code, 'DEADLINE_PASSED')
  await repo.writeSetting('submissions', { open: true, deadline: null, max_bytes: 1024 * 1024 })
  assert.equal((await call(handler, { action: 'start', team, video: video(), consent })).body.code, 'VIDEO_TOO_LARGE')
  assert.equal((await repo.db.query('select count(*)::int as n from public.tb_teams')).rows[0].n, 0, 'nothing is registered when validation fails')

  // التوكن يسمح بمسار واحد فقط: محاولة رفع إلى مسار آخر تُرفض
  await repo.writeSetting('submissions', { open: true })
  const start = await call(handler, { action: 'start', team, video: video(), consent })
  const forged = await fetch(start.body.upload.endpoint, { method: 'POST', headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': '10', 'x-signature': start.body.upload.token, 'Upload-Metadata': `bucketName ${b64('submissions')},objectName ${b64('life/TB-999/other.mp4')}` } })
  assert.equal(forged.status, 403)

  const get = response()
  await handler({ method: 'GET', headers: {} }, get)
  assert.equal(get.statusCode, 405)
})

test('admin: overview with storage usage, settings, signed view links, delete team, remove member; non-admins are refused', async () => {
  const repo = await createDevDatabase()
  const handler = createHandler({ repo, storage: storage(), verifyAdmin: async token => (token === 'admin-token' ? { id: 'u1', email: 'admin@example.com' } : null) })
  assert.equal((await call(handler, { action: 'admin_overview' })).status, 401)
  assert.equal((await call(handler, { action: 'admin_overview' }, { token: 'wrong' })).status, 403)

  const start = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق النور', track: 'destination', mobiles: ['0501111111', '0502222222', '0503333333'] }, video: video(), consent })
  await uploadBytes(start.body.upload)
  await call(handler, { action: 'complete', code: start.body.team.code, uploadId: start.body.upload.uploadId })
  await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق البحر', track: 'life', mobiles: ['0505555555'] }, video: video(), consent })

  const overview = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.deepEqual(overview.body.storage, { configured: true, bucket: 'submissions', usedBytes: video().size, includedBytes: 100 * 1024 ** 3 })
  assert.deepEqual(overview.body.stats, { teams: 2, withVideo: 1, members: 4, qualified: 0, rejected: 0, undecided: 1, inperson: 2, registrations: 8 })
  assert.equal(overview.body.review.ready, true)
  const nour = overview.body.teams.find(t => t.name === 'فريق النور')
  assert.equal(nour.type, 'mixed')
  assert.deepEqual(nour.members.map(m => [m.name, m.inPerson, m.leader]), [['سارة محمد الحربي', true, true], ['عبدالله خالد العمري', false, false], ['نورة سعد الجهني', true, false]])
  assert.equal(nour.video.name, 'TB-001 - فريق النور - أسواق المدينة.mp4')
  assert.match(nour.video.path, /^destination\/TB-001\//)
  const sea = overview.body.teams.find(t => t.name === 'فريق البحر')
  assert.equal(sea.type, 'online')
  assert.equal(sea.video, null)
  assert.equal(sea.pending.fileName, 'city.mp4')

  const links = await call(handler, { action: 'admin_video_url', teamId: nour.id }, { token: 'admin-token' })
  assert.equal(links.status, 200, JSON.stringify(links.body))
  assert.match(links.body.url, /\/object\/sign\/submissions\/destination\/TB-001\//)
  assert.match(links.body.downloadUrl, /download=/)
  assert.equal((await call(handler, { action: 'admin_video_url', teamId: sea.id }, { token: 'admin-token' })).body.code, 'VIDEO_NOT_FOUND')

  // قرار التأهّل: لوحة الإدارة فقط، ومربوط بالفيديو الذي اتُّخذ عليه
  assert.deepEqual(nour.review, { status: 'pending', at: null, by: null, previous: null })
  assert.equal((await call(handler, { action: 'admin_review', teamId: nour.id, status: 'winner' }, { token: 'admin-token' })).body.code, 'INVALID_REVIEW')
  assert.equal((await call(handler, { action: 'admin_review', teamId: sea.id, status: 'qualified' }, { token: 'admin-token' })).body.code, 'VIDEO_NOT_FOUND')
  assert.equal((await call(handler, { action: 'admin_review', teamId: nour.id, status: 'qualified' })).status, 401)
  const qualified = await call(handler, { action: 'admin_review', teamId: nour.id, status: 'qualified' }, { token: 'admin-token' })
  assert.equal(qualified.status, 200, JSON.stringify(qualified.body))
  assert.equal(qualified.body.review.status, 'qualified')
  assert.equal(qualified.body.review.by, 'admin@example.com')
  assert.ok(Number.isFinite(Date.parse(qualified.body.review.at)))
  let view = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.equal(view.body.teams.find(t => t.id === nour.id).review.status, 'qualified')
  assert.deepEqual([view.body.stats.qualified, view.body.stats.rejected, view.body.stats.undecided], [1, 0, 0])
  // الواجهة العامة لا تكشف القرار بأي صورة
  const publicCard = await call(handler, { action: 'team', code: nour.code })
  assert.equal(publicCard.status, 200)
  assert.doesNotMatch(JSON.stringify(publicCard.body), /review|qualified/)
  // استبدال الفيديو بعد القرار يعيد الفريق إلى «بلا قرار» مع ذكر القرار السابق
  const replace = await call(handler, { action: 'start', team: { mode: 'existing', code: nour.code, mobile: '0501111111' }, video: video({ fileName: 'cut2.mp4', title: 'نسخة أحدث' }), consent })
  assert.equal(replace.status, 200, JSON.stringify(replace.body))
  await uploadBytes(replace.body.upload)
  assert.equal((await call(handler, { action: 'complete', code: nour.code, uploadId: replace.body.upload.uploadId })).status, 200)
  view = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.deepEqual(view.body.teams.find(t => t.id === nour.id).review, { status: 'pending', at: null, by: null, previous: 'qualified' })
  assert.deepEqual([view.body.stats.qualified, view.body.stats.undecided], [0, 1])
  assert.equal((await call(handler, { action: 'admin_review', teamId: nour.id, status: 'rejected' }, { token: 'admin-token' })).body.review.status, 'rejected')
  assert.deepEqual((await call(handler, { action: 'admin_review', teamId: nour.id, status: 'pending' }, { token: 'admin-token' })).body.review, { status: 'pending', at: null, by: null, previous: null })

  const settings = await call(handler, { action: 'admin_settings', open: false, deadline: '2026-12-01T20:59:00.000Z', maxBytes: 512 * 1024 * 1024 }, { token: 'admin-token' })
  assert.deepEqual(settings.body.settings, { open: false, deadline: '2026-12-01T20:59:00.000Z', maxBytes: 512 * 1024 * 1024 })
  assert.equal((await call(handler, { action: 'admin_settings', deadline: 'tomorrow' }, { token: 'admin-token' })).body.code, 'INVALID_DEADLINE')

  const removed = await call(handler, { action: 'admin_remove_member', memberId: nour.members[1].id }, { token: 'admin-token' })
  assert.equal(removed.status, 200)
  assert.equal((await call(handler, { action: 'admin_remove_member', memberId: sea.members[0].id }, { token: 'admin-token' })).body.code, 'LAST_MEMBER')
  const deleted = await call(handler, { action: 'admin_delete_team', teamId: nour.id }, { token: 'admin-token' })
  assert.equal(deleted.status, 200)
  assert.deepEqual(fake.videos(), [], 'the deleted team video left the bucket')
  const after = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.deepEqual(after.body.teams.map(t => t.name), ['فريق البحر'])
  assert.equal((await call(handler, { action: 'lookup', mobiles: ['0502222222', '0501111111'] })).body.results.map(r => r.status).join(','), 'ok,ok')
})

test('admin review before review-2026-11-12.sql ran: public flow intact, overview says not ready, decision refused with a clear code', async () => {
  const repo = await createDevDatabase()
  await repo.db.exec('alter table public.tb_teams drop column review_status, drop column review_at, drop column review_by, drop column review_video')
  const handler = createHandler({ repo, storage: storage(), verifyAdmin: async token => (token === 'admin-token' ? { id: 'u1', email: 'admin@example.com' } : null) })
  const start = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق الفجر', track: 'identity', mobiles: ['0501111111'] }, video: video(), consent })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  await uploadBytes(start.body.upload)
  assert.equal((await call(handler, { action: 'complete', code: start.body.team.code, uploadId: start.body.upload.uploadId })).status, 200)
  assert.equal((await call(handler, { action: 'team', mobile: '0501111111' })).body.team.video.title, 'أسواق المدينة')
  const overview = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.equal(overview.body.review.ready, false)
  assert.deepEqual(overview.body.teams[0].review, { status: 'pending', at: null, by: null, previous: null })
  const refused = await call(handler, { action: 'admin_review', teamId: overview.body.teams[0].id, status: 'qualified' }, { token: 'admin-token' })
  assert.equal(refused.status, 503)
  assert.equal(refused.body.code, 'REVIEW_NOT_MIGRATED')
})
