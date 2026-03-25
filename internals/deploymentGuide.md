# CJ Laundry Deployment Guide

Document status: Active  
Last updated: 2026-03-25  
Scope: full setup and deployment runbook for local, staging, and production

This is the canonical step-by-step deployment guide for CJ Laundry. It is written for a junior-level developer who needs to set the project up from scratch, understand where every value goes, and deploy safely without guessing.

If you follow this file from top to bottom, you should end with:

- a working local environment
- a provisioned staging environment
- a documented path to production deployment
- a rollback path if something goes wrong
- a clear validation path for request correlation, structured logs, security headers, rollback, and WhatsApp runtime health

## 1. Read This First

### What this guide covers

- local development setup
- local env file placement
- GCP VM provisioning for staging and production
- SSH deploy-user setup for GitHub Actions
- GitHub environments and secret placement
- branch-based CI and deploy workflows
- first staging rollout
- first production rollout
- smoke tests and rollback

### What this guide does not cover

- writing product code
- changing business logic
- live traffic migration strategy beyond the repo baseline
- advanced host hardening beyond the repo baseline
- operator-level phone pairing steps beyond the repo baseline admin status flow

### How to use this guide

Work in this order:

1. understand the environment topology
2. prepare your local machine and local env files
3. generate SSH keys for GitHub Actions
4. provision the GCP VMs
5. bootstrap the deploy user on each VM
6. configure DNS
7. add GitHub environments and secrets
8. deploy staging
9. validate staging
10. deploy production

Do not skip straight to production. Staging is the safety checkpoint.

## 2. Environment Topology

| Environment | Public web | Admin web | API | Runtime target | Deployment trigger |
| --- | --- | --- | --- | --- | --- |
| `local` | `http://localhost:3000` | `http://localhost:3001` | `http://localhost:4000` | local machine | manual |
| `staging` | `https://staging.cjlaundry.com` | `https://admin-staging.cjlaundry.com` | `https://api-staging.cjlaundry.com` | one GCP VM + Docker Compose + Caddy | push to `staging` after CI success |
| `production` | `https://cjlaundry.com` | `https://admin.cjlaundry.com` | `https://api.cjlaundry.com` | one GCP VM + Docker Compose + Caddy | push to `main` after CI success |

Important architecture rules already frozen in the repo:

- all three public surfaces for one environment live on the same VM
- MongoDB stays on the private Docker network and is not exposed publicly
- MongoDB runs in single-node replica-set mode so transaction-backed business writes are supported
- MongoDB replica-set mode with auth also requires an internal keyfile, which this repo now renders from `MONGO_REPLICA_KEY`
- GitHub Actions does not build deployment images
- GitHub Actions only ships the selected git release to the VM over SSH
- the VM builds images locally from the shipped release
- the VM also persists WhatsApp auth state in a shared bind mount so the linked-device session survives container restarts

## 3. Where Each Env Value Goes

This section matters because most deployment mistakes come from putting the right value in the wrong place.

| Location | Purpose | Examples | Should be committed? |
| --- | --- | --- | --- |
| local machine `.env.local` files | local development only | `packages/api/.env.local`, `app/admin-web/.env.local`, `app/public-web/.env.local` | no |
| GitHub environment secrets | canonical hosted secrets for CI/CD | `STAGING_SESSION_SECRET`, `PRODUCTION_VM_SSH_PRIVATE_KEY` | no |
| VM runtime env file | rendered by GitHub Actions before deploy | `/opt/cjl/staging/shared/runtime.env`, `/opt/cjl/production/shared/runtime.env` | no |
| repo example files | safe templates only | `packages/api/.env.example`, `deploy/env/runtime.staging.env.example` | yes |

### 3.1 Local-only env files

These files stay on your machine:

- `packages/api/.env.local`
- `app/admin-web/.env.local`
- `app/public-web/.env.local`

Use them only for local development. Never paste staging or production secrets into them.

### 3.2 GitHub-hosted secrets

These live in GitHub:

- repository Settings
- Environments
- `staging` or `production`
- Environment secrets

Use GitHub environment secrets for:

- VM host/user/key details
- Mongo hosted credentials
- `MONGO_REPLICA_KEY`
- session secret
- WhatsApp gateway internal token
- bootstrap admin credentials
- known_hosts
- Caddy ACME email

