# Session Handoff 2026-03-26

Document status: Active  
Purpose: repo snapshot after POS QR continuation UX, focused failed-notification recovery, shared receipt-rendering refresh, and public/admin mobile UX polish

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
- refreshed public landing marketing content and customer-facing service messaging:
  - hero pricing copy now uses the new `Cuci sepuasnya mulai dari Rp. 10.000` wording
  - layanan/harga copy now emphasizes economical pricing plus best quality
  - ironing is now visible in the public service grid
  - the address card now exposes a direct `Kunjungi CJ Laundry` Maps CTA
- updated additional landing/public content now present in repo:
  - benefits copy reflects the newer self-service, LG machine, and comfort wording
  - `Cara Kerja` timing now says `60-90 menit`
  - landing FAQ payload now includes the added washer/dryer-only and drop-off/no-extra-fee answers
- adjusted public auth/mobile UX:
  - login inputs now use mobile-safe sizing and blur active focus before redirect so portal entry no longer inherits browser zoom
  - portal mobile top bar now keeps `CJ Laundry` as the brand-first label on history/stamp/leaderboard pages
- adjusted admin customer-detail mobile UX:
  - action buttons in the profile hero now wrap instead of bleeding off-screen
  - QR login sheets now cap viewport height and scroll internally so the close button remains reachable
- added ADR `docs/adr/0012-live-settings-receipts-and-focused-notification-recovery.md`
- added ADR `docs/adr/0013-mobile-surface-fit-and-brand-first-customer-ctas.md`
- updated PRD and implementation/backlog internals to reflect the new operator flow and receipt policy

## Verification Run

- `npm run typecheck`
- `npm run test:backend`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts --reporter=line`
- `npm run typecheck --workspace @cjl/public-web`
- `npm run typecheck --workspace @cjl/admin-web`

All passed at session end.

## Important Repo Facts

- admin fallback receipt download is now intentionally PNG-only for failed `order_confirmed`
- portal receipt download remains PDF and should stay that way unless product intent changes again
- live receipt output now reads current business identity from settings, so changing laundry phone/address should affect newly rendered historical receipts too
- manual WhatsApp fallback no longer requires `order_confirmed` render status to be `ready`; it only needs a failed notification with a prepared message
- the backend still retains manual-resolve endpoints for compatibility, but the default operator path is now the focused button set in the outbox UI
- the public customer auth bug report about slight post-login portal zoom was handled in the login flow, not by adding scale logic to portal pages
- the landing address card now owns the explicit external maps CTA for outlet visits, while WhatsApp remains the primary conversation CTA
- the two `next-env.d.ts` files were touched by local Next.js/tooling state during verification and should not be treated as business-logic changes

## Recommended Next Start

1. validate the new POS QR continue flow on staging with a real cashier/device workflow
2. validate failed-send recovery on staging, especially the `wa.me` deep link plus manual PNG attachment path for `order_confirmed`
3. save new staging business contact/address values and confirm landing, portal PDF receipt, and admin fallback PNG receipt all reflect them consistently
4. validate the latest mobile UX polish on real devices during staging:
   - login submit no longer leaves portal zoomed in
   - history/stamp/leaderboard mobile top bars remain brand-first
   - admin customer detail QR sheet remains fully usable on narrow screens
5. keep the first production push blocked until the refreshed fallback/receipt behavior is exercised on staging with a real WhatsApp device
