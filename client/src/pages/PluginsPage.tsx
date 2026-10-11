import { useState, useSyncExternalStore } from 'react'
import { Mic, Timer } from 'lucide-react'
import { browserDatabase, extensionService } from '@/services'
import { extensionCatalog } from '@/extensions/catalog'
import { QuickTimer } from '@/extensions/quick-timer/QuickTimer'
import { VoiceNote } from '@/extensions/voice-note/VoiceNote'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ExtensionId } from '@/extensions/contracts'
export function PluginsPage() {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const [selected, setSelected] = useState<ExtensionId | null>(null), [error, setError] = useState('')
  return <main id="main-content" className="shared-page-content" tabIndex={-1}><div className="grid gap-4 sm:grid-cols-2">{extensionCatalog.map(extension => { const enabled = extensionService.isEnabled(extension.id), Icon = extension.id === 'quick-timer' ? Timer : Mic; return <section key={extension.id} className="space-y-4 rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="inline-flex items-center gap-2 font-medium"><Icon size={18}/>{extension.title}</h2><button type="button" role="switch" aria-label={`Enable ${extension.title}`} aria-checked={enabled} className={`relative h-6 w-10 rounded-full transition-colors ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`} onClick={() => { const result = extensionService.setEnabled(extension.id, !enabled); setError(result.ok ? '' : result.message) }}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'left-0.5 translate-x-4' : 'left-0.5'}`}/></button></div><p className="text-sm text-muted-foreground">{extension.description}</p><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{enabled ? 'Enabled · available to AI' : 'Disabled'}</span><Button size="sm" variant="outline" disabled={!enabled} onClick={() => setSelected(extension.id)}>Try it</Button></div></section> })}</div>{error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}<Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent><DialogHeader><DialogTitle>{selected === 'quick-timer' ? 'Quick Timer' : 'Voice Note'}</DialogTitle></DialogHeader>{selected === 'quick-timer' ? <QuickTimer standalone/> : selected === 'voice-note' ? <VoiceNote/> : null}</DialogContent></Dialog></main>
}
