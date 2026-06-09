#!/usr/bin/env bash
set -euo pipefail

MONGO_IMAGE="${MONGO_IMAGE:-mongo:7}"
RCLONE_IMAGE="${RCLONE_IMAGE:-rclone/rclone:1.68}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm-slim}"
BACKUP_PREFIX_DEFAULT="production/mongodb"
BACKUP_MIN_CUSTOMERS="${BACKUP_MIN_CUSTOMERS:-100}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RETENTION_SCRIPT="${RETENTION_SCRIPT:-${SCRIPT_DIR}/backup-retention.mjs}"
CATALOG_SCRIPT="${CATALOG_SCRIPT:-${SCRIPT_DIR}/backup-catalog.mjs}"

usage() {
  cat <<'EOF'
Usage:
  backup-mongo-r2.sh backup <production> <base-dir> <runtime-env> <backup-env> <daily|pre-deploy|post-deploy|pre-restore> [incoming-sha] [expected-current-sha]
  backup-mongo-r2.sh restore-latest <production> <base-dir> <runtime-env> <backup-env>
  backup-mongo-r2.sh record-delayed <base-dir> <release-sha>
  backup-mongo-r2.sh run-due-delayed <production> <base-dir> <runtime-env> <backup-env>

Production backups are unencrypted mongodump archive+gzip+oplog artifacts uploaded to Cloudflare R2.
Production restore downloads the latest successful R2 backup and restores the app database namespace with mongorestore --oplogReplay --drop.
EOF
}

require_file() {
  local path="$1"
  local label="$2"
  if [[ ! -f "${path}" ]]; then
    echo "${label} not found: ${path}" >&2
    exit 1
  fi
}

load_env_file() {
  local path="$1"
  set -a
  # shellcheck source=/dev/null
  source "${path}"
  set +a
}

require_var() {
  local name="$1"
  local value="${!name:-}"
  if [[ -z "${value// }" ]]; then
    echo "Missing required environment value: ${name}" >&2
    exit 1
  fi
}

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  printf '%s' "${value}"
}

log_section() {
  echo
  echo "== $1 =="
}

human_bytes() {
  local bytes="$1"
  if command -v numfmt >/dev/null 2>&1; then
    numfmt --to=iec-i --suffix=B "${bytes}" 2>/dev/null || printf '%s bytes' "${bytes}"
  else
    printf '%s bytes' "${bytes}"
  fi
}

compose() {
  docker compose \
    --project-name "cjl-${APP_ENV}" \
    --project-directory "${RELEASE_DIR}" \
    --env-file "${RUNTIME_ENV_FILE}" \
    -f "${COMPOSE_FILE}" \
    "$@"
}

wait_for_service() {
  local service="$1"
  local timeout_seconds="${2:-180}"
  local started_at
  local container_id
  local status

  started_at="$(date +%s)"

  while true; do
    container_id="$(compose ps -q "${service}" 2>/dev/null || true)"

    if [[ -n "${container_id}" ]]; then
      status="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "${container_id}" 2>/dev/null || true)"

      case "${status}" in
        healthy|running)
          echo "Service ${service} is ${status}."
          return 0
          ;;
        unhealthy|exited|dead)
          echo "Service ${service} entered bad state: ${status}" >&2
          docker logs "${container_id}" --tail 100 >&2 || true
          return 1
          ;;
      esac
    fi

    if (( "$(date +%s)" - started_at >= timeout_seconds )); then
      echo "Timed out waiting for ${service} to become ready." >&2
      if [[ -n "${container_id}" ]]; then
        docker logs "${container_id}" --tail 100 >&2 || true
      fi
      return 1
    fi

    sleep 5
  done
}

acquire_backup_lock() {
  local lock_file="${BASE_DIR}/shared/backup-state/mongo-r2-backup.lock"
  mkdir -p "${BASE_DIR}/shared/backup-state"

  exec 9>"${lock_file}"
  if ! flock -n 9; then
    echo "Another production MongoDB backup or restore is already running." >&2
    exit 1
  fi
}

rclone_env_args() {
  printf '%s\0' \
    -e RCLONE_CONFIG_R2_TYPE=s3 \
    -e RCLONE_CONFIG_R2_PROVIDER=Cloudflare \
    -e "RCLONE_CONFIG_R2_ACCESS_KEY_ID=${R2_ACCESS_KEY_ID}" \
    -e "RCLONE_CONFIG_R2_SECRET_ACCESS_KEY=${R2_SECRET_ACCESS_KEY}" \
    -e "RCLONE_CONFIG_R2_ENDPOINT=https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    -e RCLONE_CONFIG_R2_REGION=auto \
    -e RCLONE_CONFIG_R2_ACL=private \
    -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
}

