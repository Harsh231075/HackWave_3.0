import type { ReactNode } from 'react'

interface PageHeaderProps {
  visible: boolean
  left?: ReactNode
  right?: ReactNode
}

export function PageHeader({ visible, left, right }: PageHeaderProps) {
  return <header className="canvas-header" hidden={!visible}>
    {left}
    <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{right}</div>
  </header>
}
