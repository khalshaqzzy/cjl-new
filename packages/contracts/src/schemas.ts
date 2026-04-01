import { z } from "zod"

export const serviceCodeSchema = z.enum([
  "washer",
  "dryer",
  "detergent",
  "softener",
  "wash_dry_fold_package",
  "ironing",
  "ironing_only",
  "laundry_plastic",
])

export const pricingModelSchema = z.enum(["fixed", "per_kg"])
export const dashboardWindowSchema = z.enum(["daily", "weekly", "monthly"])
export const orderStatusSchema = z.enum(["Active", "Done", "Voided"])
export const publicOrderStatusSchema = z.enum(["Active", "Done", "Cancelled"])
export const notificationEventTypeSchema = z.enum([
  "welcome",
  "order_confirmed",
  "order_done",
  "order_void_notice",
  "account_info",
])
export const notificationDeliveryStatusSchema = z.enum([
  "queued",
  "sent",
  "failed",
  "manual_resolved",
  "ignored",
])
export const adminLaundryStatusSchema = z.enum(["Active", "Done", "Cancelled"])
export const adminLaundryScopeSchema = z.enum(["active", "today", "history"])
export const adminLaundrySortSchema = z.enum(["oldest", "newest"])
export const notificationRenderStatusSchema = z.enum([
  "not_required",
  "pending",
  "ready",
  "failed",
])
export const whatsappProviderSchema = z.enum(["disabled", "cloud_api"])
export const whatsappProviderHealthStateSchema = z.enum([
  "disabled",
  "ready",
  "misconfigured",
  "degraded",
])
export const whatsappProviderKindSchema = z.enum([
  "cloud_api",
  "webjs_legacy",
  "simulated",
])
export const whatsappProviderStatusSchema = z.enum([
  "accepted",
  "sent",
  "delivered",
  "read",
  "failed",
])
export const pointLedgerToneSchema = z.enum([
  "earned",
  "redeemed",
  "adjustment",
  "reversal",
])
export const whatsappConnectionStateSchema = whatsappProviderHealthStateSchema
export const whatsappPairingMethodSchema = z.enum(["qr", "code"])
export const whatsappMessageDirectionSchema = z.enum(["inbound", "outbound"])
export const whatsappComposerModeSchema = z.enum(["free_form", "template_only", "read_only"])
export const whatsappMessageSourceSchema = z.enum([
  "automated_notification",
  "manual_operator",
  "inbound_customer",
  "legacy_mirror",
])

export const serviceSettingSchema = z.object({
  serviceCode: serviceCodeSchema,
  displayName: z.string(),
  pricingModel: pricingModelSchema,
  price: z.number().int().nonnegative(),
  isActive: z.boolean(),
  publicDescription: z.string().optional(),
})

export const adminWhatsappContactSchema = z.object({
  id: z.string(),
  phone: z.string().min(1),
  isPrimary: z.boolean(),
})

export const businessProfileSchema = z.object({
  laundryName: z.string(),
  laundryPhone: z.string(),
  publicContactPhone: z.string(),
  publicWhatsapp: z.string(),
  adminWhatsappContacts: z.array(adminWhatsappContactSchema),
  address: z.string(),
  operatingHours: z.string(),
})

export const settingsResponseSchema = z.object({
  business: businessProfileSchema,
  services: z.array(serviceSettingSchema),
}).strict()

export const customerSearchResultSchema = z.object({
  customerId: z.string(),
  name: z.string(),
  phone: z.string(),
  currentPoints: z.number().int(),
  activeOrderCount: z.number().int(),
  recentActivityAt: z.string().optional(),
  createdAtIso: z.string(),
  lastActivityAtIso: z.string().optional(),
})

export const customerProfileSchema = z.object({
  customerId: z.string(),
  name: z.string(),
  phone: z.string(),
  currentPoints: z.number().int(),
  publicNameVisible: z.boolean(),
  activeOrderCount: z.number().int(),
  totalOrders: z.number().int(),
  lastActivityAt: z.string().optional(),
})

export const oneTimeLoginSchema = z.object({
  url: z.string().min(1),
})

