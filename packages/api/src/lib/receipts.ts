import PDFDocument from "pdfkit"
import { formatCurrency } from "./formatters.js"

type ReceiptOrderLike = {
  orderCode: string
  customerName: string
  createdAtLabel: string
  weightKgLabel: string
  subtotal: number
  discount: number
  total: number
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
}

const drawSectionLabel = (doc: PDFKit.PDFDocument, label: string) => {
  doc
    .moveDown(0.2)
    .fontSize(9)
    .fillColor("#6b7280")
    .text(label.toUpperCase(), { characterSpacing: 1.2 })
    .moveDown(0.3)
}

const drawKeyValue = (doc: PDFKit.PDFDocument, label: string, value: string, strong = false) => {
  const startX = doc.x
  const startY = doc.y
  const valueWidth = 160

  doc.font("Helvetica").fontSize(10).fillColor("#6b7280").text(label, startX, startY, {
    width: 180
  })
  doc
    .font(strong ? "Helvetica-Bold" : "Helvetica")
    .fontSize(10)
    .fillColor("#111827")
    .text(value, startX + 190, startY, {
      width: valueWidth,
      align: "right"
    })
  doc.moveDown(0.8)
}

export const renderReceiptPdf = async (
  order: ReceiptOrderLike,
  business: ReceiptBusinessLike
) => {
  const doc = new PDFDocument({
    size: "A4",
    margin: 48
  })

  const chunks: Buffer[] = []
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)))

  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)
  })

  doc.font("Helvetica-Bold").fontSize(20).fillColor("#111827").text(business.laundryName)
  doc.font("Helvetica").fontSize(10).fillColor("#4b5563").text(`Kontak: ${business.laundryPhone}`)
  doc.moveDown(1)

  drawSectionLabel(doc, "Informasi Order")
  drawKeyValue(doc, "Kode Order", order.orderCode, true)
  drawKeyValue(doc, "Pelanggan", order.customerName, true)
  drawKeyValue(doc, "Tanggal", order.createdAtLabel)
  drawKeyValue(doc, "Berat", order.weightKgLabel)

  drawSectionLabel(doc, "Item Layanan")
  for (const item of order.items) {
    const rowTop = doc.y
    doc.font("Helvetica-Bold").fontSize(10).fillColor("#111827").text(item.serviceLabel, 48, rowTop)
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#6b7280")
      .text(`${item.quantityLabel} x ${item.unitPriceLabel}`, 48, rowTop + 14)
    doc
      .font("Helvetica-Bold")
      .fontSize(10)
      .fillColor("#111827")
      .text(item.lineTotalLabel, 360, rowTop + 6, {
        width: 160,
        align: "right"
      })
    doc.moveDown(1.6)
  }

  doc
    .moveTo(48, doc.y + 2)
    .lineTo(547, doc.y + 2)
    .strokeColor("#e5e7eb")
    .stroke()
  doc.moveDown(0.8)

  drawKeyValue(doc, "Subtotal", formatCurrency(order.subtotal))
  if (order.discount > 0) {
    drawKeyValue(doc, "Diskon Redeem", `-${formatCurrency(order.discount)}`)
  }
  drawKeyValue(doc, "Total", formatCurrency(order.total), true)

  doc
    .moveDown(1.2)
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#6b7280")
    .text("Receipt ini dibuat dari snapshot order CJ Laundry.", {
      align: "center"
    })

  doc.end()
  return completed
}
