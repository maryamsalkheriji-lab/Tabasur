import test from 'node:test'
import assert from 'node:assert/strict'
import { startFakeDrive } from './helpers/fake-drive.mjs'
import { mobileKeyFromStored, nameKey, teamNameKey, driveFileName, parseMobile } from '../server/submissions/keys.js'
import { createDevDatabase } from '../server/submissions/dev-db.js'
import { PUBLICATION_POLICY } from '../src/lib/remote-camp.js'

const fake = await startFakeDrive()
Object.assign(process.env, fake.env())
process.env.VERCEL_ENV = 'test'
const { createHandler, createOAuthCallback, CHUNK_SIZE } = await import('../server/submissions/handler.js')

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
const video = (overrides = {}) => ({ fileName: 'city.mp4', size: 3 * 1024 * 1024 + 123, mimeType: 'video/mp4', title: 'أسواق المدينة', ...overrides })

async function connectDrive(repo) {
  await repo.writeSecret('drive_oauth', { client_id: 'abc.apps.googleusercontent.com', client_secret: 'secret-secret', refresh_token: 'fake-refresh-token', email: 'organizer@example.com', connected_at: new Date().toISOString() })
}

// يرفع البايتات إلى رابط الجلسة كما يفعل المتصفح (قطع متتابعة مع Content-Range).
async function uploadBytes(sessionUri, size, chunk = 1024 * 1024) {
  let offset = 0, last = null
  while (offset < size) {
    const end = Math.min(size, offset + chunk)
    const res = await fetch(sessionUri, { method: 'PUT', headers: { 'Content-Range': `bytes ${offset}-${end - 1}/${size}` }, body: Buffer.alloc(end - offset, 7) })
    if (res.status === 308) { offset = Number(/bytes=0-(\d+)/.exec(res.headers.get('range'))[1]) + 1; continue }
    assert.ok(res.ok, `chunk status ${res.status}`)
    last = await res.json(); offset = size
  }
  return last
}

test.after(() => fake.close())

test('keys: mobiles, names and Drive file names normalize predictably', () => {
  assert.equal(mobileKeyFromStored('0501234567'), '966501234567')
  assert.equal(mobileKeyFromStored('+201001234567'), '201001234567')
  assert.equal(parseMobile('٠٥٠١٢٣٤٥٦٧').key, '966501234567')
  assert.equal(parseMobile('+966 50 123 4567').stored, '0501234567')
  assert.equal(parseMobile('12345').ok, false)
  assert.equal(nameKey('سارةُ محمّد الحربي'), nameKey('ساره محمد  الحربى'))
  assert.notEqual(nameKey('سارة محمد الحربي'), nameKey('سارة محمد العمري'))
  assert.equal(teamNameKey(' فريق  النُّور '), 'فريق النور')
  assert.equal(driveFileName('TB-007', 'فريق النور/الإبداع', 'أسواق: المدينة؟', 'mp4'), 'TB-007 - فريق النور الإبداع - أسواق المدينة؟.mp4')
})

