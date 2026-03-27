"use client"

import { useEffect, useMemo, useState } from "react"
import Image from "next/image"
import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappMessageItem,
} from "@cjl/contracts"
import {
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Smartphone,
  Unplug,
  Wifi,
} from "lucide-react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"

const statusTone: Record<WhatsappConnectionStatus["state"], string> = {
  disabled: "bg-slate-100 text-slate-700",
  initializing: "bg-amber-100 text-amber-700",
  pairing: "bg-sky-100 text-sky-700",
  authenticated: "bg-amber-100 text-amber-700",
  connected: "bg-emerald-100 text-emerald-700",
  disconnected: "bg-rose-100 text-rose-700",
  auth_failure: "bg-rose-100 text-rose-700",
}

const statusLabel: Record<WhatsappConnectionStatus["state"], string> = {
  disabled: "Dinonaktifkan",
  initializing: "Menyiapkan",
  pairing: "Pairing",
  authenticated: "Terautentikasi",
  connected: "Terhubung",
  disconnected: "Terputus",
  auth_failure: "Auth Gagal",
}

export default function WhatsappAdminPage() {
  const [status, setStatus] = useState<WhatsappConnectionStatus | null>(null)
  const [chats, setChats] = useState<WhatsappChatSummary[]>([])
  const [messages, setMessages] = useState<WhatsappMessageItem[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyAction, setBusyAction] = useState<"pair" | "reconnect" | "reset" | null>(null)

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) ?? null,
    [chats, selectedChatId]
  )

  const pairingMethod = status?.pairingMethod
  const showQrCode = pairingMethod === "qr" && Boolean(status?.qrCodeDataUrl)
  const showPairingCode = pairingMethod === "code" || Boolean(status?.pairingCode)
  const canResetSession =
    Boolean(error) || status?.state === "auth_failure" || status?.state === "disconnected"

  const loadStatusAndChats = async (preserveSelection = true) => {
    const [statusPayload, chatPayload] = await Promise.all([
      adminApi.getWhatsappStatus(),
      adminApi.listWhatsappChats(),
    ])

    setStatus(statusPayload)
    setChats(chatPayload)
    setError(null)
    setSelectedChatId((current) => {
      if (preserveSelection && current && chatPayload.some((chat) => chat.chatId === current)) {
        return current
      }

      return chatPayload[0]?.chatId ?? null
    })
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        setError(null)
        await loadStatusAndChats(false)
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Gagal memuat WhatsApp")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()
    const interval = window.setInterval(() => {
      void loadStatusAndChats()
    }, 8000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [])

  useEffect(() => {
    if (!selectedChatId) {
      setMessages([])
      return
    }

    let cancelled = false

    const loadMessages = async () => {
      try {
        const payload = await adminApi.listWhatsappMessages(selectedChatId)
        if (!cancelled) {
          setMessages(payload)
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Gagal memuat percakapan")
        }
      }
    }

    void loadMessages()
    const interval = window.setInterval(() => {
      void loadMessages()
    }, 6000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [selectedChatId])

  const handlePairing = async () => {
    setBusyAction("pair")
    setError(null)
    try {
      const payload = await adminApi.requestWhatsappPairingCode()
      setStatus(payload)
      setError(null)
      await loadStatusAndChats()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Gagal membuat pairing code")
    } finally {
      setBusyAction(null)
    }
  }

  const handleReconnect = async () => {
    setBusyAction("reconnect")
    setError(null)
    try {
      const payload = await adminApi.reconnectWhatsapp()
      setStatus(payload)
      setError(null)
      await loadStatusAndChats()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Gagal reconnect WhatsApp")
    } finally {
      setBusyAction(null)
    }
  }

  const handleResetSession = async () => {
    setBusyAction("reset")
    setError(null)
    try {
      const payload = await adminApi.resetWhatsappSession()
      setStatus(payload)
      setError(null)
      await loadStatusAndChats()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Gagal reset session WhatsApp")
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <AdminShell
      title="WhatsApp"
      subtitle="Status linked device dan inbox mirror read-only"
      action={
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => void loadStatusAndChats()}
          disabled={busyAction !== null}
        >
          <RefreshCw className="mr-1 h-4 w-4" />
          Refresh
        </Button>
      }
    >
      <div className="space-y-5 px-4 py-5 lg:px-6">
        {isLoading ? (
          <div className="rounded-2xl border border-line-base bg-bg-surface px-4 py-10 text-center text-sm text-text-muted">
            Memuat panel WhatsApp...
          </div>
        ) : (
          <>
            {error && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Card className="rounded-3xl border-line-base">
              <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold text-text-strong">
                      Status Koneksi
                    </CardTitle>
                    <p className="mt-1 text-sm text-text-muted">
                      Pairing dilakukan dari sini. Balas pelanggan tetap lewat WhatsApp asli.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn("rounded-full px-3 py-1 text-xs", status ? statusTone[status.state] : "bg-slate-100 text-slate-700")}>
                      {status ? statusLabel[status.state] : "Tidak diketahui"}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {status?.gatewayReachable ? "Gateway aktif" : "Gateway tidak terjangkau"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoTile icon={Wifi} label="Nomor aktif" value={status?.currentPhone ?? "-"} />
                  <InfoTile icon={Smartphone} label="Profile name" value={status?.profileName ?? "-"} />
                  <InfoTile icon={RefreshCw} label="Terakhir ready" value={status?.lastReadyAt ?? "-"} />
                  <InfoTile icon={Unplug} label="Disconnect reason" value={status?.lastDisconnectReason ?? "-"} />
                  <InfoTile icon={Unplug} label="Auth failure" value={status?.lastAuthFailureReason ?? "-"} />
                  <InfoTile icon={QrCode} label="Pairing code" value={status?.pairingCode ?? "-"} />
                </div>
                <div className="rounded-3xl border border-dashed border-line-base bg-bg-subtle p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm font-semibold text-text-strong">Pairing Material</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={handlePairing}
                        disabled={busyAction !== null}
                      >
                        {busyAction === "pair" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <QrCode className="mr-1 h-4 w-4" />}
                        Generate Pairing Code
                      </Button>
                      <Button
                        size="sm"
                        className="rounded-xl"
                        onClick={handleReconnect}
                        disabled={busyAction !== null}
                      >
                        {busyAction === "reconnect" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
                        Reconnect
                      </Button>
                      {canResetSession && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl"
                          onClick={handleResetSession}
                          disabled={busyAction !== null}
                        >
                          {busyAction === "reset" ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Unplug className="mr-1 h-4 w-4" />}
                          Reset Session
                        </Button>
                      )}
                    </div>
                  </div>

                  {showQrCode ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl bg-white p-4">
                      <Image
                        src={status?.qrCodeDataUrl ?? ""}
                        alt="WhatsApp QR"
                        width={224}
                        height={224}
                        unoptimized
                        className="h-56 w-56 rounded-2xl border border-line-base object-contain"
                      />
                      <p className="text-center text-xs text-text-muted">
                        Scan QR ini hanya saat gateway memang berada pada mode QR pairing.
                      </p>
                    </div>
                  ) : showPairingCode ? (
                    <div className="rounded-2xl bg-white p-6 text-center">
                      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                        Pairing Code Aktif
                      </p>
                      <p className="mt-3 text-2xl font-semibold tracking-[0.2em] text-text-strong">
                        {status?.pairingCode ?? "-"}
                      </p>
                      <p className="mt-3 text-sm text-text-muted">
                        Gunakan pairing code ini dari perangkat WhatsApp utama. QR lama tidak berlaku saat mode pairing code aktif.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-2xl bg-white p-6 text-center text-sm text-text-muted">
                      QR hanya tampil saat gateway berada pada mode QR pairing. Jalur utama operator adalah pairing code.
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="rounded-3xl border-line-base">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-text-strong">
                    Inbox Mirror
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <ScrollArea className="h-[560px] pr-2">
                    {chats.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                        Belum ada chat yang termirror.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {chats.map((chat) => (
                          <button
                            key={chat.chatId}
                            type="button"
                            onClick={() => setSelectedChatId(chat.chatId)}
                            className={cn(
                              "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                              selectedChatId === chat.chatId
                                ? "border-emerald-300 bg-emerald-50"
                                : "border-line-base bg-bg-surface hover:bg-bg-subtle"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-text-strong">
                                  {chat.title}
                                </p>
                                <p className="truncate text-xs text-text-muted">
                                  {chat.phone ?? chat.chatId}
                                </p>
                              </div>
                              {chat.unreadCount > 0 && (
                                <Badge className="rounded-full bg-emerald-600 text-white">
                                  {chat.unreadCount}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-2 truncate text-sm text-text-body">
                              {chat.lastMessagePreview}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                              <span>{chat.customerName ?? "Belum terkait customer"}</span>
                              <span>{chat.lastMessageAtLabel ?? "-"}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              <Card className="rounded-3xl border-line-base">
                <CardHeader className="pb-2">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold text-text-strong">
                        {selectedChat?.title ?? "Pilih chat"}
                      </CardTitle>
                      <p className="mt-1 text-sm text-text-muted">
                        {selectedChat?.phone ?? "Thread percakapan akan tampil di sini."}
                      </p>
                    </div>
                    {selectedChat?.openWhatsappUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-xl"
                        onClick={() => window.open(selectedChat.openWhatsappUrl, "_blank", "noopener,noreferrer")}
                      >
                        <MessageCircle className="mr-1 h-4 w-4" />
                        Open in WhatsApp
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[560px] pr-2">
                    {!selectedChat ? (
                      <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                        Pilih chat di panel kiri untuk melihat timeline.
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                        Belum ada pesan yang tersimpan untuk chat ini.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {messages.map((message) => (
                          <div
                            key={message.providerMessageId}
                            className={cn(
                              "max-w-[88%] rounded-3xl px-4 py-3 shadow-sm",
                              message.direction === "outbound"
                                ? "ml-auto bg-emerald-600 text-white"
                                : "bg-bg-subtle text-text-strong"
                            )}
                          >
                            <div className="flex items-center gap-2 text-[11px] opacity-80">
                              <span>{message.direction === "outbound" ? "Keluar" : "Masuk"}</span>
                              <span>•</span>
                              <span>{message.timestampLabel}</span>
                              {typeof message.providerAck === "number" && (
                                <>
                                  <span>•</span>
                                  <span>Ack {message.providerAck}</span>
                                </>
                              )}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                              {message.body ?? message.caption ?? message.textPreview}
                            </p>
                            {message.hasMedia && (
                              <p className="mt-2 text-xs opacity-80">
                                Media: {message.mediaName ?? message.mediaMimeType ?? message.messageType}
                              </p>
                            )}
                            {(message.notificationId || message.orderCode) && (
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                {message.notificationId && (
                                  <Badge variant="secondary" className="rounded-full">
                                    Notifikasi {message.notificationId}
                                  </Badge>
                                )}
                                {message.orderCode && (
                                  <Badge variant="secondary" className="rounded-full">
                                    {message.orderCode}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Wifi
  label: string
  value: string
}) {
  return (
    <div className="rounded-2xl border border-line-base bg-bg-subtle p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-text-muted">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      <p className="mt-3 break-words text-sm font-semibold text-text-strong">
        {value}
      </p>
    </div>
  )
}
