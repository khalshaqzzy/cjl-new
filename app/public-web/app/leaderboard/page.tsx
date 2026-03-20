'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { LeaderboardRow } from '@cjl/contracts'
import { FloatingHeader } from '@/components/public/floating-header'
import { Footer } from '@/components/public/footer'
import { publicApi } from '@/lib/api'
import { ArrowLeft, Award, Crown, Medal, Star, Trophy } from 'lucide-react'

export default function PublicLeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [months, setMonths] = useState<Array<{ key: string; label: string; isCurrent: boolean }>>([])
  const [selectedMonth, setSelectedMonth] = useState('')
  const [laundryInfo, setLaundryInfo] = useState({ name: 'CJ Laundry', phone: '', whatsapp: '', address: '', operatingHours: '' })

  useEffect(() => {
    publicApi.getLeaderboard(selectedMonth || undefined).then((payload) => {
      setRows(payload.rows)
      setMonths(payload.availableMonths)
      if (!selectedMonth) {
        setSelectedMonth(payload.availableMonths.find((month) => month.isCurrent)?.key ?? payload.availableMonths[0]?.key ?? '')
      }
    }).catch(() => undefined)
  }, [selectedMonth])

  useEffect(() => {
    publicApi.getLanding().then((payload) => setLaundryInfo(payload.laundryInfo)).catch(() => undefined)
  }, [])

  const top3 = rows.slice(0, 3)
  const rest = rows.slice(3)
  const currentMonth = months.find((month) => month.key === selectedMonth)

  return (
    <div className="min-h-screen bg-bg-soft">
      <FloatingHeader />
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-text-muted hover:text-text-strong mb-8 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Kembali ke beranda
          </Link>

          <div className="text-center mb-12">
            <span className="inline-block px-4 py-2 bg-pink-cloud text-pink-hot text-sm font-medium rounded-full mb-4">Leaderboard</span>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-text-strong mb-4 text-balance">Pelanggan Teratas</h1>
            <p className="text-text-body text-lg max-w-2xl mx-auto text-pretty">Lihat siapa saja yang paling aktif menggunakan layanan CJ Laundry.</p>
          </div>

          <div className="flex justify-center gap-2 flex-wrap mb-8">
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

          <div className="max-w-3xl mx-auto mb-12 grid grid-cols-3 gap-4">
            {[Crown, Medal, Award].map((Icon, index) => (
              <div key={index} className={`rounded-3xl p-6 text-center ${index === 0 ? 'bg-text-strong text-white' : 'bg-white border border-line-soft'} ${index === 0 ? '' : 'mt-8'}`}>
                <div className="w-12 h-12 rounded-full bg-pink-cloud flex items-center justify-center mx-auto mb-4">
                  <Icon className="w-6 h-6 text-pink-hot" />
                </div>
                <p className="font-display text-xl font-bold">{top3[index]?.maskedAlias ?? '-'}</p>
                <p className={`text-sm mt-1 ${index === 0 ? 'text-white/70' : 'text-text-muted'}`}>{top3[index]?.earnedStamps ?? 0} stamp</p>
              </div>
            ))}
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-white rounded-3xl border border-line-soft overflow-hidden">
              <div className="p-5 border-b border-line-soft">
                <h3 className="font-display text-lg font-semibold text-text-strong">{currentMonth?.label ?? selectedMonth}</h3>
              </div>
              <div className="divide-y divide-line-soft">
                {rest.map((row) => (
                  <div key={`${row.rank}-${row.monthKey}`} className="flex items-center justify-between p-4 hover:bg-bg-soft transition-colors">
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

          <div className="text-center mt-12">
            <p className="text-text-muted mb-4">Ingin masuk leaderboard? Mulai kumpulkan stamp sekarang!</p>
            <Link href="/login" className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-gradient-primary text-white font-semibold">
              <Trophy className="w-4 h-4" />
              Masuk ke Portal
            </Link>
          </div>
        </div>
      </main>
      <Footer laundryInfo={laundryInfo} />
    </div>
  )
}
