import type { NotificationEventType } from "@cjl/contracts"
import { compileTemplate } from "./notifications.js"

type TemplateCategory = "MARKETING" | "UTILITY"

export type ApprovedWhatsappTemplate = {
  eventType: NotificationEventType
  templateName: string
  language: "id"
  category: TemplateCategory
  requiresDocumentHeader: boolean
  fallbackText: string
}

export type TemplateParameterMap = Record<string, string>

export const approvedWhatsappTemplates: Record<NotificationEventType, ApprovedWhatsappTemplate> = {
  welcome: {
    eventType: "welcome",
    templateName: "cjl_welcome_v1",
    language: "id",
    category: "MARKETING",
    requiresDocumentHeader: false,
    fallbackText: `Halo {{customer_name}}!

Selamat datang di CJ Laundry. Nomor pelanggan Anda sudah berhasil terdaftar.

Website CJ Laundry:
https://cjlaundry.com

Di website tersebut Anda bisa:
- cek status laundry
- lihat riwayat order
- cek poin / stamp
- lihat leaderboard pelanggan

Nomor terdaftar:
{{registered_phone}}

Simpan pesan ini ya. Terima kasih sudah mempercayakan cucian Anda ke CJ Laundry.`,
  },
  order_confirmed: {
    eventType: "order_confirmed",
    templateName: "cjl_order_confirmed_v1",
    language: "id",
    category: "UTILITY",
    requiresDocumentHeader: true,
    fallbackText: `Halo {{customer_name}}!

Pesanan Anda dengan kode {{order_code}} sudah kami konfirmasi pada {{created_at}}.

Detail order:
- Berat: {{weight_kg_label}}
- Layanan: {{service_summary}}
- Total: {{total_label}}

Poin loyalty:
- Poin diperoleh: {{earned_stamps}}
- Poin digunakan: {{redeemed_points}}
- Saldo poin sekarang: {{current_points}}

Pantau status order Anda di:
{{status_url}}

Receipt ringkas ada pada dokumen terlampir. Terima kasih sudah order di CJ Laundry.`,
  },
  order_done: {
    eventType: "order_done",
    templateName: "cjl_order_done_v1",
    language: "id",
    category: "UTILITY",
    requiresDocumentHeader: false,
    fallbackText: `Halo {{customer_name}}!

Pesanan Anda dengan kode {{order_code}} yang masuk pada {{created_at}} telah selesai pada {{completed_at}}.

Laundry Anda sudah dapat diambil.

Terima kasih sudah menggunakan layanan CJ Laundry. Kami tunggu order berikutnya ya.`,
  },
  order_void_notice: {
    eventType: "order_void_notice",
    templateName: "cjl_order_void_notice_v1",
    language: "id",
    category: "UTILITY",
    requiresDocumentHeader: false,
    fallbackText: `Halo pelanggan CJ Laundry.

Order atas nama {{customer_name}} dengan kode {{order_code}} dibatalkan.

Alasan pembatalan:
{{reason}}

Silakan hubungi CJ Laundry bila Anda memerlukan bantuan lebih lanjut.`,
  },
  account_info: {
    eventType: "account_info",
    templateName: "cjl_account_info_v1",
    language: "id",
    category: "UTILITY",
    requiresDocumentHeader: false,
    fallbackText: `Halo {{customer_name}}!

Data akun CJ Laundry Anda sudah diperbarui.

Nomor pelanggan terbaru:
{{customer_phone}}

Silakan simpan nomor terbaru ini untuk kebutuhan komunikasi dengan CJ Laundry.`,
  },
}

export const buildTemplateParams = (
  eventType: NotificationEventType,
  params: TemplateParameterMap
) => {
  const template = approvedWhatsappTemplates[eventType]
  return {
    template,
    templateParams: params,
    preparedMessage: compileTemplate(template.fallbackText, params),
  }
}
