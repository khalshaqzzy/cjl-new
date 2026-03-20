'use client'

import { Star, Clock, Zap, Shield, ThumbsUp, Sparkles, MapPin, Award } from 'lucide-react'

const items = [
  { icon: Clock, label: '1 Jam Selesai' },
  { icon: Star, label: 'Stamp Reward Otomatis' },
  { icon: Zap, label: 'Mesin Electrolux Modern' },
  { icon: Shield, label: 'Aman & Terawat' },
  { icon: ThumbsUp, label: 'Hasil Bersih & Wangi' },
  { icon: Sparkles, label: 'Detergen Premium' },
  { icon: MapPin, label: 'Lokasi Strategis' },
  { icon: Award, label: 'Program Loyalty' },
]

const allItems = [...items, ...items]

export function MarqueeTrustBar() {
  return (
    <div className="bg-white border-y border-line-soft py-4 overflow-hidden marquee-track">
      <div className="flex animate-marquee whitespace-nowrap select-none" aria-hidden="true">
        {allItems.map((item, i) => (
          <div
            key={i}
            className="inline-flex items-center gap-3 mx-8 text-sm font-medium text-text-muted"
          >
            <item.icon className="w-4 h-4 text-pink-hot flex-shrink-0" />
            <span>{item.label}</span>
            <span className="ml-8 text-pink-soft">✦</span>
          </div>
        ))}
      </div>
    </div>
  )
}
