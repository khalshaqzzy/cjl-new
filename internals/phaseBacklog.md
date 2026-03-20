# Phase Backlog

Document status: Active  
Purpose: condensed next-work inventory after backend/frontend integration

## Next Recommended Items

1. Run the API and both frontends together against MongoDB and verify session, POS, void, leaderboard, and direct status flows manually.
2. Clean Next.js config warnings:
   remove deprecated `eslint` key from `app/public-web/next.config.mjs`
   decide whether to keep or remove extra lockfiles / set explicit Turbopack root
3. Tighten frontend error handling for live API failures so pages do not silently degrade.

## Lower Priority Follow-Ups

1. Reduce remaining frontend dependence on `lib/mock-data.ts` for helper-only concerns and move stable shared formatting/helpers where appropriate.
2. Add dedicated smoke-check / acceptance scripts when testing moves into scope.
3. Review whether archived leaderboard snapshot lifecycle needs additional operator visibility in admin UI.

## Explicitly Out Of Scope From Last Session

- deployment changes
- automated tests
- Docker/runtime provisioning changes
