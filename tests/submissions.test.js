import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_MEMBERS, CONSENT_MAX_BYTES, consentExtension, normalizeNationalId, consentFileName } from '../server/submissions/keys.js'
import { mobileKeyFromStored, nameKey, teamNameKey, driveFileName, parseMobile } from '../server/submissions/keys.js'
import { resumableEndpoint, TUS_CHUNK_SIZE } from '../server/submissions/storage.js'
import { createHandler, CHUNK_SIZE } from '../server/submissions/handler.js'
import { createHarness, NATIONAL_ID, video, consentFile, b64, response } from './helpers/submissions-harness.mjs'

const { fake, storage, call, uploadBytes, teamConsents, registerTeam, signConsent, signAll, teamReadyForVideo, freshDatabase } = await createHarness()

test('keys: mobiles, names, display file names and consent helpers normalize predictably', () => {
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
  // الإقرار: الصيغ المقبولة ورقم الهوية واسم الملف
  assert.deepEqual([consentExtension('scan.JPEG', ''), consentExtension('iqrar.pdf', ''), consentExtension('photo', 'image/png'), consentExtension('x.heic', 'image/heic'), consentExtension('x.exe', '')], ['jpg', 'pdf', 'png', '', ''])
  assert.equal(normalizeNationalId(' ١٠٢٣٤٥٦٧٨٩ '), '1023456789')
  assert.equal(normalizeNationalId('ab-123 456'), 'AB123456')
  assert.deepEqual([normalizeNationalId('12'), normalizeNationalId('x'.repeat(21)), normalizeNationalId('١٢٣؛٤٥٦')], ['', '', ''])
  assert.equal(consentFileName('TB-001', 'سارة/محمد الحربي', 'jpg'), 'TB-001 - سارة محمد الحربي - إقرار.jpg')
  assert.equal(CONSENT_MAX_BYTES, 15 * 1024 * 1024)
})

test('full flow: lookup, register, a signed declaration per member, resumable upload of one video, replace it, and read the receipt', async () => {
  const repo = await freshDatabase()
  const handler = createHandler({ repo, storage: storage() })

  const config = await call(handler, { action: 'config' })
  assert.equal(config.status, 200)
  assert.deepEqual([config.body.open, config.body.uploadReady, config.body.chunkSize, config.body.consentsReady, config.body.consentMaxBytes], [true, true, CHUNK_SIZE, true, CONSENT_MAX_BYTES])

  const lookup = await call(handler, { action: 'lookup', mobiles: ['0501111111', '0599999999', 'abc', { number: '1001234567', country: 'EG' }] })
  assert.equal(lookup.status, 200)
  assert.deepEqual(lookup.body.results.map(r => r.status), ['ok', 'not_registered', 'invalid', 'ok'])
  assert.equal(lookup.body.results[0].name, 'سارة محمد الحربي')
  assert.equal(lookup.body.results[3].mobile, '+201001234567')

  // 1) التسجيل فقط
  let team = await registerTeam(handler, 'فريق النور', 'life', ['0501111111', '0504444444'])
  assert.equal(team.code, 'TB-001')
  assert.deepEqual(team.members.map(m => [m.name, m.leader, m.mobile, m.consent]), [['سارة محمد الحربي', true, '05•••••111', null], ['محمد عبدالله الخيبري', false, '05•••••444', null]])
  assert.ok(team.members.every(m => /^[0-9a-f-]{36}$/.test(m.id)), 'members carry ids for the declaration upload')
  assert.deepEqual(team.consents, { ready: true, required: 2, done: 0, complete: false })
  assert.equal(team.video, null)

  // 2) لا فيديو قبل الإقرارات
  const blocked = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0501111111' }, video: video() })
  assert.equal(blocked.status, 409)
  assert.deepEqual([blocked.body.code, blocked.body.missing], ['CONSENTS_MISSING', ['سارة محمد الحربي', 'محمد عبدالله الخيبري']])

  // 3) تحققات الإقرار
  const [sara, mohammed] = team.members
  const consentCall = (payload, mobile = '0501111111') => call(handler, { action: 'consent_start', code: 'TB-001', mobile, memberId: sara.id, nationalId: NATIONAL_ID, file: consentFile(), ...payload })
  assert.equal((await consentCall({ nationalId: '12' })).body.code, 'INVALID_NATIONAL_ID')
  assert.equal((await consentCall({ file: consentFile({ fileName: 'virus.exe', mimeType: 'application/octet-stream' }) })).body.code, 'INVALID_CONSENT_FILE')
  assert.equal((await consentCall({ file: consentFile({ size: CONSENT_MAX_BYTES + 1 }) })).body.code, 'CONSENT_TOO_LARGE')
  assert.equal((await consentCall({}, '0502222222')).body.code, 'NOT_A_MEMBER')
  assert.equal((await consentCall({ memberId: '00000000-0000-0000-0000-000000000000' })).body.code, 'MEMBER_NOT_FOUND')
  // تأكيد مزوّر: مسار خارج مجلد الفريق أو ملف لم يصل
  assert.equal((await call(handler, { action: 'consent_complete', code: 'TB-001', mobile: '0501111111', memberId: sara.id, nationalId: NATIONAL_ID, objectPath: 'consents/life/TB-999/TB-999-1-x.pdf' })).body.code, 'INVALID_CONSENT_FILE')
  assert.equal((await call(handler, { action: 'consent_complete', code: 'TB-001', mobile: '0501111111', memberId: sara.id, nationalId: NATIONAL_ID, objectPath: 'consents/life/TB-001/TB-001-1-missing.pdf' })).body.code, 'UPLOAD_INCOMPLETE')

  // 4) القائدة ترفع إقرارها، والعضو الثاني يرفع إقراره بنفسه (صورة)
  const first = await signConsent(handler, team, '0501111111', sara)
  assert.equal(first.consent.fileName, 'TB-001 - سارة محمد الحربي - إقرار.pdf')
  assert.deepEqual(first.team.consents, { ready: true, required: 2, done: 1, complete: false })
  assert.equal(first.team.members[0].consent.fileName, 'TB-001 - سارة محمد الحربي - إقرار.pdf')
  assert.equal(first.team.members[0].consent.size, 1234)
  const stillBlocked = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0501111111' }, video: video() })
  assert.deepEqual([stillBlocked.body.code, stillBlocked.body.missing], ['CONSENTS_MISSING', ['محمد عبدالله الخيبري']])
  const second = await signConsent(handler, first.team, '0504444444', mohammed, { nationalId: '٢٠٠١١٢٢٣٣٤', file: consentFile({ fileName: 'IMG_0042.JPG', size: 4096, mimeType: 'image/jpeg' }) })
  assert.deepEqual(second.team.consents, { ready: true, required: 2, done: 2, complete: true })
  assert.equal(second.consent.fileName, 'TB-001 - محمد عبدالله الخيبري - إقرار.jpg')
  assert.deepEqual(teamConsents('life/TB-001').map(f => f.key.replace(/-[a-z0-9]+\.(pdf|jpg)$/, '.$1')), ['submissions/consents/life/TB-001/TB-001-1.pdf', 'submissions/consents/life/TB-001/TB-001-2.jpg'])
  // البطاقة العامة لا تكشف رقم الهوية
  const publicCard = await call(handler, { action: 'team', code: 'TB-001' })
  assert.doesNotMatch(JSON.stringify(publicCard.body), /1023456789|2001122334|nationalId|national_id/)
  team = second.team

  // 5) الفيديو
  const start = await call(handler, { action: 'start', team: { mode: 'existing', code: 'tb-001', mobile: '0501111111' }, video: video() })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  assert.equal(start.body.created, false)
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
  const again = await call(handler, { action: 'start', team: { mode: 'existing', code: 'tb-001', mobile: '0504444444' }, video: video() })
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
  const replace = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0501111111' }, video: video({ fileName: 'better.mov', mimeType: 'video/quicktime', size: 2 * 1024 * 1024, title: 'نسخة أفضل' }) })
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
  assert.deepEqual(fake.videos().map(v => v.key), [])

  // استبدال إقرار: الملف القديم يُحذف ويبقى ملف واحد لكل عضو
  const before = teamConsents('life/TB-001').map(f => f.key)
  const resigned = await signConsent(handler, team, '0501111111', sara, { file: consentFile({ fileName: 'scan.png', size: 2048, mimeType: 'image/png' }) })
  assert.equal(resigned.consent.fileName, 'TB-001 - سارة محمد الحربي - إقرار.png')
  assert.equal(teamConsents('life/TB-001').length, 2)
  assert.ok(!teamConsents('life/TB-001').some(f => f.key === before[0]), 'the previous declaration file left the bucket')
  assert.deepEqual(resigned.team.consents, { ready: true, required: 2, done: 2, complete: true })

  const log = (await repo.db.query('select action from public.tb_upload_log order by id')).rows.map(r => r.action)
  assert.deepEqual(log, ['team_created', 'consent_upload_started', 'consent_uploaded', 'consent_upload_started', 'consent_uploaded', 'upload_started', 'upload_completed', 'upload_started', 'upload_completed', 'previous_removed', 'video_removed', 'consent_upload_started', 'consent_uploaded'])
})

