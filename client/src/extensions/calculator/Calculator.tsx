import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { calculate } from './calculate'
export function Calculator() {
  const [expression, setExpression] = useState(''), [error, setError] = useState('')
  function evaluate(event?: FormEvent) { event?.preventDefault(); try { setExpression(String(calculate(expression))); setError('') } catch (failure) { setError(failure instanceof Error ? failure.message : 'Invalid expression.') } }
  function change(value: string) { setExpression(value.slice(0, 200)); setError('') }
  return <form className="space-y-3" aria-label="Calculator" onSubmit={evaluate}><Input aria-label="Calculator expression" value={expression} maxLength={200} placeholder="0" autoComplete="off" className="h-16! px-4 text-right text-3xl! font-medium tabular-nums" onChange={event => change(event.target.value)}/><div className="grid grid-cols-4 gap-2">{['C','(',')','÷','7','8','9','×','4','5','6','−','1','2','3','+','0','.','%','='].map(key => <Button key={key} type="button" variant={key === '=' ? 'default' : 'outline'} aria-label={key === 'C' ? 'Clear calculation' : key === '=' ? 'Calculate' : key} onClick={() => key === '=' ? evaluate() : change(key === 'C' ? '' : expression + key)}>{key}</Button>)}</div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<p className="text-xs text-muted-foreground">% divides by 100. Example: 200 × 10% = 20.</p></form>
}
