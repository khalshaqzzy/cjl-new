import { z } from "zod"

export const serviceCodeSchema = z.enum([
  "washer",
  "dryer",
  "detergent",
  "softener",
  "wash_dry_fold_package",
  "ironing",
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
])
export const notificationRenderStatusSchema = z.enum([
  "not_required",
  "pending",
  "ready",
  "failed",
])
export const pointLedgerToneSchema = z.enum([
  "earned",
  "redeemed",
  "adjustment",
  "reversal",
])

export const serviceSettingSchema = z.object({
  serviceCode: serviceCodeSchema,
  displayName: z.string(),
  pricingModel: pricingModelSchema,
  price: z.number().int().nonnegative(),
  isActive: z.boolean(),
  publicDescription: z.string().optional(),
})

export const businessProfileSchema = z.object({
  laundryName: z.string(),
  laundryPhone: z.string(),
  publicContactPhone: z.string(),
  publicWhatsapp: z.string(),
  address: z.string(),
  operatingHours: z.string(),
})

export const messageTemplateSchema = z.object({
  welcome: z.string(),
  orderConfirmed: z.string(),
  orderDone: z.string(),
  orderVoidNotice: z.string(),
  accountInfo: z.string(),
})

export const settingsResponseSchema = z.object({
  business: businessProfileSchema,
  services: z.array(serviceSettingSchema),
  messageTemplates: messageTemplateSchema,
})

export const customerSearchResultSchema = z.object({
  customerId: z.string(),
  name: z.string(),
  phone: z.string(),
  currentPoints: z.number().int(),
  activeOrderCount: z.number().int(),
  recentActivityAt: z.string().optional(),
})

export const customerProfileSchema = z.object({
  customerId: z.string(),
  name: z.string(),
  phone: z.string(),
  currentPoints: z.number().int(),
  activeOrderCount: z.number().int(),
  totalOrders: z.number().int(),
  lastActivityAt: z.string().optional(),
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
  weightKgLabel: z.string(),
  serviceSummary: z.string(),
  earnedStamps: z.number().int(),
  redeemedPoints: z.number().int(),
  status: z.literal("Active"),
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
  renderStatus: notificationRenderStatusSchema.optional(),
  deliveryStatus: notificationDeliveryStatusSchema,
  latestFailureReason: z.string().optional(),
  attemptCount: z.number().int(),
  lastAttemptAt: z.string().optional(),
  preparedMessage: z.string(),
  manualResolutionNote: z.string().optional(),
})

export const leaderboardRowSchema = z.object({
  rank: z.number().int(),
  maskedAlias: z.string(),
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
  }),
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
export type NotificationRenderStatus = z.infer<typeof notificationRenderStatusSchema>
export type ServiceSetting = z.infer<typeof serviceSettingSchema>
export type SettingsResponse = z.infer<typeof settingsResponseSchema>
export type CustomerSearchResult = z.infer<typeof customerSearchResultSchema>
export type CustomerProfile = z.infer<typeof customerProfileSchema>
export type OrderPreviewResponse = z.infer<typeof orderPreviewResponseSchema>
export type ActiveOrderCard = z.infer<typeof activeOrderCardSchema>
export type OrderHistoryItem = z.infer<typeof orderHistoryItemSchema>
export type PointLedgerItem = z.infer<typeof pointLedgerItemSchema>
export type NotificationRecord = z.infer<typeof notificationRecordSchema>
export type LeaderboardRow = z.infer<typeof leaderboardRowSchema>
export type MonthlySummary = z.infer<typeof monthlySummarySchema>
export type PublicDashboardResponse = z.infer<typeof publicDashboardResponseSchema>
export type LandingResponse = z.infer<typeof landingResponseSchema>
export type DirectOrderStatus = z.infer<typeof directOrderStatusSchema>
export type AdminDashboardResponse = z.infer<typeof adminDashboardResponseSchema>
export type CreateCustomerInput = z.infer<typeof createCustomerInputSchema>
export type UpdateCustomerInput = z.infer<typeof updateCustomerInputSchema>
export type ManualPointAdjustmentInput = z.infer<typeof manualPointAdjustmentInputSchema>
export type OrderPreviewInput = z.infer<typeof orderPreviewInputSchema>
export type ConfirmOrderInput = z.infer<typeof confirmOrderInputSchema>
export type VoidOrderInput = z.infer<typeof voidOrderInputSchema>
export type CustomerLoginInput = z.infer<typeof customerLoginInputSchema>
export type AdminLoginInput = z.infer<typeof adminLoginInputSchema>
