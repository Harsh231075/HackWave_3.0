import type { WidgetExplanation } from '@/domain/widgetInstances'
import type { Task, Filters } from '@/domain/types'
import { createContext } from 'react'
import type { Preparation } from '@/domain/adaptiveData'
export type MeetingScope = { data: Preparation; composition: { widgets: WidgetExplanation[] }; tasks: Task[]; filters: Filters; updateFilters: (patch: Partial<Filters>) => void }
export const MeetingScopeContext = createContext<MeetingScope | null>(null)
