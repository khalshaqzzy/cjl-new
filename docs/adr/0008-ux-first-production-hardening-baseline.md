# ADR 0008: UX-First Production Hardening Baseline

Status: Accepted  
Date: 2026-03-25  
Scope: observability, API error contracts, customer-safe security controls, and hosted release gates

## Context

The repo reached a point where the product flows were functionally complete, but production readiness still depended on several weak operational defaults:

- API logging was still too close to local-development style and did not provide durable request correlation
- many backend failures still collapsed into generic errors, making frontend support and incident triage harder
- hosted boot accepted placeholder or weakly validated secrets and settings
- abuse controls relied on in-memory rate limiting that does not survive process restarts
- customer login and direct-status tokens were still operationally sensitive artifacts that should not be stored in plaintext
- deploy automation existed, but CI and release gates did not yet enforce the full hardening baseline

At the same time, the product intentionally optimizes for low-friction customer behavior:

- customer login remains normalized phone plus name
- one-time magic links remain a first-class UX shortcut
- customer sessions remain sliding 30 days
- no OTP, CAPTCHA, or extra challenge step should be introduced as part of this production hardening pass

## Decision

The repo now standardizes on the following baseline:

1. API and WhatsApp gateway runtime logs use structured JSON output
2. every API response includes `X-Request-Id`, and API error responses include `message`, `error.code`, and `error.requestId`
3. backend failures are mapped through typed error classes instead of generic catch-all responses
4. staging and production boot reject placeholder secrets, unsafe hosted origins, and missing secure-cookie or proxy assumptions
5. session-authenticated write routes enforce trusted `Origin` or `Referer`
6. abuse controls for login, token redeem, and admin WhatsApp control paths use Mongo-backed rate limiting
7. customer magic-link tokens and direct order status tokens are stored as hashes, not plaintext
8. CI and release gates must pass lint, typecheck, tests, build, runtime dependency audit, secret scan, static analysis, and deploy smoke checks
9. API, admin, and public containers run as non-root in hosted environments
10. WhatsApp gateway is allowed as a temporary root-runtime exception until Chromium and auth-volume permissions are validated on staging

## Rationale

- Structured logs plus request IDs give the smallest useful observability baseline without adding an external vendor.
- Stable error envelopes preserve current frontend behavior while making operator support and debugging materially faster.
- Hosted env validation prevents a common class of first-deploy and post-rotation misconfigurations from reaching runtime silently.
- Trusted-origin enforcement and durable rate limiting improve abuse resistance without adding customer-visible friction.
- Token hashing removes unnecessary persistence of login and direct-status secrets while preserving the existing customer UX.
- Non-root containers reduce blast radius for the main internet-facing services with minimal implementation cost.
- Keeping the gateway exception explicit is safer than forcing non-root Chromium behavior before staging proves the runtime works.

## Consequences

Positive:

- incidents can now be traced across logs, responses, and release SHAs with far less guesswork
- frontend users continue to receive stable messages while support teams gain correlation IDs
- customer-facing security is stronger without adding visible challenge steps
- production deploys now have a clearer go or no-go gate through CI and `internals/productionReadinessChecklist.md`

Tradeoffs:

- the backend now carries more cross-cutting infrastructure code for logging, error typing, and request context
- Mongo is now a dependency not only for business data but also for durable rate-limit state
- some staging validation burden increases because Chromium and WhatsApp auth persistence must be proven before removing the gateway exception

## Follow-Up

- run the first full staging rollout and complete `internals/productionReadinessChecklist.md`
- validate request-id tracing, rollback automation, and real-device WhatsApp reconnect behavior on staging
- revisit the WhatsApp gateway root-runtime exception after staging permission validation
- revisit whether the in-process outbox remains sufficient once real hosted traffic and failure patterns are visible
