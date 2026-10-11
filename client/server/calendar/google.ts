import type { CalendarEvent } from '../../src/domain/calendar.ts'
import type { Connection } from './store.ts'

export class CalendarError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}
export function normalizeGoogleEvent(item: Record<string, unknown>, calendarId = 'primary'): CalendarEvent | null {
  if (item.status === 'cancelled' || typeof item.id !== 'string') return null
  const start = item.start as { date?: string; dateTime?: string; timeZone?: string } | undefined
  const end = item.end as { date?: string; dateTime?: string; timeZone?: string } | undefined
  if (!(start?.dateTime ?? start?.date) || !(end?.dateTime ?? end?.date)) return null
  const attendees = Array.isArray(item.attendees) ? item.attendees as Array<{ email?: string; displayName?: string; responseStatus?: string }> : []
  const organizer = item.organizer as { email?: string } | undefined
  const conference = item.conferenceData as { entryPoints?: Array<{ entryPointType?: string; uri?: string }> } | undefined
  return { id: item.id, calendarId, title: typeof item.summary === 'string' ? item.summary : 'Untitled meeting', description: typeof item.description === 'string' ? item.description : '',
    start: (start!.dateTime ?? start!.date)!, end: (end!.dateTime ?? end!.date)!, allDay: !!start?.date,
    timezone: start?.timeZone ?? 'UTC', attendees: attendees.filter(a => a.email).map(a => ({ email: a.email!, name: a.displayName, response: a.responseStatus })),
    organizer: organizer?.email ?? '', location: typeof item.location === 'string' ? item.location : '',
    meetingUrl: typeof item.hangoutLink === 'string' ? item.hangoutLink : conference?.entryPoints?.find(p => p.entryPointType === 'video')?.uri ?? '',
    url: typeof item.htmlLink === 'string' ? item.htmlLink : '', revision: String(item.etag ?? item.updated ?? ''), status: String(item.status ?? 'confirmed') }
}
export function createGoogleProvider(env: NodeJS.ProcessEnv, save: () => void, transport: typeof fetch = fetch) {
  const refreshes = new Map<Connection, Promise<void>>()
  async function refresh(connection: Connection) {
    if (connection.expires > Date.now() + 60000) return
    const running = refreshes.get(connection)
    if (running) return running
    const operation = (async () => {
      if (!connection.refreshToken) throw new CalendarError(401, 'Reconnect Google Calendar to continue.')
      const res = await transport('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, refresh_token: connection.refreshToken, grant_type: 'refresh_token' }), signal: AbortSignal.timeout(20000) })
      if (!res.ok) throw new CalendarError(401, 'Google access expired. Reconnect your calendar.')
      const token = await res.json() as { access_token?: string; expires_in?: number; refresh_token?: string; scope?: string }
      if (!token.access_token) throw new CalendarError(502, 'Google did not return an access token.')
      connection.accessToken = token.access_token; connection.expires = Date.now() + (token.expires_in ?? 3600) * 1000
      if (token.refresh_token) connection.refreshToken = token.refresh_token
      if (token.scope) connection.scope = token.scope
      save()
    })()
    refreshes.set(connection, operation)
    try { await operation } finally { refreshes.delete(connection) }
  }
  async function api(connection: Connection, path: string, init: RequestInit = {}) {
    await refresh(connection)
    const res = await transport('https://www.googleapis.com/calendar/v3' + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${connection.accessToken}`, ...init.headers }, signal: AbortSignal.timeout(20000) })
    if (!res.ok) {
      const message = res.status === 401 ? 'Reconnect Google Calendar to continue.' : res.status === 403 ? 'Google did not allow this calendar operation. Check the granted permissions.' : res.status === 429 ? 'Google Calendar is busy. Try again shortly.' : 'Google Calendar could not complete the request. Your existing workspace is unchanged.'
      throw new CalendarError(res.status === 404 ? 404 : res.status === 409 ? 409 : res.status === 401 ? 401 : res.status === 403 ? 403 : res.status === 429 ? 429 : 502, message)
    }
    return res.json()
  }
  return { api,
    async events(connection: Connection, from: string, to: string, timezone: string) {
      const records: CalendarEvent[] = []
      let pageToken = ''
      do {
        const query = new URLSearchParams({ timeMin: from, timeMax: to, singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: timezone, ...(pageToken ? { pageToken } : {}) })
        const data = await api(connection, '/calendars/primary/events?' + query) as { items?: Record<string, unknown>[]; nextPageToken?: string }
        for (const item of data.items ?? []) { const event = normalizeGoogleEvent(item); if (event && !records.some(r => r.id === event.id)) records.push(event) }
        pageToken = data.nextPageToken ?? ''
        if (records.length > 3000) throw new CalendarError(413, 'Choose a smaller calendar date range.')
      } while (pageToken)
      return records
    },
    async event(connection: Connection, id: string) {
      const item = await api(connection, '/calendars/primary/events/' + encodeURIComponent(id)) as Record<string, unknown>
      const event = normalizeGoogleEvent(item)
      if (!event) throw new CalendarError(404, 'This meeting was cancelled or is no longer available.')
      return event
    },
  }
}
