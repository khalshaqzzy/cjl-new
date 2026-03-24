# Session Handoff 2026-03-25

Document status: Active  
Purpose: repo snapshot after real WhatsApp gateway implementation plus admin status/inbox integration

## What This Session Completed

- added real WhatsApp transport on top of the existing API-owned outbox flow
- added new workspace service `packages/whatsapp-gateway`:
  - `whatsapp-web.js`
  - `LocalAuth`
  - internal-token protected HTTP interface
  - persistent auth directory support
  - internal event posting back into the API
- replaced simulated outbox send behavior with real gateway delivery calls when WhatsApp is enabled
- added PNG receipt media rendering for `order_confirmed` WhatsApp sends while preserving PDF download for admin/public receipt access
- extended notification records with transport metadata:
  - `providerMessageId`
  - `providerChatId`
  - `providerAck`
  - `sentAt`
  - `gatewayErrorCode`
- added API-owned WhatsApp session/chat/message persistence plus admin endpoints for:
  - status
  - pairing code generation
  - reconnect
  - mirrored chats
  - mirrored messages
- added admin page `/admin/whatsapp` with:
  - connection status
  - pairing material
  - read-only mirrored inbox
  - open-in-WhatsApp handoff
- updated local and hosted Compose/runtime envs for:
  - WhatsApp gateway sidecar
  - shared auth persistence volume
  - gateway internal token wiring
- expanded backend integration coverage to include:
  - mocked gateway delivery metadata
  - admin WhatsApp status endpoints
  - internal event ingestion
  - mirrored inbox reads
- kept existing failed-send manual fallback semantics intact
- added ADR `docs/adr/0006-whatsapp-gateway-sidecar-and-api-owned-mirroring.md`

## Verification Run

- `npm run build`
- `npm run test:backend`
- `npm run test:e2e`

All passed at session end.

## Important Repo Facts

- WhatsApp delivery is now real in repo terms, but still needs real-device staging validation before production rollout
- the gateway is intentionally internal-only and must not be exposed through Caddy/public routing
- mirrored WhatsApp inbox data is API-owned and read-only in v1; operators still reply from the real WhatsApp client
- local and hosted runtimes now require a stable `WHATSAPP_GATEWAY_TOKEN`
- hosted runtime now depends on a persistent `${SHARED_DIR}/whatsapp-auth` mount for session survival
- the backend integration suite now uses a mocked gateway over real HTTP, so test failures around WhatsApp should be debuggable without a real paired device

## Recommended Next Start

1. provision/refresh staging secrets and run the first staging deploy with the WhatsApp gateway enabled
2. pair the real CJ Laundry number through `/admin/whatsapp` on staging and verify session survival across gateway restarts
3. validate real-device send, inbound mirroring, reconnect, and manual fallback behavior before touching production
