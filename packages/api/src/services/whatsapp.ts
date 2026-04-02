import { DateTime } from "luxon"
import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappInternalEvent,
  WhatsappMediaDownloadStatus,
  WhatsappMessageDirection,
  WhatsappMessageItem,
  WhatsappMessageSource,
  WhatsappProviderStatus,
} from "@cjl/contracts"
import { env } from "../env.js"
import { getDatabase } from "../db.js"
import { formatDateTime, formatRelativeLabel } from "../lib/time.js"
import { maskPhone } from "../lib/security.js"
import { normalizePhone, normalizeWhatsappPhone } from "../lib/normalization.js"
import { logger } from "../logger.js"
import type {
  CustomerDocument,
  NotificationDocument,
  WhatsappChatDocument,
  WhatsappMessageDocument,
  WhatsappSessionDocument,
} from "../types.js"
import { NotFoundError } from "../errors.js"
import {
  type CloudMediaAttachment,
  type CloudSendResult,
  sendCloudNotification,
} from "./whatsapp-cloud.js"

const db = () => getDatabase()

const getSessionCollection = () =>
  db().collection<WhatsappSessionDocument>("whatsapp_sessions")

const getChatsCollection = () =>
  db().collection<WhatsappChatDocument>("whatsapp_chats")

const getMessagesCollection = () =>
  db().collection<WhatsappMessageDocument>("whatsapp_messages")

const getNotificationsCollection = () =>
  db().collection<NotificationDocument>("notifications")

type CloudInboundMessageInput = {
  providerMessageId: string
  waId?: string
  phone?: string
  displayName?: string
  messageType: string
  body?: string
  caption?: string
  timestampIso: string
  hasMedia: boolean
  mediaMimeType?: string
  mediaName?: string
  providerMediaId?: string
  mediaSha256?: string
  mediaFileSizeBytes?: number
}

type CloudStatusUpdateInput = {
  providerMessageId: string
  recipientId?: string
  status: WhatsappProviderStatus
  statusAt: string
  pricingType?: string
  pricingCategory?: string
  conversationExpirationAt?: string
  latestErrorCode?: string
  latestErrorMessage?: string
}

const buildProviderHealthState = (): WhatsappConnectionStatus["state"] => {
  if (env.WHATSAPP_PROVIDER === "disabled") {
    return "disabled"
  }

  const configured = Boolean(
    env.WHATSAPP_BUSINESS_ID?.trim() &&
      env.WHATSAPP_WABA_ID?.trim() &&
      env.WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      env.WHATSAPP_ACCESS_TOKEN?.trim() &&
      env.WHATSAPP_APP_SECRET?.trim() &&
      env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim()
  )

  return configured ? "ready" : "misconfigured"
}

const buildProviderSummary = (state: WhatsappConnectionStatus["state"]) => {
  if (state === "disabled") {
    return "WhatsApp Cloud API dinonaktifkan."
  }

  if (state === "misconfigured") {
    return "WhatsApp Cloud API belum lengkap dikonfigurasi."
  }

  if (state === "degraded") {
    return "WhatsApp Cloud API aktif dengan kondisi terdegradasi."
  }

  return "WhatsApp Cloud API siap untuk outbound template sends."
}

const defaultSession = (): WhatsappSessionDocument => {
  const state = buildProviderHealthState()
  return {
    _id: "primary",
    provider: env.WHATSAPP_PROVIDER,
    state,
    configured: state === "ready",
    enabled: env.WHATSAPP_PROVIDER === "cloud_api",
    summary: buildProviderSummary(state),
    currentPhone: undefined,
    wid: undefined,
    profileName: undefined,
    pairingMethod: undefined,
    updatedAt: new Date().toISOString(),
  }
}

export const extractWaIdFromAny = (value?: string) => {
  if (!value?.trim()) {
    return undefined
  }

  if (value.includes("@")) {
    const [chatDigits] = value.split("@")
    if (/^\d+$/.test(chatDigits)) {
      return chatDigits
    }
  }

  const digits = normalizeWhatsappPhone(value)
  return digits || undefined
}

