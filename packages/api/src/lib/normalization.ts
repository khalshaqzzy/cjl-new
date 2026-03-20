export const normalizeName = (value: string) =>
  value.trim().replace(/\s+/g, " ").toLowerCase()

export const normalizePhone = (value: string) => {
  const digits = value.replace(/\D/g, "")
  if (!digits) {
    return ""
  }

  if (digits.startsWith("62")) {
    return `+${digits}`
  }

  if (digits.startsWith("0")) {
    return `+62${digits.slice(1)}`
  }

  return `+62${digits}`
}

export const normalizeWhatsappPhone = (value: string) =>
  normalizePhone(value).replace(/\D/g, "")
