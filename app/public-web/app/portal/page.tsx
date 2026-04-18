'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import type { PublicDashboardResponse } from '@cjl/contracts'
import { AdminChatSelector } from '@/components/public/admin-chat-selector'
import { PortalShell } from '@/components/public/portal-shell'
import { publicApi } from '@/lib/api'
import { getStatusColor, getStatusLabel } from '@/lib/presenters'
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  Gift,
  Scale,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from 'lucide-react'

const iconMap: Record<string, React.ElementType> = {
  clock: Clock,
  check: CheckCircle2,
  weight: Scale,
  star: Sparkles,
}

function useCountUp(target: number, duration = 1200, active = false) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!active) return
    const start = performance.now()
    const raf = (now: number) => {
      const progress = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(ease * target))
      if (progress < 1) requestAnimationFrame(raf)
    }
    requestAnimationFrame(raf)
  }, [target, duration, active])

  return count
}

function StampHeroCard({
  currentPoints,
  eligibleRewardDiscounts,
  lifetimeEarnedStamps,
}: {
  currentPoints: number
  eligibleRewardDiscounts: number
  lifetimeEarnedStamps: number
}) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)
  const stampCount = useCountUp(currentPoints, 1000, visible)
  const rewardCount = useCountUp(eligibleRewardDiscounts, 800, visible)
  const progressPct = (currentPoints % 10) * 10

  useEffect(() => {
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) setVisible(true)
    }, { threshold: 0.3 })
    if (cardRef.current) obs.observe(cardRef.current)
    return () => obs.disconnect()
  }, [])

  return (
    <div ref={cardRef} className="relative rounded-3xl overflow-hidden mb-6 group bg-gradient-primary shadow-xl shadow-pink-hot/20">
      <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-3xl pointer-events-none bg-white/15 translate-x-1/3 -translate-y-1/3" />
      <div className="absolute bottom-0 left-0 w-48 h-48 rounded-full blur-2xl pointer-events-none bg-white/8 -translate-x-1/3 translate-y-1/3" />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.15]"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Total Stamp</span>
            </div>
            <p className="font-display text-5xl font-bold text-white leading-none">{visible ? stampCount : 0}</p>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 mb-1 justify-end">
              <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Diskon Reward</span>
              <Gift className="w-3.5 h-3.5 text-white/60" />
            </div>
            <p className="font-display text-5xl font-bold text-white leading-none">{visible ? rewardCount : 0}x</p>
          </div>
        </div>

        <div className="mb-3">
          <div className="flex justify-between text-xs text-white/70 mb-1.5">
            <span>Progress ke stamp berikutnya</span>
            <span>{currentPoints % 10}/10</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden bg-white/20">
            <div
              className="h-full rounded-full bg-white transition-all duration-1000 ease-out"
              style={{ width: visible ? `${progressPct}%` : '0%' }}
            />
          </div>
        </div>
        <p className="text-xs text-white/70">{10 - (currentPoints % 10)} stamp lagi untuk gratis cuci berikutnya</p>

        <div className="mt-4 pt-4 flex items-center gap-2 border-t border-white/15">
          <Zap className="w-3.5 h-3.5 text-white/60" />
          <span className="text-xs text-white/70">
            Total lifetime: <span className="text-white font-semibold">{lifetimeEarnedStamps} stamp</span>
          </span>
        </div>
      </div>
    </div>
  )
}

