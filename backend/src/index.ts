import { createServer } from 'node:http'
import { connectLocalMongo, disconnectMongo } from './database.ts'
import { createApiHandler } from './routes/api.ts'
const port=Number(process.env.PORT??4000)
if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535.')
try{
  await connectLocalMongo()
  const server=createServer(createApiHandler())
  server.listen(port,'127.0.0.1',()=>console.log(`Orlo demo backend: http://127.0.0.1:${port}/api/v1/health (local MongoDB, no frontend connection)`))
  const stop=()=>{server.close(()=>{void disconnectMongo().then(()=>process.exit(0))})}
  process.once('SIGINT',stop);process.once('SIGTERM',stop)
  server.on('error',error=>{console.error(error.message);void disconnectMongo().then(()=>process.exit(1))})
}catch(error){console.error('Local MongoDB connection failed:',error instanceof Error?error.message:'Unknown error');process.exitCode=1}
