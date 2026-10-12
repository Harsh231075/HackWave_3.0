import { z } from 'zod'
import type { WidgetType } from '../lib/workspace/config.ts'

export const layoutVariantSchema = z.strictObject({
  version: z.number().int().positive(), description: z.string().min(1),
  minWidth: z.number().positive().max(4000), preferredWidth: z.number().positive().max(4000), maxWidth: z.number().positive().max(4000),
  minHeight: z.number().positive().max(4000), preferredHeight: z.number().positive().max(4000), scrollContent: z.boolean(),
}).refine(v => v.minWidth <= v.preferredWidth && v.preferredWidth <= v.maxWidth && v.minHeight <= v.preferredHeight, 'Dimensions must be ordered.')
export type LayoutVariant = z.infer<typeof layoutVariantSchema>
export const canvasMetricsSchema = z.object({ width: z.number().nonnegative().max(20000), height: z.number().nonnegative().max(20000), gap: z.number().nonnegative().max(100), allowVerticalScroll: z.literal(true) })
export type CanvasMetrics = z.infer<typeof canvasMetricsSchema>

const sizes: Record<WidgetType, readonly (readonly [number, number])[]> = {
  tasks: [[480, 380], [760, 560]], calendar: [[560, 440], [900, 640]],
  timeline: [[340, 400], [560, 560]], meetings: [[380, 360], [640, 520]],
  outline: [[380, 360], [720, 560]], resources: [[380, 360], [720, 520]],
  metrics: [[420, 240], [900, 240]], chart: [[480, 360], [800, 480]],
  activity: [[380, 360], [680, 520]], communications: [[400, 380], [720, 540]],
  issues: [[400, 380], [720, 540]], usage: [[640, 500], [1000, 640]],
  'mail-inbox': [[420, 420], [760, 520]], 'mail-message': [[560, 460], [800, 600]],
  recommendation: [[360, 300]], context: [[380, 340]], availability: [[420, 460]],
  'resource-create': [[560, 520]], 'mail-compose': [[560, 520]],
  'quick-timer': [[280, 340]], calculator: [[320, 440]], 'voice-note': [[360, 340]],
  'external-plugin': [[480, 400]],
}
const forms = new Set<WidgetType>(['resource-create', 'mail-compose', 'availability', 'quick-timer', 'calculator', 'voice-note', 'external-plugin'])
export const widgetLayoutCatalog = Object.fromEntries(Object.entries(sizes).map(([type, dimensions]) => [type, dimensions.map(([width, height], index) => layoutVariantSchema.parse({
  version: index + 1,
  description: dimensions.length === 1 ? 'Complete controls in one appropriately sized presentation.' : index === 0 ? 'Denser spacing with a shorter content region; same selected view and records.' : 'More spacious presentation with a taller content region; same selected view and records.',
  minWidth: type === 'quick-timer' ? 240 : type === 'calculator' ? 300 : type === 'usage' ? 560 : 280,
  preferredWidth: width, maxWidth: type === 'quick-timer' ? 340 : type === 'calculator' ? 360 : dimensions.length === 1 ? width : 1200,
  minHeight: type === 'quick-timer' ? 280 : ['resource-create', 'mail-compose', 'calendar', 'usage'].includes(type) ? 320 : 160,
  preferredHeight: height, scrollContent: !forms.has(type as WidgetType),
}))])) as Record<WidgetType, LayoutVariant[]>

export type LayoutInstance = { instanceId: string; widgetType: WidgetType; layoutVersion?: number; span?: 'full' | 'wide' | 'narrow'; layoutSide?: 'left' | 'right'; layoutWidth?: 'full' | 'wide' | 'narrow'; externalLayoutVariants?: LayoutVariant[]; viewState?: { taskView?: string; calendarView?: string } }
export function supportedLayoutVariants(instance: LayoutInstance): LayoutVariant[] { return instance.widgetType === 'external-plugin' && instance.externalLayoutVariants?.length ? instance.externalLayoutVariants : widgetLayoutCatalog[instance.widgetType] }
export function layoutVariant(instance: LayoutInstance): LayoutVariant {
  const variant = supportedLayoutVariants(instance).find(v => v.version === (instance.layoutVersion ?? 1))
  if (!variant) throw new Error(`Version ${instance.layoutVersion} is not available for ${instance.widgetType}.`)
  const minWidth = instance.widgetType === 'tasks' && instance.viewState?.taskView === 'kanban' ? 620 : instance.widgetType === 'calendar' && ['month', 'week'].includes(instance.viewState?.calendarView ?? 'month') ? 560 : variant.minWidth
  return { ...variant, minWidth, preferredWidth: Math.max(minWidth, variant.preferredWidth), maxWidth: Math.max(minWidth, variant.maxWidth) }
}
export function chooseLayoutVersion(instance: LayoutInstance, request: number | 'smaller' | 'larger') {
  const current = layoutVariant(instance)
  if (typeof request === 'number') {
    layoutVariant({ ...instance, layoutVersion: request })
    return request
  }
  const area = (v: LayoutVariant) => v.preferredWidth * v.preferredHeight
  const candidates = supportedLayoutVariants(instance).map(v => layoutVariant({ ...instance, layoutVersion: v.version }))
    .filter(v => request === 'smaller' ? area(v) < area(current) : area(v) > area(current))
    .sort((a, b) => Math.abs(area(a) - area(current)) - Math.abs(area(b) - area(current)))
  if (!candidates.length) throw new Error(`No ${request} version is available for ${instance.widgetType}. Its current presentation is kept.`)
  return candidates[0].version
}

