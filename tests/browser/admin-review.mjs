// Admin qualification flow in a real browser against the local Vite server: mocked Supabase auth and a mocked
// /api/submissions (in-memory state), so nothing reaches an external service. Covers: decision buttons, the team moving to
// the «المتأهلون» tab, undo from both tabs, the replaced-video notice, the not-migrated banner, and phone-width layout.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core')
const base = process.env.ADMIN_BASE_URL || 'http://127.0.0.1:5173'
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(base).hostname))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) })
const shots = process.env.ADMIN_SCREENSHOTS
if (shots) await mkdir(shots, { recursive: true })
const user = { id: '00000000-0000-0000-0000-000000000002', email: 'review-test@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {}, created_at: '2026-11-01T00:00:00.000Z' }
const expiresAt = Math.floor(Date.now() / 1000) + 3600
const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: user.id, exp: expiresAt, role: 'authenticated' })).toString('base64url'), 'test-signature'].join('.')

function makeState(ready = true) {
  const member = (id, name, mobile, leader = false, inPerson = false) => ({ id, name, mobile, leader, inPerson })
  const video = (title, path) => ({ path, name: `${path.split('/')[1]} - ${title}.mp4`, title, size: 87 * 1024 * 1024, mimeType: 'video/mp4', uploadedAt: '2026-11-11T18:00:00.000Z', consentVersion: '2026-11-10.1', consentAt: '2026-11-11T17:59:00.000Z' })
  const pending = { status: 'pending', at: null, by: null, previous: null }
  return {
    ready,
    teams: [
      { id: 't1', code: 'TB-001', name: 'عدسة المدينة', track: 'life', trackLabel: 'جودة الحياة', type: 'mixed', createdAt: '2026-11-11T10:00:00.000Z', members: [member('m1', 'سارة محمد الحربي', '0501111111', true, true), member('m2', 'Hadeel Mohammed', '+201001234567')], video: video('أسواق المدينة', 'life/TB-001/TB-001-a.mp4'), pending: null, review: { ...pending } },
      { id: 't2', code: 'TB-002', name: 'نبض الحرم', track: 'identity', trackLabel: 'الهوية والسردية', type: 'inperson', createdAt: '2026-11-11T11:00:00.000Z', members: [member('m3', 'نورة سعد الجهني', '0503333333', true, true)], video: video('حكاية الطريق', 'identity/TB-002/TB-002-b.mp4'), pending: null, review: { ...pending } },
      { id: 't3', code: 'TB-003', name: 'بلا فيديو', track: 'destination', trackLabel: 'الوجهة وتجربة الزائر', type: 'online', createdAt: '2026-11-11T12:00:00.000Z', members: [member('m4', 'ريم فهد القحطاني', '0505555555', true)], video: null, pending: null, review: { ...pending } },
      { id: 't4', code: 'TB-004', name: 'نسخة مستبدلة', track: 'investment', trackLabel: 'الاستثمار والفرص', type: 'online', createdAt: '2026-11-11T13:00:00.000Z', members: [member('m5', 'عبدالله خالد العمري', '0502222222', true)], video: video('نسخة أحدث', 'investment/TB-004/TB-004-c.mp4'), pending: null, review: { status: 'pending', at: null, by: null, previous: 'qualified' } },
    ],
    log: [],
  }
}

function overview(state) {
  const withVideo = state.teams.filter(t => t.video)
  const by = status => withVideo.filter(t => t.review.status === status).length
  return {
    ok: true, settings: { open: true, deadline: '2026-11-21T20:59:00.000Z', maxBytes: 2 * 1024 ** 3 }, teams: state.teams,
    storage: { configured: true, bucket: 'submissions', usedBytes: withVideo.reduce((s, t) => s + t.video.size, 0), includedBytes: 100 * 1024 ** 3 },
    review: { ready: state.ready },
    stats: { teams: state.teams.length, withVideo: withVideo.length, members: state.teams.reduce((s, t) => s + t.members.length, 0), qualified: by('qualified'), rejected: by('rejected'), undecided: by('pending'), inperson: 148, registrations: 740 },
  }
}

