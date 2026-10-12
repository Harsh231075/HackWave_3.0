import { useState, type ReactNode } from 'react'
import { preferencesService } from '@/services'
import type { DisplayPreferences } from '@/services/contracts'
import { DisplayPreferencesContext } from './displayPreferencesContext'
export function DisplayPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(() => preferencesService.load())
  const update = async (patch: Partial<DisplayPreferences>) => {
    const result = await preferencesService.save(patch)
    if (result.status !== 'invalid') setPreferences(current => ({ ...current, ...patch }))
  }
  return <DisplayPreferencesContext.Provider value={{ preferences, update }}>{children}</DisplayPreferencesContext.Provider>
}
