# Production Readiness Checklist

Document status: Active  
Last updated: 2026-04-02  
Purpose: final gate checklist before the first production push after Cloud-only WhatsApp cutover prep

## Build And Verification

- `npm run lint` passes
- `npm run typecheck` passes
- `npm run test:backend` passes
- `npm run test:e2e` passes
- `npm run build` passes
- `npm run validate:cloud-runtime` passes
- `npm run audit:prod` passes
- CI security job passes:
  - Gitleaks
  - Trivy filesystem scan
- CodeQL workflow passes on the target commit
- `docker compose config` passes
- `docker compose build` passes in CI

## Runtime And Secrets

- no placeholder secrets remain in staging or production runtime envs
- staging and production deploy workflows fail before release upload if any required Cloud WhatsApp secret is blank
- `SESSION_SECRET` is unique per environment
- `ADMIN_BOOTSTRAP_PASSWORD` is present, non-placeholder, and stored only in runtime secrets
- `SESSION_COOKIE_SECURE=true` in hosted env
- `TRUST_PROXY=1` or `true` in hosted env
- `RELEASE_SHA` is rendered into hosted runtime env on deploy
- `LOG_LEVEL` is explicitly set in hosted runtime env
- staging and production both include:
  - `FIREBASE_DATABASE_URL`
  - `WHATSAPP_PROVIDER=cloud_api`
  - `WHATSAPP_GRAPH_API_VERSION`
  - `WHATSAPP_GRAPH_API_BASE_URL`
  - `WHATSAPP_BUSINESS_ID`
  - `WHATSAPP_WABA_ID`
  - `WHATSAPP_PHONE_NUMBER_ID`
  - `WHATSAPP_ACCESS_TOKEN`
  - `WHATSAPP_APP_SECRET`
  - `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
  - `WHATSAPP_WEBHOOK_PATH`
- production includes Firebase machine-control secret:
  - `PRODUCTION_FIREBASE_DATABASE_URL`
- production includes R2 backup secrets:
  - `PRODUCTION_R2_ACCOUNT_ID`
  - `PRODUCTION_R2_BUCKET`
  - `PRODUCTION_R2_ACCESS_KEY_ID`
  - `PRODUCTION_R2_SECRET_ACCESS_KEY`
- production deploy renders `/opt/cjl/production/shared/backup.env` with mode `0600`
- deploy workflows no longer require or reference `*_DEPLOY_RESET_TOKEN`

## API And Observability

- every API response includes `X-Request-Id`
- API error responses include `error.code` and `error.requestId`
- structured JSON logs are visible for the API
- access logs include request id, status, latency, actor type, and release SHA
- background worker failures produce error logs and do not disappear silently
- `/ready` returns:
  - release metadata
  - Mongo check
  - settings/admin seed checks
  - Cloud provider configuration checks
  - configured webhook path
- hosted deploy validates `/ready` semantically, not just by HTTP `200`

## Security And Data Protection

- admin/public/API domains return security headers
- production MongoDB R2 bucket is private and has no public `r2.dev` access
- production MongoDB backups are unencrypted client-side by decision and stored only behind private R2 credentials
- production backup automation uses a full-instance `mongodump --archive --gzip --oplog`
- production backup retention keeps all backups newer than 72 hours, the newest daily, and the two most recent commit-boundary dailies
- `deploy/scripts/remote-deploy.sh` has no path that deletes `shared/mongo-data`
- staging runs CSP in report-only mode
- session-authenticated write routes enforce trusted origin checks
- Mongo-backed rate limiting works for admin login, customer login, magic-link redeem, and admin WhatsApp send/read actions
- `customer_magic_links` store token hashes only
- `direct_order_tokens` store token hashes only
- order documents no longer persist plaintext direct status tokens
- audit logs capture request correlation and masked network metadata
- API, admin, and public containers run as non-root

## Staging Acceptance

- staging deploy finishes green
- staging smoke checks pass for admin, public, and API
- first-start staging logs for the target release are reviewed for startup backfill duration and index creation timing
- first-start staging logs confirm whether WhatsApp compatibility backfill ran in `baseline` or `incremental` mode
- request ID can be traced from browser/network response to container log line
- expected error codes are validated on staging:
  - `401`
  - `403`
  - `404`
  - `409`
  - `422`
  - `429`
  - `500`
  - `503`
- real staging validation proves:
  - webhook challenge verification works
  - signed webhook POST is accepted
  - outbound status progression appears in admin
  - inbound media lands in GridFS and can be opened from admin
  - CSW-open manual reply succeeds
  - CSW-closed thread stays template-only
  - failed-notification resend, `Mark as Done`, and `Ignore` behave as expected
- customer portal and direct-status flows remain intact

## Production Go/No-Go

- production release candidate commit already passed staging validation
- pre-deploy production MongoDB backup succeeds before VM image build
- production delayed backup state is recorded only after production smoke/readiness checks pass
- production workflow `Ensure MongoDB backup timers` step succeeds
- production backup timers are installed automatically and visible in `systemctl list-timers 'cjl-mongo-r2-*'`
- isolated restore drill from an R2 backup has succeeded with `mongorestore --gzip --oplogReplay`
- staging proved the baseline startup backfill does not cause unacceptable startup degradation on realistic data volume
- staging proved subsequent restarts run the incremental path rather than rescanning full WhatsApp history
- previous healthy release SHA is known before deploy
- first-hour production log review owner is assigned
- first-hour review explicitly checks:
  - `401` spikes
  - `429` spikes
  - `5xx` spikes
  - webhook signature failures
  - Cloud delivery failures
  - admin inbox/manual-send regressions
