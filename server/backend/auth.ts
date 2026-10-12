import { fileURLToPath } from 'node:url'
import { betterAuth } from 'better-auth'
import { fromNodeHeaders } from 'better-auth/node'
import { getMigrations } from 'better-auth/db/migration'
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import type { IncomingMessage } from 'node:http'
import { BackendError } from './repository.ts'

export function createAuth(env: NodeJS.ProcessEnv) {
  if ((env.BETTER_AUTH_SECRET ?? '').length < 32) throw new BackendError(503, 'Set BETTER_AUTH_SECRET to a random secret of at least 32 characters.')
  const baseURL = new URL(env.BETTER_AUTH_URL ?? env.APP_ORIGIN ?? 'http://localhost:5173').origin
  if (env.NODE_ENV === 'production' && !baseURL.startsWith('https:') && !['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname)) throw new BackendError(503, 'Use HTTPS for a public production authentication URL.')
  const filename = env.AUTH_DB_PATH ?? fileURLToPath(new URL('../.auth-data/auth.sqlite', import.meta.url))
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true, mode: 0o700 })
  const database = new DatabaseSync(filename)
  database.exec('PRAGMA journal_mode = WAL; PRAGMA busy_timeout = 5000; PRAGMA foreign_keys = ON;')
  const googleEnabled = !!env.AUTH_GOOGLE_CLIENT_ID && !!env.AUTH_GOOGLE_CLIENT_SECRET
  const auth = betterAuth({
    appName: 'Orlo', baseURL, secret: env.BETTER_AUTH_SECRET,
    database, trustedOrigins: [baseURL],
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: googleEnabled ? { google: { clientId: env.AUTH_GOOGLE_CLIENT_ID!, clientSecret: env.AUTH_GOOGLE_CLIENT_SECRET! } } : {},
    session: { expiresIn: 7 * 24 * 60 * 60, updateAge: 24 * 60 * 60 },
  })
  const ready = (async () => {
    const migration = await getMigrations(auth.options)
    await migration.runMigrations()
  })()
  return { auth, ready, googleEnabled, async close() { await ready; database.close() } }
}
export type AuthRuntime = ReturnType<typeof createAuth>
const runtimes = new Map<string, AuthRuntime>()
export function getAuth(env: NodeJS.ProcessEnv = process.env) {
  const key = JSON.stringify([env.AUTH_DB_PATH, env.BETTER_AUTH_URL, env.APP_ORIGIN, env.BETTER_AUTH_SECRET, env.AUTH_GOOGLE_CLIENT_ID, env.AUTH_GOOGLE_CLIENT_SECRET])
  let runtime = runtimes.get(key)
  if (!runtime) { runtime = createAuth(env); runtimes.set(key, runtime) }
  return runtime
}
export async function authenticatedUser(req: IncomingMessage, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const { auth, ready } = getAuth(env)
  await ready
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (!session?.user.id) throw new BackendError(401, 'Sign in to continue.')
  // Cookie authentication requires same-origin protection on writes outside Better Auth's handler.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method ?? 'GET')) {
    const origin = req.headers.origin
    const expected = new URL(env.BETTER_AUTH_URL ?? env.APP_ORIGIN ?? 'http://localhost:5173').origin
    if (origin !== expected) throw new BackendError(403, 'This request must originate from Orlo.')
  }
  return session.user.id
}
