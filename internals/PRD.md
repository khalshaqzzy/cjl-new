# CJ Laundry POS Web App v1 PRD

Document status: Draft for implementation  
Last updated: 2026-03-28  
Primary timezone: Asia/Jakarta  
Primary currency: IDR  
Scope type: MVP that is implementation-ready

## 1. Product Summary

CJ Laundry membutuhkan web app POS dengan dua surface utama:

1. `admin.cjlaundry.com`
   Untuk operasional laundry harian: registrasi customer, pembuatan order, pencatatan berat dan item layanan, auto-calculation harga, loyalty stamp/point, notifikasi WhatsApp, pemantauan laundry aktif/hari ini/history operasional, penyelesaian order, histori customer, penambahan poin manual, dan dashboard laporan.
2. `cjlaundry.com`
   Untuk customer: landing page brand yang informatif, login ringan tanpa password, pengecekan status laundry, stamp/poin, riwayat cuci, riwayat penukaran stamp, ringkasan aktivitas bulanan tanpa nominal uang, dan leaderboard publik.

Seluruh aplikasi v1 di-deploy sebagai satu monolith pada VM per environment. Runtime backend menggunakan Express.js, admin/public frontend dirilis bersama dari deployment yang sama, dan MongoDB berjalan di Docker Compose pada VM tersebut. Semua mutasi data bisnis harus melalui backend API/server layer. Public client tidak boleh memiliki akses langsung ke database.

## 2. Business Goals

### 2.1 Primary goals

- Mempercepat proses operasional order laundry dari registrasi sampai selesai.
- Menghilangkan pencatatan manual untuk order, histori, dan loyalty stamp.
- Mengirim notifikasi WhatsApp otomatis pada momen bisnis penting.
- Memberikan portal customer yang cukup ringan untuk status, histori, dan engagement loyalty.
- Menyediakan dashboard penjualan dan operasional yang usable untuk pemilik laundry.

### 2.2 Success metrics

- Admin dapat membuat order baru dalam kurang dari 2 menit dari customer search sampai konfirmasi.
- Semua order confirmed menghasilkan histori order, receipt snapshot, dan ledger poin yang konsisten.
- Semua event WA penting tercatat status delivery-nya dan dapat di-retry tanpa menggandakan efek bisnis.
- Customer dapat login dan melihat data dirinya tanpa password.
- Leaderboard bulan berjalan dan arsip bulanan konsisten dengan ledger stamp order.

### 2.3 Non-goals for v1

- Multi-branch / multi-outlet.
- Multi-admin role management.
- Pickup / delivery workflow.
- Partial payment, unpaid order, atau payment gateway.
- Customer self-registration dari public site.
- Password reset, OTP login, atau social login untuk customer.
- Inventory / stock management.
- Printer thermal integration.
- Akuntansi, pajak, atau invoice fiskal formal.

## 3. Confirmed Decisions

- Admin auth memakai satu akun admin dengan `username + password`.
- Customer login memakai `nomor HP + nama`, tanpa password dan tanpa OTP.
- Duplicate nama customer diperbolehkan.
- Satu nomor HP hanya boleh dipakai oleh satu customer.
- Satu customer dapat memiliki lebih dari satu order aktif pada saat yang sama.
- Customer-facing status order v1 hanya `Active -> Done`; internal correction state `Voided` dipakai untuk order yang dibatalkan dan direpresentasikan sebagai `Cancelled` pada surface customer bila perlu ditampilkan.
- Saat order dikonfirmasi, order dianggap lunas.
- Order terkunci setelah konfirmasi; koreksi dilakukan melalui `cancel/void`, bukan edit in place.
- Link status order dari WA membuka order spesifik secara langsung tanpa login.
- Stamp dihitung saat order dikonfirmasi, bukan saat selesai.
- Qty per item layanan diperbolehkan.
- Redeem 10 poin dapat dipakai berulang untuk menggratiskan 1 Washer unit per 10 poin.
- Washer unit yang digratiskan melalui redeem tidak boleh ikut dihitung sebagai penambahan stamp.
- Manual point addition dari admin memengaruhi saldo poin customer, tetapi tidak memengaruhi leaderboard.
- Cancel/void membalik poin dan memicu recalculation leaderboard untuk bulan order terkait, termasuk bulan yang sudah diarsipkan.
- Harga layanan dapat diubah dari admin settings, tetapi setiap order menyimpan snapshot harga saat transaksi dibuat.
- WhatsApp bot memakai 1 nomor khusus CJ Laundry yang dipair ke bot di VM, tanpa Official WhatsApp API.
- Customer-facing admin contact dapat berisi lebih dari satu nomor WhatsApp; satu nomor `primary` dipakai untuk landing page, portal contact CTA, dan fallback public contact surface.
- Runtime backend v1 memakai Express.js, bukan Fastify.
- Arsitektur runtime v1 adalah monolith yang berjalan di VM per environment, bukan frontend terpisah di platform hosting terpisah.
- Database utama v1 adalah MongoDB yang berjalan di Docker Compose dan tidak diekspos langsung ke public internet.
- Push ke branch `staging` harus memicu auto-deploy ke VM staging, dan push ke branch `main` harus memicu auto-deploy ke VM production.

## 4. Key Constraints and Product Risks

### 4.1 Product constraints

- Login customer sengaja dibuat ringan, tetapi ini lebih lemah secara privacy dibanding OTP.
- Karena leaderboard bersifat publik, data identitas yang ditampilkan harus diprivasi.
- Karena aplikasi dan database sama-sama self-hosted di VM, backup, monitoring, restore, dan hardening host menjadi tanggung jawab operasional CJ Laundry.
- Monolith pada single VM per environment menyederhanakan deployment, tetapi meningkatkan blast radius jika app container, reverse proxy, atau host bermasalah; staging dan production harus tetap sepenuhnya terpisah.
- WhatsApp non-official API tidak dapat diperlakukan setara SLA-nya dengan API resmi; sistem harus tahan terhadap disconnect, retry, dan duplicate send.

### 4.2 Accepted product risk

Customer login `nomor + nama` diterima untuk v1 demi friction serendah mungkin. Implikasinya:

- Portal customer tidak boleh membuka data pelanggan lain.
- Login error harus generik dan tidak boleh membocorkan apakah nomor terdaftar.
- Rate limiting dan session hardening wajib.
- Portal customer sebaiknya tidak menjadi surface utama untuk data moneter sensitif.

## 5. Users and Roles

### 5.1 Admin

Satu operator internal CJ Laundry yang:

- login ke admin app,
- registrasi customer,
- membuat dan mengonfirmasi order,
- menandai laundry selesai,
- melihat histori dan poin customer,
- menambah poin manual,
- mengubah harga katalog,
- melihat dashboard.

### 5.2 Customer

Customer laundry yang:

- menerima welcome message,
- menerima order receipt dan status link,
- login ke public portal dengan nomor HP + nama,
- melihat stamp, riwayat order, status order aktif, redemption history, dan monthly summary,
- melihat leaderboard publik.

### 5.3 System integrations

- WhatsApp bot session pada VM.
- MongoDB sebagai data store utama yang berjalan di Docker Compose pada VM environment terkait.
- Monolithic Express application yang melayani admin app, public app, dan backend API dari release artifact yang sama.
- Reverse proxy/TLS termination pada VM untuk routing domain publik ke monolith.
- CI/CD workflow berbasis branch untuk auto-deploy ke staging dan production VM.

## 6. Assumptions and Defaults

- Single branch/outlet untuk seluruh v1.
- Semua pelaporan memakai timezone `Asia/Jakarta`.
- Satuan berat disimpan minimal 2 digit desimal, tetapi UI default menampilkan 1 digit desimal.
- Berat order wajib diisi untuk semua order, meskipun tidak semua layanan menggunakan harga per kg.
- Harga `Setrika` dihitung dari berat order yang sama.
- Receipt order-confirmed yang dikirim otomatis oleh bot WhatsApp berupa file PDF; portal customer tetap menyediakan download PDF, sedangkan admin outbox fallback untuk failed order-confirmed menyediakan download image agar mudah diteruskan secara manual ke WhatsApp.
- Output receipt final memakai data transaksi dari order, tetapi nama laundry, nomor kontak laundry, dan alamat diambil dari admin settings terbaru saat render.
- Public portal tidak menampilkan nominal uang pada monthly summary.
- Untuk menjaga privasi akibat login yang lemah, public portal default tetap tidak menonjolkan nominal uang pada dashboard/list views; nominal resmi tersedia pada halaman detail order terautentikasi dan PDF receipt, bukan pada direct status token page.
- Void/cancel didukung lintas bulan; jika koreksi menyentuh bulan leaderboard yang sudah diarsipkan, sistem harus meregenerasi snapshot bulan terkait dengan audit trail yang jelas.
- Order yang di-void memakai state internal `Voided`, tetapi customer-facing status atau halaman order harus tampil sebagai `Cancelled`, bukan `Voided`.
- Minggu laporan dimulai Senin 00:00 dan berakhir Minggu 23:59:59 Asia/Jakarta.

## 7. Scope Overview

### 7.1 Admin surface

- Admin login
- Dashboard
- Customer registration and customer search
- Order creation and confirmation
- Laundry tab with `Aktif`, `Hari Ini`, and `History`
- Notification status / outbox
- Customer detail / history tab
- Manual point addition
- Settings for service prices and business profile

### 7.2 Public surface

- Marketing landing page
- Customer login
- Customer dashboard / portal
- Direct order status page from WA token
- Public leaderboard page

## 8. Service Catalog and Pricing Model

Initial service catalog:

| Service | Code | Pricing model | Default price |
| --- | --- | --- | --- |
| Washer | `washer` | fixed per unit | Rp 10.000 |
| Dryer | `dryer` | fixed per unit | Rp 10.000 |
| Detergent | `detergent` | fixed per unit | Rp 1.000 |
| Softener | `softener` | fixed per unit | Rp 1.000 |
| Paket Cuci Kering Lipat | `wash_dry_fold_package` | fixed per unit | Rp 35.000 |
| Paket Cuci Kering | `wash_dry_package` | fixed per unit | Rp 25.000 |
| Setrika | `ironing` | per kg | Rp 4.500/kg |
| Setrika Saja | `ironing_only` | per kg | Rp 5.000/kg |
| Plastik Laundry | `laundry_plastic` | fixed per unit | Rp 2.000 |
| Plastik Laundry Besar | `laundry_plastic_large` | fixed per unit | Rp 4.000 |
| Gantungan Laundry | `laundry_hanger` | fixed per unit | Rp 2.000 |

Rules:

- `washer`, `dryer`, `detergent`, `softener`, `wash_dry_fold_package`, `wash_dry_package`, `laundry_plastic`, `laundry_plastic_large`, and `laundry_hanger` use integer quantity.
- `ironing` and `ironing_only` are selectable services whose line total is `order_weight_kg x service_price_per_kg`.
- Admin settings may change prices and active status of catalog items, but may not change service codes or pricing model in v1.
- Each confirmed order stores a price snapshot for every line item and for overall totals.
- `ironing_only`, `laundry_plastic`, `wash_dry_package`, `laundry_plastic_large`, and `laundry_hanger` are POS-only catalog items and must not appear on the public landing page service list in v1.

## 9. Information Architecture

### 9.1 Admin IA

- Login
- Dashboard
- Order / POS
- Laundry
- Notifikasi
- Pelanggan
- Settings

### 9.2 Public IA

- Landing page
- Login
- Customer dashboard
- Order status page via token
- Leaderboard

## 10. End-to-End User Flows

### 10.1 Admin login

1. Admin opens `admin.cjlaundry.com`.
2. Admin enters username and password.
3. Backend validates credentials.
4. On success, backend issues secure admin session and redirects to dashboard.
5. Failed attempts show generic error and are rate limited.

### 10.2 Register customer

1. Admin opens Order/POS or Pelanggan tab.
2. Admin creates customer with:
   - full name,
   - phone number.
3. Backend normalizes phone number into canonical Indonesia format.
4. If normalized phone already exists, registration is rejected and existing customer is returned for selection.
5. On successful creation:
   - customer record is stored,
   - audit log is written,
   - exactly one welcome WA notification record is created.
