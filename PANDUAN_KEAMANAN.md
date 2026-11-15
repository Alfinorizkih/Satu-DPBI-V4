# Panduan Keamanan & Tata Kelola Sesi — SATU DPBI

Dokumen ini menjelaskan kontrol keamanan teknis yang diterapkan pada backend dan frontend **SATU DPBI** serta praktik operasional wajib bagi pengelola server.

---

## 1. Arsitektur Autentikasi & Sesi

Implementasi terdapat pada `server/security.ts` dan `server/routes.ts`:

1. **Penyimpanan Kata Sandi**:
   - Menggunakan fungsi derivasi kunci **`crypto.scryptSync`** dengan salt acak 16-byte per pengguna dan perbandingan waktu konstan **`crypto.timingSafeEqual`** untuk mencegah serangan *timing attack*.
2. **Cookie Sesi Aman (`satu_dpbi_sid`)**:
   - **`HttpOnly: true`**: Tidak dapat dibaca oleh JavaScript (`document.cookie`) sehingga terlindung dari eksfiltrasi via XSS.
   - **`Secure`**: Aktif otomatis saat `NODE_ENV=production` atau protokol HTTPS (`X-Forwarded-Proto: https`).
   - **`SameSite`**: Dikonfigurasi via `COOKIE_SAMESITE` (`lax` untuk domain tunggal; `none` untuk deployment terpisah frontend Vercel + backend API berbeda domain/subdomain HTTPS).
   - Token mentah dikirim di cookie sementara di basis data hanya disimpan **hash SHA-256** (`sessions.token_hash`).
3. **Rotasi ID Sesi**:
   - Setiap proses login berhasil, aktivasi undangan, atau perubahan sensitif selalu menerbitkan baris sesi baru dengan ID acak baru dan mengganti sesi lama.
4. **Masa Berlaku & Batas Inaktivitas (*Idle Timeout*)**:
   - Masa berlaku absolut sesi bawaan: **8 jam** (`SESSION_TTL_HOURS`, dapat disesuaikan di pengaturan sistem).
   - Batas waktu tidak aktif bawaan: **60 menit** (`IDLE_TIMEOUT_MINUTES`). Setiap aktivitas di atas ambang tersebut diperiksa terhadap `last_seen_at`; bila kedaluwarsa, backend mengembalikan **HTTP `419`** dan frontend memblokir layar kerja agar pengguna melakukan autentikasi ulang.
5. **Manajemen Perangkat & Pencabutan Sesi**:
   - Pengguna dapat melihat seluruh perangkat aktif pada `/pengaturan/sesi`, mencabut satu sesi, atau menjalankan *logout* seluruh perangkat (`DELETE /api/auth/sessions`).

---

## 2. Pembatasan Laju (*Rate Limiting*) & Token Sekali Pakai

- **Proteksi Brute Force Login**: Percobaan login gagal per kombinasi IP dan email dibatasi hingga **5 kali dalam jendela 15 menit** (`checkLoginRateLimit`). Setelah melampaui batas, backend membalas HTTP **429 Too Many Requests**.
- **Token Reset Password & Undangan**:
  - Menggunakan 32-byte acak kriptografis (`crypto.randomBytes(32)`), disimpan sebagai hash SHA-256.
  - Memiliki waktu kedaluwarsa ketat dan hanya dapat digunakan **satu kali** (`used_at IS NULL`).

---

## 3. Perlindungan CSRF, Origin & CORS

1. **`requireSafeOrigin` (`server/security.ts`)**:
   - Seluruh permintaan perubahan data (`POST`, `PATCH`, `PUT`, `DELETE`) ke `/api/*` wajib berasal dari origin yang sama atau tercantum eksplisit di variabel `CORS_ALLOWED_ORIGINS`, dan menyertakan header anti-CSRF `X-Requested-With: SATU-DPBI`.
2. **CORS Terbatas (`server.ts`)**:
   - Hanya mengizinkan domain yang didaftarkan pada `CORS_ALLOWED_ORIGINS` (tanpa wildcard `*`) agar `Access-Control-Allow-Credentials: true` tetap aman.
3. **Header Keamanan HTTP**:
   - Backend dan `vercel.json` menyertakan `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, dan `X-Frame-Options: SAMEORIGIN`.

---

## 4. Isolasi Hak Akses (RBAC) & Privasi Data Sensitif

- Penegakan hak akses dilakukan **di sisi server** melalui middleware `requireAuth` dan `requirePermission(module, action)` pada setiap endpoint, bukan hanya menyembunyikan tombol di UI.
- **Pembatasan Data Pribadi & Identitas**:
  - Bidang sensitif personalia (alamat lengkap domisili, NISN, dokumen kartu pelajar/izin wali) disaring berdasarkan cakupan wilayah dan peran.
  - Dokumen unggahan disimpan pada direktori privat (`storage/private/`) di luar folder `public/` sehingga tidak dapat diakses langsung tanpa autentikasi melalui `/api/files/:id`.
  - Modul **Perlindungan Peserta & Pengaduan** (`/perlindungan`) membatasi pembacaan rincian laporan sensitif hanya kepada peran pelindung berwenang dan pelapor terkait.

---

## 5. Checklist Pengerasan Produksi (*Production Hardening*)

- [ ] Pastikan `DEMO_MODE="false"` pada `.env` server produksi (mematikan fitur `demo-switch` dan akun simulasi publik).
- [ ] Atur `SESSION_SECRET` dengan minimal 64 karakter acak unik (`openssl rand -hex 32`).
- [ ] Pastikan HTTPS aktif penuh (TLS valid) pada domain frontend maupun domain API backend.
- [ ] Jangan pernah mengunggah `.env`, berkas `.db`, atau isi `storage/` ke repositori Git publik maupun privat.
- [ ] Tinjau secara berkala menu `/audit-log` dan `/status-sistem` untuk mendeteksi percobaan akses `401`/`403`/`429` berulang.
