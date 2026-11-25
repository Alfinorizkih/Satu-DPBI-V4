# Laporan Pengujian & Audit Kualitas — SATU DPBI

Dokumen ini mencatat hasil verifikasi teknis, audit keamanan, dan pengujian fungsional yang dijalankan **setelah perubahan kode terakhir** pada platform **SATU DPBI** (*Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia*). Seluruh status dilaporkan secara objektif menggunakan label **LULUS**, **GAGAL**, atau **BELUM DIUJI**.

---

## 1. Ringkasan Eksekutif

| Kategori Pengujian | Metode | Status | Keterangan |
|---|---|---|---|
| Pemeriksaan Tipe TypeScript (`npm run lint`) | `tsc --noEmit` | **LULUS** | 0 galat tipe di seluruh `src/` dan `server/`. |
| Build Produksi (`npm run build`) | Vite 8 + esbuild (`compile_applet`) | **LULUS** | Berhasil mengompilasi bundel klien `dist/` dan server produksi `server.js`. |
| Audit Dependensi | `bun audit` | **LULUS** | `No vulnerabilities found (checked 341 packages)`. |
| Pengujian Unit & Integrasi Keamanan | `npx --yes tsx --test src/lib/domain.test.ts server/api.security.test.ts` | **LULUS** | **20 dari 20** sub-tes lulus (16 unit domain/RBAC/CSV/email + 4 integrasi penuh API keamanan, sesi, IDOR, alur kerja terhubung & Pusat Email). |
| Uji Kesehatan API (`/api/health`) | `GET http://localhost:3000/api/health` | **LULUS** | Mengembalikan HTTP 200 JSON `{"ok":true,"service":"SATU DPBI","mode":"DEMO_SIMULASI"}`. |
| Uji UI/UX, Pusat Persetujuan, Pusat Email, RBAC & Responsivitas Browser Nyata | Chromium Headless (`playwright-cli`) | **LULUS** | **0 galat konsol** (`Errors: 0`), diuji pada desktop `1440x900` (Light & Dark Mode) serta seluler `390x844` tanpa luapan horizontal (`scrollWidth: 390`, `overflow390: false`). |
| Pengemasan Arsip Rilis Bersih (`npm run package:zip`) | `scripts/create-release-zip.mjs` | **LULUS** | Menghasilkan `satu-dpbi-paket-final.zip` yang telah diverifikasi bebas `node_modules/`, `.db*`, `.env`, `dist/`, `storage/`, dan `.playwright-cli/`. |
| Pengiriman Email SMTP Produksi & Deployment Eksternal | Infrastruktur Eksternal | **BELUM DIUJI** | Pusat Email beroperasi dalam mode **Sandbox Outbox (SQLite)** sampai `SMTP_HOST` dikonfigurasi; deployment GitHub/Vercel/Domainesia/ArenHost membutuhkan kredensial produksi organisasi. |

---

## 2. Rincian Hasil Pengujian Otomatis (`20/20 LULUS`)

### A. Pengujian Unit Domain & RBAC (`src/lib/domain.test.ts` — 16 sub-tes)
1. `supports all 38 official Indonesian provinces` — **LULUS**
2. `defines all 6 official national Bidang and matches proposals accurately` — **LULUS**
3. `distinguishes Duta domicile vs assignment vs coordinator/activity coverage in regencies` — **LULUS**
4. `sanitizes public statistics payload based on privacy approval flag` — **LULUS**
5. `computes GeoJSON bounding boxes and SVG path projections faithfully` — **LULUS**
6. `RBAC isolates Duta and Alumni from national system/command center actions` — **LULUS**
7. `Delegation grants temporary permission only within active date window` — **LULUS**
8. `Approval matrix routes proposals accurately without overloading Super Admin` — **LULUS**
9. `Coordinator province coordinate verification accurately checks boundaries` — **LULUS**
10. `Alumni 30-day archive window calculates reminders and expiration accurately` — **LULUS**
11. `Profile completeness & reference number generator produce exact institutional values` — **LULUS**
12. `Clean parameterized router resolves public paths, CMS route, deep links, and active nav bases safely` — **LULUS**
13. `hasScopedPermission blocks cross-province Korwil actions and enforces province-scoped delegation windows` — **LULUS**
14. `csvSafeCell escapes spreadsheet formula prefixes and embedded quotes safely` — **LULUS**
15. `Email template placeholder validation & rendering accept only allowlisted variables` — **LULUS**
16. `Approval Center and Email Center routes and BASE_ROLE_PERMISSIONS enforce role boundaries` — **LULUS**

