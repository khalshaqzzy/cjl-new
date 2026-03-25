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
- real WhatsApp delivery via dedicated gateway sidecar with persistent auth volume
- admin WhatsApp status page plus read-only mirrored inbox backed by API-owned chat/message records
- uppercase customer-name normalization plus repo-safe startup backfill for legacy customer/order/notification name snapshots
- PDF receipt downloads for admin notification fallback and authenticated portal order detail
- manual WhatsApp fallback for failed notification sends with admin outbox action support
- customer-controlled public leaderboard name visibility with masked-by-default display
- expanded admin dashboard reporting payload and UI
- multi-contact admin WhatsApp settings with one customer-facing primary contact and legacy-settings backfill
- landing page and other public contact surfaces now resolve from the primary admin contact with fallback `087780563875`
- portal dashboard now includes a mobile-friendly `Chat Admin` selector and explicit mobile logout affordance
- customer registration and customer detail now support one-time magic-login links plus admin QR display flows
- customer auth now supports manual login plus one-time magic-link redeem with a sliding 30-day customer session while admin remains at 7 days
- root-level Docker Compose topology for local full-stack runtime
- backend integration coverage and frontend end-to-end coverage that pass from root test commands
- branch-based CI and hosted deploy workflows committed in repo
- root `typecheck` now bootstraps `@cjl/contracts` before workspace checks so clean CI runners resolve shared contracts reliably
- CI now installs Playwright Chromium on GitHub runners before `npm test` so E2E does not depend on prewarmed browser caches
- remote deploy now waits for container readiness and smoke checks retry transient TLS warm-up failures during first hosted rollouts
- WhatsApp gateway runtime now imports `whatsapp-web.js` through CommonJS-safe interop so hosted Node ESM startup matches local development behavior
- remote deploy assets for Caddy, Compose, release shipping, smoke checks, and rollback
- hosted and local runtime env contracts updated for WhatsApp gateway auth and persistence

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
- settings now also manage ordered admin WhatsApp contacts with exactly one primary customer-facing number
- admin logout now invalidates backend session instead of only navigating client-side
- notification outbox UI now follows canonical backend fields and receipt download flow
- notification outbox now supports manual WhatsApp fallback for failed sends and receipt download visibility beyond failed-only cards
- admin dashboard now exposes the full PRD metric set plus top-customer visibility
- customer list/search now relies on backend querying and machine-sort fields instead of brittle client-only filtering
- POS now surfaces duplicate-phone selection feedback, preview failures, and post-confirmation shortcuts
- POS and customer-detail flows can now show QR/login-link sheets backed by one-time customer magic links

### Phase 4: Public Surface Integration

Status: complete for current scope

- landing, login, portal, order history, stamp view, leaderboard, and direct order status pages consume backend APIs
- landing hero/contact and direct-status contact CTA now follow the primary admin WhatsApp contact instead of hardcoded/public-gateway assumptions
- portal shell validates backend customer session before rendering protected pages
- monthly summary UI now surfaces the full non-monetary PRD fields returned by backend
- public non-landing pages no longer rely on `mock-data` presenter helpers for runtime status rendering
- portal and direct-status order detail flows now surface cancellation timestamp and cancellation reason when relevant
- authenticated portal order detail now exposes receipt-style itemized pricing plus PDF receipt download
- public leaderboard and landing teaser now respect masked-by-default names with portal-controlled opt-in visibility
- public login now redirects authenticated customers directly to the portal and protected shells render a visible session-check state
- portal dashboard now exposes an `Admin 1 / Admin 2 / ...` chat selector and a clearer mobile logout path
- public `/auto-login` now redeems one-time customer magic links and rejects reuse

### Phase 5: Post-Integration Stabilization

Status: complete in repo terms

- session cookie secure env parsing fixed so local HTTP sessions work in browser-based flows
- customer session lifetime now slides 30 days from the latest authenticated request while admin remains fixed at 7 days
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
- CI security scan now pins `aquasecurity/trivy-action` immutably by SHA and keeps an explicit Trivy CLI version pin
- staging and production deploy workflows now exist with branch-based auto-deploy triggers
- hosted smoke checks now explicitly tolerate first-deploy Caddy TLS issuance lag instead of failing fast on transient handshake errors
- remote deploy assets now exist for Caddy, Compose, runtime env contracts, smoke checks, and rollback
- hosted deployment model is now fixed as SSH-orchestrated VM-local builds

### Phase 8: Hosted Environment Validation and Operations Hardening

Status: next recommended phase

Focus:

- run the first real staging rollout on GCP and validate the runbook against reality
- verify Caddy TLS issuance, DNS, and VM sizing under real deployment conditions
- validate WhatsApp sidecar pairing, session persistence, reconnect behavior, and mirrored inbox data on staging
- decide whether the in-process outbox should remain monolith-local or evolve into a separate queue when hosted scale/operability requires it

## Important Notes

- live deployment implementation is now prepared in repo terms, but still requires real cloud provisioning and first rollout validation
- automated testing is now in scope for local repo verification and is implemented
- multiple lockfiles still exist in the monorepo, but explicit Turbopack root removed the earlier workspace-root warning blocker
- hosted rollout is now blocked more by real-device validation than by missing WhatsApp implementation code
- production hardening now includes structured runtime logging, typed error envelopes, token-hash persistence, origin checks, Mongo-backed rate limiting, and CI security gates
- clean-checkout CI validation no longer depends on a prebuilt committed `packages/contracts/dist` artifact
- clean-checkout CI validation now also provisions the required Playwright Chromium binary explicitly before E2E starts
- the next meaningful milestone is no longer repo implementation; it is successful staging execution of the new readiness checklist and rollback path