6. Admin may optionally open a one-time login QR/link sheet immediately after successful creation.
7. If registration happens from the POS flow and the QR sheet is shown, the sheet must provide a clear continue CTA so the cashier can proceed directly to service selection without manually leaving the QR sheet first.
8. WhatsApp welcome message contains:
   - greeting text,
   - registered customer name,
   - registered customer phone,
   - laundry brand name,
   - laundry contact phone,
   - instruction that the customer can login using registered name and phone,
   - one-time auto-login link that can be opened directly or rendered as QR by admin UI.

### 10.3 Search/select customer before order

1. Admin searches by partial name or partial phone.
2. Search is case-insensitive for name and normalization-aware for phone.
3. Search results show enough context to disambiguate duplicate names:
   - customer name,
   - normalized phone,
   - current point balance,
   - active order count.
4. Admin selects exactly one customer before creating order.

### 10.4 Create and confirm order

1. Admin selects customer.
2. Admin enters order weight in kg.
3. Admin selects service items and quantities.
4. If `ironing` is selected, total automatically follows weight.
5. System calculates:
   - line totals,
   - subtotal before redemption,
   - available redemption capacity from current point balance,
   - redeemed Washer units selected by admin,
   - discount amount,
   - net total,
   - earned stamps.
6. Admin confirms order.
7. On confirmation, backend atomically creates:
   - order record,
   - order line items snapshot,
  - receipt source snapshot metadata,
   - points ledger entries for earned and redeemed points,
   - leaderboard contribution event,
   - audit log,
   - WhatsApp notification record for confirmation.
8. Order enters `Active` immediately after the business transaction commits.
9. System starts receipt rendering and WhatsApp delivery workflow after commit; receipt generation and media send may complete asynchronously.
10. Notification record must track render status and delivery status separately so admin can see whether failure happened during receipt generation or message sending.
11. If receipt generation or WhatsApp delivery fails:
   - order remains `Active`,
   - notification stays visible in admin outbox as pending or failed,
   - failed `order_confirmed` handling must expose `Send Message`, `Download Receipt`, `Resend Message`, `Mark as Done`, and `Ignore`,
   - failed `welcome`, `account_info`, and `order_done` handling must expose `Send Message`, `Kirim Ulang`, `Mark as Done`, and `Ignore`,
   - admin fallback must open a WhatsApp deep link with the prepared message already filled in,
   - `Send Message` and `Mark as Done` classify the item as manual handling, while `Ignore` classifies it as ignored and removes it from failed operational counts.
12. Successful WhatsApp confirmation message includes:
   - customer-friendly message,
   - order code,
   - order created timestamp,
  - receipt rendered on demand and downloadable as PDF from authenticated customer portal surfaces,
   - points earned,
   - points redeemed if any,
   - current point balance,
   - direct order status link.

### 10.5 Active laundry to done

1. Admin opens the `Laundry` tab.
2. Default view remains `Aktif` and shows all `Active` orders.
3. Additional views:
   - `Hari Ini` shows all orders created today, including completed orders, with `Cancelled` optional behind a `Show Cancelled` toggle that defaults off.
   - `History` shows the full laundry history with search, intuitive status filters, sort controls, and the same default-off `Show Cancelled` toggle.
4. Admin selects one active order and clicks `Done`.
5. Backend updates:
   - order status to `Done`,
   - order completed timestamp,
   - order history visibility,
   - audit log,
   - WhatsApp completion notification record.
6. WhatsApp done message includes:
   - customer name,
   - order code,
   - timestamp pesanan masuk,
   - timestamp pesanan selesai.
7. Jika delivery WA `order_done` gagal, order tetap `Done` dan admin outbox menyediakan fallback WhatsApp manual tanpa mengubah ulang business state order.

### 10.6 Void/cancel confirmed order

1. Admin opens a confirmed order from admin UI.
2. Admin chooses `Void/Cancel` and provides reason.
3. System validates order is still eligible for UI void:
   - not already voided
4. Backend atomically:
   - marks order as voided,
   - stores void reason and timestamp,
   - reverses earned point entries,
   - reverses redeemed point entries,
   - recalculates leaderboard contribution for the affected confirmation month,
   - excludes order from active and sales reporting,
   - writes audit log,
   - schedules or executes a versioned leaderboard snapshot rebuild when the affected month was already archived.
5. Cross-month correction is allowed in v1; archived months must not become permanently uncorrectable.
6. If a customer had already received confirmation WA, system should support an optional cancellation/correction WA notification as an operational safeguard.
7. Customer-facing order views must show `Cancelled` semantics instead of exposing raw internal `Voided`.

### 10.7 Customer management

Admin can:

- search customers,
- open customer profile,
- see point balance,
- see full order history,
- see active orders,
- see points history,
- add points manually,
- edit customer name,
- edit customer phone number.

Manual point addition rules:

- Positive addition only in v1.
- Must require admin note/reason.
- Creates ledger entry type `admin_adjustment`.
- Updates point balance immediately.
- Does not affect leaderboard.
- Is visible in customer portal as adjustment history.

Customer identity edit rules:

- Edit name and phone must create audit log entries.
- New phone number must remain unique after normalization.
- Successful identity change must preserve existing order history, points history, and customer ID.
- After a successful name or phone update, system must resend account-information WA to the latest customer number so the customer has updated login details.

### 10.8 Public customer login

1. Customer opens `cjlaundry.com`.
2. Customer navigates to login.
3. Customer enters registered phone and name.
4. Backend normalizes phone and name.
5. If match succeeds, backend creates a customer session.
6. Customer may also arrive via one-time magic-login link from WhatsApp or QR shown by admin.
7. Magic-login token is valid for one successful login only.
8. If match fails or token is invalid/reused, user sees generic failure without disclosing which field was wrong.

### 10.9 Public customer portal

Customer can view:

- current point balance,
- active orders,
- historical orders,
- order statuses,
- stamps earned history,
- redemption history,
- monthly summary without money,
- public leaderboard.

### 10.10 Direct order link from WhatsApp

