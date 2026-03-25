import { expect, test } from "@playwright/test"
import { MongoClient } from "mongodb"

const mongoUri =
  process.env.MONGODB_URI ??
  "mongodb://127.0.0.1:27019/cjlaundry_e2e"

const waitForOrderRecord = async (orderCode: string) => {
  const client = new MongoClient(mongoUri)
  await client.connect()
  const database = client.db()

  try {
    const startedAt = Date.now()
    while (Date.now() - startedAt < 15_000) {
      const order = await database.collection("orders").findOne({ orderCode })
      if (order) {
        const customer = await database.collection("customers").findOne({ _id: order.customerId })
        return { order, customer }
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  } finally {
    await client.close()
  }

  throw new Error(`Order ${orderCode} was not found in MongoDB`)
}

const waitForDirectStatusToken = async (orderId: string) => {
  const client = new MongoClient(mongoUri)
  await client.connect()
  const database = client.db()

  try {
    const startedAt = Date.now()
    while (Date.now() - startedAt < 15_000) {
      const notification = await database.collection("notifications").findOne({
        orderId,
        eventType: "order_confirmed",
      })

      const token = notification?.preparedMessage.match(/\/status\/([a-f0-9]+)/i)?.[1]
      if (token) {
        return token
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  } finally {
    await client.close()
  }

  throw new Error(`Direct status token for order ${orderId} was not found`)
}

test.describe.configure({ mode: "serial" })

test("admin and public frontends stay fully integrated through the backend", async ({ browser, page }) => {
  const uniqueSuffix = Date.now().toString().slice(-6)
  const customerName = `E2e Customer ${uniqueSuffix}`
  const upperCustomerName = customerName.toUpperCase()
  const customerPhone = `08123${uniqueSuffix}`
  const primaryAdminPhone = `08999${uniqueSuffix}`

  await page.goto("http://127.0.0.1:3101/")

  await page.getByTestId("admin-login-username").fill("admin")
  await page.getByTestId("admin-login-password").fill("admin123")
  await page.getByTestId("admin-login-submit").click()

  await expect(page).toHaveURL(/\/admin$/)

  await page.goto("http://127.0.0.1:3101/admin/settings")
  await page.getByTestId("settings-add-admin-contact").click()
  await page.getByTestId("settings-admin-contact-phone-1").fill(primaryAdminPhone)
  await page.getByTestId("settings-admin-contact-primary-1").click()
  await page.getByRole("button", { name: "Simpan" }).click()
  await expect(page.getByText("Pengaturan berhasil disimpan.")).toBeVisible()

  const landingPage = await browser.newPage()
  await landingPage.goto("http://127.0.0.1:3100/")
  await expect(landingPage.getByRole("link", { name: "Chat Sekarang" })).toHaveAttribute("href", new RegExp(primaryAdminPhone.replace(/^0/, "62")))
  await expect(landingPage.locator("#kontak").getByText(primaryAdminPhone)).toBeVisible()

  await page.goto("http://127.0.0.1:3101/admin/pos")
  await page.getByTestId("pos-open-create-customer").click()
  await page.getByTestId("pos-create-customer-name").fill(customerName)
  await page.getByTestId("pos-create-customer-phone").fill(customerPhone)
  await page.getByTestId("pos-show-qr-after-create").click()
  await page.getByTestId("pos-create-customer-submit").click()
  await expect(page.getByText("QR Login Customer Baru")).toBeVisible()
  const firstMagicLinkUrl = (await page.getByText(/\/auto-login\?token=/).first().innerText()).trim()
  await expect(firstMagicLinkUrl).toContain("/auto-login?token=")
  await page.keyboard.press("Escape")
  await expect(page.getByTestId("pos-next-to-services")).toBeEnabled()
  await page.getByTestId("pos-next-to-services").click()

  await page.getByTestId("pos-weight-input").fill("3")
  await page.getByTestId("service-plus-washer").click()
  await page.getByTestId("service-plus-dryer").click()
  await page.getByTestId("pos-open-summary").click()
  await page.getByTestId("pos-confirm-order").click()

  await expect(page.getByText("Order Berhasil Dibuat!")).toBeVisible()
  await expect(page.getByRole("button", { name: "Detail Pelanggan" })).toBeVisible()

  const orderCode = (await page.getByTestId("pos-success-order-code").innerText()).trim()
  const { order, customer } = await waitForOrderRecord(orderCode)
  const directStatusToken = await waitForDirectStatusToken(order._id)

  expect(customer?._id).toBeTruthy()

  await page.getByRole("button", { name: "Order Baru" }).click()
  await page.getByTestId("pos-open-create-customer").click()
  await page.getByTestId("pos-create-customer-name").fill(customerName)
  await page.getByTestId("pos-create-customer-phone").fill(customerPhone)
  await page.getByTestId("pos-create-customer-submit").click()
  await expect(page.getByTestId("pos-create-customer-feedback")).toContainText("Nomor HP sudah terdaftar")

  await page.goto("http://127.0.0.1:3101/admin")
  await expect(page.getByText("Pelanggan Teratas")).toBeVisible()

  const publicPage = await browser.newPage()
  await publicPage.goto(firstMagicLinkUrl)
  await expect(publicPage).toHaveURL(/\/portal$/)
  await expect(publicPage.getByTestId("portal-stamp-hero")).toBeVisible()
  await publicPage.goto(firstMagicLinkUrl)
  await expect(publicPage.getByText("Link Tidak Valid")).toBeVisible()
  await publicPage.goto("http://127.0.0.1:3100/portal")

  const chatPopup = publicPage.waitForEvent("popup")
  await publicPage.getByTestId("portal-chat-admin-button").click()
  await expect(publicPage.getByText("Admin 2")).toBeVisible()
  await publicPage.getByTestId("portal-admin-contact-1").click()
  const adminPopup = await chatPopup
  await expect(adminPopup).toHaveURL(new RegExp(primaryAdminPhone.replace(/^0/, "62")))

  await publicPage.goto("http://127.0.0.1:3100/portal/riwayat")
  await expect(publicPage.getByText(orderCode)).toBeVisible()
  await publicPage.getByText(orderCode).click()
  await expect(publicPage.getByRole("heading", { name: "Detail Order" }).first()).toBeVisible()
  await expect(publicPage.getByText("Aktif")).toBeVisible()
  await expect(publicPage.getByText("Rincian Receipt")).toBeVisible()
  await expect(publicPage.getByText("Subtotal")).toBeVisible()
  await expect(publicPage.getByText("Total", { exact: true })).toBeVisible()
  const receiptDownload = publicPage.waitForEvent("download")
  await publicPage.getByRole("button", { name: "Download Receipt" }).click()
  const receiptFile = await receiptDownload
  expect(receiptFile.suggestedFilename()).toContain(".pdf")

  await publicPage.goto("http://127.0.0.1:3100/portal")
  await expect(publicPage.getByRole("heading", { name: "Ringkasan Bulan Ini" })).toBeVisible()
  await expect(publicPage.getByText("Stamp diperoleh", { exact: true }).last()).toBeVisible()
  await expect(publicPage.getByText("Poin ditukar", { exact: true })).toBeVisible()

  await publicPage.goto("http://127.0.0.1:3100/portal/leaderboard")
  await expect(publicPage.locator("main").getByText(upperCustomerName)).not.toBeVisible()
  await publicPage.getByRole("switch").click()
  await expect(publicPage.locator("main").getByText(upperCustomerName)).toBeVisible()
  await publicPage.getByRole("switch").click()
  await expect(publicPage.locator("main").getByText(upperCustomerName)).not.toBeVisible()

  const directStatusPage = await browser.newPage()
  await directStatusPage.goto(`http://127.0.0.1:3100/status/${directStatusToken}`)
  await expect(directStatusPage.getByTestId("direct-status-order-code")).toContainText(orderCode)
  await expect(directStatusPage.getByTestId("direct-status-badge")).toContainText("Aktif")
  await expect(directStatusPage.getByText("Rincian Receipt")).not.toBeVisible()

  const client = new MongoClient(mongoUri)
  await client.connect()
  try {
    const database = client.db()
    await database.collection("notifications").insertOne({
      _id: `notification_manual_done_${uniqueSuffix}`,
      customerName: upperCustomerName,
      destinationPhone: customer.phone,
      orderId: order._id,
      orderCode,
      eventType: "order_done",
      renderStatus: "not_required",
      deliveryStatus: "failed",
      latestFailureReason: "Simulasi gagal kirim bot",
      attemptCount: 1,
      preparedMessage: `Halo ${upperCustomerName}, order ${orderCode} sudah selesai.`,
      businessKey: `e2e-manual-done:${uniqueSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  } finally {
    await client.close()
  }

  await page.goto("http://127.0.0.1:3101/admin/notifikasi")
  await expect(page.getByText("Simulasi gagal kirim bot")).toBeVisible()
  const whatsappPopup = page.waitForEvent("popup")
  await page.getByRole("button", { name: "WhatsApp" }).first().click()
  const popup = await whatsappPopup
  await expect(popup).toHaveURL(/wa\.me|api\.whatsapp\.com/)
  await expect(page.getByText("Fallback WhatsApp manual dibuka oleh admin.")).toBeVisible()

  await page.goto(`http://127.0.0.1:3101/admin/pelanggan/${customer?._id}`)
  await page.getByRole("button", { name: "QR Login" }).click()
  await expect(page.getByText("QR Login Tambahan")).toBeVisible()
  const secondMagicLinkUrl = (await page.getByText(/\/auto-login\?token=/).first().innerText()).trim()
  await page.keyboard.press("Escape")
  await page.getByRole("button", { name: "QR Login" }).click()
  const thirdMagicLinkUrl = (await page.getByText(/\/auto-login\?token=/).first().innerText()).trim()
  await page.keyboard.press("Escape")

  const secondMagicPage = await browser.newPage()
  await secondMagicPage.goto(secondMagicLinkUrl)
  await expect(secondMagicPage).toHaveURL(/\/portal$/)

  const thirdMagicPage = await browser.newPage()
  await thirdMagicPage.goto(thirdMagicLinkUrl)
  await expect(thirdMagicPage).toHaveURL(/\/portal$/)

  await page.getByTestId(`void-order-${order._id}`).click()
  await page.getByTestId("void-reason-input").fill("Pelanggan membatalkan order pada skenario e2e")
  await page.getByTestId("void-submit").click()

  await expect(page.getByText("Dibatalkan", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Pelanggan membatalkan order pada skenario e2e")).toBeVisible()

  await publicPage.goto("http://127.0.0.1:3100/portal/riwayat")
  await expect(publicPage.getByText(orderCode)).toBeVisible()
  await publicPage.getByText(orderCode).click()
  await expect(publicPage.getByText("Dibatalkan", { exact: true }).last()).toBeVisible()
  await expect(publicPage.getByText("Tanggal Dibatalkan")).toBeVisible()
  await expect(publicPage.getByText("Pelanggan membatalkan order pada skenario e2e")).toBeVisible()

  await directStatusPage.reload()
  await expect(directStatusPage.getByTestId("direct-status-badge")).toContainText("Dibatalkan")
  await expect(directStatusPage.getByText("Alasan Pembatalan")).toBeVisible()

  await publicPage.setViewportSize({ width: 390, height: 844 })
  await publicPage.goto("http://127.0.0.1:3100/portal")
  await publicPage.getByTestId("portal-mobile-logout").click()
  await expect(publicPage).toHaveURL(/\/login$/)

  await page.getByRole("button", { name: "Keluar" }).click()
  await expect(page).toHaveURL("http://127.0.0.1:3101/")
  await page.goto("http://127.0.0.1:3101/admin")
  await expect(page).toHaveURL("http://127.0.0.1:3101/")
})
