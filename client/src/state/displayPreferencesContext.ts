import { createContext } from 'react'
import type { DisplayPreferences } from '@/services/contracts'
export const DisplayPreferencesContext = createContext<{
  preferences: DisplayPreferences
  update: (patch: Partial<DisplayPreferences>) => void
} | null>(null)
