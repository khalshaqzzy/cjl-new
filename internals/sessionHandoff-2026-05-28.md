# Session Handoff 2026-05-28

Document status: Active  
Purpose: concise repo handoff after reusable employee QR login implementation

## Current State

- Added owner-managed reusable QR/login link for the single employee account:
  - owner Settings can generate or rotate one active employee login link
  - owner Settings can disable the link without revoking existing employee sessions
  - `/employee-login?token=...` on the admin web redeems the link into an employee admin session
  - the same link can be used for multiple employee logins while active
  - username/password changes disable the current link, increment employee credential version, and revoke employee sessions
  - employee deactivation disables the current link and revokes employee sessions
  - employee reactivation does not restore an old link; owner must generate a new QR
- Employee login-link tokens are stored hash-only on the `admins` document and indexed with sparse uniqueness on `employeeLoginLink.tokenHash`.
- Full employee login URLs are returned only during generate/rotate. After refresh, Settings shows link status and token suffix only.
- Admin Settings mobile UI now includes a QR sheet for employee login with reusable-link copy and warning that opening it on the owner device replaces the current session with an employee session.

## Verification

- `npm run build:contracts` passed.
- `npm run typecheck --workspace @cjl/api --workspace @cjl/admin-web` passed after rebuilding contracts.
- `npm run test:backend` passed.
- `npm run lint` passed with two pre-existing warnings in `app/admin-web/app/admin/pos/page.tsx` for internal navigation via `window.location.href`.
- `npm run typecheck` passed.
- `npm run validate:cloud-runtime` passed.
- `npm run audit:prod` passed.
- `npm test` passed.
- `npm run build` passed.
- Playwright E2E prints a post-test web server warning about `Persisting failed: Access is denied`, but the E2E test exits successfully.

## Operational Notes

- No new environment variables are required.
- If an employee QR is exposed beyond intended devices, owner should disable or regenerate it from Settings.
- Existing employee sessions are not revoked by link disable alone; disable only blocks future QR-based logins.

## Recommended Next Start

1. Smoke test employee QR scan on a real mobile device against staging.
2. Confirm owner operators understand that refreshed Settings cannot reveal a prior full QR URL because tokens are hash-only.
