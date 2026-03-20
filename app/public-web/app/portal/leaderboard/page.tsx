'use client'

import { useEffect, useState } from 'react'
import type { LeaderboardRow } from '@cjl/contracts'
import { PortalShell } from '@/components/public/portal-shell'
import { publicApi } from '@/lib/api'
import { Award, Crown, Medal, Star } from 'lucide-react'

export default function PortalLeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [months, setMonths] = useState<Array<{ key: string; label: string; isCurrent: boolean }>>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [session, setSession] = useState<{ customerId: string; name: string; phone: string } | null>(null)

  useEffect(() => {
    publicApi.getLeaderboard(selectedMonth || undefined).then((payload) => {
      setRows(payload.rows)
      setMonths(payload.availableMonths)
      if (!selectedMonth) {
        setSelectedMonth(payload.availableMonths.find((month) => month.isCurrent)?.key ?? payload.availableMonths[0]?.key ?? '')
      }
    }).catch(() => undefined)
    publicApi.getSession().then((payload) => setSession(payload.session)).catch(() => undefined)
  }, [selectedMonth])

  const top3 = rows.slice(0, 3)

  return (
    <PortalShell title="Leaderboard" session={session}>
      <div className="min-h-screen bg-bg-soft px-4 md:px-6 py-6 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-bold text-text-strong">Leaderboard</h1>
          <p className="text-sm text-text-muted mt-1">Peringkat pelanggan paling aktif bulan ini.</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {months.map((month) => (
            <button
              key={month.key}
              onClick={() => setSelectedMonth(month.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium ${selectedMonth === month.key ? 'bg-gradient-primary text-white' : 'bg-white border border-line-soft text-text-body'}`}
            >
              {month.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {[Crown, Medal, Award].map((Icon, index) => (
            <div key={index} className={`rounded-3xl p-5 text-center ${index === 0 ? 'bg-text-strong text-white' : 'bg-white border border-line-soft'}`}>
              <div className="w-12 h-12 rounded-full bg-pink-cloud flex items-center justify-center mx-auto mb-4">
                <Icon className="w-6 h-6 text-pink-hot" />
              </div>
              <p className="font-display text-lg font-bold">{top3[index]?.maskedAlias ?? '-'}</p>
              <p className={`text-sm mt-1 ${index === 0 ? 'text-white/70' : 'text-text-muted'}`}>{top3[index]?.earnedStamps ?? 0} stamp</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-3xl border border-line-soft overflow-hidden">
          <div className="divide-y divide-line-soft">
            {rows.slice(3).map((row) => (
              <div key={`${row.rank}-${row.monthKey}`} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <span className="w-10 h-10 rounded-full bg-pink-cloud flex items-center justify-center text-sm font-semibold text-pink-hot">{row.rank}</span>
                  <span className="font-medium text-text-strong">{row.maskedAlias}</span>
                </div>
                <div className="flex items-center gap-1 text-text-muted">
                  <Star className="w-4 h-4" />
                  <span className="font-display font-semibold">{row.earnedStamps}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PortalShell>
  )
}
