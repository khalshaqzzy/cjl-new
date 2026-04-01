import type { ClientSession, Filter } from "mongodb"
import type {
  AdminLaundryOrder,
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
import { shouldForceNotificationFailure } from "../lib/notifications.js"
import { renderReceiptImageBase64 } from "../lib/receipt-image.js"
import { formatCustomerName, normalizeName, normalizePhoneLabel } from "../lib/normalization.js"
import { createReceiptRenderModel, renderReceiptPdf } from "../lib/receipts.js"
import { hashOpaqueToken, maskPhone, tokenLast4 } from "../lib/security.js"
import { formatDateTime, formatRelativeLabel, formatWeightLabel } from "../lib/time.js"
import { buildTemplateParams } from "../lib/whatsapp-template-registry.js"
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
  return notification.deliveryStatus === "failed" && notification.preparedMessage.trim().length > 0
}

export const formatOrderItemSummary = (item: OrderDocument["items"][number]) => {
  if (item.pricingModel === "per_kg") {
    return `${formatWeightLabel(item.quantity)} ${item.serviceLabel}`
  }

  return `${item.quantity}x ${item.serviceLabel}`
}

export const buildOrderServiceSummary = (items: OrderDocument["items"]) =>
  items.map(formatOrderItemSummary).join(", ")

export const getSettingsDocument = async (session?: ClientSession) => {
  const settings = await db()
    .collection<SettingsDocument>("settings")
    .findOne({ _id: "app-settings" }, { session })

  if (!settings) {
    throw new DependencyError("Settings belum tersedia")
  }

  const normalizedPublicWhatsapp =
    normalizePhoneLabel(settings.business.publicWhatsapp) || settings.business.publicWhatsapp.trim()
  const adminWhatsappContacts = sanitizeAdminWhatsappContacts(
    settings.business.adminWhatsappContacts,
    [
      settings.business.publicContactPhone,
      normalizedPublicWhatsapp,
    ]
  )
  const primaryAdminWhatsappContact = resolvePrimaryAdminWhatsappContact(adminWhatsappContacts, [
    settings.business.publicContactPhone,
    normalizedPublicWhatsapp,
  ])
  const normalizedBusiness = {
    ...settings.business,
    laundryName: settings.business.laundryName.trim(),
    laundryPhone: normalizePhoneLabel(settings.business.laundryPhone) || settings.business.laundryPhone.trim(),
    publicContactPhone: primaryAdminWhatsappContact.phone,
    publicWhatsapp: normalizedPublicWhatsapp || primaryAdminWhatsappContact.phone,
    adminWhatsappContacts,
    address: settings.business.address.trim(),
    operatingHours: settings.business.operatingHours.trim(),
  }

  if (JSON.stringify(normalizedBusiness) !== JSON.stringify(settings.business)) {
    await db().collection<SettingsDocument>("settings").updateOne(
      { _id: "app-settings" },
      {
        $set: {
          business: normalizedBusiness,
          updatedAt: new Date().toISOString(),
        }
      },
      { session }
    )
  }

  settings.business = normalizedBusiness
  return settings
}

export const getPrimaryAdminWhatsappContact = (settings: SettingsDocument) =>
  resolvePrimaryAdminWhatsappContact(settings.business.adminWhatsappContacts, [
    settings.business.publicContactPhone,
    settings.business.publicWhatsapp,
  ])

