import dotenv from "dotenv"
import { z } from "zod"

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default("mongodb://127.0.0.1:27017/cjlaundry"),
  SESSION_SECRET: z.string().default("cjlaundry-dev-secret"),
  ADMIN_USERNAME: z.string().default("admin"),
  ADMIN_PASSWORD: z.string().default("admin123"),
  APP_TIMEZONE: z.string().default("Asia/Jakarta"),
  ADMIN_ORIGIN: z.string().default("http://localhost:3001"),
  PUBLIC_ORIGIN: z.string().default("http://localhost:3000"),
  API_ORIGIN: z.string().default("http://localhost:4000"),
  WA_FAIL_MODE: z.enum(["never", "confirm-only", "all"]).default("never")
})

export const env = envSchema.parse(process.env)
