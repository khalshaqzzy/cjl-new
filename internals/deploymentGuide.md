# CJ Laundry Deployment Guide

Document status: Active  
Last updated: 2026-03-21  
Scope: full setup and deployment runbook for local, staging, and production

This is the canonical step-by-step deployment guide for CJ Laundry. It is written for a junior-level developer who needs to set the project up from scratch, understand where every value goes, and deploy safely without guessing.

If you follow this file from top to bottom, you should end with:

- a working local environment
- a provisioned staging environment
- a documented path to production deployment
- a rollback path if something goes wrong

## 1. Read This First

### What this guide covers

- local development setup
- local Docker Compose runtime
- staging and production GCP VM setup
- GitHub Actions CI and deploy workflows
- DNS and TLS routing with Caddy
- first staging rollout
- first production rollout
- smoke tests and rollback

### What this guide does not cover

- writing product code
- changing business logic
- advanced host hardening beyond the repo baseline
- operational WhatsApp bot persistence, because that runtime is not implemented in this repo yet

### How to use this guide

Work in this order:

1. understand the environment topology
2. prepare your local machine and local env files
3. provision GCP VMs and DNS
4. add GitHub environments and secrets
5. validate the branch-based workflows
6. deploy staging
7. validate staging
8. deploy production

Do not skip straight to production. Staging is the safety checkpoint.

## 2. Environment Topology

| Environment | Public web | Admin web | API | Runtime target | Notes |
| --- | --- | --- | --- | --- | --- |
| `local` | `http://localhost:3000` | `http://localhost:3001` | `http://localhost:4000` | local machine | day-to-day development |
| `staging` | `https://staging.cjlaundry.site` | `https://admin-staging.cjlaundry.site` | `https://api-staging.cjlaundry.site` | one GCP VM + Docker Compose + Caddy | auto-deploy from branch `staging` |
| `production` | `https://cjlaundry.site` | `https://admin.cjlaundry.site` | `https://api.cjlaundry.site` | one GCP VM + Docker Compose + Caddy | auto-deploy from branch `main` |

Important architecture rule from the PRD:

- all three public surfaces for one environment live on the same VM
- MongoDB stays on the VM Docker network and is not exposed publicly
- GitHub Actions does not build deployment images
- GitHub Actions only ships the selected release to the VM over SSH and then tells the VM to build locally

## 3. Before You Start

Before touching any cloud setup, confirm all of the following:

- you can access this GitHub repository
- you can edit GitHub Actions secrets and environments
- you have Node.js and npm working locally
- you can create GCP Compute Engine VMs
- you can edit DNS for `cjlaundry.site`
- you can add SSH keys for the deployment user on each VM

If even one of those is missing, pause and get access first. Otherwise you will get blocked halfway through setup.

### 3.1 Tools to install on your machine

Install these before you start the setup:

- Git
- Node.js 22.x
- npm 10.x or newer
- Docker Desktop or Docker Engine for local container testing
- optional: Google Cloud CLI

Helpful install checks:

```powershell
node -v
npm -v
docker --version
docker compose version
```

The GitHub deployment flow does not require local GCloud or SSH tooling if you only trigger Actions from the browser, but having both locally is useful for debugging.

### 3.2 What success looks like

By the end of this guide, a junior developer should be able to answer these questions clearly:

- which domains belong to local, staging, and production
- which values live in local `.env` files
- which values live in GitHub environment secrets
- how the release gets from GitHub to the VM
- why the VM builds images itself instead of pulling prebuilt images from GitHub
- how to roll back if a deploy breaks

## 4. Repo Files That Matter

These are the main files you will keep referring to:

### Local env examples

- `packages/api/.env.example`
- `app/admin-web/.env.example`
- `app/public-web/.env.example`

These are for local development only. Do not paste staging or production secrets into them.

### Deployment reference env examples

- `deploy/env/runtime.staging.env.example`
- `deploy/env/runtime.production.env.example`

These are reference files. GitHub Actions renders the actual runtime env file on the target VM later.

### Deployment assets