test('governance: one person in one team only, by mobile and by name, and no two teams share a name', async () => {
  const repo = await freshDatabase()
  const handler = createHandler({ repo, storage: storage() })
  const register = team => call(handler, { action: 'register', team: { mode: 'new', ...team } })
  const first = await register({ name: 'الفريق الأول', track: 'identity', mobiles: ['0501111111', '0505555555'] })
  assert.equal(first.status, 200, JSON.stringify(first.body))

  const sameMobile = await register({ name: 'فريق آخر', track: 'life', mobiles: ['0502222222', '0501111111'] })
  assert.equal(sameMobile.status, 409)
  assert.deepEqual([sameMobile.body.code, sameMobile.body.mobile, sameMobile.body.teamCode], ['MOBILE_TAKEN', '0501111111', 'TB-001'])

  // ريم فهد القحطاني مسجّلة مرتين برقمين مختلفين: الاسم نفسه لا يدخل فريقًا ثانيًا
  const sameName = await register({ name: 'فريق آخر', track: 'life', mobiles: ['0506666666'] })
  assert.equal(sameName.status, 409)
  assert.equal(sameName.body.code, 'MOBILE_TAKEN')
  const lookup = await call(handler, { action: 'lookup', mobiles: ['0506666666'] })
  assert.equal(lookup.body.results[0].status, 'in_team')

  const sameTeamName = await register({ name: ' الفريقُ الاول ', track: 'life', mobiles: ['0502222222'] })
  assert.equal(sameTeamName.status, 409)
  assert.equal(sameTeamName.body.code, 'TEAM_NAME_TAKEN')

  const duplicateInForm = await register({ name: 'فريق ثالث', track: 'life', mobiles: ['0502222222', '+966502222222'] })
  assert.equal(duplicateInForm.body.code, 'DUPLICATE_MEMBER')
  const unregistered = await register({ name: 'فريق ثالث', track: 'life', mobiles: ['0502222222', '0598765432'] })
  assert.deepEqual([unregistered.status, unregistered.body.code, unregistered.body.mobile], [400, 'NOT_REGISTERED', '0598765432'])
  // لا عدد محدد للفريق؛ يبقى سقف تقني (MAX_MEMBERS) لا يُعرض للمشاركين
  const tooMany = await register({ name: 'فريق ثالث', track: 'life', mobiles: Array.from({ length: MAX_MEMBERS + 1 }, (_, i) => `05${String(10000000 + i).padStart(8, '0')}`) })
  assert.equal(tooMany.body.code, 'INVALID_MEMBERS')
  const sixMembers = await register({ name: 'فريق ثالث', track: 'life', mobiles: ['0502222222', '0503333333', '0507777777', '0508888888', '0509999999', '0500000000'] })
  assert.notEqual(sixMembers.body.code, 'INVALID_MEMBERS', 'six members are no longer refused for their number')

  const notMember = await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0502222222' }, video: video() })
  assert.equal(notMember.body.code, 'NOT_A_MEMBER')
  assert.equal((await call(handler, { action: 'team', code: 'TB-999' })).body.code, 'TEAM_NOT_FOUND')
  assert.equal((await call(handler, { action: 'team', code: 'nope' })).body.code, 'INVALID_CODE')
  assert.equal((await repo.db.query('select count(*)::int as n from public.tb_teams')).rows[0].n, 1)
})

test('validation: video, closed state, deadline, storage not configured, size limit, bad token', async () => {
  const repo = await freshDatabase()
  const unconfigured = createHandler({ repo, storage: null })
  const newTeam = { mode: 'new', name: 'فريق', track: 'life', mobiles: ['0502222222'] }
  assert.equal((await call(unconfigured, { action: 'config' })).body.uploadReady, false)
  // التسجيل لا يحتاج التخزين، لكن الإقرار والفيديو يحتاجانه
  const registered = await call(unconfigured, { action: 'register', team: newTeam })
  assert.equal(registered.status, 200, JSON.stringify(registered.body))
  const member = registered.body.team.members[0]
  const noStorageConsent = await call(unconfigured, { action: 'consent_start', code: 'TB-001', mobile: '0502222222', memberId: member.id, nationalId: NATIONAL_ID, file: consentFile() })
  assert.deepEqual([noStorageConsent.status, noStorageConsent.body.code], [503, 'STORAGE_NOT_CONFIGURED'])
  const notReady = await call(unconfigured, { action: 'start', team: { mode: 'existing', code: 'TB-001', mobile: '0502222222' }, video: video() })
  assert.deepEqual([notReady.status, notReady.body.code], [503, 'STORAGE_NOT_CONFIGURED'])

  const handler = createHandler({ repo, storage: storage() })
  const existing = { mode: 'existing', code: 'TB-001', mobile: '0502222222' }
  await signAll(handler, registered.body.team, '0502222222')
  assert.equal((await call(handler, { action: 'start', team: existing, video: video({ fileName: 'deck.pdf', mimeType: 'application/pdf' }) })).body.code, 'INVALID_VIDEO_TYPE')
  assert.equal((await call(handler, { action: 'start', team: existing, video: video({ size: 3 * 1024 ** 3 }) })).body.code, 'VIDEO_TOO_LARGE')
  assert.equal((await call(handler, { action: 'start', team: existing, video: video({ title: 'x' }) })).body.code, 'INVALID_TITLE')
  assert.equal((await call(handler, { action: 'start', team: newTeam, video: video() })).body.code, 'INVALID_REQUEST', 'start no longer creates teams; register does')
  assert.equal((await call(handler, { action: 'register', team: { ...newTeam, name: 'فريق ثانٍ', track: 'food' } })).body.code, 'INVALID_TRACK')
  assert.equal((await call(handler, { action: 'register', team: { ...newTeam, name: 'x' } })).body.code, 'INVALID_TEAM_NAME')
  assert.equal((await call(handler, { action: 'nope' })).body.code, 'UNKNOWN_ACTION')

  await repo.writeSetting('submissions', { open: false })
  assert.equal((await call(handler, { action: 'register', team: { ...newTeam, name: 'فريق ثانٍ', mobiles: ['0503333333'] } })).body.code, 'SUBMISSIONS_CLOSED')
  assert.equal((await call(handler, { action: 'start', team: existing, video: video() })).body.code, 'SUBMISSIONS_CLOSED')
  await repo.writeSetting('submissions', { open: true, deadline: '2020-01-01T00:00:00.000Z' })
  assert.equal((await call(handler, { action: 'start', team: existing, video: video() })).body.code, 'DEADLINE_PASSED')
  await repo.writeSetting('submissions', { open: true, deadline: null, max_bytes: 1024 * 1024 })
  assert.equal((await call(handler, { action: 'start', team: existing, video: video() })).body.code, 'VIDEO_TOO_LARGE')
  assert.equal((await repo.db.query('select count(*)::int as n from public.tb_teams')).rows[0].n, 1, 'nothing else is registered when validation fails')

  // التوكن يسمح بمسار واحد فقط: محاولة رفع إلى مسار آخر تُرفض
  await repo.writeSetting('submissions', { open: true })
  const start = await call(handler, { action: 'start', team: existing, video: video() })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  const forged = await fetch(start.body.upload.endpoint, { method: 'POST', headers: { 'Tus-Resumable': '1.0.0', 'Upload-Length': '10', 'x-signature': start.body.upload.token, 'Upload-Metadata': `bucketName ${b64('submissions')},objectName ${b64('life/TB-999/other.mp4')}` } })
  assert.equal(forged.status, 403)
  // وتوكن الإقرار كذلك: مسار آخر يُرفض
  const consentStart = await call(handler, { action: 'consent_start', code: 'TB-001', mobile: '0502222222', memberId: member.id, nationalId: NATIONAL_ID, file: consentFile() })
  const forgedConsent = await fetch(consentStart.body.upload.uploadUrl.replace(/TB-001-1-[a-z0-9]+\.pdf/, 'TB-001-1-other.pdf'), { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: Buffer.alloc(10) })
  assert.equal(forgedConsent.status, 403)

  const get = response()
  await handler({ method: 'GET', headers: {} }, get)
  assert.equal(get.statusCode, 405)
})

