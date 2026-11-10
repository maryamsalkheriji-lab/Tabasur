// محاكي Google (OAuth + Drive v3 + الرفع القابل للاستئناف) للاختبارات المحلية فقط.
// يحاكي ما يعتمد عليه الموقع: تبادل الرموز، إنشاء المجلدات، جلسات الرفع مع 308/Range، فحص الملفات، سلة المهملات، about.
import { createServer } from 'node:http'
import { createHash, randomBytes } from 'node:crypto'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Content-Range, X-Upload-Content-Type, X-Upload-Content-Length, Authorization',
  'Access-Control-Expose-Headers': 'Range, Location, Content-Length',
}

export async function startFakeDrive({ failChunks = 0, accessTokenTtl = 3600 } = {}) {
  const state = { files: new Map(), sessions: new Map(), tokens: 0, exchanges: [], refreshTokens: new Set(['fake-refresh-token']), failChunks, log: [] }
  const base = () => `http://127.0.0.1:${server.address().port}`
  const fileJson = file => ({ id: file.id, name: file.name, mimeType: file.mimeType, size: String(file.size), md5Checksum: file.md5, parents: file.parents, webViewLink: `${base()}/view/${file.id}`, createdTime: file.createdTime, trashed: file.trashed, appProperties: file.appProperties })
  const readBody = req => new Promise(resolve => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))) })
  const send = (res, status, body, headers = {}) => {
    const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
    res.writeHead(status, { ...CORS, 'Content-Type': 'application/json; charset=utf-8', ...headers })
    res.end(payload)
  }
  const idToken = email => ['e30', Buffer.from(JSON.stringify({ email, sub: '1' })).toString('base64url'), 'sig'].join('.')

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, base())
    state.log.push(`${req.method} ${url.pathname}${url.search}`)
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }
    const auth = req.headers.authorization || ''
    const body = await readBody(req)

    if (url.pathname === '/token' && req.method === 'POST') {
      const params = new URLSearchParams(body.toString())
      if (params.get('grant_type') === 'authorization_code') {
        state.exchanges.push(Object.fromEntries(params))
        if (params.get('code') !== 'good-code') return send(res, 400, { error: 'invalid_grant' })
        return send(res, 200, { access_token: `at-${++state.tokens}`, refresh_token: 'fake-refresh-token', expires_in: accessTokenTtl, scope: 'drive.file openid email', id_token: idToken('organizer@example.com') })
      }
      if (!state.refreshTokens.has(params.get('refresh_token'))) return send(res, 400, { error: 'invalid_grant' })
      return send(res, 200, { access_token: `at-${++state.tokens}`, expires_in: accessTokenTtl, token_type: 'Bearer' })
    }

    // جلسات الرفع (لا تحتاج Authorization، رابط الجلسة هو التفويض)
    if (url.pathname === '/upload/drive/v3/files' && url.searchParams.get('uploadType') === 'resumable') {
      if (req.method === 'POST') {
        if (!/^Bearer at-/.test(auth)) return send(res, 401, { error: 'unauthorized' })
        const meta = JSON.parse(body.toString() || '{}')
        const id = randomBytes(8).toString('hex')
        state.sessions.set(id, { meta, size: Number(req.headers['x-upload-content-length']), mimeType: req.headers['x-upload-content-type'], chunks: [], received: 0, fileId: null, fields: url.searchParams.get('fields') })
        return send(res, 200, '', { Location: `${base()}/upload/drive/v3/files?uploadType=resumable&upload_id=${id}` })
      }
      if (req.method === 'PUT') {
        const session = state.sessions.get(url.searchParams.get('upload_id'))
        if (!session) return send(res, 404, { error: 'session not found' })
        const range = String(req.headers['content-range'] || '')
        const query = /^bytes \*\/(\d+)$/.exec(range)
        if (!query) {
          const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range)
          if (!match) return send(res, 400, { error: 'bad range' })
          const start = Number(match[1]), end = Number(match[2])
          if (state.failChunks > 0) { state.failChunks -= 1; res.destroy(); return }
          if (start !== session.received) return send(res, 308, '', { Range: session.received ? `bytes=0-${session.received - 1}` : undefined })
          if (body.length !== end - start + 1) return send(res, 400, { error: 'length mismatch' })
          session.chunks.push(body)
          session.received += body.length
        }
        if (session.received < session.size) return send(res, 308, '', session.received ? { Range: `bytes=0-${session.received - 1}` } : {})
        if (!session.fileId) {
          const data = Buffer.concat(session.chunks)
          const file = { id: `file-${randomBytes(6).toString('hex')}`, name: session.meta.name, mimeType: session.meta.mimeType || session.mimeType, size: data.length, md5: createHash('md5').update(data).digest('hex'), parents: session.meta.parents || [], createdTime: new Date().toISOString(), trashed: false, appProperties: session.meta.appProperties || {}, data }
          state.files.set(file.id, file)
          session.fileId = file.id
        }
        return send(res, 200, fileJson(state.files.get(session.fileId)))
      }
    }

    if (!/^Bearer at-/.test(auth)) return send(res, 401, { error: { code: 401, message: 'Invalid Credentials' } })
    if (url.pathname === '/drive/v3/about') return send(res, 200, { user: { emailAddress: 'organizer@example.com', displayName: 'Organizer' }, storageQuota: { limit: '16106127360', usage: '1073741824', usageInDrive: '1000000000' } })
    if (url.pathname === '/drive/v3/files' && req.method === 'POST') {
      const meta = JSON.parse(body.toString() || '{}')
      const file = { id: `folder-${randomBytes(4).toString('hex')}`, name: meta.name, mimeType: meta.mimeType, size: 0, md5: '', parents: meta.parents || [], createdTime: new Date().toISOString(), trashed: false }
      state.files.set(file.id, file)
      return send(res, 200, fileJson(file))
    }
    const fileMatch = /^\/drive\/v3\/files\/([^/]+)$/.exec(url.pathname)
    if (fileMatch) {
      const file = state.files.get(decodeURIComponent(fileMatch[1]))
      if (!file) return send(res, 404, { error: { code: 404, message: 'File not found' } })
      if (req.method === 'GET') return send(res, 200, fileJson(file))
      if (req.method === 'PATCH') { Object.assign(file, JSON.parse(body.toString() || '{}')); return send(res, 200, fileJson(file)) }
      if (req.method === 'DELETE') { state.files.delete(file.id); return send(res, 204, '') }
    }
    return send(res, 404, { error: 'unknown endpoint' })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    state, server,
    get base() { return base() },
    env: () => ({ GOOGLE_OAUTH_TOKEN_URL: `${base()}/token`, GOOGLE_DRIVE_API_BASE: `${base()}/drive/v3`, GOOGLE_DRIVE_UPLOAD_BASE: `${base()}/upload/drive/v3` }),
    close: () => new Promise(resolve => server.close(resolve)),
  }
}
