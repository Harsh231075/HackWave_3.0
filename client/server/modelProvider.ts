export function resolveProvider(env: NodeJS.ProcessEnv) {
  const provider = (env.MODEL_PROVIDER ?? (env.OPENAI_API_KEY && !env.GROQ_API_KEY ? 'openai' : 'groq')).toLowerCase()
  const responses = provider === 'openai' || provider === 'gateway'
  const keyName = provider === 'gateway' ? 'THESYS_API_KEY' : provider === 'ollama' ? 'OLLAMA (local)' : `${provider.toUpperCase()}_API_KEY`
  const base = ({ groq: 'https://api.groq.com/openai/v1', openai: 'https://api.openai.com/v1', gateway: 'https://api.thesys.dev/v1/embed', ollama: env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434/v1' } as Record<string, string>)[provider] ?? env[`${provider.toUpperCase()}_BASE_URL`] ?? ''
  return { provider, format: responses ? 'responses' as const : 'chat' as const, key: provider === 'ollama' ? 'ollama' : env[keyName], keyName, base,
    model: provider === 'gateway' ? env.THESYS_MODEL : provider === 'groq' ? env.GROQ_MODEL ?? 'qwen/qwen3.8-27b' : env[`${provider.toUpperCase()}_MODEL`] }
}
export class ProviderError extends Error {
  readonly status: number
  readonly code?: string
  constructor(status: number, message: string, code?:string) { super(message); this.status = status;this.code=code }
}
export async function modelText(env: NodeJS.ProcessEnv, instructions: string, input: Array<{ role: 'user' | 'assistant'; content: string }>, signal: AbortSignal, structured = false) {
  const config = resolveProvider(env)
  if (!config.key) throw new ProviderError(503, `${config.keyName} is not configured. Add it to client/.env.local and restart the server.`)
  if (!config.model) throw new ProviderError(503, `Set the model name for your chosen provider (${config.provider}) in client/.env.local.`)
  const chat = config.format === 'chat'
  const configuredBudget = Number(env.MODEL_STRUCTURED_MAX_TOKENS ?? 768)
  const structuredBudget = Number.isInteger(configuredBudget) && configuredBudget >= 256 && configuredBudget <= 8192 ? configuredBudget : 768
  const body = chat ? { model: config.model, messages: [{ role: 'system', content: instructions }, ...input], temperature: structured ? 0 : 0.6, max_tokens: structured ? structuredBudget : 2048, stream: false,
    ...(structured && ['groq', 'ollama'].includes(config.provider) ? { response_format: { type: 'json_object' } } : {}) } :
    { model: config.model, instructions, input, store: false, stream: false, ...(structured ? { max_output_tokens: structuredBudget } : {}), ...(structured && config.provider === 'openai' ? { text: { format: { type: 'json_object' } } } : {}) }
  const response = await fetch(`${config.base.replace(/\/$/, '')}/${chat ? 'chat/completions' : 'responses'}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` }, body: JSON.stringify(body), signal: AbortSignal.any([signal, AbortSignal.timeout(120_000)]),
  })
  if (!response.ok) {
    let detail = ''
    let code:string|undefined
    try { const error = await response.json() as { error?: { message?: string;code?:string } }; code=error.error?.code;if (error.error?.message) detail = `: ${error.error.message}` } catch { /* Provider may return a non-JSON error. */ }
    throw new ProviderError(response.status, `Model provider (${config.provider}) returned ${response.status}${detail || '. Check your model name and API key.'}`,code)
  }
  const result = await response.json() as { choices?: Array<{ message?: { content?: string } }>; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> }
  const text = chat ? result.choices?.[0]?.message?.content : result.output?.flatMap(item => item.content ?? []).filter(part => part.type === 'output_text').map(part => part.text ?? '').join('')
  if (!text?.trim()) throw new ProviderError(502, 'The model returned no output. Try again.')
  return text
}
