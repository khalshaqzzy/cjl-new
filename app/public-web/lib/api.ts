"use client"

import type {
  CustomerMagicLinkRedeemInput,
  CustomerOrderDetail,
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

const apiFetchBlob = async (path: string, init?: RequestInit) => {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {})
    }
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null
    throw new Error(payload?.message ?? "Request gagal")
  }

  return {
    blob: await response.blob(),
    filename: response.headers.get("content-disposition")?.match(/filename=\"?([^"]+)\"?/)?.[1] ?? "receipt.pdf"
  }
}

export const publicApi = {
  getLanding: () => apiFetch<LandingResponse>("/v1/public/landing"),
  login: (phone: string, name: string) =>
    apiFetch<{ ok: true }>("/v1/public/auth/login", {
      method: "POST",
      body: JSON.stringify({ phone, name })
    }),
  redeemMagicLink: (token: CustomerMagicLinkRedeemInput["token"]) =>
    apiFetch<{
      ok: true
      session: { customerId: string; name: string; phone: string; publicNameVisible: boolean }
    }>("/v1/public/auth/magic-link/redeem", {
      method: "POST",
      body: JSON.stringify({ token })
    }),
  logout: () => apiFetch<{ ok: true }>("/v1/public/auth/logout", { method: "POST" }),
  getSession: () =>
    apiFetch<{
      authenticated: boolean
      session: { customerId: string; name: string; phone: string; publicNameVisible: boolean } | null
    }>("/v1/public/auth/session"),
  getDashboard: () => apiFetch<PublicDashboardResponse>("/v1/public/me/dashboard"),
  listOrders: () => apiFetch<OrderHistoryItem[]>("/v1/public/me/orders"),
  getOrderDetail: (orderId: string) => apiFetch<CustomerOrderDetail>(`/v1/public/me/orders/${orderId}`),
  getOrderReceipt: (orderId: string) => apiFetchBlob(`/v1/public/me/orders/${orderId}/receipt`),
  listPoints: () => apiFetch<PointLedgerItem[]>("/v1/public/me/points"),
  listRedemptions: () =>
    apiFetch<Array<{ entryId: string; redeemedPoints: number; freeWasherUnits: number; createdAtLabel: string; relatedOrderCode?: string }>>("/v1/public/me/redemptions"),
  getMonthlySummary: () => apiFetch<MonthlySummary>("/v1/public/me/monthly-summary"),
  getLeaderboard: (month?: string) =>
    apiFetch<{ rows: LeaderboardRow[]; availableMonths: Array<{ key: string; label: string; isCurrent: boolean }> }>(
      `/v1/public/leaderboard${month ? `?month=${encodeURIComponent(month)}` : ""}`
    ),
  updateNameVisibility: (publicNameVisible: boolean) =>
    apiFetch<{ session: { customerId: string; name: string; phone: string; publicNameVisible: boolean } }>(
      "/v1/public/me/preferences/name-visibility",
      {
        method: "PATCH",
        body: JSON.stringify({ publicNameVisible })
      }
    ),
  getDirectStatus: (token: string) => apiFetch<DirectOrderStatus>(`/v1/public/status/${token}`)
}
