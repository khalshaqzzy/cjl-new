# Deployment Guide

Document status: Active  
Created: 2026-03-21  
Purpose: canonical note for current deployment-adjacent repo assets and what is still intentionally deferred

## Scope Boundary

This repo now contains local Docker packaging and Compose topology, but live deployment remains out of scope.

Do not assume VM rollout, reverse proxy, TLS, secrets distribution, backup policy, or registry publication are finalized just because Dockerfiles now exist.

## Current Local Runtime Commands

From repo root:

1. `npm run build`
2. `npm test`
3. `npm run docker:build`
4. `npm run docker:up`
5. `npm run docker:down`

## Current Docker Artifacts

- `docker-compose.yml`
- `packages/api/Dockerfile`
- `app/admin-web/Dockerfile`
- `app/public-web/Dockerfile`
- `.env.example`

## What These Artifacts Mean Today

- local teams can build container images for the monorepo surfaces
- local teams can boot the full stack with Compose
- future deployment sessions have a concrete baseline instead of starting from zero

## What Is Still Missing For Live Deployment

- environment-specific secret injection and storage
- reverse proxy / TLS configuration
- health-check and rollback orchestration on target VMs
- CI/CD image build and publish steps
- persistent WhatsApp session storage design
- backup and restore runbook for MongoDB volumes

## Guidance For Future Sessions

- if the next session touches staging or production rollout, update this file in the same session
- if image strategy changes materially, add or update an ADR
- prefer keeping local test topology and live deployment topology explicitly separated in documentation
