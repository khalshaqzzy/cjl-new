// Mock Data for CJ Laundry Public Frontend

// ==================== TYPES ====================

export type OrderStatus = 'Active' | 'Done' | 'Cancelled'

export interface LaundryInfo {
  name: string
  phone: string
  whatsapp: string
  address: string
  operatingHours: string
}

export interface ServiceItem {
  code: string
  name: string
  price: number
  priceModel: 'per_unit' | 'per_kg'
  description?: string
}

export interface PublicSummaryCardVM {
  id: string
  label: string
  value: string
  icon: string
}

export interface ActiveOrderVM {
  orderId: string
  orderCode: string
  status: OrderStatus
  createdAtLabel: string
  completedAtLabel?: string
  serviceSummary: string
  weightKgLabel: string
}

export interface OrderHistoryCardVM {
  orderId: string
  orderCode: string
  status: OrderStatus
  createdAtLabel: string
  completedAtLabel?: string
  serviceSummary: string
  weightKgLabel: string
  earnedStamps: number
  redeemedPoints: number
}

export interface StampBalanceVM {
  currentPoints: number
  eligibleFreeWashers: number
  lifetimeEarnedStamps: number
}

export interface PointLedgerItemVM {
  entryId: string
  label: string
  delta: number
  createdAtLabel: string
  relatedOrderCode?: string
  tone: 'earned' | 'redeemed' | 'adjustment' | 'reversal'
}

export interface RedemptionHistoryItemVM {
  entryId: string
  redeemedPoints: number
  freeWasherUnits: number
  createdAtLabel: string
  relatedOrderCode?: string
}

export interface LeaderboardRowVM {
  rank: number
  maskedAlias: string
  earnedStamps: number
  monthKey: string
}

export interface DirectOrderStatusVM {
  orderCode: string
  status: OrderStatus
  createdAtLabel: string
  completedAtLabel?: string
  cancelledAtLabel?: string
  cancellationSummary?: string
  serviceSummary: string
  weightKgLabel: string
  earnedStamps: number
  redeemedPoints: number
  laundryName: string
  laundryPhone: string
}

export interface CustomerSession {
  customerId: string
  name: string
  phone: string
}

export interface FAQItem {
  question: string
  answer: string
}

// ==================== MOCK DATA ====================

export const mockLaundryInfo: LaundryInfo = {
  name: 'CJ Laundry',
  phone: '0812-3456-7890',
  whatsapp: '6281234567890',
  address: 'Jl. Raya Sejahtera No. 123, Kelurahan Maju, Kecamatan Berkembang, Kota Indah 12345',
  operatingHours: 'Senin - Minggu, 07:00 - 22:00',
}

export const mockServices: ServiceItem[] = [
  {
    code: 'washer',
    name: 'Washer',
    price: 10000,
    priceModel: 'per_unit',
    description: 'Mesin cuci kapasitas besar',
  },
  {
    code: 'dryer',
    name: 'Dryer',
    price: 10000,
    priceModel: 'per_unit',
    description: 'Pengering cepat dan efisien',
  },
  {
    code: 'detergent',
    name: 'Detergent',
    price: 1000,
    priceModel: 'per_unit',
    description: 'Detergen premium berkualitas',
  },
  {
    code: 'softener',
    name: 'Softener',
    price: 1000,
    priceModel: 'per_unit',
    description: 'Pelembut pakaian wangi tahan lama',
  },
  {
    code: 'wash_dry_fold_package',
    name: 'Paket Cuci Kering Lipat',
    price: 35000,
    priceModel: 'per_unit',
    description: 'Layanan lengkap cuci, kering, dan lipat',
  },
  {
    code: 'ironing',
    name: 'Setrika',
    price: 4500,
    priceModel: 'per_kg',
    description: 'Setrika rapi profesional',
  },
]

export const mockCustomerSession: CustomerSession = {
  customerId: 'cust_001',
  name: 'Budi Santoso',
  phone: '081234567890',
}

export const mockStampBalance: StampBalanceVM = {
  currentPoints: 24,
  eligibleFreeWashers: 2,
  lifetimeEarnedStamps: 156,
}

export const mockSummaryCards: PublicSummaryCardVM[] = [
  {
    id: '1',
    label: 'Order Aktif',
    value: '2',
    icon: 'clock',
  },
  {
    id: '2',
    label: 'Selesai Bulan Ini',
    value: '8',
    icon: 'check',
  },
  {
    id: '3',
    label: 'Total Berat',
    value: '45.5 kg',
    icon: 'weight',
  },
  {
    id: '4',
    label: 'Stamp Diperoleh',
    value: '12',
    icon: 'star',
  },
]

