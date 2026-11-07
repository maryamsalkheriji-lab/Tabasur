// رسالة القبول في المسار الأونلاين (عربي + إنجليزي) بنفس تصميم رسالة القبول الحضوري:
// ترويسة تَبصّر، بطاقة بيضاء، صندوق "من أين تبدأ"، زر لصفحة الأونلاين (وفيها رابط Drive للقطات الخام)،
// زر مجموعة واتساب، المنشور داخل الرسالة، والدليل مرفقًا. لا تاريخ ولا مكان ولا موعد تسليم.
import { emailAssetUrl } from './assets.js'

export const ONLINE_PAGE_PATH = '/tabsur/remote'
export const ONLINE_ACCEPTANCE_SUBJECT = 'تم قبولك في المسار الأونلاين لمعسكر تَبصّر · You’re accepted to Tabsur Camp (Online track)'
export const TEST_SUBJECT_PREFIX = '[نسخة تجريبية للمراجعة] '

const INLINE = {
  header: 'tabsur-header',
  postAr: 'tabsur-online-post-ar',
  postEn: 'tabsur-online-post-en',
}

export function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
}

export function onlinePageUrl(publicSite) {
  return `${String(publicSite || 'https://cubex.com.sa').replace(/\/$/, '')}${ONLINE_PAGE_PATH}`
}

// رابط المجموعة يأتي من متغير البيئة WHATSAPP_GROUP_URL (المستودع عام)؛ أي قيمة غير رابط دعوة واتساب تُهمل.
export function safeWhatsappUrl(value) {
  const url = String(value || '').trim()
  return /^https:\/\/(chat\.whatsapp\.com|wa\.me)\/[A-Za-z0-9_?=&%+.-]+$/.test(url) ? url : ''
}

const AR = {
  preheader: 'تم قبولك في المسار الأونلاين. ادخل إلى الموقع، وحمّل اللقطات الخام من رابط Drive، وابدأ إعداد الفيديو الخاص بك من منزلك.',
  title: 'نبارك لك قبولك في معسكر تَبصّر',
  subtitle: 'في المسار الأونلاين · شارك من أي مكان',
  hello: name => (name ? `مرحبًا ${name}،` : 'مرحبًا،'),
  intro: 'تم قبولك في المسار الأونلاين لمعسكر تَبصّر. المشاركة في هذا المسار تكون بالكامل من منزلك دون أي حضور، ويمكنك البدء من هذه اللحظة في إعداد الفيديو الخاص بك.',
  startTitle: 'من أين تبدأ؟',
  start: 'ادخل إلى صفحة المسار الأونلاين في الموقع؛ ستجد فيها رابط مجلد Google Drive الذي يضم الصور والفيديوهات الخام للمدينة المنورة. حمّل منها ما تحتاج إليه، وابدأ العمل على الفيديو الخاص بك من منزلك.',
  button: 'افتح صفحة الأونلاين ومكتبة اللقطات',
  buttonNote: 'الرابط:',
  whatsappTitle: 'انضم إلى مجموعة واتساب معسكر تَبصّر لمتابعة المستجدات:',
  whatsappButton: 'الانضمام إلى مجموعة واتساب',
  attachments: 'أرفقنا لك مع هذه الرسالة الدليل الإرشادي للمسار الأونلاين (عربي وإنجليزي) ومنشور المعسكر.',
  postAlt: 'منشور معسكر تَبصّر: شارك أونلاين من أي مكان، بدون حضور',
  closing: 'ننتظر إبداعك،',
  team: 'فريق معسكر تَبصّر',
  contact: 'للاستفسار:',
  receipt: 'رقم الطلب:',
}

const EN = {
  title: 'Congratulations, you’re accepted to Tabsur Camp',
  subtitle: 'Online track · take part from anywhere',
  hello: name => (name ? `Hello ${name},` : 'Hello,'),
  intro: 'You have been accepted to the online track of Tabsur Camp. You take part entirely from home, with no attendance. You can start working on your video right now.',
  startTitle: 'Where to start?',
  start: 'Open the online-track page on our website. It holds the Google Drive folder with the raw photos and footage of Madinah; download what you need and start working on your video from home.',
  button: 'Open the online page & footage library',
  buttonNote: 'Link:',
  whatsappTitle: 'Join the Tabsur Camp WhatsApp group to follow the updates:',
  whatsappButton: 'Join the WhatsApp group',
  attachments: 'Attached to this email: the online-track participant guide (Arabic and English) and the camp announcement.',
  postAlt: 'Tabsur Camp announcement: join online from anywhere, no attendance needed',
  closing: 'We look forward to your work,',
  team: 'Tabsur Camp team',
  contact: 'Questions:',
  receipt: 'Request number:',
}

