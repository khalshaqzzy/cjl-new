import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappInternalEvent,
  WhatsappMessageDirection,
  WhatsappMessageItem,
} from "@cjl/contracts"
import { env } from "../env.js"
import { getDatabase } from "../db.js"
import { formatDateTime, formatRelativeLabel } from "../lib/time.js"
import { normalizePhone, normalizeWhatsappPhone } from "../lib/normalization.js"
import type {
  CustomerDocument,
  NotificationDocument,
  SettingsDocument,
  WhatsappChatDocument,
  WhatsappMessageDocument,
  WhatsappSessionDocument,
} from "../types.js"

const db = () => getDatabase()

type GatewayStatusResponse = {
  state: WhatsappConnectionStatus["state"]
  connected: boolean
  currentPhone?: string
  wid?: string
  profileName?: string
  qrCodeValue?: string
  qrCodeDataUrl?: string
  pairingCode?: string
  observedAt?: string
}

type GatewaySendResponse = {
  providerMessageId: string
  providerChatId: string
  providerAck?: number
  sentAt: string
}

type GatewayRequestPairingCodeResponse = GatewayStatusResponse

type GatewayRequestBody = {
  notificationId: string
  eventType: NotificationDocument["eventType"]
  toPhone: string
  message: string
  orderCode?: string
  media?: {
    mimeType: string
    filename: string
    base64Data: string
  }
}

type GatewayError = Error & {
  code?: string
  status?: number
}

const defaultSession = (): WhatsappSessionDocument => ({
  _id: "primary",
  state: env.WHATSAPP_ENABLED ? "initializing" : "disabled",
  connected: false,
  updatedAt: new Date().toISOString(),
})

const getSessionCollection = () =>
  db().collection<WhatsappSessionDocument>("whatsapp_sessions")

const getChatsCollection = () =>
  db().collection<WhatsappChatDocument>("whatsapp_chats")

const getMessagesCollection = () =>
  db().collection<WhatsappMessageDocument>("whatsapp_messages")

const getNotificationsCollection = () =>
  db().collection<NotificationDocument>("notifications")

