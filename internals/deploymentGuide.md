# CJ Laundry Deployment Guide

Document status: Active  
Last updated: 2026-04-02  
Scope: local setup, hosted rollout, and rollback for the Cloud-only WhatsApp runtime

This is the canonical deployment guide after the WhatsApp migration phases were closed in repo terms. The application runtime is now:

- one VM per environment
- one Docker Compose stack per environment
- Cloud API outbound from the API service
- signed Meta webhook ingestion into the API service
- no active linked-device sidecar runtime

## 1. Environment Topology

| Environment | Public web | Admin web | API | Runtime target | Deployment trigger |
| --- | --- | --- | --- | --- | --- |
| `local` | `http://localhost:3000` | `http://localhost:3001` | `http://localhost:4000` | local machine | manual |
| `staging` | `https://staging.cjlaundry.com` | `https://admin-staging.cjlaundry.com` | `https://api-staging.cjlaundry.com` | one GCP VM + Docker Compose + Caddy | push to `staging` after CI success |
| `production` | `https://cjlaundry.com` | `https://admin.cjlaundry.com` | `https://api.cjlaundry.com` | one GCP VM + Docker Compose + Caddy | push to `main` after CI success |

Frozen deployment facts:

- MongoDB stays on the internal Docker network and is not exposed publicly
- MongoDB runs in single-node replica-set mode
- GitHub Actions streams the release archive to the VM and the VM builds locally
- active WhatsApp secrets are Cloud API credentials, not gateway/session credentials

## 2. Local Setup

Create local env files from the repo examples:

- `packages/api/.env.local`
- `app/admin-web/.env.local`
- `app/public-web/.env.local`

Minimum API local values:

- `APP_ENV=local`
- `PORT=4000`
- `MONGODB_URI=mongodb://127.0.0.1:27017/cjlaundry`
- `SESSION_SECRET=replace-me`
- `SESSION_COOKIE_SECURE=false`
- `TRUST_PROXY=false`
- `ADMIN_USERNAME=admin`
- `ADMIN_PASSWORD=admin123`
- `WHATSAPP_PROVIDER=cloud_api`
- `WHATSAPP_GRAPH_API_VERSION=v25.0`
- `WHATSAPP_GRAPH_API_BASE_URL=https://graph.facebook.com`
- `WHATSAPP_BUSINESS_ID=local-business-id`
- `WHATSAPP_WABA_ID=local-waba-id`
- `WHATSAPP_PHONE_NUMBER_ID=local-phone-number-id`
- `WHATSAPP_ACCESS_TOKEN=local-access-token`
- `WHATSAPP_APP_SECRET=local-app-secret`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN=local-webhook-token`
- `WHATSAPP_WEBHOOK_PATH=/v1/webhooks/meta/whatsapp`

Local verification:

- `npm run lint`
- `npm run typecheck`
- `npm run test:backend`
- `npm run test:e2e`
- `npm run build`
- `npm run validate:cloud-runtime`
- `docker compose config`

Optional local container runtime:

- `npm run docker:up`
- check:
  - `http://localhost:4000/health`
  - `http://localhost:4000/ready`
  - `http://localhost:3001`
  - `http://localhost:3000`
- `npm run docker:down`

## 3. Hosted Infrastructure

Each hosted environment needs:

- one Ubuntu 24.04 VM
- one static IP
- inbound `22`, `80`, and `443`
- DNS records pointing to that VM
- Docker Engine + Compose plugin
- `/opt/cjl/<env>/releases`
- `/opt/cjl/<env>/shared`

Bootstrap using `deploy/scripts/bootstrap-vm.sh`.

## 4. GitHub Environments and Secrets

Create GitHub environments:

- `staging`
- `production`

Shared secret groups per environment:

- VM access:
  - `*_VM_HOST`
  - `*_VM_USER`
  - `*_VM_SSH_PRIVATE_KEY`
  - `*_VM_SSH_KNOWN_HOSTS`
  - `*_VM_SSH_PORT`
- Caddy:
  - `*_CADDY_EMAIL`
- Mongo:
  - `*_MONGO_ROOT_USERNAME`
  - `*_MONGO_ROOT_PASSWORD`
  - `*_MONGO_DATABASE`
  - `*_MONGO_REPLICA_KEY`
- API/session/bootstrap:
  - `*_SESSION_SECRET`
  - `*_ADMIN_BOOTSTRAP_USERNAME`
  - `*_ADMIN_BOOTSTRAP_PASSWORD`
  - `*_DEPLOY_RESET_TOKEN`
