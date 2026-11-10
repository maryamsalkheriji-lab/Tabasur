// عميل صفحة التسليم: نداءات /api/submissions ورفع الفيديو مباشرة إلى Supabase Storage بالبروتوكول القابل للاستئناف (TUS).
export const SUBMISSIONS_API = '/api/submissions'
export const MAX_MEMBERS = 5
export const TEAM_CODE_PATTERN = /^TB-\d{3,6}$/
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi']
export const TUS_CHUNK_SIZE = 6 * 1024 * 1024

export class SubmissionError extends Error {
  constructor(code, extra = {}, status = 0) { super(code); this.code = code; this.extra = extra; this.status = status }
}

export async function callSubmissions(action, payload = {}, { token, signal, fetchImpl = fetch } = {}) {
  let response
  try {
    response = await fetchImpl(SUBMISSIONS_API, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ action, ...payload }),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new SubmissionError('NETWORK')
  }
  let body = null
  try { body = await response.json() } catch { body = null }
  if (!response.ok || !body?.ok) {
    const { ok: _ok, code, ...extra } = body || {}
    throw new SubmissionError(code || `HTTP_${response.status}`, extra, response.status)
  }
  return body
}

export function normalizeTeamCode(value) {
  const text = String(value || '').trim().toUpperCase().replace(/\s+/g, '').replace(/^TB-?/, 'TB-')
  return /^\d+$/.test(text) ? `TB-${text.padStart(3, '0')}` : text
}

export function isVideoFile(file) {
  if (!file) return false
  const ext = (/\.([a-z0-9]{2,5})$/i.exec(file.name || '') || [])[1]?.toLowerCase()
  return VIDEO_EXTENSIONS.includes(ext) || /^video\//.test(file.type || '')
}

// نص الإيصال الذي يحفظه الفريق في واتساب (بلا أي رابط خاص).
export function receiptText(team, lang = 'ar') {
  const members = team.members.map(member => member.name).join(lang === 'ar' ? '، ' : ', ')
  const video = team.video ? `${team.video.title} (${team.video.fileName})` : ''
  return lang === 'ar'
    ? `إيصال تسليم معسكر تَبصَّر\nكود الفريق: ${team.code}\nالفريق: ${team.name}\nالمسار: ${team.trackLabel}\nالأعضاء: ${members}\nالفيديو: ${video}`
    : `Tabsur Camp submission receipt\nTeam code: ${team.code}\nTeam: ${team.name}\nTrack: ${team.trackLabel}\nMembers: ${members}\nVideo: ${video}`
}

export function whatsappShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

const utf8Base64 = value => btoa(String.fromCharCode(...new TextEncoder().encode(String(value))))
const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' })

function request({ method, url, headers, body, signal, timeout, onUploadProgress }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, url, true)
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value)
    xhr.timeout = timeout
    if (onUploadProgress) xhr.upload.onprogress = event => { if (event.lengthComputable) onUploadProgress(event.loaded) }
    xhr.onload = () => resolve({ status: xhr.status, header: name => xhr.getResponseHeader(name), text: xhr.responseText })
    xhr.onerror = () => reject(new SubmissionError('UPLOAD_RETRY'))
    xhr.ontimeout = () => reject(new SubmissionError('UPLOAD_RETRY'))
    xhr.onabort = () => reject(abortError())
    if (signal) {
      if (signal.aborted) return reject(abortError())
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(body === undefined ? null : body)
  })
}

/* ─── الرفع القابل للاستئناف (TUS 1.0.0) إلى Supabase Storage ───
 * السيرفر يعطي توكنًا موقّعًا لمسار واحد (x-signature). القطع 6 ميغابايت بالضبط كما يشترط Supabase.
 * عند انقطاع الشبكة نسأل الخادم عن الإزاحة (HEAD) ونكمل من حيث وقف. يعيد { uploadUrl } عند الاكتمال. */
export function uploadResumable({ file, endpoint, token, anonKey, bucket, objectPath, chunkSize = TUS_CHUNK_SIZE, uploadUrl = null, onProgress, onUploadUrl, onRetry, signal, maxRetries = 6 }) {
  const size = file.size
  const common = { 'Tus-Resumable': '1.0.0', 'x-signature': token, 'x-upsert': 'true', ...(anonKey ? { authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}) }

  const create = async () => {
    const response = await request({
      method: 'POST', url: endpoint, signal, timeout: 60000,
      headers: {
        ...common, 'Upload-Length': String(size),
        'Upload-Metadata': `bucketName ${utf8Base64(bucket)},objectName ${utf8Base64(objectPath)},contentType ${utf8Base64(file.type || 'application/octet-stream')},cacheControl ${utf8Base64('3600')}`,
      },
    })
    if (response.status === 403 || response.status === 401) throw new SubmissionError('UPLOAD_EXPIRED', { status: response.status })
    if (response.status < 200 || response.status >= 300) throw new SubmissionError(response.status >= 500 || response.status === 429 ? 'UPLOAD_RETRY' : 'UPLOAD_FAILED', { status: response.status })
    const location = response.header('Location')
    if (!location) throw new SubmissionError('UPLOAD_FAILED', { status: response.status })
    return new URL(location, endpoint).href
  }

  const offsetOf = async url => {
    const response = await request({ method: 'HEAD', url, signal, timeout: 30000, headers: common })
    if (response.status === 404 || response.status === 410 || response.status === 403) throw new SubmissionError('UPLOAD_EXPIRED', { status: response.status })
    if (response.status < 200 || response.status >= 300) throw new SubmissionError('UPLOAD_RETRY', { status: response.status })
    return Number(response.header('Upload-Offset') || 0)
  }

  const patch = async (url, offset) => {
    const end = Math.min(size, offset + chunkSize)
    const response = await request({
      method: 'PATCH', url, signal, timeout: 10 * 60 * 1000,
      headers: { ...common, 'Upload-Offset': String(offset), 'Content-Type': 'application/offset+octet-stream' },
      body: file.slice(offset, end),
      onUploadProgress: loaded => onProgress?.(Math.min(size, offset + loaded), size),
    })
    if (response.status === 204 || response.status === 200) return Number(response.header('Upload-Offset') ?? end)
    if (response.status === 409) return offsetOf(url) // الإزاحة مختلفة: نعيد المزامنة
    if (response.status === 404 || response.status === 410 || response.status === 403) throw new SubmissionError('UPLOAD_EXPIRED', { status: response.status })
    throw new SubmissionError(response.status >= 500 || response.status === 429 ? 'UPLOAD_RETRY' : 'UPLOAD_FAILED', { status: response.status })
  }

  return (async () => {
    let url = uploadUrl
    let offset = 0
    let retries = 0
    if (url) {
      try { offset = await offsetOf(url) } catch (error) { if (error.code === 'UPLOAD_EXPIRED') url = null; else throw error }
    }
    if (!url) { url = await create(); onUploadUrl?.(url); offset = 0 }
    onProgress?.(offset, size)
    while (offset < size) {
      try {
        offset = await patch(url, offset)
        retries = 0
      } catch (error) {
        if (error?.name === 'AbortError' || error.code === 'UPLOAD_EXPIRED' || error.code === 'UPLOAD_FAILED') throw error
        if (++retries > maxRetries) throw new SubmissionError('UPLOAD_RETRY_EXHAUSTED')
        onRetry?.(retries)
        await new Promise(resolve => setTimeout(resolve, Math.min(30000, 1500 * 2 ** (retries - 1))))
        offset = await offsetOf(url)
      }
    }
    onProgress?.(size, size)
    return { uploadUrl: url }
  })()
}
