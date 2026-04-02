# WhatsApp Business API Migration Phases

Document status: Active  
Created: 2026-04-02  
Purpose: implementation-ready migration phases for moving CJ Laundry from the current `whatsapp-web.js` sidecar runtime to the official WhatsApp Business Platform / Cloud API while keeping the legacy code in the repo but removing it from runtime usage.

## 1. Summary

This document defines the complete implementation sequence for migrating CJ Laundry WhatsApp capabilities to the official WhatsApp Business Platform.

Target outcome:

- automatic outbound notifications use official Cloud API
- inbound and outbound WhatsApp data are ingested from official webhooks
- admin gets a first-party WhatsApp interface inside the app
- manual non-template sends are supported only when valid under Meta rules
- delivery visibility uses Cloud API webhook statuses, not `whatsapp-web.js` ack numbers
- `@cjl/whatsapp-gateway` remains in the repo as deprecated legacy code but is not used by any application runtime path

This plan assumes the current business event model remains unchanged:

- `welcome`
- `order_confirmed`
- `order_done`
- `order_void_notice`
- `account_info`

This plan also assumes the baseline guide in [`docs/WhatsApp/docs/WhatsAppAPIDocs.md`](C:\Users\Khalfani%20Shaquille\Documents\GitHub\cjl-new\docs\WhatsApp\docs\WhatsAppAPIDocs.md) is the source of truth for Meta platform constraints and repo-level WhatsApp migration facts.

## 2. Current Repo Facts That Drive the Plan

- The API already owns:
  - notification records
  - outbox processing
  - receipt rendering
  - mirrored WhatsApp chats/messages
  - admin notification recovery semantics
- The current runtime still depends on:
  - `packages/whatsapp-gateway`
  - `/v1/internal/whatsapp/events`
  - `providerAck`
  - `providerChatId`
  - pairing / reconnect / reset-session admin controls
- Those dependencies now exist only as legacy bridge compatibility, not as active target-state runtime behavior.
- The current admin WhatsApp surface is now provider-health plus hybrid thread/message visibility rather than pairing control.
- Current local and hosted compose files no longer boot `whatsapp-gateway` as an active runtime service.
- Current integration tests now stub Cloud API sends directly and only keep the internal event bridge for legacy mirrored-data coverage.
- Current deploy scripts no longer wait for `whatsapp-gateway` readiness or provision `whatsapp-auth` as an active runtime dependency.

These facts mean the migration is not just an adapter swap. It is a coordinated change across:

- contracts
- API service layer
- admin UI
- tests
- compose and deployment
- internals and ADR memory

## 3. Frozen Decisions For This Migration

These decisions are now fixed for the migration plan unless a later session explicitly changes them:

1. Official target provider is Meta WhatsApp Business Platform / Cloud API.
2. `whatsapp-web.js` is not deleted from the repo during this migration.
3. The legacy gateway is moved to a code-only, deprecated state:
   - not part of local runtime
   - not part of hosted runtime
   - not part of the admin WhatsApp experience
   - not part of deploy, smoke-check, or readiness critical paths
4. The API remains the system of record for:
   - notification state
   - thread/message read models
   - customer linkage
   - operator-facing delivery status
5. Automated notifications remain template-first.
6. Manual operator sends inside the admin WhatsApp interface support non-template messages only when the customer service window is open.
7. The admin WhatsApp interface becomes a first-party product surface, not an “open real WhatsApp app” dependency.
8. Manual `wa.me` fallback for failed notifications remains available even after Cloud API cutover.
9. Current domain event names remain unchanged in the first migration.
10. Delivery truth moves from numeric provider ack semantics to Cloud API webhook status strings.

## 4. End-State Architecture

End-state after migration:

- API sends automatic outbound notifications directly to Graph API.
- API exposes a Meta webhook endpoint for:
  - verification handshake
  - incoming `messages[]`
  - outgoing `statuses[]`
  - template lifecycle updates
- API maintains a canonical WhatsApp thread/message read model for the admin UI.
- Admin WhatsApp page shows:
  - thread list
  - timeline
  - customer linkage
  - CSW/FEP visibility
  - manual non-template composer when allowed
  - outbound delivery status visibility
- Legacy `@cjl/whatsapp-gateway` code remains in repo under deprecated storage only and is not started by application runtime.

