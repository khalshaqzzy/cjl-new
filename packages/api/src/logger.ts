import pino from "pino"
import { env } from "./env.js"

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "cjl-api",
    appEnv: env.APP_ENV,
    releaseSha: env.RELEASE_SHA,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

export const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    const status =
      "status" in error && typeof (error as { status?: unknown }).status === "number"
        ? (error as { status: number }).status
        : undefined
    const code =
      "code" in error && typeof (error as { code?: unknown }).code === "string"
        ? (error as { code: string }).code
        : undefined

    return {
      name: error.name,
      message: error.message,
      ...(typeof status === "number" ? { status } : {}),
      ...(code ? { code } : {}),
      stack: error.stack,
      cause: error.cause instanceof Error
        ? {
            name: error.cause.name,
            message: error.cause.message,
            stack: error.cause.stack,
          }
        : error.cause,
    }
  }

  return {
    message: String(error),
  }
}
