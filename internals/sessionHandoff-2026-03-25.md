# Session Handoff 2026-03-25

Document status: Active  
Purpose: repo snapshot after WhatsApp runtime integration, customer magic-login rollout, and push-to-prod hardening implementation

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
- added production-grade API and gateway structured logging with request correlation through `X-Request-Id`
- replaced generic API error handling with typed status mapping and stable error envelopes including `error.code` and `error.requestId`
- hardened hosted env validation so staging and production reject placeholder secrets, unsafe hosted origins, and missing secure-cookie/proxy assumptions
- added trusted-origin enforcement for session-authenticated write routes without changing customer login UX
- replaced in-memory abuse controls with Mongo-backed rate limiting for admin login, customer login, token redeem, and admin WhatsApp control paths
- moved customer magic-link and direct order status tokens to hashed persistence with rollout-safe legacy compatibility handling
- extended audit log shape with request correlation, outcome, actor source, and masked network metadata
- added frontend API error normalization plus global/local Next.js error boundaries for admin and public surfaces
- upgraded both Next.js apps to a patched version line and removed build-time TypeScript ignore behavior
- hardened hosted/container runtime:
  - API, admin, and public images now run as non-root
  - WhatsApp gateway remains a documented temporary root-runtime exception pending staging validation
- expanded CI and deploy workflows with lint, typecheck, audit, secret scanning, Trivy, CodeQL, dependency review, and rollback-on-smoke-failure automation
- added ADR `docs/adr/0008-ux-first-production-hardening-baseline.md`
- added `internals/productionReadinessChecklist.md` as the final pre-production gate

## Verification Run

- `npm run lint`
- `npm run typecheck`
- `npm run audit:prod`
- `npm run build`
- `npm run security:scan`
- `npm run test:backend`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts --reporter=line`
- `docker compose config`

All passed at session end.

`docker compose build` could not be validated locally because Docker Desktop or the local Docker daemon was unavailable on the operator machine at session end.

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
- production-readiness hardening is now implemented in repo terms; the remaining work is mostly environment validation, real-device WhatsApp validation, and first hosted rollout proof
- `/ready` now exposes release metadata and dependency state and should be treated as the primary runtime triage endpoint
- first production push should stay blocked until `internals/productionReadinessChecklist.md` is fully executed on staging
- API/admin/public containers are expected to run non-root in hosted environments; the gateway root exception is temporary and must be revisited after staging permission validation

## Recommended Next Start

1. provision or refresh the staging VM secrets and run the first full staging deploy using the hardened CI and rollback path
2. execute `internals/productionReadinessChecklist.md` on staging, including request-id tracing, rollback proof, error-code validation, and security-header checks
3. validate real-device welcome WA, magic-link open and QR scan usability, reconnect behavior, and WhatsApp auth-volume persistence before touching production
