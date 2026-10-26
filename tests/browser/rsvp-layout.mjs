// Run with an installed Playwright module and browser; no database writes.
// RSVP_BASE_URL defaults to the local Vite server. It can also verify production.
import assert from 'node:assert/strict'
const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core')
const engine = process.env.RSVP_BROWSER === 'webkit' ? webkit : chromium
const browser = await engine.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) })
const base = process.env.RSVP_BASE_URL || 'http://127.0.0.1:5173'
const sizes = [{ width: 1470, height: 800 }, { width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 390, height: 844 }, { width: 320, height: 568 }]
const event = { id: '00000000-0000-0000-0000-000000000001', name: 'فعالية مدينة تك', slug: 'madinah-tech' }

async function centered(page, label) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const box = await page.evaluate(() => {
    const section = document.querySelector('main section').getBoundingClientRect()
    const main = document.querySelector('main')
    return { left: section.left, right: section.right, offset: section.x + section.width / 2 - innerWidth / 2, width: innerWidth, scroll: main.scrollLeft, documentWidth: document.documentElement.scrollWidth }
  })
  assert.ok(Math.abs(box.offset) <= 1, `${label}: content shifted ${box.offset}px`)
  assert.ok(box.left >= 0 && box.right <= box.width, `${label}: content is clipped`)
  assert.equal(box.scroll, 0, `${label}: invitation has an internal horizontal scroll offset`)
  assert.ok(box.documentWidth <= box.width, `${label}: document overflows horizontally`)
}

async function revealFocusedElement(page) {
  // Browser focus/scroll restoration must never pan into the decorative waves.
  await page.locator('main > button').evaluate(button => {
    button.focus()
    button.scrollIntoView({ block: 'nearest', inline: 'start', behavior: 'instant' })
  })
  await centered(page, 'native focus reveal')
}

try {
  for (const viewport of sizes) {
    const page = await browser.newPage({ viewport })
    const errors = [], posts = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/rest/v1/**', route => {
      const request = route.request()
      if (request.url().endsWith('/rpc/jd_submit_rsvp')) {
        posts.push(request.postDataJSON())
        return route.fulfill({ status: 204, body: '' })
      }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify([event]) })
    })
    await page.goto(`${base}/rsvp/madinah-tech`)
    await page.locator('#rsvp-name').waitFor()
    await page.evaluate(() => document.fonts.ready)
    await centered(page, 'Arabic form')
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('heading', { name: 'We’d love to see you.' }).waitFor()
    await revealFocusedElement(page)
    await page.locator('#rsvp-name').fill('ضيف اختبار المحاذاة')
    await page.locator('button[value="attending"]').click()
    await page.getByRole('heading', { name: 'We look forward to seeing you' }).waitFor()
    await centered(page, 'English confirmation')
    assert.equal(await page.locator('[role="status"][tabindex="-1"]').evaluate(el => el === document.activeElement), true)
    await revealFocusedElement(page)
    await page.getByRole('button', { name: 'العربية', exact: true }).click()
    await page.getByRole('heading', { name: 'ننتظرك بكل ترحيب' }).waitFor()
    await centered(page, 'Arabic confirmation')
    await revealFocusedElement(page)
    await page.getByRole('button', { name: 'English', exact: true }).click()
    await page.getByRole('heading', { name: 'We look forward to seeing you' }).waitFor()
    await page.reload()
    await page.getByRole('heading', { name: 'We look forward to seeing you' }).waitFor()
    await centered(page, 'Restored English confirmation')
    if (process.env.RSVP_SCREENSHOTS) await page.screenshot({ path: `${process.env.RSVP_SCREENSHOTS}/rsvp-confirmation-${viewport.width}.png`, fullPage: true })
    await page.getByRole('button', { name: 'Edit response', exact: true }).click()
    await page.locator('#rsvp-name').fill('Long Guest Name '.repeat(7).trim())
    await page.locator('button[value="declined"]').click()
    await page.getByRole('heading', { name: 'Thank you for letting us know' }).waitFor()
    await centered(page, 'English decline with a long name')
    await page.getByRole('button', { name: 'العربية', exact: true }).click()
    await page.getByRole('heading', { name: 'شكرًا لإبلاغنا' }).waitFor()
    await centered(page, 'Arabic decline')
    assert.equal(posts.length, 2)
    assert.equal(posts[0].p_response_id, posts[1].p_response_id)
    assert.deepEqual(errors, [])
    console.log(`PASS ${viewport.width}px: forms, confirmations, declines, language changes, focus, reload, long name, one response ID`)
    await page.close()
  }

  const page = await browser.newPage({ viewport: sizes[0] })
  await page.addInitScript(() => sessionStorage.setItem('cubex-rsvp:madinah-tech', JSON.stringify({ id: '00000000-0000-0000-0000-000000000011', name: 'Layout Test', status: 'attending' })))
  await page.route('**/rest/v1/**', route => route.fulfill({ contentType: 'application/json', body: JSON.stringify([event]) }))
  await page.goto(`${base}/rsvp/madinah-tech?lang=en`)
  await page.getByRole('heading', { name: 'We look forward to seeing you' }).waitFor()
  for (let i = 0; i < 12; i++) {
    await page.getByRole('button', { name: i % 2 ? 'English' : 'العربية', exact: true }).click()
    await page.setViewportSize(sizes[i % sizes.length])
    await page.getByRole('heading', { name: i % 2 ? 'We look forward to seeing you' : 'ننتظرك بكل ترحيب' }).waitFor()
    await centered(page, `Language and resize ${i}`)
  }
  console.log('PASS repeated language switching and window resizing; no live replies created')
} finally { await browser.close() }
