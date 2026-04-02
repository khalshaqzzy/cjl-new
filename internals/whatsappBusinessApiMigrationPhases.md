# WhatsApp Business API Migration Phases

Document status: Active  
Last updated: 2026-04-02  
Purpose: canonical migration status after repo-level closure of WhatsApp Cloud migration phases

## Summary

The repo is now Cloud-only in active runtime terms:

- automatic outbound notifications use Cloud API
- signed Meta webhooks drive inbound/status ingestion
- admin uses a first-party inbox inside the app
- manual free-form send is CSW-only
- failed-notification recovery prefers backend-owned resend
- deprecated gateway code remains in repo only and is not started by any active runtime path

## Phase Status

### Phase 1: Template Authoring and Approval

Status: completed operationally

- all five templates are active in WhatsApp Manager
- template IDs still need repo backfill if the operator has not recorded them yet

### Phase 2: Provider Abstraction and Data Model Expansion

Status: complete in repo terms

### Phase 3: Cloud API Outbound Delivery

Status: complete in repo terms

### Phase 4: Meta Webhook Verification and Ingestion

Status: complete in repo terms

### Phase 5: Admin WhatsApp Interface Upgrade

Status: complete in repo terms

### Phase 6: Manual Operator Send Path

Status: complete in repo terms

### Phase 7: Testing and Tooling Migration

Status: complete in repo terms

- backend integration coverage is Cloud-aware
- E2E coverage is Cloud-aware
- root CI/build/typecheck path no longer depends on the deprecated gateway workspace
- deploy/runtime/doc parity is enforced by `npm run validate:cloud-runtime`

### Phase 8: Deployment, Env, and Runtime Topology Change

Status: complete in repo terms, live validation pending

- hosted workflows now render Cloud API env values
- active runtime topology no longer depends on gateway-era secrets or auth volumes
- `/ready` exposes Cloud readiness state
- operator runbooks now describe Cloud-only deployment and validation

### Phase 9: Data Backfill and Cutover

Status: complete in repo terms, live cutover pending

- startup backfill canonicalizes legacy WhatsApp data for Cloud-era reads
- legacy bridge route is retired
- legacy history is preserved in MongoDB through additive compatibility fields and shadow chat records

## What Still Requires Real Environment Validation

The migration is not operationally finished until staging proves:

- Cloud secrets are present and correct
- webhook challenge verification works
- signed webhook POST is accepted from Meta
- outbound status progression appears in admin
- inbound media opens from admin
- manual send behaves correctly under open/closed CSW
- failed-notification recovery behaves correctly on real infrastructure

## Recommended Next Start

1. run `npm run validate:cloud-runtime`
2. run `npm run test:e2e`
3. deploy `staging`
4. validate the full Cloud-era path on staging
5. only then promote the same SHA to `main`
