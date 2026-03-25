import sharp from "sharp"
import type { ReceiptRenderModel } from "./receipts.js"

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

const renderItems = (receipt: ReceiptRenderModel) =>
  receipt.items
    .map((item, index) => {
      const rowY = 446 + index * 112
      const fill = index % 2 === 0 ? "#ffffff" : "#f8fafc"

      return `
        <rect x="92" y="${rowY}" width="896" height="92" rx="24" fill="${fill}" />
        <text x="128" y="${rowY + 38}" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#111827">${escapeHtml(item.serviceLabel)}</text>
        <text x="128" y="${rowY + 68}" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#6b7280">${escapeHtml(`${item.quantityLabel} • ${item.unitPriceLabel}`)}</text>
        <text x="940" y="${rowY + 54}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" text-anchor="end" fill="#111827">${escapeHtml(item.lineTotalLabel)}</text>
      `
    })
    .join("")

const renderContactLines = (receipt: ReceiptRenderModel, startY: number) => {
  const lines = [
    `Telepon: ${receipt.laundryPhone}`,
    ...(receipt.adminWhatsapp && receipt.adminWhatsapp !== receipt.laundryPhone
      ? [`WhatsApp: ${receipt.adminWhatsapp}`]
      : []),
    receipt.address,
    ...(receipt.operatingHours ? [receipt.operatingHours] : []),
  ]

  return lines
    .map(
      (line, index) => `
        <text x="126" y="${startY + index * 34}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#f9fafb">${escapeHtml(line)}</text>
      `
    )
    .join("")
}

export const renderReceiptImage = async (receipt: ReceiptRenderModel) => {
  const lineItemsHeight = Math.max(receipt.items.length, 1) * 112
  const contactLines = [
    `Telepon: ${receipt.laundryPhone}`,
    ...(receipt.adminWhatsapp && receipt.adminWhatsapp !== receipt.laundryPhone
      ? [`WhatsApp: ${receipt.adminWhatsapp}`]
      : []),
    receipt.address,
    ...(receipt.operatingHours ? [receipt.operatingHours] : []),
  ]
  const contactHeight = 128 + (contactLines.length - 1) * 34
  const height = 1268 + lineItemsHeight + contactHeight
  const summaryY = 446 + lineItemsHeight + 20
  const loyaltyY = summaryY + 182
  const contactY = loyaltyY + 178

  const svg = `
    <svg width="1080" height="${height}" viewBox="0 0 1080 ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="page" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff7ed" />
          <stop offset="100%" stop-color="#f8fafc" />
        </linearGradient>
        <linearGradient id="header" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stop-color="#111827" />
          <stop offset="100%" stop-color="#1f2937" />
        </linearGradient>
      </defs>

      <rect width="1080" height="${height}" fill="url(#page)" />
      <rect x="38" y="38" width="1004" height="${height - 76}" rx="42" fill="#ffffff" />
      <rect x="72" y="72" width="936" height="168" rx="34" fill="url(#header)" />
      <text x="118" y="136" font-family="Arial, Helvetica, sans-serif" font-size="56" font-weight="700" fill="#ffffff">${escapeHtml(receipt.laundryName)}</text>
      <text x="118" y="184" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#fdba74">Smart Laundry Receipt</text>
      <rect x="824" y="100" width="126" height="42" rx="21" fill="#ffffff" />
      <text x="887" y="128" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="20" font-weight="700" fill="#111827">LUNAS</text>
      <text x="118" y="214" font-family="Arial, Helvetica, sans-serif" font-size="18" letter-spacing="3" fill="#d1d5db">CJ LAUNDRY POS</text>

      <rect x="72" y="270" width="936" height="148" rx="30" fill="#fff7ed" />
      <text x="118" y="320" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="2" fill="#6b7280">KODE ORDER</text>
      <text x="118" y="362" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#111827">${escapeHtml(receipt.orderCode)}</text>
      <text x="872" y="320" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="2" fill="#6b7280">TANGGAL</text>
      <text x="872" y="362" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#111827">${escapeHtml(receipt.createdAtLabel)}</text>
      <text x="118" y="398" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="2" fill="#6b7280">PELANGGAN</text>
      <text x="118" y="440" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#111827">${escapeHtml(receipt.customerName)}</text>
      <text x="872" y="398" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="2" fill="#6b7280">BERAT</text>
      <text x="872" y="440" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="700" fill="#111827">${escapeHtml(receipt.weightKgLabel)}</text>

      <text x="92" y="504" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="3" font-weight="700" fill="#6b7280">RINCIAN LAYANAN</text>
      ${renderItems(receipt)}

      <rect x="72" y="${summaryY}" width="936" height="152" rx="30" fill="#f8fafc" />
      <text x="120" y="${summaryY + 46}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#6b7280">Subtotal</text>
      <text x="944" y="${summaryY + 46}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#111827">${escapeHtml(`Rp ${receipt.subtotal.toLocaleString("id-ID")}`)}</text>
      <text x="120" y="${summaryY + 84}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="${receipt.discount > 0 ? "#ea580c" : "#6b7280"}">Diskon Redeem</text>
      <text x="944" y="${summaryY + 84}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="${receipt.discount > 0 ? "#ea580c" : "#111827"}">${escapeHtml(receipt.discount > 0 ? `-Rp ${receipt.discount.toLocaleString("id-ID")}` : "Rp 0")}</text>
      <line x1="120" y1="${summaryY + 108}" x2="944" y2="${summaryY + 108}" stroke="#e5e7eb" stroke-width="2" />
      <text x="120" y="${summaryY + 138}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="#111827">Total</text>
      <text x="944" y="${summaryY + 138}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="38" font-weight="700" fill="#f97316">${escapeHtml(`Rp ${receipt.total.toLocaleString("id-ID")}`)}</text>

      <rect x="72" y="${loyaltyY}" width="936" height="148" rx="30" fill="#fffaf0" />
      <text x="120" y="${loyaltyY + 44}" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="3" font-weight="700" fill="#6b7280">LOYALTY</text>
      <text x="120" y="${loyaltyY + 84}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#6b7280">Stamp Diperoleh</text>
      <text x="944" y="${loyaltyY + 84}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#111827">${receipt.earnedStamps}</text>
      <text x="120" y="${loyaltyY + 118}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#6b7280">Poin Ditukar</text>
      <text x="944" y="${loyaltyY + 118}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#111827">${receipt.redeemedPoints}</text>
      <text x="120" y="${loyaltyY + 152}" font-family="Arial, Helvetica, sans-serif" font-size="24" fill="#6b7280">Saldo Poin</text>
      <text x="944" y="${loyaltyY + 152}" text-anchor="end" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="700" fill="#047857">${receipt.resultingPointBalance}</text>

      <rect x="72" y="${contactY}" width="936" height="${contactHeight}" rx="34" fill="#111827" />
      <text x="120" y="${contactY + 40}" font-family="Arial, Helvetica, sans-serif" font-size="22" letter-spacing="3" font-weight="700" fill="#fdba74">KONTAK &amp; ALAMAT</text>
      ${renderContactLines(receipt, contactY + 82)}
    </svg>
  `

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

export const renderReceiptImageBase64 = async (receipt: ReceiptRenderModel) =>
  (await renderReceiptImage(receipt)).toString("base64")