function actionButton({ label, href, color, note, dir }) {
  const safeHref = escapeHtml(href)
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto;"><tr><td bgcolor="${color}" style="background:${color};border-radius:10px;text-align:center;"><a href="${safeHref}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-size:16px;font-weight:bold;line-height:1.5;">${escapeHtml(label)}</a></td></tr></table>
${note ? `<p dir="${dir}" style="margin:12px 0 0;font-size:13px;line-height:1.7;color:#527066;text-align:center;">${escapeHtml(note)} <a href="${safeHref}" style="color:#027286;word-break:break-all;" dir="ltr">${safeHref}</a></p>` : ''}`
}

function section({ copy, dir, lang, name, pageUrl, whatsappUrl, postSrc, fromAddress, receiptId }) {
  const align = dir === 'rtl' ? 'right' : 'left'
  return `
<tr><td dir="${dir}" lang="${lang}" style="padding:28px 24px 10px;text-align:${align};">
<h1 style="margin:0 0 14px;font-size:25px;line-height:1.6;color:#02313a;">${escapeHtml(copy.title)}<br><span style="color:#027286;font-size:19px;">${escapeHtml(copy.subtitle)}</span></h1>
<p style="margin:0;font-size:16px;line-height:1.9;">${escapeHtml(copy.hello(name))}<br>${escapeHtml(copy.intro)}</p>
</td></tr>
<tr><td dir="${dir}" lang="${lang}" style="padding:10px 24px 6px;">
<table role="presentation" dir="${dir}" width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f4;border:1px solid #dcebe4;border-radius:12px;">
<tr><td style="padding:16px 18px 4px;font-size:16px;font-weight:bold;text-align:${align};color:#02313a;">${escapeHtml(copy.startTitle)}</td></tr>
<tr><td style="padding:0 18px 16px;font-size:15px;line-height:1.9;text-align:${align};">${escapeHtml(copy.start)}</td></tr>
</table>
</td></tr>
<tr><td dir="${dir}" align="center" style="padding:16px 24px 6px;">${actionButton({ label: copy.button, href: pageUrl, color: '#027286', note: copy.buttonNote, dir })}</td></tr>
${whatsappUrl ? `<tr><td dir="${dir}" lang="${lang}" align="center" style="padding:22px 24px 6px;">
<p style="margin:0 0 14px;font-size:16px;line-height:1.8;text-align:center;">${escapeHtml(copy.whatsappTitle)}</p>
${actionButton({ label: copy.whatsappButton, href: whatsappUrl, color: '#128c7e', note: '', dir })}
</td></tr>` : ''}
<tr><td dir="${dir}" lang="${lang}" style="padding:20px 24px 0;text-align:${align};">
<p style="margin:0;font-size:14px;line-height:1.9;color:#526b65;">${escapeHtml(copy.attachments)}</p>
</td></tr>
<tr><td align="center" style="padding:18px 24px 8px;"><img src="${escapeHtml(postSrc)}" width="340" alt="${escapeHtml(copy.postAlt)}" style="display:block;width:100%;max-width:340px;height:auto;border:1px solid #dfe9e5;border-radius:12px;"></td></tr>
<tr><td dir="${dir}" lang="${lang}" style="padding:12px 24px 26px;text-align:${align};">
<p style="margin:0;font-size:15px;font-weight:bold;line-height:1.8;">${escapeHtml(copy.closing)}<br>${escapeHtml(copy.team)}</p>
<p style="margin:12px 0 0;font-size:12px;line-height:1.8;color:#6c817a;">${escapeHtml(copy.contact)} <a href="mailto:${escapeHtml(fromAddress)}" style="color:#027286;">${escapeHtml(fromAddress)}</a>${receiptId ? ` · ${escapeHtml(copy.receipt)} <span dir="ltr">${escapeHtml(receiptId)}</span>` : ''}</p>
</td></tr>`
}

export function renderOnlineAcceptanceHtml({ name = '', fromAddress, pageUrl, whatsappUrl = '', headerSrc, postArSrc, postEnSrc, receiptId = '' }) {
  const shared = { name, pageUrl, whatsappUrl, fromAddress, receiptId }
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(AR.title)}</title></head>
<body style="margin:0;padding:0;background:#f3f7f5;font-family:Arial,Tahoma,sans-serif;color:#02313a;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(AR.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f7f5;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #dfe9e5;border-radius:18px;overflow:hidden;">
<tr><td bgcolor="#0b7387" style="background:#0b7387;line-height:0;font-size:0;"><img src="${escapeHtml(headerSrc)}" width="600" alt="تَبصّر" style="display:block;width:100%;max-width:600px;height:auto;border:0;"></td></tr>
${section({ copy: AR, dir: 'rtl', lang: 'ar', postSrc: postArSrc, ...shared })}
<tr><td style="padding:0 24px;"><div style="border-top:2px solid #dfe9e5;font-size:0;line-height:0;">&nbsp;</div></td></tr>
${section({ copy: EN, dir: 'ltr', lang: 'en', postSrc: postEnSrc, ...shared })}
</table>
</td></tr></table></body></html>`
}

