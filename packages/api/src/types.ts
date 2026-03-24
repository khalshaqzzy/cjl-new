import type {
  NotificationDeliveryStatus,
  NotificationEventType,
  NotificationRenderStatus,
  ServiceCode,
  ServiceSetting,
  WhatsappConnectionState,
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
  directToken: string
  receiptSnapshot: OrderReceiptSnapshotDocument
  status: "Active" | "Done" | "Voided"
  createdAt: string
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
  renderedReceipt?: string
  providerMessageId?: string
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
  connected: boolean
  currentPhone?: string
  wid?: string
  profileName?: string
  lastReadyAt?: string
  lastDisconnectAt?: string
  lastDisconnectReason?: string
  lastAuthFailureAt?: string
  lastAuthFailureReason?: string
  updatedAt: string
}

export type WhatsappChatDocument = {
  _id: string
  title: string
  phone?: string
  customerId?: string
  customerName?: string
  unreadCount: number
  lastMessagePreview: string
  lastMessageDirection?: WhatsappMessageDirection
  lastMessageAt?: string
  updatedAt: string
}

export type WhatsappMessageDocument = {
  _id: string
  chatId: string
  phone?: string
  customerId?: string
  customerName?: string
  direction: WhatsappMessageDirection
  messageType: string
  body?: string
  caption?: string
  textPreview: string
  timestampIso: string
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
    address: string
    operatingHours: string
  }
  services: ServiceSetting[]
  messageTemplates: {
    welcome: string
    orderConfirmed: string
    orderDone: string
    orderVoidNotice: string
    accountInfo: string
  }
  updatedAt: string
}

export type AuditLogDocument = {
  _id: string
  actorType: "admin" | "system"
  actorId: string
  action: string
  entityType: string
  entityId: string
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

export type DirectOrderTokenDocument = {
  _id: string
  token: string
  orderId: string
  revokedAt?: string
  revokedReason?: string
  createdAt: string
}

export type CounterDocument = {
  _id: string
  sequence: number
}