export const mockActiveOrders: ActiveOrderVM[] = [
  {
    orderId: 'ord_001',
    orderCode: 'CJ-20260321-001',
    status: 'Active',
    createdAtLabel: '21 Mar 2026, 09:30',
    serviceSummary: '2x Washer, 1x Dryer, Detergent',
    weightKgLabel: '5.5 kg',
  },
  {
    orderId: 'ord_002',
    orderCode: 'CJ-20260320-015',
    status: 'Active',
    createdAtLabel: '20 Mar 2026, 14:45',
    serviceSummary: '1x Paket Cuci Kering Lipat',
    weightKgLabel: '3.2 kg',
  },
]

export const mockOrderHistory: OrderHistoryCardVM[] = [
  {
    orderId: 'ord_001',
    orderCode: 'CJ-20260321-001',
    status: 'Active',
    createdAtLabel: '21 Mar 2026, 09:30',
    serviceSummary: '2x Washer, 1x Dryer, Detergent',
    weightKgLabel: '5.5 kg',
    earnedStamps: 3,
    redeemedPoints: 0,
  },
  {
    orderId: 'ord_002',
    orderCode: 'CJ-20260320-015',
    status: 'Active',
    createdAtLabel: '20 Mar 2026, 14:45',
    serviceSummary: '1x Paket Cuci Kering Lipat',
    weightKgLabel: '3.2 kg',
    earnedStamps: 1,
    redeemedPoints: 0,
  },
  {
    orderId: 'ord_003',
    orderCode: 'CJ-20260318-008',
    status: 'Done',
    createdAtLabel: '18 Mar 2026, 10:15',
    completedAtLabel: '18 Mar 2026, 11:20',
    serviceSummary: '1x Washer, 1x Dryer, Softener',
    weightKgLabel: '4.0 kg',
    earnedStamps: 2,
    redeemedPoints: 0,
  },
  {
    orderId: 'ord_004',
    orderCode: 'CJ-20260315-022',
    status: 'Done',
    createdAtLabel: '15 Mar 2026, 16:30',
    completedAtLabel: '15 Mar 2026, 17:35',
    serviceSummary: '3x Washer, 2x Dryer, Setrika',
    weightKgLabel: '8.5 kg',
    earnedStamps: 5,
    redeemedPoints: 10,
  },
  {
    orderId: 'ord_005',
    orderCode: 'CJ-20260312-011',
    status: 'Done',
    createdAtLabel: '12 Mar 2026, 08:45',
    completedAtLabel: '12 Mar 2026, 09:50',
    serviceSummary: '1x Paket Cuci Kering Lipat, Setrika',
    weightKgLabel: '6.0 kg',
    earnedStamps: 2,
    redeemedPoints: 0,
  },
  {
    orderId: 'ord_006',
    orderCode: 'CJ-20260310-005',
    status: 'Cancelled',
    createdAtLabel: '10 Mar 2026, 11:00',
    serviceSummary: '2x Washer, 1x Dryer',
    weightKgLabel: '4.5 kg',
    earnedStamps: 0,
    redeemedPoints: 0,
  },
  {
    orderId: 'ord_007',
    orderCode: 'CJ-20260308-019',
    status: 'Done',
    createdAtLabel: '08 Mar 2026, 13:20',
    completedAtLabel: '08 Mar 2026, 14:25',
    serviceSummary: '2x Washer, 2x Dryer, Detergent, Softener',
    weightKgLabel: '7.0 kg',
    earnedStamps: 4,
    redeemedPoints: 0,
  },
]

export const mockPointLedger: PointLedgerItemVM[] = [
  {
    entryId: 'ledger_001',
    label: 'Stamp dari order',
    delta: 3,
    createdAtLabel: '21 Mar 2026, 09:30',
    relatedOrderCode: 'CJ-20260321-001',
    tone: 'earned',
  },
  {
    entryId: 'ledger_002',
    label: 'Stamp dari order',
    delta: 1,
    createdAtLabel: '20 Mar 2026, 14:45',
    relatedOrderCode: 'CJ-20260320-015',
    tone: 'earned',
  },
  {
    entryId: 'ledger_003',
    label: 'Stamp dari order',
    delta: 2,
    createdAtLabel: '18 Mar 2026, 10:15',
    relatedOrderCode: 'CJ-20260318-008',
    tone: 'earned',
  },
  {
    entryId: 'ledger_004',
    label: 'Penukaran stamp',
    delta: -10,
    createdAtLabel: '15 Mar 2026, 16:30',
    relatedOrderCode: 'CJ-20260315-022',
    tone: 'redeemed',
  },
  {
    entryId: 'ledger_005',
    label: 'Stamp dari order',
    delta: 5,
    createdAtLabel: '15 Mar 2026, 16:30',
    relatedOrderCode: 'CJ-20260315-022',
    tone: 'earned',
  },
  {
    entryId: 'ledger_006',
    label: 'Bonus dari admin',
    delta: 5,
    createdAtLabel: '14 Mar 2026, 10:00',
    tone: 'adjustment',
  },
  {
    entryId: 'ledger_007',
    label: 'Stamp dari order',
    delta: 2,
    createdAtLabel: '12 Mar 2026, 08:45',
    relatedOrderCode: 'CJ-20260312-011',
    tone: 'earned',
  },
  {
    entryId: 'ledger_008',
    label: 'Pembatalan order',
    delta: 0,
    createdAtLabel: '10 Mar 2026, 11:30',
    relatedOrderCode: 'CJ-20260310-005',
    tone: 'reversal',
  },
]

