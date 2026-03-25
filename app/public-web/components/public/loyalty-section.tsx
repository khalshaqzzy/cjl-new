'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Star, Gift, History, CheckCircle2, Zap } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'
import { cn } from '@/lib/utils'

const benefits = [
  {
    icon: Zap,
    title: 'Stamp Otomatis',
    description: 'Setiap transaksi yang memenuhi syarat langsung mendapat stamp. Tidak perlu claim manual.',
  },
  {
    icon: Gift,
    title: '1 Gratis Washer',
    description: 'Kumpulkan 10 stamp untuk 1x gratis cuci. Stamp tidak kadaluarsa.',
  },
  {
    icon: History,
    title: 'Pantau di Portal',
    description: 'Cek progress stamp, riwayat transaksi, dan status cucian kapan saja.',
  },
]

const TOTAL_STAMPS = 10
const TARGET_STAMPS = 7
// How long each fill step takes (ms)
const FILL_STEP_MS = 160
// Pause at full (7 stamps) before resetting
const PAUSE_FULL_MS = 1400
// Pause at empty before refilling
const PAUSE_EMPTY_MS = 600

type DotState = 'empty' | 'filling' | 'filled' | 'unfilling'

function LoopingStampCard() {
  const cardRef = useRef<HTMLDivElement>(null)
  const [started, setStarted] = useState(false)
  // Per-dot state for fine-grained animation control
  const [dotStates, setDotStates] = useState<DotState[]>(Array(TOTAL_STAMPS).fill('empty'))
  const [count, setCount] = useState(0)
  const [shining, setShining] = useState(false)
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  const runLoop = useCallback(() => {
    if (!mountedRef.current) return

    // Phase 1 — fill dots 0 → TARGET_STAMPS one by one
    const fillNext = (i: number) => {
      if (!mountedRef.current) return
      if (i >= TARGET_STAMPS) {
        // Reached target — shine then pause
        setShining(true)
        loopRef.current = setTimeout(() => {
          setShining(false)
          // Phase 2 — unfill all at once
          setDotStates(Array(TOTAL_STAMPS).fill('unfilling'))
          loopRef.current = setTimeout(() => {
            if (!mountedRef.current) return
            setDotStates(Array(TOTAL_STAMPS).fill('empty'))
            setCount(0)
            loopRef.current = setTimeout(runLoop, PAUSE_EMPTY_MS)
          }, 320)
        }, PAUSE_FULL_MS)
        return
      }
      setDotStates(prev => {
        const next = [...prev]
        next[i] = 'filling'
        return next
      })
      // After fill animation completes, mark as filled
      loopRef.current = setTimeout(() => {
        if (!mountedRef.current) return
        setDotStates(prev => {
          const next = [...prev]
          next[i] = 'filled'
          return next
        })
        setCount(i + 1)
        loopRef.current = setTimeout(() => fillNext(i + 1), FILL_STEP_MS * 0.4)
      }, FILL_STEP_MS)
    }

    fillNext(0)
  }, [])

  // Start loop when card enters viewport
  useEffect(() => {
    const el = cardRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true)
          loopRef.current = setTimeout(runLoop, 600)
        }
      },
      { threshold: 0.35 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [started, runLoop])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (loopRef.current) clearTimeout(loopRef.current)
    }
  }, [])

  return (
    <div ref={cardRef} className="relative max-w-sm mx-auto lg:mx-0">
      {/* Ambient glow behind card */}
      <div
        className="absolute inset-0 rounded-3xl pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% 80%, rgba(240,78,148,0.18) 0%, transparent 70%)',
          transform: 'translateY(12px) scale(0.92)',
          filter: 'blur(24px)',
        }}
      />

      {/* Card */}
      <div
        className="relative bg-gradient-primary rounded-[2rem] overflow-hidden border border-white/20 aspect-[2.85/2] w-full max-w-[380px] flex flex-col justify-between shadow-2xl"
        style={{ boxShadow: '0 20px 50px rgba(240,78,148,0.25), 0 4px 12px rgba(240,78,148,0.15)' }}
      >
        {/* Shine sweep overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          {shining && (
            <div
              className="absolute top-0 bottom-0 w-24 animate-stamp-card-shine"
              style={{
                background: 'linear-gradient(105deg, transparent 20%, rgba(255,255,255,0.45) 50%, transparent 80%)',
                transform: 'skewX(-12deg)',
              }}
            />
          )}
        </div>

        {/* Dot grid pattern backdrop */}
        <div
          className="absolute inset-0 opacity-[0.25] pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, #ffffff 1.2px, transparent 1.2px)',
            backgroundSize: '22px 22px',
          }}
        />

        <div className="p-5 sm:p-7 relative h-full flex flex-col justify-between z-10">
          {/* Top Section: Header */}
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                <span className="text-[10px] uppercase tracking-[0.25em] font-black text-white/80">
                  Kartu Stamp Saya
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="font-display font-black text-4xl sm:text-5xl text-white leading-none">
                  {20 + count}
                </span>
                <span className="text-xl font-bold text-white/40">/ {TOTAL_STAMPS}</span>
              </div>
              <p className="text-white/70 text-[10px] sm:text-xs mt-2 font-medium">
                {TOTAL_STAMPS - count} lagi menuju gratis cuci
              </p>
            </div>
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center bg-white/20 border border-white/30 backdrop-blur-md shadow-inner"
            >
              <Star className="w-6 h-6 text-white fill-white" />
            </div>
          </div>

          {/* Middle Section: Stamp Grid — Made even smaller with increased padding */}
          <div className="grid grid-cols-5 gap-2 px-10 my-1">
            {Array.from({ length: TOTAL_STAMPS }).map((_, i) => {
              const state = dotStates[i]
              const isFilled = state === 'filled'
              const isFilling = state === 'filling'
              const isUnfilling = state === 'unfilling'
              const isActive = isFilled || isFilling

              return (
                <div
                  key={i}
                  className={[
                    'aspect-square rounded-lg flex items-center justify-center relative overflow-hidden',
                    isFilling ? 'animate-stamp-fill' : '',
                    isUnfilling ? 'animate-stamp-unfill' : '',
                    isFilled ? 'animate-stamp-glow' : '',
                  ].join(' ')}
                  style={{
                    background: isActive
                      ? 'rgba(255,255,255,1)'
                      : 'rgba(255,255,255,0.15)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    transition: 'all 0.3s ease',
                  }}
                >
                  <Star
                    className="w-3 h-3 relative z-10"
                    style={{
                      color: isActive ? '#f04e94' : 'rgba(255,255,255,0.35)',
                      fill: isActive ? '#f04e94' : 'none',
                    }}
                  />
                </div>
              )
            })}
          </div>

          {/* Bottom Section: Footer only */}
          <div className="flex items-center justify-between pt-4 border-t border-white/10">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span className="text-[10px] sm:text-xs text-white/80 font-medium tracking-tight">
                Gratis Washer tersedia: <strong className="text-white">2x</strong>
              </span>
            </div>
            <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.1em] bg-white text-pink-hot shadow-sm">
              Aktif
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar — Outside (Bottom) */}
      <div className="mt-6 px-1">
        <div className="flex justify-between items-end mb-2 px-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-text-muted">Progres Stamp</span>
          <span className="text-xs font-bold text-pink-hot">{20 + count} / {TOTAL_STAMPS}</span>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-pink-soft/30 border border-pink-soft/20 shadow-inner p-[1px]">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out bg-gradient-primary shadow-sm"
            style={{ 
              width: `${(count / TOTAL_STAMPS) * 100}%`,
              boxShadow: count > 0 ? '0 0 10px rgba(240,78,148,0.2)' : 'none'
            }}
          />
        </div>
      </div>
    </div>
  )
}

