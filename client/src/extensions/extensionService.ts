import { createPluginImportService } from './external/importService.ts'
import type { BrowserDatabase } from '../services/browserDatabase.ts'
import type { ActionResult } from '../domain/commands.ts'
import { extensionSettingsSchema, type ExtensionId } from './contracts.ts'
import { extensionCatalog, capabilityAllowed } from './catalog.ts'
export function createExtensionService(database: BrowserDatabase) {
  const imported=createPluginImportService(database)
  const handlers = new Set<(id: ExtensionId) => void>()
  const getSettings = () => { const raw = database.readCollection('extensionSettings'); const parsed = extensionSettingsSchema.safeParse(raw.status === 'found' ? raw.value : { version: 1, enabled: [] }); const settings=parsed.success && raw.status !== 'invalid' ? parsed.data : { version: 1 as const, enabled: [] };return {...settings,enabled:[...settings.enabled.filter(id=>id!=='external-plugin'),...(imported.list().some(p=>p.enabled)?['external-plugin' as const]:[])]} }
  const isEnabled = (id: ExtensionId) => getSettings().enabled.includes(id)
  return {
    getSettings, isEnabled,
    isWidgetEnabled: (id: string) => capabilityAllowed(id, getSettings().enabled),
    getEnabledCapabilities: () => extensionCatalog.filter(item => isEnabled(item.id)),
    beforeDisable(handler: (id: ExtensionId) => void) { handlers.add(handler); return () => { handlers.delete(handler) } },
    setEnabled(id: ExtensionId, enabled: boolean): ActionResult<void> {
      if(id==='external-plugin')return {ok:false,message:'Enable individual imported plugins from Plugins.'}
      if (!extensionCatalog.some(item => item.id === id)) return { ok: false, message: 'Unknown extension.' }
      const raw = database.readCollection('extensionSettings')
      if (raw.status === 'invalid' || raw.status === 'found' && !extensionSettingsSchema.safeParse(raw.value).success) return { ok: false, message: 'Saved extension settings are invalid and have been preserved. Reset local data to repair them.' }
      try { if (!enabled) for (const handler of handlers) handler(id) } catch(error){return {ok:false,message:error instanceof Error?error.message:'Unable to stop the active extension.'}}
      const ids = new Set(getSettings().enabled.filter(item=>item!=='external-plugin')); if (enabled) ids.add(id); else ids.delete(id)
      const result = database.writeCollection('extensionSettings', { version: 1, enabled: [...ids] })
      return result.status === 'invalid' ? { ok: false, message: 'Extension settings could not be saved.' } : { ok: true, value: undefined }
    },
  }
}
export type ExtensionService = ReturnType<typeof createExtensionService>
