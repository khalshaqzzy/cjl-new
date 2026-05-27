"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { AdminWhatsappContact, EmployeeLoginLinkStatus, ServiceSetting } from "@cjl/contracts"
import { AdminShell } from "@/components/admin/admin-shell"
import { CustomerLoginLinkSheet } from "@/components/admin/customer-login-link-sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
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
  QrCode,
  Save,
  Shirt,
  ShoppingBag,
  SprayCan,
  Star,
  Trash2,
  Waves,
  Wind,
  Droplets,
  KeyRound,
  LogOut,
  ShieldCheck,
  Unlink,
  UserCog,
} from "lucide-react"

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
}

export default function SettingsPage() {
  const router = useRouter()
  const [laundryName, setLaundryName] = useState("")
  const [laundryPhone, setLaundryPhone] = useState("")
  const [publicContactPhone, setPublicContactPhone] = useState("")
  const [publicWhatsapp, setPublicWhatsapp] = useState("")
  const [adminWhatsappContacts, setAdminWhatsappContacts] = useState<AdminWhatsappContact[]>([createContactDraft()])
  const [laundryAddress, setLaundryAddress] = useState("")
  const [operatingHours, setOperatingHours] = useState("")
  const [services, setServices] = useState<ServiceSetting[]>([])
  const [initialState, setInitialState] = useState<InitialState | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const [saveError, setSaveError] = useState("")
  const [saveSuccess, setSaveSuccess] = useState("")
  const [employeeExists, setEmployeeExists] = useState(false)
  const [employeeUsername, setEmployeeUsername] = useState("")
  const [employeePassword, setEmployeePassword] = useState("")
  const [employeeIsActive, setEmployeeIsActive] = useState(true)
  const [employeeLoginLink, setEmployeeLoginLink] = useState<EmployeeLoginLinkStatus>({
    exists: false,
    isActive: false,
  })
  const [employeeLoginUrl, setEmployeeLoginUrl] = useState("")
  const [isEmployeeQrSheetOpen, setIsEmployeeQrSheetOpen] = useState(false)
  const [isSavingEmployee, setIsSavingEmployee] = useState(false)
  const [isGeneratingEmployeeLoginLink, setIsGeneratingEmployeeLoginLink] = useState(false)
  const [isDisablingEmployeeLoginLink, setIsDisablingEmployeeLoginLink] = useState(false)
  const [employeeMessage, setEmployeeMessage] = useState("")
  const [employeeError, setEmployeeError] = useState("")
  const [isLoggingOutOtherSessions, setIsLoggingOutOtherSessions] = useState(false)

  useEffect(() => {
    adminApi.getSession()
      .then(async (session) => {
        if (session.role === "employee") {
          router.replace("/admin")
          return
        }

        const [settings, employee, employeeLoginLinkResponse] = await Promise.all([
          adminApi.getSettings(),
          adminApi.getEmployeeAccount(),
          adminApi.getEmployeeLoginLink(),
        ])

        setLaundryName(settings.business.laundryName)
        setLaundryPhone(settings.business.laundryPhone)
        setPublicContactPhone(settings.business.publicContactPhone)
        setPublicWhatsapp(settings.business.publicWhatsapp)
        setAdminWhatsappContacts(settings.business.adminWhatsappContacts)
        setLaundryAddress(settings.business.address)
        setOperatingHours(settings.business.operatingHours)
        setServices(settings.services)
        setInitialState({
          laundryName: settings.business.laundryName,
          laundryPhone: settings.business.laundryPhone,
          publicContactPhone: settings.business.publicContactPhone,
          publicWhatsapp: settings.business.publicWhatsapp,
          adminWhatsappContacts: settings.business.adminWhatsappContacts,
          laundryAddress: settings.business.address,
          operatingHours: settings.business.operatingHours,
          services: settings.services,
        })
        setEmployeeExists(employee.exists)
        setEmployeeUsername(employee.username)
        setEmployeeIsActive(employee.exists ? employee.isActive : true)
        setEmployeeLoginLink(employeeLoginLinkResponse.loginLink)
        setLoadError("")
      })
      .catch((error) => setLoadError(error instanceof Error ? error.message : "Gagal memuat pengaturan"))
      .finally(() => setIsLoading(false))
  }, [router])

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
      })

      setLaundryName(payload.business.laundryName)
      setLaundryPhone(payload.business.laundryPhone)
      setPublicContactPhone(payload.business.publicContactPhone)
      setPublicWhatsapp(payload.business.publicWhatsapp)
      setAdminWhatsappContacts(payload.business.adminWhatsappContacts)
      setLaundryAddress(payload.business.address)
      setOperatingHours(payload.business.operatingHours)
      setServices(payload.services)
      setInitialState({
        laundryName: payload.business.laundryName,
        laundryPhone: payload.business.laundryPhone,
        publicContactPhone: payload.business.publicContactPhone,
        publicWhatsapp: payload.business.publicWhatsapp,
        adminWhatsappContacts: payload.business.adminWhatsappContacts,
        laundryAddress: payload.business.address,
        operatingHours: payload.business.operatingHours,
        services: payload.services,
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
    setSaveError("")
    setSaveSuccess("")
    setHasChanges(false)
  }

  const handleSaveEmployee = async () => {
    if (!employeeUsername.trim()) {
      setEmployeeError("Username karyawan wajib diisi.")
      setEmployeeMessage("")
      return
    }

    if (!employeeExists && !employeePassword.trim()) {
      setEmployeeError("Password wajib diisi saat membuat akun karyawan.")
      setEmployeeMessage("")
      return
    }

    setIsSavingEmployee(true)
    setEmployeeError("")
    setEmployeeMessage("")
    try {
      const employee = await adminApi.updateEmployeeAccount({
        username: employeeUsername.trim(),
        password: employeePassword.trim() || undefined,
        isActive: employeeIsActive,
      })
      setEmployeeExists(employee.exists)
      setEmployeeUsername(employee.username)
      setEmployeePassword("")
      setEmployeeIsActive(employee.isActive)
      const employeeLoginLinkResponse = await adminApi.getEmployeeLoginLink()
      setEmployeeLoginLink(employeeLoginLinkResponse.loginLink)
      if (!employeeLoginLinkResponse.loginLink.isActive) {
        setEmployeeLoginUrl("")
      }
      setEmployeeMessage("Akun karyawan berhasil disimpan.")
    } catch (error) {
      setEmployeeError(error instanceof Error ? error.message : "Gagal menyimpan akun karyawan")
    } finally {
      setIsSavingEmployee(false)
    }
  }

  const handleGenerateEmployeeLoginLink = async () => {
    setIsGeneratingEmployeeLoginLink(true)
    setEmployeeError("")
    setEmployeeMessage("")

    try {
      const response = await adminApi.generateEmployeeLoginLink()
      setEmployeeLoginLink(response.loginLink)
      setEmployeeLoginUrl(response.reusableLogin?.url ?? "")
      setIsEmployeeQrSheetOpen(Boolean(response.reusableLogin?.url))
      setEmployeeMessage("QR login karyawan berhasil dibuat.")
    } catch (error) {
      setEmployeeError(error instanceof Error ? error.message : "Gagal membuat QR login karyawan")
    } finally {
      setIsGeneratingEmployeeLoginLink(false)
    }
  }

  const handleDisableEmployeeLoginLink = async () => {
    setIsDisablingEmployeeLoginLink(true)
    setEmployeeError("")
    setEmployeeMessage("")

    try {
      const response = await adminApi.disableEmployeeLoginLink()
      setEmployeeLoginLink(response.loginLink)
      setEmployeeLoginUrl("")
      setIsEmployeeQrSheetOpen(false)
      setEmployeeMessage("Link QR login karyawan berhasil dinonaktifkan.")
    } catch (error) {
      setEmployeeError(error instanceof Error ? error.message : "Gagal menonaktifkan QR login karyawan")
    } finally {
      setIsDisablingEmployeeLoginLink(false)
    }
  }

  const handleLogoutOtherSessions = async () => {
    setIsLoggingOutOtherSessions(true)
    setEmployeeError("")
    setEmployeeMessage("")
    try {
      await adminApi.logoutOtherSessions()
      setEmployeeMessage("Semua sesi lain untuk akun ini berhasil dikeluarkan.")
    } catch (error) {
      setEmployeeError(error instanceof Error ? error.message : "Gagal mengeluarkan sesi lain")
    } finally {
      setIsLoggingOutOtherSessions(false)
    }
  }

  return (
    <AdminShell title="Pengaturan" subtitle="Profil bisnis, nomor admin, dan harga layanan">
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

        {(employeeError || employeeMessage) && (
          <div
            className={cn(
              "rounded-xl border px-4 py-3 text-sm",
              employeeError
                ? "border-danger/20 bg-danger-bg text-danger"
                : "border-success/20 bg-success-bg text-success"
            )}
          >
            {employeeError || employeeMessage}
          </div>
        )}

        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b border-line-base pb-1">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-info/10">
              <UserCog className="h-3.5 w-3.5 text-info" />
            </div>
            <h2 className="text-sm font-semibold text-text-strong">Akun Karyawan</h2>
          </div>

          <Card className="rounded-xl border-line-base bg-bg-surface shadow-card">
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-text-strong">
                    {employeeExists ? "Akun karyawan tersedia" : "Akun karyawan belum dibuat"}
                  </p>
                  <p className="mt-0.5 text-xs text-text-muted">
                    Maksimal satu akun karyawan untuk akses operasional tanpa Settings dan Kontrol Mesin.
                  </p>
                </div>
                <Badge className={cn("w-fit rounded-full border-0 px-2.5 py-0.5 text-xs", employeeIsActive && employeeExists ? "bg-success-bg text-success" : "bg-bg-subtle text-text-muted")}>
                  {employeeExists ? employeeIsActive ? "Aktif" : "Nonaktif" : "Belum setup"}
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">Username</label>
                  <Input
                    value={employeeUsername}
                    onChange={(event) => {
                      setEmployeeUsername(event.target.value)
                      setEmployeeError("")
                      setEmployeeMessage("")
                    }}
                    placeholder="username karyawan"
                    className="h-11 rounded-lg border-line-base"
                    data-testid="settings-employee-username"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-text-muted">
                    {employeeExists ? "Password baru (opsional)" : "Password"}
                  </label>
                  <Input
                    type="password"
                    value={employeePassword}
                    onChange={(event) => {
                      setEmployeePassword(event.target.value)
                      setEmployeeError("")
                      setEmployeeMessage("")
                    }}
                    placeholder={employeeExists ? "Kosongkan jika tidak diganti" : "password karyawan"}
                    className="h-11 rounded-lg border-line-base"
                    data-testid="settings-employee-password"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line-base bg-bg-subtle px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white">
                    <ShieldCheck className="h-4 w-4 text-rose-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-text-body">Aktifkan akun karyawan</p>
                    <p className="text-xs text-text-muted">Nonaktif akan menolak login dan mencabut sesi karyawan.</p>
                  </div>
                </div>
                <Switch
                  checked={employeeIsActive}
                  onCheckedChange={(checked) => {
                    setEmployeeIsActive(checked)
                    setEmployeeError("")
                    setEmployeeMessage("")
                  }}
                  data-testid="settings-employee-active"
                />
              </div>

              <div className="space-y-3 rounded-xl border border-line-base bg-bg-subtle px-4 py-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                      <QrCode className="h-4 w-4 text-rose-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-text-body">QR login karyawan</p>
                      <p className="mt-0.5 text-xs leading-relaxed text-text-muted">
                        Link bisa dipakai berkali-kali sampai dinonaktifkan, akun nonaktif, atau username/password diubah.
                      </p>
                      {employeeLoginLink.isActive && employeeLoginLink.tokenLast4 ? (
                        <p className="mt-2 text-xs text-text-muted">
                          Token aktif berakhir <span className="font-semibold text-text-body">{employeeLoginLink.tokenLast4}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      "w-fit shrink-0 rounded-full border-0 px-2.5 py-0.5 text-xs",
                      employeeLoginLink.isActive
                        ? "bg-success-bg text-success"
                        : "bg-bg-surface text-text-muted"
                    )}
                    data-testid="settings-employee-login-link-status"
                  >
                    {employeeLoginLink.isActive ? "QR aktif" : "QR nonaktif"}
                  </Badge>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-lg bg-white"
                    onClick={handleGenerateEmployeeLoginLink}
                    disabled={!employeeExists || !employeeIsActive || isGeneratingEmployeeLoginLink}
                    data-testid="settings-employee-login-link-generate"
                  >
                    {isGeneratingEmployeeLoginLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                    Generate QR Login
                  </Button>
                  {employeeLoginLink.isActive ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="rounded-lg bg-white text-danger hover:text-danger"
                      onClick={handleDisableEmployeeLoginLink}
                      disabled={isDisablingEmployeeLoginLink}
                      data-testid="settings-employee-login-link-disable"
                    >
                      {isDisablingEmployeeLoginLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Unlink className="mr-2 h-4 w-4" />}
                      Nonaktifkan Link
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  className="rounded-lg bg-rose-600 font-semibold text-white hover:bg-rose-500"
                  onClick={handleSaveEmployee}
                  disabled={isSavingEmployee}
                  data-testid="settings-employee-save"
                >
                  {isSavingEmployee ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
                  Simpan Akun Karyawan
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-lg"
                  onClick={handleLogoutOtherSessions}
                  disabled={isLoggingOutOtherSessions}
                  data-testid="settings-logout-other-sessions"
                >
                  {isLoggingOutOtherSessions ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogOut className="mr-2 h-4 w-4" />}
                  Log out from all devices
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

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
                { label: "Paket Cuci Kering", desc: "1 stamp untuk setiap unit paket cuci kering", value: "1", color: "bg-rose-50 text-rose-600" },
                { label: "Redeem 1 Diskon Reward", desc: "Poin yang dibutuhkan untuk diskon Rp 10.000 pada Washer atau paket. Setiap redeem mengurangi 1 kesempatan poin.", value: "10", color: "bg-success/10 text-success" },
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

      <CustomerLoginLinkSheet
        open={isEmployeeQrSheetOpen}
        onOpenChange={setIsEmployeeQrSheetOpen}
        loginUrl={employeeLoginUrl}
        title="QR Login Karyawan"
        description="Karyawan bisa scan QR ini untuk langsung masuk ke admin dengan akses operasional."
        linkLabel="Link Login Karyawan"
        notice="Link ini reusable untuk banyak login. Membuka link di perangkat owner akan mengganti sesi aktif menjadi sesi karyawan."
        qrAlt="QR login karyawan"
      />
    </AdminShell>
  )
}
