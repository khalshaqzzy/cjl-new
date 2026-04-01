# ADR 0017: WhatsApp Template Phase 1 Approval and Welcome Marketing Exception

Status: Accepted  
Date: 2026-04-02  
Scope: approved WhatsApp template registry state after Phase 1 and the category exception for `cjl_welcome_v1`

## Context

The migration plan for the WhatsApp Business Platform introduced a Phase 1 template-authoring step intended to approve five templates before provider cutover work:

- `cjl_welcome_v1`
- `cjl_order_confirmed_v1`
- `cjl_order_done_v1`
- `cjl_order_void_notice_v1`
- `cjl_account_info_v1`

The initial repo plan assumed all five would be approved under `UTILITY`. During actual template creation in WhatsApp Manager, the team had to iterate on `welcome`, `order_void_notice`, and `account_info` copy to satisfy Meta validators. The final operational outcome is:

- all five templates are active in WhatsApp Manager
- `cjl_welcome_v1` is active as `MARKETING`
- the other four templates are active as `UTILITY`

This is materially different from the earlier repo assumption that all approved templates would be `UTILITY`.

## Decision

The repo now standardizes on the following Phase 1 template facts:

1. `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md` is the source of truth for approved template status, category, and component shape.
2. The repo must preserve the actual approved category of `cjl_welcome_v1` as `MARKETING`.
3. Future sessions must not silently rewrite `cjl_welcome_v1` back to `UTILITY` just because the original design intent preferred utility-safe copy.
4. Provider implementation in later migration phases must read approved category/name/language from the registry rather than inferring category from event semantics alone.
5. The current app runtime remains unchanged:
   - `settings.messageTemplates` still drive `preparedMessage`
   - the `whatsapp-web.js` gateway remains the active transport
   - no Cloud API send path is enabled yet

## Rationale

- The approved category in WhatsApp Manager is an operational fact and is more important than prior planning assumptions.
- Capturing the exception in an ADR prevents future sessions from planning against stale assumptions.
- Keeping runtime behavior unchanged avoids conflating Phase 1 template approval with later provider migration phases.

## Consequences

Positive:

- future Cloud API work can use the approved template inventory as it actually exists
- repo memory now matches the operator-visible state in WhatsApp Manager
- the welcome-template exception is explicit instead of hidden in chat history

Tradeoffs:

- the approved template set is not perfectly category-uniform
- later implementation may need category-aware handling or at least documentation-aware handling when sending `welcome`
- template IDs still need to be backfilled into the registry if not yet recorded

## Follow-Up

- backfill template IDs into `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md`
- start migration Phase 2 from the actual approved registry state, not the earlier all-utility assumption
- keep `cjl_welcome_v1` marketing classification visible in future migration docs unless and until it is replaced by a new approved template version
