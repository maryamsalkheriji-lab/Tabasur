// مفاتيح المطابقة المشتركة بين السيرفر والاختبارات: رقم الجوال والاسم واسم الفريق.
import { validateMobile, arabicToAscii, DEFAULT_COUNTRY } from '../../src/lib/phone.js'

export const TRACKS = Object.freeze(['destination', 'life', 'investment', 'identity'])
export const TRACK_LABELS = Object.freeze({
  destination: 'الوجهة وتجربة الزائر',
  life: 'جودة الحياة',
  investment: 'الاستثمار والفرص',
  identity: 'الهوية والسردية',
})
export const TRACK_FOLDER_NAMES = Object.freeze({
  destination: '01 الوجهة وتجربة الزائر',
  life: '02 جودة الحياة',
  investment: '03 الاستثمار والفرص',
  identity: '04 الهوية والسردية',
})
export const ROOT_FOLDER_NAME = 'تسليمات معسكر تَبصَّر'
export const MAX_MEMBERS = 50 // سقف تقني فقط؛ لا يُعرض للمشاركين ولا يُذكر في النصوص (قرار المنظّمة: لا عدد محدد للفريق)
export const TEAM_CODE_PATTERN = /^TB-\d{3,6}$/
// قرار المنظّمة على فيديو الفريق (لوحة الإدارة فقط)
export const REVIEW_STATUSES = Object.freeze(['pending', 'qualified', 'rejected'])

// الصيغة المحفوظة في قاعدة البيانات (05xxxxxxxx أو +code...) إلى مفتاح أرقام دولي بلا +.
export function mobileKeyFromStored(stored) {
  const digits = String(stored || '').replace(/\D/g, '')
  if (!digits) return ''
  if (/^05\d{8}$/.test(digits)) return `966${digits.slice(1)}`
  if (/^5\d{8}$/.test(digits)) return `966${digits}`
  if (/^009665\d{8}$/.test(digits)) return digits.slice(2)
  return digits.replace(/^00/, '')
}

// يتحقق من رقم أدخله المشارك ويعيد الصيغة المحفوظة ومفتاح المطابقة.
export function parseMobile(raw, iso = DEFAULT_COUNTRY) {
  const text = arabicToAscii(String(raw || '')).trim()
  if (!text || text.length > 24) return { ok: false }
  const result = validateMobile(iso, text)
  if (!result.ok) return { ok: false }
  return { ok: true, stored: result.stored, e164: result.e164, key: mobileKeyFromStored(result.stored), country: result.country.iso }
}

// مفتاح اسم الشخص: بلا تشكيل ولا فروق إملائية شائعة ولا مسافات، لمنع تكرار الشخص نفسه في فريقَين.
export function nameKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\p{Mn}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .toLowerCase()
}

// مفتاح اسم الفريق: نفس التطبيع لكن المسافات تبقى مسافة واحدة.
export function teamNameKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/\p{Mn}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

// اسم عرض نظيف (يُحفظ في قاعدة البيانات ويظهر في درايف).
export function cleanText(value, max = 80) {
  return String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
}

const VIDEO_EXTENSIONS = Object.freeze(['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'])
export function videoExtension(fileName, mimeType) {
  const match = /\.([a-z0-9]{2,5})$/i.exec(String(fileName || '').trim())
  const ext = match ? match[1].toLowerCase() : ''
  if (VIDEO_EXTENSIONS.includes(ext)) return ext
  const byMime = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm', 'video/x-m4v': 'm4v', 'video/x-matroska': 'mkv', 'video/x-msvideo': 'avi' }
  return byMime[String(mimeType || '').toLowerCase()] || ''
}

export function isVideoFile(fileName, mimeType) {
  return Boolean(videoExtension(fileName, mimeType)) && (!mimeType || /^video\//i.test(mimeType) || mimeType === 'application/octet-stream')
}

// اسم الملف في درايف: كود الفريق - اسم الفريق - عنوان الفيديو.ext
export function driveFileName(code, teamName, title, ext) {
  const safe = value => cleanText(value, 60).replace(/[\\/:*?"<>|#%{}$~]/g, ' ').replace(/\s+/g, ' ').trim()
  const parts = [code, safe(teamName), safe(title)].filter(Boolean)
  return `${parts.join(' - ')}.${ext}`
}

/* ─── إقرار العضو الموقّع (نموذج PDF يعبّئه ويوقّعه كل عضو ثم يُرفع صورةً أو PDF) ─── */
export const CONSENT_FORM_VERSION = 'iqrar-2026-11-15'
export const CONSENT_MAX_BYTES = 15 * 1024 * 1024
const CONSENT_MIME_BY_EXT = Object.freeze({ pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' })
const CONSENT_EXT_BY_MIME = Object.freeze({ 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' })
export function consentExtension(fileName, mimeType) {
  const match = /\.([a-z0-9]{2,5})$/i.exec(String(fileName || '').trim())
  const ext = match ? match[1].toLowerCase() : ''
  if (CONSENT_MIME_BY_EXT[ext]) return ext === 'jpeg' ? 'jpg' : ext
  return CONSENT_EXT_BY_MIME[String(mimeType || '').toLowerCase()] || ''
}
export function consentMime(ext) { return CONSENT_MIME_BY_EXT[ext] || 'application/octet-stream' }
// رقم الهوية أو الإقامة أو جواز السفر: أرقام وحروف لاتينية فقط بعد تحويل الأرقام العربية، من 5 إلى 20 خانة
export function normalizeNationalId(value) {
  const text = arabicToAscii(String(value || '')).replace(/[\s-]/g, '').toUpperCase()
  return /^[A-Z0-9]{5,20}$/.test(text) ? text : ''
}
// اسم ملف الإقرار عند التنزيل: الكود - اسم العضو - إقرار.ext
export function consentFileName(code, memberName, ext) {
  const safe = value => cleanText(value, 60).replace(/[\\/:*?"<>|#%{}$~]/g, ' ').replace(/\s+/g, ' ').trim()
  return `${code} - ${safe(memberName)} - إقرار.${ext}`
}
