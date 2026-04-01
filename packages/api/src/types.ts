import type {
  AdminWhatsappContact,
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationRenderStatus,
  ServiceCode,
  ServiceSetting,
  WhatsappComposerMode,
  WhatsappConnectionState,
  WhatsappMessageSource,
  WhatsappPairingMethod,
  WhatsappProviderKind,
  WhatsappProviderStatus,
  WhatsappMessageDirection
} from "@cjl/contracts"

export type CustomerDocument = {
  _id: string
  name: string
  normalizedName: string
  phone: string
  normalizedPhone: string
  phoneDigits: string
  publicNameVisible: boolean
  currentPoints: number
  createdAt: string
  updatedAt: string
}

export type OrderReceiptSnapshotDocument = {
  orderCode: string
  customerName: string
  serviceSummary: string
  totalLabel: string
  createdAtLabel: string
  laundryName: string
  laundryPhone: string
}

export type OrderItemDocument = {
  serviceCode: ServiceCode
  serviceLabel: string
  quantity: number
  unitPrice: number
  pricingModel: "fixed" | "per_kg"
  lineTotal: number
}

export type OrderDocument = {
  _id: string
  orderCode: string
  customerId: string
  customerName: string
  customerPhone: string
  weightKg: number
  items: OrderItemDocument[]
  subtotal: number
  discount: number
  total: number
  redeemedPoints: number
  earnedStamps: number
  resultingPointBalance: number
  directToken?: string
  receiptSnapshot: OrderReceiptSnapshotDocument
  status: "Active" | "Done" | "Voided"
  createdAt: string
  activityAt: string
  completedAt?: string
  voidedAt?: string
  voidReason?: string
}

export type PointLedgerDocument = {
  _id: string
  customerId: string
  orderId?: string
  orderCode?: string
  label: string
  delta: number
  balanceAfter: number
  tone: "earned" | "redeemed" | "adjustment" | "reversal"
  leaderboardDelta: number
  createdAt: string
}

export type NotificationDocument = {
  _id: string
  customerId?: string
  customerName: string
  destinationPhone: string
  orderId?: string
  orderCode?: string
  eventType: NotificationEventType
  renderStatus?: NotificationRenderStatus
  deliveryStatus: NotificationDeliveryStatus
  latestFailureReason?: string
  attemptCount: number
  lastAttemptAt?: string
  preparedMessage: string
  manualResolutionNote?: string
  manualResolvedAt?: string
  ignoredNote?: string
  ignoredAt?: string
  renderedReceipt?: string
  templateParams?: Record<string, string>
  providerKind?: WhatsappProviderKind
  providerMessageId?: string
  providerStatus?: WhatsappProviderStatus
  providerStatusAt?: string
  waId?: string
  pricingType?: string
  pricingCategory?: string
  latestErrorCode?: string
  latestErrorMessage?: string
  providerChatId?: string
  providerAck?: number
  sentAt?: string
  gatewayErrorCode?: string
  businessKey: string
  createdAt: string
  updatedAt: string
}

export type WhatsappSessionDocument = {
  _id: "primary"
  state: WhatsappConnectionState
  provider: "disabled" | "cloud_api"
  configured: boolean
  enabled: boolean
  summary: string
  businessId?: string
  wabaId?: string
  phoneNumberId?: string
  currentPhone?: string
  wid?: string
  profileName?: string
  pairingMethod?: WhatsappPairingMethod
  updatedAt: string
}

export type WhatsappChatDocument = {
  _id: string
  title: string
  waId?: string
  displayName?: string
  phone?: string
  customerId?: string
  customerName?: string
  unreadCount: number
  lastMessagePreview: string
  lastMessageDirection?: WhatsappMessageDirection
  lastMessageAt?: string
  lastInboundAt?: string
  cswOpenedAt?: string
  cswExpiresAt?: string
  fepOpenedAt?: string
  fepExpiresAt?: string
  composerMode: WhatsappComposerMode
  updatedAt: string
}

export type WhatsappMessageDocument = {
  _id: string
  chatId: string
  providerKind?: WhatsappProviderKind
  waId?: string
  phone?: string
  customerId?: string
  customerName?: string
  direction: WhatsappMessageDirection
  messageType: string
  body?: string
  caption?: string
  textPreview: string
  timestampIso: string
  providerStatus?: WhatsappProviderStatus
  providerStatusAt?: string
  pricingType?: string
  pricingCategory?: string
  latestErrorCode?: string
  latestErrorMessage?: string
  source?: WhatsappMessageSource
  providerAck?: number
  hasMedia: boolean
  mediaMimeType?: string
  mediaName?: string
  notificationId?: string
  orderCode?: string
  createdAt: string
  updatedAt: string
}

export type SettingsDocument = {
  _id: "app-settings"
  business: {
    laundryName: string
    laundryPhone: string
    publicContactPhone: string
    publicWhatsapp: string
    adminWhatsappContacts: AdminWhatsappContact[]
    address: string
    operatingHours: string
  }
  services: ServiceSetting[]
  updatedAt: string
}

export type AuditLogDocument = {
  _id: string
  actorType: "admin" | "customer" | "system" | "anonymous"
  actorId: string
  actorSource: "http" | "session" | "system"
  action: string
  entityType: string
  entityId: string
  outcome: "success" | "failure"
  requestId?: string
  origin?: string
  ipHash?: string
  userAgent?: string
  metadata?: Record<string, unknown>
  createdAt: string
}

export type LeaderboardSnapshotDocument = {
  _id: string
  monthKey: string
  version: number
  rows: Array<{
    rank: number
    customerId: string
    maskedAlias: string
    earnedStamps: number
  }>
  reason: string
  createdAt: string
}

export type IdempotencyKeyDocument = {
  _id?: string
  scope: string
  key: string
  fingerprint: string
  status: "in_progress" | "completed"
  response?: unknown
  createdAt: string
  updatedAt: string
}

export type AdminDocument = {
  _id: string
  username: string
  passwordHash: string
  createdAt: string
}

export type CustomerMagicLinkDocument = {
  _id: string
  tokenHash: string
  tokenLast4: string
  token?: string
  customerId: string
  source: "registration_welcome" | "admin_regenerated"
  createdAt: string
  usedAt?: string
  revokedAt?: string
  revokedReason?: string
}

export type DirectOrderTokenDocument = {
  _id: string
  tokenHash: string
  tokenLast4: string
  token?: string
  orderId: string
  revokedAt?: string
  revokedReason?: string
  createdAt: string
}

export type RateLimitDocument = {
  _id: string
  totalHits: number
  resetTime: Date
}

export type CounterDocument = {
  _id: string
  sequence: number
}
