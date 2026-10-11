import { ArrowUp, Mic, Square } from 'lucide-react'
import type { RefObject } from 'react'
import { Button } from '@/components/ui/button'
export function ConversationComposer({ value, onChange, onSubmit, pending, onStop, inputRef, speech }: {
  value: string; onChange: (value: string) => void; onSubmit: () => void; pending: boolean; onStop: () => void
  inputRef: RefObject<HTMLTextAreaElement | null>
  speech: { supported: boolean; listening: boolean; error: string; toggle: () => void; cancel: () => void }
}) {
  return <div className="shrink-0 border-t border-border/60 bg-background px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3 sm:px-8">
    <form className="mx-auto max-w-6xl rounded-2xl border border-border bg-card p-3 shadow-sm focus-within:border-ring" onSubmit={e => { e.preventDefault(); onSubmit() }} aria-label="Conversation input">
      <label className="sr-only" htmlFor="conversation-goal">Message Orlo</label>
      <textarea ref={inputRef} id="conversation-goal" rows={2} value={value} maxLength={4000} onChange={e => { speech.cancel(); onChange(e.target.value) }} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); if (!pending && value.trim()) e.currentTarget.form?.requestSubmit() } }} placeholder="Describe your next step or change this workspace…" className="max-h-40 min-h-12 w-full resize-none bg-transparent px-2 py-1 text-sm leading-6 text-foreground outline-none placeholder:text-muted-foreground" />
      <div className="flex items-center justify-between gap-3"><span className="px-2 text-xs text-muted-foreground" role="status">{speech.listening ? 'Listening… tap stop when you’re done.' : 'Shift + Enter for a new line · Ctrl / Cmd + K to focus'}</span><div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" size="icon" disabled={!speech.supported || pending || (!speech.listening && value.length >= 4000)} aria-label={speech.listening ? 'Stop speech input' : 'Speak your goal'} aria-pressed={speech.listening} title={speech.supported ? 'Speak your goal' : 'Speech input is unavailable in this browser'} onClick={speech.toggle}>{speech.listening ? <Square size={16} fill="currentColor" /> : <Mic size={18} />}</Button>
        {pending ? <Button type="button" size="icon" aria-label="Stop generation" onClick={onStop}><Square size={16} fill="currentColor" /></Button> : <Button type="submit" size="icon" disabled={!value.trim()} aria-label="Send message"><ArrowUp size={18} /></Button>}
      </div></div>
    </form>
    {speech.error && <p className="mx-auto mt-2 max-w-6xl text-xs text-destructive" role="alert">{speech.error}</p>}
  </div>
}
