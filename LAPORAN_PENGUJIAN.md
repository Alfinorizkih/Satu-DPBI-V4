# Laporan Pengujian & Audit Kualitas — SATU DPBI

Dokumen ini mencatat hasil verifikasi teknis, audit keamanan, pengujian fungsional, dan verifikasi visual terbaru pada platform **SATU DPBI** (*Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia*). Seluruh status dilaporkan secara objektif menggunakan label **LULUS**, **GAGAL**, atau **BELUM DIUJI**.

---

## 1. Ringkasan Eksekutif

| Kategori Pengujian | Metode | Status | Keterangan |
|---|---|---|---|
| Pemeriksaan Tipe TypeScript (`npm run lint`) | `tsc --noEmit` | **LULUS** | `0` galat tipe di seluruh `src/` dan `server/`. |
| Build Produksi (`npm run build`) | Vite 8 + esbuild (`compile_applet`) | **LULUS** | Berhasil mengompilasi bundel klien `dist/` dan server produksi `server.js`. |
| Pengujian Unit & Integrasi Keamanan | `npx --yes tsx --test src/lib/domain.test.ts server/api.security.test.ts` | **LULUS** | **31 dari 31** sub-tes lulus (`21` unit domain/RBAC/CSV/guidance + `10` integrasi keamanan API & Zero-Confusion UX). |
| Uji Kesehatan & Versi API | `GET /api/health` & `GET /api/system/version` | **LULUS** | Mengembalikan HTTP `200` JSON dengan `maintenanceMode: false`. |
| Uji Browser Nyata, Dark Mode & Responsivitas | Chromium Headless (`playwright-cli`) | **LULUS** | Putaran 1 & 2 pada Desktop (`1440x900` Terang & Gelap) dan Mobile (`390x844`): **0** galat konsol, **0** luapan horizontal, seluruh aset logo resmi termuat (`naturalWidth > 0`), seluruh API mengembalikan HTTP `200`. |
| Pengiriman Email SMTP Produksi & Deployment Eksternal | Infrastruktur Eksternal | **BELUM DIUJI** | Pusat Email beroperasi dalam mode **Sandbox Outbox (SQLite)** hingga `SMTP_HOST` dikonfigurasi; deployment eksternal membutuhkan kredensial hosting & domain organisasi. |

---

## 2. Rincian Pengujian Otomatis (`31/31 LULUS`)

### A. Pengujian Unit Domain, RBAC, CSV, Router & Panduan (`src/lib/domain.test.ts` — 21 sub-tes)
1. Dukungan penuh 38 provinsi resmi Indonesia — **LULUS**
2. Definisi 6 Bidang resmi Pengurus Nasional & pencocokan proposal — **LULUS**
3. Pembedaan jujur Duta domisili vs penugasan vs koordinator/kegiatan kabupaten/kota — **LULUS**
4. Sanitasi statistik publik sesuai flag persetujuan privasi — **LULUS**
5. Proyeksi bounding box & jalur SVG GeoJSON — **LULUS**
6. Isolasi RBAC Duta & Alumni dari akses sistem/eksekutif nasional — **LULUS**
7. Pembatasan delegasi sementara pada rentang tanggal aktif — **LULUS**
8. Perutean matriks persetujuan proposal tanpa membebani Super Admin — **LULUS**
9. Verifikasi koordinat batas provinsi koordinator — **LULUS**
10. Perhitungan jendela transisi arsip Alumni 30 hari — **LULUS**
11. Kelengkapan profil & generator nomor referensi institusional — **LULUS**
12. Router berparameter bersih (rute publik, CMS, deep link, dan active nav base) — **LULUS**
13. `hasScopedPermission` memblokir aksi Korwil lintas provinsi & menegakkan delegasi bercakupan provinsi — **LULUS**
14. `csvSafeCell` menetralkan prefiks formula spreadsheet dan tanda kutip ganda — **LULUS**
15. Validator & renderer placeholder templat email hanya menerima variabel yang diizinkan — **LULUS**
16. Rute Approval Center & Email Center serta batas peran `BASE_ROLE_PERMISSIONS` — **LULUS**
17. Dukungan **20** variabel templat email, rute & RBAC Program Unggulan (`/program`) & Persuratan (`/persuratan`), serta penomoran `SURAT`/`PROG` — **LULUS**
18. `offlineDraft.ts` mengisolasi draft lapangan per akun pengguna dan membersihkan penyimpanan dengan aman — **LULUS**
19. `escapeHtml` dan `renderEmailTemplate(..., { htmlEscape: true })` mencegah injeksi XSS pada badan HTML — **LULUS**
20. Parser CSV RFC-4180 (`parseRfc4180Csv`, `parseCsvObjects`, `parseEmailRecipientsCsv`, `buildCsvErrorReport`) menangani pemisah `;`, koma di dalam tanda kutip, deduplikasi, baris tidak valid, dan perlindungan formula ekspor galat — **LULUS**
21. Helper panduan Zero-Confusion (`resolvePageHelp`, `normalizeDisplayScale`, `sanitizeFavoritePaths`, `calculateChecklistCompleteness`) — **LULUS**

