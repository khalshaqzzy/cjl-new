#!/usr/bin/env bash
set -euo pipefail

READY_URL="${1:?READY_URL is required}"
EXPECTED_PROVIDER="${2:-cloud_api}"

READY_PAYLOAD="$(
  curl \
    --fail \
    --silent \
    --show-error \
    --location \
    --connect-timeout 10 \
    --max-time 30 \
    "${READY_URL}"
)"

export READY_PAYLOAD
export EXPECTED_PROVIDER

node <<'NODE'
const payload = JSON.parse(process.env.READY_PAYLOAD ?? "{}")
const expectedProvider = process.env.EXPECTED_PROVIDER ?? "cloud_api"

if (!payload.ok) {
  throw new Error("/ready returned ok=false")
}

if (payload.whatsapp?.provider !== expectedProvider) {
  throw new Error(`Expected whatsapp.provider=${expectedProvider}, got ${payload.whatsapp?.provider ?? "undefined"}`)
}

if (!payload.checks?.whatsappProviderConfigured) {
  throw new Error("WhatsApp Cloud provider is not fully configured according to /ready")
}

if (!payload.checks?.whatsappWebhookConfigured) {
  throw new Error("WhatsApp webhook path is not configured according to /ready")
}
NODE
