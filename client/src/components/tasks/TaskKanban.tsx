import { useRef, useState, type ReactNode } from 'react'
import { DragDropProvider, useDraggable, useDroppable } from '@dnd-kit/react'
import { GripVertical } from 'lucide-react'
import type { ActionResult } from '@/domain/commands'
import type { Task, TaskStatus } from '@/domain/types'

const statuses: TaskStatus[] = ['pending', 'blocked', 'completed']
type ChangeStatus = (task: Task, status: TaskStatus) => ActionResult<Task> | Promise<ActionResult<Task>>

function DraggableTask({ task, disabled, renderCard }: { task: Task; disabled: boolean; renderCard: (task: Task, handle: ReactNode) => ReactNode }) {
  const { ref, handleRef, isDragging } = useDraggable({ id: task.id, disabled })
  return <div ref={ref} className={isDragging ? 'opacity-50' : undefined} data-kanban-task={task.id}>
    {renderCard(task, <button ref={handleRef} type="button" disabled={disabled} className="shrink-0 cursor-grab rounded p-1 text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing" style={{ touchAction: 'none' }} aria-label={`Move ${task.title}`}><GripVertical size={16} aria-hidden="true" /></button>)}
  </div>
}

function Column({ status, tasks, disabled, renderCard }: { status: TaskStatus; tasks: Task[]; disabled: boolean; renderCard: (task: Task, handle: ReactNode) => ReactNode }) {
  const { ref, isDropTarget } = useDroppable({ id: status, disabled })
  return <section ref={ref} data-kanban-column={status} className={`min-w-0 rounded-lg bg-muted p-3 ${isDropTarget ? 'ring-2 ring-ring' : ''}`}>
    <h3 tabIndex={-1} className="mb-3 flex justify-between text-sm font-medium capitalize">{status}<span>{tasks.length}</span></h3>
    <div className="flex min-h-24 flex-col gap-2">{tasks.map(task => <DraggableTask key={task.id} task={task} disabled={disabled} renderCard={renderCard} />)}</div>
  </section>
}

export function TaskKanban({ tasks, onStatusChange, renderCard }: { tasks: Task[]; onStatusChange: ChangeStatus; renderCard: (task: Task, handle: ReactNode) => ReactNode }) {
  const root = useRef<HTMLDivElement>(null)
  const drag = useRef<{ task: Task; change: ChangeStatus } | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const mounted = useRef(true)
  // The ref callback also guards asynchronous replies after a goal change/unmount.
  return <div ref={element => { root.current = element; mounted.current = !!element }}>
    <DragDropProvider onDragStart={event => {
      const task = tasks.find(task => task.id === event.operation.source?.id)
      drag.current = task ? { task: structuredClone(task), change: onStatusChange } : null
      setMessage('')
    }} onDragMove={(event, manager) => {
      if (!(event.nativeEvent instanceof KeyboardEvent) || !drag.current) return
      const direction = event.nativeEvent.key
      if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(direction)) return
      event.preventDefault()
      const current = (event.operation.target?.id ?? drag.current.task.status) as TaskStatus
      const next = statuses[statuses.indexOf(current) + (direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1)]
      const column = next && root.current?.querySelector<HTMLElement>(`[data-kanban-column="${next}"]`)
      if (!column) return
      column.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const bounds = column.getBoundingClientRect()
      manager.actions.move({ to: { x: bounds.x + bounds.width / 2, y: bounds.y + 50 }, propagate: false })
    }} onDragEnd={async event => {
      const started = drag.current
      drag.current = null
      const status = event.operation.target?.id
      if (!started || event.canceled || !statuses.includes(status as TaskStatus) || status === started.task.status || saving) return
      setSaving(true)
      try {
        const result = await started.change(started.task, status as TaskStatus)
        if (mounted.current) setMessage(result.ok ? `Moved “${started.task.title}” to ${status}. Active filters may hide it.` : result.message)
      } catch {
        if (mounted.current) setMessage('Unable to move this task. Try again.')
      } finally {
        if (mounted.current) {
          setSaving(false)
          requestAnimationFrame(() => {
            const card = [...(root.current?.querySelectorAll<HTMLElement>('[data-kanban-task]') ?? [])].find(card => card.dataset.kanbanTask === started.task.id)
            const fallback = root.current?.querySelector<HTMLElement>(`[data-kanban-column="${started.task.status}"] h3`)
            const focusTarget = card?.querySelector<HTMLButtonElement>('button') ?? fallback
            focusTarget?.focus()
          })
        }
      }
    }}>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3" data-task-view="kanban">{statuses.map(status => <Column key={status} status={status} tasks={tasks.filter(task => task.status === status)} disabled={saving} renderCard={renderCard} />)}</div>
    </DragDropProvider>
    <p className="sr-only">Use a task’s Move button: Space or Enter to pick up, arrow keys to move, Space or Enter to drop, Escape to cancel.</p>
    {message && <p role="status" className="mt-3 text-sm text-muted-foreground">{message}</p>}
  </div>
}
