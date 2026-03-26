'use client'

import { Clock, Shield, Sparkles, Wallet, ThumbsUp, HandHeart } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'
import { cn } from '@/lib/utils'

const benefits = [
  {
    icon: Clock,
    title: '1 Jam Selesai',
    description: 'Proses cuci dan kering hanya membutuhkan waktu sekitar 1 jam.',
    size: 'col-span-1',
    accent: false,
  },
  {
    icon: Sparkles,
    title: 'Self Service',
    description: 'Kontrol penuh atas cucian Anda. Pilih mesin serta detergent dan pewangi sesuka hati.',
    size: 'col-span-1',
    accent: false,
  },
  {
    icon: Shield,
    title: 'Hasil Bersih & Wangi',
    description: 'Mesin LG berkualitas tinggi dan detergen premium untuk hasil terbaik setiap saat.',
    size: 'sm:col-span-2',
    accent: true,
  },
  {
    icon: Wallet,
    title: 'Harga Ekonomis',
    description: 'Mulai Rp 10.000 per mesin.',
    size: 'col-span-1',
    accent: false,
  },
  {
    icon: ThumbsUp,
    title: 'Aman & Nyaman',
    description: 'Tempat bersih dengan lingkungan yang nyaman',
    size: 'col-span-1',
    accent: false,
  },
  {
    icon: HandHeart,
    title: 'Layanan Titip',
    description: 'Tidak sempat menunggu? Titipkan pakaian, kami yang urus.',
    size: 'sm:col-span-2',
    accent: false,
  },
]

export function BenefitsSection() {
  const [headerRef, headerVisible] = useReveal()
  const [gridRef, gridVisible] = useReveal(0.08)

  return (
    <section className="py-28 bg-white overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="text-center mb-16" ref={headerRef}>
          <div className={cn('reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-soft bg-pink-cloud text-pink-hot text-xs font-semibold uppercase tracking-wider mb-5', headerVisible && 'visible')}>
            <span className="w-1.5 h-1.5 rounded-full bg-pink-hot" />
            Keunggulan
          </div>
          <h2 className={cn('reveal font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-text-strong leading-tight text-balance', headerVisible && 'visible')}>
            Mengapa{' '}
            <span className="text-gradient-pink">CJ Laundry?</span>
          </h2>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto" ref={gridRef}>
          {benefits.map((b, i) => (
            <div
              key={b.title}
              className={cn(
                `reveal delay-${i * 100} group relative rounded-3xl p-7 overflow-hidden transition-all duration-500`,
                gridVisible && 'visible',
                b.accent
                  ? 'bg-gradient-primary hover:shadow-2xl hover:shadow-pink-hot/20'
                  : 'bg-bg-soft border border-line-soft hover:border-pink-soft hover:shadow-xl hover:shadow-pink-hot/6',
                b.size === 'sm:col-span-2' ? 'sm:col-span-2' : ''
              )}
            >
              {/* Beam on hover */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="absolute top-0 -left-20 w-12 h-full bg-white/20 skew-x-[-12deg] animate-beam" />
              </div>

              <div className="relative z-10 flex flex-col h-full">
                <div className={cn(
                  'w-12 h-12 rounded-2xl flex items-center justify-center mb-5 transition-all duration-300',
                  b.accent
                    ? 'bg-white/20'
                    : 'bg-pink-cloud border border-pink-soft group-hover:bg-gradient-primary group-hover:border-transparent'
                )}>
                  <b.icon className={cn(
                    'w-5 h-5 transition-colors',
                    b.accent ? 'text-white' : 'text-pink-hot group-hover:text-white'
                  )} />
                </div>
                <h3 className={cn('font-display font-bold text-lg mb-2', b.accent ? 'text-white' : 'text-text-strong')}>
                  {b.title}
                </h3>
                <p className={cn('text-sm leading-relaxed', b.accent ? 'text-white/75' : 'text-text-muted')}>
                  {b.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
