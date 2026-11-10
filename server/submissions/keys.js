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
export const MAX_MEMBERS = 5
export const TEAM_CODE_PATTERN = /^TB-\d{3,6}$/

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
