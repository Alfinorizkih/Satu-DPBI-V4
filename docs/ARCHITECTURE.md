# Arsitektur Sistem — SATU DPBI

Dokumen ini menjelaskan arsitektur teknis aplikasi **SATU DPBI** yang berjalan sebagai aplikasi web terpadu (Full-Stack TypeScript/Node.js + React SPA).

---

## 1. Diagram Alir Arsitektur Tingkat Tinggi

```text
+-------------------------------------------------------------------+
|  Browser Pengguna (Desktop & Mobile)                              |
|  - Website Publik (/ , /tentang , /wilayah , /bantuan)            |
|  - Portal Auth & Workspace SPA (React 19 + Tailwind CSS v4)       |
|  - Mesin Cetak A4 CSS Print + Komponen Peta GeoJSON Interaktif    |
+-------------------------------------------------------------------+
            | HTTPS + Cookie HttpOnly (SameSite) + X-Requested-With
            v
+-------------------------------------------------------------------+
|  Express 4 API & Static Server (server.ts) — Port 3000            |
|  - Security Headers & Origin/CSRF Check (requireSafeOrigin)       |
|  - CORS Configurable (CORS_ALLOWED_ORIGINS)                       |
|  - Dev: Vite Middleware | Prod: Express Static (dist/) + SPA      |
|  - Public Static Assets: /assets & /maps (GeoJSON 38 Provinsi)    |
+-------------------------------------------------------------------+
      |                    |                           |
      v                    v                           v
+-----------+   +-----------------------+   +-----------------------+
| Auth &    |   | Domain & CMS Modules  |   | Storage Privat        |
| Security  |   | - server/routes.ts    |   | - storage/private/    |
| Scrypt +  |   | - server/routes_      |   | - storage/backups/    |
| Sesi DB   |   |   modules.ts          |   |   (ZIP + SHA-256)     |
+-----------+   +-----------------------+   +-----------------------+
      |                    |
      +---------+----------+
                v
+-------------------------------------------------------------------+
|  Basis Data SQLite Mode WAL (node:sqlite bawaan Node.js >= 22)    |
|  - Demo: data/satu_dpbi_demo.db | Prod: data/satu_dpbi_prod.db    |
|  - Skema Relasional Pendamping: database/schema_mysql.sql (MySQL) |
+-------------------------------------------------------------------+
```

---

## 2. Lapisan Backend (`server.ts` & `server/`)

| Berkas | Tanggung Jawab |
| :--- | :--- |
| `server.ts` | Entrypoint tunggal Express 4; mengatur CORS multi-origin opsional, security headers (`X-Content-Type-Options`, `Referrer-Policy`), parser JSON/cookie, aset `/assets` dan `/public/maps`, endpoint `GET /api/health`, validasi origin CSRF (`requireSafeOrigin`), error handler terstruktur (`recordSystemError`), dan SPA fallback. |
| `server/db.ts` | Mengelola koneksi tunggal `DatabaseSync` (`node:sqlite`), mengaktifkan `PRAGMA journal_mode = WAL` dan `PRAGMA foreign_keys = ON`, menjalankan DDL idempoten saat boot (`initSchema`), serta menyediakan generator nomor referensi atomik `nextReferenceNumber()` di dalam transaksi `BEGIN IMMEDIATE`. |
| `server/seed.ts` | Menanamkan data referensi wajib untuk semua mode (38 provinsi, ~514 kabupaten/kota dari `public/maps/regencies-index.json`, daftar kecamatan/kelurahan contoh, aturan `approval_matrix_rules`, konten awal `cms_contents` & `help_articles`, serta `automation_jobs`). Data simulasi pengguna hanya dibuat jika `DEMO_MODE=true`. |
| `server/security.ts` | Hashing kata sandi `crypto.scryptSync` + `timingSafeEqual`, throttling brute-force per IP+email (`LOGIN_ATTEMPTS`), pembuatan/rotasi token sesi ter-hash SHA-256, pemeriksaan *idle timeout*, inspeksi *magic bytes* berkas unggahan (`PDF`, `JPEG`, `PNG`, `WebP`, `CSV`), serta pencatatan `audit_logs` dan `activity_timeline`. |
| `server/routes.ts` | Endpoint portal publik (`/api/public/*`), cascading wilayah (`/api/locations/cascade`), autentikasi & sesi (`/api/auth/*`), unggah/unduh berkas privat (`/api/files/*`), dashboard, pencarian global, wilayah 38 provinsi + kab/kota + handover, verifikasi lokasi, personalia, organisasi, angkatan, proposal + versi, LKL, dan laporan koordinator. |
| `server/routes_modules.ts` | Endpoint tugas + komentar + bulk assign, dokumen + generator massal PDF/ZIP, pengumuman (termasuk `isPublic`), kalender, notifikasi, saved views, safeguarding, evaluasi, arsip & perpanjangan alumni, kontrol sistem + backup/restore ZIP SHA-256, aktivitas saya (`/api/my-activity`), manajemen pengguna/pengaturan, ekspor CSV, dan CRUD CMS/Pusat Bantuan (`/api/cms*`, `/api/help-articles*`). |

