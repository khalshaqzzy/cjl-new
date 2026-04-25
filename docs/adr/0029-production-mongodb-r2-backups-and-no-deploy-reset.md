# ADR 0029: Production MongoDB R2 Backups and No Deploy Reset

Status: Accepted  
Date: 2026-04-25  
Scope: production backup, retention, restore posture, and hosted deploy data-safety policy

## Context

CJ Laundry production runs as one Docker Compose stack on the production VM. MongoDB is a MongoDB 7 container, uses a single-node replica set for transactions, and persists data under `/opt/cjl/production/shared/mongo-data`.

The old hosted deploy flow included a reset-token mechanism. If the reset fingerprint changed, `remote-deploy.sh` could run a full container reset and remove persistent data, including `shared/mongo-data`. That behavior is now too dangerous for production because runtime env changes, secret rotation mistakes, or a misunderstood reset-token change could destroy the only live business database before a backup exists.

Production also needs automated backups to Cloudflare R2:

- daily at `02:00 Asia/Jakarta`
- before every production deploy image build
- 3 hours after a successful production deploy, only if that release is still current

The user explicitly chose:

- production-only backups
- same R2 bucket, under a production backup prefix
- no client-side encryption for backup archives
- backup only MongoDB data, but enough MongoDB data for full app database recovery
- pre-deploy backup failure blocks production deployment
- delayed 3-hour backups occur after successful deploy
- if a backup service exists on the VM, it must be containerized where practical
- remove Mongo reset on runtime env changes under all circumstances

## Decision

Production MongoDB backups are implemented as VM-side scripts under `deploy/scripts/`.

The backup runner is `deploy/scripts/backup-mongo-r2.sh`. It uses containerized external tooling:

- MongoDB tools from the running `mongo` Compose service via `docker compose exec`
- `rclone/rclone` container for S3-compatible R2 upload/delete/list operations
- `node:22-bookworm-slim` container for retention planning and delayed-state parsing on the VM

The production workflow renders `/opt/cjl/production/shared/backup.env` from GitHub production secrets:

- `PRODUCTION_R2_ACCOUNT_ID` -> `R2_ACCOUNT_ID`
- `PRODUCTION_R2_BUCKET` -> `R2_BUCKET`
- `PRODUCTION_R2_ACCESS_KEY_ID` -> `R2_ACCESS_KEY_ID`
- `PRODUCTION_R2_SECRET_ACCESS_KEY` -> `R2_SECRET_ACCESS_KEY`
- fixed prefix: `R2_PREFIX=production/mongodb`

`backup.env` is uploaded with `umask 077` and must not be committed.

## Backup Artifact

Each successful backup creates:

- one MongoDB archive object
- one JSON manifest object

The archive is produced by:

```bash
mongodump --archive --gzip --oplog
```

The dump scope is the full MongoDB instance, not only `${MONGO_DATABASE}`. This is intentional because `mongodump --oplog` is the consistency mechanism for live replica-set dumps and is not compatible with a narrowed `--db` dump. The practical recovery target remains CJ Laundry MongoDB data, not app images or VM filesystem state.

Archive object layout:

```text
production/mongodb/in-progress/YYYY/MM/<timestamp>_production_<reason>_<current-sha>_<incoming-sha>.archive.gz
production/mongodb/success/YYYY/MM/<timestamp>_production_<reason>_<current-sha>_<incoming-sha>.archive.gz
production/mongodb/manifests/YYYY/MM/<timestamp>_production_<reason>_<current-sha>_<incoming-sha>.json
```

Upload flow:

1. write dump locally under `/opt/cjl/production/shared/backups/tmp`
2. compute local size and SHA-256
3. upload archive to `in-progress`
4. verify the in-progress archive can be listed
5. upload manifest
6. upload archive to `success`
7. best-effort delete the in-progress object

Retention only considers objects under `production/mongodb/success`.

## Backup Triggers

### Daily Backup

`deploy/scripts/ensure-backup-systemd.sh` checks whether backup timers are installed after production deploy. If either timer is missing, it runs `deploy/scripts/install-backup-systemd.sh`.

The installer copies stable backup scripts into `/opt/cjl/production/shared/bin` and installs `cjl-mongo-r2-backup@production.timer`.

Installed stable scripts:

```text
/opt/cjl/production/shared/bin/cjl-mongo-r2-backup
/opt/cjl/production/shared/bin/backup-retention.mjs
```

The systemd units call the stable `shared/bin` script, not `/opt/cjl/production/current/...`. This is required so timers keep working if production is rolled back to a release that predates the backup implementation.

The timer uses:

```ini
OnCalendar=*-*-* 02:00:00 Asia/Jakarta
Persistent=true
```

The timer installation is automatic during production deploy. The workflow runs the ensure script after `remote-deploy.sh` succeeds and before smoke checks. This means that if smoke checks later fail and rollback runs, stable backup scripts have already been copied into `shared/bin` and the systemd timers do not depend on `/current`.

The bootstrap script does not grant passwordless sudo, but it does add the deploy user to the Docker group. The ensure script therefore installs timers through the first available path:

1. current root privileges
2. passwordless sudo if an operator has added it separately
3. Docker host namespace access, using the bootstrap-provided Docker permission

### Blocking Pre-Deploy Backup

`.github/workflows/deploy-production.yml` runs a pre-deploy backup after:

- CI has succeeded
- the production release archive has been uploaded to the VM
- `runtime.env` and `backup.env` have been rendered and uploaded

It runs before `remote-deploy.sh`, so it happens before the VM image build and before new code starts. If the pre-deploy backup fails, the production deploy stops.

The first production deploy into an empty `/opt/cjl/production/current` may skip pre-deploy backup because no previous production release exists yet.

### Delayed Post-Deploy Backup

After production smoke checks and `/ready` semantic validation pass, the workflow runs:

```bash
backup-mongo-r2.sh record-delayed /opt/cjl/production <release-sha>
```

This records a pending backup in:

```text
/opt/cjl/production/shared/backup-state/delayed-post-deploy.json
```

`cjl-mongo-r2-delayed-backup@production.timer` polls every 5 minutes. Once the pending backup is at least 3 hours old, it checks whether the recorded SHA is still the current release:

- if yes, it runs a `post-deploy` backup
- if no, it marks the delayed backup as `skipped-superseded`

This prevents old commits from receiving delayed backups after a newer successful production deploy.

## Retention

Retention is implemented in `deploy/scripts/backup-retention.mjs` and tested in `tests/backup-retention.test.mjs`.

Retention runs only after a successful daily backup. It never runs after pre-deploy or delayed post-deploy backups.

The retention rule keeps:

- all successful backups newer than 72 hours
- the newest daily backup
- the two most recent commit-boundary daily backups

A commit-boundary daily is a daily backup that is followed by at least one `pre-deploy` backup before the next daily backup.

For example:

```text
D1 C1 C2 C3 X1 D2 C4 X2 D3
```

The preserved daily backups are:

- `D3`, because it is the newest daily
- `D2`, because it is the latest commit-boundary daily
- `D1`, because it is the commit-boundary daily before `D2`

All successful backups younger than 72 hours are also retained.

Cleanup deletes archive and manifest pairs. Malformed keys and `in-progress` objects are ignored by the retention planner.

## No Deploy Reset Policy

Hosted deploy reset behavior is removed.

`deploy/scripts/remote-deploy.sh` no longer accepts or reads:

- `DEPLOY_RESET_FINGERPRINT`
- `*_DEPLOY_RESET_TOKEN`
- `shared/deploy-reset.fingerprint`

It no longer contains:

- `compose down --volumes`
- host-side `rm -rf` helpers for shared persistent data
- any code path that deletes `shared/mongo-data`

Runtime env changes, secret changes, or workflow reruns must never delete MongoDB data. Any future destructive production data reset must be a separate, explicit, operator-run procedure with its own ADR/runbook.

ADR 0011 is superseded for deploy reset behavior.

## Security And Access Decisions

R2 bucket access must remain private:

- do not enable public bucket access
- do not enable `r2.dev` access
- use bucket-scoped S3 API credentials where possible
- store R2 secrets only in the GitHub `production` environment and on the VM-rendered `backup.env`

Backup archives are not client-side encrypted by project decision. Cloudflare R2 still provides provider-side transport/storage controls, but operators must treat bucket credentials as production database credentials because the objects contain customer and order data.

The implementation uses R2's S3-compatible endpoint:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

and region:

```text
auto
```

## Restore Posture

This ADR implements backup creation and retention, not automatic restore.

Restore is intentionally manual because restoring MongoDB is destructive if run against the live database. A restore drill must download an archive from R2 into an isolated MongoDB instance and use:

```bash
mongorestore --archive=<file>.archive.gz --gzip --oplogReplay
```

Operators must prove at least one isolated restore before relying on these backups for production recovery.

Deploy rollback still restores only code/runtime. It does not undo MongoDB business mutations.

## Rationale

- A full MongoDB dump is the smallest practical way to combine live backup with `--oplog` consistency.
- A blocking pre-deploy backup captures the currently healthy production data before new code builds or starts.
- A delayed post-deploy backup captures the post-release production state only after the deploy is proven healthy.
- Containerized rclone/Node usage avoids requiring host-level package installation beyond Docker.
- Removing deploy reset entirely is safer than preserving a high-blast-radius reset switch.
- Keeping backup retention in a tested Node module is safer than encoding nuanced date/commit-boundary logic in shell.

## Consequences

- Production deploys now require working R2 credentials.
- A production pre-deploy backup outage blocks deploys until R2 credentials, R2 reachability, Docker, MongoDB, or disk-space problems are fixed.
- The first backup-capable release automatically installs or refreshes production VM backup timers after deploy succeeds. This uses Docker-group host access when root/sudo is unavailable, which is powerful but consistent with the bootstrap-created deploy user's Docker privileges.
- Backup storage may temporarily exceed the minimum retained set because all successful backups younger than 72 hours are preserved.
- The same-bucket prefix design depends on careful bucket access controls and operator discipline; accidental bucket-wide deletion remains outside this app's control.
- Client-side encryption is deliberately absent; changing that would require a new ADR and restore runbook update.

## Follow-Up

- Complete Cloudflare and GitHub provisioning using `docs/Cloudflare/R2/R2Guide.md`.
- Run one manual production backup after the backup-capable release is deployed.
- Run an isolated restore drill and record the result in production readiness notes.
- Consider a future alerting mechanism for backup failures; current implementation blocks deploy-time failures and relies on systemd/journal logs for timer failures.
