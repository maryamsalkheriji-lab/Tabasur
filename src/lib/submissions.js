// عميل صفحة التسليم: نداءات /api/submissions ورفع الفيديو إلى جلسة Google القابلة للاستئناف.
export const SUBMISSIONS_API = '/api/submissions'
export const MAX_MEMBERS = 5
export const TEAM_CODE_PATTERN = /^TB-\d{3,6}$/
export const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi']

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

/* ─── الرفع القابل للاستئناف إلى رابط الجلسة ───
 * قطع من 8 ميغابايت (مضاعف 256 كيلوبايت). عند انقطاع الشبكة نسأل السيرفر عن البايتات التي وصلت ثم نكمل.
 * يعيد { fileId, file } عند الاكتمال. */
export function uploadToSession({ file, sessionUri, chunkSize, startAt = 0, onProgress, getCommitted, signal, maxRetries = 6 }) {
  const size = file.size
  const putChunk = (start, end) => new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', sessionUri, true)
    xhr.setRequestHeader('Content-Range', `bytes ${start}-${end - 1}/${size}`)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.timeout = 10 * 60 * 1000
    xhr.upload.onprogress = event => { if (event.lengthComputable && onProgress) onProgress(Math.min(size, start + event.loaded), size) }
    xhr.onload = () => {
      if (xhr.status === 308) {
        const range = /bytes=0-(\d+)/.exec(xhr.getResponseHeader('Range') || '')
        return resolve({ done: false, committed: range ? Number(range[1]) + 1 : end })
      }
      if (xhr.status === 200 || xhr.status === 201) {
        let body = null
        try { body = JSON.parse(xhr.responseText) } catch { body = null }
        return resolve({ done: true, file: body })
      }
      if (xhr.status === 404 || xhr.status === 410) return reject(new SubmissionError('UPLOAD_EXPIRED'))
      reject(new SubmissionError(xhr.status >= 500 || xhr.status === 429 ? 'UPLOAD_RETRY' : 'UPLOAD_FAILED', { status: xhr.status }, xhr.status))
    }
    xhr.onerror = () => reject(new SubmissionError('UPLOAD_RETRY'))
    xhr.ontimeout = () => reject(new SubmissionError('UPLOAD_RETRY'))
    xhr.onabort = () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
    if (signal) {
      if (signal.aborted) return reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
      signal.addEventListener('abort', () => xhr.abort(), { once: true })
    }
    xhr.send(file.slice(start, end))
  })

  return (async () => {
    let offset = startAt
    let retries = 0
    while (offset < size) {
      const end = Math.min(size, offset + chunkSize)
      try {
        const result = await putChunk(offset, end)
        if (result.done) { onProgress?.(size, size); return { fileId: result.file?.id || null, file: result.file } }
        offset = result.committed
        retries = 0
      } catch (error) {
        if (error?.name === 'AbortError' || error.code === 'UPLOAD_EXPIRED' || error.code === 'UPLOAD_FAILED') throw error
        if (++retries > maxRetries) throw new SubmissionError('UPLOAD_RETRY_EXHAUSTED')
        await new Promise(resolve => setTimeout(resolve, Math.min(30000, 1500 * 2 ** (retries - 1))))
        if (getCommitted) {
          const state = await getCommitted()
          if (state?.complete) { onProgress?.(size, size); return { fileId: state.fileId || null, file: null } }
          if (Number.isFinite(state?.committed)) offset = state.committed
        }
      }
    }
    // وصلت كل البايتات لكن لم نستلم استجابة الاكتمال: السيرفر يتحقق من حالة الجلسة.
    const state = getCommitted ? await getCommitted() : null
    if (state?.complete) return { fileId: state.fileId || null, file: null }
    throw new SubmissionError('UPLOAD_INCOMPLETE')
  })()
}