---

## 3. Lapisan Frontend (`src/`)

- **Router & Isolasi Zona (`src/App.tsx`, `src/lib/routes.ts`)**:
  - Memisahkan secara tegas rute website publik (`isPublicWebsitePath`), halaman autentikasi (`/login`, `/lupa-password`, `/reset-password`, `/aktivasi`, `/verifikasi-undangan`), dan rute privat terotentikasi (`matchPrivateRoute`).
  - Rute privat yang diakses tanpa sesi langsung diarahkan ke `/login` sambil menyimpan `pendingRedirectPath` agar pengguna kembali ke halaman tujuan setelah berhasil masuk.
- **Autentikasi & Tema (`src/context/AuthContext.tsx`)**:
  - Menyimpan status pengguna aktif, daftar izin efektif (`permissions`), preferensi tema `terang`/`gelap` pada `<html>` class `dark`, penanganan event sesi habis (`419` -> modal *Sesi Berakhir*), serta notifikasi belum terbaca.
- **Mesin Peta GeoJSON (`src/lib/geojson.ts`, `src/components/IndonesiaMap.tsx`)**:
  - Memuat geometri `/maps/indonesia-38-provinces.geojson` dan `/maps/kabupaten/<code>.geojson` sesuai kebutuhan (*lazy fetch* per provinsi), menghitung *bounding box* dan proyeksi koordinat bujur/lintang ke kanvas SVG beresolusi tinggi dengan kontrol zoom, pan, seleksi provinsi, dan *drilldown* kabupaten/kota.
- **Mesin Cetak A4 (`src/components/print/A4PrintEngine.tsx`)**:
  - Modal pratinjau cetak interaktif dengan pilihan orientasi **Potret (`portrait`)** atau **Lanskap (`landscape`)**, aturan CSS `@page { size: A4; margin: 12mm; }` & `@media print`, kop resmi DPBI, blok metadata terstruktur, serta penomoran referensi.
- **Design System Terpadu (`src/components/ui/`)**:
  - Terdiri atas `Button.tsx`, `FormControls.tsx`, `DataDisplay.tsx`, `Overlay.tsx`, `Feedback.tsx`, `DocumentPreview.tsx`, dan ekspor terpadu `Primitives.tsx`. Seluruh kontrol mematuhi standar *Minimal Institutional Dashboard* tanpa elemen pil dekoratif atau bayangan berlebihan.

---

## 4. Kesesuaian Build & Rilis

- `npm run lint`: Validasi tipe TypeScript ketat (`tsc --noEmit`).
- `npm test`: Menjalankan `tsx --test src/lib/domain.test.ts` menggunakan `node:test`.
- `npm run build`: Mengompilasi SPA ke `dist/` (Vite 8) dan membundel `server.ts` ke `server.js` (esbuild ESM).
- `npm run package:zip`: Menjalankan `scripts/create-release-zip.mjs` untuk menghasilkan arsip bersih `satu-dpbi-paket-final.zip`.
