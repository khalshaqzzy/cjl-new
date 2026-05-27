# Session Handoff 2026-05-06

Document status: Active  
Purpose: concise repo handoff after admin machine control, owner/employee role, employee QR login, and PR #3 CodeQL hardening

## Current State

- Added owner/employee admin role support:
  - seeded `admin-primary` is normalized as active owner
  - owner can create/update one employee account from Settings
  - employee login uses the existing admin login page/domain
  - employee cannot access Settings or Kontrol Mesin
  - employee dashboard is daily-only
  - employee laundry is limited to `Aktif` and `Hari Ini`
  - owner Settings can log out other owner sessions while keeping the current session
- Added owner-only reusable employee QR login:
  - Settings can generate/rotate and disable one reusable employee login link
  - QR tokens are stored hash-only in MongoDB and the plaintext URL is only returned on generation
  - employee QR redemption creates an employee admin session and can be reused until disabled, credentials change, or the account is deactivated
  - username/password changes and employee deactivation invalidate the QR link and revoke existing employee sessions
- Addressed PR #3 review and CodeQL findings:
  - QR login management routes are rate limited
  - employee POS now loads active services through `GET /v1/admin/services` instead of owner-only Settings
  - owner/employee session revocation now parses persisted session JSON and deletes exact matching session IDs instead of substring-matching serialized sessions
  - `Laundry Aktif` only fetches the admin session once on mount
  - webhook POSTs are rate limited before ingestion
  - API Helmet CSP is enabled for API responses
  - non-test runtime now has CSRF middleware plus `/v1/admin/csrf-token` and `/v1/public/csrf-token`; admin/public fetch helpers automatically attach `X-CSRF-Token` for unsafe methods
- Added admin-only `Kontrol Mesin` under the `Lainnya` menu.
- Backend now owns Firebase Realtime Database access through `FIREBASE_DATABASE_URL` and REST `.json` endpoints; frontend never talks to Firebase directly.
- Machine mapping implemented:
  - dryer 1-5 read/write `A1-E1`
  - washer 1-5 read status from `A3-E3`
  - washer on writes `A2-E2 = "1"`
  - washer off writes `A3-E3 = "0"`
- All Firebase command writes use string values `"0"` / `"1"` and PATCH the `Mesin` parent path after confirming the target key exists.
- Added backend audit actions `machine.command.sent` and `machine.command.failed`.
- Staging/production deploy workflows now require `STAGING_FIREBASE_DATABASE_URL` / `PRODUCTION_FIREBASE_DATABASE_URL` and render them as runtime `FIREBASE_DATABASE_URL`.
- Updated lockfile to move transitive `ip-address` to `10.2.0`, clearing the production audit gate.
- Updated admin/public Next.js to `16.3.0-canary.27`, matching the audit-safe canary line where Next's bundled PostCSS is `8.5.10`.

## Verification

- `npm run lint` passed.
- `npm run typecheck` passed.
- `npm run validate:cloud-runtime` passed.
- `npm run audit:prod` passed.
- `npm test` passed.
- `npm run build` passed.

Latest PR #3 local/remote verification after CodeQL hardening:

- `npm run lint` passed with the existing POS Next.js `window.location.href` warnings only.
- `npm run typecheck` passed.
- `npm run validate:cloud-runtime` passed.
- `npm run audit:prod` passed.
- `npm test` passed.
- `npm run build` passed.

Earlier verification from the machine-control session:

- `npm run test:backend` passed.
- `docker compose config` passed.
- `docker compose --project-directory . --env-file deploy/env/runtime.staging.env.example -f deploy/api/docker-compose.remote.yml config` passed.
- `docker compose --project-directory . --env-file deploy/env/runtime.production.env.example -f deploy/api/docker-compose.remote.yml config` passed.
- `docker compose --project-directory . --env-file deploy/env/runtime.production.env.example -f deploy/api/docker-compose.remote.yml build api admin-web public-web` passed.

## Operational Notes

- No new env vars are required for the employee account; owner creates it from `/admin/settings`.
- Production/staging browser clients now fetch CSRF tokens automatically through the admin/public API helpers before unsafe requests.
- Hosted GitHub deployments must set the environment-prefixed Firebase secrets; manual VM env edits use runtime name `FIREBASE_DATABASE_URL`.
- Firebase rules must permit the app backend to read/write the `Mesin` paths using only the database URL, matching the provided draft scripts.
- `internals/phaseBacklog.md` is referenced by `internals/rules.md` but is not present in this repo snapshot.

## Recommended Next Start

1. Watch PR #3 checks after the latest push and confirm the required CodeQL code-scanning review check turns green.
2. Configure `FIREBASE_DATABASE_URL` in staging.
3. Smoke test `/admin/mesin` against real hardware status values.
4. Confirm washer on command path `A2-E2` updates physical machine behavior while status remains sourced from `A3-E3`.
