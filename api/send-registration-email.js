const ZEPTOMAIL_API_URL = 'https://api.zeptomail.com/v1.1/email'

// الموقع العام — لتحميل صورة البانر داخل الرسالة.
// عملاء البريد لا يستطيعون تحميل صورة من localhost، فنُثبّت الدومين هنا.
const PUBLIC_SITE = process.env.PUBLIC_SITE_URL || 'https://cubex.com.sa'

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
    .replace(/'/g, '&#39;')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return json(res, 405, { ok: false, message: 'Method not allowed' })
  }

  const apiKey = process.env.ZEPTOMAIL_TOKEN
  const fromAddress = process.env.EMAIL_FROM_ADDRESS || 'info@cubex.com.sa'
  const fromName = process.env.EMAIL_FROM_NAME || 'تَبصِّر'

  if (!apiKey) {
    return json(res, 200, { ok: false, skipped: true, message: 'ZEPTOMAIL_TOKEN is not configured' })
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {})
    const { email, fullName, receiptId, kind } = body
    if (!email || !fullName) {
      return json(res, 400, { ok: false, message: 'Missing email or fullName' })
    }

    const imageUrl = `${PUBLIC_SITE}/assets/tabsur-registration-email.jpeg`
    const safeName = escapeHtml(fullName)
    const safeReceipt = escapeHtml(receiptId || '')
    const isSponsor = kind === 'sponsor'

    const subject = isSponsor ? 'تم استلام طلب الرعاية في تَبصِّر' : 'تم تسجيلك بنجاح في معسكر تَبصِّر'
    const kicker = isSponsor ? 'تم استلام طلب الرعاية' : 'تم تسجيلك بنجاح'
    const title = `مرحبًا ${safeName}`
    const message = isSponsor
      ? 'شكرًا لتواصلكم مع تَبصِّر. وصلنا طلب الرعاية بنجاح، وسنراجع بيانات الجهة ثم نتواصل مع الشخص المسؤول لمناقشة فرص الشراكة والدعم.'
      : 'شكرًا لتسجيلك في معسكر تَبصِّر. وصلنا طلبك بنجاح، وسنراجع بياناتك ثم نتواصل معك عبر البريد الإلكتروني أو رقم الجوال خلال الفترة القادمة.'

    const html = `
      <div dir="rtl" style="margin:0;background:#FAF6EF;padding:28px;font-family:Arial,'Tahoma',sans-serif;color:#2D251E;">
        <div style="max-width:680px;margin:0 auto;background:#FFFDFC;border:1px solid rgba(45,37,30,.12);border-radius:22px;overflow:hidden;">
          <img src="${imageUrl}" alt="تَبصِّر · معسكر تسويق المدن" style="display:block;width:100%;height:auto;background:#FAF6EF;" />
          <div style="padding:28px 30px 32px;text-align:right;">
            <p style="margin:0 0 8px;color:#668066;font-size:14px;font-weight:700;">${kicker}</p>
            <h1 style="margin:0 0 14px;font-size:30px;line-height:1.25;color:#2D251E;">${title}</h1>
            <p style="margin:0;color:#5D4B3D;font-size:17px;line-height:1.9;">
              ${message}
            </p>
            ${safeReceipt ? `<div style="margin-top:22px;display:inline-block;padding:10px 16px;border-radius:999px;background:#E8EFE5;color:#526652;font-size:13px;font-weight:700;">رقم الطلب: ${safeReceipt}</div>` : ''}
            <p style="margin:24px 0 0;color:#5D4B3D;font-size:14px;line-height:1.8;">
              لأي استفسار، راسلنا على
              <a href="mailto:${fromAddress}" style="color:#2D251E;">${fromAddress}</a>
            </p>
            <p style="margin:18px 0 0;color:#9A8A7D;font-size:13px;line-height:1.7;">
              تَبصِّر · معسكر تسويق المدن
            </p>
          </div>
        </div>
      </div>
    `

    const text = [
      kicker,
      '',
      `مرحبًا ${fullName}`,
      '',
      message,
      receiptId ? `\nرقم الطلب: ${receiptId}` : '',
      '',
      `لأي استفسار: ${fromAddress}`,
      'تَبصِّر · معسكر تسويق المدن',
    ].filter(Boolean).join('\n')

    const response = await fetch(ZEPTOMAIL_API_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Zoho-enczapikey ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { address: fromAddress, name: fromName },
        to: [{ email_address: { address: email, name: fullName } }],
        reply_to: [{ address: fromAddress, name: fromName }],
        subject,
        htmlbody: html,
        textbody: text,
        track_opens: true,
        track_clicks: false,
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return json(res, response.status, {
        ok: false,
        message: data?.message || data?.error?.message || 'Email provider error',
        data,
      })
    }

    return json(res, 200, { ok: true, data })
  } catch (error) {
    return json(res, 500, { ok: false, message: error.message || 'Unexpected error' })
  }
}