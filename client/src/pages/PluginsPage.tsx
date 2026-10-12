import { Upload, Trash2 } from 'lucide-react'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { ExternalPluginFrame } from '@/extensions/external/ExternalPlugin'
import { useRef, useState, useSyncExternalStore } from 'react'
import { browserDatabase, extensionService, pluginImportService } from '@/services'
import { extensionCatalog, extensionAvailable } from '@/extensions/catalog'
import { MailConnection, MailInbox } from '@/extensions/mail/MailWidgets'
import { QuickTimer } from '@/extensions/quick-timer/QuickTimer'
import { Calculator } from '@/extensions/calculator/Calculator'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ExtensionId } from '@/extensions/contracts'
import stopwatchMetadata from '@/extensions/stopwatch/metadata.json'
import whiteboardMetadata from '@/extensions/whiteboard/metadata.json'

export function PluginsPage() {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const [selected, setSelected] = useState<ExtensionId | null>(null), [error, setError] = useState(''), [pending, setPending] = useState<ExtensionId | null>(null)
  const folderInput = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false), [preview, setPreview] = useState<string | null>(null)
  const imported = pluginImportService.list()
  const builtins = extensionCatalog.filter(extension => extension.id !== 'external-plugin')
  const toggle = async (id: ExtensionId, enabled: boolean) => {
    if (pending) return
    setPending(id); const result = await extensionService.setEnabled(id, enabled)
    setError(result.ok ? '' : result.message); setPending(null)
  }
  return <main id="main-content" className="shared-page-content" tabIndex={-1}>
    <PageHeaderActions><Button size="sm" variant="outline" disabled={importing} onClick={() => folderInput.current?.click()}><Upload size={14}/>{importing ? 'Importing…' : 'Import plugin'}</Button></PageHeaderActions>
    <input ref={folderInput} type="file" multiple {...{ webkitdirectory: '' }} className="sr-only" aria-label="Import plugin folder" disabled={importing} onChange={async event => {
      const files = Array.from(event.target.files ?? []); event.target.value = ''
      if (!files.length) return
      setImporting(true)
      try { const result = await pluginImportService.importFolder(files); setError(result.ok ? '' : result.message) }
      catch (error) { setError(error instanceof Error ? error.message : 'Import failed.') }
      finally { setImporting(false) }
    }}/>
    <div className="grid items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-3">{builtins.map(extension => {
      const available = extensionAvailable(extension.id), enabled = extensionService.isEnabled(extension.id)
      return <section key={extension.id} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><ExtensionIcon svg={extension.iconSvg}/><h2 className="text-sm font-semibold">{extension.title}</h2></div>
        <button type="button" role="switch" aria-label={`Enable ${extension.title}`} aria-checked={enabled} disabled={!available || !!pending} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-40 ${enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`} onClick={() => void toggle(extension.id, !enabled)}><span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`}/></button></div>
        <p className="flex-1 text-sm leading-6 text-muted-foreground">{extension.description}</p>
        {!available && <p className="text-xs text-muted-foreground">Unavailable without file storage</p>}
        {extension.id === 'mail' && enabled && <MailConnection compact/>}
        <div className="flex min-h-8 justify-end">{enabled && <Button size="sm" variant="outline" onClick={() => setSelected(extension.id)}>Preview</Button>}</div>
      </section>
    })}</div>
    {imported.length > 0 && <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{imported.map(plugin => <section key={plugin.id} className="space-y-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3"><h2 className="text-sm font-semibold">{plugin.name}</h2><Button size="sm" variant="outline" onClick={async () => { const result = await pluginImportService.setEnabled(plugin.id, !plugin.enabled); setError(result.ok ? '' : result.message) }}>{plugin.enabled ? 'Disable' : 'Enable'}</Button></div>
      <p className="text-sm text-muted-foreground">{plugin.description}</p><div className="flex justify-end gap-2">{plugin.enabled && <Button size="sm" variant="outline" onClick={() => setPreview(plugin.id)}>Preview</Button>}<Button size="icon-sm" variant="ghost" aria-label={`Remove ${plugin.name}`} onClick={async () => { const result = await pluginImportService.remove(plugin.id); setError(result.ok ? '' : result.message) }}><Trash2 size={14}/></Button></div>
    </section>)}</div>}
    <Dialog open={!!preview} onOpenChange={open => { if (!open) setPreview(null) }}><DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>{imported.find(plugin => plugin.id === preview)?.name}</DialogTitle></DialogHeader>{preview && <ExternalPluginFrame id={preview}/>}</DialogContent></Dialog>
    <section className="mt-8 space-y-4" aria-label="Coming soon"><h2 className="text-sm font-medium text-muted-foreground">Coming soon</h2><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[stopwatchMetadata, whiteboardMetadata].map(plugin => <section key={plugin.name} className="space-y-4 rounded-xl border border-dashed border-border p-5"><div className="flex items-center gap-3"><ExtensionIcon svg={plugin.iconSvg}/><h3 className="text-sm font-semibold">{plugin.name}</h3></div><p className="text-sm text-muted-foreground">{plugin.description}</p></section>)}</div></section>
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
    <Dialog open={!!selected} onOpenChange={open => { if (!open) setSelected(null) }}><DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>{builtins.find(e => e.id === selected)?.title}</DialogTitle></DialogHeader>{selected === 'quick-timer' ? <QuickTimer standalone/> : selected === 'calculator' ? <Calculator/> : selected === 'mail' ? <MailInbox/> : null}</DialogContent></Dialog>
  </main>
}

function ExtensionIcon({ svg }: { svg: string }) {
  return <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted"><img src={'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)} alt="" aria-hidden="true" className="size-5" /></span>
}