const buildReceiptRenderModelFromOrder = async (order: OrderDocument) => {
  const settings = await getSettingsDocument()
  const primaryAdminContact = getPrimaryAdminWhatsappContact(settings)

  return createReceiptRenderModel(
    {
      orderCode: order.orderCode,
      customerName: order.customerName,
      createdAtLabel: formatDateTime(order.createdAt),
      weightKgLabel: formatWeightLabel(order.weightKg),
      subtotal: order.subtotal,
      discount: order.discount,
      total: order.total,
      earnedStamps: order.earnedStamps,
      redeemedPoints: order.redeemedPoints,
      resultingPointBalance: order.resultingPointBalance,
      items: order.items.map((item) => ({
        serviceLabel: item.serviceLabel,
        quantityLabel: item.pricingModel === "per_kg" ? formatWeightLabel(item.quantity) : `${item.quantity} unit`,
        unitPriceLabel: formatCurrency(item.unitPrice),
        lineTotalLabel: formatCurrency(item.lineTotal),
      })),
    },
    {
      laundryName: settings.business.laundryName,
      laundryPhone: settings.business.laundryPhone,
      adminWhatsapp: primaryAdminContact.phone,
      address: settings.business.address,
      operatingHours: settings.business.operatingHours,
    }
  )
}

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
  ignoredNote: notification.ignoredNote,
  ignoredAt: notification.ignoredAt ? formatDateTime(notification.ignoredAt) : undefined,
  receiptAvailable:
    notification.eventType === "order_confirmed" &&
    (notification.renderStatus === "ready" || Boolean(notification.renderedReceipt)),
  manualWhatsappAvailable: canManualWhatsappFallback(notification),
  providerKind: notification.providerKind,
  providerMessageId: notification.providerMessageId,
  providerStatus: notification.providerStatus,
  providerStatusAt: notification.providerStatusAt ? formatDateTime(notification.providerStatusAt) : undefined,
  waId: notification.waId,
  pricingType: notification.pricingType,
  pricingCategory: notification.pricingCategory,
  latestErrorCode: notification.latestErrorCode,
  latestErrorMessage: notification.latestErrorMessage,
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
  serviceSummary: buildOrderServiceSummary(order.items),
  totalLabel: formatCurrency(order.total),
  earnedStamps: order.earnedStamps,
  redeemedPoints: order.redeemedPoints,
  status: order.status === "Voided" ? "Cancelled" : order.status
})

