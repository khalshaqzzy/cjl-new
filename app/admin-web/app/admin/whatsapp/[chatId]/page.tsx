"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import type {
  WhatsappChatSummary,
  WhatsappConnectionStatus,
  WhatsappMessageItem,
} from "@cjl/contracts"
import { TriangleAlert } from "lucide-react"
import { AdminShell } from "@/components/admin/admin-shell"
import {
  ThreadComposer,
  ThreadHeader,
  ThreadTimeline,
  fetchWhatsappMessages,
  fetchWhatsappOverview,
  mergeLatestMessageIntoChats,
  updateChatReadState,
} from "@/components/admin/whatsapp-inbox"
import { Button } from "@/components/ui/button"
import { adminApi } from "@/lib/api"

const decodeChatId = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export default function WhatsappThreadDetailPage() {
  const params = useParams<{ chatId: string }>()
  const router = useRouter()
  const routeChatId = decodeChatId(params.chatId)

  const [status, setStatus] = useState<WhatsappConnectionStatus | null>(null)
  const [chats, setChats] = useState<WhatsappChatSummary[]>([])
  const [messages, setMessages] = useState<WhatsappMessageItem[]>([])
  const [composerValue, setComposerValue] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [composerError, setComposerError] = useState<string | null>(null)

  const selectedChat = useMemo(
    () => chats.find((chat) => chat.chatId === routeChatId) ?? null,
    [chats, routeChatId]
  )

  const syncThread = async () => {
    const overview = await fetchWhatsappOverview()
    setStatus(overview.status)
    setChats(overview.chats)

    const chat = overview.chats.find((item) => item.chatId === routeChatId)
    if (!chat) {
      setMessages([])
      setLoadError("Thread WhatsApp tidak ditemukan atau sudah tidak tersedia.")
      return
    }

    const nextMessages = await fetchWhatsappMessages(routeChatId)
    setMessages(nextMessages)
    setLoadError(null)

    if (chat.unreadCount > 0) {
      await adminApi.markWhatsappChatRead(routeChatId)
      setChats((current) => updateChatReadState(current, routeChatId))
    }
  }

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await syncThread()
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Gagal memuat thread WhatsApp")
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void run()
    const overviewInterval = window.setInterval(() => {
      void run()
    }, 8000)

    return () => {
      cancelled = true
      window.clearInterval(overviewInterval)
    }
  }, [routeChatId])

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        const payload = await fetchWhatsappMessages(routeChatId)
        if (!cancelled) {
          setMessages(payload)
        }
      } catch (error) {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : "Gagal memuat timeline WhatsApp")
        }
      }
    }

    if (!selectedChat) {
      return
    }

    const interval = window.setInterval(() => {
      void run()
    }, 6000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [routeChatId, selectedChat])

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await syncThread()
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Gagal refresh thread WhatsApp")
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleSendMessage = async () => {
    if (!selectedChat || !composerValue.trim()) {
      return
    }

    setIsSending(true)
    setComposerError(null)
    try {
      const result = await adminApi.sendWhatsappMessage(
        routeChatId,
        composerValue.trim(),
        crypto.randomUUID()
      )
      setMessages((current) => [...current, result])
      setChats((current) => mergeLatestMessageIntoChats(current, routeChatId, result))
      setComposerValue("")
      await syncThread()
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
      title="Thread WhatsApp"
      subtitle="Tampilan penuh untuk percakapan pelanggan"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-10 text-center text-sm text-text-muted">
            Memuat thread WhatsApp...
          </div>
        ) : (
          <div
            data-testid="whatsapp-thread-panel"
            className="fixed inset-x-0 bottom-24 top-14 flex min-h-0 min-w-0 max-w-full flex-col overflow-hidden bg-bg-surface lg:static lg:inset-auto lg:flex-1"
          >
            <div className="flex min-h-0 min-w-0 flex-1 max-w-full flex-col overflow-hidden lg:h-[calc(100dvh-9rem)] lg:max-h-[calc(100dvh-9rem)] lg:min-h-0">
              <ThreadHeader
                status={status}
                selectedChat={selectedChat}
                onRefresh={() => void handleRefresh()}
                isRefreshing={isRefreshing}
                showBackButton
                onBack={() => router.push("/admin/whatsapp")}
              />

              {loadError || !selectedChat ? (
                <div className="flex min-h-0 flex-1 items-center justify-center px-6 py-10">
                  <div className="max-w-md space-y-4 text-center">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-bg text-warning">
                      <TriangleAlert className="h-5 w-5" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-lg font-semibold text-text-strong">Thread tidak tersedia</h2>
                      <p className="text-sm text-text-muted">
                        {loadError ?? "Thread ini belum punya data yang bisa ditampilkan."}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-xl"
                      onClick={() => router.push("/admin/whatsapp")}
                      data-testid="whatsapp-thread-empty-back"
                    >
                      Kembali ke daftar thread
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-surface">
                  <ThreadTimeline
                    messages={messages}
                    onOpenMedia={openMedia}
                    className="min-w-0 max-w-full"
                  />
                  <ThreadComposer
                    status={status}
                    selectedChat={selectedChat}
                    composerValue={composerValue}
                    onComposerChange={setComposerValue}
                    onSend={() => void handleSendMessage()}
                    isSending={isSending}
                    composerError={composerError}
                    showStatusNote={false}
                    className="sticky bottom-0 z-20 shrink-0"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminShell>
  )
}
