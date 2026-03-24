"use client"

import { useEffect, useState } from "react"
import type { NotificationRecord } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import {
  Send,
  Download,
  Copy,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Phone,
  User,
  MessageSquare,
  MessageCircle,
  FileImage,
} from "lucide-react"
import { adminApi } from "@/lib/api"

const eventTypeLabels: Record<string, string> = {
  welcome: "Welcome",
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
}

const renderStatusConfig = {
  not_required: { label: "Tidak perlu", className: "text-text-muted" },
  pending: { label: "Menunggu", className: "text-info" },
  ready: { label: "Siap", className: "text-success" },
  failed: { label: "Gagal", className: "text-danger" },
}

function NotificationCard({
  notification,
  onResend,
  onDownload,
  onCopy,
  onPreview,
  onManualWhatsapp,
  onManualResolve,
  busyAction,
}: {
  notification: NotificationRecord
  onResend: () => void
  onDownload: () => void
  onCopy: () => void
  onPreview: () => void
  onManualWhatsapp: () => void
  onManualResolve: () => void
  busyAction: "resend" | "download" | "copy" | "preview" | "whatsapp" | "manual" | null
}) {
  const status = statusConfig[notification.deliveryStatus]
  const StatusIcon = status.icon
  const isFailedConfirmation =
    notification.eventType === "order_confirmed" &&
    notification.deliveryStatus === "failed"

  return (
    <Card
      className={cn(
        "rounded-xl border shadow-card transition-all",
        isFailedConfirmation
          ? "border-danger/30 bg-danger-bg"
          : "border-line-base bg-bg-surface"
      )}
    >
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("rounded-full text-xs", status.className)}
            >
              <StatusIcon className="h-3 w-3 mr-1" />
              {status.label}
            </Badge>
            <Badge variant="secondary" className="rounded-full text-xs">
              {eventTypeLabels[notification.eventType]}
            </Badge>
          </div>
          {notification.orderCode && (
            <span className="font-mono text-xs font-semibold text-rose-600">
              {notification.orderCode}
            </span>
          )}
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-subtle flex-shrink-0">
            <User className="h-4 w-4 text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-strong truncate">
              {notification.customerName}
            </p>
            <p className="text-xs text-text-muted flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {notification.destinationPhone}
            </p>
          </div>
        </div>

        {/* Render Status (for order confirmations) */}
        {notification.renderStatus && (
          <div className="flex items-center gap-2 mb-3 text-sm">
            <FileImage className="h-4 w-4 text-text-muted" />
            <span className="text-text-muted">Receipt:</span>
            <span
              className={cn(
                "font-medium",
                renderStatusConfig[notification.renderStatus]?.className
              )}
            >
              {renderStatusConfig[notification.renderStatus]?.label}
            </span>
          </div>
        )}

        {/* Error Message */}
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

        {/* Attempt Info */}
        <div className="mb-4 space-y-1 text-xs text-text-muted">
          <div className="flex items-center justify-between">
            <span>Dibuat: {notification.createdAtLabel}</span>
            <span>Percobaan: {notification.attemptCount}x</span>
          </div>
          {notification.sentAt && (
            <div>Terkirim: {notification.sentAt}</div>
          )}
          {notification.lastAttemptAt && (
            <div>Terakhir dicoba: {notification.lastAttemptAt}</div>
          )}
          {notification.manualResolvedAt && (
            <div>Diselesaikan manual: {notification.manualResolvedAt}</div>
          )}
          {notification.providerAck !== undefined && (
            <div>Ack Provider: {notification.providerAck}</div>
          )}
          {notification.providerMessageId && (
            <div className="truncate">Provider Msg: {notification.providerMessageId}</div>
          )}
          {notification.gatewayErrorCode && (
            <div>Kode Gateway: {notification.gatewayErrorCode}</div>
          )}
        </div>

        {notification.receiptAvailable && notification.deliveryStatus !== "failed" && (
          <div className="mb-3">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl w-full"
              onClick={onDownload}
              disabled={busyAction !== null}
            >
              {busyAction === "download" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />}
              {busyAction === "download" ? "Menyiapkan..." : "Download Receipt"}
            </Button>
          </div>
        )}

        {/* Actions */}
        {notification.deliveryStatus === "failed" && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl flex-1"
              onClick={onResend}
              disabled={busyAction !== null}
            >
              {busyAction === "resend" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              {busyAction === "resend" ? "Memproses..." : "Kirim Ulang"}
            </Button>
            {notification.receiptAvailable && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={onDownload}
                disabled={busyAction !== null}
              >
                {busyAction === "download" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              </Button>
            )}
            {notification.manualWhatsappAvailable && (
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl flex-1"
                onClick={onManualWhatsapp}
                disabled={busyAction !== null}
              >
                {busyAction === "whatsapp" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <MessageCircle className="h-4 w-4 mr-1" />}
                {busyAction === "whatsapp" ? "Membuka..." : "WhatsApp"}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onPreview}
              disabled={busyAction !== null}
            >
              {busyAction === "preview" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquare className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onCopy}
              disabled={busyAction !== null}
            >
              {busyAction === "copy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="rounded-xl flex-1"
              onClick={onManualResolve}
              disabled={busyAction !== null}
            >
              {busyAction === "manual" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
              {busyAction === "manual" ? "Memproses..." : "Manual"}
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
            >
              {busyAction === "resend" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
              {busyAction === "resend" ? "Memproses..." : "Kirim Sekarang"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function SummaryBanner({ notifications }: { notifications: NotificationRecord[] }) {
  const failed = notifications.filter((n) => n.deliveryStatus === "failed").length
  const queued = notifications.filter((n) => n.deliveryStatus === "queued").length

  if (failed === 0 && queued === 0) return null

  return (
    <Card
      className={cn(
        "rounded-2xl border",
        failed > 0
          ? "border-danger/30 bg-danger/5"
          : "border-info/30 bg-info/5"
      )}
    >
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
                {failed > 0
                  ? `${failed} notifikasi gagal terkirim`
                  : `${queued} notifikasi menunggu`}
              </p>
              <p className="text-sm text-text-muted">
                {failed > 0
                  ? "Segera tangani untuk memastikan pelanggan menerima informasi"
                  : "Akan dikirim otomatis"}
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
  const [selectedNotification, setSelectedNotification] = useState<NotificationRecord | null>(null)
  const [showManualResolveSheet, setShowManualResolveSheet] = useState(false)
  const [showMessagePreviewSheet, setShowMessagePreviewSheet] = useState(false)
  const [manualNote, setManualNote] = useState("")
  const [messagePreview, setMessagePreview] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeAction, setActiveAction] = useState<{
    notificationId: string
    action: "resend" | "download" | "copy" | "preview" | "whatsapp" | "manual"
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    adminApi.listNotifications()
      .then((payload) => {
        setNotifications(payload)
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat notifikasi"))
      .finally(() => setIsLoading(false))
  }, [])

  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === "all") return true
    return n.deliveryStatus === activeTab
  })

  const tabCounts = {
    all: notifications.length,
    queued: notifications.filter((n) => n.deliveryStatus === "queued").length,
    failed: notifications.filter((n) => n.deliveryStatus === "failed").length,
    manual_resolved: notifications.filter((n) => n.deliveryStatus === "manual_resolved").length,
    sent: notifications.filter((n) => n.deliveryStatus === "sent").length,
  }

  const handleResend = async (notification: NotificationRecord) => {
    setActiveAction({ notificationId: notification.notificationId, action: "resend" })
    try {
      const updated = await adminApi.resendNotification(notification.notificationId)
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === notification.notificationId ? (updated as NotificationRecord) : n))
      )
    } finally {
      setActiveAction(null)
    }
  }

  const handleManualResolve = async () => {
    if (!selectedNotification || !manualNote) return
    setIsProcessing(true)
    setActiveAction({ notificationId: selectedNotification.notificationId, action: "manual" })
    try {
      const updated = await adminApi.manualResolveNotification(selectedNotification.notificationId, manualNote)
      setNotifications((prev) =>
        prev.map((n) => (n.notificationId === selectedNotification.notificationId ? (updated as NotificationRecord) : n))
      )
      setShowManualResolveSheet(false)
      setManualNote("")
      setSelectedNotification(null)
    } finally {
      setIsProcessing(false)
      setActiveAction(null)
    }
  }

  const handlePreviewMessage = async (notification: NotificationRecord) => {
    setActiveAction({ notificationId: notification.notificationId, action: "preview" })
    try {
      const payload = await adminApi.getNotificationMessage(notification.notificationId)
      setSelectedNotification(notification)
      setMessagePreview(payload.message)
      setShowMessagePreviewSheet(true)
    } finally {
      setActiveAction(null)
    }
  }

  const handleCopy = async (notification: NotificationRecord) => {
    setActiveAction({ notificationId: notification.notificationId, action: "copy" })
    try {
      const payload = await adminApi.getNotificationMessage(notification.notificationId)
      await navigator.clipboard.writeText(payload.message)
    } finally {
      setActiveAction(null)
    }
  }

  const handleDownload = async (notification: NotificationRecord) => {
    setActiveAction({ notificationId: notification.notificationId, action: "download" })
    try {
      const { blob, filename } = await adminApi.getNotificationReceipt(notification.notificationId)
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    } finally {
      setActiveAction(null)
    }
  }

  const handleManualWhatsapp = async (notification: NotificationRecord) => {
    setActiveAction({ notificationId: notification.notificationId, action: "whatsapp" })
    try {
      const payload = await adminApi.openManualWhatsappFallback(notification.notificationId)
      setNotifications((prev) =>
        prev.map((current) =>
          current.notificationId === notification.notificationId ? payload.notification : current
        )
      )
      window.open(payload.whatsappUrl, "_blank", "noopener,noreferrer")
    } finally {
      setActiveAction(null)
    }
  }

  return (
    <AdminShell
      title="Notifikasi"
      subtitle="Status pengiriman WhatsApp"
      action={
        tabCounts.failed > 0 && (
          <Badge className="bg-danger/10 text-danger border-danger/30 rounded-full px-3 py-1">
            {tabCounts.failed} gagal
          </Badge>
        )
      }
    >
      <div className="px-4 py-6 lg:px-6 space-y-6">
        {/* Summary Banner */}
        <SummaryBanner notifications={notifications} />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full justify-start overflow-x-auto bg-bg-soft rounded-2xl p-1 h-auto">
            <TabsTrigger
              value="all"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Semua ({tabCounts.all})
            </TabsTrigger>
            <TabsTrigger
              value="queued"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Menunggu ({tabCounts.queued})
            </TabsTrigger>
            <TabsTrigger
              value="failed"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Gagal ({tabCounts.failed})
            </TabsTrigger>
            <TabsTrigger
              value="manual_resolved"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Manual ({tabCounts.manual_resolved})
            </TabsTrigger>
            <TabsTrigger
              value="sent"
              className="rounded-xl data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Terkirim ({tabCounts.sent})
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {isLoading ? (
              <div className="flex items-center gap-2 rounded-xl border border-line-base bg-bg-surface px-4 py-3 text-sm text-text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat notifikasi...
              </div>
            ) : loadError ? (
              <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
                {loadError}
              </div>
            ) : filteredNotifications.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredNotifications.map((notification) => (
                  <NotificationCard
                    key={notification.notificationId}
                    notification={notification}
                    onResend={() => handleResend(notification)}
                    onDownload={() => handleDownload(notification)}
                    onCopy={() => handleCopy(notification)}
                    onPreview={() => handlePreviewMessage(notification)}
                    onManualWhatsapp={() => handleManualWhatsapp(notification)}
                    onManualResolve={() => {
                      setSelectedNotification(notification)
                      setShowManualResolveSheet(true)
                    }}
                    busyAction={activeAction?.notificationId === notification.notificationId ? activeAction.action : null}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-soft mx-auto mb-4">
                  <MessageSquare className="h-8 w-8 text-text-muted" />
                </div>
                <h3 className="font-display text-lg font-semibold text-text-strong">
                  Tidak ada notifikasi
                </h3>
                <p className="text-text-muted mt-1">
                  Belum ada notifikasi dengan status ini
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Manual Resolve Sheet */}
      <Sheet open={showManualResolveSheet} onOpenChange={setShowManualResolveSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">
              Tandai Manual Terselesaikan
            </SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-4">
            {selectedNotification && (
              <Card className="rounded-xl border-line-base bg-bg-subtle">
                <CardContent className="p-4">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-text-muted">Pelanggan</span>
                      <span className="font-medium text-text-strong">
                        {selectedNotification.customerName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-muted">Nomor HP</span>
                      <span className="text-text-body">
                        {selectedNotification.destinationPhone}
                      </span>
                    </div>
                    {selectedNotification.orderCode && (
                      <div className="flex justify-between">
                        <span className="text-text-muted">Order</span>
                      <span className="font-mono text-xs font-semibold text-rose-600">
                        {selectedNotification.orderCode}
                      </span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-body">
                Catatan Penyelesaian *
              </label>
              <Textarea
                placeholder="Contoh: Sudah dikirim manual via WhatsApp pribadi"
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                className="rounded-xl border-line-soft resize-none"
                rows={3}
              />
              <p className="text-xs text-text-muted">
                Catatan ini akan disimpan sebagai audit trail
              </p>
            </div>
          </div>
          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1 rounded-xl">
                Batal
              </Button>
            </SheetClose>
              <Button
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              onClick={handleManualResolve}
              disabled={!manualNote || isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Memproses...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Tandai Selesai
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet open={showMessagePreviewSheet} onOpenChange={setShowMessagePreviewSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">
              Preview Pesan WhatsApp
            </SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-4">
            {selectedNotification && (
              <Card className="rounded-xl border-line-base bg-bg-subtle">
                <CardContent className="p-4 text-sm">
                  <div className="flex justify-between gap-3">
                    <span className="text-text-muted">Tujuan</span>
                    <span className="font-medium text-text-strong">{selectedNotification.customerName}</span>
                  </div>
                  <div className="mt-2 flex justify-between gap-3">
                    <span className="text-text-muted">Nomor HP</span>
                    <span className="text-text-body">{selectedNotification.destinationPhone}</span>
                  </div>
                </CardContent>
              </Card>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-body">Isi Pesan</label>
              <Textarea value={messagePreview} readOnly className="min-h-40 rounded-xl border-line-soft resize-none bg-bg-subtle" />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1 rounded-xl">
                Tutup
              </Button>
            </SheetClose>
            <Button
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              onClick={() => {
                void navigator.clipboard.writeText(messagePreview)
              }}
            >
              <Copy className="h-4 w-4 mr-2" />
              Salin Pesan
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AdminShell>
  )
}
