import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { registrationEmailPlugin } from './server/registration-email-plugin.js'
import { assertNoSecretsInPublicEnv } from './server/public-env-guard.js'

export default defineConfig(({ mode }) => {
  // يوقف البناء لو انحط مفتاح سري في متغير عام (VITE_)
  assertNoSecretsInPublicEnv(mode)
  return {
    plugins: [react(), registrationEmailPlugin()],
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            'three': ['three'],
            'gsap':  ['gsap'],
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          }
        }
      }
    }
  }
})
