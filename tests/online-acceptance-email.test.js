import test from 'node:test'
import assert from 'node:assert/strict'
import { buildOnlineAcceptanceEmail, onlinePageUrl, ONLINE_ACCEPTANCE_SUBJECT, DEFAULT_WHATSAPP_GROUP_URL } from '../server/email/online-acceptance.js'
import { loadOnlineEmailAssets, clearEmailAssetCache, ONLINE_EMAIL_FILES } from '../server/email/assets.js'

const fromAddress = 'info@cubex.com.sa'

const WHATSAPP = 'https://chat.whatsapp.com/ABCDEF123456'

test('the acceptance email is bilingual, points to the online page and WhatsApp, and never mentions a date, venue, theme or deadline', async () => {
  const assets = await loadOnlineEmailAssets('https://cubex.com.sa')
  const mail = buildOnlineAcceptanceEmail({ name: 'مريم', fromAddress, publicSite: 'https://cubex.com.sa', whatsappUrl: WHATSAPP, receiptId: 'TBSR-2026-1234', assets })
  assert.equal(mail.subject, ONLINE_ACCEPTANCE_SUBJECT)
  assert.match(mail.subject, /الأونلاين/)
  assert.match(mail.subject, /Online track/)
  assert.equal(mail.pageUrl, 'https://cubex.com.sa/tabsur/remote')
  assert.equal(mail.whatsappUrl, WHATSAPP)
  for (const part of [mail.html, mail.text]) {
    assert.ok(part.includes('https://cubex.com.sa/tabsur/remote'), 'online page link')
    assert.ok(part.includes(WHATSAPP), 'whatsapp link')
    assert.ok(part.includes('مرحبًا مريم'), 'arabic greeting')
    assert.ok(part.includes('Hello مريم'), 'english greeting')
    assert.match(part, /Google Drive/)
    assert.match(part, /واتساب/)
    assert.match(part, /WhatsApp/)
    assert.ok(part.includes('TBSR-2026-1234'))
    // لا موعد تسليم، لا اختيار محور، لا رابط تسليم لاحق، لا تاريخ أو مكان حضور
    assert.doesNotMatch(part, /فيديوك|بيتك|تقدر|محور|اختر|60 إلى 180|60 to 180|ثانية|seconds|التسليم|الموعد|موعد|submission|deadline|theme|مسرح|نوفمبر|November|الحضوري|in-person|وصلنا طلبك|سنراجع/)
  }
  assert.deepEqual(mail.attachments.map(a => a.name), [ONLINE_EMAIL_FILES.guide.attachAs, ONLINE_EMAIL_FILES.postAr.attachAs, ONLINE_EMAIL_FILES.postEn.attachAs])
  assert.ok(mail.attachments.every(a => a.content.length > 1000 && a.mime_type))
  assert.deepEqual(mail.inline_images.map(i => i.cid), ['tabsur-header', 'tabsur-online-post-ar', 'tabsur-online-post-en'])
  for (const { cid } of mail.inline_images) assert.ok(mail.html.includes(`cid:${cid}`))
  const bytes = Buffer.byteLength(JSON.stringify(mail))
  assert.ok(bytes < 6 * 1024 * 1024, `payload too large: ${bytes}`)
})

test('the WhatsApp button always points to the group; bad overrides fall back to the built-in link', () => {
  assert.match(DEFAULT_WHATSAPP_GROUP_URL, /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/)
  const without = buildOnlineAcceptanceEmail({ name: 'x', fromAddress, assets: {} })
  assert.equal(without.whatsappUrl, DEFAULT_WHATSAPP_GROUP_URL)
  assert.ok(without.html.includes(DEFAULT_WHATSAPP_GROUP_URL) && without.html.includes('واتساب') && without.text.includes('WhatsApp'))
  for (const bad of ['javascript:alert(1)', 'https://evil.example/chat.whatsapp.com/x', 'http://chat.whatsapp.com/abc', 'https://chat.whatsapp.com/abc"><script>']) {
    const mail = buildOnlineAcceptanceEmail({ name: 'x', fromAddress, whatsappUrl: bad, assets: {} })
    assert.equal(mail.whatsappUrl, DEFAULT_WHATSAPP_GROUP_URL, bad)
    assert.ok(!mail.html.includes('evil.example') && !mail.html.includes('<script>'), bad)
  }
  const ok = buildOnlineAcceptanceEmail({ name: 'x', fromAddress, whatsappUrl: ' https://chat.whatsapp.com/D3MQ_x-9?s=qt&p=i ', assets: {} })
  assert.equal(ok.whatsappUrl, 'https://chat.whatsapp.com/D3MQ_x-9?s=qt&p=i')
  assert.ok(ok.html.includes('https://chat.whatsapp.com/D3MQ_x-9?s=qt&amp;p=i'))
})

test('names are escaped and missing assets fall back to the hosted copies instead of failing', () => {
  const mail = buildOnlineAcceptanceEmail({ name: 'Evil <a href="https://evil.example">x</a>', fromAddress, publicSite: 'https://cubex.com.sa/', assets: {} })
  assert.ok(!mail.html.includes('<a href="https://evil.example">'))
  assert.ok(mail.html.includes('Evil &lt;a href=&quot;https://evil.example&quot;&gt;x&lt;/a&gt;'))
  assert.deepEqual(mail.attachments, [])
  assert.deepEqual(mail.inline_images, [])
  assert.ok(mail.html.includes('https://cubex.com.sa/email/tabsur-header.png'))
  assert.ok(mail.html.includes('https://cubex.com.sa/email/tabsur-online-post-ar.jpg'))
  assert.ok(mail.html.includes('https://cubex.com.sa/email/tabsur-online-post-en.jpg'))
  assert.ok(!mail.html.includes('cid:'))
  assert.ok(!mail.text.includes('رقم الطلب'))
  assert.ok(mail.html.includes('https://cubex.com.sa/tabsur/remote'), 'trailing slash on the site is normalized')
})

test('the public email assets exist with the expected types', async () => {
  clearEmailAssetCache()
  const assets = await loadOnlineEmailAssets()
  assert.equal(assets.guide.bytes.subarray(0, 4).toString(), '%PDF')
  assert.equal(assets.header.bytes.subarray(1, 4).toString(), 'PNG')
  assert.equal(assets.postAr.bytes[0], 0xff)
  assert.equal(assets.postEn.bytes[0], 0xff)
  assert.equal(onlinePageUrl('https://cubex.com.sa/'), 'https://cubex.com.sa/tabsur/remote')
})

test('fetched fallbacks are accepted only when the bytes really are the expected file type', async () => {
  const { looksLike } = await import('../server/email/assets.js')
  // الموقع يعيد index.html برمز 200 لأي مسار غير موجود، فلا يكفي رمز الحالة
  assert.equal(looksLike('application/pdf', Buffer.from('<!doctype html><html>spa</html>')), false)
  assert.equal(looksLike('image/png', Buffer.from('<!doctype html>')), false)
  assert.equal(looksLike('image/jpeg', Buffer.from('<!doctype html>')), false)
  assert.equal(looksLike('application/pdf', Buffer.from('%PDF-1.4 rest')), true)
  assert.equal(looksLike('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0])), true)
  assert.equal(looksLike('image/png', Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n'), Buffer.alloc(8)])), true)
  assert.equal(looksLike('text/plain', Buffer.from('anything')), true, 'unknown types are not blocked')
  assert.equal(looksLike('application/pdf', null), false)
})
