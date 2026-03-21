import type {
  LandingResponse,
  LeaderboardRow,
  PublicDashboardResponse
} from "@cjl/contracts"
import { getDatabase } from "../db.js"
import { computeLeaderboardRows } from "../lib/leaderboard.js"
import { normalizeName, normalizePhone, normalizeWhatsappPhone } from "../lib/normalization.js"
import { formatDateTime, formatWeightLabel, monthKeyFromIso, monthLabel, nowJakarta } from "../lib/time.js"
import type {
  CustomerDocument,
  DirectOrderTokenDocument,
  LeaderboardSnapshotDocument,
  OrderDocument,
  PointLedgerDocument
} from "../types.js"
import { getSettingsDocument, mapOrderHistory, mapPointLedger } from "./common.js"

const db = () => getDatabase()

const calculateMonthlySummary = async (customerId: string) => {
  const monthKey = nowJakarta().toFormat("yyyy-MM")
  const orders = await db().collection<OrderDocument>("orders").find({ customerId }).toArray()
  const monthOrders = orders.filter(
    (order) => monthKeyFromIso(order.createdAt) === monthKey && order.status !== "Voided"
  )
  return {
    monthKey,
    totalOrdersCreated: monthOrders.length,
    totalCompletedOrders: monthOrders.filter((order) => order.status === "Done").length,
    activeOrdersOpen: monthOrders.filter((order) => order.status === "Active").length,
    totalWeightProcessedLabel: formatWeightLabel(monthOrders.reduce((sum, order) => sum + order.weightKg, 0)),
    totalEarnedStamps: monthOrders.reduce((sum, order) => sum + order.earnedStamps, 0),
    totalRedeemedPoints: monthOrders.reduce((sum, order) => sum + order.redeemedPoints, 0),
    freeWasherUnitsUsed: monthOrders.reduce((sum, order) => sum + order.redeemedPoints / 10, 0)
  }
}

export const getLandingData = async (): Promise<LandingResponse> => {
  const settings = await getSettingsDocument()
  const currentMonth = nowJakarta().toFormat("yyyy-MM")
  const leaderboardTeaser = await computeLeaderboardRows(currentMonth, 5)
  return {
    laundryInfo: {
      name: settings.business.laundryName,
      phone: settings.business.publicContactPhone,
      whatsapp: normalizeWhatsappPhone(settings.business.publicWhatsapp),
      address: settings.business.address,
      operatingHours: settings.business.operatingHours
    },
    services: settings.services.filter((service) => service.isActive).map((service) => ({
      code: service.serviceCode,
      name: service.displayName,
      price: service.price,
      priceModel: service.pricingModel === "fixed" ? "per_unit" : "per_kg",
      description: service.publicDescription
    })),
    faqs: [
      {
        question: "Bagaimana cara login ke portal pelanggan?",
        answer: "Login menggunakan nomor HP dan nama yang terdaftar saat transaksi pertama."
      },
      {
        question: "Kapan stamp bertambah?",
        answer: "Stamp bertambah saat order dikonfirmasi oleh admin."
      },
      {
        question: "Apakah status order bisa dicek tanpa login?",
        answer: "Bisa, lewat link status order khusus yang dikirim via WhatsApp."
      }
    ],
    leaderboardTeaser: leaderboardTeaser.map((row) => ({
      rank: row.rank,
      maskedAlias: row.maskedAlias,
      earnedStamps: row.earnedStamps,
      monthKey: currentMonth
    }))
  }
}

export const loginCustomer = async (phone: string, name: string) => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({
    normalizedPhone: normalizePhone(phone),
    normalizedName: normalizeName(name)
  })
  if (!customer) {
    return null
  }

  return {
    customerId: customer._id,
    name: customer.name,
    phone: customer.phone
  }
}