export const buildCanonicalChatId = (waId?: string, phone?: string, fallbackChatId?: string) => {
  const canonicalWaId = extractWaIdFromAny(waId) ?? extractWaIdFromAny(phone)
  if (canonicalWaId) {
    return `wa:${canonicalWaId}`
  }

  const fallback = fallbackChatId?.trim()
  if (fallback) {
    return `legacy:${fallback}`
  }

  return `legacy:unknown`
}

export const buildPhoneLabel = (phone?: string, waId?: string) => {
  const normalized = phone?.trim() ? normalizePhone(phone) : undefined
  if (normalized) {
    return normalized
  }

  const fallbackWaId = extractWaIdFromAny(waId)
  return fallbackWaId ? `+${fallbackWaId}` : undefined
}

export const resolveCustomerByPhone = async (phone?: string, waId?: string) => {
  const normalizedPhone = buildPhoneLabel(phone, waId)
  if (!normalizedPhone) {
    return null
  }

  return db()
    .collection<CustomerDocument>("customers")
    .findOne({ normalizedPhone })
}

export const isWindowOpen = (expiresAt?: string) =>
  Boolean(expiresAt && DateTime.fromISO(expiresAt).toMillis() > Date.now())

export const resolveComposerMode = (
  chat: Pick<WhatsappChatDocument, "cswExpiresAt">,
): WhatsappChatDocument["composerMode"] => (isWindowOpen(chat.cswExpiresAt) ? "free_form" : "template_only")

const mapAckToProviderStatus = (providerAck?: number): WhatsappProviderStatus | undefined => {
  if (typeof providerAck !== "number") {
    return undefined
  }

  if (providerAck >= 3) {
    return "read"
  }
  if (providerAck === 2) {
    return "delivered"
  }
  if (providerAck === 1) {
    return "sent"
  }

  return "accepted"
}

export const buildMessagePreview = (
  direction: WhatsappMessageDirection,
  messageType: string,
  body?: string,
  caption?: string,
  mediaName?: string
) => {
  const text = body?.trim() || caption?.trim()
  if (text) {
    return text
  }

  const mediaLabel = mediaName?.trim() || `Media ${messageType}`
  return direction === "outbound" ? `Mengirim ${mediaLabel}` : `Menerima ${mediaLabel}`
}

const buildChatTitle = (
  customerName?: string,
  displayName?: string,
  phone?: string,
  chatId?: string
) => {
  if (customerName?.trim()) {
    return customerName
  }

  if (displayName?.trim()) {
    return displayName
  }

  if (phone?.trim()) {
    return phone
  }

  return chatId ?? "WhatsApp Chat"
}

const formatMediaDownloadStatus = (
  mediaDownloadStatus?: WhatsappMessageDocument["mediaDownloadStatus"]
): WhatsappMediaDownloadStatus | undefined => mediaDownloadStatus

const upsertChatActivity = async ({
  chatId,
  waId,
  phone,
  customerId,
  customerName,
  displayName,
  direction,
  textPreview,
  timestampIso,
}: {
  chatId: string
  waId?: string
  phone?: string
  customerId?: string
  customerName?: string
  displayName?: string
  direction: WhatsappMessageDirection
  textPreview: string
  timestampIso: string
}) => {
  const existingChat = await getChatsCollection().findOne({ _id: chatId })
  const shouldPromoteLastMessage =
    !existingChat?.lastMessageAt || timestampIso >= existingChat.lastMessageAt
  const nextUnreadCount =
    direction === "inbound"
      ? (existingChat?.unreadCount ?? 0) + 1
      : (existingChat?.unreadCount ?? 0)

  const chatUpdate: Partial<WhatsappChatDocument> = {
    title: buildChatTitle(customerName, displayName, phone, chatId),
    waId,
    displayName,
    phone,
    customerId,
    customerName,
    unreadCount: nextUnreadCount,
    updatedAt: timestampIso,
    composerMode: resolveComposerMode({
      cswExpiresAt:
        direction === "inbound"
          ? DateTime.fromISO(timestampIso).plus({ hours: 24 }).toISO() ?? existingChat?.cswExpiresAt
          : existingChat?.cswExpiresAt,
    }),
  }

  if (direction === "inbound") {
    const cswOpenedAt = timestampIso
    const cswExpiresAt = DateTime.fromISO(timestampIso).plus({ hours: 24 }).toISO() ?? timestampIso
    chatUpdate.lastInboundAt = timestampIso
    chatUpdate.cswOpenedAt = cswOpenedAt
    chatUpdate.cswExpiresAt = cswExpiresAt
    chatUpdate.composerMode = "free_form"
  }

  if (shouldPromoteLastMessage) {
    chatUpdate.lastMessagePreview = textPreview
    chatUpdate.lastMessageDirection = direction
    chatUpdate.lastMessageAt = timestampIso
  }

  await getChatsCollection().updateOne(
    { _id: chatId },
    {
      $set: chatUpdate,
    },
    { upsert: true }
  )
}

