import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createReceiptRenderModel, renderReceiptPdf } from "../../packages/api/src/lib/receipts.ts"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, "../..")
const outputDir = path.join(repoRoot, "docs", "WhatsApp", "assets")
const outputFile = path.join(outputDir, "cjl-order-confirmed-sample-receipt.pdf")

const receipt = createReceiptRenderModel(
  {
    orderCode: "CJ-260402-001",
    customerName: "BUDI SANTOSO",
    createdAtLabel: "2 Apr 2026, 10:35",
    weightKgLabel: "3.0 kg",
    items: [
      {
        serviceLabel: "Washer",
        quantityLabel: "1x",
        unitPriceLabel: "Rp 10.000",
        lineTotalLabel: "Rp 10.000",
      },
      {
        serviceLabel: "Dryer",
        quantityLabel: "1x",
        unitPriceLabel: "Rp 10.000",
        lineTotalLabel: "Rp 10.000",
      },
      {
        serviceLabel: "Setrika",
        quantityLabel: "3.0 kg",
        unitPriceLabel: "Rp 4.500 / kg",
        lineTotalLabel: "Rp 13.500",
      },
    ],
    subtotal: 33500,
    discount: 9000,
    total: 24500,
    earnedStamps: 1,
    redeemedPoints: 0,
    resultingPointBalance: 6,
  },
  {
    laundryName: "CJ Laundry",
    laundryPhone: "087780563875",
    adminWhatsapp: "+62 822 4637 7434",
    address: "Jl. Raya Sejahtera No. 123, Jakarta",
    operatingHours: "Senin - Minggu, 07:00 - 22:00",
  }
)

const main = async () => {
  await mkdir(outputDir, { recursive: true })
  const pdf = await renderReceiptPdf(receipt)
  await writeFile(outputFile, pdf)
  console.log(outputFile)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
