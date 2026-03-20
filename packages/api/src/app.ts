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
  customerLoginInputSchema,
  dashboardWindowSchema,
  manualPointAdjustmentInputSchema,
  settingsResponseSchema,
  updateCustomerInputSchema,
  voidOrderInputSchema
} from "@cjl/contracts"
import { env } from "./env.js"
import { mongoClient } from "./db.js"
import { nowJakarta } from "./lib/time.js"
import {
  addManualPoints,
  confirmOrder,
  createCustomer,
  findAdminByUsername,
  getAdminDashboard,
  getCustomerDetail,
  getIdempotentResponse,
  getNotificationPreparedMessage,
  getOrderById,
  getOrderPreview,
  getSettings,
  listActiveOrders,
  listCustomers,
  listNotifications,
  markNotificationManualResolved,
  markOrderDone,
  resendNotification,
  saveIdempotentResponse,
  updateCustomerIdentity,
  updateSettings,
  verifyAdminPassword,
  voidOrder,
  downloadNotificationReceipt
} from "./services/admin.js"
import {
  getAvailableLeaderboardMonths,
  getDirectOrderStatus,
  getLandingData,
  getLeaderboardByMonth,
  getPublicDashboard,
  listCustomerOrders,
  listCustomerPointLedger,
  listCustomerRedemptions,
  loginCustomer,
  getCustomerOrderDetail
} from "./services/public.js"
import type { AdminDocument, SettingsDocument } from "./types.js"

declare module "express-session" {
  interface SessionData {
    adminUserId?: string
    customerUserId?: string
    customerProfile?: {
      customerId: string
      name: string
      phone: string
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

const getParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value ?? ""

const withIdempotency = async <T>(
  req: express.Request,
  scope: string,
  work: () => Promise<T>
) => {
  const key = req.header("Idempotency-Key")
  if (!key) {
    return work()
  }

  const existing = await getIdempotentResponse(scope, key)
  if (existing) {
    return existing.response as T
  }

  const response = await work()
  await saveIdempotentResponse(scope, key, response)
  return response
}

export const createApp = () => {
  const app = express()
  app.set("trust proxy", env.TRUST_PROXY)

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
      store: MongoStore.create({
        client: mongoClient,
        collectionName: "sessions"
      })
    })
  )

