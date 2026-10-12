import { fileSchema } from '../../client/src/services/fileService.ts'
import { profileSchema } from '../../client/src/services/profileService.ts'
import { importedPluginSchema } from '../../client/src/extensions/external/importService.ts'
import mongoose, { Schema } from 'mongoose'
import { z } from 'zod'
import { persistedSchema } from '../../client/src/services/workspaceService.ts'
import { noteSchema } from '../../client/src/domain/notes.ts'
import { meetingSchema, communicationSchema, issueSchema, relationshipSchema, adaptiveResourceSchema } from '../../client/src/domain/adaptiveData.ts'
import { usageObservationSchema, usageReleaseSchema } from '../../client/src/domain/usage.ts'
import { timerSessionSchema } from '../../client/src/extensions/quick-timer/schema.ts'
import { activityRecordSchema } from '../../client/src/services/recordHistory.ts'
import { emptyBackendSnapshot, type BackendSnapshot } from './services.ts'

export class BackendError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
let connecting: Promise<typeof mongoose> | undefined
export async function connectDatabase(env: NodeJS.ProcessEnv = process.env) {
  if (!env.MONGODB_URI) throw new BackendError(503, 'Configure MONGODB_URI on the server.')
  if (!connecting) connecting = mongoose.connect(env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 }).catch(error => { connecting = undefined; throw error })
  try { await connecting } catch { throw new BackendError(503, 'The database is unavailable. Retry when it is connected.') }
}

const recordSchemas = {
  files: fileSchema, profiles: profileSchema, importedPlugins: importedPluginSchema,
  members: z.object({ id: z.string().min(1), profileId: z.string().min(1) }),
  tasks: persistedSchema.shape.tasks.element, events: persistedSchema.shape.events.element,
  notes: noteSchema.extend({ body: z.string().max(5000) }), meetings: meetingSchema, resources: adaptiveResourceSchema,
  communications: communicationSchema, issues: issueSchema, relationships: relationshipSchema,
  usageObservations: usageObservationSchema, usageReleases: usageReleaseSchema, timerSessions: timerSessionSchema,
  recordActivity: activityRecordSchema,
}
type RecordKey = keyof typeof recordSchemas
function mongooseFields(schema: z.ZodType) {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any' }) as { properties?: Record<string, { type?: string; enum?: string[] }> }
  return Object.fromEntries(Object.entries(json.properties ?? {}).filter(([key]) => key !== 'id').map(([key, value]) => [key, { type: value.type === 'string' ? String : value.type === 'number' || value.type === 'integer' ? Number : value.type === 'boolean' ? Boolean : Schema.Types.Mixed, ...(value.enum ? { enum: value.enum } : {}) }]))
}
const models = Object.fromEntries(Object.entries(recordSchemas).map(([key, validator]) => {
  const schema = new Schema({ _id: String, recordId: String, userId: { type: String, required: true, immutable: true }, ...mongooseFields(validator) }, { strict: 'throw', versionKey: false })
  schema.index({ userId: 1 })
  if (key === 'tasks') schema.index({ userId: 1, status: 1, due: 1 })
  if (key === 'events') schema.index({ userId: 1, date: 1 })
  if (key === 'notes') schema.index({ userId: 1, updatedAt: -1 })
  if (key === 'relationships') schema.index({ userId: 1, sourceKind: 1, sourceId: 1 })
  if (key === 'usageObservations') schema.index({ userId: 1, date: 1, segment: 1 }, { unique: true })
  return [key, mongoose.models[`Orlo_${key}`] ?? mongoose.model(`Orlo_${key}`, schema, key)]
})) as Record<RecordKey, mongoose.Model<unknown>>
const stateSchema = new Schema({ _id: String, revision: { type: Number, default: 0 }, collections: Schema.Types.Mixed, preferences: Schema.Types.Mixed, dismissed: [String], activity: [String] }, { versionKey: false })
const stateModel = mongoose.models.Orlo_state ?? mongoose.model('Orlo_state', stateSchema, 'userState')

