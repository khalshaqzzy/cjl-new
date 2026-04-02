# ADR 0024: Admin WhatsApp Mobile Detail Route and Scroll Containment

Status: Accepted  
Date: 2026-04-02  
Scope: admin web WhatsApp inbox interaction model and layout containment

## Context

The Cloud WhatsApp migration delivered a working first-party inbox, but the original admin web layout still had usability problems on mobile and long conversations:

1. mobile thread opening used a bottom sheet with fixed-height content, which made the composer and message area unreliable when the on-screen keyboard opened
2. provider health consumed too much vertical space relative to the thread list, especially on mobile
3. long message histories could bleed scroll ownership into the whole page instead of staying inside the timeline
4. header actions such as back, refresh, and status badges were easy to lose during long mobile scroll sessions

These are durable UI architecture choices because they affect:

- route structure inside the admin app
- how mobile and desktop inbox navigation intentionally differ
- how shell chrome interacts with focused thread work
- how overflow boundaries are enforced in the shared admin UI layer 

## Decision

The admin web now standardizes on the following rules for the WhatsApp inbox:

1. Desktop keeps the split-pane inbox at `/admin/whatsapp`.
2. Mobile thread selection opens a dedicated full-detail route at `/admin/whatsapp/[chatId]`.
3. The dedicated thread route is keyed by `chatId`, not `customerId`, so unlinked threads remain first-class and replyable.
4. Mobile thread detail hides the admin bottom tab bar while the focused conversation view is open.
5. Provider health is compact and default-collapsed; detailed Cloud fields are shown only when explicitly expanded.
6. Thread headers in focused conversation views are sticky so status and controls remain visible during long scroll sessions.
7. Message timelines must own their own scroll region; inbox scrolling must not bleed into the entire admin page.
8. Thread timelines auto-scroll to the newest message when opened and continue to stick to the bottom while the operator remains near the bottom of the conversation.

## Rationale

- A dedicated mobile detail route is more reliable than a bottom sheet for keyboard-heavy reply work and deep message histories.
- Keeping desktop split-pane avoids throwing away the faster scan-and-switch workflow operators already have on larger screens.
- Collapsing provider health by default preserves visibility for operational work while keeping diagnostic detail one tap away.
- Sticky headers reduce repeated scroll-to-top actions during active conversation handling.
- Explicit scroll containment is necessary to avoid regressions where long timelines push the whole page instead of the timeline viewport.

## Consequences

Positive:

- mobile operators get a stable full-height conversation surface with visible controls
- long threads are safer to use on both desktop and mobile
- desktop keeps the existing high-throughput scanning model
- unlinked WhatsApp threads still have a complete interaction flow

Tradeoffs:

- the admin inbox now has two intentional interaction models to maintain:
  - desktop split-pane
  - mobile detail route
- shell layout and shared scroll-area behavior now carry inbox-specific constraints that future admin UI work should preserve
- tests must cover both desktop and mobile inbox flows to prevent route/overflow regressions

## Follow-Up

- validate the new mobile inbox UX on real staging devices after the first Cloud rollout
- keep future admin shell changes compatible with hidden-mobile-nav detail surfaces
- if inbox complexity grows further, consider moving WhatsApp polling/state into a dedicated shared hook or data layer
