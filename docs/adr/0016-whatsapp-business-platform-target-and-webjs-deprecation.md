# ADR 0016: WhatsApp Business Platform Target and WebJS Deprecation Path

Status: Accepted  
Date: 2026-04-02  
Scope: provider target state for WhatsApp delivery, admin messaging interface direction, and legacy `whatsapp-web.js` runtime policy

## Context

The repo currently has a working WhatsApp runtime based on:

- `@cjl/whatsapp-gateway`
- `whatsapp-web.js`
- linked-device pairing
- API-owned mirrored chats/messages
- read-only admin WhatsApp visibility

This solved the original v1 requirement of real WhatsApp delivery and operator visibility, but it is no longer the desired long-term platform boundary. CJ Laundry now has access to the official WhatsApp Business Platform and wants to migrate all WhatsApp messaging to the official API before treating the WhatsApp integration as final.

The migration has several constraints:

- the repo should not lose existing notification/outbox semantics
- the API must remain the data owner for notification state and operator-facing visibility
- `whatsapp-web.js` should not be deleted immediately
- the legacy runtime should stop being treated as the target architecture
- the future admin WhatsApp surface must support first-party operator messaging instead of only read-only mirroring

## Decision

The repo now standardizes on the following architectural direction:

1. the official target provider is Meta WhatsApp Business Platform / Cloud API
2. the API remains the system of record for:
   - notification state
   - WhatsApp thread/message read models
   - customer linkage
   - operator-visible message status
3. the admin WhatsApp surface evolves into a first-party inbox interface that can:
   - show inbound and outbound messages
   - show linked customer identity
   - show delivery visibility
   - send manual non-template text messages only when allowed by customer-service-window rules
4. `@cjl/whatsapp-gateway` remains in the repo, but becomes deprecated code only:
   - not part of any local runtime
   - not part of any hosted runtime
   - not part of deploy topology
   - not part of the primary admin WhatsApp experience
5. legacy provider semantics such as `providerAck` and `@c.us` chat identity are deprecated and will be replaced by Cloud API webhook status strings and `wa_id` / canonical phone identity

## Rationale

- Official Cloud API is the correct provider boundary for long-term maintainability, compliance, and operational stability.
- Keeping the API as the system of record preserves the core design from ADR 0004 and avoids splitting ownership between multiple runtimes.
- Retaining the legacy package as code-only history reduces migration risk and preserves fallback knowledge without forcing any runtime to keep depending on it.
- Moving the admin WhatsApp experience into the app aligns with the newer product need for operator visibility plus in-app manual messaging.

## Consequences

Positive:

- the WhatsApp integration target is now aligned with the official provider
- future work can stop optimizing linked-device runtime behavior entirely, because it is no longer part of the target runtime
- operator messaging and message-status visibility can be designed around official webhook semantics

Tradeoffs:

- migration scope is broader than a transport-only swap
- admin UI, contracts, tests, envs, and deploy topology all need coordinated changes
- legacy and Cloud-era fields will coexist temporarily during transition

## Follow-Up

- implement the detailed sequence in `internals/whatsappBusinessApiMigrationPhases.md`
- add a template registry once the first approved templates exist
- move all active deploy/runtime paths to Cloud API while retaining the legacy gateway package in the repo under deprecated handling only
