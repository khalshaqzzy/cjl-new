# Implementation Phases

Document status: Active  
Last updated: 2026-04-02  
Purpose: compact repo-level implementation status snapshot

## Current Repo Status

The repo now has:

- buildable contract package in `packages/contracts`
- buildable Express API package in `packages/api`
- buildable admin Next.js app in `app/admin-web`
- buildable public Next.js app in `app/public-web`
- transaction-backed core admin mutations for customer create, order confirm, order done, and void flows
- Cloud API outbound delivery from the API runtime
- signed Meta webhook verification and ingestion on the API runtime
- GridFS-backed inbound WhatsApp media storage and admin retrieval
- first-party admin WhatsApp inbox with:
  - searchable thread list
  - timeline
  - linked-customer shortcut
  - explicit unread clearing
  - CSW-gated manual text replies
  - template-only disabled state
  - mobile list-first navigation with dedicated thread detail route
  - compact default-collapsed provider health summary
  - sticky thread header and contained message scrolling on desktop/mobile
- failed-notification recovery through backend-owned resend with receipt download, `Mark as Done`, and `Ignore`
- startup seed/backfill that now also canonicalizes legacy WhatsApp data for Cloud-era reads while preserving legacy history
- startup WhatsApp compatibility backfill now uses a runtime migration watermark and incremental cursor-based passes after the first baseline run
- root CI that validates lint, typecheck, backend tests, E2E, build, compose, and Cloud runtime parity
- hosted deploy workflows that now render Cloud API credentials instead of gateway-era runtime values and fail if Cloud secrets or `/ready` semantics are invalid

## Phase Snapshot

### Phase 1: Workspace and Contract Foundation

Status: complete in repo terms

### Phase 2: Core Backend Runtime

Status: complete in repo terms

### Phase 3: Admin Surface Integration

Status: complete in repo terms

- admin WhatsApp inbox now has a dedicated `/admin/whatsapp/[chatId]` detail route for mobile
- message timelines auto-scroll to the newest item on open and keep scroll ownership inside the inbox panel
- mobile thread detail hides the bottom nav and keeps header controls visible while scrolling

### Phase 4: Public Surface Integration

Status: complete in repo terms

### Phase 5: Post-Integration Stabilization

Status: complete in repo terms

### Phase 6: Local Containerization and Test Automation

Status: complete in repo terms

### Phase 7: Release and CI Hardening

Status: complete in repo terms

- root build/typecheck no longer depend on the deprecated gateway workspace
- CI now validates Cloud runtime parity in deploy assets and operator runbooks
- backend integration coverage now verifies startup backfill for legacy WhatsApp data
- E2E coverage now verifies failed-notification recovery actions on the Cloud-era admin surface

### Phase 8: Hosted Environment Validation and Operations Hardening

Status: code-complete in repo terms, real-environment validation pending

- hosted deploy workflows render Cloud API runtime env
- active hosted runtime no longer depends on gateway-era env or volumes
- `/ready` now reports Cloud provider/webhook readiness
- hosted deploy now validates `/ready` semantically after smoke check
- deployment and checklist docs now describe Cloud-only runtime and validation

### Phase 9: Data Backfill and Cutover

Status: code-complete in repo terms, live staging/prod cutover pending

- startup backfill now:
  - preserves existing production data
  - canonicalizes legacy WhatsApp chat IDs away from `@c.us`
  - backfills Cloud-era provider fields where derivable
  - marks superseded legacy chats as shadow records
- startup backfill now records watermark `whatsapp-cutover-backfill-v1`, runs baseline once, then narrows to incremental passes
- canonical chat upserts now preserve human-readable legacy titles instead of degrading them to phone or raw IDs
- legacy internal bridge route is retired and no longer part of the active runtime path

## Important Notes

- the deprecated `packages/whatsapp-gateway` package remains in repo as non-runtime legacy code only
- staging and production validation are still required before calling the migration operationally complete
- the next meaningful milestone is live staging validation of:
  - webhook challenge verification
  - signed webhook POST
  - inbox thread visibility
  - manual reply behavior under open/closed CSW
  - inbound media retrieval
  - failed-notification recovery actions
