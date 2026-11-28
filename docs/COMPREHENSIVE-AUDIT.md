# AUDIT SISTEM MENYELURUH — SATU DPBI
**Proyek:** SATU-DPBI (Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia)  
**Baseline Workspace:** `/app/applet` (Node.js + Express + Vite + React + SQLite `better-sqlite3`, tanpa direktori `.git`)  
**Metode:** Inspeksi langsung seluruh file sumber `server/`, `server.ts`, `src/`, `database/`, `scripts/`, dan `package.json`.

---

## 1. Inventaris Arsitektur & Modul Awal

| Lapisan | File Utama | Peran |
| :--- | :--- | :--- |
| Server HTTP & Middleware | `server.ts` | Express SPA/API server, CORS, `requireAuth`, `requirePermission`, CSP/security headers, port 3000 |
| Database & Migrasi | `server/db.ts`, `database/schema_mysql.sql` | SQLite WAL (`satu_dpbi.db`) untuk preview/sandbox + skema MySQL 8 untuk referensi produksi |
| Keamanan & Sesi | `server/security.ts` | PBKDF2 password hashing, SHA-256 session token, idle timeout, RBAC middleware, audit log |
| Rute Inti & Modul | `server/routes.ts`, `server/routes_modules.ts` | Auth, Files, Dashboard, Search, Wilayah, Personalia, Delegasi, Proposal, LKL, Laporan Koordinator, Tugas, Dokumen, Pengaturan, Ekspor |
| Data Awal | `server/seed.ts` | 38 provinsi Indonesia, kabupaten/kota sampel, personel lintas role, proposal, LKL, dokumen, artikel bantuan |
| Frontend Core | `src/App.tsx`, `src/context/AuthContext.tsx`, `src/components/AppShell.tsx` | Router, session context, toast engine, sidebar/header/mobile drawer, light/dark theme |
| Logika Murni | `src/lib/rbac.ts`, `src/lib/routes.ts`, `src/lib/types.ts` | Matriks RBAC 8 role, 6 bidang resmi, 38 provinsi, validasi koordinat, parser rute |
| Pengujian | `src/lib/domain.test.ts` | 12 unit test logika domain (provinces, RBAC, alumni 30 hari, koordinat, rute) |

---

## 2. Temuan Audit Terverifikasi (Baseline Pra-Perbaikan)

### 2.1 Keamanan & Kontrol Akses (Prioritas Kritis / Tinggi)
1. **Interpolasi SQL String pada Dashboard & Global Search (`server/routes.ts`)**
   - `/api/dashboard` (baris ~848–889 & ~1026) dan `/api/search` (baris ~1116–1119) menyisipkan `user.provinceCode` dan `user.personnelId` langsung lewat template string ke kueri SQL.
   - Risiko: melanggar standar parameterized query dan menyulitkan jaminan keamanan di seluruh jalur filter dinamis.
2. **IDOR pada Berkas Tersimpan & Deduplikasi Lintas Pengguna (`server/routes.ts`)**
   - `POST /api/files/upload` (baris ~765–778) melakukan deduplikasi global berdasarkan `checksum_sha256` dan mengembalikan `id` berkas yang diunggah pengguna lain tanpa pencatatan hak akses (`file_access_grants`).
   - `serveStoredFile` hanya memverifikasi login (`requireAuth`) tanpa memeriksa apakah pengguna berhak mengakses `file_id` tersebut. Selain itu `DocumentPreview.tsx` memanggil `/api/files/:id/download` yang belum memiliki route alias eksplisit.
3. **Batas Kedaluwarsa Sesi Melebihi 24 Jam & Celah Allowlist Pengaturan (`server/security.ts`, `server/routes_modules.ts`)**
   - `server/security.ts` (baris 63) & `PATCH /api/system/settings` mengizinkan `session_ttl_hours` hingga `168` jam (7 hari), padahal batas maksimal keamanan portal organisasi ditetapkan **24 jam** (terpisah dari `idle_timeout_minutes`).
   - `PATCH /api/system/settings` memeriksa kunci `'kemendikdasmen_integration_status'`, sedangkan `seed.ts` & `GET /api/system/overview` memakai `'kemendikdasmen_status'`, serta belum menolak kunci sembarang lewat allowlist ketat.
4. **Celah Object-Level Authorization (IDOR) pada Alur Operasional**
   - `GET /api/proposals/:id/versions`, `PATCH /api/proposals/:id`, `POST /api/proposals/:id/revise`, dan `POST /api/proposals/:id/decide` belum menutup penuh pengecekan kepemilikan Duta, cakupan provinsi Korwil, transisi status valid, dan pencegahan self-approval.
   - `PATCH /api/tasks/:id` dan `GET/POST /api/tasks/:id/comments` (`server/routes_modules.ts`) dapat diakses lintas pengguna/provinsi selama pengguna memiliki izin modul `tugas`.
   - `POST /api/personnel/:id/verify`, `POST /api/personnel/import`, `POST /api/handovers`, dan `POST /api/location/exceptions/:id/decide` perlu penegakan provinsi yang konsisten bagi Koordinator Wilayah.
   - `GET /api/archive` mengandalkan kecocokan teks `owner_name` dan memiliki fallback `LIMIT 10` tanpa filter saat `user.personnelId` kosong.
   - `GET /api/export/bundle` belum memfilter `province_code` untuk Korwil dan belum menyanitasi sel CSV terhadap formula injection (`=`, `+`, `-`, `@`).
