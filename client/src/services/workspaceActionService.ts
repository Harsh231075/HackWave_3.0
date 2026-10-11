import { projectHasClient } from '../domain/projects.ts'
import { projectSettings } from './projectOwnership.ts'
import { createAdaptiveDataService } from './adaptiveDataService.ts'
import { workspaceCollectionKey, workspaceDocumentSchema } from '../domain/workspaceDocument.ts'
import { workspaceActionSchema, type ActionOrigin } from '../domain/workspaceActions.ts'
import { widgetBindingSchema } from '../domain/widgetInstances.ts'
import { adaptiveTaskSchema } from '../domain/adaptiveData.ts'
import { intentDateSchema } from '../domain/intent.ts'
import type { BrowserDatabase } from './browserDatabase.ts'
import { createPinService } from './pinService.ts'
import { loadActionScope } from './actionScope.ts'
import { createTaskService } from './taskService.ts'
import { createDraftService } from './draftService.ts'
import type { TaskInput, ActionResult } from '../domain/commands.ts'
import type { Task } from '../domain/types.ts'
export type PreparedWorkspaceAction =
  | { type: 'task.edit'; task: Task; origin: ActionOrigin }
  | { type: 'focus.schedule'; task: Task; date: string; origin: ActionOrigin }
  | { type: 'draft.edit'; key: string; label: string; fallback: string; expectedSaved: string | undefined; origin: ActionOrigin }
  | { type: 'goal.change'; goal: string; origin: ActionOrigin }
export function createWorkspaceActionService(database: BrowserDatabase) {
  function scope(origin: ActionOrigin) {
    if (!widgetBindingSchema.safeParse(origin.binding).success || !intentDateSchema.safeParse(origin.referenceDate).success || !Number.isInteger(origin.revision)) return null
    const saved = database.readCollection(workspaceCollectionKey)
    if (saved.status === 'found') {
      const parsed = workspaceDocumentSchema.safeParse(saved.value)
      if (!parsed.success || parsed.data.revision !== origin.revision) return null
      if (origin.instanceId) {
        const instance = [...parsed.data.active, ...parsed.data.pins].find(w => w.instanceId === origin.instanceId)
        if (!instance || JSON.stringify(instance.binding) !== JSON.stringify(origin.binding)) return null
      }
    }
    if (origin.pinId) {
      const pins = createPinService(database).loadPins()
      const pin = pins.status === 'found' ? pins.value.find(p => p.pinId === origin.pinId) : null
      if (!pin || JSON.stringify(pin.binding) !== JSON.stringify(origin.binding)) return null
    }
    return loadActionScope(database, origin.binding)
  }
  const taskService = createTaskService(database, () => '')
  const draftService = createDraftService(database)
  function checkTask(origin: ActionOrigin, expected: Task): ActionResult<Task> {
    const current = scope(origin)?.tasks.find(t => t.id === expected.id)
    return current && JSON.stringify(current) === JSON.stringify(expected) ? { ok: true, value: current } : { ok: false, message: 'Task changed or left this view. Reopen the editor to review it.' }
  }
  return {
    prepare(value: unknown, origin: ActionOrigin): ActionResult<PreparedWorkspaceAction> {
      const parsed = workspaceActionSchema.safeParse(value), data = scope(origin)
      if (!parsed.success || !data) return { ok: false, message: 'This action or its original records are unavailable.' }
      const action = parsed.data
      if (action.type === 'goal.change') return { ok: true, value: { ...action, origin } }
      if (action.type === 'draft.edit') return data.draft ? { ok: true, value: { type: action.type, ...data.draft, expectedSaved: database.getState().drafts[data.draft.key], origin } } : { ok: false, message: 'This view has no editable draft.' }
      const task = data.tasks.find(t => t.id === action.taskId)
      if (!task || !adaptiveTaskSchema.safeParse(task).success) return { ok: false, message: 'This task is no longer in the original view.' }
      if (action.type === 'focus.schedule') {
        if (task.status !== 'pending' || !Number.isInteger(task.duration)) return { ok: false, message: 'Resolve blockers before scheduling focus.' }
        const date = action.date ?? origin.referenceDate
        if (date < origin.referenceDate) return { ok: false, message: 'Choose a current or future focus date.' }
        return { ok: true, value: { type: action.type, task: structuredClone(task), date, origin } }
      }
      return { ok: true, value: { type: action.type, task: structuredClone(task), origin } }
    },
    checkTask,
    createTask(origin:ActionOrigin,input:TaskInput,projectId:string):ActionResult<Task>{
      if(input.id||!scope(origin)||origin.binding.kind==='google-calendar')return {ok:false,message:'This task creation view is unavailable.'}
      const data=createAdaptiveDataService(database),snapshot=data.snapshot(),project=snapshot?.projects.find(p=>p.id===projectId)
      const binding=origin.binding
      const clientId=binding.kind==='workspace'||binding.kind==='meeting'?binding.clientId:binding.kind==='usage'||binding.kind==='overdue'?binding.intent.clientId:binding.query.clientId
      const expectedProject=binding.kind==='workspace'||binding.kind==='meeting'?binding.projectId:binding.kind==='usage'||binding.kind==='overdue'?binding.intent.projectId:binding.query.projectId
      if(!project||(clientId&&!projectHasClient(project,clientId))||(expectedProject&&project.id!==expectedProject))return {ok:false,message:'Choose a project belonging to this view.'}
      return database.transaction(()=>{
        const result=taskService.save({...input,projectId});if(!result.ok)return result
        const linked=projectSettings(database) ? {ok:true as const,value:undefined} : data.relationships.create({sourceKind:'project',sourceId:project.id,targetKind:'task',targetId:result.value.id,type:'related'});if(!linked.ok)return linked
        if(binding.kind==='meeting'){const meetingLink=data.relationships.create({sourceKind:'meeting',sourceId:binding.meetingId,targetKind:'task',targetId:result.value.id,type:'related'});if(!meetingLink.ok)return meetingLink}
        return result
      })
    },
    saveTask(prepared: Extract<PreparedWorkspaceAction, { type: 'task.edit' }>, input: TaskInput): ActionResult<Task> {
      const checked = checkTask(prepared.origin, prepared.task)
      if (!checked.ok) return checked
      if (input.id !== prepared.task.id || !adaptiveTaskSchema.safeParse(input).success) return { ok: false, message: 'Enter valid task details.' }
      return taskService.save(input)
    },
    saveDraft(prepared: Extract<PreparedWorkspaceAction, { type: 'draft.edit' }>, value: string): ActionResult<void> {
      const draft = scope(prepared.origin)?.draft
      if (!draft || draft.key !== prepared.key || draft.fallback !== prepared.fallback || database.getState().drafts[draft.key] !== prepared.expectedSaved) return { ok: false, message: 'The saved draft or its scope changed. Reopen the editor; your unsaved text is kept.' }
      const result = draftService.save(draft.key, value)
      if (result.ok) prepared.expectedSaved = value
      return result
    },
  }
}
