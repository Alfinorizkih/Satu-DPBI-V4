# PETA JALAN PENYEMPURNAAN & KEUNGGULAN OPERASIONAL — SATU DPBI

Dokumen ini merangkum prioritas implementasi terstruktur berdasarkan hasil audit pada `docs/COMPREHENSIVE-AUDIT.md`.

---

## Fase 1 — Fondasi Skema, Keamanan Sesi & RBAC (Kritis)
1. **Hard Session Expiry <= 24 Jam & Kontrol Sesi Admin**
   - Batasi `session_ttl_hours` secara keras di `1..24` jam pada `server/security.ts`, `PATCH /api/system/settings`, dan form Pengaturan Sistem.
   - Tambah endpoint `GET/DELETE /api/settings/users/:id/sessions` agar Super Admin dapat memeriksa dan memutus paksa sesi aktif pengguna mana pun (`ADMIN_REVOKE_USER_SESSIONS`).
2. **Penghapusan Interpolasi SQL & Penutupan Celah IDOR**
   - Ubah 100% kueri dinamis di `/api/dashboard` dan `/api/search` menjadi parameter `?` terikat.
   - Tambah tabel `file_access_grants` serta helper `canAccessStoredFile(...)` untuk memvalidasi akses berkas pada `/api/files/:id`, `/api/files/:id/preview`, dan `/api/files/:id/download`.
   - Tegakkan pembatasan provinsi Korwil & kepemilikan objek pada Proposal, LKL, Laporan Koordinator, Tugas, Personalia, Serah Terima, Arsip, dan Ekspor CSV (lengkap dengan formula injection protection).
3. **Pembatasan Delegasi & Keamanan Header HTTP**
   - Validasi bahwa delegasi tidak melampaui hak pemberi delegasi dan menjaga cakupan `provinceCode`.
   - Tambah `Content-Security-Policy`, `Permissions-Policy`, dan `Strict-Transport-Security` kondisional pada `server.ts`, serta throttling & audit log pada login gagal, reset password, dan akses ditolak.
4. **Migrasi Database Terkelola (`schema_migrations`)**
   - Tambah tabel pelacakan migrasi dan kolom relasi antarmodul (`proposal_id`, `lkl_id`, `event_id`, `sla_due_at`, `escalated_to`, `event_key` notifikasi idempoten) beserta sinkronisasi `database/schema_mysql.sql`.

## Fase 2 — Satu Alur Kerja Terhubung & Pusat Persetujuan Nasional (`/persetujuan`)
1. **Otomasi Proposal -> Kalender -> Tugas -> LKL -> Evaluasi**
   - Saat Proposal berstatus `disetujui`, sistem otomatis membuat entri `calendar_events` tertaut + 4 tugas bertahap (`Persiapan`, `Pelaksanaan`, `Dokumentasi`, `Pelaporan LKL`) dan mengirim notifikasi idempoten ke PIC & Korwil.
   - Perubahan jadwal/lokasi Proposal menyinkronkan jadwal di Kalender secara otomatis.
   - LKL mewajibkan pilihan Proposal disetujui bila relevan, dilengkapi *pre-submit checklist*, dan saat LKL `diterima` akan memperbarui status tugas pelaporan serta metrik peta/analitik (7/30/90 hari) beserta lencana kontribusi non-shaming.
2. **Pusat Persetujuan Nasional (`/persetujuan`)**
   - Menggabungkan antrean persetujuan lintas modul (Proposal, LKL, Laporan Koordinator, Permintaan Akun, Serah Terima Wilayah) lengkap dengan indikator SLA, penugasan ulang reviewer, eskalasi, penolakan/pembatalan dengan alasan wajib, dan jejak audit.
3. **Revisi Laporan Koordinator Wilayah**
   - Koordinator Wilayah dapat mengirim revisi laporan berstatus `perlu_revisi` langsung dari halaman Laporan Koordinator.

## Fase 3 — Pusat Email Terintegrasi (`/email`), Umpan Balik Global & Ketahanan UX
1. **Pusat Email & Pengiriman Massal (`/email`)**
   - Terintegrasi dengan `nodemailer` ketika `SMTP_HOST` dikonfigurasi; bila belum ada kredensial SMTP, berjalan jujur pada mode `sandbox_outbox` (antrean SQLite persisten) tanpa klaim palsu pengiriman eksternal.
   - Mendukung templat tervalidasi (`{{nama}}`, dll.), builder audiens dengan deduplikasi, uji kirim ke diri sendiri, draf/penjadwalan, pembatalan, kirim ulang log gagal, dan ekspor CSV log pengiriman.
2. **Mesin Toast Global, ConfirmDialog, Kompresi Gambar & Kepatuhan URL API**
   - Upgrade Toast (`success | error | warning | info | loading`, tombol tutup manual, durasi adaptif, aksesibel).
   - Pasang `ConfirmDialog` pada semua penghapusan/penolakan/pencabutan penting, kompresi gambar HTML5 `<canvas>` pada `FileDropzone`, dan standarisasi `apiUrl(...)` di seluruh halaman.

## Fase 4 — Pengujian Terpadu, Verifikasi Browser & Paket Final
1. Perluasan unit test (`src/lib/domain.test.ts`) dan integration security test (`server/api.security.test.ts`).
2. Pemeriksaan responsivitas `320px`, `390px`, `768px`, `1440px` pada mode terang & gelap via Playwright tanpa error konsol.
3. Penyusunan dokumentasi akhir (`FEATURE-CATALOG.md`, `INTEGRATION-MATRIX.md`, `SECURITY-REVIEW.md`, `TESTING-REPORT.md`, `LAPORAN_PENGUJIAN.md`, `walkthrough.md`) dan arsip zip rilis.
