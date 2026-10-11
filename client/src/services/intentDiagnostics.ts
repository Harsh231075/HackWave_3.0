import { z } from 'zod'
const diagnosticsSchema=z.object({fallbackReason:z.string().max(160).optional(),fallbackMessage:z.string().max(1500).optional(),providerStatus:z.number().int().min(100).max(599).optional(),httpStatus:z.number().int().min(100).max(599).optional(),providerCode:z.string().max(160).optional(),validationFields:z.array(z.string().max(200)).max(50).optional(),validationIssues:z.array(z.object({path:z.string().max(200),message:z.string().max(500)})).max(50).optional()})
export function logKeywordFallback(value:unknown,defaults:{reason:string;message:string}){
 const parsed=diagnosticsSchema.safeParse(value)
 const d=parsed.success?parsed.data:{}
 console.warn('[Orlo AI] Keyword fallback',{
  reason:d.fallbackReason??defaults.reason,
  message:d.fallbackMessage??defaults.message,
  ...(d.providerStatus!==undefined?{providerStatus:d.providerStatus}:{}),
  ...(d.httpStatus!==undefined?{httpStatus:d.httpStatus}:{}),
  ...(d.providerCode?{providerCode:d.providerCode}:{}),
  ...(d.validationIssues?.length?{validationIssues:d.validationIssues}:d.validationFields?.length?{validationFields:d.validationFields}:{}),
 })
}
