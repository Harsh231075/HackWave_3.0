import { useContext, useId, useLayoutEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageHeaderContext } from './pageHeaderContext'

export function PageHeaderActions({ children, active = true }: { children: ReactNode; active?: boolean }) {
  const slot = useContext(PageHeaderContext)
  const id = useId()
  const register = slot?.register
  useLayoutEffect(() => {
    if (active && register) return register(id)
  }, [active, id, register])

  if (!slot) throw new Error('PageHeaderActions must be rendered inside WorkspaceLayout.')
  return active && slot.target ? createPortal(children, slot.target) : null
}
