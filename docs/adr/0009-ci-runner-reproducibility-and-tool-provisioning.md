# ADR 0009: CI Runner Reproducibility and Tool Provisioning

Status: Accepted  
Date: 2026-03-25  
Scope: GitHub Actions workflow determinism for security scanning and browser-based end-to-end tests

## Context

The repo already depends on GitHub Actions for validation and security gates, but two workflow assumptions proved unstable on clean runners:

- the Trivy scan depended on a mutable action tag format and failed when the referenced action release could not be resolved
- the Playwright end-to-end suite assumed Chromium was already present in the runner cache, which is not guaranteed on a fresh or newly rotated GitHub-hosted image

These failures were operational, not product-level:

- application code, contracts, and tests passed locally
- backend integration tests succeeded on CI
- the workflow still failed before the intended security and browser coverage could complete

Because staging and production deploys are branch-gated by CI, these workflow assumptions are part of the release architecture rather than disposable convenience.

## Decision

The repo now standardizes on the following CI reproducibility rules:

1. third-party GitHub Actions used in security-sensitive paths must be pinned immutably by commit SHA instead of relying on mutable or ambiguous tag references
2. the Trivy filesystem scan continues to use `aquasecurity/trivy-action`, but the workflow pins the action by the accepted upstream release SHA and keeps the Trivy CLI version explicit
3. browser-based E2E validation must provision its own browser dependency on GitHub runners instead of assuming a prewarmed cache
4. the `validate` job installs Playwright Chromium explicitly with `npx playwright install --with-deps chromium` before `npm test`
5. local developer scripts remain unchanged; runner provisioning stays in CI so local workflows are not made heavier just to satisfy hosted execution requirements

## Rationale

- SHA pinning reduces supply-chain ambiguity and removes a class of breakage where an action reference is syntactically plausible but not actually resolvable by GitHub Actions
- keeping the Trivy CLI version explicit preserves scan consistency even if the action updates its internal defaults later
- explicit Playwright browser provisioning makes the E2E job independent of runner cache state and image churn
- scoping browser install to CI preserves current local ergonomics while fixing hosted reliability
- these decisions are narrow, cheap, and aligned with the repo's existing branch-gated deployment model

## Consequences

Positive:

- CI failures from missing Playwright browser binaries should stop on clean GitHub runners
- the security job becomes deterministic about which Trivy action revision and CLI version it executes
- branch-gated staging and production deploys depend on fewer hidden runner assumptions

Tradeoffs:

- the workflow adds setup time for Chromium installation on CI
- SHA-pinned actions are less readable than tag references and must be updated deliberately when upgrading

## Follow-Up

- keep future action upgrades explicit by updating both the accepted release reference and its pinned SHA together
- if E2E expands to multiple browsers, update CI provisioning intentionally instead of assuming Playwright defaults
- continue treating CI workflow reproducibility as architecture-level repo memory and document similar fixes in ADRs when they affect release gates
