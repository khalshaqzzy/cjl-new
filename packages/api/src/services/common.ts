import type {
  CustomerProfile,
  NotificationRecord,
  OrderHistoryItem,
  PointLedgerItem
} from "@cjl/contracts"
import { getDatabase } from "../db.js"
import { createId } from "../lib/ids.js"
import { formatCurrency } from "../lib/formatters.js"
import { buildReceiptText, compileTemplate, shouldForceNotificationFailure } from "../lib/notifications.js"
import { normalizeName } from "../lib/normalization.js"
import { formatDateTime, formatRelativeLabel, formatWeightLabel } from "../lib/time.js"
import type {
  AuditLogDocument,
  CustomerDocument,
  NotificationDocument,
  OrderDocument,
  PointLedgerDocument,
  SettingsDocument
} from "../types.js"

const db = () => getDatabase()

export const getSettingsDocument = async () => {
  const settings = await db().collection<SettingsDocument>("settings").findOne({ _id: "app-settings" })
  if (!settings) {
    throw new Error("Settings belum tersedia")
  }
  return settings
}

export const saveAuditLog = async (
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>
) => {
  await db().collection<AuditLogDocument>("audit_logs").insertOne({
    _id: createId("audit"),
    actorType: "admin",
    actorId: "admin-primary",
    action,
    entityType,
    entityId,
    metadata,
    createdAt: new Date().toISOString()
  })
}

export const mapNotification = (notification: NotificationDocument): NotificationRecord => ({
  notificationId: notification._id,
  eventType: notification.eventType,
  customerName: notification.customerName,
  destinationPhone: notification.destinationPhone,
  orderCode: notification.orderCode,
  renderStatus: notification.renderStatus,
  deliveryStatus: notification.deliveryStatus,
  latestFailureReason: notification.latestFailureReason,
  attemptCount: notification.attemptCount,
  lastAttemptAt: notification.lastAttemptAt ? formatRelativeLabel(notification.lastAttemptAt) : undefined,
  preparedMessage: notification.preparedMessage,
  manualResolutionNote: notification.manualResolutionNote
})

export const mapOrderHistory = (order: OrderDocument): OrderHistoryItem => ({
  orderId: order._id,
  orderCode: order.orderCode,
  createdAtLabel: formatDateTime(order.createdAt),
  completedAtLabel: order.completedAt ? formatDateTime(order.completedAt) : undefined,
  cancelledAtLabel: order.voidedAt ? formatDateTime(order.voidedAt) : undefined,
  cancellationSummary: order.voidReason,
  weightKgLabel: formatWeightLabel(order.weightKg),
  serviceSummary: order.items.map((item) => `${item.quantity}x ${item.serviceLabel}`).join(", "),
  totalLabel: formatCurrency(order.total),
  earnedStamps: order.earnedStamps,
  redeemedPoints: order.redeemedPoints,
  status: order.status === "Voided" ? "Cancelled" : order.status
})

export const mapPointLedger = (entry: PointLedgerDocument): PointLedgerItem => ({
  entryId: entry._id,
  label: entry.label,
  delta: entry.delta,
  balanceAfter: entry.balanceAfter,
  createdAtLabel: formatDateTime(entry.createdAt),
  tone: entry.tone,
  relatedOrderCode: entry.orderCode
})

export const mapCustomerProfile = (
  customer: CustomerDocument,
  orderCount: number,
  activeOrderCount: number,
  lastActivityAt?: string
): CustomerProfile => ({
  customerId: customer._id,
  name: customer.name,
  phone: customer.phone,
  currentPoints: customer.currentPoints,
  activeOrderCount,
  totalOrders: orderCount,
  lastActivityAt
})

export const buildPreparedMessage = async (
  eventType: NotificationDocument["eventType"],
  params: Record<string, string | number | undefined>
) => {
  const settings = await getSettingsDocument()
  const template = {
    welcome: settings.messageTemplates.welcome,
    order_confirmed: settings.messageTemplates.orderConfirmed,
    order_done: settings.messageTemplates.orderDone,
    order_void_notice: settings.messageTemplates.orderVoidNotice,
    account_info: settings.messageTemplates.accountInfo
  }[eventType]

  return compileTemplate(template, params)
}

export const insertPointLedger = async (entry: PointLedgerDocument) => {
  await db().collection<PointLedgerDocument>("point_ledgers").insertOne(entry)
}

export const processNotification = async (notificationId: string) => {
  const collection = db().collection<NotificationDocument>("notifications")
  const notification = await collection.findOne({ _id: notificationId })
  if (!notification) {
    return
  }

  const now = new Date().toISOString()
  if (shouldForceNotificationFailure(notification.eventType)) {
    await collection.updateOne(
      { _id: notificationId },
      {
        $set: {
          deliveryStatus: "failed",
          latestFailureReason: "Simulasi kegagalan WhatsApp aktif",
          lastAttemptAt: now,
          updatedAt: now
        },
        $inc: { attemptCount: 1 }
      }
    )
    return
  }

  await collection.updateOne(
    { _id: notificationId },
    {
      $set: {
        deliveryStatus: "sent",
        latestFailureReason: undefined,
        renderStatus: notification.renderStatus ?? "not_required",
        lastAttemptAt: now,
        updatedAt: now
      },
      $inc: { attemptCount: 1 }
    }
  )
}

export const queueNotification = async (notification: NotificationDocument) => {
  await db().collection<NotificationDocument>("notifications").insertOne(notification)
  await processNotification(notification._id)
}

export const mapCustomerSearch = async (customer: CustomerDocument) => {
  const activeOrderCount = await db().collection<OrderDocument>("orders").countDocuments({
    customerId: customer._id,
    status: "Active"
  })
  const latestOrder = await db()
    .collection<OrderDocument>("orders")
    .find({ customerId: customer._id })
    .sort({ createdAt: -1 })
    .limit(1)
    .next()

  return {
    customerId: customer._id,
    name: customer.name,
    phone: customer.phone,
    currentPoints: customer.currentPoints,
    activeOrderCount,
    recentActivityAt: latestOrder ? formatRelativeLabel(latestOrder.createdAt) : undefined
  }
}

export const filterCustomersByQuery = (
  query: string | undefined,
  customers: Array<Awaited<ReturnType<typeof mapCustomerSearch>>>
) => {
  if (!query?.trim()) {
    return customers
  }

  const normalizedQuery = normalizeName(query)
  return customers.filter(
    (customer) =>
      normalizeName(customer.name).includes(normalizedQuery) ||
      customer.phone.replace(/\s/g, "").includes(query.replace(/\s/g, ""))
  )
}

export const buildOrderReceipt = async (notificationId: string) => {
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification || !notification.orderId || !notification.orderCode) {
    throw new Error("Receipt tidak tersedia")
  }

  const order = await db().collection<OrderDocument>("orders").findOne({ _id: notification.orderId })
  if (!order) {
    throw new Error("Order receipt tidak ditemukan")
  }

  return buildReceiptText({
    orderCode: order.orderCode,
    customerName: order.customerName,
    serviceSummary: order.items.map((item) => `${item.quantity}x ${item.serviceLabel}`).join(", "),
    totalLabel: formatCurrency(order.total),
    createdAt: order.createdAt
  })
}
