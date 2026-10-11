import { componentIntentEndpoint } from './components.ts'
import { createCalendarHandler } from './calendar/handler.ts'
import { adaptiveEndpoint } from './adaptive.ts'
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { resolve, extname, sep } from 'node:path'
import { chat } from './chat.ts'

const root = fileURLToPath(new URL('../dist', import.meta.url))
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' }
const calendar = createCalendarHandler(process.env)
createServer(async (req, res) => {
  if (await calendar(req, res)) return
  const path = new URL(req.url ?? '/', 'http://localhost').pathname
  if (path === '/api/workspace/resolve') return componentIntentEndpoint(req, res)
  if (path === '/api/intent') return adaptiveEndpoint('intent', req, res)
  if (path === '/api/workspace/compose') return adaptiveEndpoint('compose', req, res)
  if (path === '/api/generate') return chat(req, res)
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
}).listen(Number(process.env.PORT ?? 3000), '127.0.0.1', () => console.log(`Orlo available at http://127.0.0.1:${process.env.PORT ?? 3000}`))
