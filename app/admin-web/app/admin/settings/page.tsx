"use client"

import { useEffect, useState } from "react"
import type { AdminWhatsappContact, ServiceSetting } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { adminApi } from "@/lib/api"
import {
  Building2,
  DollarSign,
  Info,
  Loader2,
  MessageCircle,
  Package,
  Phone,
  Plus,
  Save,
  Shirt,
  ShoppingBag,
  Sparkles,
  SprayCan,
  Star,
  Trash2,
  Waves,
  Wind,
  Droplets,
} from "lucide-react"

const serviceIcons: Record<string, typeof Shirt> = {
  washer: Waves,
  dryer: Wind,
  detergent: Droplets,
  softener: SprayCan,
  wash_dry_fold_package: Package,
  ironing: Shirt,
  ironing_only: Shirt,
  laundry_plastic: ShoppingBag,
}

const createContactDraft = (): AdminWhatsappContact => ({
  id: crypto.randomUUID(),
  phone: "",
  isPrimary: false,
})

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
        "rounded-xl border bg-bg-surface shadow-card transition-all",
        service.isActive ? "border-line-base" : "border-line-base/40 opacity-55"
      )}
    >
      <CardContent className="p-4">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", service.isActive ? "bg-rose-50" : "bg-bg-subtle")}>
              <Icon className={cn("h-4 w-4", service.isActive ? "text-rose-600" : "text-text-muted")} />
            </div>
            <div>
              <p className="text-sm font-semibold text-text-strong">{service.displayName}</p>
              <Badge variant="secondary" className="mt-1 rounded-md border-0 bg-bg-subtle px-1.5 text-[10px]">
                {service.pricingModel === "per_kg" ? "per kg" : "per unit"}
              </Badge>
            </div>
          </div>
          <Switch checked={service.isActive} onCheckedChange={onActiveChange} />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs text-text-muted">Harga</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-text-muted">Rp</span>
            <Input
              type="number"
              value={service.price}
              onChange={(event) => onPriceChange(parseInt(event.target.value, 10) || 0)}
              className="h-10 rounded-lg border-line-base pl-9 text-right text-sm font-semibold"
              disabled={!service.isActive}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

type InitialState = {
  laundryName: string
  laundryPhone: string
  publicContactPhone: string
  publicWhatsapp: string
  adminWhatsappContacts: AdminWhatsappContact[]
  laundryAddress: string
  operatingHours: string
  services: ServiceSetting[]
  messageTemplates: {
    welcome: string
    orderConfirmed: string
    orderDone: string
    orderVoidNotice: string
    accountInfo: string
  }
}

