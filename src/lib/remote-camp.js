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

// Draft terms for the local preview; production must retain consent on the server.
export const PUBLICATION_POLICY = Object.freeze({
  version: '2026-11-01.2',
  beneficiary: 'أمانة منطقة المدينة المنورة',
  summary: 'تسري هذه الموافقة على جميع الفيديوهات التي أرفقها، سواء فازت في المعسكر أو لم تفز.',
  terms: Object.freeze([
    'أسمح لأمانة منطقة المدينة المنورة بنشر الفيديوهات التي أرفقها وعرضها على حساباتها الرسمية ومنصاتها الإعلامية، داخل المملكة وخارجها، مع إمكانية تحريرها أو اقتباس مقاطع منها بما يناسب النشر.',
    'هذه الموافقة إذن بالنشر فقط؛ لا تتضمن نقل أي حقوق مالية، ولا يترتب عليها مقابل مادي، وتبقى حقوقي الأدبية في العمل محفوظة.',
    'أؤكد أن الفيديو من عملي، وأن المواد التي استخدمتها فيه مرخّصة ولا تمس حقوق الغير.',
  ]),
  acknowledgement: 'قرأت الشروط وأوافق على نشر جميع الفيديوهات التي سأرفقها.',
})

// English rendering of the same policy version, shown when the visitor switches the site to English.
export const PUBLICATION_POLICY_EN = Object.freeze({
  summary: 'This consent applies to every video I attach, whether or not it wins in the camp.',
  terms: Object.freeze([
    'I allow Madinah Regional Municipality to publish and display the videos I attach on its official accounts and media platforms, inside and outside the Kingdom, including editing them or using excerpts as suits publication.',
    'This consent is a permission to publish only. It does not transfer any financial rights, involves no payment, and my moral rights in the work remain reserved.',
    'I confirm the video is my own work, and that any material used in it is licensed and does not infringe the rights of others.',
  ]),
  acknowledgement: 'I have read the terms and agree to the publication of all videos I will attach.',
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
