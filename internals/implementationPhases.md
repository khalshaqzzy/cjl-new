# Implementation Phases

Document status: Active  
Purpose: compact repo-level implementation status snapshot

## Current Repo Status

The repo now has:

- buildable contract package in `packages/contracts`
- buildable Express API package in `packages/api`
- buildable admin Next.js app in `app/admin-web`
- buildable public Next.js app in `app/public-web`
- primary admin and public product flows wired to backend APIs
- root-level Docker Compose topology for local full-stack runtime
- backend integration coverage and frontend end-to-end coverage that pass from root test commands

## Phase Snapshot

### Phase 1: Workspace and Contract Foundation

Status: complete in repo terms

- monorepo workspaces established
- shared contracts package available and consumed across apps
- monorepo build command passes

### Phase 2: Core Backend Runtime

Status: complete for current scope

- Express app routes implemented for admin and public surfaces
- Mongo-backed services for customers, orders, notifications, settings, and sessions implemented
- leaderboard module added and backend build blockers removed

### Phase 3: Admin Surface Integration

Status: complete for current scope

- dashboard, customers, customer detail, active laundry, notifications, settings, and POS are connected to backend
- customer detail now supports void/cancel flow from UI
- settings now manage business profile, service prices, and message template blocks

### Phase 4: Public Surface Integration

Status: complete for current scope

- landing, login, portal, order history, stamp view, leaderboard, and direct order status pages consume backend APIs
- portal shell validates backend customer session before rendering protected pages

### Phase 5: Post-Integration Stabilization

Status: complete in repo terms

- session cookie secure env parsing fixed so local HTTP sessions work in browser-based flows
- customer detail admin UI now keeps cancelled orders visible in history instead of silently hiding them
- non-blocking Next.js config warning for deprecated `eslint` key was removed
- Turbopack workspace root is now explicit for both frontend apps

### Phase 6: Local Containerization and Test Automation

Status: complete in repo terms

- `docker-compose.yml` now defines local `mongo`, `api`, `admin-web`, and `public-web` services
- per-service Dockerfiles added for API and both frontend apps
- backend integration suite added in `packages/api/test/integration.test.ts`
- frontend end-to-end suite added in `tests/e2e/full-stack.spec.ts`
- root scripts now cover `npm test`, `npm run test:backend`, `npm run test:e2e`, and Docker Compose helpers

### Phase 7: Release and CI Hardening

Status: next recommended phase

Focus:

- wire current tests into CI so regressions block merges automatically
- decide production/staging image build and VM runtime conventions using the new Docker artifacts
- expand scenario coverage beyond the current happy-path plus correction-path flows
- document secrets, reverse proxy, and backup/restore expectations before live deployment work resumes

## Important Notes

- live deployment remains out of scope in repo terms even though local Docker runtime files now exist
- automated testing is now in scope for local repo verification and is implemented
- multiple lockfiles still exist in the monorepo, but explicit Turbopack root removed the earlier workspace-root warning blocker
