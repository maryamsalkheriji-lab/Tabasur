import { loadEnv } from 'vite'
import handler from '../api/send-registration-email.js'

export function registrationEmailPlugin() {
  function install(server) {
    const env = loadEnv(server.config.mode, server.config.envDir, '')
    for (const key of ['ZEPTOMAIL_TOKEN', 'EMAIL_FROM_ADDRESS', 'EMAIL_FROM_NAME', 'PUBLIC_SITE_URL', 'SUPABASE_URL', 'VITE_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'ALLOWED_ORIGINS']) {
      if (process.env[key] === undefined && env[key]) process.env[key] = env[key]
    }
    server.middlewares.use(async (req, res, next) => {
      if (req.url?.split('?')[0] !== '/api/send-registration-email') return next()
      if (req.method !== 'POST') return handler(req, res)
      try {
        const chunks = []
        let size = 0
        for await (const chunk of req) {
          size += Buffer.byteLength(chunk)
          if (size > 16384) {
            res.writeHead(413, { 'Content-Type': 'application/json' })
            return res.end(JSON.stringify({ ok: false, code: 'BODY_TOO_LARGE' }))
          }
          chunks.push(Buffer.from(chunk))
        }
        req.body = Buffer.concat(chunks).toString('utf8')
        await handler(req, res)
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
