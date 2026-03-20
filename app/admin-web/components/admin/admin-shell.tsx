"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  ShoppingCart,
  Shirt,
  Users,
  Bell,
  Settings,
  LogOut,
  Menu,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { adminApi } from "@/lib/api"

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/pos", label: "POS", icon: ShoppingCart },
  { href: "/admin/laundry-aktif", label: "Laundry", icon: Shirt },
  { href: "/admin/pelanggan", label: "Pelanggan", icon: Users },
]

const moreItems = [
  { href: "/admin/notifikasi", label: "Notifikasi", icon: Bell },
  { href: "/admin/settings", label: "Pengaturan", icon: Settings },
]

function BottomNavItem({
  href,
  label,
  icon: Icon,
  isActive,
}: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  isActive: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex flex-col items-center gap-1 px-3 py-2 transition-colors",
        isActive ? "text-rose-600" : "text-text-muted hover:text-text-body"
      )}
    >
      <div className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
        isActive && "bg-rose-50"
      )}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <span className={cn("text-[10px] font-medium", isActive ? "text-rose-600" : "text-text-muted")}>
        {label}
      </span>
    </Link>
  )
}

function SideNavItem({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string
  label: string
  icon: typeof LayoutDashboard
  isActive: boolean
  onClick?: () => void
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
        isActive
          ? "bg-rose-50 text-rose-600"
          : "text-text-body hover:bg-bg-subtle hover:text-text-strong"
      )}
    >
      <Icon className={cn("h-4 w-4 flex-shrink-0", isActive ? "text-rose-600" : "text-text-muted")} />
      <span className="flex-1">{label}</span>
      {isActive && <ChevronRight className="h-3.5 w-3.5 text-rose-400" />}
    </Link>
  )
}

export function AdminShell({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode
  title: string
  subtitle?: string
  action?: ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const [isSessionChecked, setIsSessionChecked] = useState(false)

  useEffect(() => {
    adminApi
      .getSession()
      .then((payload) => {
        if (!payload.authenticated) {
          router.replace("/")
          return
        }

        setIsSessionChecked(true)
      })
      .catch(() => {
        router.replace("/")
      })
  }, [router])

  if (!isSessionChecked) {
    return null
  }

  return (
    <div className="min-h-screen bg-bg-canvas lg:flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-60 lg:flex-col lg:fixed lg:inset-y-0 border-r border-line-base bg-bg-surface">
        {/* Brand */}
        <div className="flex h-14 items-center gap-2.5 px-5 border-b border-line-base flex-shrink-0">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-600">
            <Shirt className="h-4 w-4 text-white" />
          </div>
          <span className="font-semibold text-sm text-text-strong tracking-tight">CJ Laundry</span>
          <span className="ml-auto text-[10px] font-medium bg-bg-subtle text-text-muted px-1.5 py-0.5 rounded">Admin</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Menu Utama
          </p>
          {navItems.map((item) => (
            <SideNavItem key={item.href} {...item} isActive={pathname === item.href} />
          ))}
          <div className="my-3 h-px bg-line-base" />
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">
            Lainnya
          </p>
          {moreItems.map((item) => (
            <SideNavItem key={item.href} {...item} isActive={pathname === item.href} />
          ))}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-line-base">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted hover:bg-danger-bg hover:text-danger transition-all"
          >
            <LogOut className="h-4 w-4" />
            <span>Keluar</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 lg:pl-60 flex flex-col min-h-screen">
        {/* Top Bar */}
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-4 border-b border-line-base bg-bg-surface/95 backdrop-blur-sm px-4 lg:px-6">
          <div className="flex items-center gap-3 min-w-0">
            {/* Mobile logo */}
            <div className="lg:hidden flex h-7 w-7 items-center justify-center rounded-md bg-rose-600 flex-shrink-0">
              <Shirt className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-sm text-text-strong truncate">{title}</h1>
              {subtitle && (
                <p className="text-[11px] text-text-muted truncate">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {action}
            {/* Mobile more menu */}
            <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
              <SheetTrigger asChild className="lg:hidden">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Menu className="h-4 w-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-64 p-0" aria-describedby={undefined}>
                <SheetHeader className="px-5 py-4 border-b border-line-base">
                  <SheetTitle className="text-sm font-semibold text-text-strong">Menu Lainnya</SheetTitle>
                </SheetHeader>
                <nav className="p-3 space-y-0.5">
                  {moreItems.map((item) => (
                    <SideNavItem
                      key={item.href}
                      {...item}
                      isActive={pathname === item.href}
                      onClick={() => setMoreOpen(false)}
                    />
                  ))}
                  <div className="my-3 h-px bg-line-base" />
                  <Link
                    href="/"
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-muted hover:bg-danger-bg hover:text-danger transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Keluar</span>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </header>

        {/* Page body */}
        <main className="flex-1 pb-24 lg:pb-8">{children}</main>

        {/* Mobile Bottom Tab Bar */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
          <div className="border-t border-line-base bg-bg-surface/95 backdrop-blur-sm">
            <div className="flex items-center justify-around px-2">
              {navItems.map((item) => (
                <BottomNavItem
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                />
              ))}
            </div>
          </div>
        </nav>
      </div>
    </div>
  )
}
