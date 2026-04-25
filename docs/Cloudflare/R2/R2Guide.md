# Cloudflare R2 Guide for Production MongoDB Backups

Document status: Active  
Created: 2026-04-25  
Scope: operator guide for provisioning Cloudflare R2 and GitHub secrets for CJ Laundry production MongoDB backups

## 1. What This Guide Configures

This guide configures the Cloudflare and GitHub side of the production MongoDB backup implementation.

The implementation writes unencrypted MongoDB backup archives and manifests to a private Cloudflare R2 bucket through the S3-compatible API.

Current production backup shape:

- environment: production only
- bucket: existing/same private R2 bucket chosen by the operator
- prefix: `production/mongodb`
- S3 endpoint: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- S3 region: `auto`
- GitHub environment: `production`
- VM-rendered config: `/opt/cjl/production/shared/backup.env`

Repo files that consume this setup:

- `.github/workflows/deploy-production.yml`
- `deploy/scripts/backup-mongo-r2.sh`
- `deploy/scripts/install-backup-systemd.sh`
- `deploy/env/backup.production.env.example`
- `docs/adr/0029-production-mongodb-r2-backups-and-no-deploy-reset.md`

Sources:

- Cloudflare R2 S3 guide: https://developers.cloudflare.com/r2/get-started/s3/
- Cloudflare R2 S3 API: https://developers.cloudflare.com/r2/api/s3/api/
- Cloudflare R2 authentication: https://developers.cloudflare.com/r2/api/s3/tokens/
- Cloudflare R2 public buckets: https://developers.cloudflare.com/r2/data-access/public-buckets/

## 2. Required GitHub Secrets

Add these secrets to the GitHub `production` environment:

| GitHub secret | Value source | Rendered VM env |
| --- | --- | --- |
| `PRODUCTION_R2_ACCOUNT_ID` | Cloudflare account ID | `R2_ACCOUNT_ID` |
| `PRODUCTION_R2_BUCKET` | R2 bucket name | `R2_BUCKET` |
| `PRODUCTION_R2_ACCESS_KEY_ID` | R2 S3 API token creation result | `R2_ACCESS_KEY_ID` |
| `PRODUCTION_R2_SECRET_ACCESS_KEY` | R2 S3 API token creation result | `R2_SECRET_ACCESS_KEY` |

The workflow also renders:

```text
R2_PREFIX=production/mongodb
```

Do not add staging R2 backup secrets. Backups are production-only.

## 3. Cloudflare Manual Setup

### 3.1 Open R2

1. Log in to Cloudflare Dashboard.
2. Select the Cloudflare account that owns CJ Laundry infrastructure.
3. Open `R2 Object Storage`.
4. Confirm R2 is enabled for the account.

### 3.2 Create Or Choose The Bucket

Use the same private bucket intended for production backups.

Recommended bucket naming if creating a new one:

```text
cjlaundry-production-backups
```

Bucket requirements:

- lowercase letters, numbers, and hyphens only
- private bucket
- no public development URL
- no public custom domain
- Standard storage class unless a later ADR changes this

Manual dashboard path:

1. R2 Object Storage
2. Create bucket
3. Enter bucket name
4. Leave public access disabled
5. Create

Save the bucket name as:

```text
PRODUCTION_R2_BUCKET
```

### 3.3 Find The Account ID

Cloudflare account ID is needed for the S3 endpoint.

Common places to find it:

- R2 overview page
- the S3 API endpoint shown after creating an R2 API token
- Cloudflare dashboard URL/account context

The endpoint must have this shape:

```text
https://<ACCOUNT_ID>.r2.cloudflarestorage.com
```

Save only the account ID portion as:

```text
PRODUCTION_R2_ACCOUNT_ID
```

Do not save the full endpoint URL in GitHub secrets for this implementation.

### 3.4 Create The R2 S3 API Token

Create an R2 token for S3-compatible clients.

Manual dashboard path:

1. R2 Object Storage
2. Manage R2 API tokens / S3 API Tokens
3. Create API token
4. Choose Object Read & Write permission
5. Scope it to the production backup bucket if Cloudflare offers bucket scoping in the dashboard
6. Create token

Cloudflare may show the S3 credentials directly after token creation:

- Access Key ID
- Secret Access Key

Save them immediately. The secret access key is shown only at creation time.

Map them to GitHub:

```text
PRODUCTION_R2_ACCESS_KEY_ID=<Access Key ID>
PRODUCTION_R2_SECRET_ACCESS_KEY=<Secret Access Key>
```