### 3.3 VM runtime env files

These files live only on the VM:

- `/opt/cjl/staging/shared/runtime.env`
- `/opt/cjl/production/shared/runtime.env`

You do not create these files by hand during normal deployment. The GitHub workflow renders them from the environment secrets and uploads them over SSH right before deployment.

## 4. Repo Files That Matter

These are the main files you will keep referring to.

### Local env examples

- `packages/api/.env.example`
- `app/admin-web/.env.example`
- `app/public-web/.env.example`

### Hosted runtime env examples

- `deploy/env/runtime.staging.env.example`
- `deploy/env/runtime.production.env.example`

These are safe templates only. They show shape and naming, not real secrets.

Mongo note:

- because the repo uses a replica set and root auth at the same time, hosted runtime envs must define `MONGO_REPLICA_KEY`
- this is not the app login password; it is the internal Mongo replica-set authentication secret used to generate the runtime keyfile
- keep it alphanumeric or base64-safe with no spaces, quotes, or punctuation like `-`

### Deployment assets

- `deploy/api/docker-compose.remote.yml`
- `deploy/api/Caddyfile`
- `deploy/scripts/bootstrap-vm.sh`
- `deploy/scripts/remote-deploy.sh`
- `deploy/scripts/remote-rollback.sh`
- `deploy/scripts/smoke-check.sh`

### Automation files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

### Operator checklists

- `internals/productionReadinessChecklist.md`
- `internals/releaseExecutionChecklist.md`

## 5. Step 1: Prepare Local Development First

Do this before touching staging or production. It proves the repo is healthy on your machine.

### 5.1 Install dependencies

From the repo root:

```powershell
npm install
```

Expected result:

- install completes without errors
- a `node_modules` folder is created at the repo root

### 5.2 Create local env files

From the repo root:

```powershell
Copy-Item packages/api/.env.example packages/api/.env.local
Copy-Item app/admin-web/.env.example app/admin-web/.env.local
Copy-Item app/public-web/.env.example app/public-web/.env.local
```

At minimum, local values should be:

- `packages/api/.env.local`
  - `APP_ENV=local`
  - `PORT=4000`
  - `MONGODB_URI=mongodb://127.0.0.1:27017/cjlaundry`
  - `SESSION_SECRET=replace-me`
  - `SESSION_COOKIE_SECURE=false`
  - `TRUST_PROXY=false`
  - `ADMIN_USERNAME=admin`
  - `ADMIN_PASSWORD=admin123`
- `app/admin-web/.env.local`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`
- `app/public-web/.env.local`
  - `NEXT_PUBLIC_API_BASE_URL=http://localhost:4000`

### 5.3 Run local verification

From the repo root:

```powershell
npm run lint
npm run typecheck
npm run audit:prod
npm test
npm run build
npm run security:scan
docker compose config
```

Then optionally boot local containers:

```powershell
npm run docker:up
```

Manual checks:

- `http://localhost:4000/health`
- `http://localhost:4000/ready`
- `http://localhost:3001`
- `http://localhost:3000`

Stop local containers when done:

```powershell
npm run docker:down
```

What done looks like:

- lint and typecheck pass
- tests pass
- build passes
- audit and local security scan pass
- compose config renders
- `/health` responds successfully
- `/ready` responds successfully

## 6. Step 2: Generate the SSH Keys GitHub Actions Will Use

Each environment should have its own SSH key pair. Do not reuse the same key for staging and production.

### 6.1 Create the staging key pair

Run this on your machine:

```powershell
ssh-keygen -t ed25519 -C "github-actions-staging" -f "$HOME\\.ssh\\cjl-staging-actions"
```

This creates:

- private key: `$HOME\.ssh\cjl-staging-actions`
- public key: `$HOME\.ssh\cjl-staging-actions.pub`

### 6.2 Create the production key pair

```powershell
ssh-keygen -t ed25519 -C "github-actions-production" -f "$HOME\\.ssh\\cjl-production-actions"
```

### 6.3 Where these key files go

- the `.pub` file goes onto the VM deploy user's `authorized_keys`
- the private key file content goes into GitHub environment secret:
  - `STAGING_VM_SSH_PRIVATE_KEY`
  - `PRODUCTION_VM_SSH_PRIVATE_KEY`

