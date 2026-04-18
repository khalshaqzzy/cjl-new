"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { ConfirmOrderInput, CustomerSearchResult, OrderPreviewResponse, ServiceSetting } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"
import { CustomerLoginLinkSheet } from "@/components/admin/customer-login-link-sheet"
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Gift,
  Loader2,
  Minus,
  Package,
  Phone,
  Plus,
  ReceiptText,
  Scale,
  Search,
  Shirt,
  ShoppingBag,
  SprayCan,
  Star,
  User,
  UserPlus,
  Waves,
  Wind,
  X,
  Droplets,
} from "lucide-react"

type ServicePickerItemVM = {
  serviceCode: ServiceSetting["serviceCode"]
  label: string
  pricingLabel: string
  quantity: number
  selected: boolean
  disabled?: boolean
  pricePerUnit: number
  pricingModel: ServiceSetting["pricingModel"]
}

const serviceIcons: Record<string, typeof Shirt> = {
  washer: Waves,
  dryer: Wind,
  detergent: Droplets,
  softener: SprayCan,
  wash_dry_fold_package: Package,
  wash_dry_package: Package,
  ironing: Shirt,
  ironing_only: Shirt,
  laundry_plastic: ShoppingBag,
  laundry_plastic_large: ShoppingBag,
  laundry_hanger: Shirt,
}

const createServicePickerItem = (
  service: Awaited<ReturnType<typeof adminApi.getSettings>>["services"][number]
): ServicePickerItemVM => ({
  serviceCode: service.serviceCode,
  label: service.displayName,
  pricingLabel:
    service.pricingModel === "per_kg"
      ? `Rp ${service.price.toLocaleString("id-ID")}/kg`
      : `Rp ${service.price.toLocaleString("id-ID")}/unit`,
  quantity: 0,
  selected: false,
  disabled: !service.isActive,
  pricePerUnit: service.price,
  pricingModel: service.pricingModel,
})

const buildOrderPayload = (
  customerId: string,
  weightKg: string,
  services: ServicePickerItemVM[],
  redeemCount: number
): ConfirmOrderInput | null => {
  const parsedWeight = Number(weightKg)
  if (!customerId || Number.isNaN(parsedWeight) || parsedWeight <= 0) {
    return null
  }

  if (!services.some((service) => service.selected && service.quantity > 0)) {
    return null
  }

  return {
    customerId,
    weightKg: parsedWeight,
    redeemCount,
    items: services.map((service) => ({
      serviceCode: service.serviceCode,
      quantity: service.quantity,
      selected: service.selected,
    })),
  }
}

