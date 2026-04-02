import bcrypt from "bcryptjs"
import { logger } from "./logger.js"
import type {
  AdminDocument,
  NotificationDocument,
  SettingsDocument,
  WhatsappChatDocument,
  WhatsappMessageDocument,
} from "./types.js"
import { getDatabase } from "./db.js"
import { defaultSettings } from "./defaults.js"
import { env } from "./env.js"
import { resolvePrimaryAdminWhatsappContact, sanitizeAdminWhatsappContacts } from "./lib/admin-whatsapp.js"
import { formatCustomerName, normalizeName, normalizePhone, normalizePhoneLabel } from "./lib/normalization.js"
import { hashOpaqueToken, tokenLast4 } from "./lib/security.js"

export const WHATSAPP_CUTOVER_BACKFILL_MIGRATION_ID = "whatsapp-cutover-backfill-v1"

const legacyWhatsappChatIdPattern = /@c\.us$/
const canonicalWhatsappChatIdPattern = /^wa:/

type RuntimeMigrationDocument = {
  _id: string
  completedAt: string
  lastRunAt: string
  lastMode: "baseline" | "incremental"
  lastSummary: Record<string, unknown>
}

const resolveConfiguredAdminCredentials = () => ({
  username:
    env.APP_ENV === "local" || env.APP_ENV === "test"
      ? env.ADMIN_USERNAME
      : env.ADMIN_BOOTSTRAP_USERNAME ?? env.ADMIN_USERNAME,
  password:
    env.APP_ENV === "local" || env.APP_ENV === "test"
      ? env.ADMIN_PASSWORD
      : env.ADMIN_BOOTSTRAP_PASSWORD ?? env.ADMIN_PASSWORD,
})

const mergeServiceCatalog = (existingServices: SettingsDocument["services"]) => {
  const defaultServices = defaultSettings().services
  const existingByCode = new Map(existingServices.map((service) => [service.serviceCode, service]))
  const mergedServices = defaultServices.map((defaultService) => existingByCode.get(defaultService.serviceCode) ?? defaultService)
  const extraServices = existingServices.filter(
    (service) => !defaultServices.some((defaultService) => defaultService.serviceCode === service.serviceCode)
  )

  return [...mergedServices, ...extraServices]
}

