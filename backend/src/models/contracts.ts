import { z } from 'zod'

const id = z.string().trim().min(1).max(160)
const title = z.string().trim().min(1).max(160)
const text = z.string().max(5000)
const date = z.iso.date()
const time = z.iso.time({ precision: -1 })
export const widgetTypes = ['metrics','tasks','timeline','meetings','recommendation','outline','resources','resource-create','context','calendar','availability','chart','activity','usage','communications','issues','quick-timer','voice-note','calculator','external-plugin','mail-inbox','mail-message','mail-compose'] as const
export const entityContracts = {
  tasks: z.strictObject({ title, description: z.string().max(2000).default(''), owner: id, due: date, duration: z.number().int().min(5).max(480).default(30), priority: z.enum(['urgent','high','medium','low']).default('medium'), status: z.enum(['pending','blocked','completed']).default('pending') }),
  events: z.strictObject({ title, date, start: time, end: time, category: z.enum(['meeting','focus','class','break']).default('meeting'), participants: id.array().max(30).default([]), agenda: text.default('') }),
  notes: z.strictObject({ title, body: text.default(''), kind: z.enum(['general','agenda','investigation']).default('general'), meetingId: id.optional(), pinned: z.boolean().default(false) }),
  resources: z.strictObject({ title, kind: z.enum(['document','link','text','attachment','reference']).default('document'), context: z.string().max(200).default(''), body: text.default(''), description: z.string().max(2000).default(''), tags: z.string().trim().min(1).max(40).array().max(20).default([]) }),
  attachments: z.strictObject({ name: title, mimeType: id, size: z.number().int().nonnegative().max(2 * 1024 * 1024), storageKey: id }),
  links: z.strictObject({ sourceType: z.enum(['tasks','events','notes','resources','issues','communications','usage-releases','usage-observations']), sourceId: id, targetType: z.enum(['tasks','events','notes','resources','issues','communications','usage-releases','usage-observations']), targetId: id, relationType: z.enum(['related','previous_meeting']).default('related') }),
  issues: z.strictObject({ title, description: text.default(''), owner: id, status: z.enum(['open','closed']).default('open'), meetingId: id.optional() }),
  communications: z.strictObject({ subject: title, sender: id, body: text.default(''), date, meetingId: id.optional() }),
  'usage-observations': z.strictObject({ date, segment: id, sessions: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER), source: z.enum(['synthetic','manual']).default('manual') }),
  'usage-releases': z.strictObject({ title, date, description: text.default(''), segments: id.array().max(30).default([]), source: z.enum(['synthetic','manual']).default('manual') }),
  'plugin-settings': z.strictObject({ pluginId: z.enum(['quick-timer','voice-note','calculator','external-plugin','mail']), enabled: z.boolean(), configuration: z.record(z.string().max(80), z.json()).default({}) }),
  'voice-notes': z.strictObject({ noteId: id, attachmentId: id, durationMs: z.number().int().min(1).max(120000) }),
  workspaces: z.strictObject({ title, components: z.strictObject({ instanceId: id, widgetType: z.enum(widgetTypes), span: z.enum(['full','wide','narrow']).default('wide'), pinned: z.boolean().default(false), properties: z.record(z.string().max(80), z.json()).default({}) }).array().max(14).default([]), context: z.strictObject({ goal: z.string().max(4000).default(''), targetInstanceIds: id.array().max(14).default([]) }).default({goal:'',targetInstanceIds:[]}) }),
  activity: z.strictObject({ operation: z.enum(['create','update','delete']), entityType: id, entityId: id, summary: z.string().max(500), at: z.iso.datetime() }),
} as const
export type EntityType = keyof typeof entityContracts
export type RecordData = Record<string, unknown>
export type StoredRecord = RecordData & { id: string; revision: number; createdAt: string; updatedAt: string }
export function isEntityType(value: string): value is EntityType { return Object.hasOwn(entityContracts, value) }

export function parseEntity(entity: EntityType, input: unknown): RecordData {
  const value = entityContracts[entity].parse(input) as RecordData
  if (entity === 'events' && String(value.start) >= String(value.end)) throw new Error('Event end must follow its start on the same date.')
  if (entity === 'resources' && value.kind === 'link') {
    try { const url=new URL(String(value.body));if(!['http:','https:'].includes(url.protocol))throw new Error() } catch { throw new Error('A link resource needs a valid HTTP or HTTPS URL.') }
  }
  if (entity === 'links' && value.relationType === 'previous_meeting' && (value.sourceType !== 'events' || value.targetType !== 'events')) throw new Error('Previous meeting links must connect two events.')
  if (entity === 'workspaces') {
    const components=value.components as Array<{instanceId:string}>, ids=new Set(components.map(c=>c.instanceId))
    if(ids.size!==components.length)throw new Error('Component instance IDs must be unique.')
    if((value.context as {targetInstanceIds:string[]}).targetInstanceIds.some(id=>!ids.has(id)))throw new Error('Context targets must exist in this workspace.')
  }
  return value
}