rclone() {
  local env_args=()
  while IFS= read -r -d '' item; do
    env_args+=("${item}")
  done < <(rclone_env_args)

  local volume_args=()
  if [[ -n "${TMP_DIR:-}" ]]; then
    volume_args=(-v "${TMP_DIR}:/data")
  fi

  docker run --rm \
    "${env_args[@]}" \
    "${volume_args[@]}" \
    "${RCLONE_IMAGE}" \
    "$@"
}

validate_r2_config() {
  if [[ "${R2_ACCOUNT_ID}" == http://* || "${R2_ACCOUNT_ID}" == https://* || "${R2_ACCOUNT_ID}" == */* ]]; then
    echo "R2_ACCOUNT_ID must be only the 32-character Cloudflare account ID, not the R2 endpoint URL." >&2
    exit 1
  fi

  if [[ ! "${R2_ACCOUNT_ID}" =~ ^[A-Fa-f0-9]{32}$ ]]; then
    echo "R2_ACCOUNT_ID must be the 32-character hexadecimal Cloudflare account ID." >&2
    exit 1
  fi

  if [[ "${R2_BUCKET}" == http://* || "${R2_BUCKET}" == https://* || "${R2_BUCKET}" == */* ]]; then
    echo "R2_BUCKET must be only the bucket name, not an R2 URL or path." >&2
    exit 1
  fi

  if [[ ! "${R2_BUCKET}" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]]; then
    echo "R2_BUCKET must be a valid bucket name, for example cjlaundry-production-backups." >&2
    exit 1
  fi

  if [[ "${R2_ACCESS_KEY_ID}" == http://* || "${R2_ACCESS_KEY_ID}" == https://* || "${R2_ACCESS_KEY_ID}" == */* ]]; then
    echo "R2_ACCESS_KEY_ID must be the R2 S3 access key ID or Cloudflare token id, not a URL or path." >&2
    exit 1
  fi

  if [[ "${#R2_ACCESS_KEY_ID}" -ne 32 ]]; then
    echo "R2_ACCESS_KEY_ID must be 32 characters. Cloudflare R2 rejects other lengths." >&2
    echo "Use the token id, not the raw token value, as R2_ACCESS_KEY_ID." >&2
    exit 1
  fi

  if [[ "${R2_SECRET_ACCESS_KEY}" == http://* || "${R2_SECRET_ACCESS_KEY}" == https://* ]]; then
    echo "R2_SECRET_ACCESS_KEY must be the R2 S3 secret access key, not a URL." >&2
    exit 1
  fi

  if [[ ! "${R2_SECRET_ACCESS_KEY}" =~ ^[A-Fa-f0-9]{64}$ ]]; then
    echo "R2_SECRET_ACCESS_KEY must be a 64-character SHA-256 hex value when using a Cloudflare R2 API token." >&2
    echo "Use the token id as R2_ACCESS_KEY_ID and sha256(token value) as R2_SECRET_ACCESS_KEY." >&2
    exit 1
  fi
}

r2_preflight() {
  echo "Checking production R2 backup target."
  if ! rclone lsd "r2:${R2_BUCKET}" >/dev/null; then
    echo "Unable to access R2 bucket '${R2_BUCKET}' through endpoint https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com." >&2
    echo "Check that R2_ACCOUNT_ID is not the full endpoint URL, R2_BUCKET is only the bucket name, and the access key/secret are R2 S3 credentials." >&2
    exit 1
  fi
  echo "R2 preflight succeeded for bucket=${R2_BUCKET} prefix=${R2_PREFIX}."
}

current_release_sha() {
  if [[ -f "${BASE_DIR}/current_release" ]]; then
    cat "${BASE_DIR}/current_release"
  fi
}

ensure_production() {
  if [[ "${APP_ENV}" != "production" ]]; then
    echo "MongoDB R2 backups are production-only; got APP_ENV=${APP_ENV}" >&2
    exit 1
  fi
}

write_delayed_state() {
  local base_dir="$1"
  local release_sha="$2"
  local state_dir="${base_dir}/shared/backup-state"
  local due_epoch

  mkdir -p "${state_dir}"
  due_epoch="$(( $(date -u +%s) + 10800 ))"

  cat > "${state_dir}/delayed-post-deploy.json" <<EOF
{
  "releaseSha": "$(json_escape "${release_sha}")",
  "dueEpoch": ${due_epoch},
  "status": "pending",
  "recordedAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

run_due_delayed_backup() {
  local state_file="${BASE_DIR}/shared/backup-state/delayed-post-deploy.json"
  if [[ ! -f "${state_file}" ]]; then
    echo "No delayed post-deploy backup is pending."
    return 0
  fi

  local values_file="${BASE_DIR}/shared/backup-state/delayed-post-deploy.values"
  docker run --rm \
    -v "${BASE_DIR}/shared/backup-state:/state" \
    "${NODE_IMAGE}" \
    node -e "const fs=require('fs'); const s=JSON.parse(fs.readFileSync('/state/delayed-post-deploy.json','utf8')); console.log([s.releaseSha||'', s.dueEpoch||0, s.status||''].join('\n'))" \
    > "${values_file}"

  local release_sha due_epoch status now_epoch
  release_sha="$(sed -n '1p' "${values_file}")"
  due_epoch="$(sed -n '2p' "${values_file}")"
  status="$(sed -n '3p' "${values_file}")"
  now_epoch="$(date -u +%s)"

  if [[ "${status}" != "pending" ]]; then
    echo "Delayed post-deploy backup state is ${status}; nothing to run."
    return 0
  fi

  if (( now_epoch < due_epoch )); then
    echo "Delayed post-deploy backup is not due yet."
    return 0
  fi

  local current_sha
  current_sha="$(current_release_sha)"
  if [[ "${current_sha}" != "${release_sha}" ]]; then
    cat > "${state_file}" <<EOF
{
  "releaseSha": "$(json_escape "${release_sha}")",
  "dueEpoch": ${due_epoch},
  "status": "skipped-superseded",
  "currentReleaseSha": "$(json_escape "${current_sha}")",
  "updatedAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    echo "Skipping delayed backup for ${release_sha}; current release is ${current_sha}."
    return 0
  fi

  run_backup "post-deploy" "none" "${release_sha}"

  cat > "${state_file}" <<EOF
{
  "releaseSha": "$(json_escape "${release_sha}")",
  "dueEpoch": ${due_epoch},
  "status": "completed",
  "updatedAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
}

prepare_runtime() {
  require_file "${RUNTIME_ENV_FILE}" "Runtime env"
  require_file "${BACKUP_ENV_FILE}" "Backup env"
  load_env_file "${RUNTIME_ENV_FILE}"
  load_env_file "${BACKUP_ENV_FILE}"

  require_var MONGO_ROOT_USERNAME
  require_var MONGO_ROOT_PASSWORD
  require_var MONGO_DATABASE
  require_var R2_ACCOUNT_ID
  require_var R2_BUCKET
  require_var R2_ACCESS_KEY_ID
  require_var R2_SECRET_ACCESS_KEY
  require_file "${CATALOG_SCRIPT}" "Backup catalog script"
  validate_r2_config

  if [[ ! "${BACKUP_MIN_CUSTOMERS}" =~ ^[0-9]+$ ]]; then
    echo "BACKUP_MIN_CUSTOMERS must be a non-negative integer." >&2
    exit 1
  fi

  R2_PREFIX="${R2_PREFIX:-${BACKUP_PREFIX_DEFAULT}}"
  RELEASE_DIR="${BASE_DIR}/current"
  if [[ -L "${RELEASE_DIR}" || -d "${RELEASE_DIR}" ]]; then
    RELEASE_DIR="$(readlink -f "${RELEASE_DIR}")"
  elif [[ -f "${BASE_DIR}/current_release" ]]; then
    RELEASE_DIR="${BASE_DIR}/releases/$(cat "${BASE_DIR}/current_release")"
  fi

  COMPOSE_FILE="${RELEASE_DIR}/deploy/api/docker-compose.remote.yml"
  require_file "${COMPOSE_FILE}" "Compose file"
}

log_compose_status() {
  log_section "Docker Compose service status"
  compose ps || true

  log_section "Docker container status for project cjl-${APP_ENV}"
  docker ps \
    --filter "label=com.docker.compose.project=cjl-${APP_ENV}" \
    --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true
}

log_mongo_container_status() {
  local mongo_container="$1"

  log_section "MongoDB container status"
  docker inspect \
    --format 'name={{.Name}} status={{.State.Status}} running={{.State.Running}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}n/a{{end}} startedAt={{.State.StartedAt}} restartCount={{.RestartCount}}' \
    "${mongo_container}" || true

  echo "Recent MongoDB container logs:"
  docker logs --tail 20 "${mongo_container}" 2>&1 || true
}

log_mongo_storage_usage() {
  local mongo_container="$1"
  local mongo_data_dir="${BASE_DIR}/shared/mongo-data"

  log_section "MongoDB storage usage"
  if [[ -d "${mongo_data_dir}" ]]; then
    echo "Host MongoDB data directory: ${mongo_data_dir}"
    du -sh "${mongo_data_dir}" 2>/dev/null || true
    df -h "${mongo_data_dir}" 2>/dev/null || true
  else
    echo "Host MongoDB data directory not found: ${mongo_data_dir}"
  fi

  echo "MongoDB /data/db usage inside container:"
  docker exec "${mongo_container}" sh -lc 'du -sh /data/db 2>/dev/null || true; df -h /data/db 2>/dev/null || true' || true
}

log_mongo_database_stats() {
  log_section "MongoDB logical database stats"
  compose exec -T mongo mongosh \
    --quiet \
    "mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/admin?authSource=admin&replicaSet=rs0" \
    --eval '
const names = db.adminCommand({ listDatabases: 1 }).databases.map((database) => database.name).sort();
for (const name of names) {
  const stats = db.getSiblingDB(name).stats(1024 * 1024);
  print(`${name}: collections=${stats.collections} objects=${stats.objects} dataSizeMiB=${stats.dataSize.toFixed(2)} storageSizeMiB=${stats.storageSize.toFixed(2)} indexSizeMiB=${stats.indexSize.toFixed(2)}`);
}
' || true
}

mongo_customer_count() {
  compose exec -T \
    -e "TARGET_MONGO_DATABASE=${MONGO_DATABASE}" \
    mongo mongosh \
    --quiet \
    "mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/admin?authSource=admin&replicaSet=rs0" \
    --eval 'print(db.getSiblingDB(process.env.TARGET_MONGO_DATABASE).getCollection("customers").countDocuments({}))' \
    | tail -n 1 \
    | tr -d '[:space:]'
}

backup_threshold_allows_upload() {
  local customer_count
  customer_count="$(mongo_customer_count)"

  if [[ ! "${customer_count}" =~ ^[0-9]+$ ]]; then
    echo "Unable to read MongoDB customer count for ${MONGO_DATABASE}.customers: ${customer_count}" >&2
    exit 1
  fi

  echo "Backup customer threshold: customerCount=${customer_count} minimum=${BACKUP_MIN_CUSTOMERS}."
  if (( customer_count < BACKUP_MIN_CUSTOMERS )); then
    echo "Skipping ${REASON} backup because ${MONGO_DATABASE}.customers has ${customer_count} customers, below BACKUP_MIN_CUSTOMERS=${BACKUP_MIN_CUSTOMERS}."
    return 1
  fi

  return 0
}

log_backup_inputs() {
  log_section "Backup execution context"
  echo "environment=${APP_ENV}"
  echo "reason=${REASON}"
  echo "currentReleaseSha=${CURRENT_SHA:-none}"
  echo "incomingReleaseSha=${INCOMING_SHA:-none}"
  echo "expectedCurrentReleaseSha=${EXPECTED_CURRENT_SHA:-none}"
  echo "releaseDir=${RELEASE_DIR}"
  echo "composeFile=${COMPOSE_FILE}"
  echo "r2Bucket=${R2_BUCKET}"
  echo "r2Prefix=${R2_PREFIX}"
}

log_local_archive_metadata() {
  local archive_path="$1"
  local manifest_path="$2"

  log_section "Local backup artifact"
  echo "archiveName=${ARCHIVE_NAME}"
  echo "archivePath=${archive_path}"
  echo "archiveSizeBytes=${ARCHIVE_SIZE}"
  echo "archiveSizeHuman=$(human_bytes "${ARCHIVE_SIZE}")"
  echo "archiveSha256=${ARCHIVE_SHA256}"
  echo "manifestPath=${manifest_path}"
  wc -c "${manifest_path}" | awk '{print "manifestSizeBytes="$1}'
  du -h "${archive_path}" "${manifest_path}" 2>/dev/null || true
}

log_r2_object_metadata() {
  local archive_key="$1"
  local manifest_key="$2"

  log_section "R2 backup artifact"
  echo "archiveKey=${archive_key}"
  rclone lsl "r2:${R2_BUCKET}/${archive_key}" || true
  rclone size --json "r2:${R2_BUCKET}/${archive_key}" || true
  echo "manifestKey=${manifest_key}"
  rclone lsl "r2:${R2_BUCKET}/${manifest_key}" || true
  rclone size --json "r2:${R2_BUCKET}/${manifest_key}" || true
}

create_manifest() {
  local path="$1"
  local archive_key="$2"
  local manifest_key="$3"

  cat > "${path}" <<EOF
{
  "environment": "production",
  "reason": "$(json_escape "${REASON}")",
  "createdAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "createdAtAsiaJakarta": "$(TZ=Asia/Jakarta date +%Y-%m-%dT%H:%M:%S%z)",
  "currentReleaseSha": "$(json_escape "${CURRENT_SHA}")",
  "incomingReleaseSha": "$(json_escape "${INCOMING_SHA}")",
  "expectedCurrentReleaseSha": "$(json_escape "${EXPECTED_CURRENT_SHA}")",
  "mongoDump": {
    "image": "$(json_escape "${MONGO_IMAGE}")",
    "archive": true,
    "gzip": true,
    "oplog": true,
    "scope": "full-instance"
  },
  "archive": {
    "fileName": "$(json_escape "${ARCHIVE_NAME}")",
    "sizeBytes": ${ARCHIVE_SIZE},
    "sha256": "$(json_escape "${ARCHIVE_SHA256}")"
  },
  "r2": {
    "bucket": "$(json_escape "${R2_BUCKET}")",
    "archiveKey": "$(json_escape "${archive_key}")",
    "manifestKey": "$(json_escape "${manifest_key}")"
  },
  "scriptVersion": 1
}
EOF
}

run_retention_after_daily() {
  if [[ "${REASON}" != "daily" ]]; then
    return 0
  fi

  echo "Planning production backup retention."
  local list_file="${TMP_DIR}/archive-keys.txt"
  local inventory_file="${TMP_DIR}/retention-input.json"
  local plan_file="${TMP_DIR}/retention-plan.json"
  local delete_archives_file="${TMP_DIR}/delete-archives.txt"
  local delete_manifests_file="${TMP_DIR}/delete-manifests.txt"

  if ! rclone lsf --recursive --files-only "r2:${R2_BUCKET}/${R2_PREFIX}/success" > "${list_file}"; then
    echo "No existing successful backups found for retention."
    return 0
  fi

  docker run --rm \
    -e "R2_PREFIX=${R2_PREFIX}" \
    -v "${TMP_DIR}:/data" \
    "${NODE_IMAGE}" \
    node -e "const fs=require('fs'); const keys=fs.readFileSync('/data/archive-keys.txt','utf8').split(/\r?\n/).filter(Boolean).map((key)=>process.env.R2_PREFIX + '/success/' + key); fs.writeFileSync('/data/retention-input.json', JSON.stringify({ archiveKeys: keys, nowIso: new Date().toISOString() }));"

  docker run --rm \
    -v "${RETENTION_SCRIPT}:/backup-retention.mjs:ro" \
    -v "${CATALOG_SCRIPT}:/backup-catalog.mjs:ro" \
    -v "${TMP_DIR}:/data" \
    "${NODE_IMAGE}" \
    node /backup-retention.mjs /data/retention-input.json \
    > "${plan_file}"

  docker run --rm \
    -v "${TMP_DIR}:/data" \
    "${NODE_IMAGE}" \
    node -e "const fs=require('fs'); const p=JSON.parse(fs.readFileSync('/data/retention-plan.json','utf8')); fs.writeFileSync('/data/delete-archives.txt', p.deleteArchiveKeys.join('\n')); fs.writeFileSync('/data/delete-manifests.txt', p.deleteManifestKeys.join('\n'));"

  while IFS= read -r key; do
    [[ -z "${key}" ]] && continue
    echo "Deleting old production backup archive: ${key}"
    rclone deletefile "r2:${R2_BUCKET}/${key}"
  done < "${delete_archives_file}"

  while IFS= read -r key; do
    [[ -z "${key}" ]] && continue
    echo "Deleting old production backup manifest: ${key}"
    rclone deletefile "r2:${R2_BUCKET}/${key}" || true
  done < "${delete_manifests_file}"
}

select_latest_restore_backup() {
  local list_file="${TMP_DIR}/restore-archive-list.txt"
  local values_file="${TMP_DIR}/restore-selection.values"

  if ! rclone lsf --recursive --files-only "r2:${R2_BUCKET}/${R2_PREFIX}/success" > "${list_file}"; then
    echo "Unable to list successful production backups in r2:${R2_BUCKET}/${R2_PREFIX}/success." >&2
    exit 1
  fi

  if [[ ! -s "${list_file}" ]]; then
    echo "No successful production MongoDB backups found in R2 prefix ${R2_PREFIX}/success." >&2
    exit 1
  fi

  docker run --rm \
    -e "R2_PREFIX=${R2_PREFIX}" \
    -v "${CATALOG_SCRIPT}:/backup-catalog.mjs:ro" \
    -v "${TMP_DIR}:/data" \
    "${NODE_IMAGE}" \
    node --input-type=module -e '
import fs from "node:fs"
import { archiveToManifestKey, selectLatestRestorableBackup } from "/backup-catalog.mjs"

const relativeKeys = fs.readFileSync("/data/restore-archive-list.txt", "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
const archiveKeys = relativeKeys.map((key) => `${process.env.R2_PREFIX}/success/${key}`)
const backup = selectLatestRestorableBackup(archiveKeys)

if (!backup) {
  process.exit(2)
}

fs.writeFileSync("/data/restore-selection.values", [
  backup.key,
  archiveToManifestKey(backup.key),
  backup.key.split("/").at(-1),
  backup.createdAtUtc,
  backup.createdAtAsiaJakarta,
].join("\n"))
'

  mapfile -t restore_selection < "${values_file}"
  RESTORE_ARCHIVE_KEY="${restore_selection[0]:-}"
  RESTORE_MANIFEST_KEY="${restore_selection[1]:-}"
  RESTORE_BACKUP_NAME="${restore_selection[2]:-}"
  RESTORE_TIMESTAMP_UTC="${restore_selection[3]:-}"
  RESTORE_TIMESTAMP_ASIA_JAKARTA="${restore_selection[4]:-}"

  if [[ -z "${RESTORE_ARCHIVE_KEY}" || -z "${RESTORE_MANIFEST_KEY}" ]]; then
    echo "Unable to select the latest successful production backup." >&2
    exit 1
  fi
}

download_restore_artifacts() {
  RESTORE_ARCHIVE_PATH="${TMP_DIR}/restore.archive.gz"
  RESTORE_MANIFEST_PATH="${TMP_DIR}/restore-manifest.json"
  RESTORE_MANIFEST_AVAILABLE=0

  if rclone copyto "r2:${R2_BUCKET}/${RESTORE_MANIFEST_KEY}" "/data/restore-manifest.json"; then
    RESTORE_MANIFEST_AVAILABLE=1
  else
    echo "Restore manifest not available at ${RESTORE_MANIFEST_KEY}; continuing with archive size validation only."
  fi

  rclone copyto "r2:${R2_BUCKET}/${RESTORE_ARCHIVE_KEY}" "/data/restore.archive.gz"

  RESTORE_ARCHIVE_SIZE="$(wc -c < "${RESTORE_ARCHIVE_PATH}" | tr -d ' ')"
  if [[ "${RESTORE_ARCHIVE_SIZE}" == "0" ]]; then
    echo "Restore archive is empty: ${RESTORE_ARCHIVE_KEY}" >&2
    exit 1
  fi

  RESTORE_ARCHIVE_SHA256="$(sha256sum "${RESTORE_ARCHIVE_PATH}" | awk '{print $1}')"
}

verify_restore_manifest() {
  if [[ "${RESTORE_MANIFEST_AVAILABLE}" != "1" ]]; then
    return 0
  fi

  local manifest_values_file="${TMP_DIR}/restore-manifest.values"
  docker run --rm \
    -v "${TMP_DIR}:/data" \
    "${NODE_IMAGE}" \
    node -e '
const fs = require("fs")
const manifest = JSON.parse(fs.readFileSync("/data/restore-manifest.json", "utf8"))
console.log(manifest.archive?.sha256 || "")
console.log(manifest.r2?.archiveKey || "")
' > "${manifest_values_file}"

  local expected_sha expected_archive_key
  expected_sha="$(sed -n '1p' "${manifest_values_file}")"
  expected_archive_key="$(sed -n '2p' "${manifest_values_file}")"

  if [[ -z "${expected_sha}" ]]; then
    echo "Restore manifest is missing archive.sha256: ${RESTORE_MANIFEST_KEY}" >&2
    exit 1
  fi

  if [[ -n "${expected_archive_key}" && "${expected_archive_key}" != "${RESTORE_ARCHIVE_KEY}" ]]; then
    echo "Restore manifest archive key mismatch: expected ${RESTORE_ARCHIVE_KEY}, manifest has ${expected_archive_key}." >&2
    exit 1
  fi

  if [[ "${expected_sha}" != "${RESTORE_ARCHIVE_SHA256}" ]]; then
    echo "Restore archive SHA-256 mismatch for ${RESTORE_ARCHIVE_KEY}." >&2
    echo "expected=${expected_sha}" >&2
    echo "actual=${RESTORE_ARCHIVE_SHA256}" >&2
    exit 1
  fi
}

log_restore_selection() {
  log_section "Selected R2 restore backup"
  echo "backupName=${RESTORE_BACKUP_NAME}"
  echo "archiveKey=${RESTORE_ARCHIVE_KEY}"
  echo "manifestKey=${RESTORE_MANIFEST_KEY}"
  echo "backupTimestampUtc=${RESTORE_TIMESTAMP_UTC}"
  echo "backupTimestampAsiaJakarta=${RESTORE_TIMESTAMP_ASIA_JAKARTA}"
  echo "archiveSizeBytes=${RESTORE_ARCHIVE_SIZE}"
  echo "archiveSha256=${RESTORE_ARCHIVE_SHA256}"
  echo "currentReleaseSha=${CURRENT_SHA:-none}"
}

run_restore_latest() {
  prepare_runtime
  ensure_production
  r2_preflight

  CURRENT_SHA="$(current_release_sha)"
  mkdir -p "${BASE_DIR}/shared/backup-state" "${BASE_DIR}/shared/backups/tmp"
  acquire_backup_lock

  TMP_DIR="$(mktemp -d "${BASE_DIR}/shared/backups/tmp/mongo-r2-restore-latest.XXXXXX")"
  RESTORE_SERVICES_STOPPED=0
  trap 'restore_exit=$?; if [[ "${RESTORE_SERVICES_STOPPED:-0}" == "1" && "${restore_exit}" -ne 0 ]]; then echo "Restore failed; attempting to restart production services." >&2; compose up -d --build --remove-orphans || true; fi; rm -rf "${TMP_DIR}"; exit "${restore_exit}"' EXIT

  select_latest_restore_backup
  download_restore_artifacts
  verify_restore_manifest
  log_restore_selection

  log_section "Creating pre-restore safety backup when threshold allows"
  (
    BACKUP_LOCK_HELD=1
    run_backup "pre-restore" "none" ""
  )

  log_section "Stopping write-capable production services"
  compose stop api admin-web public-web || true
  RESTORE_SERVICES_STOPPED=1

  log_section "Restoring production MongoDB from R2 backup"
  echo "restoreNamespace=${MONGO_DATABASE}.*"
  compose exec -T mongo mongorestore \
    --uri="mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/?authSource=admin&replicaSet=rs0" \
    --archive \
    --gzip \
    --nsInclude="${MONGO_DATABASE}.*" \
    --oplogReplay \
    --drop \
    < "${RESTORE_ARCHIVE_PATH}"

  log_section "Restarting production services after restore"
  compose up -d --build --remove-orphans
  wait_for_service mongo 120
  wait_for_service api 240
  wait_for_service admin-web 240
  wait_for_service public-web 240
  wait_for_service caddy 120
  RESTORE_SERVICES_STOPPED=0

  echo "Production MongoDB restore completed from backup: ${RESTORE_ARCHIVE_KEY}"
  echo "Restored backup timestamp GMT+7: ${RESTORE_TIMESTAMP_ASIA_JAKARTA}"
}

run_backup() {
  REASON="${1:?reason is required}"
  INCOMING_SHA="${2:-none}"
  EXPECTED_CURRENT_SHA="${3:-}"

  case "${REASON}" in
    daily|pre-deploy|post-deploy|pre-restore) ;;
    *)
      echo "Unsupported backup reason: ${REASON}" >&2
      exit 1
      ;;
  esac

  if [[ "${REASON}" == "pre-deploy" && ! -f "${BASE_DIR}/current_release" && ! -e "${BASE_DIR}/current" ]]; then
    echo "No current production release exists; skipping first pre-deploy backup."
    return 0
  fi

  prepare_runtime
  ensure_production

  CURRENT_SHA="$(current_release_sha)"
  if [[ -n "${EXPECTED_CURRENT_SHA}" && "${CURRENT_SHA}" != "${EXPECTED_CURRENT_SHA}" ]]; then
    echo "Skipping ${REASON} backup for ${EXPECTED_CURRENT_SHA}; current release is ${CURRENT_SHA}."
    return 0
  fi

  mkdir -p "${BASE_DIR}/shared/backup-state" "${BASE_DIR}/shared/backups/tmp"

  if [[ "${BACKUP_LOCK_HELD:-0}" != "1" ]]; then
    acquire_backup_lock
  fi

  local mongo_container
  mongo_container="$(compose ps -q mongo 2>/dev/null || true)"
  if [[ -z "${mongo_container}" ]]; then
    echo "Mongo service is not available through compose." >&2
    exit 1
  fi

  log_backup_inputs
  log_compose_status
  log_mongo_container_status "${mongo_container}"
  log_mongo_storage_usage "${mongo_container}"
  log_mongo_database_stats

  if ! backup_threshold_allows_upload; then
    return 0
  fi

  r2_preflight

  TMP_DIR="$(mktemp -d "${BASE_DIR}/shared/backups/tmp/mongo-r2-${REASON}.XXXXXX")"
  trap 'rm -rf "${TMP_DIR}"' EXIT

  local stamp
  stamp="$(date -u +%Y%m%dT%H%M%SZ)"
  ARCHIVE_NAME="${stamp}_production_${REASON}_${CURRENT_SHA:-none}_${INCOMING_SHA:-none}.archive.gz"
  local manifest_name="${ARCHIVE_NAME%.archive.gz}.json"
  local archive_path="${TMP_DIR}/${ARCHIVE_NAME}"
  local manifest_path="${TMP_DIR}/${manifest_name}"
  local year month
  year="${stamp:0:4}"
  month="${stamp:4:2}"
  local in_progress_key="${R2_PREFIX}/in-progress/${year}/${month}/${ARCHIVE_NAME}"
  local archive_key="${R2_PREFIX}/success/${year}/${month}/${ARCHIVE_NAME}"
  local manifest_key="${R2_PREFIX}/manifests/${year}/${month}/${manifest_name}"

  log_section "Creating production MongoDB backup archive"
  echo "reason=${REASON}"
  compose exec -T mongo mongodump \
    --uri="mongodb://${MONGO_ROOT_USERNAME}:${MONGO_ROOT_PASSWORD}@127.0.0.1:27017/?authSource=admin&replicaSet=rs0" \
    --archive \
    --gzip \
    --oplog \
    > "${archive_path}"

  ARCHIVE_SIZE="$(wc -c < "${archive_path}" | tr -d ' ')"
  if [[ "${ARCHIVE_SIZE}" == "0" ]]; then
    echo "Backup archive is empty." >&2
    exit 1
  fi

  ARCHIVE_SHA256="$(sha256sum "${archive_path}" | awk '{print $1}')"
  create_manifest "${manifest_path}" "${archive_key}" "${manifest_key}"
  log_local_archive_metadata "${archive_path}" "${manifest_path}"

  log_section "Uploading production MongoDB backup to R2"
  rclone copyto "/data/${ARCHIVE_NAME}" "r2:${R2_BUCKET}/${in_progress_key}"
  rclone lsf --files-only "r2:${R2_BUCKET}/${R2_PREFIX}/in-progress/${year}/${month}" \
    | grep -Fx "${ARCHIVE_NAME}" >/dev/null
  rclone copyto "/data/${manifest_name}" "r2:${R2_BUCKET}/${manifest_key}"
  rclone copyto "/data/${ARCHIVE_NAME}" "r2:${R2_BUCKET}/${archive_key}"
  rclone deletefile "r2:${R2_BUCKET}/${in_progress_key}" || true
  log_r2_object_metadata "${archive_key}" "${manifest_key}"

  run_retention_after_daily

  echo "Production MongoDB backup completed: ${archive_key}"
}

MODE="${1:-}"
case "${MODE}" in
  backup)
    if [[ $# -lt 6 ]]; then
      usage
      exit 1
    fi
    APP_ENV="$2"
    BASE_DIR="$3"
    RUNTIME_ENV_FILE="$4"
    BACKUP_ENV_FILE="$5"
    run_backup "$6" "${7:-none}" "${8:-}"
    ;;
  restore-latest)
    if [[ $# -ne 5 ]]; then
      usage
      exit 1
    fi
    APP_ENV="$2"
    BASE_DIR="$3"
    RUNTIME_ENV_FILE="$4"
    BACKUP_ENV_FILE="$5"
    run_restore_latest
    ;;
  record-delayed)
    if [[ $# -ne 3 ]]; then
      usage
      exit 1
    fi
    write_delayed_state "$2" "$3"
    ;;
  run-due-delayed)
    if [[ $# -ne 5 ]]; then
      usage
      exit 1
    fi
    APP_ENV="$2"
    BASE_DIR="$3"
    RUNTIME_ENV_FILE="$4"
    BACKUP_ENV_FILE="$5"
    prepare_runtime
    ensure_production
    run_due_delayed_backup
    ;;
  *)
    usage
    exit 1
    ;;
esac
