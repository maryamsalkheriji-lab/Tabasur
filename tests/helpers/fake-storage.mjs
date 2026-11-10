// محاكي Supabase Storage للاختبارات المحلية فقط: التوقيع على مسار رفع، بروتوكول TUS القابل للاستئناف
// (إنشاء، HEAD للإزاحة، PATCH للقطع)، معلومات الكائن، الحذف، والروابط الموقّعة. مع CORS للمتصفح.
import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'

export const FAKE_SERVICE_KEY = 'fake-service-key'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-signature, x-upsert, tus-resumable, upload-length, upload-metadata, upload-offset, upload-concat, content-type, x-client-info, cache-control',
  'Access-Control-Expose-Headers': 'Location, Upload-Offset, Upload-Length, Tus-Resumable',
}

export async function startFakeStorage({ failChunks = 0 } = {}) {
  const state = { objects: new Map(), tokens: new Map(), uploads: new Map(), failChunks, log: [] }
  const base = () => `http://127.0.0.1:${server.address().port}`
  const readBody = req => new Promise(resolve => { const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => resolve(Buffer.concat(chunks))) })
  const send = (res, status, body, headers = {}) => {
    const payload = body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)
    res.writeHead(status, { ...CORS, 'Tus-Resumable': '1.0.0', ...(payload ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...headers })
    res.end(payload)
  }
  const objectJson = (key, obj) => ({ id: obj.id, name: key.split('/').slice(1).join('/'), bucket_id: key.split('/')[0], size: obj.size, content_type: obj.contentType, created_at: obj.createdAt, updated_at: obj.createdAt, metadata: { size: obj.size, mimetype: obj.contentType, eTag: obj.md5 } })
  const isService = req => (req.headers.authorization || '') === `Bearer ${FAKE_SERVICE_KEY}` || req.headers.apikey === FAKE_SERVICE_KEY
  const decodeMeta = header => Object.fromEntries(String(header || '').split(',').map(pair => pair.trim()).filter(Boolean).map(pair => { const [key, value] = pair.split(' '); return [key, value ? Buffer.from(value, 'base64').toString('utf8') : ''] }))

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, base())
    state.log.push(`${req.method} ${url.pathname}`)
    if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end() }
    const body = await readBody(req)
    const path = url.pathname.replace(/^\/storage\/v1/, '')

    // توقيع مسار رفع (السيرفر فقط)
    let match = /^\/object\/upload\/sign\/([^/]+)\/(.+)$/.exec(path)
    if (match && req.method === 'POST') {
      if (!isService(req)) return send(res, 401, { statusCode: '401', error: 'Unauthorized', message: 'invalid signature' })
      const token = randomBytes(12).toString('hex')
      state.tokens.set(token, { bucket: match[1], path: decodeURIComponent(match[2]), exp: Date.now() + 2 * 3600 * 1000 })
      return send(res, 200, { url: `/object/upload/sign/${match[1]}/${match[2]}?token=${token}` })
    }

    // TUS: إنشاء جلسة رفع بتوكن موقّع
    if (path === '/upload/resumable' && req.method === 'POST') {
      if (req.headers['tus-resumable'] !== '1.0.0') return send(res, 412, { message: 'Tus-Resumable required' })
      const meta = decodeMeta(req.headers['upload-metadata'])
      const signature = state.tokens.get(String(req.headers['x-signature'] || ''))
      if (!signature || signature.bucket !== meta.bucketName || signature.path !== meta.objectName || signature.exp < Date.now()) return send(res, 403, { statusCode: '403', error: 'Unauthorized', message: 'invalid upload signature' })
      const id = randomBytes(8).toString('hex')
      state.uploads.set(id, { key: `${meta.bucketName}/${meta.objectName}`, contentType: meta.contentType || 'application/octet-stream', length: Number(req.headers['upload-length']), chunks: [], offset: 0, done: false })
      return send(res, 201, '', { Location: `${base()}/storage/v1/upload/resumable/${id}` })
    }
    match = /^\/upload\/resumable\/([a-f0-9]+)$/.exec(path)
    if (match) {
      const upload = state.uploads.get(match[1])
      if (!upload) return send(res, 404, { message: 'upload not found' })
      if (req.method === 'HEAD') { res.writeHead(200, { ...CORS, 'Tus-Resumable': '1.0.0', 'Upload-Offset': String(upload.offset), 'Upload-Length': String(upload.length), 'Cache-Control': 'no-store' }); return res.end() }
      if (req.method === 'PATCH') {
        if (req.headers['content-type'] !== 'application/offset+octet-stream') return send(res, 415, { message: 'bad content type' })
        if (Number(req.headers['upload-offset']) !== upload.offset) return send(res, 409, { message: 'offset mismatch' }, { 'Upload-Offset': String(upload.offset) })
        if (state.failChunks > 0) { state.failChunks -= 1; res.destroy(); return }
        if (upload.offset + body.length < upload.length && body.length !== 6 * 1024 * 1024) return send(res, 400, { message: 'chunk must be 6MB' })
        upload.chunks.push(body)
        upload.offset += body.length
        if (upload.offset >= upload.length && !upload.done) {
          upload.done = true
          const data = Buffer.concat(upload.chunks)
          state.objects.set(upload.key, { id: randomBytes(8).toString('hex'), size: data.length, contentType: upload.contentType, md5: createHash('md5').update(data).digest('hex'), createdAt: new Date().toISOString(), data })
        }
        return send(res, 204, '', { 'Upload-Offset': String(upload.offset) })
      }
    }

    if (!isService(req)) return send(res, 401, { statusCode: '401', error: 'Unauthorized', message: 'invalid signature' })
    match = /^\/object\/info\/([^/]+)\/(.+)$/.exec(path)
    if (match && req.method === 'GET') {
      const key = `${match[1]}/${decodeURIComponent(match[2])}`
      const obj = state.objects.get(key)
      if (!obj) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      return send(res, 200, objectJson(key, obj))
    }
    match = /^\/object\/sign\/([^/]+)\/(.+)$/.exec(path)
    if (match && req.method === 'POST') {
      const key = `${match[1]}/${decodeURIComponent(match[2])}`
      if (!state.objects.has(key)) return send(res, 404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
      return send(res, 200, { signedURL: `/object/sign/${match[1]}/${match[2]}?token=${randomBytes(6).toString('hex')}` })
    }
    match = /^\/object\/([^/]+)$/.exec(path)
    if (match && req.method === 'DELETE') {
      const { prefixes = [] } = JSON.parse(body.toString() || '{}')
      const removed = []
      for (const prefix of prefixes) { const key = `${match[1]}/${prefix}`; const obj = state.objects.get(key); if (obj) { state.objects.delete(key); removed.push(objectJson(key, obj)) } }
      return send(res, 200, removed)
    }
    return send(res, 404, { statusCode: '404', error: 'not_found', message: `unknown endpoint ${req.method} ${path}` })
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  return {
    state, server,
    get base() { return base() },
    env: () => ({ SUBMISSIONS_STORAGE_URL: base(), SUBMISSIONS_STORAGE_KEY: FAKE_SERVICE_KEY }),
    config: () => ({ projectUrl: base(), serviceKey: FAKE_SERVICE_KEY, bucket: 'submissions' }),
    videos: () => [...state.objects.entries()].map(([key, obj]) => ({ key, ...obj })),
    close: () => new Promise(resolve => server.close(resolve)),
  }
}
