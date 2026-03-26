'use client'

import { useReveal } from '@/hooks/use-reveal'
import { cn } from '@/lib/utils'
import { MapPin, CreditCard, Play, Bell } from 'lucide-react'

const steps = [
  {
    number: '01',
    icon: MapPin,
    title: 'Datang & Pilih Mesin',
    description: 'Kunjungi outlet CJ Laundry terdekat. Pilih mesin washer atau dryer yang tersedia.',
    color: 'bg-pink-hot',
    textColor: 'text-pink-hot',
    bgLight: 'bg-pink-cloud',
  },
  {
    number: '02',
    icon: CreditCard,
    title: 'Bayar di Kasir',
    description: 'Lakukan pembayaran tunai atau QRIS di kasir. Stamp reward langsung tercatat otomatis.',
    color: 'bg-pink-hot',
    textColor: 'text-pink-hot',
    bgLight: 'bg-pink-cloud',
  },
  {
    number: '03',
    icon: Play,
    title: 'Mesin Berjalan',
    description: 'Masukkan pakaian dan mesin siap bekerja. Proses cuci atau kering sekitar 60-90 menit.',
    color: 'bg-pink-hot',
    textColor: 'text-pink-hot',
    bgLight: 'bg-pink-cloud',
  },
  {
    number: '04',
    icon: Bell,
    title: 'Ambil & Selesai',
    description: 'Notifikasi WhatsApp saat cucian selesai. Ambil pakaian Anda yang sudah bersih dan wangi!',
    color: 'bg-pink-hot',
    textColor: 'text-pink-hot',
    bgLight: 'bg-pink-cloud',
  },
]

export function HowItWorksSection() {
  const [headerRef, headerVisible] = useReveal()
  const [stepsRef, stepsVisible] = useReveal(0.1)

  return (
    <section id="cara-kerja" className="py-28 bg-white overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="text-center mb-20" ref={headerRef}>
          <div className={cn('reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-soft bg-bg-soft text-pink-hot text-xs font-semibold uppercase tracking-wider mb-5', headerVisible && 'visible')}>
            <span className="w-1.5 h-1.5 rounded-full bg-pink-hot" />
            Cara Kerja
          </div>
          <h2 className={cn('reveal font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-text-strong leading-tight text-balance', headerVisible && 'visible')}>
            Mudah dalam{' '}
            <span className="text-gradient-pink">4 Langkah</span>
          </h2>
          <p className={cn('reveal delay-200 text-text-body text-lg mt-4 max-w-xl mx-auto leading-relaxed', headerVisible && 'visible')}>
            Tidak perlu ribet. Proses self service yang simpel dengan hasil cucian maksimal.
          </p>
        </div>

        {/* Steps grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5" ref={stepsRef}>
          {steps.map((step, index) => (
            <div
              key={step.number}
              className={cn(
                'reveal group relative bg-bg-soft rounded-3xl p-7 border border-line-soft hover:border-pink-soft hover:shadow-xl hover:shadow-pink-hot/6 transition-all duration-500 overflow-hidden',
                `delay-${index * 100}`,
                stepsVisible && 'visible'
              )}
            >
              {/* Step number — large background */}
              <span className="absolute -top-4 -right-2 font-display font-extrabold text-8xl text-pink-soft/60 select-none pointer-events-none leading-none">
                {step.number}
              </span>

              {/* Beam on hover */}
              <div className="absolute inset-0 overflow-hidden rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="absolute top-0 -left-20 w-16 h-full bg-white/40 skew-x-[-12deg] animate-beam" />
              </div>

              <div className="relative z-10">
                {/* Icon */}
                <div className="w-13 h-13 rounded-2xl bg-white border border-pink-soft flex items-center justify-center mb-6 shadow-sm group-hover:bg-gradient-primary group-hover:border-transparent transition-all duration-300">
                  <step.icon
                    className="w-6 h-6 text-pink-hot group-hover:text-white transition-colors"
                    size={24}
                  />
                </div>

                {/* Step label */}
                <p className="font-display font-black text-xs text-pink-hot uppercase tracking-widest mb-2">
                  Langkah {step.number}
                </p>
                <h3 className="font-display font-bold text-lg text-text-strong mb-3 leading-tight">
                  {step.title}
                </h3>
                <p className="text-text-muted text-sm leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Connector line — desktop only */}
        <div className="hidden lg:flex items-center justify-center mt-8 gap-0">
          {steps.map((_, i) => (
            <div key={i} className="flex items-center">
              <div className="w-3 h-3 rounded-full bg-pink-hot shadow-lg shadow-pink-hot/30" />
              {i < steps.length - 1 && (
                <div className="w-[calc((100vw-96px)/4-24px)] max-w-[200px] h-px bg-gradient-to-r from-pink-hot to-pink-rose" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
