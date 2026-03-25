import cors from "cors"
import crypto from "node:crypto"
import express from "express"
import session from "express-session"
import rateLimit from "express-rate-limit"
import MongoStore from "connect-mongo"
import helmet from "helmet"
import { MongoServerError } from "mongodb"
import { ZodError } from "zod"
import {
  adminLoginInputSchema,
  confirmOrderInputSchema,
  createCustomerInputSchema,
  customerNameVisibilityInputSchema,
  customerMagicLinkRedeemInputSchema,
  customerLoginInputSchema,
  dashboardWindowSchema,
  manualPointAdjustmentInputSchema,
  settingsResponseSchema,
  updateCustomerInputSchema,
  voidOrderInputSchema,
  whatsappInternalEventSchema,
} from "@cjl/contracts"
import {
  AppError,
  AuthorizationError,
  ConflictError,
  RateLimitError,
  toValidationAppError,
} from "./errors.js"
import { env } from "./env.js"
import { mongoClient } from "./db.js"
import { normalizePhone } from "./lib/normalization.js"
import { fingerprintUserAgent, hashIpAddress, maskPhone } from "./lib/security.js"
import { nowJakarta } from "./lib/time.js"
import { logger, serializeError } from "./logger.js"
import { MongoRateLimitStore } from "./mongo-rate-limit-store.js"
import { updateRequestContext, withRequestContext } from "./request-context.js"
import {
  addManualPoints,
  beginIdempotencyRequest,
  completeIdempotencyRequest,
  confirmOrder,
  createRequestFingerprint,
  createCustomer,
  failIdempotencyRequest,
  findAdminByUsername,
  generateCustomerMagicLink,
  getAdminDashboard,
  getCustomerDetail,
  getNotificationPreparedMessage,
  getOrderById,
  getOrderPreview,
  getSettings,
  listActiveOrders,
  listCustomers,
  listNotifications,
  markNotificationManualResolved,
  markOrderDone,
  openManualWhatsappFallback,
  resendNotification,
  updateCustomerIdentity,
  updateSettings,
  verifyAdminPassword,
  waitForCompletedIdempotencyRequest,
  voidOrder,
  downloadNotificationReceipt
} from "./services/admin.js"
import {
  getAvailableLeaderboardMonths,
  getDirectOrderStatus,
  getLandingData,
  getLeaderboardByMonth,
  getPublicDashboard,
  getCustomerOrderReceipt,
  listCustomerOrders,
  listCustomerPointLedger,
  listCustomerRedemptions,
  loginCustomer,
  redeemCustomerMagicLink,
  getCustomerOrderDetail,
  markCustomerMagicLinkUsed,
  updateCustomerNameVisibility
} from "./services/public.js"
import {
  getWhatsappStatus,
  ingestWhatsappInternalEvent,
  listWhatsappChats,
  listWhatsappMessages,
  reconnectWhatsapp,
  requestWhatsappPairingCode,
} from "./services/whatsapp.js"
import type { AdminDocument, SettingsDocument } from "./types.js"

const processStartedAt = new Date().toISOString()
const allowedOrigins = new Set([env.ADMIN_ORIGIN, env.PUBLIC_ORIGIN])

declare module "express-session" {
  interface SessionData {
    adminUserId?: string
    customerUserId?: string
    customerProfile?: {
      customerId: string
      name: string
      phone: string
      publicNameVisible: boolean
    }
  }
}

const ADMIN_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7
const CUSTOMER_SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30

const applyAdminSessionLifetime = (req: express.Request) => {
  req.session.cookie.maxAge = ADMIN_SESSION_MAX_AGE_MS
}

const applyCustomerSessionLifetime = (req: express.Request) => {
  req.session.cookie.maxAge = CUSTOMER_SESSION_MAX_AGE_MS
}

const getRequestId = (res: express.Response) => String(res.getHeader("X-Request-Id") ?? "")

