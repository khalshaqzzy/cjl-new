"use client"

import { useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { cn } from "@/lib/utils"
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Bell,
  Clock,
  Package,
  Settings,
  Shirt,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react"
import { adminApi } from "@/lib/api"

type DashboardWindow = "daily" | "weekly" | "monthly"
type ChartMetric = "netSales" | "itemsSold" | "operationalUnits"
type DashboardPayload = Awaited<ReturnType<typeof adminApi.getDashboard>>
type ServiceChartOption = {
  serviceCode: string
  label: string
  quantity: number
}

const timeFilters: Array<{ key: DashboardWindow; label: string }> = [
  { key: "daily", label: "Hari Ini" },
  { key: "weekly", label: "Minggu Ini" },
  { key: "monthly", label: "Bulan Ini" },
]

const chartMetrics: Array<{
  key: ChartMetric
  label: string
  dataLabel: string
  color: string
}> = [
  { key: "netSales", label: "Pendapatan", dataLabel: "Pendapatan", color: "var(--rose-500)" },
  { key: "itemsSold", label: "Items", dataLabel: "Items terjual", color: "var(--info)" },
  { key: "operationalUnits", label: "Unit", dataLabel: "Unit operasional", color: "var(--success)" },
]

const compactNumber = (value: number) =>
  new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 }).format(value)

const roundDashboardQuantity = (value: number) => Number(value.toFixed(2))

const currency = (value: number) =>
  `Rp ${new Intl.NumberFormat("id-ID").format(value)}`

