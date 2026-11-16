# Dokumentasi API Backend — SATU DPBI

Semua endpoint API berada di bawah prefiks `/api/`. Permintaan pengubah status (`POST`, `PATCH`, `PUT`, `DELETE`) dilindungi validasi origin/header anti-CSRF (`requireSafeOrigin` — header `Origin` sesuai whitelist/host atau header `X-Requested-With: SATU-DPBI`).

---

## 1. Endpoint Publik & Kesehatan (Tanpa Autentikasi)

| Metode & Path | Fungsi | Catatan Privasi / Output |
| :--- | :--- | :--- |
| `GET /api/health` | Probe status layanan | Mengembalikan `ok`, `service`, `mode` (`PRODUKSI`/`DEMO_SIMULASI`), `timestamp` |
| `GET /api/public/overview` | Agregat beranda & 38 provinsi publik | Mengembalikan `cms`, `publicAnnouncements` (`is_public=1`), `publicStats` (disanitasi via `sanitizePublicStatsPayload`), `provinces` agregat tanpa PII, serta `demoAccounts` **hanya** saat `DEMO_MODE=true` |
| `GET /api/public/provinces/:code` | Detail publik 1 provinsi & kabupaten/kotanya | Mengembalikan metadata provinsi + daftar kabupaten/kota dengan `hasCoordinator` boolean (tanpa nama pribadi/kontak) |
| `GET /api/public/help` | Daftar artikel Pusat Bantuan terbit | Hanya artikel `is_published = 1` urut `sort_order` |
| `GET /api/public/files/:id` | Media publik aman (`province_logo`, `public_media`) | Hanya format gambar terverifikasi (`jpeg/png/webp`), cacheable, terisolasi dari berkas privat pelajar |
| `GET /api/locations/cascade` | Dropdown bertingkat wilayah Indonesia | Query: `?provinceCode=`, `?regencyCode=`, `?districtCode=` -> `{ regencies, districts, villages }` |

---

## 2. Autentikasi, Sesi & Profil Mandiri

| Metode & Path | Otorisasi | Fungsi |
| :--- | :--- | :--- |
| `POST /api/auth/bootstrap` | Publik (hanya jika `users = 0`) | Registrasi satu kali Super Admin pertama pada database produksi kosong |
| `POST /api/auth/login` | Publik (rate-limited `429`) | Verifikasi email & kata sandi `scrypt`, set cookie sesi `HttpOnly`, tolak akun tertunda/nonaktif/alumni kedaluwarsa |
| `POST /api/auth/demo-switch` | Publik (`DEMO_MODE=true`) | Berpindah akun simulasi secara cepat untuk pengujian peran |
| `POST /api/auth/logout` | `requireAuth` | Hapus sesi aktif dari DB dan bersihkan cookie |
| `GET /api/auth/session` | Opsional | Cek sesi aktif, batas waktu `idleMinutes`, dan alasan kedaluwarsa (`expired`/`idle`/`pending`/`inactive`) |
| `GET /api/auth/me` | `requireAuth` | Profil ringkas & izin efektif pengguna saat ini |
| `GET /api/auth/sessions` | `requireAuth` | Daftar perangkat & sesi aktif pengguna |
| `DELETE /api/auth/sessions/:id` | `requireAuth` | Cabut satu sesi perangkat milik sendiri |
| `POST /api/auth/sessions/revoke-all` | `requireAuth` | Keluar dari seluruh perangkat sekaligus |
| `POST /api/auth/change-password` | `requireAuth` | Ganti kata sandi, hapus sesi perangkat lain, dan rotasi ID sesi saat ini |
| `PATCH /api/auth/profile` | `requireAuth` | Perbarui nama tampilan & preferensi notifikasi pribadi |
| `GET /api/auth/login-history` | `requireAuth` | 20 riwayat login/logout/rotasi terakhir milik pengguna |
| `POST /api/auth/request-reset` | Publik | Terbitkan token reset sekali pakai berbatas 1 jam (`password_resets`) |
| `POST /api/auth/complete-reset` | Publik | Selesaikan reset kata sandi dengan token valid |
| `POST /api/auth/accept-invitation` | Publik | Aktivasi akun undangan baru dengan token berbatas waktu |

---

## 3. Berkas Privat, Dashboard & Pencarian Global

