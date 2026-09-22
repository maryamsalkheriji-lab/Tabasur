/* ─── أدوات حماية مشتركة ─── */

// يقبل الروابط اللي تبدأ بـ http أو https فقط.
// يمنع روابط مثل javascript: اللي ممكن تشغّل كود في متصفح الأدمن.
export function toSafeHttpUrl(value) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch {
    return null
  }
}

export function isHttpUrl(value) {
  return toSafeHttpUrl(value) !== null
}

// خلية آمنة لملفات CSV/Excel: تمنع تنفيذ المعادلات (CSV Injection)
// لما تبدأ القيمة بـ = أو + أو - أو @ أو Tab أو سطر جديد.
export function csvCell(value) {
  let text = String(value ?? '')
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
