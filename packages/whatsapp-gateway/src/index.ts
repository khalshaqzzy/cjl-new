import express from "express"
import crypto from "node:crypto"
import QRCode from "qrcode"
import type { WhatsappInternalEvent } from "@cjl/contracts"
import { LocalAuth, MessageMedia, Client } from "whatsapp-web.js"
import { env } from "./env.js"
import { logger, serializeError } from "./logger.js"

type GatewayState = {
  state:
    | "disabled"
    | "initializing"
    | "pairing"
    | "authenticated"
    | "connected"
    | "disconnected"
    | "auth_failure"
  connected: boolean
  currentPhone?: string
  wid?: string
  profileName?: string
  qrCodeValue?: string
  qrCodeDataUrl?: string
  pairingCode?: string
  observedAt?: string
  lastDisconnectReason?: string
  lastAuthFailureReason?: string
}

type SendRequest = {
  notificationId: string
  eventType: string
  toPhone: string
  message: string
  orderCode?: string
  media?: {
    mimeType: string
    filename: string
    base64Data: string
  }
}

const app = express()
app.use((req, res, next) => {
  const requestId = req.header("X-Request-Id")?.slice(0, 128) || crypto.randomUUID()
  const startedAt = process.hrtime.bigint()
  res.setHeader("X-Request-Id", requestId)
  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
    logger.info({
      event: "gateway.http.request.completed",
      requestId,
      method: req.method,
      route: req.route?.path ?? req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
    })
  })
  next()
})
app.use(express.json({ limit: "12mb" }))

const gatewayState: GatewayState = {
  state: "initializing",
  connected: false,
}

let client: Client | null = null
let clientInitPromise: Promise<Client> | null = null

const nowIso = () => new Date().toISOString()

const toDigits = (value: string) => value.replace(/\D/g, "")

