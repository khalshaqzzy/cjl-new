# ADR 0005: Public Receipt PDFs, Manual WhatsApp Fallback, and Live Leaderboard Name Visibility

Status: Accepted  
Date: 2026-03-25  
Scope: customer-facing receipt delivery, failed-notification recovery, and public leaderboard name display

## Context

The CJ Laundry product behavior evolved in three related areas:

- authenticated customers now need a receipt-style order detail view with downloadable PDF receipts
- admins need a manual WhatsApp recovery path when bot delivery has already failed
- leaderboard names must stay masked by default but become publicly visible when a customer opts in

The repo already had:

- order snapshots with item pricing and totals
- an outbox worker with notification delivery state
- archived leaderboard snapshots that persist rank and earned-stamp values

The main architectural decisions left open were:

- whether receipt downloads should remain plain text or become a richer format
- whether manual WhatsApp fallback should mutate order business state or only resolve notification handling
- whether leaderboard display names should be frozen inside snapshots or resolved from live customer preference at read time

## Decision

The repo now standardizes on the following:

1. receipt downloads are rendered as PDF on the backend from stored order snapshots
2. authenticated portal order detail may expose itemized monetary receipt data and PDF download
3. direct status token pages remain non-monetary summary views
4. manual WhatsApp recovery is an admin-only fallback for failed notifications and resolves notification handling, not order business state
5. leaderboard rank and earned-stamp data stay snapshot-backed, but the displayed customer name is resolved at read time from the live customer visibility preference

## Rationale

- PDF is a durable operator/customer artifact and is more appropriate than plain text for manual attachment or customer download.
- Rendering PDFs on the API avoids coupling receipt output to either frontend runtime and keeps snapshot-derived receipt generation centralized.
- Manual WhatsApp fallback is an operational recovery action after bot failure; tying it to business-state transitions would create duplicate or misleading domain effects.
- Live preference-based name resolution avoids rebuilding archived leaderboard snapshots whenever a customer changes visibility settings while still preserving archived rank/stamp integrity.

## Consequences

Positive:

- admin and customer receipt downloads now use the same backend-controlled rendering path
- failed send recovery is explicit in the outbox contract and visible in tests and UI
- leaderboard privacy defaults remain strong while still allowing customer opt-in without rank recalculation
- archived snapshots remain stable for rank/score auditing

Tradeoffs:

- the API now owns PDF generation and carries an additional dependency for receipt rendering
- manual WhatsApp fallback marks a notification manually resolved when the deep link is opened, not when the operator proves delivery happened
- leaderboard display is no longer fully frozen textually because names are resolved from live preference at read time

## Follow-Up

- validate PDF rendering quality and WhatsApp deep-link behavior in staging and real devices
- when the real WhatsApp adapter is introduced, preserve the same failed-send fallback semantics instead of replacing them with an implicit retry-only model
- if future reporting requires historically frozen public display names, introduce an explicit archived-display-name policy rather than reusing the current live-preference resolution silently
