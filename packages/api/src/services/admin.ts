import bcrypt from "bcryptjs"
import { DateTime } from "luxon"
import type {
  AdminDashboardResponse,
  ConfirmOrderInput,
  CreateCustomerInput,
  CustomerProfile,
  DashboardWindow,
  OrderPreviewResponse,
  SettingsResponse,
  UpdateCustomerInput,
  VoidOrderInput
} from "@cjl/contracts"
import { getDatabase } from "../db.js"
import { env } from "../env.js"
import { calculateOrderPreview } from "../lib/calculator.js"
import { formatCurrency } from "../lib/formatters.js"
import { createId, createOpaqueToken, createOrderCode } from "../lib/ids.js"
import { rebuildArchivedLeaderboard } from "../lib/leaderboard.js"
import { normalizeName, normalizePhone } from "../lib/normalization.js"
import { formatDateTime, formatRelativeLabel, formatWeightLabel, monthKeyFromIso, nowJakarta } from "../lib/time.js"
import type {
  AdminDocument,
  CustomerDocument,
  DirectOrderTokenDocument,
  IdempotencyKeyDocument,
  NotificationDocument,
  OrderDocument,
  PointLedgerDocument,
  SettingsDocument
} from "../types.js"
import {
  buildOrderReceipt,
  buildPreparedMessage,
  filterCustomersByQuery,
  getSettingsDocument,
  insertPointLedger,
  mapCustomerProfile,
  mapCustomerSearch,
  mapNotification,
  mapOrderHistory,
  mapPointLedger,
  processNotification,
  queueNotification,
  saveAuditLog
} from "./common.js"

const db = () => getDatabase()

const nextOrderSequence = async () =>
  (await db().collection<OrderDocument>("orders").countDocuments({})) + 1

const isInDashboardWindow = (iso: string, window: DashboardWindow) => {
  const reference = nowJakarta()
  const unit = window === "daily" ? "day" : window === "weekly" ? "week" : "month"
  const start = reference.startOf(unit)
  const end = reference.endOf(unit)
  const value = DateTime.fromISO(iso).setZone(env.APP_TIMEZONE)

  return value >= start && value <= end
}

export const findAdminByUsername = async (username: string) =>
  db().collection<AdminDocument>("admins").findOne({ username })

export const verifyAdminPassword = async (admin: AdminDocument, password: string) =>
  bcrypt.compare(password, admin.passwordHash)

export const getAdminDashboard = async (window: DashboardWindow): Promise<AdminDashboardResponse> => {
  const orders = await db().collection<OrderDocument>("orders").find({ status: { $ne: "Voided" } }).toArray()
  const ordersInWindow = orders.filter((order) => isInDashboardWindow(order.createdAt, window))
  const notifications = await db().collection<NotificationDocument>("notifications").find({}).sort({ createdAt: -1 }).limit(12).toArray()
  const activeOrders = await db().collection<OrderDocument>("orders").find({ status: "Active" }).sort({ createdAt: -1 }).limit(8).toArray()
  const grossSales = ordersInWindow.reduce((sum, order) => sum + order.subtotal, 0)
  const netSales = ordersInWindow.reduce((sum, order) => sum + order.total, 0)
  const discountTotal = ordersInWindow.reduce((sum, order) => sum + order.discount, 0)
  const pointsEarned = ordersInWindow.reduce((sum, order) => sum + order.earnedStamps, 0)
  const completedOrderCount = ordersInWindow.filter((order) => order.status === "Done").length

  return {
    metrics: [
      {
        id: "net-sales",
        label: window === "daily" ? "Penjualan Hari Ini" : window === "weekly" ? "Penjualan Minggu Ini" : "Penjualan Bulan Ini",
        value: formatCurrency(netSales),
        deltaLabel: discountTotal > 0 ? `${formatCurrency(discountTotal)} diskon` : undefined,
        tone: "positive"
      },
      {
        id: "active-orders",
        label: "Order Aktif",
        value: String(activeOrders.length),
        tone: "neutral"
      },
      {
        id: "completed-orders",
        label: "Order Selesai",
        value: String(completedOrderCount),
        tone: "positive"
      },
      {
        id: "points-earned",
        label: "Poin Diberikan",
        value: String(pointsEarned),
        deltaLabel: grossSales > 0 ? formatCurrency(grossSales) : undefined,
        tone: "positive"
      }
    ],
    activeOrders: activeOrders.map((order) => ({
      orderId: order._id,
      orderCode: order.orderCode,
      customerName: order.customerName,
      phone: order.customerPhone,
      createdAtLabel: formatRelativeLabel(order.createdAt),
      weightKgLabel: formatWeightLabel(order.weightKg),
      serviceSummary: order.items.map((item) => `${item.quantity} ${item.serviceLabel}`).join(", "),
      earnedStamps: order.earnedStamps,
      redeemedPoints: order.redeemedPoints,
      status: "Active"
    })),
    notifications: notifications.map(mapNotification)
  }
}

