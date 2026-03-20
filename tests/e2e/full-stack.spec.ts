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

test.describe.configure({ mode: "serial" })

test("admin and public frontends stay fully integrated through the backend", async ({ browser, page }) => {
  const uniqueSuffix = Date.now().toString().slice(-6)
  const customerName = `E2E Customer ${uniqueSuffix}`
  const customerPhone = `08123${uniqueSuffix}`

  await page.goto("http://127.0.0.1:3101/")

  await page.getByTestId("admin-login-username").fill("admin")
  await page.getByTestId("admin-login-password").fill("admin123")
  await page.getByTestId("admin-login-submit").click()

  await expect(page).toHaveURL(/\/admin$/)

  await page.goto("http://127.0.0.1:3101/admin/pos")
  await page.getByTestId("pos-open-create-customer").click()
  await page.getByTestId("pos-create-customer-name").fill(customerName)
  await page.getByTestId("pos-create-customer-phone").fill(customerPhone)
  await page.getByTestId("pos-create-customer-submit").click()
  await page.getByTestId("pos-next-to-services").click()

  await page.getByTestId("pos-weight-input").fill("3")
  await page.getByTestId("service-plus-washer").click()
  await page.getByTestId("service-plus-dryer").click()
  await page.getByTestId("pos-open-summary").click()
  await page.getByTestId("pos-confirm-order").click()

  await expect(page.getByText("Order Berhasil Dibuat!")).toBeVisible()

  const orderCode = (await page.getByTestId("pos-success-order-code").innerText()).trim()
  const { order, customer } = await waitForOrderRecord(orderCode)

  expect(customer?._id).toBeTruthy()

  const publicPage = await browser.newPage()
  await publicPage.goto("http://127.0.0.1:3100/login")
  await publicPage.getByTestId("public-login-phone").fill(customerPhone)
  await publicPage.getByTestId("public-login-name").fill(customerName)
  await publicPage.getByTestId("public-login-submit").click()

  await expect(publicPage).toHaveURL(/\/portal$/)
  await expect(publicPage.getByTestId("portal-stamp-hero")).toBeVisible()

  await publicPage.goto("http://127.0.0.1:3100/portal/riwayat")
  await expect(publicPage.getByText(orderCode)).toBeVisible()
  await publicPage.getByText(orderCode).click()
  await expect(publicPage.getByRole("heading", { name: "Detail Order" }).first()).toBeVisible()
  await expect(publicPage.getByText("Active")).toBeVisible()

  const directStatusPage = await browser.newPage()
  await directStatusPage.goto(`http://127.0.0.1:3100/status/${order.directToken}`)
  await expect(directStatusPage.getByTestId("direct-status-order-code")).toContainText(orderCode)
  await expect(directStatusPage.getByTestId("direct-status-badge")).toContainText("Active")

  await page.goto(`http://127.0.0.1:3101/admin/pelanggan/${customer?._id}`)
  await page.getByTestId(`void-order-${order._id}`).click()
  await page.getByTestId("void-reason-input").fill("Pelanggan membatalkan order pada skenario e2e")
  await page.getByTestId("void-submit").click()

  await expect(page.getByText("Dibatalkan", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("Pelanggan membatalkan order pada skenario e2e")).toBeVisible()

  await publicPage.goto("http://127.0.0.1:3100/portal/riwayat")
  await expect(publicPage.getByText(orderCode)).toBeVisible()
  await publicPage.getByText(orderCode).click()
  await expect(publicPage.getByText("Cancelled")).toBeVisible()

  await directStatusPage.reload()
  await expect(directStatusPage.getByTestId("direct-status-badge")).toContainText("Cancelled")
})