const recordOutboundAcceptance = async (
  notification: NotificationDocument,
  result: CloudSendResult,
  media?: CloudMediaAttachment
) => {
  const chatId = buildCanonicalChatId(result.waId, notification.destinationPhone)
  const phone = buildPhoneLabel(notification.destinationPhone, result.waId)
  const customer = notification.customerId
    ? await db().collection<CustomerDocument>("customers").findOne({ _id: notification.customerId })
    : await resolveCustomerByPhone(phone, result.waId)
  const textPreview = buildMessagePreview(
    "outbound",
    media ? "document" : "template",
    notification.preparedMessage,
    undefined,
    media?.filename
  )

  await getMessagesCollection().updateOne(
    { _id: result.providerMessageId },
    {
      $set: {
        chatId,
        providerKind: result.providerKind,
        waId: result.waId,
        phone,
        customerId: customer?._id ?? notification.customerId,
        customerName: customer?.name ?? notification.customerName,
        direction: "outbound",
        messageType: media ? "document" : "template",
        body: notification.preparedMessage,
        textPreview,
        timestampIso: result.providerStatusAt,
        providerStatus: result.providerStatus,
        providerStatusAt: result.providerStatusAt,
        source: "automated_notification" satisfies WhatsappMessageSource,
        hasMedia: Boolean(media),
        mediaMimeType: media?.mimeType,
        mediaName: media?.filename,
        notificationId: notification._id,
        orderCode: notification.orderCode,
        updatedAt: result.providerStatusAt,
      },
      $setOnInsert: {
        createdAt: result.providerStatusAt,
      },
    },
    { upsert: true }
  )

  await upsertChatActivity({
    chatId,
    waId: result.waId,
    phone,
    customerId: customer?._id ?? notification.customerId,
    customerName: customer?.name ?? notification.customerName,
    displayName: customer?.name ?? notification.customerName,
    direction: "outbound",
    textPreview,
    timestampIso: result.providerStatusAt,
  })
}

const mapChat = (chat: WhatsappChatDocument): WhatsappChatSummary => ({
  chatId: chat._id,
  title: chat.title,
  waId: chat.waId,
  displayName: chat.displayName,
  phone: chat.phone,
  customerId: chat.customerId,
  customerName: chat.customerName,
  unreadCount: chat.unreadCount,
  lastMessagePreview: chat.lastMessagePreview,
  lastMessageDirection: chat.lastMessageDirection,
  lastMessageAtIso: chat.lastMessageAt,
  lastMessageAtLabel: chat.lastMessageAt ? formatRelativeLabel(chat.lastMessageAt) : undefined,
  isCswOpen: isWindowOpen(chat.cswExpiresAt),
  cswExpiresAtIso: chat.cswExpiresAt,
  cswExpiresAtLabel: chat.cswExpiresAt ? formatRelativeLabel(chat.cswExpiresAt) : undefined,
  isFepOpen: isWindowOpen(chat.fepExpiresAt),
  fepExpiresAtIso: chat.fepExpiresAt,
  fepExpiresAtLabel: chat.fepExpiresAt ? formatRelativeLabel(chat.fepExpiresAt) : undefined,
  composerMode: resolveComposerMode(chat),
})

