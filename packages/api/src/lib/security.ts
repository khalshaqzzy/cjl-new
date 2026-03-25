import crypto from "node:crypto"

const sha256 = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex")

export const hashOpaqueToken = (token: string) => sha256(token)

export const maskPhone = (phone?: string) => {
  if (!phone) {
    return undefined
  }

  const digits = phone.replace(/\D/g, "")
  if (digits.length <= 4) {
    return `***${digits}`
  }

  return `${digits.slice(0, 2)}***${digits.slice(-2)}`
}

export const maskToken = (token?: string) => {
  if (!token) {
    return undefined
  }

  if (token.length <= 8) {
    return "***"
  }

  return `${token.slice(0, 4)}...${token.slice(-4)}`
}

export const tokenLast4 = (token: string) => token.slice(-4)

export const hashIpAddress = (ip?: string) => {
  if (!ip) {
    return undefined
  }

  return sha256(ip).slice(0, 16)
}

export const fingerprintUserAgent = (userAgent?: string) => {
  if (!userAgent) {
    return undefined
  }

  return userAgent.slice(0, 160)
}
