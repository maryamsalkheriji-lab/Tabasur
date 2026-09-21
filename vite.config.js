import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { registrationEmailPlugin } from './server/registration-email-plugin.js'

export default defineConfig({
  plugins: [react(), registrationEmailPlugin()],
  build: {
    outDir: 'dist',
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
})
