import { createContext } from 'react'

export const WidgetHeaderContext = createContext<HTMLDivElement | null | undefined>(undefined)
export const WidgetPageActionsContext = createContext(false)
