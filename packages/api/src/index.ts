import { createApp } from "./app.js"
import { connectDatabase } from "./db.js"
import { env } from "./env.js"
import { ensureSeedData } from "./seed.js"

const bootstrap = async () => {
  await connectDatabase()
  await ensureSeedData()
  const app = createApp()
  app.listen(env.PORT, () => {
    console.log(`CJ Laundry API listening on ${env.PORT}`)
  })
}

bootstrap().catch((error) => {
  console.error(error)
  process.exit(1)
})