export const mapWhatsappMessage = (message: WhatsappMessageDocument): WhatsappMessageItem => ({
  providerMessageId: message._id,
  chatId: message.chatId,
  providerKind: message.providerKind,
  waId: message.waId,
  direction: message.direction,
  messageType: message.messageType,
  body: message.body,
  caption: message.caption,
  textPreview: message.textPreview,
  timestampIso: message.timestampIso,
  timestampLabel: formatDateTime(message.timestampIso),
  providerStatus: message.providerStatus,
  providerStatusAtIso: message.providerStatusAt,
  providerStatusAtLabel: message.providerStatusAt
    ? formatDateTime(message.providerStatusAt)
    : undefined,
  pricingType: message.pricingType,
  pricingCategory: message.pricingCategory,
  latestErrorCode: message.latestErrorCode,
  latestErrorMessage: message.latestErrorMessage,
  source: message.source,
  providerAck: message.providerAck,
  hasMedia: message.hasMedia,
  providerMediaId: message.providerMediaId,
  mediaMimeType: message.mediaMimeType,
  mediaName: message.mediaName,
  mediaDownloadStatus: formatMediaDownloadStatus(message.mediaDownloadStatus),
  mediaDownloadAvailable: Boolean(message.mediaStorageId),
  notificationId: message.notificationId,
  orderCode: message.orderCode,
  customerId: message.customerId,
  customerName: message.customerName,
})

const buildFailedReason = (
  latestErrorMessage?: string,
  latestErrorCode?: string
) => latestErrorMessage?.trim() || latestErrorCode?.trim() || "Gagal mengirim WhatsApp"

const updateNotificationDeliveryFromStatus = async (
  providerMessageId: string,
  update: {
    providerStatus: WhatsappProviderStatus
    providerStatusAt: string
    waId?: string
    pricingType?: string
    pricingCategory?: string
    latestErrorCode?: string
    latestErrorMessage?: string
  }
) => {
  const set: Record<string, unknown> = {
    providerKind: "cloud_api",
    providerMessageId,
    providerStatus: update.providerStatus,
    providerStatusAt: update.providerStatusAt,
    updatedAt: update.providerStatusAt,
  }

  if (update.waId) {
    set.waId = update.waId
  }
  if (update.pricingType) {
    set.pricingType = update.pricingType
  }
  if (update.pricingCategory) {
    set.pricingCategory = update.pricingCategory
  }
  if (update.latestErrorCode) {
    set.latestErrorCode = update.latestErrorCode
  }
  if (update.latestErrorMessage) {
    set.latestErrorMessage = update.latestErrorMessage
  }

  if (update.providerStatus === "failed") {
    set.deliveryStatus = "failed"
    set.latestFailureReason = buildFailedReason(update.latestErrorMessage, update.latestErrorCode)
  } else {
    set.deliveryStatus = "sent"
  }

  await getNotificationsCollection().updateOne(
    { providerMessageId },
    {
      $set: set,
      ...(update.providerStatus === "failed"
        ? {}
        : {
            $unset: {
              latestFailureReason: "",
              gatewayErrorCode: "",
            },
          }),
    }
  )
}

