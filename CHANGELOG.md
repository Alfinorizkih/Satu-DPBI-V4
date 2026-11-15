# Catatan Perubahan (Changelog) — SATU DPBI

Seluruh perubahan besar pada arsitektur, antarmuka, keamanan, dan kesiapan produksi dicatat secara berurutan pada dokumen ini.

---

## [2.0.0] — Perombakan Menyeluruh & Kesiapan Produksi

### Penambahan Fitur & Halaman Baru
- **Halaman Baru Terdedikasi**:
  - `/aktivitas-saya` (`MyActivityPage.tsx`): ringkasan pribadi proposal, LKL, tugas, notifikasi, dan aktivitas audit pengguna aktif.
  - `/tugas-saya`: filter otomatis mode tugas pribadi di `TasksPage`.
  - `/alumni` (`AlumniPage.tsx`): direktori alumni lintas angkatan, penghitung sisa jendela akses 30 hari, serta kontrol perpanjangan akses oleh administrator.
  - `/profil`, `/pengaturan/keamanan`, `/pengaturan/sesi`, `/pengaturan/pengguna`, `/pengaturan/hak-akses`: rute langsung terpisah menuju tab pengaturan akun, sesi aktif, manajemen pengguna, dan matriks RBAC.
  - `/audit-log` & `/status-sistem`: rute langsung menuju pusat audit keamanan dan pemantau kesehatan/error sistem (`system_errors`).
- **Endpoint Backend Baru**:
  - `GET /api/health` untuk pemantauan ketersediaan layanan (*uptime probe*).
  - `GET /api/my-activity` untuk agregasi aktivitas pribadi pengguna terautentikasi.
  - Penambahan daftar `systemErrors` pada `GET /api/system/overview`.

### Desain Sistem, Navigasi & Perlindungan Form
- **Design System Modular (`src/components/ui/`)**: Memecah komponen primitif ke dalam `Button.tsx`, `FormControls.tsx`, `DataDisplay.tsx`, `Overlay.tsx`, `Feedback.tsx`, dan `DocumentPreview.tsx` dengan dukungan penuh mode terang & mode gelap (`@custom-variant dark`), serta ekspor terpadu via `index.ts` dan kompatibilitas mundur `Primitives.tsx`.
- **Router Bersih & Deep Linking (`src/lib/routes.ts`)**: Mendukung rute berparameter (`/personalia/:id`, `/personalia/:id/ubah`, `/wilayah/:id`, `/angkatan/:id`, `/proposal/baru`, `/proposal/:id`, `/laporan-kegiatan/baru`, `/laporan-kegiatan/:id`, `/tugas/:id`, `/dokumen/:id`), validasi segmen aman, dan pelestarian tujuan (`pendingRedirectPath`) setelah login.
- **Navigasi Sidebar 5 Kelompok**: Penataan ulang menu menjadi **Utama**, **Organisasi**, **Operasional**, **Informasi**, dan **Pengelolaan** disertai penyorotan rute induk saat membuka rute detail.
- **Keamanan Pengisian Formulir**: Penambahan hook `useUnsavedChanges` (dialog konfirmasi sebelum meninggalkan formulir yang sudah diubah + peringatan `beforeunload`) serta penguncian ganda tombol kirim (*double-submit lock*) pada formulir Proposal, LKL, dan Personalia.

### Kesiapan Deployment & Dokumentasi
- Dukungan pemisahan domain frontend–backend melalui `VITE_API_BASE_URL`, middleware `CORS_ALLOWED_ORIGINS`, `COOKIE_SAMESITE`, dan `COOKIE_DOMAIN`.
- Sinkronisasi penuh `database/schema_mysql.sql` dengan seluruh kolom dan tabel terbaru (`notification_prefs_json`, `avatar_file_id`, `system_errors`).
- Penambahan `vercel.json`, `.github/workflows/ci.yml`, skrip pengemasan rilis `scripts/create-release-zip.mjs` (`npm run package:zip`), serta 12 dokumen operasional lengkap.

---

## [1.0.0] — Fondasi Awal SATU DPBI
- Implementasi awal server Express + SQLite WAL (`node:sqlite`), autentikasi sesi `HttpOnly`, 6 peran RBAC + delegasi, 38 provinsi Indonesia, modul Proposal, LKL, Laporan Koordinator, Tugas, Dokumen + PDF/ZIP bulk generator, Pengumuman, Kalender, Perlindungan Peserta, Evaluasi, Arsip Alumni 30 Hari, dan Backup/Restore terkompresi.
