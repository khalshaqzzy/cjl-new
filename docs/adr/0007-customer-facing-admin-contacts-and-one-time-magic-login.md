# ADR 0007: Customer-Facing Admin Contacts and One-Time Magic Login

Status: Accepted  
Date: 2026-03-25  
Scope: public admin-contact settings, customer magic-link login, and split customer/admin session lifetimes

## Context

The repo already had:

- one WhatsApp gateway number paired to the bot runtime
- landing and public contact surfaces that effectively depended on a single public contact value
- lightweight customer login using normalized phone plus name
- one shared session middleware path for both admin and customer actors

The new requirements added several durable cross-app concerns at once:

- admin must manage multiple customer-facing WhatsApp numbers with one primary public contact
- landing page and portal chat CTA must resolve from that primary contact instead of from the gateway/bot number
- customer registration must send a one-time login link through WhatsApp
- admin must be able to show the same link as a QR code after registration and from customer detail
- customer session lifetime should slide for portal usage without giving admin the same longer session window

## Decision

The repo now standardizes on the following model:

1. settings store customer-facing admin contacts in `business.adminWhatsappContacts` as an ordered array with exactly one `isPrimary`
2. the bot-paired WhatsApp number remains a separate concept in `publicWhatsapp`
3. public customer-facing surfaces use the primary admin contact, with legacy backfill and fallback `087780563875` when older settings do not yet contain the new field
4. customer registration and admin customer-detail flows may create additional one-time magic-login tokens without revoking older unused tokens
5. each magic-link token is single-use only after a successful session save; token reuse fails
6. customer sessions use a sliding 30-day renewal policy, while admin sessions remain fixed at 7 days

## Rationale

- Separating gateway identity from customer-facing contact identity prevents the bot runtime from accidentally becoming the only public support number and supports multiple human admin numbers cleanly.
- Ordered contacts plus implicit `Admin 1 / Admin 2 / ...` labels satisfy the current UX requirement without introducing a larger editable-label product surface.
- One-time magic links reduce friction for first login while remaining safer than indefinite reusable autologin URLs.
- Allowing multiple active unused magic links matches the operational requirement to show additional QR codes later without invalidating earlier welcome messages.
- Splitting session behavior by actor improves customer UX without silently expanding admin exposure on shared or unattended devices.

## Consequences

Positive:

- landing, portal, and direct-status flows now share one canonical customer-facing contact source
- admin can expose more than one human WhatsApp number without touching gateway pairing
- first-time customer login is materially simpler through WhatsApp link or QR scan
- customer portal stays signed in longer through normal usage while admin remains comparatively tighter

Tradeoffs:

- settings validation and backfill rules are more complex than the previous single-phone model
- multiple active unused magic links increase the number of valid one-time login artifacts in circulation
- support/device policies now matter more because a customer session can stay alive for 30 days from latest use

## Follow-Up

- validate real-device scanning and link-open behavior on staging
- decide later whether admin-contact display names should remain implicit or become editable
- revisit token-expiry or manual token-revocation controls if operational risk grows after production usage
