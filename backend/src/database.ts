import { mongoose, mongoModels } from './models/index.ts'
export async function connectLocalMongo(uri=process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/orlo_demo') {
  await mongoose.connect(uri,{serverSelectionTimeoutMS:5000})
  // Ensure the uniqueness declared in the model schemas is enforced before serving writes.
  await Promise.all(Object.values(mongoModels).map(model=>model.createIndexes()))
}
export async function disconnectMongo(){await mongoose.disconnect()}
