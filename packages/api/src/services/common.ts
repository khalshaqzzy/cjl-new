import type { ClientSession, Filter } from "mongodb"
import type {
  CustomerOrderDetail,
  CustomerProfile,
  NotificationRecord,
  OrderHistoryItem,
  PointLedgerItem
} from "@cjl/contracts"
import { sanitizeAdminWhatsappContacts, resolvePrimaryAdminWhatsappContact } from "../lib/admin-whatsapp.js"
import { env } from "../env.js"
import { getDatabase } from "../db.js"
import { createId, createOpaqueToken } from "../lib/ids.js"
import { formatCurrency } from "../lib/formatters.js"
import { compileTemplate, shouldForceNotificationFailure } from "../lib/notifications.js"
import { renderReceiptImageBase64 } from "../lib/receipt-image.js"
import { formatCustomerName, normalizeName } from "../lib/normalization.js"
import { renderReceiptPdf } from "../lib/receipts.js"
import { hashOpaqueToken, maskPhone, tokenLast4 } from "../lib/security.js"
import { formatDateTime, formatRelativeLabel, formatWeightLabel } from "../lib/time.js"
import { DependencyError, NotFoundError, ValidationError } from "../errors.js"
import { logger, serializeError } from "../logger.js"
import { getRequestContext } from "../request-context.js"
import { sendNotificationToWhatsapp } from "./whatsapp.js"
import type {
  AuditLogDocument,
  CustomerMagicLinkDocument,
  CustomerDocument,
  DirectOrderTokenDocument,
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

const canManualWhatsappFallback = (notification: NotificationDocument) => {
  if (notification.deliveryStatus !== "failed") {
    return false
  }

  if (notification.eventType === "order_done") {
    return true
  }

  if (notification.eventType === "order_confirmed") {
    return notification.renderStatus === "ready"
  }

  return false
}

export const getSettingsDocument = async (session?: ClientSession) => {
  const settings = await db()
    .collection<SettingsDocument>("settings")
    .findOne({ _id: "app-settings" }, { session })

  if (!settings) {
    throw new DependencyError("Settings belum tersedia")
  }

  const adminWhatsappContacts = sanitizeAdminWhatsappContacts(
    settings.business.adminWhatsappContacts,
    [
      settings.business.publicContactPhone,
      settings.business.publicWhatsapp,
    ]
  )

  if (JSON.stringify(adminWhatsappContacts) !== JSON.stringify(settings.business.adminWhatsappContacts ?? [])) {
    await db().collection<SettingsDocument>("settings").updateOne(
      { _id: "app-settings" },
      {
        $set: {
          "business.adminWhatsappContacts": adminWhatsappContacts,
          updatedAt: new Date().toISOString(),
        }
      },
      { session }
    )
  }

  settings.business.adminWhatsappContacts = adminWhatsappContacts
  return settings
}

export const getPrimaryAdminWhatsappContact = (settings: SettingsDocument) =>
  resolvePrimaryAdminWhatsappContact(settings.business.adminWhatsappContacts, [
    settings.business.publicContactPhone,
    settings.business.publicWhatsapp,
  ])

export const saveAuditLog = async (
  action: string,
  entityType: string,
  entityId: string,
  metadata?: Record<string, unknown>,
  session?: ClientSession
) => {
  const context = getRequestContext()
  await db().collection<AuditLogDocument>("audit_logs").insertOne({
    _id: createId("audit"),
    actorType: context?.actorType ?? "system",
    actorId: context?.actorId ?? "system",
    actorSource: context?.actorSource ?? "system",
    action,
    entityType,
    entityId,
    outcome: "success",
    requestId: context?.requestId,
    origin: context?.origin,
    ipHash: context?.ipHash,
    userAgent: context?.userAgent,
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
  manualResolvedAt: notification.manualResolvedAt ? formatDateTime(notification.manualResolvedAt) : undefined,
  receiptAvailable:
    notification.eventType === "order_confirmed" &&
    (notification.renderStatus === "ready" || Boolean(notification.renderedReceipt)),
  manualWhatsappAvailable: canManualWhatsappFallback(notification),
  providerMessageId: notification.providerMessageId,
  providerChatId: notification.providerChatId,
  providerAck: notification.providerAck,
  sentAt: notification.sentAt ? formatDateTime(notification.sentAt) : undefined,
  gatewayErrorCode: notification.gatewayErrorCode,
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
  publicNameVisible: customer.publicNameVisible,
  activeOrderCount,
  totalOrders: orderCount,
  lastActivityAt
})

export const mapCustomerOrderDetail = (order: OrderDocument): CustomerOrderDetail => ({
  orderId: order._id,
  orderCode: order.orderCode,
  status: order.status === "Voided" ? "Cancelled" : order.status,
  createdAtLabel: formatDateTime(order.createdAt),
  completedAtLabel: order.completedAt ? formatDateTime(order.completedAt) : undefined,
  cancelledAtLabel: order.voidedAt ? formatDateTime(order.voidedAt) : undefined,
  cancellationSummary: order.voidReason,
  weightKgLabel: formatWeightLabel(order.weightKg),
  serviceSummary: order.items.map((item) => `${item.quantity}x ${item.serviceLabel}`).join(", "),
  earnedStamps: order.earnedStamps,
  redeemedPoints: order.redeemedPoints,
  subtotal: order.subtotal,
  subtotalLabel: formatCurrency(order.subtotal),
  discount: order.discount,
  discountLabel: order.discount > 0 ? `-${formatCurrency(order.discount)}` : formatCurrency(0),
  total: order.total,
  totalLabel: formatCurrency(order.total),
  items: order.items.map((item) => ({
    serviceCode: item.serviceCode,
    serviceLabel: item.serviceLabel,
    quantity: item.quantity,
    quantityLabel: item.pricingModel === "per_kg" ? formatWeightLabel(item.quantity) : `${item.quantity} unit`,
    unitPrice: item.unitPrice,
    unitPriceLabel: formatCurrency(item.unitPrice),
    lineTotal: item.lineTotal,
    lineTotalLabel: formatCurrency(item.lineTotal)
  }))
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

export const buildCustomerMagicLinkUrl = (token: string) =>
  `${env.PUBLIC_ORIGIN}/auto-login?token=${encodeURIComponent(token)}`

export const createCustomerMagicLink = async (
  customerId: string,
  source: CustomerMagicLinkDocument["source"],
  session?: ClientSession
) => {
  const createdAt = new Date().toISOString()
  const token = createOpaqueToken()
  const document: CustomerMagicLinkDocument = {
    _id: createId("magic"),
    tokenHash: hashOpaqueToken(token),
    tokenLast4: tokenLast4(token),
    customerId,
    source,
    createdAt,
  }

  await db().collection<CustomerMagicLinkDocument>("customer_magic_links").insertOne(document, { session })

  return {
    token,
    url: buildCustomerMagicLinkUrl(token),
  }
}

export const queueNotification = async (notification: NotificationDocument, session?: ClientSession) => {
  await notificationsCollection().insertOne(notification, { session })
}

const createRenderedReceipt = async (notification: NotificationDocument) => {
  if (!notification.orderId) {
    throw new ValidationError("Receipt tidak tersedia untuk notifikasi ini")
  }

  const order = await db().collection<OrderDocument>("orders").findOne({ _id: notification.orderId })
  if (!order) {
    throw new NotFoundError("Order receipt tidak ditemukan")
  }

  return renderReceiptImageBase64(order.receiptSnapshot)
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
  let notification = await notificationsCollection().findOne({ _id: notificationId })
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
        logger.error({
          event: "notification.render.failed",
          notificationId,
          error: serializeError(error),
        })
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

    notification = refreshed
  }

  if (shouldForceNotificationFailure(notification.eventType)) {
    logger.warn({
      event: "notification.delivery.forced_failure",
      notificationId,
      eventType: notification.eventType,
    })
    await markNotificationFailed(notificationId, "Simulasi kegagalan WhatsApp aktif", {
      deliveryStatus: "failed",
      gatewayErrorCode: "forced_failure",
    })
    return
  }

  try {
    logger.info({
      event: "notification.delivery.attempted",
      notificationId,
      eventType: notification.eventType,
      destinationPhone: maskPhone(notification.destinationPhone),
    })
    const delivery = await sendNotificationToWhatsapp(
      notification,
      notification.preparedMessage,
      notification.eventType === "order_confirmed" && notification.renderedReceipt
        ? {
            mimeType: "image/png",
            filename: `${notification.orderCode ?? notification._id}-receipt.png`,
            base64Data: notification.renderedReceipt,
          }
        : undefined
    )

    await notificationsCollection().updateOne(
      { _id: notificationId },
      {
        $set: {
          deliveryStatus: "sent",
          lastAttemptAt: now,
          updatedAt: now,
          providerMessageId: delivery.providerMessageId,
          providerChatId: delivery.providerChatId,
          providerAck: delivery.providerAck,
          sentAt: delivery.sentAt,
        },
        $unset: {
          latestFailureReason: "",
          gatewayErrorCode: "",
        },
        $inc: { attemptCount: 1 }
      }
    )
    logger.info({
      event: "notification.delivery.sent",
      notificationId,
      eventType: notification.eventType,
      providerMessageId: delivery.providerMessageId,
      providerChatId: delivery.providerChatId,
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Gagal mengirim WhatsApp"
    const gatewayErrorCode =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof (error as { code?: unknown }).code === "string"
        ? ((error as { code: string }).code)
        : undefined

    await markNotificationFailed(notificationId, reason, {
      deliveryStatus: "failed",
      ...(gatewayErrorCode ? { gatewayErrorCode } : {}),
    })
    logger.error({
      event: "notification.delivery.failed",
      notificationId,
      eventType: notification.eventType,
      gatewayErrorCode,
      error: serializeError(error),
    })
  }
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
  } catch (error) {
    logger.error({
      event: "outbox.tick.failed",
      error: serializeError(error),
    })
  } finally {
    outboxTickActive = false
  }
}

export const startOutboxWorker = () => {
  if (outboxTimer) {
    return
  }

  outboxEnabled = true
  logger.info({
    event: "outbox.started",
    pollMs: env.OUTBOX_POLL_MS,
  })
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

  logger.info({
    event: "outbox.stopped",
  })
}

export const markNotificationForRetry = async (notificationId: string) => {
  const notification = await notificationsCollection().findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
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
              renderedReceipt: "",
              providerMessageId: "",
              providerChatId: "",
              providerAck: "",
              sentAt: "",
              gatewayErrorCode: "",
            }
          }
        : {
            $unset: {
              latestFailureReason: "",
              manualResolutionNote: "",
              manualResolvedAt: "",
              providerMessageId: "",
              providerChatId: "",
              providerAck: "",
              sentAt: "",
              gatewayErrorCode: "",
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
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  if (notification.eventType !== "order_confirmed") {
    throw new ValidationError("Receipt tidak tersedia")
  }

  if (notification.renderedReceipt) {
    return notification.renderedReceipt
  }

  return createRenderedReceipt(notification)
}

export const buildOrderReceiptPdf = async (orderId: string) => {
  const [order, settings] = await Promise.all([
    db().collection<OrderDocument>("orders").findOne({ _id: orderId }),
    getSettingsDocument()
  ])

  if (!order) {
    throw new NotFoundError("Order tidak ditemukan")
  }

  return renderReceiptPdf(
    {
      orderCode: order.orderCode,
      customerName: order.customerName,
      createdAtLabel: formatDateTime(order.createdAt),
      weightKgLabel: formatWeightLabel(order.weightKg),
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      items: order.items.map((item) => ({
        serviceLabel: item.serviceLabel,
        quantityLabel: item.pricingModel === "per_kg" ? formatWeightLabel(item.quantity) : `${item.quantity} unit`,
        unitPriceLabel: formatCurrency(item.unitPrice),
        lineTotalLabel: formatCurrency(item.lineTotal)
      }))
    },
    {
      laundryName: settings.business.laundryName,
      laundryPhone: getPrimaryAdminWhatsappContact(settings).phone
    }
  )
}

export const toCustomerName = (value: string) => formatCustomerName(value)

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

export const findCustomerMagicLinkByToken = async (token: string) => {
  const tokenHash = hashOpaqueToken(token)
  return db().collection<CustomerMagicLinkDocument>("customer_magic_links").findOne({
    tokenHash,
    usedAt: { $exists: false },
    revokedAt: { $exists: false },
  })
}

export const findDirectOrderTokenByToken = async (token: string) => {
  const tokenHash = hashOpaqueToken(token)
  return db().collection<DirectOrderTokenDocument>("direct_order_tokens").findOne({
    tokenHash,
    revokedAt: { $exists: false },
  })
}
