import type {
  CustomerNameVisibilityInput,
  CustomerOrderDetail,
  CustomerMagicLinkRedeemInput,
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
  CustomerMagicLinkDocument,
  DirectOrderTokenDocument,
  LeaderboardSnapshotDocument,
  OrderDocument,
  PointLedgerDocument
} from "../types.js"
import { buildOrderReceiptPdf, getPrimaryAdminWhatsappContact, getSettingsDocument, mapCustomerOrderDetail, mapOrderHistory, mapPointLedger } from "./common.js"

const db = () => getDatabase()

const mapCustomerSession = (customer: CustomerDocument) => ({
  customerId: customer._id,
  name: customer.name,
  phone: customer.phone,
  publicNameVisible: customer.publicNameVisible,
})

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
  const primaryContact = getPrimaryAdminWhatsappContact(settings)
  const currentMonth = nowJakarta().toFormat("yyyy-MM")
  const leaderboardTeaser = await resolveLeaderboardDisplayRows(
    currentMonth,
    await computeLeaderboardRows(currentMonth, 5)
  )
  return {
    laundryInfo: {
      name: settings.business.laundryName,
      phone: primaryContact.phone,
      whatsapp: normalizeWhatsappPhone(primaryContact.phone),
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
    leaderboardTeaser
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

  return mapCustomerSession(customer)
}

export const redeemCustomerMagicLink = async (input: CustomerMagicLinkRedeemInput) => {
  const magicLink = await db().collection<CustomerMagicLinkDocument>("customer_magic_links").findOne({
    token: input.token,
    usedAt: { $exists: false },
    revokedAt: { $exists: false },
  })

  if (!magicLink) {
    return null
  }

  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: magicLink.customerId })
  if (!customer) {
    return null
  }

  return {
    magicLinkId: magicLink._id,
    session: mapCustomerSession(customer),
  }
}

export const markCustomerMagicLinkUsed = async (magicLinkId: string) => {
  await db().collection<CustomerMagicLinkDocument>("customer_magic_links").updateOne(
    { _id: magicLinkId, usedAt: { $exists: false } },
    {
      $set: {
        usedAt: new Date().toISOString(),
      }
    }
  )
}

export const getPublicDashboard = async (customerId: string): Promise<PublicDashboardResponse> => {
  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }

  const [orders, settings] = await Promise.all([
    db().collection<OrderDocument>("orders").find({ customerId }).sort({ createdAt: -1 }).toArray(),
    getSettingsDocument(),
  ])
  const monthlySummary = await calculateMonthlySummary(customerId)
  return {
    session: mapCustomerSession(customer),
    adminWhatsappContacts: settings.business.adminWhatsappContacts,
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
  return mapCustomerOrderDetail(order)
}

export const getCustomerOrderReceipt = async (customerId: string, orderId: string) => {
  const order = await db().collection<OrderDocument>("orders").findOne({ _id: orderId, customerId })
  if (!order) {
    throw new Error("Order tidak ditemukan")
  }

  return buildOrderReceiptPdf(orderId)
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

const resolveLeaderboardDisplayRows = async (
  monthKey: string,
  rows: Array<{
    rank: number
    customerId: string
    maskedAlias: string
    earnedStamps: number
  }>
): Promise<LeaderboardRow[]> => {
  const customerIds = rows.map((row) => row.customerId)
  const customers = customerIds.length > 0
    ? await db().collection<CustomerDocument>("customers").find({
        _id: { $in: customerIds }
      }).toArray()
    : []

  const customerMap = new Map(customers.map((customer) => [customer._id, customer]))

  return rows.map((row) => {
    const customer = customerMap.get(row.customerId)
    const showName = customer?.publicNameVisible === true && Boolean(customer.name)
    return {
      rank: row.rank,
      displayName: showName ? customer!.name : row.maskedAlias,
      isMasked: !showName,
      earnedStamps: row.earnedStamps,
      monthKey
    }
  })
}

export const getLeaderboardByMonth = async (monthKey: string): Promise<LeaderboardRow[]> =>
  resolveLeaderboardDisplayRows(
    monthKey,
    await computeLeaderboardRows(monthKey, monthKey === nowJakarta().toFormat("yyyy-MM") ? 50 : 20)
  )

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

export const updateCustomerNameVisibility = async (
  customerId: string,
  input: CustomerNameVisibilityInput
) => {
  await db().collection<CustomerDocument>("customers").updateOne(
    { _id: customerId },
    {
      $set: {
        publicNameVisible: input.publicNameVisible,
        updatedAt: new Date().toISOString()
      }
    }
  )

  const customer = await db().collection<CustomerDocument>("customers").findOne({ _id: customerId })
  if (!customer) {
    throw new Error("Pelanggan tidak ditemukan")
  }

  return {
    customerId: customer._id,
    name: customer.name,
    phone: customer.phone,
    publicNameVisible: customer.publicNameVisible
  }
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
  const primaryContact = getPrimaryAdminWhatsappContact(settings)
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
    laundryPhone: primaryContact.phone
  }
}