To print the public key:

```powershell
Get-Content "$HOME\\.ssh\\cjl-staging-actions.pub"
Get-Content "$HOME\\.ssh\\cjl-production-actions.pub"
```

To print the private key when filling GitHub secrets:

```powershell
Get-Content "$HOME\\.ssh\\cjl-staging-actions"
Get-Content "$HOME\\.ssh\\cjl-production-actions"
```

Paste the full private key including the `BEGIN` and `END` lines into GitHub.

## 7. Step 3: Provision the GCP VMs

You need two Ubuntu VMs:

- one for staging
- one for production

### 7.1 Recommended starting VM shape

Use this unless you intentionally want something larger:

| Setting | Recommendation |
| --- | --- |
| OS | Ubuntu 24.04 LTS |
| Machine type | `e2-standard-2` |
| Disk | 40 GB balanced persistent disk |

Reason:

- the VM must run Docker
- the VM must build three app images locally during deployment
- smaller shapes tend to make build time and memory pressure worse

### 7.2 Reserve static IPs

Before creating DNS records, reserve:

- one static IP for the staging VM
- one static IP for the production VM

### 7.3 Create the VMs

Create:

- staging VM
- production VM

Important:

- enable SSH access for your admin account first
- keep note of the public IP for each VM
- do not rely on ephemeral IPs for public DNS

### 7.4 Open required firewall ports

Allow inbound:

- `22/tcp`
- `80/tcp`
- `443/tcp`

Do not expose:

- `27017`
- `3000`
- `3001`
- `4000`

Those stay private inside the VM host and Docker network.

## 8. Step 4: Bootstrap the Deploy User on Each VM

This repo now includes a VM bootstrap script so you do not have to do package installation and deploy-user setup manually line by line.

### 8.1 Copy the bootstrap script to the staging VM

From your machine:

```powershell
scp .\deploy\scripts\bootstrap-vm.sh <your-admin-user>@<staging-vm-ip>:/tmp/bootstrap-vm.sh
```

### 8.2 Run the bootstrap script on staging

SSH into the staging VM as your existing admin user, then run:

```bash
chmod +x /tmp/bootstrap-vm.sh
sudo bash /tmp/bootstrap-vm.sh staging cjl-staging-deploy "PASTE_THE_STAGING_PUBLIC_KEY_HERE"
```

This script will:

- install Docker Engine and the Compose plugin
- create user `cjl-staging-deploy` if missing
- install the public key into `/home/cjl-staging-deploy/.ssh/authorized_keys`
- add the user to the `docker` group
- create `/opt/cjl/staging/releases`
- create `/opt/cjl/staging/shared`
- create the shared Caddy and Mongo bind-mount directories
- enable UFW for SSH, HTTP, and HTTPS

Ubuntu package note:

- some images expose Docker Compose as `docker-compose-plugin`
- others expose it as `docker-compose-v2`
- the bootstrap script now auto-detects and installs whichever package exists on the target image

### 8.3 Run the bootstrap script on production

Repeat the same process on the production VM:

```powershell
scp .\deploy\scripts\bootstrap-vm.sh <your-admin-user>@<production-vm-ip>:/tmp/bootstrap-vm.sh
```

Then on the production VM:

```bash
chmod +x /tmp/bootstrap-vm.sh
sudo bash /tmp/bootstrap-vm.sh production cjl-production-deploy "PASTE_THE_PRODUCTION_PUBLIC_KEY_HERE"
```

### 8.4 Verify the deploy user before touching GitHub

From your machine, test SSH using the private key you generated earlier.

Example for staging:

```powershell
ssh -i "$HOME\\.ssh\\cjl-staging-actions" cjl-staging-deploy@<staging-vm-ip> "docker version"
```

Example for production:

```powershell
ssh -i "$HOME\\.ssh\\cjl-production-actions" cjl-production-deploy@<production-vm-ip> "docker version"
```

If this fails, GitHub Actions will also fail. Fix this before continuing.

### 8.5 Capture the host fingerprint for GitHub

GitHub Actions needs `known_hosts` so SSH host verification is strict.

From your machine:

```powershell
ssh-keyscan -H <staging-vm-ip>
ssh-keyscan -H <production-vm-ip>
```

