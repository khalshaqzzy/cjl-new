import bcrypt from "bcryptjs"
import crypto from "node:crypto"
import { DateTime } from "luxon"
import type {
  AdminLaundryListResponse,
  AdminLaundryScope,
  AdminLaundrySort,
  AdminDashboardResponse,
  ConfirmOrderInput,
  CreateCustomerInput,
  CreateCustomerResponse,
  CustomerProfile,
  CustomerMagicLinkResponse,
  DashboardWindow,
  NotificationRecord,
  OrderPreviewResponse,
  SettingsResponse,
  UpdateCustomerInput,
  VoidOrderInput
} from "@cjl/contracts"
import { getDatabase, withMongoTransaction } from "../db.js"
import { ConflictError, NotFoundError, ValidationError } from "../errors.js"
import { env } from "../env.js"
import { sanitizeAdminWhatsappContacts } from "../lib/admin-whatsapp.js"
import { calculateOrderPreview } from "../lib/calculator.js"
import { formatCurrency } from "../lib/formatters.js"
import { createId, createOpaqueToken, createOrderCode } from "../lib/ids.js"
import { buildMaskedAlias, rebuildArchivedLeaderboard } from "../lib/leaderboard.js"
import { normalizeName, normalizePhone, normalizePhoneLabel } from "../lib/normalization.js"
import { hashOpaqueToken, tokenLast4 } from "../lib/security.js"
import { formatDateTime, formatRelativeLabel, formatWeightLabel, monthKeyFromIso, nowJakarta, toIso } from "../lib/time.js"
import { serializeError } from "../logger.js"
import type {
  AdminDocument,
  CustomerDocument,
  DirectOrderTokenDocument,
  IdempotencyKeyDocument,
  NotificationDocument,
  OrderDocument,
  PointLedgerDocument,
  SettingsDocument
} from "../types.js"
import {
  buildOrderReceipt,
  buildOrderServiceSummary,
  buildCustomerSearchFilter,
  createCustomerMagicLink,
  getPrimaryAdminWhatsappContact,
  buildPreparedMessage,
  getSettingsDocument,
  insertPointLedger,
  mapAdminLaundryOrder,
  mapCustomerProfile,
  mapCustomerSearch,
  mapNotification,
  mapOrderHistory,
  mapPointLedger,
  markNotificationIgnored as markNotificationIgnoredRecord,
  markNotificationForRetry,
  markNotificationManualResolved as markNotificationManualResolvedRecord,
  processNotification,
  queueNotification,
  saveAuditLog
} from "./common.js"
import { sendNotificationFallbackToWhatsapp } from "./whatsapp.js"

const db = () => getDatabase()

const windowBounds = (window: DashboardWindow) => {
  const reference = nowJakarta()
  const start =
    window === "daily"
      ? reference.startOf("day")
      : window === "weekly"
        ? reference.startOf("week")
        : reference.startOf("month")
  const end =
    window === "daily"
      ? reference.endOf("day")
      : window === "weekly"
        ? reference.endOf("week")
        : reference.endOf("month")

  return { start, end }
}

const isWithinWindow = (iso: string | undefined, window: DashboardWindow) => {
  if (!iso) {
    return false
  }

  const { start, end } = windowBounds(window)
  const value = DateTime.fromISO(iso).setZone(env.APP_TIMEZONE)
  return value >= start && value <= end
}

const phoneDigits = (phone: string) => normalizePhone(phone).replace(/\D/g, "")

const sha256 = (payload: string) =>
  crypto.createHash("sha256").update(payload).digest("hex")

const buildOrderSearchFilter = (query?: string) => {
  if (!query?.trim()) {
    return {}
  }

  const normalizedQuery = query.trim()
  const digits = normalizedQuery.replace(/\D/g, "")
  const clauses: Record<string, unknown>[] = [
    { customerName: { $regex: normalizedQuery, $options: "i" } },
    { orderCode: { $regex: normalizedQuery, $options: "i" } },
  ]

  if (digits) {
    clauses.push({ customerPhone: { $regex: digits } })
  } else {
    clauses.push({ customerPhone: { $regex: normalizedQuery, $options: "i" } })
  }

  return { $or: clauses }
}

const resolveLaundryStatusFilter = (
  status: "all" | "active" | "done" | "cancelled",
  includeCancelled: boolean
) => {
  if (status === "active") {
    return { status: "Active" as const }
  }

  if (status === "done") {
    return { status: "Done" as const }
  }

  if (status === "cancelled") {
    return { status: "Voided" as const }
  }

  return includeCancelled
    ? { status: { $in: ["Active", "Done", "Voided"] } }
    : { status: { $in: ["Active", "Done"] } }
}

const encodeLaundryCursor = (activityAt: string, orderId: string) =>
  Buffer.from(JSON.stringify({ activityAt, orderId }), "utf8").toString("base64url")

const decodeLaundryCursor = (cursor?: string) => {
  if (!cursor) {
    return null
  }

  try {
    const decoded = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      activityAt?: string
      orderId?: string
    }

    if (!decoded.activityAt || !decoded.orderId) {
      return null
    }

    return decoded as { activityAt: string; orderId: string }
  } catch {
    return null
  }
}

