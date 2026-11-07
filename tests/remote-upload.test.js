import test from 'node:test'
import assert from 'node:assert/strict'
import handler from '../api/remote-upload.js'
import { registrationEmailPlugin } from '../server/registration-email-plugin.js'

function response() {
  return { headers: {}, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = JSON.parse(body); this.writableEnded = true } }
}

test('remote uploads reject every method without inspecting files or contacting storage', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = () => assert.fail('Closed uploads must never contact Drive or storage')
  try {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']) {
      const req = { method, get body() { assert.fail('Closed uploads must not read the request body') } }
      const res = response()
      await handler(req, res)
      assert.equal(res.statusCode, 423)
      assert.deepEqual(res.body, { ok: false, code: 'UPLOADS_CLOSED' })
      assert.equal(res.headers['Cache-Control'], 'no-store')
    }
  } finally { globalThis.fetch = originalFetch }
})

for (const hook of ['configureServer', 'configurePreviewServer']) {
  test(`${hook}: direct upload requests stay closed without consuming the body`, async () => {
    let middleware
    registrationEmailPlugin()[hook]({ config: { mode: 'test', envDir: '/private/tmp/nonexistent-remote-upload-test' }, middlewares: { use(fn) { middleware = fn } } })
    const req = {
      method: 'POST', url: '/api/remote-upload?enabled=true&track=life',
      [Symbol.asyncIterator]() { assert.fail('Must not consume any video bytes') },
    }
    const res = response()
    await middleware(req, res, () => assert.fail('Locked endpoint must not fall through to the SPA'))
    assert.equal(res.statusCode, 423)
    assert.equal(res.body.code, 'UPLOADS_CLOSED')
  })
}
