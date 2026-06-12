const RESEND_API_URL = 'https://api.resend.com/emails'

function json(res, status, payload) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, message: 'Method not allowed' })
  }

  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM || 'Tabsur <onboarding@resend.dev>'

  if (!apiKey) {
    return json(res, 200, { ok: false, skipped: true, message: 'RESEND_API_KEY is not configured' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { email, fullName, receiptId, origin, kind } = body
    if (!email || !fullName) {
      return json(res, 400, { ok: false, message: 'Missing email or fullName' })
    }

    const imageUrl = `${origin || ''}/assets/tabsur-registration-email.jpeg`
    const safeName = escapeHtml(fullName)
    const safeReceipt = escapeHtml(receiptId || '')
    const isSponsor = kind === 'sponsor'
    const subject = isSponsor ? 'تم استلام طلب الرعاية في تَبصَّر' : 'تم تسجيلك بنجاح في معسكر تَبصَّر'
    const kicker = isSponsor ? 'تم استلام طلب الرعاية' : 'تم تسجيلك بنجاح'
    const title = isSponsor ? `مرحبًا ${safeName}` : `مرحبًا ${safeName}`
    const message = isSponsor
      ? 'شكرًا لتواصلكم مع تَبصَّر. وصلنا طلب الرعاية بنجاح، وسنراجع بيانات الجهة ثم نتواصل مع الشخص المسؤول لمناقشة فرص الشراكة والدعم.'
      : 'شكرًا لتسجيلك في معسكر تَبصَّر. وصلنا طلبك بنجاح، وسنراجع بياناتك ثم نتواصل معك عبر البريد الإلكتروني أو رقم الجوال خلال الفترة القادمة.'

    const html = `
      <div dir="rtl" style="margin:0;background:#F8F4ED;padding:28px;font-family:Arial,'Tahoma',sans-serif;color:#0F1E2A;">
        <div style="max-width:680px;margin:0 auto;background:#ffffff;border:1px solid rgba(15,30,42,.10);border-radius:22px;overflow:hidden;">
          <img src="${imageUrl}" alt="تَبصَّر" style="display:block;width:100%;height:auto;background:#F8F4ED;" />
          <div style="padding:28px 30px 32px;text-align:right;">
            <p style="margin:0 0 8px;color:#1F8B5C;font-size:14px;font-weight:700;">${kicker}</p>
            <h1 style="margin:0 0 14px;font-size:30px;line-height:1.25;color:#0F1E2A;">${title}</h1>
            <p style="margin:0;color:#33536A;font-size:17px;line-height:1.9;">
              ${message}
            </p>
            ${safeReceipt ? `<div style="margin-top:22px;display:inline-block;padding:10px 16px;border-radius:999px;background:#EFF8F2;color:#1F8B5C;font-size:13px;font-weight:700;">رقم الطلب: ${safeReceipt}</div>` : ''}
            <p style="margin:24px 0 0;color:#7E8E9C;font-size:13px;line-height:1.7;">
              تَبصَّر · معسكر تسويق المدن بالذكاء الاصطناعي
            </p>
          </div>
        </div>
      </div>
    `

    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [email],
        subject,
        html,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return json(res, response.status, { ok: false, message: data.message || 'Email provider error', data })
    }

    return json(res, 200, { ok: true, data })
  } catch (error) {
    return json(res, 500, { ok: false, message: error.message || 'Unexpected error' })
  }
}