1. Customer receives order-specific link.
2. Link contains an opaque, high-entropy token.
3. Opening the link shows one order only:
   - order code,
   - current status,
   - created timestamp,
   - completed timestamp if done,
   - cancelled timestamp and reason summary if voided,
   - service summary,
   - weight,
   - points earned/redeemed,
   - laundry contact details.
4. The token does not reveal customer-wide history or any other order.

### 10.11 Public leaderboard

Public leaderboard supports:

- current month top 50 customers,
- archived top 20 customers for each completed month,
- month selector for past completed months,
- privacy-safe customer aliases by default,
- customer opt-in untuk menampilkan nama uppercase penuh mereka pada leaderboard publik.

## 11. Landing Page Requirements

The public landing page must feel polished, premium, and informative. It is not merely a login screen.

Minimum sections:

- Hero section with clear value proposition and CTA.
- Service overview with current public prices.
- How it works section.
- Loyalty / stamp explanation.
- Order status / customer portal CTA.
- Leaderboard teaser.
- Business contact info and operating hours.
- FAQ covering login, points, and order updates.

Content goals:

- Explain how customers receive updates.
- Explain login method using name + phone.
- Explain stamp redemption in simple language.
- Reinforce trust and convenience.

## 12. Functional Requirements by Module

### 12.1 Admin authentication

- Single admin account for v1.
- Password stored as secure one-way hash.
- Session stored server-side or as signed secure HTTP-only cookie.
- Logout supported.
- Brute-force rate limiting required.
- Admin pages must not be accessible without valid session.

### 12.2 Customer registration

- Required fields: `name`, `phone`.
- Duplicate names allowed.
- Duplicate normalized phone disallowed.
- Registration success triggers welcome WA exactly once.
- System must prevent duplicate customer creation if network retry happens.
- Successful non-duplicate registration also creates one one-time magic-login token for welcome WA delivery.
- POS registration with optional QR display must still let the cashier continue directly into order entry without losing the selected customer.

### 12.3 Customer search

- Search by partial phone or partial name.
- Must handle duplicate names gracefully.
- Search results should return quickly even with growing dataset.

### 12.4 Laundry operations view

- Default admin laundry view remains the current `Aktif` operational list.
- `Hari Ini` must show all laundry created today, including `Done`, with section ordering optimized for operations:
  - active first by oldest created,
  - completed by newest completed,
  - cancelled by newest cancelled when shown.
- `History` must support:
  - search by customer name, phone, or order code,
  - intuitive status filters,
  - newest-first default sort,
  - optional cancelled visibility behind a default-off toggle,
  - server-side pagination or cursor-based continuation so the admin UI does not need to read the full order collection on every history visit.
- Admin operational list queries may use a lifecycle-aware activity timestamp so `Hari Ini` and `History` can be driven by the latest relevant order event (`created`, `done`, or `cancelled`) instead of repeated multi-field date scans.

### 12.4 Order builder

- Customer selection is mandatory.
- After a customer is selected, the POS flow must keep a visible customer summary at the top of later steps and confirmation surfaces.
- The visible customer summary must include:
  - customer name,
  - customer phone number,
  - current point balance when available,
  - warning if the customer already has active orders.
- Weight is mandatory and positive.
- Qty defaults to zero for all services.
- Setrika total auto-calculates from order weight.
- POS service catalog must include:
  - `Setrika Saja` at Rp 5.000/kg,
  - `Plastik Laundry` at Rp 2.000/unit.
- Order preview must show:
  - line items,
  - qty,
  - unit price,
  - subtotal,
  - redeemed points,
  - discount amount,
  - net total,
  - stamps earned,
  - resulting point balance after order.

### 12.6 Notification status / outbox

- Admin has a dedicated notification status page/outbox.
- Outbox lists queued, sent, failed, manual, and ignored notification records.
- Outbox must distinguish terminal manual handling from ignored handling in separate operator-friendly views.
- Failed registration-style notifications (`welcome`, `account_info`, `order_done`) must expose:
  - `Send Message`,
  - `Kirim Ulang`,
  - `Mark as Done`,
  - `Ignore`,
  - latest failure reason,
  - timestamps of attempts.
- Failed order-confirmation notifications must expose:
  - `Send Message`,
  - `Download Receipt`,
  - `Resend Message`,
  - `Mark as Done`,
  - `Ignore`,
  - latest failure reason,
  - timestamps of attempts.
- `Resend Message` / `Kirim Ulang` must trigger a backend-owned WhatsApp API resend immediately from the admin outbox instead of opening a manual deep link.
- `Mark as Done` must classify the notification as manual handling without retrying bot delivery.
- `Ignore` must classify the notification as ignored without keeping it in the failed operational state.
- Failed WhatsApp delivery must raise a short popup/toast notification during an active admin session.
- Orders remain valid business records even if notification delivery is pending or failed.

### 12.7 Customer profile

- Shows customer identity and current point balance.
- Shows active orders and completed orders.
- Shows points ledger history.
- Supports manual point addition with reason.
- Supports audited edit of customer name and phone.

### 12.8 Settings

Settings must support:

- laundry display name,
- laundry contact phone,
- ordered customer-facing admin WhatsApp contacts with exactly one primary contact,
- public contact info,
- service prices,
- service active/inactive state,
- WhatsApp message templates or configurable message blocks.
- Welcome WA templates must support an `{{autoLoginUrl}}` placeholder.

### 12.9 Dashboard

Dashboard must support:

- daily metrics,
- weekly metrics,
- monthly metrics.

Minimum dashboard metrics:

- net sales,
- gross sales before redemption discount,
- discount value from point redemption,
- confirmed order count,
- active order count,
- completed order count,
- total processed weight,
- average order value,
- new customers,
- points issued,
- points redeemed,
- top services,
- top customers by confirmed orders or earned stamps.
- `Perlu Perhatian` must appear above KPI cards so unresolved operational issues are visible before summary metrics.

## 13. Domain Model

### 13.1 Customer

Core fields:

- `customer_id`
- `name`
- `normalized_name`
- `phone_raw`
- `phone_normalized`
- `current_points_balance`
- `welcome_message_sent_at`
- `created_at`
- `updated_at`
- `is_active`

