import { createServer } from "node:http"

const graphApiBaseUrl = "http://127.0.0.1:4115"

const startWhatsappGraphStub = async () => {
  const server = createServer((req, res) => {
    const sendJson = (statusCode: number, payload: unknown) => {
      res.statusCode = statusCode
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify(payload))
    }

    if (req.headers.authorization !== "Bearer cjlaundry-e2e-whatsapp-access-token") {
      sendJson(401, { message: "Unauthorized" })
      return
    }

    if (req.method === "POST" && req.url === "/v25.0/1234567890/media") {
      sendJson(200, { id: "media-order-confirmed" })
      return
    }

    if (req.method === "POST" && req.url === "/v25.0/1234567890/messages") {
      let requestBody = ""
      req.on("data", (chunk) => {
        requestBody += chunk.toString()
      })
      req.on("end", () => {
        const payload = JSON.parse(requestBody || "{}") as {
          to?: string
        }

        sendJson(200, {
          contacts: [
            {
              input: payload.to,
              wa_id: payload.to,
            },
          ],
          messages: [
            {
              id: `wamid.${Date.now()}`,
            },
          ],
        })
      })
      return
    }

    if (req.method === "GET" && req.url === "/v25.0/cloud-media-image") {
      sendJson(200, {
        url: `${graphApiBaseUrl}/media/cloud-media-image/download`,
        mime_type: "image/jpeg",
        sha256: "provider-media-sha",
        file_size: 19,
      })
      return
    }

    if (req.method === "GET" && req.url === "/media/cloud-media-image/download") {
      res.statusCode = 200
      res.setHeader("Content-Type", "image/jpeg")
      res.end(Buffer.from("integration-media-01"))
      return
    }

    sendJson(404, { message: "Not found" })
  })

  await new Promise<void>((resolve) => {
    server.listen(4115, "127.0.0.1", () => resolve())
  })

  return server
}

const main = async () => {
  process.env.APP_ENV = process.env.APP_ENV ?? "test"
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
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? "cjlaundry-e2e-webhook-token"
  process.env.WHATSAPP_APP_SECRET =
    process.env.WHATSAPP_APP_SECRET ?? "cjlaundry-e2e-app-secret"
  process.env.WHATSAPP_PROVIDER = process.env.WHATSAPP_PROVIDER ?? "cloud_api"
  process.env.WHATSAPP_GRAPH_API_VERSION =
    process.env.WHATSAPP_GRAPH_API_VERSION ?? "v25.0"
  process.env.WHATSAPP_GRAPH_API_BASE_URL =
    process.env.WHATSAPP_GRAPH_API_BASE_URL ?? graphApiBaseUrl
  process.env.WHATSAPP_BUSINESS_ID =
    process.env.WHATSAPP_BUSINESS_ID ?? "biz_e2e"
  process.env.WHATSAPP_WABA_ID =
    process.env.WHATSAPP_WABA_ID ?? "waba_e2e"
  process.env.WHATSAPP_PHONE_NUMBER_ID =
    process.env.WHATSAPP_PHONE_NUMBER_ID ?? "1234567890"
  process.env.WHATSAPP_ACCESS_TOKEN =
    process.env.WHATSAPP_ACCESS_TOKEN ?? "cjlaundry-e2e-whatsapp-access-token"

  const { MongoMemoryReplSet } = await import("mongodb-memory-server")
  const mongo = await MongoMemoryReplSet.create({
    instanceOpts: [{
      port: 27019,
      dbName: "cjlaundry_e2e"
    }],
    replSet: {
      count: 1,
      storageEngine: "wiredTiger"
    }
  })
  process.env.MONGODB_URI = process.env.MONGODB_URI ?? mongo.getUri("cjlaundry_e2e")

  const { disconnectDatabase } = await import("../../packages/api/src/db.ts")
  const { startServer } = await import("../../packages/api/src/server.ts")
  const whatsappGraphStub = await startWhatsappGraphStub()

  const { server, stopBackgroundWork } = await startServer()
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
    await stopBackgroundWork()
    await disconnectDatabase()
    await new Promise<void>((resolve, reject) => {
      whatsappGraphStub.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
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
