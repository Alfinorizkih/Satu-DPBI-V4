# Panduan Troubleshooting — SATU DPBI

Daftar masalah umum saat instalasi lokal, pengoperasian harian, maupun deployment produksi beserta langkah penyelesaiannya.

---

## 1. Masalah Instalasi & Build Lokal

### A. Error `Cannot find module 'node:sqlite'` saat menjalankan `npm run dev` atau `npm start`
- **Penyebab**: Versi Node.js yang digunakan lebih lama dari Node.js 22.x (modul bawaan `node:sqlite` tersedia mulai Node 22.5+).
- **Solusi**: Periksa versi Node dengan `node -v`. Tingkatkan ke **Node.js 22 LTS** atau lebih baru (disarankan via `nvm install 22 && nvm use 22`).

### B. `npm run build` gagal atau `tsc --noEmit` memunculkan error impor
- **Solusi**: Jalankan `npm ci` untuk menyinkronkan `node_modules` sesuai `package-lock.json` / `bun.lock`, lalu ulangi `npm run lint && npm run build`.

---

## 2. Masalah Autentikasi, Sesi & CORS (Deployment Terpisah)

### A. Login berhasil (`200 OK`) tetapi halaman langsung kembali ke login / `/api/auth/me` mengembalikan `401`
- **Penyebab**: Cookie sesi `satu_dpbi_sid` tidak tersimpan atau tidak terkirim lintas domain antara Vercel (`frontend`) dan server API (`backend`).
- **Solusi**:
  1. Pastikan kedua URL menggunakan **HTTPS** (browser modern memblokir cookie `SameSite=None` di HTTP biasa).
  2. Di `.env` backend, atur `CORS_ALLOWED_ORIGINS="https://domain-frontend-anda.vercel.app"` (atau `https://satu.dpbi.or.id`) **tanpa garis miring di akhir**.
  3. Atur `COOKIE_SAMESITE="none"` jika domain frontend dan backend berbeda root domain (mis. `*.vercel.app` dan `api.dpbi.or.id`). Jika satu root domain (`satu.dpbi.or.id` & `api.dpbi.or.id`), gunakan `COOKIE_SAMESITE="lax"` dan `COOKIE_DOMAIN=".dpbi.or.id"`.
  4. Di Vercel, pastikan `VITE_API_BASE_URL` diisi URL backend tanpa garis miring penutup, lalu lakukan *Redeploy*.

### B. Muncul error `403 Origin tidak diizinkan` saat mengirim form / login
- **Penyebab**: Middleware `requireSafeOrigin` menolak permintaan `POST/PATCH/DELETE` karena origin pemanggil belum terdaftar.
- **Solusi**: Tambahkan origin persis (skema + domain + port jika ada) ke variabel `CORS_ALLOWED_ORIGINS` pada `.env` backend dan muat ulang server.

### C. Muncul error `429 Terlalu banyak percobaan login`
- **Penyebab**: Fitur anti-brute-force memblokir sementara setelah **5 kali** gagal login dalam 15 menit dari IP + email yang sama.
- **Solusi**: Tunggu 15 menit hingga jendela pembatas terbuka otomatis, atau gunakan alur **Reset Password** bila lupa kata sandi.

### D. Muncul dialog / halaman `419 Sesi Berakhir`
- **Penyebab**: Sesi melebihi batas tidak aktif (`IDLE_TIMEOUT_MINUTES`, bawaan 60 menit), masa berlaku absolut habis, atau sesi dicabut dari perangkat lain via `/pengaturan/sesi`.
- **Solusi**: Klik **Masuk Kembali** untuk melakukan autentikasi ulang dan menerbitkan ID sesi baru.

---

## 3. Masalah Navigasi & Routing SPA (404 saat Refresh di Vercel)

- **Gejala**: Membuka `/proposal/baru` atau menekan F5 pada `/personalia/per-101` memunculkan 404 bawaan penyedia hosting statis.
- **Solusi**: Pastikan berkas `vercel.json` di root repositori ikut terunggah dan berisi aturan `rewrites` dari `"/((?!assets/).*)"` ke `"/index.html"`.

---

## 4. Masalah Unggah Berkas, Pratinjau PDF & Kuota Penyimpanan

### A. Pratinjau PDF menampilkan layar kosong atau gagal dimuat di iframe
- **Penyebab**: Header `X-Frame-Options` pada server API memblokir penyematan lintas origin, atau `VITE_API_BASE_URL` belum terpasang di komponen pratinjau.
- **Solusi**: Pastikan seluruh tautan file menggunakan helper `apiUrl('/api/files/...')` dan domain backend tidak memblokir embedding iframe dari domain frontend DPBI.

### B. Error saat unggah dokumen: kuota penuh atau ukuran berkas ditolak
- **Solusi**: Periksa kapasitas pada `/sistem` tab **Storage & Backup**. Tingkatkan nilai `STORAGE_QUOTA_MB` pada `.env` jika kapasitas disk hosting masih mencukupi, atau arsipkan/hapus berkas sementara yang tidak terpakai.

---

## 5. Investigasi Error Internal HTTP `500`

Jika pengguna melaporkan pesan error beserta **Kode Referensi** (mis. `ERR-20261115-...`):
1. Masuk sebagai **Super Admin** dan buka `/status-sistem`.
2. Cari kode referensi tersebut pada tabel **Catatan Error Sistem Terbaru (`system_errors`)** untuk melihat endpoint rute dan pesan kesalahan teknis yang tercatat di server tanpa mengekspos detail basis data ke pengguna publik.
