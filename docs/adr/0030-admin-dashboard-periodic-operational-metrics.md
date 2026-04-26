# ADR 0030: Admin Dashboard Periodic Operational Metrics

Status: Accepted
Date: 2026-04-26
Scope: admin dashboard API contract, admin dashboard aggregation, and admin web dashboard layout

## Context

The admin dashboard previously mixed operational and sales signals, but did not expose enough period-aware metrics for day-to-day laundry operations. The operator needed:

- daily, weekly, and monthly dashboard views with different KPI priorities
- average daily revenue for the current week and current month
- complete item quantity reporting across all service lines
- a capacity-oriented operational unit metric based on washer, dryer, and package work
- switchable charts for revenue, item/service quantities, and operational units
- mobile-first admin usability without changing public web, POS pricing, point logic, or deployment behavior

The reporting rules for this codebase require:

- `Asia/Jakarta` reporting windows
- Monday as the start of week
- `Voided` orders excluded from sales and operations metrics
- existing stored order line quantities used as the source of truth

## Decision Drivers

- Operators need different information for same-day action versus weekly/monthly review.
- Dashboard metrics must match persisted order facts and avoid one-off client-side derivations.
- Mobile admin must remain first-class because operators may use the dashboard on narrow devices.
- The existing white surface, rose accent, and compact admin shell should remain the visual baseline.
- The change must not require a MongoDB data migration or production seed.

## Considered Options

### Option 1: Keep Total Items as the Only Items Chart

Pros:

- Smallest contract and UI change.
- Easy to explain.

Cons:

- Does not answer which services are driving volume.
- Per-kg and per-unit services become indistinguishable in chart review.
- Operators still need to inspect service tables manually.

### Option 2: Add a Separate Chart for Every Service

Pros:

- All service trends are visible at once.
- No extra picker interaction.

Cons:

- Too dense for mobile.
- Many services make the chart hard to read.
- Forces complex legends and colors into a simple operational dashboard.

### Option 3: Keep One Items Chart with a Service Picker

Pros:

- Preserves a compact chart panel.
- Lets operators inspect each service line without horizontal chart overflow.
- Works well on mobile with scrollable chips.
- Keeps the API contract explicit through `itemsByService`.

Cons:

- Requires one additional user choice when reviewing service trends.
- The API response is larger because each bucket carries service breakdowns.

## Decision

Adopt option 3.

The admin dashboard API returns period buckets with:

- `netSales`
- total `itemsSold`
- `itemsByService[]`
- `operationalUnits`

`itemsByService[]` is derived at request time from `order.items[]` and contains service code, display label, and quantity per chart bucket.

`operationalUnits` is derived at request time using:

```text
washer + dryer + 2 * wash_dry_package + 2 * wash_dry_fold_package
```

Other services, including detergent, softener, ironing, plastic, and hanger, contribute to item quantity but not operational units.

The admin web dashboard uses different KPI sets by selected period:

- `Hari Ini`: no chart; cards show `Penjualan Bersih`, `Unit Operasional`, `Items Terjual`, and `Order Aktif`
- `Minggu Ini` and `Bulan Ini`: chart shown; cards show `Total Penjualan Bersih`, `Avg Penjualan / Hari`, `Avg Mesin / Hari`, and `Total Mesin`

Weekly/monthly average revenue uses elapsed days in the running period. Average machine units per day uses the same elapsed-day denominator.

The dashboard also:

- lists all service usage entries, not only the top five
- returns up to 30 top customers
- exposes uncensored customer names in the admin-only top-customer response
- keeps the public web and customer-facing surfaces unchanged

## Rationale

The dashboard is an admin-only operational surface. It should optimize for scan speed and capacity awareness rather than customer privacy masking or marketing presentation. The API already owns business reporting rules, so deriving these fields in the API keeps the UI simple and avoids duplicate aggregation logic.

No persisted schema change is required because all new values can be computed from existing order documents:

- `order.items[].quantity`
- `order.items[].serviceCode`
- `order.items[].serviceLabel`
- `order.status`
- `order.createdAt`
- `order.total`
- `order.customerName`

Therefore `packages/api/src/seed.ts` does not need to change for this decision.

## Consequences

### Positive

- Operators can distinguish total item movement from washer/dryer/package workload.
- Weekly and monthly views show averages that are meaningful for running-period review.
- Daily view becomes faster to scan by removing chart noise.
- Mobile layout avoids horizontal overflow and keeps chart controls compact.
- Admin can see real top-customer names where operational identification matters.

### Negative

- The dashboard response payload is larger because chart buckets include service breakdowns.
- The `topCustomers` response now includes `customerName`, which must remain scoped to authenticated admin endpoints.
- Future service-code changes must consider whether the service contributes to operational units.

### Risks and Mitigations

- Risk: a new machine/package service is added but not included in operational units.
  - Mitigation: update the operational unit multiplier map and backend integration tests with any new machine/package service.
- Risk: long service/customer names create mobile overflow.
  - Mitigation: dashboard rows and chips use truncation, bounded heights, and scrollable lists.
- Risk: consumers outside admin start relying on admin-only customer names.
  - Mitigation: keep `customerName` only in the admin dashboard contract and do not expose it in public contracts.

## Verification

Implemented verification includes:

- `npm run build:contracts`
- `npm run typecheck --workspace @cjl/api --workspace @cjl/admin-web`
- `npm run build:admin`
- `npm run test:backend`
- Playwright mobile checks at `390x844`:
  - daily view does not render the chart
  - weekly view renders chart and period KPI cards
  - items chart shows service picker
  - no horizontal overflow

## Related Decisions

- ADR 0001: Backend Owns Business Rules and Shared Contracts
- ADR 0015: Admin Operator UX and Notification Recovery Expansion
- ADR 0014: Laundry Activity Read Model and Regression Guardrails
