## ADR 0026: Admin WhatsApp Mobile Width Containment and Frozen Detail Chrome

Status: Accepted  
Date: 2026-04-06  
Scope: admin web WhatsApp mobile width containment, frozen detail chrome, and timeline-only scroll behavior

## Context

ADR 0025 established full-shell thread surfaces and kept the mobile bottom nav visible on `/admin/whatsapp/[chatId]`. Real-device verification then showed two classes of regressions still remained on narrow mobile widths:

1. thread list cards could overflow horizontally when long previews, names, phone numbers, or status badges shared the same row
2. detail threads could still feel page-scrolling rather than timeline-scrolling, and long message payloads, notification IDs, order codes, and media labels could push bubbles past the right edge

These are durable UI architecture constraints because they affect shared WhatsApp components and the route-level shell contract for the focused mobile thread view.

## Decision

The admin WhatsApp mobile surfaces now follow these rules:

1. Thread list items must be width-contained by default:
   - inner wrappers use `min-w-0`
   - long previews and labels must wrap or truncate safely
   - badges and metadata chips must not widen the card beyond the viewport
2. Message bubbles and related metadata in the focused detail route must also be width-contained:
   - long text uses safe wrapping
   - metadata badges and media/file labels wrap instead of extending the bubble width
   - mobile bubble width is capped more conservatively than desktop
3. The focused mobile detail route uses an explicit viewport-bounded thread column between the admin top bar and the persistent mobile bottom nav.
4. Within that bounded thread column:
   - header stays sticky at the top
   - composer stays pinned at the bottom
   - the timeline remains the only scroll container
   - page-level `window` scrolling must not be the operator’s message navigation path

## Rationale

- Width containment failures on mobile are not harmless cosmetic issues; they hide controls and content and break the operator workflow.
- Relying on generic flex behavior without `min-w-0` and explicit wrapping is insufficient for message UIs that frequently contain long machine-generated identifiers and receipt metadata.
- A viewport-bounded detail column is the clearest way to preserve frozen header/composer behavior while keeping the bottom nav visible.
- The same invariant should hold both in visual verification and automated tests: only the message viewport scrolls during thread review.

## Consequences

Positive:

- thread list and detail surfaces are usable on narrow real-device widths
- timeline-only scroll is reinforced by both route structure and test coverage
- long WhatsApp notification metadata no longer causes right-edge clipping

Tradeoffs:

- the focused mobile detail route now depends more explicitly on shell top/bottom chrome dimensions
- future mobile shell changes must preserve the bounded-thread-column contract
- WhatsApp message components carry more defensive wrapping rules than generic admin list/detail components

## Follow-Up

- validate on staging with real production-like notification text and media names
- if other admin detail routes adopt persistent bottom-nav + frozen-composer patterns, reuse the same bounded-column approach instead of re-inventing layout rules