export const ingestCloudInboundMessage = async (message: CloudInboundMessageInput) => {
  const waId = extractWaIdFromAny(message.waId) ?? extractWaIdFromAny(message.phone)
  const phone = buildPhoneLabel(message.phone, waId)
  const chatId = buildCanonicalChatId(waId, phone)
  const customer = await resolveCustomerByPhone(phone, waId)
  const textPreview = buildMessagePreview(
    "inbound",
    message.messageType,
    message.body,
    message.caption,
    message.mediaName
  )
  const nextUpdatedAt = new Date().toISOString()

  logger.info({
    event: "whatsapp.cloud.inbound_message_upserted",
    providerMessageId: message.providerMessageId,
    destinationPhone: maskPhone(phone),
    messageType: message.messageType,
  })

  await getMessagesCollection().updateOne(
    { _id: message.providerMessageId },
    {
      $set: {
        chatId,
        providerKind: "cloud_api",
        waId,
        phone,
        customerId: customer?._id,
        customerName: customer?.name,
        direction: "inbound",
        messageType: message.messageType,
        body: message.body,
        caption: message.caption,
        textPreview,
        timestampIso: message.timestampIso,
        source: "inbound_customer" satisfies WhatsappMessageSource,
        hasMedia: message.hasMedia,
        providerMediaId: message.providerMediaId,
        mediaMimeType: message.mediaMimeType,
        mediaName: message.mediaName,
        mediaSha256: message.mediaSha256,
        mediaFileSizeBytes: message.mediaFileSizeBytes,
        ...(message.providerMediaId ? { mediaDownloadStatus: "pending" satisfies WhatsappMediaDownloadStatus } : {}),
        ...(message.providerMediaId
          ? {
              mediaStorageId: undefined,
              mediaDownloadedAt: undefined,
              mediaDownloadError: undefined,
            }
          : {}),
        updatedAt: nextUpdatedAt,
      },
      $setOnInsert: {
        createdAt: nextUpdatedAt,
      },
    },
    { upsert: true }
  )

  await upsertChatActivity({
    chatId,
    waId,
    phone,
    customerId: customer?._id,
    customerName: customer?.name,
    displayName: message.displayName,
    direction: "inbound",
    textPreview,
    timestampIso: message.timestampIso,
  })
}

export const ingestCloudStatusUpdate = async (statusUpdate: CloudStatusUpdateInput) => {
  const waId = extractWaIdFromAny(statusUpdate.recipientId)
  const phone = buildPhoneLabel(statusUpdate.recipientId, waId)
  const notification = await getNotificationsCollection().findOne({
    providerMessageId: statusUpdate.providerMessageId,
  })
  const customer = notification?.customerId
    ? await db().collection<CustomerDocument>("customers").findOne({ _id: notification.customerId })
    : await resolveCustomerByPhone(phone, waId)
  const existingMessage = await getMessagesCollection().findOne({
    _id: statusUpdate.providerMessageId,
  })
  const chatId =
    existingMessage?.chatId ??
    buildCanonicalChatId(waId, phone, notification?.providerChatId)
  const textPreview =
    existingMessage?.textPreview ??
    buildMessagePreview(
      "outbound",
      existingMessage?.messageType ?? "template",
      notification?.preparedMessage
    )

  await getMessagesCollection().updateOne(
    { _id: statusUpdate.providerMessageId },
    {
      $set: {
        chatId,
        providerKind: "cloud_api",
        waId: waId ?? existingMessage?.waId ?? notification?.waId,
        phone: phone ?? existingMessage?.phone ?? notification?.destinationPhone,
        customerId: customer?._id ?? existingMessage?.customerId ?? notification?.customerId,
        customerName: customer?.name ?? existingMessage?.customerName ?? notification?.customerName,
        direction: existingMessage?.direction ?? "outbound",
        messageType: existingMessage?.messageType ?? "template",
        body: existingMessage?.body ?? notification?.preparedMessage,
        textPreview,
        timestampIso: existingMessage?.timestampIso ?? statusUpdate.statusAt,
        providerStatus: statusUpdate.status,
        providerStatusAt: statusUpdate.statusAt,
        pricingType: statusUpdate.pricingType,
        pricingCategory: statusUpdate.pricingCategory,
        latestErrorCode: statusUpdate.latestErrorCode,
        latestErrorMessage: statusUpdate.latestErrorMessage,
        source: existingMessage?.source ?? ("automated_notification" satisfies WhatsappMessageSource),
        updatedAt: statusUpdate.statusAt,
      },
      $setOnInsert: {
        createdAt: statusUpdate.statusAt,
        hasMedia: existingMessage?.hasMedia ?? false,
      },
    },
    { upsert: true }
  )

  await updateNotificationDeliveryFromStatus(statusUpdate.providerMessageId, {
    providerStatus: statusUpdate.status,
    providerStatusAt: statusUpdate.statusAt,
    waId: waId ?? notification?.waId,
    pricingType: statusUpdate.pricingType,
    pricingCategory: statusUpdate.pricingCategory,
    latestErrorCode: statusUpdate.latestErrorCode,
    latestErrorMessage: statusUpdate.latestErrorMessage,
  })

  if (chatId) {
    const existingChat = await getChatsCollection().findOne({ _id: chatId })
    if (existingChat) {
      const chatUpdate: Partial<WhatsappChatDocument> = {
        waId: waId ?? existingChat.waId,
        phone: phone ?? existingChat.phone,
        customerId: customer?._id ?? existingChat.customerId ?? notification?.customerId,
        customerName: customer?.name ?? existingChat.customerName ?? notification?.customerName,
        updatedAt: statusUpdate.statusAt,
      }

      if (
        statusUpdate.pricingType === "free_entry_point" &&
        statusUpdate.conversationExpirationAt
      ) {
        chatUpdate.fepOpenedAt = statusUpdate.statusAt
        chatUpdate.fepExpiresAt = statusUpdate.conversationExpirationAt
      }

      chatUpdate.composerMode = resolveComposerMode({
        cswExpiresAt: existingChat.cswExpiresAt,
      })

      await getChatsCollection().updateOne(
        { _id: chatId },
        {
          $set: chatUpdate,
        }
      )
    }
  }
}

