import { createBrowserStorage } from '../../client/src/services/local/browserStorage.ts'
import { createBrowserDatabase } from '../../client/src/services/browserDatabase.ts'
import { emptyRecords, freshLocalData } from '../../client/src/services/localDataService.ts'
import { createDemoSeedService } from '../../client/src/services/demoSeedService.ts'
export function localSetup(seed=false){
  const raw=new Map<string,string>(),storage=createBrowserStorage(()=>({getItem:key=>raw.get(key)??null,setItem:(key,value)=>{raw.set(key,value)},removeItem:key=>{raw.delete(key)}}))
  const database=createBrowserDatabase(storage,emptyRecords(),freshLocalData())
  if(seed){const result=createDemoSeedService(database,()=> '2026-10-11').seed();if(!result.ok)throw new Error(result.message)}
  return {database,storage,raw}
}