const gatewayFetch = async <T>(
  path: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetch(`${env.WHATSAPP_GATEWAY_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_GATEWAY_TOKEN}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; code?: string }
      | null
    const error = new Error(payload?.message ?? "WhatsApp gateway request gagal") as GatewayError
    error.code = payload?.code
    error.status = response.status
    throw error
  }

  return (await response.json()) as T
}

const buildMessagePreview = (
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

const buildChatTitle = (displayName: string | undefined, phone: string | undefined, chatId: string) => {
  const title = displayName?.trim()
  if (title) {
    return title
  }

  const normalizedPhone = phone?.trim()
  if (normalizedPhone) {
    return normalizedPhone
  }

  return chatId
}

const buildOpenWhatsappUrl = (phone?: string) => {
  if (!phone) {
    return undefined
  }

  return `https://wa.me/${normalizeWhatsappPhone(phone)}`
}

const resolveCustomerByPhone = async (phone?: string) => {
  if (!phone) {
    return null
  }

  const normalizedPhone = normalizePhone(phone)
  if (!normalizedPhone) {
    return null
  }

  return db()
    .collection<CustomerDocument>("customers")
    .findOne({ normalizedPhone })
}

const mapChat = (chat: WhatsappChatDocument): WhatsappChatSummary => ({
  chatId: chat._id,
  title: chat.title,
  phone: chat.phone,
  customerId: chat.customerId,
  customerName: chat.customerName,
  unreadCount: chat.unreadCount,
  lastMessagePreview: chat.lastMessagePreview,
  lastMessageDirection: chat.lastMessageDirection,
  lastMessageAtIso: chat.lastMessageAt,
  lastMessageAtLabel: chat.lastMessageAt ? formatRelativeLabel(chat.lastMessageAt) : undefined,
  openWhatsappUrl: buildOpenWhatsappUrl(chat.phone),
})

const mapMessage = (message: WhatsappMessageDocument): WhatsappMessageItem => ({
  providerMessageId: message._id,
  chatId: message.chatId,
  direction: message.direction,
  messageType: message.messageType,
  body: message.body,
  caption: message.caption,
  textPreview: message.textPreview,
  timestampIso: message.timestampIso,
  timestampLabel: formatDateTime(message.timestampIso),
  providerAck: message.providerAck,
  hasMedia: message.hasMedia,
  mediaMimeType: message.mediaMimeType,
  mediaName: message.mediaName,
  notificationId: message.notificationId,
  orderCode: message.orderCode,
  customerId: message.customerId,
  customerName: message.customerName,
})

const mergeStatus = (
  persisted: WhatsappSessionDocument,
  live: Partial<GatewayStatusResponse> | null,
  gatewayReachable: boolean
): WhatsappConnectionStatus => ({
  state: live?.state ?? persisted.state,
  connected: live?.connected ?? persisted.connected,
  gatewayReachable,
  currentPhone: live?.currentPhone ?? persisted.currentPhone,
  wid: live?.wid ?? persisted.wid,
  profileName: live?.profileName ?? persisted.profileName,
  lastReadyAt: persisted.lastReadyAt,
  lastDisconnectAt: persisted.lastDisconnectAt,
  lastDisconnectReason: persisted.lastDisconnectReason,
  lastAuthFailureAt: persisted.lastAuthFailureAt,
  lastAuthFailureReason: persisted.lastAuthFailureReason,
  qrCodeValue: live?.qrCodeValue,
  qrCodeDataUrl: live?.qrCodeDataUrl,
  pairingCode: live?.pairingCode,
  observedAt: live?.observedAt,
})

export const getWhatsappStatus = async (): Promise<WhatsappConnectionStatus> => {
  const persisted = (await getSessionCollection().findOne({ _id: "primary" })) ?? defaultSession()

  if (!env.WHATSAPP_ENABLED) {
    return mergeStatus(persisted, null, false)
  }

  try {
    const live = await gatewayFetch<GatewayStatusResponse>("/internal/status")
    return mergeStatus(persisted, live, true)
  } catch {
    return mergeStatus(persisted, null, false)
  }
}

export const requestWhatsappPairingCode = async (): Promise<WhatsappConnectionStatus> => {
  if (!env.WHATSAPP_ENABLED) {
    return getWhatsappStatus()
  }

  const settings = await db()
    .collection<SettingsDocument>("settings")
    .findOne({ _id: "app-settings" })

  if (!settings?.business.publicWhatsapp) {
    throw new Error("Nomor WhatsApp publik belum diatur")
  }

  const live = await gatewayFetch<GatewayRequestPairingCodeResponse>("/internal/pairing-code", {
    method: "POST",
    body: JSON.stringify({
      phoneNumber: settings.business.publicWhatsapp,
    }),
  })

  const persisted = (await getSessionCollection().findOne({ _id: "primary" })) ?? defaultSession()
  return mergeStatus(persisted, live, true)
}

export const reconnectWhatsapp = async (): Promise<WhatsappConnectionStatus> => {
  if (!env.WHATSAPP_ENABLED) {
    return getWhatsappStatus()
  }

  const live = await gatewayFetch<GatewayStatusResponse>("/internal/reconnect", {
    method: "POST",
    body: JSON.stringify({}),
  })
  const persisted = (await getSessionCollection().findOne({ _id: "primary" })) ?? defaultSession()
  return mergeStatus(persisted, live, true)
}

export const sendNotificationToWhatsapp = async (
  notification: NotificationDocument,
  message: string,
  media?: GatewayRequestBody["media"]
): Promise<GatewaySendResponse> => {
  if (!env.WHATSAPP_ENABLED) {
    const simulatedSentAt = new Date().toISOString()
    return {
      providerMessageId: `simulated:${notification._id}`,
      providerChatId: normalizeWhatsappPhone(notification.destinationPhone),
      providerAck: 1,
      sentAt: simulatedSentAt,
    }
  }

  return gatewayFetch<GatewaySendResponse>("/internal/send", {
    method: "POST",
    body: JSON.stringify({
      notificationId: notification._id,
      eventType: notification.eventType,
      toPhone: notification.destinationPhone,
      message,
      orderCode: notification.orderCode,
      ...(media ? { media } : {}),
    } satisfies GatewayRequestBody),
  })
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

  return messages.map(mapMessage)
}

export const ingestWhatsappInternalEvent = async (event: WhatsappInternalEvent) => {
  if (event.type === "session_state_changed") {
    const update: Partial<WhatsappSessionDocument> & { updatedAt: string } = {
      state: event.state,
      connected: event.connected,
      currentPhone: event.currentPhone,
      wid: event.wid,
      profileName: event.profileName,
      updatedAt: event.observedAt,
    }

    if (event.state === "connected") {
      update.lastReadyAt = event.observedAt
    }

    if (event.state === "disconnected") {
      update.lastDisconnectAt = event.observedAt
      update.lastDisconnectReason = event.lastDisconnectReason
    }

    if (event.state === "auth_failure") {
      update.lastAuthFailureAt = event.observedAt
      update.lastAuthFailureReason = event.lastAuthFailureReason
    }

    await getSessionCollection().updateOne(
      { _id: "primary" },
      {
        $set: update,
        $setOnInsert: { _id: "primary" },
      },
      { upsert: true }
    )

    return
  }

  if (event.type === "message_ack_changed") {
    await getMessagesCollection().updateOne(
      { _id: event.providerMessageId },
      {
        $set: {
          providerAck: event.providerAck,
          updatedAt: event.observedAt,
        },
      }
    )

    await getNotificationsCollection().updateOne(
      { providerMessageId: event.providerMessageId },
      {
        $set: {
          providerAck: event.providerAck,
          updatedAt: event.observedAt,
        },
      }
    )

    return
  }

  const existingMessage = await getMessagesCollection().findOne({ _id: event.providerMessageId })
  const customer = await resolveCustomerByPhone(event.phone)
  const textPreview = buildMessagePreview(
    event.direction,
    event.messageType,
    event.body,
    event.caption,
    event.mediaName
  )
  const now = new Date().toISOString()

  await getMessagesCollection().updateOne(
    { _id: event.providerMessageId },
    {
      $set: {
        chatId: event.chatId,
        phone: event.phone,
        customerId: customer?._id,
        customerName: customer?.name,
        direction: event.direction,
        messageType: event.messageType,
        body: event.body,
        caption: event.caption,
        textPreview,
        timestampIso: event.timestampIso,
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

  const existingChat = await getChatsCollection().findOne({ _id: event.chatId })
  const shouldPromoteLastMessage =
    !existingChat?.lastMessageAt ||
    event.timestampIso >= existingChat.lastMessageAt
  const nextUnreadCount =
    event.direction === "inbound" && !existingMessage
      ? (existingChat?.unreadCount ?? 0) + 1
      : (existingChat?.unreadCount ?? 0)

  const chatUpdate: Partial<WhatsappChatDocument> = {
    title: buildChatTitle(event.displayName, event.phone, event.chatId),
    phone: event.phone,
    customerId: customer?._id,
    customerName: customer?.name,
    unreadCount: nextUnreadCount,
    updatedAt: now,
  }

  if (shouldPromoteLastMessage) {
    chatUpdate.lastMessagePreview = textPreview
    chatUpdate.lastMessageDirection = event.direction
    chatUpdate.lastMessageAt = event.timestampIso
  }

  await getChatsCollection().updateOne(
    { _id: event.chatId },
    {
      $set: chatUpdate,
    },
    { upsert: true }
  )

  if (event.notificationId) {
    await getNotificationsCollection().updateOne(
      { _id: event.notificationId },
      {
        $set: {
          providerMessageId: event.providerMessageId,
          providerChatId: event.chatId,
          providerAck: event.providerAck,
          updatedAt: now,
        },
      }
    )
  }
}
