## ADR 0027: Admin WhatsApp ScrollArea Wrapper Width Contract

Status: Accepted  
Date: 2026-04-05  
Scope: admin web WhatsApp mobile timeline containment, Radix `ScrollArea` wrapper sizing, and bubble alignment contract

## Context

ADR 0026 hardened mobile WhatsApp detail containment for long previews, badges, metadata, and sticky chrome. Real-device verification still exposed one residual failure mode on the focused thread route:

1. some outbound bubbles could render partly past the right screen edge even when the bubble itself had a mobile max-width
2. the actual widening source was the timeline wrapper stack, especially the internal content wrapper inserted by Radix `ScrollArea`
3. once that wrapper widened to the longest message payload or metadata chip, right-aligned bubbles were positioned against the widened wrapper rather than the viewport-bounded thread column

This is a durable layout contract issue because the admin inbox depends on a shared `ScrollArea` primitive and the message timeline uses repeated left/right aligned bubble rows.

## Decision

The admin WhatsApp timeline now follows these rules:

1. The shared admin `ScrollArea` viewport must force its immediate internal content wrapper to:
   - `display: block`
   - `width: 100%`
   - `min-width: 0`
   - `min-height: 100%`
2. Focused WhatsApp timeline stacks must render as:
   - a full-width column container
   - one full-width row per message
   - row-level alignment (`justify-start` / `justify-end`) for inbound vs outbound placement
3. The bubble body itself may size to content (`w-fit`) but must remain constrained by explicit max-width caps and `min-w-0`.
4. The focused mobile thread route must preserve `min-w-0` along the fixed panel/container chain so the viewport remains the hard width boundary.
5. Automated verification must assert the wrapper-level invariant directly:
   - mobile timeline viewport `scrollWidth <= clientWidth`
   - mobile outbound bubble bounding boxes remain within the viewport after send

## Rationale

- Width bugs in message UIs can survive text wrapping if the real problem is the scroll-content wrapper sizing contract.
- Relying on bubble `max-width` alone is insufficient when right-aligned placement occurs inside a parent that has already widened beyond the viewport.
- Fixing the shared `ScrollArea` wrapper contract removes a whole class of latent overflow regressions across the WhatsApp surface.
- Row-based bubble alignment is simpler to reason about than margin-based right alignment when containment is critical on narrow mobile widths.

## Consequences

Positive:

- mobile WhatsApp detail is constrained by the actual viewport rather than by content-driven wrapper width
- outbound and inbound bubbles now share a clearer, more stable alignment model
- automated tests now guard the true overflow condition instead of only checking a single bubble case

Tradeoffs:

- the shared admin `ScrollArea` primitive now carries a stronger layout opinion about its immediate child wrapper
- future admin surfaces that rely on content-sized horizontal behavior should not reuse this primitive without deliberate review
- WhatsApp bubble markup is slightly more explicit because alignment moved from margin tricks to row ownership

## Follow-Up

- verify on staging with production-like long notification IDs, order codes, captions, and mixed inbound/outbound media threads
- if another admin surface requires horizontal scrolling, introduce a dedicated variant rather than weakening this containment contract