async function openAdmin(width, state) {
  const page = await browser.newPage({ viewport: { width, height: 1100 }, reducedMotion: 'reduce' })
  const errors = [], aborted = []
  page.on('pageerror', error => errors.push(error.message))
  // ردود 4xx المقصودة وطلبات الجهات الخارجية التي نمنعها (تحليلات، Supabase REST غير المحاكى) ليست أخطاء في الواجهة.
  page.on('console', message => { if (message.type() === 'error' && !/status of 4\d\d|Failed to load resource: net::ERR_FAILED/.test(message.text())) errors.push(message.text()) })
  await page.route('**/*', route => {
    const request = route.request(), url = new URL(request.url())
    const abort = () => { aborted.push(`${request.method()} ${url.host}${url.pathname}`); return route.abort() }
    const fulfill = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(data) })
    if (url.hostname.endsWith('.supabase.co')) {
      if (url.pathname === '/auth/v1/token') return fulfill({ access_token: token, refresh_token: 'test-only-refresh', expires_in: 3600, expires_at: expiresAt, token_type: 'bearer', user })
      if (url.pathname === '/auth/v1/user') return fulfill(user)
      if (request.method() === 'GET' && url.pathname === '/rest/v1/registrations') return fulfill([])
      if (request.method() === 'GET' && url.pathname === '/rest/v1/sponsor_registrations') return fulfill([])
      return abort()
    }
    if (url.pathname === '/api/submissions') {
      const body = request.postDataJSON()
      state.log.push(body)
      if (request.headers().authorization !== `Bearer ${token}`) return fulfill({ ok: false, code: 'UNAUTHORIZED' }, 401)
      if (body.action === 'admin_overview') return fulfill(overview(state))
      if (body.action === 'admin_review') {
        if (!state.ready) return fulfill({ ok: false, code: 'REVIEW_NOT_MIGRATED' }, 503)
        const team = state.teams.find(t => t.id === body.teamId)
        if (!team) return fulfill({ ok: false, code: 'TEAM_NOT_FOUND' }, 404)
        if (body.status !== 'pending' && !team.video) return fulfill({ ok: false, code: 'VIDEO_NOT_FOUND' }, 409)
        team.review = body.status === 'pending' ? { status: 'pending', at: null, by: null, previous: null } : { status: body.status, at: new Date().toISOString(), by: user.email, previous: null }
        return fulfill({ ok: true, review: team.review })
      }
      return fulfill({ ok: false, code: 'UNKNOWN_ACTION' }, 400)
    }
    if (!['GET', 'HEAD'].includes(request.method())) return abort()
    if (![new URL(base).hostname, 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname)) return abort()
    return route.continue()
  })
  await page.goto(`${base}/admin?tab=submissions`)
  await page.locator('#admin-email').fill(user.email)
  await page.locator('#admin-password').fill('test-only-not-a-real-password')
  await page.getByRole('button', { name: 'دخول اللوحة', exact: true }).click()
  await page.locator('#teams-card').waitFor()
  await page.evaluate(() => document.fonts.ready)
  return { page, errors, aborted }
}
const noOverflow = async page => {
  const report = await page.evaluate(() => {
    // في الاتجاه RTL يتمدد المحتوى الزائد إلى اليسار (left سالب)
    const over = [...document.querySelectorAll('body *')].filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1) })
    return { scrollWidth: document.documentElement.scrollWidth, innerWidth, over: over.slice(0, 12).map(el => { const r = el.getBoundingClientRect(); return `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} left=${Math.round(r.left)} right=${Math.round(r.right)} text=${el.textContent.trim().slice(0, 30)}` }) }
  })
  assert.ok(report.scrollWidth <= report.innerWidth + 1, `horizontal overflow at ${report.innerWidth}px: ${report.over.join(' | ')}`)
}
const row = (page, code) => page.locator('#teams-card tbody tr', { hasText: code })