export const createCustomerResponseSchema = z.object({
  customer: customerSearchResultSchema,
  duplicate: z.boolean(),
  oneTimeLogin: oneTimeLoginSchema.optional(),
})

export const customerMagicLinkResponseSchema = z.object({
  oneTimeLogin: oneTimeLoginSchema,
})

export const orderLinePreviewSchema = z.object({
  serviceCode: serviceCodeSchema,
  serviceLabel: z.string(),
  quantity: z.number(),
  quantityLabel: z.string(),
  unitPrice: z.number().int().nonnegative(),
  unitPriceLabel: z.string(),
  lineTotal: z.number().int().nonnegative(),
  lineTotalLabel: z.string(),
})

export const orderPreviewResponseSchema = z.object({
  customerName: z.string(),
  weightKg: z.number(),
  subtotal: z.number().int(),
  subtotalLabel: z.string(),
  discount: z.number().int(),
  discountLabel: z.string(),
  total: z.number().int(),
  totalLabel: z.string(),
  earnedStamps: z.number().int(),
  redeemedPoints: z.number().int(),
  resultingPointBalance: z.number().int(),
  maxRedeemableWashers: z.number().int(),
  items: z.array(orderLinePreviewSchema),
})

export const activeOrderCardSchema = z.object({
  orderId: z.string(),
  orderCode: z.string(),
  customerName: z.string(),
  phone: z.string(),
  createdAtLabel: z.string(),
  createdAtIso: z.string(),
  weightKgLabel: z.string(),
  serviceSummary: z.string(),
  earnedStamps: z.number().int(),
  redeemedPoints: z.number().int(),
  status: z.literal("Active"),
})

export const adminLaundryOrderSchema = z.object({
  orderId: z.string(),
  orderCode: z.string(),
  customerName: z.string(),
  phone: z.string(),
  createdAtLabel: z.string(),
  createdAtIso: z.string(),
  completedAtLabel: z.string().optional(),
  completedAtIso: z.string().optional(),
  cancelledAtLabel: z.string().optional(),
  cancelledAtIso: z.string().optional(),
  weightKgLabel: z.string(),
  serviceSummary: z.string(),
  totalLabel: z.string(),
  earnedStamps: z.number().int(),
  redeemedPoints: z.number().int(),
  status: adminLaundryStatusSchema,
})

export const adminLaundryListResponseSchema = z.object({
  items: z.array(adminLaundryOrderSchema),
  nextCursor: z.string().optional(),
})

export const orderHistoryItemSchema = z.object({
  orderId: z.string(),
  orderCode: z.string(),
  createdAtLabel: z.string(),
  completedAtLabel: z.string().optional(),
  cancelledAtLabel: z.string().optional(),
  cancellationSummary: z.string().optional(),
  weightKgLabel: z.string(),
  serviceSummary: z.string(),
  totalLabel: z.string().optional(),
  earnedStamps: z.number().int(),
  redeemedPoints: z.number().int(),
  status: publicOrderStatusSchema,
})

export const pointLedgerItemSchema = z.object({
  entryId: z.string(),
  label: z.string(),
  delta: z.number().int(),
  balanceAfter: z.number().int().optional(),
  createdAtLabel: z.string(),
  tone: pointLedgerToneSchema,
  relatedOrderCode: z.string().optional(),
})

export const notificationRecordSchema = z.object({
  notificationId: z.string(),
  eventType: notificationEventTypeSchema,
  customerName: z.string(),
  destinationPhone: z.string(),
  orderCode: z.string().optional(),
  createdAtLabel: z.string(),
  renderStatus: notificationRenderStatusSchema.optional(),
  deliveryStatus: notificationDeliveryStatusSchema,
  latestFailureReason: z.string().optional(),
  attemptCount: z.number().int(),
  lastAttemptAt: z.string().optional(),
  preparedMessage: z.string(),
  manualResolutionNote: z.string().optional(),
  manualResolvedAt: z.string().optional(),
  ignoredNote: z.string().optional(),
  ignoredAt: z.string().optional(),
  receiptAvailable: z.boolean(),
  manualWhatsappAvailable: z.boolean(),
  providerKind: whatsappProviderKindSchema.optional(),
  providerMessageId: z.string().optional(),
  providerStatus: whatsappProviderStatusSchema.optional(),
  providerStatusAt: z.string().optional(),
  waId: z.string().optional(),
  pricingType: z.string().optional(),
  pricingCategory: z.string().optional(),
  latestErrorCode: z.string().optional(),
  latestErrorMessage: z.string().optional(),
  providerChatId: z.string().optional(),
  providerAck: z.number().int().nonnegative().optional(),
  sentAt: z.string().optional(),
  gatewayErrorCode: z.string().optional(),
})

