# Phase Backlog

Document status: Active  
Purpose: condensed next-work inventory after deployment workflow implementation

## Next Recommended Items

1. Provision the real staging VM, DNS records, and GitHub staging secrets, then execute the first staging rollout.
2. Validate hosted replica-set initialization, including correct `MONGO_REPLICA_KEY`, `WHATSAPP_GATEWAY_TOKEN`, and session-secret wiring, `/ready`, TLS issuance, and branch-based deploy behavior on staging before touching production.
3. Pair the real CJ Laundry number through the admin WhatsApp status page on staging and verify `Generate Pairing Code`, `Reset Session`, and reconnect behavior against a real device.
4. Verify settings persistence on staging with `08...` input across laundry phone, public contact, public WhatsApp, admin contacts, and address, then confirm landing and portal reflect the saved values immediately.
5. Validate the new customer magic-link flow on real devices: welcome WA link open, one-time redeem behavior, QR scan usability, and sliding 30-day session refresh after repeated portal usage.
6. Execute the full `productionReadinessChecklist.md` on staging before allowing the first production push.
7. Decide whether the v1 in-process outbox remains sufficient operationally after the first hosted rollout or whether a separate queue or worker boundary is warranted.

## Lower Priority Follow-Ups

1. Validate mirrored inbound/outbound WhatsApp thread quality on real phones and decide whether unread clearing or operator chat filters are needed in v1.1.
2. Decide whether admin-contact labels should remain implicit `Admin 1 / Admin 2 / ...` or later become configurable display names.
3. Review whether archived leaderboard snapshot lifecycle needs additional operator visibility in admin UI beyond the current top-customer/reporting improvements.
4. Decide whether frontend images should stay `next start` based or move to standalone output for leaner hosted runtime images.
5. Decide whether the frozen landing page should later be brought into stricter PRD wording parity or remain a deliberate marketing exception.

## Explicitly Out Of Scope From This Session

- running the first live staging rollout
- running the first live production rollout
- staging validation of the new real WhatsApp runtime
- production-scale hardening beyond the new 30-day customer session and one-time login token model
