'use client'

import Link from 'next/link'
import type { LandingResponse } from '@cjl/contracts'
import { ArrowUpRight } from 'lucide-react'

const footerLinks = [
  { href: '#layanan', label: 'Layanan' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#loyalty', label: 'Rewards' },
  { href: '#leaderboard', label: 'Leaderboard' },
  { href: '#faq', label: 'FAQ' },
  { href: '#kontak', label: 'Kontak' },
  { href: '/login', label: 'Portal Pelanggan' },
  { href: '/leaderboard', label: 'Leaderboard Publik' },
]

interface FooterProps {
  laundryInfo: LandingResponse['laundryInfo']
}

export function Footer({ laundryInfo }: FooterProps) {
  const year = new Date().getFullYear()

  return (
    <footer className="bg-bg-soft border-t border-line-soft relative overflow-hidden">
      <div className="container mx-auto px-6 lg:px-12 py-16">
        <div className="grid md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-pink-hot/25">
                <span className="font-display font-bold text-base text-white">CJ</span>
              </div>
              <span className="font-display font-bold text-xl text-text-strong">CJ Laundry</span>
            </div>
            <p className="text-text-muted text-sm leading-relaxed max-w-xs">
              Laundry self service modern dengan hasil bersih, wangi, dan cepat. Program stamp reward untuk pelanggan setia.
            </p>
          </div>

          {/* Links */}
          <div className="md:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-center gap-1 text-text-muted hover:text-pink-hot text-sm transition-colors"
              >
                {link.label}
                {link.href.startsWith('/') && !link.href.startsWith('#') && (
                  <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
              </Link>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-line-soft flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-text-muted text-xs">
            &copy; {year} {laundryInfo.name}. Hak cipta dilindungi.
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span>{laundryInfo.phone}</span>
            <span className="w-1 h-1 rounded-full bg-line-soft" />
            <span>{laundryInfo.operatingHours}</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
