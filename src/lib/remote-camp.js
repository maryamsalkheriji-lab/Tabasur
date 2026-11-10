// Local preview: only the common library URL is persisted. Videos stay in memory.
export const REMOTE_STORAGE_KEY = 'tabsur-remote-preview-v2'
export const VIDEO_ACCEPT = 'video/*,.mp4,.mov,.webm,.m4v'
// Shared raw-footage folder shown to every visitor on the public remote page.
export const DEFAULT_LIBRARY_URL = 'https://drive.google.com/drive/folders/1R0C4MsoTgcqEP9JdHGxZp-Ld2UKRpzGr'
// Submissions (2026-11-10): one video per team, uploaded from /tabsur/submit through /api/submissions into the
// organizer's private Drive. The public per-track folders were retired; SUBMISSIONS_OPEN only switches the remote page copy.
export const SUBMISSIONS_OPEN = true
export const SUBMIT_PATH = '/tabsur/submit'
export function submitPathForTrack(trackId) {
  return remoteTracks.some(track => track.id === trackId) ? `${SUBMIT_PATH}?track=${trackId}` : SUBMIT_PATH
}
export const remoteTracks = [
  { id: 'destination', title: 'الوجهة وتجربة الزائر', description: 'احكِ تجربة اكتشاف المدينة.', image: '/assets/track-01.png', number: '01' },
  { id: 'life', title: 'جودة الحياة', description: 'أبرز تفاصيل الحياة وتحوّلها.', image: '/assets/track-02.png', number: '02' },
  { id: 'investment', title: 'الاستثمار والفرص', description: 'قدّم فرص المدينة وإمكاناتها.', image: '/assets/track-03.png', number: '03' },
  { id: 'identity', title: 'الهوية والسردية', description: 'اروي روح المكان وقصص الناس.', image: '/assets/track-04.png', number: '04' },
]

// نص «إقرار وموافقة على استخدام ونشر الأعمال الإبداعية» المعتمد من أمانة منطقة المدينة المنورة (2026-11-10). تغيير النص يستلزم رفع الإصدار.
export const PUBLICATION_POLICY = Object.freeze({
  version: '2026-11-10.1',
  beneficiary: 'أمانة منطقة المدينة المنورة وهيئة تطوير منطقة المدينة المنورة',
  summary: 'يسري هذا الإقرار على جميع الأعمال والفيديوهات التي أرفقها ضمن المعسكر، سواء فازت أو لم تفز.',
  terms: Object.freeze([
    'أقرّ، بصفتي مشاركًا في «معسكر تَبصَّر»، بموافقتي على منح أمانة منطقة المدينة المنورة وهيئة تطوير منطقة المدينة المنورة الإذن باستخدام الأعمال والمخرجات الإبداعية التي أقدمها ضمن المعسكر، ونشرها وعرضها وإعادة نشرها عبر منصاتهما الإعلامية ومواقعهما الإلكترونية، بما في ذلك منصة «روح المدينة»، وفي الفعاليات والمعارض والبرامج والأنشطة والحملات الإعلامية والتسويقية التي تنظمانها أو تشاركان فيها، وذلك لأغراض التعريف والترويج للمدينة المنورة ومبادراتها ومشروعاتها.',
    'كما أوافق على إجراء التعديلات الفنية والتحريرية اللازمة على هذه الأعمال، بما في ذلك الاختصار وإعادة التنسيق والإنتاج وتكييفها بما يتناسب مع متطلبات النشر والعرض، مع مراعاة سلامة المحتوى وعدم الإخلال بجوهر العمل، ومع احتفاظي بحقوق الملكية الفكرية المتعلقة بأعمالي.',
    'وأقرّ بأن الأعمال المقدمة من إنتاجي، وأنني أمتلك الحقوق والتصاريح اللازمة لاستخدام عناصرها ومشاركتها، بما لا يتعارض مع حقوق الآخرين.',
    'هذا الإقرار إذن بالاستخدام والنشر؛ لا يترتب عليه مقابل مادي، وتبقى حقوقي الأدبية والملكية الفكرية في أعمالي محفوظة.',
  ]),
  acknowledgement: 'قرأت الإقرار وأوافق على ما ورد فيه.',
})

// English rendering of the same policy version, shown when the visitor switches the site to English.
export const PUBLICATION_POLICY_EN = Object.freeze({
  summary: 'This declaration applies to every work and video I attach within the camp, whether or not it wins.',
  terms: Object.freeze([
    'As a participant in Tabsur Camp, I grant Madinah Regional Municipality and the Madinah Region Development Authority permission to use the creative works and outputs I submit within the camp, and to publish, display and republish them on their media platforms and websites, including the “Spirit of Madinah” platform, and in the events, exhibitions, programs, activities and media and marketing campaigns they organize or take part in, for the purpose of promoting Madinah and its initiatives and projects.',
    'I also agree to the technical and editorial changes needed for these works, including shortening, reformatting, production and adaptation to publishing and display requirements, while preserving the integrity of the content and the essence of the work, and while I retain the intellectual property rights to my works.',
    'I declare that the submitted works are my own production, and that I hold the rights and permissions needed to use and share their elements without infringing the rights of others.',
    'This declaration is a permission to use and publish. It involves no payment, and my moral and intellectual property rights in my works remain reserved.',
  ]),
  acknowledgement: 'I have read the declaration and agree to its terms.',
})

