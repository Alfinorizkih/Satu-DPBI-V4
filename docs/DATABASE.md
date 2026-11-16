# Struktur Basis Data — SATU DPBI

SATU DPBI menggunakan dua skema yang saling selaras:
1. **Runtime Bawaan (SQLite Mode WAL)**: Didefinisikan di `server/db.ts` via modul bawaan Node.js `node:sqlite` (`data/satu_dpbi_demo.db` untuk simulasi dan `data/satu_dpbi_prod.db` untuk produksi).
2. **Skema Produksi Relasional MySQL/MariaDB**: Didefinisikan di `database/schema_mysql.sql` (`InnoDB`, `utf8mb4_unicode_ci`) untuk impor langsung ke phpMyAdmin / MySQL Server.

> Seluruh migrasi kolom tambahan pada `server/db.ts` (seperti `avatar_file_id`, `assignment_province_code`, `regency_code`, `notification_prefs_json`, `logo_file_id`, `description`, `attachment_file_id`, `attachment_file_name`, dan `is_public`) dijalankan secara **idempoten** tanpa menimpa data yang sudah tersimpan.

---

## Ringkasan Kelompok Tabel

### A. Autentikasi, Sesi & Penomoran Atomik
| Nama Tabel | Fungsi Utama | Kolom Kunci & Catatan |
| :--- | :--- | :--- |
| `users` | Akun pengguna terdaftar | `id`, `email` (unik), `password_hash` (`scrypt`), `role`, `bidang`, `province_code`, `batch_id`, `personnel_id`, `account_status`, `alumni_access_expires_at`, `notification_prefs_json`, `is_demo` |
| `sessions` | Manajemen sesi aktif per perangkat | `id`, `user_id` (FK CASCADE), `token_hash` (unik SHA-256), `device_label`, `ip_address`, `expires_at`, `last_seen_at` |
| `invitations` | Token undangan aktivasi akun baru | `email`, `role`, `province_code`, `batch_id`, `token_hash` (unik), `expires_at`, `used_at` |
| `password_resets` | Token reset kata sandi sekali pakai | `user_id`, `token_hash` (unik), `expires_at`, `used_at` |
| `reference_sequences` | Pencacah nomor surat/referensi tahunan atomik | PK majemuk `(category, year)`, `last_seq` |

### B. Wilayah Administratif & Organisasi
| Nama Tabel | Fungsi Utama | Kolom Kunci & Catatan |
| :--- | :--- | :--- |
| `provinces` | Data induk 38 provinsi Indonesia | `code` (PK), `name`, `island`, `status`, `coordinator_id`, `coordinator_name`, `coaching_note`, `logo_file_id`, `description`, `min_lat`..`center_lng` |
| `regencies` | Data ~514+ kabupaten/kota | `code` (PK), `province_code` (index), `name`, `kind` (`kabupaten`/`kota`), `status`, `coordinator_name`, `coaching_note` |
| `districts` | Data kecamatan untuk formulir wilayah bertingkat | `code` (PK), `regency_code` (index), `name` |
| `villages` | Data kelurahan/desa | `code` (PK), `district_code` (index), `name` |
| `region_history` | Jejak pembaruan & pemekaran wilayah | `region_type`, `region_code`, `action`, `summary`, `actor_name` |
| `batches` | Siklus angkatan (tidak menimpa data lama) | `id`, `batch_number` (unik), `name`, `opened_at`..`term_ends_at`, `duration_months`, `status` |
| `organization_positions` | Jabatan pengurus 6 Bidang & pengawas | `title`, `bidang`, `level`, `holder_personnel_id`, `holder_name`, `sk_number`, `status` |
| `delegations` | Pendelegasian wewenang berbatas waktu | `delegate_user_id`, `grantor_user_id`, `module`, `action`, `province_code`, `starts_at`, `ends_at`, `status` |
| `handovers` | Berita acara serah terima koordinator wilayah | `reference_number` (`HND`), `province_code`, `outgoing_coordinator_name`, `incoming_coordinator_name`, `active_tasks_count`, `open_proposals_count`, `status` |

