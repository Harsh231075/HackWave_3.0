export function safeIntentError(failure:unknown,env:NodeJS.ProcessEnv):string {
 let message=failure instanceof Error?failure.message:'The AI request failed.'
 for(const [name,value] of Object.entries(env))if(/API_KEY|TOKEN|SECRET|PASSWORD/i.test(name)&&value)message=message.replaceAll(value,'[redacted]')
 return message.replace(/Bearer\s+\S+/gi,'Bearer [redacted]').replace(/\b(?:gsk_|sk-)[A-Za-z0-9_-]+/g,'[redacted]').slice(0,1500)
}
