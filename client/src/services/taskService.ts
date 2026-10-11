import { validProject } from './projectOwnership.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { prepareTask, type TaskInput, type ActionResult } from '../domain/commands.ts'
import { filterTasks, emptyFilters } from '../domain/workspace.ts'
import type { Filters, Task } from '../domain/types.ts'
export function createTaskService(database: BrowserDatabase, today: () => string, createId: () => string = () => crypto.randomUUID()) {
  const save = (input: TaskInput): ActionResult<Task> => {
    if (!validProject(database, input.projectId)) return { ok: false, message: 'Choose an available project.' }
    const result = prepareTask(input, database.getState(), createId)
    if (!result.ok) return result
    database.dispatch(result.value.action)
    return { ok: true, value: structuredClone(result.value.record) }
  }
  const getById = (id: string) => structuredClone(database.getState().tasks.find(task => task.id === id) ?? null)
  return {
    list: (filters: Partial<Filters> = {}) => structuredClone(filterTasks(database.getState().tasks, { ...emptyFilters(), ...filters }, today())),
    getById, save,
    create: (input: Omit<Task, 'id'>) => save(input),
    update(id: string, patch: Partial<Omit<Task, 'id'>>) { const task = getById(id); return task ? save({ ...task, ...patch, id }) : { ok: false as const, message: 'This task is no longer available.' } },
    delete(id: string): ActionResult<void> {
      if (!getById(id)) return { ok: false, message: 'This task is no longer available.' }
      database.dispatch({ type: 'delete-task', id })
      return { ok: true, value: undefined }
    },
    toggle(id: string): ActionResult<Task> {
      if (!getById(id)) return { ok: false, message: 'This task is no longer available.' }
      database.dispatch({ type: 'toggle', id })
      return { ok: true, value: getById(id)! }
    },
  }
}
