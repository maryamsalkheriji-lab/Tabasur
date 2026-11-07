// Uses isolated browser contexts and mocked Supabase responses only.
// No real login, participant records, or writes reach an external service.
import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright-core')
const base = process.env.ADMIN_BASE_URL || 'http://127.0.0.1:5173'
assert.ok(['127.0.0.1', 'localhost', 'cubex.com.sa'].includes(new URL(base).hostname))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE } : {}) })
const shots = process.env.ADMIN_SCREENSHOTS
if (shots) await mkdir(shots, { recursive: true })
const user = { id: '00000000-0000-0000-0000-000000000001', email: 'pagination-test@example.test', aud: 'authenticated', role: 'authenticated', user_metadata: {}, app_metadata: {}, created_at: '2026-11-01T00:00:00.000Z' }
const expiresAt = Math.floor(Date.now()/1000) + 3600
const token = [Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'), Buffer.from(JSON.stringify({sub:user.id,exp:expiresAt,role:'authenticated'})).toString('base64url'), 'test-signature'].join('.')
const rows = Array.from({length:667}, (_, i) => ({
  id: String(i+1), full_name: `مشارك تجريبي ${i+1}`, email: `participant-${i+1}@example.test`, mobile: '0500000000',
  city: 'مدينة تجريبية', specialty: 'video', ai_experience: 'yes', experience: '1-3',
  created_at: new Date(Date.UTC(2026,10,1) - i*60000).toISOString(),
}))

async function checkLayout(page, nav) {
  const box = await nav.evaluate(el => {
    const rect = el.getBoundingClientRect()
    return { left:rect.left, right:rect.right, width:innerWidth, scrollWidth:document.documentElement.scrollWidth,
      controls:[...el.querySelectorAll('button,select')].map(node=>{ const r=node.getBoundingClientRect(); return {left:r.left,right:r.right} }) }
  })
  assert.ok(box.left>=0 && box.right<=box.width+1, 'Pagination remains inside the viewport')
  assert.ok(box.scrollWidth<=box.width+1, 'No horizontal document overflow')
  for (const control of box.controls) assert.ok(control.left>=box.left && control.right<=box.right+1, 'Every page control is visible within the card')
  assert.ok(await nav.getByRole('button').count()<=11, 'At most seven page numbers and four navigation buttons')
}

try {
  for (const width of [320,390,768,1440,2340]) {
    const page = await browser.newPage({ viewport:{width,height:1000}, reducedMotion:'reduce' })
    const errors=[], blocked=[]
    let rowCount=rows.length
    page.on('pageerror', error=>errors.push(error.message))
    await page.route('**/*', route => {
      const request=route.request(), url=new URL(request.url())
      const fulfill=data=>route.fulfill({contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)})
      if (url.hostname.endsWith('.supabase.co')) {
        if (url.pathname==='/auth/v1/token') return fulfill({access_token:token,refresh_token:'test-only-refresh',expires_in:3600,expires_at:expiresAt,token_type:'bearer',user})
        if (url.pathname==='/auth/v1/user') return fulfill(user)
        if (request.method()==='GET' && url.pathname==='/rest/v1/registrations') return fulfill(rows.slice(0,rowCount))
        if (request.method()==='GET' && url.pathname==='/rest/v1/sponsor_registrations') return fulfill([])
        blocked.push(`${request.method()} ${url.pathname}`)
        return route.abort()
      }
      if (!['GET','HEAD'].includes(request.method())) { blocked.push(request.method()); return route.abort() }
      if (![new URL(base).hostname,'fonts.googleapis.com','fonts.gstatic.com'].includes(url.hostname)) return route.abort()
      return route.continue()
    })
    await page.goto(`${base}/admin`)
    await page.locator('#admin-email').fill(user.email)
    await page.locator('#admin-password').fill('test-only-not-a-real-password')
    await page.getByRole('button',{name:'دخول اللوحة',exact:true}).click()
    const nav=page.getByRole('navigation',{name:'صفحات المسجّلين'})
    await nav.waitFor()
    await page.evaluate(()=>document.fonts.ready)
    const status=nav.getByRole('status')
    const first=nav.getByRole('button',{name:'الصفحة الأولى',exact:true})
    const last=nav.getByRole('button',{name:'الصفحة الأخيرة',exact:true})
    const previous=nav.getByRole('button',{name:'الصفحة السابقة',exact:true})
    const next=nav.getByRole('button',{name:'الصفحة التالية',exact:true})
    const jump=nav.getByLabel('انتقل إلى صفحة')
    async function atPage(number,total=67) {
      await page.waitForFunction(({number,total})=>document.querySelector('nav[aria-label="صفحات المسجّلين"] [role="status"]')?.textContent===`الصفحة ${number} من ${total}`,{number,total})
      assert.equal(await nav.locator('[aria-current="page"]').textContent(),String(number))
      assert.equal(await page.locator('table tbody tr').first().locator('td').first().textContent(),String((number-1)*10+1))
      await checkLayout(page,nav)
    }
    await atPage(1)
    assert.equal(await first.isDisabled(),true)
    assert.equal(await previous.isDisabled(),true)
    assert.equal(await jump.locator('option').count(),67)
    await next.click(); await atPage(2)
    await last.click(); await atPage(67)
    assert.equal(await last.isDisabled(),true)
    assert.equal(await next.isDisabled(),true)
    assert.equal(await page.locator('table tbody tr').count(),7)
    await first.click(); await atPage(1)
    await jump.selectOption('33'); await atPage(33)
    await nav.getByRole('button',{name:'الصفحة 34',exact:true}).click(); await atPage(34)
    await previous.click(); await atPage(33)
    if(shots) await nav.screenshot({path:`${shots}/pagination-${width}.png`})
    await nav.getByRole('button',{name:'الصفحة 1',exact:true}).click(); await atPage(1)
    await last.click(); await atPage(67)
    const search=page.getByPlaceholder('ابحث بالاسم أو البريد أو المدينة...')
    await search.fill('participant-667@example.test')
    await nav.waitFor({state:'detached'})
    assert.equal(await page.locator('table tbody tr').count(),1)
    await search.fill(''); await atPage(1)
    await last.click(); await atPage(67)
    rowCount=12
    await page.getByRole('button',{name:'تحديث',exact:true}).click()
    await atPage(2,2)
    assert.equal(await page.locator('table tbody tr').count(),2)
    assert.deepEqual(errors,[])
    assert.deepEqual(blocked,[])
    console.log(`PASS ${width}px: 67 pages, first/last/next/previous/direct selection, filtering, refresh clamp, no clipped controls`)
    await page.close()
  }
} finally { await browser.close() }