export const getWhatsappStatus = async (): Promise<WhatsappConnectionStatus> => {
  const persisted = (await getSessionCollection().findOne({ _id: "primary" })) ?? defaultSession()
  const state = buildProviderHealthState()

  return {
    provider: env.WHATSAPP_PROVIDER,
    state,
    configured: state === "ready",
    enabled: env.WHATSAPP_PROVIDER === "cloud_api",
    businessId: env.WHATSAPP_BUSINESS_ID,
    wabaId: env.WHATSAPP_WABA_ID,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    currentPhone: persisted.currentPhone,
    webhookPath: env.WHATSAPP_WEBHOOK_PATH,
    summary: buildProviderSummary(state),
    observedAt: new Date().toISOString(),
  }
}

export const sendNotificationToWhatsapp = async (
  notification: NotificationDocument,
  media?: CloudMediaAttachment
) => {
  if (env.WHATSAPP_PROVIDER === "disabled") {
    const simulatedResult: CloudSendResult = {
      providerKind: "simulated",
      providerMessageId: `simulated:${notification._id}`,
      providerStatus: "accepted",
      providerStatusAt: new Date().toISOString(),
      sentAt: new Date().toISOString(),
      waId: normalizeWhatsappPhone(notification.destinationPhone),
    }
    await recordOutboundAcceptance(notification, simulatedResult, media)
    return simulatedResult
  }

  const result = await sendCloudNotification(notification, media)
  await recordOutboundAcceptance(notification, result, media)
  return result
}

export const listWhatsappChats = async () => {
  const chats = await getChatsCollection()
    .find({})
    .sort({ lastMessageAt: -1, updatedAt: -1 })
    .toArray()

  return chats.map(mapChat)
}

export const listWhatsappMessages = async (chatId: string) => {
  const messages = await getMessagesCollection()
    .find({ chatId })
    .sort({ timestampIso: 1, createdAt: 1 })
    .toArray()

  return messages.map(mapWhatsappMessage)
}

export const markWhatsappChatRead = async (chatId: string) => {
  const result = await getChatsCollection().updateOne(
    { _id: chatId },
    {
      $set: {
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
      },
    }
  )

  if (!result.matchedCount) {
    throw new NotFoundError("Thread WhatsApp tidak ditemukan")
  }
}

