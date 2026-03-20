"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Bell,
  Settings,
  Shirt,
  AlertCircle,
  ArrowRight,
  Package,
  Star,
  Clock
} from "lucide-react"
import { adminApi } from "@/lib/api"

const timeFilters = [
  { key: "daily", label: "Hari Ini" },
  { key: "weekly", label: "Minggu Ini" },
  { key: "monthly", label: "Bulan Ini" },
]

function MetricCard({
  label,
  value,
  deltaLabel,
  tone,
  icon: Icon,
}: {
  label: string
  value: string
  deltaLabel?: string
  tone: "neutral" | "positive" | "warning"
  icon: typeof TrendingUp
}) {
  return (
    <Card className="min-w-[188px] flex-shrink-0 snap-start rounded-xl border-line-base shadow-card bg-bg-surface">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-subtle">
            <Icon className="h-4 w-4 text-text-body" />
          </div>
          {deltaLabel && (
            <span className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
              tone === "positive" && "bg-success-bg text-success",
              tone === "warning" && "bg-warning-bg text-warning",
              tone === "neutral" && "bg-bg-subtle text-text-muted"
            )}>
              {tone === "positive" && <TrendingUp className="h-3 w-3" />}
              {tone === "warning" && <TrendingDown className="h-3 w-3" />}
              {deltaLabel}
            </span>
          )}
        </div>
        <p className="text-2xl font-bold text-text-strong tabular-nums">{value}</p>
        <p className="text-xs text-text-muted mt-0.5">{label}</p>
      </CardContent>
    </Card>
  )
}

function QuickActionTile({
  href,
  icon: Icon,
  label,
  description,
}: {
  href: string
  icon: typeof ShoppingCart
  label: string
  description: string
}) {
  return (
    <Link href={href}>
      <Card className="group rounded-xl border-line-base shadow-card hover:shadow-elevated hover:border-rose-100 transition-all cursor-pointer h-full bg-bg-surface">
        <CardContent className="p-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-bg-subtle group-hover:bg-rose-50 transition-colors mb-4">
            <Icon className="h-4 w-4 text-text-body group-hover:text-rose-600 transition-colors" />
          </div>
          <h3 className="text-sm font-semibold text-text-strong">{label}</h3>
          <p className="text-xs text-text-muted mt-0.5">{description}</p>
        </CardContent>
      </Card>
    </Link>
  )
}