Save the full output lines into:

- `STAGING_VM_SSH_KNOWN_HOSTS`
- `PRODUCTION_VM_SSH_KNOWN_HOSTS`

Windows OpenSSH note:

- some Windows `ssh-keyscan` builds fail against newer Ubuntu images with errors like `unsupported KEX method sntrup761x25519-sha512@openssh.com`
- if that happens, use normal SSH once to accept the host key locally:

```powershell
ssh -o StrictHostKeyChecking=accept-new -o HashKnownHosts=no <user>@<vm-host> "exit"
```

- then read the matching line from `$HOME\.ssh\known_hosts` and paste that value into the GitHub environment secret
- if needed, use WSL or Git Bash for `ssh-keyscan -H <vm-host>` instead of Windows PowerShell OpenSSH

## 9. Step 5: Configure DNS

All hosted domains for one environment point to the same VM. Caddy routes traffic to the correct internal service by hostname.

### 9.1 Staging DNS records

Point these names to the staging VM static IP:

- `api-staging.cjlaundry.com`
- `admin-staging.cjlaundry.com`
- `staging.cjlaundry.com`

### 9.2 Production DNS records

Point these names to the production VM static IP:

- `api.cjlaundry.com`
- `admin.cjlaundry.com`
- `cjlaundry.com`

After saving DNS, wait for propagation before debugging TLS.

## 10. Step 6: Fill GitHub Environments and Secrets

Go to:

- the GitHub repository
- `Settings`
- `Environments`

You need two GitHub environments:

- `staging`
- `production`

### 10.1 Create the environments

In GitHub:

1. open repository `Settings`
2. click `Environments`
3. click `New environment`
4. create `staging`
5. create `production`

Recommended protection:

- `staging`: no reviewer requirement is fine
- `production`: add required reviewers if your team wants a manual gate

### 10.2 Add staging environment secrets

Open the `staging` environment, then use `Add secret` for each value below.

| Secret | What to paste |
| --- | --- |
| `STAGING_VM_HOST` | staging VM public IP or DNS |
| `STAGING_VM_USER` | `cjl-staging-deploy` |
| `STAGING_VM_SSH_PRIVATE_KEY` | full contents of `$HOME\.ssh\cjl-staging-actions` |
| `STAGING_VM_SSH_KNOWN_HOSTS` | full output of `ssh-keyscan -H <staging-vm-ip>` |
| `STAGING_VM_SSH_PORT` | `22` unless you intentionally changed SSH port |
| `STAGING_CADDY_EMAIL` | the email Caddy should use for ACME |
| `STAGING_MONGO_ROOT_USERNAME` | strong Mongo root username |
| `STAGING_MONGO_ROOT_PASSWORD` | strong Mongo root password |
| `STAGING_MONGO_DATABASE` | usually `cjlaundry` |
| `STAGING_MONGO_REPLICA_KEY` | long alphanumeric or base64-safe internal Mongo replica-set key |
| `STAGING_SESSION_SECRET` | long random secret |
| `STAGING_WHATSAPP_GATEWAY_TOKEN` | shared internal token for API <-> WhatsApp gateway auth |
| `STAGING_DEPLOY_RESET_TOKEN` | long random token used only by deploy workflow to decide whether to wipe containers and persistent volumes |
| `STAGING_ADMIN_BOOTSTRAP_USERNAME` | first admin username |
| `STAGING_ADMIN_BOOTSTRAP_PASSWORD` | plaintext first admin password used for bootstrap seeding |

### 10.3 Add production environment secrets

Open the `production` environment and add:

