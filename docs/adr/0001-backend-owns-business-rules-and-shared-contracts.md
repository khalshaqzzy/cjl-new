# ADR 0001: Backend Owns Business Rules And Shared Contracts

Status: Accepted  
Date: 2026-03-21  
Scope: admin web, public web, API, shared contracts

## Context

The repo now contains one Express API, one admin Next.js app, one public Next.js app, and a shared contracts package.

During integration work, several user-facing flows could either keep business behavior in frontend-local mock logic or move that behavior behind backend APIs and shared contract types. The riskiest areas were pricing calculation, loyalty point accumulation, leaderboard views, order lifecycle transitions, notification text composition, and protected-session checks.

If those rules drift across apps, the admin and public surfaces will disagree on order state, customer value, and leaderboard outcomes. Future sessions would also be forced to re-decide where truth lives.

## Decision

The backend is the system of record for business rules and operational state.

Specifically:

- pricing, points, leaderboard aggregation, order lifecycle guards, and notification template handling stay server-side
- admin and public apps consume backend APIs instead of recreating those rules locally
- shared request and response shapes are exported from `packages/contracts` and consumed by the API and frontend apps
- frontend mock data may exist only for presentation helpers or design scaffolding, not for runtime truth in integrated flows

## Rationale

- one implementation of business rules reduces drift between admin and public experiences
- contract sharing keeps integration changes explicit and type-checked across packages
- future stabilization and deployment work is simpler when operational state transitions are centralized
- frontend scope stays focused on rendering, interaction, and resilient data handling rather than re-implementing domain behavior

## Consequences

- backend changes can affect both frontends and should be treated as cross-surface changes
- new feature work that changes domain behavior should start with API and contract updates, then integrate into the UIs
- frontend-only shortcuts that bypass backend truth should be treated as temporary scaffolding and removed before a feature is considered integrated

## Follow-Up

- keep new integrated flows on shared contracts rather than ad hoc frontend types
- when a long-lived contract or runtime boundary changes materially, add a new ADR or supersede this one
