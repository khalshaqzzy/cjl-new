# Phase 7 Kickoff

Document status: Active  
Created: 2026-03-21  
Purpose: focused next-session start after local dockerization and automated test coverage

## Starting Context

The repo now has:

- backend and both frontend surfaces integrated
- root build passing
- backend integration suite passing
- frontend end-to-end suite passing
- local Dockerfiles and Compose topology committed

## Read Order

1. `internals/rules.md`
2. `internals/sessionHandoff-2026-03-21.md`
3. `internals/implementationPhases.md`
4. `internals/phaseBacklog.md`
5. `internals/environmentMatrix.md`
6. `internals/deploymentGuide.md`
7. this file

## Recommended First Tasks

1. Add CI workflow that runs build and test automatically.
2. Decide whether to keep current `next start` image approach or move frontends to standalone runtime output.
3. Expand automated coverage to notification failure handling, settings changes, and dashboard/reporting paths.
4. If live deployment becomes in scope, define VM secret model, reverse proxy assumptions, and rollback approach before touching pipelines.

## Guardrails

- do not silently re-decide backend-owned business logic
- do not redesign frontend visuals while working on release/ops hardening
- keep local test/runtime assumptions distinct from future live deployment assumptions
- update `deploymentGuide.md`, `environmentMatrix.md`, and ADRs if runtime topology changes again