- Cloud WhatsApp:
  - `*_WHATSAPP_BUSINESS_ID`
  - `*_WHATSAPP_WABA_ID`
  - `*_WHATSAPP_PHONE_NUMBER_ID`
  - `*_WHATSAPP_ACCESS_TOKEN`
  - `*_WHATSAPP_APP_SECRET`
  - `*_WHATSAPP_WEBHOOK_VERIFY_TOKEN`

### 4.1 Hosted env var source guide

Rule of thumb:

- store secrets only in GitHub environment secrets, never in repo files
- derive non-secret hosted runtime values from the workflow, not from manual edits on the VM
- treat staging and production as separate credentials even if the provider account is shared

#### VM access

`*_VM_HOST`

- what it is:
  - SSH target hostname or static IP of the VM
- how to get it:
  - use the reserved static IP or DNS name assigned to the staging or production VM in GCP
  - if using DNS, verify it resolves to the correct static IP before saving it
- example source:
  - `gcloud compute addresses list`
  - DNS control panel

`*_VM_USER`

- what it is:
  - Linux user used by GitHub Actions to SSH and deploy
- how to get it:
  - create a dedicated deploy user during VM bootstrap
  - use the same username that owns `/opt/cjl/<env>` and can run Docker
- recommended value shape:
  - `deploy`, `cjl`, or similar dedicated non-personal account

`*_VM_SSH_PRIVATE_KEY`

- what it is:
  - private key paired with the public key installed for the deploy user
- how to get it:
  - generate a dedicated deploy keypair with `ssh-keygen -t ed25519 -C "github-actions-cjl-<env>"`
  - add the public key to `/home/<deploy-user>/.ssh/authorized_keys` on the VM
  - save the private key contents as the GitHub secret
- important:
  - do not reuse a personal laptop SSH key for CI deploys
  - keep staging and production keys separate

`*_VM_SSH_KNOWN_HOSTS`

- what it is:
  - pinned SSH host key line used by Actions
- how to get it:
  - run `ssh-keyscan -p <port> <host>`
  - verify the fingerprint out of band on the VM before storing it
- important:
  - regenerate this only if the VM host key changes

`*_VM_SSH_PORT`

- what it is:
  - SSH port for the VM
- how to get it:
  - use `22` unless the VM is intentionally hardened to a different port
  - confirm with the VM firewall and `sshd_config`

#### Caddy and TLS

`*_CADDY_EMAIL`

- what it is:
  - email address used by Caddy for ACME registration and certificate notices
- how to get it:
  - use a team-owned ops mailbox, not a personal email
- recommended:
  - `infra@...`, `ops@...`, or another shared monitored mailbox

#### Mongo runtime

`*_MONGO_ROOT_USERNAME`

- what it is:
  - root/admin username created for the hosted Mongo container
- how to get it:
  - choose it during provisioning; it is not issued externally
- recommended:
  - distinct per environment, e.g. `cjl_staging_root`, `cjl_production_root`

`*_MONGO_ROOT_PASSWORD`

- what it is:
  - password for the root/admin Mongo user
- how to get it:
  - generate it with a password generator or CLI such as `openssl rand -base64 48`
- important:
  - never use placeholder or reused credentials across environments

`*_MONGO_DATABASE`

- what it is:
  - logical Mongo database name used by the app
- how to get it:
  - choose it during provisioning
- recommended:
  - `cjlaundry_staging` for staging
  - `cjlaundry_production` for production

`*_MONGO_REPLICA_KEY`

- what it is:
  - internal key used by Mongo replica-set auth, even in single-node replica-set mode
- how to get it:
  - generate a long random string, for example `openssl rand -base64 48`
- important:
  - treat this as a secret
  - do not rotate casually in the middle of a rollout

#### API session and bootstrap

`*_SESSION_SECRET`

- what it is:
  - Express session signing secret
- how to get it:
  - generate a long random value, for example `openssl rand -base64 48`
- important:
  - must be different for staging and production
  - rotating it invalidates existing sessions

`*_ADMIN_BOOTSTRAP_USERNAME`

- what it is:
  - initial or enforced hosted admin username at startup
- how to get it:
  - choose the bootstrap operator username during provisioning
- recommended:
  - use a stable operational username, not an individual's personal handle

`*_ADMIN_BOOTSTRAP_PASSWORD`

