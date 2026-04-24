# Cloudflare R2 Backup Research Knowledge

Document status: Research draft  
Created: 2026-04-24  
Scope: Cloudflare R2 research for automated MongoDB backups from CJ Laundry VMs

This document captures current research for a possible MongoDB backup system that uploads backup artifacts to Cloudflare R2. It is not a final architecture decision. Treat it as input for a later ADR/runbook.

## 1. Project Context

CJ Laundry v1 currently runs as:

- one VM per hosted environment
- one Docker Compose stack per environment
- MongoDB 7 in the same Compose stack
- MongoDB configured as a single-node replica set for transaction support
- deployment orchestrated by GitHub Actions over SSH
- VM-local Docker image builds from release directories under `/opt/cjl/<env>/releases/<sha>`
- shared persistent state under `/opt/cjl/<env>/shared`

Relevant repo files:

- `internals/PRD.md`
- `internals/deploymentGuide.md`
- `docs/adr/0003-ssh-orchestrated-vm-build-deployments.md`
- `docs/adr/0004-transactional-mongo-and-in-process-outbox.md`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `deploy/api/docker-compose.remote.yml`
- `deploy/scripts/remote-deploy.sh`
- `deploy/scripts/remote-rollback.sh`

Current hosted MongoDB persistence:

- Compose service: `mongo`
- hosted volume path: `${SHARED_DIR}/mongo-data:/data/db`
- staging shared dir: `/opt/cjl/staging/shared`
- production shared dir: `/opt/cjl/production/shared`
- runtime env file: `/opt/cjl/<env>/shared/runtime.env`
- Mongo URI inside Compose network:
  - `mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@mongo:27017/${MONGO_DATABASE}?authSource=admin&replicaSet=rs0`

Current deployment risk relevant to backups:

- `deploy/scripts/remote-deploy.sh` performs `compose up -d --build --remove-orphans`.
- If the deploy reset fingerprint changes, `remote-deploy.sh` runs `full_reset_stack`, including removal of `mongo-data`.
- Rollback restores code/runtime only. It does not undo MongoDB business data mutations.
- Therefore, any future deploy-time backup should run before any operation that can remove or materially alter MongoDB persistent data.

## 2. Candidate Workflow Being Researched

The user's provisional workflow is:

- daily backup every 02:00
- automatic backup after commit
- automatic backup before image build on VM, to preserve the last stable legacy image/data state
- automatic backup 3 hours after the last commit
- delete all backups in storage except the last 3 backups

This workflow may change. Research conclusions below should be read as constraints and design notes, not a frozen system decision.

## 3. Cloudflare R2 Facts Relevant To This Project

### 3.1 Product Fit

Cloudflare R2 is S3-compatible object storage. Cloudflare documents R2 as object storage for unstructured data and states that it can store outputs from large batch processes. That fits compressed MongoDB dump archives.

R2 supports several access paths:

- S3-compatible API
- Cloudflare Workers binding
- Cloudflare dashboard and Wrangler REST-backed operations
- S3-compatible tools such as rclone and AWS SDK/CLI style clients

For this project, the most natural path is VM-side S3-compatible upload using `rclone` or another S3-compatible CLI because:

- the backup source is the VM, not a Worker
- the deploy flow already uses SSH into the VM
- MongoDB is only reachable inside the VM's Docker network
- no application API changes are required for the first backup implementation

Source: Cloudflare R2 overview and S3 get-started docs:

- https://developers.cloudflare.com/r2/
- https://developers.cloudflare.com/r2/get-started/s3/

### 3.2 Bucket Creation

Cloudflare bucket creation can be done from the dashboard or Wrangler:

```bash
npx wrangler login
npx wrangler r2 bucket create <bucket-name>
npx wrangler r2 bucket list
```

Cloudflare bucket naming constraints:

- lowercase letters, numbers, and hyphens only
- 3 to 63 characters
- cannot begin or end with a hyphen
- buckets are not public by default

Suggested project bucket shape:

- separate buckets per environment:
  - `cjlaundry-staging-backups`
  - `cjlaundry-production-backups`
- or one bucket with strict prefixes:
  - `staging/mongodb/...`
  - `production/mongodb/...`

