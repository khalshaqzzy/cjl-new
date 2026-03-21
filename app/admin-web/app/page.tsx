"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Shirt, Eye, EyeOff, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"

export default function LoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    adminApi
      .getSession()
      .then((payload) => {
        if (payload.authenticated) {
          router.replace("/admin")
          return
        }
      })
      .catch(() => undefined)
      .finally(() => setIsCheckingSession(false))
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)
    try {
      await adminApi.login(username, password)
      router.push("/admin")
      return
    } catch (_error) {
      setError("Username atau password salah")
    }
    setIsLoading(false)
  }

  return (
    <div className="min-h-screen bg-bg-canvas flex">
      {/* Left decorative panel — desktop only */}
      <div className="hidden lg:flex lg:w-[44%] bg-text-strong flex-col justify-between p-12 relative overflow-hidden">
        {/* Grid texture overlay */}
        <div className="absolute inset-0 opacity-[0.04]" style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
          backgroundSize: '48px 48px',
        }} />
        {/* Top brand mark */}
        <div className="relative flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600">
            <Shirt className="h-5 w-5 text-white" />
          </div>
          <span className="text-white font-semibold tracking-tight">CJ Laundry</span>
        </div>
        {/* Center content */}
        <div className="relative space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            <span className="text-xs text-white/60">Sistem Operasional Aktif</span>
          </div>
          <h1 className="font-display text-4xl font-bold text-white leading-tight">
            Kelola Laundry<br />dengan Presisi
          </h1>
          <p className="text-white/50 leading-relaxed max-w-sm">
            Panel admin terpadu untuk order, pelanggan, notifikasi WhatsApp, dan pelaporan operasional harian.
          </p>
        </div>
        {/* Bottom stats */}
        <div className="relative grid grid-cols-3 gap-4">
          {[
            { label: "Order Hari Ini", value: "24" },
            { label: "Pelanggan Aktif", value: "138" },
            { label: "Notifikasi Terkirim", value: "96%" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-white/8 bg-white/5 p-4">
              <p className="font-display text-xl font-bold text-white">{s.value}</p>
              <p className="text-xs text-white/40 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right — login form */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 bg-bg-surface">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-600">
              <Shirt className="h-5 w-5 text-white" />
            </div>
            <span className="font-semibold text-text-strong tracking-tight">CJ Laundry</span>
          </div>

          {/* Heading */}
          <div className="space-y-1">
            <h2 className="font-display text-2xl font-bold text-text-strong">
              Masuk ke Admin
            </h2>
            <p className="text-sm text-text-muted">
              Masukkan kredensial untuk melanjutkan
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="rounded-lg border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
                {error}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="username" className="text-sm font-medium text-text-body">
                Username
              </label>
              <Input
                id="username"
                type="text"
                data-testid="admin-login-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username"
                disabled={isLoading || isCheckingSession}
                className={cn(
                  "h-11 rounded-lg border-line-base bg-bg-subtle",
                  "placeholder:text-text-placeholder",
                  "focus-visible:border-rose-600 focus-visible:ring-rose-600/15"
                )}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="text-sm font-medium text-text-body">
                Password
              </label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  data-testid="admin-login-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  disabled={isLoading || isCheckingSession}
                  className={cn(
                    "h-11 rounded-lg border-line-base bg-bg-subtle pr-11",
                    "placeholder:text-text-placeholder",
                    "focus-visible:border-rose-600 focus-visible:ring-rose-600/15"
                  )}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-body transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              data-testid="admin-login-submit"
              disabled={isLoading || isCheckingSession}
              className="w-full h-11 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold transition-colors"
            >
              {isLoading || isCheckingSession ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isCheckingSession ? "Memeriksa sesi..." : "Memproses..."}
                </>
              ) : (
                "Masuk"
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-text-muted">
            Akses terbatas. Hubungi pengelola jika membutuhkan bantuan.
          </p>
        </div>
      </div>
    </div>
  )
}
