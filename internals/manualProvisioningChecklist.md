# Manual Provisioning Checklist

Document status: Active  
Last updated: 2026-05-06  
Purpose: short external checklist for provisioning staging and production before the first Cloud-era deploy

## Local Preparation

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test:backend` passes
- `npm run test:e2e` passes
- `npm run build` passes
- `npm run validate:cloud-runtime` passes
- `docker compose config` passes
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

- point `api-staging.cjlaundry.com` to the staging VM
- point `admin-staging.cjlaundry.com` to the staging VM
- point `staging.cjlaundry.com` to the staging VM
- point `api.cjlaundry.com` to the production VM
- point `admin.cjlaundry.com` to the production VM
- point `cjlaundry.com` to the production VM

## GitHub

- create environment `staging`
- create environment `production`
- add staging deploy-user SSH private key
- add production deploy-user SSH private key
- add staging `known_hosts`
- add production `known_hosts`
- add all staging Mongo, `MONGO_REPLICA_KEY`, session, bootstrap admin, and Caddy secrets
- add staging Firebase machine control secret:
  - `STAGING_FIREBASE_DATABASE_URL`
- add staging Cloud WhatsApp secrets:
  - `STAGING_WHATSAPP_BUSINESS_ID`
  - `STAGING_WHATSAPP_WABA_ID`
  - `STAGING_WHATSAPP_PHONE_NUMBER_ID`
  - `STAGING_WHATSAPP_ACCESS_TOKEN`
  - `STAGING_WHATSAPP_APP_SECRET`
  - `STAGING_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- add all production Mongo, `MONGO_REPLICA_KEY`, session, bootstrap admin, and Caddy secrets
- add production Firebase machine control secret:
  - `PRODUCTION_FIREBASE_DATABASE_URL`
- add production Cloud WhatsApp secrets:
  - `PRODUCTION_WHATSAPP_BUSINESS_ID`
  - `PRODUCTION_WHATSAPP_WABA_ID`
  - `PRODUCTION_WHATSAPP_PHONE_NUMBER_ID`
  - `PRODUCTION_WHATSAPP_ACCESS_TOKEN`
  - `PRODUCTION_WHATSAPP_APP_SECRET`
  - `PRODUCTION_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- add production R2 backup secrets:
  - `PRODUCTION_R2_ACCOUNT_ID`
  - `PRODUCTION_R2_BUCKET`
  - `PRODUCTION_R2_ACCESS_KEY_ID`
  - `PRODUCTION_R2_SECRET_ACCESS_KEY`

## Validation

- SSH from your machine to each VM works before relying on GitHub Actions
- `CI` succeeds on branch `staging`
- `Deploy Staging` reaches green
- staging `/health` and `/ready` respond
- staging `/ready` reports the expected release SHA and Cloud provider readiness
- staging API responses expose `X-Request-Id`
- staging API logs are structured JSON
- staging manual operator reply works when CSW is open
- staging template-only composer state appears when CSW is closed
- staging inbound media retrieval works from the admin inbox
- staging webhook challenge verification and signed POST ingestion are validated before touching `main`
- after the backup-capable production release deploys, confirm the workflow's `Ensure MongoDB backup timers` step succeeded
- confirm timers are visible:
  - `systemctl list-timers 'cjl-mongo-r2-*'`
- run one manual production MongoDB R2 backup and one isolated restore drill before relying on production backups
