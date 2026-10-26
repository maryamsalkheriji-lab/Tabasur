export const RSVP_LABELS = { attending: 'تأكيد الحضور', declined: 'اعتذار عن الحضور' }
export const DEFAULT_RSVP_SLUG = 'madinah-tech'

export function normalizeGuestName(value) {
  return String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').replace(/\s+/gu, ' ').trim()
}

export function validateGuestName(value, language = 'ar') {
  const name = normalizeGuestName(value)
  if (name.length < 2 || !/\p{L}/u.test(name)) return language === 'en' ? 'Please enter your name using at least two characters.' : 'اكتب اسمك أولًا، من حرفين على الأقل.'
  if (name.length > 120) return language === 'en' ? 'Your name must be 120 characters or fewer.' : 'الاسم يجب ألا يتجاوز ١٢٠ حرفًا.'
  return ''
}

export function rsvpPath(slug) {
  return `/rsvp/${encodeURIComponent(slug)}`
}
