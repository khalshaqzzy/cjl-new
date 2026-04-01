# Session Handoff 2026-04-02

Document status: Active  
Purpose: repo snapshot after WhatsApp Business Platform migration Phase 2-3 implementation, admin template-editor removal, and Cloud API outbound activation

## What This Session Completed

- implemented WhatsApp migration Phase 2 and Phase 3 scope in the active app runtime
- removed `settings.messageTemplates` from:
  - backend settings schema and write path
  - admin settings UI
  - seed/upgrade logic
- introduced a runtime WhatsApp template registry module at `packages/api/src/lib/whatsapp-template-registry.ts`
- made the approved registry the runtime source of truth for:
  - template name
  - language
  - category
  - document-header requirement
  - fallback text generation
- added Cloud API env support in `packages/api/src/env.ts` and the runtime env examples
- added direct Cloud API outbound delivery via `packages/api/src/services/whatsapp-cloud.ts`
- switched automatic notification send flow to provider dispatch:
  - `disabled` for simulated acceptance
  - `cloud_api` for direct Graph API sends
- expanded contracts and persistence types for Cloud-era fields:
  - `providerKind`
  - `providerStatus`
  - `providerStatusAt`
  - `waId`
  - pricing/error metadata
  - CSW/FEP/composer state on WhatsApp chats
- removed pairing/reconnect/reset-session admin routes from the active API surface
- replaced the admin WhatsApp page with provider-health plus hybrid thread/message visibility
- removed the legacy template editor section from admin settings entirely
- removed `whatsapp-gateway` from active local and hosted compose/runtime topology
- updated backend integration tests to use a Cloud API stub instead of the legacy gateway stub
- updated E2E assertions so admin no longer expects template-editor UI or pairing controls
- added server-side template-parameter rehydration for resend of older notifications that were created before `templateParams` existed

## Verification Run

- `npm run test:backend`
- `npm run test:e2e`
- `npm run typecheck`
- `npm run lint`

All succeeded at session end.

## Important Repo Facts

- `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` is now the business source of truth and `packages/api/src/lib/whatsapp-template-registry.ts` is the runtime source of truth
- `cjl_welcome_v1` remains `MARKETING`; do not normalize it back to `UTILITY`
- `settings.messageTemplates` is no longer part of the product surface or API contract
- the active outbound provider path is now Cloud API oriented; the legacy gateway package remains in repo only as deprecated compatibility code
- `/v1/internal/whatsapp/events` still exists as a legacy bridge for mirrored data, but new Cloud work must not add more coupling to `providerAck`, `providerChatId`, or `@c.us`
- admin WhatsApp now presents provider health plus hybrid thread/message read models; it is no longer a linked-device control surface
- current Phase 3 scope covers outbound send only; Meta webhook verification/inbound ingestion/manual composer are still pending
- deploy runbooks outside the touched runtime files still contain stale gateway-era guidance and need a later documentation cleanup pass

## Recommended Next Start

1. implement Phase 4 webhook verification and ingestion:
   - `GET/POST /v1/webhooks/meta/whatsapp`
   - signature verification
   - inbound message ingest
   - status/pricing ingest
2. implement Phase 5-6 admin inbox completion:
   - webhook-backed timeline truth
   - manual free-form send only when CSW is open
3. clean up stale internals/runbooks that still talk about `whatsapp-gateway`, token fingerprint parity, or pairing controls
4. backfill real Meta template IDs into `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` if the operator has them