export const listCustomers = async (query?: string) => {
  const customers = await db().collection<CustomerDocument>("customers").find({}).sort({ createdAt: -1 }).toArray()
  const mapped = await Promise.all(customers.map(mapCustomerSearch))
  return filterCustomersByQuery(query, mapped)
}

export const createCustomer = async (input: CreateCustomerInput) => {
  const normalizedPhone = normalizePhone(input.phone)
  const existing = await db().collection<CustomerDocument>("customers").findOne({ normalizedPhone })
  if (existing) {
    return {
      customer: await mapCustomerSearch(existing),
      duplicate: true
    }
  }

  const now = new Date().toISOString()
  const customer: CustomerDocument = {
    _id: createId("customer"),
    name: input.name.trim(),
    normalizedName: normalizeName(input.name),
    phone: normalizedPhone,
    normalizedPhone,
    currentPoints: 0,
    createdAt: now,
    updatedAt: now
  }

  await db().collection<CustomerDocument>("customers").insertOne(customer)
  await saveAuditLog("customer.created", "customer", customer._id, { phone: customer.phone })
  const settings = await getSettingsDocument()
  const preparedMessage = await buildPreparedMessage("welcome", {
    customerName: customer.name,
    customerPhone: customer.phone,
    laundryName: settings.business.laundryName
  })
  await queueNotification({
    _id: createId("notification"),
    customerId: customer._id,
    customerName: customer.name,
    destinationPhone: customer.phone,
    eventType: "welcome",
    deliveryStatus: "queued",
    renderStatus: "not_required",
    attemptCount: 0,
    preparedMessage,
    businessKey: `welcome:${customer._id}`,
    createdAt: now,
    updatedAt: now
  })

  return {
    customer: await mapCustomerSearch(customer),
    duplicate: false
  }
}

export const getCustomerDetail = async (customerId: string) => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }
  const orders = await db().collection<OrderDocument>("orders").find({ customerId }).sort({ createdAt: -1 }).toArray()
  const pointLedger = await db().collection<PointLedgerDocument>("point_ledgers").find({ customerId }).sort({ createdAt: -1 }).toArray()
  const activeOrderCount = orders.filter((order) => order.status === "Active").length
  const profile: CustomerProfile = mapCustomerProfile(
    customer,
    orders.length,
    activeOrderCount,
    orders[0] ? formatRelativeLabel(orders[0].createdAt) : undefined
  )

  return {
    profile,
    pointLedger: pointLedger.map(mapPointLedger),
    orderHistory: orders.map(mapOrderHistory)
  }
}