const createUniqueOrderCode = async (
  orderId: string,
  date: Date,
  session: Parameters<typeof withMongoTransaction>[0] extends (session: infer T) => Promise<unknown> ? T : never
) => {
  for (let retry = 0; retry < 32; retry += 1) {
    const seed = retry === 0 ? orderId : `${orderId}:${retry}`
    const orderCode = createOrderCode(seed, date)
    const duplicate = await db().collection<OrderDocument>("orders").findOne({ orderCode }, { session })

    if (!duplicate) {
      return orderCode
    }
  }

  throw new ConflictError("Gagal membuat kode order unik")
}

const buildOrderReceiptSnapshot = async (
  orderCode: string,
  customerName: string,
  serviceSummary: string,
  total: number,
  createdAt: string,
  session: Parameters<typeof withMongoTransaction>[0] extends (session: infer T) => Promise<unknown> ? T : never
) => {
  const settings = await getSettingsDocument(session)
  return {
    orderCode,
    customerName,
    serviceSummary,
    totalLabel: formatCurrency(total),
    createdAtLabel: formatDateTime(createdAt),
    laundryName: settings.business.laundryName,
    laundryPhone: getPrimaryAdminWhatsappContact(settings).phone
  }
}

const buildDashboardMetrics = (
  summary: AdminDashboardResponse["summary"]
): AdminDashboardResponse["metrics"] => [
  {
    id: "net-sales",
    label: "Penjualan Bersih",
    value: formatCurrency(summary.netSales),
    deltaLabel: summary.discountTotal > 0 ? `${formatCurrency(summary.discountTotal)} diskon` : undefined,
    tone: "positive"
  },
  {
    id: "gross-sales",
    label: "Penjualan Kotor",
    value: formatCurrency(summary.grossSales),
    tone: "neutral"
  },
  {
    id: "active-orders",
    label: "Order Aktif",
    value: String(summary.activeOrders),
    tone: "neutral"
  },
  {
    id: "completed-orders",
    label: "Order Selesai",
    value: String(summary.completedOrders),
    tone: "positive"
  },
  {
    id: "new-customers",
    label: "Customer Baru",
    value: String(summary.newCustomers),
    tone: "positive"
  },
  {
    id: "points-earned",
    label: "Poin Diberikan",
    value: String(summary.pointsEarned),
    deltaLabel: summary.pointsRedeemed > 0 ? `${summary.pointsRedeemed} redeem` : undefined,
    tone: "positive"
  }
]

export const findAdminByUsername = async (username: string) =>
  db().collection<AdminDocument>("admins").findOne({ username })

export const verifyAdminPassword = async (admin: AdminDocument, password: string) =>
  bcrypt.compare(password, admin.passwordHash)

export const getAdminDashboard = async (window: DashboardWindow): Promise<AdminDashboardResponse> => {
  const [orders, notifications, customers, pointLedger] = await Promise.all([
    db().collection<OrderDocument>("orders").find({}).toArray(),
    db().collection<NotificationDocument>("notifications").find({}).sort({ createdAt: -1 }).toArray(),
    db().collection<CustomerDocument>("customers").find({}).toArray(),
    db().collection<PointLedgerDocument>("point_ledgers").find({}).toArray()
  ])

  const confirmedOrders = orders.filter((order) => order.status !== "Voided" && isWithinWindow(order.createdAt, window))
  const completedOrders = orders.filter((order) => order.status === "Done" && isWithinWindow(order.completedAt, window))
  const activeOrders = orders.filter((order) => order.status === "Active")
  const newCustomers = customers.filter((customer) => isWithinWindow(customer.createdAt, window)).length
  const manualPointEntries = pointLedger.filter((entry) => entry.tone === "adjustment" && isWithinWindow(entry.createdAt, window))
  const customerPointBalanceMap = new Map(customers.map((customer) => [customer._id, customer.currentPoints]))

  const topServiceUsageMap = new Map<
    AdminDashboardResponse["summary"]["topServiceUsage"][number]["serviceCode"],
    AdminDashboardResponse["summary"]["topServiceUsage"][number]
  >()
  for (const order of confirmedOrders) {
    for (const item of order.items) {
      const current = topServiceUsageMap.get(item.serviceCode) ?? {
        serviceCode: item.serviceCode as AdminDashboardResponse["summary"]["topServiceUsage"][number]["serviceCode"],
        label: item.serviceLabel,
        usageCount: 0
      }
      current.usageCount += item.quantity
      topServiceUsageMap.set(item.serviceCode, current)
    }
  }

  const topCustomerMap = new Map<
    string,
    AdminDashboardResponse["topCustomers"][number]
  >()

  for (const order of confirmedOrders) {
    const current = topCustomerMap.get(order.customerId) ?? {
      customerId: order.customerId,
      maskedName: buildMaskedAlias(order.customerName),
      confirmedOrders: 0,
      earnedStamps: 0,
      currentPoints: customerPointBalanceMap.get(order.customerId)
    }

    current.confirmedOrders += 1
    current.earnedStamps += order.earnedStamps
    topCustomerMap.set(order.customerId, current)
  }

  const summary: AdminDashboardResponse["summary"] = {
    grossSales: confirmedOrders.reduce((sum, order) => sum + order.subtotal, 0),
    netSales: confirmedOrders.reduce((sum, order) => sum + order.total, 0),
    discountTotal: confirmedOrders.reduce((sum, order) => sum + order.discount, 0),
    confirmedOrders: confirmedOrders.length,
    activeOrders: activeOrders.length,
    completedOrders: completedOrders.length,
    totalWeightKg: Number(confirmedOrders.reduce((sum, order) => sum + order.weightKg, 0).toFixed(2)),
    averageOrderValue: confirmedOrders.length > 0
      ? Math.round(confirmedOrders.reduce((sum, order) => sum + order.total, 0) / confirmedOrders.length)
      : 0,
    newCustomers,
    pointsEarned: confirmedOrders.reduce((sum, order) => sum + order.earnedStamps, 0),
    pointsRedeemed: confirmedOrders.reduce((sum, order) => sum + order.redeemedPoints, 0),
    manualPointsAdded: manualPointEntries.reduce((sum, entry) => sum + Math.max(entry.delta, 0), 0),
    topServiceUsage: [...topServiceUsageMap.values()]
      .sort((left, right) => right.usageCount - left.usageCount || left.label.localeCompare(right.label))
      .slice(0, 5)
  }

  return {
    metrics: buildDashboardMetrics(summary),
    summary,
    topCustomers: [...topCustomerMap.values()]
      .sort((left, right) =>
        right.confirmedOrders - left.confirmedOrders ||
        right.earnedStamps - left.earnedStamps ||
        left.maskedName.localeCompare(right.maskedName)
      )
      .slice(0, 5),
    activeOrders: activeOrders
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 8)
      .map((order) => ({
        orderId: order._id,
        orderCode: order.orderCode,
        customerName: order.customerName,
        phone: order.customerPhone,
        createdAtLabel: formatRelativeLabel(order.createdAt),
        createdAtIso: order.createdAt,
        weightKgLabel: formatWeightLabel(order.weightKg),
        serviceSummary: buildOrderServiceSummary(order.items),
        earnedStamps: order.earnedStamps,
        redeemedPoints: order.redeemedPoints,
        status: "Active"
      })),
    notifications: notifications.map(mapNotification)
  }
}