export function LoyaltySection() {
  const [leftRef, leftVisible] = useReveal()
  const [rightRef, rightVisible] = useReveal()

  return (
    <section id="loyalty" className="py-28 bg-bg-soft overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left — stamp card visual */}
          <div ref={leftRef} className="order-2 lg:order-1 flex justify-center lg:justify-start">
            <div className={cn('reveal-left w-full max-w-sm', leftVisible && 'visible')}>
              <LoopingStampCard />
            </div>
          </div>

          {/* Right — content */}
          <div ref={rightRef} className="order-1 lg:order-2">
            <div className={cn('reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-soft bg-pink-cloud text-pink-hot text-xs font-semibold uppercase tracking-wider mb-6', rightVisible && 'visible')}>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-hot" />
              Program Loyalty
            </div>
            <h2 className={cn('reveal font-display font-extrabold text-4xl sm:text-5xl lg:text-[52px] text-text-strong leading-tight text-balance mb-5', rightVisible && 'visible')}>
              Makin Sering Cuci,<br />
              <span className="text-gradient-pink">Makin Banyak Reward</span>
            </h2>
            <p className={cn('reveal delay-100 text-text-body text-lg leading-relaxed mb-10', rightVisible && 'visible')}>
              Setiap cuci yang memenuhi syarat otomatis mendapat stamp. Kumpulkan 10 stamp dan nikmati gratis 1x cuci menggunakan Washer.
            </p>

            <div className="space-y-5 mb-10">
              {benefits.map((b, i) => (
                <div key={b.title} className={cn(`reveal delay-${(i + 2) * 100} flex gap-4 items-start`, rightVisible && 'visible')}>
                  <div className="flex-shrink-0 w-11 h-11 rounded-2xl bg-pink-cloud border border-pink-soft flex items-center justify-center">
                    <b.icon className="w-5 h-5 text-pink-hot" />
                  </div>
                  <div>
                    <h3 className="font-display font-semibold text-text-strong mb-0.5">{b.title}</h3>
                    <p className="text-text-muted text-sm leading-relaxed">{b.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className={cn('reveal delay-500 flex flex-col sm:flex-row gap-3', rightVisible && 'visible')}>
              <Button size="lg" asChild className="bg-gradient-primary hover:opacity-90 text-white shadow-xl shadow-pink-hot/25 font-bold">
                <Link href="/login">Cek Stamp Saya</Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="border-pink-soft text-pink-hot hover:bg-pink-cloud">
                <Link href="/portal/stamp">Lihat Detail</Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
