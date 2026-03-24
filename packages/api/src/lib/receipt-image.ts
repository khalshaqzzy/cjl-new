import sharp from "sharp"
import { formatCurrency } from "./formatters.js"

type ReceiptImageSnapshot = {
  orderCode: string
  customerName: string
  serviceSummary: string
  totalLabel: string
  createdAtLabel: string
  laundryName: string
  laundryPhone: string
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")

export const renderReceiptImage = async (snapshot: ReceiptImageSnapshot) => {
  const svg = `
    <svg width="1080" height="1350" viewBox="0 0 1080 1350" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fff7ed" />
          <stop offset="100%" stop-color="#ffffff" />
        </linearGradient>
      </defs>
      <rect width="1080" height="1350" rx="56" fill="url(#bg)" />
      <rect x="56" y="56" width="968" height="1238" rx="40" fill="#ffffff" stroke="#fed7aa" stroke-width="3" />
      <rect x="96" y="96" width="888" height="164" rx="28" fill="#111827" />
      <text x="140" y="165" font-family="Arial, Helvetica, sans-serif" font-size="52" font-weight="700" fill="#ffffff">${escapeHtml(snapshot.laundryName)}</text>
      <text x="140" y="214" font-family="Arial, Helvetica, sans-serif" font-size="28" fill="#fdba74">WhatsApp Receipt</text>
      <text x="140" y="330" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#9ca3af">KODE ORDER</text>
      <text x="140" y="376" font-family="Arial, Helvetica, sans-serif" font-size="44" font-weight="700" fill="#111827">${escapeHtml(snapshot.orderCode)}</text>
      <text x="140" y="460" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#9ca3af">PELANGGAN</text>
      <text x="140" y="506" font-family="Arial, Helvetica, sans-serif" font-size="42" font-weight="700" fill="#111827">${escapeHtml(snapshot.customerName)}</text>
      <text x="140" y="590" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#9ca3af">LAYANAN</text>
      <foreignObject x="136" y="618" width="808" height="220">
        <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, Helvetica, sans-serif; font-size: 34px; line-height: 1.35; color: #111827; font-weight: 600;">
          ${escapeHtml(snapshot.serviceSummary)}
        </div>
      </foreignObject>
      <line x1="140" y1="870" x2="940" y2="870" stroke="#e5e7eb" stroke-width="3" />
      <text x="140" y="944" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#9ca3af">DIBUAT</text>
      <text x="140" y="990" font-family="Arial, Helvetica, sans-serif" font-size="34" font-weight="600" fill="#111827">${escapeHtml(snapshot.createdAtLabel)}</text>
      <text x="140" y="1086" font-family="Arial, Helvetica, sans-serif" font-size="26" font-weight="700" fill="#9ca3af">TOTAL</text>
      <text x="140" y="1148" font-family="Arial, Helvetica, sans-serif" font-size="70" font-weight="700" fill="#ea580c">${escapeHtml(snapshot.totalLabel)}</text>
      <rect x="96" y="1190" width="888" height="96" rx="24" fill="#fff7ed" stroke="#fdba74" stroke-width="2" />
      <text x="140" y="1250" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="600" fill="#7c2d12">Kontak laundry: ${escapeHtml(snapshot.laundryPhone)}</text>
    </svg>
  `

  return sharp(Buffer.from(svg))
    .png()
    .toBuffer()
}

export const renderReceiptImageBase64 = async (snapshot: ReceiptImageSnapshot) =>
  (await renderReceiptImage(snapshot)).toString("base64")

export const buildReceiptImageFallbackSnapshot = (params: {
  orderCode: string
  customerName: string
  serviceSummary: string
  total: number
  createdAtLabel: string
  laundryName: string
  laundryPhone: string
}): ReceiptImageSnapshot => ({
  orderCode: params.orderCode,
  customerName: params.customerName,
  serviceSummary: params.serviceSummary,
  totalLabel: formatCurrency(params.total),
  createdAtLabel: params.createdAtLabel,
  laundryName: params.laundryName,
  laundryPhone: params.laundryPhone,
})
