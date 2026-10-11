import { useRef, useState, useSyncExternalStore } from 'react'
import { Calculator as CalculatorIcon, FolderUp, Mic, Puzzle, Presentation, Timer, TimerReset, Trash2 } from 'lucide-react'
import { browserDatabase, extensionService, pluginImportService } from '@/services'
import { extensionCatalog } from '@/extensions/catalog'
import { QuickTimer } from '@/extensions/quick-timer/QuickTimer'
import { VoiceNote } from '@/extensions/voice-note/VoiceNote'
import { Calculator } from '@/extensions/calculator/Calculator'
import { ExternalPluginFrame } from '@/extensions/external/ExternalPlugin'
import { PageHeaderActions } from '@/components/shell/PageHeaderActions'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import type { ExtensionId } from '@/extensions/contracts'
const comingSoonPlugins = [
  { name: 'Stopwatch', description: 'Measure elapsed time while you work.', icon: TimerReset },
  { name: 'Whiteboard', description: 'Sketch ideas and map out your plans.', icon: Presentation },
]

type Preview = {kind:'builtin';id:ExtensionId} | {kind:'imported';id:string}
export function PluginsPage() {
  useSyncExternalStore(browserDatabase.subscribe, browserDatabase.getRevision, browserDatabase.getRevision)
  const [selected, setSelected] = useState<Preview | null>(null), [error, setError] = useState(''), [notice,setNotice]=useState(''), [importing,setImporting]=useState(false), [removing,setRemoving]=useState<string|null>(null)
  const folder=useRef<HTMLInputElement>(null), builtins=extensionCatalog.filter(extension=>extension.id!=='external-plugin'), imported=pluginImportService.list()
  const title=selected?.kind==='imported'?pluginImportService.getById(selected.id)?.name:builtins.find(extension=>extension.id===selected?.id)?.title
  async function importFolder(files:File[]){if(importing||!files.length)return;setImporting(true);setError('');setNotice('');const result=await pluginImportService.importFolder(files);if(result.ok)setNotice(`${result.value.name} imported. Enable it when ready.${browserDatabase.getPersistenceResult().status==='saved'?'':' Kept for this session; device storage is unavailable.'}`);else setError(result.message);setImporting(false)}
  function toggle(id:ExtensionId,enabled:boolean){const result=extensionService.setEnabled(id,enabled);setError(result.ok?'':result.message)}
  return <main id="main-content" className="shared-page-content" tabIndex={-1}>
    <PageHeaderActions><Button size="sm" variant="outline" disabled={importing} onClick={()=>folder.current?.click()}><FolderUp size={14}/>{importing?'Importing…':'Import'}</Button></PageHeaderActions>
    <input ref={folder} aria-label="Import plugin folder" type="file" multiple hidden {...{webkitdirectory:'',directory:''}} onChange={event=>{const files=Array.from(event.target.files??[]);event.target.value='';void importFolder(files)}}/>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{builtins.map(extension=>{const enabled=extensionService.isEnabled(extension.id),Icon=extension.id==='quick-timer'?Timer:extension.id==='calculator'?CalculatorIcon:Mic;return <section key={extension.id} className="space-y-4 rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="inline-flex items-center gap-2 font-medium"><Icon size={18}/>{extension.title}</h2><PluginToggle name={extension.title} enabled={enabled} onToggle={()=>toggle(extension.id,!enabled)}/></div><p className="text-sm text-muted-foreground">{extension.description}</p><div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">{enabled?'Enabled · available to AI':'Disabled'}</span><Button size="sm" variant="outline" disabled={!enabled} onClick={()=>setSelected({kind:'builtin',id:extension.id})}>Try it</Button></div></section>})}
      {imported.map(plugin=><section key={plugin.id} className="space-y-4 rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="inline-flex items-center gap-2 font-medium"><Puzzle size={18}/>{plugin.name}</h2><PluginToggle name={plugin.name} enabled={plugin.enabled} onToggle={()=>{const result=pluginImportService.setEnabled(plugin.id,!plugin.enabled);setError(result.ok?'':result.message)}}/></div><p className="text-sm text-muted-foreground">{plugin.description}</p><div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{plugin.enabled?'Enabled · available to AI':'Imported · disabled'}</span><div className="flex gap-1"><Button size="sm" variant="outline" disabled={!plugin.enabled} onClick={()=>setSelected({kind:'imported',id:plugin.id})}>Try it</Button><Button size="icon-sm" variant="ghost" aria-label={`Remove ${plugin.name}`} onClick={()=>setRemoving(plugin.id)}><Trash2 size={14}/></Button></div></div></section>)}
      {comingSoonPlugins.map(plugin => <section key={plugin.name} className="space-y-4 rounded-xl border bg-card p-5"><div className="flex items-center justify-between gap-3"><h2 className="inline-flex items-center gap-2 font-medium"><plugin.icon size={18} aria-hidden="true"/>{plugin.name}</h2><span className="shrink-0 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">Coming soon</span></div><p className="text-sm text-muted-foreground">{plugin.description}</p></section>)}
    </div>
    {error&&<p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}{notice&&<p role="status" className="mt-4 text-sm text-muted-foreground">{notice}</p>}
    <Dialog open={!!selected} onOpenChange={open=>{if(!open)setSelected(null)}}><DialogContent><DialogHeader><DialogTitle>{title??'Plugin'}</DialogTitle></DialogHeader>{selected?.kind==='imported'?<ExternalPluginFrame id={selected.id}/>:selected?.id==='quick-timer'?<QuickTimer standalone/>:selected?.id==='voice-note'?<VoiceNote/>:selected?.id==='calculator'?<Calculator/>:null}</DialogContent></Dialog>
    <Dialog open={!!removing} onOpenChange={open=>{if(!open)setRemoving(null)}}><DialogContent><DialogHeader><DialogTitle>Remove {pluginImportService.getById(removing??'')?.name}?</DialogTitle></DialogHeader><p className="text-sm text-muted-foreground">Saved dashboard components will remain unavailable until this plugin is imported again.</p><div className="flex justify-end gap-2"><Button variant="outline" onClick={()=>setRemoving(null)}>Cancel</Button><Button variant="destructive" onClick={()=>{const result=pluginImportService.remove(removing!);if(result.ok){setRemoving(null);if(selected?.kind==='imported'&&selected.id===removing)setSelected(null)}else setError(result.message)}}>Remove plugin</Button></div></DialogContent></Dialog>
  </main>
}
function PluginToggle({name,enabled,onToggle}:{name:string;enabled:boolean;onToggle:()=>void}){return <button type="button" role="switch" aria-label={`Enable ${name}`} aria-checked={enabled} className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${enabled?'bg-primary':'bg-muted-foreground/30'}`} onClick={onToggle}><span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${enabled?'translate-x-4':''}`}/></button>}
