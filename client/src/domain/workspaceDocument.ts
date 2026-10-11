import { workspaceContinuationSchema } from './workspaceContinuation.ts'
import { z } from 'zod'
import { MAX_CANVAS_WIDGETS, MAX_PINS, pinnedWidgetSchema, widgetInstanceSchema, widgetSelectionKey, makeInstance, type WidgetInstance } from './widgetInstances.ts'
import type { WorkspaceOperation } from './workspaceManagement.ts'
import { PRESETS, type WidgetType } from '../lib/workspace/config.ts'

export const turnSchema = z.strictObject({ id: z.string(), prompt: z.string().max(4000), reply: z.string().max(2000), source:z.enum(['ai','local']).optional(), status: z.enum(['pending', 'ready', 'error', 'cancelled', 'clarification']) })
export const workspaceDocumentSchema = z.strictObject({
  version: z.union([z.literal(1), z.literal(2)]).transform(() => 2 as const), continuation: workspaceContinuationSchema.optional(), active: widgetInstanceSchema.array(), pins: pinnedWidgetSchema.array().max(MAX_PINS),
  revision: z.number().int().nonnegative(), turns: turnSchema.array().max(60), targets: z.string().array(),
}).superRefine((document, ctx) => {
  const ids = [...document.active, ...document.pins].map(w => w.instanceId)
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'Widget instance IDs must be unique.' })
  if (ids.length > MAX_CANVAS_WIDGETS) ctx.addIssue({ code: 'custom', message: `Keep at most ${MAX_CANVAS_WIDGETS} views. Remove a view before adding another.` })
  if (new Set(document.pins.map(p => p.pinId)).size !== document.pins.length) ctx.addIssue({ code: 'custom', message: 'Pin IDs must be unique.' })
})
export type WorkspaceDocument = z.infer<typeof workspaceDocumentSchema>
export type ConversationTurn = z.infer<typeof turnSchema>
export const workspaceCollectionKey = 'workspaceDocument'
export const emptyWorkspace = (): WorkspaceDocument => ({ version: 2, active: [], pins: [], revision: 0, turns: [], targets: [] })

export class TargetError extends Error {
  choices: Array<{ id: string; label: string }>
  constructor(type: string, instances: WidgetInstance[]) {
    super(`Choose which ${type} view to change.`)
    this.choices = instances.map((w, index) => ({ id: w.instanceId, label: w.binding.kind === 'workspace' && !w.binding.projectId && !w.binding.clientId ? `${w.widgetType} view ${index + 1}` : w.label }))
  }
}
export function resolveTarget(document: WorkspaceDocument, target: string, includePins = false): WidgetInstance | undefined {
  const all = includePins ? [...document.active, ...document.pins] : document.active
  const exact = all.find(w => w.instanceId === target)
  if (exact) return exact
  const matching = all.filter(w => w.widgetType === target)
  const previous = matching.filter(w => document.targets.includes(w.instanceId))
  if (previous.length === 1) return previous[0]
  if (matching.length > 1) throw new TargetError(target, matching)
  return matching[0]
}
export function commitWorkspace(document: WorkspaceDocument, patch: Partial<WorkspaceDocument>): WorkspaceDocument {
  const next = workspaceDocumentSchema.parse(JSON.parse(JSON.stringify({ ...document, ...patch, revision: document.revision + 1 })))
  const ids = new Set([...next.active, ...next.pins].map(w => w.instanceId))
  if (next.continuation?.lastSuccess?.targetInstanceIds.some(id => !ids.has(id))) delete next.continuation.lastSuccess
  if (next.continuation?.pending?.targetInstanceIds.some(id => !ids.has(id))) delete next.continuation.pending
  return next
}
export function applyInstanceOperations(document: WorkspaceDocument, operations: WorkspaceOperation[], create: (type: WidgetType) => WidgetInstance, includePins = false): WorkspaceDocument {
  let active = [...document.active], pins = [...document.pins]
  const targets: string[] = []
  const target = (name: string) => resolveTarget({ ...document, active, pins }, name, includePins)
  const remove = (ids: string[]) => { active = active.filter(w => !ids.includes(w.instanceId)); if (includePins) pins = pins.filter(w => !ids.includes(w.instanceId)) }
  for (const operation of operations) {
    const op = operation
    if (op.type === 'clear') { active = []; if (includePins) pins = []; continue }
    if (op.type === 'add') {
      for (const type of op.widgets) {
        const existing = target(type)
        if (existing) { targets.push(existing.instanceId); continue }
        const instance = create(type)
        if (![...active, ...pins].some(w => widgetSelectionKey(w) === widgetSelectionKey(instance))) { active.push(instance); targets.push(instance.instanceId) }
      }
      continue
    }
    if (op.type === 'keep') {
      const keep = op.widgets.flatMap(type => { const found = target(type); return found ? [found.instanceId] : [] })
      active = active.filter(w => keep.includes(w.instanceId)); if (includePins) pins = pins.filter(w => keep.includes(w.instanceId))
      continue
    }
    if (op.type === 'remove' || op.type === 'replace') {
      const ids = op.widgets.flatMap(type => { const found = target(type); return found ? [found.instanceId] : [] })
      if (!ids.length) throw new Error('The requested view is not on this workspace.')
      const index = Math.max(0, active.findIndex(w => ids.includes(w.instanceId)))
      remove(ids)
      if (op.type === 'replace') {
        const added = op.with.map(create).filter(w => ![...active, ...pins].some(existing => widgetSelectionKey(w) === widgetSelectionKey(existing)))
        active.splice(index, 0, ...added); targets.push(...added.map(w => w.instanceId))
      }
      continue
    }
    const instance = target(op.widget)
    if (!instance) throw new Error('Add that view before changing it.')
    targets.push(instance.instanceId)
    if (op.type === 'resize') {
      active = active.map(w => w.instanceId === instance.instanceId ? { ...w, span: op.span } : w)
      pins = pins.map(w => w.instanceId === instance.instanceId ? { ...w, span: op.span } : w)
    } else {
      if (pins.some(w => w.instanceId === instance.instanceId)) throw new Error('Unpin this view before reordering it among active views.')
      const anchor = op.relativeTo ? target(op.relativeTo) : undefined
      if (anchor?.instanceId === instance.instanceId) continue
      active = active.filter(w => w.instanceId !== instance.instanceId)
      let index = op.position === 'first' ? 0 : active.length
      if (op.position === 'before' || op.position === 'after') {
        if (!anchor || !active.some(w => w.instanceId === anchor.instanceId)) throw new Error('Choose an active target view.')
        index = active.findIndex(w => w.instanceId === anchor.instanceId) + (op.position === 'after' ? 1 : 0)
      }
      active.splice(index, 0, instance)
    }
  }
  return commitWorkspace(document, { active, pins, targets })
}

export function resetWorkspaceLayout(document: WorkspaceDocument): WorkspaceDocument {
  const pinned = new Set(document.pins.map(widgetSelectionKey))
  const active = PRESETS.home.widgets.map(widget => ({ ...makeInstance(widget.id), span: widget.span }))
    .filter(widget => !pinned.has(widgetSelectionKey(widget))).slice(0, MAX_CANVAS_WIDGETS - document.pins.length)
  return commitWorkspace(document, { active, targets: [], continuation: undefined })
}
export function clearWorkspacePins(document: WorkspaceDocument): WorkspaceDocument {
  const activeIds = new Set(document.active.map(widget => widget.instanceId))
  return commitWorkspace(document, { pins: [], targets: document.targets.filter(id => activeIds.has(id)) })
}
