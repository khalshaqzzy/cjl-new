# Production Readiness Checklist

Document status: Active  
Created: 2026-03-25  
Purpose: final gate checklist before the first production push after observability, error handling, and security hardening

## Build And Verification

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test` passes
- `npm run build` passes
- `npm run audit:prod` passes
- CI security job passes:
  - Gitleaks
  - Trivy filesystem scan
- CodeQL workflow passes on the target commit
- `docker compose config` passes
- `docker compose build` passes in CI

## Runtime And Secrets

- no placeholder secrets remain in staging or production runtime envs
- `SESSION_SECRET` is unique per environment
- `WHATSAPP_GATEWAY_TOKEN` is unique per environment
- `ADMIN_BOOTSTRAP_PASSWORD` is present, non-placeholder, and stored only in runtime secrets
- `SESSION_COOKIE_SECURE=true` in hosted env
- `TRUST_PROXY=1` or `true` in hosted env
- `RELEASE_SHA` is rendered into hosted runtime env on deploy
- `LOG_LEVEL` is explicitly set in hosted runtime env

## API And Observability

- every API response includes `X-Request-Id`
- API error responses include `error.code` and `error.requestId`
- structured JSON logs are visible for API and WhatsApp gateway
- access logs include request id, status, latency, actor type, and release sha
- background worker failures produce error logs and do not disappear silently
- `/ready` returns release metadata and dependency checks

## Security And Data Protection

- admin/public/API domains return security headers
- staging runs CSP in report-only mode
- session-authenticated write routes enforce trusted origin checks
- Mongo-backed rate limiting works for admin login, customer login, magic-link redeem, and admin WhatsApp controls
- `customer_magic_links` store token hashes only
- `direct_order_tokens` store token hashes only
- order documents no longer persist plaintext direct status tokens
- audit logs capture request correlation and masked network metadata
- API, admin, and public containers run as non-root
- WhatsApp gateway root runtime is treated as a temporary exception until Chromium and auth-volume permissions are validated on staging

## Staging Acceptance

- staging deploy finishes green
- staging smoke check passes for admin, public, and API
- forced bad release path proves automatic rollback works
- request ID can be traced from browser/network response to container log line
- expected error codes are validated on staging:
  - `401`
  - `403`
  - `404`
  - `409`
  - `422`
  - `429`
  - `500`
  - `503`
- real-device WhatsApp pairing, reconnect, and outbound delivery flow are validated
- magic-link redeem still works without extra customer friction
- customer portal session still renews on sliding 30-day behavior

## Production Go/No-Go

- production release candidate commit already passed staging validation
- previous healthy release SHA is known before deploy
- first-hour production log review owner is assigned
- first-hour review explicitly checks:
  - `401` spikes
  - `429` spikes
  - `5xx` spikes
  - notification delivery failures
  - gateway disconnect/auth failures
- production push remains blocked until every item above is complete
