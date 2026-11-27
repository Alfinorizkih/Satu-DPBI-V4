# Laporan Pengujian & Audit Kualitas — SATU DPBI v4.1.0

Dokumen ini mencatat hasil verifikasi teknis, audit keamanan, pengujian fungsional, dan verifikasi visual yang dijalankan pada platform **SATU DPBI** (*Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia*) **v4.1.0**. Seluruh status dilaporkan secara objektif menggunakan label **LULUS**, **GAGAL**, atau **BELUM DIUJI**.

---

## 1. Ringkasan Eksekutif

| Kategori Pengujian | Metode | Status | Keterangan |
|---|---|---|---|
| Pemeriksaan Tipe TypeScript (`npm run lint`) | `tsc --noEmit` | **LULUS** | `0` galat tipe di seluruh `src/` dan `server/`. |
| Build Produksi (`npm run build`) | Vite 8 + esbuild (`compile_applet`) | **LULUS** | Berhasil mengompilasi bundel klien `dist/` dan server produksi `server.js`. |
| Audit Dependensi | `bun audit` | **LULUS** | `No vulnerabilities found across 341 packages`. |
| Pengujian Unit & Integrasi Keamanan | `npx --yes tsx --test src/lib/domain.test.ts server/api.security.test.ts` | **LULUS** | **26 dari 26** sub-tes lulus (`18` unit domain/RBAC/router/offlineDraft + `8` integrasi keamanan API & alur kerja v4.1.0). |
| Uji Kesehatan & Versi API | `GET /api/health` & `GET /api/system/version` | **LULUS** | Mengembalikan HTTP 200 JSON dengan versi `4.1.0`. |
| Uji Browser Nyata, Dark Mode & Responsivitas | Chromium Headless (`playwright-cli`) | **LULUS** | Putaran 1 & 2 pada Desktop (`1440x900` Terang & Gelap), Tablet (`768x1024`), dan Mobile (`390x844`): **0** galat konsol, **0** luapan horizontal, seluruh endpoint API termasuk `PATCH /api/system/settings` dan `POST /api/system/maintenance` mengembalikan HTTP `200`. |
| Pengemasan Arsip Rilis Bersih (`npm run package:zip`) | `scripts/create-release-zip.mjs` | **LULUS** | Menghasilkan `satu-dpbi-paket-final.zip` bersih tanpa `node_modules/`, `.db*`, `.env`, `dist/`, `storage/`, maupun `.playwright-cli/`. |
| Pengiriman Email SMTP Produksi & Deployment Eksternal | Infrastruktur Eksternal | **BELUM DIUJI** | Pusat Email beroperasi dalam mode **Sandbox Outbox (SQLite)** hingga `SMTP_HOST` dikonfigurasi; deployment eksternal membutuhkan kredensial hosting & domain organisasi. |

---

## 2. Rincian Pengujian Otomatis (`26/26 LULUS`)

### A. Pengujian Unit Domain, RBAC, Router & Utilitas (`src/lib/domain.test.ts` — 18 sub-tes)
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
17. **v4.1.0**: Dukungan seluruh **11** variabel templat email, rute & RBAC Program Unggulan (`/program`) & Persuratan (`/persuratan`), serta penomoran `SURAT`/`PROG` — **LULUS**
18. **v4.1.0**: `offlineDraft.ts` mengisolasi draft lapangan per akun pengguna dan membersihkan penyimpanan dengan aman — **LULUS**