Separate buckets are operationally safer because access tokens, lifecycle rules, bucket locks, and accidental deletion blast radius can be separated per environment.

Source:

- https://developers.cloudflare.com/r2/buckets/create-buckets/

### 3.3 S3 Endpoint And Region

R2 S3 API endpoint format:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

R2 S3 region is:

```text
auto
```

For compatibility, empty region and `us-east-1` can alias to `auto`, but new scripts should use `auto` explicitly when the tool supports it.

Source:

- https://developers.cloudflare.com/r2/api/s3/api/

### 3.4 Credentials And Token Scope

To use the S3 API:

- create an R2 API token from Cloudflare Dashboard
- choose Object Read & Write permission
- scope it to specific bucket(s) where possible
- copy the Access Key ID and Secret Access Key at creation time
- store the secret securely because it cannot be viewed again

Cloudflare supports account tokens and user tokens. For VM automation, prefer an account-level token owned by the Cloudflare account, not a personal user token, because user tokens can become inactive if that user is removed.

Suggested future GitHub/VM secret names:

- `STAGING_R2_ACCOUNT_ID`
- `STAGING_R2_BUCKET`
- `STAGING_R2_ACCESS_KEY_ID`
- `STAGING_R2_SECRET_ACCESS_KEY`
- `PRODUCTION_R2_ACCOUNT_ID`
- `PRODUCTION_R2_BUCKET`
- `PRODUCTION_R2_ACCESS_KEY_ID`
- `PRODUCTION_R2_SECRET_ACCESS_KEY`

If using client-side encryption with rclone crypt:

- `STAGING_RCLONE_CONFIG_PASS` or systemd credential equivalent
- `STAGING_RCLONE_CRYPT_PASSWORD`
- `STAGING_RCLONE_CRYPT_SALT`
- production equivalents

Do not commit rclone config with embedded secrets to the repo.

Source:

- https://developers.cloudflare.com/r2/api/s3/tokens
- https://developers.cloudflare.com/r2/get-started/s3/

### 3.5 Private Bucket Default

R2 buckets are private by default. This is the correct default for database backups.

Do not enable public bucket access or `r2.dev` access for MongoDB backup buckets.

If a future restore process needs temporary access, prefer:

- VM-side authenticated S3/rclone download
- or a short-lived presigned URL only for a controlled restore operation

Source:

- https://developers.cloudflare.com/r2/buckets/create-buckets/
- https://developers.cloudflare.com/r2/data-access/public-buckets/

### 3.6 Storage Classes

R2 has:

- Standard
- Infrequent Access

R2 Standard:

- no minimum storage duration
- no data retrieval processing fee
- default storage class

R2 Infrequent Access:

- lower storage price
- retrieval processing fee
- 30-day minimum storage duration

For a "keep last 3 backups" workflow, Standard is the safer initial choice because the retention window may be shorter than 30 days and restores should not incur retrieval fees during incident response. Infrequent Access only becomes interesting if retention becomes long enough, for example monthly archives kept for many months.

Source:

- https://developers.cloudflare.com/r2/buckets/storage-classes/
- https://developers.cloudflare.com/r2/pricing/

### 3.7 Pricing Model

R2 pricing is based on:

- storage volume
- Class A operations, generally state-mutating operations
- Class B operations, generally read operations
- retrieval processing fees for Infrequent Access
- no R2 egress bandwidth charge for either storage class

Relevant prices observed in current docs:

- Standard storage: `$0.015 / GB-month`
- Infrequent Access storage: `$0.01 / GB-month`
- Standard Class A operations: `$4.50 / million requests`
- Standard Class B operations: `$0.36 / million requests`
- egress: free

Deletes are free operations. Unauthorized requests are not billed.

For this project, expected cost is likely dominated by stored backup size, not operations, because backup count is small. Multipart upload can increase Class A operations because each part is an operation, but this should still be small unless dumps become very large or frequent.

Source:

- https://developers.cloudflare.com/r2/pricing/

### 3.8 Object Lifecycle Rules

R2 lifecycle rules can:

- delete objects after a chosen age
- transition objects to Infrequent Access after a chosen age

Important behavior:

- objects are typically removed within 24 hours of expiration
- existing objects may take longer to reflect newly applied lifecycle rules

