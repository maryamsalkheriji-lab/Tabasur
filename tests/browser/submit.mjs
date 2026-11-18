// End-to-end check of the team submission page against a local Vite server that runs the real API handler on an
// in-process Postgres (PGlite) and a fake Supabase Storage (TUS resumable uploads + signed PUT for declarations). Covers:
// register → a signed declaration per member → video upload → receipt, lookup by code and by mobile, replacing the video,
// the one-person-one-team rule, the declaration gate, validation messages, and phone-width layout.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { startFakeStorage } from '../helpers/fake-storage.mjs'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core')

const port = Number(process.env.SUBMIT_TEST_PORT || 5177)
const base = `http://127.0.0.1:${port}`
const shots = process.env.REMOTE_SCREENSHOTS
if (shots) await mkdir(shots, { recursive: true })
const fake = await startFakeStorage()
const vite = spawn('npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], {
  cwd: new URL('../../', import.meta.url).pathname,
  env: { ...process.env, ...fake.env(), SUBMISSIONS_DEV_DB: 'pglite', VERCEL_ENV: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let viteLog = ''
vite.stdout.on('data', chunk => { viteLog += chunk })
vite.stderr.on('data', chunk => { viteLog += chunk })
const deadline = Date.now() + 60000
while (Date.now() < deadline) {
  try { const res = await fetch(`${base}/tabsur/submit`); if (res.ok) break } catch { /* not yet */ }
  await new Promise(resolve => setTimeout(resolve, 400))
}
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) })
const stamp = Date.now()
const videoPath = join(tmpdir(), `tabsur-test-${stamp}.mp4`)
await writeFile(videoPath, Buffer.alloc(7 * 1024 * 1024 + 517, 9)) // ~7 MB → قطعتان (6 MB + الباقي)
const pngPath = join(tmpdir(), `tabsur-iqrar-${stamp}.png`)
await writeFile(pngPath, Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'))
const pdfPath = join(tmpdir(), `tabsur-iqrar-${stamp}.pdf`)
await writeFile(pdfPath, Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'))
const txtPath = join(tmpdir(), `tabsur-notes-${stamp}.txt`)
await writeFile(txtPath, 'not a declaration')

async function newPage(lang, width) {
  const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  // ردود الخادم المقصودة (403/409/4xx) يسجّلها المتصفح كأخطاء موارد؛ نتجاهلها ونبقي أي خطأ آخر.
  page.on('console', message => { if (message.type() === 'error' && !/status of 4\d\d/.test(message.text())) errors.push(message.text()) })
  await page.addInitScript(lang => localStorage.setItem('tabsur-lang', lang), lang)
  return { page, errors }
}
const noOverflow = async (page, label) => assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `horizontal overflow: ${label}`)
// رفع إقرار العضو رقم index من شاشة الفريق
async function uploadDeclaration(page, index, nationalId, filePath) {
  const row = page.locator(`#consent-${index}`)
  await row.locator('input[type="text"]').fill(nationalId)
  await row.locator('input[type="file"]').setInputFiles(filePath)
  await page.locator(`#upload-consent-${index}`).click()
  // عند النجاح يختفي النموذج (وزرّه) وتبقى شارة «الإقرار مرفوع»؛ عند الخطأ يبقى الزر فتنتهي المهلة برسالة واضحة
  await page.locator(`#upload-consent-${index}`).waitFor({ state: 'detached', timeout: 20000 })
  await row.locator('[class*="chipOk"]').waitFor({ timeout: 5000 })
}

try {
  assert.ok(viteLog.includes('ready') || viteLog.includes('Local'), `vite did not start:\n${viteLog}`)
  // ─── 1) فريق جديد: تسجيل → إقرار لكل عضو → رفع → إيصال (عربي، جوال) ───
  {
    const { page, errors } = await newPage('ar', 390)
    await page.goto(`${base}/tabsur/submit?track=life`)
    await page.locator('#submit-title').waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.match(await page.locator('[role="status"]').first().innerText(), /مفتوح الآن/)
    assert.equal(await page.locator('#submit-rules li').count(), 5)
    assert.match(await page.locator('#submit-rules').innerText(), /نموذج الإقرار/)
    if (shots) await page.screenshot({ path: `${shots}/submit-choose-ar-390.png`, fullPage: true })
    await page.locator('#mode-new').click()
    await page.locator('#new-team-form').waitFor()
    assert.ok(await page.locator('input[name="track"][value="life"]').isChecked(), 'track preselected from the query string')
    assert.equal(await page.locator('#new-team-form input[type="checkbox"]').count(), 0, 'the old consent checkbox is gone')
    assert.equal(await page.locator('#new-file').count(), 0, 'no video field before the team is registered')
    await page.fill('#team-name', 'عدسة المدينة')
    await page.locator('#new-team-form [class*="memberRow_"] input[type="tel"]').first().fill('0501111111')
    await page.locator('text=سارة محمد الحربي').first().waitFor({ timeout: 8000 })
    await page.locator('#add-member').click()
    const rows = page.locator('[class*="memberRow_"]')
    assert.equal(await rows.count(), 2)
    await rows.nth(1).locator('input[type="tel"]').fill('0599999999')
    await page.locator('text=غير مسجّل في المعسكر').waitFor({ timeout: 8000 })
    await rows.nth(1).locator('input[type="tel"]').fill('0501111111')
    await page.locator('text=هذا الرقم مكرر').waitFor({ timeout: 8000 })
    await rows.nth(1).locator('input[type="tel"]').fill('+201001234567')
    await page.locator('text=Hadeel Mohammed').first().waitFor({ timeout: 8000 })
    if (shots) await page.screenshot({ path: `${shots}/submit-form-ar-390.png`, fullPage: true })
    await page.locator('#submit-new').click()
    // شاشة الفريق: الكود والإقرارات، ورفع الفيديو مقفول
    await page.locator('#team-card').waitFor({ timeout: 15000 })
    assert.match(await page.locator('#team-card').innerText(), /TB-001/)
    assert.match(await page.locator('[role="status"]', { hasText: 'تم تسجيل الفريق' }).innerText(), /TB-001/)
    await page.locator('#consents').waitFor()
    assert.match(await page.locator('#consents-progress').innerText(), /0 من 2/)
    assert.equal(await page.locator('#download-consent').getAttribute('href'), '/assets/tabsur-iqrar.pdf')
    assert.equal((await fetch(`${base}/assets/tabsur-iqrar.pdf`)).status, 200, 'the declaration template is served')
    assert.equal(await page.locator('#replace-video').isDisabled(), true, 'video upload is locked until every declaration is in')
    assert.match(await page.locator('#video-section').innerText(), /بعد اكتمال إقرارات جميع الأعضاء/)
    assert.equal(await page.locator('#team-card').getByText('الإقرار مطلوب').count(), 2)
    await noOverflow(page, 'team screen 390')
    if (shots) await page.screenshot({ path: `${shots}/submit-consents-ar-390.png`, fullPage: true })
    // تحققات نموذج الإقرار
    await page.locator('#upload-consent-0').click()
    assert.match(await page.locator('#consent-0 .error-msg').innerText(), /رقم الهوية/)
    await page.locator('#consent-0 input[type="text"]').fill('1023456789')
    await page.locator('#consent-0 input[type="file"]').setInputFiles(txtPath)
    assert.match(await page.locator('#consent-0 .error-msg').innerText(), /ليس PDF ولا صورة/)
    // إقرار القائدة (صورة) ثم إقرار العضو الثاني (PDF)
    await uploadDeclaration(page, 0, '1023456789', pngPath)
    assert.match(await page.locator('#consents-progress').innerText(), /1 من 2/)
    assert.equal(await page.locator('#replace-video').isDisabled(), true)
    await uploadDeclaration(page, 1, 'A1234567', pdfPath)
    assert.match(await page.locator('#consents-progress').innerText(), /اكتملت إقرارات جميع الأعضاء/)
    assert.equal(await page.locator('#team-card').getByText('الإقرار مرفوع').count(), 2)
    assert.equal(await page.locator('#replace-video').isDisabled(), false, 'video upload opens once both declarations are in')
    assert.deepEqual(fake.consents().map(f => f.key.replace(/-[a-z0-9]+\.(png|pdf)$/, '.$1')), ['submissions/consents/life/TB-001/TB-001-1.png', 'submissions/consents/life/TB-001/TB-001-2.pdf'])
    if (shots) await page.screenshot({ path: `${shots}/submit-consents-done-ar-390.png`, fullPage: true })
    // الفيديو
    await page.locator('#replace-video').click()
    await page.fill('#replace-title', 'أسواق المدينة')
    await page.setInputFiles('#replace-file', videoPath)
    await page.locator('text=tabsur-test').first().waitFor()
    await page.locator('#submit-replace').click()
    await page.locator('#submit-receipt').waitFor({ timeout: 60000 })
    const receipt = await page.locator('#submit-receipt').innerText()
    assert.match(receipt, /TB-001/)
    assert.match(receipt, /عدسة المدينة/)
    assert.match(receipt, /سارة محمد الحربي/)
    assert.match(receipt, /Hadeel Mohammed/)
    assert.match(receipt, /أسواق المدينة/)
    assert.match(receipt, /تم رفع الفيديو بنجاح/)
    assert.match(await page.locator('#share-whatsapp').getAttribute('href'), /^https:\/\/wa\.me\/\?text=/)
    await noOverflow(page, 'receipt 390')
    if (shots) await page.screenshot({ path: `${shots}/submit-receipt-ar-390.png`, fullPage: true })
    const stored = fake.videos()
    assert.equal(stored.length, 1)
    assert.match(stored[0].key, /^submissions\/life\/TB-001\/TB-001-[a-z0-9]+\.mp4$/)
    assert.equal(stored[0].size, 7 * 1024 * 1024 + 517)
    assert.match(receipt, /TB-001 - عدسة المدينة - أسواق المدينة\.mp4/)
    assert.deepEqual(errors, [], errors.join('\n'))
    await page.close()
    console.log('PASS new team: registered TB-001, two signed declarations (PNG + PDF), 7 MB video in two TUS chunks, receipt shown')
  }
  // ─── 2) الشخص في فريق واحد فقط + عرض الفريق + استبدال الفيديو + استبدال إقرار (إنجليزي، سطح مكتب) ───
  {
    const { page, errors } = await newPage('en', 1280)
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#mode-new').click()
    await page.fill('#team-name', 'Second Team')
    await page.locator('label:has(input[name="track"][value="identity"])').click()
    await page.locator('[class*="memberRow_"] input[type="tel"]').fill('0501111111')
    await page.locator('text=already in another team').waitFor({ timeout: 8000 })
    await page.locator('#submit-new').click()
    await page.locator('[role="alert"]').waitFor()
    assert.match(await page.locator('[role="alert"]').innerText(), /already in another team/)
    // عرض الفريق بالكود ثم استبدال الفيديو
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#mode-existing').click()
    await page.fill('#team-code', 'tb-001')
    await page.locator('#existing-team input[type="tel"]').fill('0501111111')
    await page.locator('#lookup-team').click()
    await page.locator('#team-card').waitFor()
    assert.match(await page.locator('#team-card').innerText(), /City Lens|عدسة المدينة/)
    assert.match(await page.locator('#team-card').innerText(), /TB-001/)
    // تعديل اسم الفريق فقط: اسم مستخدم يُرفض، واسم جديد يظهر في البطاقة فورًا
    await page.locator('#rename-team').click()
    assert.equal(await page.locator('#new-team-name').inputValue(), 'عدسة المدينة')
    await page.fill('#new-team-name', 'M')
    await page.locator('#save-team-name').click()
    assert.match(await page.locator('#existing-team [role="alert"]').last().innerText(), /two to sixty/)
    await page.fill('#new-team-name', 'Madinah Lens')
    if (shots) await page.screenshot({ path: `${shots}/submit-rename-en-1280.png`, fullPage: true })
    await page.locator('#save-team-name').click()
    await page.locator('#rename-form').waitFor({ state: 'detached', timeout: 8000 })
    assert.match(await page.locator('#team-card').innerText(), /Madinah Lens/)
    assert.match(await page.locator('[role="status"]', { hasText: 'Team name updated' }).innerText(), /updated/)
    assert.match(await page.locator('#consents').innerText(), /Member declarations/)
    assert.match(await page.locator('#consents-progress').innerText(), /All member declarations are in/)
    await page.locator('#replace-video').click()
    await page.fill('#replace-title', 'Better cut')
    await page.setInputFiles('#replace-file', videoPath)
    if (shots) await page.screenshot({ path: `${shots}/submit-replace-en-1280.png`, fullPage: true })
    await page.locator('#submit-replace').click()
    await page.locator('#submit-receipt').waitFor({ timeout: 60000 })
    assert.match(await page.locator('#submit-receipt').innerText(), /Better cut/)
    assert.match(await page.locator('#submit-receipt').innerText(), /replaced successfully/)
    const files = fake.videos()
    assert.equal(files.length, 1, 'the previous video was removed from the bucket')
    assert.match(files[0].key, /^submissions\/life\/TB-001\//)
    assert.match(await page.locator('#submit-receipt').innerText(), /TB-001 - Madinah Lens - Better cut\.mp4/)
    // عرض الفريق برقم الجوال فقط، واستبدال إقرار عضو
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#mode-existing').click()
    await page.locator('#existing-team input[type="tel"]').fill('+201001234567')
    await page.locator('#lookup-team').click()
    await page.locator('#team-card').waitFor()
    assert.match(await page.locator('#team-card').innerText(), /Better cut/)
    await page.locator('#consent-1').getByRole('button', { name: 'Replace declaration' }).click()
    const before = fake.consents().map(f => f.key)
    await uploadDeclaration(page, 1, 'B7654321', pngPath)
    assert.equal(fake.consents().length, 2, 'one declaration per member')
    assert.ok(!fake.consents().some(f => f.key === before[1]), 'the replaced declaration left the bucket')
    // غير العضو لا يستطيع الاستبدال
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#mode-existing').click()
    await page.fill('#team-code', 'TB-001')
    await page.locator('#existing-team input[type="tel"]').fill('0502222222')
    await page.locator('#lookup-team').click()
    await page.locator('#team-card').waitFor()
    await page.locator('#replace-video').click()
    await page.fill('#replace-title', 'Sneaky')
    await page.setInputFiles('#replace-file', videoPath)
    await page.locator('#submit-replace').click()
    await page.locator('[role="alert"]').waitFor()
    assert.match(await page.locator('[role="alert"]').innerText(), /not a member/)
    assert.deepEqual(errors, [], errors.join('\n'))
    await page.close()
    console.log('PASS governance: taken member refused, lookup by code and by mobile, replacement removed the old file, declaration replaced, non-member blocked')
  }
  // ─── 3) تخطيط الشاشات الصغيرة بلا تمرير أفقي ───
  for (const [lang, width] of [['ar', 320], ['en', 390], ['ar', 768], ['en', 1440]]) {
    const { page, errors } = await newPage(lang, width)
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#submit-title').waitFor()
    await page.locator('#mode-new').click()
    await page.locator('#add-member').click()
    await page.evaluate(() => document.fonts.ready)
    await noOverflow(page, `${lang} new form at ${width}px`)
    if (shots && width !== 768) await page.screenshot({ path: `${shots}/submit-new-${lang}-${width}.png`, fullPage: true })
    // شاشة الفريق مع قسم الإقرارات
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#mode-existing').click()
    await page.fill('#team-code', 'TB-001')
    await page.locator('#existing-team input[type="tel"]').fill('0501111111')
    await page.locator('#lookup-team').click()
    await page.locator('#consents').waitFor()
    await page.locator('#consent-0').getByRole('button').first().click() // استبدال الإقرار: يفتح النموذج
    await page.evaluate(() => document.fonts.ready)
    await noOverflow(page, `${lang} team screen at ${width}px`)
    if (shots && width === 320) await page.screenshot({ path: `${shots}/submit-team-${lang}-${width}.png`, fullPage: true })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS layout: 320/390/768/1440 without horizontal overflow, including the declarations section')
} finally {
  await browser.close()
  vite.kill('SIGTERM')
  await fake.close()
}