export async function loadSnapshot(userId: string, session?: mongoose.ClientSession): Promise<BackendSnapshot> {
  const state = await stateModel.findById(userId).session(session ?? null).lean() as { revision: number; collections: Record<string, unknown>; preferences: Record<string, string>; dismissed: string[]; activity: string[] } | null
  const snapshot = emptyBackendSnapshot()
  if (state) { snapshot.revision = state.revision; snapshot.collections = { ...snapshot.collections, ...state.collections }; snapshot.preferences = state.preferences ?? {}; snapshot.records.dismissed = state.dismissed ?? []; snapshot.records.activity = state.activity ?? [] }
  await Promise.all(Object.entries(models).map(async ([key, model]) => {
    const rows = await model.find({ userId }).session(session ?? null).lean() as unknown as Array<Record<string, unknown>>
    const records: Array<Record<string, unknown> & { id: string }> = rows.map(({ _id, recordId, userId: _owner, ...record }) => ({ id: String(recordId ?? _id), ...record }))
    if (key === 'tasks' || key === 'events') (snapshot.records[key] as unknown[]) = records
    else if (key === 'notes') {
      snapshot.collections.notes = records.map(({ body, ...note }) => { snapshot.records.drafts[String(note.draftKey)] = String(body ?? ''); return note })
    } else snapshot.collections[key] = records
  }))
  return snapshot
}

export async function saveSnapshot(userId: string, expected: number, next: BackendSnapshot, session: mongoose.ClientSession) {
  const current = await stateModel.findById(userId).session(session).lean() as { revision: number } | null
  if ((current?.revision ?? 0) !== expected) throw new BackendError(409, 'Records changed in another tab. Refresh and review your edits.')
  const collections = { ...next.collections }
  for (const [key, validator] of Object.entries(recordSchemas)) {
    let values = key === 'tasks' || key === 'events' ? next.records[key] : next.collections[key] ?? []
    if (key === 'notes') values = (values as Array<Record<string, unknown>>).map(note => ({ ...note, body: next.records.drafts[String(note.draftKey)] ?? '' }))
    const records = validator.array().parse(values) as Array<{ id: string } & Record<string, unknown>>
    const model = models[key as RecordKey]
    const storedId = (id: string) => JSON.stringify([userId, id])
    if (records.length) await model.bulkWrite(records.map(({ id, ...record }) => ({ replaceOne: { filter: { _id: storedId(id), userId }, replacement: { _id: storedId(id), recordId: id, userId, ...record }, upsert: true } })), { session })
    await model.deleteMany({ userId, _id: { $nin: records.map(r => storedId(r.id)) } }).session(session)
    delete collections[key]
  }
  // Draft bodies are persisted only with their canonical notes, not as a second map.
  const updated = { revision: expected + 1, collections, preferences: next.preferences, dismissed: next.records.dismissed, activity: next.records.activity }
  if (current) {
    const result = await stateModel.updateOne({ _id: userId, revision: expected }, { $set: updated }, { session })
    if (!result.modifiedCount) throw new BackendError(409, 'Records changed. Refresh before saving.')
  } else await stateModel.create([{ _id: userId, ...updated }], { session })
  return { ...next, revision: expected + 1 }
}

export async function resetUser(userId: string) {
  return mongoose.connection.transaction(async session => {
    for (const model of Object.values(models)) await model.deleteMany({ userId }).session(session)
    const current = await stateModel.findById(userId).session(session).lean() as { revision: number } | null
    const snapshot = emptyBackendSnapshot(); snapshot.revision = (current?.revision ?? 0) + 1
    await stateModel.updateOne({ _id: userId }, { $set: { revision: snapshot.revision, collections: {}, preferences: {}, dismissed: [], activity: [] } }, { upsert: true, session })
    return snapshot
  })
}
export async function initializeIndexes() { for (const model of [...Object.values(models), stateModel]) await model.createIndexes() }