export const whatsappConnectionStatusSchema = z.object({
  provider: whatsappProviderSchema,
  state: whatsappConnectionStateSchema,
  configured: z.boolean(),
  enabled: z.boolean(),
  businessId: z.string().optional(),
  wabaId: z.string().optional(),
  phoneNumberId: z.string().optional(),
  currentPhone: z.string().optional(),
  webhookPath: z.string().optional(),
  summary: z.string(),
  observedAt: z.string().optional(),
})

export const whatsappChatSummarySchema = z.object({
  chatId: z.string(),
  title: z.string(),
  waId: z.string().optional(),
  displayName: z.string().optional(),
  phone: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
  unreadCount: z.number().int(),
  lastMessagePreview: z.string(),
  lastMessageDirection: whatsappMessageDirectionSchema.optional(),
  lastMessageAtIso: z.string().optional(),
  lastMessageAtLabel: z.string().optional(),
  isCswOpen: z.boolean(),
  cswExpiresAtIso: z.string().optional(),
  cswExpiresAtLabel: z.string().optional(),
  isFepOpen: z.boolean(),
  fepExpiresAtIso: z.string().optional(),
  fepExpiresAtLabel: z.string().optional(),
  composerMode: whatsappComposerModeSchema,
})

export const whatsappMessageItemSchema = z.object({
  providerMessageId: z.string(),
  chatId: z.string(),
  providerKind: whatsappProviderKindSchema.optional(),
  waId: z.string().optional(),
  direction: whatsappMessageDirectionSchema,
  messageType: z.string(),
  body: z.string().optional(),
  caption: z.string().optional(),
  textPreview: z.string(),
  timestampIso: z.string(),
  timestampLabel: z.string(),
  providerStatus: whatsappProviderStatusSchema.optional(),
  providerStatusAtIso: z.string().optional(),
  providerStatusAtLabel: z.string().optional(),
  pricingType: z.string().optional(),
  pricingCategory: z.string().optional(),
  latestErrorCode: z.string().optional(),
  latestErrorMessage: z.string().optional(),
  source: whatsappMessageSourceSchema.optional(),
  providerAck: z.number().int().nonnegative().optional(),
  hasMedia: z.boolean(),
  mediaMimeType: z.string().optional(),
  mediaName: z.string().optional(),
  notificationId: z.string().optional(),
  orderCode: z.string().optional(),
  customerId: z.string().optional(),
  customerName: z.string().optional(),
})

export const whatsappInternalSessionStateChangedEventSchema = z.object({
  type: z.literal("session_state_changed"),
  state: z.enum([
    "disabled",
    "initializing",
    "pairing",
    "authenticated",
    "connected",
    "disconnected",
    "auth_failure",
  ]),
  connected: z.boolean(),
  wid: z.string().optional(),
  currentPhone: z.string().optional(),
  profileName: z.string().optional(),
  lastDisconnectReason: z.string().optional(),
  lastAuthFailureReason: z.string().optional(),
  pairingMethod: whatsappPairingMethodSchema.optional(),
  observedAt: z.string(),
})