## 5. New Runtime Model To Implement

The migration should standardize on these runtime settings:

- introduce `WHATSAPP_PROVIDER`
  - allowed values: `cloud_api`, `disabled`
- hosted and local defaults after cutover should use:
  - `WHATSAPP_PROVIDER=cloud_api`
- `WHATSAPP_ENABLED` remains temporary compatibility env only during migration
- `WHATSAPP_GATEWAY_*` env values are removed from active API runtime contracts once Cloud mode is in place

Cloud API env contract to introduce:

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

Legacy code policy:

- `WHATSAPP_GATEWAY_URL`
- `WHATSAPP_GATEWAY_TOKEN`
- `WHATSAPP_AUTH_DIR`

remain relevant only to the retained legacy package and should not appear in active app runtime examples after migration.

## 6. Template Authoring Pack

This section is the manual template guide the operator can use directly in WhatsApp Manager.

Decision:

- first migration pass uses the safest approval-friendly template set
- no optional buttons in the first approval round
- keep components minimal unless the component is functionally required
- `order_confirmed` is the only template that uses a media/document header

### 6.1 Naming Convention

Use this exact naming convention:

- `cjl_welcome_v1`
- `cjl_order_confirmed_v1`
- `cjl_order_done_v1`
- `cjl_order_void_notice_v1`
- `cjl_account_info_v1`

Rules:

- category: `UTILITY`
- language: `id`
- parameter format: `named`
- version suffix only changes when approved content must be replaced materially

### 6.2 Template 1: `cjl_welcome_v1`

Input values for WhatsApp Manager:

- Name: `cjl_welcome_v1`
- Category: `UTILITY`
- Language: `id`
- Components:
  - `BODY`

Body text:

```text
Halo {{customer_name}}!

Selamat datang di CJ Laundry. Nomor pelanggan Anda sudah berhasil terdaftar.

Website CJ Laundry:
https://cjlaundry.com

Di website tersebut Anda bisa:
- cek status laundry
- lihat riwayat order
- cek poin / stamp
- lihat leaderboard pelanggan

Nomor terdaftar:
{{registered_phone}}

Simpan pesan ini ya. Terima kasih sudah mempercayakan cucian Anda ke CJ Laundry.
```

Named parameter examples:

- `customer_name` = `BUDI SANTOSO`
- `registered_phone` = `081234567890`

### 6.3 Template 2: `cjl_order_confirmed_v1`

Input values for WhatsApp Manager:

- Name: `cjl_order_confirmed_v1`
- Category: `UTILITY`
- Language: `id`
- Components:
  - `HEADER` = `DOCUMENT`
  - `BODY`

Header requirement:

- prepare 1 sample PDF receipt before creating the template
- use a real-looking but non-sensitive sample receipt file

Body text:

```text
Halo {{customer_name}}!

Pesanan Anda dengan kode {{order_code}} sudah kami konfirmasi pada {{created_at}}.

Detail order:
- Berat: {{weight_kg_label}}
- Layanan: {{service_summary}}
- Total: {{total_label}}

Poin loyalty:
- Poin diperoleh: {{earned_stamps}}
- Poin digunakan: {{redeemed_points}}
- Saldo poin sekarang: {{current_points}}

Pantau status order Anda di:
{{status_url}}

Receipt ringkas ada pada dokumen terlampir. Terima kasih sudah order di CJ Laundry.
```

Named parameter examples:

- `customer_name` = `BUDI SANTOSO`
- `order_code` = `CJ-260402-001`
- `created_at` = `2 Apr 2026, 10:35`
- `weight_kg_label` = `3.0 kg`
- `service_summary` = `1x Washer, 1x Dryer, 3.0 kg Setrika`
- `total_label` = `Rp 24.500`
- `earned_stamps` = `1`
- `redeemed_points` = `0`
- `current_points` = `6`
- `status_url` = `https://cjlaundry.com/status/abc123`

### 6.4 Template 3: `cjl_order_done_v1`

Input values for WhatsApp Manager:

- Name: `cjl_order_done_v1`
- Category: `UTILITY`
- Language: `id`
- Components:
  - `BODY`

Body text:

```text
Halo {{customer_name}}!

Pesanan Anda dengan kode {{order_code}} yang masuk pada {{created_at}} telah selesai pada {{completed_at}}.

Laundry Anda sudah dapat diambil.

Terima kasih sudah menggunakan layanan CJ Laundry. Kami tunggu order berikutnya ya.
```

