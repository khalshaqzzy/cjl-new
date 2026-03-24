# Session Handoff 2026-03-25

Document status: Active  
Purpose: repo snapshot after receipt/notification/privacy enhancements across admin, public, and backend contracts

## What This Session Completed

- added uppercase customer-name normalization across create/update flows
- added startup-safe backfill for legacy customer, order, and notification name snapshots plus default `publicNameVisible=false`
- added authenticated portal order-detail receipt view with:
  - line items
  - unit prices
  - subtotal/discount/total
  - PDF receipt download
- kept direct status token pages non-monetary while leaving authenticated portal detail richer
- added admin outbox manual WhatsApp fallback for failed sends only:
  - `order_done` can fallback after delivery failure
  - `order_confirmed` can fallback only after receipt render is ready
  - fallback marks the notification manually resolved and opens WhatsApp deep link for operator send
- replaced admin notification receipt download output from plain text to PDF
- added customer-controlled leaderboard name visibility:
  - masked by default
  - opt-in from portal leaderboard
  - public leaderboard and landing teaser now use live preference-aware display names
- updated shared contracts to carry:
  - richer portal order-detail payload
  - notification action-state flags
  - display-oriented leaderboard rows
  - customer name-visibility payloads
- updated backend integration and full-stack e2e coverage for the new behaviors
- updated repo memory:
  - `internals/PRD.md`
  - `internals/implementationPhases.md`
  - `internals/phaseBacklog.md`
  - new ADR `docs/adr/0005-public-receipts-fallback-and-live-name-visibility.md`

## Verification Run

- `npm run build:contracts`
- `npm run build:api`
- `npm run build:admin`
- `npm run build:public`
- `npm run test:backend`
- `npm run test:e2e`
- `npm test`

All passed at session end.

## Important Repo Facts

- PDF receipt rendering now lives server-side in `packages/api` and does not depend on frontend runtime rendering
- admin notification download actions now return PDF content
- customer portal order detail now intentionally exposes money values only for the authenticated customer’s own order
- direct token status pages still avoid money values and receipt download
- leaderboard row ranking remains snapshot-backed, but displayed names now resolve from live customer visibility preference
- manual WhatsApp fallback is an operator-only failed-send recovery path, not the default delivery mode

## Recommended Next Start

1. validate manual WhatsApp fallback and PDF receipt download in real staging browsers plus the real WhatsApp runtime
2. decide how the real WhatsApp adapter should preserve the new fallback/manual-resolution semantics
3. continue with phase 8 hosted rollout validation and operational hardening