- what it is:
  - hosted bootstrap password read by API startup
- how to get it:
  - generate a strong random password in the password manager used by the team
- important:
  - this is plaintext in GitHub secrets by design because startup hashes it into Mongo
  - rotate it only with an intentional operator plan because startup will reconcile it

`*_DEPLOY_RESET_TOKEN`

- what it is:
  - secret whose fingerprint tells deploy whether persistent volumes should be treated as a fresh stack
- how to get it:
  - generate a long random value, for example `openssl rand -base64 48`
- important:
  - changing this value is effectively a destructive reset signal for the hosted stack
  - do not rotate it unless the rollout intentionally wants a full persistent-data reset

#### Cloud WhatsApp

All WhatsApp credential names below map to the official Meta assets described in [WhatsAppAPIDocs.md](C:\Users\Khalfani%20Shaquille/Documents/GitHub/cjl-new/docs/WhatsApp/docs/WhatsAppAPIDocs.md).

`*_WHATSAPP_BUSINESS_ID`

- what it is:
  - Meta Business Portfolio ID
- how to get it:
  - open Meta Business settings or the business portfolio in Meta Business Manager
  - copy the Business ID shown for the CJ Laundry business
- important:
  - this is not the phone number and not the WABA ID

`*_WHATSAPP_WABA_ID`

- what it is:
  - WhatsApp Business Account ID
- how to get it:
  - use WhatsApp Manager or the WhatsApp Business Management API
  - the repo docs call this `WABA_ID`
  - if needed, query the list of WhatsApp assets under the business and copy the active account ID

`*_WHATSAPP_PHONE_NUMBER_ID`

- what it is:
  - phone number ID used by `POST /<PHONE_NUMBER_ID>/messages`
- how to get it:
  - open WhatsApp Manager and inspect the connected sender phone number
  - or fetch phone numbers from the WABA via the management API and copy the sender's `PHONE_NUMBER_ID`
- important:
  - this is the exact ID the API uses for outbound sends

`*_WHATSAPP_ACCESS_TOKEN`

- what it is:
  - Meta access token used by the API to call Graph / Cloud API
- how to get it:
  - create or use the system user / business token chosen for CJ Laundry WhatsApp operations
  - grant the WhatsApp messaging permissions needed by the Cloud API flow
  - copy the long-lived token into the GitHub secret
- important:
  - use a business-owned token, not a personal developer temporary token
  - record expiry and rotation owner outside the repo

Detailed acquisition and integration guide:

1. Meta-side prerequisites:
   - confirm the CJ Laundry Meta business already owns the target WABA and phone number
   - confirm the Meta app used by this repo is attached to the same business
   - create or choose a system user that is owned by the business, not a personal employee account
   - grant that system user access to:
     - the target WABA
     - the sender phone number asset if required by the current Meta UI
2. Generate the token:
   - in Meta Business settings, open the business system user section
   - choose the system user intended for server-to-server WhatsApp operations
   - generate a token from the app that owns the WhatsApp integration
   - include the WhatsApp messaging permissions required by the current Cloud API flow
3. Save it:
   - copy the issued token into:
     - `STAGING_WHATSAPP_ACCESS_TOKEN`
     - `PRODUCTION_WHATSAPP_ACCESS_TOKEN`
   - if staging and production intentionally use different Meta assets or apps, generate separate tokens
4. Verify before deploy:
   - with the token, call a safe read endpoint against Graph API, for example:
     ```bash
     curl -sS \
       -H "Authorization: Bearer <ACCESS_TOKEN>" \
       "https://graph.facebook.com/v25.0/<WABA_ID>/phone_numbers"
     ```
   - expected result:
     - HTTP success
     - the response includes the expected sender phone number and `PHONE_NUMBER_ID`
5. Verify after deploy:
   - `https://api-<env>/ready` must show:
     - `checks.whatsappProviderConfigured === true`
     - `whatsapp.provider === "cloud_api"`
   - send a staging-safe template message and confirm the API can create outbound Graph calls successfully

Operational notes:

- prefer long-lived business/system-user tokens over short-lived test tokens
- if the same Meta app/token is intentionally reused across staging and production, still save it separately in both GitHub environments so each workflow is self-contained
- rotating the token should be treated as a normal secret rotation and does not require Mongo data reset

`*_WHATSAPP_APP_SECRET`

- what it is:
  - Meta app secret used for webhook signature verification
