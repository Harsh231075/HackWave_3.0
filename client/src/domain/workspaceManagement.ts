import { z } from 'zod'
import { widgetTypes } from '../lib/workspace/config.ts'
export const workspaceOperationSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('clear')}),
  z.object({type:z.literal('keep'),widgets:z.array(z.string().min(1).max(200)).min(1)}),
  z.object({type:z.literal('remove'),widgets:z.array(z.string().min(1).max(200)).min(1)}),
  z.object({type:z.literal('replace'),widgets:z.array(z.string().min(1).max(200)).min(1),with:z.array(z.enum(widgetTypes)).min(1)}),
  z.object({type:z.literal('move'),widget:z.string().min(1).max(200),relativeTo:z.string().min(1).max(200).optional(),position:z.enum(['before','after','first','last'])}),
  z.object({type:z.literal('resize'),widget:z.string().min(1).max(200),span:z.enum(['full','wide','narrow'])}),
  z.object({type:z.literal('add'),widgets:z.array(z.enum(widgetTypes)).min(1)}),
])
export type WorkspaceOperation=z.infer<typeof workspaceOperationSchema>
export const managementSchema=z.object({action:z.literal('manage'),operations:z.array(workspaceOperationSchema).min(1).max(20),reply:z.string().min(1).max(1000),source:z.enum(['ai','local']).optional()})
export const recordMutationGoal = (goal: string) => /\b(?:delete|remove)\s+(?:(?:the|a|an|my)\s+)?(?:event|record|task|meeting|appointment)\b/i.test(goal) && !/\b(card|widget|component|view|panel)\b/i.test(goal)
const removalWords=/\b(remove|clear|delete|hide|replace|reset|keep only|only keep|hatao|saaf karo)\b|हटाओ|हटा|साफ/i
export function destructiveGoal(goal:string){
  const text=goal.toLowerCase().replace(/[’‘]/g,"'").replace(/[’‘]/g,"'").trim()
  if(/\b(how|why|what happens|what would|explain|tell me|suppose|imagine)\b|\b(if|unless|in case)\b/.test(text))return false
  if(/\b(do not|don't|dont|never|without|avoid|not|mat|nahi|shouldn't|should not)\b|नहीं|मत/.test(text))return false
  return text.split(/\s+(?:and then|and|then)\s+|[,;]\s*/).some(clause=>{
    const command=clause.trim().replace(/^(?:(?:please|kindly|can you|could you|would you|i want you to|i want to|i would like you to|i would like to)\s+)+/,'')
    return /^(?:remove|clear|delete|hide|replace|reset|keep only|only keep)\b/.test(command)||/(?:hatao|हटाओ|saaf karo)\s*[.!]?$/i.test(command)
  })
}
export function authorizesClear(goal:string){
  if(!destructiveGoal(goal))return false
  return /\b(?:remove|clear|delete|reset)\s+(?:(?:all|everything)(?:\s+(?:components|cards|widgets|views))?|(?:(?:the|my|entire|whole)\s+)?workspace)\s*(?:[.!?]|$|and\b|then\b)/i.test(goal)
}
export const removalNeedsClarification=(goal:string)=>removalWords.test(goal)&&!destructiveGoal(goal)
const aliases:Record<string,string[]>={metrics:['overview','summary','metrics'],tasks:['tasks','task','todo','deadlines','kaam'],timeline:['timeline','planner'],meetings:['meetings','meeting'],recommendation:['suggestions','suggestion','recommendations','recommendation'],outline:['notes','outline'],resources:['resources','documents'],context:['context','background'],calendar:['calendar','calender'],availability:['availability','free slots'],chart:['chart','productivity','progress'],activity:['activity'],usage:['usage'],communications:['messages','communications','emails'],issues:['issues','risks']}
export function namedWidgets(text:string):typeof widgetTypes[number][] {
  return widgetTypes.filter(id=>aliases[id].some(alias=>new RegExp('\\b'+alias+'\\b','i').test(text))).flatMap(id=>id==='metrics'&&/overview/i.test(text)?['metrics','tasks','timeline','meetings'] as typeof widgetTypes[number][]:[id]).filter((id,index,all)=>all.indexOf(id)===index)
}
export function localManagement(goal:string) {
 const text=goal.toLowerCase().replace(/\s+(?:including pins|including pinned views|and pins|and pinned views)$/i,''), operations:WorkspaceOperation[]=[]
 if(recordMutationGoal(text)||removalNeedsClarification(text))return null
 if(/(?:do not|dont|don't|never)\s+(?:remove|clear|delete|hide|replace|reset)/i.test(text))return null
 const combined=text.split(/\s+(?:and|then|and then)\s+(?=(?:add|show|remove|clear|replace|move|hide)\b)/)
 if(combined.length>1){
   for(const clause of combined){const result=localManagement(clause);if(result)operations.push(...result.operations);else if(/^(?:add|show)\b/.test(clause)){const widgets=namedWidgets(clause);if(!widgets.length)return null;operations.push({type:'add',widgets})}else return null}
   return managementSchema.parse({action:'manage',operations,reply:'Workspace updated. Other components and their settings are kept.'})
 }
 const clear=text.match(/(?:remove|clear|delete|reset)\s+(?:all|everything|workspace)(?:\s+(?:components|cards|widgets))?(?:\s+(?:except|but)\s+(.+?))?(?=\s+and\s+(?:add|show)|$)/)
 if(clear){if(clear[1]){const widgets=namedWidgets(clear[1]);if(!widgets.length)return null;operations.push({type:'keep',widgets})}else operations.push({type:'clear'})
 const add=text.match(/\band\s+(?:add|show)(?:\s+me)?\s+(.+)$/);if(add){const widgets=namedWidgets(add[1]);if(!widgets.length)return null;operations.push({type:'add',widgets})}}
 else if(/^keep only\b/.test(text)){const widgets=namedWidgets(text);if(!widgets.length)return null;operations.push({type:'keep',widgets})}
 else if(/\breplace\b/.test(text)){const parts=text.split(/\bwith\b/);if(parts.length!==2)return null;const widgets=namedWidgets(parts[0]),withWidgets=namedWidgets(parts[1]);if(!widgets.length||!withWidgets.length)return null;operations.push({type:'replace',widgets,with:withWidgets})}
 else if(/^(?:please\s+)?(?:remove|hide|delete)\b/.test(text)){const widgets=namedWidgets(text);if(!widgets.length)return null;operations.push({type:'remove',widgets})}
 else if(/\b(move|put|reorder)\b/.test(text)){const parts=text.split(/\b(above|below|before|after)\b/);const widgets=namedWidgets(parts[0]);if(widgets.length!==1)return null;const relative=namedWidgets(parts[2]??'');const position=/top|first/.test(text)?'first':/bottom|last/.test(text)?'last':/above|before/.test(parts[1]??'')?'before':'after';if(!relative.length&&!['first','last'].includes(position))return null;operations.push({type:'move',widget:widgets[0],relativeTo:relative[0],position})}
 else if(/\b(wide|narrow|full width|resize)\b/.test(text)){const widgets=namedWidgets(text);if(widgets.length!==1)return null;operations.push({type:'resize',widget:widgets[0],span:/narrow/.test(text)?'narrow':/full/.test(text)?'full':'wide'})}
 return operations.length?managementSchema.parse({action:'manage',operations,reply:'Workspace updated. Other components and their settings are kept.'}):null
}