Named parameter examples:

- `customer_name` = `BUDI SANTOSO`
- `order_code` = `CJ-260402-001`
- `created_at` = `2 Apr 2026, 10:35`
- `completed_at` = `2 Apr 2026, 14:20`

### 6.5 Template 4: `cjl_order_void_notice_v1`

Input values for WhatsApp Manager:

- Name: `cjl_order_void_notice_v1`
- Category: `UTILITY`
- Language: `id`
- Components:
  - `BODY`

Body text:

```text
Halo pelanggan CJ Laundry.

Order atas nama {{customer_name}} dengan kode {{order_code}} dibatalkan.

Alasan pembatalan:
{{reason}}

Silakan hubungi CJ Laundry bila Anda memerlukan bantuan lebih lanjut.
```

Named parameter examples:

- `customer_name` = `BUDI SANTOSO`
- `order_code` = `CJ-260402-001`
- `reason` = `Pelanggan membatalkan order sebelum proses dimulai`

### 6.6 Template 5: `cjl_account_info_v1`

Input values for WhatsApp Manager:

- Name: `cjl_account_info_v1`
- Category: `UTILITY`
- Language: `id`
- Components:
  - `BODY`

Body text:

```text
Halo {{customer_name}}!

Data akun CJ Laundry Anda sudah diperbarui.

Nomor pelanggan terbaru:
{{customer_phone}}

Silakan simpan nomor terbaru ini untuk kebutuhan komunikasi dengan CJ Laundry.
```

Named parameter examples:

- `customer_name` = `BUDI SANTOSO`
- `customer_phone` = `081234567890`

### 6.7 Required Output of the Template Phase

Before any code migration starts, capture these values for each approved template:

- template name
- language
- category
- status
- template ID
- approved-at date
- notes if Meta auto-recategorizies or rejects

Store that registry in a repo document:

- `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md`

That file does not exist yet and should be created in the template-authoring phase.

## 7. Phase Plan

### Phase 0: Freeze Migration Direction and Legacy Policy

Goal:

- make the repo’s migration target explicit
- prevent future sessions from continuing sidecar-first work by accident

Primary files to change:

- `docs/adr/0016-whatsapp-business-platform-target-and-webjs-deprecation.md`
- `internals/implementationPhases.md`
- `internals/phaseBacklog.md`
- `internals/sessionHandoff-2026-04-02.md`

Tasks:

- add an ADR declaring Cloud API as the target provider
- explicitly state that `whatsapp-web.js` remains in repo but is deprecated and disconnected from all runtime usage
- point future sessions to this migration document and the existing Cloud API base guide

Acceptance gate:

- repo memory no longer frames linked-device pairing validation as the long-term WhatsApp target state

### Phase 1: Template Authoring and Approval

Goal:

- get all operational templates approved before transport migration work depends on them

Primary work areas:

- WhatsApp Manager
- `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md`
- `docs/WhatsApp/docs/WhatsAppAPIDocs.md`

Tasks:

- create the five templates exactly as specified in Section 6
- prepare one sample PDF receipt for the document-header template
- record template IDs and statuses in the template registry
- document any approval friction and required copy changes

Acceptance gate:

- all five templates are approved, or all blockers are isolated to documented copy issues only

Current status snapshot:

- completed operationally on 2026-04-02
- all five templates are active in WhatsApp Manager
- `cjl_welcome_v1` is active as `MARKETING`
- `cjl_order_confirmed_v1`, `cjl_order_done_v1`, `cjl_order_void_notice_v1`, and `cjl_account_info_v1` are active as `UTILITY`
- template IDs still need to be copied into the repo registry if the operator has not recorded them yet

### Phase 2: Provider Abstraction and Data Model Expansion

Goal:

- make the API provider-agnostic enough to support Cloud API without breaking current business flows

Status snapshot:

- implemented on 2026-04-02 for the current repo scope
- contracts, persistence types, settings contract narrowing, and admin template-editor removal are completed
- legacy bridge fields remain for compatibility, but no new feature work should extend them

Primary files/modules to change:

- `packages/api/src/env.ts`
- `packages/api/src/types.ts`
- `packages/contracts/src/schemas.ts`
- `packages/api/src/services/whatsapp.ts`
- `packages/api/src/services/common.ts`
- `packages/api/src/services/admin.ts`

Design decisions for this phase:

- keep existing `notifications`, `whatsapp_chats`, and `whatsapp_messages` collections
- expand them instead of introducing a second parallel set of collections
- keep legacy fields for compatibility during migration
- add new Cloud-ready fields rather than overloading `providerAck`

Required schema changes:

- `NotificationDocument`
  - add `providerKind`
  - add `providerStatus`
  - add `providerStatusAt`
  - add `waId`
  - add `pricingType`
  - add `pricingCategory`
  - keep `providerAck` and `providerChatId` as deprecated optional fields
- `WhatsappChatDocument`
  - add `waId`
  - add `displayName`
  - add `lastInboundAt`
  - add `cswOpenedAt`
  - add `cswExpiresAt`
  - add `fepOpenedAt`
  - add `fepExpiresAt`
  - add `composerMode`
- `WhatsappMessageDocument`
  - add `providerKind`
  - add `waId`
  - add `providerStatus`
  - add `providerStatusAt`
  - add `pricingType`
  - add `pricingCategory`
  - add `latestErrorCode`
  - add `latestErrorMessage`
  - add `source`

API contract changes to introduce:

- thread summary includes CSW/FEP visibility
- message item includes provider status visibility
- keep old response fields temporarily so the current admin UI does not break mid-phase

Acceptance gate:

- contracts and persistence shapes can express Cloud API thread/message semantics without removing legacy webjs fields

### Phase 3: Cloud API Outbound Delivery

Goal:

- replace automatic notification delivery from gateway HTTP calls to direct Graph API calls

Status snapshot:

- implemented on 2026-04-02 for automatic outbound notifications
- approved-template registry now drives Cloud payload selection
- `order_confirmed` now uses the document-header template path
- admin WhatsApp no longer exposes pairing/reconnect/reset-session controls
- local and hosted runtime topology no longer boot `whatsapp-gateway`
- webhook verification and inbound/status ingestion are still pending in later phases

Primary files/modules to change:

- `packages/api/src/services/whatsapp.ts`
- new `packages/api/src/services/whatsapp-cloud.ts`
- `packages/api/src/services/common.ts`
- `packages/api/src/env.ts`

Tasks:

- add a dedicated Cloud API client module
- support `POST /<PHONE_NUMBER_ID>/messages` for template sends
- implement `WHATSAPP_PROVIDER` as a Cloud-only runtime selector:
  - `cloud_api`
  - `disabled`
- ensure `order_confirmed` uses the approved `DOCUMENT` header template path
- map send response `messages[0].id` into `providerMessageId`
- store initial `Accepted by Meta` state separately from final delivery status

Acceptance gate:

- all five automatic notification events can be emitted through Cloud API in test/stub mode

### Phase 4: Meta Webhook Verification and Ingestion

Goal:

- make webhook events the source of truth for delivery and inbox data

Primary files/modules to change:

- `packages/api/src/app.ts`
- `packages/api/src/services/whatsapp.ts`
- new `packages/api/src/services/whatsapp-webhooks.ts`

Tasks:

- add a public webhook endpoint such as:
  - `GET /v1/webhooks/meta/whatsapp`
  - `POST /v1/webhooks/meta/whatsapp`
- verify webhook challenge with `WHATSAPP_WEBHOOK_VERIFY_TOKEN`
- verify payload signatures with `WHATSAPP_APP_SECRET`
- ingest inbound `messages[]`
- ingest outbound `statuses[]`
- ingest:
  - `message_template_status_update`
  - `message_template_quality_update`
  - optional `message_template_components_update`
- make webhook ingestion idempotent by provider message ID + event payload fingerprint where needed

Rule implementation:

- derive `cswExpiresAt` from latest inbound customer message timestamp plus 24 hours
- derive `fepExpiresAt` from webhook pricing/conversation data when present
- do not allow FEP to reopen non-template composer after CSW closes

Acceptance gate:

- delivery status, pricing visibility, and inbox messages can be driven entirely from Meta webhooks

Status snapshot:

- implemented on 2026-04-02 for the current repo scope
- signed webhook verification and ingestion are active in the API runtime
- inbound text/media, outbound status progression, template lifecycle audit, and GridFS-backed media storage are in place