- how to get it:
  - open the Meta app that owns the WhatsApp integration
  - copy the app secret from app settings
- important:
  - this must match the same app that is subscribed to the WABA webhook

Detailed acquisition and integration guide:

1. Meta-side prerequisites:
   - identify the exact Meta app used for:
     - WhatsApp webhook subscription
     - Cloud API token generation
   - do not assume the business has only one app; confirm the app name and app ID explicitly
2. Get the value:
   - open the Meta developer console for the chosen app
   - open app settings where the app secret is displayed
   - reveal and copy the app secret
3. Save it:
   - store the same app secret in:
     - `STAGING_WHATSAPP_APP_SECRET`
     - `PRODUCTION_WHATSAPP_APP_SECRET`
   - if staging and production use different Meta apps, store the matching secret per environment
4. Verify the app mapping:
   - ensure the same app is the one subscribed to the target WABA
   - if using API-based verification, confirm the app can subscribe to the WABA and receive WhatsApp webhook events
5. Verify after deploy:
   - perform a real Meta webhook delivery to staging
   - confirm signed webhook POST is accepted by the API
   - check API logs for absence of signature-validation errors

Operational notes:

- this value is required only on the API side; it is never sent to Meta during the verify challenge
- if `WHATSAPP_APP_SECRET` is wrong, `/ready` may still say the provider is configured but signed webhook POSTs will fail at runtime
- treat any app change as a coupled rotation:
  - access token
  - app secret
  - webhook subscription
  - app-to-WABA relationship

`*_WHATSAPP_WEBHOOK_VERIFY_TOKEN`

- what it is:
  - shared verification token used during Meta webhook challenge handshake
- how to get it:
  - generate an arbitrary strong random string during provisioning
  - save the same value in:
    - GitHub environment secret
    - Meta webhook subscription verify-token field
- important:
  - this value is chosen by CJ Laundry, not issued by Meta
  - challenge verification will fail if the Meta-side value and runtime secret diverge

Detailed acquisition and integration guide:

1. Generate the value:
   - generate a strong random string, for example:
     ```bash
     openssl rand -base64 48
     ```
   - this token is operator-defined; Meta does not generate it for you
2. Save it in GitHub:
   - store it in:
     - `STAGING_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
     - `PRODUCTION_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
   - recommended:
     - use different verify tokens for staging and production to avoid environment confusion
3. Register it in Meta webhook configuration:
   - open the WhatsApp webhook subscription settings for the exact Meta app used by the environment
   - set the callback URL to:
     - staging: `https://api-staging.cjlaundry.com/v1/webhooks/meta/whatsapp`
     - production: `https://api.cjlaundry.com/v1/webhooks/meta/whatsapp`
   - paste the exact same verify token value into the verify-token field on Meta
4. Complete challenge verification:
   - trigger Meta's verification request from the webhook configuration UI
   - expected behavior:
     - Meta challenge succeeds
     - API logs show successful verify handling
5. Post-verification checks:
   - `https://api-<env>/ready` must show `checks.whatsappWebhookConfigured === true`
   - a manual GET challenge replay with the same verify token should succeed if the route is reachable

Operational notes:

- this token is only for GET challenge verification; it is not the same thing as the access token
- changing it requires updating both sides:
  - GitHub environment secret
  - Meta webhook config
- if the token is wrong, Meta webhook setup will fail even if all other WhatsApp credentials are correct

### 4.1.1 End-to-end integration sequence for token, app secret, and verify token

Use this exact order for a new hosted environment:

1. Confirm the Meta business, WABA, sender phone number, and Meta app that this repo will use.
2. Generate or choose the system user and obtain the Cloud API access token.
3. Copy the Meta app secret from the same app.
4. Generate a new environment-specific webhook verify token.
5. Save all three values into the matching GitHub environment:
   - `*_WHATSAPP_ACCESS_TOKEN`
   - `*_WHATSAPP_APP_SECRET`
   - `*_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
6. Save the matching callback URL and verify token into Meta webhook settings.
7. Complete the Meta webhook challenge successfully.
8. Ensure the app is subscribed to the target WABA.
9. Run staging deploy and verify `/ready`.
10. Send and receive at least one staging WhatsApp event to prove:
    - outbound Graph authentication works
    - webhook signature verification works
    - webhook challenge token is aligned

### 4.1.2 Fast troubleshooting map

If `WHATSAPP_ACCESS_TOKEN` is wrong:

- Graph API calls fail
- outbound send attempts fail
- `/ready.checks.whatsappProviderConfigured` may still be `true` because the value exists, so functional staging validation is still required

If `WHATSAPP_APP_SECRET` is wrong:

- signed webhook POSTs fail
- GET challenge may still pass
- outbound sends may still work

If `WHATSAPP_WEBHOOK_VERIFY_TOKEN` is wrong:

- Meta challenge verification fails
- existing webhook subscription re-verification fails
- signed POST behavior says nothing about this token because it is used only for challenge verification

### 4.2 Hosted runtime values rendered by workflow

These values are not supposed to be entered manually into GitHub secrets because the workflow already derives them:

| Runtime env var | How it is obtained |
| --- | --- |
| `APP_ENV` | hardcoded by workflow: `staging` or `production` |
| `RELEASE_SHA` | `git rev-parse HEAD` during deploy |
| `LOG_LEVEL` | fixed in workflow, currently `info` |
| `COMPOSE_PROJECT_NAME` | fixed in workflow per environment |
| `SHARED_DIR` | fixed from hosted directory layout `/opt/cjl/<env>/shared` |
| `ADMIN_DOMAIN` | fixed from environment DNS |
| `PUBLIC_DOMAIN` | fixed from environment DNS |
| `API_DOMAIN` | fixed from environment DNS |
| `APP_TIMEZONE` | fixed as `Asia/Jakarta` |
| `WHATSAPP_PROVIDER` | fixed as `cloud_api` |
| `WHATSAPP_GRAPH_API_VERSION` | fixed as `v25.0` |
| `WHATSAPP_GRAPH_API_BASE_URL` | fixed as `https://graph.facebook.com` |
| `WHATSAPP_WEBHOOK_PATH` | fixed as `/v1/webhooks/meta/whatsapp` |
| `WA_FAIL_MODE` | fixed as `never` in hosted env |

### 4.3 Hosted provisioning sequence

Recommended order to gather hosted values:

1. provision the VM, static IP, and DNS
2. create deploy SSH user and keypair
3. capture `known_hosts`
4. choose Mongo usernames/database names and generate Mongo secrets
5. generate session/bootstrap/reset secrets
6. collect Meta Business, WABA, phone number, app secret, and access token
7. generate webhook verify token and register the same value in Meta webhook settings
8. save everything into the matching GitHub environment
9. trigger staging deploy and confirm `/ready` semantic checks pass

## 5. Rendered Hosted Runtime Env

The deploy workflows render `/opt/cjl/<env>/shared/runtime.env` with:

- `APP_ENV`
- `RELEASE_SHA`
- `LOG_LEVEL`
- `COMPOSE_PROJECT_NAME`
- `SHARED_DIR`
- `ADMIN_DOMAIN`
- `PUBLIC_DOMAIN`
- `API_DOMAIN`
- `CADDY_EMAIL`
- `APP_TIMEZONE`
- `MONGO_ROOT_USERNAME`
- `MONGO_ROOT_PASSWORD`
- `MONGO_DATABASE`
- `MONGO_REPLICA_KEY`
- `SESSION_SECRET`
- `ADMIN_BOOTSTRAP_USERNAME`
- `ADMIN_BOOTSTRAP_PASSWORD`
- `WHATSAPP_PROVIDER=cloud_api`
- `WHATSAPP_GRAPH_API_VERSION=v25.0`
- `WHATSAPP_GRAPH_API_BASE_URL=https://graph.facebook.com`
- `WHATSAPP_BUSINESS_ID`
- `WHATSAPP_WABA_ID`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_APP_SECRET`
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_WEBHOOK_PATH=/v1/webhooks/meta/whatsapp`
- `WA_FAIL_MODE=never`

## 6. What the Deploy Workflows Do

Both deploy workflows:

1. wait for `CI` to succeed on the target branch
2. resolve the release SHA
3. fail fast if any required Cloud WhatsApp secret is blank
4. create the release directory on the target VM
5. upload the release archive over SSH
6. render and upload `runtime.env`
7. run `deploy/scripts/remote-deploy.sh`
8. run smoke checks against:
   - API `/health`
   - API `/ready`
   - admin site
   - public site
9. validate `/ready` semantically with `deploy/scripts/assert-ready-cloud.sh`
10. rollback to the previous release if the workflow fails after deploy and a previous release exists

## 7. Staging Validation

Minimum staging validation before production:

- `https://api-staging.cjlaundry.com/health`
- `https://api-staging.cjlaundry.com/ready`
- `https://admin-staging.cjlaundry.com`
- `https://staging.cjlaundry.com`

Required `/ready` expectations:

- `ok === true`
- `release.sha` matches the deployed SHA
- `checks.mongo === true`
- `checks.settingsSeeded === true`
- `checks.adminSeeded === true`
- `checks.whatsappProviderConfigured === true`
- `checks.whatsappWebhookConfigured === true`
- `whatsapp.provider === "cloud_api"`
- `whatsapp.webhookPath === "/v1/webhooks/meta/whatsapp"`

Hosted deploy no longer treats plain `200` from `/ready` as sufficient. The workflow now fails if:

- a required Cloud WhatsApp secret is blank before deploy starts
- `/ready` reports `checks.whatsappProviderConfigured !== true`
- `/ready` reports `checks.whatsappWebhookConfigured !== true`
- `/ready.whatsapp.provider !== "cloud_api"`

Operational staging validation:

- admin login, create customer, confirm order, mark done
- portal login and direct order link
- webhook challenge verification
- signed webhook POST acceptance
- inbox thread visibility
- CSW-open manual send
- CSW-closed template-only state
- inbound media retrieval from admin
- failed-notification recovery:
  - resend
  - receipt download
  - `Mark as Done`
  - `Ignore`

## 8. Production Rollout

Production remains auto-deployed from `main` after CI success.

Requirements before first production push:

- the exact SHA already passed staging validation
- rollback path is known
- first-hour monitoring owner is assigned
- production secrets are already provisioned

Production post-deploy checks:

- `https://api.cjlaundry.com/health`
- `https://api.cjlaundry.com/ready`
- `https://admin.cjlaundry.com`
- `https://cjlaundry.com`
- one customer-safe end-to-end smoke flow

## 9. Startup Backfill Expectations

API startup still runs idempotent seed/backfill logic. That is expected in the cutover release.

Current behavior:

- first startup after this release uses a baseline WhatsApp compatibility pass and records runtime migration watermark `whatsapp-cutover-backfill-v1`
- later startups use an incremental pass that only revisits documents still carrying legacy WhatsApp markers or missing Cloud-era derived fields
- the compatibility pass is cursor-based and batched; it no longer loads entire WhatsApp collections into memory before the API starts

What startup may do:

- normalize settings and admin bootstrap state
- hash legacy customer/direct tokens
- backfill order `activityAt`
- canonicalize legacy WhatsApp chats/messages/notifications into Cloud-era read fields
- mark legacy WhatsApp chats as shadow records while preserving history
- preserve existing human-readable legacy chat titles when canonical chats are upserted
- create required indexes

What startup must not do:

- destructive deletion of existing production business data
- destructive deletion of legacy WhatsApp history
- dropping legacy fields/collections in the first Cloud-only release

## 10. Rollback

Preferred rollback:

- re-run the deploy workflow against the last known good SHA

Emergency rollback:

- use `deploy/scripts/remote-rollback.sh` on the target VM

Rollback restores code/runtime, not business data mutations already committed to MongoDB.

## 11. Troubleshooting

### `/ready` fails but `/health` works`

Likely causes:

- wrong Mongo credentials
- Mongo not healthy
- bootstrap admin/settings missing
- Cloud WhatsApp env incomplete

Check:

- `/opt/cjl/<env>/shared/runtime.env`
- `docker compose logs api`
- `docker compose logs mongo`

### Cloud webhook fails

Check:

- `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- `WHATSAPP_APP_SECRET`
- public reachability of `GET/POST /v1/webhooks/meta/whatsapp`
- API logs for signature failures or payload rejection

### Manual send fails in admin inbox

Check:

- `GET /v1/admin/whatsapp/status`
- thread composer mode
- CSW expiry on the target thread
- Cloud credentials in runtime env
- API logs for validation or provider errors

### Inbound media cannot be opened

Check:

- webhook payload reached the API
- `whatsapp_messages.mediaDownloadStatus`
- GridFS file existence
- admin media endpoint response

## 12. Final Checklist

You are ready when all of the following are true:

- local verification passes
- `validate:cloud-runtime` passes
- staging and production SSH access works
- staging and production DNS point to the correct VM
- GitHub environments and secrets are filled
- staging deploy completes successfully
- staging Cloud validation is complete
- rollback path is proven
- production readiness checklist is complete
