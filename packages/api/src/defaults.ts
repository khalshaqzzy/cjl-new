import type { SettingsDocument } from "./types.js"

export const legacyDefaultMessageTemplates = {
  welcome: "Halo {{customerName}}, selamat datang di {{laundryName}}. Nomor terdaftar Anda {{customerPhone}}. Login portal menggunakan nomor HP + nama terdaftar.",
  orderConfirmed: "Halo {{customerName}}, order {{orderCode}} sudah dikonfirmasi pada {{createdAt}}. Poin diperoleh: {{earnedStamps}}, poin dipakai: {{redeemedPoints}}, saldo sekarang: {{currentPoints}}. Pantau status: {{statusUrl}}",
  orderDone: "Halo {{customerName}}, order {{orderCode}} yang masuk pada {{createdAt}} telah selesai pada {{completedAt}}.",
  orderVoidNotice: "Halo {{customerName}}, order {{orderCode}} dibatalkan. Alasan: {{reason}}.",
  accountInfo: "Halo {{customerName}}, data akun Anda diperbarui. Nomor login terbaru: {{customerPhone}}."
} as const

export const defaultMessageTemplates = {
  welcome: `Halo {{customerName}}!

Selamat datang di CJ Laundry. Akun pelanggan Anda sudah berhasil terdaftar.

Website CJ Laundry:
https://cjlaundry.site

Di website tersebut Anda bisa:
- login ke customer portal
- cek status laundry
- lihat riwayat order
- cek poin / stamp
- lihat leaderboard pelanggan

Gunakan data berikut untuk login:
Nomor HP: {{customerPhone}}
Nama: {{customerName}}

Login otomatis sekali pakai:
{{autoLoginUrl}}

Simpan pesan ini ya. Terima kasih sudah mempercayakan cucian Anda ke CJ Laundry.`,
  orderConfirmed: `Halo {{customerName}}!

Pesanan Anda dengan kode {{orderCode}} sudah kami konfirmasi pada {{createdAt}}.

Detail order:
- Berat: {{weightKgLabel}}
- Layanan: {{serviceSummary}}
- Total: {{totalLabel}}

Poin loyalty:
- Poin diperoleh: {{earnedStamps}}
- Poin digunakan: {{redeemedPoints}}
- Saldo poin sekarang: {{currentPoints}}

Pantau status order Anda di:
{{statusUrl}}

Receipt ringkas juga kami kirim bersama pesan ini. Terima kasih sudah order di CJ Laundry.`,
  orderDone: `Halo {{customerName}}!

Pesanan Anda dengan kode {{orderCode}} yang masuk pada {{createdAt}} telah selesai pada {{completedAt}}.

Laundry Anda sudah dapat diambil.

Terima kasih sudah menggunakan layanan CJ Laundry. Kami tunggu order berikutnya ya.`,
  orderVoidNotice: "Halo {{customerName}}, order {{orderCode}} dibatalkan. Alasan: {{reason}}.",
  accountInfo: `Halo {{customerName}}!

Data akun CJ Laundry Anda sudah diperbarui.

Nomor login terbaru:
{{customerPhone}}

Silakan gunakan nomor tersebut bersama nama terdaftar Anda saat login ke portal customer.`
} as const

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
      serviceCode: "ironing",
      displayName: "Setrika",
      pricingModel: "per_kg",
      price: 4500,
      isActive: true,
      publicDescription: "Setrika rapi profesional"
    }
  ],
  messageTemplates: defaultMessageTemplates,
  updatedAt: new Date().toISOString()
})