test('full flow: lookup, register a team, upload one video to the track folder, replace it, and read the receipt', async () => {
  const repo = await createDevDatabase()
  await connectDrive(repo)
  const handler = createHandler({ repo })

  const config = await call(handler, { action: 'config' })
  assert.equal(config.status, 200)
  assert.deepEqual([config.body.open, config.body.driveReady, config.body.chunkSize], [true, true, CHUNK_SIZE])

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
  assert.match(start.body.upload.sessionUri, /upload_id=/)
  assert.equal(start.body.upload.driveName, 'TB-001 - فريق النور - أسواق المدينة.mp4')
  const folders = await repo.readSetting('drive_folders')
  assert.equal(folders.account, 'organizer@example.com')
  assert.equal(Object.keys(folders.tracks).length, 4)

  // الرفع ناقص → complete يرفض ويخبر بعدد البايتات الواصلة
  const partial = await fetch(start.body.upload.sessionUri, { method: 'PUT', headers: { 'Content-Range': `bytes 0-${1024 * 1024 - 1}/${video().size}` }, body: Buffer.alloc(1024 * 1024, 1) })
  assert.equal(partial.status, 308)
  const status = await call(handler, { action: 'status', code: 'TB-001', uploadId: start.body.upload.uploadId })
  assert.deepEqual([status.body.complete, status.body.committed], [false, 1024 * 1024])
  const early = await call(handler, { action: 'complete', code: 'TB-001', uploadId: start.body.upload.uploadId })
  assert.equal(early.status, 409)
  assert.equal(early.body.code, 'UPLOAD_INCOMPLETE')
  assert.equal(early.body.committed, 1024 * 1024)

  // إعادة طلب start لنفس الملف تعيد الجلسة نفسها (استئناف)
  const again = await call(handler, { action: 'start', team: { mode: 'existing', code: 'tb-001', mobile: '0504444444' }, video: video(), consent })
  assert.equal(again.status, 200)
  assert.equal(again.body.upload.uploadId, start.body.upload.uploadId)

  const uploaded = await uploadBytes(start.body.upload.sessionUri, video().size)
  assert.ok(uploaded.id)
  const done = await call(handler, { action: 'complete', code: 'TB-001', uploadId: start.body.upload.uploadId, fileId: uploaded.id })
  assert.equal(done.status, 200, JSON.stringify(done.body))
  assert.equal(done.body.team.video.fileName, 'TB-001 - فريق النور - أسواق المدينة.mp4')
  assert.equal(done.body.team.video.size, video().size)
  assert.equal(done.body.team.pending, null)
  const stored = fake.state.files.get(uploaded.id)
  assert.equal(stored.parents[0], folders.tracks.life)
  assert.deepEqual(stored.appProperties, { teamCode: 'TB-001', track: 'life' })

  // عرض الفريق بالكود أو برقم أي عضو
  const byMobile = await call(handler, { action: 'team', mobile: '0504444444' })
  assert.equal(byMobile.body.team.code, 'TB-001')
  const byCode = await call(handler, { action: 'team', code: 'TB-001' })
  assert.equal(byCode.body.team.video.title, 'أسواق المدينة')

  // استبدال الفيديو: الجديد يُعتمد والقديم يذهب إلى سلة المهملات
  const replace = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0501111111' }, video: video({ fileName: 'better.mov', mimeType: 'video/quicktime', size: 2 * 1024 * 1024, title: 'نسخة أفضل' }), consent })
  assert.equal(replace.status, 200)
  assert.equal(replace.body.upload.replaces, true)
  assert.equal(replace.body.upload.driveName, 'TB-001 - فريق النور - نسخة أفضل.mov')
  const second = await uploadBytes(replace.body.upload.sessionUri, 2 * 1024 * 1024)
  const replaced = await call(handler, { action: 'complete', code: 'TB-001', uploadId: replace.body.upload.uploadId, fileId: second.id })
  assert.equal(replaced.status, 200)
  assert.equal(replaced.body.team.video.fileName, 'TB-001 - فريق النور - نسخة أفضل.mov')
  assert.equal(fake.state.files.get(uploaded.id).trashed, true)
  assert.equal(fake.state.files.get(second.id).trashed, false)

  // الحذف للقائد فقط
  const denied = await call(handler, { action: 'remove_video', code: 'TB-001', mobile: '0504444444' })
  assert.equal(denied.body.code, 'LEADER_ONLY')
  const removed = await call(handler, { action: 'remove_video', code: 'TB-001', mobile: '0501111111' })
  assert.equal(removed.status, 200)
  assert.equal(removed.body.team.video, null)
  assert.equal(fake.state.files.get(second.id).trashed, true)

  const log = (await repo.db.query('select action from public.tb_upload_log order by id')).rows.map(r => r.action)
  assert.deepEqual(log, ['team_created', 'upload_started', 'upload_completed', 'upload_started', 'upload_completed', 'previous_trashed', 'video_removed'])
})

