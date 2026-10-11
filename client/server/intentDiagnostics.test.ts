import {test} from 'node:test'
import assert from 'node:assert/strict'
import {resolveComponentIntent} from '../src/services/componentIntentService.ts'
import {safeIntentError} from './intentDiagnostics.ts'
const input={goal:'Show tasks',referenceDate:'2026-10-11',timezone:'Asia/Kolkata',catalog:{owners:[],draftKeys:[],topics:[]}}
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