### Phase 5: Admin WhatsApp Interface Upgrade

Goal:

- replace the sidecar-centric admin WhatsApp page with the first-party Cloud-era interface

Primary files/modules to change:

- `app/admin-web/app/admin/whatsapp/page.tsx`
- `app/admin-web/lib/api.ts`
- `packages/contracts/src/schemas.ts`
- `packages/api/src/services/whatsapp.ts`
- `packages/api/src/app.ts`

Tasks:

- replace pairing-centric status tiles with provider health + thread visibility
- implement thread list panel
- implement timeline panel
- surface linked customer identity when available
- surface message source:
  - automated notification
  - manual operator
  - inbound customer
- surface outbound visibility:
  - Accepted by Meta
  - Sent
  - Delivered
  - Read
  - Failed
- add disabled-state composer shell in this phase, but do not send yet if backend send endpoint is not ready

Acceptance gate:

- admin can inspect Cloud-era threads and message statuses without any dependency on linked-device pairing UX

Status snapshot:

- implemented on 2026-04-02 for the current repo scope
- `/admin/whatsapp` is now promoted into the primary desktop nav and five-item mobile bottom nav
- the admin surface now provides searchable thread list, desktop split-pane inbox UI, mobile thread sheet, linked-customer CTA, message source/status/pricing badges, and media-open affordances
- polling read paths remain read-only; unread clearing moved to an explicit mutation on operator thread open

### Phase 6: Manual Operator Send Path

Goal:

- enable non-template operator replies in-app with correct eligibility controls

Primary files/modules to change:

- `packages/api/src/app.ts`
- `packages/api/src/services/whatsapp.ts`
- new `packages/api/src/services/whatsapp-manual-send.ts`
- `app/admin-web/app/admin/whatsapp/page.tsx`
- `app/admin-web/lib/api.ts`

New admin API endpoint to add:

- `POST /v1/admin/whatsapp/chats/:chatId/messages`

Baseline send scope:

- text-only free-form messages
- no media composer in first implementation pass

Eligibility rules to enforce server-side:

- allow non-template send only if `isCswOpen === true`
- reject if `isCswOpen === false`
- return a clear error when:
  - CSW closed
  - thread not resolvable
  - recipient identifier incomplete

UI behavior:

- show composer enabled only when backend says `Free-form allowed`
- show `Template only` state when CSW closed
- show FEP as informational badge only

Acceptance gate:

- admin can send a free-form text reply from the app when CSW is open, and cannot send one when CSW is closed

Status snapshot:

- implemented on 2026-04-02 for the current repo scope
- `POST /v1/admin/whatsapp/chats/:chatId/messages` now sends idempotent text-only manual replies through Cloud API
- `POST /v1/admin/whatsapp/chats/:chatId/read` now clears unread counts explicitly without mutating polling GET flows
- server-side enforcement now blocks manual sends when CSW is closed, recipient identity is incomplete, or Cloud provider config is unavailable

### Phase 7: Testing and Tooling Migration

Goal:

- replace gateway-era tests and scripts with Cloud API-aware verification

Primary files/modules to change:

- `packages/api/test/integration.test.ts`
- `tests/e2e/full-stack.spec.ts`
- `package.json`
- any script under `scripts/testing/` that assumes gateway behavior

Integration test changes:

- replace the internal gateway stub server with a Cloud API stub server
- test webhook verification and webhook ingest
- test template send response mapping
- test status webhook progression:
  - accepted
  - sent
  - delivered
  - read
  - failed
- test CSW opening from inbound messages
- test manual free-form send allowed/blocked behavior
- remove assertions that depend on:
  - `@c.us`
  - `providerAck`
  - pairing code flow
  - reset-session flow

E2E changes:

- replace admin WhatsApp pairing expectations with inbox/status expectations
- add thread list + timeline expectations
- add manual send expectation when CSW is open
- keep manual `wa.me` fallback verification in notification recovery

Build/test script changes:

- keep `build:whatsapp` temporarily for the deprecated package code only
- add comments/docs that it is legacy-only and non-runtime
- do not make CI depend on running the legacy gateway in runtime tests

Acceptance gate:

- CI validates Cloud API behavior without needing a browser-backed WhatsApp session

Status snapshot:

- backend integration coverage now uses a Cloud API stub and passes
- backend integration coverage now also asserts unread-clear mutation, CSW-only manual send, idempotent manual-send replay, and missing-recipient rejection
- E2E coverage now asserts primary-nav/mobile-nav WhatsApp access, richer inbox UI, media-open affordances, unread clearing, linked-customer CTA, manual reply flow, and template-only composer state
- lint and typecheck also pass after the Phase 2-3 changes

### Phase 8: Deployment, Env, and Runtime Topology Change

Goal:

- make Cloud API the default deploy topology while retaining legacy code in the repo

Primary files/modules to change:

- `docker-compose.yml`
- `deploy/api/docker-compose.remote.yml`
- `deploy/env/runtime.staging.env.example`
- `deploy/env/runtime.production.env.example`
- `.github/workflows/deploy-staging.yml`
- `.github/workflows/deploy-production.yml`
- `deploy/scripts/remote-deploy.sh`

Tasks:

- introduce Cloud API env vars into local and hosted env examples
- remove `whatsapp-gateway` from active local and hosted runtime topology
- stop waiting for `whatsapp-gateway` in `remote-deploy.sh`
- stop provisioning `whatsapp-auth` as a required runtime volume
- remove the legacy service from active compose files after the Cloud runtime is in place while keeping the package code in the repo
- adjust deploy workflows so runtime env renders `WHATSAPP_PROVIDER=cloud_api`
- remove default fingerprint logging around `WHATSAPP_GATEWAY_TOKEN`
- add readiness checks that matter for Cloud mode:
  - API up
  - webhook endpoint routable
  - required Cloud env present

Acceptance gate:

- staging and production deploy successfully without booting `whatsapp-gateway` by default

Status snapshot:

- compose files, env examples, and remote deploy script have been updated so active runtime topology no longer includes `whatsapp-gateway`
- staging/production operational validation is still pending

### Phase 9: Data Backfill and Cutover

Goal:

- make the staged runtime production-safe and preserve legacy records

Primary work areas:

- MongoDB backfill scripts
- staging validation runbook
- production cutover checklist

Tasks:

- backfill legacy WhatsApp chat/message records with:
  - `providerKind=webjs_legacy`
  - legacy markers where Cloud fields are absent
- migrate canonical thread identity away from `@c.us` assumptions
- validate approved templates in staging with real delivery
- validate webhook receipt, dedup, and admin UI status transitions in staging
- ensure no staging runtime path starts the legacy sidecar
- ensure no production runtime path starts the legacy sidecar
- keep package code and deprecated docs in repo after cutover

Acceptance gate:

- production WhatsApp path is Cloud API only
- legacy webjs runtime is not started anywhere in application runtime
- no live operator flow depends on QR/pairing/reconnect/reset-session

## 8. Deliverables By Phase

The migration is only complete when these repo outputs exist:

- `docs/adr/0016-whatsapp-business-platform-target-and-webjs-deprecation.md`
- `docs/WhatsApp/docs/WhatsAppTemplateRegistry.md`
- Cloud-era env schema and env examples
- public Meta webhook endpoint
- Cloud API delivery adapter
- admin WhatsApp inbox/composer/status interface
- updated integration and E2E tests
- default deploy topology without mandatory `whatsapp-gateway`

## 9. What Must Stay Working Throughout The Migration

- customer creation still enqueues `welcome`
- order confirm still creates the order atomically before notification delivery
- order done and void semantics do not change
- failed notification recovery still offers manual fallback
- PDF receipt rendering remains backend-owned
- public portal and admin customer flows remain unaffected except where WhatsApp delivery/provider fields are displayed

## 10. What Is Explicitly Deferred

These are not part of the first migration pass:

- deleting `packages/whatsapp-gateway`
- deleting legacy gateway routes immediately
- media composer for manual operator sends
- marketing automation
- AI/chatbot behavior
- operator assignment or multi-agent inbox routing
- replacing manual `wa.me` fallback

## 11. Recommended Next Start

The next implementation session should start with:

1. execute Phase 8 and Phase 9 staging validation against the now-implemented Cloud runtime
2. validate real Meta webhook, inbound media, and operator reply behavior on staging
3. backfill real Meta template IDs into the repo registry if the operator has them
4. update stale deployment/runbook documentation that still reflects gateway-era or pre-inbox behavior