export const whatsappInternalMessageUpsertedEventSchema = z.object({
  type: z.literal("message_upserted"),
  providerMessageId: z.string(),
  chatId: z.string(),
  waId: z.string().optional(),
  direction: whatsappMessageDirectionSchema,
  messageType: z.string(),
  body: z.string().optional(),
  caption: z.string().optional(),
  timestampIso: z.string(),
  phone: z.string().optional(),
  displayName: z.string().optional(),
  providerKind: whatsappProviderKindSchema.optional(),
  providerStatus: whatsappProviderStatusSchema.optional(),
  providerStatusAt: z.string().optional(),
  pricingType: z.string().optional(),
  pricingCategory: z.string().optional(),
  latestErrorCode: z.string().optional(),
  latestErrorMessage: z.string().optional(),
  source: whatsappMessageSourceSchema.optional(),
  providerAck: z.number().int().nonnegative().optional(),
  hasMedia: z.boolean().default(false),
  mediaMimeType: z.string().optional(),
  mediaName: z.string().optional(),
  notificationId: z.string().optional(),
  orderCode: z.string().optional(),
})

export const whatsappInternalMessageAckChangedEventSchema = z.object({
  type: z.literal("message_ack_changed"),
  providerMessageId: z.string(),
  providerAck: z.number().int().nonnegative(),
  observedAt: z.string(),
})

export const whatsappInternalEventSchema = z.discriminatedUnion("type", [
  whatsappInternalSessionStateChangedEventSchema,
  whatsappInternalMessageUpsertedEventSchema,
  whatsappInternalMessageAckChangedEventSchema,
])

export const leaderboardRowSchema = z.object({
  rank: z.number().int(),
  displayName: z.string(),
  isMasked: z.boolean(),
  earnedStamps: z.number().int(),
  monthKey: z.string(),
})

export const monthlySummarySchema = z.object({
  monthKey: z.string(),
  totalOrdersCreated: z.number().int(),
  totalCompletedOrders: z.number().int(),
  activeOrdersOpen: z.number().int(),
  totalWeightProcessedLabel: z.string(),
  totalEarnedStamps: z.number().int(),
  totalRedeemedPoints: z.number().int(),
  freeWasherUnitsUsed: z.number().int(),
})

export const publicDashboardResponseSchema = z.object({
  session: z.object({
    customerId: z.string(),
    name: z.string(),
    phone: z.string(),
    publicNameVisible: z.boolean(),
  }),
  adminWhatsappContacts: z.array(adminWhatsappContactSchema),
  stampBalance: z.object({
    currentPoints: z.number().int(),
    eligibleFreeWashers: z.number().int(),
    lifetimeEarnedStamps: z.number().int(),
  }),
  summaryCards: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      icon: z.string(),
    }),
  ),
  activeOrders: z.array(
    z.object({
      orderId: z.string(),
      orderCode: z.string(),
      status: publicOrderStatusSchema,
      createdAtLabel: z.string(),
      completedAtLabel: z.string().optional(),
      serviceSummary: z.string(),
      weightKgLabel: z.string(),
    }),
  ),
  monthlySummary: monthlySummarySchema,
})

export const landingResponseSchema = z.object({
  laundryInfo: z.object({
    name: z.string(),
    phone: z.string(),
    whatsapp: z.string(),
    address: z.string(),
    operatingHours: z.string(),
  }),
  services: z.array(
    z.object({
      code: serviceCodeSchema,
      name: z.string(),
      price: z.number().int(),
      priceModel: z.enum(["per_unit", "per_kg"]),
      description: z.string().optional(),
    }),
  ),
  faqs: z.array(
    z.object({
      question: z.string(),
      answer: z.string(),
    }),
  ),
  leaderboardTeaser: z.array(leaderboardRowSchema),
})

export const directOrderStatusSchema = z.object({
  orderCode: z.string(),
  status: publicOrderStatusSchema,
  createdAtLabel: z.string(),
  completedAtLabel: z.string().optional(),
  cancelledAtLabel: z.string().optional(),
  cancellationSummary: z.string().optional(),
  serviceSummary: z.string(),
  weightKgLabel: z.string(),
  earnedStamps: z.number().int(),
  redeemedPoints: z.number().int(),
  laundryName: z.string(),
  laundryPhone: z.string(),
})

export const customerOrderDetailItemSchema = z.object({
  serviceCode: serviceCodeSchema,
  serviceLabel: z.string(),
  quantity: z.number(),
  quantityLabel: z.string(),
  unitPrice: z.number().int().nonnegative(),
  unitPriceLabel: z.string(),
  lineTotal: z.number().int().nonnegative(),
  lineTotalLabel: z.string(),
})

