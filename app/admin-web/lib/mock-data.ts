// Mock data types based on design spec
export type DashboardMetricCardVM = {
  id: string
  label: string
  value: string
  deltaLabel?: string
  tone: "neutral" | "positive" | "warning"
}

export type CustomerSearchResultVM = {
  customerId: string
  name: string
  phone: string
  currentPoints: number
  activeOrderCount: number
  recentActivityAt?: string
}

export type ServicePickerItemVM = {
  serviceCode:
    | "washer"
    | "dryer"
    | "detergent"
    | "softener"
    | "wash_dry_fold_package"
    | "wash_dry_package"
    | "ironing"
    | "ironing_only"
    | "laundry_plastic"
    | "laundry_plastic_large"
    | "laundry_hanger"
  label: string
  pricingLabel: string
  quantity: number
  selected: boolean
  disabled?: boolean
  pricePerUnit: number
  pricingModel: "fixed" | "per_kg"
}

export type OrderSummaryVM = {
  customerName: string
  weightKg: number
  subtotalLabel: string
  discountLabel: string
  totalLabel: string
  earnedStamps: number
  redeemedPoints: number
  resultingPointBalance: number
  items: Array<{
    serviceLabel: string
    quantityLabel: string
    lineTotalLabel: string
  }>
}

export type ActiveOrderCardVM = {
  orderId: string
  orderCode: string
  customerName: string
  phone: string
  createdAtLabel: string
  weightKgLabel: string
  serviceSummary: string
  earnedStamps: number
  redeemedPoints: number
  status: "Active"
}

export type OutboxNotificationVM = {
  notificationId: string
  eventType: "welcome" | "order_confirmed" | "order_done" | "order_void_notice"
  customerName: string
  destinationPhone: string
  orderCode?: string
  renderStatus?: "not_required" | "pending" | "ready" | "failed"
  deliveryStatus: "queued" | "sent" | "failed" | "manual_resolved"
  lastError?: string
  attemptCount: number
  lastAttemptAt?: string
}

export type CustomerProfileVM = {
  customerId: string
  name: string
  phone: string
  currentPoints: number
  activeOrderCount: number
  totalOrders: number
  lastActivityAt?: string
}

export type PointLedgerItemVM = {
  entryId: string
  label: string
  delta: number
  balanceAfter: number
  createdAtLabel: string
  tone: "earned" | "redeemed" | "adjustment" | "reversal"
  relatedOrderCode?: string
}

export type OrderHistoryItemVM = {
  orderId: string
  orderCode: string
  createdAtLabel: string
  completedAtLabel?: string
  cancelledAtLabel?: string
  cancellationSummary?: string
  weightKgLabel: string
  serviceSummary: string
  totalLabel: string
  earnedStamps: number
  redeemedPoints: number
  status: "Active" | "Done" | "Cancelled"
}

export type ServicePriceSettingVM = {
  serviceCode: string
  displayName: string
  pricingModel: "fixed" | "per_kg"
  price: number
  isActive: boolean
}

// Mock data
export const mockDashboardMetrics: DashboardMetricCardVM[] = [
  { id: "1", label: "Penjualan Hari Ini", value: "Rp 1.250.000", deltaLabel: "+12%", tone: "positive" },
  { id: "2", label: "Order Aktif", value: "8", deltaLabel: "", tone: "neutral" },
  { id: "3", label: "Order Selesai", value: "24", deltaLabel: "+5", tone: "positive" },
  { id: "4", label: "Poin Diberikan", value: "156", deltaLabel: "+18", tone: "positive" },
]

