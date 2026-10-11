import { useState, type ReactNode } from 'react'
import { useProject } from '@/hooks/useProject'
import { ComponentViewProvider } from './ComponentViewProvider'
import { componentViewSchema, type ViewBindings } from '@/domain/componentIntent'
import { calendarDate } from '@/domain/calendar'

export function SelectedProjectScope({ children }: { children: ReactNode }) {
  const { selectedId } = useProject()
  return <ProjectView key={selectedId} projectId={selectedId}>{children}</ProjectView>
}
function ProjectView({ projectId, children }: { projectId?: string; children: ReactNode }) {
  const [bindings, setBindings] = useState<Partial<ViewBindings>>({})
  const plan = componentViewSchema.parse({ action: 'view', widgets: ['tasks'], bindings: { ...bindings, projectId, draftKey: `project-outline:${projectId}` }, reply: 'Selected project', referenceDate: calendarDate(), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  return <ComponentViewProvider plan={plan} onChange={patch => setBindings(current => ({ ...current, ...patch }))}>{children}</ComponentViewProvider>
}
