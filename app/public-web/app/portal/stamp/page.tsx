'use client'

import { useEffect, useState } from 'react'
import { PortalShell } from '@/components/public/portal-shell'
import { publicApi } from '@/lib/api'
import { ArrowDown, ArrowUp, Gift, RefreshCw, Settings, Star, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

type TabType = 'earned' | 'redeemed'

const toneConfig = {
  earned: { bg: 'rgba(30,158,115,0.1)', color: '#1e9e73', border: 'rgba(30,158,115,0.18)', Icon: ArrowUp, label: 'Diperoleh' },
  redeemed: { bg: 'rgba(94,106,210,0.1)', color: '#5e6ad2', border: 'rgba(94,106,210,0.18)', Icon: ArrowDown, label: 'Ditukar' },
  adjustment: { bg: 'rgba(217,124,40,0.1)', color: '#d97c28', border: 'rgba(217,124,40,0.18)', Icon: Settings, label: 'Adjustment' },
  reversal: { bg: 'rgba(217,79,112,0.1)', color: '#d94f70', border: 'rgba(217,79,112,0.18)', Icon: RefreshCw, label: 'Reversal' },
}

export default function StampPage() {
  const [activeTab, setActiveTab] = useState<TabType>('earned')
  const [mounted, setMounted] = useState(false)
  const [session, setSession] = useState<{ customerId: string; name: string; phone: string } | null>(null)
  const [dashboardPoints, setDashboardPoints] = useState({ currentPoints: 0, eligibleRewardDiscounts: 0, lifetimeEarnedStamps: 0 })
  const [pointLedger, setPointLedger] = useState<Array<{ entryId: string; label: string; delta: number; createdAtLabel: string; relatedOrderCode?: string; tone: 'earned' | 'redeemed' | 'adjustment' | 'reversal' }>>([])
  const [redemptions, setRedemptions] = useState<Array<{ entryId: string; redeemedPoints: number; rewardDiscountUnits: number; createdAtLabel: string; relatedOrderCode?: string }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 60)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    Promise.all([
      publicApi.getDashboard(),
      publicApi.listPoints(),
      publicApi.listRedemptions(),
    ])
      .then(([dashboard, ledger, redemptionHistory]) => {
        setDashboardPoints(dashboard.stampBalance)
        setSession(dashboard.session)
        setPointLedger(ledger)
        setRedemptions(redemptionHistory)
        setLoadError('')
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : 'Gagal memuat stamp dan reward'))
      .finally(() => setIsLoading(false))
  }, [])

  const filledCount = dashboardPoints.currentPoints % 10 || (dashboardPoints.currentPoints > 0 ? 10 : 0)

  return (
    <PortalShell title="Stamp" session={session}>
      <div className="min-h-screen bg-bg-soft">
        <div className="relative overflow-hidden pb-8 bg-white border-b border-line-soft">
          <div
            className="absolute inset-0 pointer-events-none opacity-[0.25]"
            style={{
              backgroundImage: 'radial-gradient(circle, rgba(240,78,148,0.14) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div className="relative px-4 md:px-6 pt-6 pb-0">
            <div className={`transition-all duration-500 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-3.5 h-3.5 text-pink-hot" />
                <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Program Loyalitas</span>
              </div>
              <h1 className="font-display text-3xl font-bold text-text-strong">
                Stamp & <span className="text-gradient-pink">Reward</span>
              </h1>
              <p className="text-text-muted text-sm mt-1">Kumpulkan stamp, dapatkan gratis cuci</p>
            </div>

            <div className="mt-4">
              <div className="relative rounded-3xl overflow-hidden mb-6 bg-white border border-pink-soft shadow-xl shadow-pink-hot/8">
                <div className="h-1 w-full bg-gradient-primary" />
                <div className="relative p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-2 h-2 rounded-full bg-pink-hot animate-pulse" />
                        <span className="text-xs uppercase tracking-wider font-semibold text-text-muted">Stamp Anda</span>
                      </div>
                      <p className="font-display text-5xl font-bold text-text-strong">{dashboardPoints.currentPoints}</p>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full mb-2 bg-pink-cloud border border-pink-soft">
                        <Gift className="w-3.5 h-3.5 text-pink-hot" />
                        <span className="text-xs font-semibold text-pink-hot">{dashboardPoints.eligibleRewardDiscounts}x Diskon</span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="text-xs text-text-muted">{dashboardPoints.lifetimeEarnedStamps} lifetime</span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-5">
                    <div className="flex items-center justify-between text-xs text-text-muted mb-3">
                      <span>Kartu Stamp</span>
                      <span className="font-semibold text-text-strong">{filledCount}/10</span>
                    </div>
                    <div className="grid grid-cols-5 gap-2">
                      {Array.from({ length: 10 }).map((_, index) => (
                        <div
                          key={index}
                          className={cn(
                            'w-9 h-9 rounded-full flex items-center justify-center',
                            index < filledCount ? 'bg-gradient-primary text-white' : 'bg-pink-soft/50 text-pink-soft'
                          )}
                        >
                          {index < filledCount ? <Star className="w-4 h-4" fill="currentColor" /> : <span className="text-xs font-bold">{index + 1}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 md:px-6 max-w-4xl mx-auto -mt-4 relative z-10 pb-8">
          {loadError && (
            <div className="mb-4 rounded-2xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
              {loadError}
            </div>
          )}

          {isLoading && (
            <div className="mb-4 rounded-2xl border border-line-soft bg-white px-4 py-5 text-sm text-text-muted">
              Memuat stamp dan riwayat reward...
            </div>
          )}

          <div className="flex gap-2 mb-4 p-1 rounded-2xl bg-white shadow-sm border border-line-soft">
            {(['earned', 'redeemed'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-2.5 px-4 rounded-xl font-display font-semibold text-sm transition-all duration-200',
                  activeTab === tab ? 'bg-gradient-primary text-white shadow-md shadow-pink-hot/20' : 'text-text-muted hover:text-text-strong'
                )}
              >
                {tab === 'earned' ? 'Riwayat Stamp' : 'Riwayat Penukaran'}
              </button>
            ))}
          </div>

          {activeTab === 'earned' && (
            <div className="space-y-2.5">
              {!isLoading && pointLedger.length === 0 && (
                <div className="rounded-2xl border border-line-soft bg-white px-5 py-6 text-sm text-text-muted">
                  Belum ada riwayat stamp untuk ditampilkan.
                </div>
              )}

              {pointLedger.map((entry, index) => {
                const config = toneConfig[entry.tone] ?? toneConfig.earned
                const Icon = config.Icon
                return (
                  <div
                    key={entry.entryId}
                    className={`flex items-center gap-3 bg-white rounded-2xl p-4 border border-line-soft transition-all duration-500 hover:border-pink-soft hover:shadow-sm ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                    style={{ transitionDelay: `${index * 50}ms` }}
                  >
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: config.bg, border: `1px solid ${config.border}` }}>
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-text-strong truncate">{entry.label}</p>
                      <p className="text-xs text-text-muted">{entry.createdAtLabel}</p>
                      {entry.relatedOrderCode && <p className="text-xs text-text-muted/70 font-mono mt-0.5">{entry.relatedOrderCode}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-display text-lg font-bold" style={{ color: entry.delta > 0 ? '#1e9e73' : entry.delta < 0 ? '#5e6ad2' : '#9a7183' }}>
                        {entry.delta > 0 ? '+' : ''}{entry.delta}
                      </p>
                      <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">{config.label}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {activeTab === 'redeemed' && (
            <div className="space-y-2.5">
              {!isLoading && redemptions.length === 0 && (
                <div className="rounded-2xl border border-line-soft bg-white px-5 py-6 text-sm text-text-muted">
                  Belum ada penukaran reward pada akun ini.
                </div>
              )}

              {redemptions.map((entry, index) => (
                <div
                  key={entry.entryId}
                  className={`flex items-center gap-3 bg-white rounded-2xl p-4 border border-line-soft transition-all duration-500 hover:border-pink-soft ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}
                  style={{ transitionDelay: `${index * 60}ms` }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(94,106,210,0.1)', border: '1px solid rgba(94,106,210,0.18)' }}>
                    <Gift className="w-4 h-4" style={{ color: '#5e6ad2' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-text-strong">{entry.rewardDiscountUnits}x Diskon Reward</p>
                    <p className="text-xs text-text-muted">{entry.createdAtLabel}</p>
                    {entry.relatedOrderCode && <p className="text-xs text-text-muted/70 font-mono mt-0.5">{entry.relatedOrderCode}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg font-bold" style={{ color: '#5e6ad2' }}>-{entry.redeemedPoints}</p>
                    <p className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">Ditukar</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </PortalShell>
  )
}
