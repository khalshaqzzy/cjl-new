import bcrypt from "bcryptjs"
import type { AdminDocument, SettingsDocument } from "./types.js"
import { getDatabase } from "./db.js"
import { defaultSettings } from "./defaults.js"
import { env } from "./env.js"

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
  await db.collection("orders").createIndex({ orderCode: 1 }, { unique: true })
  await db.collection("direct_order_tokens").createIndex({ token: 1 }, { unique: true })
  await db.collection("notifications").createIndex({ businessKey: 1 }, { unique: true })
  await db.collection("idempotency_keys").createIndex({ scope: 1, key: 1 }, { unique: true })
}
