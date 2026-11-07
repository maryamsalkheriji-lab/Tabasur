// أدوات رقم الجوال الدولي: البحث عن الدولة، التعرّف على رمز الاتصال، والتحقق من الرقم.
// الرقم السعودي يُحفظ كما كان (05XXXXXXXX) حتى تبقى السجلات القديمة والجديدة بنفس الشكل،
// وأرقام بقية الدول تُحفظ بالصيغة الدولية (+رمز الدولة ثم الرقم بدون الصفر).
import { COUNTRIES } from './countries.js'

export const DEFAULT_COUNTRY = 'SA'

// الدول الأكثر استخدامًا تظهر أولًا قبل القائمة الكاملة
export const PINNED_COUNTRIES = Object.freeze(['SA', 'EG', 'IN', 'US', 'LB', 'SY', 'AE', 'JO', 'YE', 'SD', 'PK', 'PH'])

// عند تشابه رمز الاتصال بين عدة دول (مثل +1 و+44) تُفضَّل هذه الدولة في التعرّف التلقائي
const DIAL_PREFERENCE = { 1: 'US', 7: 'RU', 39: 'IT', 44: 'GB', 262: 'RE', 590: 'GP', 599: 'CW' }

const BY_ISO = new Map(COUNTRIES.map(country => [country.iso, country]))
const DIAL_CODES = [...new Set(COUNTRIES.map(country => country.dial))]

export { COUNTRIES }

export function getCountry(iso) {
  return BY_ISO.get(String(iso || '').toUpperCase()) || BY_ISO.get(DEFAULT_COUNTRY)
}

// علم الدولة من حرفَي ISO (رموز المؤشر الإقليمي). كوسوفو ليس له علم رسمي في الإيموجي.
export function flagOf(iso) {
  const code = String(iso || '').toUpperCase()
  if (!/^[A-Z]{2}$/.test(code) || code === 'XK') return '🏳️'
  return String.fromCodePoint(...[...code].map(char => 0x1f1e6 + char.charCodeAt(0) - 65))
}

export function countryName(country, lang = 'ar') {
  return lang === 'en' ? country.en : country.ar
}

export function arabicToAscii(value) {
  return String(value ?? '')
    .replace(/[٠-٩]/g, digit => '٠١٢٣٤٥٦٧٨٩'.indexOf(digit).toString())
    .replace(/[۰-۹]/g, digit => '۰۱۲۳۴۵۶۷۸۹'.indexOf(digit).toString())
}

export function digitsOnly(value) {
  return arabicToAscii(value).replace(/\D/g, '')
}

