import bcrypt from "bcryptjs"
import type { AdminDocument, SettingsDocument } from "./types.js"
import { getDatabase } from "./db.js"
import { defaultMessageTemplates, defaultSettings, legacyDefaultMessageTemplates } from "./defaults.js"
import { env } from "./env.js"
import { sanitizeAdminWhatsappContacts } from "./lib/admin-whatsapp.js"
import { formatCustomerName, normalizeName, normalizePhone } from "./lib/normalization.js"

export const ensureSeedData = async () => {
  const db = getDatabase()
  const settingsCollection = db.collection<SettingsDocument>("settings")
  const adminCollection = db.collection<AdminDocument>("admins")
  const previousDefaultWelcomeTemplate = `Halo {{customerName}}!

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

Simpan pesan ini ya. Terima kasih sudah mempercayakan cucian Anda ke CJ Laundry.`

  const existingSettings = await settingsCollection.findOne({ _id: "app-settings" })
  if (!existingSettings) {
    await settingsCollection.insertOne(defaultSettings())
  } else {
    const isLegacyMessageTemplate =
      existingSettings.messageTemplates.welcome === legacyDefaultMessageTemplates.welcome &&
      existingSettings.messageTemplates.orderConfirmed === legacyDefaultMessageTemplates.orderConfirmed &&
      existingSettings.messageTemplates.orderDone === legacyDefaultMessageTemplates.orderDone &&
      existingSettings.messageTemplates.orderVoidNotice === legacyDefaultMessageTemplates.orderVoidNotice &&
      existingSettings.messageTemplates.accountInfo === legacyDefaultMessageTemplates.accountInfo

    const shouldUpgradeWelcomeTemplate =
      isLegacyMessageTemplate ||
      existingSettings.messageTemplates.welcome === previousDefaultWelcomeTemplate

    const nextAdminWhatsappContacts = sanitizeAdminWhatsappContacts(
      existingSettings.business.adminWhatsappContacts,
      [
        existingSettings.business.publicContactPhone,
        existingSettings.business.publicWhatsapp,
      ]
    )

    if (isLegacyMessageTemplate) {
      await settingsCollection.updateOne(
        { _id: "app-settings" },
        {
          $set: {
            messageTemplates: defaultMessageTemplates,
            "business.adminWhatsappContacts": nextAdminWhatsappContacts,
            updatedAt: new Date().toISOString()
          }
        }
      )
    } else if (
      shouldUpgradeWelcomeTemplate ||
      JSON.stringify(nextAdminWhatsappContacts) !== JSON.stringify(existingSettings.business.adminWhatsappContacts ?? [])
    ) {
      await settingsCollection.updateOne(
        { _id: "app-settings" },
        {
          $set: {
            ...(shouldUpgradeWelcomeTemplate
              ? {
                  messageTemplates: {
                    ...existingSettings.messageTemplates,
                    welcome: defaultMessageTemplates.welcome,
                  },
                }
              : {}),
            "business.adminWhatsappContacts": nextAdminWhatsappContacts,
            updatedAt: new Date().toISOString(),
          }
        }
      )
    }
  }

  const admin = await adminCollection.findOne({ username: env.ADMIN_USERNAME })
  if (!admin) {
    const passwordHash = env.ADMIN_PASSWORD_HASH ?? (await bcrypt.hash(env.ADMIN_PASSWORD, 10))
    await adminCollection.insertOne({
      _id: "admin-primary",
      username: env.ADMIN_USERNAME,
      passwordHash,
      createdAt: new Date().toISOString()
    })
  }

  await db.collection("customers").createIndex({ normalizedPhone: 1 }, { unique: true })
  await db.collection("customers").createIndex({ phoneDigits: 1 })
  await db.collection("customers").createIndex({ normalizedName: 1 })
  await db.collection("customer_magic_links").createIndex({ token: 1 }, { unique: true })
  await db.collection("customer_magic_links").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("orders").createIndex({ orderCode: 1 }, { unique: true })
  await db.collection("orders").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("orders").createIndex({ status: 1, createdAt: -1 })
  await db.collection("direct_order_tokens").createIndex({ token: 1 }, { unique: true })
  await db.collection("direct_order_tokens").createIndex({ orderId: 1 })
  await db.collection("notifications").createIndex({ businessKey: 1 }, { unique: true })
  await db.collection("notifications").createIndex({ deliveryStatus: 1, createdAt: 1 })
  await db.collection("notifications").createIndex({ eventType: 1, renderStatus: 1, createdAt: 1 })
  await db.collection("notifications").createIndex({ providerMessageId: 1 }, { sparse: true })
  await db.collection("idempotency_keys").createIndex({ scope: 1, key: 1 }, { unique: true })
  await db.collection("point_ledgers").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("point_ledgers").createIndex({ orderId: 1 })
  await db.collection("leaderboard_snapshots").createIndex({ monthKey: 1, version: -1 }, { unique: true })
  await db.collection("audit_logs").createIndex({ entityType: 1, entityId: 1, createdAt: -1 })
  await db.collection("whatsapp_chats").createIndex({ lastMessageAt: -1, updatedAt: -1 })
  await db.collection("whatsapp_chats").createIndex({ phone: 1 }, { sparse: true })
  await db.collection("whatsapp_messages").createIndex({ chatId: 1, timestampIso: 1 })
  await db.collection("whatsapp_messages").createIndex({ phone: 1 }, { sparse: true })

  const customers = await db.collection("customers").find({}).toArray()

  for (const customer of customers) {
    const formattedName = formatCustomerName(customer.name)
    const normalizedCustomerName = normalizeName(customer.name)
    const nextPhoneDigits = normalizePhone(customer.phone).replace(/\D/g, "")
    const nextPublicNameVisible = customer.publicNameVisible ?? false
    if (
      customer.name === formattedName &&
      customer.normalizedName === normalizedCustomerName &&
      customer.phoneDigits === nextPhoneDigits &&
      customer.publicNameVisible === nextPublicNameVisible
    ) {
      continue
    }

    await db.collection("customers").updateOne(
      { _id: customer._id },
      {
        $set: {
          name: formattedName,
          normalizedName: normalizedCustomerName,
          phoneDigits: nextPhoneDigits,
          publicNameVisible: nextPublicNameVisible
        }
      }
    )
  }

  await db.collection("customers").updateMany(
    { publicNameVisible: { $exists: false } },
    { $set: { publicNameVisible: false } }
  )

  const orders = await db.collection("orders").find({}).toArray()
  for (const order of orders) {
    const customerName = formatCustomerName(order.customerName)
    const receiptCustomerName = formatCustomerName(order.receiptSnapshot?.customerName ?? order.customerName)
    if (
      customerName === order.customerName &&
      receiptCustomerName === order.receiptSnapshot?.customerName
    ) {
      continue
    }

    await db.collection("orders").updateOne(
      { _id: order._id },
      {
        $set: {
          customerName,
          "receiptSnapshot.customerName": receiptCustomerName
        }
      }
    )
  }

  const notifications = await db.collection("notifications").find({}).toArray()
  for (const notification of notifications) {
    const customerName = formatCustomerName(notification.customerName)
    if (customerName === notification.customerName) {
      continue
    }

    await db.collection("notifications").updateOne(
      { _id: notification._id },
      { $set: { customerName } }
    )
  }
}
