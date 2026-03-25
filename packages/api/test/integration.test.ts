import assert from "node:assert/strict"
import test from "node:test"
import { createServer, type Server } from "node:http"
import bcrypt from "bcryptjs"
import { DateTime } from "luxon"
import { MongoMemoryReplSet } from "mongodb-memory-server"

const baseUrl = "http://127.0.0.1:4105"
const gatewayUrl = "http://127.0.0.1:4115"

let mongo: MongoMemoryReplSet
let server: Server
let gatewayServer: Server
let getDatabase: (typeof import("../src/db.ts"))["getDatabase"]
let disconnectDatabase: (typeof import("../src/db.ts"))["disconnectDatabase"]
let stopBackgroundWork: (() => Promise<void>) | undefined
let ensureSeedData: (typeof import("../src/seed.ts"))["ensureSeedData"]
let parseEnv: (typeof import("../src/env.ts"))["parseEnv"]

const gatewayState = {
  state: "connected",
  connected: true,
  currentPhone: "+6281234567890",
  wid: "6281234567890@c.us",
  profileName: "CJ Laundry",
  pairingMethod: undefined as "qr" | "code" | undefined,
  qrCodeValue: undefined as string | undefined,
  qrCodeDataUrl: undefined as string | undefined,
  pairingCode: undefined as string | undefined,
  observedAt: new Date().toISOString(),
}

