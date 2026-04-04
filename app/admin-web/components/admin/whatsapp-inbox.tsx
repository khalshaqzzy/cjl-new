"use client"

import { useEffect, useLayoutEffect, useRef } from "react"
import Link from "next/link"
import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappMessageItem,
} from "@cjl/contracts"
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  UserRound,
  Webhook,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Textarea } from "@/components/ui/textarea"
import { useIsMobile } from "@/components/ui/use-mobile"
import { adminApi } from "@/lib/api"
import { cn } from "@/lib/utils"

export const providerTone: Record<WhatsappConnectionStatus["state"], string> = {
  disabled: "bg-slate-100 text-slate-700",
  ready: "bg-emerald-100 text-emerald-700",
  misconfigured: "bg-amber-100 text-amber-700",
  degraded: "bg-rose-100 text-rose-700",
}

export const providerLabel: Record<WhatsappConnectionStatus["state"], string> = {
  disabled: "Dinonaktifkan",
  ready: "Siap",
  misconfigured: "Belum Lengkap",
  degraded: "Terdegradasi",
}

export const composerTone: Record<WhatsappChatSummary["composerMode"], string> = {
  free_form: "bg-emerald-100 text-emerald-700",
  template_only: "bg-amber-100 text-amber-700",
  read_only: "bg-slate-100 text-slate-700",
}