### B. Pengujian Keamanan & Integrasi API (`server/api.security.test.ts` — 10 sub-tes)
1. Keamanan sesi (TTL maksimal `<= 24 jam`), inspeksi/pencabutan paksa sesi admin (`419`), dan penguncian kegagalan login (`429`) — **LULUS**
2. Isolasi IDOR lintas pengguna & batas provinsi Korwil (`403`) — **LULUS**
3. Alur kerja terhubung end-to-end (cek duplikasi -> persetujuan proposal -> kalender + 4 tugas -> revisi & penerimaan LKL -> revisi koordinator -> Approval Center undangan -> analitik) — **LULUS**
4. Pusat Email: deduplikasi audiens, validasi placeholder, pengiriman `sandbox_outbox`, pembatalan jadwal, retry log, dan perlindungan formula CSV — **LULUS**
5. Pusat Email Lanjutan: **50** templat resmi tersemai, toggle aktif/nonaktif templat, riwayat versi sunting templat, pengiriman HTML, dan parser penerima CSV — **LULUS**
6. Siklus Personel, Impor & 3 Mode Akun: impor CSV dengan deteksi duplikasi, rollback batch tanpa menghapus baris terikat akun aktif, siklus undangan + cooldown resend `429` + penolakan token ulang, serta 3 `linkMode` akun pengguna — **LULUS**
7. Approval, Tugas, Dokumen & Evaluasi: pencatatan `approval_history`, blokir *self-approval* (`403`), `advance_stage`, kunci penyelesaian tugas prasyarat (`409`), rantai penggantian versi dokumen (`replaced_by_id`), dan 6 perspektif `evaluatorType` — **LULUS**
8. Program, Persuratan, Handover, Backup WAL & Maintenance: CRUD Program Unggulan & Persuratan/Disposisi beserta RBAC, paket Handover dengan pencabutan otomatis sesi koordinator lama, backup `VACUUM INTO`/validasi/restore aman, serta penguncian tulis Mode Pemeliharaan (`503`) dan pemulihannya — **LULUS**
9. Siklus Personel & Keamanan Lanjutan: pengarsipan/pemulihan/penghapusan personel, pembatasan peran impor CSV, blokir penghapusan `super_admin` terakhir (`409`), pengajuan Duta 2 jalur + `perlu_revisi`/`resubmit`/auto-approve, serta kontrol jeda & lanjut antrean email 12 penerima — **LULUS**
10. Addendum Zero-Confusion UX: `/api/beranda` terisolasi per peran, `/api/process-tracker` berlini masa, `/api/support-tickets` beserta isolasi triase, `/api/auth/preferences`, dan *optimistic locking* (`409`) pada pembaruan tugas — **LULUS**

---

## 3. Rincian Verifikasi Browser Nyata (`playwright-cli`)

- **Putaran 1**: Pemeriksaan halaman publik (`/`), halaman masuk (`/login`), `/beranda`, `/proposal/baru` (form 4 tahap bertahap), serta tampilan mobile (`390x844`) pada mode Terang dan Gelap. Ditemukan bahwa pengalihan pasca-login di `PublicPortalPage.tsx` masih mengarahkan ke `/dashboard` alih-alih `preferences.startPage || '/beranda'`.
- **Putaran 2 (Pasca-Perbaikan)**:
  - Login sebagai Duta (`duta.jabar@simulasi.dpbi.or.id`) dan Super Admin (`superadmin@simulasi.dpbi.or.id`) langsung mendarat di `/beranda` sesuai preferensi awal.
  - Seluruh aset logo resmi (`icon-utama`, `logotp`, `icon-app-sd` termasuk favicon) termuat dengan `naturalWidth > 0`.
  - Halaman `/email` (`Templat Resmi (50)` & 20 variabel), `/personalia`, `/kendala`, `/status-sistem` (telemetri SQLite WAL, penyimpanan, antrean email, API health, mode pemeliharaan nonaktif), dan `/pengaturan` (tab *Tampilan*) diverifikasi pada Desktop (`1440x900` Terang/Gelap) dan Mobile (`390x844`) dengan **0** galat konsol, **0** luapan horizontal, dan seluruh permintaan API berstatus `200 OK`.

---

## 4. Daftar Item Belum Diuji (Lingkungan Produksi Eksternal)
- Pengiriman email keluar sungguhan melalui `SMTP_HOST` produksi — **BELUM DIUJI** (membutuhkan kredensial SMTP organisasi).
- Deployment ke infrastruktur hosting eksternal serta migrasi MySQL produksi — **BELUM DIUJI** (membutuhkan kredensial server dan domain produksi).
