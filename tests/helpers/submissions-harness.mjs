// أدوات مشتركة لاختبارات /api/submissions: محاكي التخزين، نداء المعالج، رفع TUS، إقرارات الأعضاء، وقاعدة PGlite لكل اختبار.
// ملاحظة: كل قاعدة PGlite تستهلك نحو غيغابايت من الذاكرة داخل العملية، لذا تُوزَّع الاختبارات على ملفين (عمليتين) وتُغلق القاعدة بعد كل اختبار.
import test from 'node:test'
import assert from 'node:assert/strict'
import { startFakeStorage } from './fake-storage.mjs'
import { createDevDatabase } from '../../server/submissions/dev-db.js'
import { createStorage } from '../../server/submissions/storage.js'

export const NATIONAL_ID = '1023456789'
export const video = (overrides = {}) => ({ fileName: 'city.mp4', size: 7 * 1024 * 1024 + 123, mimeType: 'video/mp4', title: 'أسواق المدينة', ...overrides })
export const consentFile = (overrides = {}) => ({ fileName: 'iqrar.pdf', size: 1234, mimeType: 'application/pdf', ...overrides })
export const b64 = value => Buffer.from(String(value), 'utf8').toString('base64')

export function response() {
  return { headers: {}, statusCode: 0, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = body ? JSON.parse(body) : null; this.writableEnded = true } }
}

export async function createHarness() {
  process.env.VERCEL_ENV = 'test'
  const fake = await startFakeStorage()
  const storage = () => createStorage(fake.config())

  // حد الطلبات 90 في الدقيقة لكل عنوان: الاختبارات تتجاوزه، فكل طلب يأتي من عنوان مختلف ما لم يُحدَّد
  let requestCount = 0
  async function call(handler, payload, { token, ip } = {}) {
    requestCount += 1
    const address = ip || `10.${Math.floor(requestCount / 60000) % 250}.${Math.floor(requestCount / 250) % 250}.${requestCount % 250}`
    const req = { method: 'POST', headers: { 'x-forwarded-for': address, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(payload) }
    const res = response()
    await handler(req, res)
    return { status: res.statusCode, body: res.body, headers: res.headers }
  }

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

  // الحاوية الوهمية مشتركة بين الاختبارات: نعدّ إقرارات فريق واحد بمساره فقط
  const teamConsents = prefix => fake.consents().filter(file => file.key.startsWith(`submissions/consents/${prefix}/`))
  // إقرار العضو: PUT واحد إلى الرابط الموقّع كما يفعل المتصفح
  async function putConsent(upload, bytes = Buffer.alloc(1234, 1)) {
    const res = await fetch(upload.uploadUrl, { method: 'PUT', headers: { 'Content-Type': upload.mimeType, 'x-upsert': 'true', apikey: 'anon-key' }, body: bytes })
    assert.equal(res.status, 200, await res.text())
  }
  async function registerTeam(handler, name, track, mobiles) {
    const res = await call(handler, { action: 'register', team: { mode: 'new', name, track, mobiles } })
    assert.equal(res.status, 200, JSON.stringify(res.body))
    assert.equal(res.body.created, true)
    return res.body.team
  }
  async function signConsent(handler, team, requesterMobile, member, { nationalId = NATIONAL_ID, file = consentFile(), bytes } = {}) {
    const started = await call(handler, { action: 'consent_start', code: team.code, mobile: requesterMobile, memberId: member.id, nationalId, file })
    assert.equal(started.status, 200, JSON.stringify(started.body))
    await putConsent(started.body.upload, bytes || Buffer.alloc(file.size, 1))
    const done = await call(handler, { action: 'consent_complete', code: team.code, mobile: requesterMobile, memberId: member.id, nationalId, objectPath: started.body.upload.objectPath })
    assert.equal(done.status, 200, JSON.stringify(done.body))
    return done.body
  }
  async function signAll(handler, team, requesterMobile) {
    let current = team
    for (const member of team.members) current = (await signConsent(handler, current, requesterMobile, member)).team
    return current
  }
  async function teamReadyForVideo(handler, name, track, mobiles) {
    return signAll(handler, await registerTeam(handler, name, track, mobiles), mobiles[0])
  }

  // كل اختبار ينشئ قاعدة PGlite خاصة به؛ نغلقها بعده
  const openDatabases = []
  async function freshDatabase() {
    const repo = await createDevDatabase()
    openDatabases.push(repo)
    return repo
  }
  test.afterEach(async () => { while (openDatabases.length) await openDatabases.pop().db.close() })
  test.after(() => fake.close())

  return { fake, storage, call, uploadBytes, teamConsents, putConsent, registerTeam, signConsent, signAll, teamReadyForVideo, freshDatabase }
}
