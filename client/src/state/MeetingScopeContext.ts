import type { Task, Filters } from '@/domain/types'
import { createContext } from 'react'
import type { MeetingComposition, Preparation } from '@/domain/adaptiveData'
export type MeetingScope = { data: Preparation; composition: MeetingComposition; tasks: Task[]; filters: Filters; updateFilters: (patch: Partial<Filters>) => void }
export const MeetingScopeContext = createContext<MeetingScope | null>(null)
