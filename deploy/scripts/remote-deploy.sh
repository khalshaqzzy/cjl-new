#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${1:?APP_ENV is required}"
RELEASE_SHA="${2:?RELEASE_SHA is required}"
BASE_DIR="${3:?BASE_DIR is required}"
RUNTIME_ENV_FILE="${4:?RUNTIME_ENV_FILE is required}"

RELEASE_DIR="${BASE_DIR}/releases/${RELEASE_SHA}"
COMPOSE_FILE="${RELEASE_DIR}/deploy/api/docker-compose.remote.yml"
CURRENT_LINK="${BASE_DIR}/current"

if [[ ! -d "${RELEASE_DIR}" ]]; then
  echo "Release directory not found: ${RELEASE_DIR}" >&2
  exit 1
fi

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [[ ! -f "${RUNTIME_ENV_FILE}" ]]; then
  echo "Runtime env file not found: ${RUNTIME_ENV_FILE}" >&2
  exit 1
fi

mkdir -p \
  "${BASE_DIR}/shared" \
  "${BASE_DIR}/shared/caddy-data" \
  "${BASE_DIR}/shared/caddy-config" \
  "${BASE_DIR}/shared/mongo-data"

docker compose \
  --project-name "cjl-${APP_ENV}" \
  --project-directory "${RELEASE_DIR}" \
  --env-file "${RUNTIME_ENV_FILE}" \
  -f "${COMPOSE_FILE}" \
  up -d --build --remove-orphans

ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"
printf '%s\n' "${RELEASE_SHA}" > "${BASE_DIR}/current_release"

find "${BASE_DIR}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk 'NR>5 {print $2}' \
  | xargs -r rm -rf
