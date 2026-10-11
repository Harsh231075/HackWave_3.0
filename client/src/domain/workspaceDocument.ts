import { normalizeLayoutRows, chooseLayoutVersion } from './widgetLayout.ts'
import { workspaceContinuationSchema } from './workspaceContinuation.ts'
import { z } from 'zod'
import { MAX_CANVAS_WIDGETS, MAX_PINS, pinnedWidgetSchema, widgetInstanceSchema, widgetSelectionKey, makeInstance, type WidgetInstance } from './widgetInstances.ts'
import type { WorkspaceOperation } from './workspaceManagement.ts'
import { PRESETS, type WidgetType } from '../lib/workspace/config.ts'

export const turnSchema = z.strictObject({ id: z.string(), prompt: z.string().max(4000), reply: z.string().max(2000), source:z.enum(['ai','local']).optional(), status: z.enum(['pending', 'ready', 'error', 'cancelled', 'clarification']) })
export const workspaceDocumentSchema = z.strictObject({
  version: z.literal(3), continuation: workspaceContinuationSchema.optional(), active: widgetInstanceSchema.array(), pins: pinnedWidgetSchema.array().max(MAX_PINS),
  rows: z.array(z.array(z.string().min(1)).min(1).max(MAX_CANVAS_WIDGETS)).max(MAX_CANVAS_WIDGETS).optional(),
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
export const emptyWorkspace = (): WorkspaceDocument => ({ version: 3, active: [], pins: [], revision: 0, turns: [], targets: [] })

export class TargetError extends Error {
  choices: Array<{ id: string; label: string }>
  constructor(type: string, instances: WidgetInstance[]) {
    super(`Choose which ${type} view to change.`)
    this.choices = instances.map((w, index) => ({ id: w.instanceId, label: w.binding.kind === 'workspace' ? `${w.widgetType} view ${index + 1}` : w.label }))
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
  const merged = { ...document, ...patch }
  const rows = normalizeLayoutRows([...merged.active, ...merged.pins], patch.rows ?? normalizeLayoutRows([...document.active, ...document.pins], document.rows))
  const next = workspaceDocumentSchema.parse(JSON.parse(JSON.stringify({ ...merged, rows, revision: document.revision + 1 })))
  const ids = new Set([...next.active, ...next.pins].map(w => w.instanceId))
  if (next.continuation?.lastSuccess?.targetInstanceIds.some(id => !ids.has(id))) delete next.continuation.lastSuccess
  if (next.continuation?.pending?.targetInstanceIds.some(id => !ids.has(id))) delete next.continuation.pending
  return next
}
export function applyInstanceOperations(document: WorkspaceDocument, operations: WorkspaceOperation[], create: (type: WidgetType) => WidgetInstance, includePins = false): WorkspaceDocument {
  let active = [...document.active], pins = [...document.pins]
  let rows = normalizeLayoutRows([...active, ...pins], document.rows)
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
      const oldRows = rows.map(row => [...row])
      remove(ids)
      if (op.type === 'replace') {
        const added = op.with.map(create).filter(w => ![...active, ...pins].some(existing => widgetSelectionKey(w) === widgetSelectionKey(existing)))
        active.splice(index, 0, ...added); targets.push(...added.map(w => w.instanceId))
        let inserted = false
        rows = oldRows.map(row => row.flatMap(id => {
          if (!ids.includes(id)) return [id]
          if (inserted) return []
          inserted = true; return added.map(w => w.instanceId)
        })).filter(row => row.length)
      }
      continue
    }
    const layoutTarget = (name: string) => {
      if (name === '@last') {
        const matching = [...active, ...pins].filter(w => document.targets.includes(w.instanceId))
        if (matching.length !== 1) throw new TargetError('selected', matching.length ? matching : [...active, ...pins])
        return matching[0]
      }
      return resolveTarget({ ...document, active, pins }, name, true)
    }
    const instance = layoutTarget(op.widget)
    if (!instance) throw new Error('Add that view before changing it.')
    targets.push(instance.instanceId)
    if (op.type === 'resize') {
      if ([op.span, op.version, op.size].filter(v => v !== undefined).length !== 1) throw new Error('Choose one size or version change.')
      const layoutVersion = op.version !== undefined || op.size ? chooseLayoutVersion(instance, op.version ?? op.size!) : instance.layoutVersion
      const patch = { ...(op.span ? { span: op.span, layoutWidth: op.span } : { layoutWidth: undefined }), ...(layoutVersion !== undefined ? { layoutVersion } : {}) }
      active = active.map(w => w.instanceId === instance.instanceId ? { ...w, ...patch } : w)
      pins = pins.map(w => w.instanceId === instance.instanceId ? { ...w, ...patch } : w)
    } else {
      const anchor = op.relativeTo ? layoutTarget(op.relativeTo) : undefined
      if (anchor?.instanceId === instance.instanceId) throw new Error('A widget cannot be positioned relative to itself.')
      const side = op.position === 'right' ? 'right' as const : undefined
      active = active.map(w => w.instanceId === instance.instanceId ? { ...w, layoutSide: side } : w)
      pins = pins.map(w => w.instanceId === instance.instanceId ? { ...w, layoutSide: side } : w)
      const all = [...active, ...pins]
      rows = normalizeLayoutRows(all, rows)
      const ownRow = rows.find(row => row.includes(instance.instanceId))!
      const anchorRow = anchor ? rows.find(row => row.includes(anchor.instanceId)) : undefined
      if (['before','after','above','below','left-of','right-of'].includes(op.position) && !anchorRow) throw new Error('Choose an available target view.')
      let destination: string[] | undefined
      if (op.position === 'left' || op.position === 'right') destination = ownRow
      if (op.position === 'left-of' || op.position === 'right-of') destination = anchorRow
      rows = rows.map(row => row.filter(id => id !== instance.instanceId)).filter(row => row.length)
      if (destination) {
        const remaining = destination.filter(id => id !== instance.instanceId)
        const insertion = op.position === 'left' ? 0 : op.position === 'right' ? remaining.length : remaining.indexOf(anchor!.instanceId) + (op.position === 'right-of' ? 1 : 0)
        remaining.splice(insertion, 0, instance.instanceId)
        const index = rows.findIndex(row => row.some(id => destination!.includes(id)))
        if (index < 0) rows.push(remaining); else rows[index] = remaining
      } else {
        let index = op.position === 'first' ? 0 : rows.length
        if (anchor) index = rows.findIndex(row => row.includes(anchor.instanceId)) + (['after','below'].includes(op.position) ? 1 : 0)
        rows.splice(index, 0, [instance.instanceId])
      }
      const order = rows.flat()
      active.sort((a, b) => order.indexOf(a.instanceId) - order.indexOf(b.instanceId))
    }
  }
  return commitWorkspace(document, { active, pins, targets, rows })
}

export function resetWorkspaceLayout(document: WorkspaceDocument): WorkspaceDocument {
  const pinned = new Set(document.pins.map(widgetSelectionKey))
  const active = PRESETS.home.widgets.map(widget => ({ ...makeInstance(widget.id), span: widget.span }))
    .filter(widget => !pinned.has(widgetSelectionKey(widget))).slice(0, MAX_CANVAS_WIDGETS - document.pins.length)
  return commitWorkspace(document, { active, rows: normalizeLayoutRows([...active, ...document.pins]), targets: [], continuation: undefined })
}
export function clearWorkspacePins(document: WorkspaceDocument): WorkspaceDocument {
  const activeIds = new Set(document.active.map(widget => widget.instanceId))
  return commitWorkspace(document, { pins: [], targets: document.targets.filter(id => activeIds.has(id)) })
}