// توحيد النص للبحث: حروف صغيرة، بدون تشكيل أو همزات أو علامات لاتينية.
export function normalizeSearch(value) {
  return arabicToAscii(value)
    .toLowerCase()
    .normalize('NFD')
    // NFD يفصل الحركات والهمزات (أ ← ا + علامة)، فنحذف كل علامات التشكيل اللاتينية والعربية ثم التطويل
    .replace(/\p{M}/gu, '')
    .replace(/ـ/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
}

export function sortedCountries(lang = 'ar') {
  const collator = new Intl.Collator(lang === 'en' ? 'en' : 'ar')
  return [...COUNTRIES].sort((a, b) => collator.compare(countryName(a, lang), countryName(b, lang)))
}

// يبحث بالاسم العربي أو الإنجليزي أو رمز ISO أو رمز الاتصال (مع + أو بدونها).
export function searchCountries(query, lang = 'ar') {
  const q = normalizeSearch(query)
  const all = sortedCountries(lang)
  if (!q) return { query: '', pinned: PINNED_COUNTRIES.map(getCountry), all }

  const compact = q.replace(/[\s+\-()]/g, '')
  if (/^\d+$/.test(compact)) {
    // عند البحث برمز مشترك (مثل +1) تظهر الدولة الأشهر ثم الدول الشائعة ثم البقية
    const rank = country => (DIAL_PREFERENCE[country.dial] === country.iso ? 0 : PINNED_COUNTRIES.includes(country.iso) ? 1 : 2)
    const matches = all.filter(country => country.dial.startsWith(compact))
    matches.sort((a, b) => a.dial.length - b.dial.length || rank(a) - rank(b))
    return { query: q, pinned: [], all: matches }
  }

  // الترتيب: تطابق تام، ثم يبدأ بالنص، ثم يحتوي عليه؛ والدول الشائعة أولًا عند التساوي.
  // "هند" يجب أن يجد "الهند" في المقدمة، لذلك نقارن أيضًا بعد حذف "ال" التعريف.
  const ranked = []
  for (const country of all) {
    const names = [country.ar, country.en, country.iso, ...country.aliases].map(normalizeSearch)
    const bare = names.map(name => name.replace(/^ال/, ''))
    let score
    if (names.includes(q) || bare.includes(q)) score = 0
    else if (names.some(name => name.startsWith(q)) || bare.some(name => name.startsWith(q))) score = 1
    else if (names.some(name => name.includes(q))) score = 2
    else continue
    ranked.push({ country, score: score * 2 + (PINNED_COUNTRIES.includes(country.iso) ? 0 : 1) })
  }
  ranked.sort((a, b) => a.score - b.score)
  return { query: q, pinned: [], all: ranked.map(entry => entry.country) }
}

// يتعرّف على الدولة من رقم مكتوب بالصيغة الدولية (+966... أو 00966...).
// يعيد null إن لم يكن الرقم دوليًا، و{ pending: true } إن كان الرمز لم يكتمل بعد.
export function detectInternational(input, currentIso) {
  const compact = arabicToAscii(input).replace(/[\s\-()]/g, '')
  const match = /^(\+|00)(\d*)$/.exec(compact)
  if (!match) return null
  const digits = match[2]

  let best = ''
  for (const dial of DIAL_CODES) {
    if (digits.startsWith(dial) && dial.length > best.length) best = dial
  }
  if (!best) return { pending: true }
  // قد يكون المستخدم ما زال يكتب رمزًا أطول (مثل 96 قبل 966)
  if (DIAL_CODES.some(dial => dial.length > digits.length && dial.startsWith(digits))) return { pending: true }

  const candidates = COUNTRIES.filter(country => country.dial === best)
  const country = candidates.find(c => c.iso === currentIso)
    || candidates.find(c => c.iso === DIAL_PREFERENCE[best])
    || candidates[0]
  return { pending: false, country, national: digits.slice(best.length) }
}

// يتحقق من الرقم بحسب الدولة ويعيد الصيغة التي تُحفظ في قاعدة البيانات.
// السعودية: يجب أن يكون 05 + 8 أرقام ويُحفظ كما هو.
// بقية الدول: 5 إلى 14 رقمًا بعد حذف الأصفار الأولى، ضمن حد E.164 (15 رقمًا مع رمز الدولة).
export function validateMobile(iso, rawNumber) {
  let country = getCountry(iso)
  let digits = arabicToAscii(rawNumber).replace(/[\s\-()]/g, '')

  if (/^(\+|00)/.test(digits)) {
    const intl = detectInternational(digits, country.iso)
    if (!intl || intl.pending) return { ok: false, reason: country.iso === 'SA' ? 'mobile' : 'mobileIntl' }
    country = intl.country
    digits = intl.national
  }

  if (!/^\d+$/.test(digits)) return { ok: false, reason: country.iso === 'SA' ? 'mobile' : 'mobileIntl' }

  if (country.iso === 'SA') {
    const national = digits.replace(/^0/, '')
    if (!/^5\d{8}$/.test(national)) return { ok: false, reason: 'mobile' }
    return { ok: true, country, national, stored: `0${national}`, e164: `+966${national}` }
  }

  const national = digits.replace(/^0+/, '')
  const max = 15 - country.dial.length
  if (national.length < 5 || national.length > max) return { ok: false, reason: 'mobileIntl' }
  const e164 = `+${country.dial}${national}`
  return { ok: true, country, national, stored: e164, e164 }
}
