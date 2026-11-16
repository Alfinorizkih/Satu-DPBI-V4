# Arsitektur Keamanan & Tata Kelola Sesi — SATU DPBI

Dokumen ini menjelaskan kontrol keamanan aplikasi pada `server/security.ts`, `server.ts`, dan mekanisme autentikasi frontend.

---

## 1. Penyimpanan Kata Sandi & Anti-Brute-Force

- **Hashing Kata Sandi**: Menggunakan fungsi pembangkit kunci adaptif bawaan Node.js `crypto.scryptSync(password, salt, 64)` dengan *salt* acak 16-byte per pengguna.
- **Perbandingan Konstan**: Verifikasi menggunakan `crypto.timingSafeEqual` untuk mencegah *timing attack*.
- **Pembatasan Percobaan Masuk (*Login Throttling*)**:
  - Pencatatan kegagalan dilakukan per kunci `${req.ip}:${email}`.
  - Setelah **5 kali** percobaan gagal berturut-turut, akun untuk IP tersebut dikunci sementara selama kelipatan 30 detik hingga maksimal **15 menit**, mengembalikan **HTTP `429`** beserta estimasi `retryAfterSec`.

---

## 2. Manajemen Sesi, Rotasi ID Sesi & Idle Timeout

| Kontrol | Implementasi Teknis |
| :--- | :--- |
| **Token Sesi** | Token acak 32-byte (64 karakter hex) hanya dikirim via cookie; basis data **hanya** menyimpan hash `SHA-256` (`sessions.token_hash`). |
| **Bendera Cookie** | `HttpOnly: true`, `Path: '/'`, `SameSite` terkonfigurasi (`lax` default, atau `none` bila lintas domain dengan `Secure: true`). Pada mode produksi non-local, `Secure` aktif otomatis. |
| **Masa Berlaku & Idle Timeout** | Dikonfigurasi via `system_settings` (`session_ttl_hours`: 1–168 jam, default 24 jam; `idle_timeout_minutes`: 5–480 menit, default 45 menit). Sesi kadaluarsa/idle menghapus baris di DB, membersihkan cookie, dan merespons **HTTP `419`**. |
| **Rotasi ID Sesi** | Setiap pembaruan kata sandi (`POST /api/auth/change-password`) menghapus seluruh sesi perangkat lain **dan** merotasi sesi aktif (`rotateSession`) menjadi token baru. |
| **Pencabutan Sesi Saat Mutasi Peran/Status** | Mengubah status akun (`nonaktif`/`terkunci`) atau peran pengguna via `PATCH /api/settings/users/:id/status` seketika menghapus seluruh sesi aktif target. |
| **Kontrol Multi-Perangkat** | Pengguna dapat melihat seluruh perangkat aktif (`GET /api/auth/sessions`), mencabut satu perangkat (`DELETE /api/auth/sessions/:id`), atau keluar dari semua perangkat (`POST /api/auth/sessions/revoke-all`). |

---

## 3. Perlindungan CSRF, CORS & Security Headers

- **Header HTTP Keamanan (`server.ts`)**: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-XSS-Protection: 0`.
- **Validasi Origin (`requireSafeOrigin`)**: Seluruh request `POST`, `PATCH`, `PUT`, `DELETE` pada `/api/*` wajib berasal dari host yang sama, tercantum dalam `CORS_ALLOWED_ORIGINS`, atau membawa header khusus `X-Requested-With: SATU-DPBI`.
- **Token Reset & Undangan Sekali Pakai**: Token pada `password_resets` dan `invitations` disimpan sebagai hash SHA-256, memiliki batas waktu kedaluwarsa (`1 jam` untuk reset, `72 jam` untuk undangan), dan ditandai `used_at` saat pertama kali digunakan.

---

## 4. Keamanan Berkas Unggahan & Storage Privat

- **Validasi Signature (*Magic Bytes*)**: `inspectFileMagicBytes()` menolak berkas yang ekstensinya tidak cocok dengan isi biner sebenarnya:
  - PDF (`%PDF-`), JPEG (`FF D8 FF`), PNG (`89 50 4E 47`), WebP (`RIFF....WEBP`), dan CSV teks polos.
- **Batas Ukuran**: Maksimal 15 MB per unggahan (`multer.memoryStorage()`).
- **Isolasi Penyimpanan**: Seluruh berkas sensitif disimpan di `storage/private/` di luar folder publik web, dinamai menggunakan UUID + ekstensi tervalidasi, serta melewati `path.basename()` + verifikasi `fullPath.startsWith(PRIVATE_STORAGE_DIR)` untuk mencegah *path traversal*.
- **Media Publik Terpisah**: `GET /api/public/files/:id` hanya diizinkan melayani berkas gambar (`jpeg`/`png`/`webp`) dari modul `province_logo` dan `public_media`.

---

## 5. Jejak Audit Terpisah & Penanganan Error Aman

- **Audit Log (`audit_logs`)**: Bersifat *append-only* mencatat setiap login, logout, rotasi sesi, unduh/pratinjau berkas, perubahan peran, keputusan proposal/LKL, ekspor data, backup/restore, serta perubahan CMS.
- **Error Handler Global**: Tidak pernah memaparkan *stack trace* atau kueri SQL ke klien; galat HTTP 500 dicatat ke tabel `system_errors` dengan kode unik `ERR-YYYYMMDD-XXXXXX` untuk ditelusuri administrator di `/status-sistem`.
