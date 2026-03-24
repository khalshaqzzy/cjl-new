import assert from "node:assert/strict"
import test from "node:test"
import type { Server } from "node:http"
import { DateTime } from "luxon"
import { MongoMemoryReplSet } from "mongodb-memory-server"

const baseUrl = "http://127.0.0.1:4105"

let mongo: MongoMemoryReplSet
let server: Server
let getDatabase: (typeof import("../src/db.ts"))["getDatabase"]
let disconnectDatabase: (typeof import("../src/db.ts"))["disconnectDatabase"]
let stopBackgroundWork: (() => Promise<void>) | undefined

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

test.before(async () => {
  mongo = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" }
  })

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
  process.env.WA_FAIL_MODE = "never"

  const dbModule = await import("../src/db.ts")
  const serverModule = await import("../src/server.ts")

  getDatabase = dbModule.getDatabase
  disconnectDatabase = dbModule.disconnectDatabase

  const started = await serverModule.startServer()
  server = started.server
  stopBackgroundWork = started.stopBackgroundWork
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

  await stopBackgroundWork?.()
  await disconnectDatabase()
  await mongo.stop()
})

test("backend integration flow covers auth, transactions, idempotency, outbox states, throttling, and archived leaderboard rebuilds", async () => {
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
  const adminCookie = result.response.headers.get("set-cookie")
  assert.ok(adminCookie)

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

  result = await waitFor(
    () => requestJson("/v1/admin/notifications", { headers: { Cookie: adminCookie! } }),
    (value) =>
      value.payload.some(
        (notification: { eventType: string; customerName: string; deliveryStatus: string }) =>
          notification.eventType === "welcome" &&
          notification.customerName === upperCustomerName &&
          notification.deliveryStatus === "sent"
      )
  )
  assert.ok(result.payload.length > 0)

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
    expectedStatus: 400
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

  result = await requestJson("/v1/public/me/dashboard", {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(result.payload.session.customerId, customerId)
  assert.equal(result.payload.session.name, upperCustomerName)
  assert.equal(result.payload.session.publicNameVisible, false)
  assert.ok(result.payload.activeOrders.some((order: { orderId: string }) => order.orderId === firstOrderId))

  result = await requestJson(`/v1/public/status/${firstOrderToken}`)
  assert.equal(result.payload.status, "Active")
  assert.equal("totalLabel" in result.payload, false)

  result = await requestJson(`/v1/public/me/orders/${firstOrderId}`, {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(result.payload.status, "Active")
  assert.match(result.payload.totalLabel, /30\.000/)
  assert.equal(result.payload.items.length, 2)
  assert.equal(result.payload.items[0].unitPriceLabel.startsWith("Rp"), true)

  let receiptResponse = await fetch(`${baseUrl}/v1/public/me/orders/${firstOrderId}/receipt`, {
    headers: { Cookie: publicCookie! }
  })
  assert.equal(receiptResponse.status, 200)
  assert.match(receiptResponse.headers.get("content-type") ?? "", /application\/pdf/)
  assert.ok((await receiptResponse.arrayBuffer()).byteLength > 0)

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
        }) =>
          notification.eventType === "order_confirmed" &&
          notification.orderCode === confirmFirst.payload.order.orderCode &&
          notification.deliveryStatus === "sent" &&
          notification.receiptAvailable === true &&
          notification.manualWhatsappAvailable === false
      )
  )
  const confirmNotification = result.payload.find(
    (notification: { eventType: string; orderCode?: string }) =>
      notification.eventType === "order_confirmed" &&
      notification.orderCode === confirmFirst.payload.order.orderCode
  )
  assert.ok(confirmNotification)

  receiptResponse = await fetch(`${baseUrl}/v1/admin/notifications/${confirmNotification.notificationId}/receipt`, {
    headers: { Cookie: adminCookie! }
  })
  assert.equal(receiptResponse.status, 200)
  assert.match(receiptResponse.headers.get("content-type") ?? "", /application\/pdf/)
  assert.ok((await receiptResponse.arrayBuffer()).byteLength > 0)

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
    expectedStatus: 400
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

  const blockedManualWhatsapp = await requestJson(`/v1/admin/notifications/notification_render_failure_${uniqueSuffix}/manual-whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie!
    },
    expectedStatus: 400
  })
  assert.match(blockedManualWhatsapp.payload.message, /Receipt/)

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
