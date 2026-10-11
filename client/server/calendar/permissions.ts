const base = 'https://www.googleapis.com/auth/'
export function calendarCapabilities(scope: string | undefined) {
  const granted = new Set((scope ?? '').split(/\s+/).filter(Boolean))
  const full = granted.has(base + 'calendar')
  const write = full || granted.has(base + 'calendar.events')
  return { read: write || granted.has(base + 'calendar.readonly') || granted.has(base + 'calendar.events.readonly'), write }
}
