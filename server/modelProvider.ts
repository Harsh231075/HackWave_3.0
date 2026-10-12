export function resolveProvider(env: NodeJS.ProcessEnv) {
  const base = (env.OPENAI_BASE_URL?.trim() || 'https://api.openai.com/v1').replace(/\/+$/, '')
  const format = env.MODEL_API_FORMAT?.trim() || 'chat'
  if (!['chat', 'responses'].includes(format)) throw new ProviderError(503, 'MODEL_API_FORMAT must be chat or responses.')
  try { const url = new URL(base); if (!['http:', 'https:'].includes(url.protocol) || url.search || url.hash || url.username || url.password) throw new Error() }
  catch { throw new ProviderError(503, 'Set a valid HTTP(S) OPENAI_BASE_URL without credentials, query parameters or fragments.') }
  return { format: format as 'chat' | 'responses', key: env.OPENAI_API_KEY, keyName: 'OPENAI_API_KEY', base, model: env.OPENAI_MODEL }
}
export class ProviderError extends Error {
  readonly status: number
  readonly code?: string
  constructor(status: number, message: string, code?:string) { super(message); this.status = status;this.code=code }
}
export async function modelText(env: NodeJS.ProcessEnv, instructions: string, input: Array<{ role: 'user' | 'assistant'; content: string }>, signal: AbortSignal, structured = false) {
  const config = resolveProvider(env)
  if (!config.key) throw new ProviderError(503, `${config.keyName} is not configured. Set it in the server environment and restart the server.`)
  if (!config.model) throw new ProviderError(503, `Set OPENAI_MODEL in the server environment.`)
  const chat = config.format === 'chat'
  const configuredBudget = Number(env.MODEL_STRUCTURED_MAX_TOKENS ?? 768)
  const structuredBudget = Number.isInteger(configuredBudget) && configuredBudget >= 256 && configuredBudget <= 8192 ? configuredBudget : 768
  const body = chat ? { model: config.model, messages: [{ role: 'system', content: instructions }, ...input], temperature: structured ? 0 : 0.6, max_tokens: structured ? structuredBudget : 2048, stream: false } :
    { model: config.model, instructions, input, store: false, stream: false, ...(structured ? { max_output_tokens: structuredBudget } : {}), ...(structured ? { text: { format: { type: 'json_object' } } } : {}) }
  const response = await fetch(`${config.base.replace(/\/$/, '')}/${chat ? 'chat/completions' : 'responses'}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` }, body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
  })
  if (!response.ok) {
    let detail = ''
    let code:string|undefined
    try { const error = await response.json() as { error?: { message?: string;code?:string } }; code=error.error?.code;if (error.error?.message) detail = `: ${error.error.message}` } catch { /* Provider may return a non-JSON error. */ }
    throw new ProviderError(response.status, `Model API returned ${response.status}${detail || '. Check your model name and API key.'}`,code)
  }
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  const text = chat ? result.choices?.[0]?.message?.content : result.output?.flatMap(item => item.content ?? []).filter(part => part.type === 'output_text').map(part => part.text ?? '').join('')
  if (!text?.trim()) throw new ProviderError(502, 'The model returned no output. Try again.')
  return text
}