Notes:

- `phone_normalized` is the unique business key.
- `current_points_balance` is a derived but stored convenience field backed by ledger.
- Customer identity changes must preserve the same `customer_id`.
- Customer stores a `public_name_visible` preference that controls leaderboard display only.

### 13.2 Service catalog item

Core fields:

- `service_code`
- `display_name`
- `pricing_model`
- `default_unit_price`
- `is_active`
- `updated_at`

### 13.3 Order

Core fields:

- `order_id`
- `order_code`
- `customer_id`
- `status`
- `weight_kg`
- `subtotal_amount`
- `discount_amount`
- `net_amount`
- `earned_stamps`
- `redeemed_points`
- `redeemed_free_washer_units`
- `created_at`
- `completed_at`
- `voided_at`
- `void_reason`
- `confirmation_month_key`
- `status_token`

### 13.4 Order line item snapshot

Core fields:

- `order_line_id`
- `order_id`
- `service_code`
- `service_name_snapshot`
- `pricing_model_snapshot`
- `unit_price_snapshot`
- `quantity`
- `derived_measure_value`
- `line_total`

### 13.5 Receipt snapshot

Core fields:

- `receipt_id`
- `order_id`
- `source_format`
- `template_version`
- `source_hash`
- `source_payload`
- `render_status`
- `content_hash`
- `generated_at`
- `last_error`

### 13.6 Points ledger

Core fields:

- `points_entry_id`
- `customer_id`
- `order_id` nullable
- `entry_type`
- `points_delta`
- `balance_after`
- `leaderboard_eligible`
- `note`
- `created_at`

Expected `entry_type` values:

- `order_stamp_earned_pair`
- `order_stamp_earned_package`
- `order_redeem_free_washer`
- `order_void_reversal_earned`
- `order_void_reversal_redeem`
- `admin_adjustment`

### 13.7 WhatsApp notification record

Core fields:

- `notification_id`
- `event_type`
- `customer_id`
- `order_id` nullable
- `destination_phone`
- `payload_snapshot`
- `status`
- `render_status`
- `attempt_count`
- `last_attempt_at`
- `last_error`
- `provider_message_id` nullable
- `manual_resolution_status`
- `created_at`

Expected `event_type` values:

- `welcome`
- `order_confirmed`
- `order_done`
- `order_void_notice`

### 13.8 Monthly leaderboard snapshot

Core fields:

- `month_key`
- `customer_id`
- `display_alias`
- `earned_stamps`
- `rank`
- `snapshot_type`
- `snapshot_version`
- `frozen_at`

Snapshot types:

- `current_projection`
- `archived_final`

### 13.9 Audit log

Core fields:

- `audit_id`
- `actor_type`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `summary`
- `created_at`

## 14. Business Rules and Formulas

### 14.1 Phone normalization

- Normalize Indonesian numbers into one canonical form.
- Equivalent forms such as `08...`, `628...`, and `+628...` must resolve to the same normalized value.
- All uniqueness checks use `phone_normalized`.

### 14.2 Name normalization

- Trim leading/trailing whitespace.
- Collapse repeated spaces.
- Case-insensitive comparison for login matching.
- Stored display name uses trimmed uppercase formatting.

### 14.3 Order code

- Each order has:
  - internal opaque `order_id`,
  - human-readable `order_code`.
- `order_code` must be unique and suitable for customer communication.
- Format may be implementation-specific, but must be sortable by time and easy to read.

### 14.4 Weight rules

- `weight_kg > 0`.
- Store with 2 decimal precision.
- UI should allow decimal input.
- Default display format should be 1 decimal place unless more precision matters operationally.

### 14.5 Price calculation

For an order:

- `washer_total = washer_qty x washer_price_snapshot`
- `dryer_total = dryer_qty x dryer_price_snapshot`
- `detergent_total = detergent_qty x detergent_price_snapshot`
- `softener_total = softener_qty x softener_price_snapshot`
- `package_total = package_qty x package_price_snapshot`
- `ironing_total = weight_kg x ironing_price_snapshot` if ironing selected, otherwise `0`
- `subtotal_amount = washer_total + dryer_total + detergent_total + softener_total + package_total + ironing_total`

### 14.6 Redeem calculation

- Every 10 points can redeem 1 Washer unit discount.
- `max_redeemable_free_washer_units = min(washer_qty, floor(current_points_balance / 10))`
- Admin selects how many free Washer units to apply from `0` up to max redeemable.
- `redeemed_points = redeemed_free_washer_units x 10`
- `discount_amount = redeemed_free_washer_units x washer_price_snapshot`
- `net_amount = subtotal_amount - discount_amount`

Rule clarification:

- Redeemed Washer units remain part of the service composition.
- Redemption changes price only, not service presence.

### 14.7 Earned stamp calculation

- Earned stamp from Washer/Dryer pairs:
  - `pair_stamps = min(washer_qty, dryer_qty)`
- Earned stamp from package:
  - `package_stamps = package_qty`
- `earned_stamps = pair_stamps + package_stamps`

Rule clarification:

- Free Washer units obtained by redemption still count toward pair matching if a Dryer unit exists, because the service still occurred.
- Detergent, softener, and ironing do not generate stamps.

### 14.8 Point balance update

At order confirmation:

- subtract redeemed points first,
- add earned stamps,
- persist resulting balance,
- write ledger entries with clear entry types.

### 14.9 Status transition rules

Valid order states in v1:

- `Active`
- `Done`
- `Voided`

Valid transitions:

- `draft client-side only -> Active` on confirm
- `Active -> Done`
- `Active -> Voided`
- `Done -> Voided` when admin performs audited correction flow

No in-place edit of confirmed order is allowed.

### 14.10 Leaderboard rules

- Leaderboard month is based on order confirmation timestamp in `Asia/Jakarta`.
- Manual point adjustments do not affect leaderboard.
- Point redemption does not subtract leaderboard score.
- Void removes the order's leaderboard contribution from the affected confirmation month even if that month has already been archived.
- Current month shows top 50.
- Archived completed months show top 20.
- Archived months are stored as versioned snapshots; later corrections create a newer audited snapshot version rather than silently overwriting history.

