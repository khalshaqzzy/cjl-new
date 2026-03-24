"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import type { CustomerSearchResult } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import {
  Search,
  User,
  Phone,
  Star,
  Clock,
  ChevronRight,
  UserPlus,
  Loader2,
} from "lucide-react"
import { adminApi } from "@/lib/api"
import { CustomerLoginLinkSheet } from "@/components/admin/customer-login-link-sheet"

type FilterOption = "all" | "recent" | "high_points" | "active_orders"

const filterOptions = [
  { key: "all", label: "Semua" },
  { key: "recent", label: "Terbaru" },
  { key: "high_points", label: "Poin Tinggi" },
  { key: "active_orders", label: "Order Aktif" },
]

function CustomerCard({ customer }: { customer: CustomerSearchResult }) {
  return (
    <Link href={`/admin/pelanggan/${customer.customerId}`}>
      <Card className="rounded-xl border-line-base shadow-card hover:shadow-elevated hover:border-rose-100 transition-all cursor-pointer bg-bg-surface">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-subtle flex-shrink-0">
                <User className="h-4 w-4 text-text-muted" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text-strong truncate">{customer.name}</p>
                <p className="text-xs text-text-muted flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {customer.phone}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="flex items-center gap-1">
                  <Star className="h-4 w-4 text-warning" />
                  <span className="font-medium text-text-body">
                    {customer.currentPoints}
                  </span>
                </div>
                {customer.activeOrderCount > 0 && (
                  <Badge className="mt-1 bg-rose-50 text-rose-600 border-0 rounded-md text-[10px] font-semibold px-1.5">
                    {customer.activeOrderCount} aktif
                  </Badge>
                )}
              </div>
              <ChevronRight className="h-5 w-5 text-text-muted" />
            </div>
          </div>
          {customer.recentActivityAt && (
            <p className="text-xs text-text-muted mt-3 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Aktivitas terakhir: {customer.recentActivityAt}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

export default function PelangganPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [filter, setFilter] = useState<FilterOption>("all")
  const [showNewCustomer, setShowNewCustomer] = useState(false)
  const [newCustomerName, setNewCustomerName] = useState("")
  const [newCustomerPhone, setNewCustomerPhone] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [customers, setCustomers] = useState<CustomerSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [createMessage, setCreateMessage] = useState("")
  const [showQrAfterCreate, setShowQrAfterCreate] = useState(false)
  const [loginLinkUrl, setLoginLinkUrl] = useState("")
  const [loginLinkName, setLoginLinkName] = useState("")
  const [showLoginLinkSheet, setShowLoginLinkSheet] = useState(false)
  const createCustomerKeyRef = useRef<string | null>(null)

  useEffect(() => {
    let active = true
    setIsLoading(true)

    const timer = window.setTimeout(() => {
      adminApi.listCustomers(searchQuery.trim())
        .then((payload) => {
          if (!active) {
            return
          }

          setCustomers(payload)
          setLoadError("")
        })
        .catch((error) => {
          if (!active) {
            return
          }

          setLoadError(error instanceof Error ? error.message : "Gagal memuat pelanggan")
        })
        .finally(() => {
          if (active) {
            setIsLoading(false)
          }
        })
    }, searchQuery.trim() ? 250 : 0)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  const filteredCustomers = useMemo(() => {
    let result = customers

    switch (filter) {
      case "recent":
        result = [...result].sort((left, right) => right.createdAtIso.localeCompare(left.createdAtIso))
        break
      case "high_points":
        result = result.filter((c) => c.currentPoints >= 10).sort((left, right) => right.currentPoints - left.currentPoints)
        break
      case "active_orders":
        result = result
          .filter((c) => c.activeOrderCount > 0)
          .sort((left, right) => right.activeOrderCount - left.activeOrderCount || (right.lastActivityAtIso ?? "").localeCompare(left.lastActivityAtIso ?? ""))
        break
      default:
        result = [...result].sort((left, right) => (right.lastActivityAtIso ?? right.createdAtIso).localeCompare(left.lastActivityAtIso ?? left.createdAtIso))
    }

    return result
  }, [customers, filter])

  const handleCreateCustomer = async () => {
    setIsCreating(true)
    createCustomerKeyRef.current ||= crypto.randomUUID()
    try {
      const result = await adminApi.createCustomer(newCustomerName, newCustomerPhone, createCustomerKeyRef.current)
      setCustomers((prev) => [result.customer, ...prev.filter((item) => item.customerId !== result.customer.customerId)])
      setCreateMessage(result.duplicate ? "Nomor HP sudah terdaftar. Pelanggan yang ada dipilih kembali." : "Pelanggan baru berhasil didaftarkan.")
      if (!result.duplicate && showQrAfterCreate && result.oneTimeLogin) {
        setLoginLinkUrl(result.oneTimeLogin.url)
        setLoginLinkName(result.customer.name)
        setShowLoginLinkSheet(true)
      }
      setShowNewCustomer(false)
      setNewCustomerName("")
      setNewCustomerPhone("")
      createCustomerKeyRef.current = null
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AdminShell
      title="Pelanggan"
      subtitle={`${customers.length} pelanggan terdaftar`}
      action={
        <Button
          size="sm"
          className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold h-9 px-3 text-xs"
          onClick={() => setShowNewCustomer(true)}
        >
          <UserPlus className="h-4 w-4 mr-1" />
          Tambah
        </Button>
      }
    >
      <div className="px-4 py-6 lg:px-6 space-y-6">
        {createMessage && (
          <div className="rounded-xl border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">
            {createMessage}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-text-muted" />
          <Input
            placeholder="Cari nama atau nomor HP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 pl-10 rounded-lg border-line-base bg-bg-subtle placeholder:text-text-placeholder"
          />
        </div>

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 lg:mx-0 lg:px-0">
          {filterOptions.map((option) => (
            <Button
              key={option.key}
              variant={filter === option.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(option.key as FilterOption)}
              className={cn(
                "rounded-full whitespace-nowrap",
                filter === option.key
                  ? "bg-text-strong text-white border-0"
                  : ""
              )}
            >
              {option.label}
            </Button>
          ))}
        </div>

        {/* Customer List */}
        {isLoading ? (
          <div className="flex items-center gap-2 rounded-xl border border-line-base bg-bg-surface px-4 py-3 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat pelanggan...
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
            {loadError}
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="space-y-3">
            {filteredCustomers.map((customer) => (
              <CustomerCard key={customer.customerId} customer={customer} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-soft mx-auto mb-4">
              <User className="h-8 w-8 text-text-muted" />
            </div>
            <h3 className="font-display text-lg font-semibold text-text-strong">
              {searchQuery ? "Tidak ditemukan" : "Belum ada pelanggan"}
            </h3>
            <p className="text-text-muted mt-1">
              {searchQuery
                ? "Coba kata kunci lain atau tambah pelanggan baru"
                : "Tambahkan pelanggan pertama Anda"}
            </p>
            {!searchQuery && (
              <Button
                className="mt-4 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                onClick={() => setShowNewCustomer(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Tambah Pelanggan
              </Button>
            )}
          </div>
        )}
      </div>

      {/* New Customer Sheet */}
      <Sheet open={showNewCustomer} onOpenChange={setShowNewCustomer}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">
              Tambah Pelanggan Baru
            </SheetTitle>
          </SheetHeader>
          <div className="py-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-text-body">
                Nama Lengkap
              </label>
              <Input
                placeholder="Masukkan nama lengkap"
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                className="h-11 rounded-lg border-line-base"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">Nomor HP</label>
              <Input
                type="tel"
                placeholder="08xx-xxxx-xxxx"
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                className="h-11 rounded-lg border-line-base"
              />
              <p className="text-xs text-text-muted">
                Nomor HP akan dinormalisasi ke format +62
              </p>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line-base bg-bg-subtle px-3 py-3">
              <div>
                <p className="text-sm font-medium text-text-body">Tampilkan QR login setelah daftar</p>
                <p className="mt-0.5 text-xs text-text-muted">Admin bisa langsung scan-kan login sekali pakai ke customer.</p>
              </div>
              <Switch data-testid="customers-show-qr-after-create" checked={showQrAfterCreate} onCheckedChange={setShowQrAfterCreate} />
            </div>
          </div>
          <SheetFooter className="gap-2">
            <SheetClose asChild>
              <Button variant="outline" className="flex-1 rounded-xl">
                Batal
              </Button>
            </SheetClose>
              <Button
              className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
              onClick={handleCreateCustomer}
              disabled={!newCustomerName || !newCustomerPhone || isCreating}
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Mendaftar...
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Daftarkan
                </>
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <CustomerLoginLinkSheet
        open={showLoginLinkSheet}
        onOpenChange={setShowLoginLinkSheet}
        loginUrl={loginLinkUrl}
        customerName={loginLinkName}
        title="QR Login Customer Baru"
      />
    </AdminShell>
  )
}
