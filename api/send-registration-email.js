const ZEPTOMAIL_API_URL = 'https://api.zeptomail.com/v1.1/email'

const PROVIDER_ERRORS = {
  SERR_157: 'EMAIL_AUTH_FAILED',
  SM_111: 'EMAIL_SENDER_UNVERIFIED',
  SM_128: 'EMAIL_ACCOUNT_PENDING',
  AE_101: 'EMAIL_ACCOUNT_BLOCKED',
  LE_101: 'EMAIL_CREDITS_EXPIRED',
  LE_102: 'EMAIL_CREDITS_EXHAUSTED',
  SM_133: 'EMAIL_LIMIT_REACHED',
  SMI_115: 'EMAIL_LIMIT_REACHED',
  SERR_156: 'EMAIL_IP_RESTRICTED',
}

function providerErrorCode(error) {
  for (const detail of Array.isArray(error?.details) ? error.details : []) {
    const code = PROVIDER_ERRORS[detail?.inner_error?.code] || PROVIDER_ERRORS[detail?.code]
    if (code) return code
  }
  return PROVIDER_ERRORS[error?.code] || 'EMAIL_PROVIDER_ERROR'
}

// الموقع العام — لتحميل صورة البانر داخل الرسالة.
// عملاء البريد لا يستطيعون تحميل صورة من localhost، فنُثبّت الدومين هنا.

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
    res.setHeader('Allow', 'POST')
    return json(res, 405, { ok: false, message: 'Method not allowed' })
  }

  const apiKey = (process.env.ZEPTOMAIL_TOKEN || '').trim().replace(/^Zoho-enczapikey\s+/i, '').trim()
  const fromAddress = (process.env.EMAIL_FROM_ADDRESS || 'info@cubex.com.sa').trim()
  const fromName = process.env.EMAIL_FROM_NAME || 'تَبصَّر'

  if (!apiKey) {
    return json(res, 503, { ok: false, code: 'EMAIL_NOT_CONFIGURED', message: 'Email service is unavailable' })
  }

  try {
    let body
    try { body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {}) }
    catch { return json(res, 400, { ok: false, code: 'INVALID_REQUEST' }) }
    if (!body || typeof body !== 'object') return json(res, 400, { ok: false, code: 'INVALID_REQUEST' })
    const { receiptId, kind } = body
    const email = typeof body.email === 'string' ? body.email.trim() : body.email
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : body.fullName
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
        typeof fullName !== 'string' || !fullName.trim() || fullName.length > 200 ||
        !['participant', 'sponsor'].includes(kind) ||
        (receiptId !== undefined && (typeof receiptId !== 'string' || receiptId.length > 100))) {
      return json(res, 400, { ok: false, message: 'Missing email or fullName' })
    }

    const publicSite = process.env.PUBLIC_SITE_URL || 'https://cubex.com.sa'
    const imageUrl = `${publicSite.replace(/\/$/, '')}/assets/tabsur-registration-email.jpeg`
    const safeName = escapeHtml(fullName)
    const safeReceipt = escapeHtml(receiptId || '')
    const isSponsor = kind === 'sponsor'

    const subject = isSponsor ? 'تم استلام طلب الرعاية في تَبصَّر' : 'تم تسجيلك بنجاح في معسكر تَبصَّر'
    const kicker = isSponsor ? 'تم استلام طلب الرعاية' : 'تم تسجيلك بنجاح'
    const title = `مرحبًا ${safeName}`
    const message = isSponsor
      ? 'شكرًا لتواصلكم مع تَبصَّر. وصلنا طلب الرعاية بنجاح، وسنراجع بيانات الجهة ثم نتواصل مع الشخص المسؤول لمناقشة فرص الشراكة والدعم.'
      : 'شكرًا لتسجيلك في معسكر تَبصَّر. وصلنا طلبك بنجاح، وسنراجع بياناتك ثم نتواصل معك عبر البريد الإلكتروني أو رقم الجوال خلال الفترة القادمة.'

    const html = `
      <div dir="rtl" style="margin:0;background:#FAF6EF;padding:28px;font-family:Arial,'Tahoma',sans-serif;color:#2D251E;">
        <div style="max-width:680px;margin:0 auto;background:#FFFDFC;border:1px solid rgba(45,37,30,.12);border-radius:22px;overflow:hidden;">
          <img src="${imageUrl}" alt="تَبصَّر · معسكر تسويق المدن" style="display:block;width:100%;height:auto;background:#FAF6EF;" />
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
              تَبصَّر · معسكر تسويق المدن
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
      'تَبصَّر · معسكر تسويق المدن',
    ].filter(Boolean).join('\n')

    const response = await fetch(ZEPTOMAIL_API_URL, {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
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
      return json(res, 502, {
        ok: false,
        code: providerErrorCode(data?.error),
        message: 'Email provider did not accept the message',
      })
    }

    if (!Array.isArray(data.data) || !data.data.some(item => item.code === 'EM_104')) {
      return json(res, 502, { ok: false, code: 'EMAIL_INVALID_RESPONSE' })
    }
    return json(res, 200, { ok: true })
  } catch (error) {
    return json(res, error.name === 'TimeoutError' ? 504 : 502, { ok: false, code: 'EMAIL_SEND_FAILED' })
  }
}