export const mapAdminLaundryOrder = (order: OrderDocument): AdminLaundryOrder => ({
  orderId: order._id,
  orderCode: order.orderCode,
  customerName: order.customerName,
  phone: order.customerPhone,
  createdAtLabel: formatRelativeLabel(order.createdAt),
  createdAtIso: order.createdAt,
  completedAtLabel: order.completedAt ? formatRelativeLabel(order.completedAt) : undefined,
  completedAtIso: order.completedAt,
  cancelledAtLabel: order.voidedAt ? formatRelativeLabel(order.voidedAt) : undefined,
  cancelledAtIso: order.voidedAt,
  weightKgLabel: formatWeightLabel(order.weightKg),
  serviceSummary: buildOrderServiceSummary(order.items),
  totalLabel: formatCurrency(order.total),
  earnedStamps: order.earnedStamps,
  redeemedPoints: order.redeemedPoints,
  status: order.status === "Voided" ? "Cancelled" : order.status,
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
  serviceSummary: buildOrderServiceSummary(order.items),
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
  params: Record<string, string>
) => {
  return buildTemplateParams(eventType, params).preparedMessage
}

const rehydrateNotificationTemplateContent = async (notification: NotificationDocument) => {
  const customer =
    notification.customerId
      ? await db().collection<CustomerDocument>("customers").findOne({ _id: notification.customerId })
      : null

  const order =
    notification.orderId
      ? await db().collection<OrderDocument>("orders").findOne({ _id: notification.orderId })
      : null

  const normalizedPhone =
    normalizePhoneLabel(customer?.phone || notification.destinationPhone) ||
    customer?.phone ||
    notification.destinationPhone

  let params: Record<string, string>
  switch (notification.eventType) {
    case "welcome":
      params = {
        customer_name: customer?.name ?? notification.customerName,
        registered_phone: normalizedPhone,
      }
      break
    case "account_info":
      params = {
        customer_name: customer?.name ?? notification.customerName,
        customer_phone: normalizedPhone,
      }
      break
    case "order_confirmed":
      if (!order || !order.directToken) {
        throw new ValidationError("Data order untuk template order_confirmed tidak tersedia")
      }
      params = {
        customer_name: order.customerName,
        order_code: order.orderCode,
        created_at: formatDateTime(order.createdAt),
        weight_kg_label: formatWeightLabel(order.weightKg),
        service_summary: buildOrderServiceSummary(order.items),
        total_label: formatCurrency(order.total),
        earned_stamps: String(order.earnedStamps),
        redeemed_points: String(order.redeemedPoints),
        current_points: String(order.resultingPointBalance),
        status_url: `${env.PUBLIC_ORIGIN}/status/${order.directToken}`,
      }
      break
    case "order_done":
      if (!order || !order.completedAt) {
        throw new ValidationError("Data order selesai untuk template order_done tidak tersedia")
      }
      params = {
        customer_name: order.customerName,
        order_code: order.orderCode,
        created_at: formatDateTime(order.createdAt),
        completed_at: formatDateTime(order.completedAt),
      }
      break
    case "order_void_notice":
      if (!order) {
        throw new ValidationError("Data order void untuk template order_void_notice tidak tersedia")
      }
      params = {
        customer_name: order.customerName,
        order_code: order.orderCode,
        reason: order.voidReason ?? notification.latestFailureReason ?? "Dibatalkan oleh admin",
      }
      break
  }

  const preparedMessage = await buildPreparedMessage(notification.eventType, params)

  await notificationsCollection().updateOne(
    { _id: notification._id },
    {
      $set: {
        templateParams: params,
        preparedMessage,
        updatedAt: new Date().toISOString(),
      }
    }
  )

  return {
    ...notification,
    templateParams: params,
    preparedMessage,
  }
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

  return renderReceiptImageBase64(await buildReceiptRenderModelFromOrder(order))
}

const buildWhatsappReceiptAttachment = async (notification: NotificationDocument) => {
  if (notification.eventType !== "order_confirmed" || !notification.orderId) {
    return undefined
  }

  const order = await db().collection<OrderDocument>("orders").findOne({ _id: notification.orderId })
  if (!order) {
    throw new NotFoundError("Order receipt tidak ditemukan")
  }

  const pdfBuffer = await renderReceiptPdf(await buildReceiptRenderModelFromOrder(order))
  return {
    mimeType: "application/pdf",
    filename: `${notification.orderCode ?? notification._id}-receipt.pdf`,
    base64Data: pdfBuffer.toString("base64"),
  }
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

  if (
    notification.deliveryStatus === "sent" ||
    notification.deliveryStatus === "manual_resolved" ||
    notification.deliveryStatus === "ignored"
  ) {
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

  if (!notification.templateParams) {
    notification = await rehydrateNotificationTemplateContent(notification)
  }

  try {
    logger.info({
      event: "notification.delivery.attempted",
      notificationId,
      eventType: notification.eventType,
      destinationPhone: maskPhone(notification.destinationPhone),
    })
    const whatsappAttachment = await buildWhatsappReceiptAttachment(notification)
    const delivery = await sendNotificationToWhatsapp(notification, whatsappAttachment)

    await notificationsCollection().updateOne(
      { _id: notificationId },
      {
        $set: {
          deliveryStatus: "sent",
          lastAttemptAt: now,
          updatedAt: now,
          providerKind: delivery.providerKind,
          providerMessageId: delivery.providerMessageId,
          providerStatus: delivery.providerStatus,
          providerStatusAt: delivery.providerStatusAt,
          waId: delivery.waId,
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
      providerStatus: delivery.providerStatus,
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
      latestErrorMessage: reason,
      ...(gatewayErrorCode ? { gatewayErrorCode } : {}),
      ...(gatewayErrorCode ? { latestErrorCode: gatewayErrorCode } : {}),
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
              ignoredNote: "",
              ignoredAt: "",
              renderedReceipt: "",
              providerKind: "",
              providerMessageId: "",
              providerStatus: "",
              providerStatusAt: "",
              waId: "",
              pricingType: "",
              pricingCategory: "",
              latestErrorCode: "",
              latestErrorMessage: "",
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
              ignoredNote: "",
              ignoredAt: "",
              providerKind: "",
              providerMessageId: "",
              providerStatus: "",
              providerStatusAt: "",
              waId: "",
              pricingType: "",
              pricingCategory: "",
              latestErrorCode: "",
              latestErrorMessage: "",
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
      },
      $unset: {
        ignoredNote: "",
        ignoredAt: "",
      }
    }
  )
}

export const markNotificationIgnored = async (notificationId: string, note: string) => {
  const now = new Date().toISOString()
  await notificationsCollection().updateOne(
    { _id: notificationId },
    {
      $set: {
        deliveryStatus: "ignored",
        ignoredNote: note,
        ignoredAt: now,
        updatedAt: now,
      },
      $unset: {
        manualResolutionNote: "",
        manualResolvedAt: "",
      },
    }
  )
}

export const buildOrderReceipt = async (
  notificationId: string,
  options?: { preferCached?: boolean }
) => {
  const notification = await notificationsCollection().findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  if (notification.eventType !== "order_confirmed") {
    throw new ValidationError("Receipt tidak tersedia")
  }

  if (options?.preferCached !== false && notification.renderedReceipt) {
    return notification.renderedReceipt
  }

  return createRenderedReceipt(notification)
}

export const buildOrderReceiptPdf = async (orderId: string) => {
  const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId })

  if (!order) {
    throw new NotFoundError("Order tidak ditemukan")
  }

  return renderReceiptPdf(await buildReceiptRenderModelFromOrder(order))
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
