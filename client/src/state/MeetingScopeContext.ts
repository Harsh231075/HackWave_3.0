import { createContext } from 'react'
import type { MeetingComposition, Preparation } from '@/domain/adaptiveData'
export type MeetingScope = { data: Preparation; composition: MeetingComposition }
export const MeetingScopeContext = createContext<MeetingScope | null>(null)