const sendErrorResponse = (
  res: express.Response,
  statusCode: number,
  message: string,
  code: string,
  details?: unknown
) => {
  const requestId = getRequestId(res)
  res.status(statusCode).json({
    message,
    error: {
      code,
      requestId,
      ...(details ? { details } : {}),
    },
  })
}

const resolveRequestOrigin = (req: express.Request) => {
  const origin = req.header("Origin")
  if (origin) {
    return origin
  }

  const referer = req.header("Referer")
  if (!referer) {
    return undefined
  }

  try {
    return new URL(referer).origin
  } catch {
    return undefined
  }
}

const requireTrustedOrigin = (surface: "admin" | "public") =>
  (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const origin = resolveRequestOrigin(req)
    if (!origin && (env.APP_ENV === "local" || env.APP_ENV === "test")) {
      next()
      return
    }

    const allowedOrigin = surface === "admin" ? env.ADMIN_ORIGIN : env.PUBLIC_ORIGIN
    if (origin !== allowedOrigin) {
      next(new AuthorizationError("Origin tidak diizinkan", "origin_not_allowed"))
      return
    }

    next()
  }

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.adminUserId) {
    sendErrorResponse(res, 401, "Unauthorized", "authentication_required")
    return
  }
  updateRequestContext({
    actorType: "admin",
    actorId: req.session.adminUserId,
    actorSource: "session",
  })
  next()
}

const requireCustomer = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.customerUserId || !req.session.customerProfile) {
    sendErrorResponse(res, 401, "Unauthorized", "authentication_required")
    return
  }
  applyCustomerSessionLifetime(req)
  req.session.touch()
  updateRequestContext({
    actorType: "customer",
    actorId: req.session.customerUserId,
    actorSource: "session",
  })
  next()
}

const requireInternal = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authorization = req.header("Authorization")
  if (authorization !== `Bearer ${env.WHATSAPP_GATEWAY_TOKEN}`) {
    sendErrorResponse(res, 401, "Unauthorized", "authentication_required")
    return
  }

  updateRequestContext({
    actorType: "system",
    actorId: "whatsapp-gateway",
    actorSource: "system",
  })
  next()
}

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? ""

const asyncRoute = (
  handler: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<void>
) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  void Promise.resolve(handler(req, res, next)).catch(next)
}

const withIdempotency = async <T>(
  req: express.Request,
  scope: string,
  payload: unknown,
  work: () => Promise<T>
) => {
  const key = req.header("Idempotency-Key")
  if (!key) {
    return work()
  }

  const fingerprint = createRequestFingerprint(payload)
  const claim = await beginIdempotencyRequest(scope, key, fingerprint)

  if (claim.kind === "existing") {
    if (claim.record.fingerprint !== fingerprint) {
      throw new ConflictError("Idempotency-Key sudah digunakan untuk payload yang berbeda")
    }

    if (claim.record.status === "completed") {
      return claim.record.response as T
    }

    const completed = await waitForCompletedIdempotencyRequest(scope, key)
    if (completed?.response) {
      return completed.response as T
    }

    throw new ConflictError("Permintaan sedang diproses, silakan ulangi beberapa saat lagi")
  }

  try {
    const response = await work()
    await completeIdempotencyRequest(scope, key, response)
    return response
  } catch (error) {
    await failIdempotencyRequest(scope, key)
    throw error
  }
}

