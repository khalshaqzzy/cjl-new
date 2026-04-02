import fs from "node:fs"
import path from "node:path"

const repoRoot = process.cwd()

const readFile = (relativePath: string) =>
  fs.readFileSync(path.join(repoRoot, relativePath), "utf8")

const assertIncludes = (content: string, needle: string, file: string) => {
  if (!content.includes(needle)) {
    throw new Error(`${file} must include: ${needle}`)
  }
}

const assertExcludes = (content: string, needle: string, file: string) => {
  if (content.includes(needle)) {
    throw new Error(`${file} must not include: ${needle}`)
  }
}

for (const file of [
  "packages/api/.env.example",
  "deploy/env/runtime.staging.env.example",
  "deploy/env/runtime.production.env.example",
]) {
  const content = readFile(file)
  for (const required of [
    "WHATSAPP_PROVIDER=cloud_api",
    "WHATSAPP_GRAPH_API_VERSION=v25.0",
    "WHATSAPP_GRAPH_API_BASE_URL=https://graph.facebook.com",
    "WHATSAPP_BUSINESS_ID=",
    "WHATSAPP_WABA_ID=",
    "WHATSAPP_PHONE_NUMBER_ID=",
    "WHATSAPP_ACCESS_TOKEN=",
    "WHATSAPP_APP_SECRET=",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN=",
    "WHATSAPP_WEBHOOK_PATH=/v1/webhooks/meta/whatsapp",
  ]) {
    assertIncludes(content, required, file)
  }

  for (const forbidden of ["WHATSAPP_GATEWAY_TOKEN", "WHATSAPP_AUTH_DIR", "WHATSAPP_ENABLED="]) {
    assertExcludes(content, forbidden, file)
  }
}

for (const file of [
  ".github/workflows/deploy-staging.yml",
  ".github/workflows/deploy-production.yml",
]) {
  const content = readFile(file)
  for (const required of [
    "WHATSAPP_PROVIDER=cloud_api",
    "WHATSAPP_GRAPH_API_VERSION=v25.0",
    "WHATSAPP_GRAPH_API_BASE_URL=https://graph.facebook.com",
    "WHATSAPP_BUSINESS_ID=${{ secrets.",
    "WHATSAPP_WABA_ID=${{ secrets.",
    "WHATSAPP_PHONE_NUMBER_ID=${{ secrets.",
    "WHATSAPP_ACCESS_TOKEN=${{ secrets.",
    "WHATSAPP_APP_SECRET=${{ secrets.",
    "WHATSAPP_WEBHOOK_VERIFY_TOKEN=${{ secrets.",
    "WHATSAPP_WEBHOOK_PATH=/v1/webhooks/meta/whatsapp",
    "Validate Cloud WhatsApp secrets",
    "assert-ready-cloud.sh",
  ]) {
    assertIncludes(content, required, file)
  }

  for (const forbidden of [
    "WHATSAPP_GATEWAY_TOKEN",
    "WHATSAPP_AUTH_DIR",
    "whatsapp-gateway",
    "WHATSAPP_GATEWAY_TOKEN fingerprint",
  ]) {
    assertExcludes(content, forbidden, file)
  }
}

for (const file of [
  "deploy/api/docker-compose.remote.yml",
  "docker-compose.yml",
]) {
  const content = readFile(file)
  for (const forbidden of ["WHATSAPP_GATEWAY_TOKEN", "WHATSAPP_AUTH_DIR"]) {
    assertExcludes(content, forbidden, file)
  }
}

for (const file of [
  "internals/deploymentGuide.md",
  "internals/environmentMatrix.md",
  "internals/releaseExecutionChecklist.md",
  "internals/manualProvisioningChecklist.md",
  "internals/productionReadinessChecklist.md",
]) {
  const content = readFile(file)
  for (const forbidden of [
    "WHATSAPP_GATEWAY_TOKEN",
    "WHATSAPP_AUTH_DIR",
    "whatsapp-gateway",
    "Reset Session",
    "Gateway aktif",
  ]) {
    assertExcludes(content, forbidden, file)
  }
}

console.log("Cloud runtime validation passed.")