| Secret | What to paste |
| --- | --- |
| `PRODUCTION_VM_HOST` | production VM public IP or DNS |
| `PRODUCTION_VM_USER` | `cjl-production-deploy` |
| `PRODUCTION_VM_SSH_PRIVATE_KEY` | full contents of `$HOME\.ssh\cjl-production-actions` |
| `PRODUCTION_VM_SSH_KNOWN_HOSTS` | full output of `ssh-keyscan -H <production-vm-ip>` |
| `PRODUCTION_VM_SSH_PORT` | `22` unless you intentionally changed SSH port |
| `PRODUCTION_CADDY_EMAIL` | the email Caddy should use for ACME |
| `PRODUCTION_MONGO_ROOT_USERNAME` | strong Mongo root username |
| `PRODUCTION_MONGO_ROOT_PASSWORD` | strong Mongo root password |
| `PRODUCTION_MONGO_DATABASE` | usually `cjlaundry` |
| `PRODUCTION_MONGO_REPLICA_KEY` | long alphanumeric or base64-safe internal Mongo replica-set key |
| `PRODUCTION_SESSION_SECRET` | long random secret |
| `PRODUCTION_WHATSAPP_GATEWAY_TOKEN` | shared internal token for API <-> WhatsApp gateway auth |
| `PRODUCTION_DEPLOY_RESET_TOKEN` | long random token used only by deploy workflow to decide whether to wipe containers and persistent volumes |
| `PRODUCTION_ADMIN_BOOTSTRAP_USERNAME` | first admin username |
| `PRODUCTION_ADMIN_BOOTSTRAP_PASSWORD` | plaintext first admin password used for bootstrap seeding |

### 10.4 Generate secure values

Generate a session secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Important:

- store the real admin password in a secure secret manager before pasting it into GitHub
- GitHub now stores the plaintext bootstrap password and the API hashes it before storing it in MongoDB
- on each hosted deploy/startup, the single `admin-primary` account is synchronized to the configured bootstrap username and password
- generate a separate `*_MONGO_REPLICA_KEY` value and keep it stable for the life of that environment unless you intentionally rotate Mongo internal auth
- generate a separate `*_DEPLOY_RESET_TOKEN` value and keep it stable unless you intentionally want the next deploy to destroy containers plus persistent data directories (`mongo-data`, `whatsapp-auth`, `caddy-data`, `caddy-config`)
- staging and production boots now reject placeholder or obviously default values for critical secrets, so do not leave values like `replace-me` in any hosted secret

### 10.5 What GitHub will write onto the VM

During deployment, GitHub Actions renders a runtime file and uploads it here:

- staging: `/opt/cjl/staging/shared/runtime.env`
- production: `/opt/cjl/production/shared/runtime.env`

That file is built from the environment secrets above. It is the hosted equivalent of a local `.env.local`.

## 11. Step 7: Understand What GitHub Actions Will Do

This matters because it tells you what must already be correct before the first deploy.

### 11.1 CI workflow

`.github/workflows/ci.yml` runs:

- `npm ci`
- `npm run lint`
- `npm run typecheck`
- `npm run audit:prod`
- `npm test`
- `npm run build`
- `npm run security:scan`
- `docker compose config`
- `docker compose build`

Security-specific automation also runs in GitHub:

- dependency review on pull requests
- CodeQL static analysis
- Gitleaks secret scanning
- Trivy filesystem scanning

### 11.2 Staging deploy workflow

`.github/workflows/deploy-staging.yml`:

1. waits for `CI` to succeed on branch `staging`
2. checks out the exact commit that passed CI
3. starts an SSH agent with `STAGING_VM_SSH_PRIVATE_KEY`
4. verifies the VM host using `STAGING_VM_SSH_KNOWN_HOSTS`
5. creates `/opt/cjl/staging/releases/<git-sha>` on the VM
6. streams a `git archive` tarball into that release directory
7. renders `runtime.env` from GitHub secrets
8. uploads that file to `/opt/cjl/staging/shared/runtime.env`
9. runs `deploy/scripts/remote-deploy.sh` on the VM
10. smoke-checks the staging URLs

Important first-deploy behavior:

- `remote-deploy.sh` now waits for `mongo`, `api`, `whatsapp-gateway`, `admin-web`, `public-web`, and `caddy` to become healthy or running before GitHub starts the external smoke checks
- the external smoke check now retries broader edge failures, including transient TLS handshake failures, because first-time Caddy ACME issuance can lag behind container startup on a clean VM
- GitHub Actions logs now print a short SHA-256 fingerprint of `STAGING_WHATSAPP_GATEWAY_TOKEN` for both `api` and `whatsapp-gateway`, so you can confirm both services are using the same secret without exposing the raw token
- if `STAGING_DEPLOY_RESET_TOKEN` changes compared with the last successful deploy, the workflow tears down the stack and deletes persistent data directories before rebuilding

