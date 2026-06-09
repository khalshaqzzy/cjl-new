# Release Execution Checklist

Document status: Active  
Last updated: 2026-06-09
Purpose: operator-facing execution checklist for staging rollout, production rollout, restore, rollback decision points, and first-hour monitoring after the Cloud-only WhatsApp cutover prep

## 1. Rollout Metadata

- target environment:
- target commit SHA:
- operator:
- backup operator:
- rollout start time:
- last known good SHA:
- GitHub workflow run URL:

## 2. Local Pre-Flight

- `git status --short` is clean
- `npm run lint` passed
- `npm run typecheck` passed
- `npm run test:backend` passed
- `npm run test:e2e` passed
- `npm run build` passed
- `npm run validate:cloud-runtime` passed
- `npm run audit:prod` passed
- `npm run security:scan` passed
- `docker compose config` passed
- `docker compose build` passed

## 3. Staging Pre-Deploy

- staging VM is reachable over SSH
- `docker version` works on staging as deploy user
- staging DNS resolves correctly
- GitHub `staging` environment secrets are populated and current
- staging runtime secrets do not contain placeholder values
- staging Cloud WhatsApp secrets are present and current
- staging workflow should fail before deploy if any Cloud WhatsApp secret is blank
- staging deploy has no reset-token path; runtime env changes must not wipe persistent data

## 4. Execute Staging Deploy

1. push or select the target commit on branch `staging`
2. open GitHub Actions and confirm `CI` starts for the exact target SHA
3. wait for `CI` to pass completely
4. confirm `Deploy Staging` starts for the same SHA
5. monitor these stages in the workflow:
   - release archive upload
   - runtime env render and upload
   - remote deploy script
   - internal container readiness wait
   - smoke checks
6. record result:
   - staging deploy status:
   - staging workflow URL:

## 5. Staging Validation

### 5.1 Health and readiness

- `https://api-staging.cjlaundry.com/health` returns success
- `https://api-staging.cjlaundry.com/ready` returns success
- `/ready` shows the expected `release.sha`
- `/ready.checks.whatsappProviderConfigured === true`
- `/ready.checks.whatsappWebhookConfigured === true`
- `/ready.whatsapp.provider === "cloud_api"`
- `/ready.whatsapp.webhookPath === "/v1/webhooks/meta/whatsapp"`
- admin site loads
- public site loads

### 5.2 Observability

- API response includes `X-Request-Id`
- the same `X-Request-Id` can be found in API container logs
- API logs are structured JSON
- startup logs show seed/backfill summary and duration
- startup logs show whether WhatsApp backfill ran in `baseline` or `incremental` mode

### 5.3 Security and hardening

- admin/public/API domains return expected security headers
- trusted-origin enforcement blocks invalid state-changing requests
- rate limiting behaves correctly for login and token-redeem paths
- staging runtime did not boot with placeholder or unsafe hosted env values

### 5.4 Core product flow

- admin login works
- customer create works
- idempotent customer-create replay works with the same key
- order preview works
- order confirm works
- order appears in active laundry
- order done works
- customer points and ledger update correctly
- public customer login works
- direct order status link works

### 5.5 WhatsApp Cloud flow

- webhook challenge verification works
- signed webhook POST is accepted
- welcome or transactional send succeeds through Cloud API
- outbound status progression appears in admin
- admin inbox is reachable from primary nav and mobile bottom nav
- CSW-open manual free-form send succeeds
- CSW-closed thread stays template-only
- inbound media retrieval works from the admin inbox
- failed-notification recovery works:
  - failed `order_confirmed` offers receipt download, resend, `Mark as Done`, and `Ignore`
  - failed non-receipt notifications offer resend, `Mark as Done`, and `Ignore`

### 5.6 Rollback proof

- rollback was exercised against a known-good SHA or a known-bad deploy path
- post-rollback smoke checks passed

## 6. Staging Go/No-Go

