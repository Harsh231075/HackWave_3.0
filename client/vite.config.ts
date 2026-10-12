import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
  return {
    cacheDir: env.VITE_CACHE_DIR || 'node_modules/.vite',
    plugins: [react(), tailwindcss()],
    server: {
      proxy: { '/api': { target: env.API_PROXY_TARGET || 'http://127.0.0.1:3001' } },
    },
    resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  }
})
