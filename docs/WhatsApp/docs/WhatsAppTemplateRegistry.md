# WhatsApp Template Registry

Document status: Active  
Created: 2026-04-02  
Purpose: canonical registry for CJ Laundry WhatsApp Business Platform template approval status, approval tracking, and runtime-to-Meta parameter mapping after Phase 1 completion.

## 1. Phase 1 Boundary

This registry is the canonical output of Phase 1.

- It records the approved-template inventory required before Cloud API transport work.
- It does not replace the current runtime `settings.messageTemplates` source used for `preparedMessage`, outbox retry, failed-notification handling, or `wa.me` manual fallback.
- It does not change the active `whatsapp-web.js` gateway runtime, deploy topology, contracts, or admin WhatsApp UI behavior.

## 2. Submission Defaults

Round-one submission policy used during Phase 1:

- category: `UTILITY`
- language: `id`
- parameter format: named parameters
- no optional buttons in the first approval round
- `cjl_order_confirmed_v1` uses `DOCUMENT` header plus `BODY`
- all other templates use `BODY` only

Actual outcome:

- `cjl_welcome_v1` is active as `MARKETING`
- the other four templates are active as `UTILITY`

## 3. Canonical Runtime-To-Meta Parameter Mapping

| Runtime parameter | Meta named parameter |
| --- | --- |
| `customerName` | `customer_name` |
| `customerPhone` | `customer_phone` |
| `customerPhone` | `registered_phone` |
| `orderCode` | `order_code` |
| `createdAt` | `created_at` |
| `completedAt` | `completed_at` |
| `weightKgLabel` | `weight_kg_label` |
| `serviceSummary` | `service_summary` |
| `totalLabel` | `total_label` |
| `earnedStamps` | `earned_stamps` |
| `redeemedPoints` | `redeemed_points` |
| `currentPoints` | `current_points` |
| `statusUrl` | `status_url` |
| `autoLoginUrl` | `auto_login_url` |
| `reason` | `reason` |

## 4. Supporting Assets

| Asset | Purpose | Path | Notes |
| --- | --- | --- | --- |
| Sample order-confirmed receipt PDF | Example document header media for `cjl_order_confirmed_v1` approval | `docs/WhatsApp/assets/cjl-order-confirmed-sample-receipt.pdf` | Synthetic, non-sensitive, generated from the current backend receipt renderer |

## 5. Template Registry

| Repo event type | Meta template name | Language | Category | Component shape | Approval status | Template ID | Approved at | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `welcome` | `cjl_welcome_v1` | `id` | `MARKETING` | `BODY` | `active` | `not_recorded_yet` | `2026-04-02` | Active in WhatsApp Manager. Meta did not keep this template under `UTILITY`; repo should preserve the approved category as `MARKETING`. |
| `order_confirmed` | `cjl_order_confirmed_v1` | `id` | `UTILITY` | `HEADER(document) + BODY` | `active` | `not_recorded_yet` | `2026-04-02` | Active in WhatsApp Manager. Sample PDF at `docs/WhatsApp/assets/cjl-order-confirmed-sample-receipt.pdf` was used for the document-header approval asset. |
| `order_done` | `cjl_order_done_v1` | `id` | `UTILITY` | `BODY` | `active` | `not_recorded_yet` | `2026-04-02` | Active in WhatsApp Manager. |
| `order_void_notice` | `cjl_order_void_notice_v1` | `id` | `UTILITY` | `BODY` | `active` | `not_recorded_yet` | `2026-04-02` | Active in WhatsApp Manager after the longer utility-safe body text revision. |
| `account_info` | `cjl_account_info_v1` | `id` | `UTILITY` | `BODY` | `active` | `not_recorded_yet` | `2026-04-02` | Active in WhatsApp Manager after removing login-oriented wording. |

## 6. Template Specs

### 6.1 `cjl_welcome_v1`

- repo event type: `welcome`
- language: `id`
- category: `MARKETING`
- components:
  - `BODY`

Current status:

- the original login-oriented draft was not approval-friendly under `UTILITY`
- the final Phase 1 body below was added in WhatsApp Manager and is now active
- actual approved category is `MARKETING`, not `UTILITY`

Approved round-one Phase 1 draft:

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

Approval notes:

- the earlier draft that included login credentials plus `auto_login_url` was flagged by Meta category validation as closer to `AUTHENTICATION`
- the revised utility-safe body was still ultimately activated as `MARKETING`
- future sessions must not silently rewrite the repo memory back to `UTILITY`

### 6.2 `cjl_order_confirmed_v1`

- repo event type: `order_confirmed`
- language: `id`
- category: `UTILITY`
- components:
  - `HEADER` = `DOCUMENT`
  - `BODY`

Header requirement:

- attach one synthetic sample PDF receipt during template authoring
- use `docs/WhatsApp/assets/cjl-order-confirmed-sample-receipt.pdf`

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

### 6.3 `cjl_order_done_v1`

- repo event type: `order_done`
- language: `id`
- category: `UTILITY`
- components:
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

### 6.4 `cjl_order_void_notice_v1`

- repo event type: `order_void_notice`
- language: `id`
- category: `UTILITY`
- components:
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

### 6.5 `cjl_account_info_v1`

- repo event type: `account_info`
- language: `id`
- category: `UTILITY`
- components:
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

## 7. Approval Notes And History

- 2026-04-02: Registry created in repo as the canonical Phase 1 approval record.
- 2026-04-02: Sample PDF requirement for `cjl_order_confirmed_v1` was satisfied in repo with a synthetic receipt asset generated from the active backend renderer.
- 2026-04-02: Operator completed Phase 1 template creation in WhatsApp Manager and all five templates are now active.
- 2026-04-02: Meta category validation for the original `cjl_welcome_v1` draft flagged the login-oriented body as mismatched for `UTILITY` and recommended `AUTHENTICATION`.
- 2026-04-02: Phase 1 now standardizes on the utility-safe welcome draft that omits login credentials and the one-time auto-login link.
- 2026-04-02: Phase 1 now standardizes on a utility-safe `account_info` draft that avoids login wording and focuses on account-data change confirmation.
- 2026-04-02: Template IDs were not copied back into the repo during activation and should be backfilled into this registry in a later documentation-only follow-up.
