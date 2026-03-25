# Session Handoff 2026-03-26

Document status: Active  
Purpose: repo snapshot after POS QR continuation UX, focused failed-notification recovery, and shared receipt-rendering refresh

## What This Session Completed

- updated POS customer-registration UX so showing the one-time login QR no longer blocks the cashier:
  - the POS QR sheet now exposes `Lanjutkan ke POS`
  - continuing from the sheet preserves the selected customer and advances directly to service selection
- simplified admin failed-notification recovery UI:
  - failed `order_confirmed` cards now prioritize `Download Receipt` and `Send Message`
  - failed non-receipt cards now prioritize `Send Message` and `Kirim Ulang`
  - preview/copy/manual-resolve are no longer first-class visible recovery actions in the outbox UI
- expanded manual WhatsApp fallback eligibility in backend so all failed notification event types can open a prefilled `wa.me` deep link
- changed admin notification receipt fallback download from PDF to PNG
- kept authenticated customer portal receipt download as PDF
- changed automatic WhatsApp order-confirmed media send from PNG to PDF while keeping admin fallback download on PNG
- replaced the old split receipt rendering logic with a shared backend receipt view model used by:
  - WhatsApp order-confirmed PDF send
  - admin fallback PNG download
  - portal PDF download
- significantly refreshed receipt aesthetics and structure across PNG/PDF outputs
- changed final receipt rendering so business identity uses the latest admin settings values for:
  - laundry name
  - laundry phone / admin contact
  - address
- preserved transaction-specific receipt content from the order record:
  - order code
  - customer name
  - timestamps
  - weight
  - item pricing/totals
  - loyalty values
- added ADR `docs/adr/0012-live-settings-receipts-and-focused-notification-recovery.md`
- updated PRD and implementation/backlog internals to reflect the new operator flow and receipt policy

## Verification Run

- `npm run typecheck`
- `npm run test:backend`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts --reporter=line`

All passed at session end.

## Important Repo Facts

- admin fallback receipt download is now intentionally PNG-only for failed `order_confirmed`
- portal receipt download remains PDF and should stay that way unless product intent changes again
- live receipt output now reads current business identity from settings, so changing laundry phone/address should affect newly rendered historical receipts too
- manual WhatsApp fallback no longer requires `order_confirmed` render status to be `ready`; it only needs a failed notification with a prepared message
- the backend still retains manual-resolve endpoints for compatibility, but the default operator path is now the focused button set in the outbox UI
- the two `next-env.d.ts` files were touched by local Next.js/tooling state during verification and should not be treated as business-logic changes

## Recommended Next Start

1. validate the new POS QR continue flow on staging with a real cashier/device workflow
2. validate failed-send recovery on staging, especially the `wa.me` deep link plus manual PNG attachment path for `order_confirmed`
3. save new staging business contact/address values and confirm landing, portal PDF receipt, and admin fallback PNG receipt all reflect them consistently
4. keep the first production push blocked until the refreshed fallback/receipt behavior is exercised on staging with a real WhatsApp device
