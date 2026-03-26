# ADR 0013: Mobile Surface Fit and Brand-First Customer CTAs

Status: Accepted  
Date: 2026-03-26  
Scope: durable mobile UX rules for public login/portal surfaces plus narrow-screen admin customer detail and customer-facing visit CTAs

## Context

The repo already had functional public and admin flows, but several mobile-facing UX issues remained in real usage:

- mobile browsers could auto-zoom the login form input fields and carry that zoom state into the portal immediately after successful login
- the portal mobile top bar duplicated page titles on `Riwayat`, `Stamp`, and `Leaderboard`, even though those pages already rendered their own headings in content
- the public landing page exposed address information but no direct outlet-visit CTA for Maps navigation
- the admin customer detail hero and bottom-sheet QR flow could clip controls on narrow screens, including the QR sheet close button

These issues are not backend contract problems. They are long-lived frontend behavior choices that affect how future sessions should preserve customer and operator usability on phones.

## Decision

The repo now standardizes on the following mobile UX rules:

1. public login inputs on mobile must use browser-safe text sizing so focus does not trigger persistent browser zoom
2. successful public login should clear active input focus before redirecting into the portal
3. top-level portal mobile pages for `Riwayat`, `Stamp`, and `Leaderboard` should keep a brand-first `CJ Laundry` header instead of duplicating a page title already shown in the page body
4. customer-facing location cards may expose a direct external Maps CTA when the visit action is operationally useful
5. narrow-screen admin customer detail actions must wrap instead of overflowing horizontally
6. bottom-sheet QR/login-link surfaces that can exceed viewport height must cap their height and scroll internally so close controls remain reachable

## Rationale

- Browser zoom persistence after login feels like a portal rendering bug to customers even when the root cause is the login form.
- A brand-first top bar is easier to scan on mobile and avoids redundant title treatment when the page content already establishes context.
- A Maps CTA turns the address from passive information into a usable visit action without replacing WhatsApp as the primary conversation channel.
- Admin QR flows are operational tools; clipping the close control or action buttons on small screens is unacceptable because it blocks the operator.

## Consequences

Positive:

- customers land in the portal at the expected zoom level after login on mobile browsers
- portal navigation feels more consistent with the brand treatment used on Beranda
- the landing page now supports direct visit intent, not just contact intent
- admin customer detail and QR sheets remain usable on smaller phones

Tradeoffs:

- login form typography on mobile is slightly larger than the prior compact styling
- top-level portal pages intentionally give up some title density in the top bar to preserve clarity
- customer-facing visit/navigation CTA policy is now explicit and should stay aligned with brand/contact strategy in future edits

## Follow-Up

- validate the login-to-portal flow on real Android and iPhone browsers during staging
- validate that the Maps CTA opens correctly from hosted domains and common in-app browsers
- keep future mobile surface redesigns aligned with these rules unless a later ADR intentionally supersedes them