export const listCustomers = async (query?: string) => {
  const customers = await db()
    .collection<CustomerDocument>("customers")
    .find(buildCustomerSearchFilter(query))
    .sort({ createdAt: -1 })
    .toArray()

  const customerIds = customers.map((customer) => customer._id)
  const orders = customerIds.length > 0
    ? await db()
        .collection<OrderDocument>("orders")
        .find({ customerId: { $in: customerIds } })
        .sort({ createdAt: -1 })
        .toArray()
    : []

  const activeCountByCustomer = new Map<string, number>()
  const latestOrderByCustomer = new Map<string, string>()

  for (const order of orders) {
    if (order.status === "Active") {
      activeCountByCustomer.set(order.customerId, (activeCountByCustomer.get(order.customerId) ?? 0) + 1)
    }

    if (!latestOrderByCustomer.has(order.customerId)) {
      latestOrderByCustomer.set(order.customerId, order.createdAt)
    }
  }

  return customers.map((customer) =>
    mapCustomerSearch(
      customer,
      activeCountByCustomer.get(customer._id) ?? 0,
      latestOrderByCustomer.get(customer._id)
    )
  )
}

export const createCustomer = async (input: CreateCustomerInput): Promise<CreateCustomerResponse> => {
  const normalizedPhone = normalizePhone(input.phone)
  const duplicate = await db().collection<CustomerDocument>("customers").findOne({ normalizedPhone })
  if (duplicate) {
    return {
      customer: mapCustomerSearch(duplicate, await db().collection<OrderDocument>("orders").countDocuments({
        customerId: duplicate._id,
        status: "Active"
      })),
      duplicate: true
    }
  }

  return withMongoTransaction(async (session) => {
    const now = new Date().toISOString()
    const customerName = input.name.trim().toUpperCase()
    const customer: CustomerDocument = {
      _id: createId("customer"),
      name: customerName,
      normalizedName: normalizeName(input.name),
      phone: normalizedPhone,
      normalizedPhone,
      phoneDigits: phoneDigits(input.phone),
      publicNameVisible: false,
      currentPoints: 0,
      createdAt: now,
      updatedAt: now
    }

    await db().collection<CustomerDocument>("customers").insertOne(customer, { session })
    await saveAuditLog("customer.created", "customer", customer._id, { phone: customer.phone }, session)

    const oneTimeLogin = await createCustomerMagicLink(customer._id, "registration_welcome", session)
    const templateParams = {
      customer_name: customerName,
      registered_phone: normalizePhoneLabel(customer.phone) || customer.phone,
    }
    const preparedMessage = await buildPreparedMessage("welcome", templateParams)

    await queueNotification({
      _id: createId("notification"),
      customerId: customer._id,
      customerName: customer.name,
      destinationPhone: customer.phone,
      eventType: "welcome",
      deliveryStatus: "queued",
      renderStatus: "not_required",
      attemptCount: 0,
      templateParams,
      preparedMessage,
      businessKey: `welcome:${customer._id}`,
      createdAt: now,
      updatedAt: now
    }, session)

    return {
      customer: mapCustomerSearch(customer, 0),
      duplicate: false,
      oneTimeLogin: {
        url: oneTimeLogin.url,
      }
    }
  })
}