const CONSENT_LANGUAGES = ['ar', 'en']
const policyText = (lang = 'ar') => {
  const policy = lang === 'en' ? PUBLICATION_POLICY_EN : PUBLICATION_POLICY
  return [policy.summary, ...policy.terms, policy.acknowledgement].join('\n')
}

export function makePreviewConsent(approved, trackId, acceptedAt = new Date().toISOString(), lang = 'ar') {
  if (approved !== true || !CONSENT_LANGUAGES.includes(lang) || !remoteTracks.some(track => track.id === trackId) || !Number.isFinite(Date.parse(acceptedAt))) return null
  return Object.freeze({ localOnly: true, version: PUBLICATION_POLICY.version, beneficiary: PUBLICATION_POLICY.beneficiary, trackId, acceptedAt, language: lang, text: policyText(lang) })
}

export function isCurrentPreviewConsent(consent, trackId) {
  return Boolean(consent && consent.localOnly === true && consent.trackId === trackId &&
    remoteTracks.some(track => track.id === trackId) && consent.version === PUBLICATION_POLICY.version &&
    consent.beneficiary === PUBLICATION_POLICY.beneficiary && CONSENT_LANGUAGES.includes(consent.language) &&
    consent.text === policyText(consent.language) && Number.isFinite(Date.parse(consent.acceptedAt)))
}
export function driveFolderUrl(value) {
  try {
    const url = new URL(String(value).trim())
    if (url.protocol !== 'https:' || url.hostname !== 'drive.google.com' || url.port || url.username || url.password) return null
    const match = url.pathname.match(/^\/(?:drive\/(?:u\/\d+\/)?)?folders\/([a-zA-Z0-9_-]{10,})(?:\/)?$/)
    if (!match) return null
    const clean = new URL(`https://drive.google.com/drive/folders/${match[1]}`)
    const key = url.searchParams.get('resourcekey')
    if (key && /^[a-zA-Z0-9_-]+$/.test(key)) clean.searchParams.set('resourcekey', key)
    return clean.href
  } catch { return null }
}
export function readLibraryUrl(storage) {
  try {
    const current = storage.getItem(REMOTE_STORAGE_KEY)
    if (current !== null) return driveFolderUrl(JSON.parse(current)?.libraryUrl) || ''
    // Retain a previously configured common folder, without importing registrations.
    return driveFolderUrl(JSON.parse(storage.getItem('tabsur-remote-preview-v1'))?.settings?.libraryUrl) || ''
  } catch { return '' }
}
export function saveLibraryUrl(storage, value) {
  const libraryUrl = value.trim() ? driveFolderUrl(value) : ''
  if (libraryUrl === null) throw new Error('ألصق رابط مجلد Google Drive صحيحًا.')
  storage.setItem(REMOTE_STORAGE_KEY, JSON.stringify({ libraryUrl }))
  return libraryUrl
}
export function videoKey(file) { return JSON.stringify([file.name, file.size, file.lastModified]) }
export function selectVideos(existing, incoming) {
  const keys = new Set(existing.map(videoKey))
  const accepted = [], rejected = []
  let duplicates = 0
  for (const file of incoming) {
    const isVideo = file.type?.startsWith('video/') || (!file.type && /\.(mp4|mov|webm|m4v)$/i.test(file.name))
    if (!isVideo || !Number.isFinite(file.size) || file.size <= 0) { rejected.push(file.name); continue }
    const key = videoKey(file)
    if (keys.has(key)) { duplicates++; continue }
    keys.add(key)
    accepted.push(file)
  }
  return { accepted, rejected, duplicates }
}
const BYTE_UNITS = { ar: ['كيلوبايت', 'ميغابايت', 'غيغابايت'], en: ['KB', 'MB', 'GB'] }
export function formatBytes(bytes, lang = 'ar') {
  const units = BYTE_UNITS[lang] || BYTE_UNITS.ar
  const format = value => new Intl.NumberFormat(lang === 'en' ? 'en-US' : 'ar-SA', { maximumFractionDigits: 1 }).format(value)
  if (bytes < 1024 * 1024) return `${format(bytes / 1024)} ${units[0]}`
  if (bytes < 1024 ** 3) return `${format(bytes / 1024 ** 2)} ${units[1]}`
  return `${format(bytes / 1024 ** 3)} ${units[2]}`
}
