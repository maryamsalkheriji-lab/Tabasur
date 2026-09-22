import test, { afterEach, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { registrationEmailPlugin } from '../server/registration-email-plugin.js'
import handler from '../api/send-registration-email.js'
import { sendRegistrationEmail } from '../src/lib/registration-email.js'

const SUPABASE_URL = 'https://example-project.supabase.co'
const ENV_KEYS = ['ZEPTOMAIL_TOKEN', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'VERCEL_ENV', 'PUBLIC_SITE_URL', 'ALLOWED_ORIGINS']
const savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]))
const originalFetch = globalThis.fetch

const payload = { email: 'test@example.com', fullName: 'Test <script>', receiptId: 'TBSR-2026-1234', kind: 'participant' }
const accepted = () => new Response(JSON.stringify({ data: [{ code: 'EM_104' }] }), { status: 200 })

beforeEach(() => {
  process.env.ZEPTOMAIL_TOKEN = 'test-only-token'
  process.env.SUPABASE_URL = SUPABASE_URL
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
  delete process.env.VITE_SUPABASE_URL
  delete process.env.VERCEL_ENV
  delete process.env.PUBLIC_SITE_URL
  delete process.env.ALLOWED_ORIGINS
})

afterEach(() => {
  globalThis.fetch = originalFetch
  for (const [k, v] of Object.entries(savedEnv)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
})

function response() {
  return { headers: {}, setHeader(k, v) { this.headers[k] = v }, writeHead(status, headers) { this.statusCode = status; Object.assign(this.headers, headers) }, end(body) { this.body = JSON.parse(body); this.writableEnded = true } }
}

// Fake Supabase REST + ZeptoMail. Records every call so tests can assert order and content.
function mockBackend({ registration = { full_name: 'Test <script>', contact_name: 'Sponsor <b>', created_at: new Date().toISOString() }, sentCount = 0, lookupStatus = 200, logStatus = 201, mail = accepted } = {}) {
  const calls = { lookups: [], counts: 0, logs: [], mails: [], order: [] }
  globalThis.fetch = async (url, options = {}) => {
    const u = String(url)
    if (u.startsWith(`${SUPABASE_URL}/rest/v1/registration_email_log`)) {
      if ((options.method || 'GET') === 'POST') {
        calls.logs.push(JSON.parse(options.body)); calls.order.push('log')
        return new Response(null, { status: logStatus })
      }
      calls.counts++; calls.order.push('count')
      return new Response(JSON.stringify(Array.from({ length: sentCount }, (_, id) => ({ id }))), { status: 200 })
    }
    if (u.startsWith(`${SUPABASE_URL}/rest/v1/`)) {
      calls.lookups.push({ url: u, headers: options.headers }); calls.order.push('lookup')
      return new Response(JSON.stringify(registration ? [registration] : []), { status: lookupStatus })
    }
    if (u === 'https://api.zeptomail.com/v1.1/email') {
      calls.mails.push({ body: JSON.parse(options.body), headers: options.headers }); calls.order.push('mail')
      return typeof mail === 'function' ? mail() : mail
    }
    throw new Error(`unexpected fetch ${u}`)
  }
  return calls
}

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: actual API handler receives POST instead of SPA/404`, async () => {
    let middleware
    const calls = mockBackend()
    registrationEmailPlugin()[hook]({ config: { mode: 'test', envDir: '/private/tmp/nonexistent-email-test' }, middlewares: { use(fn) { middleware = fn } } })
    const req = Readable.from([JSON.stringify(payload)])
    Object.assign(req, { url: '/api/send-registration-email', method: 'POST', headers: {} })
    const res = response()
    await middleware(req, res, () => assert.fail('API fell through'))
    assert.equal(res.statusCode, 200)
    assert.deepEqual(res.body, { ok: true })
    assert.equal(calls.mails.length, 1)
    assert.equal(calls.mails[0].body.to[0].email_address.address, payload.email)
    assert.ok(calls.mails[0].body.htmlbody.includes('Test &lt;script&gt;'))
    let fellThrough = false
    await middleware({ url: '/tabsur', method: 'GET' }, response(), () => { fellThrough = true })
    assert.equal(fellThrough, true)
    const large = Readable.from(['x'.repeat(16385)])
    Object.assign(large, { url: '/api/send-registration-email', method: 'POST', headers: {} })
    const largeRes = response()
    await middleware(large, largeRes, () => assert.fail())
    assert.equal(largeRes.statusCode, 413)
    assert.equal(calls.mails.length, 1)
  })
}

test('missing configuration returns a failure, never a successful skip', async () => {
  globalThis.fetch = () => assert.fail('must not call anything')
  for (const missing of ['ZEPTOMAIL_TOKEN', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_URL']) {
    const saved = process.env[missing]
    delete process.env[missing]
    const res = response()
    await handler({ method: 'POST', body: payload }, res)
    assert.equal(res.statusCode, 503, missing)
    assert.equal(res.body.code, 'EMAIL_NOT_CONFIGURED')
    process.env[missing] = saved
  }
})

test('invalid methods, JSON, recipients, kinds and receipt ids never send mail', async () => {
  globalThis.fetch = () => assert.fail('must not call anything')
  for (const [req, expected] of [
    [{ method: 'GET' }, 405],
    [{ method: 'POST', body: '{' }, 400],
    [{ method: 'POST', body: 'null' }, 400],
    [{ method: 'POST', body: { ...payload, email: 'invalid' } }, 400],
    [{ method: 'POST', body: { ...payload, kind: 'other' } }, 400],
    [{ method: 'POST', body: { ...payload, kind: 'constructor' } }, 400],
    [{ method: 'POST', body: { ...payload, receiptId: 'اضغط الرابط evil.example' } }, 400],
    [{ method: 'POST', body: { ...payload, receiptId: 42 } }, 400],
  ]) {
    const res = response()
    await handler(req, res)
    assert.equal(res.statusCode, expected)
  }
})

test('mail is only sent to an email that actually registered recently', async () => {
  const calls = mockBackend({ registration: null })
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.statusCode, 403)
  assert.equal(res.body.code, 'EMAIL_NOT_ALLOWED')
  assert.equal(calls.mails.length, 0)
  assert.equal(calls.logs.length, 0)
  const lookup = new URL(calls.lookups[0].url)
  assert.equal(lookup.pathname, '/rest/v1/registrations')
  assert.equal(lookup.searchParams.get('email'), 'eq.test@example.com')
  assert.match(lookup.searchParams.get('created_at'), /^gte\.\d{4}-\d{2}-\d{2}T/)
  assert.equal(calls.lookups[0].headers.apikey, 'test-service-key')
  assert.equal(calls.lookups[0].headers.Authorization, 'Bearer test-service-key')
})

test('new-style secret keys are sent only in the apikey header', async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_example'
  const calls = mockBackend()
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(calls.lookups[0].headers.apikey, 'sb_secret_example')
  assert.equal(calls.lookups[0].headers.Authorization, undefined)
})

test('sends are capped per email address', async () => {
  const calls = mockBackend({ sentCount: 3 })
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.statusCode, 429)
  assert.equal(res.body.code, 'EMAIL_LIMIT_REACHED')
  assert.equal(calls.mails.length, 0)
  assert.equal(calls.logs.length, 0)
})

test('the attempt is logged before the provider is called', async () => {
  const calls = mockBackend()
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.statusCode, 200)
  assert.deepEqual(calls.order, ['lookup', 'count', 'log', 'mail'])
  assert.deepEqual(calls.logs[0], { email: 'test@example.com', kind: 'participant' })
})

test('database problems fail closed without sending mail', async () => {
  for (const options of [{ lookupStatus: 500 }, { logStatus: 500 }]) {
    const calls = mockBackend(options)
    const res = response()
    await handler({ method: 'POST', body: payload }, res)
    assert.equal(res.statusCode, 503)
    assert.equal(res.body.code, 'EMAIL_NOT_CONFIGURED')
    assert.equal(calls.mails.length, 0)
  }
})

test('the greeting uses the stored name, never text sent by the browser', async () => {
  const calls = mockBackend({ registration: { full_name: 'Real Person', created_at: new Date().toISOString() } })
  const res = response()
  await handler({ method: 'POST', body: { ...payload, fullName: 'Win a prize at evil.example <a href="https://evil.example">here</a>' } }, res)
  assert.equal(res.statusCode, 200)
  const mail = calls.mails[0].body
  for (const part of [mail.htmlbody, mail.textbody, mail.to[0].email_address.name]) {
    assert.ok(!part.includes('evil.example'))
  }
  assert.ok(mail.htmlbody.includes('Real Person'))
  assert.ok(mail.textbody.includes('Real Person'))
  assert.equal(mail.track_opens, false)
})

test('in production only our own site may trigger mail', async () => {
  process.env.VERCEL_ENV = 'production'
  globalThis.fetch = () => assert.fail('must not call anything')
  const blocked = response()
  await handler({ method: 'POST', headers: { origin: 'https://evil.example' }, body: payload }, blocked)
  assert.equal(blocked.statusCode, 403)
  assert.equal(blocked.body.code, 'EMAIL_NOT_ALLOWED')

  process.env.ALLOWED_ORIGINS = 'https://events.amana-md.gov.sa'
  for (const origin of ['https://cubex.com.sa', 'https://www.cubex.com.sa', 'https://events.amana-md.gov.sa']) {
    mockBackend()
    const res = response()
    await handler({ method: 'POST', headers: { origin }, body: payload }, res)
    assert.equal(res.statusCode, 200, origin)
  }
})

test('API responses are never cached', async () => {
  mockBackend()
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff')
})

test('provider rejections and malformed success responses never report success', async () => {
  for (const upstream of [() => new Response('{"error":{"message":"private provider detail"}}', { status: 401 }), () => new Response('{}'), () => new Response('<html>oops</html>')]) {
    mockBackend({ mail: upstream })
    const res = response()
    await handler({ method: 'POST', body: payload }, res)
    assert.equal(res.statusCode, 502)
    assert.equal(res.body.ok, false)
    assert.ok(!JSON.stringify(res.body).includes('private provider detail'))
  }
})

test('provider timeout returns a recoverable failure', async () => {
  mockBackend({ mail: () => { throw new DOMException('timeout', 'TimeoutError') } })
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.statusCode, 504)
})

test('provider failures explain the required fix without exposing provider details', async () => {
  for (const [providerCode, expected] of [
    ['SERR_157', 'EMAIL_AUTH_FAILED'], ['SM_111', 'EMAIL_SENDER_UNVERIFIED'],
    ['SM_128', 'EMAIL_ACCOUNT_PENDING'], ['AE_101', 'EMAIL_ACCOUNT_BLOCKED'],
    ['LE_101', 'EMAIL_CREDITS_EXPIRED'], ['LE_102', 'EMAIL_CREDITS_EXHAUSTED'],
    ['SM_133', 'EMAIL_LIMIT_REACHED'], ['SERR_156', 'EMAIL_IP_RESTRICTED'],
    ['UNKNOWN', 'EMAIL_PROVIDER_ERROR'],
  ]) {
    mockBackend({ mail: () => new Response(JSON.stringify({ error: {
      details: [{ code: providerCode, message: 'private provider detail', target_value: payload.email }],
    } }), { status: 401 }) })
    const res = response()
    await handler({ method: 'POST', body: payload }, res)
    assert.equal(res.statusCode, 502)
    assert.equal(res.body.code, expected)
    assert.ok(!JSON.stringify(res.body).includes('private provider detail'))
    assert.ok(!JSON.stringify(res.body).includes(payload.email))
  }
  mockBackend({ mail: () => new Response(JSON.stringify({ error: {
    details: [{ code: 'SM_113', inner_error: { code: 'SMI_115' } }],
  } }), { status: 401 }) })
  const res = response()
  await handler({ method: 'POST', body: payload }, res)
  assert.equal(res.body.code, 'EMAIL_LIMIT_REACHED')
})

test('copied authorization prefix and surrounding form whitespace are normalized', async () => {
  process.env.ZEPTOMAIL_TOKEN = '  Zoho-enczapikey test-only-token  '
  const calls = mockBackend()
  const res = response()
  await handler({ method: 'POST', body: { ...payload, email: ` ${payload.email} `, fullName: ` ${payload.fullName} ` } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(calls.mails[0].headers.Authorization, 'Zoho-enczapikey test-only-token')
  assert.equal(calls.mails[0].body.to[0].email_address.address, payload.email)
  assert.equal(calls.mails[0].body.to[0].email_address.name, 'Test <script>')
})

test('client identifies HTML fallback and preserves actionable server error codes', async () => {
  globalThis.fetch = async () => new Response('<html>SPA</html>')
  assert.equal((await sendRegistrationEmail(payload)).code, 'EMAIL_ROUTE_MISSING')
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, code: 'EMAIL_CREDITS_EXHAUSTED' }), { status: 502 })
  assert.equal((await sendRegistrationEmail(payload)).code, 'EMAIL_CREDITS_EXHAUSTED')
})

test('sponsor confirmation checks the sponsor table and uses the sponsor template', async () => {
  const calls = mockBackend()
  const res = response()
  await handler({ method: 'POST', body: { email: payload.email, fullName: 'Someone', kind: 'sponsor' } }, res)
  assert.equal(res.body.ok, true)
  const lookup = new URL(calls.lookups[0].url)
  assert.equal(lookup.pathname, '/rest/v1/sponsor_registrations')
  assert.equal(lookup.searchParams.get('contact_email'), 'eq.test@example.com')
  assert.ok(calls.mails[0].body.subject.includes('الرعاية'))
  assert.ok(calls.mails[0].body.htmlbody.includes('Sponsor &lt;b&gt;'))
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
