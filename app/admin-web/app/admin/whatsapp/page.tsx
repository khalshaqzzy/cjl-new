"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappMessageItem,
} from "@cjl/contracts"
import { Search, X } from "lucide-react"
import { AdminShell } from "@/components/admin/admin-shell"
import {
  ProviderHealthCard,
  ThreadListItem,
  ThreadPanel,
  fetchWhatsappMessages,
  fetchWhatsappOverview,
  getWhatsappThreadHref,
  mergeLatestMessageIntoChats,
  updateChatReadState,
} from "@/components/admin/whatsapp-inbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useIsMobile } from "@/components/ui/use-mobile"
import { adminApi } from "@/lib/api"

export default function WhatsappAdminPage() {
  const router = useRouter()
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
    const payload = await fetchWhatsappOverview()
    setStatus(payload.status)
    setChats(payload.chats)
    setLoadError(null)
    setSelectedChatId((current) => {
      if (isMobile) {
        return current
      }

      if (preserveSelection && current && payload.chats.some((chat) => chat.chatId === current)) {
        return current
      }

      return payload.chats[0]?.chatId ?? null
    })
  }

  const loadDesktopMessages = async (chatId: string) => {
    const payload = await fetchWhatsappMessages(chatId)
    setMessages(payload)
  }

  const selectChat = async (chat: WhatsappChatSummary) => {
    if (isMobile) {
      router.push(getWhatsappThreadHref(chat.chatId))
      return
    }

    setSelectedChatId(chat.chatId)
    setComposerError(null)
    setComposerValue("")

    try {
      await loadDesktopMessages(chat.chatId)
      if (chat.unreadCount > 0) {
        await adminApi.markWhatsappChatRead(chat.chatId)
        setChats((current) => updateChatReadState(current, chat.chatId))
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
  }, [isMobile])

  useEffect(() => {
    if (isMobile || !selectedChatId) {
      setMessages([])
      return
    }

    let cancelled = false
    const run = async () => {
      try {
        const payload = await fetchWhatsappMessages(selectedChatId)
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
  }, [isMobile, selectedChatId])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await syncChats()
      if (!isMobile && selectedChatId) {
        await loadDesktopMessages(selectedChatId)
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
      const result = await adminApi.sendWhatsappMessage(
        selectedChatId,
        composerValue.trim(),
        crypto.randomUUID()
      )
      setMessages((current) => [...current, result])
      setChats((current) => mergeLatestMessageIntoChats(current, selectedChatId, result))
      setComposerValue("")
      await syncChats()
    } catch (error) {
      setComposerError(error instanceof Error ? error.message : "Gagal mengirim pesan WhatsApp")
    } finally {
      setIsSending(false)
    }
  }

  const openMedia = async (providerMessageId: string) => {
    window.open(adminApi.getWhatsappMediaUrl(providerMessageId), "_blank", "noopener,noreferrer")
  }

  return (
    <AdminShell title="WhatsApp" subtitle="Inbox internal berbasis Cloud API, webhook status, dan balasan operator">
      <div className="flex h-full min-h-0 max-w-full flex-col space-y-5 overflow-x-hidden px-4 py-5 lg:gap-5 lg:space-y-0 lg:overflow-hidden lg:px-6">
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

            <ProviderHealthCard
              status={status}
              onRefresh={() => void handleRefresh()}
              isRefreshing={isRefreshing}
            />

            <div className="grid max-w-full gap-5 lg:min-h-0 lg:flex-1 lg:grid-cols-[360px_minmax(0,1fr)] lg:overflow-hidden">
              <Card className="max-w-full overflow-hidden rounded-3xl border-line-base lg:flex lg:min-h-0 lg:flex-col">
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
                <CardContent className="min-w-0 px-3 pb-3 lg:min-h-0 lg:flex-1">
                  <ScrollArea className="max-w-full pr-2 lg:h-full">
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
                            isActive={!isMobile && selectedChatId === chat.chatId}
                            href={isMobile ? getWhatsappThreadHref(chat.chatId) : undefined}
                            onSelect={isMobile ? undefined : () => void selectChat(chat)}
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
                  onOpenMedia={(providerMessageId) => void openMedia(providerMessageId)}
                  onRefresh={() => void handleRefresh()}
                  isRefreshing={isRefreshing}
                />
              )}
            </div>
          </>
        )}
      </div>
    </AdminShell>
  )
}
