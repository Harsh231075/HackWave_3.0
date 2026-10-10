import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { chat } from './server/chat.ts'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), {
    name: 'productivity-chat',
    configureServer(server) {
      const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
      server.middlewares.use('/api/generate', (req, res) => { void chat(req, res, env) })
    },
  }],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
}))