export const mockCustomers: CustomerSearchResultVM[] = [
  { customerId: "c1", name: "Siti Rahayu", phone: "+62 812-3456-7890", currentPoints: 45, activeOrderCount: 2, recentActivityAt: "2 jam lalu" },
  { customerId: "c2", name: "Budi Santoso", phone: "+62 813-9876-5432", currentPoints: 120, activeOrderCount: 0, recentActivityAt: "Kemarin" },
  { customerId: "c3", name: "Dewi Lestari", phone: "+62 857-1234-5678", currentPoints: 78, activeOrderCount: 1, recentActivityAt: "3 hari lalu" },
  { customerId: "c4", name: "Ahmad Wijaya", phone: "+62 821-5555-4444", currentPoints: 210, activeOrderCount: 0, recentActivityAt: "1 minggu lalu" },
  { customerId: "c5", name: "Rina Permata", phone: "+62 878-8888-9999", currentPoints: 32, activeOrderCount: 1, recentActivityAt: "5 jam lalu" },
  { customerId: "c6", name: "Joko Prabowo", phone: "+62 815-7777-6666", currentPoints: 95, activeOrderCount: 0, recentActivityAt: "2 hari lalu" },
]

export const mockServices: ServicePickerItemVM[] = [
  { serviceCode: "washer", label: "Washer", pricingLabel: "Rp 10.000/unit", quantity: 0, selected: false, pricePerUnit: 10000, pricingModel: "fixed" },
  { serviceCode: "dryer", label: "Dryer", pricingLabel: "Rp 10.000/unit", quantity: 0, selected: false, pricePerUnit: 10000, pricingModel: "fixed" },
  { serviceCode: "detergent", label: "Detergent", pricingLabel: "Rp 1.000/unit", quantity: 0, selected: false, pricePerUnit: 1000, pricingModel: "fixed" },
  { serviceCode: "softener", label: "Softener", pricingLabel: "Rp 1.000/unit", quantity: 0, selected: false, pricePerUnit: 1000, pricingModel: "fixed" },
  { serviceCode: "wash_dry_fold_package", label: "Paket Cuci Kering Lipat", pricingLabel: "Rp 35.000/unit", quantity: 0, selected: false, pricePerUnit: 35000, pricingModel: "fixed" },
  { serviceCode: "wash_dry_package", label: "Paket Cuci Kering", pricingLabel: "Rp 25.000/unit", quantity: 0, selected: false, pricePerUnit: 25000, pricingModel: "fixed" },
  { serviceCode: "ironing", label: "Setrika", pricingLabel: "Rp 4.500/kg", quantity: 0, selected: false, pricePerUnit: 4500, pricingModel: "per_kg" },
  { serviceCode: "ironing_only", label: "Setrika Saja", pricingLabel: "Rp 5.000/kg", quantity: 0, selected: false, pricePerUnit: 5000, pricingModel: "per_kg" },
  { serviceCode: "laundry_plastic", label: "Plastik Laundry", pricingLabel: "Rp 2.000/unit", quantity: 0, selected: false, pricePerUnit: 2000, pricingModel: "fixed" },
  { serviceCode: "laundry_plastic_large", label: "Plastik Laundry Besar", pricingLabel: "Rp 4.000/unit", quantity: 0, selected: false, pricePerUnit: 4000, pricingModel: "fixed" },
  { serviceCode: "laundry_hanger", label: "Gantungan Laundry", pricingLabel: "Rp 2.000/unit", quantity: 0, selected: false, pricePerUnit: 2000, pricingModel: "fixed" },
]

