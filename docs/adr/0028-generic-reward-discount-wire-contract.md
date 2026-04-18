## ADR 0028: Generic Reward Discount Wire Contract

Status: Accepted  
Date: 2026-04-19  
Scope: public reward redemption API field names, customer portal reward summaries, and package-capable redemption semantics

## Context

Reward redemption was originally represented as a Washer-specific benefit. The backend contract and public client exposed field names such as `eligibleFreeWashers`, `freeWasherUnitsUsed`, and `freeWasherUnits`.

The reward model has changed:

1. redeemable units now include `washer`, `wash_dry_fold_package`, and `wash_dry_package`
2. every redeem spends 10 points and applies a fixed Rp 10.000 discount
3. every redeem removes 1 stamp opportunity from the order

Keeping Washer-specific wire names after this change would make future clients and tests encode a false business rule.

## Decision

Use generic reward discount names on public-facing wire contracts:

1. Public dashboard `stampBalance.eligibleRewardDiscounts` replaces `eligibleFreeWashers`.
2. Monthly summary `rewardDiscountsUsed` replaces `freeWasherUnitsUsed`.
3. Redemption history `rewardDiscountUnits` replaces `freeWasherUnits`.
4. Customer-facing copy should describe the benefit as `Diskon reward`, not a free Washer.
5. Backend order preview exposes only `maxRedeemableUnits` for redemption capacity.

## Rationale

- The API contract should match the current domain language: reward discount, not Washer giveaway.
- Package redemption is now first-class, so Washer-specific field names create a misleading integration boundary.
- Removing the legacy public field names immediately is acceptable because the repo owns both the public API and current public clients.
- Keeping admin preview terminology generic avoids carrying a second, misleading compatibility field after all in-repo consumers have moved.

## Consequences

Positive:

- public clients consume field names that reflect package-capable redemption
- future tests can assert reward behavior without special casing Washer terminology
- customer-facing portal labels and API shape now share the same domain language

Tradeoffs:

- any external public API consumer that used the old Washer-specific fields must update
- public mock data and frontend local types must stay aligned with the new field names
- any consumer still expecting the old admin preview capacity field must migrate to `maxRedeemableUnits`

## Follow-Up

- keep future loyalty docs and tests using reward discount terminology
