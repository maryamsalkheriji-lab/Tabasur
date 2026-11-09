// Local acceptance check for the remote participation page with submissions open:
// four tracks link to their own Drive folders, the site still mounts no uploader, and the API stays locked.
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
        // Old preview settings must not override the published shared library or the per-track folders.
        localStorage.setItem('tabsur-remote-preview-v2', JSON.stringify({ libraryUrl: 'https://drive.google.com/drive/folders/1FakeOverride_123', uploadsEnabled: true }))
      }, lang)
      await page.goto(`${base}/tabsur/remote?uploads=enabled`)
      await page.locator('#remote-title').waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.locator('#remote-submit article').count(), 4)
      assert.equal(await page.locator('#remote-submit button').count(), 0, 'no locked buttons remain')
      assert.equal(await page.locator('input[type="file"], dialog, main form').count(), 0)
      assert.match(await page.locator('#upload-how-to').innerText(), lang === 'ar' ? /ثلاث خطوات/ : /three steps/)
      assert.match(await page.locator('#upload-how-to').innerText(), lang === 'ar' ? /الاسم الكامل - رقم الجوال/ : /Full name - Mobile number/)
      assert.match(await page.locator('body').innerText(), lang === 'ar' ? /مفتوح الآن/ : /open now/)
      assert.equal(await page.locator('#remote-library a').getAttribute('href'), 'https://drive.google.com/drive/folders/1R0C4MsoTgcqEP9JdHGxZp-Ld2UKRpzGr')
      const folders = {
        destination: 'https://drive.google.com/drive/folders/1aPkjTMVHSsh8AC_fGeUh-MhtCwtmSjtb',
        life: 'https://drive.google.com/drive/folders/1j9RZE4kbLaGFQ5IoaD-GGBEHlLxH6qiq',
        investment: 'https://drive.google.com/drive/folders/1yzAy_szsE6wJ-HK1OyUYXmZSo5tDSvkn',
        identity: 'https://drive.google.com/drive/folders/1rpk0W6370XgSGMM_7ioYVsueQHWUgfk4',
      }
      const links = await page.locator('#remote-submit article a[target="_blank"]').all()
      assert.equal(links.length, 4, 'one upload link per track')
      for (const [id, href] of Object.entries(folders)) {
        const link = page.locator(`#remote-submit article[aria-labelledby="track-${id}"] a[target="_blank"]`)
        assert.equal(await link.getAttribute('href'), href, `${id} links to its own folder`)
        assert.match(await link.getAttribute('rel'), /noopener/)
        assert.match(await link.getAttribute('aria-label'), lang === 'ar' ? /ارفع فيديوهاتك هنا/ : /Upload your videos here/)
      }
      await page.locator('#remote-submit').evaluate(node => {
        const data = new DataTransfer()
        data.items.add(new File(['test'], 'city.mp4', { type: 'video/mp4' }))
        node.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }))
      })
      assert.equal(pickers, 0)
      assert.equal(await page.locator('input[type="file"], dialog').count(), 0)
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${lang} overflow at ${width}px`)
      if (shots && [390,1440].includes(width)) await page.screenshot({ path: `${shots}/remote-open-${lang}-${width}.png`, fullPage: true })
      const result = await page.request.post(`${base}/api/remote-upload?track=life`, { data: { name: 'not-an-upload', enabled: true } })
      assert.equal(result.status(), 423)
      assert.equal((await result.json()).code, 'UPLOADS_CLOSED')
      assert.deepEqual(errors, [])
      assert.deepEqual(writes, [])
      console.log(`PASS ${lang} ${width}px: library, four tracks linking to their own Drive folders, no picker/drop/upload, server still rejects direct submission`)
      await page.close()
    }
  }
} finally { await browser.close() }
