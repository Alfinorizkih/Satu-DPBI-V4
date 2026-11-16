# Panduan Deployment Khusus ArenHost — SATU DPBI

Dokumen ini menjelaskan secara jujur dan akurat cara men-deploy **SATU DPBI** pada infrastruktur **ArenHost** serta batasan teknis setiap jenis paket hosting.

---

## 1. Fakta Teknis Penting (Wajib Dibaca Sebelum Deploy)

Backend SATU DPBI (`server.ts` -> `server.js`) dibangun di atas **Node.js (>= 22) + Express 4** dan menggunakan modul bawaan **`node:sqlite`** dengan penyimpanan lokal pada `data/` dan `storage/`.

Oleh karena itu, kecocokan paket ArenHost terbagi menjadi dua skenario tegas:

| Jenis Layanan ArenHost | Dukungan Runtime | Status Menjalankan SATU DPBI Secara Penuh |
| :--- | :--- | :--- |
| **ArenHost VPS / Cloud Server (Linux)** | Penuh (bisa instal Node.js 22+, Nginx, PM2) | **Didukung Penuh 100%**. Frontend, Backend API, GeoJSON, upload privat, & backup ZIP berjalan utuh dalam satu server atau terpisah dengan Vercel. |
| **ArenHost Shared Hosting dengan CloudLinux *Setup Node.js App*** | Terbatas pada versi Node.js yang tersedia di cPanel | **Didukung jika dan hanya jika** versi Node.js di *NodeJS Selector* minimal **v22.x**. Jika hanya tersedia Node 16/18/20, modul `node:sqlite` tidak akan tersedia saat runtime. |
| **ArenHost Shared Hosting PHP/MySQL-Only (tanpa Node.js 22+)** | Hanya PHP & Apache/LiteSpeed + MySQL | **TIDAK DAPAT** menjalankan backend Express/Node.js secara langsung. Shared hosting PHP hanya bisa meng-host file statis hasil `vite build` (`dist/`) atau database MySQL-nya saja; backend Node.js **harus** diletakkan di VPS/server Node.js terpisah (mis. `api.dpbi.or.id`), atau seluruh endpoint `server/*.ts` harus ditulis ulang ke PHP jika wajib berjalan di shared hosting PHP. |

---

## 2. Skenario A — ArenHost VPS (Rekomendasi Utama)

1. **Siapkan Server & Node.js 22**:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
   sudo apt-get install -y nodejs nginx
   npm install -g pm2
   ```
2. **Unggah & Bangun Aplikasi**:
   ```bash
   mkdir -p /var/www/satu-dpbi && cd /var/www/satu-dpbi
   # Salin kode atau unzip satu-dpbi-paket-final.zip
   npm ci
   cp .env.example .env
   # Edit .env: set DEMO_MODE="false", SESSION_SECRET, APP_URL
   npm run build
   ```
3. **Pastikan Izin Direktori Data & Storage**:
   ```bash
   mkdir -p data storage/private storage/backups
   chmod 750 data storage storage/private storage/backups
   ```
4. **Jalankan dengan PM2 & Reverse Proxy Nginx**:
   ```bash
   pm2 start server.js --name satu-dpbi
   pm2 save
   ```
   Arahkan blok server Nginx HTTPS (`listen 443 ssl`) ke `http://127.0.0.1:3000` dengan `client_max_body_size 20M;` agar unggahan PDF hingga 15 MB tidak ditolak Nginx (`413`).

---

## 3. Skenario B — ArenHost cPanel dengan *Setup Node.js App* (Node 22+)

1. Ekstrak `satu-dpbi-paket-final.zip` ke folder aplikasi (mis. `/home/<user>/satu-dpbi`).
2. Di cPanel -> **Setup Node.js App** -> **Create Application**:
   - **Node.js version**: pilih **22.x** atau lebih baru.
   - **Application mode**: `Production`.
   - **Application root**: `satu-dpbi`.
   - **Application URL**: domain/subdomain Anda (mis. `satu.dpbi.or.id` atau `api.dpbi.or.id`).
   - **Application startup file**: `server.js`.
3. Masuk via **Terminal** cPanel atau klik **Run NPM Install** di UI cPanel, lalu jalankan:
   ```bash
   npm run build
   ```
4. Tambahkan Environment Variables di UI *Setup Node.js App* (`NODE_ENV=production`, `DEMO_MODE=false`, `SESSION_SECRET=...`, `KEMENDIKDASMEN_INTEGRATION_ENABLED=false`).
5. Klik **Restart**, lalu buka `https://<domain>/api/health` untuk memverifikasi server merespons `200 OK`.

---

## 4. Database MySQL cPanel ArenHost (`database/schema_mysql.sql`)

Skema MySQL/MariaDB resmi disediakan lengkap di `database/schema_mysql.sql` (dapat diimpor melalui **phpMyAdmin** di cPanel ArenHost).  
Perlu diperhatikan bahwa secara default runtime `server/db.ts` terhubung langsung ke SQLite WAL (`node:sqlite`) agar zero-dependency dan langsung mendukung fitur backup/restore arsip ZIP `database.sqlite` di menu `/sistem`. Bila organisasi memutuskan memindahkan persistence runtime dari SQLite ke MySQL server ArenHost, diperlukan penambahan lapisan adaptor kueri (`mysql2/promise`) pada `server/db.ts`.