export default function SettingsPage() {
  const [laundryName, setLaundryName] = useState("")
  const [laundryPhone, setLaundryPhone] = useState("")
  const [publicContactPhone, setPublicContactPhone] = useState("")
  const [publicWhatsapp, setPublicWhatsapp] = useState("")
  const [adminWhatsappContacts, setAdminWhatsappContacts] = useState<AdminWhatsappContact[]>([createContactDraft()])
  const [laundryAddress, setLaundryAddress] = useState("")
  const [operatingHours, setOperatingHours] = useState("")
  const [services, setServices] = useState<ServiceSetting[]>([])
  const [messageTemplates, setMessageTemplates] = useState({
    welcome: "",
    orderConfirmed: "",
    orderDone: "",
    orderVoidNotice: "",
    accountInfo: "",
  })
  const [initialState, setInitialState] = useState<InitialState | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saveSuccess, setSaveSuccess] = useState("")

  useEffect(() => {
    adminApi.getSettings()
      .then((payload) => {
        setLaundryName(payload.business.laundryName)
        setLaundryPhone(payload.business.laundryPhone)
        setPublicContactPhone(payload.business.publicContactPhone)
        setPublicWhatsapp(payload.business.publicWhatsapp)
        setAdminWhatsappContacts(payload.business.adminWhatsappContacts)
        setLaundryAddress(payload.business.address)
        setOperatingHours(payload.business.operatingHours)
        setServices(payload.services)
        setMessageTemplates(payload.messageTemplates)
        setInitialState({
          laundryName: payload.business.laundryName,
          laundryPhone: payload.business.laundryPhone,
          publicContactPhone: payload.business.publicContactPhone,
          publicWhatsapp: payload.business.publicWhatsapp,
          adminWhatsappContacts: payload.business.adminWhatsappContacts,
          laundryAddress: payload.business.address,
          operatingHours: payload.business.operatingHours,
          services: payload.services,
          messageTemplates: payload.messageTemplates,
        })
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat pengaturan"))
      .finally(() => setIsLoading(false))
  }, [])

  const markDirty = () => {
    setHasChanges(true)
    setSaveError("")
    setSaveSuccess("")
  }

  const handlePriceChange = (serviceCode: string, price: number) => {
    setServices((current) => current.map((service) => (
      service.serviceCode === serviceCode ? { ...service, price } : service
    )))
    markDirty()
  }

  const handleActiveChange = (serviceCode: string, isActive: boolean) => {
    setServices((current) => current.map((service) => (
      service.serviceCode === serviceCode ? { ...service, isActive } : service
    )))
    markDirty()
  }

  const handleContactChange = (contactId: string, phone: string) => {
    setAdminWhatsappContacts((current) => current.map((contact) => (
      contact.id === contactId ? { ...contact, phone } : contact
    )))
    markDirty()
  }

  const handlePrimaryChange = (contactId: string) => {
    setAdminWhatsappContacts((current) => current.map((contact) => ({
      ...contact,
      isPrimary: contact.id === contactId,
    })))
    markDirty()
  }

  const handleAddContact = () => {
    setAdminWhatsappContacts((current) => {
      const next = [...current, createContactDraft()]
      if (!next.some((contact) => contact.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true }
      }
      return next
    })
    markDirty()
  }

  const handleRemoveContact = (contactId: string) => {
    setAdminWhatsappContacts((current) => {
      const next = current.filter((contact) => contact.id !== contactId)
      if (next.length === 0) {
        return [{ ...createContactDraft(), isPrimary: true }]
      }
      if (!next.some((contact) => contact.isPrimary)) {
        next[0] = { ...next[0], isPrimary: true }
      }
      return next
    })
    markDirty()
  }

  const handleSave = async () => {
    const cleanedContacts = adminWhatsappContacts
      .map((contact) => ({ ...contact, phone: contact.phone.trim() }))
      .filter((contact) => contact.phone)

    if (
      !laundryName.trim() ||
      !laundryPhone.trim() ||
      !publicContactPhone.trim() ||
      !publicWhatsapp.trim() ||
      !operatingHours.trim() ||
      !laundryAddress.trim()
    ) {
      setSaveError("Lengkapi seluruh profil bisnis sebelum menyimpan.")
      setSaveSuccess("")
      return
    }

    if (cleanedContacts.length === 0) {
      setSaveError("Tambahkan minimal satu nomor WhatsApp admin.")
      setSaveSuccess("")
      return
    }

    setIsSaving(true)
    setSaveError("")
    setSaveSuccess("")

    try {
      const payload = await adminApi.updateSettings({
        business: {
          laundryName: laundryName.trim(),
          laundryPhone: laundryPhone.trim(),
          publicContactPhone: publicContactPhone.trim(),
          publicWhatsapp: publicWhatsapp.trim(),
          adminWhatsappContacts: cleanedContacts.map((contact, index) => ({
            ...contact,
            isPrimary: cleanedContacts.some((item) => item.isPrimary)
              ? contact.isPrimary
              : index === 0,
          })),
          address: laundryAddress.trim(),
          operatingHours: operatingHours.trim(),
        },
        services,
        messageTemplates,
      })

      setLaundryName(payload.business.laundryName)
      setLaundryPhone(payload.business.laundryPhone)
      setPublicContactPhone(payload.business.publicContactPhone)
      setPublicWhatsapp(payload.business.publicWhatsapp)
      setAdminWhatsappContacts(payload.business.adminWhatsappContacts)
      setLaundryAddress(payload.business.address)
      setOperatingHours(payload.business.operatingHours)
      setServices(payload.services)
      setMessageTemplates(payload.messageTemplates)
      setInitialState({
        laundryName: payload.business.laundryName,
        laundryPhone: payload.business.laundryPhone,
        publicContactPhone: payload.business.publicContactPhone,
        publicWhatsapp: payload.business.publicWhatsapp,
        adminWhatsappContacts: payload.business.adminWhatsappContacts,
        laundryAddress: payload.business.address,
        operatingHours: payload.business.operatingHours,
        services: payload.services,
        messageTemplates: payload.messageTemplates,
      })
      setHasChanges(false)
      setSaveSuccess("Pengaturan berhasil disimpan.")
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Gagal menyimpan pengaturan")
    } finally {
      setIsSaving(false)
    }
  }

  const resetForm = () => {
    if (!initialState) {
      return
    }

    setLaundryName(initialState.laundryName)
    setLaundryPhone(initialState.laundryPhone)
    setPublicContactPhone(initialState.publicContactPhone)
    setPublicWhatsapp(initialState.publicWhatsapp)
    setAdminWhatsappContacts(initialState.adminWhatsappContacts)
    setLaundryAddress(initialState.laundryAddress)
    setOperatingHours(initialState.operatingHours)
    setServices(initialState.services)
    setMessageTemplates(initialState.messageTemplates)
    setSaveError("")
    setSaveSuccess("")
    setHasChanges(false)
  }

  return (
    <AdminShell title="Pengaturan" subtitle="Profil bisnis, nomor admin, dan template pesan">
      <div className="space-y-8 px-4 py-6 pb-32 lg:px-6">
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

        {saveError && (
          <div className="rounded-xl border border-danger/20 bg-danger-bg px-4 py-3 text-sm text-danger">
            {saveError}
          </div>
        )}

        {saveSuccess && (
          <div className="rounded-xl border border-success/20 bg-success-bg px-4 py-3 text-sm text-success">
            {saveSuccess}
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line-base pb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <Building2 className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <h2 className="text-sm font-semibold text-text-strong">Profil Bisnis</h2>
          </div>

          <Card className="rounded-xl border-line-base bg-bg-surface shadow-card">
            <CardContent className="space-y-4 p-5">
              {[
                { label: "Nama Laundry", value: laundryName, setter: setLaundryName, placeholder: "Nama laundry", type: "text" },
                { label: "Nomor Telepon Laundry", value: laundryPhone, setter: setLaundryPhone, placeholder: "08xxxxxxxxxx", type: "tel" },
                { label: "Kontak Publik Umum", value: publicContactPhone, setter: setPublicContactPhone, placeholder: "08xxxxxxxxxx", type: "tel" },
                { label: "Nomor Gateway WhatsApp", value: publicWhatsapp, setter: setPublicWhatsapp, placeholder: "08xxxxxxxxxx", type: "text" },
                { label: "Alamat", value: laundryAddress, setter: setLaundryAddress, placeholder: "Alamat lengkap", type: "text" },
                { label: "Jam Operasional", value: operatingHours, setter: setOperatingHours, placeholder: "Senin - Minggu, 07:00 - 22:00", type: "text" },
              ].map((field) => (
                <div key={field.label} className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">{field.label}</label>
                  <Input
                    type={field.type}
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(event) => {
                      field.setter(event.target.value)
                      markDirty()
                    }}
                    className="h-11 rounded-lg border-line-base"
                  />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line-base pb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <MessageCircle className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <h2 className="text-sm font-semibold text-text-strong">Nomor Admin WhatsApp</h2>
          </div>

          <Card className="rounded-xl border-line-base bg-bg-surface shadow-card">
            <CardContent className="space-y-4 p-5">
              <div className="rounded-xl border border-info/20 bg-info/5 px-4 py-3 text-xs leading-relaxed text-info">
                Nomor primary dipakai untuk landing page, direct status, dan contact utama customer. Semua nomor aktif akan muncul pada popup "Chat Admin" di portal customer. Semua field nomor boleh diisi dengan format `08...`.
              </div>

              <div className="space-y-3">
                {adminWhatsappContacts.map((contact, index) => (
                  <div
                    key={contact.id}
                    className="rounded-2xl border border-line-base bg-bg-subtle p-4"
                    data-testid={`settings-admin-contact-${index}`}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm">
                          <Phone className="h-4 w-4 text-rose-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-text-strong">Admin {index + 1}</p>
                          <p className="text-xs text-text-muted">Nomor customer-facing</p>
                        </div>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg px-2 text-text-muted hover:text-danger"
                        disabled={adminWhatsappContacts.length === 1}
                        onClick={() => handleRemoveContact(contact.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-text-muted">Nomor WhatsApp</label>
                        <Input
                          type="tel"
                          value={contact.phone}
                          placeholder="08xx-xxxx-xxxx"
                          onChange={(event) => handleContactChange(contact.id, event.target.value)}
                          className="h-11 rounded-lg border-line-base bg-white"
                          data-testid={`settings-admin-contact-phone-${index}`}
                        />
                      </div>

                      <div className="flex items-center justify-between rounded-xl border border-line-base bg-white px-3 py-2.5">
                        <div>
                          <p className="text-sm font-medium text-text-body">Jadikan nomor primary</p>
                          <p className="text-xs text-text-muted">Dipakai sebagai kontak utama publik</p>
                        </div>
                        <Switch
                          checked={contact.isPrimary}
                          onCheckedChange={() => handlePrimaryChange(contact.id)}
                          data-testid={`settings-admin-contact-primary-${index}`}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full rounded-xl border-dashed"
                onClick={handleAddContact}
                data-testid="settings-add-admin-contact"
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Nomor Admin
              </Button>
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line-base pb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <Sparkles className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <h2 className="text-sm font-semibold text-text-strong">Blok Pesan WhatsApp</h2>
          </div>

          <Card className="rounded-xl border-line-base bg-bg-surface shadow-card">
            <CardContent className="space-y-4 p-5">
              {[
                { key: "welcome", label: "Welcome", helper: "Terkirim saat pelanggan baru dibuat. Gunakan token {{autoLoginUrl}} untuk link login sekali pakai." },
                { key: "orderConfirmed", label: "Order Dikonfirmasi", helper: "Gunakan {{orderCode}}, {{createdAt}}, {{weightKgLabel}}, {{serviceSummary}}, {{totalLabel}}, {{earnedStamps}}, {{redeemedPoints}}, {{currentPoints}}, {{statusUrl}}." },
                { key: "orderDone", label: "Order Selesai", helper: "Gunakan {{orderCode}}, {{createdAt}}, {{completedAt}}." },
                { key: "orderVoidNotice", label: "Order Dibatalkan", helper: "Gunakan {{orderCode}} dan {{reason}} untuk koreksi operasional." },
                { key: "accountInfo", label: "Info Akun", helper: "Terkirim setelah nama/nomor pelanggan diperbarui." },
              ].map(({ key, label, helper }) => (
                <div key={key} className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">{label}</label>
                  <Textarea
                    value={messageTemplates[key as keyof typeof messageTemplates]}
                    onChange={(event) => {
                      setMessageTemplates((current) => ({
                        ...current,
                        [key]: event.target.value,
                      }))
                      markDirty()
                    }}
                    rows={4}
                    className="resize-none rounded-lg border-line-base text-sm"
                  />
                  <p className="text-xs text-text-muted">{helper}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line-base pb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50">
              <DollarSign className="h-3.5 w-3.5 text-rose-600" />
            </div>
            <h2 className="text-sm font-semibold text-text-strong">Harga Layanan</h2>
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

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line-base pb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-warning/10">
              <Star className="h-3.5 w-3.5 text-warning" />
            </div>
            <h2 className="text-sm font-semibold text-text-strong">Sistem Loyalitas</h2>
          </div>

          <Card className="rounded-xl border-line-base bg-bg-surface shadow-card">
            <CardContent className="divide-y divide-line-base p-5">
              {[
                { label: "Washer + Dryer berpasangan", desc: "1 stamp untuk setiap pasangan Washer dan Dryer yang cocok pada order", value: "1", color: "bg-rose-50 text-rose-600" },
                { label: "Paket Cuci Kering Lipat", desc: "1 stamp untuk setiap unit paket", value: "1", color: "bg-rose-50 text-rose-600" },
                { label: "Redeem 1 Washer Gratis", desc: "Poin yang dibutuhkan untuk 1 Washer gratis", value: "10", color: "bg-success/10 text-success" },
                { label: "Penyesuaian Manual", desc: "Menambah saldo poin pelanggan tanpa memengaruhi leaderboard", value: "0", color: "bg-info/10 text-info" },
              ].map(({ label, desc, value, color }) => (
                <div key={label} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                  <div className="flex-1 pr-4">
                    <p className="text-sm font-semibold text-text-strong">{label}</p>
                    <p className="mt-0.5 text-xs text-text-muted">{desc}</p>
                  </div>
                  <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold", color)}>
                    {value}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="flex items-start gap-2.5 rounded-lg border border-info/20 bg-info/5 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-info" />
            <p className="text-xs leading-relaxed text-info">
              Aturan sistem loyalitas tetap dikunci agar histori order dan leaderboard tidak kehilangan konsistensi.
            </p>
          </div>
        </section>
      </div>

      {hasChanges && (
        <div className="fixed bottom-16 left-0 right-0 z-40 border-t border-line-base bg-white/95 px-4 py-3 backdrop-blur-md lg:bottom-0 lg:left-64">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-warning" />
              <span className="text-sm text-text-body">Ada perubahan yang belum disimpan</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="rounded-lg" onClick={resetForm}>
                Batalkan
              </Button>
              <Button
                size="sm"
                className="rounded-lg bg-rose-600 font-semibold text-white hover:bg-rose-500"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="mr-1.5 h-3.5 w-3.5" />
                    Simpan
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AdminShell>
  )
}
