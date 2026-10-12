// Reuse the actual frontend demo generator without mounting React or accessing browser storage.
import { createDemoSeedService } from '../../client/src/services/demoSeedService.ts'
const date=process.argv[2]
if(!/^\d{4}-\d{2}-\d{2}$/.test(date??''))throw new Error('Pass an ISO reference date.')
let snapshot={tasks:[],events:[],drafts:{},dismissed:[],activity:[]},collections={}
const database={
  getState:()=>snapshot,
  readCollection:key=>Object.hasOwn(collections,key)?{status:'found',value:collections[key]}:{status:'missing'},
  transaction:operation=>operation(),
  replaceRecords:value=>{snapshot=structuredClone(value);return {status:'saved'}},
  writeCollection:(key,value)=>{collections[key]=structuredClone(value);return {status:'saved'}},
}
let counter=0
const result=createDemoSeedService(database,()=>date,()=>`frontend-demo-v1-${String(++counter).padStart(4,'0')}`).seed()
if(!result.ok)throw new Error(result.message)
process.stdout.write(JSON.stringify({snapshot,collections}))
