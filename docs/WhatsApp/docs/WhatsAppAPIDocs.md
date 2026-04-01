# WhatsApp Business Platform / Cloud API Base Guide untuk CJ Laundry

Dokumen status: active  
Tanggal penulisan: 2026-04-02  
Tujuan: baseline guide migrasi dari gateway `whatsapp-web.js` ke official WhatsApp Business Platform / Cloud API untuk skema pesan CJ Laundry yang dipakai aplikasi saat ini.

## 1. Scope Dokumen

Dokumen ini hanya membahas kebutuhan yang relevan untuk skema messaging CJ Laundry saat ini:

- `welcome`
- `order_confirmed`
- `order_done`
- `order_void_notice`
- `account_info`

Di luar scope dokumen ini:

- marketing campaign
- catalog / commerce flows
- payments
- calling / voice
- advanced inbound automation / chatbot orchestration
- redesign produk notifikasi di luar event yang sudah ada

Default keputusan untuk baseline migrasi ini:

- semua notifikasi otomatis CJ Laundry diperlakukan sebagai **template-first**
- non-template free-form message hanya boleh dipakai jika implementasi nanti dengan sengaja mendeteksi bahwa **24-hour customer service window** memang sedang terbuka

## 2. Kenapa Cloud API Menggantikan Gateway Saat Ini

Repo saat ini masih memakai transport runtime berbasis gateway sidecar `whatsapp-web.js`, tetapi struktur aplikasi sudah cukup siap untuk dipindahkan ke provider resmi karena:

- business event notifikasi sudah dipusatkan di backend notification record
- message composition sudah dimiliki backend melalui `buildPreparedMessage(...)`
- delivery sudah didelegasikan ke adapter transport, bukan ditulis inline di seluruh flow bisnis
- retry, failed outbox, manual fallback, dan receipt rendering sudah dipisahkan dari business transaction inti

Artinya, migrasi utama nanti bukan mengubah flow bisnis order/customer, tetapi mengganti lapisan provider WhatsApp dan event ingestion-nya.

## 3. Source Baseline yang Dipakai

Semua referensi eksternal di bawah ini berasal dari dokumentasi resmi Meta yang saya verifikasi pada **2026-04-02**:

1. [About the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/about-the-platform)
2. [Sending messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
3. [Templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/overview)
4. [Template components](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/components)
5. [Utility templates](https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/utility-templates/utility-templates)
6. [Webhooks overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
7. [messages webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages)
8. [status messages webhook reference](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/reference/messages/status)
9. [Pricing on the WhatsApp Business Platform](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing)

Sumber official tambahan di repo:

- [`docs/WhatsApp/docs/WhatsApp Cloud API.postman_collection.json`](./WhatsApp%20Cloud%20API.postman_collection.json)

Catatan versi:

- contoh endpoint resmi Meta yang terlihat pada halaman `Sending messages` dan `Utility templates` memakai `v25.0`
- Postman collection official Meta tetap memakai placeholder `{{Version}}`
- untuk implementasi nanti, pilih satu Graph API version yang dipin secara eksplisit; jangan mengandalkan perilaku implicit versioning

## 4. Produk Meta yang Relevan untuk CJ Laundry

Untuk kebutuhan CJ Laundry, yang relevan adalah:

- **Cloud API**
  - untuk `POST /<PHONE_NUMBER_ID>/messages`
  - mengirim text, template, document/image/video messages, dan interactive payload
- **WhatsApp Business Management API**
  - untuk mengelola template, phone number, dan WABA assets
- **Webhooks**
  - untuk inbound `messages[]`
  - untuk outbound `statuses[]`
  - untuk template status / quality updates
- **WhatsApp Manager**
  - untuk operasional template review, template status, quality, dan asset inspection

## 5. Message Model Aplikasi Saat Ini

### 5.1 Event outbound yang aktif di app

| Event | Trigger bisnis saat ini | Keterangan |
| --- | --- | --- |
| `welcome` | customer baru berhasil dibuat | berisi data login pelanggan + one-time auto-login link |
| `order_confirmed` | order berhasil dikonfirmasi | berisi ringkasan order, poin, direct status link, dan saat ini mengirim PDF receipt |
| `order_done` | order ditandai selesai | berisi waktu order masuk dan selesai |
| `order_void_notice` | void/cancel dengan `notifyCustomer=true` | notifikasi koreksi operasional |
| `account_info` | nama / nomor customer diubah | berisi info akun terbaru |

### 5.2 Fakta repo yang penting untuk migrasi

- `order_confirmed` saat ini memisahkan:
  - business transaction
  - receipt rendering
  - message delivery
- `order_confirmed` saat ini mengirim attachment PDF via transport adapter
- admin manual fallback tetap merupakan flow terpisah dari automatic delivery dan harus dipertahankan sebagai konsep operasional
- record notifikasi saat ini menyimpan field provider-spesifik seperti:
  - `providerMessageId`
  - `providerChatId`
  - `providerAck`
  - `gatewayErrorCode`
- `providerAck` saat ini mengikuti semantik angka milik runtime `whatsapp-web.js`; ini **tidak** bisa dipertahankan apa adanya di Cloud API
- mirrored chat saat ini memakai identitas seperti `@c.us`; ini bukan identitas canonical Cloud API dan nanti harus diganti ke `wa_id` / phone-based identity

### 5.3 Parameter message yang benar-benar dipakai app saat ini

| Event | Runtime params yang saat ini disiapkan backend |
| --- | --- |
| `welcome` | `customerName`, `customerPhone`, `laundryName`, `autoLoginUrl` |
| `order_confirmed` | `customerName`, `orderCode`, `createdAt`, `weightKgLabel`, `serviceSummary`, `totalLabel`, `earnedStamps`, `redeemedPoints`, `currentPoints`, `statusUrl` |
| `order_done` | `customerName`, `orderCode`, `createdAt`, `completedAt` |
| `order_void_notice` | `customerName`, `orderCode`, `reason` |
| `account_info` | `customerName`, `customerPhone`, `laundryName` |

Implikasi migrasi:

- model event domain belum perlu diubah dulu
- yang perlu berubah adalah cara event tersebut diterjemahkan ke payload Meta

## 6. Constraint Resmi Meta yang Wajib Jadi Dasar Desain

### 6.1 Customer service window

Menurut docs resmi `Sending messages`:

- ketika user menghubungi bisnis, terbuka **24-hour customer service window**
- saat window terbuka, bisnis boleh mengirim **any type of message**
- saat window tidak terbuka, bisnis hanya boleh mengirim **template messages**

Konsekuensi untuk CJ Laundry:

- karena event seperti `welcome`, `order_confirmed`, `order_done`, `account_info`, dan `order_void_notice` sering bersifat business-initiated, baseline aman adalah **selalu siapkan template**

### 6.2 Utility template adalah kategori yang paling cocok

Menurut docs `Utility templates`:

- utility template umumnya dikirim sebagai respons terhadap aksi user atau update transaksional, seperti order confirmation atau order update
- jika kontennya mengandung material marketing, template dapat direkategori menjadi marketing

Konsekuensi untuk CJ Laundry:

- seluruh notifikasi operasional CJ Laundry sebaiknya dimodelkan sebagai **utility templates**
- copy template harus tetap transaksional, informatif, dan tidak menyisipkan promosi

### 6.3 Delivery ordering tidak dijamin

Menurut docs `Sending messages` dan `Templates`:

- urutan delivery banyak message tidak dijamin mengikuti urutan request API
- jika urutan penting, tunggu webhook `delivered` sebelum mengirim message berikutnya

Konsekuensi untuk CJ Laundry:

- `order_confirmed` **tidak boleh** didesain sebagai dua message terpisah:
  - satu text
  - satu receipt
- baseline yang lebih aman adalah **satu utility template** dengan `DOCUMENT` header agar ringkasan order dan receipt berjalan dalam satu unit pesan

### 6.4 Webhook retries bisa menimbulkan duplicate events

Menurut docs `Webhooks overview`:

- webhook akan di-retry sampai 7 hari jika endpoint tidak membalas `200`
- retry bisa menghasilkan duplicate webhook notifications

Konsekuensi untuk CJ Laundry:

- ingestion webhook wajib idempotent
- dedup tidak boleh bergantung pada asumsi sekali kirim sekali event

### 6.5 Phone format di boundary provider

Menurut docs `Sending messages`:

- Meta mendukung beberapa format input nomor, tetapi sangat merekomendasikan memakai plus sign dan country code
- mengirim nomor lokal tanpa country code dapat berujung salah kirim / tidak terkirim

Konsekuensi untuk CJ Laundry:

- format storage internal `08...` boleh tetap ada di app
- tetapi pada boundary Cloud API, nomor harus dinormalisasi menjadi format internasional E.164-ish dengan country code Indonesia, misalnya `+628...` atau digits `628...` sesuai endpoint/payload yang dipakai
- implementasi nanti tidak boleh mengirim `08...` langsung ke Meta

### 6.6 Non-template messages, CSW, dan Free Entry Point window

Menurut docs resmi `Pricing on the WhatsApp Business Platform` yang saya akses pada **2026-04-02** dan yang pada halaman tersebut bertanggal **2026-03-30**:

- semua non-template messages gratis, tetapi **hanya** dapat dikirim dalam open customer service window
- utility template yang dikirim dalam open customer service window juga gratis
- jika user masuk lewat **Click to WhatsApp Ad** atau **Facebook Page Call-to-Action button** dari app Android/iOS, lalu bisnis merespons dalam 24 jam, maka terbuka **Free Entry Point (FEP) window** selama 72 jam
- selama FEP terbuka, semua message gratis
- tetapi **FEP window independen dari CSW**
- jika CSW sudah tertutup, maka walaupun FEP masih terbuka, bisnis **hanya boleh** mengirim template messages

Konsekuensi untuk CJ Laundry:

- composer non-template harus aktif **hanya** saat `CSW Open`
- `FEP Open` tetap penting untuk pricing visibility, tetapi bukan override rule eligibility
- interface nanti harus membedakan dengan jelas:
  - `CSW Open`
  - `FEP Open`
  - `Template Only`

## 7. Required Meta Assets dan Credentials

Sebelum integrasi, CJ Laundry minimal harus punya:

- `META_BUSINESS_ID`
  - business portfolio ID
- `WABA_ID`
  - WhatsApp Business Account ID
- `PHONE_NUMBER_ID`
  - business phone number ID untuk send API
- access token
  - idealnya system user token atau business token
- webhook verify token
- app secret
- app webhook endpoint publik
- app subscription ke WABA (`/<WABA_ID>/subscribed_apps`)
- approved template set untuk semua event operasional
- template identifier data yang akan disimpan di app
  - minimal `name` + `language`
  - bila perlu juga `template_id`

Tambahan yang sangat mungkin dibutuhkan saat implementasi:

- media asset IDs / upload handles untuk template dengan `DOCUMENT` atau `IMAGE` header
- kebijakan penyimpanan raw webhook payload untuk audit/debug

## 8. Minimal Endpoint Inventory yang Relevan

Base host:

- `https://graph.facebook.com/<API_VERSION>`

Endpoint minimum yang perlu dipahami untuk migrasi CJ Laundry:

| Endpoint | Fungsi | Kenapa relevan |
| --- | --- | --- |
| `POST /<WABA_ID>/subscribed_apps` | subscribe app ke webhook WABA | wajib agar event webhook masuk |
| `GET /<WABA_ID>/phone_numbers` | ambil daftar phone number | untuk mendapatkan / memvalidasi `PHONE_NUMBER_ID` |
| `POST /<PHONE_NUMBER_ID>/register` | register phone number | dibutuhkan saat setup / migration flow tertentu |
| `POST /<PHONE_NUMBER_ID>/messages` | kirim message | endpoint utama untuk text/template |
| `POST /<WABA_ID>/message_templates` | create template | diperlukan saat persiapan template CJ Laundry |
| `GET /<WABA_ID>/message_templates` | list templates | untuk sync / audit template yang tersedia |
| `GET /<TEMPLATE_ID>?fields=status` | cek status template | untuk approval / troubleshoot |
| `POST /app/uploads` lalu upload ke `/<UPLOAD_ID>` | Resumable Upload API | untuk example media / handle saat create template media header |

Catatan praktis:

- docs resmi `Template components` menyatakan media header pada template creation memakai **Resumable Upload API** untuk memperoleh **asset handle**
- docs `Utility templates` untuk send template menunjukkan media header saat pengiriman memakai media asset `id`
- artinya implementasi template CJ Laundry yang memakai `DOCUMENT` header harus membedakan:
  - kebutuhan asset saat **create template**
  - kebutuhan media asset saat **send template**

## 9. Current App Message Matrix dan Rekomendasi Cloud API

| Event | Trigger app saat ini | Bentuk pesan saat ini | Rekomendasi Cloud API | Alasan |
| --- | --- | --- | --- | --- |
| `welcome` | customer created | text dengan login info + `autoLoginUrl` | utility template, body text + optional URL button | sering dikirim di luar window; konten transaksional |
| `order_confirmed` | order confirmed | text + PDF receipt + status link | utility template dengan `DOCUMENT` header, body params, status URL button atau link di body | menjaga atomisitas pesan dan menghindari masalah ordering |
| `order_done` | order marked done | text update waktu selesai | utility template body-only | konten update operasional |
| `order_void_notice` | void with notify | text koreksi | utility template body-only | transaksional jika murni koreksi |
| `account_info` | customer identity updated | text info akun terbaru | utility template body-only, optional login link | konten update akun, bukan promo |

### 9.1 Catatan khusus `order_confirmed`

Ini event paling penting untuk migrasi karena:

- saat ini backend memang sudah merender PDF
- user expectation-nya adalah menerima ringkasan order + receipt
- Meta tidak menjamin message sequence jika kita mengirim lebih dari satu message

Baseline desain yang direkomendasikan:

- satu template utility `order_confirmed`
- `HEADER` = `DOCUMENT`
- `BODY` = parameter order utama
- optional `URL` button ke `statusUrl`

## 10. Strategi Template per Event

### 10.1 `welcome`

Rekomendasi:

- category: `UTILITY`
- komponen minimal:
  - `BODY`
- komponen opsional:
  - `URL` button untuk portal atau magic login

Parameter minimum yang perlu tersedia saat send:

- `customerName`
- `customerPhone`
- `autoLoginUrl` atau `portalUrl`

Catatan:

- jika `autoLoginUrl` dipakai langsung di body, validasi panjang message dan template review copy
- bila ingin UX lebih rapi, button URL lebih baik daripada menaruh banyak link mentah

### 10.2 `order_confirmed`

Rekomendasi:

- category: `UTILITY`
- komponen minimal:
  - `HEADER` `DOCUMENT`
  - `BODY`
- komponen opsional:
  - `FOOTER`
  - `URL` button ke status order
  - `PHONE_NUMBER` button ke admin jika benar-benar diperlukan

Parameter minimum saat send:

- `orderCode`
- `createdAt`
- `weightKgLabel`
- `serviceSummary`
- `totalLabel`
- `earnedStamps`
- `redeemedPoints`
- `currentPoints`
- `statusUrl`

Dokumen header:

- receipt PDF harus dianggap asset/payload terpisah dari body text
- implementasi nanti perlu memastikan dokumen yang dikirim konsisten dengan receipt renderer backend yang sudah ada

### 10.3 `order_done`

Rekomendasi:

- category: `UTILITY`
- komponen minimal:
  - `BODY`

Parameter minimum:

- `customerName`
- `orderCode`
- `createdAt`
- `completedAt`

### 10.4 `account_info`

Rekomendasi:

- category: `UTILITY`
- komponen minimal:
  - `BODY`
- komponen opsional:
  - URL button ke portal login / auto-login

Parameter minimum:

- `customerName`
- `customerPhone`
- optional `autoLoginUrl`

### 10.5 `order_void_notice`

Rekomendasi:

- category: `UTILITY`, **hanya jika isi tetap murni koreksi transaksi**
- komponen minimal:
  - `BODY`

Parameter minimum:

- `customerName`
- `orderCode`
- `reason`

Catatan:

- jika nanti copy template berubah menjadi apology/promotional copy yang terlalu luas, ada risiko recategorization

## 11. Minimal Bentuk Payload yang Perlu Dibayangkan Saat Integrasi

### 11.1 Send template

Pattern umum official Meta:

```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "628xxxxxxxxxx",
  "type": "template",
  "template": {
    "name": "order_confirmation",
    "language": {
      "code": "id"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "document",
            "document": {
              "id": "<MEDIA_ASSET_ID>"
            }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          {
            "type": "text",
            "parameter_name": "order_code",
            "text": "CJ-..."
          }
        ]
      }
    ]
  }
}
```

### 11.2 Send response

Yang penting untuk app ini dari response sukses:

- `messages[0].id` sebagai provider message id utama
- `message_status` hanya berarti request diterima / pacing state tertentu, **bukan** berarti delivered

Jadi:

- response send tidak cukup untuk menyatakan sukses delivery
- final delivery status tetap harus ditentukan lewat webhook `statuses[]`

## 12. Webhook Mapping untuk Repo Ini

## 12.1 Yang perlu di-subscribe minimal

Untuk baseline CJ Laundry, minimal subscribe:

- `messages`
- `message_template_status_update`
- `message_template_quality_update`
- optional: `message_template_components_update`

## 12.2 Inbound webhook yang relevan

### `messages[]`

Dipakai untuk:

- mirror inbox customer ke admin read-only view
- menjadi sumber utama inbox-style interface internal
- menyimpan inbound text/media yang masuk
- menghubungkan inbound message ke customer berdasarkan nomor / `wa_id`
- membantu menentukan pembukaan / refresh customer service window

Mapping dasar:

| Cloud API field | Kegunaan di repo |
| --- | --- |
| `contacts[].wa_id` | kandidat identitas chat/customer level |
| `contacts[].profile.name` | display name inbound |
| `messages[].id` | provider message id inbound |
| `messages[].type` | type inbound message |
| `messages[].text.body` | preview/body text |
| `metadata.phone_number_id` | nomor bisnis penerima webhook |

Catatan:

- model chat `@c.us` dari provider lama tidak boleh dipertahankan
- identity canonical nanti harus berbasis `wa_id` dan/atau normalized phone

## 12.3 Outbound status webhook yang relevan

### `statuses[]`

Menurut docs `Status messages webhook reference`, status penting untuk app ini:

- `sent`
- `delivered`
- `read`
- `failed`
- `played` untuk voice, saat ini tidak relevan

Mapping baseline ke model notifikasi repo saat ini:

| Cloud API status | Rekomendasi mapping ke repo saat ini |
| --- | --- |
| `sent` | set `providerMessageId`; `deliveryStatus` bisa tetap `sent` |
| `delivered` | simpan raw provider status tambahan; `deliveryStatus` tetap `sent` |
| `read` | simpan raw provider status tambahan; `deliveryStatus` tetap `sent` |
| `failed` | `deliveryStatus = failed`; isi reason/error code dari `statuses[].errors[]` |

Mapping field penting:

| Cloud API field | Target repo saat ini | Catatan |
| --- | --- | --- |
| `statuses[].id` | `providerMessageId` | canonical outbound provider message id |
| `statuses[].recipient_id` | pengganti arah untuk `providerChatId` | jangan lagi pakai `@c.us` |
| `statuses[].status` | field provider status baru yang perlu ditambah nanti | jangan dipaksa ke `providerAck` |
| `statuses[].errors[0].code` | `gatewayErrorCode` atau field error baru | lebih cocok daripada ack number |
| `statuses[].errors[0].message/title` | `latestFailureReason` | tetap simpan text error untuk operator |
| `statuses[].pricing.type` | visibility billing/window UI | penting untuk `regular`, `free_customer_service`, `free_entry_point` |
| `statuses[].pricing.category` | visibility kategori pesan | bantu audit utility vs marketing |
| `statuses[].conversation.expiration_timestamp` | optional eligibility/read-model input | jangan diasumsikan selalu ada |

Catatan penting:

- `providerAck: number` adalah legacy dari provider lama dan sebaiknya dianggap **deprecated by design**
- Cloud API lebih cocok dimodelkan dengan raw status string plus timestamps

## 12.4 Template lifecycle webhooks

Relevansi untuk repo ini:

- `message_template_status_update`
  - untuk tahu template sudah `APPROVED`, `PAUSED`, `DISABLED`, dll.
- `message_template_quality_update`
  - untuk mendeteksi quality degradation sebelum notifikasi operasional terganggu
- `message_template_components_update`
  - opsional, tetapi berguna bila template diedit dari WhatsApp Manager dan app perlu audit drift

Ini penting karena migrasi CJ Laundry nanti sangat bergantung pada template approval readiness sebelum switch provider.

## 13. Perubahan Interface yang Kemungkinan Dibutuhkan Nanti

Tidak perlu mengubah product-facing event contract terlebih dahulu. Event domain yang ada bisa dipertahankan.

Tetapi ada beberapa perubahan interface/provider layer yang hampir pasti dibutuhkan:

### 13.1 `providerAck`

Saat ini:

- numeric ack dari provider lama

Nanti:

- ganti ke raw provider status berbasis string webhook, misalnya:
  - `sent`
  - `delivered`
  - `read`
  - `failed`

### 13.2 `providerChatId`

Saat ini:

- diasumsikan format seperti `628...@c.us`

Nanti:

- pindah ke identity berbasis:
  - `wa_id`
  - normalized phone
  - optional separate conversation/chat key internal

### 13.3 WhatsApp status / pairing surface

Saat ini admin surface memiliki konsep:

- pairing code
- QR
- reconnect
- reset session

Di Cloud API:

- konsep linked-device session ini tidak lagi jadi runtime utama
- sebagian besar UI tersebut akan obsolete atau harus diganti menjadi:
  - health token / credential status
  - webhook delivery health
  - template readiness status
  - phone number registration status

## 14. WhatsApp Interface Requirement untuk CJ Laundry

Cloud API tidak menyediakan operator-facing chat interface seperti aplikasi WhatsApp. Karena itu CJ Laundry perlu membangun interface admin sendiri.

### 14.1 Tujuan interface

Interface WhatsApp admin minimal harus bisa:

- melihat daftar chat/thread seperti inbox WhatsApp
- melihat pesan masuk dan keluar dalam satu timeline
- menampilkan nama customer dari sistem jika nomor sudah match ke customer internal
- tetap menampilkan nomor / identitas kontak jika belum match
- mengirim pesan non-template secara internal hanya ketika valid menurut aturan Meta
- menampilkan visibility status pesan keluar
- membedakan pesan otomatis sistem dan pesan manual operator

### 14.2 Gap repo saat ini

Surface admin WhatsApp yang ada sekarang masih berorientasi ke runtime lama:

- status linked-device / pairing
- inbox mirror read-only
- `Open in WhatsApp`
- status berbasis `providerAck` numerik

Untuk Cloud API, baseline ini tidak cukup karena:

- tidak ada linked-device session yang menjadi pusat runtime
- operator butuh composer internal
- status Cloud API berbasis string/webhook, bukan ack number
- identity chat tidak lagi cocok memakai `@c.us`

### 14.3 Bentuk interface yang direkomendasikan

#### A. Thread list panel

Setiap thread minimal menampilkan:

- display name chat
- nomor / `wa_id`
- `customerName` bila sudah linked ke customer sistem
- indikator linked / unlinked customer
- preview pesan terakhir
- arah pesan terakhir
- unread count
- waktu pesan terakhir
- badge window/eligibility:
  - `CSW Open`
  - `FEP Open`
  - `Template Only`

Aturan naming yang direkomendasikan:

- jika nomor match ke customer internal, pakai `customer.name` sebagai title utama
- jika belum match tetapi webhook punya profile name, pakai profile name
- fallback terakhir adalah phone / `wa_id`

#### B. Conversation timeline panel

Timeline minimal menampilkan:

- urutan inbound dan outbound message
- tipe pesan
- isi text / caption / preview media
- timestamp
- source pesan:
  - customer inbound
  - automated notification
  - manual operator
- relasi operasional bila ada:
  - `notificationId`
  - `orderCode`

Jika thread sudah match ke customer internal, header thread sebaiknya juga menampilkan:

- nama customer
- nomor customer
- shortcut ke halaman detail customer

#### C. Composer panel

Composer baseline minimal:

- kirim text message non-template
- disabled state yang jelas saat non-template tidak eligible

Composer harus menunjukkan mode aktif:

- `Free-form allowed`
- `Template only`

Dan reason yang jelas:

- `CSW masih terbuka`
- `CSW sudah tutup, gunakan template`
- `FEP aktif tetapi CSW tutup, non-template tetap tidak boleh`

### 14.4 Eligibility rules untuk composer

Rule baseline yang direkomendasikan:

- **non-template composer enabled** hanya saat `CSW Open`
- **template-only composer** saat `CSW Closed`
- `FEP Open` menjadi info pricing/ops, bukan override eligibility

Mapping praktis:

| Kondisi | Non-template | Template |
| --- | --- | --- |
| CSW open, FEP closed | boleh | boleh |
| CSW open, FEP open | boleh | boleh |
| CSW closed, FEP open | tidak boleh | boleh |
| CSW closed, FEP closed | tidak boleh | boleh |

### 14.5 Visibility status pesan keluar

Interface harus menampilkan status outbound message minimal:

- `Accepted by Meta`
- `Sent`
- `Delivered`
- `Read`
- `Failed`

Mapping yang direkomendasikan:

| Provider event | UI status | Catatan |
| --- | --- | --- |
| send response accepted | `Accepted by Meta` | request diterima, belum delivered |
| webhook `sent` | `Sent` | message keluar dari server Meta |
| webhook `delivered` | `Delivered` | sampai ke device user |
| webhook `read` | `Read` | dibuka di client user |
| webhook `failed` | `Failed` | tampilkan reason |

Visibility tambahan yang berguna:

- `pricing.type`
  - `regular`
  - `free_customer_service`
  - `free_entry_point`
- `pricing.category`
  - `service`
  - `utility`
  - `marketing`
  - kategori lain sesuai webhook

Ini membantu operator memahami:

- apakah pesan gratis karena CSW
- apakah pesan berada di FEP
- apakah template tertentu ditagih sebagai utility/marketing

### 14.6 Customer matching di interface

Target perilaku:

- semua thread dicoba di-resolve ke customer internal berdasarkan nomor canonical / `wa_id`
- jika match:
  - tampilkan `customerName`
  - simpan `customerId`
  - tampilkan shortcut ke customer detail
- jika tidak match:
  - thread tetap tampil
  - tandai `Belum terkait customer`

Catatan:

- model identity provider lama `@c.us` harus dianggap legacy
- matching baru harus dibangun di atas nomor canonical yang konsisten dengan normalizer backend customer

### 14.7 Additional data yang dibutuhkan interface

Agar UI benar-benar usable, model data nanti minimal butuh:

- thread-level:
  - `threadId`
  - `waId`
  - `phone`
  - `displayName`
  - `customerId`
  - `customerName`
  - `lastMessagePreview`
  - `lastMessageDirection`
  - `lastMessageAt`
  - `unreadCount`
  - `cswOpenedAt`
  - `cswExpiresAt`
  - `isCswOpen`
  - `fepOpenedAt`
  - `fepExpiresAt`
  - `isFepOpen`
  - `composerMode`
- message-level:
  - `providerMessageId`
  - `direction`
  - `messageType`
  - `body`
  - `caption`
  - `hasMedia`
  - `mediaMimeType`
  - `mediaName`
  - `timestampIso`
  - `notificationId`
  - `orderCode`
  - `customerId`
  - `customerName`
  - `providerStatus`
  - `pricingType`
  - `pricingCategory`
  - `latestErrorCode`
  - `latestErrorMessage`

### 14.8 Action baseline di interface

Action minimum yang masuk akal:

- buka thread
- kirim text non-template jika eligible
- lihat status tiap outbound message
- lihat apakah pesan berasal dari automation atau manual operator
- buka customer detail jika thread sudah linked

Action yang belum wajib di baseline pertama:

- edit / delete message
- bulk broadcast
- advanced assignment / routing
- media composer penuh
- typing indicator / presence UI

## 15. Apa yang Bisa Tetap dan Apa yang Harus Berubah

### 15.1 Yang bisa tetap

- event domain notifikasi
- notification outbox concept
- receipt renderer backend
- prepared message / parameter assembly di backend
- manual fallback sebagai operational path
- idempotent business transaction boundaries

### 15.2 Yang harus berubah

- transport adapter `sendNotificationToWhatsapp(...)`
- webhook ingestion layer
- provider status mapping
- mirrored inbox identity model
- admin WhatsApp status page
- nomor outbound normalization di boundary provider
- chat/thread read model untuk admin WhatsApp interface
- composer gating berbasis CSW/FEP state
- outbound manual send path untuk free-form text

### 15.3 Yang sebaiknya ditunda ke sesi berikutnya

- authoring detail semua template final
- pemilihan format bahasa final template (`id`, `id_ID`, atau kombinasi lain sesuai approved template strategy)
- redesign admin WhatsApp page
- cleanup field database lama seperti `providerAck` sampai adapter baru benar-benar aktif

## 16. Do Not Assume

Hal-hal yang **tidak boleh diasumsikan** saat implementasi nanti:

- jangan asumsikan semua send bisa memakai free-form text
- jangan asumsikan customer service window 24 jam sedang terbuka
- jangan asumsikan `POST /messages` success response berarti delivered
- jangan asumsikan urutan dua message terpisah akan dipertahankan
- jangan asumsikan webhook datang sekali
- jangan asumsikan nomor `08...` aman dikirim langsung ke Meta
- jangan asumsikan template langsung bisa dipakai setelah dibuat; tunggu approval/status
- jangan asumsikan identifier chat lama `@c.us` masih relevan
- jangan asumsikan `FEP Open` berarti non-template selalu boleh
- jangan asumsikan `conversation` object selalu ada di webhook versi baru
- jangan asumsikan send response `accepted` cukup untuk status akhir UI

## 17. Checklist Sebelum Mulai Integrasi

Checklist minimum untuk sesi berikutnya:

- pastikan `META_BUSINESS_ID`, `WABA_ID`, dan `PHONE_NUMBER_ID` sudah diketahui
- siapkan system/business token yang benar
- siapkan webhook endpoint publik + verify token + app secret
- subscribe app ke `/<WABA_ID>/subscribed_apps`
- tetapkan strategi nomor outbound ke format internasional Indonesia
- definisikan draft template untuk:
  - `welcome`
  - `order_confirmed`
  - `order_done`
  - `order_void_notice`
  - `account_info`
- putuskan bahasa template yang akan dipakai
- putuskan apakah `order_confirmed` memakai:
  - `DOCUMENT` header + body + URL button
  - atau body + URL button tanpa document header
- siapkan flow upload asset untuk template media/document header
- tentukan mapping database untuk raw Cloud API status
- tentukan strategi dedup webhook
- tentukan nasib field legacy:
  - `providerAck`
  - `providerChatId`
  - gateway pairing/session fields
- definisikan read model untuk:
  - thread list
  - conversation timeline
  - composer eligibility
- tentukan source of truth untuk:
  - `CSW Open`
  - `FEP Open`
- tentukan apakah composer baseline pertama:
  - text only
  - atau langsung text + media
- siapkan UI status mapping:
  - `Accepted by Meta`
  - `Sent`
  - `Delivered`
  - `Read`
  - `Failed`

## 18. Rekomendasi Implementasi Tahap Berikutnya

Urutan kerja yang paling aman setelah dokumen ini:

1. buat draft template CJ Laundry satu per satu dari event matrix di atas
2. review copy agar tetap `UTILITY` dan tidak bergeser ke marketing
3. bentuk read model admin WhatsApp interface:
   - thread list
   - message timeline
   - customer matching
   - CSW/FEP eligibility snapshot
4. siapkan adapter Cloud API outbound paling kecil dulu:
   - send template
   - receive status webhook
5. map `statuses[]` ke notification model tanpa merusak outbox yang ada
6. tambahkan composer manual untuk free-form text dengan gating ketat:
   - enabled hanya saat CSW open
   - FEP tampil sebagai info pricing, bukan override eligibility
7. baru setelah itu migrasikan mirrored inbox / inbound `messages[]`
8. terakhir, bereskan admin WhatsApp status page yang saat ini masih terikat ke sidecar lama

## 19. Ringkasan Keputusan Baseline

- baseline CJ Laundry untuk Cloud API adalah **utility-template-first**
- `order_confirmed` sebaiknya dipaketkan sebagai **single template** dengan `DOCUMENT` header
- raw webhook `statuses[]` adalah source of truth delivery state, bukan response `POST /messages`
- inbound/outbound mirror identity harus pindah dari `@c.us` ke `wa_id` / normalized phone
- legacy session controls dari `whatsapp-web.js` tidak boleh dibawa mentah ke desain Cloud API
- admin WhatsApp interface harus dibangun sebagai inbox internal sendiri
- composer non-template hanya aktif saat CSW open; FEP menambah pricing visibility tetapi tidak memperluas eligibility setelah CSW tutup

Dokumen ini cukup sebagai base guide project untuk masuk ke sesi berikutnya: **menyusun template WhatsApp Business yang konkret untuk CJ Laundry**, lalu baru mengintegrasikan provider resminya ke app.