export const generateCustomerMagicLink = async (customerId: string): Promise<CustomerMagicLinkResponse> => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new NotFoundError("Pelanggan tidak ditemukan")
  }

  const oneTimeLogin = await createCustomerMagicLink(customerId, "admin_regenerated")
  await saveAuditLog("customer.magic_link.created", "customer", customerId, { source: "admin_regenerated" })

  return {
    oneTimeLogin: {
      url: oneTimeLogin.url,
    }
  }
}

export const getCustomerDetail = async (customerId: string) => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new NotFoundError("Pelanggan tidak ditemukan")
  }

  const [orders, pointLedger] = await Promise.all([
    db().collection<OrderDocument>("orders").find({ customerId }).sort({ createdAt: -1 }).toArray(),
    db().collection<PointLedgerDocument>("point_ledgers").find({ customerId }).sort({ createdAt: -1 }).toArray()
  ])

  const activeOrderCount = orders.filter((order) => order.status === "Active").length
  const profile: CustomerProfile = mapCustomerProfile(
    customer,
    orders.length,
    activeOrderCount,
    orders[0] ? formatRelativeLabel(orders[0].createdAt) : undefined
  )

  return {
    profile,
    pointLedger: pointLedger.map(mapPointLedger),
    orderHistory: orders.map(mapOrderHistory)
  }
}

export const updateCustomerIdentity = async (customerId: string, input: UpdateCustomerInput) => {
  const existing = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!existing) {
    throw new NotFoundError("Pelanggan tidak ditemukan")
  }

  const normalizedPhone = normalizePhone(input.phone)
  const duplicate = await db().collection<CustomerDocument>("customers").findOne({
    normalizedPhone,
    _id: { $ne: customerId }
  })
  if (duplicate) {
    throw new ConflictError("Nomor HP sudah digunakan pelanggan lain")
  }

  await withMongoTransaction(async (session) => {
    const updatedAt = new Date().toISOString()
    const customerName = input.name.trim().toUpperCase()
    await db().collection<CustomerDocument>("customers").updateOne(
      { _id: customerId },
      {
        $set: {
          name: customerName,
          normalizedName: normalizeName(input.name),
          phone: normalizedPhone,
          normalizedPhone,
          phoneDigits: phoneDigits(input.phone),
          updatedAt
        }
      },
      { session }
    )

    await saveAuditLog("customer.updated", "customer", customerId, { phone: normalizedPhone }, session)

    const templateParams = {
      customer_name: customerName,
      customer_phone: normalizePhoneLabel(normalizedPhone) || normalizedPhone,
    }
    const preparedMessage = await buildPreparedMessage("account_info", templateParams)

    await queueNotification({
      _id: createId("notification"),
      customerId,
      customerName,
      destinationPhone: normalizedPhone,
      eventType: "account_info",
      renderStatus: "not_required",
      deliveryStatus: "queued",
      attemptCount: 0,
      templateParams,
      preparedMessage,
      businessKey: `account-info:${customerId}:${updatedAt}`,
      createdAt: updatedAt,
      updatedAt
    }, session)
  })

  return getCustomerDetail(customerId)
}

export const addManualPoints = async (customerId: string, points: number, reason: string) => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new NotFoundError("Pelanggan tidak ditemukan")
  }

  await withMongoTransaction(async (session) => {
    const now = new Date().toISOString()
    const balanceAfter = customer.currentPoints + points

    await db().collection<CustomerDocument>("customers").updateOne(
      { _id: customerId },
      { $set: { currentPoints: balanceAfter, updatedAt: now } },
      { session }
    )

    await insertPointLedger({
      _id: createId("ledger"),
      customerId,
      label: `Penyesuaian Admin - ${reason}`,
      delta: points,
      balanceAfter,
      tone: "adjustment",
      leaderboardDelta: 0,
      createdAt: now
    }, session)

    await saveAuditLog("customer.points.adjusted", "customer", customerId, { points, reason }, session)
  })

  return getCustomerDetail(customerId)
}

export const getOrderPreview = async (input: ConfirmOrderInput): Promise<OrderPreviewResponse> => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: input.customerId })
  if (!customer) {
    throw new NotFoundError("Pelanggan tidak ditemukan")
  }

  const settings = await getSettingsDocument()
  const preview = calculateOrderPreview(
    settings.services.filter((service) => service.isActive),
    customer.currentPoints,
    input
  )

  if (preview.activeItems.length === 0) {
    throw new ValidationError("Pilih minimal satu layanan")
  }

  return {
    customerName: customer.name,
    weightKg: input.weightKg,
    subtotal: preview.subtotal,
    subtotalLabel: formatCurrency(preview.subtotal),
    discount: preview.discount,
    discountLabel: preview.discount > 0 ? `-${formatCurrency(preview.discount)}` : formatCurrency(0),
    total: preview.total,
    totalLabel: formatCurrency(preview.total),
    earnedStamps: preview.earnedStamps,
    redeemedPoints: preview.redeemedPoints,
    resultingPointBalance: preview.resultingPointBalance,
    maxRedeemableWashers: preview.maxRedeemableWashers,
    items: preview.activeItems.map((item) => ({
      serviceCode: item.serviceCode,
      serviceLabel: item.serviceLabel,
      quantity: item.quantity,
      quantityLabel: item.quantityLabel,
      unitPrice: item.unitPrice,
      unitPriceLabel: formatCurrency(item.unitPrice),
      lineTotal: item.lineTotal,
      lineTotalLabel: formatCurrency(item.lineTotal)
    }))
  }
}