If the Cloudflare UI or API response shows an R2 API token `id` and raw token `value` instead, derive the S3 credentials this way:

```text
PRODUCTION_R2_ACCESS_KEY_ID=<token id>
PRODUCTION_R2_SECRET_ACCESS_KEY=<sha256(token value)>
```

Cloudflare documents this mapping for R2 API tokens:

- Access Key ID: the `id` of the API token
- Secret Access Key: the SHA-256 hash of the API token `value`

Hash the raw token value exactly, with no trailing newline.

PowerShell:

```powershell
$token = "paste-token-value-here"
$sha256 = [System.Security.Cryptography.SHA256]::Create()
$bytes = [System.Text.Encoding]::UTF8.GetBytes($token)
$hash = $sha256.ComputeHash($bytes)
-join ($hash | ForEach-Object { $_.ToString("x2") })
$sha256.Dispose()
```

Git Bash / Linux:

```bash
printf '%s' 'paste-token-value-here' | sha256sum | awk '{print $1}'
```

Do not use the Cloudflare Global API Key. This implementation needs R2 S3 credentials, not the account global key.

### 3.5 Confirm Public Access Is Disabled

For the backup bucket:

- do not enable `r2.dev`
- do not add a public custom domain
- do not create public bucket rules
- do not publish backup object URLs

Backups contain customer names, phone numbers, orders, ledger data, notification state, and admin settings. Treat R2 object access as production database access.

### 3.6 Lifecycle And Bucket Lock

Do not configure Cloudflare lifecycle deletion as the primary retention mechanism for this implementation.

Reason:

- R2 lifecycle is age-based.
- CJ Laundry retention is rule-based: under 72 hours, newest daily, and two commit-boundary dailies.
- The app's retention script handles the exact policy after successful daily backups.

Do not enable bucket lock unless the retention policy is revisited. Bucket lock can intentionally block deletes, which may make the backup script keep more objects than expected.

## 4. GitHub Manual Setup

### 4.1 Open Production Environment Secrets

1. Open the GitHub repository.
2. Go to `Settings`.
3. Open `Environments`.
4. Select `production`.
5. Open `Environment secrets`.

### 4.2 Add Secrets

Add:

```text
PRODUCTION_R2_ACCOUNT_ID
PRODUCTION_R2_BUCKET
PRODUCTION_R2_ACCESS_KEY_ID
PRODUCTION_R2_SECRET_ACCESS_KEY
```

Recommended checks:

- no leading/trailing spaces
- bucket name exactly matches Cloudflare
- account ID is not the endpoint URL
- account ID is only the 32-character hex value, for example `ec02f3445a2be8d8a9d43824f8a59a1f`
- bucket is only the bucket name, for example `cjlaundry-production-backups`, not `https://...r2.cloudflarestorage.com/cjlaundry-production-backups`
- access key and secret access key are from an R2 S3 API token
- access key ID is 32 characters; if Cloudflare reports `Credential access key has length 53, should be 32`, `PRODUCTION_R2_ACCESS_KEY_ID` contains the wrong value
- secret access key is not a Cloudflare API token string or global API key
- when using a Cloudflare token `id` and raw token `value`, the secret access key is the 64-character SHA-256 hex hash of the raw token value

### 4.3 What The Workflow Does With These Secrets

During production deploy, `.github/workflows/deploy-production.yml`:

1. validates the four `PRODUCTION_R2_*` secrets are non-empty
2. renders `backup.env`
3. uploads it to `/opt/cjl/production/shared/backup.env`
4. runs a blocking pre-deploy backup before `remote-deploy.sh`
5. records delayed post-deploy backup state after smoke checks and readiness validation

The rendered VM file looks like:

```text
R2_ACCOUNT_ID=<account-id>
R2_BUCKET=<bucket-name>
R2_ACCESS_KEY_ID=<access-key-id>
R2_SECRET_ACCESS_KEY=<secret-access-key>
R2_PREFIX=production/mongodb
```

The workflow uploads it with:

```bash
umask 077 && cat > /opt/cjl/production/shared/backup.env
```

## 5. Production VM Timer Setup

The production VM already has `/opt/cjl/production/shared` from bootstrap. Do not rerun or modify `bootstrap-vm.sh` for backups.

Timer installation is automatic during production deploy.

The production workflow runs:

```bash
bash /opt/cjl/production/releases/<sha>/deploy/scripts/ensure-backup-systemd.sh \
  production \
  <deploy-user> \
  /opt/cjl/production/releases/<sha>/deploy/scripts/install-backup-systemd.sh
```

The ensure script:

1. checks whether both backup timers are already enabled and active
2. installs them only when missing
3. uses root if already root
4. uses passwordless sudo if available
5. otherwise uses Docker host namespace access, which works with the Docker-group permission granted by `bootstrap-vm.sh`

This is why no manual production SSH is required for normal rollout.

The installer still supports manual recovery if needed:

```bash
sudo bash /opt/cjl/production/releases/<backup-capable-sha>/deploy/scripts/install-backup-systemd.sh production cjl-production-deploy
```

The installer creates backup-specific subdirectories under the existing shared directory:

```text
/opt/cjl/production/shared/backups
/opt/cjl/production/shared/backups/tmp
/opt/cjl/production/shared/backup-state
/opt/cjl/production/shared/bin
```

It also copies stable backup scripts into:

```text
/opt/cjl/production/shared/bin/cjl-mongo-r2-backup
/opt/cjl/production/shared/bin/backup-retention.mjs
```

It installs and enables:

```text
cjl-mongo-r2-backup@production.timer
cjl-mongo-r2-delayed-backup@production.timer
```

Confirm:

```bash
systemctl list-timers 'cjl-mongo-r2-*'
systemctl status cjl-mongo-r2-backup@production.timer
systemctl status cjl-mongo-r2-delayed-backup@production.timer
```

## 6. Manual Backup Check

Run this from the production VM after `runtime.env` and `backup.env` exist:

```bash
bash /opt/cjl/production/current/deploy/scripts/backup-mongo-r2.sh \
  backup production \
  /opt/cjl/production \
  /opt/cjl/production/shared/runtime.env \
  /opt/cjl/production/shared/backup.env \
  daily none
```

Expected behavior:

- creates a temporary archive under `/opt/cjl/production/shared/backups/tmp`
- uploads archive to `production/mongodb/in-progress/...`
- uploads manifest to `production/mongodb/manifests/...`
- uploads final archive to `production/mongodb/success/...`
- removes the in-progress object best-effort
- runs retention because the reason is `daily`
- logs Docker Compose service status, MongoDB container health, host/container MongoDB data directory usage, logical MongoDB database stats, local archive size/hash, and final R2 object size

Check logs:

```bash
journalctl -u cjl-mongo-r2-backup@production.service -n 200 --no-pager
```

For a manual shell run, read the command output directly.

## 7. Expected R2 Objects

After a successful backup, Cloudflare R2 should show keys similar to:

```text
production/mongodb/success/2026/04/20260425T190000Z_production_daily_<current-sha>_none.archive.gz
production/mongodb/manifests/2026/04/20260425T190000Z_production_daily_<current-sha>_none.json
```

The manifest records:

- environment
- reason
- UTC timestamp
- Asia/Jakarta timestamp
- current release SHA
- incoming release SHA when applicable
- archive size
- archive SHA-256
- R2 bucket/key
- dump mode
- script version

## 8. Restore Drill Requirement

This implementation does not automate restore.

Before relying on production backups, run an isolated restore drill:

1. Download one `.archive.gz` backup object from R2.
2. Start an isolated MongoDB instance, not production.
3. Run:

   ```bash
   mongorestore --archive=<backup>.archive.gz --gzip --oplogReplay
   ```

4. Point an isolated app/runtime at the restored database if practical.
5. Confirm expected collections and documents exist.
6. Record the restore drill date and result in production readiness notes.

Never run restore into production unless an operator has intentionally chosen a production data recovery path.

## 9. Troubleshooting

### Production deploy fails at `Validate R2 backup secrets`

At least one required GitHub production secret is blank.

Check:

- `PRODUCTION_R2_ACCOUNT_ID`
- `PRODUCTION_R2_BUCKET`
- `PRODUCTION_R2_ACCESS_KEY_ID`
- `PRODUCTION_R2_SECRET_ACCESS_KEY`

### Pre-deploy backup fails before image build

This blocks production deploy by design.

Check:

- production MongoDB is running and healthy
- `/opt/cjl/production/current` exists, unless this is the first deploy
- `/opt/cjl/production/shared/runtime.env` exists
- `/opt/cjl/production/shared/backup.env` exists
- Docker can pull/run `rclone/rclone:1.68`
- R2 credentials are correct
- bucket name is correct
- VM has enough disk space under `/opt/cjl/production/shared/backups/tmp`

