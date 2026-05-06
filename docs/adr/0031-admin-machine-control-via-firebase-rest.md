# ADR 0031: Admin Machine Control via Firebase REST

Status: Accepted  
Date: 2026-05-06  
Scope: admin machine control API, Firebase Realtime Database integration, deploy secrets, and admin machine control UI

## Context

CJ Laundry needs an admin-only surface to turn physical washers and dryers on and off from the existing admin app. The reference scripts in `drafts/` use Firebase Realtime Database keys under `Mesin` and intentionally update a machine key only when that key already exists.

The confirmed hardware mapping is:

| Machine group | Read status | Turn on command | Turn off command |
| --- | --- | --- | --- |
| Dryer 1-5 | `Mesin/A1` through `Mesin/E1` | same as status key, write `"1"` | same as status key, write `"0"` |
| Washer 1-5 | `Mesin/A3` through `Mesin/E3` | `Mesin/A2` through `Mesin/E2`, write `"1"` | same as status key, write `"0"` |

Firebase values are strings, not booleans or numbers:

- `"1"` means on
- `"0"` means off
- anything else is treated as unreadable/unknown by the admin UI

## Decision

Implement machine control as a backend-owned admin integration.

- The admin frontend calls CJ Laundry API endpoints only.
- The API talks to Firebase Realtime Database through REST `.json` endpoints.
- The only runtime Firebase configuration is `FIREBASE_DATABASE_URL`.
- No Firebase SDK, Firebase Admin SDK, browser API key, service account, database secret, or auth token is introduced.
- The API exposes:
  - `GET /v1/admin/machines`
  - `POST /v1/admin/machines/:machineId/command`
- Both endpoints require an authenticated admin session; command writes also require trusted admin origin validation.
- The UI exposes `/admin/mesin` through the admin `Lainnya` navigation group.

## Conditional Update Contract

The write path is stricter than the original draft scripts while preserving their intent.

For each command:

1. Resolve the exact command key from the fixed machine map.
2. `GET /Mesin/{key}.json` with `X-Firebase-ETag: true`.
3. If Firebase returns `null`, reject with `404` and do not write.
4. If Firebase returns a value but no ETag, reject with dependency error and do not write.
5. `PUT /Mesin/{key}.json` with body `"0"` or `"1"` and `if-match: <etag>`.
6. If Firebase returns precondition failure, reject with `409` and do not write.
7. After success, re-read `Mesin` to refresh admin status.

This uses Firebase REST conditional requests, which are the REST equivalent of an optimistic transaction. The practical effect is:

- existing keys can be updated
- missing keys are never created by the API
- keys deleted or changed between read and write are not recreated
- concurrent command attempts fail cleanly instead of silently overwriting unexpected state

The previous parent-level `PATCH Mesin` approach was intentionally avoided because a race between read and write could recreate a deleted child key.

## Key Scope

The API only reads or writes the following Firebase paths:

- Reads list status from `Mesin`
- Reads/writes dryer command keys: `Mesin/A1`, `Mesin/B1`, `Mesin/C1`, `Mesin/D1`, `Mesin/E1`
- Reads/writes washer off/status keys: `Mesin/A3`, `Mesin/B3`, `Mesin/C3`, `Mesin/D3`, `Mesin/E3`
- Reads/writes washer on command keys: `Mesin/A2`, `Mesin/B2`, `Mesin/C2`, `Mesin/D2`, `Mesin/E2`

No customer, order, WhatsApp, MongoDB, or other Firebase path is touched by this feature.

## Deploy Secret Contract

The app runtime reads:

```text
FIREBASE_DATABASE_URL
```

GitHub Actions environment secrets use environment-prefixed names:

```text
STAGING_FIREBASE_DATABASE_URL
PRODUCTION_FIREBASE_DATABASE_URL
```

The staging and production deploy workflows validate those GitHub secrets and render them into the VM runtime env as `FIREBASE_DATABASE_URL`. The API container receives that variable through `deploy/api/docker-compose.remote.yml`.

Manual VM-only deployments may set `FIREBASE_DATABASE_URL` directly in the runtime env file, but GitHub Actions deployments must use the prefixed secret names.

## Rationale

Keeping Firebase access in the API preserves the existing product and architecture rule that business and operational mutations go through backend-owned server routes. It also prevents the admin web bundle from receiving Firebase configuration or direct database write capability.

REST access is sufficient for the current hardware bridge because the feature only needs simple key reads and conditional single-key writes. Avoiding Firebase SDKs keeps the runtime smaller and avoids committing to service account management before Firebase rules require it.

The washer mapping intentionally separates the "turn on" command key (`A2-E2`) from the status key (`A3-E3`). The UI therefore tells operators that washer on sends a command and that visible status updates only when hardware updates the status key.

## Failure Modes

- Missing `FIREBASE_DATABASE_URL`: API returns dependency configuration error.
- Missing machine key: API returns `404`; no Firebase write occurs.
- Key changes or disappears between read and write: API returns `409`; no Firebase write occurs.
- Firebase unavailable or rejects the request: API returns dependency error and records failed audit metadata.
- Firebase value is not `"0"` or `"1"`: UI displays `Tidak terbaca` and does not infer state.
- Washer on command succeeds but status still reads `"0"`: UI remains status-driven because `A3-E3` is the source of truth.

Successful and failed command attempts write audit records:

- `machine.command.sent`
- `machine.command.failed`

## Consequences

### Positive

- Admin gets one operational panel for all 10 machines.
- Machine commands remain server-side and auditable.
- The implementation cannot create new Firebase machine keys through normal or race-condition paths.
- Deploy secret names follow the repo's existing `STAGING_` / `PRODUCTION_` convention.
- The hardware path contract is explicit enough for staging smoke tests.

### Negative

- Staging and production deploys now require Firebase database URL secrets.
- If Firebase rules later require authentication, this decision must be extended with an auth token or Admin SDK credential path.
- Conditional REST writes require Firebase ETag support; if ETags are unavailable, commands fail closed.
- Washer on status may appear delayed until the hardware writes the status key.

## Verification

Implemented verification includes:

- `npm run lint`
- `npm run typecheck`
- `npm run validate:cloud-runtime`
- `npm run audit:prod`
- `npm test`
- `npm run build`

Backend integration coverage includes:

- unauthenticated admin is rejected
- 10 machine statuses are read as string-backed statuses
- dryer commands write the `A1-E1` status/command keys
- washer on writes `A2-E2`
- washer off writes `A3-E3`
- missing command keys are not created
- keys deleted between read and write fail with `409` and are not recreated

## Related Decisions

- ADR 0001: Backend Owns Business Rules and Shared Contracts
- ADR 0015: Admin Operator UX and Notification Recovery Expansion
