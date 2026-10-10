import { useState } from 'react'
import { ArrowUp, Command, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useWorkspace } from '@/state/WorkspaceProvider'

export function AiCommandBar() {
  const { state } = useWorkspace()
  const [prompt, setPrompt] = useState('')
  const suggestions = state.role === 'student' ? ['Plan my day', 'Prepare for my exam', 'Help with overdue work'] : state.role === 'teacher' ? ['Prepare tomorrow’s lesson', 'Organize my feedback', 'Plan my week'] : ['Prepare my client meeting', 'Review overdue work', 'Investigate usage']
  return <div className="command-bar"><div className="command-input"><Sparkles size={19} /><label htmlFor="intent-input" className="sr-only">Describe your goal (AI not connected)</label><input id="intent-input" placeholder="What would you like to make progress on?" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={1000} />{prompt && <Button variant="ghost" size="icon-sm" onClick={() => setPrompt('')} aria-label="Clear intent input"><X size={14} /></Button>}<span className="command-shortcut"><Command size={12} /> AI not connected</span><Button size="icon" disabled aria-label="Send goal — AI not connected"><ArrowUp size={16} /></Button></div><div className="command-suggestions"><span>Try a goal</span>{suggestions.map(suggestion => <button key={suggestion} onClick={() => setPrompt(suggestion)}>{suggestion}</button>)}</div></div>
}
