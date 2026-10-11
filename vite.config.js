import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { registrationEmailPlugin } from './server/registration-email-plugin.js'
import { assertNoSecretsInPublicEnv } from './server/public-env-guard.js'

export default defineConfig(({ mode }) => {
  // يوقف البناء لو انحط مفتاح سري في متغير عام (VITE_)
  assertNoSecretsInPublicEnv(mode)
  // في التطوير المحلي فقط: نمرّر دالة دخول المحكّم (Edge Function) عبر Vite
  // لأن CORS فيها يسمح بنطاق cubex.com.sa فقط. في البناء النهائي يُستدعى الرابط مباشرة.
  const supabaseUrl = loadEnv(mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const devProxy = supabaseUrl
    ? { '/__supabase': { target: supabaseUrl, changeOrigin: true, rewrite: (path) => path.replace(/^\/__supabase/, '') } }
    : {}
  return {
    plugins: [react(), registrationEmailPlugin()],
    server: { proxy: devProxy },
    preview: { proxy: devProxy },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'three': ['three'],
            'gsap':  ['gsap'],
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase': ['@supabase/supabase-js'],
          }
        }
      }
    }
  }
})
