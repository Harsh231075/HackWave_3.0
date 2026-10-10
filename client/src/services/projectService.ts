import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createCollection } from './local/collection.ts'
const projectSchema = z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(160), description: z.string().max(2000).default('') })
export function createProjectService(database: BrowserDatabase) { return createCollection(database, 'projects', projectSchema) }