export const customerOrderDetailSchema = z.object({
  orderId: z.string(),
  orderCode: z.string(),
  status: publicOrderStatusSchema,
  createdAtLabel: z.string(),
  completedAtLabel: z.string().optional(),
  cancelledAtLabel: z.string().optional(),
  cancellationSummary: z.string().optional(),
  weightKgLabel: z.string(),
  serviceSummary: z.string(),
  earnedStamps: z.number().int(),
  redeemedPoints: z.number().int(),
  subtotal: z.number().int(),
  subtotalLabel: z.string(),
  discount: z.number().int(),
  discountLabel: z.string(),
  total: z.number().int(),
  totalLabel: z.string(),
  items: z.array(customerOrderDetailItemSchema),
})

export const customerNameVisibilityInputSchema = z.object({
  publicNameVisible: z.boolean(),
})

export const adminDashboardResponseSchema = z.object({
  metrics: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      value: z.string(),
      deltaLabel: z.string().optional(),
      tone: z.enum(["neutral", "positive", "warning"]),
    }),
  ),
  summary: z.object({
    grossSales: z.number().int(),
    netSales: z.number().int(),
    discountTotal: z.number().int(),
    confirmedOrders: z.number().int(),
    activeOrders: z.number().int(),
    completedOrders: z.number().int(),
    totalWeightKg: z.number(),
    averageOrderValue: z.number(),
    newCustomers: z.number().int(),
    pointsEarned: z.number().int(),
    pointsRedeemed: z.number().int(),
    manualPointsAdded: z.number().int(),
    topServiceUsage: z.array(
      z.object({
        serviceCode: serviceCodeSchema,
        label: z.string(),
        usageCount: z.number().int(),
      }),
    ),
  }),
  topCustomers: z.array(
    z.object({
      customerId: z.string(),
      maskedName: z.string(),
      confirmedOrders: z.number().int(),
      earnedStamps: z.number().int(),
      currentPoints: z.number().int().optional(),
    }),
  ),
  activeOrders: z.array(activeOrderCardSchema),
  notifications: z.array(notificationRecordSchema),
})

export const createCustomerInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
})

export const updateCustomerInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(8),
})

export const manualPointAdjustmentInputSchema = z.object({
  points: z.number().int().positive(),
  reason: z.string().min(3),
})

export const orderItemInputSchema = z.object({
  serviceCode: serviceCodeSchema,
  quantity: z.number().nonnegative(),
  selected: z.boolean(),
})

export const orderPreviewInputSchema = z.object({
  customerId: z.string(),
  weightKg: z.number().positive(),
  items: z.array(orderItemInputSchema),
  redeemCount: z.number().int().nonnegative(),
})

export const confirmOrderInputSchema = orderPreviewInputSchema

export const markDoneInputSchema = z.object({})

export const voidOrderInputSchema = z.object({
  reason: z.string().min(3),
  notifyCustomer: z.boolean().default(false),
})

export const customerLoginInputSchema = z.object({
  phone: z.string().min(8),
  name: z.string().min(1),
})

export const customerMagicLinkRedeemInputSchema = z.object({
  token: z.string().min(1),
})

export const adminLoginInputSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})

