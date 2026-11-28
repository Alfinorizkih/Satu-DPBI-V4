# Catatan Perubahan (Changelog) — SATU DPBI

Seluruh perubahan besar pada arsitektur, antarmuka, keamanan, pemetaan wilayah, serta kesiapan produksi dicatat secara berurutan pada dokumen ini.

---

## [4.2.0] — Addendum Zero-Confusion UX, Penguatan Operasional & Integrasi Identitas Resmi

### Pengalaman Pengguna Zero-Confusion & Keandalan Sistem
- **Beranda Saya Berbasis Peran (`/beranda`)**: Ruang kerja pribadi yang menyesuaikan sapaan, jabatan, wilayah, pintasan aksi utama, tugas aktif, revisi tertunda, persetujuan menunggu, tenggat terdekat, jadwal kegiatan, dan aktivitas terbaru secara spesifik untuk setiap peran (dengan pengalihan otomatis pasca-login sesuai preferensi `startPage`).
- **Panduan Bertahap & Process Tracker (`ProcessTracker.tsx`, `ProposalsPage.tsx`, `LklPage.tsx`)**: Stepper 4 tahap, indikator kelengkapan syarat, contoh pengisian, penyimpanan *draft* otomatis & pemulihan (*draft recovery*), ringkasan pra-kirim, konfirmasi aksi berisiko, serta pelacak proses berlini masa lengkap (status saat ini, tahap sebelumnya, pemeriksa aktif, tindak lanjut, catatan, tenggat, dan tahap berikutnya).
- **Pusat Bantuan Kontekstual, Tur Peran & Pusat Kendala (`/bantuan`, `/kendala`)**: Drawer bantuan kontekstual per halaman (pintasan `?`), tur interaktif per peran, FAQ & glosarium organisasi, serta modul tiket kendala `/kendala` dengan pelacakan status dan referensi galat.
- **Tampilan & Preferensi (`/pengaturan` tab `Tampilan`)**: Pengaturan halaman awal (`startPage`), skala tampilan (`ringkas` / `nyaman` / `besar`), pintasan favorit tervalidasi, preferensi notifikasi, serta status penyelesaian tur.
- **Integrasi Identitas Brand Resmi DPBI**: Penyematan aset logo resmi pada favicon/ikon aplikasi (`icon-app-sd`), logo utama portal (`icon-utama`), dan lambang atribusi *Didukung & Dikelola Oleh DPBI* (`logotp`) di header, halaman masuk, sidebar, serta footer hak cipta.

### Penguatan Modul Inti & Integritas Operasional
- **Pusat Email 50 Templat Resmi, 20 Variabel & Antrean Batch**: Ekspansi 50 templat resmi DPBI lintas kategori, toggle aktif/nonaktif templat, lampiran berkas (`email_attachments` dengan pemblokiran ekstensi eksekusi), 20 variabel ter-whitelist dengan proteksi *HTML-escape* anti-XSS, parser CSV RFC-4180 (`src/lib/csvParser.ts`) yang mendukung pemisah `,`/`;`/tab dan laporan galat bebas formula, serta antrean pengiriman bertahap (`email_queue`) lengkap dengan jeda (*pause*), lanjut (*resume*), proses batch, dan pembatalan.
- **Siklus Personel, Impor & Pendaftaran Duta 2 Jalur**: Pengarsipan/pemulihan/hapus aman personel (menjaga akun aktif & `super_admin` terakhir via `HTTP 409`), pembatasan ketat peran dari impor CSV (`HTTP 403`), serta alur pengajuan Duta 2 jalur dengan status `perlu_revisi`, pengiriman ulang (`resubmit`), dan kebijakan `duta_auto_approve`.
- **Idempotency & Concurrency Guard**: Perlindungan *double submission* (`X-Idempotency-Key` pada `idempotency_keys`) serta *optimistic concurrency* (`version` guard `HTTP 409`) pada pembaruan tugas.
- **Kesehatan Sistem & Telemetri Operasional (`/status-sistem`)**: Ringkasan latensi SQLite WAL, kapasitas penyimpanan, metrik antrean email, jumlah tiket kendala terbuka, statistik permintaan API, serta log galat `5xx`.

---

## [4.1.0] — Transformasi Total Tata Kelola, Program Unggulan, Persuratan Digital & Ketahanan Sistem

### Arsitektur Data, Keamanan & Ketahanan Operasional
- **Migrasi Skema Non-Destruktif (Migrasi 4–10)**: Penambahan tabel `org_position_history`, `import_batches`, `flagship_programs`, `approval_history`, `email_template_history`, `correspondence`, `correspondence_dispositions`, serta penyelarasan `/database/schema_mysql.sql`.
- **Versioning & Mode Pemeliharaan**: Semantic Versioning `4.1.0` di `package.json`, endpoint `/api/system/version`, spanduk global **Mode Baca-Saja**, serta middleware `requireNotInMaintenance` (`HTTP 503`) untuk operasi tulis non-Super Admin.
- **Backup WAL-Safe & Transaksi Atomik**: Backup SQLite menggunakan `VACUUM INTO` agar konsisten saat WAL aktif, pembersihan `-wal`/`-shm` saat pemulihan, dan konversi `nextReferenceNumber()` menggunakan `SAVEPOINT` SQLite agar aman di dalam transaksi majemuk.

### Manajemen Personel, Organisasi, Approval & Handover
- **Pemisahan Bersih Personel vs Akun vs Jabatan**: 3 mode pembuatan akun di `/pengaturan/pengguna` (`create_both`, `link_existing` dengan proteksi ganda `409`, `operational_only`), impor CSV berpeta kolom dengan deteksi duplikasi & *rollback* batch, serta siklus penuh undangan 6 tahap + cooldown 60 detik.
- **Bagan Organisasi Hierarkis & Handover Paket Lengkap**: Struktur organisasi hierarkis dinamis (Pembina s.d. Alumni), posisi kosong, riwayat jabatan, cetak A4, ringkasan publik bebas-PII, serta serah terima Koordinator Wilayah dengan paket tugas/laporan/inventaris dan pencabutan sesi pejabat lama otomatis.
- **Approval Engine Permanen & Pusat Revisi**: Riwayat `approval_history`, penanda SLA & eskalasi, blokir *self-approval* (`HTTP 403`), penugasan ulang beralasan, dan tab **Pusat Revisi Terpusat**.

### Modul Baru & Ekspansi Fungsional
- **Flagship Program Command Center (`/program`, `/program/:slug`)**: Pelacakan menyeluruh *Behind The Culture*, *Sedapnya Warisanku*, dan *Budaya Masuk Sekolah* terhubung ke Proposal, LKL, Tugas, Dokumen, Persuratan, dan Evaluasi (termasuk tampilan publik bebas-PII).
- **Persuratan Digital & Disposisi (`/persuratan`)**: Agenda Surat Masuk/Keluar dengan penomoran atomik `DPBI/SURAT/...` dan disposisi bertenggat.
- **Pusat Email 18 Templat Resmi & Repositori Versi**: 18 templat resmi DPBI, editor & pratinjau HTML/Teks, 11 variabel aman, riwayat edit templat, impor penerima CSV, serta penandaan versi dokumen usang (`replaced_by_id`).
- **Tugas Ketergantungan, Evaluasi 6 Pihak & Kualitas Data**: Kunci ketergantungan tugas (`409`), 6 tipe penilai (`duta`, `panitia`, `peserta`, `sekolah`, `komunitas`, `mitra`), 7 pemeriksaan Data Quality Center, dan draft lapangan terisolasi per akun (`offlineDraft.ts`).

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
