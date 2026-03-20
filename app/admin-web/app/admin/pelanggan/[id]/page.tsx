"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  User,
  Phone,
  Star,
  Edit2,
  Send,
  Plus,
  Clock,
  ChevronLeft,
  Loader2,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Shirt,
  Scale,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import {
  mockCustomerProfile,
  mockPointLedger,
  mockOrderHistory,
  type CustomerProfileVM,
  type PointLedgerItemVM,
  type OrderHistoryItemVM,
} from "@/lib/mock-data"
import { adminApi } from "@/lib/api"

const statusConfig: Record<string, { label: string; badgeClass: string }> = {
  Active: {
    label: "Aktif",
    badgeClass: "bg-emerald-50 text-emerald-700 border-0",
  },
  Done: {
    label: "Selesai",
    badgeClass: "bg-bg-subtle text-text-muted border-0",
  },
  Cancelled: {
    label: "Dibatalkan",
    badgeClass: "bg-danger/10 text-danger border-0",
  },
}

const pointToneConfig: Record<
  string,
  { icon: React.ElementType; bg: string; color: string; sign: string }
> = {
  earned: { icon: ArrowUpRight, bg: "bg-emerald-50", color: "text-emerald-600", sign: "+" },
  redeemed: { icon: ArrowDownRight, bg: "bg-bg-subtle", color: "text-text-muted", sign: "-" },
  adjustment: { icon: Plus, bg: "bg-info/10", color: "text-info", sign: "+" },
  reversal: { icon: RefreshCw, bg: "bg-warning/10", color: "text-warning", sign: "" },
}

function OrderHistoryRow({
  order,
  onVoid,
}: {
  order: OrderHistoryItemVM
  onVoid?: () => void
}) {
  const status = statusConfig[order.status] ?? statusConfig.Done
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-line-base last:border-b-0">
      {/* Status dot */}
      <div className="flex flex-col items-center pt-1 flex-shrink-0">
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            order.status === "Active" ? "bg-emerald-500" : order.status === "Cancelled" ? "bg-danger" : "bg-line-strong"
          )}
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="font-mono text-xs font-bold text-rose-600">{order.orderCode}</span>
          <Badge className={cn("rounded-md text-[10px] font-semibold px-1.5", status.badgeClass)}>
            {status.label}
          </Badge>
        </div>
        <p className="text-xs text-text-muted mb-2">{order.createdAtLabel}</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="flex items-center gap-1 text-text-muted">
            <Shirt className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{order.serviceSummary}</span>
          </div>
          <div className="flex items-center gap-1 text-text-muted">
            <Scale className="h-3 w-3 flex-shrink-0" />
            {order.weightKgLabel}
          </div>
          <div className="flex items-center gap-1 text-text-muted">
            <Star className="h-3 w-3 flex-shrink-0 text-warning" />
            +{order.earnedStamps} poin
          </div>
          <div className="font-semibold text-text-strong">{order.totalLabel}</div>
        </div>
        {order.status === "Cancelled" && (order.cancelledAtLabel || order.cancellationSummary) && (
          <div className="mt-2 rounded-lg bg-danger/5 border border-danger/15 px-3 py-2 text-xs text-danger">
            {order.cancelledAtLabel && <p>Dibatalkan: {order.cancelledAtLabel}</p>}
            {order.cancellationSummary && <p>Alasan: {order.cancellationSummary}</p>}
          </div>
        )}
      </div>
      {onVoid && order.status !== "Cancelled" && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          data-testid={`void-order-${order.orderId}`}
          className="rounded-lg h-8 text-xs"
          onClick={onVoid}
        >
          Void
        </Button>
      )}
    </div>
  )
}