### B. Pengujian Keamanan & Alur Kerja API Terintegrasi (`server/api.security.test.ts` — 4 sub-tes)
1. **Keamanan Sesi & Anti Brute-Force**: Batas TTL sesi maksimal 24 jam, inspeksi sesi aktif & pencabutan paksa seluruh sesi oleh admin (`419`), pencatatan `LOGIN_FAILED`, dan penguncian otomatis (`429`) setelah 5 percobaan gagal — **LULUS**
2. **Isolasi IDOR & Batas Provinsi**: Penolakan akses `duta` ke `audit_logs` & berkas privat pengguna lain (`403`), penolakan `koordinator_wilayah` lintas provinsi (`403`), dan penegakan delegasi bercakupan provinsi — **LULUS**
3. **Alur Kerja Terhubung End-to-End**: Cek duplikasi proposal -> persetujuan proposal -> pembuatan otomatis agenda kalender + 4 tugas bertahap -> sinkronisasi perubahan jadwal -> LKL wajib menautkan proposal disetujui -> revisi & penerimaan LKL menyelesaikan tugas terkait -> revisi laporan koordinator -> persetujuan permintaan akun menghasilkan token undangan aktif -> analitik dashboard `7/30/90` hari — **LULUS**
4. **Pusat Email & Pengiriman Massal**: Deduplikasi audiens, validasi placeholder, pembatasan izin `email:publish`, mode `sandbox_outbox`, penjadwalan & pembatalan (`409` setelah terkirim), retry log gagal, dan perlindungan CSV — **LULUS**

---

## 3. Rincian Verifikasi Browser Nyata (`playwright-cli`)

- **Putaran 1**: Verifikasi visual `/login`, `/dashboard` (Light & Dark Mode), `/persetujuan`, `/email`, `/proposal`, `/laporan-kegiatan`, `/laporan-koordinator`, `/pengaturan/pengguna`, `/pengaturan`, serta mobile `390x844`. Teridentifikasi dan diperbaiki:
  1. Tab filter `/persetujuan` overflow pada `390px` -> ditambahkan pembungkus responsif `flex-wrap`.
  2. Nilai fallback sintetis `14.5 jam` pada analitik jendela kosong `7 Hari` -> diganti menjadi `null` dengan label jujur `"Belum ada"`.
  3. Pemisah `•` di awal ringkasan LKL daring di antrean persetujuan -> dibersihkan dengan `.filter(Boolean).join(' • ')`.
  4. Penyiapan 4 templat email resmi DPBI pada database demo yang sudah ada (`seedDefaultEmailTemplates`).
- **Putaran 2 (Pasca-Perbaikan)**: Verifikasi ulang `/dashboard`, `/email` (`Templat Resmi (4)`), dan `/persetujuan` pada `390x844` (`scrollWidth: 390`, `overflow390: false`) dengan `0` galat dan `0` peringatan konsol.

---

## 4. Daftar Item Belum Diuji (Lingkungan Produksi Eksternal)
- Pengiriman email keluar sungguhan melalui `SMTP_HOST` produksi — **BELUM DIUJI** (membutuhkan kredensial SMTP organisasi).
- Push repositori, eksekusi CI eksternal, deployment Vercel/Domainesia/ArenHost, serta migrasi MySQL produksi — **BELUM DIUJI** (membutuhkan kredensial hosting dan domain organisasi).
