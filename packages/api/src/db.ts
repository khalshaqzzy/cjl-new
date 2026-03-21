import { MongoClient, type ClientSession } from "mongodb"
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

export const disconnectDatabase = async () => {
  if (connected) {
    try {
      await client.close(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/client was closed|closed connection pool|operation interrupted/i.test(message)) {
        throw error
      }
    }
    connected = false
  }
}

export const getDatabase = () => client.db()
export const mongoClient = client

export const withMongoTransaction = async <T = void>(
  work: (session: ClientSession) => Promise<T>
) => {
  const session = client.startSession()

  try {
    let result!: T
    await session.withTransaction(async () => {
      result = await work(session)
    })

    return result
  } finally {
    await session.endSession()
  }
}