try {
  // ─── 1) القرار، الانتقال إلى «المتأهلون»، التراجع، وتنبيه الفيديو المستبدل (سطح مكتب) ───
  {
    const state = makeState()
    const { page, errors, aborted } = await openAdmin(1280, state)
    assert.equal(await page.locator('#review-not-ready').count(), 0)
    assert.equal(await page.locator('#tab-qualified strong').innerText(), '0')
    assert.equal(await row(page, 'TB-001').getByRole('button', { name: 'يتأهل', exact: true }).count(), 1)
    assert.equal(await row(page, 'TB-001').getByRole('button', { name: 'لا يتأهل', exact: true }).count(), 1)
    assert.match(await row(page, 'TB-003').innerText(), /لا يوجد/)
    assert.equal(await row(page, 'TB-003').getByRole('button', { name: 'يتأهل', exact: true }).count(), 0)
    assert.match(await row(page, 'TB-004').innerText(), /استُبدل الفيديو بعد قرار سابق \(متأهل\)/)
    if (shots) await page.screenshot({ path: `${shots}/admin-review-all-1280.png`, fullPage: true })
    // كل الأعمدة ظاهرة على سطح المكتب دون تمرير أفقي داخل البطاقة، وزرّا القرار داخل الشاشة
    const fits = async selector => assert.ok(await page.locator(selector).evaluate(el => el.scrollWidth <= el.clientWidth + 1), `${selector} needs no horizontal scroll at 1280`)
    await fits('#teams-card [class*="tableWrap"]')
    const box = await row(page, 'TB-001').getByRole('button', { name: 'يتأهل', exact: true }).boundingBox()
    assert.ok(box && box.x >= 0 && box.x + box.width <= 1280, 'decision button inside the viewport')

    await row(page, 'TB-001').getByRole('button', { name: 'يتأهل', exact: true }).click()
    await page.locator('[role="status"]', { hasText: 'انتقل إلى المتأهلين' }).waitFor()
    assert.match(await row(page, 'TB-001').innerText(), /متأهل/)
    assert.equal(await row(page, 'TB-001').getByRole('button', { name: 'تغيير القرار', exact: true }).count(), 1)
    assert.equal(await page.locator('#tab-qualified strong').innerText(), '1')
    await row(page, 'TB-002').getByRole('button', { name: 'لا يتأهل', exact: true }).click()
    await page.locator('[role="status"]', { hasText: 'غير متأهل' }).waitFor()
    assert.match(await row(page, 'TB-002').innerText(), /غير متأهل/)
    assert.deepEqual(state.log.filter(b => b.action === 'admin_review').map(b => [b.teamId, b.status]), [['t1', 'qualified'], ['t2', 'rejected']])

    // مرشّح القرار
    await page.locator('select[aria-label="القرار"]').selectOption('pending')
    assert.deepEqual(await page.locator('#teams-card tbody tr .codeTag, #teams-card tbody tr [class*="codeTag"]').allInnerTexts(), ['TB-004'])
    await page.locator('select[aria-label="القرار"]').selectOption('qualified')
    assert.deepEqual(await page.locator('#teams-card tbody tr [class*="codeTag"]').allInnerTexts(), ['TB-001'])
    await page.locator('select[aria-label="القرار"]').selectOption('')

    // تبويب المتأهلين
    await page.locator('#tab-qualified').click()
    await page.locator('#qualified-card').waitFor()
    assert.deepEqual(await page.locator('#qualified-card tbody tr [class*="codeTag"]').allInnerTexts(), ['TB-001'])
    assert.match(await page.locator('#qualified-card').innerText(), /عدسة المدينة/)
    assert.equal(await page.locator('#qualified-card').getByRole('button', { name: 'حذف الفريق' }).count(), 0, 'no destructive actions in the qualified tab')
    assert.equal(await page.locator('#qualified-card [aria-label^="إزالة"]').count(), 0)
    if (shots) await page.screenshot({ path: `${shots}/admin-qualified-1280.png`, fullPage: true })
    await fits('#qualified-card [class*="tableWrap"]')
    assert.match(await page.locator('#qualified-card tbody tr').first().innerText(), /متأهل/)
    // إلغاء التأهّل مع تأكيد
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: 'إلغاء التأهّل', exact: true }).click()
    await page.waitForTimeout(300)
    assert.equal(await page.locator('#qualified-card tbody tr').count(), 1, 'dismissing the confirm keeps the team')
    page.once('dialog', dialog => dialog.accept())
    await page.getByRole('button', { name: 'إلغاء التأهّل', exact: true }).click()
    await page.locator('#qualified-card', { hasText: 'لا يوجد متأهلون بعد' }).waitFor()
    assert.equal(await page.locator('#tab-qualified strong').innerText(), '0')
    assert.deepEqual(state.log.filter(b => b.action === 'admin_review').at(-1), { action: 'admin_review', teamId: 't1', status: 'pending' })
    // العودة إلى التسليمات: الفريق بلا قرار مع الزرّين من جديد
    await page.locator('#tab-submissions').click()
    await page.locator('#teams-card').waitFor()
    assert.equal(await row(page, 'TB-001').getByRole('button', { name: 'يتأهل', exact: true }).count(), 1)
    await noOverflow(page)
    assert.ok(aborted.every(entry => !entry.includes('/api/')), `an app request was blocked: ${aborted.join(', ')}`)
    console.log('blocked third-party requests:', [...new Set(aborted)].join(', ') || 'none')
    assert.deepEqual(errors, [], errors.join('\n'))
    await page.close()
    console.log('PASS review: decide, filter, move to qualified tab, undo with confirm, replaced-video notice')
  }
  // ─── 2) قبل تشغيل ملف SQL: تنبيه واضح والأزرار معطّلة ───
  {
    const state = makeState(false)
    const { page, errors } = await openAdmin(1280, state)
    assert.match(await page.locator('#review-not-ready').innerText(), /review-2026-11-12\.sql/)
    assert.equal(await row(page, 'TB-001').getByRole('button', { name: 'يتأهل', exact: true }).isDisabled(), true)
    await page.locator('#tab-qualified').click()
    await page.locator('#qualified-card').waitFor()
    assert.equal(await page.locator('#review-not-ready').count(), 1)
    assert.deepEqual(errors, [], errors.join('\n'))
    await page.close()
    console.log('PASS not migrated: banner names the SQL file and the decision buttons are disabled')
  }
  // ─── 3) الجوال: بطاقات بلا تمرير أفقي، والقرار يعمل ───
  for (const width of [320, 390]) {
    const state = makeState()
    const { page, errors } = await openAdmin(width, state)
    await noOverflow(page)
    await row(page, 'TB-001').getByRole('button', { name: 'يتأهل', exact: true }).click()
    await page.locator('[role="status"]', { hasText: 'انتقل إلى المتأهلين' }).waitFor()
    if (shots) await page.screenshot({ path: `${shots}/admin-review-all-${width}.png`, fullPage: true })
    await page.locator('#tab-qualified').click()
    await page.locator('#qualified-card').waitFor()
    assert.equal(await page.locator('#qualified-card tbody tr').count(), 1)
    await noOverflow(page)
    if (shots) await page.screenshot({ path: `${shots}/admin-qualified-${width}.png`, fullPage: true })
    assert.deepEqual(errors, [], errors.join('\n'))
    await page.close()
  }
  console.log('PASS layout: 320/390 without horizontal overflow, decisions work from a phone')
} finally {
  await browser.close()
}
