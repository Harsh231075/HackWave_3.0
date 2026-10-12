import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveComponentIntent} from '../client/src/services/componentIntentService.ts'
import {safeIntentError} from './intentDiagnostics.ts'
import type { ComponentRequest } from '../client/src/domain/componentIntent.ts'
const input={goal:'Show tasks',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:[],draftKeys:[],topics:[]}}
test('every enabled plugin uses the AI endpoint before keyword matching',async()=>{
 const cases:Array<[string,string,NonNullable<ComponentRequest['enabledExtensions']>]>=[
  ['Show my Gmail inbox','mail-inbox',['mail']],
  ['Compose an email','mail-compose',['mail']],
  ['Show email viewer','mail-message',['mail']],
  ['Show quick timer','quick-timer',['quick-timer']],
  ['Show voice note','voice-note',['voice-note']],
  ['Show calculator','calculator',['calculator']],
  ['Show imported plugin','external-plugin',['external-plugin']],
 ]
 const logs=await capture(async()=>{
  for(const [goal,widget,enabledExtensions] of cases){
   let calls=0
   const request={...input,goal,enabledExtensions,catalog:{...input.catalog,externalPlugins:[{id:'test-plugin',name:'Test Plugin',description:'A test tool'}]}}
   globalThis.fetch=async(url,options)=>{
    calls++
    assert.ok(String(url).endsWith('/api/workspace/resolve'))
    const body=JSON.parse(String(options?.body))
    assert.equal(body.goal,goal)
    assert.deepEqual(body.enabledExtensions,enabledExtensions)
    return Response.json({action:'view',widgets:[widget],bindings:widget==='external-plugin'?{externalPluginId:'test-plugin'}:{},reply:'Ready',referenceDate:input.referenceDate,timezone:input.timezone,source:'ai'})
   }
   const result=await resolveComponentIntent(request)
   assert.equal(calls,1,goal)
   assert.equal(result.source,'ai',goal)
   if(result.action==='view')assert.deepEqual(result.widgets,[widget])
   else assert.fail(`Expected a plugin view for ${goal}`)
  }
 })
 assert.equal(logs.length,0)
})
test('mail uses keyword fallback with diagnostics only after the AI endpoint fails',async()=>{
 let calls=0
 const logs=await capture(async()=>{
  globalThis.fetch=async()=>{calls++;throw new Error('offline')}
  const result=await resolveComponentIntent({...input,goal:'Compose an email',enabledExtensions:['mail']})
  assert.equal(result.source,'local')
  assert.equal(result.action,'view')
  if(result.action==='view')assert.deepEqual(result.widgets,['mail-compose'])
 })
 assert.equal(calls,1)
 assert.equal(logs.length,1)
 assert.equal((logs[0][1] as {reason:string}).reason,'network')
})
async function capture(run:()=>Promise<void>){const original=globalThis.fetch,warn=console.warn;const logs:unknown[][]=[];console.warn=(...args)=>{logs.push(args)};try{await run();return logs}finally{globalThis.fetch=original;console.warn=warn}}
test('server keyword fallback logs provider details once in browser without raw response data',async()=>{
 const logs=await capture(async()=>{globalThis.fetch=async()=>Response.json({action:'view',widgets:['tasks'],bindings:{},reply:'Tasks',referenceDate:input.referenceDate,timezone:input.timezone,source:'local',fallbackReason:'provider_error',fallbackMessage:'Provider rate limit. Try again in 5 seconds.',providerStatus:429,providerCode:'rate_limit_exceeded',apiKey:'do-not-log',prompt:'private prompt'});const result=await resolveComponentIntent(input);assert.equal(result.source,'local')})
 assert.equal(logs.length,1);assert.equal(logs[0][0],'[Orlo AI] Keyword fallback');assert.equal((logs[0][1] as {providerStatus:number}).providerStatus,429);assert.ok(!JSON.stringify(logs).includes('do-not-log'));assert.ok(!JSON.stringify(logs).includes('private prompt'))
})
test('AI success and user cancellation produce no keyword warning',async()=>{
 const logs=await capture(async()=>{globalThis.fetch=async()=>Response.json({action:'view',widgets:['tasks'],bindings:{},reply:'Tasks',referenceDate:input.referenceDate,timezone:input.timezone,source:'ai'});assert.equal((await resolveComponentIntent(input)).source,'ai');const controller=new AbortController();controller.abort();globalThis.fetch=async()=>{throw new DOMException('Cancelled','AbortError')};await assert.rejects(resolveComponentIntent(input,controller.signal))});assert.equal(logs.length,0)
})
test('network, HTTP and invalid output fallbacks explain the failure in console',async()=>{
 for(const [mode,reason] of [['network','network'],['http','http'],['invalid','client_validation']]){const logs=await capture(async()=>{globalThis.fetch=async()=>{if(mode==='network')throw new Error('offline');if(mode==='http')return Response.json({error:{message:'failure'}},{status:503});return Response.json({action:'view',widgets:['invented']})};assert.equal((await resolveComponentIntent(input)).source,'local')});assert.equal(logs.length,1);assert.equal((logs[0][1] as {reason:string}).reason,reason)}
})
test('provider errors redact configured secrets and bearer tokens',()=>{const message=safeIntentError(new Error('Failure with my-secret-key and Bearer some-token'),{GROQ_API_KEY:'my-secret-key'});assert.ok(!message.includes('my-secret-key'));assert.ok(!message.includes('some-token'));assert.ok(message.includes('[redacted]'))})
