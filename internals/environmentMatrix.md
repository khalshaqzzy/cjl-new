# Environment Matrix

Document status: Active  
Last updated: 2026-04-02  
Purpose: runtime and validation topology snapshot after WhatsApp Cloud-only cutover prep

| Environment | Public web | Admin web | API | Runtime target | Build location | Data store |
| --- | --- | --- | --- | --- | --- | --- |
| `local` | `http://localhost:3000` | `http://localhost:3001` | `http://localhost:4000` | local machine | local machine | local MongoDB single-node replica set |
| `staging` | `https://staging.cjlaundry.com` | `https://admin-staging.cjlaundry.com` | `https://api-staging.cjlaundry.com` | one GCP VM | built on staging VM | MongoDB container single-node replica set on staging VM |
| `production` | `https://cjlaundry.com` | `https://admin.cjlaundry.com` | `https://api.cjlaundry.com` | one GCP VM | built on production VM | MongoDB container single-node replica set on production VM |

## Local Workspace Runtime

- package manager: `npm` workspaces from repo root
- API dev runtime: `npm run dev:api`
- admin dev runtime: `npm run dev --workspace @cjl/admin-web`
- public dev runtime: `npm run dev --workspace @cjl/public-web`
- deprecated gateway package remains in repo as code only and is not part of the active local runtime

## Local Container Runtime

- root entrypoint: `docker-compose.yml`
- services:
  - `mongo`
  - `api`
  - `admin-web`
  - `public-web`
- intended use:
  - local full-stack boot
  - container build sanity
  - Cloud-era config smoke only; not real Meta delivery

## Automated Verification Runtime

- backend integration tests:
  - command: `npm run test:backend`
  - database: `mongodb-memory-server` replica set
  - API exercised over real HTTP
  - outbound Cloud API exercised through a local Graph stub
  - webhook verification, status ingestion, unread clearing, manual send, resend, and startup backfill are covered here
- frontend e2e tests:
  - command: `npm run test:e2e`
  - admin/public frontends started from local workspace scripts
  - API test server started from `scripts/testing/start-api.ts`
  - database: `mongodb-memory-server` replica set
  - WhatsApp inbox/media/recovery behavior exercised through the same Cloud-era stubbed API path

## Hosted Runtime

- staging and production each use:
  - one Ubuntu VM
  - Docker Engine + Compose plugin
  - Caddy reverse proxy with host-based routing
  - MongoDB container on the internal Docker network in single-node replica-set mode
  - API, admin, and public services built locally on the VM
- active WhatsApp runtime path:
  - Cloud API outbound from the API service
  - signed Meta webhook into the API service
  - GridFS-backed inbound media storage in MongoDB
- deprecated gateway package is retained in repo only and is not started on local, staging, or production runtime paths

## Hosted Hardening Baseline

- API emits structured JSON logs to stdout
- every API response includes `X-Request-Id`
- API error envelopes include `message`, `error.code`, and `error.requestId`
- staging and production enforce hosted env validation for secrets, trusted origins, secure cookies, and proxy settings
- session-authenticated write endpoints enforce trusted `Origin` or `Referer`
- login and token-redeem abuse controls use Mongo-backed rate limiting
- customer magic-link and direct status tokens are stored as hashes
- API, admin, and public containers run as non-root
- `/ready` must report:
  - Mongo connectivity
  - seeded settings/admin readiness
  - Cloud provider config presence
  - configured webhook path

## Deployment Orchestration

- CI runs on GitHub Actions
- deploy workflows run on GitHub Actions
- GitHub streams a release archive over SSH to the target VM
- the target VM runs `docker compose up -d --build`
- hosted runtime env is rendered by the workflow and must include Cloud API secrets:
  - `*_WHATSAPP_BUSINESS_ID`
  - `*_WHATSAPP_WABA_ID`
  - `*_WHATSAPP_PHONE_NUMBER_ID`
  - `*_WHATSAPP_ACCESS_TOKEN`
  - `*_WHATSAPP_APP_SECRET`
  - `*_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
