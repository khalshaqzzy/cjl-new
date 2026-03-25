import PDFDocument from "pdfkit"
import { formatCurrency } from "./formatters.js"

export type ReceiptRenderModel = {
  laundryName: string
  laundryPhone: string
  adminWhatsapp?: string
  address: string
  operatingHours?: string
  orderCode: string
  customerName: string
  createdAtLabel: string
  weightKgLabel: string
  items: Array<{
    serviceLabel: string
    quantityLabel: string
    unitPriceLabel: string
    lineTotalLabel: string
  }>
  subtotal: number
  discount: number
  total: number
  earnedStamps: number
  redeemedPoints: number
  resultingPointBalance: number
}

type ReceiptOrderLike = {
  orderCode: string
  customerName: string
  createdAtLabel: string
  weightKgLabel: string
  subtotal: number
  discount: number
  total: number
  earnedStamps: number
  redeemedPoints: number
  resultingPointBalance: number
  items: Array<{
    serviceLabel: string
    quantityLabel: string
    unitPriceLabel: string
    lineTotalLabel: string
  }>
}

type ReceiptBusinessLike = {
  laundryName: string
  laundryPhone: string
  adminWhatsapp?: string
  address: string
  operatingHours?: string
}

const palette = {
  ink: "#1f2937",
  muted: "#6b7280",
  soft: "#f8fafc",
  line: "#e5e7eb",
  warm: "#f97316",
  warmSoft: "#fff7ed",
  dark: "#111827",
  success: "#047857",
}

export const createReceiptRenderModel = (
  order: ReceiptOrderLike,
  business: ReceiptBusinessLike
): ReceiptRenderModel => ({
  laundryName: business.laundryName,
  laundryPhone: business.laundryPhone,
  adminWhatsapp: business.adminWhatsapp,
  address: business.address,
  operatingHours: business.operatingHours,
  orderCode: order.orderCode,
  customerName: order.customerName,
  createdAtLabel: order.createdAtLabel,
  weightKgLabel: order.weightKgLabel,
  items: order.items,
  subtotal: order.subtotal,
  discount: order.discount,
  total: order.total,
  earnedStamps: order.earnedStamps,
  redeemedPoints: order.redeemedPoints,
  resultingPointBalance: order.resultingPointBalance,
})

const drawLabelValue = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  align: "left" | "right" = "left"
) => {
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(palette.muted)
    .text(label.toUpperCase(), x, y, {
      width: 160,
      align,
      characterSpacing: 1,
    })
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(palette.ink)
    .text(value, x, y + 13, {
      width: 160,
      align,
    })
}

const drawSummaryRow = (
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  label: string,
  value: string,
  options?: { strong?: boolean; accent?: boolean }
) => {
  doc
    .font(options?.strong ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options?.strong ? 11 : 10)
    .fillColor(options?.accent ? palette.warm : options?.strong ? palette.ink : palette.muted)
    .text(label, x, y, {
      width: 180,
    })
  doc
    .font(options?.strong ? "Helvetica-Bold" : "Helvetica")
    .fontSize(options?.strong ? 14 : 10)
    .fillColor(options?.accent ? palette.warm : palette.ink)
    .text(value, x + 180, y, {
      width: 120,
      align: "right",
    })
}