export const mockActiveOrders: ActiveOrderCardVM[] = [
  { orderId: "o1", orderCode: "CJ-240318-001", customerName: "Siti Rahayu", phone: "+62 812-3456-7890", createdAtLabel: "Hari ini, 08:30", weightKgLabel: "5.2 kg", serviceSummary: "2 Washer, 2 Dryer, Setrika", earnedStamps: 4, redeemedPoints: 0, status: "Active" },
  { orderId: "o2", orderCode: "CJ-240318-002", customerName: "Dewi Lestari", phone: "+62 857-1234-5678", createdAtLabel: "Hari ini, 09:15", weightKgLabel: "3.8 kg", serviceSummary: "1 Paket Cuci Kering Lipat", earnedStamps: 2, redeemedPoints: 0, status: "Active" },
  { orderId: "o3", orderCode: "CJ-240318-003", customerName: "Rina Permata", phone: "+62 878-8888-9999", createdAtLabel: "Hari ini, 10:00", weightKgLabel: "7.5 kg", serviceSummary: "3 Washer, 3 Dryer, 3 Detergent", earnedStamps: 6, redeemedPoints: 10, status: "Active" },
  { orderId: "o4", orderCode: "CJ-240317-015", customerName: "Siti Rahayu", phone: "+62 812-3456-7890", createdAtLabel: "Kemarin, 14:20", weightKgLabel: "4.0 kg", serviceSummary: "2 Washer, 2 Dryer", earnedStamps: 4, redeemedPoints: 0, status: "Active" },
  { orderId: "o5", orderCode: "CJ-240317-016", customerName: "Budi Santoso", phone: "+62 813-9876-5432", createdAtLabel: "Kemarin, 16:45", weightKgLabel: "6.2 kg", serviceSummary: "2 Paket Cuci Kering Lipat, Setrika", earnedStamps: 4, redeemedPoints: 20, status: "Active" },
]

export const mockOutboxNotifications: OutboxNotificationVM[] = [
  { notificationId: "n1", eventType: "order_confirmed", customerName: "Siti Rahayu", destinationPhone: "+62 812-3456-7890", orderCode: "CJ-240318-001", renderStatus: "ready", deliveryStatus: "sent", attemptCount: 1, lastAttemptAt: "5 menit lalu" },
  { notificationId: "n2", eventType: "order_confirmed", customerName: "Dewi Lestari", destinationPhone: "+62 857-1234-5678", orderCode: "CJ-240318-002", renderStatus: "ready", deliveryStatus: "failed", lastError: "WhatsApp tidak terkoneksi", attemptCount: 3, lastAttemptAt: "2 menit lalu" },
  { notificationId: "n3", eventType: "welcome", customerName: "Andi Pratama", destinationPhone: "+62 822-1111-2222", deliveryStatus: "queued", attemptCount: 0 },
  { notificationId: "n4", eventType: "order_done", customerName: "Budi Santoso", destinationPhone: "+62 813-9876-5432", orderCode: "CJ-240317-012", renderStatus: "ready", deliveryStatus: "sent", attemptCount: 1, lastAttemptAt: "1 jam lalu" },
  { notificationId: "n5", eventType: "order_confirmed", customerName: "Rina Permata", destinationPhone: "+62 878-8888-9999", orderCode: "CJ-240318-003", renderStatus: "failed", deliveryStatus: "failed", lastError: "Gagal render receipt", attemptCount: 2, lastAttemptAt: "10 menit lalu" },
  { notificationId: "n6", eventType: "order_void_notice", customerName: "Joko Prabowo", destinationPhone: "+62 815-7777-6666", orderCode: "CJ-240316-008", deliveryStatus: "manual_resolved", attemptCount: 4, lastAttemptAt: "2 hari lalu" },
]

export const mockPointLedger: PointLedgerItemVM[] = [
  { entryId: "p1", label: "Order CJ-240318-001 - Stamp diperoleh", delta: 4, balanceAfter: 49, createdAtLabel: "Hari ini, 08:30", tone: "earned", relatedOrderCode: "CJ-240318-001" },
  { entryId: "p2", label: "Order CJ-240317-015 - Stamp diperoleh", delta: 4, balanceAfter: 45, createdAtLabel: "Kemarin, 14:20", tone: "earned", relatedOrderCode: "CJ-240317-015" },
  { entryId: "p3", label: "Order CJ-240315-010 - Redeem diskon reward", delta: -10, balanceAfter: 41, createdAtLabel: "3 hari lalu", tone: "redeemed", relatedOrderCode: "CJ-240315-010" },
  { entryId: "p4", label: "Penyesuaian Admin - Bonus loyalitas", delta: 15, balanceAfter: 51, createdAtLabel: "1 minggu lalu", tone: "adjustment" },
  { entryId: "p5", label: "Order CJ-240310-005 - Stamp diperoleh", delta: 6, balanceAfter: 36, createdAtLabel: "1 minggu lalu", tone: "earned", relatedOrderCode: "CJ-240310-005" },
]

