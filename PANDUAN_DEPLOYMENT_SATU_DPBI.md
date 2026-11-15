# Panduan Deployment SATU DPBI (GitHub → Vercel → Domainesia → ArenHost)

Dokumen ini memandu tim pengelola **SATU DPBI** dari kode sumber lokal hingga siap tayang di produksi menggunakan alur **GitHub (repositori & CI) → Vercel (Frontend SPA) → Domainesia (Domain & DNS) → ArenHost (Backend API & Database MySQL)**.

> **Catatan Arsitektur Penting Mengenai ArenHost & Backend Node.js**:
> Aplikasi backend SATU DPBI dibangun di atas **Node.js (>= 22) + Express 4** (`server.ts`) dengan basis data lokal SQLite (`node:sqlite`) dan skema produksi MySQL (`database/schema_mysql.sql`).
> Sebelum melakukan deployment backend ke **ArenHost**, periksa paket hosting ArenHost yang Anda miliki:
> - **Opsi A — ArenHost VPS atau Shared Hosting dengan fitur *Setup Node.js App* (CloudLinux NodeJS Selector versi >= 22)**: Dapat langsung menjalankan `server.js` hasil `npm run build`.
> - **Opsi B — ArenHost Shared Hosting PHP/MySQL-only (tanpa runtime Node.js >= 22)**: Paket shared hosting PHP standar **tidak dapat** mengeksekusi server Node.js/Express secara persisten. Jika paket Anda adalah PHP-only, Anda harus menjalankan backend Express di **VPS ArenHost / layanan Node.js hosting lain** (mis. `api.dpbi.or.id`) sambil tetap memakai MySQL cPanel ArenHost, **atau** mem-porting lapisan endpoint `server/routes*.ts` ke PHP PDO/Laravel bila seluruhnya harus berjalan di shared hosting PHP.

---

## Tahap 1 — Pra-Syarat Akun, Alat & Informasi

Siapkan hal berikut sebelum memulai deployment:
1. **Akun GitHub** (untuk menyimpan repositori privat organisasi DPBI dan menjalankan `.github/workflows/ci.yml`).
2. **Akun Vercel** (terhubung ke GitHub untuk hosting frontend React/Vite berkecepatan tinggi dengan SSL otomatis).
3. **Akun Domainesia** (tempat domain resmi organisasi dikelola, misal `dpbi.or.id`).
4. **Akun ArenHost** (cPanel/VPS beserta akses Database MySQL dan manajemen proses Node.js).
5. **Alat Lokal**: Git, Node.js versi **22.x**, dan npm.
6. **Rahasia Produksi**: Buat `SESSION_SECRET` acak minimal 64 karakter hex sebelum konfigurasi server:
   ```bash
   openssl rand -hex 32
   ```

---

## Tahap 2 — Menyiapkan & Mengunggah Kode ke GitHub

1. Pastikan berkas `.gitignore` sudah mengabaikan `.env`, `node_modules/`, `data/`, `storage/`, `server.js`, `*.db`, dan `*.zip`.
2. Verifikasi secara lokal bahwa kode bersih sebelum di-push:
   ```bash
   npm ci
   npm run lint
   npm test
   npm run build
   ```
3. Inisialisasi dan dorong repositori ke GitHub (gunakan repositori **Private**):
   ```bash
   git init
   git add .
   git commit -m "chore: siapkan rilis produksi SATU DPBI"
   git branch -M main
   git remote add origin https://github.com/ORGANISASI-DPBI/satu-dpbi.git
   git push -u origin main
   ```
4. Buka tab **Actions** di GitHub dan pastikan workflow **CI Validasi SATU DPBI** (`.github/workflows/ci.yml`) berstatus hijau (lulus `lint`, `test`, dan `build`).

---

## Tahap 3 — Build & Deployment Frontend di Vercel

1. Masuk ke dashboard **Vercel** → **Add New... → Project** → pilih repositori `satu-dpbi`.
2. Konfigurasi build (sudah disiapkan di `vercel.json`):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build` *(atau `npx vite build` jika ingin mengompilasi sisi klien saja)*
   - **Output Directory**: `dist`
3. Tambahkan **Environment Variables** di Vercel:
   - `VITE_API_BASE_URL` = `https://api.dpbi.or.id` *(ganti sesuai domain/subdomain backend Anda, tanpa `/` di belakang)*.
4. Klik **Deploy** dan tunggu hingga Vercel menerbitkan URL pratinjau (mis. `satu-dpbi.vercel.app`).
5. Pastikan setiap URL rute langsung (mis. `/proposal/baru`, `/aktivitas-saya`) tidak menghasilkan 404 karena `vercel.json` sudah memuat aturan rewrite SPA.

