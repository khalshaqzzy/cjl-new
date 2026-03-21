"use client"

import { useEffect, useState } from "react"
import { AdminShell } from "@/components/admin/admin-shell"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { ServiceSetting } from "@cjl/contracts"
import {
  Save,
  Loader2,
  Building2,
  DollarSign,
  Shirt,
  Waves,
  Wind,
  Droplets,
  SprayCan,
  Package,
  Info,
} from "lucide-react"
import { adminApi } from "@/lib/api"

const serviceIcons: Record<string, typeof Shirt> = {
  washer: Waves,
  dryer: Wind,
  detergent: Droplets,
  softener: SprayCan,
  wash_dry_fold_package: Package,
  ironing: Shirt,
}

function ServicePriceCard({
  service,
  onPriceChange,
  onActiveChange,
}: {
  service: ServiceSetting
  onPriceChange: (price: number) => void
  onActiveChange: (active: boolean) => void
}) {
  const Icon = serviceIcons[service.serviceCode] || Shirt

  return (
    <Card
      className={cn(
        "rounded-xl border shadow-card transition-all bg-bg-surface",
        service.isActive ? "border-line-base" : "border-line-base/40 opacity-55"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", service.isActive ? "bg-rose-50" : "bg-bg-subtle")}>
              <Icon className={cn("h-4 w-4", service.isActive ? "text-rose-600" : "text-text-muted")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-strong">{service.displayName}</p>
              <Badge variant="secondary" className="mt-1 rounded-md text-[10px] bg-bg-subtle border-0 px-1.5">
                {service.pricingModel === "per_kg" ? "per kg" : "per unit"}
              </Badge>
            </div>
          </div>
          <Switch checked={service.isActive} onCheckedChange={onActiveChange} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-text-muted">Harga</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-text-muted font-medium">Rp</span>
            <Input
              type="number"
              value={service.price}
              onChange={(e) => onPriceChange(parseInt(e.target.value) || 0)}
              className="h-10 pl-9 rounded-lg border-line-base text-right text-sm font-semibold"
              disabled={!service.isActive}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function SettingsPage() {
  const [laundryName, setLaundryName] = useState("")
  const [laundryPhone, setLaundryPhone] = useState("")
  const [laundryAddress, setLaundryAddress] = useState("")
  const [services, setServices] = useState<ServiceSetting[]>([])
  const [publicWhatsapp, setPublicWhatsapp] = useState("")
  const [operatingHours, setOperatingHours] = useState("")
  const [messageTemplates, setMessageTemplates] = useState({
    welcome: "",
    orderConfirmed: "",
    orderDone: "",
    orderVoidNotice: "",
    accountInfo: "",
  })
  const [initialState, setInitialState] = useState<{
    laundryName: string
    laundryPhone: string
    laundryAddress: string
    publicWhatsapp: string
    operatingHours: string
    services: ServiceSetting[]
    messageTemplates: typeof messageTemplates
  } | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")

  useEffect(() => {
    adminApi.getSettings()
      .then((payload) => {
        setLaundryName(payload.business.laundryName)
        setLaundryPhone(payload.business.laundryPhone)
        setLaundryAddress(payload.business.address)
        setPublicWhatsapp(payload.business.publicWhatsapp)
        setOperatingHours(payload.business.operatingHours)
        setServices(payload.services)
        setMessageTemplates(payload.messageTemplates)
        setInitialState({
          laundryName: payload.business.laundryName,
          laundryPhone: payload.business.laundryPhone,
          laundryAddress: payload.business.address,
          publicWhatsapp: payload.business.publicWhatsapp,
          operatingHours: payload.business.operatingHours,
          services: payload.services,
          messageTemplates: payload.messageTemplates,
        })
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat pengaturan"))
      .finally(() => setIsLoading(false))
  }, [])

  const handlePriceChange = (serviceCode: string, price: number) => {
    setServices((prev) => prev.map((s) => s.serviceCode === serviceCode ? { ...s, price } : s))
    setHasChanges(true)
  }

  const handleActiveChange = (serviceCode: string, isActive: boolean) => {
    setServices((prev) => prev.map((s) => s.serviceCode === serviceCode ? { ...s, isActive } : s))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    await adminApi.updateSettings({
      business: {
        laundryName,
        laundryPhone,
        publicContactPhone: laundryPhone,
        publicWhatsapp,
        address: laundryAddress,
        operatingHours,
      },
      services,
      messageTemplates,
    })
    setInitialState({
      laundryName,
      laundryPhone,
      laundryAddress,
      publicWhatsapp,
      operatingHours,
      services,
      messageTemplates,
    })
    setIsSaving(false)
    setHasChanges(false)
  }

  return (
    <AdminShell title="Pengaturan" subtitle="Profil bisnis dan harga layanan">
      <div className="px-4 py-6 lg:px-6 space-y-8 pb-32">
        {isLoading && (
          <div className="flex items-center gap-2 rounded-xl border border-line-base bg-bg-surface px-4 py-3 text-sm text-text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat pengaturan...
          </div>
        )}

        {loadError && (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
            {loadError}
          </div>
        )}

        {/* Business Profile */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-line-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <Building2 className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-strong">Profil Bisnis</h2>
            </div>
          </div>

          <Card className="rounded-xl border-line-base shadow-card bg-bg-surface">
            <CardContent className="p-5 space-y-4">
              {[
                { label: "Nama Laundry", value: laundryName, setter: setLaundryName, type: "text", placeholder: "Nama laundry" },
                { label: "Nomor Telepon", value: laundryPhone, setter: setLaundryPhone, type: "tel", placeholder: "+62 xxx" },
                { label: "Alamat", value: laundryAddress, setter: setLaundryAddress, type: "text", placeholder: "Alamat lengkap" },
                { label: "WhatsApp Publik", value: publicWhatsapp, setter: setPublicWhatsapp, type: "text", placeholder: "628xxxx" },
                { label: "Jam Operasional", value: operatingHours, setter: setOperatingHours, type: "text", placeholder: "Senin - Minggu, 07:00 - 22:00" },
              ].map(({ label, value, setter, type, placeholder }) => (
                <div key={label} className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">{label}</label>
                  <Input
                    type={type}
                    value={value}
                    placeholder={placeholder}
                    onChange={(e) => { setter(e.target.value); setHasChanges(true) }}
                    className="h-11 rounded-lg border-line-base"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-line-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <Info className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-strong">Blok Pesan WhatsApp</h2>
            </div>
          </div>

          <Card className="rounded-xl border-line-base shadow-card bg-bg-surface">
            <CardContent className="p-5 space-y-4">
              {[
                { key: "welcome", label: "Welcome", helper: "Terkirim saat pelanggan baru dibuat." },
                { key: "orderConfirmed", label: "Order Dikonfirmasi", helper: "Gunakan token seperti {{orderCode}}, {{createdAt}}, {{earnedStamps}}, {{redeemedPoints}}, {{currentPoints}}, {{statusUrl}}." },
                { key: "orderDone", label: "Order Selesai", helper: "Gunakan {{orderCode}}, {{createdAt}}, {{completedAt}}." },
                { key: "orderVoidNotice", label: "Order Dibatalkan", helper: "Gunakan {{orderCode}} dan {{reason}} untuk koreksi operasional." },
                { key: "accountInfo", label: "Info Akun", helper: "Terkirim setelah nama/nomor pelanggan diperbarui." },
              ].map(({ key, label, helper }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">{label}</label>
                  <Textarea
                    value={messageTemplates[key as keyof typeof messageTemplates]}
                    onChange={(event) => {
                      setMessageTemplates((prev) => ({
                        ...prev,
                        [key]: event.target.value,
                      }))
                      setHasChanges(true)
                    }}
                    rows={3}
                    className="rounded-lg border-line-base resize-none text-sm"
                  />
                  <p className="text-xs text-text-muted">{helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        {/* Service Prices */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-line-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <DollarSign className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-strong">Harga Layanan</h2>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServicePriceCard
                key={service.serviceCode}
                service={service}
                onPriceChange={(price) => handlePriceChange(service.serviceCode, price)}
                onActiveChange={(active) => handleActiveChange(service.serviceCode, active)}
              />
            ))}
          </div>
        </section>

        {/* Loyalty System */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 pb-1 border-b border-line-base">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
              <Shirt className="h-3.5 w-3.5 text-warning" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text-strong">Sistem Loyalitas</h2>
            </div>
          </div>

          <Card className="rounded-xl border-line-base shadow-card bg-bg-surface">
            <CardContent className="p-5 divide-y divide-line-base">
              {[
                { label: "Washer + Dryer berpasangan", desc: "1 stamp untuk setiap pasangan Washer dan Dryer yang cocok pada order", value: "1", color: "bg-rose-50 text-rose-600" },
                { label: "Paket Cuci Kering Lipat", desc: "1 stamp untuk setiap unit paket", value: "1", color: "bg-rose-50 text-rose-600" },
                { label: "Redeem 1 Washer Gratis", desc: "Poin yang dibutuhkan untuk 1 Washer gratis", value: "10", color: "bg-success/10 text-success" },
                { label: "Penyesuaian Manual", desc: "Menambah saldo poin pelanggan tanpa memengaruhi leaderboard", value: "0", color: "bg-info/10 text-info" },
              ].map(({ label, desc, value, color }) => (
                <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-semibold text-text-strong">{label}</p>
                    <p className="text-xs text-text-muted mt-0.5">{desc}</p>
                  </div>
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg font-bold text-sm", color)}>
                    {value}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/5 p-3">
            <Info className="h-4 w-4 text-info mt-0.5 flex-shrink-0" />
            <p className="text-xs text-info leading-relaxed">
              Pengaturan sistem loyalitas tidak dapat diubah melalui UI untuk menjaga konsistensi. Hubungi developer jika diperlukan perubahan.
            </p>
          </div>
        </section>
      </div>

      {/* Sticky Save Bar */}
      {hasChanges && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 z-40 px-4 py-3 bg-white/95 backdrop-blur-md border-t border-line-base">
          <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 rounded-full bg-warning animate-pulse" />
              <span className="text-sm text-text-body">Ada perubahan yang belum disimpan</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-lg"
                onClick={() => {
                  if (!initialState) {
                    return
                  }

                  setServices(initialState.services)
                  setLaundryName(initialState.laundryName)
                  setLaundryPhone(initialState.laundryPhone)
                  setLaundryAddress(initialState.laundryAddress)
                  setPublicWhatsapp(initialState.publicWhatsapp)
                  setOperatingHours(initialState.operatingHours)
                  setMessageTemplates(initialState.messageTemplates)
                  setHasChanges(false)
                }}
              >
                Batalkan
              </Button>
              <Button
                size="sm"
                className="rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-semibold"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Menyimpan...</>
                ) : (
                  <><Save className="h-3.5 w-3.5 mr-1.5" />Simpan</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
