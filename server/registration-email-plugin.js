import { loadEnv } from 'vite'
import emailHandler from '../api/send-registration-email.js'
import analyzeHandler from '../api/analyze-project.js'

// يربط دوال /api/* بسيرفر التطوير والمعاينة بنفس سلوك Vercel (قراءة الجسم كنص JSON).
const ROUTES = {
  '/api/send-registration-email': { handler: emailHandler, maxBody: 16384 },
  '/api/analyze-project': { handler: analyzeHandler, maxBody: 16384 },
}
const ENV_KEYS = ['ZEPTOMAIL_TOKEN', 'EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME', 'PUBLIC_SITE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALLOWED_ORIGINS', 'ANTHROPIC_API_KEY', 'ANTHROPIC_MODEL']

export function registrationEmailPlugin() {
  function install(server) {
    const env = loadEnv(server.config.mode, server.config.envDir, '')
    for (const key of ENV_KEYS) {
      if (process.env[key] === undefined && env[key]) process.env[key] = env[key]
    }
    server.middlewares.use(async (req, res, next) => {
      const route = ROUTES[req.url?.split('?')[0]]
      if (!route) return next()
      if (req.method !== 'POST') return route.handler(req, res)
      try {
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += Buffer.byteLength(chunk)
          if (size > route.maxBody) {
            res.writeHead(413, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ ok: false, code: 'BODY_TOO_LARGE' }))
          }
          chunks.push(Buffer.from(chunk))
        }
        req.body = Buffer.concat(chunks).toString('utf8')
        await route.handler(req, res)
      } catch {
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, code: 'REQUEST_FAILED' }))
        }
      }
    })
  }
  return { name: 'registration-email-api', configureServer: install, configurePreviewServer: install }
}