Tie-break order:

1. higher `earned_stamps`
2. earlier timestamp of the latest qualifying stamp event that brought the customer to that score
3. lower `customer_id` lexicographically

### 14.11 Public leaderboard privacy rules

- Public leaderboard must not show phone numbers.
- Public leaderboard should hide customer identity by default.
- Use a privacy-safe alias, for example first name plus masked remainder or initial, unless the customer has explicitly opted in to show their uppercase name.
- Rank and earned-stamp ordering remain snapshot-backed; display name may resolve from live customer preference at read time.

### 14.12 Void rules

- Void requires a reason.
- Void excludes the order from sales reporting.
- Void reverses points and recalculates leaderboard contribution for the affected confirmation month, including archived months when necessary.
- If the affected leaderboard month is already archived, snapshot rebuild must produce a new version with audit trace.
- Void invalidates active-order presentation.
- Customer-facing order history and direct token page must read `Cancelled`, not raw `Voided`.

## 15. Notification Requirements

### 15.1 Welcome WA

Triggered only on first successful customer creation.

Must include:

- greeting / welcome copy,
- customer registered name,
- customer registered phone,
- laundry name,
- laundry phone,
- brief explanation of login using phone + name,
- one-time auto-login URL suitable for direct tap from WhatsApp.

### 15.2 Order confirmed WA

Triggered once per successfully confirmed order.

Must include:

- customer-friendly message,
- order code,
- order created timestamp,
- earned stamp count,
- redeemed points count if applicable,
- new current point balance,
- direct status link,
- receipt PDF rendered on demand untuk pengiriman bot WhatsApp.
- receipt PDF downloadable from authenticated portal order detail.
- admin notification fallback receipt downloadable as image.

Failure handling:

- If receipt rendering or media delivery fails after order confirmation, the order remains valid and stays `Active`.
- The related notification must enter a visible pending/failed outbox state for operator follow-up.
- Admin must be able to download the fallback receipt image on demand and trigger a backend-owned WhatsApp API resend when delivery has failed.
- Failed notifications without receipt should still support direct retry from the admin outbox.

### 15.3 Order done WA

Triggered once per order completion.

Must include:

- customer name,
- order code,
- order created timestamp,
- order completed timestamp,
- completion message.

### 15.4 Notification delivery requirements

- Message generation must be idempotent per business event.
- Delivery retries must not duplicate business side effects.
- Message status must be trackable as `queued`, `sent`, `failed`, `manual_resolved`, and `ignored`.
- Receipt render status and message delivery status must be tracked separately for order-confirmed notifications.
- Failed or pending confirmation notifications must remain visible in admin outbox until successfully sent or manually resolved.
- Admin outbox must support a focused recovery UX:
  - failed `order_confirmed`: `Send Message`, `Download Receipt`, `Resend Message`, `Mark as Done`, and `Ignore`
  - failed `welcome`, `account_info`, and `order_done`: `Send Message`, `Kirim Ulang`, `Mark as Done`, and `Ignore`
- `Send Message` and `Mark as Done` must classify the item as manual handling.
- `Ignore` must classify the item as ignored without counting as failed or sent.
- Order business state must not roll back only because notification rendering or delivery failed.
- WhatsApp session disconnect should surface operationally in admin monitoring/logs.
- Session/auth artifacts for the WhatsApp bot must be persisted outside ephemeral container storage.
- Admin UI should surface a short popup notification when a new failed WhatsApp notification is detected during an active session.

## 16. Security Requirements

### 16.1 Core security posture

- Only the backend API may write core business data.
- Public clients must never have direct MongoDB credentials or network access to the database.
- Database credentials and connection strings must remain server-side only.
- Transport must use HTTPS on all public domains.

### 16.2 Admin security

- Admin login rate limiting required.
- Session must be secure, HTTP-only, same-site protected, and revocable.
- Password must be hashed using a modern password hashing algorithm.
- CORS for admin-protected endpoints limited to the admin frontend origin.

### 16.3 Customer portal security

- Customer login must use generic failure responses.
- Rate limiting by IP and by normalized phone required.
- Session must be read-only with no business mutation ability.
- Customer portal may access only data for the authenticated customer_id.

### 16.4 Direct order status token security

- Token must be high entropy and unguessable.
- Token must only grant read access to one order.
- Token must not allow list traversal, customer history access, or lookup by incremental IDs.
- Token should be revocable when order is voided or if abuse is detected.

### 16.5 MongoDB and VM security requirements

- MongoDB must run on the internal Docker network and must not be exposed directly on a public interface.
- MongoDB authentication must be enabled, with separate credentials per environment.
- If multi-document transactions are used for order, ledger, and notification writes, the MongoDB deployment must be configured to support transactions.
- Prefer routing all business reads and writes through the backend API for policy consistency.
- If any public client-side read is ever enabled, it must be restricted to explicitly safe, denormalized read models only.

### 16.6 API safeguards

- Use server-side validation for every payload.
- Enforce idempotency on create-customer, confirm-order, mark-done, and void-order operations.
- Reject unauthorized origin usage.
- Maintain audit logs for sensitive admin actions.

### 16.7 Data exposure policy

- Public customer portal must avoid exposing unrelated customer data.
- Leaderboards must use masked aliases by default, with explicit customer opt-in required before a full uppercase name may be shown publicly.
- Monthly summary must not contain money values.
- Receipt source snapshots must remain backend-only; only rendered PDF output for authorized order detail views may be exposed to public clients.

## 17. Reporting and Analytics Requirements

### 17.1 Reporting basis

- Sales reporting includes only confirmed and not voided orders.
- Reporting timezone is Asia/Jakarta.
- Current dashboard views use:
  - daily,
  - weekly,
  - monthly windows.

### 17.2 Required metrics

- gross sales
- net sales
- redemption discount total
- confirmed orders
- completed orders
- active orders
- total weight processed
- avg order value
- new customers
- points earned
- points redeemed
- manual points added
- top service usage

### 17.3 Suggested relevant metrics

- order completion turnaround time
- percentage of orders using redemption
- most active customers this month
- WA notification failure count

## 18. Public Customer Data Presentation

