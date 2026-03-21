# Session Handoff 2026-03-21

Document status: Active  
Purpose: repo snapshot after deployment/workflow work plus PRD-gap closure for backend/frontend integration

## What This Session Completed

- added hosted deploy assets:
  - `deploy/api/docker-compose.remote.yml`
  - `deploy/api/Caddyfile`
  - `deploy/scripts/bootstrap-vm.sh`
  - `deploy/env/runtime.staging.env.example`
  - `deploy/env/runtime.production.env.example`
  - `deploy/scripts/remote-deploy.sh`
  - `deploy/scripts/remote-rollback.sh`
  - `deploy/scripts/smoke-check.sh`
- added GitHub workflows:
  - `.github/workflows/ci.yml`
  - `.github/workflows/deploy-staging.yml`
  - `.github/workflows/deploy-production.yml`
- added local env example files for API, admin web, and public web
- added `/ready` endpoint for deployment smoke and dependency validation
- added proxy-aware API env support:
  - `APP_ENV`
  - `TRUST_PROXY`
  - `ADMIN_PASSWORD_HASH`
- changed bootstrap admin seeding so hosted environments can seed from a bcrypt hash instead of a plaintext password
- documented the full hosted deployment path in:
  - `internals/deploymentGuide.md`
  - `internals/environmentMatrix.md`
  - `internals/manualProvisioningChecklist.md`
- expanded the deployment guide so it now explains:
  - exactly where local envs live
  - exactly where GitHub environment secrets go
  - exactly where hosted runtime env files are rendered on the VM
  - how to generate and install deploy-user SSH keys
  - how to bootstrap a fresh VM with the repo script
- added ADR for SSH-orchestrated VM-local builds instead of GitHub-built images
- upgraded core business mutations to transaction-backed flows
- upgraded local and hosted Mongo Compose topology to single-node replica-set mode for transaction support
- added in-process notification outbox worker with separate render vs delivery state for order confirmations
- replaced unsafe read-then-write idempotency with durable request records and stable request fingerprint checks
- expanded admin dashboard reporting to cover the required PRD metrics and top service usage
- fixed admin logout so it invalidates the backend session
- removed runtime mock initialization from key admin/customer/settings flows and replaced them with API-driven loading/error states
- expanded automated coverage for:
  - idempotent mutation replay
  - transactional rollback behavior
  - outbox render failure, resend, and manual resolve
  - customer-login throttling
  - archived leaderboard month availability after correction
  - admin logout and extended portal summary e2e coverage
- added ADR for transactional Mongo runtime plus in-process outbox worker

## Verification Run

- `npm run build`
- `docker compose config`
- `docker compose --project-directory . --env-file deploy/env/runtime.staging.env.example -f deploy/api/docker-compose.remote.yml config`
- `npm run test:backend`
- `npm run test:e2e`
- `npm test`

All passed at session end.

## Important Repo Facts

- hosted deploy model is now:
  - CI on GitHub
  - release archive streamed over SSH to the VM
  - Docker images built on the VM
  - Caddy routes all three domains on the same environment VM
- current workflows assume:
  - branch `staging` auto-deploys staging after CI success
  - branch `main` auto-deploys production after CI success
- current e2e harness still uses `mongodb-memory-server` for speed and daemon independence
- current backend and e2e harness now use replica-set-capable in-memory Mongo for transaction validation
- first real cloud rollout has not been executed yet in this session
- a reusable VM bootstrap script now exists for creating the deploy user, installing Docker, and creating the expected `/opt/cjl/<env>` runtime layout
- frontend session behavior depends on:
  - `SESSION_COOKIE_SECURE=false` for local HTTP
  - `SESSION_COOKIE_SECURE=true` and `TRUST_PROXY=1` for hosted HTTPS behind Caddy
- notification delivery is still simulated via the outbox worker; a real WhatsApp adapter is still deferred

## Recommended Next Start

1. provision the real staging VM and staging DNS
2. validate hosted replica-set initialization plus deploy workflow on staging
3. decide the next step for the deferred WhatsApp adapter on top of the outbox worker