export type ServiceCode = z.infer<typeof serviceCodeSchema>
export type PricingModel = z.infer<typeof pricingModelSchema>
export type DashboardWindow = z.infer<typeof dashboardWindowSchema>
export type OrderStatus = z.infer<typeof orderStatusSchema>
export type PublicOrderStatus = z.infer<typeof publicOrderStatusSchema>
export type NotificationEventType = z.infer<typeof notificationEventTypeSchema>
export type NotificationDeliveryStatus = z.infer<typeof notificationDeliveryStatusSchema>
export type AdminLaundryStatus = z.infer<typeof adminLaundryStatusSchema>
export type AdminLaundryScope = z.infer<typeof adminLaundryScopeSchema>
export type AdminLaundrySort = z.infer<typeof adminLaundrySortSchema>
export type NotificationRenderStatus = z.infer<typeof notificationRenderStatusSchema>
export type WhatsappProvider = z.infer<typeof whatsappProviderSchema>
export type WhatsappProviderHealthState = z.infer<typeof whatsappProviderHealthStateSchema>
export type WhatsappProviderKind = z.infer<typeof whatsappProviderKindSchema>
export type WhatsappProviderStatus = z.infer<typeof whatsappProviderStatusSchema>
export type ServiceSetting = z.infer<typeof serviceSettingSchema>
export type AdminWhatsappContact = z.infer<typeof adminWhatsappContactSchema>
export type SettingsResponse = z.infer<typeof settingsResponseSchema>
export type CustomerSearchResult = z.infer<typeof customerSearchResultSchema>
export type CustomerProfile = z.infer<typeof customerProfileSchema>
export type OneTimeLogin = z.infer<typeof oneTimeLoginSchema>
export type CreateCustomerResponse = z.infer<typeof createCustomerResponseSchema>
export type CustomerMagicLinkResponse = z.infer<typeof customerMagicLinkResponseSchema>
export type OrderPreviewResponse = z.infer<typeof orderPreviewResponseSchema>
export type ActiveOrderCard = z.infer<typeof activeOrderCardSchema>
export type AdminLaundryOrder = z.infer<typeof adminLaundryOrderSchema>
export type AdminLaundryListResponse = z.infer<typeof adminLaundryListResponseSchema>
export type OrderHistoryItem = z.infer<typeof orderHistoryItemSchema>
export type PointLedgerItem = z.infer<typeof pointLedgerItemSchema>
export type NotificationRecord = z.infer<typeof notificationRecordSchema>
export type WhatsappConnectionState = z.infer<typeof whatsappConnectionStateSchema>
export type WhatsappPairingMethod = z.infer<typeof whatsappPairingMethodSchema>
export type WhatsappMessageDirection = z.infer<typeof whatsappMessageDirectionSchema>
export type WhatsappComposerMode = z.infer<typeof whatsappComposerModeSchema>
export type WhatsappMessageSource = z.infer<typeof whatsappMessageSourceSchema>
export type WhatsappConnectionStatus = z.infer<typeof whatsappConnectionStatusSchema>
export type WhatsappChatSummary = z.infer<typeof whatsappChatSummarySchema>
export type WhatsappMessageItem = z.infer<typeof whatsappMessageItemSchema>
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>
export type MonthlySummary = z.infer<typeof monthlySummarySchema>
export type PublicDashboardResponse = z.infer<typeof publicDashboardResponseSchema>
export type LandingResponse = z.infer<typeof landingResponseSchema>
export type DirectOrderStatus = z.infer<typeof directOrderStatusSchema>
export type CustomerOrderDetail = z.infer<typeof customerOrderDetailSchema>
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>
export type ManualPointAdjustmentInput = z.infer<typeof manualPointAdjustmentInputSchema>
export type OrderPreviewInput = z.infer<typeof orderPreviewInputSchema>
export type ConfirmOrderInput = z.infer<typeof confirmOrderInputSchema>
export type VoidOrderInput = z.infer<typeof voidOrderInputSchema>
export type CustomerLoginInput = z.infer<typeof customerLoginInputSchema>
export type CustomerMagicLinkRedeemInput = z.infer<typeof customerMagicLinkRedeemInputSchema>
export type AdminLoginInput = z.infer<typeof adminLoginInputSchema>
export type CustomerNameVisibilityInput = z.infer<typeof customerNameVisibilityInputSchema>
export type WhatsappInternalEvent = z.infer<typeof whatsappInternalEventSchema>
export type WhatsappInternalSessionStateChangedEvent = z.infer<typeof whatsappInternalSessionStateChangedEventSchema>
export type WhatsappInternalMessageUpsertedEvent = z.infer<typeof whatsappInternalMessageUpsertedEventSchema>
export type WhatsappInternalMessageAckChangedEvent = z.infer<typeof whatsappInternalMessageAckChangedEventSchema>
