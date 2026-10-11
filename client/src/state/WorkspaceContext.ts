import { createContext } from 'react'
import type { ActionResult, EventInput, TaskInput } from '@/domain/commands'
import type { Event, Filters, Task, WorkspaceState } from '@/domain/types'
interface WorkspaceContextValue {
  state: WorkspaceState; notify: (message: string) => void; notice: string
  draftBuffers: Record<string, string>; editDraft: (key: string, value: string) => void
  selectedDate: string; selectDate: (date: string) => void; resetDemo: () => void
  saveTask: (input: TaskInput) => ActionResult<Task>
  toggleTask: (id: string) => ActionResult<Task>
  saveEvent: (input: EventInput) => ActionResult<Event>
  addFocusTime: (taskId: string) => ActionResult<Event>
  deleteEvent: (id: string) => ActionResult<void>
  saveDraft: (key: string, value: string) => ActionResult<void>
  dismissRecommendation: (id: string) => void
  updateFilters: (patch: Partial<Filters>) => void
  togglePin: (id: string) => void
  undo: () => void
}
export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)