export const renderReceiptPdf = async (receipt: ReceiptRenderModel) => {
  const pageWidth = 440
  const lineItemsHeight = Math.max(receipt.items.length, 1) * 52
  const pageHeight = 620 + lineItemsHeight
  const doc = new PDFDocument({
    size: [pageWidth, pageHeight],
    margin: 0,
    compress: false,
  })

  const chunks: Buffer[] = []
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)))

  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  doc.rect(0, 0, pageWidth, pageHeight).fill("#f5f5f4")

  doc
    .roundedRect(18, 18, pageWidth - 36, pageHeight - 36, 26)
    .fill("#ffffff")

  doc
    .roundedRect(32, 32, pageWidth - 64, 108, 22)
    .fill(palette.dark)

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#ffffff")
    .text(receipt.laundryName, 52, 52, {
      width: 240,
    })
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#fdba74")
    .text("Smart Laundry Receipt", 52, 82)
  doc
    .roundedRect(296, 48, 92, 28, 14)
    .fill("#ffffff")
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(palette.dark)
    .text("LUNAS", 296, 57, {
      width: 92,
      align: "center",
      characterSpacing: 1.1,
    })
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#d1d5db")
    .text("CJ LAUNDRY POS", 52, 104, {
      characterSpacing: 1.4,
    })

  doc
    .roundedRect(32, 154, pageWidth - 64, 92, 18)
    .fill(palette.warmSoft)
  drawLabelValue(doc, 52, 174, "Kode Order", receipt.orderCode)
  drawLabelValue(doc, 232, 174, "Tanggal", receipt.createdAtLabel, "right")
  drawLabelValue(doc, 52, 210, "Pelanggan", receipt.customerName)
  drawLabelValue(doc, 232, 210, "Berat", receipt.weightKgLabel, "right")

  let cursorY = 266
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(palette.muted)
    .text("RINCIAN LAYANAN", 40, cursorY, {
      characterSpacing: 1.5,
    })
  cursorY += 18

  receipt.items.forEach((item, index) => {
    const rowHeight = 44
    const rowY = cursorY + index * rowHeight
    doc
      .roundedRect(32, rowY, pageWidth - 64, rowHeight - 4, 16)
      .fill(index % 2 === 0 ? "#fcfcfd" : "#f8fafc")
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(palette.ink)
      .text(item.serviceLabel, 48, rowY + 9, {
        width: 190,
      })
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(palette.muted)
      .text(`${item.quantityLabel} • ${item.unitPriceLabel}`, 48, rowY + 24, {
        width: 200,
      })
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(palette.ink)
      .text(item.lineTotalLabel, 250, rowY + 15, {
        width: 120,
        align: "right",
      })
  })

  cursorY += lineItemsHeight + 12
  doc
    .roundedRect(32, cursorY, pageWidth - 64, 110, 18)
    .fill("#f8fafc")
  drawSummaryRow(doc, 48, cursorY + 18, "Subtotal", formatCurrency(receipt.subtotal))
  drawSummaryRow(
    doc,
    48,
    cursorY + 42,
    "Diskon Redeem",
    receipt.discount > 0 ? `-${formatCurrency(receipt.discount)}` : formatCurrency(0),
    { accent: receipt.discount > 0 }
  )
  doc
    .moveTo(48, cursorY + 74)
    .lineTo(pageWidth - 48, cursorY + 74)
    .strokeColor(palette.line)
    .lineWidth(1)
    .stroke()
  drawSummaryRow(doc, 48, cursorY + 84, "Total", formatCurrency(receipt.total), {
    strong: true,
    accent: true,
  })

  cursorY += 126
  doc
    .roundedRect(32, cursorY, pageWidth - 64, 86, 18)
    .fill("#fffaf0")
  drawSummaryRow(doc, 48, cursorY + 18, "Stamp Diperoleh", `${receipt.earnedStamps}`)
  drawSummaryRow(doc, 48, cursorY + 40, "Poin Ditukar", `${receipt.redeemedPoints}`)
  drawSummaryRow(doc, 48, cursorY + 62, "Saldo Poin", `${receipt.resultingPointBalance}`, {
    strong: true,
  })

  cursorY += 104
  doc
    .roundedRect(32, cursorY, pageWidth - 64, 108, 20)
    .fill(palette.dark)
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#fdba74")
    .text("KONTAK & ALAMAT", 48, cursorY + 18, {
      characterSpacing: 1.5,
    })
  const contactLines = [
    `Telepon: ${receipt.laundryPhone}`,
    ...(receipt.adminWhatsapp && receipt.adminWhatsapp !== receipt.laundryPhone
      ? [`WhatsApp: ${receipt.adminWhatsapp}`]
      : []),
    receipt.address,
    ...(receipt.operatingHours ? [receipt.operatingHours] : []),
  ]
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#f9fafb")
    .text(contactLines.join("\n"), 48, cursorY + 38, {
      width: pageWidth - 96,
      lineGap: 2,
    })

  doc.end()
  return completed
}
