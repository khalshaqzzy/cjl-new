'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Clock, Sparkles, Star, ArrowRight, MessageCircle } from 'lucide-react'

const floatingCards = [
  {
    icon: Clock,
    label: '1 Jam Selesai',
    sub: 'Express wash & dry',
    delay: '0s',
    className: 'top-[22%] right-[8%]',
  },
  {
    icon: Sparkles,
    label: 'Stamp Otomatis',
    sub: 'Tiap transaksi',
    delay: '1.4s',
    className: 'top-[48%] right-[4%]',
  },
  {
    icon: Star,
    label: '10 Stamp = Gratis',
    sub: 'Program loyalty',
    delay: '0.7s',
    className: 'top-[68%] right-[12%]',
  },
]

const stats = [
  { value: 500, suffix: '+', label: 'Pelanggan Aktif' },
  { value: 10, suffix: 'rb+', label: 'Cucian Selesai' },
  { value: 98, suffix: '%', label: 'Kepuasan' },
]

function AnimatedCounter({ value, suffix }: { value: number; suffix: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLSpanElement>(null)
  const started = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 1800
          const start = performance.now()
          const tick = (now: number) => {
            const progress = Math.min((now - start) / duration, 1)
            const ease = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(ease * value))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
          observer.disconnect()
        }
      },
      { threshold: 0.5 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [value])

  return (
    <span ref={ref}>
      {count}
      {suffix}
    </span>
  )
}

export function HeroSection({ whatsapp = "6287780563875" }: { whatsapp?: string }) {
  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden bg-bg-soft">
      {/* Decorative radial glow — very subtle pink */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[500px] bg-pink-hot/6 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[500px] h-[400px] bg-pink-rose/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(240,78,148,0.18) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Floating UI cards — desktop only */}
      {floatingCards.map((card) => (
        <div
          key={card.label}
          className={`absolute hidden xl:flex ${card.className} animate-float`}
          style={{ animationDelay: card.delay }}
        >
          <div className="glass border border-pink-soft rounded-2xl px-4 py-3 shadow-xl shadow-pink-hot/8 flex items-center gap-3 min-w-[180px]">
            <div className="w-9 h-9 rounded-xl bg-pink-cloud border border-pink-soft flex items-center justify-center flex-shrink-0">
              <card.icon className="w-4.5 h-4.5 text-pink-hot" size={18} />
            </div>
            <div>
              <p className="text-text-strong text-sm font-semibold leading-tight">{card.label}</p>
              <p className="text-text-muted text-xs mt-0.5">{card.sub}</p>
            </div>
          </div>
        </div>
      ))}

      {/* Main content */}
      <div className="relative z-10 container mx-auto px-6 lg:px-12 pt-32 pb-20">
        <div className="max-w-4xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full border border-pink-soft bg-white/80 mb-8 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-pulse-ring absolute inline-flex h-full w-full rounded-full bg-pink-hot opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-pink-hot" />
            </span>
            <span className="text-sm font-medium text-pink-hot">Laundry Self Service Modern</span>
          </div>

          {/* Headline */}
          <h1 className="font-display font-extrabold text-text-strong leading-[0.95] tracking-tight mb-8">
            <span className="block text-5xl sm:text-7xl lg:text-8xl xl:text-[96px]">Cucian</span>
            <span className="block text-5xl sm:text-7xl lg:text-8xl xl:text-[96px] text-gradient-pink mt-1">
              Bersih &amp; Wangi
            </span>
            <span className="block text-4xl sm:text-5xl lg:text-6xl xl:text-7xl text-text-muted mt-3 font-semibold">
              dalam 1 Jam.
            </span>
          </h1>

          {/* Sub */}
          <p className="text-text-body text-lg sm:text-xl leading-relaxed mb-10 max-w-2xl">
            Laundry self service dengan mesin modern, sistem stamp reward otomatis, dan status cucian real-time. Mulai dari{' '}
            <span className="text-text-strong font-semibold">Rp 10.000</span> per mesin.
          </p>

          {/* CTA row */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-16">
            <Button
              size="lg"
              asChild
              className="bg-gradient-primary hover:opacity-90 text-white shadow-2xl shadow-pink-hot/30 h-14 px-8 text-base font-bold gap-2 group"
            >
              <Link href="/login">
                Masuk / Daftar
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="ghost"
              asChild
              className="text-text-body hover:text-text-strong hover:bg-pink-cloud h-14 px-8 gap-2"
            >
              <a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="w-5 h-5 text-success" />
                Chat WhatsApp
              </a>
            </Button>
          </div>

          {/* Stats row */}
          <div className="flex flex-wrap gap-x-10 gap-y-6">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="font-display font-extrabold text-3xl sm:text-4xl text-text-strong">
                  <AnimatedCounter value={stat.value} suffix={stat.suffix} />
                </p>
                <p className="text-text-muted text-sm mt-1">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-white pointer-events-none" />

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 opacity-40">
        <span className="text-xs text-text-muted font-medium tracking-widest uppercase">Scroll</span>
        <div className="w-5 h-8 rounded-full border border-line-soft flex items-start justify-center p-1">
          <div className="w-1 h-2 bg-pink-hot/60 rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  )
}
