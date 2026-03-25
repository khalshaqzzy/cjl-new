import type { AdminWhatsappContact } from "@cjl/contracts"
import { normalizePhoneLabel, normalizeWhatsappPhone } from "./normalization.js"

export const ADMIN_WHATSAPP_FALLBACK_PHONE = "087780563875"

export const sanitizeAdminWhatsappContacts = (
  contacts: AdminWhatsappContact[] | undefined,
  fallbackCandidates: string[] = []
): AdminWhatsappContact[] => {
  const uniqueContacts: AdminWhatsappContact[] = []
  const seen = new Set<string>()

  for (const [index, contact] of (contacts ?? []).entries()) {
    const phone = normalizePhoneLabel(contact.phone)
    if (!phone) {
      continue
    }

    const digits = normalizeWhatsappPhone(phone)
    if (!digits || seen.has(digits)) {
      continue
    }

    seen.add(digits)
    uniqueContacts.push({
      id: contact.id?.trim() || `admin-contact-${index + 1}`,
      phone,
      isPrimary: contact.isPrimary,
    })
  }

  if (uniqueContacts.length === 0) {
    const fallbackPhone =
      fallbackCandidates.map(normalizePhoneLabel).find(Boolean) ?? ADMIN_WHATSAPP_FALLBACK_PHONE

    uniqueContacts.push({
      id: "admin-contact-1",
      phone: fallbackPhone,
      isPrimary: true,
    })
  }

  const primaryIndex = uniqueContacts.findIndex((contact) => contact.isPrimary)
  const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0

  return uniqueContacts.map((contact, index) => ({
    ...contact,
    isPrimary: index === resolvedPrimaryIndex,
  }))
}

export const resolvePrimaryAdminWhatsappContact = (
  contacts: AdminWhatsappContact[] | undefined,
  fallbackCandidates: string[] = []
) => {
  const sanitizedContacts = sanitizeAdminWhatsappContacts(contacts, fallbackCandidates)
  return sanitizedContacts.find((contact) => contact.isPrimary) ?? sanitizedContacts[0]
}
