import { useContext, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { WidgetHeaderContext, WidgetPageActionsContext } from './WidgetHeaderContext'

export function WidgetActions({ children }: { children: ReactNode }) {
  const pageActions = useContext(WidgetPageActionsContext)
  const headerSlot = useContext(WidgetHeaderContext)
  if (pageActions) return <PageHeaderActions>{children}</PageHeaderActions>
  if (headerSlot) return createPortal(children, headerSlot)
  return headerSlot === undefined ? <div className="mb-4 flex flex-wrap items-center gap-2">{children}</div> : null
}
