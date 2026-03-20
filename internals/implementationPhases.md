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

Status: next recommended phase

Focus:

- smoke run full stack against a real Mongo instance
- remove non-blocking repo/config warnings
- improve loading/error handling polish

## Important Notes

- deployment, testing, and Docker are still intentionally out of scope
- Next.js build warnings remain for deprecated `eslint` config key and workspace root inference from multiple lockfiles
