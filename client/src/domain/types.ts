export type Role = 'student' | 'teacher' | 'professional'
export type Priority = 'urgent' | 'high' | 'medium' | 'low'
export type TaskStatus = 'pending' | 'blocked' | 'completed'
export type Task = {
  id: string; role: Role; title: string; description: string; context: string
  owner: string; due: string; duration: number; priority: Priority; status: TaskStatus
}
export type Event = {
  id: string; role: Role; title: string; date: string; start: string; end: string
  category: 'meeting' | 'focus' | 'class' | 'break'; participants: string[]; agenda: string
}
export type Resource = { id: string; role: Role; title: string; kind: string; context: string; body: string }
export type Filters = { query: string; status: string; priority: string; context: string; sort: 'due' | 'priority'; from: string; to: string }
export type DomainSnapshot = { tasks: Task[]; events: Event[]; drafts: Record<string, string>; dismissed: string[]; activity: string[] }
export type WorkspaceState = DomainSnapshot & { role: Role; filters: Record<Role, Filters>; pins: Record<Role, string[]>; history: DomainSnapshot[] }
