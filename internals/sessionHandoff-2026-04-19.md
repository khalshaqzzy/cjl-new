# Session Handoff 2026-04-19

Document status: Active  
Purpose: repo snapshot after generic reward redemption and signed manual point adjustment

## What This Session Completed

- replaced Washer-only redemption semantics with generic reward redemption:
  - redeemable services are `washer`, `wash_dry_fold_package`, and `wash_dry_package`
  - each redeem uses 10 points
  - each redeem applies a fixed Rp 10.000 discount
  - each redeem removes 1 stamp opportunity from the order, with earned stamps clamped at 0
- removed the old Washer-specific admin preview capacity alias; admin preview now exposes only `maxRedeemableUnits`
- changed manual point adjustment validation so admin can submit positive or negative integers, but not `0`
- added backend guard so negative manual adjustment cannot make the customer point balance negative
- updated admin POS copy from Washer-specific wording to generic `Diskon reward`
- updated the customer detail manual point sheet:
  - signed integer input
  - minimal plus/minus sign buttons beside the input
  - decreasing-balance preview state
  - dynamic submit copy for add vs reduce
  - negative adjustment ledger display
- updated public/customer copy so redemption history and portal surfaces no longer present redeemed points as Washer-specific rewards
- cleaned up remaining Washer-specific public wire field names:
  - `eligibleFreeWashers` -> `eligibleRewardDiscounts`
  - `freeWasherUnitsUsed` -> `rewardDiscountsUsed`
  - `freeWasherUnits` -> `rewardDiscountUnits`
- updated `internals/PRD.md` to reflect generic reward units and signed manual point adjustment
- added ADR 0028 to freeze the generic reward discount wire contract

## Verification Run

- `npm run typecheck`
- `npm run test:backend`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts`
- `npm run build:admin`
- `npm run build:public`
- `npm run lint`

All succeeded at session end.

## Important Repo Facts

- order preview redemption capacity is exposed as `maxRedeemableUnits`.
- Existing order documents remain backward-compatible because they store aggregate `redeemedPoints`, `discount`, and `earnedStamps`.
- Public API fields now use generic reward discount names; old Washer-specific wire field names were removed in this session.
- `internals/phaseBacklog.md` had pre-existing user changes before this session and was intentionally left untouched.

## Recommended Next Start

1. During staging smoke, test:
   - package-only order with `Paket Cuci Kering Lipat` + 1 redeem
   - package-only order with `Paket Cuci Kering` + 1 redeem
   - mixed Washer/Dryer/package order with multiple redeem units
   - manual point adjustment `-5` on a customer with sufficient balance
   - manual point adjustment that would make balance negative
2. If any external client still expects the removed Washer-specific public wire names, update it to `eligibleRewardDiscounts`, `rewardDiscountsUsed`, and `rewardDiscountUnits`.