export const composerLabel: Record<WhatsappChatSummary["composerMode"], string> = {
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

export const getWhatsappThreadHref = (chatId: string) =>
  `/admin/whatsapp/${encodeURIComponent(chatId)}`

export const fetchWhatsappOverview = async () => {
  const [status, chats] = await Promise.all([
    adminApi.getWhatsappStatus(),
    adminApi.listWhatsappChats(),
  ])

  return { status, chats }
}

export const fetchWhatsappMessages = async (chatId: string) => adminApi.listWhatsappMessages(chatId)

export const updateChatReadState = (chats: WhatsappChatSummary[], chatId: string) =>
  chats.map((item) => (item.chatId === chatId ? { ...item, unreadCount: 0 } : item))

export const mergeLatestMessageIntoChats = (
  chats: WhatsappChatSummary[],
  chatId: string,
  message: WhatsappMessageItem
) =>
  chats.map((chat) =>
    chat.chatId === chatId
      ? {
          ...chat,
          lastMessagePreview: message.textPreview,
          lastMessageDirection: message.direction,
          lastMessageAtIso: message.timestampIso,
          lastMessageAtLabel: message.timestampLabel,
        }
      : chat
  )

export const windowBadge = (chat: WhatsappChatSummary) => {
  if (chat.isCswOpen) {
    return `CSW hingga ${chat.cswExpiresAtLabel ?? "-"}`
  }

  if (chat.isFepOpen) {
    return `FEP aktif hingga ${chat.fepExpiresAtLabel ?? "-"}`
  }

  return "CSW tertutup"
}

export const getThreadDisabledReason = (
  status: WhatsappConnectionStatus | null,
  chat: WhatsappChatSummary | null
) => {
  if (!chat) {
    return "Pilih thread untuk melihat detail percakapan."
  }

  if (status?.state !== "ready") {
    return "Cloud API belum siap. Composer dinonaktifkan sampai provider sehat."
  }

  return composerHelpText[chat.composerMode]
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

export function ProviderHealthCard({
  status,
  onRefresh,
  isRefreshing,
}: {
  status: WhatsappConnectionStatus | null
  onRefresh?: () => void
  isRefreshing?: boolean
}) {
  const isMobile = useIsMobile()

  return (
    <Collapsible
      defaultOpen={false}
      className="max-w-full overflow-hidden rounded-3xl border border-line-base bg-bg-surface shadow-card"
    >
      <div className={cn("flex items-start gap-3", isMobile ? "px-4 py-3" : "px-5 py-4")}>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-text-strong">
              {isMobile ? "Status WhatsApp" : "Cloud API Provider Health"}
            </h2>
            <Badge
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                status ? providerTone[status.state] : "bg-slate-100 text-slate-700"
              )}
            >
              {status ? providerLabel[status.state] : "Tidak diketahui"}
            </Badge>
            <Badge
              variant="outline"
              className={cn("rounded-full px-3 py-1 text-xs", isMobile && "hidden")}
            >
              {status?.provider === "cloud_api" ? "Cloud API" : "Disabled"}
            </Badge>
          </div>
          <p className={cn("mt-2 text-sm text-text-muted", isMobile && "hidden")}>
            {status?.summary ?? "Status provider WhatsApp belum tersedia."}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onRefresh && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              onClick={onRefresh}
              disabled={isRefreshing}
              aria-label="Refresh status WhatsApp"
            >
              {isRefreshing ? (
                <Loader2 className={cn("h-4 w-4 animate-spin", !isMobile && "mr-1")} />
              ) : (
                <RefreshCw className={cn("h-4 w-4", !isMobile && "mr-1")} />
              )}
              <span className={cn(isMobile && "sr-only")}>Refresh</span>
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl"
              data-testid="whatsapp-provider-toggle"
              aria-label="Tampilkan detail status WhatsApp"
            >
              <span className={cn(isMobile && "sr-only")}>Detail</span>
              <ChevronDown className={cn("h-4 w-4", !isMobile && "ml-1")} />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>
      <CollapsibleContent
        className={cn("border-t border-line-base", isMobile ? "px-4 py-3" : "px-5 py-4")}
        data-testid="whatsapp-provider-details"
      >
        {isMobile && (
          <p className="mb-3 text-sm text-text-muted">
            {status?.summary ?? "Status provider WhatsApp belum tersedia."}
          </p>
        )}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <InfoTile icon={ShieldCheck} label="Ringkasan" value={status?.summary ?? "-"} />
          <InfoTile icon={Smartphone} label="Phone Number ID" value={status?.phoneNumberId ?? "-"} />
          <InfoTile icon={Webhook} label="Webhook Path" value={status?.webhookPath ?? "-"} />
          <InfoTile icon={MessageCircle} label="Current Phone" value={status?.currentPhone ?? "-"} />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export function ThreadListItem({
  chat,
  isActive,
  href,
  onSelect,
}: {
  chat: WhatsappChatSummary
  isActive: boolean
  href?: string
  onSelect?: () => void
}) {
  const content = (
    <>
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
    </>
  )

  const className = cn(
    "block w-full rounded-2xl border px-4 py-3 text-left transition-colors",
    isActive
      ? "border-emerald-300 bg-emerald-50"
      : "border-line-base bg-bg-surface hover:bg-bg-subtle"
  )

  if (href) {
    return (
      <Link
        href={href}
        data-testid={`whatsapp-thread-${chat.chatId}`}
        className={className}
        onClick={onSelect}
      >
        {content}
      </Link>
    )
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`whatsapp-thread-${chat.chatId}`}
      className={className}
    >
      {content}
    </button>
  )
}

export function MessageBubble({
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
          <Badge className={cn("rounded-full", messageStatusTone[message.providerStatus])}>
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

export function ThreadTimeline({
  messages,
  onOpenMedia,
  className,
}: {
  messages: WhatsappMessageItem[]
  onOpenMedia: (providerMessageId: string) => void
  className?: string
}) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const bottomAnchorRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const lastMessageIdRef = useRef<string | null>(null)

  const getViewport = () =>
    rootRef.current?.querySelector<HTMLDivElement>('[data-slot="scroll-area-viewport"]') ?? null

  useEffect(() => {
    const viewport = getViewport()
    if (!viewport) {
      return
    }

    const handleScroll = () => {
      const distanceFromBottom =
        viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
      stickToBottomRef.current = distanceFromBottom <= 96
    }

    handleScroll()
    viewport.addEventListener("scroll", handleScroll, { passive: true })
    return () => viewport.removeEventListener("scroll", handleScroll)
  }, [])

  useLayoutEffect(() => {
    const viewport = getViewport()
    const lastMessageId = messages.at(-1)?.providerMessageId ?? null
    if (!viewport || !lastMessageId) {
      return
    }

    const shouldScroll = lastMessageIdRef.current === null || stickToBottomRef.current
    lastMessageIdRef.current = lastMessageId
    if (!shouldScroll) {
      return
    }

    requestAnimationFrame(() => {
      const nextViewport = getViewport()
      if (!nextViewport) {
        return
      }

      bottomAnchorRef.current?.scrollIntoView({ block: "end" })
      nextViewport.scrollTop = nextViewport.scrollHeight
      stickToBottomRef.current = true
    })
  }, [messages])

  return (
    <ScrollArea
      ref={rootRef}
      className={cn("min-h-0 flex-1 overscroll-contain px-4 py-4", className)}
      data-testid="whatsapp-thread-timeline"
    >
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
          <div ref={bottomAnchorRef} aria-hidden="true" className="h-px w-full" />
        </div>
      )}
    </ScrollArea>
  )
}

