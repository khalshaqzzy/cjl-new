import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import signature from "cookie-signature"
import type { Server } from "node:http"
import { DateTime } from "luxon"
import { MongoMemoryServer } from "mongodb-memory-server"

const baseUrl = "http://127.0.0.1:4105"

let mongo: MongoMemoryServer
let server: Server
let getDatabase: (typeof import("../src/db.ts"))["getDatabase"]
let disconnectDatabase: (typeof import("../src/db.ts"))["disconnectDatabase"]

const createSessionCookie = async (
  data: {
    adminUserId?: string
    customerUserId?: string
    customerProfile?: {
      customerId: string
      name: string
      phone: string
    }
  }
) => {
  const sessionId = `test-${randomUUID()}`
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)

  await getDatabase().collection("sessions").insertOne({
    _id: sessionId,
    session: JSON.stringify({
      cookie: {
        originalMaxAge: 1000 * 60 * 60 * 24 * 7,
        expires: expiresAt.toISOString(),
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        secure: false
      },
      ...data
    }),
    expires: expiresAt
  })

  return `cjl.sid=${encodeURIComponent(`s:${signature.sign(sessionId, process.env.SESSION_SECRET!)}`)}`
}

const requestJson = async (
  path: string,
  init?: RequestInit & { expectedStatus?: number }
) => {
  const response = await fetch(`${baseUrl}${path}`, init)
  const expectedStatus = init?.expectedStatus ?? 200

  assert.equal(response.status, expectedStatus)

  const text = await response.text()
  const payload = text ? JSON.parse(text) : null

  return {
    response,
    payload
  }
}

test.before(async () => {
  mongo = await MongoMemoryServer.create()

  process.env.PORT = "4105"
  process.env.MONGODB_URI = mongo.getUri("cjlaundry_api_test")
  process.env.SESSION_SECRET = "integration-test-secret"
  process.env.SESSION_COOKIE_SECURE = "false"
  process.env.ADMIN_USERNAME = "admin"
  process.env.ADMIN_PASSWORD = "admin123"
  process.env.APP_TIMEZONE = "Asia/Jakarta"
  process.env.ADMIN_ORIGIN = "http://127.0.0.1:3101"
  process.env.PUBLIC_ORIGIN = "http://127.0.0.1:3100"
  process.env.API_ORIGIN = "http://127.0.0.1:4100"
  process.env.WA_FAIL_MODE = "never"

  const dbModule = await import("../src/db.ts")
  const serverModule = await import("../src/server.ts")

  getDatabase = dbModule.getDatabase
  disconnectDatabase = dbModule.disconnectDatabase

  const started = await serverModule.startServer()
  server = started.server
})

test.after(async () => {
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
})

test("backend integration flow covers auth, orders, public access, and archived leaderboard rebuilds", async () => {
  let result = await requestJson("/v1/admin/dashboard", { expectedStatus: 401 })
  assert.equal(result.payload.message, "Unauthorized")

  result = await requestJson("/v1/public/me/dashboard", { expectedStatus: 401 })
  assert.equal(result.payload.message, "Unauthorized")

  result = await requestJson("/v1/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin", password: "admin123" })
  })
  assert.equal(result.payload.ok, true)

  const adminCookie = await createSessionCookie({ adminUserId: "admin-primary" })

  const uniqueSuffix = Date.now().toString().slice(-6)
  const customerName = `Budi Integration ${uniqueSuffix}`
  const customerPhone = `08123${uniqueSuffix}`

  result = await requestJson("/v1/admin/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie
    },
    body: JSON.stringify({ name: customerName, phone: customerPhone })
  })

  assert.equal(result.payload.duplicate, false)
  assert.equal(result.payload.customer.name, customerName)
  assert.equal(result.payload.customer.phone, `+62${customerPhone.slice(1)}`)

  const customerId = result.payload.customer.customerId as string

  result = await requestJson("/v1/admin/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie
    },
    body: JSON.stringify({ name: customerName, phone: customerPhone })
  })

  assert.equal(result.payload.duplicate, true)
  assert.equal(result.payload.customer.customerId, customerId)

  result = await requestJson("/v1/admin/notifications", {
    headers: { Cookie: adminCookie }
  })

  assert.ok(
    result.payload.some(
      (notification: { eventType: string; customerName: string; deliveryStatus: string }) =>
        notification.eventType === "welcome" &&
        notification.customerName === customerName &&
        notification.deliveryStatus === "sent"
    )
  )

  result = await requestJson(`/v1/admin/customers/${customerId}/points`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie
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
      Cookie: adminCookie
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
      Cookie: adminCookie,
      "Idempotency-Key": confirmKey
    },
    body: JSON.stringify(firstOrderPayload)
  })
  const confirmFirstReplay = await requestJson("/v1/admin/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "Idempotency-Key": confirmKey
    },
    body: JSON.stringify(firstOrderPayload)
  })

  assert.equal(confirmFirst.payload.order.orderCode, confirmFirstReplay.payload.order.orderCode)

  const firstOrderId = confirmFirst.payload.order.orderId as string
  const firstOrderToken = confirmFirst.payload.directToken as string

  result = await requestJson(`/v1/admin/customers/${customerId}`, {
    headers: { Cookie: adminCookie }
  })
  assert.equal(result.payload.profile.currentPoints, 12)

  result = await requestJson("/v1/admin/orders/active", {
    headers: { Cookie: adminCookie }
  })
  assert.ok(result.payload.some((order: { orderId: string }) => order.orderId === firstOrderId))

  result = await requestJson("/v1/public/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: customerPhone, name: customerName })
  })
  assert.equal(result.payload.ok, true)

  const publicCookie = await createSessionCookie({
    customerUserId: customerId,
    customerProfile: {
      customerId,
      name: customerName,
      phone: `+62${customerPhone.slice(1)}`
    }
  })

  result = await requestJson("/v1/public/me/dashboard", {
    headers: { Cookie: publicCookie }
  })
  assert.equal(result.payload.session.customerId, customerId)
  assert.ok(result.payload.activeOrders.some((order: { orderId: string }) => order.orderId === firstOrderId))

  result = await requestJson(`/v1/public/status/${firstOrderToken}`)
  assert.equal(result.payload.status, "Active")

  result = await requestJson(`/v1/admin/orders/${firstOrderId}/done`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
      "Idempotency-Key": `done-${uniqueSuffix}`
    },
    body: JSON.stringify({})
  })
  assert.equal(result.payload.status, "Done")

  result = await requestJson(`/v1/public/me/orders/${firstOrderId}`, {
    headers: { Cookie: publicCookie }
  })
  assert.equal(result.payload.status, "Done")

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
      Cookie: adminCookie,
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
      Cookie: adminCookie,
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
    headers: { Cookie: publicCookie }
  })
  assert.equal(result.payload.status, "Cancelled")

  result = await requestJson(`/v1/public/status/${archivedOrderToken}`)
  assert.equal(result.payload.status, "Cancelled")

  result = await requestJson(`/v1/admin/customers/${customerId}`, {
    headers: { Cookie: adminCookie }
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

  result = await requestJson("/v1/admin/notifications", {
    headers: { Cookie: adminCookie }
  })
  assert.ok(
    result.payload.some(
      (notification: { eventType: string; orderCode?: string; deliveryStatus: string }) =>
        notification.eventType === "order_void_notice" &&
        notification.orderCode === archivedOrderCode &&
        notification.deliveryStatus === "sent"
    )
  )
})