| Metode & Path | Otorisasi | Fungsi |
| :--- | :--- | :--- |
| `POST /api/files/upload` | `requireAuth` | Unggah berkas hingga 15 MB dengan inspeksi *magic bytes* (`PDF`, `JPEG`, `PNG`, `WebP`, `CSV`) & deduplikasi SHA-256 ke `storage/private/` |
| `GET /api/files/:id/preview` | `requireAuth` | Pratinjau `Content-Disposition: inline` dengan audit log |
| `GET /api/files/:id` | `requireAuth` | Unduh atau pratinjau (`?download=1` memaksa `attachment`) |
| `GET /api/dashboard` | `requireAuth` | Ringkasan KPI sesuai peran, `bidangScope` (Pengurus Nasional), `attentionItems`, grafik Recharts, aktivitas, dan agenda |
| `GET /api/search?q=` | `requireAuth` | Pencarian global lintas modul yang hasilnya difilter hak akses RBAC |
| `GET /api/timeline` | `requireAuth` | 30 entri linimasa aktivitas terbaru |
| `GET /api/my-activity` | `requireAuth` | Ringkasan pribadi proposal, LKL, tugas, aksi audit, dan notifikasi (`/aktivitas-saya`) |

---

## 4. Wilayah, Personalia, Organisasi & Angkatan

| Metode & Path | Otorisasi (`module:action`) | Fungsi |
| :--- | :--- | :--- |
| `GET /api/provinces` | `requireAuth` | Daftar 38 provinsi beserta jumlah Duta domisili, Duta penugasan, alumni, proposal, LKL, dan kab/kota |
| `PATCH /api/provinces/:code` | `wilayah:edit` | Pembaruan status provinsi, koordinator, catatan pembinaan, deskripsi, dan logo (Korwil terbatas provinsinya) |
| `GET /api/provinces/:code/regencies` | `wilayah:view` | Daftar kabupaten/kota per provinsi |
| `POST /api/regencies` | `wilayah:edit` | Tambah daerah pemekaran baru ke `regencies` + catat `region_history` |
| `PATCH /api/regencies/:code` | `wilayah:edit` | Ubah status, koordinator, nama, atau catatan pembinaan kabupaten/kota |
| `GET /api/regions/history` | `wilayah:view` | Riwayat perubahan provinsi & kabupaten/kota |
| `GET /api/handovers`, `POST /api/handovers` | `wilayah:view` / `edit` | Daftar dan pengajuan berita acara serah terima koordinator wilayah (`HND`) |
| `POST /api/handovers/:id/approve` | `organisasi:assign` | Pengesahan serah terima koordinator wilayah |
| `GET /api/location/logs`, `POST /api/location/verify` | `requireAuth` | Verifikasi koordinat browser *on-demand* terhadap *bounding box* provinsi atau mode daring |
| `POST /api/location/exceptions`, `.../decide` | `requireAuth` / `wilayah:manage` | Pengajuan & persetujuan pengecualian verifikasi lokasi |
| `GET /api/personnel` | `personalia:view` | Daftar personel (field sensitif disamarkan via `maskPersonnelRow` bagi non-berwenang) |
| `GET /api/personnel/check-duplicate` | `personalia:view` | Deteksi dini duplikasi email, NISN, atau nama identik sebelum simpan |
| `POST /api/personnel`, `PATCH /api/personnel/:id` | `personalia:create` / `edit` | Tambah & ubah profil personel (`PERS`) |
| `GET /api/personnel/:id/history` | `personalia:view` | Riwayat proposal, LKL, dan evaluasi per personel |
| `POST /api/personnel/:id/verify` | `personalia:review` | Verifikasi berkas identitas personel (`terverifikasi`, `perlu_perbaikan`, `tidak_valid`) |
| `POST /api/personnel/import` | `personalia:create` | Impor CSV massal transaksional dengan laporan baris duplikat/terlewati |
| `GET/POST /api/account-requests`, `.../decide` | `personalia:view`/`create`/`review` | Usulan akun Duta oleh Korwil & penerbitan token undangan oleh Nasional (`AKUN`) |
| `GET /api/organization`, `POST .../positions` | `organisasi:view` / `edit` | Struktur jabatan pengurus 6 Bidang & SK |
| `POST /api/organization/delegations`, `.../revoke` | `organisasi:assign` | Buat & cabut delegasi wewenang berbatas waktu |
| `GET/POST/PATCH /api/batches` | `angkatan:view`/`create`/`edit` | Manajemen angkatan historis & aktif |

