'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const navLinks = [
  { href: '#layanan', label: 'Layanan' },
  { href: '#cara-kerja', label: 'Cara Kerja' },
  { href: '#loyalty', label: 'Rewards' },
  { href: '#leaderboard', label: 'Leaderboard' },
  { href: '#faq', label: 'FAQ' },
]

export function FloatingHeader() {
  const [isScrolled, setIsScrolled] = useState(false)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('')

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const ids = navLinks.map((l) => l.href.replace('#', ''))
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveSection(e.target.id)
        })
      },
      { rootMargin: '-40% 0px -55% 0px' }
    )
    ids.forEach((id) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-500">
        <div
          className={cn(
            'mx-auto transition-all duration-500',
            isScrolled
              ? 'max-w-5xl mt-3 mx-4 lg:mx-auto rounded-2xl glass border border-pink-soft/60 shadow-xl shadow-pink-hot/8'
              : 'max-w-none'
          )}
        >
          <div
            className={cn(
              'flex items-center justify-between transition-all duration-500',
              isScrolled ? 'px-5 py-3' : 'px-6 py-5 lg:px-12'
            )}
          >
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="relative w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-pink-hot/30 group-hover:scale-105 transition-transform">
                <span className="font-display font-bold text-sm text-white tracking-tight">CJ</span>
                <div className="absolute inset-0 rounded-xl bg-pink-hot/30 opacity-0 group-hover:opacity-100 blur-sm transition-opacity" />
              </div>
              <span className="font-display font-bold text-lg tracking-tight text-text-strong">
                CJ Laundry
              </span>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    'relative px-4 py-2 text-sm font-medium rounded-xl transition-all duration-200',
                    activeSection === link.href.replace('#', '')
                      ? 'text-pink-hot bg-pink-cloud'
                      : 'text-text-body hover:text-pink-hot hover:bg-pink-cloud/60'
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* CTA */}
            <div className="hidden lg:flex items-center gap-2">
              <Button
                variant="ghost"
                asChild
                size="sm"
                className="text-text-body hover:text-pink-hot hover:bg-pink-cloud"
              >
                <Link href="/login">Masuk</Link>
              </Button>
              <Button
                asChild
                size="sm"
                className="bg-gradient-primary hover:opacity-90 text-white shadow-lg shadow-pink-hot/25 font-semibold gap-1.5"
              >
                <Link href="/login">
                  Cek Status
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
              className="lg:hidden p-2 rounded-xl text-text-strong hover:bg-pink-cloud transition-colors"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? 'Tutup menu' : 'Buka menu'}
            >
              {isMobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div
        className={cn(
          'fixed inset-0 z-40 lg:hidden transition-all duration-300',
          isMobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
      >
        <div
          className="absolute inset-0 bg-text-strong/40 backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
        <div
          className={cn(
            'absolute top-0 right-0 h-full w-72 bg-white border-l border-line-soft flex flex-col transition-transform duration-300 shadow-2xl',
            isMobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          )}
        >
          <div className="flex items-center justify-between p-6 border-b border-line-soft">
            <span className="font-display font-bold text-text-strong">Menu</span>
            <button
              className="p-2 rounded-xl text-text-muted hover:text-text-strong hover:bg-pink-cloud transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <nav className="flex flex-col p-4 gap-1 flex-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-3.5 text-sm font-medium text-text-body hover:text-pink-hot hover:bg-pink-cloud rounded-xl transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t border-line-soft flex flex-col gap-2">
            <Button variant="outline" asChild className="border-pink-soft text-text-strong hover:bg-pink-cloud">
              <Link href="/login">Masuk</Link>
            </Button>
            <Button asChild className="bg-gradient-primary hover:opacity-90 text-white font-semibold">
              <Link href="/login">Cek Status Cucian</Link>
            </Button>
          </div>
        </div>
      </div>
    </>
  )
}
