# ADR 0012: Live-Settings Receipt Rendering and Focused Notification Recovery

Status: Accepted  
Date: 2026-03-26  
Scope: operator recovery UX for failed WhatsApp sends plus receipt rendering policy across admin fallback, WhatsApp media, and portal PDF output

## Context

The repo already supported:

- one-time customer QR/login-link flows in POS and customer management
- outbox-backed WhatsApp delivery with separate render vs delivery state for `order_confirmed`
- backend-rendered PDF receipts for authenticated portal download
- PNG receipt media for WhatsApp order-confirmed sends

Two operator-facing problems remained:

- POS registration could show the QR sheet but still interrupt the cashier because there was no explicit continue path back into service selection
- failed notification recovery exposed too many actions in admin outbox, including preview/copy/manual-resolve controls that slowed the common fallback path

There was also one unresolved rendering policy question:

- whether receipt business identity should stay frozen from the order-time snapshot or be re-read from live admin settings when generating final PNG/PDF output

## Decision

The repo now standardizes on the following:

1. POS QR sheets shown immediately after registration may expose a POS-only continue CTA that advances straight into service selection while preserving the selected customer
2. failed notification recovery uses a focused action set instead of a kitchen-sink outbox card
3. failed `order_confirmed` cards prioritize only `Download Receipt` and `Send Message`
4. failed non-receipt cards prioritize only `Send Message` and `Kirim Ulang`
5. admin fallback receipt download for failed `order_confirmed` is PNG, not PDF
6. authenticated portal receipt download remains PDF
7. PNG and PDF receipts are generated from one shared backend receipt view model
8. final receipt rendering uses live admin settings for laundry name, laundry phone/admin contact, and address, while transactional order data still comes from the order record

## Rationale

- The cashier’s main job after registration is to continue order entry, so the QR sheet must not become a dead-end.
- Operators handling failed sends usually need one of two actions: open a prefilled WhatsApp deep link or download the receipt artifact. Extra controls create noise in the urgent path.
- PNG is the more practical operator artifact for manual WhatsApp fallback because it can be forwarded or attached more easily than PDF from common mobile/desktop WhatsApp workflows.
- Keeping portal PDF download preserves the more formal customer document path without forcing the fallback artifact to match it.
- A shared receipt view model prevents PNG WhatsApp media, admin fallback download, and portal PDF from drifting in content or hierarchy.
- Using live settings for business identity avoids stale contact/address output after operators update settings, which matches how the receipt is treated operationally in v1.

## Consequences

Positive:

- POS registration no longer blocks cashier momentum after showing QR
- failed notification handling is faster and more legible for operators
- receipt formatting is now consistent across PNG and PDF outputs
- current contact/address changes in admin settings are reflected in newly rendered receipts without data migration

Tradeoffs:

- business identity on historical receipts is no longer fully frozen to order-time values
- admin fallback PNG and customer portal PDF intentionally diverge by format
- opening a `wa.me` fallback still marks manual handling at open time, not at proof-of-delivery time

## Follow-Up

- validate staging behavior for real-device WhatsApp fallback, especially attach-after-download flow with PNG receipts
- if operators later need audit-proof confirmation of manual delivery, add a separate explicit “confirmed sent manually” action rather than reintroducing UI clutter by default
- if historical legal/financial needs later require fully frozen business identity on receipts, introduce a versioned snapshot policy instead of silently changing the current live-settings rule
