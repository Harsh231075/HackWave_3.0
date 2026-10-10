import { useState, type ReactNode } from 'react'
import { CheckCircle2, Inbox, LoaderCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export type DisplayState = 'ready' | 'loading' | 'empty' | 'error'
export function DataState({ state = 'ready', children, empty = 'Nothing here yet. You have a little room to breathe.' }: { state?: DisplayState; children: ReactNode; empty?: string }) {
  if (state === 'loading') return <div className="space-y-4 p-5" aria-label="Loading" role="status"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
  if (state === 'empty') return <div className="flex flex-col items-center justify-center gap-2 [padding:2.5rem_1rem] text-center text-(--muted-foreground) text-[length:0.88rem]"><Inbox size={24} /><p>{empty}</p></div>
  if (state === 'error') return <div className="flex flex-col items-center justify-center gap-2 [padding:2.5rem_1rem] text-center text-(--muted-foreground) text-[length:0.88rem] error-state" role="alert"><AlertCircle size={24} /><p>This demo view couldn’t load. Choose another state to continue.</p></div>
  return children
}
export function ConfirmationDialog({ open, onClose, title, description, before, after, onConfirm }: { open: boolean; onClose: () => void; title: string; description: string; before?: string; after?: string; onConfirm: () => void }) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{before && <div className="grid grid-cols-2 gap-3 [margin:1rem_0] bg-(--muted) [border:1px_solid_var(--border)] rounded-[var(--radius)] p-3 text-[length:0.82rem] [&_small]:font-semibold [&_small]:text-(--muted-foreground) [&_small]:block [&_small]:mb-1"><div><small>Before</small><p>{before}</p></div><div><small>After</small><p>{after}</p></div></div>}<DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onConfirm(); onClose() }}>Confirm change</Button></DialogFooter></DialogContent></Dialog>
}
export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`text-[length:0.72rem] font-semibold capitalize [padding:0.15rem_0.55rem] rounded-full w-fit [&.tone-urgent]:[background:rgba(239,_68,_68,_0.15)] [&.tone-urgent]:[color:#ef4444] [&.tone-high]:[background:rgba(249,_115,_22,_0.15)] [&.tone-high]:[color:#f97316] [&.tone-medium]:[background:rgba(245,_158,_11,_0.15)] [&.tone-medium]:[color:#f59e0b] [&.tone-low]:[background:rgba(16,_185,_129,_0.15)] [&.tone-low]:[color:#10b981] [&.tone-neutral]:bg-(--muted) [&.tone-neutral]:text-(--muted-foreground) [&.tone-success]:[background:rgba(16,_185,_129,_0.15)] [&.tone-success]:[color:#10b981] [&.tone-warning]:[background:rgba(239,_68,_68,_0.15)] [&.tone-warning]:[color:#ef4444] tone-${tone}`}>{children}</span> }
export function SaveFeedback({ saved }: { saved: boolean }) { return saved ? <span className="inline-flex items-center [gap:0.35rem] text-[length:0.82rem] [color:#10b981] font-medium"><CheckCircle2 size={14} /> Saved for this session</span> : null }
export function LoadingPreview() { const [loading, setLoading] = useState(false); return <Button variant="outline" onClick={() => setLoading(!loading)}>{loading && <LoaderCircle className="animate-spin" />} {loading ? 'Stop loading preview' : 'Preview loading'}</Button> }
