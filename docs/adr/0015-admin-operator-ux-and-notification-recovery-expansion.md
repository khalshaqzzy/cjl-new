# ADR-2026-03-28 Admin Operator UX and Notification Recovery Expansion

Status: Accepted  
Date: 2026-03-28  
Owners: Codex implementation session  

Note: the `Send Message` / manual deep-link recovery part of this ADR is superseded by ADR 0021. The rest of the operator UX decisions remain accepted.

## Context

Several operator-facing requirements were approved together for the admin surface:

1. add POS-only catalog items:
   - `Setrika Saja` at Rp 5.000/kg
   - `Plastik Laundry` at Rp 2.000/unit
2. keep the selected customer visible during POS order creation after the customer-selection step
3. expand Laundry from a single default active view into:
   - `Aktif`
   - `Hari Ini`
   - `History`
4. move dashboard `Perlu Perhatian` above KPI cards
5. expand failed-notification recovery actions by event type
6. show a short popup/toast when a new WhatsApp failure is detected during an active admin session

The product direction explicitly required these changes without redesigning the visual language of the app.

## Decision

We kept the existing visual system and expanded operator behavior in place.

The accepted UX decisions are:

- `Setrika Saja` and `Plastik Laundry` are available in admin POS only and remain hidden from the public landing page
- after customer selection, POS keeps a visible customer summary at the top of the next operational steps
- Laundry keeps the existing active view as default, then adds `Hari Ini` and `History`
- dashboard `Perlu Perhatian` moves above KPI cards for operational prioritization
- failed notifications expose recovery actions according to event type:
  - `welcome`, `account_info`, `order_done`: `Send Message`, `Kirim Ulang`, `Mark as Done`, `Ignore`
  - `order_confirmed`: `Send Message`, `Download Receipt`, `Resend Message`, `Mark as Done`, `Ignore`
- `Send Message` opens a backend-generated `wa.me` deep link and classifies the item as manual handling
- `Mark as Done` classifies the item as manual handling without retrying delivery
- `Ignore` classifies the item as ignored and removes it from failed operational state
- a short admin toast is shown for newly detected failed WhatsApp notifications during an active session

## Consequences

### Positive

- front-desk context loss is reduced because customer identity remains visible during POS flow
- the new POS-only items are available for operations without changing the public marketing surface
- operators can separate immediate queue work, same-day work, and historical work more cleanly
- failed-notification handling is more explicit and better matched to real operational choices
- unresolved operational issues are surfaced earlier on the dashboard

### Negative

- admin notification state handling becomes more complex because `manual_resolved` and `ignored` now need to remain distinct
- the admin app performs periodic polling for failed-notification popups
- the notification surface now has more operator actions that need regression coverage and staging validation

## Verification Added

Implemented verification now covers:

- POS service additions and order flow
- selected customer summary visibility in POS
- Laundry tabs and main navigation behavior
- failed-notification actions and state transitions
- failed-WA popup behavior at implementation level

Current verification commands:

- `npm run test:backend`
- `npm run typecheck`
- `npm run test:e2e -- tests/e2e/full-stack.spec.ts --reporter=line`

## Recommendations

1. Keep future operator-facing additions aligned to the existing design system unless there is a deliberate redesign decision.
2. If failed-notification polling becomes noisy or expensive, move to a smaller delta/summary endpoint before considering larger UI changes.
3. Preserve explicit state distinctions among `failed`, `manual_resolved`, `ignored`, and `sent`; do not collapse them for convenience in future refactors.