function StepIndicator({ current }: { current: 1 | 2 }) {
  const steps = [
    { n: 1, label: "Pelanggan" },
    { n: 2, label: "Layanan" },
    { n: 3, label: "Konfirmasi" },
  ]

  return (
    <div className="flex items-center gap-0 px-4 py-3 bg-bg-surface border-b border-line-base">
      {steps.map((step, index) => (
        <div key={step.n} className="flex items-center flex-1 last:flex-none">
          <div className="flex items-center gap-2">
            <div
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-all",
                step.n < current
                  ? "bg-success text-white"
                  : step.n === current
                    ? "bg-rose-600 text-white"
                    : "bg-bg-subtle border border-line-base text-text-muted"
              )}
            >
              {step.n < current ? <CheckCircle2 className="h-3.5 w-3.5" /> : step.n}
            </div>
            <span className={cn("text-xs font-medium hidden sm:block", step.n === current ? "text-text-strong" : "text-text-muted")}>
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div className="flex-1 mx-2">
              <div className={cn("h-px transition-all", step.n < current ? "bg-success" : "bg-line-base")} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function CustomerRow({ customer, onSelect }: { customer: CustomerSearchResult; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      data-testid={`customer-result-${customer.customerId}`}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-line-base bg-bg-surface hover:bg-rose-50 hover:border-rose-200 transition-all group"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-subtle group-hover:bg-rose-100 transition-colors flex-shrink-0">
          <User className="h-4 w-4 text-text-muted group-hover:text-rose-600 transition-colors" />
        </div>
        <div className="min-w-0 text-left">
          <p className="text-sm font-semibold text-text-strong truncate">{customer.name}</p>
          <p className="text-xs text-text-muted">{customer.phone}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0 ml-3">
        <div className="flex items-center gap-1">
          <Star className="h-3.5 w-3.5 text-warning" />
          <span className="text-xs font-semibold text-text-body tabular-nums">{customer.currentPoints}</span>
        </div>
        {customer.activeOrderCount > 0 && (
          <Badge className="bg-rose-50 text-rose-600 border-0 text-[10px] font-semibold px-1.5 rounded-md">
            {customer.activeOrderCount} aktif
          </Badge>
        )}
        <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-rose-600 transition-colors" />
      </div>
    </button>
  )
}

function SelectedCustomerSummary({
  customer,
  onClear,
}: {
  customer: CustomerSearchResult
  onClear?: () => void
}) {
  return (
    <div className="space-y-4" data-testid="pos-selected-customer-summary">
      <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-100 flex-shrink-0">
          <User className="h-5 w-5 text-rose-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-text-strong" data-testid="pos-selected-customer-name">{customer.name}</p>
          <p className="text-sm text-text-muted flex items-center gap-1">
            <Phone className="h-3 w-3" />
            {customer.phone}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="flex items-center gap-1 justify-end">
              <Star className="h-3.5 w-3.5 text-warning" />
              <span className="text-sm font-bold text-text-strong tabular-nums">{customer.currentPoints}</span>
            </div>
            <p className="text-[10px] text-text-muted">poin</p>
          </div>
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-white border border-line-base hover:bg-bg-subtle transition-colors"
            >
              <X className="h-3.5 w-3.5 text-text-muted" />
            </button>
          )}
        </div>
      </div>

      {customer.activeOrderCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-warning-bg border border-warning/20">
          <div className="h-2 w-2 rounded-full bg-warning flex-shrink-0" />
          <p className="text-xs text-warning font-medium">
            Pelanggan ini memiliki {customer.activeOrderCount} order yang sedang aktif
          </p>
        </div>
      )}
    </div>
  )
}

