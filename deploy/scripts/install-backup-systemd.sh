#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  sudo bash deploy/scripts/install-backup-systemd.sh production <deploy-user>

Installs production-only systemd timers for:
  - daily MongoDB R2 backup at 02:00 Asia/Jakarta
  - delayed post-deploy backup polling every 5 minutes
EOF
}

if [[ $# -ne 2 ]]; then
  usage
  exit 1
fi

APP_ENV="$1"
DEPLOY_USER="$2"

if [[ "${APP_ENV}" != "production" ]]; then
  echo "Backup systemd units are production-only." >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root or with sudo." >&2
  exit 1
fi

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  echo "Deploy user does not exist: ${DEPLOY_USER}" >&2
  exit 1
fi

BASE_DIR="/opt/cjl/${APP_ENV}"
RUNTIME_ENV="${BASE_DIR}/shared/runtime.env"
BACKUP_ENV="${BASE_DIR}/shared/backup.env"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BIN_DIR="${BASE_DIR}/shared/bin"
BACKUP_SCRIPT="${BIN_DIR}/cjl-mongo-r2-backup"
RETENTION_SCRIPT="${BIN_DIR}/backup-retention.mjs"

if [[ ! -f "${SOURCE_DIR}/backup-mongo-r2.sh" ]]; then
  echo "Backup script not found beside installer: ${SOURCE_DIR}/backup-mongo-r2.sh" >&2
  exit 1
fi

if [[ ! -f "${SOURCE_DIR}/backup-retention.mjs" ]]; then
  echo "Retention script not found beside installer: ${SOURCE_DIR}/backup-retention.mjs" >&2
  exit 1
fi

install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" \
  "${BASE_DIR}/shared/backups" \
  "${BASE_DIR}/shared/backups/tmp" \
  "${BASE_DIR}/shared/backup-state" \
  "${BIN_DIR}"

install -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" \
  "${SOURCE_DIR}/backup-mongo-r2.sh" \
  "${BACKUP_SCRIPT}"

install -m 644 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" \
  "${SOURCE_DIR}/backup-retention.mjs" \
  "${RETENTION_SCRIPT}"

cat > /etc/systemd/system/cjl-mongo-r2-backup@.service <<EOF
[Unit]
Description=CJ Laundry MongoDB R2 daily backup for %i
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=${DEPLOY_USER}
WorkingDirectory=${BASE_DIR}
ExecStart=${BACKUP_SCRIPT} backup %i ${BASE_DIR} ${RUNTIME_ENV} ${BACKUP_ENV} daily none
EOF

cat > /etc/systemd/system/cjl-mongo-r2-backup@.timer <<'EOF'
[Unit]
Description=CJ Laundry MongoDB R2 daily backup timer for %i

[Timer]
OnCalendar=*-*-* 02:00:00 Asia/Jakarta
Persistent=true
AccuracySec=1min
Unit=cjl-mongo-r2-backup@%i.service

[Install]
WantedBy=timers.target
EOF

cat > /etc/systemd/system/cjl-mongo-r2-delayed-backup@.service <<EOF
[Unit]
Description=CJ Laundry MongoDB R2 delayed post-deploy backup checker for %i
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
User=${DEPLOY_USER}
WorkingDirectory=${BASE_DIR}
ExecStart=${BACKUP_SCRIPT} run-due-delayed %i ${BASE_DIR} ${RUNTIME_ENV} ${BACKUP_ENV}
EOF

cat > /etc/systemd/system/cjl-mongo-r2-delayed-backup@.timer <<'EOF'
[Unit]
Description=CJ Laundry MongoDB R2 delayed post-deploy backup polling timer for %i

[Timer]
OnCalendar=*-*-* *:0/5:00
Persistent=true
AccuracySec=1min
Unit=cjl-mongo-r2-delayed-backup@%i.service

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now cjl-mongo-r2-backup@production.timer
systemctl enable --now cjl-mongo-r2-delayed-backup@production.timer

cat <<EOF
Production MongoDB R2 backup timers installed.

Required before the first run:
  - ${RUNTIME_ENV}
  - ${BACKUP_ENV}

Installed stable backup scripts:
  - ${BACKUP_SCRIPT}
  - ${RETENTION_SCRIPT}

Check timers with:
  systemctl list-timers 'cjl-mongo-r2-*'
EOF