### 11.3 Production deploy workflow

`.github/workflows/deploy-production.yml` does the same shape for `main` and the production VM.

On a first production deploy, this distinction matters:

- internal service readiness proves the stack is booted
- public HTTPS readiness still depends on Caddy finishing certificate issuance for the public domains
- the workflow now tolerates this warm-up window better, but DNS and ports `80` and `443` must still already be correct
- GitHub Actions logs now print a short SHA-256 fingerprint of `PRODUCTION_WHATSAPP_GATEWAY_TOKEN` for both `api` and `whatsapp-gateway`, so you can verify parity without leaking the real token
- if `PRODUCTION_DEPLOY_RESET_TOKEN` changes compared with the last successful deploy, the workflow destroys containers and deletes persistent data directories before recreating the stack

### 11.4 Why there is no image registry secret

This repo intentionally does not push app images from GitHub.

Deployment flow is:

1. GitHub checks out the selected commit
2. GitHub streams that release to the VM over SSH
3. the VM runs `docker compose up -d --build`

So:

- no GHCR token is required
- no registry pull secret is required
- the VM builds directly from the exact code shipped over SSH

## 12. Step 8: First Staging Rollout

Do not do this until all earlier steps are complete.

For operator-friendly execution steps, run this section together with `internals/releaseExecutionChecklist.md`.

### 12.1 Final pre-flight checklist

Before pushing for staging, confirm:

- local `npm test` passed
- local `npm run build` passed
- local `docker compose config` passed
- staging VM is reachable over SSH as `cjl-staging-deploy`
- `docker version` works when logged in as the deploy user
- staging DNS records resolve to the staging VM
- GitHub `staging` environment exists
- all staging secrets are filled
- branch `staging` exists and contains the desired code

### 12.2 Trigger the rollout

1. push the desired commit to branch `staging`
2. open the `Actions` tab in GitHub
3. wait for `CI` to finish successfully on `staging`
4. wait for `Deploy Staging` to start automatically
5. watch the job until every step passes

If `Deploy Staging` does not start, the most likely reason is that `CI` did not finish successfully on `staging`.

### 12.3 What the staging workflow writes on the VM

The staging deploy writes:

- `/opt/cjl/staging/releases/<git-sha>/...`
- `/opt/cjl/staging/shared/runtime.env`
- `/opt/cjl/staging/current`
- `/opt/cjl/staging/current_release`

This is useful later for debugging and rollback.

## 13. Step 9: Validate Staging

After the staging workflow succeeds, verify:

- `https://api-staging.cjlaundry.com/health`
- `https://api-staging.cjlaundry.com/ready`
- `https://admin-staging.cjlaundry.com`
- `https://staging.cjlaundry.com`

### 13.1 API checks

Confirm:

- `/health` returns success
- `/ready` returns success
- `/ready` includes release metadata and dependency state
- API responses include `X-Request-Id`

`/ready` is the stronger check because it proves:

- MongoDB is reachable
- settings seed exists
- bootstrap admin seed exists

### 13.2 Admin checks

Log in with the staging bootstrap admin credentials and confirm:

- login works
- logout works
- dashboard loads
- customer search works

### 13.3 Core business checks

Manually validate:

1. create a customer
2. repeat the same create call with the same `Idempotency-Key` and confirm it replays safely
3. preview an order
4. confirm an order
5. open the active order list
6. mark the order done
7. check the customer points balance and ledger history
8. log in to the public portal with the created customer
9. open the direct order status link

If any of these fail, do not deploy production yet.

### 13.4 Observability and hardening checks

On staging, also confirm:

- API and WhatsApp gateway logs are JSON logs, not dev-only console output
- the same `X-Request-Id` visible in browser/network tools can be found in the API container logs
- expected error responses include `message`, `error.code`, and `error.requestId`
- admin/public/API domains return the expected security headers
- trusted-origin enforcement blocks invalid cross-origin state-changing requests
- Mongo-backed rate limiting survives process restarts for login and token-redeem paths
- real-device WhatsApp pairing and reconnect work after a container restart
- rollback can return the VM to the last healthy release if a smoke check fails

## 14. Step 10: First Production Rollout

Only do this after staging is healthy and manually validated.