Lifecycle rules are age-based, not "keep last N" based. Therefore, lifecycle rules alone cannot satisfy "delete all backups except the last 3" with exact semantics.

Recommended interpretation:

- implement "keep last 3 successful backups" in the VM backup script
- optionally add a broad lifecycle safety net, such as delete backups older than 30 or 90 days, once retention policy is decided

Source:

- https://developers.cloudflare.com/r2/buckets/object-lifecycles/

### 3.9 Bucket Locks

R2 bucket locks can prevent deletion and overwriting for a defined period or indefinitely. They can apply by prefix and the strictest matching rule wins. Bucket lock rules take precedence over lifecycle rules.

Operational implication:

- bucket locks protect against accidental or malicious early deletion
- bucket locks conflict with an aggressive "keep last 3 only" policy if the lock duration is longer than the time it takes to create the 4th backup

For CJ Laundry, bucket locks may be useful if the final policy becomes:

- keep last 3 daily backups
- but guarantee at least 3 or 7 days of immutability

If final policy remains "delete all except last 3 immediately", do not apply bucket lock to that prefix unless the cleanup script tolerates deletion failures for locked objects.

Source:

- https://developers.cloudflare.com/r2/buckets/bucket-locks/

### 3.10 Limits

Relevant R2 limits:

- unlimited data storage per bucket
- unlimited objects per bucket
- object key length: 1,024 bytes
- object metadata size: 8,192 bytes
- object size: 5 TiB per object, specifically 5 GiB less than 5 TiB
- single-part upload: about 5 GiB
- multipart upload: about 4.995 TiB
- max upload parts: 10,000
- concurrent writes to the same object key: 1 per second

Implications:

- use unique object keys for every backup artifact
- include timestamp and release SHA in object key
- do not overwrite `latest.gz` as the primary backup object
- if a pointer object is desired, make it small metadata only and tolerate the same-key write limit

Source:

- https://developers.cloudflare.com/r2/platform/limits/

### 3.11 Security Properties

R2 encrypts objects and metadata at rest automatically. Cloudflare states objects are encrypted using AES-256 and that transport uses TLS.

This is useful but does not replace client-side encryption for database backups containing customer phone numbers, order histories, receipt metadata, and admin operational data.

Recommended project stance:

- treat R2 as encrypted-at-rest infrastructure
- still consider client-side encryption before upload
- store encryption material outside R2, preferably in an operator password manager and/or VM secret store
- verify restore procedure includes decryption, not just download

Source:

- https://developers.cloudflare.com/r2/reference/data-security/
- https://rclone.org/crypt/

### 3.12 Data Location

R2 bucket data location can be:

- Automatic, default and recommended by Cloudflare
- Location Hint, best effort for expected access region
- Jurisdictional Restriction, hard residency guarantee for supported jurisdictions

Location Hints are not guarantees. For Indonesia-based operations, `apac` is the likely performance hint if choosing one. If there is a legal/regulatory reason for a hard jurisdiction, confirm Cloudflare's supported jurisdictions before finalizing.

Source:

- https://developers.cloudflare.com/r2/reference/data-location/

### 3.13 Metrics And Observability

R2 exposes per-bucket metrics and analytics in the dashboard and via Cloudflare's GraphQL Analytics API. Relevant datasets include operations and storage.

This can answer:

- how much backup data is stored
- whether backup uploads are happening
- operation volume by bucket

It does not replace VM-side backup logs, restore test logs, or explicit success/failure alerts.

Source:

- https://developers.cloudflare.com/r2/platform/metrics-analytics/

## 4. Rclone Research

Cloudflare documents rclone as a supported example for R2. Rclone can upload objects concurrently and use R2 through the S3 provider.

Cloudflare's rclone notes:

- generate an R2 access key first
- configure rclone as an Amazon S3 compatible provider
- choose Cloudflare R2 storage provider
- set endpoint to `https://<accountid>.r2.cloudflarestorage.com`
- use `acl = private`
- if using object-level permissions, add `no_check_bucket = true`

Example config shape:

```ini
[r2]
type = s3
provider = Cloudflare
access_key_id = <access-key-id>
secret_access_key = <secret-access-key>
endpoint = https://<account-id>.r2.cloudflarestorage.com
acl = private
```

