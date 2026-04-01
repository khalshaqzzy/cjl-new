# ADR 0019: WhatsApp Cloud Webhook Truth and GridFS Inbound Media Storage

Status: Accepted  
Date: 2026-04-02  
Scope: active runtime behavior after implementing Meta webhook verification, webhook-driven delivery/inbox truth, and persistent inbound media storage

## Context

After Phase 2-3, the repo could send automatic WhatsApp notifications through Cloud API, but the runtime still lacked the official inbound and delivery-truth path:

- outbound notifications only had the initial send response state
- inbox visibility still depended partly on the legacy internal bridge
- there was no signed Meta webhook endpoint in the active API
- inbound media had no canonical persistence strategy

Phase 4 required a decision on both source-of-truth and storage boundary:

1. whether Meta webhooks would become the canonical truth for delivery and inbox state
2. where inbound media binaries would live in the current monolith + Mongo topology

## Decision

The repo now standardizes on the following Phase 4 decisions:

1. Signed Meta webhooks are the canonical runtime truth for:
   - inbound WhatsApp messages
   - outbound delivery status progression
   - pricing/FEP visibility
   - template lifecycle audit events
2. Webhook ingestion is idempotent through a dedicated `whatsapp_webhook_receipts` collection.
3. The API-owned `whatsapp_chats` and `whatsapp_messages` collections remain the canonical admin read model; webhook events update those collections directly instead of creating a parallel store.
4. Inbound media binaries are stored in Mongo GridFS under the `whatsapp_media` bucket.
5. `whatsapp_messages` stores media metadata and GridFS references, while actual binaries stay out of the main document body.
6. Media download is asynchronous:
   - webhook metadata is persisted first
   - the API acknowledges Meta immediately after safe metadata persistence
   - a small in-process worker downloads and stores the binary afterward
7. Template lifecycle webhook events are persisted as backend audit logs only in this phase; no admin UI is added for them yet.

## Rationale

- Meta webhook retries make idempotent ingestion mandatory; a receipt ledger is cleaner than relying on message-upsert side effects for duplicate protection.
- Delivery truth belongs to webhook statuses, not to the initial `POST /messages` acceptance response and not to legacy numeric ack semantics.
- Keeping chats/messages as the single read model avoids a second inbox data path and preserves the current admin WhatsApp page contract.
- GridFS fits the current single-datastore architecture better than VM-local files because it keeps persistence, backup, and retrieval inside the existing Mongo operational boundary.
- Asynchronous binary download prevents webhook acknowledgement latency from being coupled to media transfer time or temporary Graph/media fetch failures.

## Consequences

Positive:

- admin WhatsApp data can now converge on official Meta delivery and inbound truth
- inbound media survives process restarts and is retrievable through the API
- webhook duplicate retries do not inflate unread counts or create duplicate timeline entries
- future Phase 5-6 UI work can build on a stable read model and media-reference contract

Tradeoffs:

- the monolith now owns an additional background worker loop for media download
- Mongo storage growth will include WhatsApp media binaries, so staging/production validation must include realistic backup and size observations
- template lifecycle data exists only in audit logs for now, so operators do not yet get a dedicated template-health UI

## Follow-Up

- validate webhook + GridFS behavior on staging with real Meta traffic
- implement Phase 5-6 manual operator send and inbox completion on top of the new webhook-backed truth
- clean up remaining gateway-era operational docs and environment references