const shortCurrency = (value: number) => {
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)} jt`
  }

  if (value >= 1_000) {
    return `Rp ${Math.round(value / 1_000)} rb`
  }

  return currency(value)
}

function SectionHeader({
  title,
  action,
  caption,
}: {
  title: string
  action?: ReactNode
  caption?: string
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-text-strong">{title}</h3>
        {caption && <p className="mt-0.5 truncate text-xs text-text-muted">{caption}</p>}
      </div>
      {action}
    </div>
  )
}

function KpiCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = "neutral",
}: {
  label: string
  value: string
  helper?: string
  icon: LucideIcon
  tone?: "neutral" | "positive" | "warning"
}) {
  return (
    <Card className={cn(
      "min-w-0 overflow-hidden rounded-lg border-line-base bg-bg-surface shadow-sm",
      tone === "positive" && "border-t-2 border-t-success",
      tone === "warning" && "border-t-2 border-t-warning",
      tone === "neutral" && "border-t-2 border-t-line-base"
    )}>
      <CardContent className="p-3 sm:p-3.5">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
            tone === "positive" && "bg-success-bg/70",
            tone === "warning" && "bg-warning-bg/70",
            tone === "neutral" && "bg-bg-subtle"
          )}>
            <Icon className={cn(
              "h-3.5 w-3.5",
              tone === "positive" && "text-success",
              tone === "warning" && "text-warning",
              tone === "neutral" && "text-text-body"
            )} />
          </div>
          {helper && (
            <span className="max-w-[96px] truncate text-[10px] font-semibold uppercase tracking-normal text-text-muted sm:max-w-none">
              {helper}
            </span>
          )}
        </div>
        <p className="truncate text-[17px] font-bold leading-tight text-text-strong tabular-nums sm:text-xl">
          {value}
        </p>
        <p className="mt-1 truncate text-[11px] font-medium text-text-muted">{label}</p>
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
  icon: LucideIcon
  label: string
  description: string
}) {
  return (
    <Link href={href} className="min-w-0">
      <Card className="group h-full rounded-xl border-line-base bg-bg-surface shadow-card transition-all hover:border-rose-100 hover:shadow-elevated">
        <CardContent className="p-4">
          <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-bg-subtle transition-colors group-hover:bg-rose-50">
            <Icon className="h-4 w-4 text-text-body transition-colors group-hover:text-rose-600" />
          </div>
          <h3 className="truncate text-sm font-semibold text-text-strong">{label}</h3>
          <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{description}</p>
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
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-strong">{title}</h3>
            <p className="mt-0.5 line-clamp-2 text-xs text-text-muted">{description}</p>
          </div>
          <span className={cn(
            "shrink-0 text-2xl font-bold tabular-nums",
            tone === "warning" && "text-warning",
            tone === "info" && "text-info"
          )}>
            {count}
          </span>
        </div>
        <Link
          href={href}
          className={cn(
            "mt-3 inline-flex items-center gap-1 text-xs font-semibold",
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

function SummaryRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2">
      <span className="truncate text-xs text-text-muted">{label}</span>
      <span className="shrink-0 text-sm font-semibold text-text-strong tabular-nums">{value}</span>
    </div>
  )
}

export default function DashboardPage() {
  const [timeFilter, setTimeFilter] = useState<DashboardWindow>("daily")
  const [chartMetric, setChartMetric] = useState<ChartMetric>("netSales")
  const [selectedItemService, setSelectedItemService] = useState<string>("")
  const [dashboard, setDashboard] = useState<DashboardPayload | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    setIsLoading(true)
    adminApi.getDashboard(timeFilter)
      .then((payload) => {
        setDashboard(payload)
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat dashboard"))
      .finally(() => setIsLoading(false))
  }, [timeFilter])

  const activeOrders = dashboard?.activeOrders ?? []
  const notifications = dashboard?.notifications ?? []
  const summary = dashboard?.summary
  const topCustomers = dashboard?.topCustomers ?? []
  const failedNotifications = notifications.filter((n) => n.deliveryStatus === "failed").length
  const itemChartOptions = useMemo(() => {
    const options = new Map<string, ServiceChartOption>()

    for (const bucket of dashboard?.chart.series ?? []) {
      for (const item of bucket.itemsByService) {
        const current = options.get(item.serviceCode)
        if (current) {
          current.quantity = roundDashboardQuantity(current.quantity + item.quantity)
        } else {
          options.set(item.serviceCode, {
            serviceCode: item.serviceCode,
            label: item.label,
            quantity: item.quantity,
          })
        }
      }
    }

    return [...options.values()]
      .filter((item) => item.quantity > 0)
      .sort((a, b) => b.quantity - a.quantity || a.label.localeCompare(b.label))
  }, [dashboard])
  const activeItemService = selectedItemService || itemChartOptions[0]?.serviceCode || ""
  const activeItemOption = itemChartOptions.find((item) => item.serviceCode === activeItemService)
  const selectedChartMetric = chartMetrics.find((metric) => metric.key === chartMetric) ?? chartMetrics[0]
  const chartData = useMemo(() => {
    if (!dashboard) {
      return []
    }

    if (chartMetric !== "itemsSold") {
      return dashboard.chart.series
    }

    return dashboard.chart.series.map((bucket) => ({
      ...bucket,
      itemsSold: bucket.itemsByService.find((item) => item.serviceCode === activeItemService)?.quantity ?? 0,
    }))
  }, [activeItemService, chartMetric, dashboard])
  const chartConfig = {
    [chartMetric]: {
      label: chartMetric === "itemsSold" && activeItemOption ? activeItemOption.label : selectedChartMetric.dataLabel,
      color: selectedChartMetric.color,
    },
  } satisfies ChartConfig

  useEffect(() => {
    if (chartMetric !== "itemsSold") {
      return
    }

    if (!selectedItemService && itemChartOptions[0]) {
      setSelectedItemService(itemChartOptions[0].serviceCode)
      return
    }

    if (selectedItemService && !itemChartOptions.some((item) => item.serviceCode === selectedItemService)) {
      setSelectedItemService(itemChartOptions[0]?.serviceCode ?? "")
    }
  }, [chartMetric, itemChartOptions, selectedItemService])

  const today = new Date()
  const periodLabel = timeFilters.find((filter) => filter.key === timeFilter)?.label ?? ""
  const isTodayView = timeFilter === "daily"
  const periodAverage = timeFilter === "monthly"
    ? dashboard?.periodAverages.month
    : dashboard?.periodAverages.week
  const elapsedPeriodDays = periodAverage?.elapsedDays ?? 1
  const averageOperationalUnits = summary
    ? roundDashboardQuantity(summary.operationalUnits / elapsedPeriodDays)
    : 0
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

  const kpiCards = summary && dashboard
    ? isTodayView
      ? [
          {
            label: "Penjualan Bersih",
            value: currency(summary.netSales),
            helper: "Hari ini",
            icon: TrendingUp,
            tone: "positive" as const,
          },
          {
            label: "Unit Operasional",
            value: compactNumber(summary.operationalUnits),
            helper: "Mesin/paket",
            icon: Sparkles,
            tone: "positive" as const,
          },
          {
            label: "Items Terjual",
            value: compactNumber(summary.totalItemsSold),
            helper: "Semua item",
            icon: Package,
            tone: "positive" as const,
          },
          {
            label: "Order Aktif",
            value: String(summary.activeOrders),
            helper: `${summary.completedOrders} selesai`,
            icon: Shirt,
            tone: summary.activeOrders > 5 ? "warning" as const : "neutral" as const,
          },
        ]
      : [
          {
            label: "Total Penjualan Bersih",
            value: currency(summary.netSales),
            helper: periodLabel,
            icon: TrendingUp,
            tone: "positive" as const,
          },
          {
            label: "Avg Penjualan / Hari",
            value: periodAverage?.averageDailyRevenueLabel ?? currency(0),
            helper: `${elapsedPeriodDays} hari`,
            icon: WalletCards,
            tone: "neutral" as const,
          },
          {
            label: "Avg Mesin / Hari",
            value: compactNumber(averageOperationalUnits),
            helper: "Unit/hari",
            icon: BarChart3,
            tone: "neutral" as const,
          },
          {
            label: "Total Mesin",
            value: compactNumber(summary.operationalUnits),
            helper: "Unit",
            icon: Sparkles,
            tone: "positive" as const,
          },
        ]
    : []

  return (
    <AdminShell title="Dashboard" subtitle={formattedDate}>
      <div className="w-full overflow-x-hidden px-4 py-5 lg:px-6 lg:py-6">
        <div className="mx-auto max-w-7xl space-y-5 lg:space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h2 className="truncate text-xl font-semibold text-text-strong">{greeting}!</h2>
              <p className="mt-0.5 truncate text-sm text-text-muted">Ringkasan operasional CJ Laundry</p>
            </div>

            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-line-base bg-bg-surface p-1 shadow-card sm:flex sm:w-auto">
              {timeFilters.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() => setTimeFilter(filter.key)}
                  className={cn(
                    "min-w-0 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-all sm:px-3.5 sm:py-1.5 sm:text-xs",
                    timeFilter === filter.key
                      ? "bg-text-strong text-white shadow-sm"
                      : "text-text-body hover:bg-bg-subtle"
                  )}
                >
                  <span className="block truncate">{filter.label}</span>
                </button>
              ))}
            </div>
          </div>

          {(failedNotifications > 0 || activeOrders.length > 5) && (
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
          )}

          {isLoading && (
            <div className="flex items-center gap-2 rounded-xl border border-line-base bg-bg-surface px-4 py-3 text-sm text-text-muted">
              <Clock className="h-4 w-4 animate-pulse" />
              Memuat dashboard...
            </div>
          )}

          {loadError && (
            <div className="flex items-start gap-2 rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {summary && dashboard && (
            <>
              <div className={cn(
                "grid grid-cols-2 gap-3",
                isTodayView ? "lg:grid-cols-4" : "lg:grid-cols-4"
              )}>
                {kpiCards.map((metric) => (
                  <KpiCard key={metric.label} {...metric} />
                ))}
              </div>

              <div className={cn(
                "grid gap-3",
                isTodayView ? "xl:grid-cols-1" : "xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.85fr)]"
              )}>
                {!isTodayView && (
                  <Card className="min-w-0 rounded-xl border-line-base bg-bg-surface shadow-card">
                    <CardContent className="p-4 sm:p-5">
                      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-text-strong">Grafik Operasional</h3>
                          <p className="mt-0.5 truncate text-xs text-text-muted">
                            {chartMetric === "itemsSold" && activeItemOption
                              ? `${activeItemOption.label} - ${periodLabel}`
                              : `Periode ${periodLabel}`}
                          </p>
                        </div>
                        <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-bg-subtle p-1 sm:w-auto">
                          {chartMetrics.map((metric) => (
                            <button
                              key={metric.key}
                              type="button"
                              onClick={() => setChartMetric(metric.key)}
                              className={cn(
                                "min-w-0 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-colors",
                                chartMetric === metric.key
                                  ? "bg-bg-surface text-text-strong shadow-sm"
                                  : "text-text-muted hover:text-text-body"
                              )}
                            >
                              <span className="block truncate">{metric.label}</span>
                            </button>
                          ))}
                        </div>
                      </div>

                      {chartMetric === "itemsSold" && (
                        <div className="mb-4 space-y-2 rounded-lg bg-bg-subtle p-2.5">
                          <p className="px-1 text-[11px] font-semibold uppercase tracking-normal text-text-muted">
                            Pilih item di grafik
                          </p>
                          {itemChartOptions.length > 0 ? (
                            <div className="flex gap-1.5 overflow-x-auto pb-0.5 sm:flex-wrap sm:overflow-visible">
                              {itemChartOptions.map((item) => (
                                <button
                                  key={item.serviceCode}
                                  type="button"
                                  onClick={() => setSelectedItemService(item.serviceCode)}
                                  className={cn(
                                    "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-semibold transition-colors",
                                    activeItemService === item.serviceCode
                                      ? "bg-bg-surface text-text-strong shadow-sm"
                                      : "text-text-muted hover:text-text-body"
                                  )}
                                >
                                  <span className="inline-flex max-w-[140px] items-center gap-1 truncate">
                                    <span className="truncate">{item.label}</span>
                                    <span className="font-mono tabular-nums">{compactNumber(item.quantity)}</span>
                                  </span>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="px-1 text-xs text-text-muted">Belum ada item pada periode ini.</p>
                          )}
                        </div>
                      )}

                      <ChartContainer config={chartConfig} className="h-[270px] w-full aspect-auto sm:h-[300px]">
                        <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="dashboardMetricFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={selectedChartMetric.color} stopOpacity={0.28} />
                              <stop offset="95%" stopColor={selectedChartMetric.color} stopOpacity={0.03} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid vertical={false} strokeDasharray="3 3" />
                          <XAxis
                            dataKey="label"
                            tickLine={false}
                            axisLine={false}
                            tickMargin={8}
                            minTickGap={timeFilter === "monthly" ? 18 : 8}
                          />
                          <YAxis
                            width={42}
                            tickLine={false}
                            axisLine={false}
                            tickMargin={6}
                            tickFormatter={(value) => chartMetric === "netSales" ? shortCurrency(Number(value)).replace("Rp ", "") : compactNumber(Number(value))}
                          />
                          <ChartTooltip
                            content={
                              <ChartTooltipContent
                                labelClassName="text-text-strong"
                                formatter={(value) => (
                                  <span className="font-mono font-semibold tabular-nums text-text-strong">
                                    {chartMetric === "netSales" ? currency(Number(value)) : compactNumber(Number(value))}
                                  </span>
                                )}
                              />
                            }
                          />
                          <Area
                            type="monotone"
                            dataKey={chartMetric}
                            stroke={selectedChartMetric.color}
                            fill="url(#dashboardMetricFill)"
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </AreaChart>
                      </ChartContainer>
                    </CardContent>
                  </Card>
                )}

                <Card className="min-w-0 rounded-xl border-line-base bg-bg-surface shadow-card">
                  <CardContent className="p-4 sm:p-5">
                    <SectionHeader title="Ringkasan Detail" caption="Angka mentah periode aktif" />
                    <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                      <SummaryRow label="Penjualan Kotor" value={currency(summary.grossSales)} />
                      <SummaryRow label="Total Diskon" value={currency(summary.discountTotal)} />
                      <SummaryRow label="Order Terkonfirmasi" value={String(summary.confirmedOrders)} />
                      <SummaryRow label="Berat Diproses" value={`${summary.totalWeightKg.toFixed(1)} kg`} />
                      <SummaryRow label="Rata-rata Order" value={currency(summary.averageOrderValue)} />
                      <SummaryRow label="Customer Baru" value={String(summary.newCustomers)} />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-3 xl:grid-cols-2">
                <Card className="min-w-0 rounded-xl border-line-base bg-bg-surface shadow-card">
                  <CardContent className="p-4 sm:p-5">
                    <SectionHeader
                      title="Semua Layanan"
                      caption={`${summary.topServiceUsage.length} item pada periode ${periodLabel}`}
                    />
                    <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {summary.topServiceUsage.length > 0 ? (
                        summary.topServiceUsage.map((service) => (
                          <div key={service.serviceCode} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2">
                            <span className="truncate text-sm text-text-body">{service.label}</span>
                            <span className="shrink-0 text-sm font-semibold text-text-strong tabular-nums">{compactNumber(service.usageCount)}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg bg-bg-subtle px-3 py-4 text-sm text-text-muted">
                          Belum ada data penggunaan layanan pada periode ini.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="min-w-0 rounded-xl border-line-base bg-bg-surface shadow-card">
                  <CardContent className="p-4 sm:p-5">
                    <SectionHeader title="Pelanggan Teratas" caption={`${topCustomers.length} dari maksimal 30 pelanggan`} />
                    <div className="mt-3 max-h-[360px] space-y-2 overflow-y-auto pr-1">
                      {topCustomers.length > 0 ? (
                        topCustomers.map((customer, index) => (
                          <div key={customer.customerId} className="flex min-w-0 items-center justify-between gap-3 rounded-lg bg-bg-subtle px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-text-body">{index + 1}. {customer.customerName}</p>
                              <p className="truncate text-xs text-text-muted">{customer.confirmedOrders} order - {customer.earnedStamps} poin</p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold text-text-strong tabular-nums">{customer.currentPoints ?? 0}</span>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-lg bg-bg-subtle px-3 py-4 text-sm text-text-muted">
                          Belum ada data pelanggan teratas pada periode ini.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          )}

          <div className="space-y-3">
            <SectionHeader title="Aksi Cepat" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <QuickActionTile href="/admin/pos" icon={ShoppingCart} label="Buat Order" description="Order laundry baru" />
              <QuickActionTile href="/admin/pelanggan" icon={Users} label="Cari Customer" description="Lihat data pelanggan" />
              <QuickActionTile href="/admin/notifikasi" icon={Bell} label="Notifikasi" description="Status pengiriman WA" />
              <QuickActionTile href="/admin/settings" icon={Settings} label="Edit Harga" description="Atur harga layanan" />
            </div>
          </div>

          <div className="space-y-3">
            <SectionHeader
              title="Order Aktif Terbaru"
              action={
                <Link href="/admin/laundry-aktif" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-500">
                  Lihat Semua <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              }
            />
            <div className="space-y-2">
              {activeOrders.slice(0, 4).length > 0 ? (
                activeOrders.slice(0, 4).map((order) => (
                  <Card key={order.orderId} className="rounded-xl border-line-base bg-bg-surface shadow-card">
                    <CardContent className="p-4">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="truncate font-mono text-xs font-semibold text-rose-600">{order.orderCode}</span>
                            <span className="inline-flex shrink-0 items-center rounded-md bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">
                              Aktif
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-sm font-medium text-text-strong">{order.customerName}</p>
                          <p className="truncate text-xs text-text-muted">{order.serviceSummary}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-semibold text-text-strong">{order.weightKgLabel}</p>
                          <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-text-muted">
                            <Clock className="h-3 w-3" />
                            <span className="max-w-[88px] truncate sm:max-w-none">{order.createdAtLabel}</span>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="rounded-xl border border-line-base bg-bg-surface px-4 py-5 text-sm text-text-muted shadow-card">
                  Belum ada order aktif.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  )
}
