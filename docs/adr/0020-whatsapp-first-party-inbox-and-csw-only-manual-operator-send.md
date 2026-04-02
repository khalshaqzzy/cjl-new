# ADR 0020: WhatsApp First-Party Inbox and CSW-Only Manual Operator Send

Status: Accepted  
Date: 2026-04-02  
Scope: active runtime and admin product behavior after implementing WhatsApp migration Phase 5-6

## Context

After Phase 4, the repo already had the Cloud-era transport boundary in place:

- automatic outbound notifications used Cloud API
- signed Meta webhooks were the source of truth for inbound messages and delivery status
- inbound media metadata and binaries were persisted through Mongo + GridFS
- `/admin/whatsapp` could show provider health plus basic thread and timeline visibility

What remained unresolved was the operator-facing product contract:

1. whether WhatsApp should remain a secondary admin surface or become a primary workflow tab
2. how manual operator replies should be constrained against Meta policy and current chat state
3. whether unread clearing should happen implicitly through polling reads or explicitly through operator action
4. how media access should work in the first inbox implementation pass

These choices affect API shape, frontend behavior, test coverage, and future staging validation, so they need to be frozen in repo memory.

## Decision

The repo now standardizes on the following Phase 5-6 decisions:

1. `/admin/whatsapp` is a first-party admin inbox surface and belongs in the primary navigation:
   - desktop primary nav includes `WhatsApp`
   - mobile bottom nav includes `WhatsApp`
   - `Notifikasi` remains a secondary surface and is not merged into the inbox
2. The first manual operator reply path is intentionally narrow:
   - same-thread only
   - text-only
   - no template composer in the inbox
   - no media composer in the inbox
   - no new-chat flow
3. Manual free-form operator send is allowed only when the customer service window is open.
4. Free-form send eligibility is enforced server-side, not only in UI state:
   - Cloud provider must be active and configured
   - target chat must resolve canonically
   - recipient identity must resolve from `waId` or normalized phone
   - CSW must be open even if FEP is still visible
5. Manual operator replies are persisted only after Meta accepts the outbound message and returns a provider message ID.
6. Manual operator replies are stored in the canonical WhatsApp message model as:
   - `source = manual_operator`
   - `messageType = text`
   - initial `providerStatus = accepted`
7. Unread clearing is explicit and mutation-based:
   - opening a thread intentionally triggers `POST /v1/admin/whatsapp/chats/:chatId/read`
   - polling and GET reads must not clear unread as a side effect
8. Media access in the first inbox pass uses the existing admin-only media retrieval endpoint opened from the inbox UI; no inline previewer is added in this phase.

## Rationale

- Promoting WhatsApp into primary navigation matches its operational role better than leaving it buried behind secondary navigation while operators are expected to work from it.
- Server-side CSW enforcement is mandatory because UI-only gating would allow incorrect sends from stale client state and would violate the intended Cloud-era policy boundary.
- Explicit unread clearing keeps polling reads safe and predictable while aligning unread semantics with deliberate operator action rather than incidental refresh traffic.
- Keeping v1 manual send scope to text-only same-thread replies minimizes policy risk and implementation surface while still covering the core operator recovery/useful conversation case.
- Reusing the existing media retrieval endpoint avoids building a second preview/storage path before staging has validated the current GridFS-backed behavior.

## Consequences

Positive:

- the admin WhatsApp page now behaves like a primary inbox rather than a diagnostics-only surface
- unread semantics are deterministic and compatible with frequent polling
- manual send policy is enforced centrally in the API
- future status webhooks can continue advancing the same operator-created message records without special-case data paths

Tradeoffs:

- operators cannot initiate template sends or media sends from the inbox yet
- opening media in a new tab is functional but intentionally less polished than a dedicated inline previewer
- the product still lacks higher-order inbox features such as assignment, filters, drafts, and conversation routing

## Follow-Up

- validate the inbox/manual-send flow on real staging infrastructure with Cloud API credentials and live webhook traffic
- decide after staging whether v1 inbox needs operator filters, draft persistence, or conversation assignment
- decide later whether template send and media send belong inside the inbox or should remain separate operator workflows
