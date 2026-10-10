import { adaptiveProjectSchema } from '../domain/adaptiveData.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createCollection } from './local/collection.ts'
const projectSchema = adaptiveProjectSchema
export function createProjectService(database: BrowserDatabase) { return createCollection(database, 'projects', projectSchema) }
