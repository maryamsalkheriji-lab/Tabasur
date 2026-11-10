// تخزين الفيديوهات في Supabase Storage (حاوية خاصة). السيرفر يصدر توكن رفع مؤقتًا لمسار واحد،
// والمتصفح يرفع مباشرة بالبروتوكول القابل للاستئناف (TUS) إلى Storage؛ السيرفر لا يستقبل أي بايت من الفيديو.
import { createClient } from '@supabase/supabase-js'

export const DEFAULT_BUCKET = 'submissions'
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024 // Supabase يشترط 6 ميغابايت بالضبط لكل قطعة
export const SIGNED_UPLOAD_TTL_MS = 2 * 60 * 60 * 1000 // صلاحية توكن الرفع الموقّع ساعتان

export class StorageError extends Error {
  constructor(code, status = 502, detail = null) { super(code); this.code = code; this.status = status; this.detail = detail }
}

// في الإنتاج: مشروع Supabase نفسه بمفتاح service_role. في التطوير والاختبار يمكن توجيهه إلى محاكي محلي.
export function storageConfig(env = process.env) {
  const projectUrl = (env.SUBMISSIONS_STORAGE_URL || env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '')
  const serviceKey = (env.SUBMISSIONS_STORAGE_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '').trim()
  if (!projectUrl || !serviceKey) return null
  return { projectUrl, serviceKey, bucket: (env.SUBMISSIONS_BUCKET || DEFAULT_BUCKET).trim(), uploadBase: (env.SUBMISSIONS_UPLOAD_BASE || '').trim() || null }
}

// عنوان الرفع المباشر: Supabase يوصي بالمضيف <ref>.storage.supabase.co للرفع القابل للاستئناف.
// التوكن الموقّع (x-signature) يُقبل فقط على المسار /upload/resumable/sign؛ المسار بلا /sign يتحقق من Authorization كـ JWT ويرفض.
export function resumableEndpoint(projectUrl, uploadBase = null) {
  if (uploadBase) return `${uploadBase.replace(/\/$/, '')}/upload/resumable/sign`
  try {
    const url = new URL(projectUrl)
    const match = /^([a-z0-9-]+)\.supabase\.co$/i.exec(url.hostname)
    if (match) return `https://${match[1]}.storage.supabase.co/storage/v1/upload/resumable/sign`
  } catch { /* عنوان محلي */ }
  return `${projectUrl.replace(/\/$/, '')}/storage/v1/upload/resumable/sign`
}

export function createStorage(config) {
  if (!config?.projectUrl || !config?.serviceKey) throw new StorageError('STORAGE_NOT_CONFIGURED', 503)
  const client = createClient(config.projectUrl, config.serviceKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } })
  const bucket = config.bucket || DEFAULT_BUCKET
  const files = () => client.storage.from(bucket)
  const notFound = error => /not.?found|does not exist/i.test(String(error?.message || '')) || String(error?.statusCode || error?.status || '') === '404'
  return {
    bucket,
    uploadEndpoint: resumableEndpoint(config.projectUrl, config.uploadBase),
    async signUpload(path) {
      const { data, error } = await files().createSignedUploadUrl(path, { upsert: true })
      if (error || !data?.token) throw new StorageError('STORAGE_SIGN_FAILED', 502, error?.message || 'no token')
      return data.token
    },
    async info(path) {
      const { data, error } = await files().info(path)
      if (error) { if (notFound(error)) return null; throw new StorageError('STORAGE_INFO_FAILED', 502, error.message) }
      if (!data) return null
      const size = Number(data.size ?? data.metadata?.size ?? data.metadata?.contentLength ?? NaN)
      return { id: data.id || null, size: Number.isFinite(size) ? size : null, contentType: data.contentType || data.metadata?.mimetype || '', updatedAt: data.updatedAt || data.createdAt || null }
    },
    async remove(paths) {
      const list = (Array.isArray(paths) ? paths : [paths]).filter(Boolean)
      if (!list.length) return true
      const { error } = await files().remove(list)
      if (error && !notFound(error)) throw new StorageError('STORAGE_REMOVE_FAILED', 502, error.message)
      return true
    },
    async signedViewUrl(path, seconds = 3600, downloadName = null) {
      const { data, error } = await files().createSignedUrl(path, seconds, downloadName ? { download: downloadName } : undefined)
      if (error || !data?.signedUrl) throw new StorageError('STORAGE_SIGN_URL_FAILED', 502, error?.message || 'no url')
      return data.signedUrl
    },
  }
}
