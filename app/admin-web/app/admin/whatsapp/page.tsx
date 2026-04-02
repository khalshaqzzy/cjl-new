"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappMessageItem,
} from "@cjl/contracts"
import {
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Smartphone,
  UserRound,
  Webhook,
  X,
} from "lucide-react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/components/ui/use-mobile"
import { adminApi } from "@/lib/api"
import { cn } from "@/lib/utils"

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

const sourceLabel: Record<NonNullable<WhatsappMessageItem["source"]>, string> = {
  automated_notification: "Otomatis",
  manual_operator: "Operator",
  inbound_customer: "Pelanggan",
  legacy_mirror: "Legacy",
}

const sourceTone: Record<NonNullable<WhatsappMessageItem["source"]>, string> = {
  automated_notification: "bg-sky-100 text-sky-700",
  manual_operator: "bg-violet-100 text-violet-700",
  inbound_customer: "bg-emerald-100 text-emerald-700",
  legacy_mirror: "bg-slate-200 text-slate-700",
}

const messageStatusLabel: Record<NonNullable<WhatsappMessageItem["providerStatus"]>, string> = {
  accepted: "Accepted by Meta",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
}

const messageStatusTone: Record<NonNullable<WhatsappMessageItem["providerStatus"]>, string> = {
  accepted: "bg-sky-100 text-sky-700",
  sent: "bg-indigo-100 text-indigo-700",
  delivered: "bg-emerald-100 text-emerald-700",
  read: "bg-emerald-200 text-emerald-800",
  failed: "bg-rose-100 text-rose-700",
}

const composerHelpText = {
  free_form: "CSW masih terbuka. Operator bisa mengirim balasan teks langsung dari admin.",
  template_only: "CSW sudah tertutup. Thread ini hanya boleh memakai template resmi.",
  read_only: "Provider tidak siap atau thread hanya bisa dibaca pada kondisi saat ini.",
}

const windowBadge = (chat: WhatsappChatSummary) => {
  if (chat.isCswOpen) {
    return `CSW hingga ${chat.cswExpiresAtLabel ?? "-"}`
  }

  if (chat.isFepOpen) {
    return `FEP aktif hingga ${chat.fepExpiresAtLabel ?? "-"}`
  }

  return "CSW tertutup"
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
      <p className="mt-3 break-words text-sm font-semibold text-text-strong">{value}</p>
    </div>
  )
}

