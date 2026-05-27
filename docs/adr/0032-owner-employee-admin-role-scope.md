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

No new env vars are introduced for the employee account. Credentials are stored as bcrypt hashes in MongoDB.

The API owns role enforcement:

- Settings, staff management, session-wide owner logout, and machine control require owner.
- Employee dashboard requests are accepted only for `window=daily`.
- Employee laundry requests are accepted only for `scope=active` or `scope=today`.
- Deactivated or deleted admin accounts invalidate on the next authenticated request because admin middleware reloads the account from MongoDB.

Session revocation deletes stored sessions for a target admin user id:

- owner "log out all devices" deletes other owner sessions and keeps the current session id
- employee password changes and deactivation delete all employee sessions

The admin web mirrors those rules by hiding Settings and Kontrol Mesin for employee sessions, hiding weekly/monthly dashboard controls, and hiding laundry History.

## Rationale

Keeping owner and employee in the existing `admins` collection avoids new deployment configuration and preserves the current login page/domain. Server-side role checks keep hidden navigation from becoming the only control boundary.

Reloading the admin document in authenticated middleware makes deactivation effective without needing a separate token version or long-lived role claim. Deleting persisted sessions handles immediate revocation when the owner changes employee credentials or disables the account.

## Consequences

### Positive

- Owner can delegate daily operations without giving access to machine control or admin settings.
- Employee setup is fully runtime-managed and does not require deploy changes.
- Existing admin login UX remains unchanged.
- Role restrictions are enforced by the backend and reflected in the UI.

### Negative

- Every authenticated admin request now performs an admin account lookup.
- Session revocation depends on the active session store representation.
- This is not general multi-user RBAC; adding more employees or granular permissions requires a new decision.

## Verification

Planned verification includes:

- backend integration coverage for owner login, employee setup, inactive login rejection, role-restricted endpoints, employee session revocation, and owner logout-other-sessions
- E2E coverage for owner-created employee login, hidden employee navigation, daily-only dashboard controls, and laundry History hiding
- full repo gates: lint, typecheck, cloud runtime validation, production audit, tests, and build

## Related Decisions

- ADR 0001: Backend Owns Business Rules and Shared Contracts
- ADR 0015: Admin Operator UX and Notification Recovery Expansion
- ADR 0030: Admin Dashboard Periodic Operational Metrics
- ADR 0031: Admin Machine Control via Firebase REST
