import test from 'node:test'
import assert from 'node:assert/strict'
import { toSafeHttpUrl, isHttpUrl, csvCell } from '../src/lib/security.js'
import { findPublicEnvSecrets } from '../server/public-env-guard.js'

test('only http and https links can become clickable', () => {
  for (const bad of [
    'javascript:alert(1)', ' JavaScript:alert(1)', 'java\tscript:alert(1)', 'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)', 'file:///etc/passwd', 'www.example.com', '', '   ', null, undefined, 42,
  ]) {
    assert.equal(toSafeHttpUrl(bad), null, String(bad))
    assert.equal(isHttpUrl(bad), false, String(bad))
  }
  assert.equal(toSafeHttpUrl('https://behance.net/someone'), 'https://behance.net/someone')
  assert.equal(toSafeHttpUrl('  HTTP://Example.com/a b  '), 'http://example.com/a%20b')
})

test('spreadsheet export cells cannot run formulas', () => {
  assert.equal(csvCell('=HYPERLINK("http://evil","x")'), `"'=HYPERLINK(""http://evil"",""x"")"`)
  for (const lead of ['=', '+', '-', '@', '\t', '\r']) {
    assert.ok(csvCell(`${lead}1+1`).startsWith(`"'${lead}`), JSON.stringify(lead))
  }
  assert.equal(csvCell('0551234567'), '"0551234567"')
  assert.equal(csvCell('نص "عادي"'), '"نص ""عادي"""')
  assert.equal(csvCell(null), '""')
  assert.equal(csvCell(undefined), '""')
})

test('build guard refuses secrets in public VITE_ variables', () => {
  const b64 = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  const serviceJwt = `${b64({ alg: 'HS256' })}.${b64({ role: 'service_role' })}.sig`
  const anonJwt = `${b64({ alg: 'HS256' })}.${b64({ role: 'anon' })}.sig`
  assert.equal(findPublicEnvSecrets({ VITE_SUPABASE_ANON_KEY: anonJwt, VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_ADMIN_EMAIL: 'a@b.co' }).length, 0)
  assert.equal(findPublicEnvSecrets({ VITE_SUPABASE_ANON_KEY: serviceJwt }).length, 1)
  assert.equal(findPublicEnvSecrets({ VITE_SUPABASE_ANON_KEY: 'sb_secret_abc' }).length, 1)
  assert.equal(findPublicEnvSecrets({ VITE_ADMIN_PASSWORD: 'x' }).length, 1)
  assert.equal(findPublicEnvSecrets({ VITE_ZEPTOMAIL_TOKEN: 'x' }).length, 1)
  assert.equal(findPublicEnvSecrets({ ZEPTOMAIL_TOKEN: 'server-only is fine' }).length, 0)
})
