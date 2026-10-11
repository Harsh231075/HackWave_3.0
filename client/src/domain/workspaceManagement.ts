import { z } from 'zod'
import { widgetTypes } from '../lib/workspace/config.ts'
export const workspaceOperationSchema = z.discriminatedUnion('type', [
  z.object({type:z.literal('clear')}),
  z.object({type:z.literal('keep'),widgets:z.array(z.enum(widgetTypes)).min(1)}),
  z.object({type:z.literal('remove'),widgets:z.array(z.enum(widgetTypes)).min(1)}),
  z.object({type:z.literal('replace'),widgets:z.array(z.enum(widgetTypes)).min(1),with:z.array(z.enum(widgetTypes)).min(1)}),
  z.object({type:z.literal('move'),widget:z.enum(widgetTypes),relativeTo:z.enum(widgetTypes).optional(),position:z.enum(['before','after','first','last'])}),
  z.object({type:z.literal('resize'),widget:z.enum(widgetTypes),span:z.enum(['full','wide','narrow'])}),
  z.object({type:z.literal('add'),widgets:z.array(z.enum(widgetTypes)).min(1)}),
])
export type WorkspaceOperation=z.infer<typeof workspaceOperationSchema>
export const managementSchema=z.object({action:z.literal('manage'),operations:z.array(workspaceOperationSchema).min(1).max(20),reply:z.string().min(1).max(1000)})
export const destructiveGoal=(goal:string)=>!/(?:do not|dont|don't|never)\s+(?:remove|clear|delete|hide|replace|reset)/i.test(goal)&&/\b(remove|clear|delete|hide|replace|reset|keep only)\b|हटाओ|hatao|saaf karo/i.test(goal)
const aliases:Record<string,string[]>={metrics:['overview','summary','metrics'],tasks:['tasks','task','todo','deadlines','kaam'],timeline:['timeline','planner'],meetings:['meetings','meeting'],recommendation:['suggestions','suggestion','recommendations','recommendation'],outline:['notes','outline'],resources:['resources','documents'],context:['context','background'],calendar:['calendar','calender'],availability:['availability','free slots'],chart:['chart','productivity','progress'],activity:['activity'],usage:['usage'],communications:['messages','communications','emails'],issues:['issues','risks']}
export function namedWidgets(text:string):typeof widgetTypes[number][] {
  return widgetTypes.filter(id=>aliases[id].some(alias=>new RegExp('\\b'+alias+'\\b','i').test(text))).flatMap(id=>id==='metrics'&&/overview/i.test(text)?['metrics','tasks','timeline','meetings'] as typeof widgetTypes[number][]:[id]).filter((id,index,all)=>all.indexOf(id)===index)
}
export function localManagement(goal:string) {
 const text=goal.toLowerCase(), operations:WorkspaceOperation[]=[]
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
export function applyWorkspaceOperations<T extends {id:typeof widgetTypes[number];span:'full'|'wide'|'narrow'}>(items:T[],operations:WorkspaceOperation[],create:(id:T['id'])=>T):T[] {
 let result=[...items]
 for(const op of operations){
  if(op.type==='clear')result=[]
  else if(op.type==='keep')result=result.filter(item=>op.widgets.includes(item.id))
  else if(op.type==='remove')result=result.filter(item=>!op.widgets.includes(item.id))
  else if(op.type==='add'){for(const id of op.widgets)if(!result.some(item=>item.id===id))result.push(create(id))}
  else if(op.type==='replace'){if(!op.widgets.some(id=>result.some(item=>item.id===id)))throw new Error('The component to replace is not on this workspace.');const index=result.findIndex(item=>op.widgets.includes(item.id));result=result.filter(item=>!op.widgets.includes(item.id));const added=op.with.filter(id=>!result.some(item=>item.id===id)).map(create);result.splice(index,0,...added)}
  else if(op.type==='resize'){if(!result.some(item=>item.id===op.widget))throw new Error('Add that component before resizing it.');result=result.map(item=>item.id===op.widget?{...item,span:op.span}:item)}
  else {const index=result.findIndex(item=>item.id===op.widget);if(index<0)throw new Error('Add that component before moving it.');if(op.relativeTo===op.widget)continue;const item=result.splice(index,1)[0];let target=op.position==='first'?0:result.length;if(op.position==='before'||op.position==='after'){target=result.findIndex(item=>item.id===op.relativeTo);if(target<0)throw new Error('The target component is not on this workspace.');if(op.position==='after')target++}result.splice(target,0,item)}
 }
 return result
}
