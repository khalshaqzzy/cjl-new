# Phase Backlog

Document status: Active  
Purpose: condensed next-work inventory after deployment workflow implementation

## Next Recommended Items

1. Provision the real staging VM, DNS records, and GitHub staging secrets, then execute the first staging rollout.
2. Validate hosted `/ready`, TLS issuance, and branch-based deploy behavior on staging before touching production.
3. Decide whether frontend images should stay `next start` based or move to standalone output for leaner hosted runtime images.

## Lower Priority Follow-Ups

1. Expand automated coverage for notification failure handling, settings propagation, and dashboard/reporting paths.
2. Reduce remaining frontend dependence on `lib/mock-data.ts` for helper-only concerns and move stable shared formatting/helpers where appropriate.
3. Review whether archived leaderboard snapshot lifecycle needs additional operator visibility in admin UI.

## Explicitly Out Of Scope From This Session

- running the first live staging rollout
- running the first live production rollout
- WhatsApp runtime persistence implementation
