import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { fallbackComponentIntent, componentViewSchema, validateComponentResolution, selectViewTasks, selectViewEvents, type ComponentRequest, type ComponentView } from '../client/src/domain/componentIntent.ts'
import { widgetTypes } from '../client/src/lib/workspace/config.ts'
import { componentIntentEndpoint } from './components.ts'
import type { Task, Event } from '../client/src/domain/types.ts'
const input: ComponentRequest={goal:'Show tasks',referenceDate:'2026-10-12',timezone:'Asia/Kolkata',catalog:{owners:['Alex','Maya'],draftKeys:['outline'],topics:['Statistics']}}
test('disabled plugins produce only an enable message, never unrelated choices',()=>{
 for(const [goal,title] of [['please render amil component i want sent email someone person','Mail'],['Show quick timer','Quick Timer'],['Show calculator','Calculator'],['Show voice note','Voice Note']]){
  const request={...input,goal}
  const result=fallbackComponentIntent(request)
  assert.equal(result.action,'clarify')
  if(result.action==='clarify'){assert.equal(result.question,`Enable ${title} in Plugins first.`);assert.deepEqual(result.choices,[])}
  const model=validateComponentResolution({action:'clarify',question:'Would you like a meeting instead?',choices:['Schedule a meeting','Show tasks'],source:'ai'},request)
  assert.equal(model.success,true)
  if(model.success && model.data.action==='clarify'){assert.deepEqual(model.data.choices,[]);assert.equal(model.data.question,`Enable ${title} in Plugins first.`);assert.equal(model.data.source,'ai')}
 }
})
test('clear email and task form requests cannot ask for form fields first',()=>{
 for(const goal of ['I want to send email someone person','please render amil component i want sent email someone person','Create a task','Add a task','Create a task for Bob','Create a new task tomorrow']){
  const request={...input,goal,enabledExtensions:['mail' as const]}
  const result=fallbackComponentIntent(request)
  assert.equal(result.action,'view',goal)
  if(result.action==='view')assert.deepEqual(result.widgets,[/email/.test(goal)?'mail-compose':'tasks'])
  assert.equal(validateComponentResolution({action:'clarify',question:'Who is the recipient or owner? What title?',choices:['Show meetings']},request).success,false)
 }
 const ambiguous={...input,goal:'Help me'}
 assert.equal(validateComponentResolution({action:'clarify',question:'Which view would you like?',choices:['Show tasks']},ambiguous).success,true)
 const sent=fallbackComponentIntent({...input,goal:'Show sent mail',enabledExtensions:['mail']})
 assert.equal(sent.action,'view')
 if(sent.action==='view'){assert.deepEqual(sent.widgets,['mail-inbox']);assert.equal(sent.bindings.mailFolder,'Sent')}
})
test('ambiguous sharing of time clarifies without removing workspace components',()=>{
 const goal='I want to send time is some person so please render a component'
 for(const enabledExtensions of [[],['mail']] as const){
  const request:ComponentRequest={...input,goal,enabledExtensions:[...enabledExtensions],workspaceWidgets:['tasks','meetings']}
  const result=fallbackComponentIntent(request)
  assert.equal(result.action,'clarify')
  if(result.action==='clarify'){
   assert.match(result.question,/email.*meeting times.*schedule/)
   assert.equal(result.choices.includes('Compose an email'),enabledExtensions.length>0)
  }
  for(const operation of [{type:'remove',widgets:['tasks']},{type:'keep',widgets:['meetings']},{type:'replace',widgets:['tasks'],with:['meetings']},{type:'clear'}]){
   const validated=validateComponentResolution({action:'manage',operations:[operation],reply:'Updated'},request)
   assert.equal(validated.success,false)
   if(!validated.success)assert.match(validated.error.issues[0].message,/not explicitly authorized/)
  }
 }
})
test('explicit email and availability requests retain their intended component',()=>{
 const email=fallbackComponentIntent({...input,goal:'Send my meeting time by email',enabledExtensions:['mail']})
 assert.equal(email.action,'view')
 if(email.action==='view')assert.deepEqual(email.widgets,['mail-compose'])
 const availability=fallbackComponentIntent({...input,goal:'Show available meeting times'})
 assert.notEqual(availability.action,'clarify')
})
test('unauthorized removal reports authorization before target mismatch',()=>{
 const result=validateComponentResolution({action:'manage',operations:[{type:'remove',widgets:['tasks']}],reply:'Updated'},{...input,goal:'Show my meetings'})
 assert.equal(result.success,false)
 if(!result.success)assert.equal(result.error.issues[0].message,'Component removal was not explicitly authorized.')
})
function view(goal:string,previous?:ComponentView){const result=fallbackComponentIntent({...input,goal,previous});assert.equal(result.action,'view',goal);return result as ComponentView}
const cases: Array<[string,string]>=[['What’s left to do?','tasks'],['Show my calendar','calendar'],['My appointments today','meetings'],['Daily timeline','timeline'],['Find free slots tomorrow','availability'],['Suggest my next step','recommendation'],['Show my draft notes','outline'],['Open Statistics resources','resources'],['Create a new resource','resource-create'],['Project background for Northstar','context'],['Statistics summary','metrics'],['How productive was I?','chart'],['Recent changes','activity'],['Show session usage','usage'],['Show messages','communications'],['Show open issues','issues']]
for(const [prompt,widget] of cases)test(`natural wording selects ${widget}: ${prompt}`,()=>assert.ok(view(prompt).widgets.includes(widget as typeof widgetTypes[number])))
test('fallback coverage includes every existing registered component',()=>assert.deepEqual(new Set(cases.map(([,id])=>id)),new Set(widgetTypes.filter(id=>!['quick-timer','voice-note','calculator','external-plugin','mail-inbox','mail-message','mail-compose'].includes(id)))))
for(const prompt of ['Show pending tasks','Mere pending kaam dikhao','मेरे लंबित कार्य दिखाओ'])test(`pending synonyms apply a real task filter: ${prompt}`,()=>{const result=view(prompt);assert.equal(result.bindings.taskFilters.status,'pending');assert.deepEqual(result.widgets,['tasks'])})
for(const prompt of ['What’s left today?','Show unfinished tasks today','Mere aaj ke incomplete kaam dikhao','आज के अधूरे काम दिखाओ'])test(`incomplete/today variations bind both filters: ${prompt}`,()=>{const result=view(prompt);assert.equal(result.bindings.taskFilters.status,'all');assert.deepEqual(result.bindings.taskStatuses,['pending','blocked']);assert.equal(result.bindings.taskFilters.from,'2026-10-12');assert.equal(result.bindings.taskFilters.to,'2026-10-12')})
test('overview composes relevant components and combined requests include only requested tools',()=>{
 assert.deepEqual(view('Show today’s overview').widgets,['metrics','tasks','timeline','meetings'])
 assert.deepEqual(view('Show calendar and pending tasks').widgets,['tasks','calendar'])
 assert.deepEqual(view('How many pending tasks?').widgets,['metrics'])
})
test('owner/priority/kanban and resource topics use supplied bindings',()=>{
 const result=view('Alex high priority tasks in kanban')
 assert.equal(result.bindings.owner,'Alex');assert.equal(result.bindings.taskFilters.priority,'high');assert.equal(result.bindings.taskView,'kanban')
 assert.equal(view('Statistics resources').bindings.resourceQuery,'Statistics')
})
test('follow-up only-blocked retains dates and a new tasks request clears old criteria',()=>{
 const previous=view('Show pending tasks today')
 const next=view('Only blocked',previous)
 assert.equal(next.bindings.taskFilters.status,'blocked');assert.equal(next.bindings.taskFilters.from,'2026-10-12')
 assert.equal(view('Show all tasks',previous).bindings.taskFilters.from,'')
})
test('date windows support tomorrow, week and ordered explicit ranges',()=>{
 assert.deepEqual(view('Tomorrow’s meetings').bindings.dateRange,{from:'2026-10-13',to:'2026-10-13'})
 assert.deepEqual(view('Calendar this week').bindings.dateRange,{from:'2026-10-12',to:'2026-10-18'})
 assert.deepEqual(view('Tasks from 2026-10-10 through 2026-10-12').bindings.dateRange,{from:'2026-10-10',to:'2026-10-12'})
 assert.equal(fallbackComponentIntent({...input,goal:'Tasks 2026-02-31'}).action,'clarify')
})
test('unknown/vague/ambiguous requests clarify instead of rendering arbitrary records',()=>{
 for(const goal of ['Help me','kal ke kaam','Tasks for Bob','Overdue tasks for tomorrow','Show today’s activity'])assert.equal(fallbackComponentIntent({...input,goal}).action,'clarify',goal)
})
test('specialized workflows remain separate from simple component listing',()=>{
 assert.equal(fallbackComponentIntent({...input,goal:'Prepare tomorrow’s meeting'}).action,'workflow')
 assert.equal(fallbackComponentIntent({...input,goal:'Schedule a meeting with Alex tomorrow'}).action,'workflow')
 assert.equal(fallbackComponentIntent({...input,goal:'Investigate a usage drop'}).action,'workflow')
 assert.equal(view('Show overdue tasks').action,'view')
})
const tasks:Task[]=[{id:'a',title:'Pending today',description:'',owner:'Alex',due:'2026-10-12',duration:30,priority:'high',status:'pending'},{id:'b',title:'Blocked today',description:'',owner:'Maya',due:'2026-10-12',duration:30,priority:'low',status:'blocked'},{id:'c',title:'Completed',description:'',owner:'Alex',due:'2026-10-12',duration:30,priority:'high',status:'completed'},{id:'d',title:'Old pending',description:'',owner:'Alex',due:'2026-10-10',duration:30,priority:'high',status:'pending'}]
test('task record selection applies date, status, priority and owner together',()=>{
 assert.deepEqual(selectViewTasks(tasks,view('Alex high priority pending tasks today')).map(t=>t.id),['a'])
 assert.deepEqual(selectViewTasks(tasks,view('What’s left today?')).map(t=>t.id),['a','b'])
 assert.deepEqual(selectViewTasks(tasks,view('Show overdue tasks today')).map(t=>t.id),['d'])
 assert.deepEqual(selectViewTasks(tasks,view('Pending and completed tasks today')).map(t=>t.id),['a','c'])
})
test('meeting dates filter actual events rather than changing only the heading',()=>{
 const base:Event={id:'a',title:'Meeting',date:'2026-10-12',start:'09:00',end:'10:00',category:'meeting',participants:[],agenda:''}
 assert.deepEqual(selectViewEvents([base,{...base,id:'b',date:'2026-10-13'},{...base,id:'c',category:'focus'}],view('Show today’s meetings')).map(e=>e.id),['a'])
})
test('unknown IDs, owner inventions, wrong dates and duplicate components fail validation',()=>{
 const good=view('Show tasks')
 assert.equal(validateComponentResolution({...good,bindings:{...good.bindings,owner:'Invented'}},input).success,false)
 assert.equal(validateComponentResolution({...good,referenceDate:'2030-01-01'},input).success,false)
 assert.equal(componentViewSchema.safeParse({...good,widgets:['tasks','tasks']}).success,false)
 assert.equal(componentViewSchema.safeParse({...good,widgets:['imaginary']}).success,false)
})
async function endpoint(goal:string,env:NodeJS.ProcessEnv={}){
 const req=Readable.from([Buffer.from(JSON.stringify({...input,goal}))]) as unknown as IncomingMessage
 req.method='POST';req.headers={'content-type':'application/json'}
 let status=0,text=''
 const res=Object.assign(new EventEmitter(),{writableEnded:false,writeHead(code:number){status=code},end(value:string){text=value;this.writableEnded=true}})
 await componentIntentEndpoint(req,res as unknown as ServerResponse,env)
 return {status,body:JSON.parse(text)}
}
test('no API key yields an operational local view instead of 503',async()=>{const result=await endpoint('Show pending tasks today');assert.equal(result.status,200);assert.equal(result.body.action,'view');assert.equal(result.body.source,'local')})
test('AI resolves a paraphrase and validated bindings survive the transport',async()=>{
 const original=globalThis.fetch
 try{globalThis.fetch=async(_url,options)=>{const body=JSON.parse(String(options?.body));assert.match(body.messages[0].content,/Hindi, Hinglish/);return Response.json({choices:[{message:{content:JSON.stringify({...view('Show unfinished tasks'),bindings:{taskFilters:{status:'all'},taskStatuses:['pending','blocked'],taskView:'kanban'},source:undefined})}}]})}
 const result=await endpoint('Bring up unfinished items as a compact board',{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'})
 assert.equal(result.body.source,'ai');assert.equal(result.body.bindings.taskFilters.status,'all');assert.deepEqual(result.body.bindings.taskStatuses,['pending','blocked']);assert.equal(result.body.bindings.taskView,'kanban')
 }finally{globalThis.fetch=original}
})
test('invalid AI output falls back without rendering invented components',async()=>{
 const original=globalThis.fetch
 try{globalThis.fetch=async()=>Response.json({choices:[{message:{content:'{"action":"view","widgets":["fake"]}'}}]})
 const result=await endpoint('Show calendar',{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'})
 assert.deepEqual(result.body.widgets,['calendar']);assert.equal(result.body.source,'local')
 }finally{globalThis.fetch=original}
})

test('AI cannot silently drop recognized today/Hinglish date constraints',()=>{
 const request={...input,goal:'Aaj ke pending tasks dikhao'}
 const result=fallbackComponentIntent(request)
 assert.equal(result.action,'view')
 if(result.action!=='view')return
 assert.equal(validateComponentResolution({...result,bindings:{...result.bindings,dateRange:undefined,taskFilters:{...result.bindings.taskFilters,from:'',to:''}}},request).success,false)
})

test('explicit combined commands resolve as ordered management operations',async()=>{
 const result=await endpoint('Remove everything except meetings and add tasks')
 assert.equal(result.status,200);assert.equal(result.body.action,'manage')
 assert.deepEqual(result.body.operations,[{type:'keep',widgets:['meetings']},{type:'add',widgets:['tasks']}])
})

test('AI is attempted first even for an exact keyword management command',async()=>{
 const original=globalThis.fetch;let calls=0
 try{globalThis.fetch=async()=>{calls++;return Response.json({choices:[{message:{content:JSON.stringify({action:'manage',operations:[{type:'clear'}],reply:'Workspace cleared.'})}}]})};const result=await endpoint('Remove all',{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'});assert.equal(calls,1);assert.equal(result.body.source,'ai');assert.equal(result.body.action,'manage')}finally{globalThis.fetch=original}
})
test('AI outage reports keyword source for management and clarification results',async()=>{
 const original=globalThis.fetch;let calls=0
 try{globalThis.fetch=async()=>{calls++;throw new Error('Provider down')};const env={OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'};const result=await endpoint('Remove all',env);assert.equal(calls,1);assert.equal(result.body.source,'local');assert.equal(result.body.action,'manage');const uncertain=await endpoint('How do I remove all',env);assert.equal(uncertain.body.source,'local');assert.equal(uncertain.body.action,'clarify')}finally{globalThis.fetch=original}
})
test('questions, negation and conditions never authorize a clear operation',()=>{
 const clear={action:'manage',operations:[{type:'clear'}],reply:'Cleared'}
 for(const goal of ['How do I remove all','If I remove all','I don’t want to remove all','I do not want to remove all','Never automatically remove all','calendar mat hatao','Show tasks with clear priorities','Remove suggestions']){assert.equal(validateComponentResolution(clear,{...input,goal}).success,false,goal);const local=fallbackComponentIntent({...input,goal});if(local.action==='manage')assert.equal(local.operations.some(op=>op.type==='clear'),false,goal)}
 assert.equal(validateComponentResolution(clear,{...input,goal:'Can you please remove all'}).success,true)
})
test('AI cannot remove a different named component than the user requested',()=>{assert.equal(validateComponentResolution({action:'manage',operations:[{type:'remove',widgets:['calendar']}],reply:'Removed'},{...input,goal:'Remove suggestions'}).success,false)})

test('valid AI date filters are normalized rather than silently discarded',async()=>{
 const original=globalThis.fetch
 try{globalThis.fetch=async()=>Response.json({choices:[{message:{content:JSON.stringify({action:'view',widgets:['tasks'],bindings:{taskFilters:{status:'pending',from:input.referenceDate,to:input.referenceDate}},reply:'Your pending tasks',referenceDate:input.referenceDate,timezone:input.timezone})}}]});const result=await endpoint('Show pending tasks today',{OPENAI_API_KEY:'test-only',OPENAI_MODEL:'test-model'});assert.equal(result.body.source,'ai');assert.deepEqual(result.body.bindings.dateRange,{from:input.referenceDate,to:input.referenceDate})}finally{globalThis.fetch=original}
})
test('equivalent timezone aliases preserve AI source but incompatible zones are rejected',async()=>{
 const {normalizeModelIntent}=await import('./componentModelIntent.ts')
 const request={...input,timezone:'Asia/Calcutta'},candidate={...view('Show tasks'),timezone:'Asia/Kolkata'}
 assert.equal(validateComponentResolution(normalizeModelIntent(candidate,request),request).success,true)
 assert.equal(validateComponentResolution(normalizeModelIntent({...candidate,timezone:'UTC'},request),request).success,false)
})
test('compact model context omits repeated saved clocks and default filters',async()=>{
 const {componentModelInput}=await import('./componentModelIntent.ts');const previous=view('Show tasks')
 const model=componentModelInput({...input,previous,componentPlans:[previous]})
 assert.equal(model.referenceDate,input.referenceDate);assert.equal(model.previous?.bindings.taskFilters&&Object.keys(model.previous.bindings.taskFilters).length,0)
 assert.equal('referenceDate' in model.previous!,false)
})
test('removed project/client scope is clarified and cannot be silently stripped from bindings',()=>{
 const input={goal:'Show tasks for project Alpha',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:[],draftKeys:[],topics:[]}}
 assert.equal(fallbackComponentIntent(input).action,'clarify')
 const output={action:'view',widgets:['tasks'],bindings:{},reply:'Tasks',referenceDate:input.referenceDate,timezone:input.timezone}
 assert.equal(validateComponentResolution(output,input).success,false)
 assert.equal(validateComponentResolution({...output,bindings:{projectId:'old'}},{...input,goal:'Show tasks'}).success,false)
})
