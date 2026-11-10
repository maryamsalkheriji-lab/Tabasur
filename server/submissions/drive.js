// عميل Google Drive للسيرفر: ربط OAuth، إنشاء المجلدات، جلسات الرفع القابلة للاستئناف، وفحص الملفات.
// المتصفح يرفع بايتات الفيديو إلى رابط الجلسة مباشرة؛ السيرفر لا يستقبل أي ملف.
const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = process.env.GOOGLE_OAUTH_TOKEN_URL || 'https://oauth2.googleapis.com/token'
const API_BASE = process.env.GOOGLE_DRIVE_API_BASE || 'https://www.googleapis.com/drive/v3'
const UPLOAD_BASE = process.env.GOOGLE_DRIVE_UPLOAD_BASE || 'https://www.googleapis.com/upload/drive/v3'
export const DRIVE_SCOPES = Object.freeze(['https://www.googleapis.com/auth/drive.file', 'openid', 'https://www.googleapis.com/auth/userinfo.email'])
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const TIMEOUT_MS = 20000

export class DriveError extends Error {
  constructor(code, status = 502, detail = null) { super(code); this.code = code; this.status = status; this.detail = detail }
}

const tokenCache = new Map()

async function readJson(res) {
  const text = await res.text().catch(() => '')
  try { return text ? JSON.parse(text) : null } catch { return { raw: text.slice(0, 300) } }
}

export function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: DRIVE_SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', include_granted_scopes: 'true', state,
  })
  return `${AUTH_URL}?${params}`
}

export async function exchangeCode({ clientId, clientSecret, code, redirectUri }, fetchImpl = fetch) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  const body = await readJson(res)
  if (!res.ok || !body?.access_token) throw new DriveError('OAUTH_EXCHANGE_FAILED', 502, body)
  if (!body.refresh_token) throw new DriveError('OAUTH_NO_REFRESH_TOKEN', 502, body)
  return body
}

export function emailFromIdToken(idToken) {
  try {
    const payload = String(idToken || '').split('.')[1]
    const json = JSON.parse(Buffer.from(payload.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'))
    return typeof json.email === 'string' ? json.email : ''
  } catch { return '' }
}

export function createDriveClient(auth, fetchImpl = fetch) {
  const clientId = auth?.client_id, clientSecret = auth?.client_secret, refreshToken = auth?.refresh_token
  if (!clientId || !clientSecret || !refreshToken) throw new DriveError('DRIVE_NOT_CONNECTED', 503)

  async function accessToken(force = false) {
    const cached = tokenCache.get(refreshToken)
    if (!force && cached && cached.exp > Date.now() + 60000) return cached.token
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    const body = await readJson(res)
    if (!res.ok || !body?.access_token) throw new DriveError(body?.error === 'invalid_grant' ? 'DRIVE_AUTH_REVOKED' : 'DRIVE_TOKEN_FAILED', 502, body)
    tokenCache.set(refreshToken, { token: body.access_token, exp: Date.now() + Math.max(60, Number(body.expires_in) || 3600) * 1000 })
    return body.access_token
  }

  async function api(path, init = {}, retry = true) {
    const token = await accessToken()
    const res = await fetchImpl(`${API_BASE}${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, ...(init.headers || {}) }, signal: AbortSignal.timeout(TIMEOUT_MS) })
    if (res.status === 401 && retry) { await accessToken(true); return api(path, init, false) }
    return { res, body: await readJson(res) }
  }

  return {
    accessToken,
    async about() {
      const { res, body } = await api('/about?fields=user(emailAddress,displayName),storageQuota')
      if (!res.ok) throw new DriveError('DRIVE_ABOUT_FAILED', 502, body)
      return body
    },
    async createFolder(name, parentId = null) {
      const { res, body } = await api('/files?fields=id,name,webViewLink', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
      })
      if (!res.ok || !body?.id) throw new DriveError('DRIVE_FOLDER_FAILED', 502, body)
      return body
    },
    async getFile(id, fields = 'id,name,size,mimeType,md5Checksum,parents,webViewLink,createdTime,trashed') {
      const { res, body } = await api(`/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(fields)}`)
      if (res.status === 404) return null
      if (!res.ok) throw new DriveError('DRIVE_FILE_FAILED', 502, body)
      return body
    },
    async trashFile(id) {
      const { res, body } = await api(`/files/${encodeURIComponent(id)}?fields=id,trashed`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }),
      })
      if (res.status === 404) return false
      if (!res.ok) throw new DriveError('DRIVE_TRASH_FAILED', 502, body)
      return true
    },
    // يفتح جلسة رفع قابلة للاستئناف ويعيد رابطها؛ الرابط نفسه هو تفويض الرفع ويصلح أسبوعًا واحدًا.
    async createResumableSession({ name, mimeType, size, parentId, appProperties }) {
      const token = await accessToken()
      const res = await fetchImpl(`${UPLOAD_BASE}/files?uploadType=resumable&fields=${encodeURIComponent('id,name,size,mimeType,md5Checksum,parents,webViewLink')}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mimeType, 'X-Upload-Content-Length': String(size) },
        body: JSON.stringify({ name, mimeType, parents: [parentId], ...(appProperties ? { appProperties } : {}) }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      if (!res.ok) throw new DriveError('DRIVE_SESSION_FAILED', 502, await readJson(res))
      const location = res.headers.get('location')
      if (!location) throw new DriveError('DRIVE_SESSION_FAILED', 502, 'missing Location header')
      return location
    },
    // يسأل Google عن عدد البايتات التي وصلت فعلًا؛ 308 = ناقص، 200/201 = اكتمل، 404 = انتهت الجلسة.
    async queryUpload(sessionUri, size) {
      const res = await fetchImpl(sessionUri, { method: 'PUT', headers: { 'Content-Range': `bytes */${size}` }, signal: AbortSignal.timeout(TIMEOUT_MS) })
      if (res.status === 308) {
        const match = /bytes=0-(\d+)/.exec(res.headers.get('range') || '')
        return { complete: false, committed: match ? Number(match[1]) + 1 : 0 }
      }
      if (res.ok) return { complete: true, file: await readJson(res) }
      if (res.status === 404 || res.status === 410) return { complete: false, expired: true }
      throw new DriveError('DRIVE_STATUS_FAILED', 502, res.status)
    },
  }
}
