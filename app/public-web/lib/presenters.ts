export type PublicOrderStatus = "Active" | "Done" | "Cancelled"

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)

export const getStatusColor = (status: PublicOrderStatus) => {
  switch (status) {
    case "Active":
      return "bg-info/10 text-info"
    case "Done":
      return "bg-success/10 text-success"
    case "Cancelled":
      return "bg-danger/10 text-danger"
    default:
      return "bg-bg-subtle text-text-muted"
  }
}

export const getStatusLabel = (status: PublicOrderStatus) => {
  switch (status) {
    case "Active":
      return "Aktif"
    case "Done":
      return "Selesai"
    case "Cancelled":
      return "Dibatalkan"
    default:
      return status
  }
}
