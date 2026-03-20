const main = async () => {
  process.env.PORT = process.env.PORT ?? "4100"
  process.env.SESSION_SECRET = process.env.SESSION_SECRET ?? "cjlaundry-e2e-secret"
  process.env.SESSION_COOKIE_SECURE = process.env.SESSION_COOKIE_SECURE ?? "false"
  process.env.ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin"
  process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123"
  process.env.APP_TIMEZONE = process.env.APP_TIMEZONE ?? "Asia/Jakarta"
  process.env.ADMIN_ORIGIN = process.env.ADMIN_ORIGIN ?? "http://127.0.0.1:3101"
  process.env.PUBLIC_ORIGIN = process.env.PUBLIC_ORIGIN ?? "http://127.0.0.1:3100"
  process.env.API_ORIGIN = process.env.API_ORIGIN ?? "http://127.0.0.1:4100"
  process.env.WA_FAIL_MODE = process.env.WA_FAIL_MODE ?? "never"

  const { MongoMemoryServer } = await import("mongodb-memory-server")
  const mongo = await MongoMemoryServer.create({
    instance: {
      port: 27019,
      dbName: "cjlaundry_e2e"
    }
  })
  process.env.MONGODB_URI = process.env.MONGODB_URI ?? mongo.getUri("cjlaundry_e2e")

  const { disconnectDatabase } = await import("../../packages/api/src/db.ts")
  const { startServer } = await import("../../packages/api/src/server.ts")

  const { server } = await startServer()
  console.log(`CJ Laundry test API listening on ${process.env.PORT}`)

  const shutdown = async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
    await disconnectDatabase()
    await mongo.stop()
  }

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      shutdown()
        .then(() => process.exit(0))
        .catch((error) => {
          console.error(error)
          process.exit(1)
        })
    })
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
