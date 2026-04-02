# ADR 0023: Cloud Readiness Gating and Watermarked WhatsApp Backfill

Status: Accepted  
Date: 2026-04-02  
Scope: hosted deploy admission checks and startup behavior for legacy WhatsApp compatibility normalization

## Context

ADR 0022 established the Cloud-only runtime contract and additive startup compatibility backfill for the first production cutover. Review of the implementation surfaced two operational risks:

1. hosted deploy workflows could still succeed when required Cloud WhatsApp secrets were blank because smoke checks only required HTTP success
2. startup compatibility backfill still performed full-collection WhatsApp scans on every boot, which increased restart cost with total data volume

There was also a user-visible quality issue:

3. canonical chat upserts could degrade a legacy human-readable chat title into a phone number or raw chat ID

These are durable decisions because they affect:

- whether staging or production deploys are allowed to proceed
- what `/ready` means during rollout
- whether startup cost scales with total WhatsApp history on every restart
- whether legacy inbox history remains operator-readable after canonicalization

## Decision

The repo now standardizes on the following rules:

1. Hosted deploy workflows must fail before deploy if any required Cloud WhatsApp secret is blank.
2. Hosted deploy workflows must treat `/ready` as a semantic admission check, not a simple HTTP reachability check.
3. For Cloud deployments, `/ready` must report all of the following as true or exact matches before the workflow is considered healthy:
   - `ok === true`
   - `checks.whatsappProviderConfigured === true`
   - `checks.whatsappWebhookConfigured === true`
   - `whatsapp.provider === "cloud_api"`
4. WhatsApp compatibility backfill uses a runtime migration watermark `whatsapp-cutover-backfill-v1`.
5. The first post-release startup performs a baseline compatibility pass.
6. Later startups perform incremental cursor-based passes scoped to documents that still exhibit legacy markers or missing Cloud-era derived fields.
7. Canonical chat upserts must preserve existing human-readable legacy titles when stronger labels are not available.

## Rationale

- Failing before deploy on blank secrets prevents false-green auto deploys that would otherwise pass smoke checks while being unable to send WhatsApp traffic.
- Semantic `/ready` validation makes the rollout contract explicit: transport configuration must be correct, not merely reachable.
- A watermark-based baseline-plus-incremental strategy keeps the operational simplicity of startup normalization without making every restart scale with total historical WhatsApp data.
- Cursor-based processing is safer for large collections than loading complete collections into memory before the API starts.
- Preserving human-readable titles avoids inbox quality regressions during canonicalization.

## Consequences

Positive:

- staging and production deploys now block on real Cloud readiness instead of superficial uptime
- startup backfill remains automatic while becoming materially safer for realistic data volume
- later restarts become narrower and faster than the first cutover run
- operators keep readable legacy thread titles after canonicalization

Tradeoffs:

- deploy workflows now fail earlier when secrets are missing, which is stricter but intentional
- startup behavior now depends on a runtime migration watermark document in MongoDB
- the first baseline run is still potentially heavier than later runs and must be validated on staging data volume

## Follow-Up

- validate baseline and incremental startup timing on real staging data volume
- keep `/ready` validation aligned with any future Cloud provider contract changes
- after production stabilizes, decide whether the watermark should advance to a new version for any later destructive cleanup phase