### B. Pengujian Keamanan & Integrasi API (`server/api.security.test.ts` — 8 sub-tes)
1. Keamanan sesi (TTL maksimal `<= 24 jam`), inspeksi/pencabutan paksa sesi admin (`419`), dan penguncian kegagalan login (`429`) — **LULUS**
2. Isolasi IDOR lintas pengguna & batas provinsi Korwil (`403`) — **LULUS**
3. Alur kerja terhubung end-to-end (cek duplikasi -> persetujuan proposal -> kalender + 4 tugas -> revisi & penerimaan LKL -> revisi koordinator -> Approval Center undangan -> analitik) — **LULUS**
4. Pusat Email: deduplikasi audiens, validasi placeholder, pengiriman `sandbox_outbox`, pembatalan jadwal, retry log, dan perlindungan formula CSV — **LULUS**
5. **v4.1.0 Pusat Email Lanjutan**: 18 templat resmi tersemai, riwayat versi sunting templat, pengiriman konten HTML, dan parser penerima CSV — **LULUS**
6. **v4.1.0 Siklus Personel, Impor & 3 Mode Akun**: Impor massal CSV dengan deteksi duplikasi, rollback batch tanpa menghapus baris yang terikat akun aktif, siklus undangan + cooldown resend `429` + penolakan token ulang, serta 3 `linkMode` akun pengguna (`create_both`, `link_existing` dengan guard duplikasi `409` & `allowMultipleAccounts`, `operational_only`) — **LULUS**
7. **v4.1.0 Approval, Tugas, Dokumen & Evaluasi**: Pencatatan `approval_history`, blokir *self-approval* (`403`), `advance_stage`, kunci penyelesaian tugas prasyarat (`409`), rantai penggantian versi dokumen (`replaced_by_id`), dan 6 perspektif `evaluatorType` — **LULUS**
8. **v4.1.0 Program, Persuratan, Handover, Backup WAL & Maintenance**: CRUD Program Unggulan & Persuratan/Disposisi beserta RBAC, paket Handover dengan pencabutan otomatis sesi koordinator lama, backup `VACUUM INTO`/validasi/restore aman, serta penguncian tulis Mode Pemeliharaan (`503`) dan pemulihannya — **LULUS**

---

## 3. Rincian Verifikasi Browser Nyata (`playwright-cli`)

- **Putaran 1**: Pemeriksaan halaman publik (`/`, `/program`, `/login`) dan portal internal terautentikasi (`/dashboard`, `/program`, `/persuratan`, `/persetujuan`, `/tugas`, `/dokumen`, `/pengaturan/pengguna`, `/email`, `/evaluasi`, `/pengaturan`, `/status-sistem`) pada `1440x900`. Ditemukan dua perbaikan UX minor: label tombol kartu program saat belum masuk masih menyebut `"Buka Command Center"` alih-alih `"Lihat Detail Program"`, serta label kanan spanduk pemeliharaan menampilkan jargon teknis `"HTTP 503 Write-Lock"` alih-alih `"Mode Baca-Saja"`.
- **Putaran 2 (Pasca-Perbaikan)**:
  - Tombol program publik tampil sebagai `"Lihat Detail Program"` dan membuka rincian program publik tanpa error autentikasi.
  - Simpan konfigurasi di `/pengaturan` (`PATCH /api/system/settings`) mengembalikan HTTP `200`.
  - Pusat Email menampilkan `Templat Resmi (18)`.
  - Toggle Mode Pemeliharaan di `/status-sistem` menampilkan spanduk `"Mode Baca-Saja"` dan bersih hilang setelah dinonaktifkan kembali.
  - Tampilan **Dark Mode** (`1440x900`), **Tablet** (`768x1024`), dan **Mobile** (`390x844` beserta buka/tutup drawer navigasi) terverifikasi terbaca jelas tanpa tumpang tindih atau luapan horizontal.

---

## 4. Daftar Item Belum Diuji (Lingkungan Produksi Eksternal)
- Pengiriman email keluar sungguhan melalui `SMTP_HOST` produksi — **BELUM DIUJI** (membutuhkan kredensial SMTP organisasi).
- Push repositori, eksekusi CI eksternal, deployment Vercel/Domainesia/ArenHost, serta migrasi MySQL produksi — **BELUM DIUJI** (membutuhkan kredensial hosting dan domain organisasi).
