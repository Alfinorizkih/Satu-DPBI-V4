# Struktur Basis Data — SATU DPBI

Basis data **SATU DPBI** dirancang dalam dua representasi yang sinkron:
1. **SQLite (`node:sqlite` WAL + Foreign Keys)**: Digunakan langsung oleh `server/db.ts` untuk pengembangan lokal, staging, maupun server Node.js mandiri (`data/satu_dpbi_demo.db` atau `data/satu_dpbi_prod.db`).
2. **MySQL / MariaDB InnoDB (`database/schema_mysql.sql`)**: Skema relasional `utf8mb4_unicode_ci` siap impor ke phpMyAdmin / cPanel / VPS untuk lingkungan produksi berbasis MySQL.

Total terdapat **38 tabel** yang terbagi ke dalam 7 domain utama:

---

## 1. Autentikasi, Sesi & Penomoran

| Tabel | Deskripsi | Kolom Kunci |
|---|---|---|
| `users` | Akun pengguna, peran RBAC, status akun, preferensi notifikasi (`notification_prefs_json`), dan tanggal kedaluwarsa akses alumni. | `id` (PK), `email` (UNIQUE), `role`, `account_status` |
| `sessions` | Sesi aktif per perangkat; menyimpan hash SHA-256 token dan waktu terakhir aktif untuk pemeriksaan *idle timeout*. | `id` (PK), `user_id` (FK), `token_hash` (UNIQUE), `expires_at`, `last_seen_at` |
| `invitations` | Undangan aktivasi akun baru berbasis token sekali pakai. | `id` (PK), `token_hash` (UNIQUE), `expires_at`, `used_at` |
| `password_resets` | Token reset kata sandi sekali pakai berbatas waktu. | `id` (PK), `user_id` (FK), `token_hash` (UNIQUE), `used_at` |
| `reference_sequences` | Penghitung sekuens nomor surat/dokumen resmi (`DPBI/PROP/TAHUN/XXXX`, dsb.). | `(category, year)` (PK), `last_seq` |

---

## 2. Wilayah, Angkatan, Organisasi & Personalia

| Tabel | Deskripsi | Kolom Kunci |
|---|---|---|
| `provinces` | Data resmi **38 provinsi Indonesia** termasuk batas koordinat (`min_lat`, `max_lat`, `min_lng`, `max_lng`, titik tengah) & koordinator aktif. | `code` (PK) |
| `batches` | Siklus angkatan (pembukaan, pembekalan, masa tugas mulai–selesai, status) agar data lama tidak tertimpa. | `id` (PK), `batch_number` (UNIQUE) |
| `personnel` | Profil lengkap Duta & pengurus (identitas, alamat administratif, pendidikan/sekolah, jabatan, dokumen, foto profil `avatar_file_id`, skor kelengkapan). | `id` (PK), `member_number` (UNIQUE), `province_code`, `batch_id` |
| `account_requests` | Permintaan akun atau perubahan data personel dari lapangan. | `id` (PK), `province_code`, `status` |
| `organization_positions` | Struktur jabatan struktural nasional dan wilayah. | `id` (PK), `role_code`, `holder_personnel_id` |
| `delegations` | Delegasi kewenangan sementara antar pejabat lengkap dengan modul, aksi, dan rentang tanggal aktif. | `id` (PK), `delegate_user_id`, `starts_at`, `ends_at`, `status` |
| `handovers` | Catatan serah terima jabatan antar angkatan/pejabat. | `id` (PK), `batch_id`, `status` |

---

## 3. Operasional Proposal, LKL & Laporan Koordinator

| Tabel | Deskripsi | Kolom Kunci |
|---|---|---|
| `approval_matrix_rules` | Aturan perutean otomatis penyetuju proposal berdasarkan kategori, risiko, identitas DPBI, dan izin eksternal. | `id` (PK), `approver_role` |
| `proposals` | Pengajuan proposal kegiatan beserta status, tingkat risiko, lampiran PDF, dan riwayat keputusan. | `id` (PK), `reference_number` (UNIQUE), `province_code`, `status` |
| `proposal_versions` | Arsip revisi isi proposal setiap kali diajukan ulang. | `id` (PK), `proposal_id` (FK), `version` |
| `lkl_reports` | Laporan Kegiatan Lapangan lengkap dengan lampiran PDF, foto dokumentasi, koordinat GPS, dan catatan peninjau. | `id` (PK), `reference_number` (UNIQUE), `proposal_id`, `status` |
| `coordinator_reports` | Laporan bulanan dan laporan akhir wilayah oleh Koordinator Wilayah. | `id` (PK), `reference_number` (UNIQUE), `province_code`, `report_type` |

