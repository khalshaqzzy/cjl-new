import { env } from "./env.js"
import { logger, serializeError } from "./logger.js"
import { startServer } from "./server.js"

let shutdownPromise: Promise<void> | null = null

const bootstrap = async () => {
  const runtime = await startServer()
  logger.info({
    event: "api.server.started",
    port: env.PORT,
    releaseSha: env.RELEASE_SHA,
  })

  const shutdown = (signal: string) => {
    if (shutdownPromise) {
      return shutdownPromise
    }

    logger.info({
      event: "api.server.stopping",
      signal,
    })

    shutdownPromise = runtime.stopServer()
      .then(() => {
        logger.info({
          event: "api.server.stopped",
          signal,
        })
      })
      .catch((error) => {
        logger.error({
          event: "api.server.stop_failed",
          signal,
          error: serializeError(error),
        })
        process.exitCode = 1
      })
      .finally(() => {
        process.exit()
      })

    return shutdownPromise
  }

  process.on("SIGINT", () => {
    void shutdown("SIGINT")
  })
  process.on("SIGTERM", () => {
    void shutdown("SIGTERM")
  })
}

bootstrap().catch((error) => {
  logger.error({
    event: "api.bootstrap.failed",
    error: serializeError(error),
  })
  process.exit(1)
})