export const updateCustomerIdentity = async (customerId: string, input: UpdateCustomerInput) => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }
  const normalizedPhone = normalizePhone(input.phone)
  const duplicate = await db().collection<CustomerDocument>("customers").findOne({
    normalizedPhone,
    _id: { $ne: customerId }
  })
  if (duplicate) {
    throw new Error("Nomor HP sudah digunakan pelanggan lain")
  }

  await db().collection<CustomerDocument>("customers").updateOne(
    { _id: customerId },
    {
      $set: {
        name: input.name.trim(),
        normalizedName: normalizeName(input.name),
        phone: normalizedPhone,
        normalizedPhone,
        updatedAt: new Date().toISOString()
      }
    }
  )
  await saveAuditLog("customer.updated", "customer", customerId, { phone: normalizedPhone })
  const settings = await getSettingsDocument()
  const preparedMessage = await buildPreparedMessage("account_info", {
    customerName: input.name.trim(),
    customerPhone: normalizedPhone,
    laundryName: settings.business.laundryName
  })
  await queueNotification({
    _id: createId("notification"),
    customerId,
    customerName: input.name.trim(),
    destinationPhone: normalizedPhone,
    eventType: "account_info",
    deliveryStatus: "queued",
    renderStatus: "not_required",
    attemptCount: 0,
    preparedMessage,
    businessKey: `account-info:${customerId}:${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  })

  return getCustomerDetail(customerId)
}

export const addManualPoints = async (customerId: string, points: number, reason: string) => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }
  const balanceAfter = customer.currentPoints + points
  await db().collection<CustomerDocument>("customers").updateOne(
    { _id: customerId },
    { $set: { currentPoints: balanceAfter, updatedAt: new Date().toISOString() } }
  )
  await insertPointLedger({
    _id: createId("ledger"),
    customerId,
    label: `Penyesuaian Admin - ${reason}`,
    delta: points,
    balanceAfter,
    tone: "adjustment",
    leaderboardDelta: 0,
    createdAt: new Date().toISOString()
  })
  await saveAuditLog("customer.points.adjusted", "customer", customerId, { points, reason })
  return getCustomerDetail(customerId)
}

export const getOrderPreview = async (input: ConfirmOrderInput): Promise<OrderPreviewResponse> => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: input.customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }
  const settings = await getSettingsDocument()
  const preview = calculateOrderPreview(settings.services.filter((service) => service.isActive), customer.currentPoints, input)
  if (preview.activeItems.length === 0) {
    throw new Error("Pilih minimal satu layanan")
  }

  return {
    customerName: customer.name,
    weightKg: input.weightKg,
    subtotal: preview.subtotal,
    subtotalLabel: formatCurrency(preview.subtotal),
    discount: preview.discount,
    discountLabel: preview.discount > 0 ? `-${formatCurrency(preview.discount)}` : formatCurrency(0),
    total: preview.total,
    totalLabel: formatCurrency(preview.total),
    earnedStamps: preview.earnedStamps,
    redeemedPoints: preview.redeemedPoints,
    resultingPointBalance: preview.resultingPointBalance,
    maxRedeemableWashers: preview.maxRedeemableWashers,
    items: preview.activeItems.map((item) => ({
      serviceCode: item.serviceCode,
      serviceLabel: item.serviceLabel,
      quantity: item.quantity,
      quantityLabel: item.quantityLabel,
      unitPrice: item.unitPrice,
      unitPriceLabel: formatCurrency(item.unitPrice),
      lineTotal: item.lineTotal,
      lineTotalLabel: formatCurrency(item.lineTotal)
    }))
  }
}

export const confirmOrder = async (input: ConfirmOrderInput) => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: input.customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }
  const settings = await getSettingsDocument()
  const preview = calculateOrderPreview(settings.services.filter((service) => service.isActive), customer.currentPoints, input)
  if (preview.activeItems.length === 0) {
    throw new Error("Pilih minimal satu layanan")
  }
  const now = new Date().toISOString()
  const orderId = createId("order")
  const orderCode = createOrderCode(await nextOrderSequence())
  const directToken = createOpaqueToken()
  const order: OrderDocument = {
    _id: orderId,
    orderCode,
    customerId: customer._id,
    customerName: customer.name,
    customerPhone: customer.phone,
    weightKg: input.weightKg,
    items: preview.activeItems.map((item) => ({
      serviceCode: item.serviceCode,
      serviceLabel: item.serviceLabel,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      pricingModel: item.pricingModel,
      lineTotal: item.lineTotal
    })),
    subtotal: preview.subtotal,
    discount: preview.discount,
    total: preview.total,
    redeemedPoints: preview.redeemedPoints,
    earnedStamps: preview.earnedStamps,
    resultingPointBalance: preview.resultingPointBalance,
    directToken,
    status: "Active",
    createdAt: now
  }

  await db().collection<OrderDocument>("orders").insertOne(order)
  await db().collection<DirectOrderTokenDocument>("direct_order_tokens").insertOne({
    _id: createId("token"),
    token: directToken,
    orderId,
    createdAt: now
  })
  await db().collection<CustomerDocument>("customers").updateOne(
    { _id: customer._id },
    { $set: { currentPoints: preview.resultingPointBalance, updatedAt: now } }
  )

  if (preview.redeemedPoints > 0) {
    await insertPointLedger({
      _id: createId("ledger"),
      customerId: customer._id,
      orderId,
      orderCode,
      label: `Order ${orderCode} - Redeem Washer gratis`,
      delta: -preview.redeemedPoints,
      balanceAfter: customer.currentPoints - preview.redeemedPoints,
      tone: "redeemed",
      leaderboardDelta: 0,
      createdAt: now
    })
  }

  await insertPointLedger({
    _id: createId("ledger"),
    customerId: customer._id,
    orderId,
    orderCode,
    label: `Order ${orderCode} - Stamp diperoleh`,
    delta: preview.earnedStamps,
    balanceAfter: preview.resultingPointBalance,
    tone: "earned",
    leaderboardDelta: preview.earnedStamps,
    createdAt: now
  })
  await saveAuditLog("order.confirmed", "order", orderId, { orderCode })

  const preparedMessage = await buildPreparedMessage("order_confirmed", {
    customerName: customer.name,
    orderCode,
    createdAt: formatDateTime(now),
    earnedStamps: preview.earnedStamps,
    redeemedPoints: preview.redeemedPoints,
    currentPoints: preview.resultingPointBalance,
    statusUrl: `${env.PUBLIC_ORIGIN}/status/${directToken}`
  })
  await queueNotification({
    _id: createId("notification"),
    customerId: customer._id,
    customerName: customer.name,
    destinationPhone: customer.phone,
    orderId,
    orderCode,
    eventType: "order_confirmed",
    renderStatus: "ready",
    deliveryStatus: "queued",
    attemptCount: 0,
    preparedMessage,
    businessKey: `order-confirmed:${orderId}`,
    createdAt: now,
    updatedAt: now
  })

  return {
    order: mapOrderHistory(order),
    directToken
  }
}

export const listActiveOrders = async () => {
  const orders = await db().collection<OrderDocument>("orders").find({ status: "Active" }).sort({ createdAt: -1 }).toArray()
  return orders.map((order) => ({
    orderId: order._id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    phone: order.customerPhone,
    createdAtLabel: formatRelativeLabel(order.createdAt),
    weightKgLabel: formatWeightLabel(order.weightKg),
    serviceSummary: order.items.map((item) => `${item.quantity} ${item.serviceLabel}`).join(", "),
    earnedStamps: order.earnedStamps,
    redeemedPoints: order.redeemedPoints,
    status: "Active" as const
  }))
}

export const getOrderById = async (orderId: string) => {
  const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId })
  if (!order) {
    throw new Error("Order tidak ditemukan")
  }
  return mapOrderHistory(order)
}

export const markOrderDone = async (orderId: string) => {
  const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId })
  if (!order) {
    throw new Error("Order tidak ditemukan")
  }
  if (order.status === "Voided") {
    throw new Error("Order yang sudah dibatalkan tidak bisa diselesaikan")
  }
  if (order.status === "Done") {
    throw new Error("Order sudah diselesaikan")
  }
  const completedAt = new Date().toISOString()
  await db().collection<OrderDocument>("orders").updateOne(
    { _id: orderId },
    { $set: { status: "Done", completedAt } }
  )
  await saveAuditLog("order.done", "order", orderId, { completedAt })
  const preparedMessage = await buildPreparedMessage("order_done", {
    customerName: order.customerName,
    orderCode: order.orderCode,
    createdAt: formatDateTime(order.createdAt),
    completedAt: formatDateTime(completedAt)
  })
  await queueNotification({
    _id: createId("notification"),
    customerId: order.customerId,
    customerName: order.customerName,
    destinationPhone: order.customerPhone,
    orderId: order._id,
    orderCode: order.orderCode,
    eventType: "order_done",
    renderStatus: "not_required",
    deliveryStatus: "queued",
    attemptCount: 0,
    preparedMessage,
    businessKey: `order-done:${order._id}`,
    createdAt: completedAt,
    updatedAt: completedAt
  })
  return getOrderById(orderId)
}

export const voidOrder = async (orderId: string, input: VoidOrderInput) => {
  const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId })
  if (!order) {
    throw new Error("Order tidak ditemukan")
  }
  if (order.status === "Voided") {
    throw new Error("Order sudah dibatalkan")
  }
  const voidedAt = new Date().toISOString()
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: order.customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }
  const newBalance = customer.currentPoints + order.redeemedPoints - order.earnedStamps
  await db().collection<OrderDocument>("orders").updateOne(
    { _id: orderId },
    { $set: { status: "Voided", voidedAt, voidReason: input.reason } }
  )
  await db().collection<CustomerDocument>("customers").updateOne(
    { _id: customer._id },
    { $set: { currentPoints: newBalance, updatedAt: voidedAt } }
  )

  if (order.earnedStamps > 0) {
    await insertPointLedger({
      _id: createId("ledger"),
      customerId: customer._id,
      orderId: order._id,
      orderCode: order.orderCode,
      label: `Pembatalan order ${order.orderCode} - Balik stamp`,
      delta: -order.earnedStamps,
      balanceAfter: customer.currentPoints - order.earnedStamps,
      tone: "reversal",
      leaderboardDelta: 0,
      createdAt: voidedAt
    })
  }

  if (order.redeemedPoints > 0) {
    await insertPointLedger({
      _id: createId("ledger"),
      customerId: customer._id,
      orderId: order._id,
      orderCode: order.orderCode,
      label: `Pembatalan order ${order.orderCode} - Kembalikan redeem`,
      delta: order.redeemedPoints,
      balanceAfter: newBalance,
      tone: "reversal",
      leaderboardDelta: 0,
      createdAt: voidedAt
    })
  }

  await saveAuditLog("order.voided", "order", order._id, { reason: input.reason })
  await rebuildArchivedLeaderboard(monthKeyFromIso(order.createdAt), `void-order:${order.orderCode}`)

  if (input.notifyCustomer) {
    const preparedMessage = await buildPreparedMessage("order_void_notice", {
      customerName: order.customerName,
      orderCode: order.orderCode,
      reason: input.reason
    })
    await queueNotification({
      _id: createId("notification"),
      customerId: order.customerId,
      customerName: order.customerName,
      destinationPhone: order.customerPhone,
      orderId: order._id,
      orderCode: order.orderCode,
      eventType: "order_void_notice",
      renderStatus: "not_required",
      deliveryStatus: "queued",
      attemptCount: 0,
      preparedMessage,
      businessKey: `order-void:${order._id}:${Date.now()}`,
      createdAt: voidedAt,
      updatedAt: voidedAt
    })
  }

  return getOrderById(orderId)
}

export const listNotifications = async () => {
  const notifications = await db().collection<NotificationDocument>("notifications").find({}).sort({ createdAt: -1 }).toArray()
  return notifications.map(mapNotification)
}

export const resendNotification = async (notificationId: string) => {
  await db().collection<NotificationDocument>("notifications").updateOne(
    { _id: notificationId },
    { $set: { deliveryStatus: "queued", updatedAt: new Date().toISOString() } }
  )
  await processNotification(notificationId)
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new Error("Notifikasi tidak ditemukan")
  }
  return mapNotification(notification)
}

export const markNotificationManualResolved = async (notificationId: string, note: string) => {
  await db().collection<NotificationDocument>("notifications").updateOne(
    { _id: notificationId },
    {
      $set: {
        deliveryStatus: "manual_resolved",
        manualResolutionNote: note,
        updatedAt: new Date().toISOString()
      }
    }
  )
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new Error("Notifikasi tidak ditemukan")
  }
  return mapNotification(notification)
}

export const downloadNotificationReceipt = buildOrderReceipt

export const getNotificationPreparedMessage = async (notificationId: string) => {
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new Error("Notifikasi tidak ditemukan")
  }
  return notification.preparedMessage
}

export const getSettings = async (): Promise<SettingsResponse> => {
  const settings = await getSettingsDocument()
  return {
    business: settings.business,
    services: settings.services,
    messageTemplates: settings.messageTemplates
  }
}

export const updateSettings = async (payload: SettingsResponse) => {
  await db().collection<SettingsDocument>("settings").updateOne(
    { _id: "app-settings" },
    {
      $set: {
        business: payload.business,
        services: payload.services,
        messageTemplates: payload.messageTemplates,
        updatedAt: new Date().toISOString()
      }
    }
  )
  await saveAuditLog("settings.updated", "settings", "app-settings")
  return getSettings()
}

export const getIdempotentResponse = async (scope: string, key: string) =>
  db().collection<IdempotencyKeyDocument>("idempotency_keys").findOne({ scope, key })

export const saveIdempotentResponse = async (scope: string, key: string, response: unknown) => {
  await db().collection<IdempotencyKeyDocument>("idempotency_keys").updateOne(
    { scope, key },
    {
      $set: {
        scope,
        key,
        response,
        createdAt: new Date().toISOString()
      }
    },
    { upsert: true }
  )
}
