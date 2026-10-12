import { getAuth } from './backend/auth.ts'
import { createApiRouter } from './backend/router.ts'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'

const root = fileURLToPath(new URL('../client/dist', import.meta.url))
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
await getAuth(process.env).ready
const api = createApiRouter(process.env)
createServer(async (req, res) => {
  if (await api(req, res)) return
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return }
  try {
    const filename = resolve(root, '.' + decodeURIComponent(path))
    if (filename !== root && !filename.startsWith(root + sep)) { res.writeHead(403); res.end(); return }
    let data, extension
    try { data = await readFile(filename); extension = extname(filename) }
    catch { if (extname(path)) { res.writeHead(404); res.end(); return }; data = await readFile(resolve(root, 'index.html')); extension = '.html' }
    res.writeHead(200, { 'Content-Type': mime[extension] ?? 'application/octet-stream' })
    res.end(req.method === 'HEAD' ? undefined : data)
  } catch { res.writeHead(500); res.end('Unable to serve the application. Run npm run build first.') }
}).listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1', () => console.log(`Orlo available at http://127.0.0.1:${process.env.PORT ?? 3001}`))