- `deploy/api/docker-compose.remote.yml`
- `deploy/api/Caddyfile`
- `deploy/scripts/remote-deploy.sh`
- `deploy/scripts/remote-rollback.sh`
- `deploy/scripts/smoke-check.sh`

### Automation files

- `.github/workflows/ci.yml`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`

## 5. Step 1: Prepare Local Development First

Do this before staging or production. It proves the repo is healthy on your machine.

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

### 5.3 Understand what is local-only

These files stay on your machine and should never be committed:

- `packages/api/.env.local`
- `app/admin-web/.env.local`
- `app/public-web/.env.local`

Use them for local development only. Do not paste staging or production secrets into them.

### 5.4 Run local verification

From the repo root:

```powershell
npm test
npm run build
```

Then optionally boot local containers:

```powershell
npm run docker:up
```

Manual health checks:

- `http://localhost:4000/health`
- `http://localhost:4000/ready`
- `http://localhost:3001`
- `http://localhost:3000`

Stop local containers when done:

```powershell
npm run docker:down
```

What done looks like:

- the repo builds
- the repo tests pass
- `/health` responds successfully
- `/ready` responds successfully

## 6. Step 2: Understand the Hosted Runtime Shape

Hosted staging and production use the same shape:

- one Ubuntu VM per environment
- Docker Engine + Compose plugin on the VM
- Caddy as reverse proxy and TLS terminator
- MongoDB, API, admin web, and public web all run in Docker Compose
- GitHub Actions copies the selected git release to the VM over SSH
- the VM builds containers locally from that release

This means:

- no GHCR image publication is required
- no registry pull secret is required
- the VM must have enough CPU, RAM, and disk to build the app images locally

## 7. Step 3: Prepare GCP VMs

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

- the VM must both run containers and build them locally during deployment
- `e2-small` is usually too constrained for smooth multi-image builds

### 7.2 Reserve static IPs

Before creating DNS records, reserve:

- one static IP for the staging VM
- one static IP for the production VM

### 7.3 Create the VMs

Create:

- staging VM
- production VM

Make sure SSH access works for the user GitHub Actions will use later.

What done looks like:

- each VM has a public IP
- you can SSH into each VM manually
- you know which VM is staging and which is production

### 7.4 Open required firewall ports

Allow inbound:

- `22/tcp`
- `80/tcp`
- `443/tcp`

Do not expose MongoDB or the internal app ports directly to the public internet.

### 7.5 Install required packages on each VM

SSH into each VM and run:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ca-certificates curl git docker.io docker-compose-plugin
sudo systemctl enable docker
sudo systemctl start docker
```

### 7.6 Create required directories on each VM

On each VM run:

```bash
sudo mkdir -p /opt/cjl/staging/releases /opt/cjl/staging/shared
sudo mkdir -p /opt/cjl/production/releases /opt/cjl/production/shared
sudo chown -R "$USER":"$USER" /opt/cjl
```

These paths are used by the workflows and scripts already committed in this repo.

### 7.7 Optional Docker convenience

If you want to use Docker without `sudo` after reconnecting:

```bash
sudo usermod -aG docker "$USER"
newgrp docker
```

## 8. Step 4: Set Up DNS

All hosted domains for one environment point to the same VM. Caddy routes traffic to the correct internal service by hostname.

### 8.1 Staging DNS records

Point these names to the staging VM static IP:

- `api-staging.cjlaundry.site`
- `admin-staging.cjlaundry.site`
- `staging.cjlaundry.site`

### 8.2 Production DNS records

Point these names to the production VM static IP:

- `api.cjlaundry.site`
- `admin.cjlaundry.site`
- `cjlaundry.site`

After you save the records, wait for DNS propagation before troubleshooting TLS.

## 9. Step 5: Fill GitHub Environments and Secrets

Go to:

- repository Settings
- Secrets and variables
- Actions

You need environment-level secrets because staging and production have different VMs and different credentials.

### 9.1 Create GitHub environments

Create:

- `staging`
- `production`

### 9.2 Add staging environment secrets

Inside the GitHub `staging` environment, add:

| Secret | Purpose |
| --- | --- |
| `STAGING_VM_HOST` | public IP or DNS of the staging VM |
| `STAGING_VM_USER` | SSH user used by Actions |
| `STAGING_VM_SSH_PRIVATE_KEY` | private key for that SSH user |
| `STAGING_VM_SSH_KNOWN_HOSTS` | known_hosts entry for the staging VM |
| `STAGING_VM_SSH_PORT` | optional custom SSH port, otherwise `22` |
| `STAGING_CADDY_EMAIL` | email used for TLS/Let's Encrypt |
| `STAGING_MONGO_ROOT_USERNAME` | Mongo root username for staging |
| `STAGING_MONGO_ROOT_PASSWORD` | Mongo root password for staging |
| `STAGING_MONGO_DATABASE` | Mongo database name, usually `cjlaundry` |
| `STAGING_SESSION_SECRET` | session secret, minimum 32 chars |
| `STAGING_ADMIN_BOOTSTRAP_USERNAME` | bootstrap admin username |
| `STAGING_ADMIN_BOOTSTRAP_PASSWORD_HASH` | bcrypt hash of the bootstrap password |

### 9.3 Add production environment secrets

Inside the GitHub `production` environment, add:

| Secret | Purpose |
| --- | --- |
| `PRODUCTION_VM_HOST` | public IP or DNS of the production VM |
| `PRODUCTION_VM_USER` | SSH user used by Actions |
| `PRODUCTION_VM_SSH_PRIVATE_KEY` | private key for that SSH user |
| `PRODUCTION_VM_SSH_KNOWN_HOSTS` | known_hosts entry for the production VM |
| `PRODUCTION_VM_SSH_PORT` | optional custom SSH port, otherwise `22` |
| `PRODUCTION_CADDY_EMAIL` | email used for TLS/Let's Encrypt |
| `PRODUCTION_MONGO_ROOT_USERNAME` | Mongo root username for production |
| `PRODUCTION_MONGO_ROOT_PASSWORD` | Mongo root password for production |
| `PRODUCTION_MONGO_DATABASE` | Mongo database name, usually `cjlaundry` |
| `PRODUCTION_SESSION_SECRET` | session secret, minimum 32 chars |
| `PRODUCTION_ADMIN_BOOTSTRAP_USERNAME` | bootstrap admin username |
| `PRODUCTION_ADMIN_BOOTSTRAP_PASSWORD_HASH` | bcrypt hash of the bootstrap password |

### 9.4 Generate secure values

Generate a session secret:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Generate a bcrypt hash for an admin password:

```bash
node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('replace-with-real-password', 12));"
```

Store the real password somewhere secure before hashing it. After the hash is created, only the hash belongs in GitHub secrets.

### 9.5 Why there is no image registry secret

This repo intentionally does not push app images from GitHub.

Deployment flow is:

1. GitHub checks out the selected commit
2. GitHub streams a tar archive of that release to the VM over SSH
3. the VM runs `docker compose up -d --build`

So:

- no GHCR token is required
- no VM-side GitHub token is required
- the VM builds directly from the exact code release shipped over SSH

## 10. Step 6: Understand What GitHub Actions Will Do

This is important because it tells you what must already be correct before the first deploy.

### 10.1 CI workflow

`.github/workflows/ci.yml` runs:

- `npm ci`
- `npm test`
- `npm run build`
- `docker compose config`

### 10.2 Staging deploy workflow

`.github/workflows/deploy-staging.yml`:

1. waits for `CI` to succeed on branch `staging`
2. checks out the exact commit that passed CI
3. streams that git release to the staging VM over SSH
4. renders `/opt/cjl/staging/shared/runtime.env` on the VM
5. runs `deploy/scripts/remote-deploy.sh` on the VM
6. smoke-checks:
   - `https://api-staging.cjlaundry.site/health`
   - `https://api-staging.cjlaundry.site/ready`
   - `https://admin-staging.cjlaundry.site`
   - `https://staging.cjlaundry.site`

### 10.3 Production deploy workflow

`.github/workflows/deploy-production.yml`:

