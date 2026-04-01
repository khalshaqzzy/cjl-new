import crypto from "node:crypto"
import { GridFSBucket, MongoServerError, ObjectId } from "mongodb"
import type { Readable } from "node:stream"
import { NotFoundError, ValidationError } from "../errors.js"
import { getDatabase } from "../db.js"
import { env } from "../env.js"
import { logger, serializeError } from "../logger.js"
import type {
  WhatsappMessageDocument,
  WhatsappWebhookReceiptDocument,
} from "../types.js"
import { saveAuditLog } from "./common.js"
import {
  ingestCloudInboundMessage,
  ingestCloudStatusUpdate,
} from "./whatsapp.js"

const db = () => getDatabase()

const getWebhookReceiptCollection = () =>
  db().collection<WhatsappWebhookReceiptDocument>("whatsapp_webhook_receipts")

const getMessagesCollection = () =>
  db().collection<WhatsappMessageDocument>("whatsapp_messages")

const getMediaBucket = () =>
  new GridFSBucket(db(), { bucketName: "whatsapp_media" })

type MetaWebhookPayload = {
  object?: string
  entry?: MetaWebhookEntry[]
}

type MetaWebhookEntry = {
  id?: string
  changes?: MetaWebhookChange[]
}

type MetaWebhookChange = {
  field?: string
  value?: Record<string, unknown>
}

type MetaWebhookContact = {
  wa_id?: string
  profile?: {
    name?: string
  }
}

type MetaWebhookMessageNode = {
  id?: string
  from?: string
  timestamp?: string
  type?: string
  text?: {
    body?: string
  }
  image?: MetaWebhookMediaNode
  document?: MetaWebhookMediaNode
  audio?: MetaWebhookMediaNode
  video?: MetaWebhookMediaNode
  sticker?: MetaWebhookMediaNode
  button?: {
    text?: string
  }
  interactive?: {
    button_reply?: {
      title?: string
    }
    list_reply?: {
      title?: string
    }
  }
}

type MetaWebhookMediaNode = {
  id?: string
  mime_type?: string
  sha256?: string
  filename?: string
  caption?: string
  file_size?: number | string
}

type MetaWebhookStatusNode = {
  id?: string
  recipient_id?: string
  status?: string
  timestamp?: string
  pricing?: {
    type?: string
    category?: string
  }
  conversation?: {
    expiration_timestamp?: string
  }
  errors?: Array<{
    code?: number | string
    message?: string
    title?: string
  }>
}

type StoredWhatsappMedia = {
  stream: Readable
  filename: string
  contentType: string
  length?: number
}

let mediaWorkerTimer: NodeJS.Timeout | null = null
let mediaWorkerActive = false
const mediaDownloadsInFlight = new Set<string>()

const toIsoTimestamp = (input?: number | string) => {
  if (typeof input === "number" && Number.isFinite(input)) {
    return new Date(input * 1000).toISOString()
  }

  if (typeof input === "string" && input.trim()) {
    const numericValue = Number(input)
    if (Number.isFinite(numericValue)) {
      return new Date(numericValue * 1000).toISOString()
    }

    const direct = new Date(input)
    if (!Number.isNaN(direct.getTime())) {
      return direct.toISOString()
    }
  }

  return new Date().toISOString()
}

const createPayloadFingerprint = (payload: unknown) =>
  crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex")

const buildWebhookReceiptId = (
  kind: WhatsappWebhookReceiptDocument["kind"],
  providerMessageId: string,
  suffix?: string
) => `${kind}:${providerMessageId}${suffix ? `:${suffix}` : ""}`

const recordWebhookReceipt = async ({
  id,
  kind,
  providerMessageId,
  fingerprint,
  payloadSummary,
}: {
  id: string
  kind: WhatsappWebhookReceiptDocument["kind"]
  providerMessageId?: string
  fingerprint: string
  payloadSummary?: Record<string, unknown>
}) => {
  try {
    await getWebhookReceiptCollection().insertOne({
      _id: id,
      kind,
      providerMessageId,
      fingerprint,
      payloadSummary,
      createdAt: new Date().toISOString(),
    })
    return true
  } catch (error) {
    if (error instanceof MongoServerError && error.code === 11000) {
      return false
    }

    throw error
  }
}

const getMediaNodeFromMessage = (message: MetaWebhookMessageNode) => {
  const messageType = message.type
  if (!messageType) {
    return null
  }

  const typedMessage = message as Record<string, MetaWebhookMediaNode | undefined>
  return typedMessage[messageType] ?? null
}

