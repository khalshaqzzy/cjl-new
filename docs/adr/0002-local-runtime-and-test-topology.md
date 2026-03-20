# ADR 0002: Local Runtime And Test Topology

Status: Accepted  
Date: 2026-03-21  
Scope: local runtime, automated verification, Docker packaging

## Context

After frontend/backend integration was completed, the repo still lacked two things:

- a repeatable local container topology for the whole stack
- automated verification that exercised real HTTP flows across backend and frontend surfaces

The project also needed a practical answer for automated database-backed tests without making every local test run depend on a healthy Docker daemon.

## Decision

Use two complementary local-runtime paths:

- `docker-compose.yml` plus per-service Dockerfiles for full-stack local container packaging
- `mongodb-memory-server` for automated backend integration and browser end-to-end tests

This means Docker is the local packaging/runtime baseline, while automated tests remain daemon-independent and faster by booting ephemeral in-memory MongoDB processes.

## Rationale

- Compose provides a concrete operational shape that future VM deployment work can build on
- memory-backed test databases keep `npm test` self-contained and less brittle in developer machines and CI
- browser e2e still exercises real API and frontend processes without requiring a full container stack
- separating packaging concerns from automated verification keeps both workflows simpler

## Consequences

- Docker Compose success and automated test success are related but not identical signals
- future sessions must keep container runtime docs and test-runtime docs aligned
- if the project later standardizes on containerized tests, this ADR should be updated or superseded

## Follow-Up

- decide CI strategy for build plus test execution
- decide whether production images should keep current `next start` approach or move to standalone output