export function ThreadComposer({
  status,
  selectedChat,
  composerValue,
  onComposerChange,
  onSend,
  isSending,
  composerError,
  showStatusNote = true,
  className,
}: {
  status: WhatsappConnectionStatus | null
  selectedChat: WhatsappChatSummary | null
  composerValue: string
  onComposerChange: (value: string) => void
  onSend: () => void
  isSending: boolean
  composerError: string | null
  showStatusNote?: boolean
  className?: string
}) {
  const isMobile = useIsMobile()
  const canSend = Boolean(
    status &&
      status.state === "ready" &&
      selectedChat?.composerMode === "free_form" &&
      composerValue.trim()
  )

  return (
    <div
      className={cn(
        "border-t border-line-base bg-bg-surface/95 backdrop-blur-sm",
        isMobile ? "px-3 pt-2.5 pb-[calc(env(safe-area-inset-bottom)+0.625rem)]" : "px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]",
        className
      )}
    >
      {showStatusNote && (
        <div className={cn("rounded-2xl bg-bg-subtle text-text-muted", isMobile ? "mb-2 px-3 py-1.5 text-[11px] leading-5" : "mb-3 px-3 py-2 text-xs")}>
          {getThreadDisabledReason(status, selectedChat)}
        </div>
      )}
      {composerError && (
        <div className={cn("rounded-2xl border border-rose-200 bg-rose-50 text-rose-700", isMobile ? "mb-2 px-3 py-1.5 text-xs" : "mb-3 px-3 py-2 text-sm")}>
          {composerError}
        </div>
      )}
      <div className={cn("flex flex-col", isMobile ? "gap-2" : "gap-3")}>
        <Textarea
          value={composerValue}
          onChange={(event) => onComposerChange(event.target.value)}
          placeholder="Tulis balasan singkat untuk pelanggan..."
          className={cn(
            "rounded-2xl border-line-base bg-bg-surface",
            isMobile ? "min-h-16 px-3 py-2" : "min-h-24"
          )}
          disabled={status?.state !== "ready" || selectedChat?.composerMode !== "free_form" || isSending}
          data-testid="whatsapp-composer-input"
        />
        <div className={cn("flex justify-between gap-3", isMobile ? "items-center" : "items-end")}>
          <p className={cn("text-text-muted", isMobile ? "text-[11px] leading-4" : "text-xs")}>
            Hanya balasan teks non-template yang didukung pada fase ini.
          </p>
          <Button
            type="button"
            className={cn(
              "shrink-0 rounded-2xl bg-rose-600 hover:bg-rose-500",
              isMobile ? "h-10 px-4 text-sm" : ""
            )}
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
  )
}

