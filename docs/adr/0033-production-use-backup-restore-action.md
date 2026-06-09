# ADR 0033: Production Use Backup Restore Action

Status: Accepted
Date: 2026-06-09
Scope: production MongoDB R2 restore workflow, backup threshold, and hosted runtime operation locking

## Context

ADR 0029 implemented production MongoDB R2 backups and intentionally kept restore as a manual operator procedure because live restore is destructive. CJ Laundry now has a replacement GCP production VM and needs a GitHub Actions manual recovery path that restores MongoDB from the latest successful R2 backup while preserving the existing deploy workflow and existing secret names.

Production backups can also be misleading while a new VM is empty or still under initial customer load. Creating a daily, pre-deploy, post-deploy, or pre-restore backup with fewer than 100 customers could upload an empty or incomplete recovery point and make it appear as the newest backup.

## Decision

Add a production-only manual GitHub Actions workflow named `Use Backup`.

The workflow:

- is triggered only by `workflow_dispatch`
- runs in the GitHub `production` environment
- requires the operator to type `USE_LATEST_PRODUCTION_R2_BACKUP`
- reuses existing `PRODUCTION_VM_*` and `PRODUCTION_R2_*` secrets
- uploads the current repo restore tooling to the VM without changing the active release
- calls `backup-mongo-r2.sh restore-latest`
- prints the selected R2 archive key, backup name, UTC timestamp, and Asia/Jakarta GMT+7 timestamp
- runs production smoke checks and Cloud readiness validation after restore

Production deploy and restore workflows share the `production-runtime` concurrency group with `cancel-in-progress: false`. This serializes deploy and restore operations without cancelling an in-progress destructive operation.

`backup-mongo-r2.sh` now supports:

```bash
backup-mongo-r2.sh restore-latest production /opt/cjl/production /opt/cjl/production/shared/runtime.env /opt/cjl/production/shared/backup.env
```

Restore behavior:

1. validate the existing R2 backup configuration
2. select the latest successful archive under `production/mongodb/success`
3. download the archive and matching manifest
4. verify archive size and manifest SHA-256 when the manifest exists
5. create a `pre-restore` safety backup only when the live database has at least 100 customers
6. stop write-capable app services
7. run `mongorestore --archive --gzip --nsInclude="${MONGO_DATABASE}.*" --drop`
8. restart the Compose stack and wait for service health

Production backups now default to `BACKUP_MIN_CUSTOMERS=100`. If `${MONGO_DATABASE}.customers` contains fewer than 100 documents, `daily`, `pre-deploy`, `post-deploy`, and `pre-restore` backups log a skip reason and do not upload R2 objects.

Backups remain full-instance `mongodump --archive --gzip --oplog` artifacts, but the live `Use Backup` restore intentionally scopes `mongorestore` to `${MONGO_DATABASE}.*`. This restores application data and GridFS collections while preserving the current VM's MongoDB auth metadata, so the existing `MONGO_ROOT_USERNAME` and `MONGO_ROOT_PASSWORD` secrets remain valid during and after the restore.

`mongorestore --oplogReplay` is intentionally not used in the live scoped restore because MongoDB tools reject oplog replay when namespace includes are specified. Isolated full-instance restore drills should still use `--oplogReplay`.

## Rationale

- Selecting the restore source before the pre-restore safety backup prevents an empty new-VM safety backup from becoming the restore target.
- Scoping live restore to `${MONGO_DATABASE}.*` avoids replacing `admin.system.users` from the archive during a running authenticated restore.
- Omitting `--oplogReplay` in the live scoped restore avoids MongoDB tools' invalid `--oplogReplay` plus `--nsInclude` combination.
- Reusing existing secret names keeps the GCP VM replacement path simple: operators update the existing production VM host and known-host values when the target server changes.
- The 100-customer threshold avoids treating an empty or incomplete VM as a valid latest recovery point.
- A manual workflow with production environment approval is safer than adding restore behavior to the normal deploy workflow.
- Shared production concurrency prevents deploy and restore from racing on the same Compose stack and MongoDB data.

## Consequences

- The newest R2 object may intentionally lag behind current runtime state when the live database has fewer than 100 customers.
- Production pre-deploy backups can now be skipped below the threshold; deploys continue after a clear log message.
- Restore remains destructive to MongoDB data even though it is now workflow-orchestrated.
- Operators must ensure existing `PRODUCTION_VM_HOST` and `PRODUCTION_VM_SSH_KNOWN_HOSTS` point at the intended replacement VM before running deploy or `Use Backup`.
- Caddy configuration does not change; host-based routing continues to use the existing production domains.

## Follow-Up

- Run a production restore drill against an isolated or planned recovery window before relying on `Use Backup` for an emergency.
- Monitor the first restore workflow run for selected backup metadata, post-restore `/ready`, and app smoke results.