For scripted VM usage, prefer environment variables or a root-owned config file with mode `0600`.

Rclone commands relevant to backups:

```bash
rclone copy /path/to/backup.gz r2:cjlaundry-production-backups/production/mongodb/
rclone ls r2:cjlaundry-production-backups/production/mongodb/
rclone lsf --files-only r2:cjlaundry-production-backups/production/mongodb/
rclone copy r2:cjlaundry-production-backups/production/mongodb/<file>.gz /restore/path/
```

Avoid `rclone sync` for one-file backup publication unless the desired behavior is to make the remote prefix identical to a local directory. `sync` can delete destination files and should be tested with `--dry-run` first.

For "keep last 3", safer implementation:

1. upload new backup with `rclone copyto` or `rclone copy`
2. list backup objects in the target environment prefix
3. sort by timestamp encoded in the object key
4. delete all but last 3 successful backups with `rclone deletefile` or S3 DeleteObject

Rclone multipart notes:

- R2 supports objects up to about 5 TiB
- multipart uploads affect Class A operation count
- rclone can tune multipart behavior with `--s3-chunk-size` and `--s3-upload-cutoff`

For initial backup archives, default rclone behavior is acceptable unless dumps become very large.

Source:

- https://developers.cloudflare.com/r2/examples/rclone/
- https://rclone.org/commands/rclone_sync/
- https://rclone.org/crypt/

## 5. MongoDB Backup Research

### 5.1 Backup Method

MongoDB documents several backup methods for self-managed deployments. For a small self-managed deployment, `mongodump` and `mongorestore` are simple and efficient. MongoDB cautions that they are not ideal for larger systems and that `mongodump` can affect `mongod` performance.

This project is a small single-VM POS system, so `mongodump` is the practical initial choice.

Source:

- https://www.mongodb.com/docs/manual/core/backups/
- https://www.mongodb.com/docs/database-tools/mongodump/
- https://www.mongodb.com/docs/database-tools/mongorestore/

### 5.2 Consistency

This repo runs MongoDB as a single-node replica set. MongoDB `mongodump --oplog` works against nodes that maintain an oplog, including replica set members. `--oplog` captures writes that occur during the dump to support a point-in-time snapshot of the mongod instance.

For CJ Laundry, use `--oplog` for hosted backups unless testing proves a conflict with the selected dump scope. The app uses multi-document transactions for business writes, so backup consistency matters.

Candidate dump command inside the Mongo container:

```bash
mongodump \
  --uri="mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/${MONGO_DATABASE}?authSource=admin&replicaSet=rs0" \
  --archive="/backup/${backup_name}.archive.gz" \
  --gzip \
  --oplog
```

Security caveat: MongoDB warns that passwords passed in a URI can be visible to process-status programs such as `ps`. Prefer a root-owned config file or controlled environment file rather than printing secrets in command logs.

Source:

- https://www.mongodb.com/docs/database-tools/mongodump/

### 5.3 Archive And Compression

`mongodump --archive` produces a single binary archive file. `--gzip` compresses BSON and metadata. This is operationally convenient for R2 because one backup equals one object.

Restore from compressed archive:

```bash
mongorestore \
  --uri="mongodb://..." \
  --archive="/restore/<backup>.archive.gz" \
  --gzip
```

For destructive restore into an existing database, a restore runbook must decide whether to use `--drop`. Do not automate `--drop` in the backup script.

Source:

- https://www.mongodb.com/docs/database-tools/mongodump/
- https://www.mongodb.com/docs/database-tools/mongorestore/

### 5.4 Dump Scope

The app logical database is `${MONGO_DATABASE}`. Backups should include:

- all app collections in `${MONGO_DATABASE}`
- indexes and collection metadata
- enough auth context to restore operationally, if root user recreation is not handled separately

Questions for final design:

- Should backups include only `${MONGO_DATABASE}`, or all databases except local?
- Should Mongo users/roles be dumped with `--dumpDbUsersAndRoles`?
- Should restore bootstrap recreate DB users from runtime env instead?

Initial recommendation:

- dump `${MONGO_DATABASE}` plus oplog
- keep Mongo root credentials as environment provisioning secrets, not as backup-only source of truth
- document restore as "provision Mongo with runtime credentials, then restore app database"

## 6. Scheduling Research

### 6.1 Daily 02:00 Backup

Use a systemd timer on the VM rather than cron for hosted environments because:

- systemd can track missed calendar timer runs with `Persistent=true`
- timer/service logs land in journalctl
- service unit can enforce environment, user, working directory, resource, and lock behavior

Candidate timer:

```ini
[Unit]
Description=CJ Laundry MongoDB R2 daily backup timer

[Timer]
OnCalendar=*-*-* 02:00:00
Persistent=true
AccuracySec=1min
Unit=cjl-mongo-r2-backup@production.service

[Install]
WantedBy=timers.target
```

Use VM local timezone intentionally. The PRD primary timezone is `Asia/Jakarta`; hosted VMs should either run in UTC with explicit calendar handling, or be configured/documented so `02:00` means Asia/Jakarta. The safer final script logs both UTC and Asia/Jakarta timestamps.

Source:

- https://www.freedesktop.org/software/systemd/man/devel/systemd.timer.html

### 6.2 Post-Commit / Post-Deploy Backup

In the current repo, commits do not directly occur on the VM. GitHub Actions sends a release archive over SSH. Therefore "post commit" has two possible meanings:

1. after GitHub observes a successful CI run for a commit on `staging` or `main`
2. after the VM receives or deploys that commit's release archive

For this architecture, "pre-image-build on VM" is the most precise hook:

- GitHub Actions uploads release archive
- before `remote-deploy.sh` runs `docker compose up -d --build`, call backup script over SSH
- backup object includes current release SHA and incoming release SHA
- only proceed to build/deploy if backup succeeds, at least for production

This preserves the currently running/stable data state before new code starts and before deploy-reset can remove persistent volumes.

Potential workflow insertion in `.github/workflows/deploy-production.yml`:

- after `Upload runtime env`
- before `Deploy on VM`
- SSH command:
  - `bash "$REMOTE_BASE_DIR/current/deploy/scripts/backup-mongo-r2.sh" --reason pre-deploy --incoming-sha "$RELEASE_SHA"`
  - or call a stable script installed under `/opt/cjl/<env>/shared/bin`, so backup does not depend on the incoming release containing the script

Better operational design:

- install backup script under `/opt/cjl/<env>/shared/bin/cjl-mongo-r2-backup`
- version it from repo during deployment
- call the existing installed script before replacing current release
- this avoids depending on broken incoming backup code during critical pre-deploy backup

### 6.3 Backup 3 Hours After Last Commit

Systemd calendar timers alone do not understand "3 hours after last commit". Options:

- GitHub Actions schedules a delayed workflow after successful commit/deploy.
- VM script records last deployed SHA/time and a systemd one-shot timer is created/reset for 3 hours later.
- A periodic VM timer checks whether the last deploy is older than 3 hours and has not yet received a post-delay backup.

Most deterministic VM-centered option:

1. at deploy time, write `/opt/cjl/<env>/shared/backup-state/last-deploy.json`
2. run `systemd-run --on-active=3h --unit=cjl-mongo-r2-backup-after-deploy-<sha> ...`
3. delayed job checks that `<sha>` is still the current release before backing up
4. if a newer release replaced it, skip the old delayed backup

This avoids backing up a superseded commit after a newer deploy.

## 7. Retention Research

### 7.1 Exact Keep-Last-3

R2 lifecycle is age-based and cannot exactly keep the newest 3 objects. Therefore exact keep-last-3 must be implemented in the backup tool/script.

Recommended object key naming:

```text
<env>/mongodb/success/YYYY/MM/YYYYMMDDTHHMMSSZ_<env>_<reason>_<current-sha>_<incoming-sha-or-none>.archive.gz
<env>/mongodb/manifests/YYYY/MM/YYYYMMDDTHHMMSSZ_<env>_<reason>_<current-sha>_<incoming-sha-or-none>.json
```

Keep-last-3 should operate only on successful backup archives, not on in-progress or failed artifacts.

Safer upload flow:

1. create dump locally under `/opt/cjl/<env>/shared/backups/tmp`
2. checksum it locally
3. upload archive to a temporary R2 key under `<env>/mongodb/in-progress/`
4. verify remote object exists and size matches
5. upload manifest under `<env>/mongodb/manifests/`
6. copy or upload final archive key under `<env>/mongodb/success/`
7. delete the temporary in-progress key
8. prune success archives to last 3

If using a single upload only, at minimum ensure the retention cleanup runs only after upload success.

### 7.2 Retention And Bucket Lock

If bucket lock is enabled, deletion may fail until retention expires. Retention and keep-last-3 must be aligned.

Examples:

- no bucket lock: exact keep last 3 can delete immediately
- 3-day bucket lock plus daily backup: cleanup can keep more than 3 until locks expire
- 7-day bucket lock plus multiple deploy backups: R2 may retain many more than 3

Final policy must choose between:

- exact low-count retention
- minimum immutability window
- longer restore window

For production customer data, exact "only 3 backups ever" is operationally fragile if all 3 are taken after data corruption. Consider at least one longer-retention weekly/monthly class before finalizing.

## 8. Security And Secret Handling

Backup artifacts contain sensitive data:

- customer names
- phone numbers
- orders
- ledger history
- admin settings
- notification metadata
- receipt-related source data
- possibly WhatsApp message state and media references if stored in MongoDB/GridFS

Minimum controls for final implementation:

- private R2 bucket
- bucket-scoped R2 token
- separate staging and production buckets/tokens
- no public R2 URL for backup buckets
- root-owned VM backup config files with `0600`
- no secrets printed to GitHub logs or journal logs
- client-side encryption strongly considered
- restore key/password stored outside R2
- backup script emits structured logs without dumping env
- production backup failure blocks destructive deploy reset

Client-side encryption choices:

- `rclone crypt` wrapping the R2 remote
- `age` or `gpg` encryption before upload
- restic repository on R2/S3-compatible storage, if final policy moves toward deduplicated snapshots

Initial pragmatic choice:

- `mongodump --archive --gzip`
- encrypt file locally with `age` or rclone crypt
- upload encrypted object to private R2

Rclone crypt note:

- it encrypts before upload and decrypts after download
- accessing the underlying R2 remote directly returns encrypted content
- preserve the rclone crypt config/password/salt or restores become impossible

Source:

- https://developers.cloudflare.com/r2/reference/data-security/
- https://rclone.org/crypt/

## 9. Operational Verification Requirements

A backup system is not complete until restore is tested.

Minimum acceptance checks for the later implementation:

- daily timer appears in `systemctl list-timers`
- manual backup command creates an R2 object
- backup object has nonzero size
- backup manifest includes:
  - environment
  - reason
  - timestamp UTC
  - timestamp Asia/Jakarta
  - current release SHA
  - incoming release SHA when applicable
  - MongoDB database name
  - dump command version metadata
  - archive size
  - SHA-256 checksum
  - upload target bucket/key
  - script version
- restore drill succeeds into an isolated local or staging MongoDB instance
- restored app boots against restored database
- retain-last-3 cleanup deletes only intended successful backup keys
- cleanup never deletes a backup if the new backup failed
- pre-deploy backup failure blocks production deploy
- backup logs are visible via `journalctl`

Suggested restore drill cadence:

- after initial implementation
- after changing backup script
- before first production rollout using R2 backups
- periodically, for example monthly or before major releases

## 10. Candidate Implementation Shape

This section is intentionally provisional.

### 10.1 Files To Add Later

Potential repo files:

- `deploy/scripts/backup-mongo-r2.sh`
- `deploy/scripts/install-backup-systemd.sh`
- `deploy/systemd/cjl-mongo-r2-backup@.service`
- `deploy/systemd/cjl-mongo-r2-backup@.timer`
- `internals/backupAndRestoreRunbook.md`
- ADR for final backup policy

### 10.2 VM Directories

Potential hosted paths:

```text
/opt/cjl/<env>/shared/backups/tmp
/opt/cjl/<env>/shared/backups/logs
/opt/cjl/<env>/shared/backup-state
/opt/cjl/<env>/shared/rclone/rclone.conf
/opt/cjl/<env>/shared/bin/cjl-mongo-r2-backup
```