function textSection(copy, { name, pageUrl, whatsappUrl, fromAddress, receiptId }) {
  return [
    copy.title,
    copy.subtitle,
    '',
    copy.hello(name),
    copy.intro,
    '',
    copy.startTitle,
    copy.start,
    `${copy.button}: ${pageUrl}`,
    '',
    ...(whatsappUrl ? [copy.whatsappTitle, whatsappUrl, ''] : []),
    copy.attachments,
    '',
    copy.closing,
    copy.team,
    `${copy.contact} ${fromAddress}${receiptId ? ` · ${copy.receipt} ${receiptId}` : ''}`,
  ].join('\n')
}

export function renderOnlineAcceptanceText({ name = '', fromAddress, pageUrl, whatsappUrl = '', receiptId = '' }) {
  const context = { name, pageUrl, whatsappUrl, fromAddress, receiptId }
  return `${textSection(AR, context)}\n\n----------------------------------------\n\n${textSection(EN, context)}`
}

// يبني أجزاء رسالة ZeptoMail (العنوان، HTML، النص، المرفقات، الصور الداخلية) لمشارك واحد.
// assets من loadOnlineEmailAssets؛ أي ملف ناقص يُستبدل برابطه على الموقع بدل أن تفشل الرسالة.
export function buildOnlineAcceptanceEmail({ name = '', fromAddress, publicSite = 'https://cubex.com.sa', whatsappUrl = '', receiptId = '', assets = {}, subjectPrefix = '' }) {
  const pageUrl = onlinePageUrl(publicSite)
  const whatsapp = safeWhatsappUrl(whatsappUrl)
  const inlineSrc = key => (assets[key] ? `cid:${INLINE[key]}` : emailAssetUrl(publicSite, key))
  const html = renderOnlineAcceptanceHtml({
    name, fromAddress, pageUrl, whatsappUrl: whatsapp, receiptId,
    headerSrc: inlineSrc('header'), postArSrc: inlineSrc('postAr'), postEnSrc: inlineSrc('postEn'),
  })
  const text = renderOnlineAcceptanceText({ name, fromAddress, pageUrl, whatsappUrl: whatsapp, receiptId })
  const inline_images = Object.entries(INLINE)
    .filter(([key]) => assets[key])
    .map(([key, cid]) => ({ name: assets[key].file, mime_type: assets[key].mime, content: assets[key].base64, cid }))
  const attachments = ['guide', 'postAr', 'postEn']
    .filter(key => assets[key])
    .map(key => ({ name: assets[key].attachAs, mime_type: assets[key].mime, content: assets[key].base64 }))
  return { subject: `${subjectPrefix}${ONLINE_ACCEPTANCE_SUBJECT}`, html, text, pageUrl, whatsappUrl: whatsapp, inline_images, attachments }
}
