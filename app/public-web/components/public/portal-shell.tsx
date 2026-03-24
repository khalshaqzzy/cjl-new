'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useRouter } from 'next/navigation'
import { Home, History, Star, Trophy, LogOut, ChevronLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { publicApi } from '@/lib/api'

interface PortalShellProps {
  children: React.ReactNode
  title?: string
  showBack?: boolean
  backHref?: string
  session?: {
    customerId: string
    name: string
    phone: string
    publicNameVisible?: boolean
  } | null
}

const navItems = [
  { href: '/portal', icon: Home, label: 'Beranda' },
  { href: '/portal/riwayat', icon: History, label: 'Riwayat' },
  { href: '/portal/stamp', icon: Star, label: 'Stamp' },
  { href: '/portal/leaderboard', icon: Trophy, label: 'Leaderboard' },
]

export function PortalShell({ children, title, showBack, backHref = '/portal', session }: PortalShellProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [resolvedSession, setResolvedSession] = useState(session)
  const [isSessionChecked, setIsSessionChecked] = useState(Boolean(session))
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  useEffect(() => {
    if (session) {
      setResolvedSession(session)
      setIsSessionChecked(true)
      return
    }

    publicApi
      .getSession()
      .then((payload) => {
        if (!payload.authenticated || !payload.session) {
          router.replace('/login')
          return
        }

        setResolvedSession(payload.session)
        setIsSessionChecked(true)
      })
      .catch(() => {
        router.replace('/login')
      })
  }, [router, session])

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      await publicApi.logout()
    } finally {
      router.push('/login')
    }
  }

  if (!isSessionChecked) {
    return (
      <div className="min-h-screen bg-bg-soft flex items-center justify-center px-6">
        <div className="rounded-3xl border border-line-soft bg-white px-6 py-5 text-sm text-text-muted shadow-sm">
          Memeriksa sesi pelanggan...
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20 md:pb-0 md:pl-20 lg:pl-64 bg-bg-soft">

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-20 lg:w-64 flex-col z-40 bg-white border-r border-line-soft shadow-sm">

        {/* Logo */}
        <div className="flex items-center gap-3 p-4 lg:p-6 border-b border-line-soft">
          <div className="relative w-10 h-10 flex-shrink-0">
            <div className="absolute inset-0 rounded-2xl bg-gradient-primary opacity-20 blur-sm" />
            <div className="relative w-10 h-10 rounded-2xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-pink-hot/25">
              <span className="font-display font-bold text-lg text-white">CJ</span>
            </div>
          </div>
          <div className="hidden lg:block">
            <p className="font-display font-bold text-text-strong text-sm leading-tight">CJ Laundry</p>
            <p className="text-[10px] text-text-muted font-medium uppercase tracking-wider">Portal</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 lg:p-4 space-y-1 mt-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/portal' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200 group relative overflow-hidden',
                  isActive
                    ? 'bg-gradient-primary text-white shadow-lg shadow-pink-hot/20'
                    : 'text-text-muted hover:text-text-strong hover:bg-pink-cloud'
                )}
              >
                {!isActive && (
                  <span className="absolute inset-0 overflow-hidden pointer-events-none">
                    <span className="absolute top-0 bottom-0 w-8 bg-pink-hot/5 blur-sm -translate-x-full group-hover:translate-x-[400%] transition-transform duration-500 skew-x-[-15deg]" />
                  </span>
                )}
                <item.icon className="w-5 h-5 flex-shrink-0" />
                <span className="hidden lg:block font-semibold text-sm">{item.label}</span>
                {isActive && <span className="hidden lg:block ml-auto w-1.5 h-1.5 rounded-full bg-white/70" />}
              </Link>
            )
          })}
        </nav>

        {/* User section */}
        <div className="p-2 lg:p-4 border-t border-line-soft">
          <div className="flex items-center gap-3 px-3 py-2 mb-1">
            <div className="w-8 h-8 rounded-full bg-gradient-primary flex items-center justify-center flex-shrink-0 shadow-md shadow-pink-hot/20">
              <span className="font-bold text-white text-xs">{resolvedSession?.name?.charAt(0) ?? 'C'}</span>
            </div>
            <div className="hidden lg:block flex-1 min-w-0">
              <p className="font-semibold text-xs text-text-strong truncate">{resolvedSession?.name ?? 'Customer'}</p>
              <p className="text-[10px] text-text-muted truncate">{resolvedSession?.phone ?? '-'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-text-muted hover:text-danger hover:bg-danger/8 transition-all duration-200"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span className="hidden lg:block font-medium text-xs">{isLoggingOut ? 'Keluar...' : 'Keluar'}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden sticky top-0 z-40 bg-white border-b border-line-soft shadow-sm">
        <div className="flex items-center h-14 px-4">
          {showBack ? (
            <Link href={backHref} className="flex items-center gap-2 text-text-muted hover:text-pink-hot transition-colors">
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Kembali</span>
            </Link>
          ) : (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-primary flex items-center justify-center shadow-md shadow-pink-hot/20">
                <span className="font-display font-bold text-sm text-white">CJ</span>
              </div>
              <span className="font-display font-semibold text-text-strong text-sm">
                {title || 'CJ Laundry'}
              </span>
            </div>
          )}
          {title && !showBack && (
            <h1 className="flex-1 text-center font-display font-semibold text-text-strong text-sm">{title}</h1>
          )}
          {showBack && title && (
            <h1 className="flex-1 text-center font-display font-semibold text-text-strong text-sm mr-16">{title}</h1>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="min-h-[calc(100vh-56px)] md:min-h-screen">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 safe-area-pb bg-white border-t border-line-soft shadow-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const isActive = pathname === item.href ||
              (item.href !== '/portal' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200 min-w-[64px]',
                  isActive ? 'text-pink-hot' : 'text-text-muted hover:text-text-strong'
                )}
              >
                <div className="relative">
                  <item.icon className="w-5 h-5" />
                  {isActive && (
                    <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-pink-hot" />
                  )}
                </div>
                <span className="text-[10px] font-semibold">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <style jsx global>{`
        .safe-area-pb { padding-bottom: env(safe-area-inset-bottom, 0px); }
      `}</style>
    </div>
  )
}