export default function PortalDashboard() {
  const [mounted, setMounted] = useState(false)
  const [dashboard, setDashboard] = useState<PublicDashboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    publicApi.getDashboard()
      .then((payload) => {
        setDashboard(payload)
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat portal"))
      .finally(() => setIsLoading(false))
  }, [])

  const session = dashboard?.session ?? null
  const adminWhatsappContacts = dashboard?.adminWhatsappContacts ?? []
  const stampBalance = dashboard?.stampBalance ?? { currentPoints: 0, eligibleRewardDiscounts: 0, lifetimeEarnedStamps: 0 }
  const summaryCards = dashboard?.summaryCards ?? []
  const activeOrders = dashboard?.activeOrders ?? []
  const monthlySummary = dashboard?.monthlySummary

  return (
    <PortalShell session={session}>
      <div className="min-h-screen bg-bg-soft">
        <div className="relative overflow-hidden bg-white border-b border-line-soft pb-12">
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.3]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(240,78,148,0.14) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="absolute top-0 right-0 w-72 h-72 rounded-full blur-[100px] pointer-events-none bg-pink-hot/6 translate-x-1/3 -translate-y-1/2" />

          <div className="relative px-4 md:px-6 pt-6 pb-2">
            <div className={`transition-all duration-600 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Portal</span>
                <span className="text-text-muted/40">·</span>
                <span className="text-xs text-text-muted">{session?.phone ?? '-'}</span>
              </div>
              <h1 className="font-display text-3xl font-bold text-text-strong leading-tight">
                Halo, <span className="text-gradient-pink">{session?.name?.split(' ')[0] ?? 'Pelanggan'}!</span>
              </h1>
              <p className="text-text-muted text-sm mt-1">Selamat datang di portal pelanggan CJ Laundry</p>
            </div>
          </div>

          <div className="relative px-4 md:px-6 mt-4">
            <div data-testid="portal-stamp-hero">
              <StampHeroCard
              currentPoints={stampBalance.currentPoints}
              eligibleRewardDiscounts={stampBalance.eligibleRewardDiscounts}
              lifetimeEarnedStamps={stampBalance.lifetimeEarnedStamps}
              />
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 lg:px-8 max-w-4xl mx-auto -mt-4 relative z-10 pb-8 space-y-6">
          {loadError && (
            <div className="rounded-2xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
              {loadError}
            </div>
          )}

          {isLoading && (
            <div className="rounded-2xl border border-line-soft bg-white px-4 py-5 text-sm text-text-muted">
              Memuat portal pelanggan...
            </div>
          )}

          {!isLoading && summaryCards.length > 0 && (
            <div className="grid grid-cols-2 gap-3">
            {summaryCards.map((card, index) => {
              const Icon = iconMap[card.icon]
              return (
                <div
                  key={card.id}
                  className={`bg-white rounded-2xl p-4 border border-line-soft transition-all duration-500 hover:shadow-lg hover:border-pink-soft hover:-translate-y-0.5 cursor-default ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  <div className="w-9 h-9 rounded-xl bg-pink-cloud flex items-center justify-center mb-3">
                    {Icon && <Icon className="w-4 h-4 text-pink-hot" />}
                  </div>
                  <p className="font-display text-2xl font-bold text-text-strong">{card.value}</p>
                  <p className="text-xs text-text-muted mt-0.5">{card.label}</p>
                </div>
              )
            })}
            </div>
          )}

          {!isLoading && activeOrders.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display text-base font-bold text-text-strong flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-pink-hot inline-block animate-pulse" />
                  Order Aktif
                </h2>
                <Link href="/portal/riwayat" className="text-xs text-pink-hot hover:underline flex items-center gap-1 font-medium">
                  Lihat semua <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="space-y-3">
                {activeOrders.map((order, index) => (
                  <Link
                    key={order.orderId}
                    href={`/portal/riwayat/${order.orderId}`}
                    data-testid={`portal-active-order-${order.orderId}`}
                    className={`block bg-white rounded-2xl p-4 border border-line-soft transition-all duration-500 hover:shadow-lg hover:border-pink-soft hover:-translate-y-0.5 group ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                    style={{ transitionDelay: `${(summaryCards.length + index) * 80}ms` }}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-display font-semibold text-text-strong text-sm">{order.orderCode}</p>
                        <p className="text-xs text-text-muted mt-0.5">{order.createdAtLabel}</p>
                      </div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </span>
                    </div>
                    <p className="text-sm text-text-body mb-3">{order.serviceSummary} · {order.weightKgLabel}</p>
                    <div className="flex items-center justify-between pt-2.5 border-t border-line-soft">
                      <span className="text-xs text-text-muted">Lihat detail</span>
                      <ArrowRight className="w-3.5 h-3.5 text-pink-hot group-hover:translate-x-1 transition-transform" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {!isLoading && activeOrders.length === 0 && (
            <div className="rounded-2xl border border-line-soft bg-white px-5 py-6">
              <h2 className="font-display text-base font-bold text-text-strong">Order Aktif</h2>
              <p className="mt-1 text-sm text-text-muted">Saat ini belum ada order aktif yang perlu dipantau.</p>
            </div>
          )}

          {!isLoading && session && adminWhatsappContacts.length > 0 && (
            <AdminChatSelector
              contacts={adminWhatsappContacts}
              customerName={session.name}
              customerPhone={session.phone}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            {[
              { href: '/portal/stamp', icon: Star, label: 'Stamp & Reward', sub: `${stampBalance.eligibleRewardDiscounts}x diskon tersedia`, primary: true },
              { href: '/portal/leaderboard', icon: Trophy, label: 'Leaderboard', sub: 'Lihat peringkat Anda', primary: false },
            ].map((item, index) => (
              <Link
                key={item.href}
                href={item.href}
                className={`relative block rounded-2xl p-4 overflow-hidden group transition-all duration-500 hover:shadow-lg hover:-translate-y-0.5 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${item.primary ? 'bg-gradient-primary' : 'bg-text-strong'}`}
                style={{ transitionDelay: `${(summaryCards.length + activeOrders.length + index) * 80}ms` }}
              >
                <span className="absolute inset-0 overflow-hidden pointer-events-none">
                  <span className="absolute top-0 bottom-0 w-12 bg-white/10 blur-sm -translate-x-full group-hover:translate-x-[400%] transition-transform duration-700 skew-x-[-15deg]" />
                </span>
                <item.icon className="w-5 h-5 mb-3 text-white" />
                <p className="font-display font-bold text-sm text-white">{item.label}</p>
                <p className="text-xs mt-0.5 text-white/70">{item.sub}</p>
              </Link>
            ))}
          </div>

          {!isLoading && monthlySummary && (
            <div className="bg-white rounded-2xl p-5 border border-line-soft">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-display text-base font-bold text-text-strong">Ringkasan Bulan Ini</h2>
                <span className="text-xs text-text-muted">{monthlySummary.monthKey}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-bg-soft p-3">
                  <p className="text-xs text-text-muted">Order dibuat</p>
                  <p className="mt-1 text-xl font-bold text-text-strong">{monthlySummary.totalOrdersCreated}</p>
                </div>
                <div className="rounded-xl bg-bg-soft p-3">
                  <p className="text-xs text-text-muted">Order selesai</p>
                  <p className="mt-1 text-xl font-bold text-text-strong">{monthlySummary.totalCompletedOrders}</p>
                </div>
                <div className="rounded-xl bg-bg-soft p-3">
                  <p className="text-xs text-text-muted">Order masih aktif</p>
                  <p className="mt-1 text-xl font-bold text-text-strong">{monthlySummary.activeOrdersOpen}</p>
                </div>
                <div className="rounded-xl bg-bg-soft p-3">
                  <p className="text-xs text-text-muted">Berat diproses</p>
                  <p className="mt-1 text-xl font-bold text-text-strong">{monthlySummary.totalWeightProcessedLabel}</p>
                </div>
                <div className="rounded-xl bg-bg-soft p-3">
                  <p className="text-xs text-text-muted">Stamp diperoleh</p>
                  <p className="mt-1 text-xl font-bold text-text-strong">{monthlySummary.totalEarnedStamps}</p>
                </div>
                <div className="rounded-xl bg-bg-soft p-3">
                  <p className="text-xs text-text-muted">Poin ditukar</p>
                  <p className="mt-1 text-xl font-bold text-text-strong">{monthlySummary.totalRedeemedPoints}</p>
                </div>
                <div className="rounded-xl bg-bg-soft p-3">
                  <p className="text-xs text-text-muted">Diskon reward dipakai</p>
                  <p className="mt-1 text-xl font-bold text-text-strong">{monthlySummary.rewardDiscountsUsed}</p>
                </div>
              </div>
            </div>
          )}

          {!isLoading && !monthlySummary && (
            <div className="bg-white rounded-2xl p-5 border border-line-soft">
              <h2 className="font-display text-base font-bold text-text-strong">Ringkasan Bulan Ini</h2>
              <p className="mt-1 text-sm text-text-muted">Ringkasan bulan ini belum tersedia.</p>
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
