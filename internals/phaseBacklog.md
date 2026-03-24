# Phase Backlog

Document status: Active  
Purpose: condensed next-work inventory after deployment workflow implementation

## Next Recommended Items

1. Provision the real staging VM, DNS records, and GitHub staging secrets, then execute the first staging rollout.
2. Validate hosted replica-set initialization, including correct `MONGO_REPLICA_KEY` secret wiring, `/ready`, TLS issuance, and branch-based deploy behavior on staging before touching production.
3. Validate the new PDF receipt download and failed-notification manual WhatsApp fallback paths against the real WhatsApp runtime and browser environment during staging rollout.
4. Decide whether the v1 in-process outbox remains sufficient operationally after the first hosted rollout or whether a separate queue/worker boundary is warranted.

## Lower Priority Follow-Ups

1. Add a real WhatsApp adapter on top of the existing outbox flow, including persisted session handling, operational reconnect visibility, and preservation of the new manual fallback semantics.
2. Review whether archived leaderboard snapshot lifecycle needs additional operator visibility in admin UI beyond the current top-customer/reporting improvements.
3. Decide whether frontend images should stay `next start` based or move to standalone output for leaner hosted runtime images.
4. Decide whether the frozen landing page should later be brought into stricter PRD wording parity or remain a deliberate marketing exception.

## Explicitly Out Of Scope From This Session

- running the first live staging rollout
- running the first live production rollout
- real WhatsApp adapter/runtime persistence implementation
