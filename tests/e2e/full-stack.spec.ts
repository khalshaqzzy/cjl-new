import crypto from "node:crypto"
import { expect, test } from "@playwright/test"
import { GridFSBucket, MongoClient } from "mongodb"

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

const seedWhatsappMedia = async (providerMessageId: string) => {
  const client = new MongoClient(mongoUri)
  await client.connect()
  const database = client.db()

  try {
    const startedAt = Date.now()
    let message = null
    while (Date.now() - startedAt < 15_000) {
      message = await database.collection("whatsapp_messages").findOne({ _id: providerMessageId })
      if (message) {
        break
      }

      await new Promise((resolve) => setTimeout(resolve, 250))
    }

    if (!message) {
      throw new Error(`WhatsApp message ${providerMessageId} was not found in time`)
    }

    if (message.mediaStorageId) {
      return message
    }

    const bucket = new GridFSBucket(database, { bucketName: "whatsapp_media" })
    const storageId = await new Promise<string>((resolve, reject) => {
      const upload = bucket.openUploadStream("e2e-image.jpg", {
        contentType: "image/jpeg",
        metadata: {
          providerMessageId,
        },
      })

      upload.once("error", reject)
      upload.once("finish", () => resolve(String(upload.id)))
      upload.end(Buffer.from("integration-media-01"))
    })

    await database.collection("whatsapp_messages").updateOne(
      { _id: providerMessageId },
      {
        $set: {
          mediaStorageId: storageId,
          mediaMimeType: "image/jpeg",
          mediaName: "e2e-image.jpg",
          mediaDownloadStatus: "downloaded",
          mediaDownloadedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }
    )

    return await database.collection("whatsapp_messages").findOne({ _id: providerMessageId })
  } finally {
    await client.close()
  }
}

const signWhatsappWebhookPayload = (payload: unknown) => {
  const rawBody = JSON.stringify(payload)
  const signature = `sha256=${crypto
    .createHmac("sha256", "cjlaundry-e2e-app-secret")
    .update(rawBody)
    .digest("hex")}`

  return { rawBody, signature }
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
  await expect(page.getByText("Blok Pesan WhatsApp")).not.toBeVisible()

  await page.goto("http://127.0.0.1:3101/admin/whatsapp")
  await expect(page.getByText("Cloud API Provider Health")).toBeVisible()
  await expect(page.getByText("Generate Pairing Code")).not.toBeVisible()
  await expect(page.getByText("Pairing Material")).not.toBeVisible()
  await expect(page.getByText(/Ack /)).not.toBeVisible()

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
  await page.getByTestId("pos-continue-after-qr").click()
  await expect(page.getByTestId("pos-open-summary")).toBeVisible()
  await expect(page.getByTestId("pos-selected-customer-summary")).toContainText(`+62${customerPhone.slice(1)}`)

  await page.getByTestId("pos-weight-input").fill("3")
  await page.getByTestId("service-plus-washer").click()
  await page.getByTestId("service-plus-dryer").click()
  await page.getByTestId("service-toggle-ironing_only").click()
  await page.getByTestId("service-plus-laundry_plastic").click()
  await page.getByTestId("pos-open-summary").click()
  await page.getByTestId("pos-confirm-order").click()

  await expect(page.getByText("Order Berhasil Dibuat!")).toBeVisible()
  await expect(page.getByRole("button", { name: "Detail Pelanggan" })).toBeVisible()

  const orderCode = (await page.getByTestId("pos-success-order-code").innerText()).trim()
  const { order, customer } = await waitForOrderRecord(orderCode)
  const directStatusToken = await waitForDirectStatusToken(order._id)

  expect(customer?._id).toBeTruthy()

  const inboundWebhookPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_e2e",
        changes: [
          {
            field: "messages",
            value: {
              metadata: {
                phone_number_id: "e2e-phone-number",
              },
              contacts: [
                {
                  profile: { name: upperCustomerName },
                  wa_id: `62${customerPhone.slice(1)}`,
                },
              ],
              messages: [
                {
                  from: `62${customerPhone.slice(1)}`,
                  id: `wamid.e2e.${uniqueSuffix}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: {
                    body: "Halo dari webhook E2E",
                  },
                },
                {
                  from: `62${customerPhone.slice(1)}`,
                  id: `wamid.e2e.image.${uniqueSuffix}`,
                  timestamp: String(Math.floor(Date.now() / 1000) + 1),
                  type: "image",
                  image: {
                    id: "cloud-media-image",
                    mime_type: "image/jpeg",
                    caption: "Foto dari webhook E2E",
                    file_size: 19,
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  }
  const signedInboundWebhook = signWhatsappWebhookPayload(inboundWebhookPayload)
  const webhookResponse = await fetch("http://127.0.0.1:4100/v1/webhooks/meta/whatsapp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signedInboundWebhook.signature,
    },
    body: signedInboundWebhook.rawBody,
  })
  expect(webhookResponse.status).toBe(200)

  const inboxClient = new MongoClient(mongoUri)
  await inboxClient.connect()
  try {
    const database = inboxClient.db()
    await database.collection("whatsapp_chats").updateOne(
      { _id: `wa:62${customerPhone.slice(1)}` },
      {
        $set: {
          cswOpenedAt: new Date().toISOString(),
          cswExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          composerMode: "free_form",
          unreadCount: 2,
        },
      }
    )
  } finally {
    await inboxClient.close()
  }

  await page.goto("http://127.0.0.1:3101/admin/laundry-aktif")
  await expect(page.getByText(orderCode)).toBeVisible()
  await page.getByRole("tab", { name: "Hari Ini" }).click()
  await expect(page.getByText("Show Cancelled")).toBeVisible()
  await page.getByRole("tab", { name: "History" }).click()
  await expect(page.getByRole("button", { name: "Semua" })).toBeVisible()

  await page.goto("http://127.0.0.1:3101/admin/pos")
  await page.getByTestId("pos-open-create-customer").click()
  await page.getByTestId("pos-create-customer-name").fill(customerName)
  await page.getByTestId("pos-create-customer-phone").fill(customerPhone)
  await page.getByTestId("pos-create-customer-submit").click()
  await expect(page.getByTestId("pos-create-customer-feedback")).toContainText("Nomor HP sudah terdaftar")

  await page.goto("http://127.0.0.1:3101/admin")
  await expect(page.getByText("Pelanggan Teratas")).toBeVisible()

  await page.goto("http://127.0.0.1:3101/admin/whatsapp")
  await expect(page.getByText("Phone Number ID")).toHaveCount(0)
  await page.getByTestId("whatsapp-provider-toggle").click()
  await expect(page.getByText("Phone Number ID")).toBeVisible()
  await page.getByTestId("whatsapp-provider-toggle").click()
  await expect(page.getByText("Phone Number ID")).toHaveCount(0)
  await expect(page.getByText("Halo dari webhook E2E")).toBeVisible()
  await expect(page.getByText(`+62${customerPhone.slice(1)}`).first()).toBeVisible()
  const whatsappThread = page.getByTestId(`whatsapp-thread-wa:62${customerPhone.slice(1)}`)
  await expect(whatsappThread.getByText(/^2$/)).toBeVisible()
  await whatsappThread.click()
  await expect(page).toHaveURL("http://127.0.0.1:3101/admin/whatsapp")
  await expect(whatsappThread.getByText(/^2$/)).toHaveCount(0)
  await expect(page.getByTestId("whatsapp-linked-customer-link")).toBeVisible()
  await seedWhatsappMedia(`wamid.e2e.image.${uniqueSuffix}`)
  const mediaPopup = page.waitForEvent("popup")
  await expect(page.getByTestId(`whatsapp-open-media-wamid.e2e.image.${uniqueSuffix}`)).toBeVisible({ timeout: 15000 })
  await page.getByTestId(`whatsapp-open-media-wamid.e2e.image.${uniqueSuffix}`).click()
  const mediaPage = await mediaPopup
  await expect(mediaPage).toHaveURL(/\/v1\/admin\/whatsapp\/messages\/.*\/media/)
  await expect(page.getByTestId("whatsapp-composer-input")).toBeEnabled()
  await page.getByTestId("whatsapp-composer-input").fill("Balasan manual dari admin web")
  await page.getByTestId("whatsapp-send-button").click()
  const manualReplyBubble = page.locator('[data-testid^="whatsapp-message-"]').filter({
    hasText: "Balasan manual dari admin web",
  }).last()
  await expect(manualReplyBubble).toBeVisible()

  const overflowPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+62 877 8056 3875",
                phone_number_id: "1234567890",
              },
              contacts: [
                {
                  profile: { name: upperCustomerName },
                  wa_id: `62${customerPhone.slice(1)}`,
                },
              ],
              messages: Array.from({ length: 18 }, (_, index) => ({
                from: `62${customerPhone.slice(1)}`,
                id: `wamid.inbound.overflow.${uniqueSuffix}.${index}`,
                timestamp: String(Math.floor(Date.now() / 1000) + index + 10),
                type: "text",
                text: {
                  body: `Overflow desktop ${index + 1}`,
                },
              })),
            },
          },
        ],
      },
    ],
  }
  const signedOverflowPayload = signWhatsappWebhookPayload(overflowPayload)
  const overflowWebhookResponse = await page.request.post("http://127.0.0.1:4100/v1/webhooks/meta/whatsapp", {
    data: signedOverflowPayload.rawBody,
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signedOverflowPayload.signature,
    },
  })
  expect(overflowWebhookResponse.ok()).toBeTruthy()

  await page.goto("http://127.0.0.1:3101/admin/whatsapp")
  await page.getByTestId(`whatsapp-thread-wa:62${customerPhone.slice(1)}`).click()
  const pageScrollBeforeTimelineWheel = await page.evaluate(() => window.scrollY)
  const timeline = page.getByTestId("whatsapp-thread-timeline")
  await expect(timeline).toBeVisible()
  await timeline.hover()
  await page.mouse.wheel(0, 1800)
  await expect
    .poll(async () =>
      timeline.locator('[data-slot="scroll-area-viewport"]').evaluate((node) => node.scrollTop)
    )
    .toBeGreaterThan(0)
  await expect
    .poll(async () => page.evaluate(() => window.scrollY))
    .toBe(pageScrollBeforeTimelineWheel)

  await page.getByTestId("whatsapp-linked-customer-link").click()
  await expect(page).toHaveURL(new RegExp(`/admin/pelanggan/${customer?._id}$`))
  await page.goto("http://127.0.0.1:3101/admin/whatsapp")
  await expect(
    page.locator('[data-testid^="whatsapp-message-"]').filter({
      hasText: "Balasan manual dari admin web",
    }).last()
  ).toBeVisible()

  const whatsappClient = new MongoClient(mongoUri)
  await whatsappClient.connect()
  try {
    const database = whatsappClient.db()
    await database.collection("whatsapp_chats").updateOne(
      { _id: `wa:62${customerPhone.slice(1)}` },
      {
        $set: {
          cswExpiresAt: new Date(Date.now() - 60_000).toISOString(),
          composerMode: "template_only",
        },
      }
    )
  } finally {
    await whatsappClient.close()
  }

  await page.reload()
  await page.getByTestId(`whatsapp-thread-wa:62${customerPhone.slice(1)}`).click()
  await expect(page.getByText("Thread ini hanya boleh memakai template resmi.")).toBeVisible()
  await expect(page.getByTestId("whatsapp-send-button")).toBeDisabled()

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
  await expect(publicPage.getByText("Setrika Saja", { exact: true })).toBeVisible()
  await expect(publicPage.getByText("Plastik Laundry", { exact: true })).toBeVisible()
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
      _id: `notification_receipt_failed_${uniqueSuffix}`,
      customerName: upperCustomerName,
      destinationPhone: customer.phone,
      orderId: order._id,
      orderCode,
      eventType: "order_confirmed",
      renderStatus: "ready",
      deliveryStatus: "failed",
      latestFailureReason: "Simulasi receipt gagal terkirim",
      attemptCount: 1,
      preparedMessage: `Halo ${upperCustomerName}, receipt order ${orderCode}.`,
      templateParams: {
        customer_name: upperCustomerName,
        order_code: orderCode,
        created_at: "2 Apr 2026, 10:35",
        weight_kg_label: "3.0 kg",
        service_summary: "1x Washer, 1x Dryer, 2.0 kg Setrika Saja, 2x Plastik Laundry",
        total_label: "Rp 29.000",
        earned_stamps: "1",
        redeemed_points: "0",
        current_points: "1",
        status_url: `http://127.0.0.1:3100/status/${directStatusToken}`,
      },
      businessKey: `e2e-receipt-failed:${uniqueSuffix}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
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
    await database.collection("notifications").insertMany([
      {
        _id: `notification_manual_complete_${uniqueSuffix}`,
        customerName: upperCustomerName,
        destinationPhone: customer.phone,
        orderId: order._id,
        orderCode,
        eventType: "welcome",
        renderStatus: "not_required",
        deliveryStatus: "failed",
        latestFailureReason: "Simulasi mark as done",
        attemptCount: 1,
        preparedMessage: `Halo ${upperCustomerName}, notifikasi manual complete.`,
        businessKey: `e2e-manual-complete:${uniqueSuffix}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        _id: `notification_manual_ignore_${uniqueSuffix}`,
        customerName: upperCustomerName,
        destinationPhone: customer.phone,
        orderId: order._id,
        orderCode,
        eventType: "account_info",
        renderStatus: "not_required",
        deliveryStatus: "failed",
        latestFailureReason: "Simulasi ignore",
        attemptCount: 1,
        preparedMessage: `Halo ${upperCustomerName}, notifikasi ignore.`,
        businessKey: `e2e-manual-ignore:${uniqueSuffix}`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ])
  } finally {
    await client.close()
  }

  await page.goto("http://127.0.0.1:3101/admin/notifikasi")
  const failedReceiptCard = page.getByTestId(`notification-card-notification_receipt_failed_${uniqueSuffix}`)
  await expect(failedReceiptCard).toBeVisible()
  const fallbackReceiptDownload = page.waitForEvent("download")
  await page.getByTestId(`notification-download-notification_receipt_failed_${uniqueSuffix}`).click()
  const fallbackReceiptFile = await fallbackReceiptDownload
  expect(fallbackReceiptFile.suggestedFilename()).toContain(".png")
  await page.getByTestId(`notification-resend-notification_receipt_failed_${uniqueSuffix}`).click()
  await expect(failedReceiptCard).toContainText("Terkirim")

  const failedNotificationCard = page.getByTestId(`notification-card-notification_manual_done_${uniqueSuffix}`)
  await expect(failedNotificationCard).toBeVisible()
  await page.getByTestId(`notification-resend-notification_manual_done_${uniqueSuffix}`).click()
  await expect(failedNotificationCard).toContainText("Terkirim")

  const manualCompleteCard = page.getByTestId(`notification-card-notification_manual_complete_${uniqueSuffix}`)
  await expect(manualCompleteCard).toBeVisible()
  await page.getByTestId(`notification-complete-notification_manual_complete_${uniqueSuffix}`).click()
  await page.getByRole("tab", { name: /Manual/ }).click()
  await expect(page.getByText("Simulasi mark as done")).toBeVisible()

  await page.getByRole("tab", { name: /Gagal/ }).click()
  const manualIgnoreCard = page.getByTestId(`notification-card-notification_manual_ignore_${uniqueSuffix}`)
  await expect(manualIgnoreCard).toBeVisible()
  await page.getByTestId(`notification-ignore-notification_manual_ignore_${uniqueSuffix}`).click()
  await page.getByRole("tab", { name: /Ignored/ }).click()
  await expect(page.getByText("Simulasi ignore")).toBeVisible()
  await page.getByRole("tab", { name: /Semua/ }).click()

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

  const mobileUnlinkedPhone = "6287780004321"
  const mobileUnlinkedPayload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba_123",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "+62 877 8056 3875",
                phone_number_id: "1234567890",
              },
              contacts: [
                {
                  profile: { name: "MOBILE UNLINKED" },
                  wa_id: mobileUnlinkedPhone,
                },
              ],
              messages: [
                {
                  from: mobileUnlinkedPhone,
                  id: `wamid.inbound.mobile.${uniqueSuffix}`,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: {
                    body: "Halo dari mobile unlinked",
                  },
                },
              ],
            },
          },
        ],
      },
    ],
  }
  const signedMobileUnlinkedPayload = signWhatsappWebhookPayload(mobileUnlinkedPayload)
  const mobileWebhookResponse = await page.request.post("http://127.0.0.1:4100/v1/webhooks/meta/whatsapp", {
    data: signedMobileUnlinkedPayload.rawBody,
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signedMobileUnlinkedPayload.signature,
    },
  })
  expect(mobileWebhookResponse.ok()).toBeTruthy()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("http://127.0.0.1:3101/admin/whatsapp")
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "POS", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Laundry", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toBeVisible()
  await expect(page.getByRole("link", { name: "Pelanggan", exact: true })).toBeVisible()
  await expect(page.getByText("Phone Number ID")).toHaveCount(0)
  await page.getByTestId("whatsapp-provider-toggle").click()
  await expect(page.getByText("Phone Number ID")).toBeVisible()
  await page.getByTestId("whatsapp-thread-wa:62" + customerPhone.slice(1)).click()
  await expect(page).toHaveURL(new RegExp(`/admin/whatsapp/wa%3A62${customerPhone.slice(1)}$`))
  await expect(page.getByTestId("whatsapp-thread-back")).toBeVisible()
  await expect(page.getByTestId("whatsapp-linked-customer-link")).toBeVisible()
  await expect(page.getByTestId("whatsapp-composer-input")).toBeVisible()
  await expect(page.getByRole("link", { name: "Dashboard", exact: true })).toHaveCount(0)
  await page.getByTestId("whatsapp-thread-back").click()
  await expect(page).toHaveURL("http://127.0.0.1:3101/admin/whatsapp")

  await page.getByTestId(`whatsapp-thread-wa:${mobileUnlinkedPhone}`).click()
  await expect(page).toHaveURL(new RegExp(`/admin/whatsapp/wa%3A${mobileUnlinkedPhone}$`))
  await expect(page.getByTestId("whatsapp-linked-customer-link")).toHaveCount(0)
  await expect(page.getByTestId("whatsapp-composer-input")).toBeEnabled()
  await page.getByTestId("whatsapp-composer-input").fill("Balasan mobile unlinked")
  await page.getByTestId("whatsapp-send-button").click()
  await expect(
    page.locator('[data-testid^="whatsapp-message-"]').filter({
      hasText: "Balasan mobile unlinked",
    }).last()
  ).toBeVisible()
  await page.getByTestId("whatsapp-thread-back").click()
  await expect(page).toHaveURL("http://127.0.0.1:3101/admin/whatsapp")

  await publicPage.setViewportSize({ width: 390, height: 844 })
  await publicPage.goto("http://127.0.0.1:3100/portal")
  await publicPage.getByTestId("portal-mobile-logout").click()
  await expect(publicPage).toHaveURL(/\/login$/)

  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("http://127.0.0.1:3101/admin")
  await page.getByRole("button", { name: "Keluar" }).click()
  await expect(page).toHaveURL("http://127.0.0.1:3101/")
  await page.goto("http://127.0.0.1:3101/admin")
  await expect(page).toHaveURL("http://127.0.0.1:3101/")
})