function AttentionCard({
  title,
  count,
  description,
  href,
  tone,
}: {
  title: string
  count: number
  description: string
  href: string
  tone: "warning" | "info"
}) {
  return (
    <Card className={cn(
      "rounded-xl border shadow-card",
      tone === "warning" && "border-warning/20 bg-warning-bg",
      tone === "info" && "border-info/20 bg-info-bg"
    )}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            tone === "warning" && "bg-warning/10",
            tone === "info" && "bg-info/10"
          )}>
            <AlertCircle className={cn(
              "h-4 w-4",
              tone === "warning" && "text-warning",
              tone === "info" && "text-info"
            )} />
          </div>
          <span className={cn(
            "text-2xl font-bold tabular-nums",
            tone === "warning" && "text-warning",
            tone === "info" && "text-info"
          )}>
            {count}
          </span>
        </div>
        <h3 className="mt-3 text-sm font-semibold text-text-strong">{title}</h3>
        <p className="text-xs text-text-muted mt-0.5">{description}</p>
        <Link
          href={href}
          className={cn(
            "inline-flex items-center gap-1 mt-3 text-xs font-semibold",
            tone === "warning" && "text-warning",
            tone === "info" && "text-info"
          )}
        >
          Lihat Detail <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const [timeFilter, setTimeFilter] = useState("daily")
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof adminApi.getDashboard>> | null>(null)

  useEffect(() => {
    adminApi.getDashboard(timeFilter as "daily" | "weekly" | "monthly")
      .then(setDashboard)
      .catch(() => undefined)
  }, [timeFilter])

  const activeOrders = dashboard?.activeOrders ?? []
  const notifications = dashboard?.notifications ?? []
  const metrics = dashboard?.metrics
  const failedNotifications = notifications.filter(
    (n) => n.deliveryStatus === "failed"
  ).length

  const today = new Date()
  const greeting =
    today.getHours() < 12 ? "Selamat Pagi"
    : today.getHours() < 18 ? "Selamat Siang"
    : "Selamat Malam"

  const formattedDate = today.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  return (
    <AdminShell title="Dashboard" subtitle={formattedDate}>
      <div className="px-4 py-6 lg:px-6 space-y-7">
        {/* Greeting row */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-xl text-text-strong">{greeting}!</h2>
            <p className="text-sm text-text-muted mt-0.5">
              Ringkasan operasional CJ Laundry
            </p>
          </div>
        </div>

        {/* Time Filter */}
        <div className="flex gap-1.5">
          {timeFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() => setTimeFilter(filter.key)}
              className={cn(
                "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all",
                timeFilter === filter.key
                  ? "bg-text-strong text-white shadow-sm"
                  : "bg-bg-surface border border-line-base text-text-body hover:bg-bg-subtle"
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="overflow-x-auto -mx-4 px-4 lg:mx-0 lg:px-0">
          <div className="flex gap-3 snap-x snap-mandatory lg:grid lg:grid-cols-4">
            <MetricCard
              label="Penjualan Hari Ini"
              value={metrics?.[0]?.value ?? "Rp 0"}
              deltaLabel={metrics?.[0]?.deltaLabel}
              tone={metrics?.[0]?.tone ?? "positive"}
              icon={TrendingUp}
            />
            <MetricCard
              label="Order Aktif"
              value={metrics?.[1]?.value ?? activeOrders.length.toString()}
              tone={metrics?.[1]?.tone ?? "neutral"}
              icon={Shirt}
            />
            <MetricCard
              label="Order Selesai"
              value={metrics?.[2]?.value ?? "0"}
              deltaLabel={metrics?.[2]?.deltaLabel}
              tone={metrics?.[2]?.tone ?? "positive"}
              icon={Package}
            />
            <MetricCard
              label="Poin Diberikan"
              value={metrics?.[3]?.value ?? "0"}
              deltaLabel={metrics?.[3]?.deltaLabel}
              tone={metrics?.[3]?.tone ?? "positive"}
              icon={Star}
            />
          </div>
        </div>

        {/* Attention */}
        {(failedNotifications > 0 || activeOrders.length > 5) && (
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-text-strong">Perlu Perhatian</h3>
            <div className="grid gap-3 md:grid-cols-2">
              {failedNotifications > 0 && (
                <AttentionCard
                  title="Notifikasi Gagal"
                  count={failedNotifications}
                  description="Ada notifikasi WhatsApp yang perlu ditangani"
                  href="/admin/notifikasi"
                  tone="warning"
                />
              )}
              {activeOrders.length > 5 && (
                <AttentionCard
                  title="Order Menumpuk"
                  count={activeOrders.length}
                  description="Ada order aktif yang belum diselesaikan"
                  href="/admin/laundry-aktif"
                  tone="info"
                />
              )}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-text-strong">Aksi Cepat</h3>
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <QuickActionTile href="/admin/pos" icon={ShoppingCart} label="Buat Order" description="Order laundry baru" />
            <QuickActionTile href="/admin/pelanggan" icon={Users} label="Cari Customer" description="Lihat data pelanggan" />
            <QuickActionTile href="/admin/notifikasi" icon={Bell} label="Notifikasi" description="Status pengiriman WA" />
            <QuickActionTile href="/admin/settings" icon={Settings} label="Edit Harga" description="Atur harga layanan" />
          </div>
        </div>

        {/* Recent Activity */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-strong">Order Aktif Terbaru</h3>
            <Link
              href="/admin/laundry-aktif"
              className="text-xs font-semibold text-rose-600 hover:text-rose-500 inline-flex items-center gap-1"
            >
              Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="space-y-2">
            {activeOrders.slice(0, 4).map((order) => (
              <Card key={order.orderId} className="rounded-xl border-line-base shadow-card bg-bg-surface">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold text-rose-600">
                          {order.orderCode}
                        </span>
                        <span className="inline-flex items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                          Aktif
                        </span>
                      </div>
                      <p className="text-sm font-medium text-text-strong mt-0.5 truncate">
                        {order.customerName}
                      </p>
                      <p className="text-xs text-text-muted truncate">{order.serviceSummary}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-text-strong">{order.weightKgLabel}</p>
                      <p className="text-[11px] text-text-muted flex items-center gap-1 mt-0.5 justify-end">
                        <Clock className="h-3 w-3" />
                        {order.createdAtLabel}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
