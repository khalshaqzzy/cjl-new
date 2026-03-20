"use client"

import type {
  DirectOrderStatus,
  LandingResponse,
  LeaderboardRow,
  MonthlySummary,
  OrderHistoryItem,
  PointLedgerItem,
  PublicDashboardResponse
} from "@cjl/contracts"

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000"

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
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message ?? "Request gagal")
  }

  return (await response.json()) as T
}

export const publicApi = {
  getLanding: () => apiFetch<LandingResponse>("/v1/public/landing"),
  login: (phone: string, name: string) =>
    apiFetch<{ ok: true }>("/v1/public/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, name })
    }),
  logout: () => apiFetch<{ ok: true }>("/v1/public/auth/logout", { method: "POST" }),
  getSession: () =>
    apiFetch<{
      authenticated: boolean
      session: { customerId: string; name: string; phone: string } | null
    }>("/v1/public/auth/session"),
  getDashboard: () => apiFetch<PublicDashboardResponse>("/v1/public/me/dashboard"),
  listOrders: () => apiFetch<OrderHistoryItem[]>("/v1/public/me/orders"),
  getOrderDetail: (orderId: string) => apiFetch<OrderHistoryItem>(`/v1/public/me/orders/${orderId}`),
  listPoints: () => apiFetch<PointLedgerItem[]>("/v1/public/me/points"),
  listRedemptions: () =>
    apiFetch<Array<{ entryId: string; redeemedPoints: number; freeWasherUnits: number; createdAtLabel: string; relatedOrderCode?: string }>>("/v1/public/me/redemptions"),
  getMonthlySummary: () => apiFetch<MonthlySummary>("/v1/public/me/monthly-summary"),
  getLeaderboard: (month?: string) =>
    apiFetch<{ rows: LeaderboardRow[]; availableMonths: Array<{ key: string; label: string; isCurrent: boolean }> }>(
      `/v1/public/leaderboard${month ? `?month=${encodeURIComponent(month)}` : ""}`
    ),
  getDirectStatus: (token: string) => apiFetch<DirectOrderStatus>(`/v1/public/status/${token}`)
}
