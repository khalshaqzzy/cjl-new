import bcrypt from "bcryptjs"
import type { AdminDocument, SettingsDocument } from "./types.js"
import { getDatabase } from "./db.js"
import { defaultSettings } from "./defaults.js"
import { env } from "./env.js"
import { normalizePhone } from "./lib/normalization.js"

export const ensureSeedData = async () => {
  const db = getDatabase()
  const settingsCollection = db.collection<SettingsDocument>("settings")
  const adminCollection = db.collection<AdminDocument>("admins")

  const existingSettings = await settingsCollection.findOne({ _id: "app-settings" })
  if (!existingSettings) {
    await settingsCollection.insertOne(defaultSettings())
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
  await db.collection("orders").createIndex({ orderCode: 1 }, { unique: true })
  await db.collection("orders").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("orders").createIndex({ status: 1, createdAt: -1 })
  await db.collection("direct_order_tokens").createIndex({ token: 1 }, { unique: true })
  await db.collection("direct_order_tokens").createIndex({ orderId: 1 })
  await db.collection("notifications").createIndex({ businessKey: 1 }, { unique: true })
  await db.collection("notifications").createIndex({ deliveryStatus: 1, createdAt: 1 })
  await db.collection("notifications").createIndex({ eventType: 1, renderStatus: 1, createdAt: 1 })
  await db.collection("idempotency_keys").createIndex({ scope: 1, key: 1 }, { unique: true })
  await db.collection("point_ledgers").createIndex({ customerId: 1, createdAt: -1 })
  await db.collection("point_ledgers").createIndex({ orderId: 1 })
  await db.collection("leaderboard_snapshots").createIndex({ monthKey: 1, version: -1 }, { unique: true })
  await db.collection("audit_logs").createIndex({ entityType: 1, entityId: 1, createdAt: -1 })

  const customers = await db.collection("customers").find({
    $or: [
      { phoneDigits: { $exists: false } },
      { phoneDigits: "" }
    ]
  }).toArray()

  for (const customer of customers) {
    await db.collection("customers").updateOne(
      { _id: customer._id },
      {
        $set: {
          phoneDigits: normalizePhone(customer.phone).replace(/\D/g, "")
        }
      }
    )
  }
}