export const mockRedemptionHistory: RedemptionHistoryItemVM[] = [
  {
    entryId: 'redeem_001',
    redeemedPoints: 10,
    freeWasherUnits: 1,
    createdAtLabel: '15 Mar 2026, 16:30',
    relatedOrderCode: 'CJ-20260315-022',
  },
  {
    entryId: 'redeem_002',
    redeemedPoints: 20,
    freeWasherUnits: 2,
    createdAtLabel: '25 Feb 2026, 11:00',
    relatedOrderCode: 'CJ-20260225-007',
  },
  {
    entryId: 'redeem_003',
    redeemedPoints: 10,
    freeWasherUnits: 1,
    createdAtLabel: '10 Feb 2026, 09:15',
    relatedOrderCode: 'CJ-20260210-003',
  },
]

export const mockLeaderboardCurrent: LeaderboardRowVM[] = [
  { rank: 1, maskedAlias: 'An***ra', earnedStamps: 48, monthKey: '2026-03' },
  { rank: 2, maskedAlias: 'Bu***di', earnedStamps: 42, monthKey: '2026-03' },
  { rank: 3, maskedAlias: 'Ci***ta', earnedStamps: 38, monthKey: '2026-03' },
  { rank: 4, maskedAlias: 'De***wi', earnedStamps: 35, monthKey: '2026-03' },
  { rank: 5, maskedAlias: 'Ek***ko', earnedStamps: 32, monthKey: '2026-03' },
  { rank: 6, maskedAlias: 'Fa***ri', earnedStamps: 30, monthKey: '2026-03' },
  { rank: 7, maskedAlias: 'Gi***ta', earnedStamps: 28, monthKey: '2026-03' },
  { rank: 8, maskedAlias: 'Ha***di', earnedStamps: 26, monthKey: '2026-03' },
  { rank: 9, maskedAlias: 'In***ra', earnedStamps: 24, monthKey: '2026-03' },
  { rank: 10, maskedAlias: 'Ja***ti', earnedStamps: 22, monthKey: '2026-03' },
  { rank: 11, maskedAlias: 'Ka***la', earnedStamps: 20, monthKey: '2026-03' },
  { rank: 12, maskedAlias: 'Li***na', earnedStamps: 18, monthKey: '2026-03' },
  { rank: 13, maskedAlias: 'Ma***ya', earnedStamps: 17, monthKey: '2026-03' },
  { rank: 14, maskedAlias: 'Nu***ri', earnedStamps: 16, monthKey: '2026-03' },
  { rank: 15, maskedAlias: 'Ok***to', earnedStamps: 15, monthKey: '2026-03' },
]