export const mockOrderHistory: OrderHistoryItemVM[] = [
  { orderId: "oh1", orderCode: "CJ-240318-001", createdAtLabel: "Hari ini, 08:30", weightKgLabel: "5.2 kg", serviceSummary: "2 Washer, 2 Dryer, Setrika", totalLabel: "Rp 63.400", earnedStamps: 4, redeemedPoints: 0, status: "Active" },
  { orderId: "oh2", orderCode: "CJ-240317-015", createdAtLabel: "Kemarin, 14:20", weightKgLabel: "4.0 kg", serviceSummary: "2 Washer, 2 Dryer", totalLabel: "Rp 40.000", earnedStamps: 4, redeemedPoints: 0, status: "Active" },
  { orderId: "oh3", orderCode: "CJ-240315-010", createdAtLabel: "3 hari lalu", completedAtLabel: "3 hari lalu", weightKgLabel: "3.5 kg", serviceSummary: "1 Washer, 1 Dryer, 2 Detergent", totalLabel: "Rp 12.000", earnedStamps: 2, redeemedPoints: 10, status: "Done" },
  { orderId: "oh4", orderCode: "CJ-240310-005", createdAtLabel: "1 minggu lalu", completedAtLabel: "1 minggu lalu", weightKgLabel: "8.0 kg", serviceSummary: "3 Washer, 3 Dryer, Setrika", totalLabel: "Rp 96.000", earnedStamps: 6, redeemedPoints: 0, status: "Done" },
  { orderId: "oh5", orderCode: "CJ-240305-002", createdAtLabel: "2 minggu lalu", weightKgLabel: "2.5 kg", serviceSummary: "1 Paket Cuci Kering Lipat", totalLabel: "Rp 35.000", earnedStamps: 2, redeemedPoints: 0, status: "Cancelled" },
]

export const mockServicePrices: ServicePriceSettingVM[] = [
  { serviceCode: "washer", displayName: "Washer", pricingModel: "fixed", price: 10000, isActive: true },
  { serviceCode: "dryer", displayName: "Dryer", pricingModel: "fixed", price: 10000, isActive: true },
  { serviceCode: "detergent", displayName: "Detergent", pricingModel: "fixed", price: 1000, isActive: true },
  { serviceCode: "softener", displayName: "Softener", pricingModel: "fixed", price: 1000, isActive: true },
  { serviceCode: "wash_dry_fold_package", displayName: "Paket Cuci Kering Lipat", pricingModel: "fixed", price: 35000, isActive: true },
  { serviceCode: "wash_dry_package", displayName: "Paket Cuci Kering", pricingModel: "fixed", price: 25000, isActive: true },
  { serviceCode: "ironing", displayName: "Setrika", pricingModel: "per_kg", price: 4500, isActive: true },
  { serviceCode: "ironing_only", displayName: "Setrika Saja", pricingModel: "per_kg", price: 5000, isActive: true },
  { serviceCode: "laundry_plastic", displayName: "Plastik Laundry", pricingModel: "fixed", price: 2000, isActive: true },
  { serviceCode: "laundry_plastic_large", displayName: "Plastik Laundry Besar", pricingModel: "fixed", price: 4000, isActive: true },
  { serviceCode: "laundry_hanger", displayName: "Gantungan Laundry", pricingModel: "fixed", price: 2000, isActive: true },
]

export const mockCustomerProfile: CustomerProfileVM = {
  customerId: "c1",
  name: "Siti Rahayu",
  phone: "+62 812-3456-7890",
  currentPoints: 45,
  activeOrderCount: 2,
  totalOrders: 28,
  lastActivityAt: "2 jam lalu",
}
