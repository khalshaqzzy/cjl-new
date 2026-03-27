"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { AdminLaundryOrder, AdminLaundryScope, AdminLaundrySort } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"
import {
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  Clock,
  Loader2,
  Package,
  Phone,
  Scale,
  Search,
  Shirt,
  Star,
  Timer,
  User,
  X,
} from "lucide-react"

type HistoryStatusFilter = "all" | "active" | "done" | "cancelled"

const statusBadgeStyles: Record<AdminLaundryOrder["status"], string> = {
  Active: "bg-emerald-50 text-emerald-700",
  Done: "bg-info/10 text-info",
  Cancelled: "bg-danger/10 text-danger",
}

const statusLabels: Record<AdminLaundryOrder["status"], string> = {
  Active: "Aktif",
  Done: "Selesai",
  Cancelled: "Dibatalkan",
}

const sectionTitles = {
  active: "Sedang Berjalan",
  done: "Selesai Hari Ini",
  cancelled: "Dibatalkan",
} as const

const parseServiceChips = (summary: string) =>
  summary.split(",").map((service) => service.trim()).filter(Boolean)

function ServiceChips({ summary }: { summary: string }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {parseServiceChips(summary).map((chip) => (
        <span
          key={chip}
          className="inline-flex items-center px-2 py-0.5 rounded-md bg-bg-subtle border border-line-base text-[11px] font-medium text-text-body"
        >
          {chip}
        </span>
      ))}
    </div>
  )
}

function ElapsedBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-text-muted">
      <Timer className="h-3 w-3" />
      <span>{label}</span>
    </div>
  )
}

