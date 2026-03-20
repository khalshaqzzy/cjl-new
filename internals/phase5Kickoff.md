# Phase 5 Kickoff

Document status: Active  
Created: 2026-03-21  
Purpose: focused next-session start for post-integration stabilization work

## Starting Context

Backend and both frontend apps are integrated and the repo builds successfully from the workspace root.

Current phase goal is not new feature scope. It is stabilization of the integrated stack without changing approved UI design or expanding into deployment, automated testing, or Docker work.

## Read Order

1. `internals/rules.md`
2. `internals/sessionHandoff-2026-03-21.md`
3. `internals/implementationPhases.md`
4. `internals/phaseBacklog.md`
5. this file

## Required Guardrails

- do not redesign existing frontend surfaces
- keep pricing, loyalty, leaderboard, and notification logic server-side
- treat deployment, testing, and Docker as out of scope unless scope changes explicitly
- preserve backend session validation in admin and public protected shells

## Recommended First Tasks

1. Run API, admin web, and public web together against a real MongoDB instance.
2. Manually smoke the highest-risk integrated flows:
   - admin login/session gate
   - POS customer search/create, preview, confirm
   - customer order void/cancel
   - public login/session gate
   - public riwayat, stamp, leaderboard, and direct status
3. Clean the non-blocking Next.js warnings if they can be addressed without design or behavior churn.
4. Tighten loading and error handling where live API failures still produce weak UX.

## Known Non-Blocking Warnings

- deprecated `eslint` key in `app/public-web/next.config.mjs`
- workspace root inference warnings caused by multiple lockfiles

## Definition Of Done For Phase 5

- integrated flows verified against a real Mongo-backed runtime
- remaining config noise reduced or documented with an explicit decision
- obvious live-data loading/error gaps addressed without changing approved UI direction
