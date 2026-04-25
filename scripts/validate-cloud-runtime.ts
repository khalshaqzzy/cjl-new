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

{
  const productionWorkflow = readFile(".github/workflows/deploy-production.yml")
  for (const required of [
    "Validate R2 backup secrets",
    "Render backup env",
    "Upload backup env",
    "Run pre-deploy MongoDB backup",
    "Ensure MongoDB backup timers",
    "Schedule delayed MongoDB backup",
    "PRODUCTION_R2_ACCOUNT_ID",
    "PRODUCTION_R2_BUCKET",
    "PRODUCTION_R2_ACCESS_KEY_ID",
    "PRODUCTION_R2_SECRET_ACCESS_KEY",
    "backup-mongo-r2.sh",
    "ensure-backup-systemd.sh",
    "install-backup-systemd.sh",
    "record-delayed",
  ]) {
    assertIncludes(productionWorkflow, required, ".github/workflows/deploy-production.yml")
  }

  for (const forbidden of [
    "PRODUCTION_DEPLOY_RESET_TOKEN",
    "DEPLOY_RESET_FINGERPRINT",
  ]) {
    assertExcludes(productionWorkflow, forbidden, ".github/workflows/deploy-production.yml")
  }
}

{
  const stagingWorkflow = readFile(".github/workflows/deploy-staging.yml")
  for (const forbidden of [
    "STAGING_R2_ACCOUNT_ID",
    "STAGING_R2_BUCKET",
    "STAGING_R2_ACCESS_KEY_ID",
    "STAGING_R2_SECRET_ACCESS_KEY",
    "backup-mongo-r2.sh",
    "schedule-delayed-backup.sh",
    "STAGING_DEPLOY_RESET_TOKEN",
    "DEPLOY_RESET_FINGERPRINT",
  ]) {
    assertExcludes(stagingWorkflow, forbidden, ".github/workflows/deploy-staging.yml")
  }
}

{
  const remoteDeploy = readFile("deploy/scripts/remote-deploy.sh")
  for (const forbidden of [
    "DEPLOY_RESET_FINGERPRINT",
    "deploy-reset.fingerprint",
    "full_reset_stack",
    "docker_host_rm_rf",
    "docker_host_rm_rf \"mongo-data\"",
    "--volumes",
  ]) {
    assertExcludes(remoteDeploy, forbidden, "deploy/scripts/remote-deploy.sh")
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
