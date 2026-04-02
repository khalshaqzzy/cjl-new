# Session Handoff 2026-04-02

Document status: Active  
Purpose: repo snapshot after Cloud WhatsApp migration closure plus admin inbox mobile UX hardening

## What This Session Completed

- reworked admin WhatsApp mobile UX without changing backend contracts:
  - thread taps now open a dedicated `/admin/whatsapp/[chatId]` detail route on mobile
  - desktop stays split-pane
  - provider health is compact and default-collapsed
  - mobile thread detail hides bottom nav and keeps header actions sticky
  - thread timelines auto-scroll to newest messages on open
  - scroll containment now stays inside the inbox/timeline instead of bleeding to the whole page
- extracted shared admin WhatsApp UI/state blocks into `app/admin-web/components/admin/whatsapp-inbox.tsx`
- tightened shared `ScrollArea` root overflow behavior to support contained scrolling
- expanded E2E coverage for:
  - desktop provider-health collapse/expand
  - desktop thread selection staying inline
  - desktop long-timeline scroll containment
  - mobile thread route navigation, back behavior, and unlinked-thread reply flow
- removed active API runtime dependence on gateway-era env variables
- retired `POST /v1/internal/whatsapp/events` with explicit `410 legacy_whatsapp_bridge_retired`
- extended `/ready` with Cloud provider/webhook readiness checks
- added startup backfill for legacy WhatsApp data:
  - canonical chat IDs keyed by `wa:<digits>`
  - legacy chat shadow markers
  - message/chat re-pointing for Cloud-era reads
  - notification provider-field backfill where derivable
  - structured seed summary logging
- tightened startup backfill after review:
  - baseline run records migration watermark `whatsapp-cutover-backfill-v1`
  - later startups switch to incremental cursor-based passes instead of full `toArray()` scans
  - canonical chat merges now preserve human-readable legacy titles
- filtered admin WhatsApp read paths to canonical chats only
- cleaned admin notification UI so provider status/error fields are primary and gateway-era fields are no longer operator-facing truth
- removed the deprecated gateway workspace from default root build/typecheck critical path
- added `npm run validate:cloud-runtime`
- updated CI to run Cloud runtime parity validation
- updated deploy workflows to render Cloud API secrets and removed gateway-era runtime rendering
- tightened deploy workflows after review:
  - fail before deploy if any required Cloud WhatsApp secret is blank
  - validate `/ready` semantically through `deploy/scripts/assert-ready-cloud.sh`
- added ADR `docs/adr/0022-cloud-only-runtime-env-and-startup-whatsapp-compat-backfill.md`
- added ADR `docs/adr/0023-cloud-readiness-gating-and-watermarked-whatsapp-backfill.md`
- added backend coverage for:
  - `/ready` Cloud checks
  - startup backfill of legacy WhatsApp data
  - retired legacy bridge endpoint
- expanded E2E coverage for:
  - failed `order_confirmed` receipt download + resend
  - non-receipt resend
  - `Mark as Done`
  - `Ignore`
- rewrote the main deployment/runbook/checklist internals docs to Cloud-only guidance

## Verification Run

- `npm run typecheck`
- `npm run test:e2e`
- `npm run test:backend`
- `npm run validate:cloud-runtime`

Both succeeded at session end.

## Important Repo Facts

- active runtime path for WhatsApp is Cloud API only
- deprecated `packages/whatsapp-gateway` remains in repo as code only and is not part of local/staging/production runtime
- startup backfill is intentionally additive and idempotent; it preserves existing production MongoDB contents
- startup backfill is now split into:
  - baseline first run
  - watermark-driven incremental reruns
- admin WhatsApp detail UX now has two intentional modes:
  - desktop split-pane at `/admin/whatsapp`
  - mobile-focused full detail route at `/admin/whatsapp/[chatId]`
- staging and production now require Cloud WhatsApp secrets in GitHub environments:
  - `*_WHATSAPP_BUSINESS_ID`
  - `*_WHATSAPP_WABA_ID`
  - `*_WHATSAPP_PHONE_NUMBER_ID`
  - `*_WHATSAPP_ACCESS_TOKEN`
  - `*_WHATSAPP_APP_SECRET`
  - `*_WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- the operator runbooks no longer assume QR, reconnect, or session-reset flows

## Recommended Next Start

1. execute the first real staging rollout with Cloud secrets present
2. confirm the workflow passes both:
   - secret fail-fast validation
   - semantic `/ready` validation
3. validate webhook, inbox, media, manual-send, failed-notification recovery, and the new mobile inbox UX on staging
4. restart staging once and confirm `seed.completed.summary.mode` flips from `baseline` to `incremental`
5. only after staging signoff, allow the first production push