const toWhatsappNumber = (value: string) => {
  const digits = toDigits(value)
  if (!digits) {
    return ""
  }

  if (digits.startsWith("62")) {
    return digits
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`
  }

  return `62${digits}`
}

const toChatPhone = (chatId: string) => {
  if (!chatId.includes("@")) {
    return undefined
  }

  const [user] = chatId.split("@")
  if (!/^\d+$/.test(user)) {
    return undefined
  }

  return `+${user}`
}

const buildStatus = () => ({
  state: gatewayState.state,
  connected: gatewayState.connected,
  currentPhone: gatewayState.currentPhone,
  wid: gatewayState.wid,
  profileName: gatewayState.profileName,
  qrCodeValue: gatewayState.qrCodeValue,
  qrCodeDataUrl: gatewayState.qrCodeDataUrl,
  pairingCode: gatewayState.pairingCode,
  observedAt: gatewayState.observedAt,
  lastDisconnectReason: gatewayState.lastDisconnectReason,
  lastAuthFailureReason: gatewayState.lastAuthFailureReason,
})

const postInternalEvent = async (event: WhatsappInternalEvent) => {
  await fetch(`${env.WHATSAPP_API_BASE_URL}/v1/internal/whatsapp/events`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.WHATSAPP_GATEWAY_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(event),
  })
}

const updateSessionState = async (
  nextState: Partial<GatewayState> & Pick<GatewayState, "state" | "connected">
) => {
  Object.assign(gatewayState, nextState, { observedAt: nowIso() })
  logger.info({
    event: "whatsapp.session.state_changed",
    state: gatewayState.state,
    connected: gatewayState.connected,
    currentPhone: gatewayState.currentPhone,
  })

  await postInternalEvent({
    type: "session_state_changed",
    state: gatewayState.state,
    connected: gatewayState.connected,
    wid: gatewayState.wid,
    currentPhone: gatewayState.currentPhone,
    profileName: gatewayState.profileName,
    lastDisconnectReason: gatewayState.lastDisconnectReason,
    lastAuthFailureReason: gatewayState.lastAuthFailureReason,
    observedAt: gatewayState.observedAt!,
  })
}

const extractMessageId = (message: {
  id?: { _serialized?: string; id?: string }
}) => message.id?._serialized ?? message.id?.id ?? `message-${Date.now()}`

const extractMessageTimestamp = (message: { timestamp?: number }) => {
  if (typeof message.timestamp === "number" && Number.isFinite(message.timestamp)) {
    return new Date(message.timestamp * 1000).toISOString()
  }

  return nowIso()
}

const extractMessageText = (message: {
  body?: string
  caption?: string
}) => ({
  body: typeof message.body === "string" && message.body.trim() ? message.body : undefined,
  caption: typeof message.caption === "string" && message.caption.trim() ? message.caption : undefined,
})

const mirrorMessage = async (
  message: {
    fromMe?: boolean
    from?: string
    to?: string
    type?: string
    ack?: number
    hasMedia?: boolean
    body?: string
    caption?: string
    timestamp?: number
    id?: { _serialized?: string; id?: string }
    _data?: { notifyName?: string; filename?: string; mimetype?: string }
  },
  extra?: { notificationId?: string; orderCode?: string; mediaMimeType?: string; mediaName?: string }
) => {
  const chatId = message.fromMe ? message.to : message.from
  if (!chatId) {
    return
  }

  const { body, caption } = extractMessageText(message)
  await postInternalEvent({
    type: "message_upserted",
    providerMessageId: extractMessageId(message),
    chatId,
    direction: message.fromMe ? "outbound" : "inbound",
    messageType: message.type ?? "chat",
    body,
    caption,
    timestampIso: extractMessageTimestamp(message),
    phone: toChatPhone(chatId),
    displayName: message._data?.notifyName,
    providerAck: typeof message.ack === "number" ? message.ack : undefined,
    hasMedia: Boolean(message.hasMedia),
    mediaMimeType: extra?.mediaMimeType ?? message._data?.mimetype,
    mediaName: extra?.mediaName ?? message._data?.filename,
    notificationId: extra?.notificationId,
    orderCode: extra?.orderCode,
  })
}

const attachClientListeners = (instance: Client) => {
  instance.on("qr", async (qr) => {
    const qrCodeDataUrl = await QRCode.toDataURL(qr)
    await updateSessionState({
      state: "pairing",
      connected: false,
      qrCodeValue: qr,
      qrCodeDataUrl,
      pairingCode: undefined,
      lastDisconnectReason: undefined,
      lastAuthFailureReason: undefined,
    })
  })

  instance.on("code", async (code) => {
    await updateSessionState({
      state: "pairing",
      connected: false,
      pairingCode: code,
    })
  })

  instance.on("authenticated", async () => {
    await updateSessionState({
      state: "authenticated",
      connected: false,
      qrCodeValue: undefined,
      qrCodeDataUrl: undefined,
      pairingCode: undefined,
    })
  })

  instance.on("ready", async () => {
    const rawWid =
      typeof instance.info?.wid === "object" && instance.info?.wid && "_serialized" in instance.info.wid
        ? String(instance.info.wid._serialized)
        : typeof instance.info?.wid === "string"
          ? instance.info.wid
          : undefined
    const wid = rawWid ?? instance.info?.me?._serialized

    await updateSessionState({
      state: "connected",
      connected: true,
      currentPhone: wid ? toChatPhone(wid) : gatewayState.currentPhone,
      wid,
      profileName: instance.info?.pushname,
      qrCodeValue: undefined,
      qrCodeDataUrl: undefined,
      pairingCode: undefined,
      lastDisconnectReason: undefined,
      lastAuthFailureReason: undefined,
    })
  })

  instance.on("auth_failure", async (message) => {
    await updateSessionState({
      state: "auth_failure",
      connected: false,
      lastAuthFailureReason: typeof message === "string" ? message : "Authentication failed",
    })
  })

  instance.on("disconnected", async (reason) => {
    await updateSessionState({
      state: "disconnected",
      connected: false,
      lastDisconnectReason: typeof reason === "string" ? reason : "Disconnected",
    })
  })

  instance.on("change_state", async (state) => {
    if (state === "CONNECTED") {
      return
    }

    await updateSessionState({
      state: gatewayState.connected ? "connected" : "disconnected",
      connected: gatewayState.connected,
    })
  })

  instance.on("message", async (message) => {
    await mirrorMessage(message)
  })

  instance.on("message_create", async (message) => {
    if (!message.fromMe) {
      return
    }

    await mirrorMessage(message)
  })

  instance.on("message_ack", async (message, ack) => {
    await postInternalEvent({
      type: "message_ack_changed",
      providerMessageId: extractMessageId(message),
      providerAck: ack,
      observedAt: nowIso(),
    })
  })
}

const initializeClient = async () => {
  if (client) {
    return client
  }

  if (clientInitPromise) {
    return clientInitPromise
  }

  clientInitPromise = (async () => {
    const instance = new Client({
      authStrategy: new LocalAuth({
        clientId: env.WHATSAPP_SESSION_CLIENT_ID,
        dataPath: env.WHATSAPP_AUTH_DIR,
      }),
      authTimeoutMs: 60_000,
      takeoverOnConflict: true,
      takeoverTimeoutMs: 0,
      deviceName: env.WHATSAPP_DEVICE_NAME,
      browserName: env.WHATSAPP_BROWSER_NAME,
      puppeteer: {
        headless: true,
        executablePath: env.WHATSAPP_PUPPETEER_EXECUTABLE_PATH,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
          "--no-first-run",
          "--no-zygote",
        ],
      },
    })

    attachClientListeners(instance)
    await updateSessionState({
      state: "initializing",
      connected: false,
    })
    await instance.initialize()
    client = instance
    clientInitPromise = null
    return instance
  })().catch((error) => {
    client = null
    clientInitPromise = null
    throw error
  })

  return clientInitPromise
}

const restartClient = async () => {
  const previousClient = client
  client = null
  clientInitPromise = null

  if (previousClient) {
    await previousClient.destroy().catch(() => undefined)
  }

  logger.info({
    event: "whatsapp.client.restart",
  })
  return initializeClient()
}

const requireGatewayAuth = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => {
  if (req.header("Authorization") !== `Bearer ${env.WHATSAPP_GATEWAY_TOKEN}`) {
    res.status(401).json({ message: "Unauthorized", code: "unauthorized" })
    return
  }

  next()
}

app.get("/health", (_req, res) => {
  res.json({ ok: true })
})

app.get("/internal/status", requireGatewayAuth, (_req, res) => {
  res.json(buildStatus())
})

app.post("/internal/pairing-code", requireGatewayAuth, async (req, res) => {
  try {
    const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber : ""
    if (!phoneNumber.trim()) {
      res.status(400).json({ message: "Nomor pairing wajib diisi", code: "invalid_phone" })
      return
    }

    const instance = await initializeClient()
    const pairingCode = await instance.requestPairingCode(toWhatsappNumber(phoneNumber), true)
    gatewayState.pairingCode = pairingCode
    gatewayState.state = "pairing"
    gatewayState.connected = false
    gatewayState.observedAt = nowIso()
    logger.info({
      event: "whatsapp.pairing_code.generated",
      phoneNumber: toWhatsappNumber(phoneNumber),
    })
    res.json(buildStatus())
  } catch (error) {
    logger.error({
      event: "whatsapp.pairing_code.failed",
      error: serializeError(error),
    })
    res.status(400).json({
      message: error instanceof Error ? error.message : "Gagal membuat pairing code",
      code: "pairing_failed",
    })
  }
})

app.post("/internal/reconnect", requireGatewayAuth, async (_req, res) => {
  try {
    await restartClient()
    logger.info({
      event: "whatsapp.reconnect.succeeded",
    })
    res.json(buildStatus())
  } catch (error) {
    logger.error({
      event: "whatsapp.reconnect.failed",
      error: serializeError(error),
    })
    res.status(400).json({
      message: error instanceof Error ? error.message : "Gagal reconnect WhatsApp",
      code: "reconnect_failed",
    })
  }
})

app.post("/internal/send", requireGatewayAuth, async (req, res) => {
  try {
    const body = req.body as SendRequest
    const instance = await initializeClient()
    logger.info({
      event: "whatsapp.send.attempted",
      notificationId: body.notificationId,
      eventType: body.eventType,
      toPhone: toWhatsappNumber(body.toPhone),
      hasMedia: Boolean(body.media),
    })

    if (!gatewayState.connected) {
      res.status(503).json({
        message: "WhatsApp belum siap mengirim pesan",
        code: "session_not_ready",
      })
      return
    }

    const numberId = await instance.getNumberId(toWhatsappNumber(body.toPhone))
    if (!numberId?._serialized) {
      res.status(400).json({
        message: "Nomor tujuan belum terdaftar di WhatsApp",
        code: "unregistered_number",
      })
      return
    }

    const chatId = numberId._serialized
    const sentMessage = body.media
      ? await instance.sendMessage(
          chatId,
          new MessageMedia(body.media.mimeType, body.media.base64Data, body.media.filename),
          { caption: body.message }
        )
      : await instance.sendMessage(chatId, body.message)

    await mirrorMessage(sentMessage, {
      notificationId: body.notificationId,
      orderCode: body.orderCode,
      mediaMimeType: body.media?.mimeType,
      mediaName: body.media?.filename,
    })

    logger.info({
      event: "whatsapp.send.succeeded",
      notificationId: body.notificationId,
      providerMessageId: extractMessageId(sentMessage),
      providerChatId: chatId,
    })
    res.json({
      providerMessageId: extractMessageId(sentMessage),
      providerChatId: chatId,
      providerAck: typeof sentMessage.ack === "number" ? sentMessage.ack : undefined,
      sentAt: extractMessageTimestamp(sentMessage),
    })
  } catch (error) {
    logger.error({
      event: "whatsapp.send.failed",
      error: serializeError(error),
    })
    res.status(400).json({
      message: error instanceof Error ? error.message : "Gagal mengirim WhatsApp",
      code: "send_failed",
    })
  }
})

let server: ReturnType<typeof app.listen> | null = null
let shutdownPromise: Promise<void> | null = null

const start = async () => {
  await initializeClient()
  server = app.listen(env.PORT, () => {
    logger.info({
      event: "gateway.server.started",
      port: env.PORT,
      releaseSha: env.RELEASE_SHA,
    })
  })

  const shutdown = (signal: string) => {
    if (shutdownPromise) {
      return shutdownPromise
    }

    logger.info({
      event: "gateway.server.stopping",
      signal,
    })

    shutdownPromise = (async () => {
      if (server) {
        await new Promise<void>((resolve, reject) => {
          server?.close((error) => {
            if (error) {
              reject(error)
              return
            }

            resolve()
          })
        })
      }

      if (client) {
        await client.destroy().catch(() => undefined)
      }
    })()
      .then(() => {
        logger.info({
          event: "gateway.server.stopped",
          signal,
        })
      })
      .catch((error) => {
        logger.error({
          event: "gateway.server.stop_failed",
          signal,
          error: serializeError(error),
        })
        process.exitCode = 1
      })
      .finally(() => {
        process.exit()
      })

    return shutdownPromise
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT")
  })
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM")
  })
}

void start().catch((error) => {
  logger.error({
    event: "gateway.bootstrap.failed",
    error: serializeError(error),
  })
  process.exit(1)
})
