import pino from "pino"
import { env } from "./env.js"

export const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "cjl-whatsapp-gateway",
    appEnv: env.APP_ENV,
    releaseSha: env.RELEASE_SHA,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
})

export const serializeError = (error: unknown) => {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
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
