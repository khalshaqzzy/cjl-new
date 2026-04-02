import type { NotificationDocument } from "../types.js"
import { env } from "../env.js"
import { ValidationError } from "../errors.js"
import { approvedWhatsappTemplates } from "../lib/whatsapp-template-registry.js"
import { normalizeWhatsappPhone } from "../lib/normalization.js"
import { maskPhone } from "../lib/security.js"
import { logger, serializeError } from "../logger.js"

export type CloudMediaAttachment = {
  mimeType: string
  filename: string
  base64Data: string
}

export type CloudSendResult = {
  providerKind: "cloud_api" | "simulated"
  providerMessageId: string
  providerStatus: "accepted"
  providerStatusAt: string
  sentAt: string
  waId: string
}

type CloudSendResponse = {
  contacts?: Array<{
    input?: string
    wa_id?: string
  }>
  messages?: Array<{
    id: string
  }>
}

type CloudUploadResponse = {
  id?: string
}

type CloudApiErrorPayload = {
  error?: {
    message?: string
    code?: number
    error_subcode?: number
    error_data?: {
      details?: string
    }
  }
}

const buildGraphUrl = (path: string) =>
  `${env.WHATSAPP_GRAPH_API_BASE_URL.replace(/\/$/, "")}/${env.WHATSAPP_GRAPH_API_VERSION}/${path.replace(/^\//, "")}`

const assertCloudConfigured = () => {
  for (const [field, value] of [
    ["WHATSAPP_PHONE_NUMBER_ID", env.WHATSAPP_PHONE_NUMBER_ID],
    ["WHATSAPP_ACCESS_TOKEN", env.WHATSAPP_ACCESS_TOKEN],
  ] as const) {
    if (!value?.trim()) {
      throw new ValidationError(`${field} belum dikonfigurasi untuk Cloud API`)
    }
  }
}

const graphFetch = async <T>(path: string, init: RequestInit) => {
  const response = await fetch(buildGraphUrl(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
      ...(init.headers ?? {}),
    },
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as CloudApiErrorPayload | null
    const message =
      payload?.error?.error_data?.details ||
      payload?.error?.message ||
      "Cloud API request gagal"
    const error = new Error(message) as Error & {
      code?: string
      status?: number
    }
    error.status = response.status
    error.code =
      payload?.error?.code !== undefined ? String(payload.error.code) : undefined
    throw error
  }

  return (await response.json()) as T
}

const sendCloudMessage = async ({
  to,
  payload,
}: {
  to: string
  payload: Record<string, unknown>
}): Promise<CloudSendResult> => {
  const statusAt = new Date().toISOString()
  const response = await graphFetch<CloudSendResponse>(
    `${env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        ...payload,
      }),
    }
  )

  const providerMessageId = response.messages?.[0]?.id
  if (!providerMessageId) {
    throw new ValidationError("Cloud API tidak mengembalikan message ID")
  }

  return {
    providerKind: "cloud_api",
    providerMessageId,
    providerStatus: "accepted",
    providerStatusAt: statusAt,
    sentAt: statusAt,
    waId: response.contacts?.[0]?.wa_id ?? to,
  }
}

const uploadMedia = async (attachment: CloudMediaAttachment) => {
  assertCloudConfigured()

  const formData = new FormData()
  formData.set("messaging_product", "whatsapp")
  formData.set(
    "file",
    new Blob([Buffer.from(attachment.base64Data, "base64")], {
      type: attachment.mimeType,
    }),
    attachment.filename
  )

  const upload = await graphFetch<CloudUploadResponse>(
    `${env.WHATSAPP_PHONE_NUMBER_ID}/media`,
    {
      method: "POST",
      body: formData,
    }
  )

  if (!upload.id) {
    throw new ValidationError("Cloud API tidak mengembalikan media ID")
  }

  return upload.id
}

export const sendCloudNotification = async (
  notification: NotificationDocument,
  media?: CloudMediaAttachment
): Promise<CloudSendResult> => {
  assertCloudConfigured()

  if (!notification.templateParams) {
    throw new ValidationError("Notification template params tidak tersedia")
  }

  const template = approvedWhatsappTemplates[notification.eventType]
  const recipient = normalizeWhatsappPhone(notification.destinationPhone)

  const components: Array<Record<string, unknown>> = []
  if (template.requiresDocumentHeader) {
    if (!media) {
      throw new ValidationError("Attachment PDF wajib untuk template order_confirmed")
    }

    const mediaId = await uploadMedia(media)
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            id: mediaId,
            filename: media.filename,
          },
        },
      ],
    })
  }

  components.push({
    type: "body",
    parameters: Object.entries(notification.templateParams).map(([parameterName, text]) => ({
      type: "text",
      parameter_name: parameterName,
      text,
    })),
  })

  logger.info({
    event: "whatsapp.cloud.send.attempted",
    notificationId: notification._id,
    eventType: notification.eventType,
    destinationPhone: maskPhone(notification.destinationPhone),
    templateName: template.templateName,
    templateCategory: template.category,
  })

  try {
    return await sendCloudMessage({
      to: recipient,
      payload: {
        type: "template",
        template: {
          name: template.templateName,
          language: {
            code: template.language,
          },
          components,
        },
      },
    })
  } catch (error) {
    logger.error({
      event: "whatsapp.cloud.send.failed",
      notificationId: notification._id,
      eventType: notification.eventType,
      destinationPhone: maskPhone(notification.destinationPhone),
      error: serializeError(error),
    })
    throw error
  }
}

export const sendCloudTextMessage = async ({
  to,
  body,
}: {
  to: string
  body: string
}): Promise<CloudSendResult> => {
  assertCloudConfigured()

  const recipient = normalizeWhatsappPhone(to)
  logger.info({
    event: "whatsapp.cloud.manual_send.attempted",
    destinationPhone: maskPhone(to),
  })

  try {
    return await sendCloudMessage({
      to: recipient,
      payload: {
        type: "text",
        text: {
          body,
        },
      },
    })
  } catch (error) {
    logger.error({
      event: "whatsapp.cloud.manual_send.failed",
      destinationPhone: maskPhone(to),
      error: serializeError(error),
    })
    throw error
  }
}