test('admin: overview with declarations and storage usage, settings, signed links, delete team, remove member; non-admins are refused', async () => {
  const repo = await freshDatabase()
  const handler = createHandler({ repo, storage: storage(), verifyAdmin: async token => (token === 'admin-token' ? { id: 'u1', email: 'admin@example.com' } : null) })
  assert.equal((await call(handler, { action: 'admin_overview' })).status, 401)
  assert.equal((await call(handler, { action: 'admin_overview' }, { token: 'wrong' })).status, 403)

  const nourCard = await teamReadyForVideo(handler, 'فريق النور', 'destination', ['0501111111', '0502222222', '0503333333'])
  const start = await call(handler, { action: 'start', team: { mode: 'existing', code: nourCard.code, mobile: '0501111111' }, video: video() })
  assert.equal(start.status, 200, JSON.stringify(start.body))
  await uploadBytes(start.body.upload)
  await call(handler, { action: 'complete', code: nourCard.code, uploadId: start.body.upload.uploadId })
  await registerTeam(handler, 'فريق البحر', 'life', ['0505555555'])
  assert.equal((await call(handler, { action: 'start', team: { mode: 'existing', code: 'TB-002', mobile: '0505555555' }, video: video() })).body.code, 'CONSENTS_MISSING')

  const overview = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.equal(overview.status, 200, JSON.stringify(overview.body))
  assert.deepEqual(overview.body.storage, { configured: true, bucket: 'submissions', usedBytes: video().size, includedBytes: 100 * 1024 ** 3 })
  assert.deepEqual(overview.body.stats, { teams: 2, withVideo: 1, members: 4, qualified: 0, rejected: 0, undecided: 1, consentFiles: 3, consentsComplete: 1, consentsMissing: 1, inperson: 2, registrations: 8 })
  assert.deepEqual(overview.body.consents, { ready: true, files: 3, bytes: 3 * 1234 })
  assert.equal(overview.body.review.ready, true)
  const nour = overview.body.teams.find(t => t.name === 'فريق النور')
  assert.equal(nour.type, 'mixed')
  assert.deepEqual(nour.members.map(m => [m.name, m.inPerson, m.leader, m.consent?.nationalId]), [['سارة محمد الحربي', true, true, NATIONAL_ID], ['عبدالله خالد العمري', false, false, NATIONAL_ID], ['نورة سعد الجهني', true, false, NATIONAL_ID]])
  assert.match(nour.members[0].consent.path, /^consents\/destination\/TB-001\/TB-001-1-[a-z0-9]+\.pdf$/)
  assert.equal(nour.members[0].consent.fileName, 'TB-001 - سارة محمد الحربي - إقرار.pdf')
  assert.equal(nour.members[0].consent.uploadedBy, '966501111111')
  assert.deepEqual(nour.consents, { ready: true, required: 3, done: 3, complete: true })
  assert.equal(nour.video.name, 'TB-001 - فريق النور - أسواق المدينة.mp4')
  assert.match(nour.video.path, /^destination\/TB-001\//)
  const sea = overview.body.teams.find(t => t.name === 'فريق البحر')
  assert.equal(sea.type, 'online')
  assert.equal(sea.video, null)
  assert.equal(sea.pending, null, 'no upload session is opened while declarations are missing')
  assert.deepEqual(sea.consents, { ready: true, required: 1, done: 0, complete: false })
  assert.equal(sea.members[0].consent, null)

  const links = await call(handler, { action: 'admin_video_url', teamId: nour.id }, { token: 'admin-token' })
  assert.equal(links.status, 200, JSON.stringify(links.body))
  assert.match(links.body.url, /\/object\/sign\/submissions\/destination\/TB-001\//)
  assert.match(links.body.downloadUrl, /download=/)
  assert.equal((await call(handler, { action: 'admin_video_url', teamId: sea.id }, { token: 'admin-token' })).body.code, 'VIDEO_NOT_FOUND')
  // روابط الإقرارات: ملف واحد أو دفعة، للمنظّمة فقط
  assert.equal((await call(handler, { action: 'admin_consent_urls', consentIds: [nour.members[0].consent.id] })).status, 401)
  const one = await call(handler, { action: 'admin_consent_urls', consentId: nour.members[0].consent.id }, { token: 'admin-token' })
  assert.equal(one.status, 200, JSON.stringify(one.body))
  assert.equal(one.body.files.length, 1)
  assert.match(one.body.files[0].url, /\/object\/sign\/submissions\/consents\/destination\/TB-001\//)
  assert.match(one.body.files[0].downloadUrl, /download=/)
  const fetched = await fetch(new URL(one.body.files[0].url, fake.base))
  assert.equal(fetched.status, 200)
  assert.equal((await fetched.arrayBuffer()).byteLength, 1234)
  const batch = await call(handler, { action: 'admin_consent_urls', consentIds: nour.members.map(m => m.consent.id) }, { token: 'admin-token' })
  assert.deepEqual(batch.body.files.map(f => f.fileName).sort(), nour.members.map(m => m.consent.fileName).sort())
  assert.equal((await call(handler, { action: 'admin_consent_urls', consentIds: ['00000000-0000-0000-0000-000000000000'] }, { token: 'admin-token' })).body.code, 'CONSENT_NOT_FOUND')

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
  // الواجهة العامة لا تكشف القرار ولا أرقام الهوية بأي صورة
  const publicCard = await call(handler, { action: 'team', code: nour.code })
  assert.equal(publicCard.status, 200)
  assert.doesNotMatch(JSON.stringify(publicCard.body), /review|qualified|nationalId|1023456789/)
  // استبدال الفيديو بعد القرار يعيد الفريق إلى «بلا قرار» مع ذكر القرار السابق
  const replace = await call(handler, { action: 'start', team: { mode: 'existing', code: nour.code, mobile: '0501111111' }, video: video({ fileName: 'cut2.mp4', title: 'نسخة أحدث' }) })
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

  // إزالة عضو تحذف إقراره من الحاوية، وتبقى إقرارات الفريق مكتملة
  const removed = await call(handler, { action: 'admin_remove_member', memberId: nour.members[1].id }, { token: 'admin-token' })
  assert.equal(removed.status, 200)
  assert.equal(teamConsents('destination/TB-001').length, 2, 'the removed member declaration left the bucket')
  view = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.deepEqual(view.body.teams.find(t => t.id === nour.id).consents, { ready: true, required: 2, done: 2, complete: true })
  assert.equal((await call(handler, { action: 'admin_remove_member', memberId: sea.members[0].id }, { token: 'admin-token' })).body.code, 'LAST_MEMBER')
  const deleted = await call(handler, { action: 'admin_delete_team', teamId: nour.id }, { token: 'admin-token' })
  assert.equal(deleted.status, 200)
  assert.deepEqual(fake.videos().map(v => v.key), [], 'the deleted team video left the bucket')
  assert.deepEqual(teamConsents('destination/TB-001'), [], 'the deleted team declarations left the bucket')
  const after = await call(handler, { action: 'admin_overview' }, { token: 'admin-token' })
  assert.deepEqual(after.body.teams.map(t => t.name), ['فريق البحر'])
  assert.equal((await call(handler, { action: 'lookup', mobiles: ['0502222222', '0501111111'] })).body.results.map(r => r.status).join(','), 'ok,ok')
})

