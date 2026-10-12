import { layoutVariantSchema } from '../../domain/widgetLayout.ts'
import { extensionIds } from '../contracts.ts'
import { z } from 'zod'
import type { BrowserDatabase } from '../../services/browserDatabase.ts'
import { createCollection } from '../../services/local/collection.ts'
export const pluginManifestSchema = z.strictObject({ layoutVariants: z.array(layoutVariantSchema).min(1).max(8).refine(variants=>variants.some(v=>v.version===1)&&new Set(variants.map(v=>v.version)).size===variants.length,'Provide unique layout versions including version 1.').optional(), version: z.literal(1), id: z.string().regex(/^[a-z][a-z0-9-]{2,63}$/), name: z.string().trim().min(1).max(80), description: z.string().trim().min(1).max(400), entry: z.string().regex(/^[a-zA-Z0-9_./-]+\.html$/).refine(value=>!value.startsWith('/')&&!value.split('/').includes('..'), 'Use an entry within the plugin folder.') })
export const importedPluginSchema = pluginManifestSchema.extend({ html: z.string().min(1).max(3_000_000), enabled: z.boolean(), importedAt: z.iso.datetime() })
export type ImportedPlugin = z.infer<typeof importedPluginSchema>
export interface PluginFile { name: string; webkitRelativePath?: string; size: number; type: string; text():Promise<string>; arrayBuffer():Promise<ArrayBuffer> }
const MAX_PACKAGE_BYTES = 2_000_000
export function createPluginImportService(database: BrowserDatabase) {
  const records = createCollection(database, 'importedPlugins', importedPluginSchema)
  return {
    list: records.list, getById: records.getById,
    setEnabled: (id: string, enabled: boolean) => records.update(id, {enabled}),
    remove: records.delete,
    async importFolder(files: PluginFile[]) {
      const epoch=database.getEpoch()
      try {
        if (!files.length || files.length > 100 || files.reduce((total,file)=>total+file.size,0) > MAX_PACKAGE_BYTES) throw new Error('Choose a plugin folder with at most 100 files and 2 MB total.')
        const manifests=files.filter(file=>file.name==='orlo-plugin.json')
        if(manifests.length!==1)throw new Error('The folder needs exactly one orlo-plugin.json manifest.')
        const manifestFile=manifests[0], path=manifestFile.webkitRelativePath||manifestFile.name, root=path.slice(0,-manifestFile.name.length)
        const manifest=pluginManifestSchema.parse(JSON.parse(await manifestFile.text()))
        if(extensionIds.some(id=>id===manifest.id))throw new Error('Use a plugin ID different from built-in extension IDs.')
        const entries=new Map(files.map(file=>[file.webkitRelativePath||file.name,file]))
        const entry=entries.get(root+manifest.entry);if(!entry)throw new Error('The manifest entry HTML file is missing.')
        let html=await entry.text()
        const entryRoot=(root+manifest.entry).slice(0,-entry.name.length)
        const references=[...html.matchAll(/\b(src|href)\s*=\s*(["'])([^"']+)\2/gi)]
        for(const match of references){
          const reference=match[3];if(reference.startsWith('#')||reference.startsWith('data:'))continue
          if(/^(?:[a-z]+:|\/\/|\/)/i.test(reference)||reference.split('/').includes('..'))throw new Error('Bundle plugin assets locally; remote URLs and parent paths are unsupported.')
          const asset=entries.get(entryRoot+reference.replace(/^\.\//,''));if(!asset)throw new Error(`Missing plugin asset: ${reference}`)
          const extension=asset.name.split('.').at(-1)?.toLowerCase(), mime=({js:'text/javascript',css:'text/css',svg:'image/svg+xml',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',woff2:'font/woff2'} as Record<string,string>)[extension??''];if(!mime)throw new Error('Use built HTML, JavaScript, CSS or image/font assets.')
          const bytes=new Uint8Array(await asset.arrayBuffer());let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte)
          html=html.replace(match[0],`${match[1]}=${match[2]}data:${mime};base64,${btoa(binary)}${match[2]}`)
        }
        if(epoch!==database.getEpoch())throw new Error('Local data changed during import. Choose the folder again.')
        if(records.getById(manifest.id))throw new Error('This plugin ID is already imported. Remove it before importing a replacement.')
        if(records.list().length>=10)throw new Error('Remove an imported plugin before adding another (maximum 10).')
        return records.save({...manifest,html,enabled:false,importedAt:new Date().toISOString()})
      } catch(error){return {ok:false as const,message:error instanceof z.ZodError?'Invalid manifest. Use version, id, name, description and entry as documented.':error instanceof Error?error.message:'Unable to import this folder.'}}
    },
  }
}
export function isolatedPluginDocument(html:string){return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' data:; style-src 'unsafe-inline' data:; img-src data:; font-src data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'">${html}`}
