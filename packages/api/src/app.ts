import cors from "cors"
import express from "express"
import session from "express-session"
import rateLimit from "express-rate-limit"
import MongoStore from "connect-mongo"
import morgan from "morgan"
import {
  adminLoginInputSchema,
  confirmOrderInputSchema,
  createCustomerInputSchema,
  customerNameVisibilityInputSchema,
  customerLoginInputSchema,
  dashboardWindowSchema,
  manualPointAdjustmentInputSchema,
  settingsResponseSchema,
  updateCustomerInputSchema,
  voidOrderInputSchema,
  whatsappInternalEventSchema,
} from "@cjl/contracts"
import { env } from "./env.js"
import { mongoClient } from "./db.js"
import { normalizePhone } from "./lib/normalization.js"
import { nowJakarta } from "./lib/time.js"
import {
  addManualPoints,
  beginIdempotencyRequest,
  completeIdempotencyRequest,
  confirmOrder,
  createRequestFingerprint,
  createCustomer,
  failIdempotencyRequest,
  findAdminByUsername,
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
  getCustomerOrderDetail,
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

const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.adminUserId) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  next()
}

const requireCustomer = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!req.session.customerUserId || !req.session.customerProfile) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }
  next()
}

const requireInternal = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const authorization = req.header("Authorization")
  if (authorization !== `Bearer ${env.WHATSAPP_GATEWAY_TOKEN}`) {
    res.status(401).json({ message: "Unauthorized" })
    return
  }

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
      throw new Error("Idempotency-Key sudah digunakan untuk payload yang berbeda")
    }

    if (claim.record.status === "completed") {
      return claim.record.response as T
    }

    const completed = await waitForCompletedIdempotencyRequest(scope, key)
    if (completed?.response) {
      return completed.response as T
    }

    throw new Error("Permintaan sedang diproses, silakan ulangi beberapa saat lagi")
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

  app.use(morgan("dev"))
  app.use(express.json({ limit: "1mb" }))
  app.use(
    cors({
      origin: [env.ADMIN_ORIGIN, env.PUBLIC_ORIGIN],
      credentials: true
    })
  )
  app.use(
    session({
      name: "cjl.sid",
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: env.SESSION_COOKIE_SECURE,
        maxAge: 1000 * 60 * 60 * 24 * 7
      },
      ...(sessionStore ? { store: sessionStore } : {})
    })
  )

  const buildLimiter = (
    limit: number,
    message: string,
    keyGenerator?: (req: express.Request, res: express.Response) => string,
    skipSuccessfulRequests = false
  ) =>
    rateLimit({
      windowMs: 10 * 60 * 1000,
      limit,
      keyGenerator,
      skipSuccessfulRequests,
      handler: (_req, res) => {
        res.status(429).json({ message })
      }
    })

  const adminLimiter = buildLimiter(20, "Terlalu banyak percobaan login admin")
  const customerLimiter = buildLimiter(30, "Terlalu banyak percobaan login pelanggan", undefined, true)
  const customerPhoneLimiter = buildLimiter(
    10,
    "Terlalu banyak percobaan login untuk nomor ini",
    (req) => `customer-login:${normalizePhone(typeof req.body?.phone === "string" ? req.body.phone : "") || "unknown"}`,
    true
  )

  app.get("/health", (_req, res) => {
    res.json({ ok: true })
  })

  app.get("/ready", asyncRoute(async (_req, res) => {
    try {
      await mongoClient.db().command({ ping: 1 })
      const [settings, admin] = await Promise.all([
        mongoClient.db().collection<SettingsDocument>("settings").findOne({ _id: "app-settings" }),
        mongoClient.db().collection<AdminDocument>("admins").findOne({ username: env.ADMIN_USERNAME })
      ])

      if (!settings || !admin) {
        res.status(503).json({
          ok: false,
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
        checks: {
          mongo: true,
          settingsSeeded: true,
          adminSeeded: true
        }
      })
    } catch (error) {
      res.status(503).json({
        ok: false,
        appEnv: env.APP_ENV,
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
      res.status(401).json({ message: "Username atau password salah" })
      return
    }
    req.session.adminUserId = admin._id
    req.session.customerUserId = undefined
    req.session.customerProfile = undefined
    res.json({ ok: true })
  }))

  app.post("/v1/admin/auth/logout", requireAdmin, asyncRoute(async (req, res) => {
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

  app.post("/v1/admin/customers", requireAdmin, asyncRoute(async (req, res) => {
    const body = createCustomerInputSchema.parse(req.body)
    res.json(await withIdempotency(req, "create-customer", body, () => createCustomer(body)))
  }))

  app.get("/v1/admin/customers/:id", requireAdmin, asyncRoute(async (req, res) => {
    res.json(await getCustomerDetail(getParam(req.params.id)))
  }))

  app.patch("/v1/admin/customers/:id", requireAdmin, asyncRoute(async (req, res) => {
    const body = updateCustomerInputSchema.parse(req.body)
    res.json(await updateCustomerIdentity(getParam(req.params.id), body))
  }))

  app.post("/v1/admin/customers/:id/points", requireAdmin, asyncRoute(async (req, res) => {
    const body = manualPointAdjustmentInputSchema.parse(req.body)
    res.json(await addManualPoints(getParam(req.params.id), body.points, body.reason))
  }))

  app.post("/v1/admin/orders/preview", requireAdmin, asyncRoute(async (req, res) => {
    const body = confirmOrderInputSchema.parse(req.body)
    res.json(await getOrderPreview(body))
  }))

  app.post("/v1/admin/orders", requireAdmin, asyncRoute(async (req, res) => {
    const body = confirmOrderInputSchema.parse(req.body)
    res.json(await withIdempotency(req, "confirm-order", body, () => confirmOrder(body)))
  }))

  app.get("/v1/admin/orders/active", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await listActiveOrders())
  }))

  app.get("/v1/admin/orders/:id", requireAdmin, asyncRoute(async (req, res) => {
    res.json(await getOrderById(getParam(req.params.id)))
  }))

  app.post("/v1/admin/orders/:id/done", requireAdmin, asyncRoute(async (req, res) => {
    const orderId = getParam(req.params.id)
    res.json(await withIdempotency(req, "mark-done", { orderId }, () => markOrderDone(orderId)))
  }))

  app.post("/v1/admin/orders/:id/void", requireAdmin, asyncRoute(async (req, res) => {
    const body = voidOrderInputSchema.parse(req.body)
    const orderId = getParam(req.params.id)
    res.json(await withIdempotency(req, "void-order", { orderId, ...body }, () => voidOrder(orderId, body)))
  }))

  app.get("/v1/admin/notifications", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await listNotifications())
  }))

  app.post("/v1/admin/notifications/:id/resend", requireAdmin, asyncRoute(async (req, res) => {
    res.json(await resendNotification(getParam(req.params.id)))
  }))

  app.post("/v1/admin/notifications/:id/manual-resolve", requireAdmin, asyncRoute(async (req, res) => {
    const note = typeof req.body?.note === "string" ? req.body.note : ""
    res.json(await markNotificationManualResolved(getParam(req.params.id), note))
  }))

  app.post("/v1/admin/notifications/:id/manual-whatsapp", requireAdmin, asyncRoute(async (req, res) => {
    res.json(await openManualWhatsappFallback(getParam(req.params.id)))
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

  app.put("/v1/admin/settings", requireAdmin, asyncRoute(async (req, res) => {
    const body = settingsResponseSchema.parse(req.body)
    res.json(await updateSettings(body))
  }))

  app.get("/v1/admin/whatsapp/status", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await getWhatsappStatus())
  }))

  app.post("/v1/admin/whatsapp/pairing-code", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await requestWhatsappPairingCode())
  }))

  app.post("/v1/admin/whatsapp/reconnect", requireAdmin, asyncRoute(async (_req, res) => {
    res.json(await reconnectWhatsapp())
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
      res.status(401).json({ message: "Nomor HP atau nama tidak sesuai" })
      return
    }
    req.session.customerUserId = customer.customerId
    req.session.customerProfile = customer
    req.session.adminUserId = undefined
    res.json({ ok: true })
  }))

  app.post("/v1/public/auth/logout", requireCustomer, asyncRoute(async (req, res) => {
    req.session.destroy(() => res.json({ ok: true }))
  }))

  app.get("/v1/public/auth/session", (req, res) => {
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

  app.patch("/v1/public/me/preferences/name-visibility", requireCustomer, asyncRoute(async (req, res) => {
    const body = customerNameVisibilityInputSchema.parse(req.body)
    const session = await updateCustomerNameVisibility(req.session.customerUserId!, body)
    req.session.customerProfile = session
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
      res.status(404).json({ message: "Status order tidak ditemukan" })
      return
    }
    res.json(payload)
  }))

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ message: error.message })
  })

  return app
}
