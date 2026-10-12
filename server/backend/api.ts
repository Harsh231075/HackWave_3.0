import type { IncomingMessage, ServerResponse } from 'node:http'
import mongoose from 'mongoose'
import { z } from 'zod'
import { authenticatedUser } from './auth.ts'
import { BackendError, connectDatabase, loadSnapshot, resetUser, saveSnapshot } from './repository.ts'
import { createBackendServices, executeMutation } from './services.ts'

export function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' })
  res.end(JSON.stringify(value))
}
export async function readJson(req: IncomingMessage) {
  if (!req.headers['content-type']?.includes('application/json')) throw new BackendError(415, 'Expected application/json.')
  let raw = ''
  for await (const chunk of req) { raw += chunk.toString(); if (Buffer.byteLength(raw) > 5_000_000) throw new BackendError(413, 'Request is too large.') }
  try { return JSON.parse(raw) as unknown } catch { throw new BackendError(400, 'Invalid JSON.') }
}
const commandSchema = z.strictObject({ service: z.string().max(40), method: z.string().max(40), args: z.array(z.unknown()).max(8), revision: z.number().int().nonnegative() })

export async function dataEndpoint(req: IncomingMessage, res: ServerResponse, env: NodeJS.ProcessEnv, userId?: string): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!['/api/data', '/api/actions', '/api/tasks'].includes(url.pathname) && !url.pathname.startsWith('/api/tasks/') && !url.pathname.startsWith('/api/files/')) return false
  try {
    userId ??= await authenticatedUser(req, env)
    if (!userId) throw new BackendError(401, 'Sign in to continue.')
    await connectDatabase(env)
    if (req.method === 'GET' && url.pathname !== '/api/actions') {
      const snapshot = await loadSnapshot(userId)
      if (url.pathname.startsWith('/api/files/')) {
        const id = decodeURIComponent(url.pathname.slice('/api/files/'.length))
        const record = (snapshot.collections.files as Array<{ id: string; name: string; mimeType: string; content: string }>).find(file => file.id === id)
        if (!record) throw new BackendError(404, 'Attachment is unavailable.')
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', 'Content-Disposition': "attachment; filename*=UTF-8''" + encodeURIComponent(record.name), 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' })
        res.end(Buffer.from(record.content, 'base64')); return true
      }
      if (url.pathname === '/api/data') { sendJson(res, 200, snapshot); return true }
      const service = createBackendServices(snapshot).services.tasks
      if (url.pathname.startsWith('/api/tasks/')) {
        const record = service.getById(decodeURIComponent(url.pathname.slice('/api/tasks/'.length)))
        if (!record) throw new BackendError(404, 'Task is unavailable.')
        sendJson(res, 200, { record, revision: snapshot.revision }); return true
      }
      const query = z.object({ query: z.string().max(160).optional(), status: z.enum(['all', 'open', 'overdue', 'pending', 'blocked', 'completed']).optional(), priority: z.enum(['all', 'urgent', 'high', 'medium', 'low']).optional(), sort: z.enum(['due', 'priority']).optional(), from: z.union([z.iso.date(), z.literal('')]).optional(), to: z.union([z.iso.date(), z.literal('')]).optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }).parse(Object.fromEntries(url.searchParams))
      const { page, limit, ...filters } = query, records = service.list(filters)
      sendJson(res, 200, { items: records.slice((page - 1) * limit, page * limit), total: records.length, page, limit, revision: snapshot.revision }); return true
    }
    if (url.pathname === '/api/data' && req.method === 'DELETE') { sendJson(res, 200, await resetUser(userId)); return true }
    let command: z.infer<typeof commandSchema>
    if (url.pathname === '/api/actions' && req.method === 'POST') command = commandSchema.parse(await readJson(req))
    else if (url.pathname.startsWith('/api/tasks') && ['POST', 'PATCH', 'DELETE'].includes(req.method ?? '')) {
      const input = z.strictObject({ revision: z.number().int().nonnegative(), input: z.unknown().optional() }).parse(await readJson(req))
      const id = decodeURIComponent(url.pathname.slice('/api/tasks/'.length))
      command = { service: 'tasks', method: req.method === 'DELETE' ? 'delete' : req.method === 'PATCH' ? 'update' : 'create', args: req.method === 'POST' ? [input.input] : req.method === 'PATCH' ? [id, input.input] : [id], revision: input.revision }
    } else throw new BackendError(405, 'Unsupported method.')
    const owner = userId
    const response = await mongoose.connection.transaction(async session => {
      const before = await loadSnapshot(owner, session)
      if (before.revision !== command.revision) throw new BackendError(409, 'Records changed. Refresh and review your edits.')
      const context = createBackendServices(before)
      const result = await executeMutation(context, command.service, command.method, command.args)
      if (result && typeof result === 'object' && 'ok' in result && result.ok === false) return { result, snapshot: before }
      if (result && typeof result === 'object' && 'status' in result && result.status === 'invalid') throw new BackendError(400, 'Invalid saved state.')
      const next = context.exportSnapshot()
      const changed = JSON.stringify(next) !== JSON.stringify(before)
      return { result, snapshot: changed ? await saveSnapshot(owner, before.revision, next, session) : before }
    })
    sendJson(res, 200, response)
  } catch (error) {
    const status = error instanceof BackendError ? error.status : error instanceof z.ZodError ? 400 : 400
    sendJson(res, status, { error: { message: error instanceof BackendError ? error.message : error instanceof z.ZodError ? error.issues[0]?.message ?? 'Invalid record.' : 'The operation could not be completed. Check its values and retry.' } })
  }
  return true
}