const buildInboundTextBody = (message: MetaWebhookMessageNode) => {
  if (message.text?.body?.trim()) {
    return message.text.body.trim()
  }

  if (message.button?.text?.trim()) {
    return message.button.text.trim()
  }

  if (message.interactive?.button_reply?.title?.trim()) {
    return message.interactive.button_reply.title.trim()
  }

  if (message.interactive?.list_reply?.title?.trim()) {
    return message.interactive.list_reply.title.trim()
  }

  return undefined
}

const enqueueMediaDownload = (providerMessageId: string) => {
  if (!providerMessageId.trim()) {
    return
  }

  void runWhatsappMediaWorkerTick()
}

const graphFetch = async (url: string, init?: RequestInit) => {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    const error = new Error(body || "Cloud API media request gagal") as Error & {
      status?: number
    }
    error.status = response.status
    throw error
  }

  return response
}

const resolveMediaDownloadMetadata = async (providerMediaId: string) => {
  if (!env.WHATSAPP_ACCESS_TOKEN?.trim()) {
    throw new ValidationError("WHATSAPP_ACCESS_TOKEN belum dikonfigurasi untuk download media")
  }

  const baseUrl = env.WHATSAPP_GRAPH_API_BASE_URL.replace(/\/$/, "")
  const graphVersion = env.WHATSAPP_GRAPH_API_VERSION
  const response = await graphFetch(`${baseUrl}/${graphVersion}/${providerMediaId}`, {
    method: "GET",
  })

  return (await response.json()) as {
    url?: string
    mime_type?: string
    sha256?: string
    file_size?: number | string
  }
}

const uploadBufferToGridFs = async ({
  providerMessageId,
  providerMediaId,
  buffer,
  contentType,
  filename,
}: {
  providerMessageId: string
  providerMediaId: string
  buffer: Buffer
  contentType?: string
  filename: string
}) =>
  new Promise<string>((resolve, reject) => {
    const upload = getMediaBucket().openUploadStream(filename, {
      contentType,
      metadata: {
        providerMessageId,
        providerMediaId,
      },
    })

    upload.once("error", reject)
    upload.once("finish", () => resolve(String(upload.id)))
    upload.end(buffer)
  })

const processPendingMediaDownload = async (message: WhatsappMessageDocument) => {
  if (!message.providerMediaId) {
    return
  }

  const metadata = await resolveMediaDownloadMetadata(message.providerMediaId)
  if (!metadata.url?.trim()) {
    throw new ValidationError("Cloud API media metadata tidak mengandung URL download")
  }

  const response = await graphFetch(metadata.url, { method: "GET" })
  const buffer = Buffer.from(await response.arrayBuffer())
  const mediaSha256 = crypto.createHash("sha256").update(buffer).digest("hex")
  const contentType =
    metadata.mime_type ??
    message.mediaMimeType ??
    response.headers.get("content-type") ??
    "application/octet-stream"
  const filename =
    message.mediaName?.trim() ||
    `${message._id}.${contentType.split("/")[1] ?? "bin"}`
  const storageId = await uploadBufferToGridFs({
    providerMessageId: message._id,
    providerMediaId: message.providerMediaId,
    buffer,
    contentType,
    filename,
  })
  const downloadedAt = new Date().toISOString()

  await getMessagesCollection().updateOne(
    { _id: message._id },
    {
      $set: {
        mediaStorageId: storageId,
        mediaSha256,
        mediaFileSizeBytes: buffer.length,
        mediaDownloadedAt: downloadedAt,
        mediaDownloadStatus: "downloaded",
        mediaMimeType: contentType,
        mediaName: filename,
        updatedAt: downloadedAt,
      },
      $unset: {
        mediaDownloadError: "",
      },
    }
  )
}

const runWhatsappMediaWorkerTick = async () => {
  if (mediaWorkerActive) {
    return
  }

  mediaWorkerActive = true
  try {
    const pendingMessages = await getMessagesCollection()
      .find({
        providerKind: "cloud_api",
        hasMedia: true,
        mediaDownloadStatus: "pending",
      })
      .sort({ updatedAt: 1, createdAt: 1 })
      .limit(5)
      .toArray()

    for (const message of pendingMessages) {
      if (mediaDownloadsInFlight.has(message._id)) {
        continue
      }

      mediaDownloadsInFlight.add(message._id)
      try {
        await processPendingMediaDownload(message)
      } catch (error) {
        logger.error({
          event: "whatsapp.media.download.failed",
          providerMessageId: message._id,
          providerMediaId: message.providerMediaId,
          error: serializeError(error),
        })
        await getMessagesCollection().updateOne(
          { _id: message._id },
          {
            $set: {
              mediaDownloadStatus: "failed",
              mediaDownloadError:
                error instanceof Error ? error.message : "Download media WhatsApp gagal",
              updatedAt: new Date().toISOString(),
            },
          }
        )
      } finally {
        mediaDownloadsInFlight.delete(message._id)
      }
    }
  } finally {
    mediaWorkerActive = false
  }
}

