# Manual Provisioning Checklist

Document status: Active  
Created: 2026-03-21  
Purpose: short external checklist for provisioning staging and production before the first deploy

## Local Preparation

- local `npm test` passes
- local `npm run build` passes
- local `docker compose config` passes
- staging SSH key pair exists on the operator machine
- production SSH key pair exists on the operator machine

## GCP

- create one Ubuntu VM for staging
- create one Ubuntu VM for production
- reserve one static IP for each VM
- open inbound `22`, `80`, and `443`
- copy `deploy/scripts/bootstrap-vm.sh` to each VM
- run `bootstrap-vm.sh staging ...` on the staging VM with the staging public key
- run `bootstrap-vm.sh production ...` on the production VM with the production public key
- confirm SSH login works for `cjl-staging-deploy`
- confirm SSH login works for `cjl-production-deploy`
- confirm `docker version` works when logged in as each deploy user

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
- add staging deploy-user SSH private key
- add production deploy-user SSH private key
- add staging `known_hosts`
- add production `known_hosts`
- add all staging Mongo, session, bootstrap admin, and Caddy secrets
- add all production Mongo, session, bootstrap admin, and Caddy secrets

## Validation

- SSH from your machine to each VM works before relying on GitHub Actions
- `CI` succeeds on branch `staging`
- `Deploy Staging` reaches green
- staging smoke URLs respond
- staging business flow is validated manually before touching `main`
