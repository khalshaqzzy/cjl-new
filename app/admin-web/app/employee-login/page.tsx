"use client"

import Link from "next/link"
import { Suspense, useEffect, useRef, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, CheckCircle2, Loader2, Shirt } from "lucide-react"
import { Button } from "@/components/ui/button"
import { adminApi } from "@/lib/api"

type State = "loading" | "success" | "invalid"

function EmployeeLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token") ?? ""
  const [state, setState] = useState<State>("loading")
  const [message, setMessage] = useState("Sedang memproses login karyawan...")
  const redeemRef = useRef<{ token: string; request: ReturnType<typeof adminApi.redeemEmployeeLoginLink> } | null>(null)

  useEffect(() => {
    if (!token) {
      setState("invalid")
      setMessage("Link login tidak lengkap. Silakan masuk manual ke admin.")
      return
    }

    let active = true
    if (redeemRef.current?.token !== token) {
      redeemRef.current = {
        token,
        request: adminApi.redeemEmployeeLoginLink(token),
      }
    }

    redeemRef.current.request
      .then(() => {
        if (!active) {
          return
        }

        setState("success")
        setMessage("Login karyawan berhasil. Anda akan diarahkan ke dashboard...")
        window.setTimeout(() => {
          router.replace("/admin")
        }, 600)
      })
      .catch((error) => {
        if (!active) {
          return
        }

        setState("invalid")
        setMessage(error instanceof Error ? error.message : "Link login karyawan tidak valid.")
      })

    return () => {
      active = false
    }
  }, [router, token])

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-canvas px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-line-base bg-bg-surface p-6 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-600 text-white">
          {state === "loading" ? (
            <Loader2 className="h-6 w-6 animate-spin" />
          ) : state === "success" ? (
            <CheckCircle2 className="h-6 w-6" />
          ) : (
            <AlertCircle className="h-6 w-6" />
          )}
        </div>

        <div className="mb-5 flex items-center justify-center gap-2 text-sm font-semibold text-text-strong">
          <Shirt className="h-4 w-4 text-rose-600" />
          CJ Laundry Admin
        </div>

        <h1 className="text-2xl font-bold text-text-strong">
          {state === "loading" ? "Memproses Login" : state === "success" ? "Login Berhasil" : "Link Tidak Valid"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-text-muted">{message}</p>

        {state === "invalid" ? (
          <div className="mt-6 flex flex-col gap-3">
            <Button asChild className="rounded-xl bg-rose-600 font-semibold text-white hover:bg-rose-500">
              <Link href="/">Masuk Manual</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/admin">Kembali ke Admin</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default function EmployeeLoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-bg-canvas px-4 py-12">
          <div className="flex items-center gap-2 rounded-2xl border border-line-base bg-bg-surface px-5 py-4 text-sm text-text-muted shadow-card">
            <Loader2 className="h-4 w-4 animate-spin" />
            Menyiapkan halaman login karyawan...
          </div>
        </div>
      }
    >
      <EmployeeLoginContent />
    </Suspense>
  )
}
