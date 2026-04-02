# ADR 0021: Notification Recovery Prefers API Resend Over `wa.me` Fallback

Status: Accepted  
Date: 2026-04-02  
Scope: failed-notification operator recovery behavior in admin outbox after Cloud-era WhatsApp runtime activation

## Context

Earlier admin notification recovery allowed operators to open a backend-generated `wa.me` deep link populated with the prepared message text. That behavior made sense while WhatsApp recovery remained partly outside the application runtime.

After the Cloud-era migration work now in repo:

- automatic sends already go through the API-owned Cloud transport
- admin has a first-party WhatsApp surface
- resend of a failed notification can be processed by the backend immediately

Keeping `wa.me` as the primary fallback would leave notification recovery outside the same audited, testable, API-owned path that now drives the rest of the WhatsApp product.

## Decision

Failed-notification recovery now standardizes on these rules:

1. The primary operator recovery action is direct resend through the backend-owned WhatsApp API path.
2. Admin outbox `Resend Message` / `Kirim Ulang` must trigger immediate resend processing in the request path instead of only queueing work for later observation.
3. The admin notification UI no longer opens a `wa.me` deep link as the primary recovery action.
4. The legacy `POST /v1/admin/notifications/:id/manual-whatsapp` endpoint remains only as a compatibility alias and redirects to the same API resend behavior rather than returning a deep link.
5. Operator classification actions remain separate:
   - `Mark as Done` means manual handling happened outside the bot path
   - `Ignore` means the failure is intentionally removed from active operational follow-up

## Rationale

- API resend is observable, auditable, and testable in a way browser-owned deep links are not.
- Keeping resend inside the backend preserves one transport boundary for notifications instead of mixing Cloud API delivery with manual app-switching.
- Immediate resend produces a clearer admin experience because the returned notification state reflects whether the retry actually succeeded or failed.
- Compatibility aliasing avoids hard API breakage while removing `wa.me` as the product default.

## Consequences

Positive:

- failed-notification recovery now follows the same backend-owned delivery path as normal sends
- integration and E2E tests can validate recovery without popup/browser-deep-link assumptions
- operators get updated notification status immediately after retry

Tradeoffs:

- failures caused by receipt rendering or policy constraints still fail inside the app rather than falling back automatically to an external WhatsApp client
- if a future product direction still wants a human handoff to the WhatsApp client, that should be added back intentionally as a secondary action, not as the primary resend path

## Follow-Up

- validate real staging behavior for failed resend scenarios, especially `order_confirmed` cases where receipt rendering or attachment preparation can fail before transport
- decide later whether a secondary human-handoff action is still needed after observing real operator usage
