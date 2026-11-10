// End-to-end check of the team submission page against a local Vite server that runs the real API handler on an
// in-process Postgres (PGlite) and a fake Supabase Storage (TUS resumable uploads). Covers: new team + upload + receipt, lookup by code and by
// mobile, replacing the video, the one-person-one-team rule, validation messages, and phone-width layout.
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
const videoPath = join(tmpdir(), `tabsur-test-${Date.now()}.mp4`)
await writeFile(videoPath, Buffer.alloc(7 * 1024 * 1024 + 517, 9)) // ~7 MB → قطعتان (6 MB + الباقي)

async function newPage(lang, width) {
  const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  // ردود الخادم المقصودة (403/409/4xx) يسجّلها المتصفح كأخطاء موارد؛ نتجاهلها ونبقي أي خطأ آخر.
  page.on('console', message => { if (message.type() === 'error' && !/status of 4\d\d/.test(message.text())) errors.push(message.text()) })
  await page.addInitScript(lang => localStorage.setItem('tabsur-lang', lang), lang)
  return { page, errors }
}
async function typePhone(page, selector, number) {
  const input = page.locator(`${selector} input[type="tel"]`)
  await input.fill(number)
}

try {
  assert.ok(viteLog.includes('ready') || viteLog.includes('Local'), `vite did not start:\n${viteLog}`)
  // ─── 1) فريق جديد: تسجيل + رفع + إيصال (عربي، جوال) ───
  {
    const { page, errors } = await newPage('ar', 390)
    await page.goto(`${base}/tabsur/submit?track=life`)
    await page.locator('#submit-title').waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.match(await page.locator('[role="status"]').first().innerText(), /مفتوح الآن/)
    assert.equal(await page.locator('#submit-rules li').count(), 4)
    if (shots) await page.screenshot({ path: `${shots}/submit-choose-ar-390.png`, fullPage: true })
    await page.locator('#mode-new').click()
    await page.locator('#new-team-form').waitFor()
    assert.ok(await page.locator('input[name="track"][value="life"]').isChecked(), 'track preselected from the query string')
    await page.fill('#team-name', 'عدسة المدينة')
    await typePhone(page, '#new-team-form .memberRow, #new-team-form [class*="memberRow_"]', '0501111111')
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
    await page.fill('#new-title', 'أسواق المدينة')
    await page.setInputFiles('#new-file', videoPath)
    await page.locator('text=tabsur-test').first().waitFor()
    // الموافقة مطلوبة
    await page.locator('#submit-new').click()
    await page.locator('[role="alert"]').waitFor()
    assert.match(await page.locator('[role="alert"]').innerText(), /إذن النشر/)
    await page.locator('input[type="checkbox"]').check()
    if (shots) await page.screenshot({ path: `${shots}/submit-form-ar-390.png`, fullPage: true })
    await page.locator('#submit-new').click()
    await page.locator('#submit-receipt').waitFor({ timeout: 60000 })
    const receipt = await page.locator('#submit-receipt').innerText()
    assert.match(receipt, /TB-001/)
    assert.match(receipt, /عدسة المدينة/)
    assert.match(receipt, /سارة محمد الحربي/)
    assert.match(receipt, /Hadeel Mohammed/)
    assert.match(receipt, /أسواق المدينة/)
    assert.match(await page.locator('#share-whatsapp').getAttribute('href'), /^https:\/\/wa\.me\/\?text=/)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'no horizontal overflow on receipt')
    if (shots) await page.screenshot({ path: `${shots}/submit-receipt-ar-390.png`, fullPage: true })
    const stored = fake.videos()
    assert.equal(stored.length, 1)
    assert.match(stored[0].key, /^submissions\/life\/TB-001\/TB-001-[a-z0-9]+\.mp4$/)
    assert.equal(stored[0].size, 7 * 1024 * 1024 + 517)
    assert.match(receipt, /TB-001 - عدسة المدينة - أسواق المدينة\.mp4/)
    assert.deepEqual(errors, [], errors.join('\n'))
    await page.close()
    console.log('PASS new team: registered TB-001, uploaded 7 MB in two TUS chunks through the browser, receipt shown')
  }
  // ─── 2) الشخص في فريق واحد فقط + عرض الفريق + استبدال الفيديو (إنجليزي، سطح مكتب) ───
  {
    const { page, errors } = await newPage('en', 1280)
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#mode-new').click()
    await page.fill('#team-name', 'Second Team')
    await page.locator('label:has(input[name="track"][value="identity"])').click()
    await page.locator('[class*="memberRow_"] input[type="tel"]').fill('0501111111')
    await page.locator('text=already in another team').waitFor({ timeout: 8000 })
    await page.fill('#new-title', 'Another video')
    await page.setInputFiles('#new-file', videoPath)
    await page.locator('input[type="checkbox"]').check()
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
    await page.locator('#replace-video').click()
    await page.fill('#replace-title', 'Better cut')
    await page.setInputFiles('#replace-file', videoPath)
    await page.locator('#replace-form input[type="checkbox"]').check()
    if (shots) await page.screenshot({ path: `${shots}/submit-replace-en-1280.png`, fullPage: true })
    await page.locator('#submit-replace').click()
    await page.locator('#submit-receipt').waitFor({ timeout: 60000 })
    assert.match(await page.locator('#submit-receipt').innerText(), /Better cut/)
    assert.match(await page.locator('#submit-receipt').innerText(), /replaced successfully/)
    const files = fake.videos()
    assert.equal(files.length, 1, 'the previous video was removed from the bucket')
    assert.match(files[0].key, /^submissions\/life\/TB-001\//)
    assert.match(await page.locator('#submit-receipt').innerText(), /TB-001 - عدسة المدينة - Better cut\.mp4/)
    // عرض الفريق برقم الجوال فقط
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#mode-existing').click()
    await page.locator('#existing-team input[type="tel"]').fill('+201001234567')
    await page.locator('#lookup-team').click()
    await page.locator('#team-card').waitFor()
    assert.match(await page.locator('#team-card').innerText(), /Better cut/)
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
    await page.locator('#replace-form input[type="checkbox"]').check()
    await page.locator('#submit-replace').click()
    await page.locator('[role="alert"]').waitFor()
    assert.match(await page.locator('[role="alert"]').innerText(), /not a member/)
    assert.deepEqual(errors, [], errors.join('\n'))
    await page.close()
    console.log('PASS governance: taken member refused, lookup by code and by mobile, replacement removed the old file, non-member blocked')
  }
  // ─── 3) تخطيط الشاشات الصغيرة بلا تمرير أفقي ───
  for (const [lang, width] of [['ar', 320], ['en', 390], ['ar', 768], ['en', 1440]]) {
    const { page, errors } = await newPage(lang, width)
    await page.goto(`${base}/tabsur/submit`)
    await page.locator('#submit-title').waitFor()
    await page.locator('#mode-new').click()
    await page.locator('#add-member').click()
    await page.evaluate(() => document.fonts.ready)
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} overflow at ${width}px`)
    if (shots && width !== 768) await page.screenshot({ path: `${shots}/submit-new-${lang}-${width}.png`, fullPage: true })
    assert.deepEqual(errors, [])
    await page.close()
  }
  console.log('PASS layout: 320/390/768/1440 without horizontal overflow')
} finally {
  await browser.close()
  vite.kill('SIGTERM')
  await fake.close()
}
