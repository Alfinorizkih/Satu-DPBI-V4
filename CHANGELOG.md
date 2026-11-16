# Catatan Perubahan (Changelog) — SATU DPBI

Seluruh perubahan besar pada arsitektur, antarmuka, keamanan, pemetaan wilayah, serta kesiapan produksi dicatat secara berurutan pada dokumen ini.

---

## [3.0.0] — Perombakan Total UI/UX, Website Publik, Peta GeoJSON 38 Provinsi, 6 Bidang & Mesin Cetak A4

### Pemisahan Website Publik & CMS Mandiri
- **3 Zona Terpisah (`/`, `/tentang`, `/wilayah`, `/wilayah/:code`, `/bantuan` vs `/login` vs Portal Internal)**:
  - Website Publik modern yang menampilkan profil gerakan DPBI (*Berbudaya, Bergerak, dan Berdampak Untuk Negeri*), struktur 6 Bidang Resmi, pengumuman publik terkurasi (`is_public = 1`), dan Pusat Bantuan yang dapat dicari serta difilter per peran.
  - Zero PII pelajar pada seluruh endpoint publik (`/api/public/overview`, `/api/public/provinces/:code`, `/api/public/help`, `/api/public/files/:id`) serta sanitasi jumlah Duta melalui `public_show_duta_count`.
  - Pemindahan *Demo Account Switcher* secara eksklusif ke halaman `/login` saat `DEMO_MODE=true`.
- **CMS Portal Publik & Pusat Bantuan (`/pengaturan/cms`)**:
  - Endpoint baru `GET /api/cms`, `PUT /api/cms/:key`, `POST/PATCH/DELETE /api/help-articles` dengan kewenangan khusus Super Admin, Wakil Super Admin, Sekretariat Nasional, dan Pengurus Nasional Bidang Media, Publikasi & Teknologi.
  - Toggle `isPublic` (`PATCH /api/announcements/:id`) pada Pusat Pengumuman.

### Pemetaan GeoJSON Nusantara & Integrasi 6 Bidang Resmi
- **Peta Nusantara GeoJSON Nyata (`public/maps/` & `IndonesiaMap.tsx`)**:
  - Memuat geometri batas resmi 38 provinsi dan *drilldown* 517 poligon kabupaten/kota secara *lazy-load*, lengkap dengan atribusi dataset pada `public/maps/metadata.json`.
  - Klasifikasi jujur wilayah (`classifyRegencyPresence`): membedakan **Duta Domisili** vs **Duta Penugasan**, keberadaan Koordinator Wilayah, serta realisasi Proposal/LKL, disertai fitur pemekaran daerah (`POST /api/regencies`) dan riwayat wilayah (`region_history`).
- **Integrasi 6 Bidang Pengurus Nasional (`OFFICIAL_BIDANGS`)**:
  - Bidang Administrasi & Organisasi, Bidang Program & Operasional, Bidang Pengembangan Wilayah, Bidang Pendidikan & Kebudayaan, Bidang Hubungan & Kemitraan, dan Bidang Media, Publikasi & Teknologi.
  - Kartu **Fokus Bidang Saya** pada Dashboard, pilihan Bidang pada manajemen pengguna & proposal, serta filter **`Hanya Bidang Saya`** (`?bidangOnly=1`) di `/proposal`.

### Mesin Cetak A4, Kelengkapan Modul & Dokumentasi Lengkap
- **Mesin Cetak A4 (`src/components/print/A4PrintEngine.tsx`)**:
  - Pratinjau dan cetak HTML/CSS `@page A4` (Potret & Lanskap) terintegrasi ke Wilayah, Personalia, Proposal, LKL, Laporan Koordinator, Dokumen Resmi (SK/Sertifikat/Surat), dan Arsip.
- **Peningkatan Modul Operasional**:
  - Lampiran berkas langsung (`FileDropzone`) pada pembuatan Tugas (`/tugas` -> `attachmentFileId`/`attachmentFileName`).
  - Lokasi bertingkat 4 level (`/api/locations/cascade`) dan deteksi duplikasi email/NISN pada Personalia.
- **Standarisasi Minimal Institutional Dashboard & Dokumentasi**:
  - Penghapusan status pil dekoratif statis, penerapan `tabular-nums`, kontrol satu baris rapi, serta penyusunan 17 panduan lengkap di `/docs/` (termasuk analisis jujur deployment ArenHost & Vercel).

---

## [2.0.0] — Arsitektur Modular, Deep Linking & Kesiapan Produksi
- Halaman baru `/aktivitas-saya`, `/tugas-saya`, `/alumni`, `/profil`, `/pengaturan/*`, `/audit-log`, dan `/status-sistem`.
- Endpoint `/api/health`, `/api/my-activity`, serta daftar `systemErrors`.
- Design System modular (`src/components/ui/`), router berparameter (`src/lib/routes.ts`), hook `useUnsavedChanges`, CORS multi-origin, `database/schema_mysql.sql`, `vercel.json`, dan skrip `create-release-zip.mjs`.

---

## [1.0.0] — Fondasi Awal SATU DPBI
- Implementasi server Express + SQLite WAL (`node:sqlite`), autentikasi sesi `HttpOnly`, RBAC + delegasi, 38 provinsi, Proposal, LKL, Laporan Koordinator, Tugas, Dokumen + PDF/ZIP bulk generator, Pengumuman, Kalender, Safeguarding, Evaluasi, Arsip Alumni 30 Hari, serta Backup/Restore ZIP SHA-256.
