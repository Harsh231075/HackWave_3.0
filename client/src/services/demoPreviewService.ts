import type { BrowserDatabase } from './browserDatabase.ts'
import { shiftDate } from '../domain/calendar.ts'
import type { Event, Task } from '../domain/types.ts'
export function addDemoPreview(database: BrowserDatabase, date: string) {
  let tasksAdded = 0, eventsAdded = 0
  database.transaction(() => {
    const state = database.getState()
    const tasks: Task[] = [
      { id:'demo-preview-task-1',title:'Demo · Prepare design review',description:'Collect notes before the design review.',owner:'Maya',due:date,duration:45,priority:'high',status:'pending' },
      { id:'demo-preview-task-2',title:'Demo · Send revised wireframes',description:'An overdue task for the priority view.',owner:'Arjun',due:shiftDate(date,-1),duration:30,priority:'urgent',status:'pending' },
      { id:'demo-preview-task-3',title:'Demo · Share project brief',description:'A completed sample task.',owner:'Maya',due:date,duration:15,priority:'low',status:'completed' },
    ]
    const events: Event[] = [
      {id:'demo-preview-event-1',title:'Demo · Design review',date,start:'11:00',end:'12:00',category:'meeting',participants:['Maya','Alex'],agenda:'Review designs, resolve questions, agree on next steps.'},
      {id:'demo-preview-event-2',title:'Demo · Client check-in',date:shiftDate(date,1),start:'14:00',end:'14:30',category:'meeting',participants:['Maya','Jordan'],agenda:'Review the delivery timeline.'},
      {id:'demo-preview-event-3',title:'Demo · Design preparation',date,start:'09:30',end:'10:15',category:'focus',participants:[],agenda:'Protected time to prepare the review.'},
    ]
    for (const task of tasks) if (!state.tasks.some(t=>t.id===task.id)) {database.dispatch({type:'task',task});tasksAdded++}
    for (const event of events) if (!state.events.some(e=>e.id===event.id)) {database.dispatch({type:'event',event});eventsAdded++}
    return { ok: true, value: { tasksAdded, eventsAdded } }
  })
  return {tasksAdded,eventsAdded,persistence:database.getPersistenceResult()}
}