export function ThreadHeader({
  status,
  selectedChat,
  detailHref,
  onRefresh,
  isRefreshing,
  showBackButton = false,
  onBack,
}: {
  status: WhatsappConnectionStatus | null
  selectedChat: WhatsappChatSummary | null
  detailHref?: string
  onRefresh?: () => void
  isRefreshing?: boolean
  showBackButton?: boolean
  onBack?: () => void
}) {
  const isMobile = useIsMobile()

  if (!selectedChat) {
    return null
  }

  return (
    <div
      className={cn(
        "sticky top-0 z-30 border-b border-line-base bg-bg-surface/95 backdrop-blur-sm sm:px-5",
        isMobile ? "px-3 pt-1.5 pb-2" : "px-4 py-4"
      )}
    >
      <div className={cn("flex flex-col", isMobile ? "gap-2.5" : "gap-4")}>
        <div className={cn("flex", isMobile ? "flex-col gap-2.5" : "flex-col gap-4 sm:flex-row sm:items-start sm:justify-between")}>
          <div className="min-w-0 flex-1">
            {showBackButton && onBack && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn("rounded-xl px-2 text-text-muted", isMobile ? "mb-0.5 h-7 justify-start text-xs" : "mb-2 h-8")}
                onClick={onBack}
                data-testid="whatsapp-thread-back"
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Kembali
              </Button>
            )}
            <h2 className={cn("font-semibold text-text-strong", isMobile ? "text-[15px] leading-tight" : "text-base")}>{selectedChat.title}</h2>
            <p className={cn("break-words text-text-muted", isMobile ? "mt-px text-xs leading-tight" : "mt-1 text-sm")}>
              {selectedChat.phone ?? selectedChat.waId ?? selectedChat.chatId}
            </p>
          </div>
          <div
            className={cn(
              "flex shrink-0 gap-2",
              isMobile
                ? "w-full flex-nowrap items-center gap-1.5"
                : "w-full flex-col sm:w-auto sm:min-w-fit sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"
            )}
          >
            {onRefresh && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-xl",
                  isMobile ? "h-7 min-w-0 flex-1 px-2.5 text-[11px]" : "w-full sm:w-auto"
                )}
                onClick={onRefresh}
                disabled={isRefreshing}
                data-testid="whatsapp-thread-refresh"
              >
                {isRefreshing ? (
                  <Loader2 className={cn("animate-spin", isMobile ? "mr-1 h-3.5 w-3.5" : "mr-1 h-4 w-4")} />
                ) : (
                  <RefreshCw className={cn(isMobile ? "mr-1 h-3.5 w-3.5" : "mr-1 h-4 w-4")} />
                )}
                Refresh
              </Button>
            )}
            {selectedChat.customerId && (
              <Button
                asChild
                variant="outline"
                size="sm"
                className={cn(
                  "rounded-xl",
                  isMobile ? "h-7 min-w-0 flex-1 px-2.5 text-[11px]" : "w-full sm:w-auto"
                )}
                data-testid="whatsapp-linked-customer-link"
              >
                <Link href={`/admin/pelanggan/${selectedChat.customerId}`}>
                  <UserRound className={cn(isMobile ? "mr-1 h-3.5 w-3.5" : "mr-1 h-4 w-4")} />
                  {isMobile ? "Customer" : "Buka Customer"}
                </Link>
              </Button>
            )}
            {!showBackButton && detailHref && (
              <Button
                asChild
                variant="ghost"
                size="sm"
                className={cn(
                  "rounded-xl lg:hidden",
                  isMobile ? "h-7 min-w-0 flex-1 px-2.5 text-[11px]" : "w-full sm:w-auto"
                )}
              >
                <Link href={detailHref}>Buka Penuh</Link>
              </Button>
            )}
          </div>
        </div>
        <div className={cn("flex min-w-0 flex-wrap overflow-x-hidden", isMobile ? "gap-1.5" : "gap-2")}>
          <Badge className={cn("rounded-full", composerTone[selectedChat.composerMode])}>
            {composerLabel[selectedChat.composerMode]}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {windowBadge(selectedChat)}
          </Badge>
          <Badge
            variant="outline"
            className={cn(
              "rounded-full",
              selectedChat.customerId ? "border-emerald-200 text-emerald-700" : "border-slate-200 text-slate-600"
            )}
          >
            {selectedChat.customerId ? "Terkait customer" : "Belum terkait customer"}
          </Badge>
          {selectedChat.isFepOpen && (
            <Badge variant="outline" className="rounded-full">
              FEP hingga {selectedChat.fepExpiresAtLabel ?? "-"}
            </Badge>
          )}
          {status?.state !== "ready" && (
            <Badge className={cn("rounded-full", providerTone[status?.state ?? "disabled"])}>
              Provider {status ? providerLabel[status.state] : "Tidak diketahui"}
            </Badge>
          )}
        </div>
      </div>
    </div>
  )
}

export function ThreadPanel({
  status,
  selectedChat,
  messages,
  composerValue,
  onComposerChange,
  onSend,
  isSending,
  composerError,
  onOpenMedia,
  onRefresh,
  isRefreshing,
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
  onRefresh?: () => void
  isRefreshing?: boolean
}) {
  if (!selectedChat) {
    return (
      <div
        data-testid="whatsapp-thread-panel"
        className="flex min-h-[32rem] items-center justify-center px-6 py-10 text-center text-sm text-text-muted lg:h-[calc(100dvh-11rem)] lg:max-h-[calc(100dvh-11rem)] lg:min-h-0"
      >
        Pilih thread di panel kiri untuk melihat timeline dan membalas pesan pelanggan.
      </div>
    )
  }

  return (
    <div
      data-testid="whatsapp-thread-panel"
      className="flex min-h-[32rem] max-w-full flex-col overflow-hidden lg:h-[calc(100dvh-11rem)] lg:max-h-[calc(100dvh-11rem)] lg:min-h-0"
    >
      <ThreadHeader
        status={status}
        selectedChat={selectedChat}
        detailHref={getWhatsappThreadHref(selectedChat.chatId)}
        onRefresh={onRefresh}
        isRefreshing={isRefreshing}
      />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <ThreadTimeline messages={messages} onOpenMedia={onOpenMedia} />
        <ThreadComposer
          status={status}
          selectedChat={selectedChat}
          composerValue={composerValue}
          onComposerChange={onComposerChange}
          onSend={onSend}
          isSending={isSending}
          composerError={composerError}
        />
      </div>
    </div>
  )
}
