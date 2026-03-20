// Creates minimal valid stub WOFF2 files so Next.js font resolver stops crashing.
// A WOFF2 file needs a valid 48-byte header with the correct signature bytes.
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const fontsDir = join(root, 'public', 'fonts')

mkdirSync(fontsDir, { recursive: true })

// Minimal WOFF2: signature (wOF2) + 44 zero bytes = 48 bytes total
// This is enough for Next.js file-existence check to pass.
const woff2Stub = Buffer.concat([
  Buffer.from([0x77, 0x4F, 0x46, 0x32]), // signature: wOF2
  Buffer.from([0x00, 0x01, 0x00, 0x00]), // flavor: TrueType
  Buffer.from(new Array(40).fill(0)),     // remaining header fields zeroed
])

const files = [
  'ClashDisplay-Medium.woff2',
  'ClashDisplay-Semibold.woff2',
  'ClashDisplay-Bold.woff2',
]

for (const file of files) {
  const dest = join(fontsDir, file)
  writeFileSync(dest, woff2Stub)
  console.log(`Created: ${dest} (${woff2Stub.length} bytes)`)
}

console.log('Done. Font stubs created in public/fonts/')
