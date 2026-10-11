import type { BrowserDatabase } from './browserDatabase.ts'
import type { CalendarEvent, CalendarConnection } from '../domain/calendar.ts'
import type { EventInput } from '../domain/commands.ts'
import type { Task } from '../domain/types.ts'
import { dayBounds, slotConflicts } from '../domain/plannerTime.ts'
import { createEventService } from './eventService.ts'
import { createAvailabilityService } from './availabilityService.ts'
export function createPlannerSchedulingService(database:BrowserDatabase, readEvents:(from:string,to:string,zone:string)=>Promise<{accountId:string;events:CalendarEvent[]}>, connection:()=>CalendarConnection|null) {
  async function verify(input:EventInput,timezone:string,isCurrent:()=>boolean=()=>true) {
    const original=connection(),account=original?.connected?original.accountId:undefined
    if(original?.connected&&!account)throw new Error('Refresh your Google Calendar connection before scheduling.')
    if(account){
      const window=dayBounds(input.date,timezone),latest=await readEvents(window.from,window.to,timezone)
      if(!isCurrent())throw new Error('This planning view changed. Reopen scheduling.')
      if(connection()?.accountId!==account||!connection()?.connected||latest.accountId!==account)throw new Error('Calendar account changed. Reopen scheduling.')
      if(slotConflicts(latest.events,input.date,input.start,input.end,timezone))throw new Error('This time is occupied in Google Calendar. Refresh and choose another slot.')
    }else if(connection()?.connected)throw new Error('Calendar connection changed. Reopen scheduling.')
    if(!isCurrent())throw new Error('This planning view changed. Reopen scheduling.')
  }
  return {verify,async schedule(task:Task,date:string,slot:{start:string;end:string},timezone:string,isCurrent:()=>boolean=()=>true){
    const id=`planner-focus:${task.id}:${date}`
    const input={projectId:task.projectId,title:`Focus: ${task.title.replace(/^Demo ·\s*/i,'')}`,date,...slot,category:'focus' as const,participants:[task.owner],agenda:`Dedicated work session for: ${task.title}. ${task.description}`}
    await verify(input,timezone,isCurrent)
    const current=database.getState().tasks.find(t=>t.id===task.id)
    if(!current||current.status!=='pending'||JSON.stringify(current)!==JSON.stringify(task))throw new Error('This task changed. Reopen scheduling.')
    const events=createEventService(database),existing=events.getById(id)
    if(existing)throw new Error('This task already has a focus block for this day.')
    const available=createAvailabilityService(database).findSlots({date,duration:task.duration,from:'09:00',to:'18:00',step:15}).some(s=>s.start===slot.start&&s.end===slot.end)
    if(!available)throw new Error('This local slot is no longer available. Choose another time.')
    const result=events.createWithId(id,input)
    if(!result.ok)throw new Error(result.message)
    return result.value
  }}
}