---

## 4. Tugas, Dokumen & Komunikasi

| Tabel | Deskripsi | Kolom Kunci |
|---|---|---|
| `tasks` | Tugas terstruktur dengan penanggung jawab, prioritas, tenggat, checklist JSON, dan status Kanban. | `id` (PK), `reference_number` (UNIQUE), `assignee_user_id`, `status` |
| `task_comments` | Diskusi/komentar tindak lanjut per tugas. | `id` (PK), `task_id` (FK) |
| `documents` | Repositori dokumen resmi, SOP, SK, templat, kategori, versi, dan status arsip. | `id` (PK), `document_number` (UNIQUE), `file_id`, `version` |
| `announcements` | Pengumuman tersegmentasi (`nasional`, `wilayah`, `angkatan`). | `id` (PK), `scope`, `province_code`, `batch_id` |
| `calendar_events` | Agenda nasional, jadwal pembekalan, dan tenggat organisasi. | `id` (PK), `event_type`, `starts_at`, `ends_at` |
| `notifications` | Notifikasi pribadi pengguna lengkap dengan tautan modul tujuan (`link_path`). | `id` (PK), `user_id`, `is_read` |
| `saved_views` | Filter tampilan tersimpan per pengguna. | `id` (PK), `user_id`, `module` |

---

## 5. Perlindungan Peserta, Evaluasi & Verifikasi Lokasi

| Tabel | Deskripsi | Kolom Kunci |
|---|---|---|
| `risk_assessments` | Penilaian risiko kegiatan lapangan sebelum pelaksanaan. | `id` (PK), `province_code`, `risk_level` |
| `consent_records` | Catatan surat izin orang tua/wali dan persetujuan keikutsertaan. | `id` (PK), `personnel_id`, `file_id` |
| `incidents` | Laporan insiden keselamatan peserta selama kegiatan berlangsung. | `id` (PK), `province_code`, `severity`, `status` |
| `whistleblowing_reports` | Kanal pengaduan aman rahasia yang akses pembukaannya dibatasi ketat. | `id` (PK), `reference_number` (UNIQUE), `status` |
| `evaluations` | Penilaian kinerja personel, koordinator, dan ketercapaian kegiatan. | `id` (PK), `target_personnel_id`, `score` |
| `location_verifications` | Riwayat pencocokan koordinat LKL terhadap batas bounding-box provinsi. | `id` (PK), `lkl_id`, `province_code`, `matched` |
| `location_exceptions` | Pengecualian lokasi sah (mis. kegiatan lintas batas provinsi / nasional). | `id` (PK), `province_code`, `status` |

---

## 6. Penyimpanan Berkas, Audit, Otomasi & Pemantauan Sistem

| Tabel | Deskripsi | Kolom Kunci |
|---|---|---|
| `stored_files` | Metadata berkas terunggah pada `storage/private/`, deduplikasi checksum SHA-256, MIME, dan ukuran byte. | `id` (PK), `sha256`, `storage_path`, `size_bytes` |
| `backups` | Riwayat snapshot cadangan sistem, lokasi file ZIP, dan checksum integritas. | `id` (PK), `file_path`, `sha256`, `status` |
| `automation_jobs` | Daftar pekerjaan otomatis terjadwal (pengingat alumni H-7, pengingat tenggat laporan, pembersihan sesi kedaluwarsa). | `id` (PK), `job_key` (UNIQUE), `enabled` |
| `audit_logs` | Jejak audit keamanan permanen (siapa, peran, aksi, modul, target, IP, metadata JSON). | `id` (PK), `actor_user_id`, `action`, `created_at` |
| `activity_timeline` | Linimasa aktivitas organisasi yang ditayangkan pada dashboard & aktivitas terbaru. | `id` (PK), `module`, `created_at` |
| `system_settings` | Pasangan kunci-nilai konfigurasi organisasi (kebijakan sesi, nama organisasi, flag integrasi). | `key_name` (PK), `value_text` |
| `system_errors` | Catatan kesalahan internal HTTP 500 beserta kode referensi untuk investigasi administrator. | `id` (PK), `reference_id` (UNIQUE), `route`, `created_at` |
