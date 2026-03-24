'use client'

import type { LeaderboardRow } from '@cjl/contracts'
import { Trophy, Crown, Medal, Award, ArrowRight, Flame } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import Link from 'next/link'

interface LeaderboardTeaserProps {
  rows: LeaderboardRow[]
}

export function LeaderboardTeaser({ rows }: LeaderboardTeaserProps) {
  const [headerRef, headerVisible] = useReveal()
  const [podiumRef, podiumVisible] = useReveal(0.1)

  const top3 = rows.slice(0, 3)

  const podiumConfig = [
    {
      rank: 1,
      icon: Crown,
      bar: 'h-24',
      bgCard: 'bg-text-strong border border-text-strong/80',
      barBg: 'bg-gradient-to-t from-yellow-500/80 to-yellow-400/50',
      iconBg: 'bg-yellow-400/15 border-yellow-400/30',
      iconColor: 'text-yellow-500',
      nameColor: 'text-white',
      subColor: 'text-white/60',
      rankBg: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
      order: 'order-2',
      topOffset: '',
    },
    {
      rank: 2,
      icon: Medal,
      bar: 'h-16',
      bgCard: 'bg-bg-soft border border-line-soft',
      barBg: 'bg-pink-soft',
      iconBg: 'bg-pink-cloud border-pink-soft',
      iconColor: 'text-text-muted',
      nameColor: 'text-text-strong',
      subColor: 'text-text-muted',
      rankBg: 'bg-pink-cloud text-text-muted border-line-soft',
      order: 'order-1',
      topOffset: 'mt-8',
    },
    {
      rank: 3,
      icon: Award,
      bar: 'h-12',
      bgCard: 'bg-bg-soft border border-line-soft',
      barBg: 'bg-amber-100',
      iconBg: 'bg-amber-50 border-amber-200',
      iconColor: 'text-amber-500',
      nameColor: 'text-text-strong',
      subColor: 'text-text-muted',
      rankBg: 'bg-amber-50 text-amber-600 border-amber-200',
      order: 'order-3',
      topOffset: 'mt-14',
    },
  ]

  return (
    <section id="leaderboard" className="py-28 bg-bg-soft relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[300px] bg-pink-hot/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="container mx-auto px-6 lg:px-12 relative z-10">
        <div className="text-center mb-16" ref={headerRef}>
          <div className={cn('reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-soft bg-pink-cloud text-pink-hot text-xs font-semibold uppercase tracking-wider mb-6', headerVisible && 'visible')}>
            <Flame className="w-3 h-3" />
            Leaderboard Bulanan
          </div>
          <h2 className={cn('reveal font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-text-strong leading-tight text-balance', headerVisible && 'visible')}>
            Siapa{' '}
            <span className="text-gradient-pink">Pelanggan Terbaik</span>
            <br />Bulan Ini?
          </h2>
          <p className={cn('reveal delay-200 text-text-body text-lg mt-4 max-w-xl mx-auto', headerVisible && 'visible')}>
            Raih posisi teratas dan tunjukkan siapa yang paling rajin menjaga kebersihan!
          </p>
        </div>

        <div className="max-w-3xl mx-auto" ref={podiumRef}>
          <div className="flex items-end justify-center gap-4 mb-10">
            {podiumConfig.map((config) => {
              const entry = top3[config.rank - 1]
              const IconComp = config.icon
              return (
                <div
                  key={config.rank}
                  className={cn(`reveal reveal-scale delay-${(config.rank - 1) * 150} flex-1 max-w-[200px] ${config.order} ${config.topOffset}`, podiumVisible && 'visible')}
                >
                  <div className={`${config.bgCard} rounded-3xl p-5 text-center mb-3 shadow-sm`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center mx-auto mb-3 border ${config.iconBg}`}>
                      <IconComp className={`w-5 h-5 ${config.iconColor}`} />
                    </div>
                    <p className={`font-display font-bold text-xl ${config.nameColor} leading-tight`}>
                      {entry?.displayName ?? '-'}
                    </p>
                    <p className={`text-sm mt-1 ${config.subColor}`}>
                      {entry?.earnedStamps ?? 0} stamp
                    </p>
                    <div className={`inline-flex items-center gap-1 mt-3 px-3 py-1 rounded-full border text-xs font-bold ${config.rankBg}`}>
                      #{config.rank}
                    </div>
                  </div>
                  <div className={`${config.barBg} rounded-2xl w-full ${config.bar}`} />
                </div>
              )
            })}
          </div>

          <div className="bg-white border border-line-soft rounded-3xl overflow-hidden mb-8 shadow-sm">
            {rows.slice(3, 8).map((entry, index) => (
              <div
                key={`${entry.monthKey}-${entry.rank}`}
                className="flex items-center gap-4 px-6 py-4 border-b border-line-soft last:border-0 hover:bg-pink-cloud/40 transition-colors"
              >
                <span className="font-display font-bold text-text-muted w-8 text-center text-sm">
                  #{index + 4}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-text-strong text-sm">{entry.displayName}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-pink-hot" />
                  <span className="text-text-body text-sm font-medium">{entry.earnedStamps} stamp</span>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button
              size="lg"
              asChild
              className="bg-gradient-primary hover:opacity-90 text-white shadow-xl shadow-pink-hot/25 font-bold gap-2 group"
            >
              <Link href="/leaderboard">
                Lihat Leaderboard Lengkap
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
            <p className="text-text-muted text-sm mt-4">
              Masuk untuk melihat posisi Anda di leaderboard
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