### 10.3 Backup Script Behavior

Pseudo-flow:

```bash
main() {
  load_runtime_env
  load_r2_env
  acquire_lock
  resolve_current_release
  create_local_mongodump_archive
  compute_sha256
  upload_to_r2
  verify_remote_object
  upload_manifest
  prune_remote_success_backups_keep_last_3
  cleanup_local_tmp
}
```

Use locking so daily, pre-deploy, and delayed-post-deploy backups cannot run concurrently:

```bash
flock -n /opt/cjl/<env>/shared/backup-state/mongo-r2-backup.lock <backup command>
```

### 10.4 Pre-Deploy Hook Behavior

In production:

- pre-deploy backup should be blocking
- if backup fails, do not run `remote-deploy.sh`
- especially block when deploy reset fingerprint changed

In staging:

- still block by default, unless operators intentionally allow non-blocking staging backups

### 10.5 Final Decision Points

Open decisions before implementation:

- rclone vs AWS CLI vs Node script using AWS SDK
- rclone crypt vs age/gpg vs no client-side encryption
- separate buckets vs prefixes
- exact keep-last-3 vs keep-last-3 plus weekly/monthly retention
- whether deploy-time backups should run for both staging and production
- whether delayed 3-hour backups are based on commit, successful CI, or successful deploy
- whether backup object should include only `${MONGO_DATABASE}` or all app-relevant Mongo databases
- whether backup failure blocks all deploys or only destructive/pre-reset deploys
- alerting channel for backup failure

## 11. Recommended Initial Policy For Later ADR

Recommended starting policy, subject to operator approval:

- Cloudflare:
  - one private R2 bucket per environment
  - Standard storage class
  - bucket-scoped Read/Write token per environment
  - no public bucket or `r2.dev` access
  - no bucket lock for initial exact keep-last-3 policy
- Backup:
  - `mongodump --archive --gzip --oplog`
  - client-side encryption before or during upload
  - one object per successful backup
  - manifest object per backup
- Scheduling:
  - systemd daily timer at 02:00 Asia/Jakarta
  - blocking pre-deploy backup before VM image build/deploy
  - delayed 3-hour post-deploy backup only if the SHA remains current
- Retention:
  - exact keep last 3 successful backups per environment prefix
  - no cleanup if the current backup failed
  - revisit longer retention before production go-live because 3 backups may be too shallow for corruption discovered late
- Verification:
  - mandatory restore drill before production dependence

## 12. Source Index

Cloudflare R2:

- Overview: https://developers.cloudflare.com/r2/
- S3 get started: https://developers.cloudflare.com/r2/get-started/s3/
- S3 API compatibility: https://developers.cloudflare.com/r2/api/s3/api/
- Authentication tokens: https://developers.cloudflare.com/r2/api/s3/tokens
- Create buckets: https://developers.cloudflare.com/r2/buckets/create-buckets/
- Public buckets: https://developers.cloudflare.com/r2/data-access/public-buckets/
- Storage classes: https://developers.cloudflare.com/r2/buckets/storage-classes/
- Pricing: https://developers.cloudflare.com/r2/pricing/
- Object lifecycles: https://developers.cloudflare.com/r2/buckets/object-lifecycles/
- Bucket locks: https://developers.cloudflare.com/r2/buckets/bucket-locks/
- Limits: https://developers.cloudflare.com/r2/platform/limits/
- Data security: https://developers.cloudflare.com/r2/reference/data-security/
- Data location: https://developers.cloudflare.com/r2/reference/data-location/
- Metrics and analytics: https://developers.cloudflare.com/r2/platform/metrics-analytics/
- Rclone example: https://developers.cloudflare.com/r2/examples/rclone/

MongoDB:

- Self-managed backup methods: https://www.mongodb.com/docs/manual/core/backups/
- mongodump: https://www.mongodb.com/docs/database-tools/mongodump/
- mongorestore: https://www.mongodb.com/docs/database-tools/mongorestore/

Scheduling and tool behavior:

- systemd timers: https://www.freedesktop.org/software/systemd/man/devel/systemd.timer.html
- rclone sync: https://rclone.org/commands/rclone_sync/
- rclone crypt: https://rclone.org/crypt/