### 18.1 Customer dashboard contents

- current points balance
- active orders
- completed order history
- stamps earned history
- stamp redemption history
- monthly summary
- chat-admin CTA that lets customer choose among configured admin WhatsApp numbers
- visible logout control on both desktop and mobile layouts

### 18.2 Monthly summary contents

Monthly summary must not include nominal money.

Suggested summary fields:

- total orders created in month
- total completed orders in month
- active orders still open
- total weight processed
- total earned stamps
- total redeemed points
- number of free Washer units used

### 18.3 Order history presentation

Order history should prioritize:

- order code,
- status,
- timestamps,
- weight,
- service composition,
- earned/redeemed points.

Money values in portal are optional and should remain deprioritized in v1 because customer auth is intentionally weak. Official monetary proof is the receipt snapshot delivered by WhatsApp and the admin system of record.

Authenticated portal order detail may still present itemized prices, subtotal, discount, total, and PDF receipt download for the customer’s own order. Direct status token pages remain non-monetary summary views.

## 19. Operational Edge Cases

### 19.1 Duplicate registration attempt

- Same normalized phone must not create a second customer.
- System returns existing customer context for admin selection.

### 19.2 Duplicate name customers

- Search results must show phone and points to disambiguate.
- Public login remains safe because phone must still match.

### 19.3 Multiple active orders for one customer

- Every order remains independent with its own status, timestamps, receipt, and direct link.

### 19.4 Washer without Dryer

- Washer-only order is valid if business allows it.
- Washer-only does not generate pair stamp unless paired Dryer exists.

### 19.5 Dryer without Washer

- Dryer-only order is valid if business allows it.
- Dryer-only does not generate pair stamp.

### 19.6 Package together with other services

- Package can coexist with other services in one order.
- Package always contributes `1 stamp per package unit`.

### 19.7 Redemption with insufficient points

- System blocks excess redemption above available balance.
- Admin can still proceed with a lower or zero redemption.

### 19.8 Retry after network interruption

- Confirm order endpoint must be idempotent to prevent duplicated orders, duplicated points, and duplicated WA event records.

### 19.9 WhatsApp send failure

- Business transaction remains committed if order creation succeeded.
- Notification record is marked pending/failed in outbox and remains retryable.
- Admin should be able to identify whether failure happened at receipt render or delivery stage.
- Admin must have focused fallback actions appropriate to the failed notification type, including image receipt download for failed `order_confirmed`.

### 19.10 Order done after month changes

- Completion month does not alter leaderboard month.
- Leaderboard always follows confirmation month.

### 19.11 Void after month archive

- Cross-month void remains supported even after the relevant month has been archived.
- Historical correction must trigger audited rebuild of the affected archived leaderboard snapshot version.

### 19.12 Customer login abuse

- Repeated failed attempts trigger temporary throttling.
- Responses stay generic to avoid account enumeration.

## 20. Non-Functional Requirements

### 20.1 Performance

- Customer search should feel near-instant for typical operator usage.
- Admin order calculation should update immediately on input changes.
- Order confirmation API should complete fast enough for front-desk use, while receipt generation and WA delivery may finish asynchronously after business commit.
- Laundry `History` must not require loading the entire order collection for a normal operator session; use server-side pagination/cursoring and indexes aligned to the chosen activity timestamp.
- Laundry operational filters should prefer index-friendly fields over repeated broad regex or multi-timestamp scans as order volume grows.

### 20.2 Reliability

- Core business writes must be atomic from the perspective of admin action.
- Ledger and order balance consistency is more important than instant notification delivery.
- Failed background notifications must be retryable.
- Cross-month leaderboard rebuilds caused by void/correction must be deterministic and auditable.

### 20.3 Auditability

- Sensitive admin actions must be logged.
- Orders must remain historically reconstructable from snapshots and ledger entries.

### 20.4 Maintainability

- Domain logic for pricing, points, leaderboard, and notification generation must be centralized server-side.
- Frontends should consume stable API contracts, not reimplement pricing logic as source of truth.

### 20.5 Backup and recovery

- MongoDB data volume should be backed up according to operational policy, with separate backup sets for staging and production.
- WhatsApp bot session data and generated receipt references must survive container restarts.

## 21. Deployment Topology

### 21.1 Domains

- Admin frontend: `https://admin.cjlaundry.com`
- Public frontend: `https://cjlaundry.com`
- Backend API: `https://api.cjlaundry.com`

### 21.2 Hosting

- Admin app, public app, and backend API are released together as one monolithic application on the same VM per environment.
- Backend runtime uses Express.js.
- MongoDB runs in Docker Compose on the same VM environment as the application stack.
- Receipt source snapshots remain inside MongoDB; no separate object/file storage is required for v1.
- Staging and production each use their own VM, Docker Compose stack, secrets, and persistent volumes.

### 21.3 Infrastructure requirements

- Reverse proxy / TLS termination on the VM for public, admin, and API domains.
- Distinct environment variables per environment, even though admin/public/API are deployed as one monolith.
- Secure secret management for:
  - MongoDB credentials,
  - admin bootstrap credentials,
  - session secrets,
  - WhatsApp bot session/config.
- Persistent Docker volumes for MongoDB data and WhatsApp session state.
- CORS must explicitly allow only intended origins.

### 21.4 Deployment workflow

- Push ke branch `staging` memicu pipeline build, artifact update, dan deploy otomatis ke VM staging.
- Push ke branch `main` memicu pipeline build, artifact update, dan deploy otomatis ke VM production.
- Staging dan production harus memakai secret set, MongoDB volume, dan endpoint/domain yang terpisah.
- Deployment harus menjalankan smoke check minimum untuk proses app, koneksi MongoDB, dan health endpoint setelah release.

## 22. Acceptance Criteria

### 22.1 Customer registration

- Admin can create a customer with name and phone.
- Duplicate phone is rejected.
- Successful creation creates one welcome WA event and never duplicates it on retry.
- Successful non-duplicate creation also returns one one-time login URL for optional admin QR presentation.
- POS registration can continue directly from the QR sheet into service selection while keeping the newly created customer selected.
- Admin can later edit customer name and phone through audited flow without breaking customer history or customer ID.
- Successful identity change resends account-information WA to the latest normalized phone number.

