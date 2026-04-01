import assert from "node:assert/strict"
import crypto from "node:crypto"
import test from "node:test"
import { createServer, type Server } from "node:http"
import bcrypt from "bcryptjs"
import { DateTime } from "luxon"
import { MongoMemoryReplSet } from "mongodb-memory-server"

const baseUrl = "http://127.0.0.1:4105"
const graphApiBaseUrl = "http://127.0.0.1:4115"

let mongo: MongoMemoryReplSet
let server: Server
let gatewayServer: Server
let getDatabase: (typeof import("../src/db.ts"))["getDatabase"]
let disconnectDatabase: (typeof import("../src/db.ts"))["disconnectDatabase"]
let stopBackgroundWork: (() => Promise<void>) | undefined
let ensureSeedData: (typeof import("../src/seed.ts"))["ensureSeedData"]
let parseEnv: (typeof import("../src/env.ts"))["parseEnv"]

const cloudApiControls = {
  lastMediaUpload: null as null | {
    mimeType?: string
    filename?: string
  },
  lastMessagePayload: null as null | {
    to?: string
    template?: {
      name?: string
      language?: {
        code?: string
      }
      components?: Array<Record<string, unknown>>
    }
  },
}

const startGatewayServer = async () => {
  gatewayServer = createServer(async (req, res) => {
    const sendJson = (statusCode: number, payload: unknown) => {
      res.statusCode = statusCode
      res.setHeader("Content-Type", "application/json")
      res.end(JSON.stringify(payload))
    }

    if (req.headers.authorization !== "Bearer integration-test-whatsapp-access-token") {
      sendJson(401, { message: "Unauthorized", code: "unauthorized" })
      return
    }

    if (req.method === "POST" && req.url === "/v25.0/1234567890/media") {
      cloudApiControls.lastMediaUpload = {
        mimeType: req.headers["content-type"],
        filename: "uploaded-receipt.pdf",
      }
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
          template?: {
            name?: string
            language?: {
              code?: string
            }
            components?: Array<Record<string, unknown>>
          }
        }
        cloudApiControls.lastMessagePayload = payload

        if (payload.to?.includes("00000")) {
          sendJson(400, {
            message: "Nomor tujuan belum terdaftar di WhatsApp",
            code: "unregistered_number",
          })
          return
        }

        sendJson(200, {
          contacts: [
            {
              input: payload.to,
              wa_id: payload.to,
            }
          ],
          messages: [
            {
              id: `wamid.${Date.now()}`,
            }
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
    gatewayServer.listen(4115, () => resolve())
  })
}

const requestJson = async (
  path: string,
  init?: RequestInit & { expectedStatus?: number }
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  })
  const expectedStatus = init?.expectedStatus ?? 200

  assert.equal(response.status, expectedStatus)

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  return {
    response,
    payload
  }
}

const waitFor = async <T>(
  work: () => Promise<T>,
  predicate: (value: T) => boolean,
  timeoutMs = 10_000
) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const value = await work()
    if (predicate(value)) {
      return value
    }

    await new Promise((resolve) => setTimeout(resolve, 100))
  }

  throw new Error("Timed out waiting for condition")
}

const signWhatsappWebhookPayload = (payload: unknown) => {
  const rawBody = JSON.stringify(payload)
  const secret = process.env.WHATSAPP_APP_SECRET ?? "integration-test-app-secret"
  const signature = `sha256=${crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("hex")}`

  return { rawBody, signature }
}

const requestText = async (
  path: string,
  init?: RequestInit & { expectedStatus?: number }
) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: init?.signal ?? AbortSignal.timeout(10_000),
  })
  const expectedStatus = init?.expectedStatus ?? 200
  assert.equal(response.status, expectedStatus)

  return {
    response,
    text: await response.text(),
  }
}

const extractCookieExpiry = (cookieHeader: string) => {
  const match = cookieHeader.match(/Expires=([^;]+)/i)
  assert.ok(match)
  return new Date(match[1])
}

const assertCookieLifetimeDays = (
  cookieHeader: string,
  minimumDays: number,
  maximumDays: number
) => {
  const expiresAt = extractCookieExpiry(cookieHeader)
  const diffDays = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  assert.ok(diffDays >= minimumDays, `cookie lifetime ${diffDays}d was shorter than ${minimumDays}d`)
  assert.ok(diffDays <= maximumDays, `cookie lifetime ${diffDays}d was longer than ${maximumDays}d`)
}

const extractMagicToken = (url: string) => {
  const parsed = new URL(url)
  return parsed.searchParams.get("token")
}

test.before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  })

  await startGatewayServer()

  process.env.PORT = "4105"
  process.env.APP_ENV = "test"
  process.env.MONGODB_URI = mongo.getUri("cjlaundry_api_test")
  process.env.SESSION_SECRET = "integration-test-secret"
  process.env.SESSION_COOKIE_SECURE = "false"
  process.env.ADMIN_USERNAME = "admin"
  process.env.ADMIN_PASSWORD = "admin123"
  process.env.APP_TIMEZONE = "Asia/Jakarta"
  process.env.ADMIN_ORIGIN = "http://127.0.0.1:3101"
  process.env.PUBLIC_ORIGIN = "http://127.0.0.1:3100"
  process.env.API_ORIGIN = "http://127.0.0.1:4100"
  process.env.WHATSAPP_PROVIDER = "cloud_api"
  process.env.WHATSAPP_ENABLED = "true"
  process.env.WHATSAPP_GRAPH_API_VERSION = "v25.0"
  process.env.WHATSAPP_GRAPH_API_BASE_URL = graphApiBaseUrl
  process.env.WHATSAPP_BUSINESS_ID = "biz_123"
  process.env.WHATSAPP_WABA_ID = "waba_123"
  process.env.WHATSAPP_PHONE_NUMBER_ID = "1234567890"
  process.env.WHATSAPP_ACCESS_TOKEN = "integration-test-whatsapp-access-token"
  process.env.WHATSAPP_APP_SECRET = "integration-test-app-secret"
  process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = "integration-test-webhook-token"
  process.env.WHATSAPP_WEBHOOK_PATH = "/v1/webhooks/meta/whatsapp"
  process.env.WHATSAPP_GATEWAY_TOKEN = "integration-test-whatsapp-token"
  process.env.WA_FAIL_MODE = "never"

  const envModule = await import("../src/env.ts")
  const dbModule = await import("../src/db.ts")
  const seedModule = await import("../src/seed.ts")
  const serverModule = await import("../src/server.ts")

  parseEnv = envModule.parseEnv
  getDatabase = dbModule.getDatabase
  disconnectDatabase = dbModule.disconnectDatabase
  ensureSeedData = seedModule.ensureSeedData

  const started = await serverModule.startServer()
  server = started.server
  stopBackgroundWork = started.stopBackgroundWork
})

