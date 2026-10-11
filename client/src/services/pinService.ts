import { loadPinnedRecords } from './pinnedRecords.ts'
import { z } from 'zod'
import type { BrowserDatabase } from './browserDatabase.ts'
import type { LoadResult, SaveResult } from './contracts.ts'
import { MAX_PINS, pinnedWidgetSchema, widgetInstanceSchema, widgetSelectionKey, widgetViewStateSchema, type PinnedWidget, type WidgetInstance, type WidgetViewState } from '../domain/widgetInstances.ts'
export const pinCollectionKey = 'workspacePins'
const collectionSchema = z.strictObject({ version: z.literal(1), pins: pinnedWidgetSchema.array().max(MAX_PINS) }).refine(c => new Set(c.pins.map(p => p.pinId)).size === c.pins.length && new Set(c.pins.map(p => p.instanceId)).size === c.pins.length)
export type PinMutation = { ok: true; value: PinnedWidget[]; persistence: SaveResult } | { ok: false; message: string }
export function createPinService(database: BrowserDatabase, id: () => string = () => crypto.randomUUID(), now = () => new Date().toISOString()) {
  const loadPins = (): LoadResult<PinnedWidget[]> => {
    const loaded = database.readCollection(pinCollectionKey)
    if (loaded.status === 'missing') return { status: 'found', value: [] }
    if (loaded.status !== 'found') return loaded
    const parsed = collectionSchema.safeParse(loaded.value)
    return parsed.success ? { status: 'found', value: parsed.data.pins } : { status: 'invalid' }
  }
  const write = (pins: PinnedWidget[]): PinMutation => {
    const parsed = collectionSchema.safeParse({ version: 1, pins })
    if (!parsed.success) return { ok: false, message: 'The pin selection is invalid. Choose valid filters and dates.' }
    const persistence = database.writeCollection(pinCollectionKey, parsed.data)
    return persistence.status === 'invalid' ? { ok: false, message: 'Saved database data is invalid and has been preserved.' } : { ok: true, value: parsed.data.pins, persistence }
  }
  const change = (operation: (pins: PinnedWidget[]) => PinMutation): PinMutation => {
    const loaded = loadPins()
    return loaded.status === 'found' ? operation(loaded.value) : { ok: false, message: 'Saved pins are unavailable and have been preserved. Clear pins to start again.' }
  }
  return {
    loadPins,
    pinWidget(instance: WidgetInstance): PinMutation {
      const parsed = widgetInstanceSchema.safeParse(instance)
      if (!parsed.success) return { ok: false, message: 'Choose a valid view before pinning.' }
      const records = loadPinnedRecords(database, parsed.data)
      if (records.status !== 'found') return { ok: false, message: 'This view’s records are unavailable. Choose another selection.' }
      return change(pins => {
        if (pins.some(p => widgetSelectionKey(p) === widgetSelectionKey(parsed.data))) return { ok: true, value: pins, persistence: { status: 'saved' } }
        if (pins.length >= MAX_PINS) return { ok: false, message: `You can keep ${MAX_PINS} pins. Unpin a view before adding another.` }
        const pinId = id()
        return write([...pins, { ...parsed.data, ...records.value, instanceId: `pin:${pinId}`, pinId, createdAt: now() }])
      })
    },
    unpinWidget(pinId: string) { return change(pins => write(pins.filter(p => p.pinId !== pinId))) },
    updatePinViewState(pinId: string, patch: Partial<WidgetViewState>) {
      return change(pins => {
        const pin = pins.find(p => p.pinId === pinId)
        if (!pin) return { ok: false, message: 'This pin is no longer available.' }
        const state = widgetViewStateSchema.safeParse({ ...pin.viewState, ...patch })
        if (!state.success) return { ok: false, message: 'Choose valid filters and an ordered date range.' }
        const next = { ...pin, viewState: state.data }
        if (pins.some(p => p.pinId !== pinId && widgetSelectionKey(p) === widgetSelectionKey(next))) return { ok: false, message: 'That selection is already pinned. Unpin one view or choose different filters.' }
        return write(pins.map(p => p.pinId === pinId ? next : p))
      })
    },
    clearPins: () => write([]),
  }
}
