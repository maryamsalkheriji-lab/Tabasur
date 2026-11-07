// Local acceptance check for the published, locked remote participation page.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core')
const base = process.env.REMOTE_BASE_URL || 'http://127.0.0.1:5173'
assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(base).hostname))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) })
const shots = process.env.REMOTE_SCREENSHOTS
if (shots) await mkdir(shots, { recursive: true })
try {
  for (const lang of ['ar', 'en']) {
    for (const width of [320, 390, 768, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' })
      const errors = [], writes = []
      let pickers = 0
      page.on('pageerror', error => errors.push(error.message))
      page.on('filechooser', () => { pickers++ })
      await page.route('**/*', route => {
        const request = route.request(), url = new URL(request.url())
        if (!['GET', 'HEAD'].includes(request.method())) { writes.push(request.url()); return route.abort() }
        if (!['127.0.0.1', 'localhost', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return route.abort()
        return route.continue()
      })
      await page.addInitScript(lang => {
        localStorage.setItem('tabsur-lang', lang)
        // Old preview settings must not override the published shared library or open uploads.
        localStorage.setItem('tabsur-remote-preview-v2', JSON.stringify({ libraryUrl: 'https://drive.google.com/drive/folders/1FakeOverride_123', uploadsEnabled: true }))
      }, lang)
      await page.goto(`${base}/tabsur/remote?uploads=enabled`)
      await page.locator('#remote-title').waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.locator('#remote-submit article').count(), 4)
      assert.equal(await page.locator('#remote-submit button:disabled').count(), 4)
      assert.equal(await page.locator('input[type="file"], dialog, main form').count(), 0)
      assert.match(await page.locator('#upload-closed-note').innerText(), lang === 'ar' ? /مغلق حاليًا/ : /currently closed/)
      assert.equal(await page.locator('#remote-library a').getAttribute('href'), 'https://drive.google.com/drive/folders/1R0C4MsoTgcqEP9JdHGxZp-Ld2UKRpzGr')
      for (const button of await page.locator('#remote-submit button').all()) {
        // Removing disabled in devtools still cannot uncover a dormant picker or request.
        await button.evaluate(node => { node.disabled = false; node.click(); node.disabled = true })
      }
      await page.locator('#remote-submit').evaluate(node => {
        const data = new DataTransfer()
        data.items.add(new File(['test'], 'city.mp4', { type: 'video/mp4' }))
        node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }))
      })
      assert.equal(pickers, 0)
      assert.equal(await page.locator('input[type="file"], dialog').count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} overflow at ${width}px`)
      if (shots && [390,1440].includes(width)) await page.screenshot({ path: `${shots}/remote-closed-${lang}-${width}.png`, fullPage: true })
      const result = await page.request.post(`${base}/api/remote-upload?track=life`, { data: { name: 'not-an-upload', enabled: true } })
      assert.equal(result.status(), 423)
      assert.equal((await result.json()).code, 'UPLOADS_CLOSED')
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${lang} ${width}px: library, four locked tracks, no picker/drop/upload, server rejects submission`)
      await page.close()
    }
  }
} finally { await browser.close() }
