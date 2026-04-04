## ADR 0025: Admin WhatsApp Full-Shell Thread Layout and Mobile Nav Persistence

Status: Accepted  
Date: 2026-04-05  
Scope: admin web WhatsApp thread layout, mobile detail chrome, and nav activation semantics

## Context

ADR 0024 established the dedicated mobile detail route and timeline scroll containment for the admin WhatsApp inbox. After implementation, a follow-up layout pass exposed several durable UI constraints that needed to be made explicit:

1. card-based framing around the desktop and mobile thread surfaces wasted shell space and made the thread feel boxed-in relative to the rest of the admin UI
2. removing those cards naively also removed effective panel-height constraints, which caused long conversations to push the whole page instead of keeping scroll ownership inside the timeline
3. the mobile detail route originally hid the bottom tab bar entirely, but operator feedback showed they still wanted the familiar bottom-nav context and direct return path while viewing a thread
4. bottom-nav active state only matched exact routes, so `/admin/whatsapp/[chatId]` left the `WhatsApp` tab visually inactive
5. the larger status/help note above the focused composer reduced visible message area on mobile detail

These are architecture-level admin-surface choices because they affect shared shell behavior, route semantics, scroll ownership, and future admin layout work beyond one local CSS tweak.

## Decision

The admin WhatsApp surfaces now follow these rules:

1. Desktop `/admin/whatsapp` keeps the split-pane model, but both the thread list and thread panel use flat shell-aligned surfaces instead of card chrome.
2. Thread panels must preserve explicit bounded heights so the message timeline remains the only intended scroll region.
3. Mobile `/admin/whatsapp/[chatId]` keeps the dedicated focused-detail route, but no longer hides the mobile bottom nav.
4. Mobile thread detail keeps the header at the top, the composer at the bottom of the thread column, and the timeline as the only scrolling region between them.
5. Shared admin navigation highlights parent sections for subroutes, so `/admin/whatsapp/[chatId]` still marks the `WhatsApp` nav item active.
6. Focused mobile thread detail omits the larger status/help note above the composer to maximize visible message space.

## Rationale

- Flat shell-aligned thread surfaces use the available admin layout more efficiently and match the intended WhatsApp workspace feel better than nested cards.
- Bounded thread-panel heights are still necessary even after card removal; otherwise scroll containment regresses.
- Keeping the bottom nav visible on mobile detail preserves orientation and makes the focused thread route feel like part of the same app rather than a detached modal surface.
- Subtree-aware nav highlighting is a shared shell rule, not a WhatsApp-only one-off, because section detail routes should still read as belonging to their parent area.
- Removing the larger composer status note on focused detail gives more room to the timeline without removing the smaller helper text near the send action.

## Consequences

Positive:

- desktop and mobile WhatsApp surfaces feel less boxed-in and better use the available shell
- timeline-only scroll remains preserved after the full-shell layout change
- mobile operators retain app navigation context while viewing a thread
- `/admin/whatsapp/[chatId]` now reads as a first-class child of the WhatsApp section

Tradeoffs:

- mobile detail now shares vertical space with the bottom nav again, so the thread column must continue respecting shell height constraints
- future shell changes must preserve subtree-aware nav activation and timeline-only scroll containment
- focused-detail layout now depends on the composer/header remaining outside the timeline scroll region

## Follow-Up

- validate the full-shell thread layout and mobile nav persistence on staging devices with longer real conversations
- keep future admin-shell refactors compatible with parent-route activation for child detail routes
- if the smaller helper text beside the send button becomes unnecessary, remove it in a later focused composer cleanup pass
