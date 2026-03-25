#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  sudo bash deploy/scripts/bootstrap-vm.sh <staging|production> <deploy-user> "<ssh-public-key>"

Example:
  sudo bash deploy/scripts/bootstrap-vm.sh staging cjl-staging-deploy "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAA... github-actions-staging"

This script:
  - installs Docker Engine and the Compose plugin
  - creates the deployment user if missing
  - installs the provided SSH public key into authorized_keys
  - adds the deployment user to the docker group
  - creates the /opt/cjl/<env> directory structure expected by the workflows
  - creates shared bind-mount directories for Caddy, Mongo, and WhatsApp auth state
  - enables a basic UFW policy for SSH, HTTP, and HTTPS when UFW is available
EOF
}

if [[ $# -ne 3 ]]; then
  usage
  exit 1
fi

APP_ENV="$1"
DEPLOY_USER="$2"
DEPLOY_SSH_PUBLIC_KEY="$3"

case "${APP_ENV}" in
  staging|production)
    ;;
  *)
    echo "APP_ENV must be 'staging' or 'production'" >&2
    exit 1
    ;;
esac

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script as root or with sudo." >&2
  exit 1
fi

if [[ -z "${DEPLOY_SSH_PUBLIC_KEY// }" ]]; then
  echo "SSH public key must not be empty." >&2
  exit 1
fi

BASE_DIR="/opt/cjl/${APP_ENV}"
USER_HOME="/home/${DEPLOY_USER}"
SSH_DIR="${USER_HOME}/.ssh"
AUTHORIZED_KEYS="${SSH_DIR}/authorized_keys"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get upgrade -y
DOCKER_COMPOSE_PACKAGE="docker-compose-plugin"
if ! apt-cache show "${DOCKER_COMPOSE_PACKAGE}" >/dev/null 2>&1; then
  DOCKER_COMPOSE_PACKAGE="docker-compose-v2"
fi

apt-get install -y ca-certificates curl git ufw docker.io "${DOCKER_COMPOSE_PACKAGE}"

systemctl enable docker
systemctl start docker

if ! id -u "${DEPLOY_USER}" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash "${DEPLOY_USER}"
fi

usermod -aG docker "${DEPLOY_USER}"

install -d -m 700 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" "${SSH_DIR}"
touch "${AUTHORIZED_KEYS}"
chmod 600 "${AUTHORIZED_KEYS}"
chown "${DEPLOY_USER}:${DEPLOY_USER}" "${AUTHORIZED_KEYS}"

if ! grep -Fqx "${DEPLOY_SSH_PUBLIC_KEY}" "${AUTHORIZED_KEYS}"; then
  printf '%s\n' "${DEPLOY_SSH_PUBLIC_KEY}" >> "${AUTHORIZED_KEYS}"
fi

install -d -m 755 -o "${DEPLOY_USER}" -g "${DEPLOY_USER}" \
  "${BASE_DIR}" \
  "${BASE_DIR}/releases" \
  "${BASE_DIR}/shared" \
  "${BASE_DIR}/shared/caddy-data" \
  "${BASE_DIR}/shared/caddy-config" \
  "${BASE_DIR}/shared/mongo-data" \
  "${BASE_DIR}/shared/whatsapp-auth"

if command -v ufw >/dev/null 2>&1; then
  ufw allow OpenSSH
  ufw allow 80/tcp
  ufw allow 443/tcp
  ufw --force enable
fi

cat <<EOF
VM bootstrap complete.

Environment: ${APP_ENV}
Deploy user: ${DEPLOY_USER}
Base directory: ${BASE_DIR}

Next checks:
  1. Reconnect as ${DEPLOY_USER} and run: docker version
  2. Confirm SSH access with the paired private key from GitHub Actions.
  3. Save this host key into the GitHub environment secret:
     ssh-keyscan -H <vm-hostname-or-ip>
EOF