const gatewayControls = {
  nextPairingFailure: null as null | {
    status: number
    message: string
    code: string
  },
  nextPairingNetworkFailure: false,
  forceUnauthorizedForPairing: false,
  lastSendPayload: null as null | {
    toPhone?: string
    notificationId?: string
    media?: {
      mimeType?: string
      filename?: string
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

    if (req.headers.authorization !== "Bearer integration-test-whatsapp-token") {
      sendJson(401, { message: "Unauthorized", code: "unauthorized" })
      return
    }

    if (req.method === "GET" && req.url === "/internal/status") {
      sendJson(200, gatewayState)
      return
    }

    if (req.method === "POST" && req.url === "/internal/pairing-code") {
      if (gatewayControls.forceUnauthorizedForPairing) {
        gatewayControls.forceUnauthorizedForPairing = false
        sendJson(401, { message: "Unauthorized", code: "unauthorized" })
        return
      }

      if (gatewayControls.nextPairingNetworkFailure) {
        gatewayControls.nextPairingNetworkFailure = false
        req.socket.destroy()
        return
      }

      if (gatewayControls.nextPairingFailure) {
        const failure = gatewayControls.nextPairingFailure
        gatewayControls.nextPairingFailure = null
        sendJson(failure.status, {
          message: failure.message,
          code: failure.code,
        })
        return
      }

      gatewayState.state = "pairing"
      gatewayState.connected = false
      gatewayState.pairingMethod = "code"
      gatewayState.pairingCode = "PAIR-1234-5678"
      gatewayState.qrCodeValue = undefined
      gatewayState.qrCodeDataUrl = undefined
      gatewayState.observedAt = new Date().toISOString()
      sendJson(200, gatewayState)
      return
    }

    if (req.method === "POST" && req.url === "/internal/reconnect") {
      gatewayState.state = "connected"
      gatewayState.connected = true
      gatewayState.pairingMethod = undefined
      gatewayState.pairingCode = undefined
      gatewayState.qrCodeValue = undefined
      gatewayState.qrCodeDataUrl = undefined
      gatewayState.observedAt = new Date().toISOString()
      sendJson(200, gatewayState)
      return
    }

    if (req.method === "POST" && req.url === "/internal/reset-session") {
      gatewayState.state = "initializing"
      gatewayState.connected = false
      gatewayState.currentPhone = undefined
      gatewayState.wid = undefined
      gatewayState.profileName = undefined
      gatewayState.pairingMethod = undefined
      gatewayState.pairingCode = undefined
      gatewayState.qrCodeValue = undefined
      gatewayState.qrCodeDataUrl = undefined
      gatewayState.observedAt = new Date().toISOString()
      sendJson(200, gatewayState)
      return
    }

    if (req.method === "POST" && req.url === "/internal/send") {
      let requestBody = ""
      req.on("data", (chunk) => {
        requestBody += chunk.toString()
      })

      req.on("end", () => {
        const payload = JSON.parse(requestBody || "{}") as {
          toPhone?: string
          notificationId?: string
          media?: {
            mimeType?: string
            filename?: string
          }
        }
        gatewayControls.lastSendPayload = payload

        if (!gatewayState.connected) {
          sendJson(503, {
            message: "WhatsApp belum siap mengirim pesan",
            code: "session_not_ready",
          })
          return
        }

        if (payload.toPhone?.includes("00000")) {
          sendJson(400, {
            message: "Nomor tujuan belum terdaftar di WhatsApp",
            code: "unregistered_number",
          })
          return
        }

        sendJson(200, {
          providerMessageId: `provider:${payload.notificationId ?? Date.now().toString()}`,
          providerChatId: `${payload.toPhone?.replace(/\D/g, "")}@c.us`,
          providerAck: 1,
          sentAt: new Date().toISOString(),
        })
      })
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
  process.env.WHATSAPP_ENABLED = "true"
  process.env.WHATSAPP_GATEWAY_URL = gatewayUrl
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
  assert.match(welcomeNotification.preparedMessage, /auto-login\?token=/)
  assert.match(welcomeNotification.preparedMessage, new RegExp(`Nomor HP: ${customerPhone}`))
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
          providerChatId?: string
          sentAt?: string
        }) =>
          notification.eventType === "order_confirmed" &&
          notification.orderCode === confirmFirst.payload.order.orderCode &&
          notification.deliveryStatus === "sent" &&
          notification.receiptAvailable === true &&
          notification.manualWhatsappAvailable === false &&
          Boolean(notification.providerMessageId) &&
          Boolean(notification.providerChatId) &&
          Boolean(notification.sentAt)
      )
  )
  const confirmNotification = result.payload.find(
    (notification: { eventType: string; orderCode?: string }) =>
      notification.eventType === "order_confirmed" &&
      notification.orderCode === confirmFirst.payload.order.orderCode
  )
  assert.ok(confirmNotification)
  assert.equal(gatewayControls.lastSendPayload?.notificationId, confirmNotification.notificationId)
  assert.equal(gatewayControls.lastSendPayload?.media?.mimeType, "application/pdf")
  assert.equal(gatewayControls.lastSendPayload?.media?.filename, `${confirmNotification.orderCode}-receipt.pdf`)

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
  assert.equal(result.payload.gatewayReachable, true)
  assert.equal(result.payload.state, "connected")
  assert.equal(result.payload.connected, true)

  for (let attempt = 0; attempt < 25; attempt += 1) {
    result = await requestJson("/v1/admin/whatsapp/reconnect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: adminCookie!
      },
      body: JSON.stringify({})
    })
    assert.equal(result.payload.state, "connected")
    assert.equal(result.payload.connected, true)
  }

  result = await requestJson("/v1/admin/whatsapp/pairing-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.state, "pairing")
  assert.equal(result.payload.connected, false)
  assert.equal(result.payload.pairingMethod, "code")
  assert.equal(result.payload.pairingCode, "PAIR-1234-5678")
  assert.equal(result.payload.qrCodeDataUrl, undefined)
  assert.equal(result.payload.qrCodeValue, undefined)

  gatewayControls.nextPairingFailure = {
    status: 400,
    message: "Session WhatsApp belum berada pada mode pairing",
    code: "pairing_failed",
  }
  result = await requestJson("/v1/admin/whatsapp/pairing-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({}),
    expectedStatus: 400
  })
  assert.equal(result.payload.message, "Session WhatsApp belum berada pada mode pairing")
  assert.equal(result.payload.error.code, "pairing_failed")
  assert.equal(result.payload.error.details.gatewayCode, "pairing_failed")
  assert.equal(result.payload.error.details.gatewayStatus, 400)

  gatewayControls.forceUnauthorizedForPairing = true
  result = await requestJson("/v1/admin/whatsapp/pairing-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({}),
    expectedStatus: 503
  })
  assert.match(result.payload.message, /WHATSAPP_GATEWAY_TOKEN/)
  assert.equal(result.payload.error.code, "unauthorized")
  assert.equal(result.payload.error.details.gatewayCode, "unauthorized")
  assert.equal(result.payload.error.details.gatewayStatus, 401)

  gatewayControls.nextPairingNetworkFailure = true
  result = await requestJson("/v1/admin/whatsapp/pairing-code", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({}),
    expectedStatus: 503
  })
  assert.equal(result.payload.message, "Gateway WhatsApp tidak tersedia untuk pairing code")
  assert.equal(result.payload.error.code, "dependency_unavailable")

  result = await requestJson("/v1/admin/whatsapp/reconnect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.state, "connected")
  assert.equal(result.payload.connected, true)

  result = await requestJson("/v1/admin/whatsapp/reset-session", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.state, "initializing")
  assert.equal(result.payload.connected, false)
  assert.equal(result.payload.currentPhone, undefined)
  assert.equal(result.payload.profileName, undefined)
  assert.equal(result.payload.pairingMethod, undefined)
  assert.equal(result.payload.pairingCode, undefined)
  assert.equal(result.payload.qrCodeDataUrl, undefined)

  result = await requestJson("/v1/admin/whatsapp/reconnect", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.state, "connected")
  assert.equal(result.payload.connected, true)

  result = await requestJson("/v1/admin/whatsapp/chats", {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.length, 0)

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
      direction: "outbound",
      messageType: "image",
      caption: "Order confirmed mirror",
      timestampIso: new Date().toISOString(),
      phone: `+62${customerPhone.slice(1)}`,
      displayName: upperCustomerName,
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
  assert.match(result.payload[0].openWhatsappUrl, /wa\.me/)

  result = await requestJson(`/v1/admin/whatsapp/chats/${encodeURIComponent(`${customerPhone.replace(/^0/, "62")}@c.us`)}/messages`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(result.payload.length, 2)
  assert.equal(result.payload[0].direction, "inbound")
  assert.equal(result.payload[1].providerAck, 2)
  assert.equal(result.payload[1].notificationId, confirmNotification.notificationId)

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
  assert.equal(result.payload.deliveryStatus, "queued")

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
        WHATSAPP_GATEWAY_TOKEN: "staging-whatsapp-token",
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
        WHATSAPP_GATEWAY_TOKEN: "production-whatsapp-token",
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
      WHATSAPP_GATEWAY_TOKEN: "staging-whatsapp-token",
      ADMIN_BOOTSTRAP_USERNAME: "admin",
      ADMIN_BOOTSTRAP_PASSWORD: "staging-bootstrap-password-123",
    })
  )
})
