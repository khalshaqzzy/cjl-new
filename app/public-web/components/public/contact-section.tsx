'use client'

import type { LandingResponse } from '@cjl/contracts'
import { MapPin, Clock, MessageCircle, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReveal } from '@/hooks/use-reveal'
import { cn } from '@/lib/utils'

interface ContactSectionProps {
  laundryInfo: LandingResponse['laundryInfo']
}

export function ContactSection({ laundryInfo }: ContactSectionProps) {
  const [headerRef, headerVisible] = useReveal()
  const [cardsRef, cardsVisible] = useReveal(0.1)

  return (
    <section id="kontak" className="py-28 bg-white">
      <div className="container mx-auto px-6 lg:px-12">
        <div className="text-center mb-14" ref={headerRef}>
          <div className={cn('reveal inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-pink-soft bg-pink-cloud text-pink-hot text-xs font-semibold uppercase tracking-wider mb-5', headerVisible && 'visible')}>
            <span className="w-1.5 h-1.5 rounded-full bg-pink-hot" />
            Lokasi &amp; Kontak
          </div>
          <h2 className={cn('reveal font-display font-extrabold text-4xl sm:text-5xl lg:text-6xl text-text-strong leading-tight text-balance', headerVisible && 'visible')}>
            Kunjungi{' '}
            <span className="text-gradient-pink">Kami</span>
          </h2>
          <p className={cn('reveal delay-100 text-text-body text-lg mt-4 leading-relaxed', headerVisible && 'visible')}>
            Kami buka setiap hari dan siap melayani Anda.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-5 max-w-5xl mx-auto" ref={cardsRef}>
          {/* Address */}
          <div className={cn('reveal group bg-bg-soft rounded-3xl p-7 border border-line-soft hover:border-pink-soft hover:shadow-xl hover:shadow-pink-hot/6 transition-all duration-300', cardsVisible && 'visible')}>
            <div className="w-12 h-12 rounded-2xl bg-pink-cloud border border-pink-soft flex items-center justify-center mb-5 group-hover:bg-gradient-primary group-hover:border-transparent transition-all duration-300">
              <MapPin className="w-5 h-5 text-pink-hot group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-display font-bold text-text-strong text-lg mb-2">Alamat</h3>
            <p className="text-text-body text-sm leading-relaxed">{laundryInfo.address}</p>
          </div>

          {/* Hours */}
          <div className={cn('reveal delay-100 group bg-bg-soft rounded-3xl p-7 border border-line-soft hover:border-pink-soft hover:shadow-xl hover:shadow-pink-hot/6 transition-all duration-300', cardsVisible && 'visible')}>
            <div className="w-12 h-12 rounded-2xl bg-pink-cloud border border-pink-soft flex items-center justify-center mb-5 group-hover:bg-gradient-primary group-hover:border-transparent transition-all duration-300">
              <Clock className="w-5 h-5 text-pink-hot group-hover:text-white transition-colors" />
            </div>
            <h3 className="font-display font-bold text-text-strong text-lg mb-2">Jam Operasional</h3>
            <p className="text-text-body text-sm leading-relaxed">{laundryInfo.operatingHours}</p>
            <div className="flex items-center gap-2 mt-4">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-success text-xs font-medium">Sedang Buka</span>
            </div>
          </div>

          {/* WhatsApp — pink accent card */}
          <div className={cn('reveal delay-200 relative bg-gradient-primary rounded-3xl p-7 overflow-hidden', cardsVisible && 'visible')}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl pointer-events-none" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center mb-5">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <h3 className="font-display font-bold text-white text-lg mb-1">WhatsApp</h3>
              <p className="text-white/70 text-sm mb-4">Respon cepat &amp; ramah</p>
              <p className="font-display font-extrabold text-2xl text-white mb-5">
                {laundryInfo.phone}
              </p>
              <Button
                size="sm"
                className="w-full bg-white hover:bg-white/90 text-pink-hot font-semibold gap-2 group"
                asChild
              >
                <a
                  href={`https://wa.me/${laundryInfo.whatsapp}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Chat Sekarang
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
