import { env } from "../env.js"
import { formatDateTime } from "./time.js"

export const compileTemplate = (
  template: string,
  params: Record<string, string | number | undefined>
) => template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => `${params[key] ?? ""}`)

export const shouldForceNotificationFailure = (eventType: string) => {
  if (env.WA_FAIL_MODE === "all") {
    return true
  }

  if (env.WA_FAIL_MODE === "confirm-only" && eventType === "order_confirmed") {
    return true
  }

  return false
}

export const buildReceiptText = (params: {
  orderCode: string
  customerName: string
  serviceSummary: string
  totalLabel: string
  createdAt: string
}) => {
  const lines = [
    "CJ Laundry Receipt",
    `Order: ${params.orderCode}`,
    `Customer: ${params.customerName}`,
    `Waktu: ${formatDateTime(params.createdAt)}`,
    `Layanan: ${params.serviceSummary}`,
    `Total: ${params.totalLabel}`
  ]

  return lines.join("\n")
}