const handleInboundMessages = async (
  metadata: Record<string, unknown>,
  contacts: MetaWebhookContact[],
  messages: MetaWebhookMessageNode[],
) => {
  const primaryContact = contacts[0]

  for (const message of messages) {
    const providerMessageId = message.id?.trim()
    if (!providerMessageId) {
      continue
    }

    const receiptFingerprint = createPayloadFingerprint(message)
    const accepted = await recordWebhookReceipt({
      id: buildWebhookReceiptId("inbound_message", providerMessageId),
      kind: "inbound_message",
      providerMessageId,
      fingerprint: receiptFingerprint,
      payloadSummary: {
        phoneNumberId:
          typeof metadata.phone_number_id === "string" ? metadata.phone_number_id : undefined,
      },
    })

    if (!accepted) {
      continue
    }

    const messageType = message.type?.trim() || "unknown"
    const mediaNode = getMediaNodeFromMessage(message)
    const providerMediaId = mediaNode?.id?.trim()
    const mediaFileSizeBytes =
      typeof mediaNode?.file_size === "number"
        ? mediaNode.file_size
        : typeof mediaNode?.file_size === "string" && mediaNode.file_size.trim()
          ? Number(mediaNode.file_size)
          : undefined

    await ingestCloudInboundMessage({
      providerMessageId,
      waId: primaryContact?.wa_id ?? message.from,
      phone: primaryContact?.wa_id ?? message.from,
      displayName: primaryContact?.profile?.name,
      messageType,
      body: buildInboundTextBody(message),
      caption: mediaNode?.caption,
      timestampIso: toIsoTimestamp(message.timestamp),
      hasMedia: Boolean(providerMediaId),
      mediaMimeType: mediaNode?.mime_type,
      mediaName: mediaNode?.filename,
      providerMediaId,
      mediaSha256: mediaNode?.sha256,
      mediaFileSizeBytes:
        typeof mediaFileSizeBytes === "number" && Number.isFinite(mediaFileSizeBytes)
          ? mediaFileSizeBytes
          : undefined,
    })

    if (providerMediaId) {
      enqueueMediaDownload(providerMessageId)
    }
  }
}

const normalizeWebhookStatus = (
  input?: string
): "sent" | "delivered" | "read" | "failed" | undefined => {
  if (!input?.trim()) {
    return undefined
  }

  if (["sent", "delivered", "read", "failed"].includes(input)) {
    return input as "sent" | "delivered" | "read" | "failed"
  }

  return undefined
}

const handleStatusUpdates = async (statuses: MetaWebhookStatusNode[]) => {
  for (const status of statuses) {
    const providerMessageId = status.id?.trim()
    const providerStatus = normalizeWebhookStatus(status.status)
    if (!providerMessageId || !providerStatus) {
      continue
    }

    const statusAt = toIsoTimestamp(status.timestamp)
    const receiptFingerprint = createPayloadFingerprint({
      id: providerMessageId,
      status: providerStatus,
      timestamp: status.timestamp,
    })
    const accepted = await recordWebhookReceipt({
      id: buildWebhookReceiptId("status", providerMessageId, `${providerStatus}:${status.timestamp ?? statusAt}`),
      kind: "status",
      providerMessageId,
      fingerprint: receiptFingerprint,
    })

    if (!accepted) {
      continue
    }

    const firstError = status.errors?.[0]
    await ingestCloudStatusUpdate({
      providerMessageId,
      recipientId: status.recipient_id,
      status: providerStatus,
      statusAt,
      pricingType: status.pricing?.type,
      pricingCategory: status.pricing?.category,
      conversationExpirationAt: status.conversation?.expiration_timestamp
        ? toIsoTimestamp(status.conversation.expiration_timestamp)
        : undefined,
      latestErrorCode:
        firstError?.code !== undefined ? String(firstError.code) : undefined,
      latestErrorMessage: firstError?.message ?? firstError?.title,
    })
  }
}

const handleTemplateLifecycleUpdate = async (
  field: string,
  value: Record<string, unknown> | undefined,
) => {
  const payloadFingerprint = createPayloadFingerprint({ field, value })
  const entityId =
    (typeof value?.message_template_id === "string" && value.message_template_id) ||
    (typeof value?.message_template_name === "string" && value.message_template_name) ||
    (typeof value?.template_id === "string" && value.template_id) ||
    (typeof value?.template_name === "string" && value.template_name) ||
    payloadFingerprint

  const accepted = await recordWebhookReceipt({
    id: buildWebhookReceiptId("template_lifecycle", entityId, payloadFingerprint),
    kind: "template_lifecycle",
    providerMessageId: entityId,
    fingerprint: payloadFingerprint,
    payloadSummary: {
      field,
    },
  })

  if (!accepted) {
    return
  }

  await saveAuditLog(
    `whatsapp.${field}`,
    "whatsapp_template",
    entityId,
    {
      field,
      payload: value,
    }
  )
}

