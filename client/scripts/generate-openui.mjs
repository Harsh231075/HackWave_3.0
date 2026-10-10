import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
const server = await createServer({ server: { middlewareMode: true } })
try {
  const { productivityLibrary } = await server.ssrLoadModule('/src/lib/workspace/OpenUIWorkspace.tsx')
  await mkdir('src/generated', { recursive: true })
  await writeFile('src/generated/openui-spec.json', JSON.stringify(productivityLibrary.toSpec(), null, 2) + '\n')
} finally { await server.close() }
