'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Phone, User, ArrowRight, FileText, History, Star } from 'lucide-react'
import { publicApi } from '@/lib/api'

const features = [
  { icon: FileText, label: 'Status Order', desc: 'Pantau real-time' },
  { icon: History, label: 'Riwayat', desc: 'Semua transaksi' },
  { icon: Star, label: 'Stamp & Reward', desc: 'Gratis cuci' },
]

export default function LoginPage() {
  const router = useRouter()
  const [phone, setPhone] = useState('')
  const [name, setName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  // Card tilt on mouse move
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    const handleMove = (e: MouseEvent) => {
      const rect = card.getBoundingClientRect()
      const x = (e.clientX - rect.left) / rect.width - 0.5
      const y = (e.clientY - rect.top) / rect.height - 0.5
      card.style.transform = `perspective(1000px) rotateY(${x * 4}deg) rotateX(${-y * 4}deg) translateZ(4px)`
    }
    const handleLeave = () => {
      card.style.transform = 'perspective(1000px) rotateY(0deg) rotateX(0deg) translateZ(0px)'
    }
    card.addEventListener('mousemove', handleMove)
    card.addEventListener('mouseleave', handleLeave)
    return () => {
      card.removeEventListener('mousemove', handleMove)
      card.removeEventListener('mouseleave', handleLeave)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!phone || !name) {
      setError('Nomor HP dan nama harus diisi.')
      return
    }
    setIsLoading(true)
    try {
      await publicApi.login(phone, name)
      router.push('/portal')
      return
    } catch (_error) {
      setError('Nomor HP atau nama tidak sesuai.')
    }
    setIsLoading(false)
  }

  return (
    <div className="relative min-h-screen bg-bg-soft overflow-hidden flex items-center justify-center px-4 py-16">
      {/* Ambient glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-[140px] pointer-events-none bg-pink-hot/8" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full blur-[120px] pointer-events-none bg-pink-rose/6" />

      {/* Dot grid */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.35]" style={{
        backgroundImage: 'radial-gradient(circle, rgba(240,78,148,0.18) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }} />

      {/* Floating orbs */}
      <div className="absolute top-20 right-16 w-3 h-3 rounded-full bg-pink-hot/30 animate-float" />
      <div className="absolute top-1/3 left-8 w-2 h-2 rounded-full bg-pink-rose/40 animate-float-slow" style={{ animationDelay: '1s' }} />
      <div className="absolute bottom-32 right-24 w-2 h-2 rounded-full bg-pink-hot/25 animate-float" style={{ animationDelay: '2s' }} />

      <div className={`relative z-10 w-full max-w-md transition-all duration-700 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        {/* Back link */}
        <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-pink-hot transition-colors mb-8 text-sm group">
          <span className="group-hover:-translate-x-1 transition-transform">←</span>
          Kembali ke beranda
        </Link>

        {/* Main card */}
        <div
          ref={cardRef}
          style={{ transition: 'transform 0.12s ease-out' }}
          className="bg-white border border-pink-soft rounded-3xl overflow-hidden shadow-xl shadow-pink-hot/8"
        >
          {/* Top strip */}
          <div className="h-1 w-full bg-gradient-primary" />

          <div className="p-8">
            {/* Logo */}
            <div className="flex items-center gap-3 mb-8">
              <div className="relative w-11 h-11">
                <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-15 blur-md animate-pulse" />
                <div className="relative w-11 h-11 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-pink-hot/25">
                  <span className="font-display font-bold text-lg text-white">CJ</span>
                </div>
              </div>
              <div>
                <p className="font-display font-bold text-text-strong leading-tight">CJ Laundry</p>
                <p className="text-xs text-text-muted">Portal Pelanggan</p>
              </div>
            </div>

            {/* Heading */}
            <div className="mb-8">
              <h1 className="font-display text-3xl font-bold text-text-strong leading-tight mb-2">
                Selamat<br />
                <span className="text-gradient-pink">Datang.</span>
              </h1>
              <p className="text-text-muted text-sm leading-relaxed">
                Masuk dengan nomor HP &amp; nama yang terdaftar untuk mengakses akun Anda.
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Phone */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                  Nomor HP
                </label>
                <div className={`relative flex items-center rounded-xl border transition-all duration-200 overflow-hidden bg-bg-soft
                  ${focusedField === 'phone'
                    ? 'border-pink-hot shadow-[0_0_0_3px_rgba(240,78,148,0.12)]'
                    : 'border-line-soft hover:border-pink-soft'}`}>
                  <Phone className="absolute left-4 w-4 h-4 text-pink-hot/50 pointer-events-none" />
                  <input
                    type="tel"
                    data-testid="public-login-phone"
                    placeholder="08xxxxxxxxxx"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    onFocus={() => setFocusedField('phone')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-text-strong placeholder-text-muted/50 text-sm outline-none"
                  />
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="block text-xs font-semibold text-text-muted mb-1.5 uppercase tracking-wider">
                  Nama
                </label>
                <div className={`relative flex items-center rounded-xl border transition-all duration-200 overflow-hidden bg-bg-soft
                  ${focusedField === 'name'
                    ? 'border-pink-hot shadow-[0_0_0_3px_rgba(240,78,148,0.12)]'
                    : 'border-line-soft hover:border-pink-soft'}`}>
                  <User className="absolute left-4 w-4 h-4 text-pink-hot/50 pointer-events-none" />
                  <input
                    type="text"
                    data-testid="public-login-name"
                    placeholder="Nama sesuai pendaftaran"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    onFocus={() => setFocusedField('name')}
                    onBlur={() => setFocusedField(null)}
                    className="w-full bg-transparent pl-11 pr-4 py-3.5 text-text-strong placeholder-text-muted/50 text-sm outline-none"
                  />
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm bg-danger/8 border border-danger/20 text-danger">
                  <span className="text-base">!</span>
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                data-testid="public-login-submit"
                disabled={isLoading}
                className="relative w-full py-3.5 rounded-xl font-display font-semibold text-white overflow-hidden group transition-all duration-200 hover:shadow-[0_8px_24px_rgba(240,78,148,0.35)] disabled:opacity-60 disabled:cursor-not-allowed bg-gradient-primary mt-2"
              >
                <span className="absolute inset-0 overflow-hidden pointer-events-none">
                  <span className="absolute top-0 bottom-0 w-12 bg-white/15 blur-sm -translate-x-full group-hover:translate-x-[500%] transition-transform duration-700 skew-x-[-15deg]" />
                </span>
                <span className="relative flex items-center justify-center gap-2">
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      Masuk ke Portal
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </>
                  )}
                </span>
              </button>
            </form>

            <p className="mt-5 text-center text-xs text-text-muted leading-relaxed">
              Gunakan nomor HP &amp; nama yang didaftarkan saat pertama kali transaksi.
            </p>
          </div>
        </div>

        {/* Feature pills */}
        <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
          {features.map((f, i) => (
            <div
              key={f.label}
              className={`flex items-center gap-2 px-3 py-2 rounded-full text-xs bg-white border border-pink-soft shadow-sm transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
              style={{ transitionDelay: `${300 + i * 80}ms` }}
            >
              <f.icon className="w-3 h-3 text-pink-hot" />
              <span className="font-medium text-text-strong">{f.label}</span>
              <span className="text-text-muted">·</span>
              <span className="text-text-muted">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
