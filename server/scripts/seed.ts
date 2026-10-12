import { parseArgs } from 'node:util'
import mongoose from 'mongoose'
import { z } from 'zod'
import { createAuth } from '../backend/auth.ts'
import { connectDatabase, initializeIndexes, loadSnapshot, saveSnapshot } from '../backend/repository.ts'
import { createBackendServices } from '../backend/services.ts'

const { values } = parseArgs({ options: {
  email: { type: 'string' }, password: { type: 'string' }, name: { type: 'string' }, help: { type: 'boolean' },
} })

if (values.help) {
  console.log('npm run seed -- --email demo@example.com --password "your-password" --name "Demo User"\nSEED_PASSWORD may be used instead of --password. Existing accounts require the matching password; existing workspace records are never overwritten.')
} else {
  let runtime: ReturnType<typeof createAuth> | undefined
  try {
    const input = z.object({ email: z.email(), password: z.string().min(8).max(128), name: z.string().trim().min(1).max(120) }).parse({
      email: values.email?.trim().toLowerCase(), password: values.password ?? process.env.SEED_PASSWORD, name: values.name ?? 'Demo User',
    })
    // Check MongoDB before creating an account so configuration failures do not leave an orphan.
    await connectDatabase()
    await initializeIndexes()
    runtime = createAuth(process.env)
    await runtime.ready
    let userId: string
    let created = true
    try {
      const result = await runtime.auth.api.signUpEmail({ body: input })
      userId = result.user.id
    } catch (error) {
      if ((error as { body?: { code?: string } }).body?.code !== 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') throw error
      created = false
      const result = await runtime.auth.api.signInEmail({ body: { email: input.email, password: input.password } })
      userId = result.user.id
    }
    const outcome = await mongoose.connection.transaction(async session => {
      const before = await loadSnapshot(userId, session)
      const context = createBackendServices(before)
      const seeded = context.services.demo.seed()
      if (!seeded.ok) return { seeded: false, message: seeded.message }
      const saved = await saveSnapshot(userId, before.revision, context.exportSnapshot(), session)
      return { seeded: true, tasks: saved.records.tasks.length, events: saved.records.events.length }
    })
    console.log(JSON.stringify({ email: input.email, userId, account: created ? 'created' : 'existing', ...outcome }, null, 2))
    if (!outcome.seeded) process.exitCode = 1
  } catch (error) {
    console.error(error instanceof z.ZodError ? 'Supply a valid --email, --name and a password of 8–128 characters.' : error instanceof Error ? error.message : 'Seeding failed.')
    process.exitCode = 1
  } finally {
    await runtime?.close()
    await mongoose.disconnect()
  }
}
