# Session Handoff 2026-03-28

Document status: Active  
Purpose: repo snapshot after POS catalog expansion, Laundry tab expansion, dashboard attention reorder, richer failed-notification recovery UX, and order-read amplification reduction for admin Laundry

## What This Session Completed

- added two new backend-owned POS catalog items:
  - `Setrika Saja` as `ironing_only` at Rp 5.000/kg
  - `Plastik Laundry` as `laundry_plastic` at Rp 2.000/unit
- kept the public landing page unchanged in behavior by excluding the two new POS-only items from the public landing service payload
- corrected per-kg order persistence so per-kg lines now store the billed weight quantity instead of the toggle count, which keeps receipt/history quantity labels aligned with actual order weight
- updated shared order service-summary formatting so per-kg lines render as weight-based labels across admin/public views instead of awkward `1x` summaries
- expanded admin POS flow so the selected customer identity remains visible:
  - after customer selection
  - during service selection
  - inside order confirmation summary
- expanded the admin Laundry surface from one active list into three operator views:
  - `Aktif`
  - `Hari Ini`
  - `History`
- added backend-driven Laundry querying with:
  - `scope`
  - `search`
  - `sort`
  - `status`
  - `includeCancelled`
- reduced laundry-order read amplification by:
  - introducing lifecycle-aware `activityAt` on orders,
  - backfilling `activityAt` during startup for legacy orders,
  - adding order indexes aligned to `activityAt`,
  - switching `History` responses to cursor-based pagination instead of full collection reads
- kept `Aktif` behavior aligned with the prior default view while adding:
  - today-wide operational visibility
  - history search/filter/sort
  - default-off cancelled visibility
- moved dashboard `Perlu Perhatian` above KPI cards without redesigning the rest of the dashboard
- expanded notification delivery state to include `ignored`
- added explicit admin notification actions:
  - `Send Message`
  - `Download Receipt`
  - `Resend Message` / `Kirim Ulang`
  - `Mark as Done`
  - `Ignore`
- split notification follow-up visibility into `Manual` and `Ignored` tabs
- kept receipt download available for order-confirmed notifications outside the failed state when the artifact exists
- added lightweight failed-WA toast polling in admin shell so newly detected failed notifications can surface a short popup during an active admin session
- updated PRD, implementation snapshot, and backlog internals to reflect the new catalog, Laundry UX, and notification handling model
- added backend regression coverage for:
  - seed-time service catalog merge,
  - `activityAt` backfill,
  - laundry history cursor pagination,
  - invalid history cursor validation

## Verification Run

- `npm run typecheck`
- `npm run test:backend`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts --reporter=line`

All passed at session end.

## Important Repo Facts

- `ironing_only` and `laundry_plastic` are intentionally POS-only in v1 and must stay off the landing page unless product intent changes
- per-kg order lines now persist billed weight quantities, so downstream receipt/detail renderers should no longer assume per-kg items store a placeholder quantity of `1`
- the admin failed-notification popup uses lightweight polling from `AdminShell`; local/test environments poll faster than hosted environments for practicality
- `manual_resolved` and `ignored` are now distinct terminal delivery states and should not be collapsed back together silently
- the backend still retains the older `manual-resolve` endpoint for compatibility, but the intended operator path is now `manual-complete` / `ignore` plus `manual-whatsapp`
- if future sessions add more POS-only items, keep the public landing filter explicit instead of relying on UI-only hiding
- startup on staging/production will now perform a targeted `orders.activityAt` backfill for legacy rows plus create new order indexes if they do not exist
- editor warnings in `packages/api/test/integration.test.ts` are currently real standalone TypeScript diagnostics, but they are not yet enforced by root `npm run typecheck` because backend tests are outside the package TS project config

## Recommended Next Start

1. validate the expanded Laundry tabs on staging with real cashier workflows, especially `Hari Ini`, paginated `History`, and cancelled-toggle behavior
2. observe first-start deploy timing on staging for `activityAt` backfill and new index creation before allowing production rollout
3. validate the richer failed-notification recovery model on staging, including `Manual` vs `Ignored` classification and repeated receipt download for failed/manual/ignored order confirmations
4. exercise the failed-WA popup behavior on staging and decide whether operators want any debounce/grouping before production
5. add a dedicated TypeScript test-project config/script for `packages/api/test/*.ts` so editor diagnostics on integration tests are promoted into CI-visible checks
