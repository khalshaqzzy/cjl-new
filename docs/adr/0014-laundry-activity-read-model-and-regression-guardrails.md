# ADR-2026-03-28 Laundry Activity Read Model and Regression Guardrails

Status: Accepted  
Date: 2026-03-28  
Owners: Codex implementation session  

## Context

Admin Laundry evolved from a single active list into:

- `Aktif`
- `Hari Ini`
- `History`

The original query approach was acceptable for a small active queue, but it began to create avoidable read amplification once `History` and `Hari Ini` were added:

- `History` tended toward reading the full `orders` collection
- `Hari Ini` depended on multiple lifecycle timestamps (`createdAt`, `completedAt`, `voidedAt`)
- future operator search and sort needs would make broad scans worse over time

At the same time, production rollout needed a safe path for existing data. Legacy orders did not yet have a single lifecycle-aware field that could support these admin read paths efficiently.

## Decision

We adopted a lightweight denormalized read strategy inside the main `orders` collection instead of introducing a separate read-model collection in this step.

The implementation now:

- stores `activityAt` on every order
- sets `activityAt = createdAt` when order is confirmed
- updates `activityAt = completedAt` when order is marked done
- updates `activityAt = voidedAt` when order is voided
- backfills `activityAt` during startup for legacy rows
- adds Mongo indexes aligned to `activityAt`
- uses `activityAt` for `Hari Ini` and `History`
- returns paginated/cursor-based responses for Laundry `History`

This keeps the operator UX unchanged while reducing repeated full-order reads for the most expensive admin history path.

## Consequences

### Positive

- `History` no longer needs to load the full order collection for a normal admin session
- `Hari Ini` can be queried from one lifecycle-aware field instead of repeated multi-timestamp scans
- startup backfill keeps rollout additive and compatible with existing production data
- the change remains simpler than introducing and operating a separate `admin_laundry_views` collection

### Negative

- production startup now performs targeted backfill and index creation work on `orders`
- `activityAt` becomes another denormalized field that must stay in sync with order lifecycle transitions
- the repo still lacks a dedicated TypeScript project config for backend test files, so editor diagnostics on integration tests are not fully enforced by the main `typecheck` script

## Verification Added

Regression coverage now explicitly checks:

- service-catalog seed merge on existing settings
- `activityAt` backfill for `Active`, `Done`, and `Voided` orders
- Laundry history cursor pagination
- invalid cursor handling
- lifecycle-aware `Hari Ini` behavior

Current verification commands:

- `npm run test:backend`
- `npm run typecheck`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts --reporter=line`

## Recommendations

### Order Read Amplification

Recommended next step if order volume grows further:

1. Keep `Aktif` on the current direct query path.
2. Keep `Hari Ini` on `activityAt` plus indexes.
3. If `History` becomes materially larger, introduce a dedicated admin laundry read model or archive strategy rather than expanding flexible scans on `orders`.
4. Avoid broad regex-heavy query growth on the main `orders` collection; prefer normalized search fields or a separate read model first.

### Test Scripts

Recommended repo follow-up:

1. Add `packages/api/tsconfig.test.json` that includes `test/**/*.ts` and supports the current NodeNext test-import pattern.
2. Add a dedicated script such as `npm run typecheck:backend-tests`.
3. Make backend integration test diagnostics visible in CI, so editor warnings on `packages/api/test/integration.test.ts` are no longer out-of-band.

This recommendation is intentionally separate from the current implementation because the runtime/test behavior is already stable, while the missing test-project config is primarily a repo hygiene and developer-feedback gap.