5. **Kebocoran Cakupan Provinsi pada Delegasi (`src/lib/rbac.ts`, `server/routes.ts`)**
   - `resolveEffectivePermissions` menggabungkan `(module, action)` dari delegasi secara global tanpa mempertimbangkan `delegation.provinceCode`, dan `POST /api/organization/delegations` belum memvalidasi bahwa pemberi delegasi memang memiliki izin yang didelegasikan serta `startsAt < endsAt`.
6. **Audit Log & Rate Limiting Auth Belum Lengkap**
   - Kegagalan login, permintaan reset password, dan endpoint unggah/unduh/email perlu rate limiting sliding-window dan pencatatan event `LOGIN_FAILED`, `PASSWORD_RESET_REQUEST`, serta `ACCESS_DENIED_IDOR`.

### 2.2 Arsitektur Database, Alur Kerja & Kelengkapan Fitur
1. **Tabel Belum Terhubung Penuh dalam Satu Alur Kerja**
   - Proposal yang berstatus `disetujui` belum otomatis menghasilkan entri `calendar_events` dan tugas bertahap (`tasks`) dengan `proposal_id` tertaut.
   - `LKL` belum memvalidasi keterkaitan ke `proposal_id` berstatus `disetujui`, dan LKL yang berstatus `diterima` belum memperbarui tugas tertaut atau menandai kesiapan evaluasi.
   - `coordinator_reports` belum memiliki alur kirim ulang revisi oleh Koordinator Wilayah ketika berstatus `perlu_revisi`.
2. **Belum Ada Modul Kontrol Pusat Persetujuan Nasional (`/persetujuan`) & Pusat Email / Bulk Email (`/email`)**
   - Persetujuan lintas modul (Proposal, LKL, Laporan Korwil, Permintaan Akun, Serah Terima) tersebar di tiap halaman tanpa SLA tracker, eskalasi, atau penugasan ulang reviewer terpusat.
   - Tidak ada antarmuka dan API pengiriman email terpadu maupun manajemen sesi per pengguna dari panel Super Admin.
3. **Kualitas Umpan Balik Frontend & Link Berkas**
   - Toast di `AuthContext.tsx` hanya mendukung `success | error | info`, tanpa tombol tutup manual (`X`), tanpa varian `warning`/`loading`, dan durasi error terlalu singkat (`4.5` detik).
- Beberapa pemanggilan tautan berkas di `CoordinatorReportsPage.tsx`, `TasksAndDocsPages.tsx`, dan `SafetyEvalArchivePages.tsx` masih memakai path mentah `/api/files/...` tanpa pembungkus `apiUrl(...)`.
   - Beberapa aksi destruktif/penolakan belum menggunakan `ConfirmDialog` sebelum dieksekusi, dan belum ada kompresi gambar sisi klien sebelum unggah foto LKL/dokumen.

---

## 3. Penutupan Temuan & Status Verifikasi Terkini

Seluruh temuan pada Bagian 2 telah ditutup dan diperkuat dengan lapisan pengendalian tambahan:

1. **Keamanan & Kontrol Akses**:
   - Seluruh kueri SQL dinamis pada Dashboard, Global Search, dan Laporan terparameterisasi penuh (`?`).
   - File upload dan unduhan dilindungi melalui tabel `file_access_grants`, verifikasi kepemilikan/cakupan provinsi di `canAccessStoredFile()`, dan rute `/api/files/:id/download`.
   - TTL sesi dibatasi keras maksimal `24 jam`, `PATCH /api/system/settings` memakai *allowlist* kunci resmi, blokir *self-approval* (`HTTP 403`), guard `super_admin` terakhir (`HTTP 409`), proteksi formula CSV (`csvSafeCell`), *HTML escaping* (`escapeHtml`), *idempotency keys*, dan *optimistic locking* (`version`).
2. **Alur Kerja Terhubung & Skalabilitas Operasional**:
   - Proposal disetujui otomatis membangkitkan jadwal kalender dan 4 tugas bertahap; LKL memvalidasi proposal disetujui dan memperbarui status tugas serta kesiapan evaluasi; Laporan Koordinator mendukung alur revisi.
   - Pusat Persetujuan Terpadu (`/persetujuan`), Pusat Email (`50` templat resmi, `20` variabel, lampiran `email_attachments`, antrean batch `email_queue` dengan jeda/lanjut/batal, parser RFC-4180 CSV), Program Unggulan (`/program`), Persuratan & Disposisi (`/persuratan`), serta Handover Koordinator paket lengkap telah aktif.
3. **Zero-Confusion UX & Integritas Tampilan**:
   - Ruang kerja personal `/beranda` per peran (menjadi rute pendaratan baku pasca-login), form 4 langkah bertahap dengan autosave dan *draft recovery*, `ProcessTracker` timeline lengkap, Pusat Bantuan kontekstual + tur peran, Pusat Kendala (`/kendala`), tab `Tampilan & Preferensi`, serta penyematan logo resmi DPBI (`icon-app-sd`, `icon-utama`, `logotp`).
4. **Verifikasi Otomatis & Browser**:
   - `npm run lint` (`tsc --noEmit`): **0 galat**.
   - `npx --yes tsx --test src/lib/domain.test.ts server/api.security.test.ts`: **31/31 LULUS** (`21` unit + `10` integrasi API).
   - `playwright-cli` pada Desktop (`1440x900` Light/Dark) & Mobile (`390x844`): **0 galat konsol**, **0 luapan horizontal**, dan **0 kegagalan HTTP 5xx**.

