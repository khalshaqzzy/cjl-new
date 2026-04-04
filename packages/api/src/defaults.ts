import type { SettingsDocument } from "./types.js"

export const defaultSettings = (): SettingsDocument => ({
  _id: "app-settings",
  business: {
    laundryName: "CJ Laundry",
    laundryPhone: "+62 812-3456-7890",
    publicContactPhone: "+62 812-3456-7890",
    publicWhatsapp: "6281234567890",
    adminWhatsappContacts: [
      {
        id: "admin-contact-1",
        phone: "081234567890",
        isPrimary: true,
      }
    ],
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
      serviceCode: "wash_dry_package",
      displayName: "Paket Cuci Kering",
      pricingModel: "fixed",
      price: 25000,
      isActive: true,
    },
    {
      serviceCode: "ironing",
      displayName: "Setrika",
      pricingModel: "per_kg",
      price: 4500,
      isActive: true,
      publicDescription: "Setrika rapi profesional"
    },
    {
      serviceCode: "ironing_only",
      displayName: "Setrika Saja",
      pricingModel: "per_kg",
      price: 5000,
      isActive: true,
    },
    {
      serviceCode: "laundry_plastic",
      displayName: "Plastik Laundry",
      pricingModel: "fixed",
      price: 2000,
      isActive: true,
    },
    {
      serviceCode: "laundry_plastic_large",
      displayName: "Plastik Laundry Besar",
      pricingModel: "fixed",
      price: 4000,
      isActive: true,
    },
    {
      serviceCode: "laundry_hanger",
      displayName: "Gantungan Laundry",
      pricingModel: "fixed",
      price: 2000,
      isActive: true,
    }
  ],
  updatedAt: new Date().toISOString()
})
