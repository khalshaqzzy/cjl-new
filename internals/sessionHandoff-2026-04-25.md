# Session Handoff 2026-04-25

Document status: Active  
Purpose: repo snapshot after production MongoDB R2 backup implementation and no-reset deploy safety change

## What This Session Completed

- implemented production-only MongoDB backups to Cloudflare R2:
  - blocking pre-deploy backup before production VM image build
  - daily backup through systemd at `02:00 Asia/Jakarta`
  - delayed post-deploy backup 3 hours after successful production deploy validation, only if the SHA is still current
- added containerized backup tooling:
  - `deploy/scripts/backup-mongo-r2.sh`
  - `deploy/scripts/backup-retention.mjs`
  - `deploy/scripts/install-backup-systemd.sh`
  - `deploy/env/backup.production.env.example`
- added retention tests for the custom policy:
  - keep all successful backups newer than 72 hours
  - keep newest daily backup
  - keep the two most recent commit-boundary daily backups
  - ignore malformed and `in-progress` objects
- updated production deploy workflow:
  - validates `PRODUCTION_R2_*` secrets
  - renders `/opt/cjl/production/shared/backup.env`
  - blocks deploy on failed pre-deploy backup
  - automatically checks/installs production backup timers after deploy succeeds and before smoke checks
  - records delayed post-deploy backup state after smoke/readiness validation
- removed hosted deploy reset behavior:
  - no `*_DEPLOY_RESET_TOKEN`
  - no `DEPLOY_RESET_FINGERPRINT`
  - no `compose down --volumes`
  - no deploy-script path that deletes `shared/mongo-data`
- left `deploy/scripts/bootstrap-vm.sh` unchanged after user feedback because bootstrap has already run; backup scripts create only their own subdirectories under existing `/opt/cjl/production/shared`
- expanded operational docs:
  - `docs/adr/0029-production-mongodb-r2-backups-and-no-deploy-reset.md`
  - `docs/Cloudflare/R2/R2Guide.md`
  - `internals/deploymentGuide.md`
  - `internals/manualProvisioningChecklist.md`
  - `internals/productionReadinessChecklist.md`
  - `internals/releaseExecutionChecklist.md`
- marked ADR 0011 as superseded for deploy reset behavior
- marked older R2 research retention notes as superseded by ADR 0029

## Verification Run

Succeeded:

- `npm run test:backup-retention`
- `npx --yes tsx scripts/validate-cloud-runtime.ts`
- Git Bash syntax check:
  - `deploy/scripts/backup-mongo-r2.sh`
  - `deploy/scripts/install-backup-systemd.sh`
  - `deploy/scripts/bootstrap-vm.sh`
  - `deploy/scripts/remote-deploy.sh`
  - `deploy/scripts/remote-rollback.sh`
- `docker compose config`
- `node --check deploy/scripts/backup-retention.mjs`
- `git diff --check`

Could not run through normal npm bin path in this local workspace:

- `npm run validate:cloud-runtime` failed because local `tsx` was not available in `node_modules/.bin`; the same validator passed through `npx --yes tsx`.
- `npm run lint` failed because local `eslint` was not available in `node_modules/.bin`.

## Important Repo Facts

- Production backup configuration is rendered to `/opt/cjl/production/shared/backup.env` from GitHub production environment secrets.
- Required GitHub secrets:
  - `PRODUCTION_R2_ACCOUNT_ID`
  - `PRODUCTION_R2_BUCKET`
  - `PRODUCTION_R2_ACCESS_KEY_ID`
  - `PRODUCTION_R2_SECRET_ACCESS_KEY`
- R2 prefix is fixed as `production/mongodb`.
- Backup archives are not client-side encrypted by decision.
- Backup artifact is a full MongoDB instance `mongodump --archive --gzip --oplog`, even though operational recovery target is CJ Laundry MongoDB data.
- Restore is manual and must be drilled into an isolated MongoDB instance with `mongorestore --gzip --oplogReplay`.
- `deploy/scripts/bootstrap-vm.sh` must remain unchanged for this backup feature; do not use it for post-bootstrap backup directory creation.
- `deploy/scripts/install-backup-systemd.sh` and `backup-mongo-r2.sh` create required backup subdirectories under the existing shared directory.
- the timer installer copies stable scripts into `/opt/cjl/production/shared/bin`, so recurring backups do not depend on `/opt/cjl/production/current` containing backup code after rollback.
- timer installation is automatic through `deploy/scripts/ensure-backup-systemd.sh`; when root/sudo is unavailable, it uses Docker host namespace access based on the bootstrap-created deploy user's Docker group membership.
- `docs/Cloudflare/R2/R2Guide.md` is the canonical operator guide for Cloudflare bucket/API token/GitHub secret setup.
- `backup-mongo-r2.sh` validates common R2 secret shape mistakes and checks R2 bucket access before creating a `mongodump` archive; `HeadObject ... 400 BadRequest` or `Credential access key has length 53, should be 32` usually means bucket/account ID/access key/secret access key values were copied in the wrong shape.
- ADR 0029 is the canonical architecture decision for production MongoDB R2 backups and no deploy reset.
- ADR 0011 remains historical and is superseded for deploy reset behavior.

## Manual Work Still Required

1. In Cloudflare:
   - create or choose the private R2 bucket
   - keep public access and `r2.dev` disabled
   - create an R2 S3 API token with Object Read & Write for the production bucket
   - copy Account ID, bucket name, Access Key ID, and Secret Access Key
2. In GitHub production environment:
   - set all four `PRODUCTION_R2_*` secrets
3. Deploy the backup-capable release to production and confirm the `Ensure MongoDB backup timers` workflow step succeeds.
4. Confirm timers:
   - `systemctl list-timers 'cjl-mongo-r2-*'`
5. Run one manual production backup.
6. Run one isolated restore drill and record the result before relying on backups operationally.

## Dirty Worktree Caveat

This session began with unrelated dirty worktree state:

- deleted historical handoff files under `internals/`
- deleted `internals/whatsappBusinessApiMigrationPhases.md`
- modified `package-lock.json`

Those pre-existing changes were not intentionally authored as part of the backup work. Future sessions should inspect them before staging or committing.

## Recommended Next Start

1. Review `docs/Cloudflare/R2/R2Guide.md` while logged into the correct Cloudflare account.
2. Add the four production R2 GitHub secrets.
3. Trigger production deploy only after confirming the R2 token is bucket-scoped and private access remains disabled.
4. Confirm the workflow-installed production backup timers after deploy.
5. Execute and record a restore drill before treating the backup system as production-ready.