For operator-friendly execution steps, run this section together with `internals/releaseExecutionChecklist.md`.

### 14.1 Pre-flight checklist

Confirm:

- the production VM is reachable over SSH as `cjl-production-deploy`
- production DNS resolves correctly
- production GitHub environment secrets are filled
- the exact commit was already validated in staging
- `internals/productionReadinessChecklist.md` is fully checked off

### 14.2 Trigger production

Production auto-deploys from pushes to `main` after `CI` succeeds.

For the first production rollout:

1. merge or push the staging-validated commit to `main`
2. wait for `CI` to succeed on `main`
3. wait for `Deploy Production` to start automatically
4. monitor the workflow to completion

You may also trigger `Deploy Production` manually with `workflow_dispatch` and a specific `git_ref`.

### 14.3 Validate production

Check:

- `https://api.cjlaundry.com/health`
- `https://api.cjlaundry.com/ready`
- `https://admin.cjlaundry.com`
- `https://cjlaundry.com`

Then repeat the same business smoke checks you used in staging.

For the first production push, also assign one operator to review the first hour of logs for:

- `401` spikes
- `429` spikes
- `5xx` spikes
- notification delivery failures
- gateway disconnect or auth failures

## 15. Runtime Env Shape

The GitHub workflows render the real runtime env file from environment secrets, but these example files define the expected shape:

- `deploy/env/runtime.staging.env.example`
- `deploy/env/runtime.production.env.example`

The most important variables are:

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `staging` or `production` |
| `RELEASE_SHA` | git SHA rendered by deploy workflow for log correlation and `/ready` |
| `LOG_LEVEL` | runtime logger threshold |
| `COMPOSE_PROJECT_NAME` | compose project name for the environment |
| `SHARED_DIR` | bind-mount location for Mongo and Caddy state |
| `ADMIN_DOMAIN` | admin hostname |
| `PUBLIC_DOMAIN` | public hostname |
| `API_DOMAIN` | API hostname |
| `CADDY_EMAIL` | ACME email for TLS |
| `MONGO_*` | Mongo credentials and database |
| `MONGO_REPLICA_KEY` | internal Mongo replica-set keyfile source used when auth is enabled |
| `SESSION_SECRET` | session-signing secret |
| `WHATSAPP_ENABLED` | turns the real WhatsApp gateway integration on or off |
| `WHATSAPP_GATEWAY_TOKEN` | shared internal auth token between API and WhatsApp gateway |
| `WHATSAPP_AUTH_DIR` | runtime path mounted into the WhatsApp gateway for persistent auth state |
| `ADMIN_BOOTSTRAP_*` | first admin seed |
| `WA_FAIL_MODE` | failure simulation mode; keep `never` in hosted envs |

Hosted runtime note:

- `SESSION_COOKIE_SECURE=true` and `TRUST_PROXY=1` are enforced inside the hosted API service definition
- staging and production boot reject placeholder secrets, unsafe non-HTTPS origins, and missing hosted security-critical values

## 16. Rollback

Rollback is part of deployment. Do not deploy if you are not comfortable reversing the change.

### 16.1 Preferred rollback

Re-run the deploy workflow against the last known good `git_ref`.

This restores:

- the prior shipped repo release
- a fresh local build on the VM from that release
- the prior `current` symlink target

### 16.2 Emergency rollback directly on the VM

If GitHub Actions is unavailable:

1. SSH into the affected VM
2. list `/opt/cjl/<env>/releases`
3. choose the last known good release SHA
4. run the rollback script

Example for staging:

```bash
bash /opt/cjl/staging/current/deploy/scripts/remote-rollback.sh \
  staging \
  <known-good-release-sha> \
  /opt/cjl/staging \
  /opt/cjl/staging/shared/runtime.env
```

Example for production:

```bash
bash /opt/cjl/production/current/deploy/scripts/remote-rollback.sh \
  production \
  <known-good-release-sha> \
  /opt/cjl/production \
  /opt/cjl/production/shared/runtime.env
```

### 16.3 What rollback does not do

Rollback does not revert business writes already committed to MongoDB after the bad release went live.

Rollback restores code and runtime state, not user history.

## 17. Troubleshooting

### 17.1 `/ready` fails but `/health` works

Likely causes:

