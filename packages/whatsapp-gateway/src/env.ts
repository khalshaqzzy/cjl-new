import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(4100),
  WHATSAPP_GATEWAY_TOKEN: z.string().default("cjlaundry-whatsapp-internal-token"),
  WHATSAPP_AUTH_DIR: z.string().default("./.whatsapp-auth"),
  WHATSAPP_SESSION_CLIENT_ID: z.string().default("cjl-main"),
  WHATSAPP_API_BASE_URL: z.string().default("http://127.0.0.1:4000"),
  WHATSAPP_PUPPETEER_EXECUTABLE_PATH: z.string().optional(),
  WHATSAPP_DEVICE_NAME: z.string().default("CJ Laundry VM"),
  WHATSAPP_BROWSER_NAME: z.string().default("CJ Laundry Gateway"),
})

export const env = envSchema.parse(process.env)