test.after(async () => {
  if (server) {
    server.closeAllConnections?.()
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }

  await stopBackgroundWork?.()
  await disconnectDatabase()
  if (gatewayServer) {
    gatewayServer.closeAllConnections?.()
    await new Promise<void>((resolve, reject) => {
      gatewayServer.close((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })
  }
  await mongo.stop()
})

test("backend integration flow covers auth, transactions, idempotency, outbox states, throttling, and archived leaderboard rebuilds", async () => {
  let result = await requestJson("/v1/admin/dashboard", { expectedStatus: 401 })
  assert.equal(result.payload.message, "Unauthorized")
  assert.equal(result.payload.error.code, "authentication_required")
  assert.ok(result.payload.error.requestId)
  assert.equal(result.payload.error.requestId, result.response.headers.get("x-request-id"))

  result = await requestJson("/v1/public/me/dashboard", { expectedStatus: 401 })
  assert.equal(result.payload.message, "Unauthorized")

  result = await requestJson("/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  })
  assert.equal(result.payload.ok, true)
  const adminCookie = result.response.headers.get("set-cookie")
  assert.ok(adminCookie)
  assertCookieLifetimeDays(adminCookie, 6.5, 7.5)

  const seededAdminBefore = await getDatabase().collection("admins").findOne({ _id: "admin-primary" })
  assert.ok(seededAdminBefore)
  assert.equal(seededAdminBefore.username, "admin")
  assert.notEqual(seededAdminBefore.passwordHash, "admin123")
  assert.equal(seededAdminBefore.passwordHash.startsWith("$2"), true)
  assert.equal(await bcrypt.compare("admin123", seededAdminBefore.passwordHash), true)

  await getDatabase().collection("admins").updateOne(
    { _id: "admin-primary" },
    {
      $set: {
        username: "stale-admin",
        passwordHash: await bcrypt.hash("stale-password", 10),
      }
    }
  )

  await ensureSeedData()

  const seededAdmins = await getDatabase().collection("admins").find({ _id: "admin-primary" }).toArray()
  assert.equal(seededAdmins.length, 1)
  assert.equal(seededAdmins[0].username, "admin")
  assert.notEqual(seededAdmins[0].passwordHash, seededAdminBefore.passwordHash)
  assert.equal(await bcrypt.compare("admin123", seededAdmins[0].passwordHash), true)

  const initialSettings = await requestJson("/v1/admin/settings", {
    headers: { Cookie: adminCookie! }
  })

  const multiContactSettings = {
    ...initialSettings.payload,
    business: {
      ...initialSettings.payload.business,
      laundryPhone: "081333333333",
      publicContactPhone: "081444444444",
      publicWhatsapp: "087703122004",
      adminWhatsappContacts: [
        { id: "admin-1", phone: "+62 81111111111", isPrimary: false },
        { id: "admin-2", phone: "082222222222", isPrimary: true }
      ],
      address: "Jl. Integration No. 45, Bandung"
    }
  }

  result = await requestJson("/v1/admin/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify(multiContactSettings)
  })
  assert.equal(result.payload.business.adminWhatsappContacts.length, 2)
  assert.equal(result.payload.business.laundryPhone, "081333333333")
  assert.equal(result.payload.business.publicContactPhone, "082222222222")
  assert.equal(result.payload.business.publicWhatsapp, "087703122004")
  assert.equal(result.payload.business.adminWhatsappContacts[0].phone, "081111111111")
  assert.equal(result.payload.business.adminWhatsappContacts[1].isPrimary, true)
  assert.equal(result.payload.business.address, "Jl. Integration No. 45, Bandung")

  result = await requestJson("/v1/public/landing")
  assert.equal(result.payload.laundryInfo.phone, "082222222222")
  assert.equal(result.payload.laundryInfo.whatsapp, "6282222222222")
  assert.equal(result.payload.laundryInfo.address, "Jl. Integration No. 45, Bandung")

  const fallbackSettings = {
    ...multiContactSettings,
    business: {
      ...multiContactSettings.business,
      publicContactPhone: "",
      publicWhatsapp: "",
      adminWhatsappContacts: []
    }
  }

  result = await requestJson("/v1/admin/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify(fallbackSettings)
  })
  assert.equal(result.payload.business.adminWhatsappContacts.length, 1)
  assert.equal(result.payload.business.adminWhatsappContacts[0].phone, "087780563875")
  assert.equal(result.payload.business.adminWhatsappContacts[0].isPrimary, true)

  result = await requestJson("/v1/public/landing")
  assert.equal(result.payload.laundryInfo.phone, "087780563875")
  assert.equal(result.payload.laundryInfo.whatsapp, "6287780563875")

  result = await requestJson("/v1/admin/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify(multiContactSettings)
  })

  const uniqueSuffix = Date.now().toString().slice(-6)
  const customerName = `Budi Integration ${uniqueSuffix}`
  const upperCustomerName = customerName.toUpperCase()
  const customerPhone = `08123${uniqueSuffix}`

  const createCustomerKey = `create-${uniqueSuffix}`
  result = await requestJson("/v1/admin/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": createCustomerKey
    },
    body: JSON.stringify({ name: customerName, phone: customerPhone })
  })

  assert.equal(result.payload.duplicate, false)
  assert.equal(result.payload.customer.name, upperCustomerName)
  assert.equal(result.payload.customer.phone, `+62${customerPhone.slice(1)}`)
  assert.match(result.payload.oneTimeLogin.url, /\/auto-login\?token=/)
  const registrationMagicToken = extractMagicToken(result.payload.oneTimeLogin.url)
  assert.ok(registrationMagicToken)

  const createCustomerReplay = await requestJson("/v1/admin/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": createCustomerKey
    },
    body: JSON.stringify({ name: customerName, phone: customerPhone })
  })
  assert.equal(createCustomerReplay.payload.customer.customerId, result.payload.customer.customerId)

  const customerId = result.payload.customer.customerId as string

  result = await requestJson(`/v1/admin/customers/${customerId}/magic-link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({})
  })
  assert.match(result.payload.oneTimeLogin.url, /\/auto-login\?token=/)
  assert.notEqual(result.payload.oneTimeLogin.url, createCustomerReplay.payload.oneTimeLogin.url)
  const regeneratedMagicToken = extractMagicToken(result.payload.oneTimeLogin.url)
  assert.ok(regeneratedMagicToken)

  let magicLinkRedeem = await requestJson("/v1/public/auth/magic-link/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: regeneratedMagicToken })
  })
  assert.equal(magicLinkRedeem.payload.ok, true)
  assert.equal(magicLinkRedeem.payload.session.customerId, customerId)
  const regeneratedMagicCookie = magicLinkRedeem.response.headers.get("set-cookie")
  assert.ok(regeneratedMagicCookie)
  assertCookieLifetimeDays(regeneratedMagicCookie, 29, 31)

  magicLinkRedeem = await requestJson("/v1/public/auth/magic-link/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: regeneratedMagicToken }),
    expectedStatus: 401
  })
  assert.match(magicLinkRedeem.payload.message, /tidak valid/i)

  magicLinkRedeem = await requestJson("/v1/public/auth/magic-link/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: registrationMagicToken })
  })
  assert.equal(magicLinkRedeem.payload.ok, true)
  assert.equal(magicLinkRedeem.payload.session.customerId, customerId)
  const registrationMagicCookie = magicLinkRedeem.response.headers.get("set-cookie")
  assert.ok(registrationMagicCookie)
  assertCookieLifetimeDays(registrationMagicCookie, 29, 31)

  result = await waitFor(
    () => requestJson("/v1/admin/notifications", { headers: { Cookie: adminCookie! } }),
    (value) =>
      value.payload.some(
        (notification: {
          eventType: string
          customerName: string
          deliveryStatus: string
          providerMessageId?: string
        }) =>
          notification.eventType === "welcome" &&
          notification.customerName === upperCustomerName &&
          notification.deliveryStatus === "sent" &&
          Boolean(notification.providerMessageId)
      )
  )
  assert.ok(result.payload.length > 0)
  const welcomeNotification = result.payload.find(
    (notification: { eventType: string; customerName: string }) =>
      notification.eventType === "welcome" && notification.customerName === upperCustomerName
  )
  assert.doesNotMatch(welcomeNotification.preparedMessage, /auto-login\?token=/)
  assert.match(welcomeNotification.preparedMessage, /Nomor terdaftar:/)
  assert.match(welcomeNotification.preparedMessage, new RegExp(customerPhone))
  assert.doesNotMatch(welcomeNotification.preparedMessage, new RegExp(`\\+62${customerPhone.slice(1)}`))

  result = await requestJson(`/v1/admin/customers/${customerId}/points`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({ points: 20, reason: "Bonus integration" })
  })
  assert.equal(result.payload.profile.currentPoints, 20)

  const firstOrderPayload = {
    customerId,
    weightKg: 3,
    redeemCount: 1,
    items: [
      { serviceCode: "washer", quantity: 2, selected: true },
      { serviceCode: "dryer", quantity: 2, selected: true },
      { serviceCode: "detergent", quantity: 0, selected: false },
      { serviceCode: "softener", quantity: 0, selected: false },
      { serviceCode: "wash_dry_fold_package", quantity: 0, selected: false },
      { serviceCode: "ironing", quantity: 0, selected: false }
    ]
  }

  result = await requestJson("/v1/admin/orders/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify(firstOrderPayload)
  })
  assert.equal(result.payload.earnedStamps, 2)
  assert.equal(result.payload.redeemedPoints, 10)
  assert.equal(result.payload.total, 30000)
  assert.equal(result.payload.resultingPointBalance, 12)

  const confirmKey = `confirm-${uniqueSuffix}`
  const confirmFirst = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": confirmKey
    },
    body: JSON.stringify(firstOrderPayload)
  })
  const confirmFirstReplay = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": confirmKey
    },
    body: JSON.stringify(firstOrderPayload)
  })
  assert.equal(confirmFirst.payload.order.orderCode, confirmFirstReplay.payload.order.orderCode)

  const confirmMismatch = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": confirmKey
    },
    body: JSON.stringify({ ...firstOrderPayload, weightKg: 4 }),
    expectedStatus: 409
  })
  assert.match(confirmMismatch.payload.message, /Idempotency-Key/)

  const firstOrderId = confirmFirst.payload.order.orderId as string
  const firstOrderToken = confirmFirst.payload.directToken as string

  result = await requestJson(`/v1/admin/customers/${customerId}`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.profile.currentPoints, 12)

  result = await requestJson("/v1/public/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: customerPhone, name: customerName })
  })
  assert.equal(result.payload.ok, true)
  const publicCookie = result.response.headers.get("set-cookie")
  assert.ok(publicCookie)
  assertCookieLifetimeDays(publicCookie, 29, 31)

  result = await requestJson("/v1/public/me/dashboard", {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(result.payload.session.customerId, customerId)
  assert.equal(result.payload.session.name, upperCustomerName)
  assert.equal(result.payload.session.publicNameVisible, false)
  assert.equal(result.payload.adminWhatsappContacts.length, 2)
  assert.equal(result.payload.adminWhatsappContacts[0].phone, "081111111111")
  assert.equal(result.payload.adminWhatsappContacts[1].phone, "082222222222")
  assert.equal(result.payload.adminWhatsappContacts[1].isPrimary, true)
  assert.ok(result.payload.activeOrders.some((order: { orderId: string }) => order.orderId === firstOrderId))
  const refreshedPublicCookie = result.response.headers.get("set-cookie")
  assert.ok(refreshedPublicCookie)
  assertCookieLifetimeDays(refreshedPublicCookie, 29, 31)

  result = await requestJson(`/v1/public/status/${firstOrderToken}`)
  assert.equal(result.payload.status, "Active")
  assert.equal("totalLabel" in result.payload, false)
  assert.equal(result.payload.laundryPhone, "082222222222")

  result = await requestJson(`/v1/public/me/orders/${firstOrderId}`, {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(result.payload.status, "Active")
  assert.match(result.payload.totalLabel, /30\.000/)
  assert.equal(result.payload.items.length, 2)
  assert.equal(result.payload.items[0].unitPriceLabel.startsWith("Rp"), true)

  result = await waitFor(
    () => requestJson("/v1/admin/notifications", { headers: { Cookie: adminCookie! } }),
    (value) =>
      value.payload.some(
        (notification: {
          eventType: string
          orderCode?: string
          deliveryStatus: string
          receiptAvailable: boolean
          manualWhatsappAvailable: boolean
          providerMessageId?: string
          providerStatus?: string
          waId?: string
          providerChatId?: string
          sentAt?: string
        }) =>
          notification.eventType === "order_confirmed" &&
          notification.orderCode === confirmFirst.payload.order.orderCode &&
          notification.deliveryStatus === "sent" &&
          notification.receiptAvailable === true &&
          notification.manualWhatsappAvailable === false &&
          Boolean(notification.providerMessageId) &&
          notification.providerStatus === "accepted" &&
          Boolean(notification.waId) &&
          Boolean(notification.sentAt)
      )
  )
  const confirmNotification = result.payload.find(
    (notification: { eventType: string; orderCode?: string }) =>
      notification.eventType === "order_confirmed" &&
      notification.orderCode === confirmFirst.payload.order.orderCode
  )
  assert.ok(confirmNotification)
  assert.equal(cloudApiControls.lastMessagePayload?.template?.name, "cjl_order_confirmed_v1")
  assert.equal(cloudApiControls.lastMessagePayload?.template?.language?.code, "id")
  assert.equal(cloudApiControls.lastMessagePayload?.to, `62${customerPhone.slice(1)}`)
  assert.equal(cloudApiControls.lastMediaUpload?.filename, "uploaded-receipt.pdf")

  let receiptResponse = await fetch(`${baseUrl}/v1/admin/notifications/${confirmNotification.notificationId}/receipt`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(receiptResponse.status, 200)
  assert.match(receiptResponse.headers.get("content-type") ?? "", /image\/png/)
  assert.match(receiptResponse.headers.get("content-disposition") ?? "", /\.png/)
  const adminReceiptBeforeSettingsUpdate = Buffer.from(await receiptResponse.arrayBuffer())
  assert.ok(adminReceiptBeforeSettingsUpdate.byteLength > 0)

  const liveReceiptSettings = {
    ...multiContactSettings,
    business: {
      ...multiContactSettings.business,
      laundryPhone: "081555555555",
      address: "Jl. Receipt Live No. 88, Surabaya"
    }
  }

  result = await requestJson("/v1/admin/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify(liveReceiptSettings)
  })
  assert.equal(result.payload.business.laundryPhone, "081555555555")
  assert.equal(result.payload.business.address, "Jl. Receipt Live No. 88, Surabaya")

  receiptResponse = await fetch(`${baseUrl}/v1/public/me/orders/${firstOrderId}/receipt`, {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(receiptResponse.status, 200)
  assert.match(receiptResponse.headers.get("content-type") ?? "", /application\/pdf/)
  const publicReceiptPdf = Buffer.from(await receiptResponse.arrayBuffer())
  assert.ok(publicReceiptPdf.byteLength > 0)
  const publicReceiptPdfText = publicReceiptPdf.toString("latin1")
  assert.match(publicReceiptPdfText, /303831353535353535353535/)
  assert.match(publicReceiptPdfText, /52656365697074204c6976/)
  assert.match(publicReceiptPdfText, /4a6c2e/)

  receiptResponse = await fetch(`${baseUrl}/v1/admin/notifications/${confirmNotification.notificationId}/receipt`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(receiptResponse.status, 200)
  assert.match(receiptResponse.headers.get("content-type") ?? "", /image\/png/)
  const adminReceiptAfterSettingsUpdate = Buffer.from(await receiptResponse.arrayBuffer())
  assert.ok(adminReceiptAfterSettingsUpdate.byteLength > 0)
  assert.notDeepEqual(adminReceiptAfterSettingsUpdate, adminReceiptBeforeSettingsUpdate)

  result = await requestJson("/v1/public/leaderboard")
  assert.equal(result.payload.rows[0].isMasked, true)
  assert.notEqual(result.payload.rows[0].displayName, upperCustomerName)

  result = await requestJson("/v1/public/me/preferences/name-visibility", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: publicCookie!
    },
    body: JSON.stringify({ publicNameVisible: true })
  })
  assert.equal(result.payload.session.publicNameVisible, true)

  result = await requestJson("/v1/public/leaderboard")
  assert.equal(result.payload.rows[0].rank, 1)
  assert.equal(result.payload.rows[0].displayName, upperCustomerName)
  assert.equal(result.payload.rows[0].isMasked, false)

  result = await requestJson("/v1/admin/whatsapp/status", {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.provider, "cloud_api")
  assert.equal(result.payload.state, "ready")
  assert.equal(result.payload.configured, true)
  assert.equal(result.payload.enabled, true)
  assert.equal(result.payload.phoneNumberId, "1234567890")
  assert.equal(result.payload.webhookPath, "/v1/webhooks/meta/whatsapp")

  result = await requestJson("/v1/admin/whatsapp/chats", {
    headers: { Cookie: adminCookie! }
  })
  assert.ok(result.payload.length >= 1)

  const webhookChallenge = await requestText(
    "/v1/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=integration-test-webhook-token&hub.challenge=challenge-123"
  )
  assert.equal(webhookChallenge.text, "challenge-123")

  await requestText(
    "/v1/webhooks/meta/whatsapp?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=challenge-123",
    { expectedStatus: 403 }
  )

  const inboundWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+62 877 8056 3875",
                phone_number_id: "1234567890",
              },
              contacts: [
                {
                  profile: { name: upperCustomerName },
                  wa_id: `62${customerPhone.slice(1)}`,
                },
              ],
              messages: [
                {
                  from: `62${customerPhone.slice(1)}`,
                  id: `wamid.inbound.text.${uniqueSuffix}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: {
                    body: "Halo dari webhook Meta",
                  },
                },
                {
                  from: `62${customerPhone.slice(1)}`,
                  id: `wamid.inbound.image.${uniqueSuffix}`,
                  timestamp: String(Math.floor(Date.now() / 1000) + 1),
                  type: "image",
                  image: {
                    id: "cloud-media-image",
                    mime_type: "image/jpeg",
                    sha256: "provider-media-sha",
                    caption: "Foto cucian terbaru",
                    file_size: 19,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  }

  const invalidWebhookSignature = signWhatsappWebhookPayload({
    object: "whatsapp_business_account",
  })
  await requestJson("/v1/webhooks/meta/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": `${invalidWebhookSignature.signature}tampered`,
    },
    body: invalidWebhookSignature.rawBody,
    expectedStatus: 401,
  })

  const signedInboundWebhook = signWhatsappWebhookPayload(inboundWebhookPayload)
  result = await requestJson("/v1/webhooks/meta/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signedInboundWebhook.signature,
    },
    body: signedInboundWebhook.rawBody,
  })
  assert.equal(result.payload.ok, true)

  result = await requestJson("/v1/webhooks/meta/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signedInboundWebhook.signature,
    },
    body: signedInboundWebhook.rawBody,
  })
  assert.equal(result.payload.ok, true)

  const inboundCloudTextMessage = await waitFor(
    async () =>
      getDatabase().collection("whatsapp_messages").findOne({
        _id: `wamid.inbound.text.${uniqueSuffix}`,
      }),
    (message) => Boolean(message),
  )
  assert.equal(inboundCloudTextMessage?.source, "inbound_customer")

  const inboundCloudImageMessage = await waitFor(
    async () =>
      getDatabase().collection("whatsapp_messages").findOne({
        _id: `wamid.inbound.image.${uniqueSuffix}`,
      }),
    (message) => message?.mediaDownloadStatus === "downloaded",
  )
  assert.equal(inboundCloudImageMessage?.providerMediaId, "cloud-media-image")
  assert.equal(inboundCloudImageMessage?.mediaStorageId?.length !== 0, true)

  const inboundReceiptCount = await getDatabase()
    .collection("whatsapp_webhook_receipts")
    .countDocuments({
      kind: "inbound_message",
      providerMessageId: `wamid.inbound.text.${uniqueSuffix}`,
    })
  assert.equal(inboundReceiptCount, 1)

  const inboundMediaResponse = await fetch(
    `${baseUrl}/v1/admin/whatsapp/messages/${encodeURIComponent(`wamid.inbound.image.${uniqueSuffix}`)}/media`,
    {
      headers: { Cookie: adminCookie! },
    }
  )
  assert.equal(inboundMediaResponse.status, 200)
  assert.match(inboundMediaResponse.headers.get("content-type") ?? "", /image\/jpeg/)
  const inboundMediaBuffer = Buffer.from(await inboundMediaResponse.arrayBuffer())
  assert.equal(inboundMediaBuffer.toString("utf8"), "integration-media-01")

  const templateLifecyclePayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_123",
        changes: [
          {
            field: "message_template_status_update",
            value: {
              message_template_id: "template-order-confirmed",
              message_template_name: "cjl_order_confirmed_v1",
              event: "APPROVED",
            },
          },
        ],
      },
    ],
  }
  const signedTemplateLifecycle = signWhatsappWebhookPayload(templateLifecyclePayload)
  await requestJson("/v1/webhooks/meta/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signedTemplateLifecycle.signature,
    },
    body: signedTemplateLifecycle.rawBody,
  })
  await requestJson("/v1/webhooks/meta/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signedTemplateLifecycle.signature,
    },
    body: signedTemplateLifecycle.rawBody,
  })

  const templateAuditCount = await getDatabase()
    .collection("audit_logs")
    .countDocuments({
      action: "whatsapp.message_template_status_update",
      entityType: "whatsapp_template",
      entityId: "template-order-confirmed",
    })
  assert.equal(templateAuditCount, 1)

  const webhookChatId = `wa:62${customerPhone.slice(1)}`
  await getDatabase().collection("whatsapp_chats").updateOne(
    { _id: webhookChatId },
    {
      $set: {
        cswExpiresAt: DateTime.now().minus({ hours: 2 }).toISO(),
        composerMode: "template_only",
      },
    }
  )

  const postStatusWebhook = async (
    status: "sent" | "delivered" | "read" | "failed",
    extra: Record<string, unknown> = {}
  ) => {
    const statusPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          id: "waba_123",
          changes: [
            {
              field: "messages",
              value: {
                statuses: [
                  {
                    id: confirmNotification.providerMessageId,
                    recipient_id: `62${customerPhone.slice(1)}`,
                    status,
                    timestamp: String(Math.floor(Date.now() / 1000)),
                    ...extra,
                  },
                ],
              },
            },
          ],
        },
      ],
    }
    const signedPayload = signWhatsappWebhookPayload(statusPayload)
    return requestJson("/v1/webhooks/meta/whatsapp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Hub-Signature-256": signedPayload.signature,
      },
      body: signedPayload.rawBody,
    })
  }

  await postStatusWebhook("sent")
  let webhookNotificationRecord = await waitFor(
    async () =>
      getDatabase().collection("notifications").findOne({
        _id: confirmNotification.notificationId,
      }),
    (notification) => notification?.providerStatus === "sent",
  )
  assert.equal(webhookNotificationRecord?.deliveryStatus, "sent")

  await postStatusWebhook("delivered", {
    pricing: {
      type: "free_entry_point",
      category: "utility",
    },
    conversation: {
      expiration_timestamp: String(Math.floor(Date.now() / 1000) + 72 * 60 * 60),
    },
  })
  webhookNotificationRecord = await waitFor(
    async () =>
      getDatabase().collection("notifications").findOne({
        _id: confirmNotification.notificationId,
      }),
    (notification) => notification?.providerStatus === "delivered",
  )
  assert.equal(webhookNotificationRecord?.pricingType, "free_entry_point")
  assert.equal(webhookNotificationRecord?.pricingCategory, "utility")

  await postStatusWebhook("read")
  webhookNotificationRecord = await waitFor(
    async () =>
      getDatabase().collection("notifications").findOne({
        _id: confirmNotification.notificationId,
      }),
    (notification) => notification?.providerStatus === "read",
  )
  assert.equal(webhookNotificationRecord?.deliveryStatus, "sent")

  await postStatusWebhook("failed", {
    errors: [
      {
        code: 131051,
        message: "Message failed at provider",
      },
    ],
  })
  webhookNotificationRecord = await waitFor(
    async () =>
      getDatabase().collection("notifications").findOne({
        _id: confirmNotification.notificationId,
      }),
    (notification) => notification?.providerStatus === "failed",
  )
  assert.equal(webhookNotificationRecord?.deliveryStatus, "failed")
  assert.equal(webhookNotificationRecord?.latestErrorCode, "131051")
  assert.equal(webhookNotificationRecord?.latestFailureReason, "Message failed at provider")

  const webhookChatAfterStatus = await getDatabase().collection("whatsapp_chats").findOne({
    _id: webhookChatId,
  })
  assert.ok(webhookChatAfterStatus?.fepExpiresAt)
  assert.equal(DateTime.fromISO(webhookChatAfterStatus?.cswExpiresAt ?? "").toMillis() < Date.now(), true)
  assert.equal(webhookChatAfterStatus?.composerMode, "template_only")

  result = await requestJson("/v1/internal/whatsapp/events", {
    method: "POST",
    headers: {
      Authorization: "Bearer integration-test-whatsapp-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "message_upserted",
      providerMessageId: `whatsapp_in_${uniqueSuffix}`,
      chatId: `${customerPhone.replace(/^0/, "62")}@c.us`,
      waId: `62${customerPhone.slice(1)}`,
      direction: "inbound",
      messageType: "chat",
      body: "Halo, saya cek status cucian",
      timestampIso: new Date().toISOString(),
      phone: `+62${customerPhone.slice(1)}`,
      displayName: upperCustomerName,
      hasMedia: false
    })
  })
  assert.equal(result.payload.ok, true)

  result = await requestJson("/v1/internal/whatsapp/events", {
    method: "POST",
    headers: {
      Authorization: "Bearer integration-test-whatsapp-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "message_upserted",
      providerMessageId: `whatsapp_out_${uniqueSuffix}`,
      chatId: `${customerPhone.replace(/^0/, "62")}@c.us`,
      waId: `62${customerPhone.slice(1)}`,
      direction: "outbound",
      messageType: "image",
      caption: "Order confirmed mirror",
      timestampIso: new Date().toISOString(),
      phone: `+62${customerPhone.slice(1)}`,
      displayName: upperCustomerName,
      providerKind: "webjs_legacy",
      providerStatus: "sent",
      providerStatusAt: new Date().toISOString(),
      providerAck: 1,
      hasMedia: true,
      mediaMimeType: "application/pdf",
      mediaName: "receipt.pdf",
      notificationId: confirmNotification.notificationId,
      orderCode: confirmFirst.payload.order.orderCode
    })
  })
  assert.equal(result.payload.ok, true)

  result = await requestJson("/v1/internal/whatsapp/events", {
    method: "POST",
    headers: {
      Authorization: "Bearer integration-test-whatsapp-token",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      type: "message_ack_changed",
      providerMessageId: `whatsapp_out_${uniqueSuffix}`,
      providerAck: 2,
      observedAt: new Date().toISOString()
    })
  })
  assert.equal(result.payload.ok, true)

  result = await requestJson("/v1/admin/whatsapp/chats", {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.length, 1)
  assert.equal(result.payload[0].customerName, upperCustomerName)
  assert.equal(result.payload[0].waId, `62${customerPhone.slice(1)}`)
  assert.equal(result.payload[0].isCswOpen, true)
  assert.equal(result.payload[0].isFepOpen, true)
  assert.equal(result.payload[0].composerMode, "free_form")

  result = await requestJson(`/v1/admin/whatsapp/chats/${encodeURIComponent(`wa:62${customerPhone.slice(1)}`)}/messages`, {
    headers: { Cookie: adminCookie! }
  })
  assert.ok(result.payload.length >= 4)
  const inboundLegacyMessage = result.payload.find(
    (message) => message.direction === "inbound" && message.source === "legacy_mirror"
  )
  assert.ok(inboundLegacyMessage)
  const inboundWebhookMessage = result.payload.find(
    (message) =>
      message.providerMessageId === `wamid.inbound.text.${uniqueSuffix}` &&
      message.source === "inbound_customer"
  )
  assert.ok(inboundWebhookMessage)
  const inboundWebhookImage = result.payload.find(
    (message) =>
      message.providerMessageId === `wamid.inbound.image.${uniqueSuffix}` &&
      message.mediaDownloadAvailable === true &&
      message.mediaDownloadStatus === "downloaded"
  )
  assert.ok(inboundWebhookImage)
  const confirmedMirrorMessage = result.payload.find(
    (message) =>
      message.notificationId === confirmNotification.notificationId &&
      message.source === "legacy_mirror" &&
      message.providerStatus === "delivered"
  )
  assert.ok(confirmedMirrorMessage)
  assert.equal(confirmedMirrorMessage.providerAck, 2)

  await getDatabase().collection("notifications").insertOne({
    _id: `notification_conflict_${uniqueSuffix}`,
    customerName: upperCustomerName,
    destinationPhone: `+62${customerPhone.slice(1)}`,
    orderId: firstOrderId,
    orderCode: confirmFirst.payload.order.orderCode,
    eventType: "order_done",
    renderStatus: "not_required",
    deliveryStatus: "queued",
    attemptCount: 0,
    preparedMessage: "conflict",
    businessKey: `order-done:${firstOrderId}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  const failedDone = await requestJson(`/v1/admin/orders/${firstOrderId}/done`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `done-conflict-${uniqueSuffix}`
    },
    body: JSON.stringify({}),
    expectedStatus: 409
  })
  assert.ok(failedDone.payload.message)

  result = await requestJson(`/v1/admin/orders/${firstOrderId}`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.status, "Active")

  await getDatabase().collection("notifications").deleteOne({ _id: `notification_conflict_${uniqueSuffix}` })

  result = await requestJson(`/v1/admin/orders/${firstOrderId}/done`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `done-${uniqueSuffix}`
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.status, "Done")

  result = await requestJson(`/v1/public/me/orders/${firstOrderId}`, {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(result.payload.status, "Done")
  assert.match(result.payload.totalLabel, /30\.000/)

  const archivedOrderPayload = {
    customerId,
    weightKg: 2,
    redeemCount: 0,
    items: [
      { serviceCode: "washer", quantity: 1, selected: true },
      { serviceCode: "dryer", quantity: 1, selected: true },
      { serviceCode: "detergent", quantity: 0, selected: false },
      { serviceCode: "softener", quantity: 0, selected: false },
      { serviceCode: "wash_dry_fold_package", quantity: 0, selected: false },
      { serviceCode: "ironing", quantity: 0, selected: false }
    ]
  }

  result = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `archived-${uniqueSuffix}`
    },
    body: JSON.stringify(archivedOrderPayload)
  })

  const archivedOrderId = result.payload.order.orderId as string
  const archivedOrderCode = result.payload.order.orderCode as string
  const archivedOrderToken = result.payload.directToken as string

  const previousMonthIso = DateTime.now()
    .setZone("Asia/Jakarta")
    .minus({ month: 1 })
    .startOf("month")
    .plus({ days: 5, hours: 10 })
    .toUTC()
    .toISO()
  assert.ok(previousMonthIso)

  await getDatabase().collection("orders").updateOne(
    { _id: archivedOrderId },
    { $set: { createdAt: previousMonthIso } }
  )

  const previousMonthKey = DateTime.fromISO(previousMonthIso!).setZone("Asia/Jakarta").toFormat("yyyy-MM")

  result = await requestJson(`/v1/public/leaderboard?month=${previousMonthKey}`)
  assert.equal(result.payload.rows.length, 1)
  assert.equal(result.payload.rows[0].earnedStamps, 1)
  assert.equal(result.payload.rows[0].rank, 1)
  assert.equal(result.payload.rows[0].displayName, upperCustomerName)

  let snapshots = await getDatabase()
    .collection("leaderboard_snapshots")
    .find({ monthKey: previousMonthKey })
    .sort({ version: 1 })
    .toArray()

  assert.equal(snapshots.length, 1)
  assert.equal(snapshots[0].version, 1)

  result = await requestJson(`/v1/admin/orders/${archivedOrderId}/void`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `void-${uniqueSuffix}`
    },
    body: JSON.stringify({
      reason: "Pembatalan integration test",
      notifyCustomer: true
    })
  })
  assert.equal(result.payload.status, "Cancelled")
  assert.equal(result.payload.cancellationSummary, "Pembatalan integration test")

  result = await requestJson(`/v1/public/me/orders/${archivedOrderId}`, {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(result.payload.status, "Cancelled")

  result = await requestJson(`/v1/public/status/${archivedOrderToken}`)
  assert.equal(result.payload.status, "Cancelled")

  result = await requestJson(`/v1/admin/customers/${customerId}`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.profile.currentPoints, 12)

  result = await requestJson(`/v1/public/leaderboard?month=${previousMonthKey}`)
  assert.equal(result.payload.rows.length, 0)

  snapshots = await getDatabase()
    .collection("leaderboard_snapshots")
    .find({ monthKey: previousMonthKey })
    .sort({ version: 1 })
    .toArray()

  assert.equal(snapshots.length, 2)
  assert.equal(snapshots[1].version, 2)
  assert.equal(snapshots[1].rows.length, 0)

  result = await waitFor(
    () => requestJson("/v1/admin/notifications", { headers: { Cookie: adminCookie! } }),
    (value) =>
      value.payload.some(
        (notification: { eventType: string; orderCode?: string; deliveryStatus: string }) =>
          notification.eventType === "order_void_notice" &&
          notification.orderCode === archivedOrderCode &&
          notification.deliveryStatus === "sent"
      )
  )
  assert.ok(
    result.payload.some(
      (notification: { eventType: string; orderCode?: string; deliveryStatus: string }) =>
        notification.eventType === "order_void_notice" &&
        notification.orderCode === archivedOrderCode &&
        notification.deliveryStatus === "sent"
    )
  )

  await getDatabase().collection("notifications").insertOne({
    _id: `notification_render_failure_${uniqueSuffix}`,
    customerName: upperCustomerName,
    destinationPhone: `+62${customerPhone.slice(1)}`,
    orderCode: "BROKEN",
    eventType: "order_confirmed",
    renderStatus: "pending",
    deliveryStatus: "queued",
    attemptCount: 0,
    preparedMessage: "render me",
    businessKey: `broken-render:${uniqueSuffix}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  const renderFailedNotification = await waitFor(
    () => getDatabase().collection("notifications").findOne({ _id: `notification_render_failure_${uniqueSuffix}` }),
    (value) => value?.renderStatus === "failed" && value.deliveryStatus === "failed"
  )
  assert.match(renderFailedNotification?.latestFailureReason ?? "", /receipt|Receipt|Order/)

  const renderFailureManualWhatsapp = await requestJson(`/v1/admin/notifications/notification_render_failure_${uniqueSuffix}/manual-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    }
  })
  assert.equal(renderFailureManualWhatsapp.payload.notification.deliveryStatus, "manual_resolved")
  assert.match(renderFailureManualWhatsapp.payload.whatsappUrl, /wa\.me/)

  await getDatabase().collection("notifications").insertOne({
    _id: `notification_done_failed_${uniqueSuffix}`,
    customerName: upperCustomerName,
    destinationPhone: `+62${customerPhone.slice(1)}`,
    orderId: firstOrderId,
    orderCode: confirmFirst.payload.order.orderCode,
    eventType: "order_done",
    renderStatus: "not_required",
    deliveryStatus: "failed",
    latestFailureReason: "Bot disconnect",
    attemptCount: 1,
    preparedMessage: "done fallback",
    businessKey: `manual-done-fallback:${uniqueSuffix}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  result = await requestJson(`/v1/admin/notifications/notification_done_failed_${uniqueSuffix}/manual-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    }
  })
  assert.equal(result.payload.notification.deliveryStatus, "manual_resolved")
  assert.equal(result.payload.notification.manualWhatsappAvailable, false)
  assert.match(result.payload.whatsappUrl, /wa\.me/)

  await getDatabase().collection("notifications").insertOne({
    _id: `notification_manual_${uniqueSuffix}`,
    customerName: upperCustomerName,
    destinationPhone: `+62${customerPhone.slice(1)}`,
    eventType: "welcome",
    renderStatus: "not_required",
    deliveryStatus: "failed",
    latestFailureReason: "Simulasi manual",
    attemptCount: 2,
    preparedMessage: "manual fallback",
    businessKey: `manual-resolution:${uniqueSuffix}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  result = await requestJson(`/v1/admin/notifications/notification_manual_${uniqueSuffix}/manual-resolve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({ note: "Dikirim manual via admin" })
  })
  assert.equal(result.payload.deliveryStatus, "manual_resolved")
  assert.equal(result.payload.manualResolutionNote, "Dikirim manual via admin")

  result = await requestJson(`/v1/admin/notifications/notification_manual_${uniqueSuffix}/resend`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    }
  })
  assert.ok(["queued", "sent"].includes(result.payload.deliveryStatus))

  const resentNotification = await waitFor(
    () => getDatabase().collection("notifications").findOne({ _id: `notification_manual_${uniqueSuffix}` }),
    (value) => value?.deliveryStatus === "sent"
  )
  assert.equal(resentNotification?.deliveryStatus, "sent")

  let throttledLogin = null as Awaited<ReturnType<typeof requestJson>> | null
  for (let attempt = 0; attempt < 11; attempt += 1) {
    throttledLogin = await requestJson("/v1/public/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone: customerPhone, name: "Nama Salah" }),
      expectedStatus: attempt < 10 ? 401 : 429
    })
  }
  assert.equal(throttledLogin?.response.status, 429)

  result = await requestJson("/v1/public/leaderboard")
  assert.ok(result.payload.availableMonths.some((month: { key: string }) => month.key === previousMonthKey))
})

test("hosted env contract requires plaintext bootstrap password and accepts valid hosted values", async () => {
  assert.throws(
    () =>
      parseEnv({
        APP_ENV: "staging",
        PORT: "4105",
        MONGODB_URI: "mongodb://127.0.0.1:27017/cjlaundry",
        SESSION_SECRET: "staging-session-secret",
        SESSION_COOKIE_SECURE: "true",
        TRUST_PROXY: "1",
        ADMIN_ORIGIN: "https://admin-staging.cjlaundry.com",
        PUBLIC_ORIGIN: "https://staging.cjlaundry.com",
        API_ORIGIN: "https://api-staging.cjlaundry.com",
        WHATSAPP_PROVIDER: "cloud_api",
        WHATSAPP_GRAPH_API_VERSION: "v25.0",
        WHATSAPP_GRAPH_API_BASE_URL: "https://graph.facebook.com",
        WHATSAPP_BUSINESS_ID: "biz_123",
        WHATSAPP_WABA_ID: "waba_123",
        WHATSAPP_PHONE_NUMBER_ID: "phone_123",
        WHATSAPP_ACCESS_TOKEN: "staging-access-token",
        WHATSAPP_APP_SECRET: "staging-app-secret",
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: "staging-webhook-token",
        ADMIN_BOOTSTRAP_USERNAME: "admin",
        ADMIN_BOOTSTRAP_PASSWORD: "replace-me",
      }),
    /ADMIN_BOOTSTRAP_PASSWORD/
  )

  assert.throws(
    () =>
      parseEnv({
        APP_ENV: "production",
        PORT: "4105",
        MONGODB_URI: "mongodb://127.0.0.1:27017/cjlaundry",
        SESSION_SECRET: "production-session-secret",
        SESSION_COOKIE_SECURE: "true",
        TRUST_PROXY: "1",
        ADMIN_ORIGIN: "https://admin.cjlaundry.com",
        PUBLIC_ORIGIN: "https://cjlaundry.com",
        API_ORIGIN: "https://api.cjlaundry.com",
        WHATSAPP_PROVIDER: "cloud_api",
        WHATSAPP_GRAPH_API_VERSION: "v25.0",
        WHATSAPP_GRAPH_API_BASE_URL: "https://graph.facebook.com",
        WHATSAPP_BUSINESS_ID: "biz_123",
        WHATSAPP_WABA_ID: "waba_123",
        WHATSAPP_PHONE_NUMBER_ID: "phone_123",
        WHATSAPP_ACCESS_TOKEN: "production-access-token",
        WHATSAPP_APP_SECRET: "production-app-secret",
        WHATSAPP_WEBHOOK_VERIFY_TOKEN: "production-webhook-token",
        ADMIN_BOOTSTRAP_USERNAME: "admin",
      }),
    /ADMIN_BOOTSTRAP_PASSWORD/
  )

  assert.doesNotThrow(() =>
    parseEnv({
      APP_ENV: "staging",
      PORT: "4105",
      MONGODB_URI: "mongodb://127.0.0.1:27017/cjlaundry",
      SESSION_SECRET: "staging-session-secret",
      SESSION_COOKIE_SECURE: "true",
      TRUST_PROXY: "1",
      ADMIN_ORIGIN: "https://admin-staging.cjlaundry.com",
      PUBLIC_ORIGIN: "https://staging.cjlaundry.com",
      API_ORIGIN: "https://api-staging.cjlaundry.com",
      WHATSAPP_PROVIDER: "cloud_api",
      WHATSAPP_GRAPH_API_VERSION: "v25.0",
      WHATSAPP_GRAPH_API_BASE_URL: "https://graph.facebook.com",
      WHATSAPP_BUSINESS_ID: "biz_123",
      WHATSAPP_WABA_ID: "waba_123",
      WHATSAPP_PHONE_NUMBER_ID: "phone_123",
      WHATSAPP_ACCESS_TOKEN: "staging-access-token",
      WHATSAPP_APP_SECRET: "staging-app-secret",
      WHATSAPP_WEBHOOK_VERIFY_TOKEN: "staging-webhook-token",
      ADMIN_BOOTSTRAP_USERNAME: "admin",
      ADMIN_BOOTSTRAP_PASSWORD: "staging-bootstrap-password-123",
    })
  )
})

test("seed adds missing service catalog entries without overwriting existing settings services", async () => {
  const settingsCollection = getDatabase().collection("settings")
  const originalSettings = await settingsCollection.findOne({ _id: "app-settings" })
  assert.ok(originalSettings)

  const customWasherPrice = 12345
  const degradedServices = originalSettings.services
    .filter((service: { serviceCode: string }) => !["ironing_only", "laundry_plastic"].includes(service.serviceCode))
    .map((service: { serviceCode: string; price: number }) =>
      service.serviceCode === "washer"
        ? { ...service, price: customWasherPrice }
        : service
    )

  try {
    await settingsCollection.updateOne(
      { _id: "app-settings" },
      { $set: { services: degradedServices } }
    )

    await ensureSeedData()

    const upgradedSettings = await settingsCollection.findOne({ _id: "app-settings" })
    assert.ok(upgradedSettings)

    const washerService = upgradedSettings.services.find((service: { serviceCode: string }) => service.serviceCode === "washer")
    const ironingOnlyService = upgradedSettings.services.find((service: { serviceCode: string }) => service.serviceCode === "ironing_only")
    const laundryPlasticService = upgradedSettings.services.find((service: { serviceCode: string }) => service.serviceCode === "laundry_plastic")

    assert.equal(washerService?.price, customWasherPrice)
    assert.equal(ironingOnlyService?.displayName, "Setrika Saja")
    assert.equal(ironingOnlyService?.price, 5000)
    assert.equal(laundryPlasticService?.displayName, "Plastik Laundry")
    assert.equal(laundryPlasticService?.price, 2000)
  } finally {
    await settingsCollection.updateOne(
      { _id: "app-settings" },
      { $set: { services: originalSettings.services } }
    )
  }
})

test("seed backfills order activityAt from lifecycle timestamps", async () => {
  const ordersCollection = getDatabase().collection("orders")
  const uniqueSuffix = `activity-${Date.now().toString().slice(-6)}`
  const createdAt = DateTime.now().setZone("Asia/Jakarta").minus({ days: 2 }).toUTC().toISO()
  const completedAt = DateTime.now().setZone("Asia/Jakarta").minus({ days: 1, hours: 6 }).toUTC().toISO()
  const voidedAt = DateTime.now().setZone("Asia/Jakarta").minus({ hours: 8 }).toUTC().toISO()
  assert.ok(createdAt)
  assert.ok(completedAt)
  assert.ok(voidedAt)

  const baseOrder = {
    customerId: `customer_${uniqueSuffix}`,
    customerName: "SEED ACTIVITY CUSTOMER",
    customerPhone: "081234567890",
    weightKg: 1,
    items: [
      {
        serviceCode: "washer" as const,
        serviceLabel: "Washer",
        quantity: 1,
        unitPrice: 10000,
        pricingModel: "fixed" as const,
        lineTotal: 10000,
      }
    ],
    subtotal: 10000,
    discount: 0,
    total: 10000,
    redeemedPoints: 0,
    earnedStamps: 1,
    resultingPointBalance: 1,
  }

  const insertedOrderIds = [
    `order_active_${uniqueSuffix}`,
    `order_done_${uniqueSuffix}`,
    `order_void_${uniqueSuffix}`,
  ]

  try {
    await ordersCollection.insertMany([
      {
        _id: insertedOrderIds[0],
        orderCode: `CJ-ACT-${uniqueSuffix}-1`,
        ...baseOrder,
        receiptSnapshot: {
          orderCode: `CJ-ACT-${uniqueSuffix}-1`,
          customerName: "SEED ACTIVITY CUSTOMER",
          serviceSummary: "1x Washer",
          totalLabel: "Rp10.000",
          createdAtLabel: "created",
          laundryName: "CJ Laundry",
          laundryPhone: "081234567890",
        },
        status: "Active" as const,
        createdAt,
      },
      {
        _id: insertedOrderIds[1],
        orderCode: `CJ-ACT-${uniqueSuffix}-2`,
        ...baseOrder,
        receiptSnapshot: {
          orderCode: `CJ-ACT-${uniqueSuffix}-2`,
          customerName: "SEED ACTIVITY CUSTOMER",
          serviceSummary: "1x Washer",
          totalLabel: "Rp10.000",
          createdAtLabel: "created",
          laundryName: "CJ Laundry",
          laundryPhone: "081234567890",
        },
        status: "Done" as const,
        createdAt,
        completedAt,
      },
      {
        _id: insertedOrderIds[2],
        orderCode: `CJ-ACT-${uniqueSuffix}-3`,
        ...baseOrder,
        receiptSnapshot: {
          orderCode: `CJ-ACT-${uniqueSuffix}-3`,
          customerName: "SEED ACTIVITY CUSTOMER",
          serviceSummary: "1x Washer",
          totalLabel: "Rp10.000",
          createdAtLabel: "created",
          laundryName: "CJ Laundry",
          laundryPhone: "081234567890",
        },
        status: "Voided" as const,
        createdAt,
        voidedAt,
        voidReason: "Seed test",
      }
    ])

    await ensureSeedData()

    const seededOrders = await ordersCollection.find({ _id: { $in: insertedOrderIds } }).toArray()
    const seededActive = seededOrders.find((order) => order._id === insertedOrderIds[0])
    const seededDone = seededOrders.find((order) => order._id === insertedOrderIds[1])
    const seededVoided = seededOrders.find((order) => order._id === insertedOrderIds[2])

    assert.equal(seededActive?.activityAt, createdAt)
    assert.equal(seededDone?.activityAt, completedAt)
    assert.equal(seededVoided?.activityAt, voidedAt)
  } finally {
    await ordersCollection.deleteMany({ _id: { $in: insertedOrderIds } })
  }
})

test("laundry history validates cursor, oldest sort, and final page semantics", async () => {
  let result = await requestJson("/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  })
  const adminCookie = result.response.headers.get("set-cookie")
  assert.ok(adminCookie)

  const uniqueSuffix = `history-${Date.now().toString().slice(-6)}`
  const customerName = `History Customer ${uniqueSuffix}`
  const customerPhone = `08177${Date.now().toString().slice(-6)}`

  result = await requestJson("/v1/admin/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `history-create-${uniqueSuffix}`,
    },
    body: JSON.stringify({ name: customerName, phone: customerPhone })
  })
  const customerId = result.payload.customer.customerId as string

  const payload = {
    customerId,
    weightKg: 1,
    redeemCount: 0,
    items: [
      { serviceCode: "washer", quantity: 1, selected: true },
      { serviceCode: "dryer", quantity: 0, selected: false },
      { serviceCode: "detergent", quantity: 0, selected: false },
      { serviceCode: "softener", quantity: 0, selected: false },
      { serviceCode: "wash_dry_fold_package", quantity: 0, selected: false },
      { serviceCode: "ironing", quantity: 0, selected: false },
      { serviceCode: "ironing_only", quantity: 0, selected: false },
      { serviceCode: "laundry_plastic", quantity: 0, selected: false }
    ]
  }

  result = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `history-order-1-${uniqueSuffix}`,
    },
    body: JSON.stringify(payload)
  })
  const olderOrderId = result.payload.order.orderId as string

  result = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `history-order-2-${uniqueSuffix}`,
    },
    body: JSON.stringify(payload)
  })
  const newerOrderId = result.payload.order.orderId as string

  const olderIso = DateTime.now().setZone("Asia/Jakarta").minus({ hours: 2 }).toUTC().toISO()
  const newerIso = DateTime.now().setZone("Asia/Jakarta").minus({ hours: 1 }).toUTC().toISO()
  assert.ok(olderIso)
  assert.ok(newerIso)

  await getDatabase().collection("orders").updateOne(
    { _id: olderOrderId },
    { $set: { createdAt: olderIso, activityAt: olderIso } }
  )
  await getDatabase().collection("orders").updateOne(
    { _id: newerOrderId },
    { $set: { createdAt: newerIso, activityAt: newerIso } }
  )

  result = await requestJson("/v1/admin/orders/laundry?scope=history&sort=oldest&status=active&pageSize=1", {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.items.length, 1)
  assert.equal(result.payload.items[0].orderId, olderOrderId)
  assert.ok(result.payload.nextCursor)

  result = await requestJson(`/v1/admin/orders/laundry?scope=history&sort=oldest&status=active&pageSize=1&cursor=${encodeURIComponent(result.payload.nextCursor)}`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.items.length, 1)
  assert.equal(result.payload.items[0].orderId, newerOrderId)
  assert.ok(typeof result.payload.nextCursor === "string" || result.payload.nextCursor === undefined)

  await requestJson("/v1/admin/orders/laundry?scope=history&sort=oldest&status=active&cursor=not-valid-base64", {
    headers: { Cookie: adminCookie! },
    expectedStatus: 422,
  })
})

test("backend covers POS-only services, laundry filters, notification terminal states, and dashboard failed counts", async () => {
  let result = await requestJson("/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  })
  const adminCookie = result.response.headers.get("set-cookie")
  assert.ok(adminCookie)

  const uniqueSuffix = `coverage-${Date.now().toString().slice(-6)}`
  const customerName = `Coverage Customer ${uniqueSuffix}`
  const customerPhone = `08188${Date.now().toString().slice(-6)}`

  result = await requestJson("/v1/public/landing")
  const landingCodes = result.payload.services.map((service: { code: string }) => service.code)
  assert.equal(landingCodes.includes("ironing_only"), false)
  assert.equal(landingCodes.includes("laundry_plastic"), false)

  result = await requestJson("/v1/admin/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `coverage-create-${uniqueSuffix}`,
    },
    body: JSON.stringify({ name: customerName, phone: customerPhone })
  })
  const customerId = result.payload.customer.customerId as string

  const specialtyPayload = {
    customerId,
    weightKg: 2,
    redeemCount: 0,
    items: [
      { serviceCode: "washer", quantity: 0, selected: false },
      { serviceCode: "dryer", quantity: 0, selected: false },
      { serviceCode: "detergent", quantity: 0, selected: false },
      { serviceCode: "softener", quantity: 0, selected: false },
      { serviceCode: "wash_dry_fold_package", quantity: 0, selected: false },
      { serviceCode: "ironing", quantity: 0, selected: false },
      { serviceCode: "ironing_only", quantity: 1, selected: true },
      { serviceCode: "laundry_plastic", quantity: 2, selected: true }
    ]
  }

  result = await requestJson("/v1/admin/orders/preview", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify(specialtyPayload)
  })
  assert.equal(result.payload.total, 14000)
  assert.equal(result.payload.items.length, 2)
  assert.equal(result.payload.items[0].serviceCode, "ironing_only")
  assert.equal(result.payload.items[0].quantityLabel, "2.0 kg")
  assert.equal(result.payload.items[1].serviceCode, "laundry_plastic")
  assert.equal(result.payload.items[1].lineTotal, 4000)

  result = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `coverage-order-1-${uniqueSuffix}`,
    },
    body: JSON.stringify(specialtyPayload)
  })
  const firstOrderId = result.payload.order.orderId as string

  result = await requestJson("/v1/admin/orders/laundry?scope=active&sort=oldest", {
    headers: { Cookie: adminCookie! }
  })
  const activeLaundryOrder = result.payload.items.find((order: { orderId: string }) => order.orderId === firstOrderId)
  assert.ok(activeLaundryOrder)
  assert.equal(activeLaundryOrder.status, "Active")
  assert.match(activeLaundryOrder.serviceSummary, /Setrika Saja/)
  assert.match(activeLaundryOrder.serviceSummary, /Plastik Laundry/)

  result = await requestJson(`/v1/admin/orders/${firstOrderId}/done`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `coverage-done-${uniqueSuffix}`,
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.status, "Done")

  const yesterdayIso = DateTime.now().setZone("Asia/Jakarta").minus({ days: 1 }).toUTC().toISO()
  assert.ok(yesterdayIso)
  await getDatabase().collection("orders").updateOne(
    { _id: firstOrderId },
    { $set: { createdAt: yesterdayIso } }
  )

  const cancelledPayload = {
    customerId,
    weightKg: 1.5,
    redeemCount: 0,
    items: [
      { serviceCode: "washer", quantity: 1, selected: true },
      { serviceCode: "dryer", quantity: 1, selected: true },
      { serviceCode: "detergent", quantity: 0, selected: false },
      { serviceCode: "softener", quantity: 0, selected: false },
      { serviceCode: "wash_dry_fold_package", quantity: 0, selected: false },
      { serviceCode: "ironing", quantity: 0, selected: false },
      { serviceCode: "ironing_only", quantity: 0, selected: false },
      { serviceCode: "laundry_plastic", quantity: 0, selected: false }
    ]
  }

  result = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `coverage-order-2-${uniqueSuffix}`,
    },
    body: JSON.stringify(cancelledPayload)
  })
  const secondOrderId = result.payload.order.orderId as string

  result = await requestJson(`/v1/admin/orders/${secondOrderId}/void`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!,
      "Idempotency-Key": `coverage-void-${uniqueSuffix}`,
    },
    body: JSON.stringify({
      reason: "Coverage cancel",
      notifyCustomer: false,
    })
  })
  assert.equal(result.payload.status, "Cancelled")

  await getDatabase().collection("orders").updateOne(
    { _id: secondOrderId },
    { $set: { createdAt: yesterdayIso } }
  )

  result = await requestJson("/v1/admin/orders/laundry?scope=today&sort=newest", {
    headers: { Cookie: adminCookie! }
  })
  assert.ok(result.payload.items.some((order: { orderId: string; status: string }) => order.orderId === firstOrderId && order.status === "Done"))
  assert.equal(result.payload.items.some((order: { orderId: string; status: string }) => order.orderId === secondOrderId && order.status === "Cancelled"), false)

  result = await requestJson("/v1/admin/orders/laundry?scope=today&sort=newest&includeCancelled=true", {
    headers: { Cookie: adminCookie! }
  })
  assert.ok(result.payload.items.some((order: { orderId: string; status: string }) => order.orderId === secondOrderId && order.status === "Cancelled"))

  result = await requestJson("/v1/admin/orders/laundry?scope=history&sort=newest&includeCancelled=true&pageSize=1", {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.items.length, 1)
  assert.ok(result.payload.nextCursor)

  result = await requestJson(`/v1/admin/orders/laundry?scope=history&sort=newest&includeCancelled=true&pageSize=1&cursor=${encodeURIComponent(result.payload.nextCursor)}`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.items.length, 1)

  result = await requestJson("/v1/admin/orders/laundry?scope=history&sort=newest&status=done", {
    headers: { Cookie: adminCookie! }
  })
  assert.ok(result.payload.items.some((order: { orderId: string; status: string }) => order.orderId === firstOrderId && order.status === "Done"))

  result = await requestJson("/v1/admin/orders/laundry?scope=history&sort=newest&status=cancelled&includeCancelled=true", {
    headers: { Cookie: adminCookie! }
  })
  assert.ok(result.payload.items.some((order: { orderId: string; status: string }) => order.orderId === secondOrderId && order.status === "Cancelled"))

  result = await requestJson("/v1/public/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: customerPhone, name: customerName })
  })
  const publicCookie = result.response.headers.get("set-cookie")
  assert.ok(publicCookie)

  result = await requestJson(`/v1/public/me/orders/${firstOrderId}`, {
    headers: { Cookie: publicCookie! }
  })
  assert.match(result.payload.serviceSummary, /Setrika Saja/)
  assert.match(result.payload.serviceSummary, /Plastik Laundry/)
  assert.equal(result.payload.items.some((item: { serviceCode: string }) => item.serviceCode === "ironing_only"), true)
  assert.equal(result.payload.items.some((item: { serviceCode: string }) => item.serviceCode === "laundry_plastic"), true)

  await getDatabase().collection("notifications").insertOne({
    _id: `notification_complete_${uniqueSuffix}`,
    customerName: customerName.toUpperCase(),
    destinationPhone: `+62${customerPhone.slice(1)}`,
    eventType: "order_done",
    renderStatus: "not_required",
    deliveryStatus: "failed",
    latestFailureReason: "Coverage manual complete",
    attemptCount: 1,
    preparedMessage: "manual complete",
    businessKey: `manual-complete:${uniqueSuffix}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  result = await requestJson(`/v1/admin/notifications/notification_complete_${uniqueSuffix}/manual-complete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.deliveryStatus, "manual_resolved")
  assert.equal(result.payload.manualResolutionNote, "Ditandai selesai oleh admin.")

  await getDatabase().collection("notifications").insertOne({
    _id: `notification_ignore_${uniqueSuffix}`,
    customerName: customerName.toUpperCase(),
    destinationPhone: `+62${customerPhone.slice(1)}`,
    orderId: secondOrderId,
    orderCode: "IGNORE-COVERAGE",
    eventType: "order_confirmed",
    renderStatus: "ready",
    deliveryStatus: "failed",
    latestFailureReason: "Coverage ignore",
    attemptCount: 1,
    preparedMessage: "ignored fallback",
    businessKey: `ignored:${uniqueSuffix}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  result = await requestJson(`/v1/admin/notifications/notification_ignore_${uniqueSuffix}/ignore`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.deliveryStatus, "ignored")
  assert.equal(result.payload.ignoredNote, "Diabaikan oleh admin.")

  const ignoredReceiptResponse = await fetch(`${baseUrl}/v1/admin/notifications/notification_ignore_${uniqueSuffix}/receipt`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(ignoredReceiptResponse.status, 200)

  for (let index = 0; index < 13; index += 1) {
    await getDatabase().collection("notifications").insertOne({
      _id: `dashboard_failed_${uniqueSuffix}_${index}`,
      customerName: customerName.toUpperCase(),
      destinationPhone: `+62${customerPhone.slice(1)}`,
      eventType: "welcome",
      renderStatus: "not_required",
      deliveryStatus: "failed",
      latestFailureReason: `Coverage failed ${index}`,
      attemptCount: 1,
      preparedMessage: `failed ${index}`,
      businessKey: `dashboard-failed:${uniqueSuffix}:${index}`,
      createdAt: new Date(Date.now() - (index + 1) * 60_000).toISOString(),
      updatedAt: new Date(Date.now() - (index + 1) * 60_000).toISOString()
    })
  }

  result = await requestJson("/v1/admin/dashboard?window=daily", {
    headers: { Cookie: adminCookie! }
  })
  const failedNotifications = result.payload.notifications.filter(
    (notification: { deliveryStatus: string }) => notification.deliveryStatus === "failed"
  )
  assert.ok(failedNotifications.length >= 13)
})