// Normalize missing legacy rows and prune removed IDs without moving surviving instances.
export function normalizeLayoutRows(instances: LayoutInstance[], rows?: string[][]): string[][] {
  const ids = new Set(instances.map(i => i.instanceId)), seen = new Set<string>()
  const result = (rows ?? []).map(row => row.filter(id => {
    if (!ids.has(id) || seen.has(id)) return false
    seen.add(id); return true
  })).filter(row => row.length)
  let pending: string[] = [], units = 0
  const flush = () => { if (pending.length) result.push(pending); pending = []; units = 0 }
  for (const instance of instances) {
    if (seen.has(instance.instanceId)) continue
    const span = instance.span === 'wide' ? 8 : instance.span === 'narrow' ? 4 : 12
    if (units + span > 12) flush()
    pending.push(instance.instanceId); units += span
    if (units === 12) flush()
  }
  flush()
  return result
}
export type ArrangedCell = { instanceId: string; row: number; column: number; columns: number; width: number; variant: LayoutVariant }
export function arrangeWidgetRows(instances: LayoutInstance[], rows: string[][] | undefined, canvas: CanvasMetrics): ArrangedCell[] {
  const byId = new Map(instances.map(i => [i.instanceId, i]))
  const cells: ArrangedCell[] = []
  let rowNumber = 1
  for (const requestedRow of normalizeLayoutRows(instances, rows)) {
    let row: LayoutInstance[] = []
    const flush = () => {
      if (!row.length) return
      const variants = row.map(instance => {
        const variant = layoutVariant(instance)
        const fraction = instance.layoutWidth === 'narrow' ? 1 / 3 : instance.layoutWidth === 'wide' ? 2 / 3 : 1
        return instance.layoutWidth ? { ...variant, preferredWidth: Math.max(variant.minWidth, Math.min(variant.maxWidth, canvas.width * fraction)) } : variant
      })
      const unit = (canvas.width + canvas.gap) / 12
      const minimum = variants.map(v => Math.max(1, Math.min(12, Math.ceil((v.minWidth + canvas.gap) / Math.max(1, unit)))))
      let remaining = 12 - minimum.reduce((a, b) => a + b, 0)
      const columns = [...minimum]
      // Allocate spare columns toward each preferred width; retain empty space for small tools.
      for (let index = 0; index < row.length; index++) {
        const preferred = Math.min(12, Math.ceil((variants[index].preferredWidth + canvas.gap) / Math.max(1, unit)))
        const extra = Math.max(0, Math.min(remaining, preferred - columns[index]))
        columns[index] += extra; remaining -= extra
      }
      let column = 1
      row.forEach((instance, index) => {
        if (instance.layoutSide === 'right' && index === row.length - 1) column = 13 - columns[index]
        const width = Math.max(0, Math.min(variants[index].maxWidth, columns[index] * unit - canvas.gap))
        cells.push({ instanceId: instance.instanceId, row: rowNumber, column, columns: columns[index], width, variant: variants[index] })
        column += columns[index]
      })
      rowNumber++; row = []
    }
    for (const id of requestedRow) {
      const instance = byId.get(id)!
      const candidate = [...row, instance]
      const unit = Math.max(1, (canvas.width + canvas.gap) / 12)
      if (row.length && candidate.reduce((sum, i) => sum + Math.min(12, Math.ceil((layoutVariant(i).minWidth + canvas.gap) / unit)), 0) > 12) flush()
      row.push(instance)
    }
    flush()
  }
  return cells
}

export function composeNewLayoutRows(instances: LayoutInstance[], width: number, gap: number): string[][] {
  const rows: string[][] = []
  let row: string[] = [], used = 0
  for (const instance of instances) {
    const variant = layoutVariant(instance)
    if (row.length && used + gap + variant.preferredWidth > width) { rows.push(row); row = []; used = 0 }
    used += (row.length ? gap : 0) + variant.preferredWidth
    row.push(instance.instanceId)
  }
  if (row.length) rows.push(row)
  return rows
}
