import { useState, type ReactNode } from 'react'
import { CheckCircle2, Inbox, LoaderCircle, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'

export type DisplayState = 'ready' | 'loading' | 'empty' | 'error'
export function DataState({ state = 'ready', children, empty = 'Nothing here yet. You have a little room to breathe.' }: { state?: DisplayState; children: ReactNode; empty?: string }) {
  if (state === 'loading') return <div className="space-y-4 p-5" aria-label="Loading" role="status"><Skeleton className="h-5 w-2/3" /><Skeleton className="h-4 w-full" /><Skeleton className="h-4 w-4/5" /></div>
  if (state === 'empty') return <div className="empty-state"><Inbox size={24} /><p>{empty}</p></div>
  if (state === 'error') return <div className="empty-state error-state" role="alert"><AlertCircle size={24} /><p>This demo view couldn’t load. Choose another state to continue.</p></div>
  return children
}
export function ConfirmationDialog({ open, onClose, title, description, before, after, onConfirm }: { open: boolean; onClose: () => void; title: string; description: string; before?: string; after?: string; onConfirm: () => void }) {
  return <Dialog open={open} onOpenChange={value => { if (!value) onClose() }}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader>{before && <div className="change-preview"><div><small>Before</small><p>{before}</p></div><div><small>After</small><p>{after}</p></div></div>}<DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={() => { onConfirm(); onClose() }}>Confirm change</Button></DialogFooter></DialogContent></Dialog>
}
export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: string }) { return <span className={`status-badge tone-${tone}`}>{children}</span> }
export function SaveFeedback({ saved }: { saved: boolean }) { return saved ? <span className="save-feedback"><CheckCircle2 size={14} /> Saved for this session</span> : null }
export function LoadingPreview() { const [loading, setLoading] = useState(false); return <Button variant="outline" onClick={() => setLoading(!loading)}>{loading && <LoaderCircle className="animate-spin" />} {loading ? 'Stop loading preview' : 'Preview loading'}</Button> }
