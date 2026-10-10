import { useContext } from 'react'
import { MeetingScopeContext } from '@/state/MeetingScopeContext'
export const useMeetingScope = () => useContext(MeetingScopeContext)
