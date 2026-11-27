# MASTER IMPLEMENTATION PLAN — TRANSFORMASI TOTAL SATU DPBI (v4.1.0)

**Proyek:** SATU DPBI — Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia  
**Identitas Gerakan:** *Berbudaya, Bergerak, dan Berdampak Untuk Negeri.*  
**Slogan Sistem:** *Satu Sistem, Satu Data, Satu Koordinasi.*  
**Baseline Audit:** Versi codebase awal (`package.json` `0.0.0` / baseline skema v3.0) → Target **v4.1.0**  

---

## 1. Ringkasan Eksekutif Audit Baseline
Platform SATU DPBI sudah memiliki fondasi kuat: Express + SQLite `node:sqlite` (`WAL` mode), autentikasi sesi `scrypt` + cookie `HttpOnly`, proteksi Origin/CSRF, RBAC + delegasi sementara berbasis provinsi, GeoJSON 38 Provinsi & Kabupaten/Kota, enkripsi penyimpanan berkas SHA-256, Approval Center awal, dan Email Center dasar (4 templat).

Namun audit kode sumber terhadap 27 kebutuhan transformasi menemukan celah struktural berikut:
1. **Personel, Akun, Jabatan & Undangan Masih Tumpang Tindih:** `POST /api/settings/users` dan `accept-invitation` membuat baris `personnel` baru tanpa opsi menautkan personel yang sudah ada; tabel `invitations` belum memiliki siklus penuh (`draft → menunggu_persetujuan → siap_diundang → undangan_terkirim → aktivasi_dibuka → aktif`, pembatalan, dan invalidasi token lama saat kirim ulang); belum ada `org_position_history`, `import_batches` (rollback/laporan validasi CSV), atau audit log akses/ekspor PII rinci.
2. **Struktur Organisasi Belum Hierarkis & Handover Belum Menyeluruh:** Halaman Organisasi baru menampilkan daftar datar + 6 Bidang tanpa bagan hierarki (Pembina s.d. Alumni), pemisahan tegas Role Sistem vs Jabatan Organisasi, slot kosong, atau cetak bagan A4. Handover hanya memperbarui `provinces.coordinator_name` tanpa paket tugas/proposal/laporan/dokumen/inventaris atau penutupan jabatan lama & rotasi sesi pejabat lama.
3. **Approval Workflow Belum Menyimpan Riwayat Permanen & Pusat Revisi:** Belum ada tabel `approval_history` permanen, SLA countdown/eskalasi, penugasan ulang peninjau beralasan, atau tab **Pusat Revisi Terpusat** di `ApprovalCenterPage` dan `ProposalsPage`.
4. **Program Flagship & Persuratan Digital Belum Ada:** Belum ada modul/tabel untuk **Behind The Culture**, **Sedapnya Warisanku**, dan **Budaya Masuk Sekolah**, serta belum ada modul **Persuratan Masuk/Keluar & Disposisi**.
5. **Email Center Baru Memiliki 4 dari 18 Templat Resmi:** Variabel `{{role}}`, `{{nomor_surat}}`, `{{tenggat}}`, `{{tautan}}` dan isi HTML (`body_html`) + riwayat perubahan templat + impor penerima CSV belum tersedia.
6. **Ketahanan Sistem, Backup WAL & Versioning Belum Lengkap:** `package.json` masih `0.0.0`, belum ada `/api/system/version`, belum ada Mode Pemeliharaan dengan penguncian operasi tulis, dan `POST /api/system/backup` masih menyalin file `.db` mentah saat `WAL` aktif alih-alih menggunakan `VACUUM INTO` yang aman terhadap frame `-wal`.

---

## 2. Arsitektur Migrasi Database (Non-Destruktif & Bernomor)
Seluruh perubahan skema dijalankan secara sekuensial melalui `schema_migrations` di `/server/db.ts` (dan disinkronkan ke `/database/schema_mysql.sql`) tanpa menghapus atau menimpa data pengguna yang sudah ada:

