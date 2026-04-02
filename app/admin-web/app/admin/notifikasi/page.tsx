"use client"

import { useEffect, useState } from "react"
import type { NotificationRecord } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  FileImage,
  Loader2,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  User,
  XCircle,
} from "lucide-react"

const eventTypeLabels: Record<string, string> = {
  welcome: "Registrasi",
  order_confirmed: "Order Dikonfirmasi",
  order_done: "Order Selesai",
  order_void_notice: "Order Dibatalkan",
  account_info: "Info Akun",
}

const statusConfig = {
  queued: {
    label: "Menunggu",
    icon: Clock,
    className: "bg-info/10 text-info",
  },
  sent: {
    label: "Terkirim",
    icon: CheckCircle2,
    className: "bg-success/10 text-success",
  },
  failed: {
    label: "Gagal",
    icon: XCircle,
    className: "bg-danger/10 text-danger",
  },
  manual_resolved: {
    label: "Manual",
    icon: CheckCircle2,
    className: "bg-warning/10 text-warning",
  },
  ignored: {
    label: "Ignored",
    icon: CheckCircle2,
    className: "bg-bg-subtle text-text-muted",
  },
}

const providerStatusLabels: Record<string, string> = {
  accepted: "Accepted by Meta",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
}

const renderStatusConfig = {
  not_required: { label: "Tidak perlu", className: "text-text-muted" },
  pending: { label: "Menunggu", className: "text-info" },
  ready: { label: "Siap", className: "text-success" },
  failed: { label: "Gagal", className: "text-danger" },
}

type BusyAction = "resend" | "download" | "complete" | "ignore" | null

