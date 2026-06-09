# Session Handoff 2026-06-09

Document status: Active
Purpose: repo snapshot after production Use Backup restore workflow and backup threshold implementation

## Current State

- Added production-only manual GitHub Actions workflow `Use Backup`.
- `Use Backup` restores `${MONGO_DATABASE}.*` from the latest successful Cloudflare R2 backup under `production/mongodb/success` while preserving current MongoDB auth metadata; live scoped restore intentionally does not use `--oplogReplay`.
- The workflow reuses existing production secret names and requires the operator confirmation text `USE_LATEST_PRODUCTION_R2_BACKUP`.
- Production deploy and `Use Backup` share the `production-runtime` concurrency group with `cancel-in-progress: false`.
- `deploy/scripts/backup-mongo-r2.sh` now supports `restore-latest` and `pre-restore` safety backups.
- Production backups now default to `BACKUP_MIN_CUSTOMERS=100`; daily, pre-deploy, post-deploy, and pre-restore backups skip R2 upload below that customer count.
- Restore prints selected backup metadata:
  - backup name
  - archive key
  - UTC timestamp
  - Asia/Jakarta GMT+7 timestamp
  - current release SHA
- Caddy remains unchanged; production routing still follows existing `ADMIN_DOMAIN`, `PUBLIC_DOMAIN`, and `API_DOMAIN`.

## Operational Notes

- For a replacement GCP production VM, update existing `PRODUCTION_VM_HOST` and `PRODUCTION_VM_SSH_KNOWN_HOSTS`; do not create new secret names.
- Run the normal production deploy first so `/opt/cjl/production/current` and `runtime.env` exist on the target VM, then run `Use Backup`.
- The restore source is selected before any pre-restore safety backup, so an empty replacement VM cannot become the selected latest backup.
- `Use Backup` is destructive to live MongoDB data and should only run during an approved recovery window.

## Verification

Record final verification in the session closeout after commands finish.

## Recommended Next Start

1. Merge and deploy this release to production so the restore workflow/tooling is available.
2. Confirm production GitHub secrets target the intended replacement VM.
3. Run `Use Backup` during an approved recovery window and record the selected backup metadata plus smoke-check result.
