import type { WhatsappMessageItem } from "@cjl/contracts"
import { env } from "../env.js"
import { getDatabase } from "../db.js"
import { createId } from "../lib/ids.js"
import { maskPhone } from "../lib/security.js"
import { logger, serializeError } from "../logger.js"
import { getRequestContext } from "../request-context.js"
import type {
  AuditLogDocument,
  CustomerDocument,
  WhatsappChatDocument,
  WhatsappMessageDocument,
} from "../types.js"
import { DependencyError, NotFoundError, ValidationError } from "../errors.js"
import { sendCloudTextMessage } from "./whatsapp-cloud.js"
import {
  buildMessagePreview,
  buildPhoneLabel,
  isWindowOpen,
  mapWhatsappMessage,
  resolveCustomerByPhone,
} from "./whatsapp.js"

const db = () => getDatabase()

const getChatsCollection = () =>
  db().collection<WhatsappChatDocument>("whatsapp_chats")

const getMessagesCollection = () =>
  db().collection<WhatsappMessageDocument>("whatsapp_messages")

const saveManualSendAudit = async ({
  chatId,
  outcome,
  metadata,
}: {
  chatId: string
  outcome: "success" | "failure"
  metadata?: Record<string, unknown>
}) => {
  const context = getRequestContext()
  await db().collection<AuditLogDocument>("audit_logs").insertOne({
    _id: createId("audit"),
    actorType: context?.actorType ?? "system",
    actorId: context?.actorId ?? "system",
    actorSource: context?.actorSource ?? "system",
    action: "whatsapp.manual_message.send",
    entityType: "whatsapp_chat",
    entityId: chatId,
    outcome,
    requestId: context?.requestId,
    origin: context?.origin,
    ipHash: context?.ipHash,
    userAgent: context?.userAgent,
    metadata,
    createdAt: new Date().toISOString(),
  })
}

const assertCloudProviderReady = () => {
  if (env.WHATSAPP_PROVIDER !== "cloud_api") {
    throw new DependencyError("WhatsApp Cloud API sedang tidak aktif")
  }

  for (const [field, value] of [
    ["WHATSAPP_PHONE_NUMBER_ID", env.WHATSAPP_PHONE_NUMBER_ID],
    ["WHATSAPP_ACCESS_TOKEN", env.WHATSAPP_ACCESS_TOKEN],
  ] as const) {
    if (!value?.trim()) {
      throw new DependencyError(`Konfigurasi ${field} belum lengkap untuk WhatsApp Cloud API`)
    }
  }
}

const resolveRecipientFromChat = async (chat: WhatsappChatDocument) => {
  const phone = buildPhoneLabel(chat.phone, chat.waId)
  const customer =
    chat.customerId
      ? await db().collection<CustomerDocument>("customers").findOne({ _id: chat.customerId })
      : await resolveCustomerByPhone(phone, chat.waId)
  const recipient = phone ?? chat.waId

  if (!recipient?.trim()) {
    throw new ValidationError("Thread WhatsApp belum memiliki identitas penerima yang lengkap")
  }

  return {
    recipient,
    phone,
    customer,
  }
}

export const sendManualWhatsappMessage = async ({
  chatId,
  body,
}: {
  chatId: string
  body: string
}): Promise<WhatsappMessageItem> => {
  assertCloudProviderReady()

  const chat = await getChatsCollection().findOne({ _id: chatId })
  if (!chat) {
    throw new NotFoundError("Thread WhatsApp tidak ditemukan")
  }

  try {
    if (!isWindowOpen(chat.cswExpiresAt)) {
      throw new ValidationError("Customer service window sudah tertutup. Thread ini hanya boleh memakai template.")
    }

    const trimmedBody = body.trim()
    if (!trimmedBody) {
      throw new ValidationError("Pesan WhatsApp tidak boleh kosong")
    }

    const { recipient, phone, customer } = await resolveRecipientFromChat(chat)

    logger.info({
      event: "whatsapp.manual_send.requested",
      chatId,
      destinationPhone: maskPhone(phone ?? recipient),
    })

    const delivery = await sendCloudTextMessage({
      to: recipient,
      body: trimmedBody,
    })
    const timestampIso = delivery.providerStatusAt
    const messageDocument: WhatsappMessageDocument = {
      _id: delivery.providerMessageId,
      chatId: chat._id,
      providerKind: "cloud_api",
      waId: delivery.waId ?? chat.waId,
      phone: phone ?? chat.phone,
      customerId: customer?._id ?? chat.customerId,
      customerName: customer?.name ?? chat.customerName,
      direction: "outbound",
      messageType: "text",
      body: trimmedBody,
      textPreview: buildMessagePreview("outbound", "text", trimmedBody),
      timestampIso,
      providerStatus: delivery.providerStatus,
      providerStatusAt: delivery.providerStatusAt,
      source: "manual_operator",
      hasMedia: false,
      createdAt: timestampIso,
      updatedAt: timestampIso,
    }

    await getMessagesCollection().updateOne(
      { _id: messageDocument._id },
      {
        $set: messageDocument,
      },
      { upsert: true }
    )

    await getChatsCollection().updateOne(
      { _id: chat._id },
      {
        $set: {
          waId: messageDocument.waId ?? chat.waId,
          phone: messageDocument.phone ?? chat.phone,
          customerId: messageDocument.customerId ?? chat.customerId,
          customerName: messageDocument.customerName ?? chat.customerName,
          lastMessagePreview: messageDocument.textPreview,
          lastMessageDirection: "outbound",
          lastMessageAt: timestampIso,
          updatedAt: timestampIso,
        },
      }
    )

    await saveManualSendAudit({
      chatId,
      outcome: "success",
      metadata: {
        providerMessageId: delivery.providerMessageId,
        destinationPhone: phone ?? recipient,
      },
    })

    return mapWhatsappMessage(messageDocument)
  } catch (error) {
    await saveManualSendAudit({
      chatId,
      outcome: "failure",
      metadata: {
        destinationPhone: chat.phone ?? chat.waId,
        error: error instanceof Error ? error.message : "Gagal mengirim pesan manual WhatsApp",
      },
    })

    logger.error({
      event: "whatsapp.manual_send.failed",
      chatId,
      destinationPhone: maskPhone(chat.phone ?? chat.waId ?? chatId),
      error: serializeError(error),
    })
    throw error
  }
}
