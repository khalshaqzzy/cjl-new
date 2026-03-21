"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ActiveOrderCard as ActiveOrderCardType } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
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
  Search,
  Phone,
  Clock,
  Scale,
  Star,
  CheckCircle2,
  Loader2,
  User,
  Shirt,
  Package,
  ChevronRight,
  Timer,
  ArrowUpDown,
  X,
} from "lucide-react"
import { adminApi } from "@/lib/api"

type SortOption = "oldest" | "newest"

// Menghitung berapa lama order sudah masuk (mock: dari label waktu)
function ElapsedBadge({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-1 text-xs text-text-muted">
      <Timer className="h-3 w-3" />
      <span>{label}</span>
    </div>
  )
}

// Parse "2 Washer, 1 Dryer, Setrika" → ["2 Washer", "1 Dryer", "Setrika"]
function parseServiceChips(summary: string): string[] {
  return summary.split(",").map((s) => s.trim()).filter(Boolean)
}

function ServiceChips({ summary }: { summary: string }) {
  const chips = parseServiceChips(summary)
  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
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

function ActiveOrderCard({
  order,
  onMarkDone,
  onViewDetail,
}: {
  order: ActiveOrderCardType
  onMarkDone: () => void
  onViewDetail: () => void
}) {
  return (
    <Card className="rounded-xl border-line-base bg-bg-surface hover:border-rose-200 hover:shadow-elevated transition-all group">
      <CardContent className="p-0">        {/* Top strip */}
        <div className="flex items-center justify-between px-4 pt-3.5 pb-2.5 border-b border-line-base/60">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-rose-600 tracking-wide">
              {order.orderCode}
            </span>
            <span className="h-1 w-1 rounded-full bg-line-strong" />
            <ElapsedBadge label={order.createdAtLabel} />
          </div>
          <Badge className="bg-emerald-50 text-emerald-700 border-0 rounded-md text-[10px] font-semibold px-1.5">
            Aktif
          </Badge>
        </div>

        {/* Customer row — clickable */}
        <div
          role="button"
          tabIndex={0}
          className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-bg-subtle transition-colors cursor-pointer"
          onClick={onViewDetail}
          onKeyDown={(e) => e.key === "Enter" && onViewDetail()}
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

        {/* Stat row: berat + poin */}
        <div className="grid grid-cols-2 gap-px bg-line-base/40 border-t border-line-base/60">
          <div className="bg-bg-surface px-3 py-2.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Berat</p>
            <p className="text-sm font-semibold text-text-strong">{order.weightKgLabel}</p>
          </div>
          <div className="bg-bg-surface px-3 py-2.5">
            <p className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-0.5">Poin Diperoleh</p>
            <p className="text-sm font-semibold text-emerald-600">
              +{order.earnedStamps}
              {order.redeemedPoints > 0 && (
                <span className="text-text-muted font-normal text-xs ml-1">(-{order.redeemedPoints} redeem)</span>
              )}
            </p>
          </div>
        </div>

        {/* Layanan: full-width, badge chips wrap */}
        <div className="px-4 py-3 border-t border-line-base/60 bg-bg-surface">
          <p className="text-[10px] text-text-muted uppercase tracking-wide font-medium mb-1.5">Layanan</p>
          <ServiceChips summary={order.serviceSummary} />
        </div>

        {/* CTA */}
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
      </CardContent>
    </Card>
  )
}

export default function LaundryAktifPage() {
  const [orders, setOrders] = useState<ActiveOrderCardType[]>([])
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("oldest")
  const [selectedOrder, setSelectedOrder] = useState<ActiveOrderCardType | null>(null)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [showDetailSheet, setShowDetailSheet] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const doneKeyRef = useRef<string | null>(null)

  useEffect(() => {
    adminApi.listActiveOrders()
      .then((payload) => {
        setOrders(payload)
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat order aktif"))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return orders
      .filter((o) => {
        if (!q) return true
        return (
          o.customerName.toLowerCase().includes(q) ||
          o.phone.includes(q) ||
          o.orderCode.toLowerCase().includes(q)
        )
      })
      .sort((a, b) => (sortBy === "newest" ? -1 : 1))
  }, [orders, searchQuery, sortBy])

  const handleMarkDone = async () => {
    if (!selectedOrder) return
    setIsProcessing(true)
    doneKeyRef.current ||= crypto.randomUUID()
    await adminApi.markOrderDone(selectedOrder.orderId, doneKeyRef.current)
    setOrders((prev) => prev.filter((o) => o.orderId !== selectedOrder.orderId))
    setIsProcessing(false)
    setShowConfirmSheet(false)
    setShowDetailSheet(false)
    setSelectedOrder(null)
    doneKeyRef.current = null
  }

  return (
    <AdminShell
      title="Laundry Aktif"
      subtitle={`${orders.length} order sedang berjalan`}
      action={
        <Badge className="bg-emerald-50 text-emerald-700 border-0 rounded-full px-2.5 py-0.5 text-xs font-semibold">
          {orders.length}
        </Badge>
      }
    >
      <div className="px-4 py-5 lg:px-6 space-y-4">

        {/* Toolbar */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
            <Input
              placeholder="Cari nama, HP, atau kode order..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-9 rounded-lg border-line-base bg-bg-subtle text-sm placeholder:text-text-placeholder"
            />
            {searchQuery && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-body"
                onClick={() => setSearchQuery("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 h-10 px-3 rounded-lg border text-xs font-medium transition-colors",
              sortBy === "newest"
                ? "border-rose-600 bg-rose-50 text-rose-600"
                : "border-line-base bg-bg-subtle text-text-muted hover:text-text-body"
            )}
            onClick={() => setSortBy((s) => (s === "oldest" ? "newest" : "oldest"))}
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            {sortBy === "newest" ? "Terbaru" : "Terlama"}
          </button>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 text-xs text-text-muted">
          <span className="font-semibold text-text-body tabular-nums">{filteredOrders.length}</span>
          <span>order {searchQuery ? "ditemukan" : "aktif"}</span>
          {searchQuery && (
            <span className="text-text-muted">dari {orders.length} total</span>
          )}
        </div>

        {/* Orders grid */}
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-line-base bg-bg-surface px-4 py-3 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat order aktif...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
            {loadError}
          </div>
        ) : filteredOrders.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => (
              <ActiveOrderCard
                key={order.orderId}
                order={order}
                onMarkDone={() => {
                  setSelectedOrder(order)
                  setShowConfirmSheet(true)
                }}
                onViewDetail={() => {
                  setSelectedOrder(order)
                  setShowDetailSheet(true)
                }}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-bg-subtle">
              {searchQuery ? (
                <Search className="h-6 w-6 text-text-muted" />
              ) : (
                <Shirt className="h-6 w-6 text-text-muted" />
              )}
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-text-strong">
                {searchQuery ? "Tidak ada hasil" : "Belum ada order aktif"}
              </p>
              <p className="text-xs text-text-muted mt-1">
                {searchQuery ? `Tidak ditemukan untuk "${searchQuery}"` : "Order baru dari POS akan muncul di sini"}
              </p>
            </div>
            {searchQuery && (
              <Button variant="outline" size="sm" className="rounded-lg text-xs" onClick={() => setSearchQuery("")}>
                Hapus pencarian
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Confirm Done Sheet */}
      <Sheet open={showConfirmSheet} onOpenChange={setShowConfirmSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">Konfirmasi Selesai</SheetTitle>
          </SheetHeader>
          {selectedOrder && (
            <div className="py-5 space-y-3">
              <Card className="rounded-lg border-line-base bg-bg-subtle">
                <CardContent className="p-4 space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted">Kode Order</span>
                    <span className="font-mono text-sm font-bold text-rose-600">{selectedOrder.orderCode}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted">Pelanggan</span>
                    <span className="text-sm font-semibold text-text-strong">{selectedOrder.customerName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted">Waktu Masuk</span>
                    <span className="text-sm text-text-body">{selectedOrder.createdAtLabel}</span>
                  </div>
                  <div className="h-px bg-line-base" />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted">Layanan</span>
                    <span className="text-sm font-medium text-text-body">{selectedOrder.serviceSummary}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-muted">Berat</span>
                    <span className="text-sm font-medium text-text-body">{selectedOrder.weightKgLabel}</span>
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
            <Button
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              onClick={handleMarkDone}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4 mr-2" />Ya, Selesai</>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Detail Sheet */}
      <Sheet open={showDetailSheet} onOpenChange={setShowDetailSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl flex flex-col max-h-[85vh]" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base flex-shrink-0">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base font-semibold text-text-strong">Detail Order</SheetTitle>
              {selectedOrder && (
                <span className="font-mono text-sm font-bold text-rose-600">{selectedOrder.orderCode}</span>
              )}
            </div>
          </SheetHeader>

          {selectedOrder && (
            <div className="flex-1 overflow-y-auto py-5 space-y-4">
              {/* Status */}
              <div className="flex items-center justify-between">
                <Badge className="bg-emerald-50 text-emerald-700 border-0 rounded-md text-xs font-semibold px-2 py-1">
                  Sedang Berjalan
                </Badge>
                <ElapsedBadge label={selectedOrder.createdAtLabel} />
              </div>

              {/* Customer */}
              <Card className="rounded-lg border-line-base">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-3">Pelanggan</p>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-subtle flex-shrink-0">
                      <User className="h-5 w-5 text-text-muted" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-text-strong">{selectedOrder.customerName}</p>
                      <p className="text-xs text-text-muted flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {selectedOrder.phone}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Order detail rows */}
              <Card className="rounded-lg border-line-base">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-3">Detail Cucian</p>
                  <div className="space-y-3">
                    {[
                      { icon: Scale, label: "Berat", value: selectedOrder.weightKgLabel },
                      { icon: Package, label: "Waktu Masuk", value: selectedOrder.createdAtLabel },
                    ].map(({ icon: Icon, label, value }) => (
                      <div key={label} className="flex items-center justify-between">
                        <span className="text-xs text-text-muted flex items-center gap-1.5">
                          <Icon className="h-3.5 w-3.5" />
                          {label}
                        </span>
                        <span className="text-sm font-semibold text-text-strong">{value}</span>
                      </div>
                    ))}
                    {/* Layanan as chips */}
                    <div className="pt-1">
                      <span className="text-xs text-text-muted flex items-center gap-1.5 mb-2">
                        <Shirt className="h-3.5 w-3.5" />
                        Layanan
                      </span>
                      <ServiceChips summary={selectedOrder.serviceSummary} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Points */}
              <Card className="rounded-lg border-line-base bg-bg-subtle">
                <CardContent className="p-4">
                  <p className="text-[10px] font-semibold text-text-muted uppercase tracking-wide mb-3">Informasi Poin</p>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-text-muted flex items-center gap-1.5">
                        <Star className="h-3.5 w-3.5 text-warning" />
                        Akan diperoleh
                      </span>
                      <span className="text-sm font-bold text-emerald-600">+{selectedOrder.earnedStamps} poin</span>
                    </div>
                    {selectedOrder.redeemedPoints > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-text-muted flex items-center gap-1.5">
                          <Star className="h-3.5 w-3.5" />
                          Digunakan (redeem)
                        </span>
                        <span className="text-sm font-semibold text-text-body">-{selectedOrder.redeemedPoints} poin</span>
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
            <Button
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              onClick={() => {
                setShowDetailSheet(false)
                setShowConfirmSheet(true)
              }}
            >
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Tandai Selesai
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AdminShell>
  )
}