export const confirmOrder = async (input: ConfirmOrderInput) =>
  withMongoTransaction(async (session) => {
    const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: input.customerId }, { session })
    if (!customer) {
      throw new NotFoundError("Pelanggan tidak ditemukan")
    }

    const settings = await getSettingsDocument(session)
    const preview = calculateOrderPreview(
      settings.services.filter((service) => service.isActive),
      customer.currentPoints,
      input
    )

    if (preview.activeItems.length === 0) {
      throw new ValidationError("Pilih minimal satu layanan")
    }

    const createdAt = new Date().toISOString()
    const orderDate = nowJakarta().toJSDate()
    const orderId = createId("order")
    const directToken = createOpaqueToken()
    const orderCode = await createUniqueOrderCode(orderId, orderDate, session)
    const serviceSummary = preview.activeItems
      .map((item) =>
        item.pricingModel === "per_kg"
          ? `${formatWeightLabel(item.quantity)} ${item.serviceLabel}`
          : `${item.quantity}x ${item.serviceLabel}`
      )
      .join(", ")
    const receiptSnapshot = await buildOrderReceiptSnapshot(
      orderCode,
      customer.name,
      serviceSummary,
      preview.total,
      createdAt,
      session
    )

    const order: OrderDocument = {
      _id: orderId,
      orderCode,
      customerId: customer._id,
      customerName: customer.name,
      customerPhone: customer.phone,
      weightKg: input.weightKg,
      items: preview.activeItems.map((item) => ({
        serviceCode: item.serviceCode,
        serviceLabel: item.serviceLabel,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        pricingModel: item.pricingModel,
        lineTotal: item.lineTotal
      })),
      subtotal: preview.subtotal,
      discount: preview.discount,
      total: preview.total,
      redeemedPoints: preview.redeemedPoints,
      earnedStamps: preview.earnedStamps,
      resultingPointBalance: preview.resultingPointBalance,
      receiptSnapshot,
      status: "Active",
      createdAt,
      activityAt: createdAt,
    }

    await db().collection<OrderDocument>("orders").insertOne(order, { session })
    await db().collection<DirectOrderTokenDocument>("direct_order_tokens").insertOne({
      _id: createId("token"),
      tokenHash: hashOpaqueToken(directToken),
      tokenLast4: tokenLast4(directToken),
      orderId,
      createdAt
    }, { session })
    await db().collection<CustomerDocument>("customers").updateOne(
      { _id: customer._id },
      { $set: { currentPoints: preview.resultingPointBalance, updatedAt: createdAt } },
      { session }
    )

    if (preview.redeemedPoints > 0) {
      await insertPointLedger({
        _id: createId("ledger"),
        customerId: customer._id,
        orderId,
        orderCode,
        label: `Order ${orderCode} - Redeem Washer gratis`,
        delta: -preview.redeemedPoints,
        balanceAfter: customer.currentPoints - preview.redeemedPoints,
        tone: "redeemed",
        leaderboardDelta: 0,
        createdAt
      }, session)
    }

    await insertPointLedger({
      _id: createId("ledger"),
      customerId: customer._id,
      orderId,
      orderCode,
      label: `Order ${orderCode} - Stamp diperoleh`,
      delta: preview.earnedStamps,
      balanceAfter: preview.resultingPointBalance,
      tone: "earned",
      leaderboardDelta: preview.earnedStamps,
      createdAt
    }, session)

    await saveAuditLog("order.confirmed", "order", orderId, { orderCode }, session)

    const templateParams = {
      customer_name: customer.name,
      order_code: orderCode,
      created_at: formatDateTime(createdAt),
      weight_kg_label: formatWeightLabel(input.weightKg),
      service_summary: serviceSummary,
      total_label: formatCurrency(preview.total),
      earned_stamps: String(preview.earnedStamps),
      redeemed_points: String(preview.redeemedPoints),
      current_points: String(preview.resultingPointBalance),
      status_url: `${env.PUBLIC_ORIGIN}/status/${directToken}`,
    }
    const preparedMessage = await buildPreparedMessage("order_confirmed", templateParams)

    await queueNotification({
      _id: createId("notification"),
      customerId: customer._id,
      customerName: customer.name,
      destinationPhone: customer.phone,
      orderId,
      orderCode,
      eventType: "order_confirmed",
      renderStatus: "pending",
      deliveryStatus: "queued",
      attemptCount: 0,
      templateParams,
      preparedMessage,
      businessKey: `order-confirmed:${orderId}`,
      createdAt,
      updatedAt: createdAt
    }, session)

    return {
      order: mapOrderHistory(order),
      directToken
    }
  })

export const listActiveOrders = async () => {
  const orders = await db().collection<OrderDocument>("orders").find({ status: "Active" }).sort({ createdAt: -1 }).toArray()
  return orders.map((order) => ({
    orderId: order._id,
    orderCode: order.orderCode,
    customerName: order.customerName,
    phone: order.customerPhone,
    createdAtLabel: formatRelativeLabel(order.createdAt),
    createdAtIso: order.createdAt,
    weightKgLabel: formatWeightLabel(order.weightKg),
    serviceSummary: buildOrderServiceSummary(order.items),
    earnedStamps: order.earnedStamps,
    redeemedPoints: order.redeemedPoints,
    status: "Active" as const
  }))
}

