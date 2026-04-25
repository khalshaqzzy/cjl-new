#!/usr/bin/env bash
set -euo pipefail

APP_ENV="${1:?APP_ENV is required}"
RELEASE_SHA="${2:?RELEASE_SHA is required}"
BASE_DIR="${3:?BASE_DIR is required}"
RUNTIME_ENV_FILE="${4:?RUNTIME_ENV_FILE is required}"

RELEASE_DIR="${BASE_DIR}/releases/${RELEASE_SHA}"
COMPOSE_FILE="${RELEASE_DIR}/deploy/api/docker-compose.remote.yml"
CURRENT_LINK="${BASE_DIR}/current"

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

compose up -d --build --remove-orphans

wait_for_service mongo 120
wait_for_service api 240
wait_for_service admin-web 240
wait_for_service public-web 240
wait_for_service caddy 120

ln -sfn "${RELEASE_DIR}" "${CURRENT_LINK}"
printf '%s\n' "${RELEASE_SHA}" > "${BASE_DIR}/current_release"

find "${BASE_DIR}/releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
  | sort -nr \
  | awk 'NR>5 {print $2}' \
  | xargs -r rm -rf