test('governance: one person in one team only, by mobile and by name, and no two teams share a name', async () => {
  const repo = await createDevDatabase()
  await connectDrive(repo)
  const handler = createHandler({ repo })
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
  const tooMany = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق ثالث', track: 'life', mobiles: ['0502222222', '0503333333', '0507777777', '0508888888', '0509999999', '0500000000'] }, video: video(), consent })
  assert.equal(tooMany.body.code, 'INVALID_MEMBERS')

  const notMember = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0502222222' }, video: video(), consent })
  assert.equal(notMember.body.code, 'NOT_A_MEMBER')
  assert.equal((await call(handler, { action: 'team', code: 'TB-999' })).body.code, 'TEAM_NOT_FOUND')
  assert.equal((await call(handler, { action: 'team', code: 'nope' })).body.code, 'INVALID_CODE')
  assert.equal((await repo.db.query('select count(*)::int as n from public.tb_teams')).rows[0].n, 1)
})

test('validation: video, consent, closed state, deadline, drive not connected, size limit', async () => {
  const repo = await createDevDatabase()
  const handler = createHandler({ repo })
  const team = { mode: 'new', name: 'فريق', track: 'life', mobiles: ['0502222222'] }
  const notConnected = await call(handler, { action: 'start', team, video: video(), consent })
  assert.deepEqual([notConnected.status, notConnected.body.code], [503, 'DRIVE_NOT_CONNECTED'])
  assert.equal((await call(handler, { action: 'config' })).body.driveReady, false)
  await connectDrive(repo)

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

  const get = response()
  await handler({ method: 'GET', headers: {} }, get)
  assert.equal(get.statusCode, 405)
})

