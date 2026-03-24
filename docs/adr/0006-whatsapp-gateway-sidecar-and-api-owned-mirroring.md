# ADR 0006: WhatsApp Gateway Sidecar and API-Owned Mirroring

Status: Accepted  
Date: 2026-03-25  
Scope: real WhatsApp delivery runtime, pairing operations, and mirrored inbox/session data

## Context

The repo already had:

- transaction-backed notification records
- an in-process outbox worker in the API
- separate render vs delivery state for confirmation notifications
- admin manual WhatsApp fallback semantics

What it did not have was a real delivery adapter. Notification processing still simulated success by marking queued notifications as sent, and the deployment/runtime docs explicitly treated WhatsApp persistence as deferred.

The new implementation needed to satisfy several product and operational constraints at the same time:

- keep business state and outbox state owned by the API
- preserve existing notification retry and manual fallback semantics
- support persistent linked-device auth across container restarts
- expose operator-visible pairing and connection state
- mirror inbound and outbound WhatsApp messages for admin visibility without turning v1 into a full operator inbox

## Decision

The repo now standardizes on the following runtime model:

1. a dedicated `@cjl/whatsapp-gateway` sidecar service uses `whatsapp-web.js` with `LocalAuth`
2. WhatsApp auth state is persisted on a dedicated mounted volume and survives container restarts
3. the API remains the system of record for:
   - notification state
   - mirrored chats
   - mirrored messages
   - persisted session metadata
4. the gateway never writes to Mongo directly; it communicates with the API through authenticated internal HTTP calls
5. the API outbox worker performs real delivery by calling the gateway instead of simulating `sent`
6. the admin WhatsApp surface is read-only in v1:
   - status and pairing controls
   - mirrored inbox/thread visibility
   - open-in-WhatsApp handoff
   - no in-app reply composer

## Rationale

- A sidecar isolates browser/session concerns from the main API process without abandoning the single-VM monolith deployment model.
- Keeping notification, chat, and message persistence in the API avoids introducing a second data owner and preserves the existing outbox architecture from ADR 0004.
- `LocalAuth` on a mounted persistent directory is the smallest practical way to keep a linked-device session alive across restarts in the current deployment topology.
- Internal event ingestion lets the API enrich mirrored WhatsApp data with customer and notification links without giving the gateway direct database privileges.
- A read-only mirrored inbox satisfies the operational need for visibility while avoiding the larger product and audit scope of in-app operator messaging.

## Consequences

Positive:

- notification delivery is now real, not simulated
- confirmation notifications preserve separate receipt-render and transport-delivery states
- operators can inspect connection health, pairing state, inbound customer replies, and outbound system messages from admin
- WhatsApp auth persistence is now explicit in local and hosted runtime topology

Tradeoffs:

- hosted runtime now has one more long-lived container and one more persistent volume
- the gateway introduces Chromium/browser runtime dependencies into deployment
- the API now depends on internal gateway availability for automatic sends when WhatsApp is enabled
- mirrored inbox visibility is read-only, so operators still need the real WhatsApp client for replies

## Follow-Up

- validate real-device pairing, reconnect behavior, and session survival on staging
- verify receipt-image quality and media delivery on target phones
- if operator messaging later moves into the admin app, add a separate ADR for two-way inbox behavior instead of silently extending this read-only model
