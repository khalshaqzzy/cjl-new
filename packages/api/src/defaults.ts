import type { SettingsDocument } from "./types.js"

export const defaultSettings = (): SettingsDocument => ({
  _id: "app-settings",
  business: {
    laundryName: "CJ Laundry",
    laundryPhone: "+62 812-3456-7890",
    publicContactPhone: "+62 812-3456-7890",
    publicWhatsapp: "6281234567890",
    address: "Jl. Raya Sejahtera No. 123, Jakarta",
    operatingHours: "Senin - Minggu, 07:00 - 22:00"
  },
  services: [
    {
      serviceCode: "washer",
      displayName: "Washer",
      pricingModel: "fixed",
      price: 10000,
      isActive: true,
      publicDescription: "Mesin cuci kapasitas besar"
    },
    {
      serviceCode: "dryer",
      displayName: "Dryer",
      pricingModel: "fixed",
      price: 10000,
      isActive: true,
      publicDescription: "Pengering cepat dan efisien"
    },
    {
      serviceCode: "detergent",
      displayName: "Detergent",
      pricingModel: "fixed",
      price: 1000,
      isActive: true,
      publicDescription: "Detergen premium berkualitas"
    },
    {
      serviceCode: "softener",
      displayName: "Softener",
      pricingModel: "fixed",
      price: 1000,
      isActive: true,
      publicDescription: "Pelembut pakaian wangi tahan lama"
    },
    {
      serviceCode: "wash_dry_fold_package",
      displayName: "Paket Cuci Kering Lipat",
      pricingModel: "fixed",
      price: 35000,
      isActive: true,
      publicDescription: "Layanan lengkap cuci, kering, dan lipat"
    },
    {
      serviceCode: "ironing",
      displayName: "Setrika",
      pricingModel: "per_kg",
      price: 4500,
      isActive: true,
      publicDescription: "Setrika rapi profesional"
    }
  ],
  messageTemplates: {
    welcome: "Halo {{customerName}}, selamat datang di {{laundryName}}. Nomor terdaftar Anda {{customerPhone}}. Login portal menggunakan nomor HP + nama terdaftar.",
    orderConfirmed: "Halo {{customerName}}, order {{orderCode}} sudah dikonfirmasi pada {{createdAt}}. Poin diperoleh: {{earnedStamps}}, poin dipakai: {{redeemedPoints}}, saldo sekarang: {{currentPoints}}. Pantau status: {{statusUrl}}",
    orderDone: "Halo {{customerName}}, order {{orderCode}} yang masuk pada {{createdAt}} telah selesai pada {{completedAt}}.",
    orderVoidNotice: "Halo {{customerName}}, order {{orderCode}} dibatalkan. Alasan: {{reason}}.",
    accountInfo: "Halo {{customerName}}, data akun Anda diperbarui. Nomor login terbaru: {{customerPhone}}."
  },
  updatedAt: new Date().toISOString()
})
