import type { ClientSession, Filter } from "mongodb"
import type {
  CustomerProfile,
  NotificationRecord,
  OrderHistoryItem,
  PointLedgerItem
} from "@cjl/contracts"
import { env } from "../env.js"
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

let outboxTimer: NodeJS.Timeout | null = null
let outboxTickActive = false
let outboxEnabled = false

const notificationsCollection = () => db().collection<NotificationDocument>("notifications")

export const getSettingsDocument = async (session?: ClientSession) => {
  const settings = await db()
    .collection<SettingsDocument>("settings")
    .findOne({ _id: "app-settings" }, { session })

  if (!settings) {
    throw new Error("Settings belum tersedia")
  }

  return settings
}

export const saveAuditLog = async (
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
  session?: ClientSession
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
  }, { session })
}

export const mapNotification = (notification: NotificationDocument): NotificationRecord => ({
  notificationId: notification._id,
  eventType: notification.eventType,
  customerName: notification.customerName,
  destinationPhone: notification.destinationPhone,
  orderCode: notification.orderCode,
  createdAtLabel: formatDateTime(notification.createdAt),
  renderStatus: notification.renderStatus,
  deliveryStatus: notification.deliveryStatus,
  latestFailureReason: notification.latestFailureReason,
  attemptCount: notification.attemptCount,
  lastAttemptAt: notification.lastAttemptAt ? formatRelativeLabel(notification.lastAttemptAt) : undefined,
  preparedMessage: notification.preparedMessage,
  manualResolutionNote: notification.manualResolutionNote,
  manualResolvedAt: notification.manualResolvedAt ? formatDateTime(notification.manualResolvedAt) : undefined
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
  params: Record<string, string | number | undefined>,
  session?: ClientSession
) => {
  const settings = await getSettingsDocument(session)
  const template = {
    welcome: settings.messageTemplates.welcome,
    order_confirmed: settings.messageTemplates.orderConfirmed,
    order_done: settings.messageTemplates.orderDone,
    order_void_notice: settings.messageTemplates.orderVoidNotice,
    account_info: settings.messageTemplates.accountInfo
  }[eventType]

  return compileTemplate(template, params)
}

export const insertPointLedger = async (entry: PointLedgerDocument, session?: ClientSession) => {
  await db().collection<PointLedgerDocument>("point_ledgers").insertOne(entry, { session })
}

export const queueNotification = async (notification: NotificationDocument, session?: ClientSession) => {
  await notificationsCollection().insertOne(notification, { session })
}

const createRenderedReceipt = async (notification: NotificationDocument) => {
  if (!notification.orderId) {
    throw new Error("Receipt tidak tersedia untuk notifikasi ini")
  }

  const order = await db().collection<OrderDocument>("orders").findOne({ _id: notification.orderId })
  if (!order) {
    throw new Error("Order receipt tidak ditemukan")
  }

  return buildReceiptText(order.receiptSnapshot)
}

const markNotificationFailed = async (
  notificationId: string,
  reason: string,
  nextState: Partial<NotificationDocument>
) => {
  const now = new Date().toISOString()
  await notificationsCollection().updateOne(
    { _id: notificationId },
    {
      $set: {
        ...nextState,
        latestFailureReason: reason,
        lastAttemptAt: now,
        updatedAt: now
      },
      $inc: { attemptCount: 1 }
    }
  )
}

export const processNotification = async (notificationId: string) => {
  const notification = await notificationsCollection().findOne({ _id: notificationId })
  if (!notification) {
    return
  }

  if (notification.deliveryStatus === "sent" || notification.deliveryStatus === "manual_resolved") {
    return
  }

  const now = new Date().toISOString()

  if (notification.eventType === "order_confirmed") {
    if (notification.renderStatus === "pending") {
      try {
        const renderedReceipt = await createRenderedReceipt(notification)
        await notificationsCollection().updateOne(
          { _id: notificationId },
          {
            $set: {
              renderStatus: "ready",
              renderedReceipt,
              updatedAt: now
            },
            $unset: {
              latestFailureReason: ""
            }
          }
        )
      } catch (error) {
        await markNotificationFailed(
          notificationId,
          error instanceof Error ? error.message : "Gagal merender receipt",
          {
            renderStatus: "failed",
            deliveryStatus: "failed"
          }
        )
        return
      }
    }

    const refreshed = await notificationsCollection().findOne({ _id: notificationId })
    if (!refreshed || refreshed.renderStatus !== "ready") {
      return
    }
  }

  if (shouldForceNotificationFailure(notification.eventType)) {
    await markNotificationFailed(notificationId, "Simulasi kegagalan WhatsApp aktif", {
      deliveryStatus: "failed"
    })
    return
  }

  await notificationsCollection().updateOne(
    { _id: notificationId },
    {
      $set: {
        deliveryStatus: "sent",
        lastAttemptAt: now,
        updatedAt: now
      },
      $unset: {
        latestFailureReason: ""
      },
      $inc: { attemptCount: 1 }
    }
  )
}

const processQueuedNotifications = async () => {
  if (!outboxEnabled) {
    return
  }

  if (outboxTickActive) {
    return
  }

  outboxTickActive = true

  try {
    const notifications = await notificationsCollection()
      .find({
        $or: [
          { deliveryStatus: "queued" },
          { eventType: "order_confirmed", renderStatus: "pending", deliveryStatus: "failed" }
        ]
      })
      .sort({ createdAt: 1 })
      .limit(10)
      .toArray()

    for (const notification of notifications) {
      await processNotification(notification._id)
    }
  } catch {
    // Swallow background worker errors so shutdown or transient DB interruptions
    // do not crash the process; operational visibility stays in notification state.
  } finally {
    outboxTickActive = false
  }
}

export const startOutboxWorker = () => {
  if (outboxTimer) {
    return
  }

  outboxEnabled = true
  outboxTimer = setInterval(() => {
    void processQueuedNotifications()
  }, env.OUTBOX_POLL_MS)

  void processQueuedNotifications()
}

export const stopOutboxWorker = async () => {
  outboxEnabled = false
  if (outboxTimer) {
    clearInterval(outboxTimer)
    outboxTimer = null
  }

  while (outboxTickActive) {
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
}

export const markNotificationForRetry = async (notificationId: string) => {
  const notification = await notificationsCollection().findOne({ _id: notificationId })
  if (!notification) {
    throw new Error("Notifikasi tidak ditemukan")
  }

  const now = new Date().toISOString()
  await notificationsCollection().updateOne(
    { _id: notificationId },
    {
      $set: {
        deliveryStatus: "queued",
        renderStatus: notification.eventType === "order_confirmed" ? "pending" : notification.renderStatus ?? "not_required",
        updatedAt: now
      },
      ...(notification.eventType === "order_confirmed"
        ? {
            $unset: {
              latestFailureReason: "",
              manualResolutionNote: "",
              manualResolvedAt: "",
              renderedReceipt: ""
            }
          }
        : {
            $unset: {
              latestFailureReason: "",
              manualResolutionNote: "",
              manualResolvedAt: ""
            }
          })
    }
  )
}

export const markNotificationManualResolved = async (notificationId: string, note: string) => {
  const now = new Date().toISOString()
  await notificationsCollection().updateOne(
    { _id: notificationId },
    {
      $set: {
        deliveryStatus: "manual_resolved",
        manualResolutionNote: note,
        manualResolvedAt: now,
        updatedAt: now
      }
    }
  )
}

export const buildOrderReceipt = async (notificationId: string) => {
  const notification = await notificationsCollection().findOne({ _id: notificationId })
  if (!notification) {
    throw new Error("Notifikasi tidak ditemukan")
  }

  if (notification.eventType !== "order_confirmed") {
    throw new Error("Receipt tidak tersedia")
  }

  if (notification.renderedReceipt) {
    return notification.renderedReceipt
  }

  return createRenderedReceipt(notification)
}

export const mapCustomerSearch = (
  customer: CustomerDocument,
  activeOrderCount: number,
  latestOrderAt?: string
) => ({
  customerId: customer._id,
  name: customer.name,
  phone: customer.phone,
  currentPoints: customer.currentPoints,
  activeOrderCount,
  recentActivityAt: latestOrderAt ? formatRelativeLabel(latestOrderAt) : undefined,
  createdAtIso: customer.createdAt,
  lastActivityAtIso: latestOrderAt
})

export const filterCustomersByQuery = <T extends { name: string; phone: string }>(
  query: string | undefined,
  customers: T[]
) => {
  if (!query?.trim()) {
    return customers
  }

  const normalizedQuery = normalizeName(query)
  const digits = query.replace(/\D/g, "")
  return customers.filter(
    (customer) =>
      normalizeName(customer.name).includes(normalizedQuery) ||
      customer.phone.replace(/\D/g, "").includes(digits)
  )
}

export const buildCustomerSearchFilter = (query?: string): Filter<CustomerDocument> => {
  if (!query?.trim()) {
    return {}
  }

  const normalizedQuery = normalizeName(query)
  const digits = query.replace(/\D/g, "")
  const digitCandidates = Array.from(new Set([
    digits,
    digits.startsWith("0") ? `62${digits.slice(1)}` : "",
    digits.startsWith("62") ? digits.slice(2) : ""
  ].filter(Boolean)))

  const clauses: Filter<CustomerDocument>[] = [
    { normalizedName: { $regex: normalizedQuery, $options: "i" } }
  ]

  if (digitCandidates.length > 0) {
    clauses.push({
      $or: digitCandidates.map((candidate) => ({
        phoneDigits: { $regex: candidate }
      }))
    })
  }

  return { $or: clauses }
}