- **Migrasi 4 — Siklus Personel, Undangan & Impor Batch:**
  - Tabel baru `org_position_history` (riwayat jabatan, unit, bidang, provinsi, SK, periode mulai/selesai, alasan).
  - Tabel baru `import_batches` (rekap impor CSV, jumlah valid/duplikat/gagal, laporan JSON, status dapat dibatalkan).
  - Kolom baru di `invitations`: `status`, `personnel_id`, `resend_count`, `last_sent_at`, `opened_at`, `cancelled_at`, `cancelled_by`, `cancel_reason`, `batch_id`.
  - Kolom baru di `personnel`: `import_batch_id`.
- **Migrasi 5 — Struktur Organisasi Hierarkis & Program Flagship:**
  - Kolom baru di `organization_positions`: `parent_id`, `role_category`, `province_code`, `is_system_role`, `sort_order`.
  - Tabel baru `flagship_programs` (`Behind The Culture`, `Sedapnya Warisanku`, `Budaya Masuk Sekolah`) beserta target peserta, target wilayah, PIC nasional, periode, KPI JSON, dan status.
  - Kolom `program_id` pada `proposals`, `lkl_reports`, `tasks`, `evaluations`.
- **Migrasi 6 — Unified Approval History, SLA & Pusat Revisi:**
  - Tabel baru `approval_history` (entity_type, entity_id, step_name, from_status, to_status, actor_id, actor_name, actor_role, action_type, note, diff_summary, assigned_to_id, sla_due_at, created_at).
  - Kolom SLA & eskalasi pada `proposals` (`current_stage`, `revision_deadline`, `sla_due_at`, `escalated_at`, `reassigned_reason`).
- **Migrasi 7 — Email Center 18 Templat, HTML & Audit Edit:**
  - Kolom baru di `email_templates`: `body_html`, `updated_by`, `version`, `audit_note`.
  - Tabel baru `email_template_history` (riwayat perubahan templat oleh admin).
- **Migrasi 8 — Persuratan Digital (Persuratan & Disposisi) & Repositori Dokumen Lanjutan:**
  - Tabel baru `correspondence` (surat masuk/keluar, nomor surat atomik, pengirim/penerima, perihal, kategori, klasifikasi kerahasiaan, tanggal surat, status tindak lanjut, lampiran).
  - Tabel baru `correspondence_dispositions` (disposisi dari pimpinan/sekretariat ke bidang/wilayah, tenggat, instruksi, status selesai).
  - Kolom baru di `documents`: `parent_document_id`, `replaced_by_id`, `is_latest_version`, `tags`.
- **Migrasi 9 — Handover Paket Lengkap, Tugas & Ketergantungan, Evaluasi Multi-Pihak & Bukti Lapangan:**
  - Kolom baru di `handovers`: `outgoing_user_id`, `incoming_user_id`, `checklist_json`, `pending_reports_count`, `active_docs_count`, `inventory_notes`, `access_transfer_confirmed`.
  - Kolom baru di `tasks`: `depends_on_task_id`, `estimated_hours`.
  - Kolom baru di `evaluations`: `evaluator_type` (`duta` | `panitia` | `peserta` | `sekolah` | `komunitas` | `mitra`), `event_id`.
  - Kolom baru di `location_verifications`: `reported_location_text`, `verification_proof_status`, `captured_via`.
- **Migrasi 10 — Indeks Pencarian, Versioning & Mode Pemeliharaan:**
  - Indeks komposit untuk query proposal, LKL, personel, surat, dan audit log; pengaturan awal `maintenance_mode` dan `maintenance_message` di `system_settings`.

---

## 3. Status Pelaksanaan Seluruh Fase (v4.1.0 — SELESAI)

