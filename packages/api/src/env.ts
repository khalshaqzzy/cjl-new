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

const deprecatedWhatsappRuntimeFields = [
  "WHATSAPP_ENABLED",
  "WHATSAPP_GATEWAY_URL",
  "WHATSAPP_GATEWAY_TOKEN",
  "WHATSAPP_AUTH_DIR",
  "WHATSAPP_CHROMIUM_EXECUTABLE_PATH",
] as const

const envSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production", "test"]).default("local"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/cjlaundry"),
  SESSION_SECRET: z.string().default("cjlaundry-dev-secret"),
  SESSION_COOKIE_SECURE: booleanLikeSchema.default(false),
  TRUST_PROXY: trustProxyLikeSchema.default(false),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  ADMIN_BOOTSTRAP_USERNAME: z.string().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().optional(),
  APP_TIMEZONE: z.string().default("Asia/Jakarta"),
  ADMIN_ORIGIN: z.string().default("http://localhost:3001"),
  PUBLIC_ORIGIN: z.string().default("http://localhost:3000"),
  API_ORIGIN: z.string().default("http://localhost:4000"),
  RELEASE_SHA: z.string().default("dev"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  WHATSAPP_PROVIDER: z.enum(["cloud_api", "disabled"]).default("disabled"),
  WHATSAPP_GRAPH_API_VERSION: z.string().default("v25.0"),
  WHATSAPP_GRAPH_API_BASE_URL: z.string().default("https://graph.facebook.com"),
  WHATSAPP_BUSINESS_ID: z.string().optional(),
  WHATSAPP_WABA_ID: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_PATH: z.string().default("/v1/webhooks/meta/whatsapp"),
  WA_FAIL_MODE: z.enum(["never", "confirm-only", "all"]).default("never"),
  OUTBOX_POLL_MS: z.coerce.number().int().positive().default(250)
}).superRefine((value, context) => {
  if (value.APP_ENV === "local" || value.APP_ENV === "test") {
    if (value.WHATSAPP_PROVIDER === "cloud_api") {
      for (const field of [
        "WHATSAPP_BUSINESS_ID",
        "WHATSAPP_WABA_ID",
        "WHATSAPP_PHONE_NUMBER_ID",
        "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_APP_SECRET",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
      ] as const) {
        const currentValue = value[field]
        if (!currentValue?.trim()) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [field],
            message: `${field} wajib diisi saat WHATSAPP_PROVIDER=cloud_api`,
          })
        }
      }
    }

    return
  }

  const placeholderSecrets = new Map<string, string | undefined>([
    ["SESSION_SECRET", value.SESSION_SECRET],
    ["ADMIN_BOOTSTRAP_PASSWORD", value.ADMIN_BOOTSTRAP_PASSWORD],
    ["WHATSAPP_ACCESS_TOKEN", value.WHATSAPP_ACCESS_TOKEN],
    ["WHATSAPP_APP_SECRET", value.WHATSAPP_APP_SECRET],
    ["WHATSAPP_WEBHOOK_VERIFY_TOKEN", value.WHATSAPP_WEBHOOK_VERIFY_TOKEN],
  ])

  for (const [field, currentValue] of placeholderSecrets.entries()) {
    const normalized = currentValue?.trim()
    if (
      !normalized ||
      normalized.startsWith("replace-me") ||
      normalized === "admin123" ||
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

  if (!value.ADMIN_BOOTSTRAP_USERNAME?.trim()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ADMIN_BOOTSTRAP_USERNAME"],
      message: "ADMIN_BOOTSTRAP_USERNAME wajib diisi pada staging/production",
    })
  }

  if (value.WHATSAPP_PROVIDER === "cloud_api") {
    for (const field of [
      "WHATSAPP_BUSINESS_ID",
      "WHATSAPP_WABA_ID",
      "WHATSAPP_PHONE_NUMBER_ID",
      "WHATSAPP_ACCESS_TOKEN",
      "WHATSAPP_APP_SECRET",
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
    ] as const) {
      const currentValue = value[field]
      if (!currentValue?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} wajib diisi saat WHATSAPP_PROVIDER=cloud_api`,
        })
      }
    }
  }
})

export const parseEnv = (input: NodeJS.ProcessEnv) => {
  const parsed = envSchema.safeParse(input)
  const deprecatedIssues = deprecatedWhatsappRuntimeFields.flatMap((field) =>
    Object.prototype.hasOwnProperty.call(input, field)
      ? [{
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} sudah retired untuk runtime Cloud-only; hapus variabel ini dari env aktif`,
        }]
      : []
  )

  if (!parsed.success || deprecatedIssues.length > 0) {
    throw new z.ZodError([
      ...(parsed.success ? [] : parsed.error.issues),
      ...deprecatedIssues,
    ])
  }

  return parsed.data
}

export const env = parseEnv(process.env)
