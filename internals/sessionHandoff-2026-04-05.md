# Session Handoff 2026-04-05

Document status: Active  
Purpose: repo snapshot after admin-only service catalog expansion and redemption-aware stamp fix

## What This Session Completed

- added 3 new admin-only services to the canonical catalog, settings flow, and seed backfill:
  - `wash_dry_package` / Paket Cuci Kering / Rp 25.000 / +1 stamp
  - `laundry_plastic_large` / Plastik Laundry Besar / Rp 4.000
  - `laundry_hanger` / Gantungan Laundry / Rp 2.000
- preserved catalog ordering so admin POS and settings render the new items in related positions without extra UI sorting:
  - `wash_dry_package` after `wash_dry_fold_package`
  - `laundry_plastic_large` and `laundry_hanger` after `laundry_plastic`
- updated the backend order calculator so redeemed free Washer units no longer count toward earned stamps
- kept the redemption cap logic unchanged: `maxRedeemableWashers = min(floor(points / 10), washerQty)`
- updated public landing filtering so all 5 admin-only services stay hidden from the marketing service list
- updated admin POS/settings copy to explain that redeemed free Washer units do not add stamps
- expanded backend integration coverage for:
  - additive seed backfill of the 3 new services
  - hidden landing-service filtering for all admin-only services
  - `wash_dry_package` stamp earning
  - `laundry_plastic_large` and `laundry_hanger` totals without stamp earning
  - redemption-aware earned-stamp scenarios
- expanded E2E coverage for:
  - selecting the new admin-only services in POS
  - verifying they appear in order detail surfaces
  - redeeming 10 points for 1 free Washer while earned stamps stay based on residual Washer units only

## Verification Run

- `npm run typecheck`
- `npm run test:backend`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts`

All succeeded at session end.

## Important Repo Facts

- the canonical service code enum now includes:
  - `wash_dry_package`
  - `laundry_plastic_large`
  - `laundry_hanger`
- existing environments receive the new catalog entries through startup seed merge; no destructive settings migration is required
- order history remains backward-compatible because `earnedStamps` is stored per confirmed order; only new orders use the updated Washer redemption rule
- public landing still intentionally hides admin-only services, but authenticated/public order detail continues to show those items when present on a real order

## Recommended Next Start

1. if product docs need to be fully synchronized, mirror the new catalog and redemption wording into any future dedicated design/ops docs that restate loyalty rules
2. if staging validation is already planned, include one manual smoke case for:
   - `wash_dry_package`
   - `laundry_plastic_large`
   - `laundry_hanger`
   - `2 washer + 2 dryer + redeem 1` earning exactly 1 stamp
