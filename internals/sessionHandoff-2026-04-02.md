# Session Handoff 2026-04-02

Document status: Active  
Purpose: repo snapshot after WhatsApp Business Platform migration Phase 5-6 admin inbox completion, CSW-only manual send, and primary-nav promotion

## What This Session Completed

- kept the existing webhook-driven Cloud API runtime and completed the Phase 5-6 product surface on top of it
- added admin mutation endpoints:
  - `POST /v1/admin/whatsapp/chats/:chatId/messages`
  - `POST /v1/admin/whatsapp/chats/:chatId/read`
- added dedicated manual-send orchestration in `packages/api/src/services/whatsapp-manual-send.ts`
- enforced server-side manual-send eligibility:
  - Cloud provider must be active and configured
  - recipient identity must resolve from canonical chat data
  - CSW must be open even if FEP remains open
- persisted accepted operator replies as `source = manual_operator` and let later webhook statuses advance the same message record
- added explicit unread clearing that zeros `unreadCount` only when an operator intentionally opens a thread
- promoted `/admin/whatsapp` into the primary desktop nav and five-item mobile bottom nav
- upgraded the admin WhatsApp page into a full inbox surface with:
  - searchable thread list
  - desktop split-pane inbox layout
  - mobile full-height thread sheet
  - linked-customer CTA into `/admin/pelanggan/[id]`
  - message source/status/pricing badges
  - media-open affordance using the existing admin-only media endpoint
  - CSW-aware composer with template-only disabled state
- updated integration coverage for:
  - explicit unread-clear mutation
  - CSW-open operator reply success
  - idempotent manual-send replay
  - CSW-closed manual-send rejection
  - missing-recipient rejection
- updated E2E coverage for:
  - primary-nav and mobile-bottom-nav WhatsApp visibility
  - unread badge clearing on thread open
  - linked-customer CTA
  - media-open affordance
  - manual reply rendering
  - template-only disabled composer state

## Verification Run

- `npm run lint`
- `npm run typecheck`
- `npm run test:backend`
- `npm run test:e2e`

All succeeded at session end.

## Important Repo Facts

- `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` is still the business source of truth and `packages/api/src/lib/whatsapp-template-registry.ts` is still the runtime source of truth
- `cjl_welcome_v1` remains `MARKETING`; do not normalize it back to `UTILITY`
- the active outbound provider path is Cloud API and the active inbound/status truth path is now the signed Meta webhook
- `/v1/internal/whatsapp/events` still exists only as a legacy bridge for mirrored-data compatibility; new Cloud work must not add fresh coupling to `providerAck`, `providerChatId`, or `@c.us`
- admin WhatsApp is now a first-party inbox surface reachable from the primary admin nav and mobile bottom nav
- manual operator send is implemented only for text-only same-thread replies when `composerMode === "free_form"` / CSW is open
- template sending from the inbox is still out of scope; template-only is an informational disabled state only
- ADR `0020-whatsapp-first-party-inbox-and-csw-only-manual-operator-send.md` freezes the nav, unread-clear, media-open, and manual-send scope decisions from this session
- inbound media binaries are now stored in Mongo GridFS and referenced from `whatsapp_messages`, not from VM-local filesystem paths
- template lifecycle webhook events are backend-audited only in this phase; no admin UI has been added for them yet
- deploy runbooks and environment docs still contain some stale gateway-era wording and now need a cleanup pass against the current Cloud-only runtime

## Recommended Next Start

1. validate the implemented inbox/manual-send flow on real staging infrastructure:
   - thread-open unread clear under live polling
   - CSW-open manual text reply success
   - CSW-closed template-only behavior
   - admin media open/retrieval behavior
2. validate the webhook and GridFS media path on real staging infrastructure:
   - GET challenge
   - signed POST
   - inbound media download
   - admin media retrieval
3. clean up stale internals/runbooks that still talk about `whatsapp-gateway`, token fingerprint parity, pairing controls, or pre-inbox WhatsApp UX
4. backfill real Meta template IDs into `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` if the operator has them
