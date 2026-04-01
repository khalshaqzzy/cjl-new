# ADR 0018: WhatsApp Cloud Phase 2-3 Runtime Activation and Template Registry Cutover

Status: Accepted  
Date: 2026-04-02  
Scope: active runtime behavior after implementing provider abstraction, Cloud API outbound delivery, and removal of admin-editable WhatsApp templates

## Context

After Phase 1, the repo had an approved WhatsApp template inventory, but the live runtime still behaved like the older gateway-first architecture:

- `settings.messageTemplates` was still the source of truth for prepared message content
- the admin settings page still exposed WhatsApp template editing
- automatic sends still depended on the legacy gateway runtime shape
- the admin WhatsApp page still exposed pairing/session control language

This left the repo in an inconsistent state where Meta-approved templates existed operationally, but the application still treated mutable admin settings and legacy gateway semantics as the primary runtime contract.

## Decision

The repo now standardizes on the following runtime decisions for Phase 2-3:

1. `settings.messageTemplates` is removed from the active product surface, API contract, and backend write path.
2. The approved template registry is split into two aligned sources:
   - `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` as the business/reference registry
   - `packages/api/src/lib/whatsapp-template-registry.ts` as the runtime registry
3. Automatic outbound WhatsApp notifications now use Cloud-era provider dispatch:
   - `cloud_api` for direct Graph API sends
   - `disabled` for simulated acceptance
4. Cloud-era provider fields become first-class runtime data on notifications, chats, and messages.
5. The admin WhatsApp page no longer acts as a linked-device/pairing control surface; it now shows provider health and hybrid thread/message visibility.
6. Legacy gateway compatibility remains bridge-only:
   - legacy package may remain in repo
   - `/v1/internal/whatsapp/events` may remain for mirrored data compatibility
   - no new runtime feature may add fresh coupling to pairing controls, `providerAck`, `providerChatId`, or `@c.us`

## Rationale

- Approved Meta templates are the operational boundary that should govern runtime sends, not mutable admin-edited copy.
- Removing template editing avoids divergence between business-approved templates and what the app thinks it is sending.
- Cloud-era contracts needed to land before webhook ingestion so notifications, chats, and messages could already represent provider truth correctly.
- Shifting the admin WhatsApp page away from pairing controls prevents the UI from reinforcing a runtime model the repo has already deprecated.

## Consequences

Positive:

- runtime outbound behavior now aligns with the approved template inventory
- settings are narrower and no longer mix business profile management with transport/template authoring
- contracts and persistence can already express Meta-style provider state before webhook ingestion lands
- local and hosted runtime topology no longer require `whatsapp-gateway`

Tradeoffs:

- thread/message visibility remains hybrid until webhook ingestion is implemented
- the repo now has some stale deployment/runbook documentation that still references gateway-era flows
- resend of older notifications requires server-side template rehydration because older records may predate `templateParams`

## Follow-Up

- implement webhook verification and ingestion so provider status transitions stop depending on the legacy bridge
- implement admin manual composer rules using CSW/FEP state
- clean up remaining internals and operational runbooks that still describe pairing or gateway-token parity as the active path
