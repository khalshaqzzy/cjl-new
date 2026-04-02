# ADR 0022: Cloud-Only Runtime Env and Startup WhatsApp Compatibility Backfill

Status: Accepted  
Date: 2026-04-02  
Scope: deploy/runtime topology, API readiness contract, and first Cloud-only production cutover compatibility behavior

## Context

After the earlier WhatsApp migration ADRs:

- Cloud API outbound delivery was already active in the API runtime
- signed Meta webhooks were already the source of truth for inbound/status ingestion
- admin already had a first-party inbox and backend-owned notification recovery

What remained unresolved was the deployment and cutover contract for the first Cloud-only production release:

1. hosted deploy workflows and runbooks still rendered and described gateway-era runtime values
2. the API still tolerated gateway-era env shape even though the active runtime path no longer needed it
3. legacy WhatsApp data in MongoDB still needed to remain readable after Cloud-only cutover
4. `/v1/internal/whatsapp/events` still existed as a compatibility bridge and could be mistaken for an active runtime dependency

These are durable architectural choices because they affect:

- GitHub environment secret shape
- runtime readiness and smoke-check semantics
- startup behavior on staging and production
- rollback expectations
- how future sessions reason about legacy WhatsApp records

## Decision

The repo now standardizes on the following rules:

1. Active local, staging, and production runtime topology is Cloud-only for WhatsApp.
2. Hosted deploy workflows render Cloud API runtime env directly and no longer render active gateway-era runtime values such as:
   - `WHATSAPP_GATEWAY_TOKEN`
   - `WHATSAPP_AUTH_DIR`
   - `WHATSAPP_ENABLED`
3. The API runtime contract treats Cloud provider configuration as the active WhatsApp contract and exposes that truth through `/ready`.
4. The legacy bridge endpoint `POST /v1/internal/whatsapp/events` is explicitly retired and returns `410 legacy_whatsapp_bridge_retired`.
5. The first Cloud-only cutover release uses additive, idempotent startup compatibility backfill rather than a separate mandatory migration job.
6. Startup compatibility backfill must:
   - preserve existing production MongoDB contents
   - canonicalize legacy WhatsApp chat identities into `wa:<digits>` chat IDs for active read paths
   - mark superseded legacy chats as shadow records instead of deleting them
   - backfill Cloud-era provider fields where they can be derived from legacy fields such as `providerAck` and `providerChatId`
   - remain safe to rerun on every startup
7. Legacy fields and collections remain preserved during the first Cloud-only production release for audit/history compatibility and are not dropped as part of the cutover.

## Rationale

- Cloud-only deploy env removes ambiguity between the runtime that is tested in repo and the runtime that is deployed.
- Explicitly retiring the bridge endpoint is safer than silently leaving an old path available, because future sessions and operators can no longer misread it as a supported runtime dependency.
- `/ready` must expose Cloud provider readiness because smoke checks and rollout decisions should be based on the active transport contract, not on obsolete gateway/session assumptions.
- Startup compatibility backfill is consistent with the repo's existing seed-and-normalize boot model and avoids introducing a second operational path that must be run manually before the first deploy.
- Shadowing legacy chats instead of deleting them preserves historical fidelity while allowing the admin UI to read only canonical Cloud-era threads.
- Keeping legacy fields for the first Cloud-only release reduces rollback and audit risk; destructive cleanup can be deferred until real staging and production behavior have been observed.

## Consequences

Positive:

- hosted secrets, workflows, runtime env examples, and operator runbooks now align with the active Cloud runtime
- startup logs now make WhatsApp compatibility backfill observable during staging and production rollouts
- active read paths use canonical chat IDs while still preserving legacy records
- future sessions have a clear rule that gateway-era runtime behavior is not part of the supported topology

Tradeoffs:

- API startup now owns more compatibility work, which can slightly increase boot time on environments with legacy data
- legacy WhatsApp fields and shadow records remain in MongoDB for at least the first Cloud-only release, so the data model stays transitional for a while
- the deprecated gateway package remains in the repo even though it is not part of runtime, which preserves optional historical context at the cost of some repo clutter

## Follow-Up

- validate startup backfill timing and behavior on real staging data volume
- validate webhook challenge verification, signed webhook POST, media retrieval, manual send, and failed-notification recovery on staging
- once production cutover is proven stable, decide whether and when to remove legacy fields, shadow records, or the deprecated gateway package entirely