---

## Tahap 4 — Pengaturan Domain & DNS di Domainesia

Misalkan domain utama organisasi adalah `dpbi.or.id`:
- Frontend di Vercel akan memakai: **`satu.dpbi.or.id`** (atau domain puncak `dpbi.or.id`).
- Backend API di ArenHost/VPS akan memakai: **`api.dpbi.or.id`**.

Langkah di **MyDomainesia → Domain → Kelola DNS (DNS Management)**:
1. Tambahkan record untuk **Frontend (Vercel)**:
   - Tipe: `CNAME`
   - Nama/Host: `satu` (untuk `satu.dpbi.or.id`)
   - Value/Target: `cname.vercel-dns.com.`
   - TTL: `300` atau bawaan.
   - *(Lalu masuk ke **Vercel → Project Settings → Domains**, tambahkan `satu.dpbi.or.id` dan tunggu status SSL Valid).*
2. Tambahkan record untuk **Backend API (ArenHost/VPS)**:
   - Tipe: `A`
   - Nama/Host: `api` (untuk `api.dpbi.or.id`)
   - Value/Target: **Alamat IP Publik server/VPS ArenHost Anda**.
3. Jika seluruh aplikasi (frontend + backend) di-hosting bersamaan dalam satu server ArenHost tanpa Vercel, cukup arahkan `satu` (`A` record) langsung ke IP ArenHost dan kosongkan `VITE_API_BASE_URL`.

---

## Tahap 5 — Menyiapkan Backend & Hosting di ArenHost

1. **Verifikasi Dukungan Node.js di ArenHost**:
   - Masuk ke **cPanel ArenHost** dan cari menu **Setup Node.js App**, **atau** masuk melalui SSH jika menggunakan **VPS ArenHost**.
   - Pastikan tersedia runtime **Node.js 22.x** (wajib untuk `node:sqlite` dan ESM bundle `server.js`).
2. **Aktifkan SSL/HTTPS untuk `api.dpbi.or.id`**:
   - Di cPanel → **SSL/TLS Status** → jalankan **Run AutoSSL** untuk `api.dpbi.or.id` (atau gunakan **Certbot / Nginx Reverse Proxy** di VPS).
   - HTTPS **wajib aktif** agar cookie sesi `HttpOnly` lintas subdomain berfungsi aman.
3. **Unggah Proyek & Bangun Server**:
   - Clone repositori (atau unggah hasil bersih tanpa `node_modules`) ke direktori aplikasi, misalnya `/home/user/satu-dpbi-api`:
     ```bash
     npm ci
     npm run build
     ```
   - File eksekusi produksi backend adalah **`server.js`** dengan perintah mulai: `npm start` (`NODE_ENV=production node server.js`).
4. **Reverse Proxy (Khusus VPS dengan Nginx)**:
   ```nginx
   server {
       listen 443 ssl http2;
       server_name api.dpbi.or.id;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

---

## Tahap 6 — Konfigurasi Database MySQL & Variabel `.env` Produksi

1. **Membuat Database MySQL di cPanel ArenHost**:
   - Buka **MySQL Databases** → buat database baru (mis. `dpbiorid_satudpbi`).
   - Buat user MySQL dengan kata sandi kuat lalu berikan **ALL PRIVILEGES** ke database tersebut.
2. **Impor Skema Resmi (`database/schema_mysql.sql`)**:
   - Buka **phpMyAdmin**, pilih database `dpbiorid_satudpbi` → tab **Import** → pilih berkas `database/schema_mysql.sql` → klik **Go**.
   - Verifikasi seluruh **38 tabel** (`users`, `sessions`, `provinces`, `personnel`, `proposals`, `lkl_reports`, `system_errors`, dst.) berhasil dibuat dengan engine `InnoDB` dan collation `utf8mb4_unicode_ci`.
   > **Catatan Konektor Database Saat Ini**: Implementasi runtime `server/db.ts` saat ini menggunakan `node:sqlite` (`data/satu_dpbi_prod.db`) secara bawaan agar zero-dependency. Jika Anda menargetkan persistence langsung ke MySQL ArenHost pada runtime, pasangkan adaptor `mysql2/promise` di `server/db.ts` atau jalankan SQLite pada volume disk persisten VPS ArenHost sambil menggunakan `schema_mysql.sql` untuk migrasi relasional terpusat.
3. **Buat Berkas `.env` Produksi di Server Backend** *(jangan pernah commit berkas ini)*:
   ```env
   NODE_ENV="production"
   PORT="3000"
   APP_URL="https://satu.dpbi.or.id"
   DEMO_MODE="false"
   SESSION_SECRET="<TEMPEL_64_KARAKTER_HEX_ACAK_DISINI>"
   STORAGE_QUOTA_MB="10240"
   KEMENDIKDASMEN_INTEGRATION_ENABLED="false"

   CORS_ALLOWED_ORIGINS="https://satu.dpbi.or.id"
   COOKIE_SAMESITE="lax"
   COOKIE_DOMAIN=".dpbi.or.id"
   ```

---

## Tahap 7 — Migrasi Data Awal & Inisialisasi Super Admin Produksi

1. Jalankan server backend dalam mode produksi (`DEMO_MODE="false"`):
   ```bash
   pm2 start server.js --name satu-dpbi-api
   pm2 save
   ```
2. Saat dijalankan pertama kali:
   - 38 data resmi provinsi Indonesia (`provinces`), aturan matriks persetujuan (`approval_matrix_rules`), pekerjaan otomasi (`automation_jobs`), dan pengaturan default organisasi otomatis ditanamkan oleh `ensureSeeded` **tanpa akun demo**.
3. Buka `https://satu.dpbi.or.id` di peramban:
   - Karena `DEMO_MODE="false"` dan tabel `users` masih kosong, portal otomatis menampilkan formulir **Inisialisasi Super Admin Pertama**.
   - Daftarkan email resmi Ketua/Pengelola Utama dan kata sandi kuat.
   - Setelah akun Super Admin dibuat, fitur bootstrap terkunci permanen.