Production is blocked unless all are true:

- staging deploy passed
- staging validation passed
- rollback proof passed
- Cloud WhatsApp validation passed
- no unresolved `5xx` spike or auth/session regression remains

## 7. Production Pre-Deploy

- target production SHA exactly matches the staging-validated SHA
- last known good production SHA is recorded
- production VM is reachable over SSH
- production DNS resolves correctly
- GitHub `production` environment secrets are current
- production Cloud WhatsApp secrets are present and current
- production workflow should fail before deploy if any Cloud WhatsApp secret is blank
- production deploy has no reset-token path; runtime env changes must not wipe persistent data
- production R2 backup secrets are present before deploying a backup-capable release
- production pre-deploy MongoDB backup is expected to block deploy if it fails, except when it intentionally skips because `${MONGO_DATABASE}.customers` has fewer than 100 documents
- production backup env renders `BACKUP_MIN_CUSTOMERS=100`
- production deploy and `Use Backup` use shared `production-runtime` workflow concurrency
- first-hour monitoring owner is assigned
- backup rollback operator is assigned

## 8. Execute Production Deploy

1. merge or push the approved SHA to `main`, or trigger the workflow manually for the approved SHA
2. confirm `CI` runs and passes for the exact SHA
3. confirm `Deploy Production` runs for the exact SHA
4. monitor these workflow stages:
   - previous release capture
   - release archive upload
   - runtime env render and upload
   - remote deploy script
   - internal container readiness wait
   - smoke checks

## 9. Production Validation

- `https://api.cjlaundry.com/health` returns success
- `https://api.cjlaundry.com/ready` returns success
- `/ready` shows the expected `release.sha`
- `/ready.checks.whatsappProviderConfigured === true`
- `/ready.checks.whatsappWebhookConfigured === true`
- `/ready.whatsapp.provider === "cloud_api"`
- `/ready.whatsapp.webhookPath === "/v1/webhooks/meta/whatsapp"`
- admin site loads
- public site loads
- admin login works
- one customer-safe business flow works end to end

## 10. First-Hour Monitoring

- check `401` spike
- check `429` spike
- check `5xx` spike
- check webhook signature failures
- check Cloud delivery failures
- check admin inbox/manual-send regressions
- check customer login or magic-link complaints

## 10.1 Use Backup Restore Execution

Use only for approved production database recovery:

1. confirm `PRODUCTION_VM_HOST` and `PRODUCTION_VM_SSH_KNOWN_HOSTS` target the intended GCP VM
2. confirm the normal production deploy has established `/opt/cjl/production/current`
3. open GitHub Actions and run `Use Backup`
4. type `USE_LATEST_PRODUCTION_R2_BACKUP`
5. record workflow output:
   - backup name:
   - archive key:
   - backup timestamp UTC:
   - backup timestamp GMT+7:
   - restore namespace:
   - restored/current release SHA:
6. confirm post-restore smoke checks passed:
   - `https://api.cjlaundry.com/health`
   - `https://api.cjlaundry.com/ready`
   - `https://admin.cjlaundry.com`
   - `https://cjlaundry.com`
7. perform one customer-safe admin/public validation after restore

## 11. Rollback Trigger Conditions

- production smoke checks fail
- `/ready` fails after deploy
- admin login is broken
- customer login or direct-status flow is broken broadly
- Cloud delivery or webhook processing breaks required production operations
- sustained `5xx` errors appear without a fast fix

## 12. Rollback Execution

- identify the last healthy SHA
- confirm the current incident requires rollback, not a quick forward fix
- execute workflow rollback or re-deploy the last healthy SHA
- if GitHub is unavailable, use `deploy/scripts/remote-rollback.sh` on the VM
- re-run health, readiness, admin, public, and one core business smoke check

## 13. Closeout

- final deployed SHA:
- rollback used: yes or no
- open follow-up issues:
- docs needing update:
- incident summary or release notes link:
