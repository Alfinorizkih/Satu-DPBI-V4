# Laporan Tinjauan Keamanan — SATU DPBI

Dokumen ini merangkum hasil audit keamanan kode sumber, otorisasi, manajemen sesi, perlindungan unggahan, dan audit dependensi pada repositori **SATU DPBI**.

---

## 1. Ringkasan Audit Dependensi
- **Manajer Paket / Lockfile**: `bun.lock` (`package-lock.json` tidak digunakan).
- **Perintah Audit**: `bun audit` (read-only).
- **Hasil**: `No vulnerabilities found (checked 341 packages)` (`174 ms`).

---

## 2. Pengamanan Inti yang Diverifikasi

| Area Pengamanan | Lokasi Kode Terverifikasi | Mekanisme Perlindungan |
|---|---|---|
| **Hashing Kata Sandi & Token** | `server/security.ts:13-30` | Kata sandi di-hash menggunakan `crypto.scryptSync` + garam acak 16 byte dan dibandingkan memakai `crypto.timingSafeEqual`. Token sesi dan token undangan/reset disimpan sebagai ringkasan SHA-256 (`sha256`). |
| **Pembatasan Percobaan Login (Anti Brute-Force)** | `server/security.ts:10, 32-58`, `server/routes.ts:429` | Kegagalan login dilacak menggunakan `count`, `lockedUntil`, dan `lastAttemptAt`. Pada kegagalan ke-5 secara beruntun dalam jendela aktif, permintaan berikutnya ditolak dengan HTTP `429` dan penguncian progresif hingga 15 menit (juga memperbaiki bug reset counter prematur ketika `lockedUntil === 0`). |
| **Kebijakan TTL Sesi & Idle Timeout** | `server/security.ts:79-88, 90-122, 248-360` | Masa berlaku sesi dibatasi ketat maksimal **24 jam** (`Math.min(24, ...)`). Idle timeout mengakhiri sesi dengan status `419` dan membersihkan cookie. Cookie sesi diset `HttpOnly`, `SameSite` terkonfigurasi, dan `Secure` di produksi. |
| **Kontrol & Pencabutan Sesi oleh Admin** | `server/routes_modules.ts:977-1025` | Perubahan peran atau status akun langsung menghapus semua sesi aktif pengguna tersebut. Super Admin dapat meninjau daftar sesi perangkat aktif pengguna (`GET /api/settings/users/:id/sessions`) dan memutus seluruh sesi secara paksa (`DELETE /api/settings/users/:id/sessions`), sehingga token lama langsung tertolak `419`. |
| **Proteksi Lintas Origin** | `server/security.ts:366-414` | Permintaan mutasi memeriksa kecocokan header `Origin`/`Referer` terhadap `Host` atau daftar `CORS_ALLOWED_ORIGINS` serta header khusus `X-Requested-With: SATU-DPBI`. |
| **Kontrol Akses Berbasis Peran & Cakupan Provinsi** | `src/lib/rbac.ts`, `server/security.ts:416-448` | Setiap endpoint terproteksi memeriksa `requirePermission` dan `hasScopedUserPermission`. Koordinator Wilayah dibatasi pada `provinceCode` masing-masing (kecuali menerima delegasi aktif yang cocok dengan provinsi target), sementara Duta hanya dapat membaca/memodifikasi objek miliknya. |
| **Proteksi Berkas Privat & Anti-IDOR** | `server/security.ts:450-550`, `server/routes.ts:798-914` | Berkas diunggah ke `PRIVATE_STORAGE_DIR` di luar root web, divalidasi *magic bytes*-nya (`inspectFileMagicBytes`), dan pengunduhan/pratinjau wajib melewati `canAccessStoredFile` serta pengecekan jalur kanonis `fullPath.startsWith(PRIVATE_STORAGE_DIR)`. Upaya akses silang mencatat `ACCESS_DENIED_IDOR` di audit log. |
| **Validasi Templat Email & Ekspor CSV Aman** | `src/lib/rbac.ts`, `server/email.ts:5, 228-237` | Variabel placeholder templat email dibatasi pada daftar variabel resmi (`nama`, `email`, `jabatan`, `provinsi`, `angkatan`, `tanggal`, `referensi`), dan ekspor log CSV membungkus sel berawalan `=`, `+`, `-`, `@`, `\t`, atau `\r` menggunakan `csvSafeCell` agar aman dibuka di aplikasi spreadsheet. |
| **Kueri SQL Terparameter** | `server/*.ts` | Seluruh kueri SQLite (`node:sqlite`) menggunakan placeholder `?` terikat (prepared statements) tanpa interpolasi langsung nilai masukan pengguna. |
| **Isolasi PII pada Portal Publik** | `server/routes.ts`, `src/pages/PublicPages.tsx` | Halaman publik tidak mengekspos data pribadi pelajar (NISN, alamat, telepon, wali) dan menyembunyikan angka statistik agregat apabila pengaturan publik dinonaktifkan. |

---

## 3. Catatan Operasional Produksi
1. Saat beralih dari mode demo ke produksi (`DEMO_MODE=false`), atur `SESSION_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, dan `SMTP_FROM` di environment server (jangan di variabel `VITE_*`).
2. Tanpa `SMTP_HOST`, Pusat Email beroperasi aman pada mode **Sandbox Outbox (SQLite)** agar tidak mengirim email keluar secara tidak sengaja selama pengujian.