export const listLaundryOrders = async ({
  scope,
  search,
  sort,
  status,
  includeCancelled,
  cursor,
  pageSize,
}: {
  scope: AdminLaundryScope
  search?: string
  sort: AdminLaundrySort
  status: "all" | "active" | "done" | "cancelled"
  includeCancelled: boolean
  cursor?: string
  pageSize: number
}): Promise<AdminLaundryListResponse> => {
  const effectiveIncludeCancelled = includeCancelled || status === "cancelled"
  const filters: Record<string, unknown>[] = [buildOrderSearchFilter(search)]
  const sortField = scope === "active" ? "createdAt" : "activityAt"
  const sortDirection = sort === "newest" ? -1 : 1

  if (scope === "active") {
    filters.push({ status: "Active" })
  } else {
    filters.push(resolveLaundryStatusFilter(status, effectiveIncludeCancelled))

    if (scope === "today") {
      const start = toIso(nowJakarta().startOf("day"))
      const end = toIso(nowJakarta().endOf("day"))
      filters.push({
        activityAt: {
          $gte: start,
          $lte: end,
        },
      })
    }
  }

  if (scope === "history") {
    const decodedCursor = decodeLaundryCursor(cursor)
    if (cursor && !decodedCursor) {
      throw new ValidationError("Cursor history laundry tidak valid")
    }

    if (decodedCursor) {
      filters.push(
        sortDirection === -1
          ? {
              $or: [
                { [sortField]: { $lt: decodedCursor.activityAt } },
                { [sortField]: decodedCursor.activityAt, _id: { $lt: decodedCursor.orderId } },
              ],
            }
          : {
              $or: [
                { [sortField]: { $gt: decodedCursor.activityAt } },
                { [sortField]: decodedCursor.activityAt, _id: { $gt: decodedCursor.orderId } },
              ],
            }
      )
    }
  }

  const query = filters.filter((filter) => Object.keys(filter).length > 0)
  const orders = await db()
    .collection<OrderDocument>("orders")
    .find(query.length > 0 ? { $and: query } : {})
    .sort({ [sortField]: sortDirection, _id: sortDirection })
    .limit(scope === "history" ? pageSize + 1 : pageSize)
    .toArray()

  const hasMore = scope === "history" && orders.length > pageSize
  const nextPageSource = hasMore ? orders[pageSize - 1] : undefined
  const items = hasMore ? orders.slice(0, pageSize) : orders

  return {
    items: items.map(mapAdminLaundryOrder),
    nextCursor: nextPageSource ? encodeLaundryCursor(nextPageSource.activityAt, nextPageSource._id) : undefined,
  }
}

export const getOrderById = async (orderId: string) => {
  const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId })
  if (!order) {
    throw new NotFoundError("Order tidak ditemukan")
  }

  return mapOrderHistory(order)
}

export const markOrderDone = async (orderId: string) =>
  withMongoTransaction(async (session) => {
    const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId }, { session })
    if (!order) {
      throw new NotFoundError("Order tidak ditemukan")
    }
    if (order.status === "Voided") {
      throw new ConflictError("Order yang sudah dibatalkan tidak bisa diselesaikan")
    }
    if (order.status === "Done") {
      throw new ConflictError("Order sudah diselesaikan")
    }

    const completedAt = new Date().toISOString()
    await db().collection<OrderDocument>("orders").updateOne(
      { _id: orderId },
      { $set: { status: "Done", completedAt, activityAt: completedAt } },
      { session }
    )
    await saveAuditLog("order.done", "order", orderId, { completedAt }, session)

    const templateParams = {
      customer_name: order.customerName,
      order_code: order.orderCode,
      created_at: formatDateTime(order.createdAt),
      completed_at: formatDateTime(completedAt),
    }
    const preparedMessage = await buildPreparedMessage("order_done", templateParams)

    await queueNotification({
      _id: createId("notification"),
      customerId: order.customerId,
      customerName: order.customerName,
      destinationPhone: order.customerPhone,
      orderId: order._id,
      orderCode: order.orderCode,
      eventType: "order_done",
      renderStatus: "not_required",
      deliveryStatus: "queued",
      attemptCount: 0,
      templateParams,
      preparedMessage,
      businessKey: `order-done:${order._id}`,
      createdAt: completedAt,
      updatedAt: completedAt
    }, session)

    return mapOrderHistory({
      ...order,
      status: "Done",
      activityAt: completedAt,
      completedAt
    })
  })

