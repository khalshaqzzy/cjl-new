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
- transaction-backed core admin mutations for customer create, order confirm, order done, and void flows
- in-process outbox worker with separate receipt render vs delivery state for confirmation notifications
- uppercase customer-name normalization plus repo-safe startup backfill for legacy customer/order/notification name snapshots
- PDF receipt downloads for admin notification fallback and authenticated portal order detail
- manual WhatsApp fallback for failed notification sends with admin outbox action support
- customer-controlled public leaderboard name visibility with masked-by-default display
- expanded admin dashboard reporting payload and UI
- root-level Docker Compose topology for local full-stack runtime
- backend integration coverage and frontend end-to-end coverage that pass from root test commands
- branch-based CI and hosted deploy workflows committed in repo
- remote deploy assets for Caddy, Compose, release shipping, smoke checks, and rollback

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
- Mongo runtime is now expected to run in replica-set mode so transactions are available
- leaderboard module added and backend build blockers removed

### Phase 3: Admin Surface Integration

Status: complete for current scope

- dashboard, customers, customer detail, active laundry, notifications, settings, and POS are connected to backend
- customer detail now supports void/cancel flow from UI
- settings now manage business profile, service prices, and message template blocks
- admin logout now invalidates backend session instead of only navigating client-side
- notification outbox UI now follows canonical backend fields and receipt download flow
- notification outbox now supports manual WhatsApp fallback for failed sends and receipt download visibility beyond failed-only cards
- admin dashboard now exposes the full PRD metric set plus top-customer visibility
- customer list/search now relies on backend querying and machine-sort fields instead of brittle client-only filtering
- POS now surfaces duplicate-phone selection feedback, preview failures, and post-confirmation shortcuts

### Phase 4: Public Surface Integration

Status: complete for current scope

- landing, login, portal, order history, stamp view, leaderboard, and direct order status pages consume backend APIs
- portal shell validates backend customer session before rendering protected pages
- monthly summary UI now surfaces the full non-monetary PRD fields returned by backend
- public non-landing pages no longer rely on `mock-data` presenter helpers for runtime status rendering
- portal and direct-status order detail flows now surface cancellation timestamp and cancellation reason when relevant
- authenticated portal order detail now exposes receipt-style itemized pricing plus PDF receipt download
- public leaderboard and landing teaser now respect masked-by-default names with portal-controlled opt-in visibility
- public login now redirects authenticated customers directly to the portal and protected shells render a visible session-check state

### Phase 5: Post-Integration Stabilization

Status: complete in repo terms

- session cookie secure env parsing fixed so local HTTP sessions work in browser-based flows
- customer detail admin UI now keeps cancelled orders visible in history instead of silently hiding them
- non-blocking Next.js config warning for deprecated `eslint` key was removed
- Turbopack workspace root is now explicit for both frontend apps
- runtime mock initialization has been removed from key admin/settings/customer detail flows

### Phase 6: Local Containerization and Test Automation

Status: complete in repo terms

- `docker-compose.yml` now defines local `mongo`, `api`, `admin-web`, and `public-web` services
- local and hosted Mongo Compose topologies now initialize a single-node replica set for transaction support
- per-service Dockerfiles added for API and both frontend apps
- backend integration suite added in `packages/api/test/integration.test.ts`
- frontend end-to-end suite added in `tests/e2e/full-stack.spec.ts`
- root scripts now cover `npm test`, `npm run test:backend`, `npm run test:e2e`, and Docker Compose helpers

### Phase 7: Release and CI Hardening

Status: complete in repo terms

- CI workflow now validates test, build, and compose config
- staging and production deploy workflows now exist with branch-based auto-deploy triggers
- remote deploy assets now exist for Caddy, Compose, runtime env contracts, smoke checks, and rollback
- hosted deployment model is now fixed as SSH-orchestrated VM-local builds

### Phase 8: Hosted Environment Validation and Operations Hardening

Status: next recommended phase

Focus:

- run the first real staging rollout on GCP and validate the runbook against reality
- verify Caddy TLS issuance, DNS, and VM sizing under real deployment conditions
- add operational hardening for backups, log access, and WhatsApp session persistence when the real adapter is implemented
- decide whether the in-process outbox should remain monolith-local or evolve into a separate queue when hosted scale/operability requires it

## Important Notes

- live deployment implementation is now prepared in repo terms, but still requires real cloud provisioning and first rollout validation
- automated testing is now in scope for local repo verification and is implemented
- multiple lockfiles still exist in the monorepo, but explicit Turbopack root removed the earlier workspace-root warning blocker