| Fase | Ruang Lingkup Utama | Modul Terkait | Status |
|---|---|---|---|
| **Fase 0** | Audit repositori, database, RBAC, halaman, API & matriks kesenjangan | `/docs/MASTER-IMPLEMENTATION-PLAN.md`, `/docs/FEATURE-IMPLEMENTATION-MATRIX.md` | **Selesai** |
| **Fase 1** | Migrasi 4–10, `schema_mysql.sql`, Semantic Versioning `4.1.0`, `/api/system/version`, Mode Pemeliharaan write-lock, backup SQLite `VACUUM INTO` + restore aman, masking & audit PII | `server/db.ts`, `server.ts`, `server/security.ts`, `database/schema_mysql.sql`, `package.json`, `src/lib/rbac.ts`, `src/lib/types.ts` | **Selesai** |
| **Fase 2** | Direktori personel terpadu, 3 mode pembuatan akun (tautkan personel / buat keduanya / operasional), impor CSV berpeta kolom + preview + rollback batch, siklus penuh undangan & `org_position_history` | `server/routes.ts`, `server/routes_modules.ts`, `src/pages/PersonnelPage.tsx`, `src/pages/SystemAndSettingsPages.tsx` | **Selesai** |
| **Fase 3** | Bagan organisasi hierarkis dinamis + posisi kosong + A4 cetak + publik aman; Approval History + SLA + anti-self-approval + **Pusat Revisi Terpusat**; Handover paket penuh + rotasi sesi | `server/workflow.ts`, `server/routes_workflow_email.ts`, `src/pages/OrganizationAndBatchesPages.tsx`, `src/pages/ApprovalCenterPage.tsx`, `src/pages/ProposalsPage.tsx`, `src/pages/RegionsPage.tsx` | **Selesai** |
| **Fase 4** | **Flagship Program Command Center** (`Behind The Culture`, `Sedapnya Warisanku`, `Budaya Masuk Sekolah`), keterkaitan siklus penuh Program→Arsip, Tugas (ketergantungan `409` + Tugas Saya), Evaluasi 6 tipe penilai & analitik tren | `server/seed.ts`, `server/routes_programs_correspondence.ts`, `src/pages/ProgramsAndCorrespondencePages.tsx`, `src/pages/TasksAndDocsPages.tsx`, `src/pages/SafetyEvalArchivePages.tsx` | **Selesai** |
| **Fase 5** | **18 Templat Email Resmi DPBI** + HTML/Text preview + riwayat edit + impor penerima CSV; **Persuratan Digital & Disposisi**; Repositori Dokumen dengan penanda versi usang (`replaced_by_id`) | `server/email.ts`, `src/pages/EmailCenterPage.tsx`, `src/pages/ProgramsAndCorrespondencePages.tsx`, `src/pages/TasksAndDocsPages.tsx` | **Selesai** |
| **Fase 6 & 7** | Data Quality Center lengkap (7 aturan pemeriksaan), Draft & Antrean Unggah Lapangan (`offlineDraft.ts`, `LocationVerifyModal.tsx`), Showcase Program & Struktur Publik di Website Publik, konsistensi Light/Dark & responsivitas `390px–1440px` | `src/lib/offlineDraft.ts`, `src/components/LocationVerifyModal.tsx`, `src/pages/PublicPortalPage.tsx`, `src/pages/PublicAboutPage.md`, `src/components/AppShell.tsx` | **Selesai** |
| **Fase 8** | Pengujian unit + keamanan + API (`26/26` lulus), `tsc --noEmit` (`0` galat), `vite build` + `esbuild`, `bun audit` (`0` kerentanan), verifikasi browser Playwright (`1440x900` Light/Dark, `768x1024`, `390x844`), pembaruan panduan lengkap 7 peran, changelog, laporan pengujian & arsip ZIP rilis | `src/lib/domain.test.ts`, `server/api.security.test.ts`, `docs/USER-GUIDE-COMPLETE.md`, `docs/RELEASE-NOTES.md`, `CHANGELOG.md`, `LAPORAN_PENGUJIAN.md`, `walkthrough.md` | **Selesai** |