4. Masuk ke `/pengaturan/pengguna` untuk mulai mengundang Pengurus Nasional, Sekretariat Nasional, dan Koordinator Wilayah menggunakan **token undangan sekali pakai**.

---

## Tahap 8 — Koneksi Frontend–Backend, CORS, HTTPS & Cookie Lintas Subdomain

Verifikasi pengaturan komunikasi antara Vercel dan Backend:
1. **Jika menggunakan satu domain induk (`satu.dpbi.or.id` & `api.dpbi.or.id`)**:
   - Gunakan `COOKIE_SAMESITE="lax"` dan `COOKIE_DOMAIN=".dpbi.or.id"`. Ini lebih ramah terhadap kebijakan *third-party cookie blocking* di Safari/Chrome terbaru.
2. **Jika menggunakan domain berbeda sepenuhnya (mis. `satu-dpbi.vercel.app` & `api.dpbi.or.id`)**:
   - Atur `COOKIE_SAMESITE="none"` dan kosongkan `COOKIE_DOMAIN=""`.
   - Kedua situs **wajib HTTPS**.
3. **Header Anti-CSRF**:
   - Pastikan proxy Nginx/Cloudflare tidak menghapus header `Origin`, `Cookie`, `Set-Cookie`, dan `X-Requested-With`.

---

## Tahap 9 — Pengujian Pasca-Deployment (Wajib Sebelum Rilis Umum)

Lakukan uji berikut langsung pada URL produksi `https://satu.dpbi.or.id`:
1. Buka `https://api.dpbi.or.id/api/health` → pastikan respons JSON: `{"ok":true,"service":"SATU DPBI","mode":"PRODUKSI",...}`.
2. Login sebagai Super Admin di `https://satu.dpbi.or.id`, lalu muat ulang halaman (`F5`) → sesi wajib tetap aktif.
3. Uji deep link langsung di bilah alamat: `/aktivitas-saya`, `/tugas-saya`, `/alumni`, `/proposal/baru`, `/audit-log`, `/status-sistem`.
4. Buat proposal uji coba, unggah lampiran PDF, dan buka pratinjaunya untuk memastikan `storage/private/` memiliki izin tulis (`chmod 750`).
5. Uji logout, login ulang dengan password salah 6 kali untuk memastikan rate limiter HTTP `429` aktif, lalu login kembali.
6. Verifikasi tab `/pengaturan/sesi` menampilkan perangkat aktif dan tombol **Keluar dari Semua Perangkat** berfungsi.

---

## Tahap 10 — Checklist Keamanan & Pemeliharaan Berkala

- [ ] `DEMO_MODE` terkonfirmasi `"false"` di server produksi (tombol demo switch tidak muncul di halaman login).
- [ ] `KEMENDIKDASMEN_INTEGRATION_ENABLED` tetap `"false"`.
- [ ] HTTPS HSTS aktif dan sertifikat SSL auto-renew berjalan di Vercel dan ArenHost.
- [ ] Backup database & folder `storage/private/` terjadwal harian otomatis (lihat `PANDUAN_BACKUP_RESTORE.md`).
- [ ] Peninjauan rutin `/audit-log` dan `/status-sistem` dilakukan minimal mingguan oleh Super Admin/Sekretariat.
