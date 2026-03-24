"use client"

import { useState } from "react"
import type { AdminWhatsappContact } from "@cjl/contracts"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useIsMobile } from "@/hooks/use-mobile"
import { ArrowRight, MessageCircle, Phone } from "lucide-react"

const normalizeWhatsappDigits = (phone: string) => {
  const digits = phone.replace(/\D/g, "")
  if (!digits) {
    return ""
  }

  if (digits.startsWith("62")) {
    return digits
  }

  if (digits.startsWith("0")) {
    return `62${digits.slice(1)}`
  }

  return `62${digits}`
}

type AdminChatSelectorProps = {
  contacts: AdminWhatsappContact[]
  customerName: string
  customerPhone: string
}

export function AdminChatSelector({
  contacts,
  customerName,
  customerPhone,
}: AdminChatSelectorProps) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)

  const content = (
    <div className="space-y-4 px-4 pb-5">
      <div className="rounded-2xl border border-line-soft bg-bg-soft px-4 py-3 text-sm text-text-muted">
        Pilih nomor admin yang ingin Anda hubungi. Pesan awal akan otomatis menyertakan identitas portal Anda.
      </div>

      <div className="space-y-3">
        {contacts.map((contact, index) => {
          const whatsappUrl = `https://wa.me/${normalizeWhatsappDigits(contact.phone)}?text=${encodeURIComponent(
            `Halo Admin, saya ${customerName} (${customerPhone}) menghubungi dari portal customer CJ Laundry.`
          )}`

          return (
            <button
              key={contact.id}
              type="button"
              className="flex w-full items-center justify-between rounded-2xl border border-line-soft bg-white px-4 py-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-pink-soft hover:shadow-lg"
              onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}
              data-testid={`portal-admin-contact-${index}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-pink-cloud">
                  <Phone className="h-4 w-4 text-pink-hot" />
                </div>
                <div>
                  <p className="font-display text-base font-bold text-text-strong">Admin {index + 1}</p>
                  <p className="mt-0.5 text-sm text-text-muted">{contact.phone}</p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-pink-hot" />
            </button>
          )
        })}
      </div>
    </div>
  )

  return (
    <>
      <button
        type="button"
        className="group relative block overflow-hidden rounded-2xl bg-text-strong p-4 text-left text-white transition-all duration-500 hover:-translate-y-0.5 hover:shadow-lg"
        onClick={() => setOpen(true)}
        data-testid="portal-chat-admin-button"
      >
        <span className="absolute inset-0 overflow-hidden pointer-events-none">
          <span className="absolute top-0 bottom-0 w-12 -translate-x-full skew-x-[-15deg] bg-white/10 blur-sm transition-transform duration-700 group-hover:translate-x-[400%]" />
        </span>
        <MessageCircle className="mb-3 h-5 w-5 text-white" />
        <p className="font-display text-sm font-bold text-white">Chat Admin</p>
        <p className="mt-0.5 text-xs text-white/70">Pilih nomor admin yang tersedia</p>
      </button>

      {isMobile ? (
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="rounded-t-3xl">
            <DrawerHeader className="px-4 pt-4 text-left">
              <DrawerTitle className="text-base font-semibold text-text-strong">Chat Admin</DrawerTitle>
              <DrawerDescription className="text-sm text-text-muted">
                Pilih nomor admin untuk membuka WhatsApp.
              </DrawerDescription>
            </DrawerHeader>
            {content}
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg rounded-3xl border-line-soft p-0">
            <DialogHeader className="border-b border-line-soft px-6 pb-4 pt-6 text-left">
              <DialogTitle className="text-base font-semibold text-text-strong">Chat Admin</DialogTitle>
              <DialogDescription className="text-sm text-text-muted">
                Pilih nomor admin untuk membuka WhatsApp.
              </DialogDescription>
            </DialogHeader>
            {content}
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
