import { MongoClient } from "mongodb"
import { env } from "./env.js"

const client = new MongoClient(env.MONGODB_URI)
let connected = false

export const connectDatabase = async () => {
  if (!connected) {
    await client.connect()
    connected = true
  }

  return client.db()
}

export const getDatabase = () => client.db()
export const mongoClient = client
