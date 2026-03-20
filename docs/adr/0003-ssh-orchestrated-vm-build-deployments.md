# ADR 0003: SSH-Orchestrated VM-Build Deployments

Status: Accepted  
Date: 2026-03-21  
Scope: staging and production deployment topology

## Context

The PRD fixes the hosted runtime as one VM per environment with MongoDB on Docker Compose and the application stack deployed together.

There were two broad implementation options for deployment:

- build images in GitHub and publish them to a registry, then pull them on the VM
- use GitHub Actions only as a remote orchestrator and let the VM build from the selected release locally

The chosen operational constraint for this project is that image builds must happen on the VM, not in GitHub.

## Decision

Deployments use SSH-orchestrated release shipping and VM-local Docker builds.

The deployment shape is:

- GitHub Actions waits for CI success on the target branch
- GitHub Actions checks out the exact commit to deploy
- GitHub Actions streams a git archive of that release over SSH to the target VM
- the VM stores that release under `/opt/cjl/<env>/releases/<sha>`
- the VM runs `docker compose up -d --build` from that release
- Caddy on the same VM routes admin, public, and API domains to the correct containers

## Rationale

- satisfies the explicit project requirement that deploy images are built on the VM
- avoids maintaining a separate image registry or VM pull credentials
- keeps the deployed artifact traceable to an exact git SHA
- makes rollback possible by reactivating an older release directory on the VM

## Consequences

- deploy VMs need enough CPU, memory, and disk to build images locally
- deployment time is slower than registry-pull approaches because the VM rebuilds services
- GitHub workflows need SSH access plus host key verification material for each environment
- release directories on the VM become part of the operational state and must be managed deliberately

## Follow-Up

- verify VM sizing in staging under repeated real deploys
- if deployment speed or host resource pressure becomes a problem, revisit this ADR explicitly instead of silently moving builds back into GitHub
