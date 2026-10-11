import { continuationChangeSchema } from './intentChanges.ts'
import type { IntentRequest } from './intent.ts'
/** Only explicit changes override the last validated goal. */
export function applyIntentContinuity(value: unknown, request: IntentRequest): unknown {
  if (!value || typeof value !== 'object') return value
  const response = value as Record<string, unknown>
  const scoped = response.scopeChanges as string[] | undefined
  const next = response.intent as Record<string, unknown> | undefined
  const compatibility = Array.isArray(scoped) && next ? { relationship: 'refinement', changes: Object.fromEntries(scoped.filter(field => ['dateRange', 'segment'].includes(field)).map(field => { const value = field === 'segment' ? (next.constraints as Record<string, unknown> | undefined)?.segment : next.dateRange; return [field, value === undefined ? { operation: 'clear' } : { operation: 'set', value }] })) } : undefined
  const declared = continuationChangeSchema.safeParse(request.continuation ?? response.continuation ?? compatibility)
  if(response.status !== 'resolved' || !request.previousIntent || request.clarificationAnswer || !declared.success || declared.data.relationship==='new_goal')return value
  const intent=structuredClone(request.previousIntent), constraints={...intent.constraints}
  for(const [field,patch] of Object.entries(declared.data.changes)){
    if(!['meetingId','dateRange','status','priority','segment','owner'].includes(field))return {version:2,requestId:request.requestId,originalGoal:request.goal,status:'unsupported',reason:'This workflow does not support that refinement.'}
    const key=field==='owner'?'ownerId':field
    if(['status','priority','segment','owner'].includes(field)){
      if(patch.operation==='clear'||patch.operation==='set'&&['all','overdue'].includes(String(patch.value)))Reflect.deleteProperty(constraints,key)
      else Object.assign(constraints,{[key]:patch.value})
    }else if(patch.operation==='clear')Reflect.deleteProperty(intent,field)
    else Object.assign(intent,{[field]:patch.value})
  }
  intent.constraints=constraints
  if(declared.data.changes.meetingId?.operation==='set'){
    const meeting=request.candidates.meetings.find(m=>m.id===intent.meetingId)
    if(meeting)intent.dateRange={from:meeting.date,to:meeting.date}
  }
  if (!intent.dateRange) return { version: 2, requestId: request.requestId, originalGoal: request.goal, status: 'needs_clarification', field: 'dateRange', question: 'Which dates should this goal use?', choices: [], partialIntent: intent }
  if(intent.goalType==='meeting_preparation'&&declared.data.changes.dateRange&&!declared.data.changes.meetingId){
    const meetings=request.candidates.meetings.filter(m=>m.date>=intent.dateRange?.from&&m.date<=intent.dateRange?.to)
    if(meetings.length===1)intent.meetingId=meetings[0].id
    else {
      delete intent.meetingId
      return meetings.length>1?{version:2,requestId:request.requestId,originalGoal:request.goal,status:'needs_clarification',field:'meetingId',question:'Which meeting?',choices:meetings.map(m=>({id:m.id,label:m.label})),partialIntent:intent}:{version:2,requestId:request.requestId,originalGoal:request.goal,status:'unsupported',reason:'No meetings match those dates.'}
    }
  }
  if (intent.goalType === 'meeting_preparation' && !intent.meetingId) {
    const meetings = request.candidates.meetings.filter(m => m.date >= intent.dateRange.from && m.date <= intent.dateRange.to)
    if (meetings.length === 1) intent.meetingId = meetings[0].id
    else return meetings.length > 1 ? { version: 2, requestId: request.requestId, originalGoal: request.goal, status: 'needs_clarification', field: 'meetingId', question: 'Which meeting?', choices: meetings.map(m => ({ id: m.id, label: m.label })), partialIntent: intent } : { version: 2, requestId: request.requestId, originalGoal: request.goal, status: 'unsupported', reason: 'No meetings match those dates.' }
  }
  return {...response,intent,continuation:declared.data}
}
