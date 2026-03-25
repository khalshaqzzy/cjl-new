import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  APP_ENV: z.enum(["local", "staging", "production", "test"]).default("local"),
  PORT: z.coerce.number().int().positive().default(4100),
  WHATSAPP_GATEWAY_TOKEN: z.string().default("cjlaundry-whatsapp-internal-token"),
  WHATSAPP_AUTH_DIR: z.string().default("./.whatsapp-auth"),
  WHATSAPP_SESSION_CLIENT_ID: z.string().default("cjl-main"),
  WHATSAPP_API_BASE_URL: z.string().default("http://127.0.0.1:4000"),
  WHATSAPP_PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  WHATSAPP_DEVICE_NAME: z.string().default("CJ Laundry VM"),
  WHATSAPP_BROWSER_NAME: z.string().default("CJ Laundry Gateway"),
  RELEASE_SHA: z.string().default("dev"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
}).superRefine((value, context) => {
  if (value.APP_ENV === "local" || value.APP_ENV === "test") {
    return
  }

  if (
    !value.WHATSAPP_GATEWAY_TOKEN.trim() ||
    value.WHATSAPP_GATEWAY_TOKEN.includes("internal-token") ||
    value.WHATSAPP_GATEWAY_TOKEN.startsWith("replace-me")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["WHATSAPP_GATEWAY_TOKEN"],
      message: "WHATSAPP_GATEWAY_TOKEN wajib diisi dengan secret yang valid",
    })
  }
})

export const env = envSchema.parse(process.env)