### 22.2 Order creation

- Admin can select an existing customer, enter weight, choose services, and confirm.
- System correctly computes subtotal, redemption discount, net total, earned stamps, and resulting point balance.
- Confirmed order becomes `Active`.
- Receipt snapshot is generated and linked to the order.
- Confirmation WA event is recorded once.
- If receipt rendering or WhatsApp delivery fails, the order remains `Active` and the failed notification appears in admin outbox for direct WhatsApp API resend or operator classification (`Mark as Done` / `Ignore`).
- Admin fallback receipt download for failed `order_confirmed` is an image; authenticated customer receipt download remains PDF.

### 22.3 Point logic

- Washer/Dryer pairs earn 1 stamp per matched pair dari Washer yang tidak digratiskan oleh redeem.
- `wash_dry_fold_package` and `wash_dry_package` each earn 1 stamp per package unit.
- Redemption spends 10 points per free Washer unit.
- Manual point addition changes balance but not leaderboard.
- Void reverses points and recalculates the relevant leaderboard month even if that month is already archived.

### 22.4 Order completion

- Admin can mark any active order as done.
- Order disappears from active list and appears as completed.
- Done WA event is recorded once with correct timestamps.

### 22.5 Customer portal

- Customer can login with normalized phone + name.
- Customer can also login via one-time magic link/QR delivered through admin or welcome WA.
- Customer sees only their own points, orders, and history.
- Monthly summary contains no money values.
- Authenticated order detail shows itemized prices/totals and supports PDF receipt download for the customer’s own order.
- Direct order link shows only the targeted order.
- Cancelled/voided orders are shown to customers as `Cancelled`, never `Voided`.
- Customer portal exposes a chat-admin selector backed by the configured admin WhatsApp numbers.
- Customer session remains active with a sliding 30-day renewal from the latest authenticated request.

### 22.6 Leaderboard

- Current month leaderboard shows top 50 by earned stamps.
- Completed months show archived top 20.
- Admin adjustments and redemption deductions do not affect leaderboard scores.
- Leaderboard identity is privacy-safe by default and only shows full uppercase customer names after explicit opt-in.

### 22.7 Security

- Public clients cannot mutate core business data directly in MongoDB or by bypassing the backend API.
- Admin endpoints reject unauthenticated requests.
- Customer login flow is rate limited and non-enumerating.
- Direct status token cannot be guessed or expanded into broader data access.
- Cross-month correction and leaderboard rebuilds leave auditable snapshot version trail.

### 22.9 Deployment workflow

- Push to `staging` results in an automated deployment to the staging VM without manual image promotion steps outside the pipeline.
- Push to `main` results in an automated deployment to the production VM.
- A failed deployment must not overwrite the previous healthy MongoDB volume or leave the app without a recoverable prior release path.

### 22.8 Reporting

- Daily, weekly, and monthly reports exclude voided orders.
- Reports use Asia/Jakarta boundaries.
- Dashboard shows at least the required metrics listed in this PRD.

## 23. Test Scenarios

The implementation must explicitly cover at minimum:

1. Customer registration with duplicate name but unique phone.
2. Re-register existing phone number.
3. Multiple concurrent active orders for one customer.
4. Order with multiple Washer/Dryer quantities and correct stamp pairing.
5. Order redeeming multiple Washer units with sufficient points.
6. Order cancellation after receipt/WA creation and proper rollback of points plus leaderboard.
7. Manual point adjustment visibility in customer portal without affecting leaderboard.
8. Price catalog change after historical orders already exist.
9. Direct public order link access without login while still blocking unrelated customer data.
10. Leaderboard current month vs archived previous months.
11. Dashboard aggregation by day, week, and month in `Asia/Jakarta`.
12. WhatsApp retry/idempotency so duplicate sends do not create duplicate business events.
13. Login abuse throttling and generic error handling.
14. Cross-month void on an archived leaderboard month triggers snapshot rebuild with audit/version trail.
15. Receipt render failure or WhatsApp media send failure appears in outbox with the focused fallback actions expected for that notification type, including image receipt download for failed `order_confirmed`.
16. Customer identity edit preserves history, enforces unique normalized phone, and resends updated account-information WA.
17. Welcome WA one-time auto-login link succeeds once and rejects token reuse.
18. Additional QR/login links generated from customer detail do not revoke older unused one-time links.
19. Landing page and portal contact CTA follow the primary configured admin WhatsApp contact with fallback `087780563875`.

## 24. Suggested Implementation Notes

These notes are intentionally prescriptive enough to reduce ambiguity, while still leaving framework-level choices open.

- Use Express.js as the backend runtime and keep admin/public/API module boundaries explicit even though deployment is monolithic.
- Prefer MongoDB transaction boundaries or an equivalent atomic write strategy around customer balance updates, order creation, and ledger writes.
- Treat the points ledger as source of truth and stored balance as denormalized convenience.
- Generate receipt and send WhatsApp asynchronously after the business transaction commits, but persist notification records synchronously.
- For admin laundry read paths, prefer a denormalized lifecycle activity field such as `activityAt` and paginated read APIs before introducing heavier read models.
- Use an outbox-like pattern or equivalent job queue semantics so message retries are safe.
- Keep all pricing, point, redemption, and leaderboard logic in backend domain services.
- Expose only read models needed by admin and public frontends.
- Version archived leaderboard snapshots so cross-month correction remains auditable instead of destructive overwrite.
- Keep Docker Compose service boundaries minimal and operationally explicit, at least separating app runtime, MongoDB, and supporting reverse proxy/session persistence concerns.

## 25. Deferred Decisions for Later Docs

The following should be detailed in separate design/technical docs, not re-decided at implementation time:

- Admin UI interaction design and screen layouts.
- Public landing page visual direction and section copy.
- Exact API route definitions and payload schemas.
- MongoDB collection naming, indexing strategy, and backup rotation policy.
- Receipt rendering technology.
- Specific WhatsApp library/runtime selection.

This PRD freezes the product behavior and operational rules for CJ Laundry POS v1.
