 'use client'

import { useEffect, useState } from 'react'
import { FloatingHeader } from '@/components/public/floating-header'
import { HeroSection } from '@/components/public/hero-section'
import { MarqueeTrustBar } from '@/components/public/marquee-trust-bar'
import { ServicesSection } from '@/components/public/services-section'
import { HowItWorksSection } from '@/components/public/how-it-works-section'
import { LoyaltySection } from '@/components/public/loyalty-section'
import { BenefitsSection } from '@/components/public/benefits-section'
import { LeaderboardTeaser } from '@/components/public/leaderboard-teaser'
import { FAQSection } from '@/components/public/faq-section'
import { ContactSection } from '@/components/public/contact-section'
import { Footer } from '@/components/public/footer'
import { publicApi } from '@/lib/api'
import type { LandingResponse } from '@cjl/contracts'

const emptyLandingData: LandingResponse = {
  laundryInfo: {
    name: '',
    phone: '',
    whatsapp: '',
    address: '',
    operatingHours: '',
  },
  services: [],
  faqs: [],
  leaderboardTeaser: [],
}

export default function LandingPage() {
  const [data, setData] = useState<LandingResponse>(emptyLandingData)

  useEffect(() => {
    publicApi.getLanding()
      .then(setData)
      .catch(() => undefined)
  }, [])

  return (
    <main className="min-h-screen">
      <FloatingHeader />
      <HeroSection />
      <MarqueeTrustBar />
      <ServicesSection services={data.services} />
      <HowItWorksSection />
      <LoyaltySection />
      <BenefitsSection />
      <LeaderboardTeaser rows={data.leaderboardTeaser} />
      <FAQSection faqs={data.faqs} />
      <ContactSection laundryInfo={data.laundryInfo} />
      <Footer laundryInfo={data.laundryInfo} />
    </main>
  )
}
