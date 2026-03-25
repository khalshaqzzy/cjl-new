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
  RELEASE_SHA: z.string().default("dev"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WHATSAPP_ENABLED: booleanLikeSchema.default(false),
  WHATSAPP_GATEWAY_URL: z.string().default("http://127.0.0.1:4100"),
  WHATSAPP_GATEWAY_TOKEN: z.string().default("cjlaundry-whatsapp-internal-token"),
  WHATSAPP_AUTH_DIR: z.string().default("./.whatsapp-auth"),
  WHATSAPP_CHROMIUM_EXECUTABLE_PATH: z.string().optional(),
  WA_FAIL_MODE: z.enum(["never", "confirm-only", "all"]).default("never"),
  OUTBOX_POLL_MS: z.coerce.number().int().positive().default(250)
}).superRefine((value, context) => {
  if (value.APP_ENV === "local" || value.APP_ENV === "test") {
    return
  }

  const placeholderSecrets = new Map<string, string | undefined>([
    ["SESSION_SECRET", value.SESSION_SECRET],
    ["WHATSAPP_GATEWAY_TOKEN", value.WHATSAPP_GATEWAY_TOKEN],
    ["ADMIN_PASSWORD_HASH", value.ADMIN_PASSWORD_HASH],
  ])

  for (const [field, currentValue] of placeholderSecrets.entries()) {
    const normalized = currentValue?.trim()
    if (
      !normalized ||
      normalized.startsWith("replace-me") ||
      normalized.includes("dev-secret") ||
      normalized.includes("internal-token")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} harus diisi dengan secret production/staging yang valid`,
      })
    }
  }

  if (value.SESSION_COOKIE_SECURE !== true) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["SESSION_COOKIE_SECURE"],
      message: "SESSION_COOKIE_SECURE wajib true pada staging/production",
    })
  }

  if (value.TRUST_PROXY !== true && value.TRUST_PROXY !== 1) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["TRUST_PROXY"],
      message: "TRUST_PROXY wajib aktif pada staging/production",
    })
  }

  for (const [field, origin] of [
    ["ADMIN_ORIGIN", value.ADMIN_ORIGIN],
    ["PUBLIC_ORIGIN", value.PUBLIC_ORIGIN],
    ["API_ORIGIN", value.API_ORIGIN],
  ] as const) {
    if (!origin.startsWith("https://")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} wajib memakai HTTPS pada staging/production`,
      })
    }
  }
})

export const env = envSchema.parse(process.env)