function LaundryOrderCard({
  order,
  onViewDetail,
  onMarkDone,
}: {
  order: AdminLaundryOrder
  onViewDetail: () => void
  onMarkDone: () => void
}) {
  return (
    <Card className="rounded-xl border-line-base bg-bg-surface hover:border-rose-200 hover:shadow-elevated transition-all group">
      <CardContent className="p-0">
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-line-base/60">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-rose-600 tracking-wide">{order.orderCode}</span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <ElapsedBadge label={order.createdAtLabel} />
          </div>
          <Badge className={cn("border-0 rounded-md text-[10px] font-semibold px-1.5", statusBadgeStyles[order.status])}>
            {statusLabels[order.status]}
          </Badge>
        </div>

        <div
          role="button"
          tabIndex={0}
          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-bg-subtle transition-colors cursor-pointer"
          onClick={onViewDetail}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              onViewDetail()
            }
          }}
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-subtle flex-shrink-0">
            <User className="h-4 w-4 text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-strong truncate">{order.customerName}</p>
            <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 flex-shrink-0" />
              {order.phone}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-text-body flex-shrink-0 transition-colors" />
        </div>

        <div className="grid grid-cols-2 gap-px bg-line-base/40 border-t border-line-base/60">
          <div className="bg-bg-surface px-3 py-2.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Berat</p>
            <p className="text-sm font-semibold text-text-strong">{order.weightKgLabel}</p>
          </div>
          <div className="bg-bg-surface px-3 py-2.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Total</p>
            <p className="text-sm font-semibold text-text-strong">{order.totalLabel}</p>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-line-base/60 bg-bg-surface">
          <p className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-1.5">Layanan</p>
          <ServiceChips summary={order.serviceSummary} />
        </div>

        {order.status === "Active" ? (
          <div className="px-4 pb-3.5 pt-2">
            <button
              type="button"
              className="w-full h-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
              onClick={onMarkDone}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Tandai Selesai
            </button>
          </div>
        ) : (
          <div className="px-4 pb-3.5 pt-2">
            <div className="rounded-lg border border-line-base bg-bg-subtle px-3 py-2 text-xs text-text-muted">
              {order.status === "Done" ? `Selesai ${order.completedAtLabel ?? ""}`.trim() : `Dibatalkan ${order.cancelledAtLabel ?? ""}`.trim()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyState({
  searchQuery,
  onClearSearch,
}: {
  searchQuery: string
  onClearSearch: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-bg-subtle">
        {searchQuery ? <Search className="h-6 w-6 text-text-muted" /> : <Shirt className="h-6 w-6 text-text-muted" />}
      </div>
      <div className="text-center">
        <p className="text-sm font-semibold text-text-strong">{searchQuery ? "Tidak ada hasil" : "Belum ada data laundry"}</p>
        <p className="text-xs text-text-muted mt-1">
          {searchQuery ? `Tidak ditemukan untuk "${searchQuery}"` : "Order dari POS akan tampil di halaman ini"}
        </p>
      </div>
      {searchQuery && (
        <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={onClearSearch}>
          Hapus pencarian
        </Button>
      )}
    </div>
  )
}

function DetailSheet({
  order,
  open,
  onOpenChange,
  onMarkDone,
}: {
  order: AdminLaundryOrder | null
  open: boolean
  onOpenChange: (value: boolean) => void
  onMarkDone: () => void
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl flex flex-col max-h-[85vh]" aria-describedby={undefined}>
        <SheetHeader className="pb-4 border-b border-line-base flex-shrink-0">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base font-semibold text-text-strong">Detail Order</SheetTitle>
            {order && <span className="font-mono text-sm font-bold text-rose-600">{order.orderCode}</span>}
          </div>
        </SheetHeader>

        {order && (
          <div className="flex-1 overflow-y-auto py-5 space-y-4">
            <div className="flex items-center justify-between">
              <Badge className={cn("border-0 rounded-md text-xs font-semibold px-2 py-1", statusBadgeStyles[order.status])}>
                {statusLabels[order.status]}
              </Badge>
              <ElapsedBadge label={order.createdAtLabel} />
            </div>

            <Card className="rounded-lg border-line-base">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-3">Pelanggan</p>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-subtle flex-shrink-0">
                    <User className="h-5 w-5 text-text-muted" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-strong">{order.customerName}</p>
                    <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3" />
                      {order.phone}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-line-base">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-3">Detail Cucian</p>
                <div className="space-y-3">
                  {[
                    { icon: Scale, label: "Berat", value: order.weightKgLabel },
                    { icon: Package, label: "Waktu Masuk", value: order.createdAtLabel },
                    ...(order.status === "Done" && order.completedAtLabel ? [{ icon: Clock, label: "Selesai", value: order.completedAtLabel }] : []),
                    ...(order.status === "Cancelled" && order.cancelledAtLabel ? [{ icon: Clock, label: "Dibatalkan", value: order.cancelledAtLabel }] : []),
                  ].map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center justify-between">
                      <span className="text-xs text-text-muted flex items-center gap-1.5">
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </span>
                      <span className="text-sm font-semibold text-text-strong">{value}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-text-muted flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5" />
                      Total
                    </span>
                    <span className="text-sm font-semibold text-text-strong">{order.totalLabel}</span>
                  </div>
                  <div className="pt-1">
                    <span className="text-xs text-text-muted flex items-center gap-1.5 mb-2">
                      <Shirt className="h-3.5 w-3.5" />
                      Layanan
                    </span>
                    <ServiceChips summary={order.serviceSummary} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-lg border-line-base bg-bg-subtle">
              <CardContent className="p-4">
                <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-3">Informasi Poin</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-text-muted flex items-center gap-1.5">
                      <Star className="h-3.5 w-3.5 text-warning" />
                      Diperoleh
                    </span>
                    <span className="text-sm font-bold text-emerald-600">+{order.earnedStamps} poin</span>
                  </div>
                  {order.redeemedPoints > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5" />
                        Digunakan
                      </span>
                      <span className="text-sm font-semibold text-text-body">-{order.redeemedPoints} poin</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <SheetFooter className="pt-4 border-t border-line-base flex-shrink-0 gap-2">
          <SheetClose asChild>
            <Button variant="outline" className="flex-1 rounded-lg">Tutup</Button>
          </SheetClose>
          {order?.status === "Active" && (
            <Button className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold" onClick={onMarkDone}>
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Tandai Selesai
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function ConfirmDoneSheet({
  order,
  open,
  onOpenChange,
  onConfirm,
  isProcessing,
}: {
  order: AdminLaundryOrder | null
  open: boolean
  onOpenChange: (value: boolean) => void
  onConfirm: () => void
  isProcessing: boolean
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
        <SheetHeader className="pb-4 border-b border-line-base">
          <SheetTitle className="text-base font-semibold text-text-strong">Konfirmasi Selesai</SheetTitle>
        </SheetHeader>
        {order && (
          <div className="py-5 space-y-3">
            <Card className="rounded-lg border-line-base bg-bg-subtle">
              <CardContent className="p-4 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Kode Order</span>
                  <span className="font-mono text-sm font-bold text-rose-600">{order.orderCode}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Pelanggan</span>
                  <span className="text-sm font-semibold text-text-strong">{order.customerName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Waktu Masuk</span>
                  <span className="text-sm text-text-body">{order.createdAtLabel}</span>
                </div>
                <div className="h-px bg-line-base" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Layanan</span>
                  <span className="text-sm font-medium text-text-body text-right">{order.serviceSummary}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-text-muted">Berat</span>
                  <span className="text-sm font-medium text-text-body">{order.weightKgLabel}</span>
                </div>
              </CardContent>
            </Card>
            <div className="flex items-start gap-2 bg-emerald-50 border border-emerald-200 rounded-lg p-3">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-emerald-700">
                Notifikasi WhatsApp akan otomatis dikirim ke pelanggan saat order ditandai selesai.
              </p>
            </div>
          </div>
        )}
        <SheetFooter className="gap-2">
          <SheetClose asChild>
            <Button variant="outline" className="flex-1 rounded-lg">Batal</Button>
          </SheetClose>
          <Button className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold" onClick={onConfirm} disabled={isProcessing}>
            {isProcessing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</> : <><CheckCircle2 className="h-4 w-4 mr-2" />Ya, Selesai</>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

export default function LaundryAktifPage() {
  const [activeTab, setActiveTab] = useState<AdminLaundryScope>("active")
  const [orders, setOrders] = useState<AdminLaundryOrder[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<AdminLaundrySort>("oldest")
  const [historyStatus, setHistoryStatus] = useState<HistoryStatusFilter>("all")
  const [includeCancelled, setIncludeCancelled] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<AdminLaundryOrder | null>(null)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [showDetailSheet, setShowDetailSheet] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadError, setLoadError] = useState("")
  const doneKeyRef = useRef<string | null>(null)

  const loadOrders = ({ append = false, cursor }: { append?: boolean; cursor?: string } = {}) => {
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
    }

    return adminApi.listLaundryOrders({
      scope: activeTab,
      search: searchQuery,
      sort: activeTab === "today" ? "newest" : sortBy,
      status: activeTab === "history" ? historyStatus : "all",
      includeCancelled: activeTab === "active" ? false : includeCancelled,
      cursor: activeTab === "history" ? cursor : undefined,
      pageSize: activeTab === "history" ? 24 : 120,
    })
      .then((payload) => {
        setOrders((current) => append ? [...current, ...payload.items] : payload.items)
        setNextCursor(payload.nextCursor ?? null)
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat data laundry"))
      .finally(() => {
        if (append) {
          setIsLoadingMore(false)
        } else {
          setIsLoading(false)
        }
      })
  }

  useEffect(() => {
    void loadOrders()
  }, [activeTab, historyStatus, includeCancelled, searchQuery, sortBy])

  useEffect(() => {
    if (activeTab === "active") {
      setSortBy("oldest")
    }
    if (activeTab === "history") {
      setSortBy("newest")
    }
  }, [activeTab])

  const todaySections = useMemo(() => {
    const active = [...orders.filter((order) => order.status === "Active")].sort((left, right) => left.createdAtIso.localeCompare(right.createdAtIso))
    const done = [...orders.filter((order) => order.status === "Done")].sort((left, right) => (right.completedAtIso ?? "").localeCompare(left.completedAtIso ?? ""))
    const cancelled = [...orders.filter((order) => order.status === "Cancelled")].sort((left, right) => (right.cancelledAtIso ?? "").localeCompare(left.cancelledAtIso ?? ""))

    return { active, done, cancelled }
  }, [orders])

  const handleMarkDone = async () => {
    if (!selectedOrder) {
      return
    }

    setIsProcessing(true)
    doneKeyRef.current ||= crypto.randomUUID()
    try {
      await adminApi.markOrderDone(selectedOrder.orderId, doneKeyRef.current)
      setShowConfirmSheet(false)
      setShowDetailSheet(false)
      setSelectedOrder(null)
      doneKeyRef.current = null
      await loadOrders()
    } finally {
      setIsProcessing(false)
    }
  }

  const openDetail = (order: AdminLaundryOrder) => {
    setSelectedOrder(order)
    setShowDetailSheet(true)
  }

  const openConfirm = (order: AdminLaundryOrder) => {
    setSelectedOrder(order)
    setShowConfirmSheet(true)
  }

  return (
    <AdminShell
      title="Laundry"
      subtitle="Monitor order aktif, hari ini, dan histori laundry"
      action={
        <Badge className="bg-emerald-50 text-emerald-700 border-0 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {orders.length}
        </Badge>
      }
    >
      <div className="px-4 py-5 lg:px-6 space-y-4">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as AdminLaundryScope)}>
          <TabsList className="w-full justify-start overflow-x-auto bg-bg-soft rounded-2xl p-1 h-auto">
            <TabsTrigger value="active" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Aktif</TabsTrigger>
            <TabsTrigger value="today" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Hari Ini</TabsTrigger>
            <TabsTrigger value="history" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">History</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <Input
              placeholder="Cari nama, HP, atau kode order..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 pl-9 pr-9 rounded-lg border-line-base bg-bg-subtle text-sm placeholder:text-text-placeholder"
            />
            {searchQuery && (
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-body" onClick={() => setSearchQuery("")}>
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {activeTab !== "today" && (
            <button
              type="button"
              className={cn(
                "flex items-center gap-1.5 h-10 px-3 rounded-lg border text-xs font-medium transition-colors",
                sortBy === "newest"
                  ? "border-rose-600 bg-rose-50 text-rose-600"
                  : "border-line-base bg-bg-subtle text-text-muted hover:text-text-body"
              )}
              onClick={() => setSortBy((current) => (current === "oldest" ? "newest" : "oldest"))}
            >
              <ArrowUpDown className="h-3.5 w-3.5" />
              {sortBy === "newest" ? "Terbaru" : "Terlama"}
            </button>
          )}
        </div>

        {(activeTab === "today" || activeTab === "history") && (
          <div className="flex items-center justify-between rounded-xl border border-line-base bg-bg-surface px-4 py-3">
            <div>
              <p className="text-sm font-medium text-text-body">Show Cancelled</p>
              <p className="text-xs text-text-muted">Tampilkan order yang dibatalkan pada daftar laundry</p>
            </div>
            <Switch checked={includeCancelled} onCheckedChange={setIncludeCancelled} />
          </div>
        )}

        {activeTab === "history" && (
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: "Semua" },
              { key: "active", label: "Aktif" },
              { key: "done", label: "Selesai" },
              ...(includeCancelled ? [{ key: "cancelled", label: "Dibatalkan" }] : []),
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setHistoryStatus(item.key as HistoryStatusFilter)}
                className={cn(
                  "h-9 px-3 rounded-lg border text-xs font-medium transition-colors",
                  historyStatus === item.key
                    ? "border-rose-600 bg-rose-50 text-rose-600"
                    : "border-line-base bg-bg-subtle text-text-muted hover:text-text-body"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="font-semibold text-text-body tabular-nums">{orders.length}</span>
          <span>{searchQuery ? "order ditemukan" : activeTab === "active" ? "order aktif" : activeTab === "today" ? "order hari ini" : "order histori"}</span>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-line-base bg-bg-surface px-4 py-3 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat data laundry...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
            <div className="flex items-center justify-between gap-3">
              <span>{loadError}</span>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => {
                void loadOrders()
              }}>
                Coba Lagi
              </Button>
            </div>
          </div>
        ) : activeTab === "today" ? (
          <div className="space-y-5">
            {(["active", "done", "cancelled"] as const).map((sectionKey) => {
              const sectionOrders = todaySections[sectionKey]
              if (sectionOrders.length === 0 || (sectionKey === "cancelled" && !includeCancelled)) {
                return null
              }

              return (
                <section key={sectionKey} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-text-strong">{sectionTitles[sectionKey]}</h3>
                    <Badge className="bg-bg-subtle text-text-body border-0 rounded-full px-2 py-0.5 text-xs">{sectionOrders.length}</Badge>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {sectionOrders.map((order) => (
                      <LaundryOrderCard
                        key={order.orderId}
                        order={order}
                        onViewDetail={() => openDetail(order)}
                        onMarkDone={() => openConfirm(order)}
                      />
                    ))}
                  </div>
                </section>
              )
            })}

            {todaySections.active.length === 0 && todaySections.done.length === 0 && todaySections.cancelled.length === 0 && (
              <EmptyState searchQuery={searchQuery} onClearSearch={() => setSearchQuery("")} />
            )}
          </div>
        ) : orders.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {orders.map((order) => (
                <LaundryOrderCard
                  key={order.orderId}
                  order={order}
                  onViewDetail={() => openDetail(order)}
                  onMarkDone={() => openConfirm(order)}
                />
              ))}
            </div>
            {activeTab === "history" && nextCursor && (
              <div className="flex justify-center">
                <Button
                  variant="outline"
                  className="rounded-lg"
                  onClick={() => {
                    void loadOrders({ append: true, cursor: nextCursor })
                  }}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memuat...</> : "Muat lebih banyak"}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <EmptyState searchQuery={searchQuery} onClearSearch={() => setSearchQuery("")} />
        )}
      </div>

      <ConfirmDoneSheet
        order={selectedOrder?.status === "Active" ? selectedOrder : null}
        open={showConfirmSheet}
        onOpenChange={setShowConfirmSheet}
        onConfirm={handleMarkDone}
        isProcessing={isProcessing}
      />

      <DetailSheet
        order={selectedOrder}
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        onMarkDone={() => {
          setShowDetailSheet(false)
          setShowConfirmSheet(true)
        }}
      />
    </AdminShell>
  )
}