function StepCustomer({
  selectedCustomer,
  onSelect,
  onClear,
  onNext,
}: {
  selectedCustomer: CustomerSearchResult | null
  onSelect: (customer: CustomerSearchResult) => void
  onClear: () => void
  onNext: () => void
}) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<CustomerSearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState("")
  const [newPhone, setNewPhone] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [createMessage, setCreateMessage] = useState("")
  const [showQrAfterCreate, setShowQrAfterCreate] = useState(false)
  const [loginLinkUrl, setLoginLinkUrl] = useState("")
  const [loginLinkName, setLoginLinkName] = useState("")
  const [showLoginLinkSheet, setShowLoginLinkSheet] = useState(false)
  const createCustomerKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }

    let active = true
    setIsSearching(true)
    const timer = window.setTimeout(() => {
      adminApi.listCustomers(query)
        .then((payload) => {
          if (active) {
            setResults(payload)
          }
        })
        .catch(() => {
          if (active) {
            setResults([])
          }
        })
        .finally(() => {
          if (active) {
            setIsSearching(false)
          }
        })
    }, 250)

    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query])

  const handleCreate = async () => {
    setIsCreating(true)
    try {
      createCustomerKeyRef.current ||= crypto.randomUUID()
      const response = await adminApi.createCustomer(newName, newPhone, createCustomerKeyRef.current)
      onSelect(response.customer)
      setCreateMessage(response.duplicate ? "Nomor HP sudah terdaftar. Pelanggan yang ada dipilih kembali." : "Pelanggan baru berhasil didaftarkan dan dipilih.")
      if (!response.duplicate && showQrAfterCreate && response.oneTimeLogin) {
        setLoginLinkUrl(response.oneTimeLogin.url)
        setLoginLinkName(response.customer.name)
        setShowLoginLinkSheet(true)
      }
      setShowNew(false)
      setNewName("")
      setNewPhone("")
      setQuery("")
      setResults([])
      createCustomerKeyRef.current = null
    } finally {
      setIsCreating(false)
    }
  }

  const handleContinueAfterQr = () => {
    setShowLoginLinkSheet(false)
    onNext()
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 px-4 py-5 space-y-4">
        {createMessage && (
          <div data-testid="pos-create-customer-feedback" className="rounded-lg border border-success/20 bg-success-bg px-3 py-2 text-xs text-success">
            {createMessage}
          </div>
        )}
        {selectedCustomer ? (
          <SelectedCustomerSummary customer={selectedCustomer} onClear={onClear} />
        ) : (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted pointer-events-none" />
              <Input
                autoFocus
                data-testid="pos-customer-search"
                placeholder="Cari nama atau nomor HP..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="h-11 pl-9 rounded-lg border-line-base bg-bg-subtle text-sm placeholder:text-text-placeholder"
              />
              {query && (
                <button type="button" onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-4 w-4 text-text-muted" />
                </button>
              )}
            </div>

            {isSearching && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-bg-subtle text-xs text-text-muted">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Mencari pelanggan...
              </div>
            )}

            {results.length > 0 && (
              <div className="space-y-1.5 max-h-72 overflow-y-auto">
                {results.map((customer) => (
                  <CustomerRow key={customer.customerId} customer={customer} onSelect={() => {
                    onSelect(customer)
                    setQuery("")
                  }} />
                ))}
              </div>
            )}

            {query && !isSearching && results.length === 0 && (
              <div className="text-center py-8 space-y-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle mx-auto">
                  <User className="h-5 w-5 text-text-muted" />
                </div>
                <p className="text-sm text-text-muted">Pelanggan tidak ditemukan</p>
                <Button variant="outline" size="sm" className="rounded-lg" data-testid="pos-open-create-customer-from-empty" onClick={() => setShowNew(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Daftarkan Pelanggan Baru
                </Button>
              </div>
            )}

            {!query && (
              <button
                type="button"
                data-testid="pos-open-create-customer"
                onClick={() => setShowNew(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-line-strong hover:border-rose-300 hover:bg-rose-50 transition-all group"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-bg-subtle group-hover:bg-rose-100 transition-colors flex-shrink-0">
                  <UserPlus className="h-4 w-4 text-text-muted group-hover:text-rose-600 transition-colors" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-medium text-text-body group-hover:text-text-strong">Tambah Pelanggan Baru</p>
                  <p className="text-xs text-text-muted">Daftarkan pelanggan walk-in</p>
                </div>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-5 pt-3 border-t border-line-base">
        <Button
          className="w-full h-11 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
          data-testid="pos-next-to-services"
          disabled={!selectedCustomer}
          onClick={onNext}
        >
          Lanjut ke Pilih Layanan
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      <Sheet open={showNew} onOpenChange={setShowNew}>
        <SheetContent side="bottom" className="rounded-t-2xl" aria-describedby={undefined}>
          <SheetHeader className="pb-4 border-b border-line-base">
            <SheetTitle className="text-base font-semibold text-text-strong">Daftarkan Pelanggan Baru</SheetTitle>
          </SheetHeader>
          <div className="py-5 space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">Nama Lengkap</label>
              <Input data-testid="pos-create-customer-name" placeholder="Masukkan nama lengkap" value={newName} onChange={(event) => setNewName(event.target.value)} className="h-11 rounded-lg border-line-base" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text-body">Nomor HP (WhatsApp)</label>
              <Input data-testid="pos-create-customer-phone" type="tel" placeholder="08xx-xxxx-xxxx" value={newPhone} onChange={(event) => setNewPhone(event.target.value)} className="h-11 rounded-lg border-line-base" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-line-base bg-bg-subtle px-3 py-3">
              <div>
                <p className="text-sm font-medium text-text-body">Tampilkan QR login setelah daftar</p>
                <p className="mt-0.5 text-xs text-text-muted">Opsional untuk membantu customer login di tempat.</p>
              </div>
              <Switch data-testid="pos-show-qr-after-create" checked={showQrAfterCreate} onCheckedChange={setShowQrAfterCreate} />
            </div>
          </div>
          <SheetFooter>
            <Button data-testid="pos-create-customer-submit" className="w-full h-11 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold" onClick={handleCreate} disabled={!newName || !newPhone || isCreating}>
              {isCreating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Mendaftarkan...</> : <><UserPlus className="h-4 w-4 mr-2" />Daftarkan &amp; Pilih</>}
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
        continueAction={{
          label: "Lanjutkan ke POS",
          onClick: handleContinueAfterQr,
          testId: "pos-continue-after-qr",
        }}
      />
    </div>
  )
}

function ServiceToggleRow({
  service,
  weightKg,
  onQuantityChange,
  onToggle,
}: {
  service: ServicePickerItemVM
  weightKg: number
  onQuantityChange: (delta: number) => void
  onToggle: () => void
}) {
  const Icon = serviceIcons[service.serviceCode] || Shirt
  const isPerKg = service.pricingModel === "per_kg"
  const lineTotal = isPerKg ? service.pricePerUnit * weightKg : service.pricePerUnit * service.quantity

  return (
    <div data-testid={`service-row-${service.serviceCode}`} className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border transition-all", service.selected ? "border-rose-200 bg-rose-50" : "border-line-base bg-bg-surface hover:border-line-strong", service.disabled && "opacity-50")}>
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 transition-colors", service.selected ? "bg-rose-100" : "bg-bg-subtle")}>
        <Icon className={cn("h-4 w-4 transition-colors", service.selected ? "text-rose-600" : "text-text-muted")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium transition-colors", service.selected ? "text-text-strong" : "text-text-body")}>{service.label}</p>
        <p className="text-xs text-text-muted">{service.pricingLabel}</p>
      </div>
      {service.selected && <span className="text-sm font-semibold text-rose-600 tabular-nums flex-shrink-0">Rp {lineTotal.toLocaleString("id-ID")}</span>}
      {isPerKg ? (
        <button type="button" data-testid={`service-toggle-${service.serviceCode}`} onClick={onToggle} disabled={service.disabled} className={cn("flex h-6 w-6 items-center justify-center rounded-md border-2 transition-all flex-shrink-0", service.selected ? "border-rose-600 bg-rose-600" : "border-line-strong")}>
          {service.selected && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
        </button>
      ) : (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button type="button" data-testid={`service-minus-${service.serviceCode}`} onClick={() => onQuantityChange(-1)} disabled={service.quantity === 0 || service.disabled} className={cn("flex h-7 w-7 items-center justify-center rounded-lg border transition-colors", service.quantity === 0 || service.disabled ? "border-line-base text-text-placeholder cursor-not-allowed" : "border-line-base hover:bg-bg-subtle text-text-body")}>
            <Minus className="h-3 w-3" />
          </button>
          <span data-testid={`service-quantity-${service.serviceCode}`} className={cn("w-7 text-center text-sm font-semibold tabular-nums", service.selected ? "text-text-strong" : "text-text-muted")}>{service.quantity}</span>
          <button type="button" data-testid={`service-plus-${service.serviceCode}`} onClick={() => onQuantityChange(1)} disabled={service.disabled} className="flex h-7 w-7 items-center justify-center rounded-lg border border-line-base hover:bg-bg-subtle text-text-body transition-colors disabled:cursor-not-allowed disabled:text-text-placeholder">
            <Plus className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  )
}

function StepServices({
  customer,
  services,
  setServices,
  weightKg,
  setWeightKg,
  redeemCount,
  setRedeemCount,
  preview,
  isPreviewLoading,
  previewError,
  onBack,
  onNext,
  isConfirming,
}: {
  customer: CustomerSearchResult
  services: ServicePickerItemVM[]
  setServices: React.Dispatch<React.SetStateAction<ServicePickerItemVM[]>>
  weightKg: string
  setWeightKg: (value: string) => void
  redeemCount: number
  setRedeemCount: (value: number) => void
  preview: OrderPreviewResponse | null
  isPreviewLoading: boolean
  previewError: string
  onBack: () => void
  onNext: () => void
  isConfirming: boolean
}) {
  const weight = Number(weightKg) || 0
  const selectedServices = services.filter((service) => service.selected)
  const maxRedeem = preview?.maxRedeemableUnits ?? Math.floor(customer.currentPoints / 10)
  const hasWeightError = weightKg.trim().length > 0 && weight <= 0
  const hasServiceError = selectedServices.length === 0

  const handleQuantityChange = (serviceCode: string, delta: number) => {
    setServices((current) => current.map((service) => {
      if (service.serviceCode !== serviceCode) return service
      const quantity = Math.max(0, service.quantity + delta)
      return { ...service, quantity, selected: quantity > 0 }
    }))
  }

  const handleToggle = (serviceCode: string) => {
    setServices((current) => current.map((service) => {
      if (service.serviceCode !== serviceCode) return service
      const selected = !service.selected
      return { ...service, selected, quantity: selected ? Math.max(service.quantity, 1) : 0 }
    }))
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-5 pb-1">
          <SelectedCustomerSummary customer={customer} />
        </div>
        <div className="px-4 pt-5 pb-4 border-b border-line-base">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-text-strong flex items-center gap-1.5"><Scale className="h-4 w-4 text-text-muted" />Berat Cucian</p>
            {weight > 0 && <Badge className="bg-bg-subtle text-text-body border-0 text-xs font-semibold rounded-md">{weight} kg</Badge>}
          </div>
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Input data-testid="pos-weight-input" type="number" step="0.1" min="0" placeholder="0.0" value={weightKg} onChange={(event) => setWeightKg(event.target.value)} className="h-12 text-xl font-bold text-center rounded-lg border-line-base bg-bg-subtle pr-12 tabular-nums" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-text-muted">kg</span>
            </div>
            <div className="flex gap-1.5">
              {[2, 5, 10].map((preset) => (
                <button key={preset} type="button" onClick={() => setWeightKg(String(preset))} className={cn("h-12 w-12 rounded-lg border text-sm font-semibold transition-all", weight === preset ? "border-rose-600 bg-rose-50 text-rose-600" : "border-line-base bg-bg-surface text-text-muted hover:border-line-strong")}>
                  {preset}
                </button>
              ))}
            </div>
          </div>
          {hasWeightError && (
            <p className="mt-2 text-xs text-danger">Berat cucian harus lebih dari 0 kg.</p>
          )}
        </div>

        <div className="px-4 pt-4 pb-3 space-y-2">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">Pilih Layanan</p>
          {services.map((service) => (
            <ServiceToggleRow key={service.serviceCode} service={service} weightKg={weight} onQuantityChange={(delta) => handleQuantityChange(service.serviceCode, delta)} onToggle={() => handleToggle(service.serviceCode)} />
          ))}
          {hasServiceError && (
            <p className="pt-1 text-xs text-danger">Pilih minimal satu layanan sebelum lanjut ke ringkasan.</p>
          )}
        </div>

        {customer.currentPoints >= 10 && (
          <div className="px-4 pb-4">
            <div className="rounded-xl border border-line-base bg-bg-surface overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-line-base">
                <div className="flex items-center gap-2"><Gift className="h-4 w-4 text-warning" /><p className="text-sm font-semibold text-text-strong">Tukar Poin</p></div>
                <div className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-warning" /><span className="text-sm font-bold text-text-strong tabular-nums">{customer.currentPoints}</span><span className="text-xs text-text-muted ml-0.5">tersedia</span></div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-text-body">Diskon reward</p>
                    <p className="text-xs text-text-muted">10 poin = diskon Rp 10.000 untuk Washer atau paket, dan mengurangi 1 kesempatan poin</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" data-testid="pos-redeem-minus" onClick={() => setRedeemCount(Math.max(0, redeemCount - 1))} disabled={redeemCount === 0} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border transition-colors", redeemCount === 0 ? "border-line-base text-text-placeholder cursor-not-allowed" : "border-line-base hover:bg-bg-subtle text-text-body")}>
                      <Minus className="h-3 w-3" />
                    </button>
                    <span data-testid="pos-redeem-count" className="w-8 text-center text-sm font-bold text-text-strong tabular-nums">{redeemCount}</span>
                    <button type="button" data-testid="pos-redeem-plus" onClick={() => setRedeemCount(Math.min(maxRedeem, redeemCount + 1))} disabled={redeemCount >= maxRedeem} className={cn("flex h-8 w-8 items-center justify-center rounded-lg border transition-colors", redeemCount >= maxRedeem ? "border-line-base text-text-placeholder cursor-not-allowed" : "border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-600")}>
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                {(preview?.discount ?? 0) > 0 && <div className="mt-2 pt-2 border-t border-line-base flex items-center justify-between"><span className="text-xs text-success font-medium">Hemat</span><span className="text-xs font-bold text-success">{preview?.discountLabel}</span></div>}
              </div>
            </div>
          </div>
        )}

        {(preview?.earnedStamps ?? 0) > 0 && (
          <div className="px-4 pb-5">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-warning-bg border border-warning/20">
              <Star className="h-4 w-4 text-warning flex-shrink-0" />
              <p className="text-xs text-warning font-medium">
                Pelanggan akan mendapat <strong>{preview?.earnedStamps} poin</strong> dari order ini
              </p>
            </div>
          </div>
        )}

        {(preview?.redeemedPoints ?? 0) > 0 && (
          <div className="px-4 pb-5">
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-info/10 border border-info/20">
              <Gift className="h-4 w-4 text-info flex-shrink-0" />
              <p className="text-xs text-info font-medium">
                Setiap redeem memberi diskon Rp 10.000 dan mengurangi 1 kesempatan poin dari order ini.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-line-base bg-bg-surface">
        {isPreviewLoading && (
          <div className="px-4 pt-3 flex items-center gap-2 text-xs text-text-muted">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Menghitung ringkasan order...
          </div>
        )}
        {previewError && (
          <div className="px-4 pt-3 text-xs text-danger">
            {previewError}
          </div>
        )}
        {selectedServices.length > 0 && (
          <div className="px-4 py-3 space-y-1">
            {(preview?.discount ?? 0) > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-text-muted">Subtotal</span>
                  <span className="text-xs text-text-muted tabular-nums line-through">{preview?.subtotalLabel}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-success">Diskon poin</span>
                  <span className="text-xs text-success font-medium tabular-nums">{preview?.discountLabel}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm font-semibold text-text-strong">Total</span>
              <span className="text-xl font-bold text-rose-600 tabular-nums">{preview?.totalLabel ?? "Rp 0"}</span>
            </div>
          </div>
        )}
        <div className="px-4 pb-5 pt-2 flex gap-2">
          <Button variant="outline" className="rounded-lg h-11 px-4" onClick={onBack}>
            Kembali
          </Button>
          <Button data-testid="pos-open-summary" className="flex-1 h-11 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold" disabled={selectedServices.length === 0 || weight <= 0 || isConfirming || isPreviewLoading || !preview} onClick={onNext}>
            {isConfirming ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Memproses...</> : <><ReceiptText className="h-4 w-4 mr-2" />Lihat Ringkasan</>}
          </Button>
        </div>
      </div>
    </div>
  )
}

function OrderSummarySheet({ open, onOpenChange, customer, preview, onConfirm, isConfirming }: { open: boolean; onOpenChange: (value: boolean) => void; customer: CustomerSearchResult; preview: OrderPreviewResponse | null; onConfirm: () => void; isConfirming: boolean }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[90vh] flex flex-col" aria-describedby={undefined}>
        <SheetHeader className="pb-4 border-b border-line-base flex-shrink-0">
          <div className="flex items-center gap-2"><ReceiptText className="h-4 w-4 text-rose-600" /><SheetTitle className="text-base font-semibold text-text-strong">Konfirmasi Order</SheetTitle></div>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          <SelectedCustomerSummary customer={customer} />
          <div className="rounded-xl border border-line-base overflow-hidden">
            {preview?.items.map((item, index) => {
              const Icon = serviceIcons[item.serviceCode] || Shirt
              return (
                <div key={item.serviceCode} className={cn("flex items-center justify-between px-4 py-3", index > 0 && "border-t border-line-base")}>
                  <div className="flex items-center gap-3">
                    <Icon className="h-4 w-4 text-text-muted flex-shrink-0" />
                    <div><p className="text-sm font-medium text-text-body">{item.serviceLabel}</p><p className="text-xs text-text-muted">{item.quantityLabel} · {item.unitPriceLabel}</p></div>
                  </div>
                  <span className="text-sm font-semibold text-text-strong tabular-nums">{item.lineTotalLabel}</span>
                </div>
              )
            })}
          </div>
          <div className="rounded-xl border border-line-base overflow-hidden">
            {(preview?.discount ?? 0) > 0 && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-line-base"><span className="text-sm text-text-muted">Subtotal</span><span className="text-sm text-text-muted tabular-nums">{preview?.subtotalLabel}</span></div>
                <div className="flex items-center justify-between px-4 py-3 border-b border-line-base"><span className="text-sm text-success">{(preview?.redeemedPoints ?? 0) / 10}x Diskon Reward</span><span className="text-sm text-success font-medium tabular-nums">{preview?.discountLabel}</span></div>
              </>
            )}
            <div className="flex items-center justify-between px-4 py-3 bg-bg-subtle"><span className="text-sm font-bold text-text-strong">Total Bayar</span><span className="text-xl font-bold text-rose-600 tabular-nums">{preview?.totalLabel ?? "Rp 0"}</span></div>
          </div>
          <div className="rounded-xl border border-warning/30 bg-warning-bg overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-warning/20"><Star className="h-4 w-4 text-warning" /><p className="text-xs font-semibold text-warning uppercase tracking-wider">Ringkasan Poin</p></div>
            <div className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between"><span className="text-sm text-text-muted">Poin saat ini</span><span className="text-sm font-semibold text-text-body tabular-nums">{customer.currentPoints}</span></div>
              {(preview?.redeemedPoints ?? 0) > 0 && <div className="flex items-center justify-between"><span className="text-sm text-text-muted">Digunakan</span><span className="text-sm font-semibold text-danger tabular-nums">-{preview?.redeemedPoints ?? 0}</span></div>}
              {(preview?.earnedStamps ?? 0) > 0 && <div className="flex items-center justify-between"><span className="text-sm text-text-muted">Diperoleh</span><span className="text-sm font-semibold text-success tabular-nums">+{preview?.earnedStamps ?? 0}</span></div>}
              {(preview?.redeemedPoints ?? 0) > 0 && <p className="text-xs text-text-muted">Setiap redeem mengurangi 1 kesempatan poin dari order ini.</p>}
              <div className="flex items-center justify-between pt-2 border-t border-warning/20"><span className="text-sm font-semibold text-text-strong">Saldo Setelah</span><span className="text-sm font-bold text-text-strong tabular-nums">{preview?.resultingPointBalance ?? customer.currentPoints} poin</span></div>
            </div>
          </div>
        </div>
        <SheetFooter className="pt-4 border-t border-line-base flex-shrink-0">
          <Button data-testid="pos-confirm-order" className="w-full h-12 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold" onClick={onConfirm} disabled={isConfirming || !preview}>
            {isConfirming ? <><Loader2 className="h-5 w-5 mr-2 animate-spin" />Memproses Order...</> : <><CheckCircle2 className="h-5 w-5 mr-2" />Konfirmasi &amp; Buat Order</>}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function SuccessScreen({ customerId, customerName, orderCode, onNewOrder }: { customerId: string; customerName: string; orderCode: string; onNewOrder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] px-6 text-center gap-5">
      <div className="relative">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10"><CheckCircle2 className="h-10 w-10 text-success" /></div>
        <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-warning-bg border border-warning/20"><Star className="h-3 w-3 text-warning" /></div>
      </div>
      <div className="space-y-1.5">
        <h2 className="text-xl font-bold text-text-strong">Order Berhasil Dibuat!</h2>
        <p className="text-sm text-text-muted">Order untuk <span className="font-semibold text-text-body">{customerName}</span> telah dikonfirmasi</p>
      </div>
      <div data-testid="pos-success-order-code" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-bg-subtle border border-line-base"><ReceiptText className="h-4 w-4 text-text-muted" /><span className="font-mono text-sm font-semibold text-rose-600">{orderCode}</span></div>
      <div className="flex gap-3 w-full max-w-md">
        <Button variant="outline" className="flex-1 rounded-lg" onClick={() => (window.location.href = "/admin/laundry-aktif")}>Laundry Aktif</Button>
        <Button variant="outline" className="flex-1 rounded-lg" onClick={() => (window.location.href = `/admin/pelanggan/${customerId}`)}>Detail Pelanggan</Button>
        <Button className="flex-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold" onClick={onNewOrder}>Order Baru</Button>
      </div>
    </div>
  )
}

export default function POSPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSearchResult | null>(null)
  const [weightKg, setWeightKg] = useState("")
  const [services, setServices] = useState<ServicePickerItemVM[]>([])
  const [baseServices, setBaseServices] = useState<ServicePickerItemVM[]>([])
  const [redeemCount, setRedeemCount] = useState(0)
  const [preview, setPreview] = useState<OrderPreviewResponse | null>(null)
  const [isPreviewLoading, setIsPreviewLoading] = useState(false)
  const [previewError, setPreviewError] = useState("")
  const [isConfirming, setIsConfirming] = useState(false)
  const [showSummary, setShowSummary] = useState(false)
  const [createdOrderCode, setCreatedOrderCode] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)
  const confirmOrderKeyRef = useRef<string | null>(null)

  const payload = useMemo(() => selectedCustomer ? buildOrderPayload(selectedCustomer.customerId, weightKg, services, redeemCount) : null, [redeemCount, selectedCustomer, services, weightKg])

  useEffect(() => {
    adminApi.getSettings()
      .then((settings) => {
        const nextServices = settings.services.filter((service) => service.isActive).map(createServicePickerItem)
        setBaseServices(nextServices)
        setServices(nextServices)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!payload) {
      setPreview(null)
      setPreviewError("")
      return
    }

    let active = true
    setIsPreviewLoading(true)
    adminApi.previewOrder(payload)
      .then((response) => {
        if (!active) return
        setPreview(response)
        setPreviewError("")
        if (redeemCount > response.maxRedeemableUnits) setRedeemCount(response.maxRedeemableUnits)
      })
      .catch((error) => {
        if (active) {
          setPreview(null)
          setPreviewError(error instanceof Error ? error.message : "Gagal menghitung preview order")
        }
      })
      .finally(() => {
        if (active) setIsPreviewLoading(false)
      })

    return () => {
      active = false
    }
  }, [payload, redeemCount])

  const handleConfirm = async () => {
    if (!payload) return
    setIsConfirming(true)
    try {
      confirmOrderKeyRef.current ||= crypto.randomUUID()
      const response = await adminApi.confirmOrder(payload, confirmOrderKeyRef.current)
      setCreatedOrderCode(response.order.orderCode)
      setShowSummary(false)
      setShowSuccess(true)
    } finally {
      setIsConfirming(false)
    }
  }

  const handleReset = () => {
    setStep(1)
    setSelectedCustomer(null)
    setWeightKg("")
    setServices(baseServices.map((service) => ({ ...service })))
    setRedeemCount(0)
    setPreview(null)
    setPreviewError("")
    setCreatedOrderCode("")
    setShowSuccess(false)
    setShowSummary(false)
    confirmOrderKeyRef.current = null
  }

  if (showSuccess && selectedCustomer) {
    return (
      <AdminShell title="POS" subtitle="Buat Order Baru">
        <SuccessScreen customerId={selectedCustomer.customerId} customerName={selectedCustomer.name} orderCode={createdOrderCode} onNewOrder={handleReset} />
      </AdminShell>
    )
  }

  return (
    <AdminShell title="POS" subtitle="Buat Order Baru">
      <div className="flex flex-col" style={{ minHeight: "calc(100vh - 8rem)" }}>
        <StepIndicator current={step} />
        <div className="flex-1 flex flex-col">
          {step === 1 && <StepCustomer selectedCustomer={selectedCustomer} onSelect={setSelectedCustomer} onClear={() => setSelectedCustomer(null)} onNext={() => setStep(2)} />}
          {step === 2 && selectedCustomer && (
            <>
              <StepServices customer={selectedCustomer} services={services} setServices={setServices} weightKg={weightKg} setWeightKg={setWeightKg} redeemCount={redeemCount} setRedeemCount={setRedeemCount} preview={preview} isPreviewLoading={isPreviewLoading} previewError={previewError} onBack={() => setStep(1)} onNext={() => setShowSummary(true)} isConfirming={isConfirming} />
              <OrderSummarySheet open={showSummary} onOpenChange={setShowSummary} customer={selectedCustomer} preview={preview} onConfirm={handleConfirm} isConfirming={isConfirming} />
            </>
          )}
        </div>
      </div>
    </AdminShell>
  )
}
