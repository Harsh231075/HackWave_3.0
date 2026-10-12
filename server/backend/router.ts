import { mailEndpoint } from './mailGateway.ts'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { z } from 'zod'
import { toNodeHandler } from 'better-auth/node'
import { authenticatedUser, getAuth } from './auth.ts'
import { dataEndpoint, readJson, sendJson } from './api.ts'
import { BackendError, connectDatabase, loadSnapshot } from './repository.ts'
import { ownedContext } from './context.ts'
import { createCalendarHandler } from '../calendar/handler.ts'
import { calendarCookie, calendarOwner, createMongoCalendarStore } from './calendarStore.ts'
import { componentIntentEndpoint } from '../components.ts'
import { adaptiveEndpoint } from '../adaptive.ts'
import { chat } from '../chat.ts'

export function createApiRouter(env: NodeJS.ProcessEnv) {
  env = { ...env, APP_ORIGIN: env.BETTER_AUTH_URL ?? env.APP_ORIGIN }
  return async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname
    if (!path.startsWith('/api/')) return false
    try {
      if (path === '/api/health') { sendJson(res, 200, { ok: true }); return true }
      if (path.startsWith('/api/auth/')) {
        const runtime = getAuth(env); await runtime.ready
        await toNodeHandler(runtime.auth)(req, res); return true
      }
      if (path === '/api/auth-config') { const runtime = getAuth(env); await runtime.ready; sendJson(res, 200, { googleEnabled: runtime.googleEnabled }); return true }
      // The callback recovers ownership from an unguessable HttpOnly session cookie;
      // the Calendar handler additionally verifies the one-time OAuth state/PKCE.
      if (path === '/api/calendar/google/callback') await connectDatabase(env)
      const userId = path === '/api/calendar/google/callback' ? await calendarOwner(calendarCookie(req.headers.cookie)) : await authenticatedUser(req, env)
      if (!userId) throw new BackendError(401, 'Sign in to continue.')
      await connectDatabase(env)
      if (path === '/api/calendar/connections' && req.method === 'GET' && !(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REDIRECT_URI)) { sendJson(res, 200, { connected: false, configured: false }); return true }
      if (path.startsWith('/api/calendar/')) {
        const handled = await createCalendarHandler(env, fetch, createMongoCalendarStore(userId, env))(req, res)
        if (handled) return true
      }
      if (await mailEndpoint(req, res, env, userId)) return true
      if (await dataEndpoint(req, res, env, userId)) return true
      if (path === '/api/ready') { sendJson(res, 200, { ok: true }); return true }
      if (['/api/workspace/resolve', '/api/intent', '/api/workspace/compose', '/api/generate'].includes(path)) {
        if (req.method !== 'POST') throw new BackendError(405, 'Use POST.')
        const snapshot = await loadSnapshot(userId)
        const body = ownedContext(path, await readJson(req), snapshot)
        if (path === '/api/workspace/resolve') await componentIntentEndpoint(req, res, env, body)
        else if (path === '/api/generate') await chat(req, res, env, body)
        else await adaptiveEndpoint(path === '/api/intent' ? 'intent' : 'compose', req, res, env, body)
        return true
      }
      throw new BackendError(404, 'API route is unavailable.')
    } catch (error) {
      if (!res.headersSent) sendJson(res, error instanceof BackendError ? error.status : error instanceof z.ZodError ? 400 : 500, { error: { message: error instanceof BackendError ? error.message : error instanceof z.ZodError ? 'Invalid request values.' : 'The request could not be completed.' } })
      else res.destroy()
      return true
    }
  }
}
