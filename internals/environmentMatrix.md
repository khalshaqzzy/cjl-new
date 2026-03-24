# Environment Matrix

Document status: Active  
Created: 2026-03-21  
Purpose: runtime and verification topology snapshot for local, staging, and production

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
- shared contracts must be buildable from `packages/contracts`

## Local Container Runtime

- root entrypoint: `docker-compose.yml`
- services:
  - `mongo`
  - `api`
  - `whatsapp-gateway`
  - `admin-web`
  - `public-web`
- intended use:
  - local full-stack boot
  - container build sanity

## Automated Verification Runtime

- backend integration tests:
  - command: `npm run test:backend`
  - database: `mongodb-memory-server` replica set
  - API exercised over real HTTP on test port
  - WhatsApp transport exercised through a mocked gateway over real HTTP
- frontend e2e tests:
  - command: `npm run test:e2e`
  - admin/public frontends started from local workspace scripts
  - API test server started from `scripts/testing/start-api.ts`
  - database: `mongodb-memory-server` replica set

## Hosted Runtime

- staging and production each use:
  - one Ubuntu VM
  - Docker Engine + Compose plugin
  - Caddy reverse proxy with host-based routing
  - MongoDB container on the internal Docker network in single-node replica-set mode
  - MongoDB internal replica-set keyfile rendered from `MONGO_REPLICA_KEY`
  - API, WhatsApp gateway, admin, and public services built locally on the VM
  - persistent WhatsApp auth bind-mount at `${SHARED_DIR}/whatsapp-auth`

## Deployment Orchestration

- CI runs on GitHub Actions
- deploy workflows run on GitHub Actions
- GitHub does not build deploy images for hosted environments
- GitHub streams a release archive over SSH to the target VM
- the target VM runs `docker compose up -d --build`
