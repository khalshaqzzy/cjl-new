# ADR 0010: WhatsApp Pairing Controls and Canonical Business Contact Normalization

Status: Accepted  
Date: 2026-03-25  
Scope: operator-visible WhatsApp pairing semantics, session recovery, and canonical business-contact storage

## Context

After the real WhatsApp gateway sidecar and customer-facing admin-contact model were in place, two operational gaps became clear:

- the admin WhatsApp page could show stale QR material while the operator was actually using phone-number pairing code flow
- the API collapsed most gateway control failures into one generic dependency message, which hid the real difference between gateway-unreachable, token mismatch, and pairing-state errors
- settings accepted mixed phone-number formats and stored business-contact fields independently, which made landing, portal, and settings UI appear inconsistent when operators entered `08...`, `62...`, or `+62...` across different fields

These problems were not just UI bugs. They affected:

- real-device pairing success and supportability
- the repeatability of staging and production runbooks
- whether customer-facing contact surfaces resolved from one canonical source of truth

## Decision

The repo now standardizes on the following model:

1. WhatsApp connection status explicitly distinguishes pairing material with `pairingMethod` set to `qr` or `code`
2. QR pairing material and phone-number pairing code are mutually exclusive in runtime state; when code mode is active, stale QR values are cleared
3. the gateway exposes a reset-session control that destroys the current client, removes persisted LocalAuth session state, and reboots from a clean initialization state
4. the API propagates gateway `4xx` control failures with their original message and code, while keeping network and unreachable failures mapped as dependency-unavailable behavior
5. business phone fields are normalized to a canonical local display format `08...`
6. customer-facing public contact now resolves canonically from the primary admin WhatsApp contact instead of drifting independently from the contact list
7. `publicWhatsapp` remains the gateway-paired WhatsApp number concept, but is normalized into the same human-entered `08...` storage style as other business phone fields

## Rationale

- Pairing-code flow and QR flow are operationally different enough that one ambiguous "pairing" state was not safe for real-device use.
- Session reset must be an explicit first-class control because persistent auth volumes are intentionally retained across deploys and container restarts.
- Gateway control failures need to preserve their original semantics so operators can tell configuration problems from recoverable device-state problems.
- Canonical `08...` storage matches operator behavior in Indonesia better than mixing raw `62`, `+62`, and local formats across business fields.
- Resolving landing and portal contact information from the primary admin contact prevents a split-brain configuration where settings appear saved but customer surfaces keep showing an older number.

## Consequences

Positive:

- operators can now tell whether the page expects a QR scan or a pairing code entry
- stuck or corrupted WhatsApp auth state has a documented recovery action without manual filesystem intervention
- landing, portal, and settings now converge on one canonical customer-facing contact source
- Indonesian phone-number input is more forgiving while still producing stable stored output

Tradeoffs:

- the API/gateway control surface is broader and now includes an explicit destructive recovery action
- settings write logic is stricter and performs normalization and canonicalization rather than blindly storing raw UI input
- public contact fields are less independent than before because customer-facing output intentionally follows the primary admin-contact rule

## Follow-Up

- validate the full reset-session and re-pair flow on staging with the real CJ Laundry device
- verify that production operators understand the distinction between gateway bot number and customer-facing admin contact
- revisit whether future versions should expose a separate read-only "gateway number" label in settings to reduce operator confusion further