export const voidOrder = async (orderId: string, input: VoidOrderInput) => {
  const result = await withMongoTransaction(async (session) => {
    const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId }, { session })
    if (!order) {
      throw new NotFoundError("Order tidak ditemukan")
    }
    if (order.status === "Voided") {
      throw new ConflictError("Order sudah dibatalkan")
    }

    const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: order.customerId }, { session })
    if (!customer) {
      throw new NotFoundError("Pelanggan tidak ditemukan")
    }

    const voidedAt = new Date().toISOString()
    const newBalance = customer.currentPoints + order.redeemedPoints - order.earnedStamps

    await db().collection<OrderDocument>("orders").updateOne(
      { _id: orderId },
      { $set: { status: "Voided", voidedAt, voidReason: input.reason, activityAt: voidedAt } },
      { session }
    )
    await db().collection<CustomerDocument>("customers").updateOne(
      { _id: customer._id },
      { $set: { currentPoints: newBalance, updatedAt: voidedAt } },
      { session }
    )

    if (order.earnedStamps > 0) {
      await insertPointLedger({
        _id: createId("ledger"),
        customerId: customer._id,
        orderId: order._id,
        orderCode: order.orderCode,
        label: `Pembatalan order ${order.orderCode} - Balik stamp`,
        delta: -order.earnedStamps,
        balanceAfter: customer.currentPoints - order.earnedStamps,
        tone: "reversal",
        leaderboardDelta: 0,
        createdAt: voidedAt
      }, session)
    }

    if (order.redeemedPoints > 0) {
      await insertPointLedger({
        _id: createId("ledger"),
        customerId: customer._id,
        orderId: order._id,
        orderCode: order.orderCode,
        label: `Pembatalan order ${order.orderCode} - Kembalikan redeem`,
        delta: order.redeemedPoints,
        balanceAfter: newBalance,
        tone: "reversal",
        leaderboardDelta: 0,
        createdAt: voidedAt
      }, session)
    }

    await saveAuditLog("order.voided", "order", order._id, { reason: input.reason }, session)

    if (input.notifyCustomer) {
      const templateParams = {
        customer_name: order.customerName,
        order_code: order.orderCode,
        reason: input.reason,
      }
      const preparedMessage = await buildPreparedMessage("order_void_notice", templateParams)

      await queueNotification({
        _id: createId("notification"),
        customerId: order.customerId,
        customerName: order.customerName,
        destinationPhone: order.customerPhone,
        orderId: order._id,
        orderCode: order.orderCode,
        eventType: "order_void_notice",
        renderStatus: "not_required",
        deliveryStatus: "queued",
        attemptCount: 0,
        templateParams,
        preparedMessage,
        businessKey: `order-void:${order._id}:${voidedAt}`,
        createdAt: voidedAt,
        updatedAt: voidedAt
      }, session)
    }

    return {
      order: {
        ...order,
        status: "Voided" as const,
        activityAt: voidedAt,
        voidedAt,
        voidReason: input.reason
      },
      monthKey: monthKeyFromIso(order.createdAt)
    }
  })

  await rebuildArchivedLeaderboard(result.monthKey, `void-order:${result.order.orderCode}`)
  return mapOrderHistory(result.order)
}

export const listNotifications = async (): Promise<NotificationRecord[]> => {
  const notifications = await db().collection<NotificationDocument>("notifications").find({}).sort({ createdAt: -1 }).toArray()
  return notifications.map(mapNotification)
}

export const resendNotification = async (notificationId: string) => {
  await markNotificationForRetry(notificationId)
  let standardRetryError: unknown = null

  try {
    await processNotification(notificationId)
  } catch (error) {
    standardRetryError = error
  }

  let notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  if ((standardRetryError || notification.deliveryStatus === "failed") && notification.preparedMessage.trim()) {
    const attemptedAt = new Date().toISOString()

    try {
      const delivery = await sendNotificationFallbackToWhatsapp(notification)
      await db().collection<NotificationDocument>("notifications").updateOne(
        { _id: notificationId },
        {
          $set: {
            deliveryStatus: "sent",
            lastAttemptAt: attemptedAt,
            updatedAt: attemptedAt,
            providerKind: delivery.providerKind,
            providerMessageId: delivery.providerMessageId,
            providerStatus: delivery.providerStatus,
            providerStatusAt: delivery.providerStatusAt,
            waId: delivery.waId,
            sentAt: delivery.sentAt,
          },
          $unset: {
            latestFailureReason: "",
            gatewayErrorCode: "",
            latestErrorCode: "",
            latestErrorMessage: "",
          },
          $inc: { attemptCount: 1 },
        }
      )
      await saveAuditLog("notification.api_fallback_sent", "notification", notificationId, {
        eventType: notification.eventType,
        orderCode: notification.orderCode,
      })
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Gagal mengirim fallback WhatsApp"
      const gatewayErrorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof (error as { code?: unknown }).code === "string"
          ? (error as { code: string }).code
          : undefined

      await db().collection<NotificationDocument>("notifications").updateOne(
        { _id: notificationId },
        {
          $set: {
            deliveryStatus: "failed",
            latestFailureReason: reason,
            latestErrorMessage: reason,
            lastAttemptAt: attemptedAt,
            updatedAt: attemptedAt,
            ...(gatewayErrorCode ? { gatewayErrorCode } : {}),
            ...(gatewayErrorCode ? { latestErrorCode: gatewayErrorCode } : {}),
          },
          $inc: { attemptCount: 1 },
        }
      )
      await saveAuditLog("notification.api_fallback_failed", "notification", notificationId, {
        eventType: notification.eventType,
        orderCode: notification.orderCode,
        error: serializeError(error),
      })
    }

    notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
    if (!notification) {
      throw new NotFoundError("Notifikasi tidak ditemukan")
    }
  }

  if (standardRetryError && notification.deliveryStatus !== "sent" && !notification.preparedMessage.trim()) {
    throw standardRetryError
  }

  return mapNotification(notification)
}

