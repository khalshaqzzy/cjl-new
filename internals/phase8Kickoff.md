# Phase 8 Kickoff

Document status: Active  
Created: 2026-03-21  
Purpose: focused next-session start for real hosted rollout validation

## Starting Context

The repo now contains:

- full local build and test automation
- branch-based GitHub Actions CI
- branch-based deploy workflows for staging and production
- SSH-orchestrated release shipping to VMs
- VM-local Docker build strategy
- Caddy + Docker Compose remote runtime assets
- comprehensive hosted deployment guide and provisioning checklist

## Read Order

1. `internals/rules.md`
2. `internals/sessionHandoff-2026-03-21.md`
3. `internals/implementationPhases.md`
4. `internals/environmentMatrix.md`
5. `internals/deploymentGuide.md`
6. `internals/manualProvisioningChecklist.md`
7. relevant ADRs in `docs/adr/`
8. this file

## Recommended First Tasks

1. Provision the real staging VM in GCP.
2. Set DNS for `staging.cjlaundry.com`, `admin-staging.cjlaundry.com`, and `api-staging.cjlaundry.com`.
3. Populate the GitHub `staging` environment secrets exactly as documented.
4. Push a known-good commit to branch `staging` and observe the first deploy end to end.
5. Update the deployment docs immediately with any real-world drift discovered during the first rollout.

## Guardrails

- do not move image builds back into GitHub without an explicit ADR update
- keep MongoDB off public ports in hosted environments
- keep all deploy flows branch-based as frozen by the PRD unless the product contract changes
- treat the first real staging rollout as a documentation-validation session, not just an ops click-through
