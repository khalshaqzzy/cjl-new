"use client"

import Link from "next/link"
import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react"
import { publicApi } from "@/lib/api"

type State = "loading" | "success" | "invalid"

function AutoLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [state, setState] = useState<State>("loading")
  const [message, setMessage] = useState("Sedang menyiapkan login otomatis Anda...")

  useEffect(() => {
    if (!token) {
      setState("invalid")
      setMessage("Link login tidak lengkap. Silakan masuk manual ke portal pelanggan.")
      return
    }

    let active = true

    publicApi.redeemMagicLink(token)
      .then(() => {
        if (!active) {
          return
        }

        setState("success")
        setMessage("Login berhasil. Anda akan diarahkan ke portal pelanggan...")
        window.setTimeout(() => {
          router.replace("/portal")
        }, 600)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setState("invalid")
        setMessage(error instanceof Error ? error.message : "Link login sudah tidak valid.")
      })

    return () => {
      active = false
    }
  }, [router, token])

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-bg-soft px-4 py-16">
      <div className="absolute left-1/4 top-1/4 h-80 w-80 rounded-full bg-pink-hot/8 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-72 w-72 rounded-full bg-pink-rose/6 blur-[120px]" />

      <div className="relative z-10 w-full max-w-md rounded-3xl border border-pink-soft bg-white p-8 text-center shadow-xl shadow-pink-hot/8">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-primary shadow-lg shadow-pink-hot/20">
          {state === "loading" ? (
            <Loader2 className="h-7 w-7 animate-spin text-white" />
          ) : state === "success" ? (
            <CheckCircle2 className="h-7 w-7 text-white" />
          ) : (
            <AlertCircle className="h-7 w-7 text-white" />
          )}
        </div>

        <h1 className="font-display text-3xl font-bold text-text-strong">
          {state === "loading" ? "Memproses Login" : state === "success" ? "Login Berhasil" : "Link Tidak Valid"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{message}</p>

        {state === "invalid" && (
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild className="rounded-xl bg-rose-600 font-semibold text-white hover:bg-rose-500">
              <Link href="/login">Masuk Manual</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/">Kembali ke Beranda</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AutoLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-soft px-4 py-16">
          <div className="flex items-center gap-2 rounded-2xl border border-line-soft bg-white px-5 py-4 text-sm text-text-muted shadow-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Menyiapkan halaman login otomatis...
          </div>
        </div>
      }
    >
      <AutoLoginContent />
    </Suspense>
  )
}