export const ingestWhatsappInternalEvent = async (event: WhatsappInternalEvent) => {
  if (event.type === "session_state_changed") {
    const nextState = buildProviderHealthState()
    await getSessionCollection().updateOne(
      { _id: "primary" },
      {
        $set: {
          provider: env.WHATSAPP_PROVIDER,
          state: nextState,
          configured: nextState === "ready",
          enabled: env.WHATSAPP_PROVIDER === "cloud_api",
          summary: buildProviderSummary(nextState),
          currentPhone: event.currentPhone,
          wid: event.wid,
          profileName: event.profileName,
          pairingMethod: event.pairingMethod,
          updatedAt: event.observedAt,
        },
        $setOnInsert: {
          _id: "primary",
        },
      },
      { upsert: true }
    )

    return
  }

  if (event.type === "message_ack_changed") {
    const providerStatus = mapAckToProviderStatus(event.providerAck)
    await getMessagesCollection().updateOne(
      { _id: event.providerMessageId },
      {
        $set: {
          providerAck: event.providerAck,
          ...(providerStatus ? { providerStatus } : {}),
          ...(providerStatus ? { providerStatusAt: event.observedAt } : {}),
          updatedAt: event.observedAt,
        },
      }
    )

    await getNotificationsCollection().updateOne(
      { providerMessageId: event.providerMessageId },
      {
        $set: {
          providerAck: event.providerAck,
          ...(providerStatus ? { providerStatus } : {}),
          ...(providerStatus ? { providerStatusAt: event.observedAt } : {}),
          updatedAt: event.observedAt,
        },
      }
    )

    return
  }

  const waId = extractWaIdFromAny(event.waId) ?? extractWaIdFromAny(event.phone) ?? extractWaIdFromAny(event.chatId)
  const phone = buildPhoneLabel(event.phone, waId)
  const chatId = buildCanonicalChatId(waId, phone, event.chatId)
  const customer = await resolveCustomerByPhone(phone, waId)
  const textPreview = buildMessagePreview(
    event.direction,
    event.messageType,
    event.body,
    event.caption,
    event.mediaName
  )
  const providerStatus = event.providerStatus ?? mapAckToProviderStatus(event.providerAck)
  const now = event.providerStatusAt ?? event.timestampIso

  logger.info({
    event: "whatsapp.internal.message_upserted",
    providerMessageId: event.providerMessageId,
    direction: event.direction,
    destinationPhone: maskPhone(phone),
    providerKind: event.providerKind ?? "webjs_legacy",
  })

  await getMessagesCollection().updateOne(
    { _id: event.providerMessageId },
    {
      $set: {
        chatId,
        providerKind: event.providerKind ?? "webjs_legacy",
        waId,
        phone,
        customerId: customer?._id,
        customerName: customer?.name,
        direction: event.direction,
        messageType: event.messageType,
        body: event.body,
        caption: event.caption,
        textPreview,
        timestampIso: event.timestampIso,
        providerStatus,
        providerStatusAt: event.providerStatusAt,
        pricingType: event.pricingType,
        pricingCategory: event.pricingCategory,
        latestErrorCode: event.latestErrorCode,
        latestErrorMessage: event.latestErrorMessage,
        source: event.source ?? "legacy_mirror",
        providerAck: event.providerAck,
        hasMedia: event.hasMedia,
        mediaMimeType: event.mediaMimeType,
        mediaName: event.mediaName,
        notificationId: event.notificationId,
        orderCode: event.orderCode,
        updatedAt: now,
      },
      $setOnInsert: {
        createdAt: now,
      },
    },
    { upsert: true }
  )

  await upsertChatActivity({
    chatId,
    waId,
    phone,
    customerId: customer?._id,
    customerName: customer?.name,
    displayName: event.displayName,
    direction: event.direction,
    textPreview,
    timestampIso: event.timestampIso,
  })

  if (event.notificationId) {
    await getNotificationsCollection().updateOne(
      { _id: event.notificationId },
      {
        $set: {
          providerKind: event.providerKind ?? "webjs_legacy",
          providerMessageId: event.providerMessageId,
          providerStatus,
          providerStatusAt: event.providerStatusAt,
          waId,
          pricingType: event.pricingType,
          pricingCategory: event.pricingCategory,
          latestErrorCode: event.latestErrorCode,
          latestErrorMessage: event.latestErrorMessage,
          providerChatId: event.chatId,
          providerAck: event.providerAck,
          updatedAt: now,
        },
      }
    )
  }
}
