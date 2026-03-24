# Session Handoff 2026-03-25

Document status: Active  
Purpose: repo snapshot after WhatsApp runtime integration plus multi-admin customer contact and magic-login implementation

## What This Session Completed

- kept the real WhatsApp gateway/runtime integration and extended the app-facing contracts around customer contact and login
- added `business.adminWhatsappContacts` as an ordered settings field with legacy backfill and exactly one `isPrimary` contact for customer-facing surfaces
- preserved `publicWhatsapp` as the bot/gateway number instead of overloading it as the public admin-contact list
- updated landing and public direct-status/dashboard contact flows to resolve from the primary admin WhatsApp contact with fallback `087780563875`
- updated admin settings UI to manage multiple WhatsApp contacts, add/remove numbers, and switch the primary public contact
- added portal `Chat Admin` UI with mobile-first contact picker using `Admin 1 / Admin 2 / ...` labels
- added explicit mobile logout affordance in the customer portal shell
- added one-time customer magic-link generation and redeem flow:
  - create-customer returns `oneTimeLogin.url` for new customers
  - welcome WA copy now supports `{{autoLoginUrl}}`
  - admin POS and customer-create flows can optionally open a QR sheet after registration
  - customer detail can generate additional QR/login links without revoking older unused tokens
  - public `/auto-login` route redeems a token once, creates a customer session, and rejects reuse
- split session behavior by actor:
  - admin remains on a 7-day session
  - customer gets a 30-day sliding session refreshed on authenticated requests
- expanded backend integration coverage and frontend E2E coverage for the above flows
- added ADR `docs/adr/0007-customer-facing-admin-contacts-and-one-time-magic-login.md`

## Verification Run

- `npm run build`
- `npm run test:backend`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts --reporter=line`

All passed at session end.

## Important Repo Facts

- WhatsApp delivery is now real in repo terms, but still needs real-device staging validation before production rollout
- the gateway is intentionally internal-only and must not be exposed through Caddy/public routing
- mirrored WhatsApp inbox data is API-owned and read-only in v1; operators still reply from the real WhatsApp client
- local and hosted runtimes now require a stable `WHATSAPP_GATEWAY_TOKEN`
- hosted runtime now depends on a persistent `${SHARED_DIR}/whatsapp-auth` mount for session survival
- hosted staging and production domains are now canonical on `cjlaundry.com`, not `cjlaundry.site`
- deploy workflows now render hosted WhatsApp runtime vars so first VM rollout includes `WHATSAPP_ENABLED=true` and the gateway token
- the gateway-paired WhatsApp number and the customer-facing admin contact list are now intentionally separate settings concepts
- if legacy settings lack `adminWhatsappContacts`, backend read/update paths backfill from `publicContactPhone`, then `publicWhatsapp`, then fallback `087780563875`
- one-time customer magic links are stored server-side and deactivated per token only after a successful login session is saved
- generating a new magic link from customer detail does not revoke older active unused tokens
- customer session extension is sliding 30 days from the latest authenticated portal request; admin remains fixed at 7 days

## Recommended Next Start

1. provision/refresh staging secrets and run the first staging deploy with the WhatsApp gateway enabled
2. validate real-device welcome WA plus magic-link open/scan behavior, including repeated portal use refreshing the 30-day customer session
3. verify the distinction between bot-paired WhatsApp number and customer-facing admin contact numbers on staging before touching production
