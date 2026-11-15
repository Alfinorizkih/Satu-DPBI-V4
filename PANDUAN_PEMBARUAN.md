# Panduan Pembaruan & Rilis — SATU DPBI

Panduan ini menjelaskan alur aman saat memperbarui kode aplikasi, skema basis data, atau konfigurasi **SATU DPBI** di lingkungan pengembangan maupun produksi tanpa memutus sesi aktif atau merusak data.

---

## 1. Alur Kerja Pembaruan Kode (GitHub CI → Produksi)

1. **Tarik atau Terapkan Perubahan di Cabang Kerja**:
   ```bash
   git pull origin main
   npm ci
   ```
2. **Validasi Kualitas Sebelum Rilis**:
   ```bash
   npm run lint    # Pastikan 0 kesalahan TypeScript
   npm test        # Pastikan seluruh pengujian unit RBAC, domain & router lulus
   npm run build   # Bangun bundle dist/ dan server.js
   ```
   *(Pipeline `.github/workflows/ci.yml` juga menjalankan langkah yang sama secara otomatis pada setiap `push` dan `pull_request`.)*
3. **Buat Cadangan Data Sebelum Deploy**:
   - Masuk ke `/sistem` dan klik **Buat Backup Sistem Sekarang**, atau jalankan backup database & `storage/private/` di server produksi sebelum mengganti kode.

---

## 2. Pembaruan Frontend (Vercel)

Jika frontend di-hosting di **Vercel** dan terhubung ke GitHub:
- Setiap *push* ke cabang `main` memicu deployment otomatis di Vercel menggunakan `vercel.json`.
- Jika menambah variabel lingkungan baru di frontend (harus diawali `VITE_`, mis. `VITE_API_BASE_URL`), tambahkan pada **Vercel → Project Settings → Environment Variables**, lalu lakukan **Redeploy** agar nilai baru masuk ke bundel Vite.

---

## 3. Pembaruan Backend & Skema Basis Data

1. **Unggah Kode Baru / Pull di Server Backend**:
   ```bash
   git pull origin main
   npm ci --omit=dev # atau npm ci jika build dijalankan di server
   npm run build
   ```
2. **Migrasi Skema Aman**:
   - Pada SQLite (`server/db.ts`), `initSchema` menggunakan `CREATE TABLE IF NOT EXISTS` serta penambahan kolom ringan yang idempoten tanpa menimpa baris data yang ada.
   - Pada MySQL (`database/schema_mysql.sql`), jika terdapat kolom atau tabel baru pada versi rilis, jalankan skrip `ALTER TABLE ... ADD COLUMN` secara bertahap di phpMyAdmin/CLI dan **hindari** `DROP TABLE`.
3. **Restart Proses Node.js**:
   - Jika memakai **PM2**: `pm2 restart satu-dpbi --update-env`
   - Jika memakai **cPanel Node.js Selector**: klik **Restart** pada panel Node.js App.
4. **Verifikasi Pasca-Rilis**:
   - Panggil `GET /api/health` dan pastikan status mengembalikan `ok: true` dan `mode: "PRODUKSI"`.
   - Buka halaman `/status-sistem` sebagai Super Admin untuk memastikan tidak ada lonjakan entri pada tabel `system_errors`.

---

## 4. Rollback Cepat Jika Rilis Bermasalah

1. Kembalikan commit Git ke tag/commit stabil sebelumnya (`git checkout <commit-stabil>`), jalankan ulang `npm ci && npm run build`, lalu restart proses Node.js.
2. Jika perubahan melibatkan struktur tabel database yang tidak kompatibel ke belakang, pulihkan snapshot backup yang dibuat pada langkah 1.3.
3. Di Vercel, gunakan fitur **Instant Rollback** ke deployment sebelumnya pada menu *Deployments*.