- wrong Mongo credentials in runtime env
- Mongo container is unhealthy
- bootstrap seed documents were not created
- hosted env validation rejected a placeholder secret or unsafe hosted origin setting

Check:

- `/opt/cjl/<env>/shared/runtime.env`
- `docker compose logs api`
- `docker compose logs mongo`

### 17.2 GitHub Actions cannot SSH into the VM

Check:

- `*_VM_HOST`
- `*_VM_USER`
- `*_VM_SSH_PRIVATE_KEY`
- `*_VM_SSH_KNOWN_HOSTS`
- `*_VM_SSH_PORT`

Manual verification tip:

- try SSH from your machine with the same private key first
- if that fails, GitHub Actions will fail too

### 17.3 The VM deploy starts but image build fails

Check:

- available disk space
- available memory
- whether Docker is running
- whether the release directory contains the expected repo files

Useful commands:

```bash
df -h
free -h
docker system df
```

### 17.4 TLS certificate does not issue

Likely causes:

- domain points to the wrong IP
- ports `80` or `443` are blocked
- Caddy is not reachable

Check:

- DNS resolution
- GCP firewall rules
- `docker compose logs caddy`

If the deploy only fails during the immediate GitHub smoke check on a first rollout:

- verify whether internal API health is already good on the VM with `curl http://127.0.0.1:4000/health`
- if internal health succeeds but public HTTPS still fails, treat it as an edge TLS readiness problem rather than an API outage
- recent workflow changes now retry transient TLS errors and wait for container readiness first, but they do not replace correct DNS or open ports

### 17.5 Admin bootstrap login fails

Check:

- `*_ADMIN_BOOTSTRAP_USERNAME`
- `*_ADMIN_BOOTSTRAP_PASSWORD`
- whether the bootstrap password secret matches the password you are trying to use

Important:

- the bootstrap admin account is re-synced on startup to match the configured bootstrap username and password
- changing the bootstrap password secret and redeploying will rotate the login credentials for the single seeded admin account

### 17.6 WhatsApp pairing code fails or QR keeps loading forever

Check from the admin WhatsApp page first:

- `Gateway aktif` must be visible
- pairing-code mode should not display an old QR at the same time
- if the page shows `Auth Gagal` or `Terputus`, use `Reset Session` before retrying pairing

Then verify runtime config on the VM:

- `WHATSAPP_GATEWAY_TOKEN` in `/opt/cjl/<env>/shared/runtime.env` is not a placeholder and matches both `api` and `whatsapp-gateway`
- `WHATSAPP_ENABLED=true`
- the shared auth mount exists at `/opt/cjl/<env>/shared/whatsapp-auth`

Useful commands:

```bash
cd /opt/cjl/<env>/current
docker compose --env-file /opt/cjl/<env>/shared/runtime.env -f deploy/api/docker-compose.remote.yml logs api --tail 100
docker compose --env-file /opt/cjl/<env>/shared/runtime.env -f deploy/api/docker-compose.remote.yml logs whatsapp-gateway --tail 100
curl -s http://127.0.0.1:4100/health
```

Interpretation:

- if `api` logs mention gateway unauthorized or internal auth mismatch, fix `WHATSAPP_GATEWAY_TOKEN` and redeploy
- if `whatsapp-gateway` logs show auth failure or stale browser/session issues, run `Reset Session` from admin and pair again
- if pairing code succeeds but the phone still shows an old QR flow, refresh the page and confirm the panel is in pairing-code mode before scanning anything

## 18. Final Checklist

You are ready when all of the following are true:

- local `.env.local` files exist
- local `npm test` succeeds
- local `npm run build` succeeds
- local `docker compose config` succeeds
- staging and production SSH key pairs exist
- staging and production deploy users can log in over SSH with those keys
- staging and production VMs have Docker running
- `/opt/cjl/staging` and `/opt/cjl/production` directory trees exist
- staging and production DNS records point to the correct VM IPs
- GitHub environments `staging` and `production` exist
- all required environment secrets are filled
- `CI` succeeds on `staging`
- staging deploy completes successfully
- staging smoke checks pass
- staging business flow passes manual validation
- staging WhatsApp admin page shows `Gateway aktif` and can recover with `Reset Session` if pairing is stuck
- production deploy is ready to run