function NotificationCard({
  notification,
  busyAction,
  onResend,
  onDownload,
  onManualComplete,
  onIgnore,
}: {
  notification: NotificationRecord
  busyAction: BusyAction
  onResend: () => void
  onDownload: () => void
  onManualComplete: () => void
  onIgnore: () => void
}) {
  const status = statusConfig[notification.deliveryStatus]
  const StatusIcon = status.icon
  const isFailed = notification.deliveryStatus === "failed"
  const canDownloadReceipt = notification.eventType === "order_confirmed" && notification.receiptAvailable

  return (
    <Card
      className={cn(
        "rounded-xl border shadow-card transition-all",
        isFailed ? "border-danger/30 bg-danger-bg" : "border-line-base bg-bg-surface"
      )}
      data-testid={`notification-card-${notification.notificationId}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("rounded-full text-xs border-0", status.className)}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            <Badge variant="secondary" className="rounded-full text-xs">
              {eventTypeLabels[notification.eventType]}
            </Badge>
          </div>
          {notification.orderCode && (
            <span className="font-mono text-xs font-semibold text-rose-600">{notification.orderCode}</span>
          )}
        </div>

        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle flex-shrink-0">
            <User className="h-4 w-4 text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-strong truncate">{notification.customerName}</p>
            <p className="text-xs text-text-muted flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {notification.destinationPhone}
            </p>
          </div>
        </div>

        {notification.renderStatus && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <FileImage className="h-4 w-4 text-text-muted" />
            <span className="text-text-muted">Receipt:</span>
            <span className={cn("font-medium", renderStatusConfig[notification.renderStatus]?.className)}>
              {renderStatusConfig[notification.renderStatus]?.label}
            </span>
          </div>
        )}

        {notification.latestFailureReason && (
          <div className="mb-3 rounded-xl bg-danger/10 p-3 text-sm text-danger flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{notification.latestFailureReason}</span>
          </div>
        )}

        {notification.manualResolutionNote && (
          <div className="mb-3 rounded-xl bg-warning/10 p-3 text-sm text-warning flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{notification.manualResolutionNote}</span>
          </div>
        )}

        {notification.ignoredNote && (
          <div className="mb-3 rounded-xl bg-bg-subtle p-3 text-sm text-text-muted flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{notification.ignoredNote}</span>
          </div>
        )}

        <div className="mb-4 space-y-1 text-xs text-text-muted">
          <div className="flex items-center justify-between">
            <span>Dibuat: {notification.createdAtLabel}</span>
            <span>Percobaan: {notification.attemptCount}x</span>
          </div>
          {notification.sentAt && <div>Terkirim: {notification.sentAt}</div>}
          {notification.lastAttemptAt && <div>Terakhir dicoba: {notification.lastAttemptAt}</div>}
          {notification.manualResolvedAt && <div>Manual: {notification.manualResolvedAt}</div>}
          {notification.ignoredAt && <div>Ignored: {notification.ignoredAt}</div>}
          {notification.providerStatus && (
            <div>Provider Status: {providerStatusLabels[notification.providerStatus] ?? notification.providerStatus}</div>
          )}
          {notification.providerMessageId && <div className="truncate">Provider Msg: {notification.providerMessageId}</div>}
          {notification.latestErrorCode && <div>Error Code: {notification.latestErrorCode}</div>}
        </div>

        {canDownloadReceipt && !isFailed && (
          <div className="mb-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl w-full"
              onClick={onDownload}
              disabled={busyAction !== null}
              data-testid={`notification-download-${notification.notificationId}`}
            >
              {busyAction === "download" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              {busyAction === "download" ? "Menyiapkan..." : "Download Receipt"}
            </Button>
          </div>
        )}

        {notification.deliveryStatus === "queued" && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl flex-1"
              onClick={onResend}
              disabled={busyAction !== null}
              data-testid={`notification-resend-${notification.notificationId}`}
            >
              {busyAction === "resend" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {busyAction === "resend" ? "Memproses..." : "Kirim Sekarang"}
            </Button>
          </div>
        )}

        {isFailed && (
          <div className="flex flex-wrap gap-2">
            {canDownloadReceipt && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={onDownload}
                disabled={busyAction !== null}
                data-testid={`notification-download-${notification.notificationId}`}
              >
                {busyAction === "download" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
                {busyAction === "download" ? "Menyiapkan..." : "Download Receipt"}
              </Button>
            )}
            <Button
              size="sm"
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white"
              onClick={onResend}
              disabled={busyAction !== null}
              data-testid={`notification-resend-${notification.notificationId}`}
            >
              {busyAction === "resend" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {busyAction === "resend" ? "Memproses..." : notification.eventType === "order_confirmed" ? "Resend Message" : "Kirim Ulang"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onManualComplete}
              disabled={busyAction !== null}
              data-testid={`notification-complete-${notification.notificationId}`}
            >
              {busyAction === "complete" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              {busyAction === "complete" ? "Memproses..." : "Mark as Done"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onIgnore}
              disabled={busyAction !== null}
              data-testid={`notification-ignore-${notification.notificationId}`}
            >
              {busyAction === "ignore" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <XCircle className="h-4 w-4 mr-1" />}
              {busyAction === "ignore" ? "Memproses..." : "Ignore"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryBanner({ notifications }: { notifications: NotificationRecord[] }) {
  const failed = notifications.filter((notification) => notification.deliveryStatus === "failed").length
  const queued = notifications.filter((notification) => notification.deliveryStatus === "queued").length

  if (failed === 0 && queued === 0) {
    return null
  }

  return (
    <Card className={cn("rounded-2xl border", failed > 0 ? "border-danger/30 bg-danger/5" : "border-info/30 bg-info/5")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {failed > 0 ? (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-danger/20">
                <AlertTriangle className="h-5 w-5 text-danger" />
              </div>
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-info/20">
                <Clock className="h-5 w-5 text-info" />
              </div>
            )}
            <div>
              <p className="font-medium text-text-strong">
                {failed > 0 ? `${failed} notifikasi gagal terkirim` : `${queued} notifikasi menunggu`}
              </p>
              <p className="text-sm text-text-muted">
                {failed > 0
                  ? "Segera tangani agar pelanggan tetap menerima informasi penting."
                  : "Sistem masih menunggu untuk mengirim notifikasi."}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function NotifikasiPage() {
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [activeTab, setActiveTab] = useState("all")
  const [activeAction, setActiveAction] = useState<{ notificationId: string; action: BusyAction } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  const loadNotifications = () =>
    adminApi.listNotifications()
      .then((payload) => {
        setNotifications(payload)
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat notifikasi"))
      .finally(() => setIsLoading(false))

  useEffect(() => {
    void loadNotifications()
  }, [])

  const filteredNotifications = notifications.filter((notification) => {
    if (activeTab === "all") {
      return true
    }

    return notification.deliveryStatus === activeTab
  })

  const tabCounts = {
    all: notifications.length,
    queued: notifications.filter((notification) => notification.deliveryStatus === "queued").length,
    failed: notifications.filter((notification) => notification.deliveryStatus === "failed").length,
    manual_resolved: notifications.filter((notification) => notification.deliveryStatus === "manual_resolved").length,
    ignored: notifications.filter((notification) => notification.deliveryStatus === "ignored").length,
    sent: notifications.filter((notification) => notification.deliveryStatus === "sent").length,
  }

  const updateNotification = (nextNotification: NotificationRecord) => {
    setNotifications((current) =>
      current.map((notification) =>
        notification.notificationId === nextNotification.notificationId ? nextNotification : notification
      )
    )
  }

  const runAction = async (
    notificationId: string,
    action: Exclude<BusyAction, null>,
    task: () => Promise<void>
  ) => {
    setActiveAction({ notificationId, action })
    try {
      await task()
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <AdminShell
      title="Notifikasi"
      subtitle="Status pengiriman dan recovery WhatsApp"
      action={
        tabCounts.failed > 0 && (
          <Badge className="bg-danger/10 text-danger border-danger/30 rounded-full px-3 py-1">
            {tabCounts.failed} gagal
          </Badge>
        )
      }
    >
      <div className="px-4 py-6 lg:px-6 space-y-6">
        <SummaryBanner notifications={notifications} />

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto bg-bg-soft rounded-2xl p-1 h-auto">
            <TabsTrigger value="all" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Semua ({tabCounts.all})</TabsTrigger>
            <TabsTrigger value="queued" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Menunggu ({tabCounts.queued})</TabsTrigger>
            <TabsTrigger value="failed" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Gagal ({tabCounts.failed})</TabsTrigger>
            <TabsTrigger value="manual_resolved" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Manual ({tabCounts.manual_resolved})</TabsTrigger>
            <TabsTrigger value="ignored" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Ignored ({tabCounts.ignored})</TabsTrigger>
            <TabsTrigger value="sent" className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm">Terkirim ({tabCounts.sent})</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-line-base bg-bg-surface px-4 py-3 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat notifikasi...
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
                <div className="flex items-center justify-between gap-3">
                  <span>{loadError}</span>
                  <Button variant="outline" size="sm" className="rounded-lg" onClick={loadNotifications}>
                    Coba Lagi
                  </Button>
                </div>
              </div>
            ) : filteredNotifications.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.notificationId}
                    notification={notification}
                    busyAction={activeAction?.notificationId === notification.notificationId ? activeAction.action : null}
                    onResend={() =>
                      runAction(notification.notificationId, "resend", async () => {
                        updateNotification(await adminApi.resendNotification(notification.notificationId))
                      })
                    }
                    onDownload={() =>
                      runAction(notification.notificationId, "download", async () => {
                        const { blob, filename } = await adminApi.getNotificationReceipt(notification.notificationId)
                        const url = URL.createObjectURL(blob)
                        const anchor = document.createElement("a")
                        anchor.href = url
                        anchor.download = filename
                        anchor.click()
                        URL.revokeObjectURL(url)
                      })
                    }
                    onManualComplete={() =>
                      runAction(notification.notificationId, "complete", async () => {
                        updateNotification(await adminApi.manualCompleteNotification(notification.notificationId))
                      })
                    }
                    onIgnore={() =>
                      runAction(notification.notificationId, "ignore", async () => {
                        updateNotification(await adminApi.ignoreNotification(notification.notificationId))
                      })
                    }
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-soft mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-text-muted" />
                </div>
                <h3 className="font-display text-lg font-semibold text-text-strong">Tidak ada notifikasi</h3>
                <p className="text-text-muted mt-1">Belum ada notifikasi dengan status ini</p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AdminShell>
  )
}
