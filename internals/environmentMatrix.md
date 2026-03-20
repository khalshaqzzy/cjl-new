# Environment Matrix

Document status: Active  
Created: 2026-03-21  
Purpose: runtime and verification topology snapshot for local and future hosted environments

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
  - `admin-web`
  - `public-web`
- intended use:
  - local full-stack boot
  - container build sanity
  - future base for VM runtime packaging

## Local Automated Test Runtime

- backend integration tests:
  - command: `npm run test:backend`
  - database: `mongodb-memory-server`
  - API exercised over real HTTP on test port
- frontend e2e tests:
  - command: `npm run test:e2e`
  - admin/public frontends started from local workspace scripts
  - API test server started from `scripts/testing/start-api.ts`
  - database: `mongodb-memory-server`

## Future Hosted Environments

- staging: not implemented in repo runtime yet
- production: not implemented in repo runtime yet

Live deployment topology remains deferred even though local Docker artifacts now exist.
