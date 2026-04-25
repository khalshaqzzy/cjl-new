#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  bash deploy/scripts/ensure-backup-systemd.sh production <deploy-user> <installer-path>

Checks whether production backup timers are installed. If not, installs them using:
  1. current root privileges, or
  2. passwordless sudo, or
  3. Docker-group host namespace escalation from the bootstrap-created deploy user.
EOF
}

if [[ $# -ne 3 ]]; then
  usage
  exit 1
fi

APP_ENV="$1"
DEPLOY_USER="$2"
INSTALLER_PATH="$3"

if [[ "${APP_ENV}" != "production" ]]; then
  echo "Backup timers are production-only." >&2
  exit 1
fi

if [[ ! -f "${INSTALLER_PATH}" ]]; then
  echo "Backup timer installer not found: ${INSTALLER_PATH}" >&2
  exit 1
fi

daily_timer="cjl-mongo-r2-backup@production.timer"
delayed_timer="cjl-mongo-r2-delayed-backup@production.timer"

timers_installed() {
  systemctl is-enabled --quiet "${daily_timer}" \
    && systemctl is-enabled --quiet "${delayed_timer}"
}

verify_timers() {
  systemctl is-enabled --quiet "${daily_timer}"
  systemctl is-enabled --quiet "${delayed_timer}"
  systemctl is-active --quiet "${daily_timer}"
  systemctl is-active --quiet "${delayed_timer}"
}

run_installer() {
  if [[ "${EUID}" -eq 0 ]]; then
    bash "${INSTALLER_PATH}" "${APP_ENV}" "${DEPLOY_USER}"
    return
  fi

  if command -v sudo >/dev/null 2>&1 && sudo -n true >/dev/null 2>&1; then
    sudo bash "${INSTALLER_PATH}" "${APP_ENV}" "${DEPLOY_USER}"
    return
  fi

  if ! command -v docker >/dev/null 2>&1; then
    echo "Cannot install backup timers: neither root/sudo nor docker is available." >&2
    exit 1
  fi

  if ! docker info >/dev/null 2>&1; then
    echo "Cannot install backup timers: deploy user cannot access Docker." >&2
    exit 1
  fi

  echo "Installing production backup timers through Docker host namespace access."
  docker run --rm \
    --privileged \
    --pid=host \
    -v /:/host \
    ubuntu:24.04 \
    nsenter -t 1 -m -u -i -n -p -- \
    /bin/bash -lc "bash '${INSTALLER_PATH}' '${APP_ENV}' '${DEPLOY_USER}'"
}

if timers_installed; then
  echo "Production MongoDB R2 backup timers are already installed."
else
  run_installer
fi

verify_timers
systemctl list-timers 'cjl-mongo-r2-*' --no-pager
