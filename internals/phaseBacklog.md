# Phase Backlog

Document status: Active  
Last updated: 2026-04-02  
Purpose: condensed next-work inventory after repo-level closure of WhatsApp migration Phases 7-9

## Next Recommended Items

1. Provision or verify the real staging VM, DNS, and GitHub Cloud WhatsApp secrets, then execute the first staging rollout.
2. Validate staged `/ready` output:
   - release SHA
   - Mongo checks
   - Cloud provider configured
   - webhook path configured
3. Validate the Meta webhook path on staging end to end:
   - GET challenge verification
   - signed POST acceptance
   - inbound text ingestion
   - inbound media download to GridFS
   - outbound status progression and pricing visibility
4. Validate the admin WhatsApp inbox on staging:
   - thread list/timeline visibility
   - mobile list-to-detail navigation
   - sticky thread header visibility during long-scroll sessions
   - provider-health collapsed/default and expanded/detail states
   - explicit unread clearing
   - CSW-open manual send success
   - CSW-closed template-only state
   - media open flow
5. Validate failed-notification recovery on staging:
   - failed `order_confirmed` shows receipt download, resend, `Mark as Done`, and `Ignore`
   - failed non-receipt notifications show resend, `Mark as Done`, and `Ignore`
   - resend updates backend state immediately
6. Observe first-start behavior for startup backfill and index creation on realistic staging data volume before allowing the first production push:
   - baseline run duration
   - `seed.completed.summary.mode === "baseline"`
   - no unacceptable boot delay
7. Restart staging once after the baseline rollout and confirm the runtime migration watermark forces incremental behavior:
   - `seed.completed.summary.mode === "incremental"`
   - no full-history rescans
8. Execute `internals/productionReadinessChecklist.md` fully on staging before allowing the first production push.
9. Backfill the real Meta template IDs into `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` if the operator has not recorded them yet.

## Lower Priority Follow-Ups

1. Decide whether the v1 in-process outbox remains sufficient after the first hosted rollout.
2. Decide whether admin notification polling should move to a delta/summary endpoint.
3. Decide whether the deprecated gateway package should stay in repo long-term or move to a dedicated archive branch after production cutover stabilizes.

## Explicitly Out Of Scope From This Session

- running the first live staging rollout
- running the first live production rollout
- destructive cleanup of legacy WhatsApp fields or collections
- adding template-send UI inside the inbox