### R2 upload is unauthorized

Likely causes:

- Access Key ID or Secret Access Key copied incorrectly
- Access Key ID is the raw token value instead of the token `id`
- token is not an R2 S3 API token
- token lacks Object Read & Write
- token is scoped to a different bucket
- account ID is wrong

### R2 upload fails with `HeadObject ... 400 BadRequest` or `ListObjectsV2 ... InvalidArgument`

This usually means the R2 S3 endpoint or credentials are shaped incorrectly, even if MongoDB backup creation succeeded.

Check the GitHub production secrets:

```text
PRODUCTION_R2_ACCOUNT_ID=ec02f3445a2be8d8a9d43824f8a59a1f
PRODUCTION_R2_BUCKET=cjlaundry-production-backups
PRODUCTION_R2_ACCESS_KEY_ID=<32-character Cloudflare token id / R2 S3 access key id>
PRODUCTION_R2_SECRET_ACCESS_KEY=<64-character sha256 hex of token value / R2 S3 secret access key>
```

If the error says:

```text
Credential access key has length 53, should be 32
```

then `PRODUCTION_R2_ACCESS_KEY_ID` is not the R2 access key ID. Use the 32-character token `id` value instead.

Do not use these values:

```text
PRODUCTION_R2_ACCOUNT_ID=https://ec02f3445a2be8d8a9d43824f8a59a1f.r2.cloudflarestorage.com
PRODUCTION_R2_BUCKET=https://ec02f3445a2be8d8a9d43824f8a59a1f.r2.cloudflarestorage.com/cjlaundry-production-backups
PRODUCTION_R2_ACCESS_KEY_ID=<raw Cloudflare bearer token value>
PRODUCTION_R2_SECRET_ACCESS_KEY=<raw Cloudflare bearer token value>
```

The backup script validates these common mistakes before `mongodump` starts and performs an R2 access preflight before creating the local archive.

### Timer does not run

Check:

```bash
systemctl list-timers 'cjl-mongo-r2-*'
systemctl status cjl-mongo-r2-backup@production.timer
systemctl status cjl-mongo-r2-delayed-backup@production.timer
journalctl -u cjl-mongo-r2-backup@production.service -n 200 --no-pager
journalctl -u cjl-mongo-r2-delayed-backup@production.service -n 200 --no-pager
ls -la /opt/cjl/production/shared/bin
```

### Delayed backup is skipped

This is expected if another production deploy became current before the 3-hour delay elapsed.

Check:

```bash
cat /opt/cjl/production/shared/backup-state/delayed-post-deploy.json
cat /opt/cjl/production/current_release
```

## 10. Operator Checklist

Cloudflare:

- R2 enabled
- private production backup bucket exists
- public access disabled
- no `r2.dev` access
- S3 API token created
- Access Key ID copied, or derived from token `id`
- Secret Access Key copied, or derived as SHA-256 of token `value`
- Account ID copied

GitHub:

- `PRODUCTION_R2_ACCOUNT_ID` set
- `PRODUCTION_R2_BUCKET` set
- `PRODUCTION_R2_ACCESS_KEY_ID` set
- `PRODUCTION_R2_SECRET_ACCESS_KEY` set
- staging has no R2 backup secrets unless a future ADR changes production-only scope

Production VM:

- backup-capable release deployed
- `/opt/cjl/production/shared/backup.env` rendered by workflow
- systemd timers installed automatically by workflow
- timers visible in `systemctl list-timers`
- manual backup completed
- isolated restore drill completed

## 11. Values Reference

Use this table when copying values:

| Need | Where to get it | Where to put it |
| --- | --- | --- |
| Account ID | Cloudflare account / R2 S3 endpoint | `PRODUCTION_R2_ACCOUNT_ID` |
| Bucket name | R2 bucket list/details | `PRODUCTION_R2_BUCKET` |
| Access Key ID | R2 S3 credential screen, or token `id` | `PRODUCTION_R2_ACCESS_KEY_ID` |
| Secret Access Key | R2 S3 credential screen, or SHA-256 hash of token `value` | `PRODUCTION_R2_SECRET_ACCESS_KEY` |
| S3 endpoint | Derived from account ID | not stored; script builds it |
| Region | Cloudflare R2 docs | fixed as `auto` in script |
| Prefix | Project decision | fixed as `production/mongodb` |
