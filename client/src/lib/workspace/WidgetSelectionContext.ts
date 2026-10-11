import { createContext, useContext } from 'react'
import type { UsageQuery } from '@/domain/usage'
export const WidgetSelectionContext = createContext<((query: UsageQuery | null) => void) | null>(null)
export const useWidgetSelection = () => useContext(WidgetSelectionContext)
export const PinControlsContext = createContext(true)