function ThreadListItem({
  chat,
  isActive,
  onSelect,
}: {
  chat: WhatsappChatSummary
  isActive: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`whatsapp-thread-${chat.chatId}`}
      className={cn(
        "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
        isActive
          ? "border-emerald-300 bg-emerald-50"
          : "border-line-base bg-bg-surface hover:bg-bg-subtle"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-text-strong">{chat.title}</p>
            <Badge
              variant="outline"
              className={cn(
                "rounded-full px-2 py-0 text-[10px]",
                chat.customerId ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-600"
              )}
            >
              {chat.customerId ? "Linked" : "Unlinked"}
            </Badge>
          </div>
          <p className="truncate text-xs text-text-muted">
            {chat.phone ?? chat.waId ?? chat.chatId}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {chat.unreadCount > 0 && (
            <Badge className="rounded-full bg-emerald-600 text-white">{chat.unreadCount}</Badge>
          )}
          <span className="text-[11px] text-text-muted">{chat.lastMessageAtLabel ?? "-"}</span>
        </div>
      </div>
      <p className="mt-2 line-clamp-2 text-sm text-text-body">{chat.lastMessagePreview}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Badge className={cn("rounded-full text-[11px]", composerTone[chat.composerMode])}>
          {composerLabel[chat.composerMode]}
        </Badge>
        <Badge variant="outline" className="rounded-full text-[11px]">
          {windowBadge(chat)}
        </Badge>
        {chat.isFepOpen && (
          <Badge variant="outline" className="rounded-full text-[11px]">
            FEP Open
          </Badge>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-text-muted">
        <span>{chat.customerName ?? chat.displayName ?? "Belum terkait customer"}</span>
        <ChevronRight className="h-3.5 w-3.5" />
      </div>
    </button>
  )
}

function MessageBubble({
  message,
  onOpenMedia,
}: {
  message: WhatsappMessageItem
  onOpenMedia: (providerMessageId: string) => void
}) {
  const isOutbound = message.direction === "outbound"
  return (
    <div
      className={cn(
        "max-w-[92%] rounded-3xl px-4 py-3 shadow-sm",
        isOutbound ? "ml-auto bg-emerald-600 text-white" : "bg-bg-subtle text-text-strong"
      )}
      data-testid={`whatsapp-message-${message.providerMessageId}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-[11px] opacity-80">
        <span>{isOutbound ? "Keluar" : "Masuk"}</span>
        <span>&bull;</span>
        <span>{message.timestampLabel}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
        {message.body ?? message.caption ?? message.textPreview}
      </p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
        {message.source && (
          <Badge className={cn("rounded-full", sourceTone[message.source])}>
            {sourceLabel[message.source]}
          </Badge>
        )}
        {message.providerStatus && (
          <Badge
            className={cn("rounded-full", messageStatusTone[message.providerStatus])}
          >
            {messageStatusLabel[message.providerStatus]}
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
      {message.hasMedia && (
        <div className="mt-3 rounded-2xl border border-white/15 bg-white/10 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-3.5 w-3.5" />
            <span>{message.mediaName ?? message.mediaMimeType ?? message.messageType}</span>
          </div>
          {message.mediaDownloadAvailable ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2 rounded-xl"
              onClick={() => onOpenMedia(message.providerMessageId)}
              data-testid={`whatsapp-open-media-${message.providerMessageId}`}
            >
              Buka Media
            </Button>
          ) : (
            <p className="mt-2 opacity-80">
              Media {message.mediaDownloadStatus === "failed" ? "gagal diunduh" : "masih diproses"}.
            </p>
          )}
        </div>
      )}
      {(message.latestErrorCode || message.latestErrorMessage) && (
        <p className="mt-2 text-xs opacity-80">
          Error {message.latestErrorCode ?? "-"}: {message.latestErrorMessage ?? "-"}
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
  )
}

function ThreadPanel({
  status,
  selectedChat,
  messages,
  composerValue,
  onComposerChange,
  onSend,
  isSending,
  composerError,
  onOpenMedia,
}: {
  status: WhatsappConnectionStatus | null
  selectedChat: WhatsappChatSummary | null
  messages: WhatsappMessageItem[]
  composerValue: string
  onComposerChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  composerError: string | null
  onOpenMedia: (providerMessageId: string) => void
}) {
  const canSend =
    Boolean(status && status.state === "ready" && selectedChat?.composerMode === "free_form" && composerValue.trim())

  if (!selectedChat) {
    return (
      <Card className="rounded-3xl border-line-base">
        <CardContent className="flex h-[640px] items-center justify-center px-6 py-10 text-center text-sm text-text-muted">
          Pilih thread di panel kiri untuk melihat timeline dan membalas pesan pelanggan.
        </CardContent>
      </Card>
    )
  }

  const threadDisabledReason =
    status?.state !== "ready"
      ? "Cloud API belum siap. Composer dinonaktifkan sampai provider sehat."
      : composerHelpText[selectedChat.composerMode]

  return (
    <Card className="rounded-3xl border-line-base">
      <div className="flex h-[640px] flex-col">
        <CardHeader className="border-b border-line-base pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <CardTitle className="text-base font-semibold text-text-strong">
                {selectedChat.title}
              </CardTitle>
              <p className="mt-1 text-sm text-text-muted">
                {selectedChat.phone ?? selectedChat.waId ?? selectedChat.chatId}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className={cn("rounded-full", composerTone[selectedChat.composerMode])}>
                  {composerLabel[selectedChat.composerMode]}
                </Badge>
                <Badge variant="outline" className="rounded-full">
                  {windowBadge(selectedChat)}
                </Badge>
                {selectedChat.isFepOpen && (
                  <Badge variant="outline" className="rounded-full">
                    FEP hingga {selectedChat.fepExpiresAtLabel ?? "-"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 lg:items-end">
              <Badge
                variant="outline"
                className={cn(
                  "rounded-full",
                  selectedChat.customerId ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-600"
                )}
              >
                {selectedChat.customerId ? "Terkait customer" : "Belum terkait customer"}
              </Badge>
              {selectedChat.customerId && (
                <Button asChild variant="outline" size="sm" className="rounded-xl" data-testid="whatsapp-linked-customer-link">
                  <Link href={`/admin/pelanggan/${selectedChat.customerId}`}>
                    <UserRound className="mr-1 h-4 w-4" />
                    Buka Customer
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-0 flex-1 flex-col p-0">
          <ScrollArea className="flex-1 px-4 py-4">
            {messages.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                Belum ada pesan yang tersimpan untuk thread ini.
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.providerMessageId}
                    message={message}
                    onOpenMedia={onOpenMedia}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          <div className="border-t border-line-base px-4 py-4">
            <div className="mb-3 rounded-2xl bg-bg-subtle px-3 py-2 text-xs text-text-muted">
              {threadDisabledReason}
            </div>
            {composerError && (
              <div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {composerError}
              </div>
            )}
            <div className="flex flex-col gap-3">
              <Textarea
                value={composerValue}
                onChange={(event) => onComposerChange(event.target.value)}
                placeholder="Tulis balasan singkat untuk pelanggan..."
                className="min-h-24 rounded-2xl border-line-base bg-bg-surface"
                disabled={status?.state !== "ready" || selectedChat.composerMode !== "free_form" || isSending}
                data-testid="whatsapp-composer-input"
              />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-text-muted">
                  Hanya balasan teks non-template yang didukung pada fase ini.
                </p>
                <Button
                  type="button"
                  className="rounded-2xl bg-rose-600 hover:bg-rose-500"
                  onClick={onSend}
                  disabled={!canSend || isSending}
                  data-testid="whatsapp-send-button"
                >
                  {isSending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Mengirim...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Kirim
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </div>
    </Card>
  )
}

export default function WhatsappAdminPage() {
  const isMobile = useIsMobile()
  const [status, setStatus] = useState<WhatsappConnectionStatus | null>(null)
  const [chats, setChats] = useState<WhatsappChatSummary[]>([])
  const [messages, setMessages] = useState<WhatsappMessageItem[]>([])
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [composerValue, setComposerValue] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false)

  const filteredChats = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) {
      return chats
    }

    return chats.filter((chat) =>
      [chat.title, chat.customerName, chat.displayName, chat.phone, chat.waId, chat.lastMessagePreview]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query))
    )
  }, [chats, searchQuery])

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === selectedChatId) ?? null,
    [chats, selectedChatId]
  )

  const syncChats = async (preserveSelection = true) => {
    const [statusPayload, chatPayload] = await Promise.all([
      adminApi.getWhatsappStatus(),
      adminApi.listWhatsappChats(),
    ])

    setStatus(statusPayload)
    setChats(chatPayload)
    setLoadError(null)
    setSelectedChatId((current) => {
      if (preserveSelection && current && chatPayload.some((chat) => chat.chatId === current)) {
        return current
      }

      return chatPayload[0]?.chatId ?? null
    })
  }

  const loadMessages = async (chatId: string) => {
    const payload = await adminApi.listWhatsappMessages(chatId)
    setMessages(payload)
  }

  const selectChat = async (chat: WhatsappChatSummary) => {
    setSelectedChatId(chat.chatId)
    setComposerError(null)
    setComposerValue("")
    if (isMobile) {
      setMobileThreadOpen(true)
    }

    try {
      await loadMessages(chat.chatId)
      if (chat.unreadCount > 0) {
        await adminApi.markWhatsappChatRead(chat.chatId)
        setChats((current) =>
          current.map((item) =>
            item.chatId === chat.chatId ? { ...item, unreadCount: 0 } : item
          )
        )
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal membuka thread WhatsApp")
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await syncChats(false)
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Gagal memuat panel WhatsApp")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()
    const interval = window.setInterval(() => {
      void syncChats()
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
    const run = async () => {
      try {
        const payload = await adminApi.listWhatsappMessages(selectedChatId)
        if (!cancelled) {
          setMessages(payload)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Gagal memuat timeline WhatsApp")
        }
      }
    }

    void run()
    const interval = window.setInterval(() => {
      void run()
    }, 6000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [selectedChatId])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await syncChats()
      if (selectedChatId) {
        await loadMessages(selectedChatId)
      }
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal refresh panel WhatsApp")
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedChatId || !composerValue.trim()) {
      return
    }

    setIsSending(true)
    setComposerError(null)
    try {
      const result = await adminApi.sendWhatsappMessage(selectedChatId, composerValue.trim(), crypto.randomUUID())
      setMessages((current) => [...current, result])
      setChats((current) =>
        current.map((chat) =>
          chat.chatId === selectedChatId
            ? {
                ...chat,
                lastMessagePreview: result.textPreview,
                lastMessageDirection: result.direction,
                lastMessageAtIso: result.timestampIso,
                lastMessageAtLabel: result.timestampLabel,
              }
            : chat
        )
      )
      setComposerValue("")
      await syncChats()
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "Gagal mengirim pesan WhatsApp")
    } finally {
      setIsSending(false)
    }
  }

  const openMedia = (providerMessageId: string) => {
    window.open(adminApi.getWhatsappMediaUrl(providerMessageId), "_blank", "noopener,noreferrer")
  }

  return (
    <AdminShell
      title="WhatsApp"
      subtitle="Inbox internal berbasis Cloud API, webhook status, dan balasan operator"
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
            {loadError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {loadError}
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
                      Inbound, outbound status, dan inbox admin sudah mengikuti signed Meta webhook.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge
                      className={cn(
                        "rounded-full px-3 py-1 text-xs",
                        status ? providerTone[status.state] : "bg-slate-100 text-slate-700"
                      )}
                    >
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
                <InfoTile icon={Smartphone} label="Phone Number ID" value={status?.phoneNumberId ?? "-"} />
                <InfoTile icon={Webhook} label="Webhook Path" value={status?.webhookPath ?? "-"} />
                <InfoTile icon={MessageCircle} label="Current Phone" value={status?.currentPhone ?? "-"} />
              </CardContent>
            </Card>

            <div className="grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="rounded-3xl border-line-base">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold text-text-strong">Thread List</CardTitle>
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      placeholder="Cari nama, nomor, atau isi pesan..."
                      className="rounded-2xl border-line-base bg-bg-subtle pl-9 pr-9"
                      data-testid="whatsapp-search-input"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted"
                        onClick={() => setSearchQuery("")}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <ScrollArea className="h-[640px] pr-2">
                    {filteredChats.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-line-base px-4 py-10 text-center text-sm text-text-muted">
                        Belum ada thread yang cocok dengan filter saat ini.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredChats.map((chat) => (
                          <ThreadListItem
                            key={chat.chatId}
                            chat={chat}
                            isActive={selectedChatId === chat.chatId && (!isMobile || mobileThreadOpen)}
                            onSelect={() => void selectChat(chat)}
                          />
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>

              {!isMobile && (
                <ThreadPanel
                  status={status}
                  selectedChat={selectedChat}
                  messages={messages}
                  composerValue={composerValue}
                  onComposerChange={setComposerValue}
                  onSend={() => void handleSendMessage()}
                  isSending={isSending}
                  composerError={composerError}
                  onOpenMedia={openMedia}
                />
              )}
            </div>

            <Sheet open={mobileThreadOpen} onOpenChange={setMobileThreadOpen}>
              <SheetContent side="bottom" className="h-[88vh] rounded-t-3xl p-0" aria-describedby={undefined}>
                <SheetHeader className="border-b border-line-base px-4 py-4">
                  <SheetTitle className="text-base font-semibold text-text-strong">
                    Thread WhatsApp
                  </SheetTitle>
                </SheetHeader>
                <div className="p-4">
                  <ThreadPanel
                    status={status}
                    selectedChat={selectedChat}
                    messages={messages}
                    composerValue={composerValue}
                    onComposerChange={setComposerValue}
                    onSend={() => void handleSendMessage()}
                    isSending={isSending}
                    composerError={composerError}
                    onOpenMedia={openMedia}
                  />
                </div>
              </SheetContent>
            </Sheet>
          </>
        )}
      </div>
    </AdminShell>
  )
}
