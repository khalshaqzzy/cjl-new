import crypto from "crypto"

export const createId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(8).toString("hex")}`

export const createOpaqueToken = () =>
  crypto.randomBytes(24).toString("hex")

const orderCodeAlphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

const buildOrderSuffix = (seed: string, length = 3) => {
  const digest = crypto.createHash("sha256").update(seed).digest()
  let suffix = ""

  for (let index = 0; index < length; index += 1) {
    suffix += orderCodeAlphabet[digest[index] % orderCodeAlphabet.length]
  }

  return suffix
}

export const createOrderCode = (seed: string, date = new Date()) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `CJ-${year}${month}${day}-${buildOrderSuffix(seed)}`
}