export const resolveMetaWhatsappWebhookChallenge = (
  query: Record<string, unknown>
) => {
  const mode =
    typeof query["hub.mode"] === "string"
      ? query["hub.mode"]
      : typeof query.hub_mode === "string"
        ? query.hub_mode
        : undefined
  const verifyToken =
    typeof query["hub.verify_token"] === "string"
      ? query["hub.verify_token"]
      : typeof query.hub_verify_token === "string"
        ? query.hub_verify_token
        : undefined
  const challenge =
    typeof query["hub.challenge"] === "string"
      ? query["hub.challenge"]
      : typeof query.hub_challenge === "string"
        ? query.hub_challenge
        : undefined

  if (
    mode === "subscribe" &&
    verifyToken?.trim() &&
    verifyToken === env.WHATSAPP_WEBHOOK_VERIFY_TOKEN &&
    challenge?.trim()
  ) {
    return challenge
  }

  return null
}

export const verifyMetaWhatsappWebhookSignature = (
  rawBody: Buffer,
  signatureHeader?: string
) => {
  if (!signatureHeader?.startsWith("sha256=") || !env.WHATSAPP_APP_SECRET?.trim()) {
    return false
  }

  const receivedSignature = signatureHeader.slice("sha256=".length).trim()
  const expectedSignature = crypto
    .createHmac("sha256", env.WHATSAPP_APP_SECRET)
    .update(rawBody)
    .digest("hex")

  if (receivedSignature.length !== expectedSignature.length) {
    return false
  }

  return crypto.timingSafeEqual(
    Buffer.from(receivedSignature, "utf8"),
    Buffer.from(expectedSignature, "utf8")
  )
}

export const ingestMetaWhatsappWebhook = async (payload: MetaWebhookPayload) => {
  if (payload.object !== "whatsapp_business_account" || !Array.isArray(payload.entry)) {
    logger.warn({
      event: "whatsapp.webhook.ignored_payload",
      object: payload.object,
    })
    return
  }

  for (const entry of payload.entry) {
    for (const change of entry.changes ?? []) {
      const field = change.field?.trim()
      if (!field) {
        continue
      }

      if (field === "messages") {
        const metadata = (change.value ?? {}) as Record<string, unknown>
        const contacts = Array.isArray(metadata.contacts)
          ? (metadata.contacts as MetaWebhookContact[])
          : []
        const messages = Array.isArray(metadata.messages)
          ? (metadata.messages as MetaWebhookMessageNode[])
          : []
        const statuses = Array.isArray(metadata.statuses)
          ? (metadata.statuses as MetaWebhookStatusNode[])
          : []

        await handleInboundMessages(metadata, contacts, messages)
        await handleStatusUpdates(statuses)
        continue
      }

      if (
        field === "message_template_status_update" ||
        field === "message_template_quality_update" ||
        field === "message_template_components_update"
      ) {
        await handleTemplateLifecycleUpdate(field, change.value)
        continue
      }

      logger.info({
        event: "whatsapp.webhook.unsupported_change_field",
        field,
      })
    }
  }
}

export const openStoredWhatsappMedia = async (
  providerMessageId: string
): Promise<StoredWhatsappMedia> => {
  const message = await getMessagesCollection().findOne({ _id: providerMessageId })
  if (!message?.mediaStorageId) {
    throw new NotFoundError("Media WhatsApp belum tersedia")
  }

  const fileId = new ObjectId(message.mediaStorageId)
  const file = await getMediaBucket().find({ _id: fileId }).next()
  if (!file) {
    throw new NotFoundError("Media WhatsApp tidak ditemukan")
  }

  return {
    stream: getMediaBucket().openDownloadStream(fileId),
    filename: file.filename,
    contentType:
      (typeof file.contentType === "string" && file.contentType) ||
      message.mediaMimeType ||
      "application/octet-stream",
    length: file.length,
  }
}

export const startWhatsappMediaWorker = () => {
  if (mediaWorkerTimer || env.WHATSAPP_PROVIDER !== "cloud_api") {
    return
  }

  mediaWorkerTimer = setInterval(() => {
    void runWhatsappMediaWorkerTick()
  }, 1_000)
  void runWhatsappMediaWorkerTick()
}

export const stopWhatsappMediaWorker = async () => {
  if (mediaWorkerTimer) {
    clearInterval(mediaWorkerTimer)
    mediaWorkerTimer = null
  }

  while (mediaWorkerActive) {
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
}
