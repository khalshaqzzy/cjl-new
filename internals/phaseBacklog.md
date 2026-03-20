# Phase Backlog

Document status: Active  
Purpose: condensed next-work inventory after containerization and automated test coverage

## Next Recommended Items

1. Add CI workflow that runs `npm run build` and `npm test` on every push and pull request.
2. Decide whether frontend images should stay `next start` based or move to standalone output for leaner runtime images.
3. Expand automated coverage for failure paths that are only lightly touched today:
   WA failure simulation
   manual notification resolution
   settings mutation propagation
   direct order link revocation if later implemented

## Lower Priority Follow-Ups

1. Reduce remaining frontend dependence on `lib/mock-data.ts` for helper-only concerns and move stable shared formatting/helpers where appropriate.
2. Add additional browser tests for settings, notification outbox, and dashboard reporting views.
3. Review whether archived leaderboard snapshot lifecycle needs additional operator visibility in admin UI.

## Explicitly Out Of Scope From This Session

- live deployment / VM rollout
- production reverse proxy and TLS setup
- Docker image publishing and registry workflows