export const getPublicDashboard = async (customerId: string): Promise<PublicDashboardResponse> => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }

  const orders = await db().collection<OrderDocument>("orders").find({ customerId }).sort({ createdAt: -1 }).toArray()
  const monthlySummary = await calculateMonthlySummary(customerId)
  return {
    session: {
      customerId: customer._id,
      name: customer.name,
      phone: customer.phone
    },
    stampBalance: {
      currentPoints: customer.currentPoints,
      eligibleFreeWashers: Math.floor(customer.currentPoints / 10),
      lifetimeEarnedStamps: orders.reduce((sum, order) => sum + order.earnedStamps, 0)
    },
    summaryCards: [
      {
        id: "active-orders",
        label: "Order Aktif",
        value: String(orders.filter((order) => order.status === "Active").length),
        icon: "clock"
      },
      {
        id: "completed-month",
        label: "Selesai Bulan Ini",
        value: String(monthlySummary.totalCompletedOrders),
        icon: "check"
      },
      {
        id: "weight-month",
        label: "Total Berat",
        value: monthlySummary.totalWeightProcessedLabel,
        icon: "weight"
      },
      {
        id: "earned-month",
        label: "Stamp Diperoleh",
        value: String(monthlySummary.totalEarnedStamps),
        icon: "star"
      }
    ],
    activeOrders: orders.filter((order) => order.status === "Active").map((order) => ({
      orderId: order._id,
      orderCode: order.orderCode,
      status: "Active" as const,
      createdAtLabel: formatDateTime(order.createdAt),
      completedAtLabel: order.completedAt ? formatDateTime(order.completedAt) : undefined,
      serviceSummary: order.items.map((item) => `${item.quantity}x ${item.serviceLabel}`).join(", "),
      weightKgLabel: formatWeightLabel(order.weightKg)
    })),
    monthlySummary
  }
}

export const listCustomerOrders = async (customerId: string) => {
  const orders = await db().collection<OrderDocument>("orders").find({ customerId }).sort({ createdAt: -1 }).toArray()
  return orders.map(mapOrderHistory)
}

export const getCustomerOrderDetail = async (customerId: string, orderId: string) => {
  const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId, customerId })
  if (!order) {
    throw new Error("Order tidak ditemukan")
  }
  return mapOrderHistory(order)
}

export const listCustomerPointLedger = async (customerId: string) => {
  const entries = await db().collection<PointLedgerDocument>("point_ledgers").find({ customerId }).sort({ createdAt: -1 }).toArray()
  return entries.map(mapPointLedger)
}

export const listCustomerRedemptions = async (customerId: string) => {
  const entries = await db().collection<PointLedgerDocument>("point_ledgers").find({
    customerId,
    tone: "redeemed"
  }).sort({ createdAt: -1 }).toArray()
  return entries.map((entry) => ({
    entryId: entry._id,
    redeemedPoints: Math.abs(entry.delta),
    freeWasherUnits: Math.abs(entry.delta) / 10,
    createdAtLabel: formatDateTime(entry.createdAt),
    relatedOrderCode: entry.orderCode
  }))
}

export const getLeaderboardByMonth = async (monthKey: string): Promise<LeaderboardRow[]> =>
  (await computeLeaderboardRows(monthKey, monthKey === nowJakarta().toFormat("yyyy-MM") ? 50 : 20)).map((row) => ({
    rank: row.rank,
    maskedAlias: row.maskedAlias,
    earnedStamps: row.earnedStamps,
    monthKey
  }))

export const getAvailableLeaderboardMonths = async () => {
  const [orders, snapshots] = await Promise.all([
    db().collection<OrderDocument>("orders").find({ status: { $ne: "Voided" } }).toArray(),
    db().collection<LeaderboardSnapshotDocument>("leaderboard_snapshots").find({}).toArray()
  ])

  const monthKeys = [...new Set([
    ...orders.map((order) => monthKeyFromIso(order.createdAt)),
    ...snapshots.map((snapshot) => snapshot.monthKey)
  ])].sort().reverse()

  return monthKeys.map((key) => ({
    key,
    label: monthLabel(key),
    isCurrent: key === nowJakarta().toFormat("yyyy-MM")
  }))
}

export const getDirectOrderStatus = async (token: string) => {
  const directToken = await db().collection<DirectOrderTokenDocument>("direct_order_tokens").findOne({
    token,
    revokedAt: { $exists: false }
  })
  if (!directToken) {
    return null
  }

  const order = await db().collection<OrderDocument>("orders").findOne({ _id: directToken.orderId })
  if (!order) {
    return null
  }

  const settings = await getSettingsDocument()
  return {
    orderCode: order.orderCode,
    status: order.status === "Voided" ? "Cancelled" : order.status,
    createdAtLabel: formatDateTime(order.createdAt),
    completedAtLabel: order.completedAt ? formatDateTime(order.completedAt) : undefined,
    cancelledAtLabel: order.voidedAt ? formatDateTime(order.voidedAt) : undefined,
    cancellationSummary: order.voidReason,
    serviceSummary: order.items.map((item) => `${item.quantity}x ${item.serviceLabel}`).join(", "),
    weightKgLabel: formatWeightLabel(order.weightKg),
    earnedStamps: order.earnedStamps,
    redeemedPoints: order.redeemedPoints,
    laundryName: settings.business.laundryName,
    laundryPhone: settings.business.publicContactPhone
  }
}
