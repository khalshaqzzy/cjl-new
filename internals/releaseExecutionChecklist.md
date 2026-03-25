# Release Execution Checklist

Document status: Active  
Created: 2026-03-25  
Purpose: operator-facing execution checklist for staging rollout, production rollout, rollback decision points, and first-hour monitoring

Use this file during an actual rollout window.  
Use `internals/productionReadinessChecklist.md` before this file.  
Use `internals/deploymentGuide.md` if you need setup detail or troubleshooting depth.

## 1. Rollout Metadata

Fill this before starting:

- target environment:
- target commit SHA:
- operator:
- backup operator:
- rollout start time:
- last known good SHA:
- GitHub workflow run URL:

## 2. Local Pre-Flight

Confirm all are true on the selected release commit:

- `git status --short` is clean
- `npm run lint` passed
- `npm run typecheck` passed
- `npm test` passed
- `npm run build` passed
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
- staging `STAGING_DEPLOY_RESET_TOKEN` is unchanged unless the rollout explicitly intends to wipe persistent data
- `internals/productionReadinessChecklist.md` items needed for staging are ready to execute
- WhatsApp operator/device is available for pairing and message validation if needed

## 4. Execute Staging Deploy

1. push or select the target commit on branch `staging`
2. open GitHub Actions and confirm `CI` starts for the exact target SHA
3. wait for `CI` to pass completely
4. confirm `Deploy Staging` starts for the same SHA
5. monitor these stages in the workflow:
   - release archive upload
   - runtime env render and upload
   - `WHATSAPP_GATEWAY_TOKEN` fingerprint parity log
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
- admin site loads
- public site loads
- if the rollout is the first hosted deploy for that environment, allow for initial Caddy ACME warm-up instead of treating the first transient TLS error as immediate app failure

### 5.2 Observability

- API response includes `X-Request-Id`
- the same `X-Request-Id` can be found in API container logs
- API logs are structured JSON
- WhatsApp gateway logs are structured JSON
- error responses include `message`, `error.code`, and `error.requestId`
- deploy log shows the same `WHATSAPP_GATEWAY_TOKEN` fingerprint for `api` and `whatsapp-gateway`

### 5.3 Security and hardening

- admin/public/API domains return expected security headers
- trusted-origin enforcement blocks invalid state-changing requests
- rate limiting behaves correctly for login and token-redeem paths
- customer magic-link and direct-status flow still work without extra friction
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

### 5.5 WhatsApp runtime

- status page loads
- pairing material can be generated if not already paired
- gateway reports connected state
- welcome or transactional send succeeds
- mirrored inbound or outbound activity appears in admin
- gateway still reconnects after restart
- persisted auth survives container restart

### 5.6 Rollback proof

- intentionally bad release path or equivalent rollback test was executed
- rollback restored the last healthy SHA
- post-rollback smoke checks passed

## 6. Staging Go/No-Go

Production is blocked unless all are true:

- staging deploy passed
- staging validation passed
- rollback proof passed
- WhatsApp real-device validation passed
- no unresolved `5xx` spike or auth/session regression remains

Decision:

- staging signoff:
- approved by:
- time:

## 7. Production Pre-Deploy

- target production SHA exactly matches the staging-validated SHA
- last known good production SHA is recorded
- production VM is reachable over SSH
- production DNS resolves correctly
- GitHub `production` environment secrets are current
- production `PRODUCTION_DEPLOY_RESET_TOKEN` is unchanged unless the rollout explicitly intends to wipe persistent data
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
   - `WHATSAPP_GATEWAY_TOKEN` fingerprint parity log
   - remote deploy script
   - internal container readiness wait
   - smoke checks
5. record result:
   - production deploy status:
   - production workflow URL:

## 9. Production Validation

- `https://api.cjlaundry.com/health` returns success
- `https://api.cjlaundry.com/ready` returns success
- `/ready` shows the expected `release.sha`
- admin site loads
- public site loads
- admin login works
- one customer-safe business flow works end to end
- API logs and request IDs are visible

## 10. First-Hour Monitoring

Monitor for at least 60 minutes after production goes live.

- check `401` spike
- check `429` spike
- check `5xx` spike
- check notification delivery failures
- check gateway disconnect or auth failures
- check customer login or magic-link complaints
- confirm no rollback trigger condition is reached

Record:

- first-hour reviewer:
- start time:
- end time:
- summary:

## 11. Rollback Trigger Conditions

Rollback immediately if any of the following is true:

- production smoke checks fail
- `/ready` fails after deploy
- admin login is broken
- customer login or direct-status flow is broken broadly
- WhatsApp gateway breaks required production operations
- sustained `5xx` errors appear without a fast fix
- request correlation or logs are insufficient to triage safely during the incident window

## 12. Rollback Execution

- identify the last healthy SHA
- confirm the current incident requires rollback, not a quick forward fix
- execute workflow rollback or re-deploy the last healthy SHA
- if GitHub is unavailable, use `deploy/scripts/remote-rollback.sh` on the VM
- re-run health, readiness, admin, public, and one core business smoke check
- document rollback result and incident summary

## 13. Closeout

- final deployed SHA:
- rollback used: yes or no
- open follow-up issues:
- docs needing update:
- incident summary or release notes link:
