"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Check, Copy, ExternalLink, Loader2, QrCode } from "lucide-react"

type CustomerLoginLinkSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  loginUrl: string
  customerName?: string
  title?: string
  description?: string
}

export function CustomerLoginLinkSheet({
  open,
  onOpenChange,
  loginUrl,
  customerName,
  title = "QR Login Customer",
  description = "Pelanggan bisa scan QR ini atau membuka link sekali pakai untuk langsung masuk ke portal.",
}: CustomerLoginLinkSheetProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [copyState, setCopyState] = useState<"idle" | "done">("idle")

  useEffect(() => {
    if (!open || !loginUrl) {
      return
    }

    let active = true
    setIsGenerating(true)

    QRCode.toDataURL(loginUrl, {
      errorCorrectionLevel: "M",
      margin: 1,
      width: 320,
      color: {
        dark: "#111827",
        light: "#ffffff",
      },
    })
      .then((value) => {
        if (active) {
          setQrCodeDataUrl(value)
        }
      })
      .finally(() => {
        if (active) {
          setIsGenerating(false)
        }
      })

    return () => {
      active = false
    }
  }, [loginUrl, open])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(loginUrl)
    setCopyState("done")
    window.setTimeout(() => setCopyState("idle"), 1500)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl" aria-describedby={undefined}>
        <SheetHeader className="border-b border-line-base pb-4 text-left">
          <SheetTitle className="text-base font-semibold text-text-strong">{title}</SheetTitle>
          <SheetDescription className="text-sm text-text-muted">
            {customerName ? `${description} Customer: ${customerName}.` : description}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-5">
          <div className="rounded-3xl border border-line-base bg-bg-subtle p-4">
            <div className="mx-auto flex aspect-square w-full max-w-[280px] items-center justify-center rounded-2xl bg-white shadow-sm">
              {isGenerating ? (
                <div className="flex flex-col items-center gap-2 text-sm text-text-muted">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Menyiapkan QR...
                </div>
              ) : qrCodeDataUrl ? (
                <img
                  src={qrCodeDataUrl}
                  alt="QR login customer"
                  className="h-full w-full rounded-2xl object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-sm text-text-muted">
                  <QrCode className="h-5 w-5" />
                  QR tidak tersedia
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-line-base bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Link Sekali Pakai</p>
            <p className="mt-2 break-all text-sm leading-relaxed text-text-body">{loginUrl}</p>
          </div>

          <div className="rounded-2xl border border-info/20 bg-info/5 px-4 py-3 text-xs leading-relaxed text-info">
            Link ini hanya berlaku satu kali per token. Token lain yang belum dipakai tetap dapat digunakan.
          </div>
        </div>

        <SheetFooter className="gap-2">
          <Button variant="outline" className="flex-1 rounded-xl" onClick={handleCopy}>
            {copyState === "done" ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
            {copyState === "done" ? "Tersalin" : "Copy Link"}
          </Button>
          <Button
            className="flex-1 rounded-xl bg-rose-600 font-semibold text-white hover:bg-rose-500"
            onClick={() => window.open(loginUrl, "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            Buka Link
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