test('admin: overview with folders and quota, settings, delete team, remove member; non-admins are refused', async () => {
  const repo = await createDevDatabase()
  await connectDrive(repo)
  const handler = createHandler({ repo, verifyAdmin: async token => (token === 'admin-token' ? { id: 'u1', email: 'admin@example.com' } : null) })
  assert.equal((await call(handler, { action: 'admin_overview' })).status, 401)
  assert.equal((await call(handler, { action: 'admin_overview' }, { token: 'wrong' })).status, 403)

  const start = await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق النور', track: 'destination', mobiles: ['0501111111', '0502222222', '0503333333'] }, video: video(), consent })
  const uploaded = await uploadBytes(start.body.upload.sessionUri, video().size)
  await call(handler, { action: 'complete', code: start.body.team.code, uploadId: start.body.upload.uploadId, fileId: uploaded.id })
  await call(handler, { action: 'start', team: { mode: 'new', name: 'فريق البحر', track: 'life', mobiles: ['0505555555'] }, video: video(), consent })

  const overview = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.equal(overview.body.drive.connected, true)
  assert.equal(overview.body.drive.email, 'organizer@example.com')
  assert.equal(overview.body.drive.quota.limit, '16106127360')
  assert.equal(Object.keys(overview.body.drive.folders.tracks).length, 4)
  assert.deepEqual(overview.body.stats, { teams: 2, withVideo: 1, members: 4, inperson: 2, registrations: 8 })
  const nour = overview.body.teams.find(t => t.name === 'فريق النور')
  assert.equal(nour.type, 'mixed')
  assert.deepEqual(nour.members.map(m => [m.name, m.inPerson, m.leader]), [['سارة محمد الحربي', true, true], ['عبدالله خالد العمري', false, false], ['نورة سعد الجهني', true, false]])
  assert.equal(nour.video.name, 'TB-001 - فريق النور - أسواق المدينة.mp4')
  assert.match(nour.video.link, /\/view\//)
  const sea = overview.body.teams.find(t => t.name === 'فريق البحر')
  assert.equal(sea.type, 'online')
  assert.equal(sea.video, null)
  assert.equal(sea.pending.fileName, 'city.mp4')

  const settings = await call(handler, { action: 'admin_settings', open: false, deadline: '2026-12-01T20:59:00.000Z', maxBytes: 512 * 1024 * 1024 }, { token: 'admin-token' })
  assert.deepEqual(settings.body.settings, { open: false, deadline: '2026-12-01T20:59:00.000Z', maxBytes: 512 * 1024 * 1024 })
  assert.equal((await call(handler, { action: 'admin_settings', deadline: 'tomorrow' }, { token: 'admin-token' })).body.code, 'INVALID_DEADLINE')

  const removed = await call(handler, { action: 'admin_remove_member', memberId: nour.members[1].id }, { token: 'admin-token' })
  assert.equal(removed.status, 200)
  assert.equal((await call(handler, { action: 'admin_remove_member', memberId: sea.members[0].id }, { token: 'admin-token' })).body.code, 'LAST_MEMBER')
  const deleted = await call(handler, { action: 'admin_delete_team', teamId: nour.id }, { token: 'admin-token' })
  assert.equal(deleted.status, 200)
  assert.equal(fake.state.files.get(uploaded.id).trashed, true)
  const after = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.deepEqual(after.body.teams.map(t => t.name), ['فريق البحر'])
  // الرقم المحذوف يستطيع الانضمام إلى فريق جديد
  assert.equal((await call(handler, { action: 'lookup', mobiles: ['0502222222', '0501111111'] })).body.results.map(r => r.status).join(','), 'ok,ok')
})

test('oauth: begin stores pending state and the callback saves the refresh token and account email', async () => {
  const repo = await createDevDatabase()
  const handler = createHandler({ repo, verifyAdmin: async () => ({ id: 'u1', email: 'admin@example.com' }) })
  const begin = await call(handler, { action: 'admin_drive_begin', clientId: 'abc-123.apps.googleusercontent.com', clientSecret: 'GOCSPX-secret-value' }, { token: 'x' })
  assert.equal(begin.status, 200, JSON.stringify(begin.body))
  const url = new URL(begin.body.url)
  assert.equal(url.origin + url.pathname, 'https://accounts.google.com/o/oauth2/v2/auth')
  assert.equal(url.searchParams.get('access_type'), 'offline')
  assert.equal(url.searchParams.get('prompt'), 'consent')
  assert.match(url.searchParams.get('scope'), /drive\.file/)
  const state = url.searchParams.get('state')
  assert.equal(url.searchParams.get('redirect_uri'), begin.body.redirectUri)
  assert.equal((await call(handler, { action: 'admin_drive_begin', clientId: 'nope', clientSecret: 'GOCSPX-secret-value' }, { token: 'x' })).body.code, 'INVALID_CLIENT_ID')

  const callback = createOAuthCallback({ repo })
  const redirectOf = async query => { const res = response(); await callback({ method: 'GET', url: `/api/drive-oauth?${query}`, headers: {} }, res); return res.headers.Location }
  assert.match(await redirectOf(`code=good-code&state=wrong`), /drive=error&reason=STATE_MISMATCH/)
  assert.match(await redirectOf(`error=access_denied`), /drive=error&reason=access_denied/)
  assert.match(await redirectOf(`code=bad-code&state=${state}`), /drive=error&reason=OAUTH_EXCHANGE_FAILED/)
  assert.equal(await redirectOf(`code=good-code&state=${state}`), '/admin?tab=submissions&drive=connected')
  const saved = await repo.readSecret('drive_oauth')
  assert.deepEqual([saved.refresh_token, saved.email, saved.client_id], ['fake-refresh-token', 'organizer@example.com', 'abc-123.apps.googleusercontent.com'])
  assert.equal(await repo.readSecret('drive_oauth_pending'), null)
  assert.equal(fake.state.exchanges.at(-1).redirect_uri, begin.body.redirectUri)
  assert.equal((await call(handler, { action: 'config' })).body.driveReady, true)
  await call(handler, { action: 'admin_drive_disconnect' }, { token: 'x' })
  assert.equal((await call(handler, { action: 'config' })).body.driveReady, false)
})
