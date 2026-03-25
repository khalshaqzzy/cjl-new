"use client"

import type {
  CreateCustomerResponse,
  AdminDashboardResponse,
  CustomerMagicLinkResponse,
  ConfirmOrderInput,
  CustomerSearchResult,
  NotificationRecord,
  OrderHistoryItem,
  OrderPreviewResponse,
  SettingsResponse,
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappMessageItem,
} from "@cjl/contracts"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"

export class ApiError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestId?: string

  constructor(message: string, status: number, code?: string, requestId?: string) {
    super(requestId ? `${message} [Ref: ${requestId}]` : message)
    this.name = "ApiError"
    this.status = status
    this.code = code
    this.requestId = requestId
  }
}

const resolveIdempotencyKey = (key?: string) => key ?? crypto.randomUUID()

const apiFetch = async <T>(path: string, init?: RequestInit) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; error?: { code?: string; requestId?: string } }
      | null
    throw new ApiError(
      payload?.message ?? "Request gagal",
      response.status,
      payload?.error?.code,
      payload?.error?.requestId ?? response.headers.get("x-request-id") ?? undefined
    )
  }

  if (response.headers.get("content-type")?.includes("text/plain")) {
    return (await response.text()) as T
  }

  return (await response.json()) as T
}

const apiFetchBlob = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { message?: string; error?: { code?: string; requestId?: string } }
      | null
    throw new ApiError(
      payload?.message ?? "Request gagal",
      response.status,
      payload?.error?.code,
      payload?.error?.requestId ?? response.headers.get("x-request-id") ?? undefined
    )
  }

  return {
    blob: await response.blob(),
    filename: response.headers.get("content-disposition")?.match(/filename="?([^"]+)"?/)?.[1] ?? "receipt.txt"
  }
}

export const adminApi = {
  getSession: () => apiFetch<{ authenticated: boolean }>("/v1/admin/auth/session"),
  login: (username: string, password: string) =>
    apiFetch<{ ok: true }>("/v1/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password })
    }),
  logout: () => apiFetch<{ ok: true }>("/v1/admin/auth/logout", { method: "POST" }),
  getDashboard: (window: "daily" | "weekly" | "monthly") =>
    apiFetch<AdminDashboardResponse>(`/v1/admin/dashboard?window=${window}`),
  listCustomers: (search = "") =>
    apiFetch<CustomerSearchResult[]>(`/v1/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (name: string, phone: string, idempotencyKey?: string) =>
    apiFetch<CreateCustomerResponse>("/v1/admin/customers", {
      method: "POST",
      headers: { "Idempotency-Key": resolveIdempotencyKey(idempotencyKey) },
      body: JSON.stringify({ name, phone })
    }),
  generateCustomerMagicLink: (customerId: string) =>
    apiFetch<CustomerMagicLinkResponse>(`/v1/admin/customers/${customerId}/magic-link`, {
      method: "POST",
      body: JSON.stringify({})
    }),
  getCustomerDetail: (customerId: string) =>
    apiFetch<{
      profile: import("@cjl/contracts").CustomerProfile
      pointLedger: import("@cjl/contracts").PointLedgerItem[]
      orderHistory: OrderHistoryItem[]
    }>(`/v1/admin/customers/${customerId}`),
  updateCustomer: (customerId: string, name: string, phone: string) =>
    apiFetch<{
      profile: import("@cjl/contracts").CustomerProfile
      pointLedger: import("@cjl/contracts").PointLedgerItem[]
      orderHistory: OrderHistoryItem[]
    }>(`/v1/admin/customers/${customerId}`, {
      method: "PATCH",
      body: JSON.stringify({ name, phone })
    }),
  addCustomerPoints: (customerId: string, points: number, reason: string) =>
    apiFetch<{
      profile: import("@cjl/contracts").CustomerProfile
      pointLedger: import("@cjl/contracts").PointLedgerItem[]
      orderHistory: OrderHistoryItem[]
    }>(`/v1/admin/customers/${customerId}/points`, {
      method: "POST",
      body: JSON.stringify({ points, reason })
    }),
  previewOrder: (payload: ConfirmOrderInput) =>
    apiFetch<OrderPreviewResponse>("/v1/admin/orders/preview", {
      method: "POST",
      body: JSON.stringify(payload)
    }),
  confirmOrder: (payload: ConfirmOrderInput, idempotencyKey?: string) =>
    apiFetch<{ order: OrderHistoryItem; directToken: string }>("/v1/admin/orders", {
      method: "POST",
      headers: { "Idempotency-Key": resolveIdempotencyKey(idempotencyKey) },
      body: JSON.stringify(payload)
    }),
  listActiveOrders: () => apiFetch<import("@cjl/contracts").ActiveOrderCard[]>("/v1/admin/orders/active"),
  markOrderDone: (orderId: string, idempotencyKey?: string) =>
    apiFetch(`/v1/admin/orders/${orderId}/done`, {
      method: "POST",
      headers: { "Idempotency-Key": resolveIdempotencyKey(idempotencyKey) },
      body: JSON.stringify({})
    }),
  voidOrder: (orderId: string, reason: string, notifyCustomer: boolean, idempotencyKey?: string) =>
    apiFetch(`/v1/admin/orders/${orderId}/void`, {
      method: "POST",
      headers: { "Idempotency-Key": resolveIdempotencyKey(idempotencyKey) },
      body: JSON.stringify({ reason, notifyCustomer })
    }),
  listNotifications: () => apiFetch<NotificationRecord[]>("/v1/admin/notifications"),
  resendNotification: (notificationId: string) =>
    apiFetch(`/v1/admin/notifications/${notificationId}/resend`, { method: "POST" }),
  manualResolveNotification: (notificationId: string, note: string) =>
    apiFetch(`/v1/admin/notifications/${notificationId}/manual-resolve`, {
      method: "POST",
      body: JSON.stringify({ note })
    }),
  openManualWhatsappFallback: (notificationId: string) =>
    apiFetch<{ notification: NotificationRecord; whatsappUrl: string }>(
      `/v1/admin/notifications/${notificationId}/manual-whatsapp`,
      { method: "POST" }
    ),
  getNotificationReceipt: (notificationId: string) =>
    apiFetchBlob(`/v1/admin/notifications/${notificationId}/receipt`),
  getNotificationMessage: (notificationId: string) =>
    apiFetch<{ message: string }>(`/v1/admin/notifications/${notificationId}/message`),
  getSettings: () => apiFetch<SettingsResponse>("/v1/admin/settings"),
  updateSettings: (payload: SettingsResponse) =>
    apiFetch<SettingsResponse>("/v1/admin/settings", {
      method: "PUT",
      body: JSON.stringify(payload)
    }),
  getWhatsappStatus: () => apiFetch<WhatsappConnectionStatus>("/v1/admin/whatsapp/status"),
  requestWhatsappPairingCode: () =>
    apiFetch<WhatsappConnectionStatus>("/v1/admin/whatsapp/pairing-code", { method: "POST" }),
  reconnectWhatsapp: () =>
    apiFetch<WhatsappConnectionStatus>("/v1/admin/whatsapp/reconnect", { method: "POST" }),
  resetWhatsappSession: () =>
    apiFetch<WhatsappConnectionStatus>("/v1/admin/whatsapp/reset-session", { method: "POST" }),
  listWhatsappChats: () => apiFetch<WhatsappChatSummary[]>("/v1/admin/whatsapp/chats"),
  listWhatsappMessages: (chatId: string) =>
    apiFetch<WhatsappMessageItem[]>(`/v1/admin/whatsapp/chats/${encodeURIComponent(chatId)}/messages`),
}
