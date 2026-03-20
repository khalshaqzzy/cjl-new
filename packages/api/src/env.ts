import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const booleanLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true
    }
    if (["false", "0", "no", "off", ""].includes(normalized)) {
      return false
    }
  }

  return value
}, z.boolean())

const trustProxyLikeSchema = z.preprocess((value) => {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (/^\d+$/.test(normalized)) {
      return Number(normalized)
    }
    if (["true", "yes", "on"].includes(normalized)) {
      return true
    }
    if (["false", "no", "off", ""].includes(normalized)) {
      return false
    }
  }

  return value
}, z.union([z.boolean(), z.number().int().nonnegative()]))

const envSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production", "test"]).default("local"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/cjlaundry"),
  SESSION_SECRET: z.string().default("cjlaundry-dev-secret"),
  SESSION_COOKIE_SECURE: booleanLikeSchema.default(false),
  TRUST_PROXY: trustProxyLikeSchema.default(false),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  ADMIN_PASSWORD_HASH: z.string().optional(),
  APP_TIMEZONE: z.string().default("Asia/Jakarta"),
  ADMIN_ORIGIN: z.string().default("http://localhost:3001"),
  PUBLIC_ORIGIN: z.string().default("http://localhost:3000"),
  API_ORIGIN: z.string().default("http://localhost:4000"),
  WA_FAIL_MODE: z.enum(["never", "confirm-only", "all"]).default("never")
})

export const env = envSchema.parse(process.env)
