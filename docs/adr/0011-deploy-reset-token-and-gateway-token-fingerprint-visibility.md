# ADR 0011: Deploy Reset Token and Gateway Token Fingerprint Visibility

Status: Accepted  
Date: 2026-03-25  
Scope: staged and production deploy workflow observability plus destructive reset behavior

## Context

Hosted WhatsApp triage depended too much on inference:

- operators could not confirm from GitHub Actions whether `api` and `whatsapp-gateway` had actually been rendered with the same `WHATSAPP_GATEWAY_TOKEN`
- some recovery scenarios required a truly clean hosted rebuild, but the existing deploy flow intentionally preserved Mongo data, WhatsApp auth state, and Caddy state across deploys
- when a persistent hosted session became suspect, operators had no single deploy-time switch that forced the next rollout to rebuild from an empty data state

For first production and staging rollouts, this ambiguity slowed diagnosis. It was especially problematic for WhatsApp pairing failures, where token mismatch and corrupted persisted state can look similar from the UI.

## Decision

The repo now standardizes on the following hosted deploy behavior:

1. GitHub Actions computes and prints a short SHA-256 fingerprint of `WHATSAPP_GATEWAY_TOKEN`
2. the same fingerprint is printed for both `api` and `whatsapp-gateway` so operators can confirm parity without exposing the raw secret
3. each hosted environment now requires a separate `*_DEPLOY_RESET_TOKEN`
4. the VM stores only a fingerprint of the last deployed reset token in `shared/deploy-reset.fingerprint`
5. if the current reset-token fingerprint differs from the stored value, the deploy tears down the stack, removes Compose volumes, deletes persistent hosted directories, and then rebuilds from scratch

## Rationale

- Raw secret values must not be printed in CI logs, but operators still need a fast parity signal during incident triage.
- A dedicated deploy-reset secret is safer than overloading normal application secrets with hidden destructive behavior.
- Fingerprint comparison is enough to detect intentional reset-token rotation while avoiding storage of the raw reset secret on the VM.
- Full-stack wipe behavior is acceptable here because the reset-token path is explicitly destructive and intended only for rare recovery or environment rebootstrap scenarios.

## Consequences

Positive:

- deploy operators can confirm WhatsApp gateway token parity directly from workflow logs
- intentional environment rebootstrap now has one explicit control instead of ad hoc manual cleanup on the VM
- recovery from poisoned persistent WhatsApp auth state can be folded into normal deploy orchestration

Tradeoffs:

- the first deploy after introducing `*_DEPLOY_RESET_TOKEN` wipes hosted persistent data because no previous fingerprint exists yet
- rotating `*_DEPLOY_RESET_TOKEN` is a high-blast-radius action that also removes Mongo and Caddy state, not just WhatsApp auth
- deploy workflows now have an additional required secret per hosted environment

## Follow-Up

- validate the first destructive reset on staging before relying on it for production recovery
- decide later whether narrower reset scopes, such as WhatsApp-auth-only reset, should exist alongside the current full-environment wipe
- ensure operators treat reset-token rotation as a planned maintenance action, not a routine redeploy habit
