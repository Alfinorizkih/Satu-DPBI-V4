# Panduan Deployment Produksi Umum — SATU DPBI

Panduan ini mencakup standar deployment produksi untuk **SATU DPBI** pada lingkungan tunggal (*single-host* Node.js) maupun arsitektur terpisah (Frontend SPA di Vercel/CDN + Backend API di Node.js Server/VPS).

---

## 1. Prasyarat Infrastruktur

- **Node.js**: Versi **22.x** atau lebih baru (wajib karena aplikasi menggunakan `node:sqlite` bawaan tanpa dependensi C++ eksternal).
- **npm**: Versi 10+.
- **HTTPS / SSL**: Wajib aktif pada domain produksi agar cookie sesi `HttpOnly; Secure` diterima oleh browser modern.
- **Ruang Penyimpanan Persisten**: Direktori `data/` (basis data SQLite WAL) dan `storage/` (`storage/private/` & `storage/backups/`) harus berada pada disk persisten yang tidak terhapus saat deploy ulang.

---

## 2. Variabel Lingkungan Produksi (`.env`)

Salin `.env.example` menjadi `.env` di server backend, lalu sesuaikan:

```env
NODE_ENV="production"
PORT="3000"
APP_URL="https://satu.dpbi.or.id"
DEMO_MODE="false"
SESSION_SECRET="<64_KARAKTER_HEX_ACAK_HASIL_openssl_rand_-hex_32>"
STORAGE_QUOTA_MB="10240"
KEMENDIKDASMEN_INTEGRATION_ENABLED="false"

# Isi bila frontend dan backend terpisah origin/subdomain
VITE_API_BASE_URL=""
CORS_ALLOWED_ORIGINS="https://satu.dpbi.or.id"
COOKIE_SAMESITE="lax"
COOKIE_DOMAIN=""
```

> **Peringatan Keamanan**: Jangan pernah mengaktifkan `DEMO_MODE="true"` di server produksi karena mode tersebut membuka endpoint `/api/auth/demo-switch` dan menampilkan tombol akun simulasi di halaman masuk.

---

## 3. Langkah Build & Menjalankan Produksi (Single Host / VPS)

```bash
# 1. Pasang dependensi produksi & dev untuk proses build
npm ci

# 2. Verifikasi kualitas sebelum rilis
npm run lint
npm test

# 3. Bangun frontend (dist/) dan bundel server (server.js)
npm run build

# 4. Jalankan server produksi (disarankan memakai PM2 atau systemd)
NODE_ENV=production node server.js
```

Contoh konfigurasi proses menggunakan **PM2**:

```bash
pm2 start server.js --name satu-dpbi --env production
pm2 save
pm2 startup
```

---

## 4. Deployment Frontend Terpisah di Vercel

Berkas `vercel.json` sudah menyiapkan rewrite SPA agar rute bersih seperti `/wilayah/32` atau `/proposal/baru` tidak menghasilkan `404`.
1. Hubungkan repositori GitHub ke **Vercel**.
2. Set *Build Command* ke `npx vite build` (atau `npm run build`) dan *Output Directory* ke `dist`.
3. Tambahkan Environment Variable **`VITE_API_BASE_URL`** berisi URL origin backend HTTPS (contoh: `https://api.dpbi.or.id`, tanpa garis miring di akhir).
4. Pada server backend, isi `CORS_ALLOWED_ORIGINS="https://satu.dpbi.or.id"` dan atur:
   - `COOKIE_SAMESITE="lax"` + `COOKIE_DOMAIN=".dpbi.or.id"` bila memakai subdomain satu domain induk.
   - `COOKIE_SAMESITE="none"` + `COOKIE_DOMAIN=""` bila domain Vercel berbeda sepenuhnya dengan domain backend.

---

## 5. Verifikasi Pasca-Deploy

1. Panggil `GET https://<domain-backend>/api/health` -> pastikan `"ok":true` dan `"mode":"PRODUKSI"`.
2. Buka `/` di peramban: pada database kosong, portal otomatis mengarahkan admin perdana ke inisialisasi Super Admin pertama (`POST /api/auth/bootstrap`).
3. Segera buat akun Super Admin pertama; setelah 1 pengguna tersimpan, form bootstrap terkunci otomatis selamanya.
4. Uji muat ulang halaman (`F5`) setelah login, unggah berkas PDF ke `/proposal`, serta uji `/wilayah` untuk memastikan seluruh berkas GeoJSON di `public/maps/` termuat dengan status `200 OK`.