### C. Personalia & Alur Operasional
| Nama Tabel | Fungsi Utama | Kolom Kunci & Catatan |
| :--- | :--- | :--- |
| `personnel` | Direktori data induk Duta & Pengelola | `member_number` (unik), `reference_number` (`PERS`), `province_code` (domisili), `assignment_province_code` (penugasan), `regency_code`, `school_name`, `nisn`, `guardian_*`, `docs_checklist_json`, `avatar_file_id`, `verification_status` |
| `account_requests` | Pengajuan akun Duta oleh Korwil | `reference_number` (`AKUN`), `province_code`, `school_name`, `supporting_file_id`, `status`, `decided_by` |
| `approval_matrix_rules` | Aturan rute persetujuan proposal | `bidang`, `category`, `risk_level`, `uses_dpbi_identity`, `external_permit_needed`, `approver_role` |
| `proposals` | Pengajuan proposal kegiatan + status | `reference_number` (`PROP`), `version`, `bidang`, `category`, `risk_level`, `assigned_approver_role`, `pdf_file_id`, `status` |
| `proposal_versions` | Riwayat versi revisi dokumen proposal | `proposal_id`, `version`, `pdf_file_id`, `change_note`, `uploaded_by` |
| `lkl_reports` | Laporan Kegiatan Lapangan | `reference_number` (`LKL`), `proposal_id`, `activity_mode` (`luring`/`daring`), `venue_*`, `platform_*`, `pdf_file_id`, `photo_file_ids_json`, `status` |
| `coordinator_reports` | Laporan bulanan & akhir koordinator | `reference_number` (`LKW`), `report_type` (`bulanan`/`akhir`), `province_code`, `period_label`, `lkl_recap_count`, `status` |
| `tasks` | Penugasan operasional & lampiran | `reference_number` (`TGS`), `priority`, `status`, `deadline`, `assignee_id`, `checklist_json`, `attachment_file_id`, `attachment_file_name` |
| `task_comments` | Diskusi per tugas | `task_id`, `author_id`, `body` |

### D. Dokumen, Komunikasi, CMS & Perlindungan
| Nama Tabel | Fungsi Utama | Kolom Kunci & Catatan |
| :--- | :--- | :--- |
| `documents` | Arsip SK, SOP, Sertifikat, Surat Tugas | `document_number` (`DOC`), `category`, `version`, `access_level`, `file_id`, `expires_at` |
| `announcements` | Pengumuman tersegmentasi & publik | `scope`, `province_code`, `batch_id`, `priority`, `status`, `is_public` |
| `calendar_events` | Agenda & tenggat organisasi | `category`, `start_at`, `end_at`, `province_code`, `related_ref` |
| `notifications` | Notifikasi pribadi per pengguna | `user_id`, `title`, `category`, `target_path`, `is_read` |
| `saved_views` | Filter pencarian tersimpan milik pengguna | `user_id`, `module`, `name`, `filter_json` |
| `risk_assessments` | Penilaian risiko & rasio pendamping U18 | `proposal_id`, `participant_under_18`, `adult_chaperone_count`, `emergency_plan`, `risk_level`, `status` |
| `consent_records` | Persetujuan terpisah (partisipasi, wali, foto, publikasi) | `personnel_id`, `consent_participation`, `consent_guardian`, `consent_documentation`, `consent_publication` |
| `incidents` | Laporan insiden lapangan tereskalasi | `reference_number` (`INS`), `province_code`, `urgency`, `escalated_to`, `reported_by_user_id` |
| `whistleblowing_reports` | Kanal pengaduan rahasia & *conflict rerouting* | `reference_number` (`ADU`), `reporter_mode`, `assigned_handler_role`, `conflict_rerouted`, `status` |
| `evaluations` | Skor evaluasi kinerja terbobot | `task_completion_score`, `report_timeliness_score`, `report_quality_score`, `coordination_score`, `total_score` |
| `location_verifications` | Riwayat cek koordinat *on-demand* | `user_id`, `province_code`, `latitude`, `longitude`, `matched`, `verification_mode` |
| `location_exceptions` | Pengecualian lokasi sementara | `user_id`, `province_code`, `valid_until`, `status`, `decided_by` |
| `cms_contents` | Konten teks portal publik (`hero_subtitle`, `about_dpbi`, dll.) | `key` (PK), `title`, `body`, `updated_by`, `updated_at` |
| `help_articles` | Artikel Pusat Bantuan `/bantuan` | `slug` (unik), `category`, `role_target`, `sort_order`, `is_published` |

### E. Penyimpanan, Backup & Tata Kelola Sistem
| Nama Tabel | Fungsi Utama | Kolom Kunci & Catatan |
| :--- | :--- | :--- |
| `stored_files` | Metadata berkas fisik di `storage/private/` | `stored_name`, `mime_type`, `size_bytes`, `checksum_sha256` (deduplikasi), `module`, `is_archived` |
| `backups` | Katalog arsip backup ZIP tervalidasi | `backup_name`, `size_bytes`, `checksum_sha256`, `status` |
| `automation_jobs` | Penjadwal & pemicu manual sistem | `job_key` (unik), `schedule_label`, `enabled`, `last_run_at`, `last_status` |
| `audit_logs` | Log audit keamanan *append-only* | `actor_user_id`, `actor_role`, `action`, `target_type`, `target_id`, `outcome` |
| `activity_timeline` | Linimasa aktivitas operasional | `category`, `title`, `province_code`, `batch_id`, `related_path` |
| `system_settings` | Konfigurasi kebijakan & ambang batas | `key` (PK), `value`, `updated_at` |
| `system_errors` | Pencatatan error internal bernomor referensi | `reference_code` (unik `ERR-...`), `http_status`, `route`, `error_message` |
