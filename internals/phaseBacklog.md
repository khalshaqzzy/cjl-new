# Phase Backlog

Document status: Active  
Purpose: condensed next-work inventory after deployment workflow implementation

## Next Recommended Items

1. Provision the real staging VM, DNS records, and GitHub staging secrets, then execute the first staging rollout.
2. Validate hosted replica-set initialization, `/ready`, TLS issuance, and branch-based deploy behavior on staging before touching production.
3. Decide whether the v1 in-process outbox remains sufficient operationally after the first hosted rollout or whether a separate queue/worker boundary is warranted.

## Lower Priority Follow-Ups

1. Add a real WhatsApp adapter on top of the existing outbox flow, including persisted session handling and operational reconnect visibility.
2. Review whether archived leaderboard snapshot lifecycle needs additional operator visibility in admin UI.
3. Decide whether frontend images should stay `next start` based or move to standalone output for leaner hosted runtime images.

## Explicitly Out Of Scope From This Session

- running the first live staging rollout
- running the first live production rollout
- real WhatsApp adapter/runtime persistence implementation