function PointLedgerRow({ entry }: { entry: PointLedgerItemVM }) {
  const config = pointToneConfig[entry.tone] ?? pointToneConfig.adjustment
  const Icon = config.icon
  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-line-base last:border-b-0">
      <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0", config.bg)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-text-strong leading-tight">{entry.label}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-text-muted">{entry.createdAtLabel}</span>
          {entry.relatedOrderCode && (
            <>
              <span className="h-1 w-1 rounded-full bg-line-strong" />
              <span className="font-mono text-xs text-rose-600">{entry.relatedOrderCode}</span>
            </>
          )}
        </div>
      </div>
      <div className="text-right flex-shrink-0">
        <p className={cn("text-sm font-bold tabular-nums", entry.delta > 0 ? "text-emerald-600" : "text-text-body")}>
          {entry.delta > 0 ? "+" : ""}{entry.delta}
        </p>
        <p className="text-[10px] text-text-muted mt-0.5">Saldo: {entry.balanceAfter}</p>
      </div>
    </div>
  )
}

const QUICK_POINT_CHIPS = [5, 10, 20, 50]

export default function CustomerDetailPage() {
  const router = useRouter()
  const [customer, setCustomer] = useState<CustomerProfileVM>(mockCustomerProfile)
  const [pointLedger, setPointLedger] = useState<PointLedgerItemVM[]>(mockPointLedger)
  const [orderHistory, setOrderHistory] = useState<OrderHistoryItemVM[]>(mockOrderHistory)
  const [activeTab, setActiveTab] = useState("orders")

  const [showEditSheet, setShowEditSheet] = useState(false)
  const [editName, setEditName] = useState(customer.name)
  const [editPhone, setEditPhone] = useState(customer.phone)
  const [isEditing, setIsEditing] = useState(false)

  const [showAddPointsSheet, setShowAddPointsSheet] = useState(false)
  const [addPointsAmount, setAddPointsAmount] = useState("")
  const [addPointsNote, setAddPointsNote] = useState("")
  const [isAddingPoints, setIsAddingPoints] = useState(false)
  const [showVoidSheet, setShowVoidSheet] = useState(false)
  const [selectedOrderForVoid, setSelectedOrderForVoid] = useState<OrderHistoryItemVM | null>(null)
  const [voidReason, setVoidReason] = useState("")
  const [notifyCustomerOnVoid, setNotifyCustomerOnVoid] = useState(true)
  const [isVoiding, setIsVoiding] = useState(false)

  const [isResendingWA, setIsResendingWA] = useState(false)

  const getCustomerId = () => window.location.pathname.split("/").pop() ?? ""

  const loadCustomerDetail = async () => {
    const customerId = getCustomerId()
    if (!customerId) {
      return
    }

    const payload = await adminApi.getCustomerDetail(customerId)
    setCustomer(payload.profile as CustomerProfileVM)
    setPointLedger(payload.pointLedger as PointLedgerItemVM[])
    setOrderHistory(payload.orderHistory as OrderHistoryItemVM[])
  }

  useEffect(() => {
    loadCustomerDetail().catch(() => undefined)
  }, [])

  const activeOrders = orderHistory.filter((o) => o.status === "Active")
  const historicalOrders = orderHistory.filter((o) => o.status !== "Active")

  const handleEditIdentity = async () => {
    setIsEditing(true)
    const customerId = getCustomerId()
    if (customerId) {
      const payload = await adminApi.updateCustomer(customerId, editName, editPhone)
      setCustomer((payload.profile as CustomerProfileVM))
      setPointLedger(payload.pointLedger as PointLedgerItemVM[])
      setOrderHistory(payload.orderHistory as OrderHistoryItemVM[])
    }
    setIsEditing(false)
    setShowEditSheet(false)
  }

  const handleAddPoints = async () => {
    if (!addPointsAmount || !addPointsNote) return
    setIsAddingPoints(true)
    const customerId = getCustomerId()
    if (customerId) {
      const payload = await adminApi.addCustomerPoints(customerId, parseInt(addPointsAmount), addPointsNote)
      setCustomer(payload.profile as CustomerProfileVM)
      setPointLedger(payload.pointLedger as PointLedgerItemVM[])
      setOrderHistory(payload.orderHistory as OrderHistoryItemVM[])
    }
    setIsAddingPoints(false)
    setShowAddPointsSheet(false)
    setAddPointsAmount("")
    setAddPointsNote("")
  }

  const handleResendWA = async () => {
    setIsResendingWA(true)
    await new Promise((r) => setTimeout(r, 400))
    setIsResendingWA(false)
  }

  const handleVoidOrder = async () => {
    if (!selectedOrderForVoid || !voidReason.trim()) {
      return
    }

    setIsVoiding(true)
    await adminApi.voidOrder(selectedOrderForVoid.orderId, voidReason.trim(), notifyCustomerOnVoid)
    await loadCustomerDetail()
    setIsVoiding(false)
    setShowVoidSheet(false)
    setSelectedOrderForVoid(null)
    setVoidReason("")
    setNotifyCustomerOnVoid(true)
  }

  const newPointsBalance = addPointsAmount
    ? customer.currentPoints + (parseInt(addPointsAmount) || 0)
    : null

  return (
    <AdminShell
      title="Detail Pelanggan"
      action={
        <Button
          variant="ghost"
          size="sm"
          className="rounded-lg text-text-muted h-9 px-2"
          onClick={() => router.back()}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Kembali
        </Button>
      }
    >
      <div className="px-4 py-5 lg:px-6 space-y-4 pb-24">

        {/* Profile Hero */}
        <Card className="rounded-xl border-line-base shadow-card bg-bg-surface overflow-hidden">
          <div className="h-14 bg-gradient-to-r from-slate-50 to-rose-50 border-b border-line-base" />
          <CardContent className="px-5 pb-5 -mt-7">
            <div className="flex items-end justify-between gap-4">
              <div className="flex items-end gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white border-2 border-white shadow-card">
                  <User className="h-7 w-7 text-rose-600" />
                </div>
                <div className="pb-0.5">
                  <h2 className="text-base font-bold text-text-strong leading-tight">{customer.name}</h2>
                  <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                    <Phone className="h-3 w-3" />
                    {customer.phone}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8 px-2.5 text-xs"
                  onClick={handleResendWA}
                  disabled={isResendingWA}
                >
                  {isResendingWA ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <><Send className="h-3.5 w-3.5 mr-1" />WA</>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-lg h-8 px-2.5 text-xs"
                  onClick={() => {
                    setEditName(customer.name)
                    setEditPhone(customer.phone)
                    setShowEditSheet(true)
                  }}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1" />
                  Edit
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            {
              icon: Star,
              iconClass: "text-warning",
              bg: "bg-warning/10",
              value: customer.currentPoints,
              label: "Poin Aktif",
              highlight: true,
            },
            {
              icon: CheckCircle2,
              iconClass: "text-emerald-600",
              bg: "bg-emerald-50",
              value: customer.totalOrders,
              label: "Total Order",
            },
            {
              icon: Shirt,
              iconClass: "text-rose-600",
              bg: "bg-rose-50",
              value: customer.activeOrderCount,
              label: "Sedang Aktif",
            },
            {
              icon: Calendar,
              iconClass: "text-info",
              bg: "bg-info/10",
              value: customer.lastActivityAt ?? "-",
              label: "Aktivitas Terakhir",
              small: true,
            },
          ].map(({ icon: Icon, iconClass, bg, value, label, highlight, small }) => (
            <Card
              key={label}
              className={cn(
                "rounded-xl border-line-base shadow-card bg-bg-surface",
                highlight && "border-warning/30 bg-warning/5"
              )}
            >
              <CardContent className="p-4">
                <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg mb-3", bg)}>
                  <Icon className={cn("h-4 w-4", iconClass)} />
                </div>
                <p className={cn("font-bold text-text-strong tabular-nums", small ? "text-sm leading-tight" : "text-xl")}>
                  {value}
                </p>
                <p className="text-xs text-text-muted mt-0.5">{label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full grid grid-cols-2 bg-bg-subtle rounded-lg p-1 h-auto border border-line-base">
            <TabsTrigger
              value="orders"
              className="rounded-md text-sm py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-text-strong data-[state=inactive]:text-text-muted"
            >
              Riwayat Order
              {activeOrders.length > 0 && (
                <Badge className="ml-1.5 bg-emerald-50 text-emerald-700 border-0 text-[10px] px-1.5 rounded-md">
                  {activeOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger
              value="points"
              className="rounded-md text-sm py-2 data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-text-strong data-[state=inactive]:text-text-muted"
            >
              Riwayat Poin
              <Badge className="ml-1.5 bg-bg-subtle text-text-muted border-0 text-[10px] px-1.5 rounded-md">
                {pointLedger.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Orders tab */}
          <TabsContent value="orders" className="mt-3 space-y-3">
            {activeOrders.length > 0 && (
              <Card className="rounded-xl border-emerald-200 bg-bg-surface shadow-card">
                <CardContent className="p-4 pb-1">
                  <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide mb-1">
                    Sedang Berjalan ({activeOrders.length})
                  </p>
                  {activeOrders.map((o) => (
                    <OrderHistoryRow
                      key={o.orderId}
                      order={o}
                      onVoid={() => {
                        setSelectedOrderForVoid(o)
                        setShowVoidSheet(true)
                      }}
                    />
                  ))}
                </CardContent>
              </Card>
            )}

            <Card className="rounded-xl border-line-base bg-bg-surface shadow-card">
              <CardContent className="p-4 pb-1">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">
                  Riwayat Sebelumnya ({historicalOrders.length})
                </p>
                {historicalOrders.length > 0 ? (
                  historicalOrders.map((o) => (
                    <OrderHistoryRow
                      key={o.orderId}
                      order={o}
                      onVoid={() => {
                        setSelectedOrderForVoid(o)
                        setShowVoidSheet(true)
                      }}
                    />
                  ))
                ) : (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Package className="h-8 w-8 text-text-muted" />
                    <p className="text-sm text-text-muted">Belum ada riwayat order</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Points tab */}
          <TabsContent value="points" className="mt-3 space-y-3">
            {/* Current balance + add CTA */}
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-warning" />
                <span className="text-sm font-semibold text-text-strong">
                  {customer.currentPoints} poin aktif
                </span>
              </div>
              <Button
                size="sm"
                className="rounded-lg h-8 px-3 text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                onClick={() => setShowAddPointsSheet(true)}
              >
                <Plus className="h-3.5 w-3.5 mr-1" />
                Tambah Manual
              </Button>
            </div>

            <Card className="rounded-xl border-line-base bg-bg-surface shadow-card">
              <CardContent className="p-4 pb-1">
                <p className="text-[10px] font-bold text-text-muted uppercase tracking-wide mb-1">
                  Semua Transaksi ({pointLedger.length})
                </p>
                {pointLedger.length > 0 ? (
                  pointLedger.map((e) => <PointLedgerRow key={e.entryId} entry={e} />)
                ) : (
                  <div className="flex flex-col items-center py-8 gap-2">
                    <Star className="h-8 w-8 text-text-muted" />
                    <p className="text-sm text-text-muted">Belum ada riwayat poin</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Identity Sheet */}
      <Sheet open={showEditSheet} onOpenChange={setShowEditSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">Edit Identitas</SheetTitle>
          </SheetHeader>
          <div className="py-5 space-y-4">
            <div className="flex items-start gap-2 bg-warning/5 border border-warning/30 rounded-lg p-3">
              <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
              <p className="text-xs text-warning leading-relaxed">
                Perubahan identitas akan dicatat dalam audit log. Notifikasi WA akan dikirim ke nomor baru.
              </p>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">Nama Lengkap</label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-11 rounded-lg border-line-base"
                placeholder="Nama pelanggan"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">Nomor HP</label>
              <Input
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="h-11 rounded-lg border-line-base"
                placeholder="08xx-xxxx-xxxx"
              />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1 rounded-lg">Batal</Button>
            </SheetClose>
            <Button
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              onClick={handleEditIdentity}
              disabled={!editName.trim() || !editPhone.trim() || isEditing}
            >
              {isEditing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menyimpan...</>
              ) : (
                "Simpan Perubahan"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Add Points Sheet */}
      <Sheet open={showAddPointsSheet} onOpenChange={setShowAddPointsSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">Tambah Poin Manual</SheetTitle>
          </SheetHeader>
          <div className="py-5 space-y-4">
            {/* Current balance */}
            <div className="flex items-center justify-between bg-bg-subtle rounded-lg px-4 py-3 border border-line-base">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-warning" />
                <span className="text-sm text-text-muted">Saldo saat ini</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-text-strong tabular-nums">{customer.currentPoints}</span>
                {newPointsBalance !== null && newPointsBalance !== customer.currentPoints && (
                  <>
                    <ChevronLeft className="h-3 w-3 text-text-muted rotate-180" />
                    <span className="text-sm font-bold text-emerald-600 tabular-nums">{newPointsBalance}</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick chips */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">Jumlah Poin</label>
              <div className="flex gap-2 flex-wrap">
                {QUICK_POINT_CHIPS.map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors",
                      addPointsAmount === String(val)
                        ? "border-rose-600 bg-rose-50 text-rose-600"
                        : "border-line-base bg-bg-surface text-text-body hover:border-rose-200"
                    )}
                    onClick={() => setAddPointsAmount(String(val))}
                  >
                    +{val}
                  </button>
                ))}
              </div>
              <Input
                type="number"
                min="1"
                placeholder="Atau ketik jumlah lain..."
                value={addPointsAmount}
                onChange={(e) => setAddPointsAmount(e.target.value)}
                className="h-11 rounded-lg border-line-base text-center font-semibold"
              />
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">
                Alasan <span className="text-danger">*</span>
              </label>
              <Textarea
                placeholder="Contoh: Kompensasi keterlambatan, bonus loyalitas..."
                value={addPointsNote}
                onChange={(e) => setAddPointsNote(e.target.value)}
                className="rounded-lg border-line-base resize-none text-sm"
                rows={3}
              />
              <p className="text-xs text-text-muted">Wajib diisi dan akan tercatat dalam riwayat poin.</p>
            </div>
          </div>
          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1 rounded-lg">Batal</Button>
            </SheetClose>
            <Button
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              onClick={handleAddPoints}
              disabled={!addPointsAmount || !addPointsNote.trim() || isAddingPoints}
            >
              {isAddingPoints ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Menambahkan...</>
              ) : (
                <><Plus className="h-4 w-4 mr-2" />Tambah Poin</>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={showVoidSheet} onOpenChange={setShowVoidSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">Void / Cancel Order</SheetTitle>
          </SheetHeader>
          <div className="py-5 space-y-4">
            {selectedOrderForVoid && (
              <Card className="rounded-xl border-line-base bg-bg-subtle">
                <CardContent className="p-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Kode Order</span>
                    <span className="font-mono text-xs font-semibold text-rose-600">{selectedOrderForVoid.orderCode}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Status</span>
                    <span className="font-medium text-text-strong">{statusConfig[selectedOrderForVoid.status]?.label ?? selectedOrderForVoid.status}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Layanan</span>
                    <span className="font-medium text-text-strong text-right">{selectedOrderForVoid.serviceSummary}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">
                Alasan Void <span className="text-danger">*</span>
              </label>
              <Textarea
                data-testid="void-reason-input"
                rows={3}
                value={voidReason}
                onChange={(event) => setVoidReason(event.target.value)}
                placeholder="Contoh: pelanggan batal, input service salah, koreksi transaksi..."
                className="rounded-lg border-line-base resize-none text-sm"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-line-base bg-bg-subtle px-4 py-3">
              <div>
                <p className="text-sm font-medium text-text-body">Kirim notifikasi ke pelanggan</p>
                <p className="text-xs text-text-muted mt-0.5">Aktifkan jika pembatalan perlu diinformasikan via WhatsApp.</p>
              </div>
              <Switch data-testid="void-notify-toggle" checked={notifyCustomerOnVoid} onCheckedChange={setNotifyCustomerOnVoid} />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1 rounded-lg">Batal</Button>
            </SheetClose>
            <Button
              data-testid="void-submit"
              className="flex-1 rounded-lg bg-danger hover:bg-danger/90 text-white font-semibold"
              onClick={handleVoidOrder}
              disabled={!voidReason.trim() || isVoiding}
            >
              {isVoiding ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
              ) : (
                "Void Order"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AdminShell>
  )
}
