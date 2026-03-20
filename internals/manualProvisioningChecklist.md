# Manual Provisioning Checklist

Document status: Active  
Created: 2026-03-21  
Purpose: short external checklist for provisioning staging and production before the first deploy

## GCP

- create one Ubuntu VM for staging
- create one Ubuntu VM for production
- reserve one static IP for each VM
- open inbound `22`, `80`, and `443`
- install Docker Engine and Docker Compose plugin on both VMs
- create `/opt/cjl/staging/releases`, `/opt/cjl/staging/shared`, `/opt/cjl/production/releases`, `/opt/cjl/production/shared`
- confirm SSH login works for the deploy user on both VMs

## DNS

- point `api-staging.cjlaundry.site` to the staging VM
- point `admin-staging.cjlaundry.site` to the staging VM
- point `staging.cjlaundry.site` to the staging VM
- point `api.cjlaundry.site` to the production VM
- point `admin.cjlaundry.site` to the production VM
- point `cjlaundry.site` to the production VM

## GitHub

- create environment `staging`
- create environment `production`
- add all staging VM, Caddy, Mongo, session, and bootstrap admin secrets
- add all production VM, Caddy, Mongo, session, and bootstrap admin secrets

## Validation

- `npm test` passes locally
- `npm run build` passes locally
- `docker compose config` passes locally
- SSH from your machine to each VM works before you rely on GitHub Actions