export const createApp = () => {
  const app = express()
  app.set("trust proxy", env.TRUST_PROXY)
  app.locals.startedAt = processStartedAt
  app.locals.releaseSha = env.RELEASE_SHA
  const sessionStore =
    env.APP_ENV === "test"
      ? null
      : MongoStore.create({
          client: mongoClient,
          collectionName: "sessions"
        })

  if (sessionStore) {
    app.locals.sessionStore = sessionStore
  }

  app.use((req, res, next) => {
    const requestId = req.header("X-Request-Id")?.slice(0, 128) || crypto.randomUUID()
    const context = {
      requestId,
      actorType: "anonymous" as const,
      actorId: "anonymous",
      actorSource: "http" as const,
      origin: resolveRequestOrigin(req),
      userAgent: fingerprintUserAgent(req.header("User-Agent")),
      ipHash: hashIpAddress(req.ip),
      method: req.method,
      path: req.originalUrl,
    }
    const startedAt = process.hrtime.bigint()
    res.setHeader("X-Request-Id", requestId)

    res.on("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000
      const actorType = req.session?.adminUserId
        ? "admin"
        : req.session?.customerUserId
          ? "customer"
          : context.actorType
      const actorId = req.session?.adminUserId ?? req.session?.customerUserId ?? context.actorId
      logger.info({
        event: "http.request.completed",
        requestId,
        method: req.method,
        route: req.route?.path ?? req.originalUrl,
        statusCode: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        actorType,
        actorId,
        origin: context.origin,
        ipHash: context.ipHash,
        userAgent: context.userAgent,
      })
    })

    withRequestContext(context, next)
  })
  app.use(express.json({ limit: "1mb" }))
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: env.APP_ENV === "production"
      ? {
          maxAge: 31536000,
          includeSubDomains: true,
          preload: true,
        }
      : env.APP_ENV === "staging"
        ? {
            maxAge: 86400,
            includeSubDomains: true,
          }
        : false,
  }))
  app.use((_req, res, next) => {
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
    next()
  })
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true)
          return
        }

        callback(new AuthorizationError("Origin tidak diizinkan", "origin_not_allowed"))
      },
      credentials: true
    })
  )
  app.use(
    session({
      name: "cjl.sid",
      secret: env.SESSION_SECRET,
      resave: false,
      rolling: true,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.SESSION_COOKIE_SECURE,
        maxAge: ADMIN_SESSION_MAX_AGE_MS
      },
      ...(sessionStore ? { store: sessionStore } : {})
    })
  )

  const buildLimiter = (
    keyPrefix: string,
    limit: number,
    message: string,
    keyGenerator?: (req: express.Request, res: express.Response) => string,
    skipSuccessfulRequests = false
  ) =>
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit,
      store: new MongoRateLimitStore(),
      keyGenerator: (req, res) => `${keyPrefix}:${keyGenerator ? keyGenerator(req, res) : req.ip}`,
      skipSuccessfulRequests,
      handler: (_req, res) => {
        const error = new RateLimitError(message)
        sendErrorResponse(res, error.statusCode, error.message, error.code)
      }
    })

  const adminLimiter = buildLimiter("admin-login", 20, "Terlalu banyak percobaan login admin")
  const customerLimiter = buildLimiter("customer-login-ip", 30, "Terlalu banyak percobaan login pelanggan", undefined, true)
  const customerPhoneLimiter = buildLimiter(
    "customer-login-phone",
    10,
    "Terlalu banyak percobaan login untuk nomor ini",
    (req) => `customer-login:${normalizePhone(typeof req.body?.phone === "string" ? req.body.phone : "") || "unknown"}`,
    true
  )
  const customerMagicLinkLimiter = buildLimiter(
    "customer-magic-link",
    10,
    "Terlalu banyak percobaan redeem link login"
  )
  const whatsappAdminLimiter = buildLimiter(
    "admin-whatsapp",
    10,
    "Terlalu banyak percobaan pada kontrol WhatsApp admin"
  )

  app.get("/health", (_req, res) => {
    res.json({ ok: true, releaseSha: env.RELEASE_SHA })
  })

  app.get("/ready", asyncRoute(async (_req, res) => {
    try {
      await mongoClient.db().command({ ping: 1 })
      const [settings, admin] = await Promise.all([
        mongoClient.db().collection<SettingsDocument>("settings").findOne({ _id: "app-settings" }),
        mongoClient.db().collection<AdminDocument>("admins").findOne({ _id: "admin-primary" })
      ])

      if (!settings || !admin) {
        res.status(503).json({
          ok: false,
          release: {
            sha: env.RELEASE_SHA,
            startedAt: processStartedAt,
          },
          checks: {
            mongo: true,
            settingsSeeded: Boolean(settings),
            adminSeeded: Boolean(admin)
          }
        })
        return
      }

      res.json({
        ok: true,
        appEnv: env.APP_ENV,
        release: {
          sha: env.RELEASE_SHA,
          startedAt: processStartedAt,
        },
        checks: {
          mongo: true,
          settingsSeeded: true,
          adminSeeded: true
        }
      })
    } catch (_error) {
      res.status(503).json({
        ok: false,
        appEnv: env.APP_ENV,
        release: {
          sha: env.RELEASE_SHA,
          startedAt: processStartedAt,
        },
        checks: {
          mongo: false,
          settingsSeeded: false,
          adminSeeded: false
        }
      })
    }
  }))

  app.post("/v1/admin/auth/login", adminLimiter, asyncRoute(async (req, res) => {
    const body = adminLoginInputSchema.parse(req.body)
    const admin = await findAdminByUsername(body.username)
    if (!admin || !(await verifyAdminPassword(admin, body.password))) {
      logger.warn({
        event: "admin.auth.login.failed",
        username: body.username,
      })
      sendErrorResponse(res, 401, "Username atau password salah", "authentication_failed")
      return
    }
    req.session.adminUserId = admin._id
    req.session.customerUserId = undefined
    req.session.customerProfile = undefined
    applyAdminSessionLifetime(req)
    updateRequestContext({
      actorType: "admin",
      actorId: admin._id,
      actorSource: "session",
    })
    logger.info({
      event: "admin.auth.login.succeeded",
      actorId: admin._id,
    })
    res.json({ ok: true })
  }))

  app.post("/v1/admin/auth/logout", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    req.session.destroy(() => res.json({ ok: true }))
  }))

  app.get("/v1/admin/auth/session", (req, res) => {
    res.json({ authenticated: Boolean(req.session.adminUserId) })
  })

  app.get("/v1/admin/dashboard", requireAdmin, asyncRoute(async (req, res) => {
    const window = dashboardWindowSchema.parse(req.query.window ?? "daily")
    res.json(await getAdminDashboard(window))
  }))

  app.get("/v1/admin/customers", requireAdmin, asyncRoute(async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    res.json(await listCustomers(search))
  }))

  app.post("/v1/admin/customers", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const body = createCustomerInputSchema.parse(req.body)
    const result = await withIdempotency(req, "create-customer", body, () => createCustomer(body))
    logger.info({
      event: result.duplicate ? "customer.create.duplicate" : "customer.create.succeeded",
      customerId: result.customer.customerId,
      destinationPhone: maskPhone(result.customer.phone),
    })
    res.json(result)
  }))

  app.post("/v1/admin/customers/:id/magic-link", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const customerId = getParam(req.params.id)
    const result = await generateCustomerMagicLink(customerId)
    logger.info({
      event: "customer.magic_link.created",
      customerId,
    })
    res.json(result)
  }))

  app.get("/v1/admin/customers/:id", requireAdmin, asyncRoute(async (req, res) => {
    res.json(await getCustomerDetail(getParam(req.params.id)))
  }))

  app.patch("/v1/admin/customers/:id", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const body = updateCustomerInputSchema.parse(req.body)
    const customerId = getParam(req.params.id)
    const result = await updateCustomerIdentity(customerId, body)
    logger.info({
      event: "customer.updated",
      customerId,
      destinationPhone: maskPhone(body.phone),
    })
    res.json(result)
  }))

  app.post("/v1/admin/customers/:id/points", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const body = manualPointAdjustmentInputSchema.parse(req.body)
    const customerId = getParam(req.params.id)
    const result = await addManualPoints(customerId, body.points, body.reason)
    logger.info({
      event: "customer.points.adjusted",
      customerId,
      points: body.points,
    })
    res.json(result)
  }))

  app.post("/v1/admin/orders/preview", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const body = confirmOrderInputSchema.parse(req.body)
    res.json(await getOrderPreview(body))
  }))

  app.post("/v1/admin/orders", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const body = confirmOrderInputSchema.parse(req.body)
    const result = await withIdempotency(req, "confirm-order", body, () => confirmOrder(body))
    logger.info({
      event: "order.confirmed",
      orderId: result.order.orderId,
      orderCode: result.order.orderCode,
      customerId: body.customerId,
    })
    res.json(result)
  }))

  app.get("/v1/admin/orders/active", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await listActiveOrders())
  }))

  app.get("/v1/admin/orders/:id", requireAdmin, asyncRoute(async (req, res) => {
    res.json(await getOrderById(getParam(req.params.id)))
  }))

  app.post("/v1/admin/orders/:id/done", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const orderId = getParam(req.params.id)
    const result = await withIdempotency(req, "mark-done", { orderId }, () => markOrderDone(orderId))
    logger.info({
      event: "order.done",
      orderId,
      orderCode: result.orderCode,
    })
    res.json(result)
  }))

  app.post("/v1/admin/orders/:id/void", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const body = voidOrderInputSchema.parse(req.body)
    const orderId = getParam(req.params.id)
    const result = await withIdempotency(req, "void-order", { orderId, ...body }, () => voidOrder(orderId, body))
    logger.info({
      event: "order.voided",
      orderId,
      reason: body.reason,
    })
    res.json(result)
  }))

  app.get("/v1/admin/notifications", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await listNotifications())
  }))

  app.post("/v1/admin/notifications/:id/resend", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const notificationId = getParam(req.params.id)
    const result = await resendNotification(notificationId)
    logger.info({
      event: "notification.retry.queued",
      notificationId,
    })
    res.json(result)
  }))

  app.post("/v1/admin/notifications/:id/manual-resolve", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const note = typeof req.body?.note === "string" ? req.body.note : ""
    const notificationId = getParam(req.params.id)
    const result = await markNotificationManualResolved(notificationId, note)
    logger.info({
      event: "notification.manual_resolved",
      notificationId,
    })
    res.json(result)
  }))

  app.post("/v1/admin/notifications/:id/manual-whatsapp", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const notificationId = getParam(req.params.id)
    const result = await openManualWhatsappFallback(notificationId)
    logger.info({
      event: "notification.manual_whatsapp_opened",
      notificationId,
    })
    res.json(result)
  }))

  app.get("/v1/admin/notifications/:id/receipt", requireAdmin, asyncRoute(async (req, res) => {
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${getParam(req.params.id)}.pdf"`)
    res.send(await downloadNotificationReceipt(getParam(req.params.id)))
  }))

  app.get("/v1/admin/notifications/:id/message", requireAdmin, asyncRoute(async (req, res) => {
    res.json({ message: await getNotificationPreparedMessage(getParam(req.params.id)) })
  }))

  app.get("/v1/admin/settings", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await getSettings())
  }))

  app.put("/v1/admin/settings", requireAdmin, requireTrustedOrigin("admin"), asyncRoute(async (req, res) => {
    const body = settingsResponseSchema.parse(req.body)
    const result = await updateSettings(body)
    logger.info({
      event: "settings.updated",
    })
    res.json(result)
  }))

  app.get("/v1/admin/whatsapp/status", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await getWhatsappStatus())
  }))

  app.post("/v1/admin/whatsapp/pairing-code", requireAdmin, requireTrustedOrigin("admin"), whatsappAdminLimiter, asyncRoute(async (_req, res) => {
    const result = await requestWhatsappPairingCode()
    logger.info({
      event: "whatsapp.pairing_code.requested",
      state: result.state,
    })
    res.json(result)
  }))

  app.post("/v1/admin/whatsapp/reconnect", requireAdmin, requireTrustedOrigin("admin"), whatsappAdminLimiter, asyncRoute(async (_req, res) => {
    const result = await reconnectWhatsapp()
    logger.info({
      event: "whatsapp.reconnect.requested",
      state: result.state,
    })
    res.json(result)
  }))

  app.get("/v1/admin/whatsapp/chats", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await listWhatsappChats())
  }))

  app.get("/v1/admin/whatsapp/chats/:chatId/messages", requireAdmin, asyncRoute(async (req, res) => {
    res.json(await listWhatsappMessages(getParam(req.params.chatId)))
  }))

  app.post("/v1/internal/whatsapp/events", requireInternal, asyncRoute(async (req, res) => {
    const body = whatsappInternalEventSchema.parse(req.body)
    await ingestWhatsappInternalEvent(body)
    res.json({ ok: true })
  }))

  app.get("/v1/public/landing", asyncRoute(async (_req, res) => {
    res.json(await getLandingData())
  }))

  app.post("/v1/public/auth/login", customerLimiter, customerPhoneLimiter, asyncRoute(async (req, res) => {
    const body = customerLoginInputSchema.parse(req.body)
    const customer = await loginCustomer(body.phone, body.name)
    if (!customer) {
      logger.warn({
        event: "customer.auth.login.failed",
        destinationPhone: maskPhone(body.phone),
      })
      sendErrorResponse(res, 401, "Nomor HP atau nama tidak sesuai", "authentication_failed")
      return
    }
    req.session.customerUserId = customer.customerId
    req.session.customerProfile = customer
    req.session.adminUserId = undefined
    applyCustomerSessionLifetime(req)
    updateRequestContext({
      actorType: "customer",
      actorId: customer.customerId,
      actorSource: "session",
    })
    logger.info({
      event: "customer.auth.login.succeeded",
      customerId: customer.customerId,
      destinationPhone: maskPhone(customer.phone),
    })
    res.json({ ok: true })
  }))

  app.post("/v1/public/auth/magic-link/redeem", customerMagicLinkLimiter, asyncRoute(async (req, res) => {
    const body = customerMagicLinkRedeemInputSchema.parse(req.body)
    const redeemed = await redeemCustomerMagicLink(body)
    if (!redeemed) {
      sendErrorResponse(res, 401, "Link login sudah tidak valid", "authentication_failed")
      return
    }

    req.session.customerUserId = redeemed.session.customerId
    req.session.customerProfile = redeemed.session
    req.session.adminUserId = undefined
    applyCustomerSessionLifetime(req)

    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          reject(error)
          return
        }

        resolve()
      })
    })

    await markCustomerMagicLinkUsed(redeemed.magicLinkId)
    updateRequestContext({
      actorType: "customer",
      actorId: redeemed.session.customerId,
      actorSource: "session",
    })
    logger.info({
      event: "customer.magic_link.redeemed",
      customerId: redeemed.session.customerId,
    })
    res.json({ ok: true, session: redeemed.session })
  }))

  app.post("/v1/public/auth/logout", requireCustomer, requireTrustedOrigin("public"), asyncRoute(async (req, res) => {
    req.session.destroy(() => res.json({ ok: true }))
  }))

  app.get("/v1/public/auth/session", (req, res) => {
    if (req.session.customerUserId && req.session.customerProfile) {
      applyCustomerSessionLifetime(req)
      req.session.touch()
    }
    res.json({
      authenticated: Boolean(req.session.customerUserId),
      session: req.session.customerProfile ?? null
    })
  })

  app.get("/v1/public/me/dashboard", requireCustomer, asyncRoute(async (req, res) => {
    res.json(await getPublicDashboard(req.session.customerUserId!))
  }))

  app.get("/v1/public/me/orders", requireCustomer, asyncRoute(async (req, res) => {
    res.json(await listCustomerOrders(req.session.customerUserId!))
  }))

  app.get("/v1/public/me/orders/:id", requireCustomer, asyncRoute(async (req, res) => {
    res.json(await getCustomerOrderDetail(req.session.customerUserId!, getParam(req.params.id)))
  }))

  app.get("/v1/public/me/orders/:id/receipt", requireCustomer, asyncRoute(async (req, res) => {
    const orderId = getParam(req.params.id)
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `attachment; filename="receipt-${orderId}.pdf"`)
    res.send(await getCustomerOrderReceipt(req.session.customerUserId!, orderId))
  }))

  app.get("/v1/public/me/points", requireCustomer, asyncRoute(async (req, res) => {
    res.json(await listCustomerPointLedger(req.session.customerUserId!))
  }))

  app.get("/v1/public/me/redemptions", requireCustomer, asyncRoute(async (req, res) => {
    res.json(await listCustomerRedemptions(req.session.customerUserId!))
  }))

  app.get("/v1/public/me/monthly-summary", requireCustomer, asyncRoute(async (req, res) => {
    const dashboard = await getPublicDashboard(req.session.customerUserId!)
    res.json(dashboard.monthlySummary)
  }))

  app.patch("/v1/public/me/preferences/name-visibility", requireCustomer, requireTrustedOrigin("public"), asyncRoute(async (req, res) => {
    const body = customerNameVisibilityInputSchema.parse(req.body)
    const session = await updateCustomerNameVisibility(req.session.customerUserId!, body)
    req.session.customerProfile = session
    logger.info({
      event: "customer.name_visibility.updated",
      customerId: session.customerId,
      publicNameVisible: session.publicNameVisible,
    })
    res.json({ session })
  }))

  app.get("/v1/public/leaderboard", asyncRoute(async (req, res) => {
    const month = typeof req.query.month === "string" ? req.query.month : nowJakarta().toFormat("yyyy-MM")
    res.json({
      rows: await getLeaderboardByMonth(month),
      availableMonths: await getAvailableLeaderboardMonths()
    })
  }))

  app.get("/v1/public/status/:token", asyncRoute(async (req, res) => {
    const payload = await getDirectOrderStatus(getParam(req.params.token))
    if (!payload) {
      sendErrorResponse(res, 404, "Status order tidak ditemukan", "resource_not_found")
      return
    }
    res.json(payload)
  }))

  app.use((error: unknown, _req: express.Request, res: express.Response, __next: express.NextFunction) => {
    const requestId = getRequestId(res)

    if (error instanceof ZodError) {
      const validationError = toValidationAppError(error)
      logger.warn({
        event: "http.request.failed",
        requestId,
        code: validationError.code,
        error: serializeError(validationError),
      })
      sendErrorResponse(
        res,
        validationError.statusCode,
        validationError.message,
        validationError.code,
        validationError.details
      )
      return
    }

    if (error instanceof MongoServerError && error.code === 11000) {
      const conflictError = new ConflictError("Data konflik dengan record yang sudah ada")
      logger.warn({
        event: "http.request.failed",
        requestId,
        code: conflictError.code,
        error: serializeError(error),
      })
      sendErrorResponse(res, conflictError.statusCode, conflictError.message, conflictError.code)
      return
    }

    if (error instanceof AppError) {
      logger[error.statusCode >= 500 ? "error" : "warn"]({
        event: "http.request.failed",
        requestId,
        code: error.code,
        error: serializeError(error),
      })
      sendErrorResponse(
        res,
        error.statusCode,
        error.message,
        error.code,
        error.exposeDetails ? error.details : undefined
      )
      return
    }

    logger.error({
      event: "http.request.failed",
      requestId,
      code: "internal_error",
      error: serializeError(error),
    })
    sendErrorResponse(res, 500, "Terjadi kesalahan internal", "internal_error")
  })

  return app
}
