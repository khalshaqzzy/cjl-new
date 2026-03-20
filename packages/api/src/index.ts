import { env } from "./env.js"
import { startServer } from "./server.js"

const bootstrap = async () => {
  await startServer()
  console.log(`CJ Laundry API listening on ${env.PORT}`)
}

bootstrap().catch((error) => {
  console.error(error)
  process.exit(1)
})