export const mockLeaderboardArchive: Record<string, LeaderboardRowVM[]> = {
  '2026-02': [
    { rank: 1, maskedAlias: 'Ri***na', earnedStamps: 52, monthKey: '2026-02' },
    { rank: 2, maskedAlias: 'Bu***di', earnedStamps: 45, monthKey: '2026-02' },
    { rank: 3, maskedAlias: 'An***ra', earnedStamps: 40, monthKey: '2026-02' },
    { rank: 4, maskedAlias: 'Su***to', earnedStamps: 38, monthKey: '2026-02' },
    { rank: 5, maskedAlias: 'Wi***ni', earnedStamps: 35, monthKey: '2026-02' },
    { rank: 6, maskedAlias: 'Fa***ri', earnedStamps: 33, monthKey: '2026-02' },
    { rank: 7, maskedAlias: 'De***wi', earnedStamps: 30, monthKey: '2026-02' },
    { rank: 8, maskedAlias: 'Ek***ko', earnedStamps: 28, monthKey: '2026-02' },
    { rank: 9, maskedAlias: 'Ha***di', earnedStamps: 25, monthKey: '2026-02' },
    { rank: 10, maskedAlias: 'In***ra', earnedStamps: 22, monthKey: '2026-02' },
  ],
  '2026-01': [
    { rank: 1, maskedAlias: 'Su***to', earnedStamps: 58, monthKey: '2026-01' },
    { rank: 2, maskedAlias: 'Ri***na', earnedStamps: 50, monthKey: '2026-01' },
    { rank: 3, maskedAlias: 'Bu***di', earnedStamps: 48, monthKey: '2026-01' },
    { rank: 4, maskedAlias: 'An***ra', earnedStamps: 42, monthKey: '2026-01' },
    { rank: 5, maskedAlias: 'Wi***ni', earnedStamps: 40, monthKey: '2026-01' },
    { rank: 6, maskedAlias: 'Ci***ta', earnedStamps: 36, monthKey: '2026-01' },
    { rank: 7, maskedAlias: 'Fa***ri', earnedStamps: 32, monthKey: '2026-01' },
    { rank: 8, maskedAlias: 'De***wi', earnedStamps: 28, monthKey: '2026-01' },
    { rank: 9, maskedAlias: 'Gi***ta', earnedStamps: 26, monthKey: '2026-01' },
    { rank: 10, maskedAlias: 'Ha***di', earnedStamps: 24, monthKey: '2026-01' },
  ],
}

export const mockDirectOrderStatus: DirectOrderStatusVM = {
  orderCode: 'CJ-20260321-001',
  status: 'Active',
  createdAtLabel: '21 Mar 2026, 09:30',
  serviceSummary: '2x Washer, 1x Dryer, Detergent',
  weightKgLabel: '5.5 kg',
  earnedStamps: 3,
  redeemedPoints: 0,
  laundryName: 'CJ Laundry',
  laundryPhone: '0812-3456-7890',
}

export const mockFAQs: FAQItem[] = [
  {
    question: 'Bagaimana cara login ke portal pelanggan?',
    answer: 'Anda dapat login menggunakan nomor HP dan nama yang terdaftar saat pertama kali melakukan transaksi di CJ Laundry. Tidak perlu password atau OTP.',
  },
  {
    question: 'Bagaimana cara kerja sistem stamp?',
    answer: 'Setiap transaksi yang memenuhi syarat akan otomatis mendapatkan stamp. Kumpulkan 10 stamp untuk mendapatkan 1 gratis cuci (Washer). Stamp akan bertambah saat order dikonfirmasi.',
  },
  {
    question: 'Apa saja yang bisa saya lihat di portal pelanggan?',
    answer: 'Di portal pelanggan, Anda dapat melihat status order aktif, riwayat order, jumlah stamp yang terkumpul, riwayat penukaran stamp, dan leaderboard pelanggan.',
  },
  {
    question: 'Apakah link status order aman?',
    answer: 'Ya, setiap link status order hanya menampilkan informasi satu order tersebut. Link tidak memberikan akses ke data pelanggan lain atau riwayat order lainnya.',
  },
  {
    question: 'Bagaimana jika saya lupa nomor HP yang terdaftar?',
    answer: 'Silakan hubungi kami melalui WhatsApp untuk verifikasi identitas dan bantuan akses akun Anda.',
  },
  {
    question: 'Berapa lama proses laundry self service?',
    answer: 'Rata-rata proses cuci dan kering membutuhkan waktu sekitar 1 jam. Waktu dapat bervariasi tergantung jumlah pakaian dan layanan yang dipilih.',
  },
]

// Available months for leaderboard archive
export const availableMonths = [
  { key: '2026-03', label: 'Maret 2026', isCurrent: true },
  { key: '2026-02', label: 'Februari 2026', isCurrent: false },
  { key: '2026-01', label: 'Januari 2026', isCurrent: false },
]

// Helper function to format currency
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

// Helper function to get status color class
export function getStatusColor(status: OrderStatus): string {
  switch (status) {
    case 'Active':
      return 'bg-info/10 text-info'
    case 'Done':
      return 'bg-success/10 text-success'
    case 'Cancelled':
      return 'bg-danger/10 text-danger'
    default:
      return 'bg-muted text-muted-foreground'
  }
}

// Helper function to get status label in Indonesian
export function getStatusLabel(status: OrderStatus): string {
  switch (status) {
    case 'Active':
      return 'Aktif'
    case 'Done':
      return 'Selesai'
    case 'Cancelled':
      return 'Dibatalkan'
    default:
      return status
  }
}
