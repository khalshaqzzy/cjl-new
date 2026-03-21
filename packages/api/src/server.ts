import type { Server } from "node:http"
import { createApp } from "./app.js"
import { connectDatabase } from "./db.js"
import { env } from "./env.js"
import { ensureSeedData } from "./seed.js"
import { startOutboxWorker, stopOutboxWorker } from "./services/common.js"

export const startServer = async () => {
  await connectDatabase()
  await ensureSeedData()
  startOutboxWorker()

  const app = createApp()
  const server = await new Promise<Server>((resolve) => {
    const instance = app.listen(env.PORT, () => resolve(instance))
  })

  return {
    app,
    server,
    stopBackgroundWork: async () => {
      const sessionStore = app.locals.sessionStore as { close?: () => Promise<void> | void } | undefined
      if (sessionStore?.close) {
        await sessionStore.close()
      }
      await stopOutboxWorker()
    }
  }
}