  const adminLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 20 })
  const customerLimiter = rateLimit({ windowMs: 10 * 60 * 1000, limit: 30 })

  app.get("/health", (_req, res) => {
    res.json({ ok: true })
  })

  app.get("/ready", async (_req, res) => {
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
  })

  app.post("/v1/admin/auth/login", adminLimiter, async (req, res) => {
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
  })

  app.post("/v1/admin/auth/logout", requireAdmin, async (req, res) => {
    req.session.destroy(() => res.json({ ok: true }))
  })

  app.get("/v1/admin/auth/session", (req, res) => {
    res.json({ authenticated: Boolean(req.session.adminUserId) })
  })

  app.get("/v1/admin/dashboard", requireAdmin, async (req, res) => {
    const window = dashboardWindowSchema.parse(req.query.window ?? "daily")
    res.json(await getAdminDashboard(window))
  })

  app.get("/v1/admin/customers", requireAdmin, async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined
    res.json(await listCustomers(search))
  })

  app.post("/v1/admin/customers", requireAdmin, async (req, res) => {
    const body = createCustomerInputSchema.parse(req.body)
    res.json(await withIdempotency(req, "create-customer", () => createCustomer(body)))
  })

  app.get("/v1/admin/customers/:id", requireAdmin, async (req, res) => {
    res.json(await getCustomerDetail(getParam(req.params.id)))
  })

  app.patch("/v1/admin/customers/:id", requireAdmin, async (req, res) => {
    const body = updateCustomerInputSchema.parse(req.body)
    res.json(await updateCustomerIdentity(getParam(req.params.id), body))
  })

  app.post("/v1/admin/customers/:id/points", requireAdmin, async (req, res) => {
    const body = manualPointAdjustmentInputSchema.parse(req.body)
    res.json(await addManualPoints(getParam(req.params.id), body.points, body.reason))
  })

  app.post("/v1/admin/orders/preview", requireAdmin, async (req, res) => {
    const body = confirmOrderInputSchema.parse(req.body)
    res.json(await getOrderPreview(body))
  })

  app.post("/v1/admin/orders", requireAdmin, async (req, res) => {
    const body = confirmOrderInputSchema.parse(req.body)
    res.json(await withIdempotency(req, "confirm-order", () => confirmOrder(body)))
  })

  app.get("/v1/admin/orders/active", requireAdmin, async (_req, res) => {
    res.json(await listActiveOrders())
  })

  app.get("/v1/admin/orders/:id", requireAdmin, async (req, res) => {
    res.json(await getOrderById(getParam(req.params.id)))
  })

  app.post("/v1/admin/orders/:id/done", requireAdmin, async (req, res) => {
    res.json(await withIdempotency(req, "mark-done", () => markOrderDone(getParam(req.params.id))))
  })

  app.post("/v1/admin/orders/:id/void", requireAdmin, async (req, res) => {
    const body = voidOrderInputSchema.parse(req.body)
    res.json(await withIdempotency(req, "void-order", () => voidOrder(getParam(req.params.id), body)))
  })

  app.get("/v1/admin/notifications", requireAdmin, async (_req, res) => {
    res.json(await listNotifications())
  })

  app.post("/v1/admin/notifications/:id/resend", requireAdmin, async (req, res) => {
    res.json(await resendNotification(getParam(req.params.id)))
  })

  app.post("/v1/admin/notifications/:id/manual-resolve", requireAdmin, async (req, res) => {
    const note = typeof req.body?.note === "string" ? req.body.note : ""
    res.json(await markNotificationManualResolved(getParam(req.params.id), note))
  })

  app.get("/v1/admin/notifications/:id/receipt", requireAdmin, async (req, res) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8")
    res.send(await downloadNotificationReceipt(getParam(req.params.id)))
  })

  app.get("/v1/admin/notifications/:id/message", requireAdmin, async (req, res) => {
    res.json({ message: await getNotificationPreparedMessage(getParam(req.params.id)) })
  })

  app.get("/v1/admin/settings", requireAdmin, async (_req, res) => {
    res.json(await getSettings())
  })

  app.put("/v1/admin/settings", requireAdmin, async (req, res) => {
    const body = settingsResponseSchema.parse(req.body)
    res.json(await updateSettings(body))
  })

  app.get("/v1/public/landing", async (_req, res) => {
    res.json(await getLandingData())
  })

  app.post("/v1/public/auth/login", customerLimiter, async (req, res) => {
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
  })

  app.post("/v1/public/auth/logout", requireCustomer, async (req, res) => {
    req.session.destroy(() => res.json({ ok: true }))
  })

  app.get("/v1/public/auth/session", (req, res) => {
    res.json({
      authenticated: Boolean(req.session.customerUserId),
      session: req.session.customerProfile ?? null
    })
  })

  app.get("/v1/public/me/dashboard", requireCustomer, async (req, res) => {
    res.json(await getPublicDashboard(req.session.customerUserId!))
  })

  app.get("/v1/public/me/orders", requireCustomer, async (req, res) => {
    res.json(await listCustomerOrders(req.session.customerUserId!))
  })

  app.get("/v1/public/me/orders/:id", requireCustomer, async (req, res) => {
    res.json(await getCustomerOrderDetail(req.session.customerUserId!, getParam(req.params.id)))
  })

  app.get("/v1/public/me/points", requireCustomer, async (req, res) => {
    res.json(await listCustomerPointLedger(req.session.customerUserId!))
  })

  app.get("/v1/public/me/redemptions", requireCustomer, async (req, res) => {
    res.json(await listCustomerRedemptions(req.session.customerUserId!))
  })

  app.get("/v1/public/me/monthly-summary", requireCustomer, async (req, res) => {
    const dashboard = await getPublicDashboard(req.session.customerUserId!)
    res.json(dashboard.monthlySummary)
  })

  app.get("/v1/public/leaderboard", async (req, res) => {
    const month = typeof req.query.month === "string" ? req.query.month : nowJakarta().toFormat("yyyy-MM")
    res.json({
      rows: await getLeaderboardByMonth(month),
      availableMonths: await getAvailableLeaderboardMonths()
    })
  })

  app.get("/v1/public/status/:token", async (req, res) => {
    const payload = await getDirectOrderStatus(getParam(req.params.token))
    if (!payload) {
      res.status(404).json({ message: "Status order tidak ditemukan" })
      return
    }
    res.json(payload)
  })

  app.use((error: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(400).json({ message: error.message })
  })

  return app
}
