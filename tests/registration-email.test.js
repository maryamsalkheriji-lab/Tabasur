import test, { afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { registrationEmailPlugin } from '../server/registration-email-plugin.js'
import handler from '../api/send-registration-email.js'
import { sendRegistrationEmail } from '../src/lib/registration-email.js'

const originalFetch = globalThis.fetch
const originalToken = process.env.ZEPTOMAIL_TOKEN
const payload = { email: 'test@example.com', fullName: 'Test <script>', receiptId: 'TBSR-2026-1234', kind: 'participant' }
const accepted = () => new Response(JSON.stringify({ data: [{ code: 'EM_104' }] }), { status: 200 })
afterEach(() => {
  globalThis.fetch = originalFetch
  if (originalToken === undefined) delete process.env.ZEPTOMAIL_TOKEN
  else process.env.ZEPTOMAIL_TOKEN = originalToken
})
function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v }, writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers) }, end(body) { this.body = JSON.parse(body); this.writableEnded = true } }
}

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: actual API handler receives POST instead of SPA/404`, async () => {
    process.env.ZEPTOMAIL_TOKEN = 'test-only-token'
    let middleware, calls = 0
    globalThis.fetch = async (url, options) => {
      calls++
      assert.equal(url, 'https://api.zeptomail.com/v1.1/email')
      const mail = JSON.parse(options.body)
      assert.equal(mail.to[0].email_address.address, payload.email)
      assert.ok(mail.htmlbody.includes('Test &lt;script&gt;'))
      return accepted()
    }
    registrationEmailPlugin()[hook]({ config: { mode: 'test', envDir: '/private/tmp/nonexistent-email-test' }, middlewares: { use(fn) { middleware = fn } } })
    const req = Readable.from([JSON.stringify(payload)])
    Object.assign(req, { url: '/api/send-registration-email', method: 'POST' })
    const res = response()
    await middleware(req, res, () => assert.fail('API fell through'))
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { ok: true })
    assert.equal(calls, 1)
    let fellThrough = false
    await middleware({ url: '/tabsur', method: 'GET' }, response(), () => { fellThrough = true })
    assert.equal(fellThrough, true)
    const large = Readable.from(['x'.repeat(16385)])
    Object.assign(large, { url: '/api/send-registration-email', method: 'POST' })
    const largeRes = response()
    await middleware(large, largeRes, () => assert.fail())
    assert.equal(largeRes.statusCode, 413)
    assert.equal(calls, 1)
  })
}

test('missing configuration returns a failure, never a successful skip', async () => {
  delete process.env.ZEPTOMAIL_TOKEN
  globalThis.fetch = () => assert.fail('must not call provider')
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.statusCode, 503)
  assert.equal(res.body.code, 'EMAIL_NOT_CONFIGURED')
})

test('invalid methods, JSON, recipients and kinds never send mail', async () => {
  process.env.ZEPTOMAIL_TOKEN = 'test-only-token'
  globalThis.fetch = () => assert.fail('must not call provider')
  for (const [req, expected] of [[{ method: 'GET' }, 405], [{ method: 'POST', body: '{' }, 400], [{ method: 'POST', body: 'null' }, 400], [{ method: 'POST', body: { ...payload, email: 'invalid' } }, 400], [{ method: 'POST', body: { ...payload, kind: 'other' } }, 400]]) {
    const res = response()
    await handler(req, res)
    assert.equal(res.statusCode, expected)
  }
})

test('provider rejections and malformed success responses never report success', async () => {
  process.env.ZEPTOMAIL_TOKEN = 'test-only-token'
  for (const upstream of [new Response('{"error":{"message":"private provider detail"}}', { status: 401 }), new Response('{}'), new Response('<html>oops</html>')]) {
    globalThis.fetch = async () => upstream
    const res = response()
    await handler({ method: 'POST', body: payload }, res)
    assert.equal(res.statusCode, 502)
    assert.equal(res.body.ok, false)
    assert.ok(!JSON.stringify(res.body).includes('private provider detail'))
  }
})

test('provider timeout returns a recoverable failure', async () => {
  process.env.ZEPTOMAIL_TOKEN = 'test-only-token'
  globalThis.fetch = async () => { throw new DOMException('timeout', 'TimeoutError') }
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.statusCode, 504)
})

test('provider failures explain the required fix without exposing provider details', async () => {
  process.env.ZEPTOMAIL_TOKEN = 'test-only-token'
  for (const [providerCode, expected] of [
    ['SERR_157', 'EMAIL_AUTH_FAILED'], ['SM_111', 'EMAIL_SENDER_UNVERIFIED'],
    ['SM_128', 'EMAIL_ACCOUNT_PENDING'], ['AE_101', 'EMAIL_ACCOUNT_BLOCKED'],
    ['LE_101', 'EMAIL_CREDITS_EXPIRED'], ['LE_102', 'EMAIL_CREDITS_EXHAUSTED'],
    ['SM_133', 'EMAIL_LIMIT_REACHED'], ['SERR_156', 'EMAIL_IP_RESTRICTED'],
    ['UNKNOWN', 'EMAIL_PROVIDER_ERROR'],
  ]) {
    globalThis.fetch = async () => new Response(JSON.stringify({ error: {
      details: [{ code: providerCode, message: 'private provider detail', target_value: payload.email }],
    } }), { status: 401 })
    const res = response()
    await handler({ method: 'POST', body: payload }, res)
    assert.equal(res.statusCode, 502)
    assert.equal(res.body.code, expected)
    assert.ok(!JSON.stringify(res.body).includes('private provider detail'))
    assert.ok(!JSON.stringify(res.body).includes(payload.email))
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ error: {
    details: [{ code: 'SM_113', inner_error: { code: 'SMI_115' } }],
  } }), { status: 401 })
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.body.code, 'EMAIL_LIMIT_REACHED')
})

test('copied authorization prefix and surrounding form whitespace are normalized', async () => {
  process.env.ZEPTOMAIL_TOKEN = '  Zoho-enczapikey test-only-token  '
  globalThis.fetch = async (_, options) => {
    assert.equal(options.headers.Authorization, 'Zoho-enczapikey test-only-token')
    const mail = JSON.parse(options.body)
    assert.equal(mail.to[0].email_address.address, payload.email)
    assert.equal(mail.to[0].email_address.name, payload.fullName)
    return accepted()
  }
  const res = response()
  await handler({ method: 'POST', body: { ...payload, email: ` ${payload.email} `, fullName: ` ${payload.fullName} ` } }, res)
  assert.equal(res.statusCode, 200)
})

test('client identifies HTML fallback and preserves actionable server error codes', async () => {
  globalThis.fetch = async () => new Response('<html>SPA</html>')
  assert.equal((await sendRegistrationEmail(payload)).code, 'EMAIL_ROUTE_MISSING')
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, code: 'EMAIL_CREDITS_EXHAUSTED' }), { status: 502 })
  assert.equal((await sendRegistrationEmail(payload)).code, 'EMAIL_CREDITS_EXHAUSTED')
})

test('sponsor confirmation uses sponsor template', async () => {
  process.env.ZEPTOMAIL_TOKEN = 'test-only-token'
  globalThis.fetch = async (_, options) => {
    assert.ok(JSON.parse(options.body).subject.includes('الرعاية'))
    return accepted()
  }
  const res = response()
  await handler({ method: 'POST', body: { ...payload, kind: 'sponsor' } }, res)
  assert.equal(res.body.ok, true)
})

test('client distinguishes missing API, SPA HTML, explicit failure and acceptance', async () => {
  for (const [res, expected] of [[new Response('', { status: 404 }), false], [new Response('<html>SPA</html>'), false], [new Response('{"ok":false}'), false], [new Response('{"ok":true}'), true]]) {
    let calls = 0
    globalThis.fetch = async () => { calls++; return res }
    assert.equal((await sendRegistrationEmail(payload)).ok, expected)
    assert.equal(calls, 1, 'ambiguous failures must not automatically duplicate mail')
  }
  globalThis.fetch = async () => { throw new TypeError('offline') }
  assert.equal((await sendRegistrationEmail(payload)).code, 'EMAIL_CONNECTION_FAILED')
})