1. waits for `CI` to succeed on branch `main`
2. checks out the exact commit that passed CI
3. streams that git release to the production VM over SSH
4. renders `/opt/cjl/production/shared/runtime.env` on the VM
5. runs `deploy/scripts/remote-deploy.sh` on the VM
6. smoke-checks:
   - `https://api.cjlaundry.site/health`
   - `https://api.cjlaundry.site/ready`
   - `https://admin.cjlaundry.site`
   - `https://cjlaundry.site`

## 11. Step 7: First Staging Rollout

Do not do this until all earlier steps are complete.

### 11.1 Final pre-flight checklist

Before pushing for staging, confirm:

- the staging VM is reachable over SSH
- Docker is installed and running on the staging VM
- `staging.cjlaundry.site`, `admin-staging.cjlaundry.site`, and `api-staging.cjlaundry.site` resolve to the staging VM
- staging GitHub environment secrets are filled
- branch `staging` exists and contains the code you want

### 11.2 Trigger the rollout

1. push the desired code to branch `staging`
2. wait for `CI` to succeed
3. wait for `Deploy Staging` to start automatically
4. watch the job until all stages pass

If `Deploy Staging` does not start, the most likely reason is that `CI` did not finish successfully on `staging`.

### 11.3 What the workflow writes on the VM

The staging deploy writes:

- `/opt/cjl/staging/releases/<git-sha>/...` for the shipped repo release
- `/opt/cjl/staging/shared/runtime.env`
- `/opt/cjl/staging/current` as a symlink to the active release
- `/opt/cjl/staging/current_release`

This is useful when debugging or rolling back later.

## 12. Step 8: Validate Staging

After the staging workflow succeeds, verify these URLs manually:

- `https://api-staging.cjlaundry.site/health`
- `https://api-staging.cjlaundry.site/ready`
- `https://admin-staging.cjlaundry.site`
- `https://staging.cjlaundry.site`

### 12.1 API checks

Confirm:

- `/health` returns success
- `/ready` returns success

`/ready` is the stronger check because it proves:

- MongoDB is reachable
- settings seed exists
- bootstrap admin seed exists

### 12.2 Admin checks

Log in using the staging bootstrap admin credentials and confirm:

- login works
- logout works
- dashboard loads
- customer search works

### 12.3 Core business checks

Manually validate:

1. create a customer
2. repeat the same create call with the same `Idempotency-Key` and confirm it replays safely
3. preview an order
4. confirm an order
5. open the active order list
6. mark the order done
7. check the customer points balance and ledger history
8. login to the public portal with the created customer
9. open the direct order status link

If any of these fail, do not deploy production yet.

Infrastructure smoke checks only prove the apps are reachable. They do not prove the business flow is correct.

## 13. Step 9: First Production Rollout

Only do this after staging is healthy and manually validated.

### 13.1 Pre-flight checklist

Confirm:

- the production VM is reachable over SSH
- Docker is installed and running on the production VM
- `cjlaundry.site`, `admin.cjlaundry.site`, and `api.cjlaundry.site` resolve to the production VM
- production GitHub environment secrets are filled
- branch `main` contains the exact commit already validated in staging

### 13.2 Trigger production

Production auto-deploys from pushes to `main` after `CI` succeeds.

For the first production rollout:

1. merge or push the staging-validated commit to `main`
2. wait for `CI` to succeed on `main`
3. wait for `Deploy Production` to start automatically
4. monitor the workflow to completion

You may also trigger `Deploy Production` manually with `workflow_dispatch` and a specific `git_ref`.

Junior-level rule:

- never use production as your first test
- if you are unsure which commit to deploy, use the exact commit that already passed staging validation

### 13.3 Validate production

Check:

- `https://api.cjlaundry.site/health`
- `https://api.cjlaundry.site/ready`
- `https://admin.cjlaundry.site`
- `https://cjlaundry.site`

Then repeat the same business smoke checks you used in staging.

## 14. Runtime Env Shape

The GitHub workflows render the actual VM env file from secrets, but these example files describe what belongs there:

- `deploy/env/runtime.staging.env.example`
- `deploy/env/runtime.production.env.example`

The most important variables are:

| Variable | Purpose |
| --- | --- |
| `APP_ENV` | `staging` or `production` |
| `SHARED_DIR` | shared state path for Caddy and Mongo bind mounts |
| `ADMIN_DOMAIN` | admin public hostname |
| `PUBLIC_DOMAIN` | public public hostname |
| `API_DOMAIN` | API public hostname |
| `CADDY_EMAIL` | ACME email for TLS |
| `MONGO_*` | Mongo root credentials and database name |
| `SESSION_SECRET` | session signing secret |
| `ADMIN_BOOTSTRAP_*` | initial admin login seed |
| `WA_FAIL_MODE` | failure simulation mode, should stay `never` in hosted envs |

## 15. Rollback

Rollback is part of deployment. Do not deploy if you are not comfortable reversing the change.

### 15.1 Preferred rollback

Re-run the deploy workflow against the last known good `git_ref`.

This restores:

- the prior shipped repo release
- a fresh local build on the VM from that release
- the prior active `current` symlink target

### 15.2 Emergency rollback directly on the VM

If GitHub Actions is unavailable:

1. SSH into the affected VM
2. list the release directories
3. choose the last known good release SHA
4. run the rollback script directly

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

### 15.3 What rollback does not do

Rollback does not revert database writes that already happened after the bad release went live.

Rollback restores code/runtime state, not business data history.

## 16. Troubleshooting

### 16.1 `/ready` fails but `/health` works

Likely causes:

- wrong Mongo credentials in runtime env
- Mongo container is unhealthy
- bootstrap seed documents were not created

Check:

- `/opt/cjl/<env>/shared/runtime.env`
- `docker compose logs api`
- `docker compose logs mongo`

This pattern usually means the API process is alive, but one of its dependencies is not configured correctly.

### 16.2 TLS certificate does not issue

Likely causes:

- the domain points to the wrong IP
- ports `80` or `443` are blocked
- the VM firewall is not open

Check:

- DNS resolution
- GCP firewall rules
- whether Caddy is actually running

### 16.3 GitHub Actions cannot SSH into the VM

Check:

- `*_VM_HOST`
- `*_VM_USER`
- `*_VM_SSH_PRIVATE_KEY`
- `*_VM_SSH_KNOWN_HOSTS`
- `*_VM_SSH_PORT`

Manual verification tip:

- try SSH from your own terminal with the same host and user first
- if manual SSH fails, GitHub Actions will fail too

### 16.4 The VM deploy starts but image build fails

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

### 16.5 Admin bootstrap login fails

Check:

- `*_ADMIN_BOOTSTRAP_USERNAME`
- `*_ADMIN_BOOTSTRAP_PASSWORD_HASH`
- whether the stored hash actually matches the intended password

Important:

- the bootstrap admin is seeded only if missing
- changing the hash later does not automatically overwrite an already-created admin record

### 16.6 The frontend points at the wrong API

Check the runtime env rendered by GitHub Actions:

- `ADMIN_DOMAIN`
- `PUBLIC_DOMAIN`
- `API_DOMAIN`

Because the frontends are built on the VM, a wrong `API_DOMAIN` value means the built frontend will carry the wrong `NEXT_PUBLIC_API_BASE_URL`.

## 17. Final Checklist

You are ready when all of the following are true:

- local env files exist and local build/test pass
- `docker compose config` succeeds from the repo root
- `https://api-staging.cjlaundry.site`, `https://admin-staging.cjlaundry.site`, and `https://staging.cjlaundry.site` all resolve to the staging VM
- `https://api.cjlaundry.site`, `https://admin.cjlaundry.site`, and `https://cjlaundry.site` all resolve to the production VM
- staging and production VMs are reachable over SSH
- Docker is installed and running on both VMs
- required VM directories exist
- GitHub environments `staging` and `production` exist
- all required environment secrets are filled
- `CI` succeeds on `staging`
- staging deploy completes successfully
- staging smoke tests pass
- staging business flow passes manual validation
- production deploy is ready to run
