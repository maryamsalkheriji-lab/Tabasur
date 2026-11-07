// ملفات رسالة القبول (ترويسة، دليل، منشور) تعيش في public/email حتى تكون متاحة على الموقع أيضًا.
// محليًا تُقرأ من القرص، وعلى Vercel (حيث قد لا تُرفق مع الدالة) تُجلب من الموقع العام، وتُحفظ في الذاكرة.
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const EMAIL_ASSET_PATH = 'email'

export const ONLINE_EMAIL_FILES = Object.freeze({
  header: { file: 'tabsur-header.png', mime: 'image/png', attachAs: null },
  guide: { file: 'tabsur-online-guide.pdf', mime: 'application/pdf', attachAs: 'معسكر_تبصّر_الدليل_عن_بعد.pdf' },
  postAr: { file: 'tabsur-online-post-ar.jpg', mime: 'image/jpeg', attachAs: 'معسكر_تبصّر_المسار_الأونلاين.jpg' },
  postEn: { file: 'tabsur-online-post-en.jpg', mime: 'image/jpeg', attachAs: 'Tabsur_Camp_Online_Track.jpg' },
})

const cache = new Map()

// الموقع يعيد index.html (200) لأي مسار غير موجود بسبب rewrites، لذا نتحقق من توقيع الملف لا من رمز الحالة فقط.
const MAGIC = {
  'image/png': bytes => bytes.length > 8 && bytes[0] === 0x89 && bytes.subarray(1, 4).toString() === 'PNG',
  'image/jpeg': bytes => bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8,
  'application/pdf': bytes => bytes.length > 4 && bytes.subarray(0, 4).toString() === '%PDF',
}
export function looksLike(mime, bytes) {
  const check = MAGIC[mime]
  return Boolean(bytes && (!check || check(bytes)))
}

export function emailAssetUrl(publicSite, key) {
  return `${String(publicSite || '').replace(/\/$/, '')}/${EMAIL_ASSET_PATH}/${ONLINE_EMAIL_FILES[key].file}`
}

export async function loadEmailAsset(key, publicSite) {
  const spec = ONLINE_EMAIL_FILES[key]
  if (!spec) throw new Error(`Unknown email asset: ${key}`)
  if (cache.has(key)) return cache.get(key)

  let bytes = null
  try {
    bytes = await readFile(path.join(PROJECT_ROOT, 'public', EMAIL_ASSET_PATH, spec.file))
  } catch {
    // الملف ليس على القرص (نسخة Vercel): نجلبه من الموقع العام
  }
  if (!bytes && publicSite) {
    try {
      const response = await fetch(emailAssetUrl(publicSite, key), { signal: AbortSignal.timeout(8000) })
      if (response.ok) {
        const fetched = Buffer.from(await response.arrayBuffer())
        if (looksLike(spec.mime, fetched)) bytes = fetched
      }
    } catch {
      // الرسالة تُرسل بدون هذا الملف بدل أن تفشل
    }
  }
  if (bytes && !looksLike(spec.mime, bytes)) bytes = null
  const asset = bytes ? { ...spec, key, bytes, base64: bytes.toString('base64') } : null
  if (asset) cache.set(key, asset)
  return asset
}

export async function loadOnlineEmailAssets(publicSite) {
  const entries = await Promise.all(Object.keys(ONLINE_EMAIL_FILES).map(async key => [key, await loadEmailAsset(key, publicSite)]))
  return Object.fromEntries(entries)
}

export function clearEmailAssetCache() {
  cache.clear()
}
