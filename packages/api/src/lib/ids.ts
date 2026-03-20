import crypto from "crypto"

export const createId = (prefix: string) =>
  `${prefix}_${crypto.randomBytes(8).toString("hex")}`

export const createOpaqueToken = () =>
  crypto.randomBytes(24).toString("hex")

export const createOrderCode = (sequence: number, date = new Date()) => {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, "0")
  const day = `${date.getDate()}`.padStart(2, "0")
  return `CJ-${year}${month}${day}-${`${sequence}`.padStart(3, "0")}`
}
