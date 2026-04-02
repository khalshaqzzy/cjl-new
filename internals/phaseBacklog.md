# Phase Backlog

Document status: Active  
Purpose: condensed next-work inventory after WhatsApp Phase 5-6 admin inbox completion

## Next Recommended Items

0. WhatsApp Business Platform migration Phases 5 and 6 are now implemented. Continue from Phase 8 and Phase 9 in `internals/whatsappBusinessApiMigrationPhases.md`, not from the legacy gateway/pairing path.
1. Backfill the real Meta template IDs into `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` if the operator has not recorded them yet.

2. Provision the real staging VM, DNS records, and GitHub staging secrets, then execute the first staging rollout.
3. Validate hosted replica-set initialization, including correct `MONGO_REPLICA_KEY`, Cloud API env rendering, deploy reset token wiring, `/ready`, TLS issuance, and branch-based deploy behavior on staging before touching production.
4. Validate the new Meta webhook path on staging end-to-end:
   - GET challenge verification
   - signed POST acceptance
   - inbound text ingestion
   - inbound media download to GridFS
   - outbound status progression and pricing visibility
5. Verify settings persistence on staging with `08...` input across laundry phone, public contact, public WhatsApp, admin contacts, and address, then confirm landing, portal, portal PDF receipt, and admin fallback PNG receipt all reflect the saved values correctly.
6. Validate the customer magic-link flow on real devices: welcome WA delivery, one-time redeem behavior, QR scan usability, and the POS `Lanjutkan ke POS` transition after QR display.
7. Validate failed-notification operator recovery on staging:
   - failed `order_confirmed` shows `Download Receipt`, `Resend Message`, `Mark as Done`, and `Ignore`
   - failed non-receipt notifications show `Kirim Ulang`, `Mark as Done`, and `Ignore`
   - `Resend Message` / `Kirim Ulang` calls WhatsApp API directly and returns the updated notification state
   - `Mark as Done` lands in the `Manual` tab and `Ignore` lands in the `Ignored` tab
8. Exercise the latest mobile/front-desk UX polish on real devices during staging:
   - login submit should not leave the portal slightly zoomed in
   - portal top bar on `Riwayat`, `Stamp`, and `Leaderboard` should stay brand-first
   - the landing address card `Kunjungi CJ Laundry` Maps CTA should open correctly
   - admin customer detail and QR login sheet should remain fully usable on narrow screens
   - admin POS should keep selected customer identity visible throughout service selection and order confirmation
   - admin Laundry tabs should behave correctly for `Aktif`, `Hari Ini`, `History`, and default-off cancelled visibility
9. During staging deploy, observe first-start behavior for the new order `activityAt` backfill, settings cleanup, and index creation on realistic data volume before allowing the first production push.
10. Execute the full `productionReadinessChecklist.md` on staging before allowing the first production push.
11. Validate the implemented WhatsApp inbox/operator flow on staging end-to-end:
   - `/admin/whatsapp` is reachable from primary nav and mobile bottom nav
   - explicit thread-open unread clearing behaves correctly under polling refresh
   - CSW-open manual free-form send succeeds with real Cloud API credentials
   - CSW-closed threads stay template-only
   - inbound media retrieval works from the admin affordance against staged GridFS data
12. Decide whether the v1 in-process outbox and media worker remain sufficient operationally after the first hosted rollout or whether a separate queue or worker boundary is warranted.
13. Decide whether admin notification polling should move to a delta/summary endpoint so `AdminShell` and dashboard stop re-reading the full notifications collection.

## Lower Priority Follow-Ups

1. Validate webhook-backed inbound/outbound WhatsApp thread quality on real phones and decide whether operator chat filters, assignment, or draft persistence are needed in v1.1.
2. Decide whether admin-contact labels should remain implicit `Admin 1 / Admin 2 / ...` or later become configurable display names.
3. Review whether archived leaderboard snapshot lifecycle needs additional operator visibility in admin UI beyond the current top-customer/reporting improvements.
4. Decide whether frontend images should stay `next start` based or move to standalone output for leaner hosted runtime images.
5. Decide whether the frozen landing page should later be brought into stricter PRD wording parity or remain a deliberate marketing exception.
6. Decide whether destructive reset-token rotation should later support narrower wipes, such as WhatsApp auth only, instead of always removing Mongo and Caddy state too.
7. Add a dedicated backend-test TypeScript config and script, for example `packages/api/tsconfig.test.json` plus a root script such as `npm run typecheck:backend-tests`, so VS Code diagnostics on `packages/api/test/*.ts` are enforced consistently in CI.

## Explicitly Out Of Scope From This Session

- running the first live staging rollout
- running the first live production rollout
- staging validation of the new real Meta webhook/runtime integration
- production-scale hardening beyond the new 30-day customer session and one-time login token model
- notification read-model optimization beyond the current laundry-order amplification reduction
