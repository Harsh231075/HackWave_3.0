import { useSyncExternalStore } from 'react'
import { browserDatabase, pluginImportService } from '@/services'
import { useComponentView } from '@/state/ComponentViewContext'
import { isolatedPluginDocument } from './importService'
export function ExternalPluginFrame({id}:{id:string}){
  useSyncExternalStore(browserDatabase.subscribe,browserDatabase.getRevision,browserDatabase.getRevision)
  const plugin=pluginImportService.getById(id)
  if(!plugin?.enabled)return <p className="text-sm text-muted-foreground">This plugin is unavailable or disabled. Enable it in Plugins.</p>
  return <iframe title={plugin.name} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={isolatedPluginDocument(plugin.html)} className="h-96 w-full rounded-lg border-0 bg-white" allow="camera 'none'; microphone 'none'; geolocation 'none'; clipboard-read 'none'; clipboard-write 'none'"/>
}
export function ExternalPlugin(){
  useSyncExternalStore(browserDatabase.subscribe,browserDatabase.getRevision,browserDatabase.getRevision)
  const component=useComponentView(), id=component?.plan.bindings.externalPluginId
  const enabled=pluginImportService.list().filter(plugin=>plugin.enabled)
  const selected=id?pluginImportService.getById(id):enabled.length===1?enabled[0]:undefined
  return selected?<ExternalPluginFrame id={selected.id}/>:<p className="text-sm text-muted-foreground">Choose an enabled plugin by name using Ctrl + K.</p>
}