---

## 5. Proposal, LKL, Tugas, Dokumen, Pengumuman & CMS

| Metode & Path | Otorisasi (`module:action`) | Fungsi |
| :--- | :--- | :--- |
| `GET /api/proposals` | `proposal:view` | Daftar proposal + `matrixRules` + `activeBidang`; mendukung `?bidangOnly=1` untuk Pengurus Nasional |
| `GET /api/proposals/:id/versions` | `proposal:view` | Riwayat versi PDF proposal |
| `POST /api/proposals`, `PATCH /api/proposals/:id` | `proposal:create` / `edit` | Simpan draft / ajukan proposal + hitung `resolveProposalApprover` |
| `POST /api/proposals/:id/decide`, `.../revise` | `proposal:review` / `edit` | Keputusan (setujui/revisi/tolak) dan unggah revisi versi berikutnya |
| `GET /api/lkl`, `POST /api/lkl`, `POST /api/lkl/:id/review` | `lkl:view`/`create`/`review` | Pelaporan kegiatan Daring/Luring + lampiran foto/PDF + verifikasi Korwil |
| `GET/POST /api/coordinator-reports`, `.../review` | `laporan_koordinator:view`/`create`/`review` | Laporan bulanan (tenggat tgl 5) & akhir angkatan Korwil (`LKW`) |
| `GET/POST/PATCH /api/tasks`, `POST /api/tasks/bulk-assign` | `tugas:view`/`create`/`edit`/`assign` | Manajemen tugas, lampiran berkas, komentar (`/api/tasks/:id/comments`), & distribusi massal |
| `GET/POST /api/documents`, `POST /api/documents/bulk-generate` | `dokumen:view`/`create`/`publish` | Pustaka dokumen/SOP & generator sertifikat/surat massal PDF dalam arsip ZIP |
| `GET/POST/PATCH /api/announcements` | `requireAuth` / `pengumuman:create` / `edit` | Pengumuman tersegmentasi + toggle publik (`isPublic`) |
| `GET/POST /api/calendar` | `requireAuth` / `kalender:create` | Agenda dan tenggat organisasi |
| `GET /api/notifications`, `POST .../read`, `.../read-all` | `requireAuth` | Notifikasi pribadi dengan rute target |
| `GET/POST /api/saved-views` | `requireAuth` | Tampilan filter tersimpan per pengguna |
| `GET /api/safeguarding`, `POST .../risks\|consents\|incidents\|whistleblowing` | `perlindungan:view`/`create` (`whistleblowing`: `requireAuth`) | Penilaian risiko U18, persetujuan terpisah, laporan insiden, & pengaduan rahasia |
| `GET/POST /api/evaluations` | `evaluasi:view`/`create` | Penilaian kinerja terbobot otomatis (`30/25/25/20`) |
| `GET /api/archive`, `GET /api/archive/export-personal`, `POST /api/archive/alumni/:userId/extend` | `arsip:view`/`download`/`manage` | Arsip angkatan, ekspor JSON pribadi, & perpanjangan jendela alumni 30 hari |
| `GET /api/system/overview`, `POST /api/system/backup*`, `.../automation*` | `sistem:view`/`manage`/`restore`/`configure` | Kontrol storage, backup ZIP + validasi/restore SHA-256, otomasi, audit log, & `systemErrors` |
| `GET/POST /api/settings/users`, `PATCH .../status` | `pengaturan:manage` | Manajemen akun & peran pengguna (cabut sesi otomatis saat status/peran diubah) |
| `GET /api/settings/config`, `PATCH /api/system/settings` | `requireAuth` / `sistem:configure` | Baca konfigurasi & simpan kebijakan sistem (kecuali lock Kemendikdasmen) |
| `GET /api/export/bundle?scope=proposals\|lkl\|personnel` | `arsip:export` | Ekspor CSV teraudit |
| `GET /api/cms`, `PUT /api/cms/:key`, `POST/PATCH/DELETE /api/help-articles` | `requireCmsEditor` | Pengelolaan CMS portal publik & Pusat Bantuan |
