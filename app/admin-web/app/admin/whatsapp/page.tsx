"use client"

import { useEffect, useMemo, useState } from "react"
import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappMessageItem,
} from "@cjl/contracts"
import {
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Webhook,
} from "lucide-react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"

const providerTone: Record<WhatsappConnectionStatus["state"], string> = {
  disabled: "bg-slate-100 text-slate-700",
  ready: "bg-emerald-100 text-emerald-700",
  misconfigured: "bg-amber-100 text-amber-700",
  degraded: "bg-rose-100 text-rose-700",
}

const providerLabel: Record<WhatsappConnectionStatus["state"], string> = {
  disabled: "Dinonaktifkan",
  ready: "Siap",
  misconfigured: "Belum Lengkap",
  degraded: "Terdegradasi",
}

const composerTone: Record<WhatsappChatSummary["composerMode"], string> = {
  free_form: "bg-emerald-100 text-emerald-700",
  template_only: "bg-amber-100 text-amber-700",
  read_only: "bg-slate-100 text-slate-700",
}

const composerLabel: Record<WhatsappChatSummary["composerMode"], string> = {
  free_form: "Free-form allowed",
  template_only: "Template only",
  read_only: "Read-only",
}

const messageStatusTone: Record<string, string> = {
  accepted: "bg-sky-100 text-sky-700",
  sent: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  read: "bg-emerald-200 text-emerald-800",
  failed: "bg-rose-100 text-rose-700",
}

export default function WhatsappAdminPage() {
  const [status, setStatus] = useState<WhatsappConnectionStatus | null>(null)
  const [chats, setChats] = useState<WhatsappChatSummary[]>([])
  const [messages, setMessages] = useState<WhatsappMessageItem[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) ?? null,
    [chats, selectedChatId]
  )

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
        await loadStatusAndChats(false)
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Gagal memuat panel WhatsApp")
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
          setError(nextError instanceof Error ? nextError.message : "Gagal memuat timeline WhatsApp")
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

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadStatusAndChats()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Gagal refresh panel WhatsApp")
    } finally {
      setIsRefreshing(false)
    }
  }

  return (
    <AdminShell
      title="WhatsApp"
      subtitle="Provider health, thread visibility, dan timeline pesan hybrid"
      action={
        <Button
          variant="outline"
          size="sm"
          className="rounded-xl"
          onClick={() => void handleRefresh()}
          disabled={isRefreshing}
        >
          {isRefreshing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-1 h-4 w-4" />}
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
                      Cloud API Provider Health
                    </CardTitle>
                    <p className="mt-1 text-sm text-text-muted">
                      Outbound otomatis berjalan via Cloud API. Inbox masih hybrid sampai webhook ingestion selesai.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className={cn("rounded-full px-3 py-1 text-xs", status ? providerTone[status.state] : "bg-slate-100 text-slate-700")}>
                      {status ? providerLabel[status.state] : "Tidak diketahui"}
                    </Badge>
                    <Badge variant="outline" className="rounded-full px-3 py-1 text-xs">
                      {status?.provider === "cloud_api" ? "Cloud API" : "Disabled"}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <InfoTile icon={ShieldCheck} label="Ringkasan" value={status?.summary ?? "-"} />
                <InfoTile icon={MessageCircle} label="Phone Number ID" value={status?.phoneNumberId ?? "-"} />
                <InfoTile icon={Webhook} label="Webhook Path" value={status?.webhookPath ?? "-"} />
                <InfoTile icon={Send} label="Current Phone" value={status?.currentPhone ?? "-"} />
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="rounded-3xl border-line-base">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold text-text-strong">
                    Thread List
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <ScrollArea className="h-[560px] pr-2">
                    {chats.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                        Belum ada thread WhatsApp yang tersimpan.
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
                                  {chat.phone ?? chat.waId ?? chat.chatId}
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
                            <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                              <Badge className={cn("rounded-full", composerTone[chat.composerMode])}>
                                {composerLabel[chat.composerMode]}
                              </Badge>
                              {chat.isCswOpen ? (
                                <Badge variant="outline" className="rounded-full">CSW Open</Badge>
                              ) : (
                                <Badge variant="outline" className="rounded-full">CSW Closed</Badge>
                              )}
                              {chat.isFepOpen && (
                                <Badge variant="outline" className="rounded-full">FEP Open</Badge>
                              )}
                            </div>
                            <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
                              <span>{chat.customerName ?? chat.displayName ?? "Belum terkait customer"}</span>
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
                  <div className="flex flex-col gap-2">
                    <CardTitle className="text-base font-semibold text-text-strong">
                      {selectedChat?.title ?? "Pilih thread"}
                    </CardTitle>
                    <p className="text-sm text-text-muted">
                      {selectedChat?.phone ?? selectedChat?.waId ?? "Timeline pesan akan tampil di sini."}
                    </p>
                    {selectedChat && (
                      <div className="flex flex-wrap gap-2">
                        <Badge className={cn("rounded-full", composerTone[selectedChat.composerMode])}>
                          {composerLabel[selectedChat.composerMode]}
                        </Badge>
                        {selectedChat.cswExpiresAtLabel && (
                          <Badge variant="outline" className="rounded-full">
                            CSW hingga {selectedChat.cswExpiresAtLabel}
                          </Badge>
                        )}
                        {selectedChat.fepExpiresAtLabel && (
                          <Badge variant="outline" className="rounded-full">
                            FEP hingga {selectedChat.fepExpiresAtLabel}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[560px] pr-2">
                    {!selectedChat ? (
                      <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                        Pilih thread di panel kiri untuk melihat timeline.
                      </div>
                    ) : messages.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                        Belum ada pesan yang tersimpan untuk thread ini.
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
                            <div className="flex flex-wrap items-center gap-2 text-[11px] opacity-80">
                              <span>{message.direction === "outbound" ? "Keluar" : "Masuk"}</span>
                              <span>•</span>
                              <span>{message.timestampLabel}</span>
                              {message.source && (
                                <>
                                  <span>•</span>
                                  <span>{message.source}</span>
                                </>
                              )}
                            </div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                              {message.body ?? message.caption ?? message.textPreview}
                            </p>
                            {(message.providerStatus || message.pricingType || message.pricingCategory) && (
                              <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                                {message.providerStatus && (
                                  <Badge className={cn("rounded-full", messageStatusTone[message.providerStatus] ?? "bg-slate-100 text-slate-700")}>
                                    {message.providerStatus}
                                  </Badge>
                                )}
                                {message.pricingType && (
                                  <Badge variant="outline" className="rounded-full">
                                    pricing: {message.pricingType}
                                  </Badge>
                                )}
                                {message.pricingCategory && (
                                  <Badge variant="outline" className="rounded-full">
                                    category: {message.pricingCategory}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {(message.latestErrorCode || message.latestErrorMessage) && (
                              <p className="mt-2 text-xs opacity-80">
                                Error {message.latestErrorCode ?? "-"}: {message.latestErrorMessage ?? "-"}
                              </p>
                            )}
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
  icon: typeof ShieldCheck
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
