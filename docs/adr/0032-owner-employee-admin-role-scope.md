# ADR 0032: Owner and Employee Admin Role Scope

Status: Accepted  
Date: 2026-05-27  
Scope: admin authentication, admin API authorization, admin web navigation, and employee account lifecycle

## Context

CJ Laundry originally used one admin account for all internal operations. The operator now needs one additional employee account that uses the same admin login page and domain, without introducing new runtime environment variables.

The employee account is operational, not an equal admin:

- no `/admin/settings`
- no `/admin/mesin`
- dashboard limited to today's data
- laundry limited to `Aktif` and `Hari Ini`
- no access to laundry `History`

The owner also needs a Settings action to log out other devices while keeping the current owner session active.

## Decision

Admin auth now has two roles:

- `owner`
- `employee`

The seeded `admin-primary` account is always normalized as an active `owner`. The optional employee account is stored in the same `admins` collection as `_id: "employee-primary"` and is managed only from owner Settings.

The employee account contract is intentionally capped at one account:

- create/update username
- set password on first setup
- optional password replacement after setup
- active/inactive toggle
- one reusable QR/login link managed from owner Settings

No new env vars are introduced for the employee account. Credentials are stored as bcrypt hashes in MongoDB. The reusable employee QR login token is stored hash-only on the employee admin document; the full URL is returned only at generation time.

The API owns role enforcement:

- Settings, staff management, session-wide owner logout, and machine control require owner.
- Employee dashboard requests are accepted only for `window=daily`.
- Employee laundry requests are accepted only for `scope=active` or `scope=today`.
- Deactivated or deleted admin accounts invalidate on the next authenticated request because admin middleware reloads the account from MongoDB.

Session revocation deletes stored sessions for a target admin user id:

- owner "log out all devices" deletes other owner sessions and keeps the current session id
- employee username/password changes and deactivation delete all employee sessions

Employee QR login uses one active reusable link at a time:

- owner can generate or rotate the link from Settings
- owner can disable the link without logging out already-authenticated employee sessions
- username/password changes disable the current link and increment the employee credential version
- employee deactivation disables the current link and revokes employee sessions
- reactivation does not restore an old QR link; owner must generate a new one

The admin web mirrors those rules by hiding Settings and Kontrol Mesin for employee sessions, hiding weekly/monthly dashboard controls, and hiding laundry History.

## Rationale

Keeping owner and employee in the existing `admins` collection avoids new deployment configuration and preserves the current login page/domain. Server-side role checks keep hidden navigation from becoming the only control boundary.

Reloading the admin document in authenticated middleware makes deactivation effective without needing a long-lived role claim. Deleting persisted sessions handles immediate revocation when the owner changes employee credentials or disables the account. The separate `credentialVersion` lets reusable QR links remain valid across normal use while failing closed after credential changes.

## Consequences

### Positive

- Owner can delegate daily operations without giving access to machine control or admin settings.
- Employee setup is fully runtime-managed and does not require deploy changes.
- Existing admin login UX remains unchanged.
- Employee can log in quickly on mobile devices by scanning a QR code.
- Role restrictions are enforced by the backend and reflected in the UI.

### Negative

- Every authenticated admin request now performs an admin account lookup.
- Session revocation depends on the active session store representation.
- A reusable QR link is more sensitive than a one-time link, so owner must disable or rotate it if the QR is exposed outside intended employee devices.
- This is not general multi-user RBAC; adding more employees or granular permissions requires a new decision.

## Verification

Planned verification includes:

- backend integration coverage for owner login, employee setup, inactive login rejection, role-restricted endpoints, employee session revocation, reusable QR login, QR disable, credential invalidation, and owner logout-other-sessions
- E2E coverage for owner-created employee login, QR generation from Settings, hidden employee navigation, daily-only dashboard controls, mobile QR sheet rendering, and laundry History hiding
- full repo gates: lint, typecheck, cloud runtime validation, production audit, tests, and build

## Related Decisions

- ADR 0001: Backend Owns Business Rules and Shared Contracts
- ADR 0015: Admin Operator UX and Notification Recovery Expansion
- ADR 0030: Admin Dashboard Periodic Operational Metrics
- ADR 0031: Admin Machine Control via Firebase REST
