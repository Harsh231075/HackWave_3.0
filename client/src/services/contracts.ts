import type { LayoutSession, MeetingLayoutInput } from './layoutService.ts'
import type { DomainSnapshot, Event, Resource, Task } from '../domain/types.ts'

export type LoadResult<T> = { status: 'found'; value: T } | { status: 'missing' | 'invalid' | 'unavailable' }
export type SaveResult = { status: 'saved' | 'unavailable' | 'invalid' }
export interface StorageAdapter {
  readJson(key: string): LoadResult<unknown>
  writeJson(key: string, value: unknown): SaveResult
  readString(key: string): LoadResult<string>
  writeString(key: string, value: string): SaveResult
  remove(key: string): SaveResult
}
export interface WorkspaceService { load(): LoadResult<DomainSnapshot>; save(snapshot: DomainSnapshot): SaveResult }
export interface LayoutService { load(): LoadResult<string>; loadSession(): LoadResult<LayoutSession>; save(response: string): SaveResult; saveMeeting(session: MeetingLayoutInput): SaveResult; saveUsage(session: import('./layoutService.ts').UsageLayout): SaveResult; saveOverdue(session: import('./layoutService.ts').OverdueLayout): SaveResult; clear(): SaveResult }
export type TaskView = 'list' | 'kanban'
export type CalendarView = 'month' | 'week' | 'day' | 'agenda'
export type CalendarCategory = 'all' | Event['category']
export interface DisplayPreferences { taskView: TaskView; calendarView: CalendarView; calendarCategory: CalendarCategory }
export interface PreferencesService { load(): DisplayPreferences; save(patch: Partial<DisplayPreferences>): SaveResult }
export interface GenerateWorkspaceInput {
  goal: string
  previousUI: string
  context: { canvas?: import('../domain/widgetLayout.ts').CanvasMetrics; layoutCatalog?: Record<string, import('../domain/widgetLayout.ts').LayoutVariant[]>; demoDate: string; timezone?: string; tasks: Task[]; events: Event[]; drafts: Record<string, string>; pins: string[]; componentState: Record<string, unknown> }
}
export interface GenerationService { generate(input: GenerateWorkspaceInput, options?: { signal?: AbortSignal }): Promise<{ response: string }> }
export interface ResourceService { list(context?: string): Resource[]; getById(id: string): Resource | null }
