import { createContext } from 'react'

export interface PageHeaderSlot {
  target: HTMLDivElement | null
  register: (id: string) => () => void
}

export const PageHeaderContext = createContext<PageHeaderSlot | null>(null)
