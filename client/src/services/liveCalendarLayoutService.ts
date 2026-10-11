import { z } from 'zod'
const schema = z.object({ kind: z.enum(['prepare', 'schedule']), goal: z.string().min(1).max(4000), date: z.iso.date(), accountId: z.string().optional(), eventId: z.string().optional(), widgets: z.array(z.enum(['details', 'outline', 'calendar'])).max(3).optional(), span: z.enum(['wide', 'narrow', 'full']).optional() })
const key = 'orlo-live-calendar-layout-v1'
export const liveCalendarLayoutService = {
  load() { try { const raw = localStorage.getItem(key); const parsed = raw ? schema.safeParse(JSON.parse(raw)) : null; return parsed?.success ? parsed.data : null } catch { return null } },
  save(value: unknown) { const result = schema.safeParse(value); if (!result.success) return false; try { localStorage.setItem(key, JSON.stringify(result.data)); return true } catch { return false } },
  clear() { try { localStorage.removeItem(key); return true } catch { return false } },
}
