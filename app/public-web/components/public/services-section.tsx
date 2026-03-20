'use client'

import type { LandingResponse } from '@cjl/contracts'
import { formatCurrency } from '@/lib/mock-data'
import { Waves, Wind, Droplets, Sparkles, Package, Shirt, ArrowRight } from 'lucide-react'
import { useReveal } from '@/hooks/use-reveal'
import { cn } from '@/lib/utils'
import Link from 'next/link'

const iconMap: Record<string, React.FC<{ className?: string }>> = {
  washer: Waves,
  dryer: Wind,
  detergent: Droplets,
  softener: Sparkles,
  wash_dry_fold_package: Package,
  ironing: Shirt,
}

interface ServicesSectionProps {
  services: LandingResponse['services']
}

export function ServicesSection({ services }: ServicesSectionProps) {
  const [ref, isVisible] = useReveal()
  const [gridRef, gridVisible] = useReveal()
  const primaryServices = services.filter((s) => ['washer', 'dryer'].includes(s.code))
  const secondaryServices = services.filter((s) => !['washer', 'dryer'].includes(s.code))

  return (
    <section id="layanan" className="py-28 bg-white">
      <div className="container mx-auto px-6 lg:px-12" ref={ref}>
        {/* Header */}
        <div className="mb-16">
          <div className={cn('reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-soft bg-pink-cloud text-pink-hot text-xs font-semibold uppercase tracking-wider mb-5', isVisible && 'visible')}>
            <span className="w-1.5 h-1.5 rounded-full bg-pink-hot" />
            Layanan &amp; Harga
          </div>
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
            <h2 className={cn('reveal font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-text-strong leading-tight max-w-xl text-balance', isVisible && 'visible')}>
              Harga Jelas,<br />
              <span className="text-gradient-pink">Kualitas Nyata</span>
            </h2>
            <p className={cn('reveal reveal-right text-text-body text-lg max-w-sm lg:text-right leading-relaxed', isVisible && 'visible')}>
              Semua harga sudah termasuk penggunaan mesin premium. Tidak ada biaya tersembunyi.
            </p>
          </div>
        </div>

        {/* Bento grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4" ref={gridRef}>
          {/* Washer — dark accent card */}
          {primaryServices[0] && (() => {
            const Icon = iconMap[primaryServices[0].code] ?? Waves
            return (
              <div className={cn('reveal md:col-span-2 xl:col-span-2 group relative rounded-3xl p-8 overflow-hidden cursor-default bg-text-strong', gridVisible && 'visible')}>
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-48 bg-pink-hot/25 blur-[80px] pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full min-h-[220px]">
                  <div className="flex items-center justify-between mb-auto">
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center">
                      <Icon className="w-7 h-7 text-pink-rose" />
                    </div>
                    <span className="text-xs font-semibold text-pink-rose/70 uppercase tracking-widest">Populer</span>
                  </div>
                  <div className="mt-8">
                    <p className="text-white/60 text-sm mb-1">{primaryServices[0].description}</p>
                    <h3 className="font-display font-bold text-2xl text-white mb-1">
                      {primaryServices[0].name}
                    </h3>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="font-display font-extrabold text-4xl text-white">
                        {formatCurrency(primaryServices[0].price)}
                      </span>
                      <span className="text-white/50 text-sm">/ siklus</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Dryer — pink gradient */}
          {primaryServices[1] && (() => {
            const Icon = iconMap[primaryServices[1].code] ?? Wind
            return (
              <div className={cn('reveal delay-100 group relative bg-gradient-primary rounded-3xl p-8 overflow-hidden cursor-default', gridVisible && 'visible')}>
                <div className="absolute -top-8 -right-8 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
                <div className="relative z-10 flex flex-col h-full min-h-[220px]">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center mb-auto">
                    <Icon className="w-7 h-7 text-white" />
                  </div>
                  <div className="mt-8">
                    <p className="text-white/70 text-sm mb-1">{primaryServices[1].description}</p>
                    <h3 className="font-display font-bold text-2xl text-white mb-1">
                      {primaryServices[1].name}
                    </h3>
                    <div className="flex items-baseline gap-1 mt-3">
                      <span className="font-display font-extrabold text-4xl text-white">
                        {formatCurrency(primaryServices[1].price)}
                      </span>
                      <span className="text-white/70 text-sm">/ siklus</span>
                    </div>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* CTA card */}
          <div className={cn('reveal delay-200 group relative bg-bg-soft border-2 border-dashed border-pink-soft hover:border-pink-hot rounded-3xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 min-h-[180px]', gridVisible && 'visible')}>
            <div className="w-12 h-12 rounded-2xl bg-pink-cloud group-hover:bg-gradient-primary flex items-center justify-center mb-3 transition-all duration-300">
              <ArrowRight className="w-5 h-5 text-pink-hot group-hover:text-white transition-colors" />
            </div>
            <p className="font-semibold text-text-strong text-sm">Layanan Tambahan</p>
            <p className="text-text-muted text-xs mt-1">Detergen, softener &amp; paket</p>
          </div>

          {/* Secondary service cards */}
          {secondaryServices.slice(0, 3).map((service, i) => {
            const Icon = iconMap[service.code] ?? Sparkles
            return (
              <div
                key={service.code}
                className={cn(`reveal delay-${(i + 3) * 100} group bg-bg-soft border border-line-soft hover:border-pink-soft hover:shadow-xl hover:shadow-pink-hot/6 rounded-3xl p-6 transition-all duration-300`, gridVisible && 'visible')}
              >
                <div className="w-11 h-11 rounded-xl bg-pink-cloud group-hover:bg-gradient-primary flex items-center justify-center mb-4 transition-all duration-300">
                  <Icon className="w-5 h-5 text-pink-hot group-hover:text-white transition-colors" />
                </div>
                <h3 className="font-display font-semibold text-text-strong text-base mb-1">{service.name}</h3>
                <p className="text-text-muted text-xs mb-3 leading-relaxed">{service.description}</p>
                <div className="flex items-baseline gap-1">
                  <span className="font-display font-bold text-xl text-text-strong">
                    {formatCurrency(service.price)}
                  </span>
                  <span className="text-text-muted text-xs">
                    /{service.priceModel === 'per_kg' ? 'kg' : 'unit'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-center text-text-muted text-sm">
          Semua harga sudah termasuk PPN.{' '}
          <Link href="#kontak" className="text-pink-hot hover:underline font-medium">
            Hubungi kami
          </Link>{' '}
          untuk informasi paket khusus.
        </p>
      </div>
    </section>
  )
}