export const markNotificationManualResolved = async (notificationId: string, note: string) => {
  await markNotificationManualResolvedRecord(notificationId, note)
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  return mapNotification(notification)
}

export const markNotificationManualCompleted = async (notificationId: string) => {
  const note = "Ditandai selesai oleh admin."
  await markNotificationManualResolvedRecord(notificationId, note)
  await saveAuditLog("notification.manual_completed", "notification", notificationId)
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  return mapNotification(notification)
}

export const markNotificationIgnored = async (notificationId: string) => {
  const note = "Diabaikan oleh admin."
  await markNotificationIgnoredRecord(notificationId, note)
  await saveAuditLog("notification.ignored", "notification", notificationId)
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  return mapNotification(notification)
}

export const downloadNotificationReceipt = async (notificationId: string) => {
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  if (notification.eventType !== "order_confirmed" || !notification.orderId) {
    throw new ValidationError("Receipt tidak tersedia")
  }

  return Buffer.from(await buildOrderReceipt(notificationId, { preferCached: false }), "base64")
}

export const openManualWhatsappFallback = async (notificationId: string) => {
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }

  if (notification.deliveryStatus !== "failed") {
    throw new ConflictError("Manual WhatsApp hanya tersedia untuk notifikasi gagal")
  }

  if (!notification.preparedMessage.trim()) {
    throw new ValidationError("Pesan fallback tidak tersedia untuk notifikasi ini")
  }

  await saveAuditLog("notification.manual_whatsapp_redirected_to_api_resend", "notification", notificationId, {
    eventType: notification.eventType,
    orderCode: notification.orderCode
  })

  return {
    notification: await resendNotification(notificationId),
  }
}

export const getNotificationPreparedMessage = async (notificationId: string) => {
  const notification = await db().collection<NotificationDocument>("notifications").findOne({ _id: notificationId })
  if (!notification) {
    throw new NotFoundError("Notifikasi tidak ditemukan")
  }
  return notification.preparedMessage
}

export const getSettings = async (): Promise<SettingsResponse> => {
  const settings = await getSettingsDocument()
  return {
    business: settings.business,
    services: settings.services,
  }
}

export const updateSettings = async (payload: SettingsResponse) => {
  const normalizedPublicWhatsapp =
    normalizePhoneLabel(payload.business.publicWhatsapp) || payload.business.publicWhatsapp.trim()
  const normalizedAdminWhatsappContacts = sanitizeAdminWhatsappContacts(
    payload.business.adminWhatsappContacts,
    [
      payload.business.publicContactPhone,
      normalizedPublicWhatsapp,
    ]
  )
  const primaryAdminWhatsappContact =
    normalizedAdminWhatsappContacts.find((contact) => contact.isPrimary) ??
    normalizedAdminWhatsappContacts[0]
  const nextBusiness = {
    ...payload.business,
    laundryName: payload.business.laundryName.trim(),
    laundryPhone: normalizePhoneLabel(payload.business.laundryPhone) || payload.business.laundryPhone.trim(),
    publicContactPhone: primaryAdminWhatsappContact.phone,
    publicWhatsapp: normalizedPublicWhatsapp || primaryAdminWhatsappContact.phone,
    adminWhatsappContacts: normalizedAdminWhatsappContacts,
    address: payload.business.address.trim(),
    operatingHours: payload.business.operatingHours.trim(),
  }

  await db().collection<SettingsDocument>("settings").updateOne(
    { _id: "app-settings" },
    {
      $set: {
        business: nextBusiness,
        services: payload.services,
        updatedAt: new Date().toISOString()
      },
      $unset: {
        messageTemplates: "",
      }
    }
  )
  await saveAuditLog("settings.updated", "settings", "app-settings")
  return getSettings()
}

export const beginIdempotencyRequest = async (scope: string, key: string, fingerprint: string) => {
  const now = new Date().toISOString()

  try {
    await db().collection<IdempotencyKeyDocument>("idempotency_keys").insertOne({
      scope,
      key,
      fingerprint,
      status: "in_progress",
      createdAt: now,
      updatedAt: now
    })

    return { kind: "started" as const }
  } catch {
    const existing = await db().collection<IdempotencyKeyDocument>("idempotency_keys").findOne({ scope, key })
    if (!existing) {
      throw new ConflictError("Gagal memproses idempotency request")
    }

    return { kind: "existing" as const, record: existing }
  }
}

export const waitForCompletedIdempotencyRequest = async (scope: string, key: string, timeoutMs = 3000) => {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    const record = await db().collection<IdempotencyKeyDocument>("idempotency_keys").findOne({ scope, key })
    if (record?.status === "completed") {
      return record
    }

    await new Promise((resolve) => setTimeout(resolve, 75))
  }

  return null
}

export const completeIdempotencyRequest = async (scope: string, key: string, response: unknown) => {
  await db().collection<IdempotencyKeyDocument>("idempotency_keys").updateOne(
    { scope, key },
    {
      $set: {
        status: "completed",
        response,
        updatedAt: new Date().toISOString()
      }
    }
  )
}

export const failIdempotencyRequest = async (scope: string, key: string) => {
  await db().collection<IdempotencyKeyDocument>("idempotency_keys").deleteOne({ scope, key, status: "in_progress" })
}

export const createRequestFingerprint = (payload: unknown) => sha256(JSON.stringify(payload))
