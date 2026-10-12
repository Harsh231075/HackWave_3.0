import { connectLocalMongo, disconnectMongo } from '../src/database.ts'
import { seedFrontendDemo } from '../src/seed/frontend.ts'
try{
  await connectLocalMongo()
  console.log(JSON.stringify(await seedFrontendDemo(process.env.SEED_DATE),null,2))
}catch(error){console.error('Seed failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1}
finally{await disconnectMongo()}