const extractWaIdFromAny = (value?: string) => {
  if (!value?.trim()) {
    return undefined
  }

  if (value.includes("@")) {
    const [chatDigits] = value.split("@")
    if (/^\d+$/.test(chatDigits)) {
      return chatDigits
    }
  }

  const digits = value.replace(/\D/g, "")
  if (!digits) {
    return undefined
  }

  if (digits.startsWith("62")) {
    return digits
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`
  }

  return `62${digits}`
}

const buildCanonicalWhatsappPhone = (phone?: string, waId?: string) => {
  if (phone?.trim()) {
    const normalizedPhone = normalizePhone(phone)
    if (normalizedPhone) {
      return normalizedPhone
    }
  }

  const normalizedWaId = extractWaIdFromAny(waId)
  return normalizedWaId ? `+${normalizedWaId}` : undefined
}

const buildCanonicalWhatsappChatId = (
  waId?: string,
  phone?: string,
  fallbackChatId?: string
) => {
  const canonicalWaId = extractWaIdFromAny(waId) ?? extractWaIdFromAny(phone)
  if (canonicalWaId) {
    return `wa:${canonicalWaId}`
  }

  if (fallbackChatId?.startsWith("wa:")) {
    return fallbackChatId
  }

  return undefined
}

const mapAckToProviderStatus = (providerAck?: number) => {
  if (typeof providerAck !== "number") {
    return undefined
  }

  if (providerAck >= 3) {
    return "read" as const
  }
  if (providerAck === 2) {
    return "delivered" as const
  }
  if (providerAck === 1) {
    return "sent" as const
  }

  return "accepted" as const
}

const isWhatsappLegacyMarker = (value?: string) => Boolean(value?.includes("@c.us"))

const isIsoAfter = (candidate?: string, current?: string) => {
  if (!candidate) {
    return false
  }
  if (!current) {
    return true
  }

  return Date.parse(candidate) > Date.parse(current)
}

const buildWhatsappChatTitle = (
  customerName?: string,
  displayName?: string,
  title?: string,
  phone?: string,
  fallbackChatId?: string
) => {
  if (customerName?.trim()) {
    return customerName
  }
  if (displayName?.trim()) {
    return displayName
  }
  if (title?.trim()) {
    return title
  }
  if (phone?.trim()) {
    return phone
  }

  return fallbackChatId ?? "WhatsApp Chat"
}

type WhatsappCanonicalChatAggregate = Partial<WhatsappChatDocument> & { _id: string }

const mergeCanonicalChatAggregate = (
  aggregate: WhatsappCanonicalChatAggregate | undefined,
  candidate: Partial<WhatsappChatDocument> & { _id: string }
) => {
  const merged: WhatsappCanonicalChatAggregate = aggregate
    ? { ...aggregate }
    : {
        _id: candidate._id,
        title: candidate.title,
        unreadCount: 0,
        lastMessagePreview: "Belum ada pesan",
        composerMode: "template_only",
        updatedAt: new Date(0).toISOString(),
      }

  if (candidate.waId && !merged.waId) {
    merged.waId = candidate.waId
  }
  if (candidate.phone && !merged.phone) {
    merged.phone = candidate.phone
  }
  if (candidate.customerId && !merged.customerId) {
    merged.customerId = candidate.customerId
  }
  if (candidate.customerName && !merged.customerName) {
    merged.customerName = candidate.customerName
  }
  if (candidate.displayName && !merged.displayName) {
    merged.displayName = candidate.displayName
  }
  if (candidate.title && !merged.title) {
    merged.title = candidate.title
  }

  merged.unreadCount = Math.max(merged.unreadCount ?? 0, candidate.unreadCount ?? 0)

  if (isIsoAfter(candidate.lastMessageAt, merged.lastMessageAt)) {
    merged.lastMessageAt = candidate.lastMessageAt
    merged.lastMessagePreview = candidate.lastMessagePreview ?? merged.lastMessagePreview
    merged.lastMessageDirection = candidate.lastMessageDirection ?? merged.lastMessageDirection
  }

  if (isIsoAfter(candidate.lastInboundAt, merged.lastInboundAt)) {
    merged.lastInboundAt = candidate.lastInboundAt
  }
  if (isIsoAfter(candidate.cswOpenedAt, merged.cswOpenedAt)) {
    merged.cswOpenedAt = candidate.cswOpenedAt
  }
  if (isIsoAfter(candidate.cswExpiresAt, merged.cswExpiresAt)) {
    merged.cswExpiresAt = candidate.cswExpiresAt
  }
  if (isIsoAfter(candidate.fepOpenedAt, merged.fepOpenedAt)) {
    merged.fepOpenedAt = candidate.fepOpenedAt
  }
  if (isIsoAfter(candidate.fepExpiresAt, merged.fepExpiresAt)) {
    merged.fepExpiresAt = candidate.fepExpiresAt
  }
  if (isIsoAfter(candidate.updatedAt, merged.updatedAt)) {
    merged.updatedAt = candidate.updatedAt
  }

  merged.title = buildWhatsappChatTitle(
    candidate.customerName ?? merged.customerName,
    candidate.displayName ?? merged.displayName,
    candidate.title ?? merged.title,
    candidate.phone ?? merged.phone,
    candidate._id
  )
  merged.composerMode =
    merged.cswExpiresAt && Date.parse(merged.cswExpiresAt) > Date.now()
      ? "free_form"
      : "template_only"

  return merged
}

const buildWhatsappChatBackfillQuery = (mode: "baseline" | "incremental") =>
  mode === "baseline"
    ? {}
    : {
        $or: [
          {
            _id: legacyWhatsappChatIdPattern,
            isLegacyShadow: { $ne: true },
          },
          {
            _id: canonicalWhatsappChatIdPattern,
            waId: { $exists: false },
          },
          {
            _id: canonicalWhatsappChatIdPattern,
            phone: { $exists: false },
          },
          {
            shadowedByChatId: { $exists: true },
            isLegacyShadow: { $ne: true },
          },
        ],
      }

const buildWhatsappMessageBackfillQuery = (mode: "baseline" | "incremental") =>
  mode === "baseline"
    ? {}
    : {
        $or: [
          { chatId: legacyWhatsappChatIdPattern },
          {
            providerKind: { $exists: false },
            providerAck: { $exists: true },
          },
          {
            providerStatus: { $exists: false },
            providerAck: { $exists: true },
          },
          {
            providerKind: { $exists: false },
            source: "legacy_mirror" as const,
          },
          {
            providerStatus: { $exists: false },
            source: "legacy_mirror" as const,
          },
        ],
      }

const buildNotificationBackfillQuery = (mode: "baseline" | "incremental") =>
  mode === "baseline"
    ? {}
    : {
        $or: [
          {
            providerKind: { $exists: false },
            providerAck: { $exists: true },
          },
          {
            providerStatus: { $exists: false },
            providerAck: { $exists: true },
          },
          {
            providerKind: { $exists: false },
            providerChatId: legacyWhatsappChatIdPattern,
          },
          {
            providerStatus: { $exists: false },
            providerChatId: legacyWhatsappChatIdPattern,
          },
          {
            waId: { $exists: false },
            providerChatId: legacyWhatsappChatIdPattern,
          },
          {
            latestErrorCode: { $exists: false },
            gatewayErrorCode: { $exists: true },
          },
        ],
      }

const backfillWhatsappCutoverData = async (mode: "baseline" | "incremental") => {
  const database = getDatabase()
  const chatsCollection = database.collection<WhatsappChatDocument>("whatsapp_chats")
  const messagesCollection = database.collection<WhatsappMessageDocument>("whatsapp_messages")
  const notificationsCollection = database.collection<NotificationDocument>("notifications")

  const summary = {
    mode,
    notificationsUpdated: 0,
    messagesUpdated: 0,
    chatsShadowed: 0,
    canonicalChatsUpserted: 0,
  }

  const canonicalChats = new Map<string, WhatsappCanonicalChatAggregate>()
  const now = new Date().toISOString()

  const chatsCursor = chatsCollection.find(buildWhatsappChatBackfillQuery(mode), { batchSize: 200 })
  for await (const chat of chatsCursor) {
    const canonicalWaId = extractWaIdFromAny(chat.waId) ?? extractWaIdFromAny(chat.phone) ?? extractWaIdFromAny(chat._id)
    const canonicalPhone = buildCanonicalWhatsappPhone(chat.phone, canonicalWaId)
    const canonicalChatId = buildCanonicalWhatsappChatId(canonicalWaId, canonicalPhone, chat._id)

    if (canonicalChatId) {
      canonicalChats.set(
        canonicalChatId,
        mergeCanonicalChatAggregate(canonicalChats.get(canonicalChatId), {
          _id: canonicalChatId,
          title: chat.title,
          waId: canonicalWaId,
          phone: canonicalPhone,
          customerId: chat.customerId,
          customerName: chat.customerName,
          displayName: chat.displayName,
          unreadCount: chat.unreadCount,
          lastMessagePreview: chat.lastMessagePreview,
          lastMessageDirection: chat.lastMessageDirection,
          lastMessageAt: chat.lastMessageAt,
          lastInboundAt: chat.lastInboundAt,
          cswOpenedAt: chat.cswOpenedAt,
          cswExpiresAt: chat.cswExpiresAt,
          fepOpenedAt: chat.fepOpenedAt,
          fepExpiresAt: chat.fepExpiresAt,
          updatedAt: chat.updatedAt,
        })
      )
    }

    const nextSet: Partial<WhatsappChatDocument> = {}
    let shouldUpdate = false

    if (canonicalWaId && canonicalWaId !== chat.waId) {
      nextSet.waId = canonicalWaId
      shouldUpdate = true
    }
    if (canonicalPhone && canonicalPhone !== chat.phone) {
      nextSet.phone = canonicalPhone
      shouldUpdate = true
    }

    if (canonicalChatId && canonicalChatId !== chat._id) {
      if (!chat.isLegacyShadow || chat.shadowedByChatId !== canonicalChatId) {
        nextSet.isLegacyShadow = true
        nextSet.shadowedByChatId = canonicalChatId
        nextSet.legacySourceChatId = chat.legacySourceChatId ?? chat._id
        shouldUpdate = true
        summary.chatsShadowed += 1
      }
    } else if (chat.isLegacyShadow || chat.shadowedByChatId) {
      await chatsCollection.updateOne(
        { _id: chat._id },
        {
          $set: {
            ...(nextSet.waId ? { waId: nextSet.waId } : {}),
            ...(nextSet.phone ? { phone: nextSet.phone } : {}),
            isLegacyShadow: false,
            updatedAt: now,
          },
          $unset: {
            shadowedByChatId: "",
          },
        }
      )
      continue
    }

    if (shouldUpdate) {
      await chatsCollection.updateOne(
        { _id: chat._id },
        {
          $set: {
            ...nextSet,
            updatedAt: now,
          },
        }
      )
    }
  }

  const messagesCursor = messagesCollection.find(buildWhatsappMessageBackfillQuery(mode), { batchSize: 200 })
  for await (const message of messagesCursor) {
    const derivedProviderKind =
      message.providerKind ??
      (message.providerAck !== undefined || isWhatsappLegacyMarker(message.chatId)
        ? "webjs_legacy"
        : undefined)
    const derivedWaId =
      extractWaIdFromAny(message.waId) ??
      extractWaIdFromAny(message.phone) ??
      extractWaIdFromAny(message.chatId)
    const derivedPhone = buildCanonicalWhatsappPhone(message.phone, derivedWaId)
    const canonicalChatId =
      buildCanonicalWhatsappChatId(derivedWaId, derivedPhone, message.chatId) ?? message.chatId
    const derivedProviderStatus = message.providerStatus ?? mapAckToProviderStatus(message.providerAck)
    const nextSet: Partial<WhatsappMessageDocument> = {}
    let shouldUpdate = false

    if (derivedProviderKind && derivedProviderKind !== message.providerKind) {
      nextSet.providerKind = derivedProviderKind
      shouldUpdate = true
    }
    if (derivedWaId && derivedWaId !== message.waId) {
      nextSet.waId = derivedWaId
      shouldUpdate = true
    }
    if (derivedPhone && derivedPhone !== message.phone) {
      nextSet.phone = derivedPhone
      shouldUpdate = true
    }
    if (canonicalChatId !== message.chatId) {
      nextSet.chatId = canonicalChatId
      shouldUpdate = true
    }
    if (derivedProviderStatus && derivedProviderStatus !== message.providerStatus) {
      nextSet.providerStatus = derivedProviderStatus
      nextSet.providerStatusAt = message.providerStatusAt ?? message.updatedAt ?? message.timestampIso
      shouldUpdate = true
    }

    const nextMessage = {
      ...message,
      ...nextSet,
    }

    canonicalChats.set(
      nextMessage.chatId,
      mergeCanonicalChatAggregate(canonicalChats.get(nextMessage.chatId), {
        _id: nextMessage.chatId,
        waId: nextMessage.waId,
        phone: nextMessage.phone,
        customerId: nextMessage.customerId,
        customerName: nextMessage.customerName,
        displayName: nextMessage.customerName,
        unreadCount: nextMessage.direction === "inbound" ? 1 : 0,
        lastMessagePreview: nextMessage.textPreview,
        lastMessageDirection: nextMessage.direction,
        lastMessageAt: nextMessage.timestampIso,
        lastInboundAt: nextMessage.direction === "inbound" ? nextMessage.timestampIso : undefined,
        updatedAt: nextMessage.updatedAt,
      })
    )

    if (shouldUpdate) {
      await messagesCollection.updateOne(
        { _id: message._id },
        {
          $set: {
            ...nextSet,
            updatedAt: now,
          },
        }
      )
      summary.messagesUpdated += 1
    }
  }

  const notificationsCursor = notificationsCollection.find(buildNotificationBackfillQuery(mode), { batchSize: 200 })
  for await (const notification of notificationsCursor) {
    const derivedProviderKind =
      notification.providerKind ??
      (notification.providerAck !== undefined || isWhatsappLegacyMarker(notification.providerChatId)
        ? "webjs_legacy"
        : undefined)
    const derivedWaId =
      extractWaIdFromAny(notification.waId) ??
      extractWaIdFromAny(notification.providerChatId) ??
      extractWaIdFromAny(notification.destinationPhone)
    const derivedProviderStatus =
      notification.providerStatus ?? mapAckToProviderStatus(notification.providerAck)
    const nextSet: Partial<NotificationDocument> = {}
    let shouldUpdate = false

    if (derivedProviderKind && derivedProviderKind !== notification.providerKind) {
      nextSet.providerKind = derivedProviderKind
      shouldUpdate = true
    }
    if (derivedWaId && derivedWaId !== notification.waId) {
      nextSet.waId = derivedWaId
      shouldUpdate = true
    }
    if (derivedProviderStatus && derivedProviderStatus !== notification.providerStatus) {
      nextSet.providerStatus = derivedProviderStatus
      nextSet.providerStatusAt =
        notification.providerStatusAt ?? notification.sentAt ?? notification.updatedAt
      shouldUpdate = true
    }
    if (!notification.latestErrorCode && notification.gatewayErrorCode) {
      nextSet.latestErrorCode = notification.gatewayErrorCode
      shouldUpdate = true
    }

    if (shouldUpdate) {
      await notificationsCollection.updateOne(
        { _id: notification._id },
        {
          $set: {
            ...nextSet,
            updatedAt: now,
          },
        }
      )
      summary.notificationsUpdated += 1
    }
  }

  for (const [chatId, aggregate] of canonicalChats.entries()) {
    const existingCanonicalChat = await chatsCollection.findOne({ _id: chatId })
    const mergedAggregate = existingCanonicalChat
      ? mergeCanonicalChatAggregate(aggregate, {
          _id: existingCanonicalChat._id,
          title: existingCanonicalChat.title,
          waId: existingCanonicalChat.waId,
          phone: existingCanonicalChat.phone,
          customerId: existingCanonicalChat.customerId,
          customerName: existingCanonicalChat.customerName,
          displayName: existingCanonicalChat.displayName,
          unreadCount: existingCanonicalChat.unreadCount,
          lastMessagePreview: existingCanonicalChat.lastMessagePreview,
          lastMessageDirection: existingCanonicalChat.lastMessageDirection,
          lastMessageAt: existingCanonicalChat.lastMessageAt,
          lastInboundAt: existingCanonicalChat.lastInboundAt,
          cswOpenedAt: existingCanonicalChat.cswOpenedAt,
          cswExpiresAt: existingCanonicalChat.cswExpiresAt,
          fepOpenedAt: existingCanonicalChat.fepOpenedAt,
          fepExpiresAt: existingCanonicalChat.fepExpiresAt,
          updatedAt: existingCanonicalChat.updatedAt,
        })
      : aggregate

    await chatsCollection.updateOne(
      { _id: chatId },
      {
        $set: {
          title: buildWhatsappChatTitle(
            mergedAggregate.customerName,
            mergedAggregate.displayName,
            mergedAggregate.title,
            mergedAggregate.phone,
            chatId
          ),
          waId: mergedAggregate.waId,
          displayName: mergedAggregate.displayName,
          phone: mergedAggregate.phone,
          customerId: mergedAggregate.customerId,
          customerName: mergedAggregate.customerName,
          unreadCount: mergedAggregate.unreadCount ?? 0,
          lastMessagePreview: mergedAggregate.lastMessagePreview ?? "Belum ada pesan",
          lastMessageDirection: mergedAggregate.lastMessageDirection,
          lastMessageAt: mergedAggregate.lastMessageAt,
          lastInboundAt: mergedAggregate.lastInboundAt,
          cswOpenedAt: mergedAggregate.cswOpenedAt,
          cswExpiresAt: mergedAggregate.cswExpiresAt,
          fepOpenedAt: mergedAggregate.fepOpenedAt,
          fepExpiresAt: mergedAggregate.fepExpiresAt,
          composerMode:
            mergedAggregate.cswExpiresAt && Date.parse(mergedAggregate.cswExpiresAt) > Date.now()
              ? "free_form"
              : "template_only",
          isLegacyShadow: false,
          updatedAt: mergedAggregate.updatedAt ?? now,
        },
        $unset: {
          shadowedByChatId: "",
        },
      },
      { upsert: true }
    )
    summary.canonicalChatsUpserted += 1
  }

  return summary
}

export const ensureSeedData = async () => {
  const startedAt = Date.now()
  const db = getDatabase()
  const settingsCollection = db.collection<SettingsDocument>("settings")
  const adminCollection = db.collection<AdminDocument>("admins")
  const seedSummary = {
    customerNamesNormalized: 0,
    magicLinksHashed: 0,
    directTokensHashed: 0,
    orderActivityBackfilled: 0,
    notificationNamesNormalized: 0,
  }

  const existingSettings = await settingsCollection.findOne({ _id: "app-settings" })
  if (!existingSettings) {
    await settingsCollection.insertOne(defaultSettings())
  } else {
    const normalizedPublicWhatsapp =
      normalizePhoneLabel(existingSettings.business.publicWhatsapp) || existingSettings.business.publicWhatsapp.trim()
    const nextAdminWhatsappContacts = sanitizeAdminWhatsappContacts(
      existingSettings.business.adminWhatsappContacts,
      [
        existingSettings.business.publicContactPhone,
        normalizedPublicWhatsapp,
      ]
    )
    const primaryAdminWhatsappContact = resolvePrimaryAdminWhatsappContact(nextAdminWhatsappContacts, [
      existingSettings.business.publicContactPhone,
      normalizedPublicWhatsapp,
    ])
    const nextBusiness = {
      ...existingSettings.business,
      laundryName: existingSettings.business.laundryName.trim(),
      laundryPhone:
        normalizePhoneLabel(existingSettings.business.laundryPhone) ||
        existingSettings.business.laundryPhone.trim(),
      publicContactPhone: primaryAdminWhatsappContact.phone,
      publicWhatsapp: normalizedPublicWhatsapp || primaryAdminWhatsappContact.phone,
      adminWhatsappContacts: nextAdminWhatsappContacts,
      address: existingSettings.business.address.trim(),
      operatingHours: existingSettings.business.operatingHours.trim(),
    }
    const nextServices = mergeServiceCatalog(existingSettings.services)

    const shouldUpdateSettings =
      JSON.stringify(nextBusiness) !== JSON.stringify(existingSettings.business) ||
      JSON.stringify(nextServices) !== JSON.stringify(existingSettings.services)

    if (shouldUpdateSettings || "messageTemplates" in existingSettings) {
      await settingsCollection.updateOne(
        { _id: "app-settings" },
        {
          $set: {
            business: nextBusiness,
            services: nextServices,
            updatedAt: new Date().toISOString(),
          },
          $unset: {
            messageTemplates: "",
          },
        }
      )
    }
  }

  const configuredAdmin = resolveConfiguredAdminCredentials()
  const currentAdmin = await adminCollection.findOne({ _id: "admin-primary" })

  if (!currentAdmin) {
    const passwordHash = await bcrypt.hash(configuredAdmin.password, 10)
    await adminCollection.insertOne({
      _id: "admin-primary",
      username: configuredAdmin.username,
      passwordHash,
      createdAt: new Date().toISOString()
    })
  } else {
    const usernameChanged = currentAdmin.username !== configuredAdmin.username
    const passwordChanged = !(await bcrypt.compare(configuredAdmin.password, currentAdmin.passwordHash))

    if (usernameChanged || passwordChanged) {
      await adminCollection.updateOne(
        { _id: "admin-primary" },
        {
          $set: {
            username: configuredAdmin.username,
            ...(passwordChanged
              ? { passwordHash: await bcrypt.hash(configuredAdmin.password, 10) }
              : {}),
          }
        }
      )
    }
  }

  await db.collection("customers").createIndex({ normalizedPhone: 1 }, { unique: true })
  await db.collection("customers").createIndex({ phoneDigits: 1 })
  await db.collection("customers").createIndex({ normalizedName: 1 })
  await db.collection("customer_magic_links").createIndex({ tokenHash: 1 }, { unique: true })
  await db.collection("customer_magic_links").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("orders").createIndex({ orderCode: 1 }, { unique: true })
  await db.collection("orders").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("orders").createIndex({ status: 1, createdAt: -1 })
  await db.collection("orders").createIndex({ activityAt: -1, _id: -1 })
  await db.collection("orders").createIndex({ status: 1, activityAt: -1, _id: -1 })
  await db.collection("direct_order_tokens").createIndex({ tokenHash: 1 }, { unique: true })
  await db.collection("direct_order_tokens").createIndex({ orderId: 1 })
  await db.collection("notifications").createIndex({ businessKey: 1 }, { unique: true })
  await db.collection("notifications").createIndex({ deliveryStatus: 1, createdAt: 1 })
  await db.collection("notifications").createIndex({ eventType: 1, renderStatus: 1, createdAt: 1 })
  await db.collection("notifications").createIndex({ providerMessageId: 1 }, { sparse: true })
  await db.collection("idempotency_keys").createIndex({ scope: 1, key: 1 }, { unique: true })
  await db.collection("point_ledgers").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("point_ledgers").createIndex({ orderId: 1 })
  await db.collection("leaderboard_snapshots").createIndex({ monthKey: 1, version: -1 }, { unique: true })
  await db.collection("audit_logs").createIndex({ entityType: 1, entityId: 1, createdAt: -1 })
  await db.collection("audit_logs").createIndex({ requestId: 1, createdAt: -1 }, { sparse: true })
  await db.collection("rate_limits").createIndex({ resetTime: 1 }, { expireAfterSeconds: 0 })
  await db.collection("runtime_migrations").createIndex({ lastRunAt: -1 })
  await db.collection("whatsapp_webhook_receipts").createIndex({ createdAt: 1 })
  await db.collection("whatsapp_chats").createIndex({ isLegacyShadow: 1, lastMessageAt: -1, updatedAt: -1 })
  await db.collection("whatsapp_chats").createIndex({ phone: 1 }, { sparse: true })
  await db.collection("whatsapp_chats").createIndex({ shadowedByChatId: 1 }, { sparse: true })
  await db.collection("whatsapp_messages").createIndex({ chatId: 1, timestampIso: 1 })
  await db.collection("whatsapp_messages").createIndex({ phone: 1 }, { sparse: true })
  await db.collection("whatsapp_messages").createIndex({ providerMediaId: 1 }, { sparse: true })
  await db.collection("whatsapp_messages").createIndex({ mediaStorageId: 1 }, { sparse: true })
  await db.collection("whatsapp_messages").createIndex(
    { providerKind: 1, hasMedia: 1, mediaDownloadStatus: 1, updatedAt: 1 },
    { sparse: true }
  )

  const customers = await db.collection("customers").find({}).toArray()

  for (const customer of customers) {
    const formattedName = formatCustomerName(customer.name)
    const normalizedCustomerName = normalizeName(customer.name)
    const nextPhoneDigits = normalizePhone(customer.phone).replace(/\D/g, "")
    const nextPublicNameVisible = customer.publicNameVisible ?? false
    if (
      customer.name === formattedName &&
      customer.normalizedName === normalizedCustomerName &&
      customer.phoneDigits === nextPhoneDigits &&
      customer.publicNameVisible === nextPublicNameVisible
    ) {
      continue
    }

    await db.collection("customers").updateOne(
      { _id: customer._id },
      {
        $set: {
          name: formattedName,
          normalizedName: normalizedCustomerName,
          phoneDigits: nextPhoneDigits,
          publicNameVisible: nextPublicNameVisible
        }
      }
    )
    seedSummary.customerNamesNormalized += 1
  }

  await db.collection("customers").updateMany(
    { publicNameVisible: { $exists: false } },
    { $set: { publicNameVisible: false } }
  )

  const magicLinks = await db.collection("customer_magic_links").find({}).toArray()
  for (const magicLink of magicLinks) {
    if (!magicLink.tokenHash && typeof magicLink.token === "string" && magicLink.token.length > 0) {
      await db.collection("customer_magic_links").updateOne(
        { _id: magicLink._id },
        {
          $set: {
            tokenHash: hashOpaqueToken(magicLink.token),
            tokenLast4: tokenLast4(magicLink.token),
          },
          $unset: {
            token: "",
          }
        }
      )
      seedSummary.magicLinksHashed += 1
    }
  }

  const directTokens = await db.collection("direct_order_tokens").find({}).toArray()
  for (const directToken of directTokens) {
    if (!directToken.tokenHash && typeof directToken.token === "string" && directToken.token.length > 0) {
      await db.collection("direct_order_tokens").updateOne(
        { _id: directToken._id },
        {
          $set: {
            tokenHash: hashOpaqueToken(directToken.token),
            tokenLast4: tokenLast4(directToken.token),
          },
          $unset: {
            token: "",
          }
        }
      )
      seedSummary.directTokensHashed += 1
    }
  }

  await db.collection("orders").updateMany(
    { directToken: { $exists: true } },
    {
      $unset: {
        directToken: "",
      }
    }
  )

  const orders = await db.collection("orders").find({}).toArray()
  for (const order of orders) {
    const activityAt =
      order.status === "Done"
        ? order.completedAt ?? order.createdAt
        : order.status === "Voided"
          ? order.voidedAt ?? order.createdAt
          : order.createdAt
    const customerName = formatCustomerName(order.customerName)
    const receiptCustomerName = formatCustomerName(order.receiptSnapshot?.customerName ?? order.customerName)
    if (
      customerName === order.customerName &&
      receiptCustomerName === order.receiptSnapshot?.customerName &&
      activityAt === order.activityAt
    ) {
      continue
    }

    await db.collection("orders").updateOne(
      { _id: order._id },
      {
        $set: {
          customerName,
          "receiptSnapshot.customerName": receiptCustomerName,
          activityAt,
        }
      }
    )
    seedSummary.orderActivityBackfilled += 1
  }

  const notifications = await db.collection("notifications").find({}).toArray()
  for (const notification of notifications) {
    const customerName = formatCustomerName(notification.customerName)
    if (customerName === notification.customerName) {
      continue
    }

    await db.collection("notifications").updateOne(
      { _id: notification._id },
      { $set: { customerName } }
    )
    seedSummary.notificationNamesNormalized += 1
  }

  const migrationsCollection = db.collection<RuntimeMigrationDocument>("runtime_migrations")
  const existingWhatsappBackfillMigration = await migrationsCollection.findOne({
    _id: WHATSAPP_CUTOVER_BACKFILL_MIGRATION_ID,
  })
  const whatsappBackfillMode = existingWhatsappBackfillMigration ? "incremental" : "baseline"
  const whatsappSummary = await backfillWhatsappCutoverData(whatsappBackfillMode)

  await migrationsCollection.updateOne(
    { _id: WHATSAPP_CUTOVER_BACKFILL_MIGRATION_ID },
    {
      $set: {
        completedAt: existingWhatsappBackfillMigration?.completedAt ?? new Date().toISOString(),
        lastRunAt: new Date().toISOString(),
        lastMode: whatsappBackfillMode,
        lastSummary: whatsappSummary,
      },
      $setOnInsert: {
        _id: WHATSAPP_CUTOVER_BACKFILL_MIGRATION_ID,
      },
    },
    { upsert: true }
  )

  logger.info({
    event: "seed.completed",
    durationMs: Date.now() - startedAt,
    appEnv: env.APP_ENV,
    summary: {
      ...seedSummary,
      ...whatsappSummary,
    },
  })
}
