# Panduan Pengguna Lengkap SATU DPBI (v4.1.0)

**SATU DPBI** (*Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia*)  
**Tagline Sistem:** *Satu Sistem, Satu Data, Satu Koordinasi.*  
**Identitas Gerakan:** *Berbudaya, Bergerak, dan Berdampak Untuk Negeri.*

---

## 1. Memahami Struktur Akses & 3 Zona Portal

1. **Website Publik (`/`, `/program`, `/program/:slug`, `/tentang`, `/wilayah`, `/wilayah/:code`, `/bantuan`, `/privasi`, `/ketentuan`)**
   - Dapat diakses masyarakat, sekolah, mitra, dan calon anggota tanpa login.
   - Menampilkan profil organisasi DPBI, 3 Program Unggulan Nasional (*Behind The Culture*, *Sedapnya Warisanku*, *Budaya Masuk Sekolah*), ringkasan struktur kepengurusan bebas-PII, pengumuman publik terkurasi, dan persebaran 38 provinsi.
2. **Portal Autentikasi (`/login`, `/aktivasi`, `/lupa-password`, `/reset-password`)**
   - Masuk menggunakan email & kata sandi resmi, aktivasi token undangan (`72 jam`, sekali pakai), atau pengaturan ulang kata sandi.
   - Pada mode evaluasi (`DEMO_MODE=true`), panel pilih akun simulasi tersedia di halaman `/login`.
3. **Portal Internal (Sesuai Role & 6 Bidang Resmi)**
   - Setelah masuk, pengguna diarahkan ke **Beranda Saya (`/beranda`)** yang disesuaikan dengan peran (atau halaman awal pilihan pada *Pengaturan -> Tampilan*).
   - Dilengkapi menu sidebar terkelompok (*Utama, Organisasi, Operasional, Informasi, Pengelolaan*), pencarian cepat (`Ctrl+K`), tombol bantuan kontekstual (`?`) & tur interaktif peran, Pusat Kendala (`/kendala`), mode Terang/Gelap, serta banner peringatan otomatis saat *Mode Pemeliharaan* aktif.

---

## 2. Panduan Berdasarkan 7 Peran Utama (RBAC)

### A. Super Admin & Wakil Super Admin
- **Manajemen Pengguna & Penautan Personel (`/pengaturan/pengguna`)**:
  - Gunakan 3 mode pembuatan akun:
    1. *Buat Akun + Profil Personel Baru Sekaligus* (`create_both`),
    2. *Tautkan ke Data Personel yang Sudah Ada* (`link_existing`, mencegah duplikasi personel),
    3. *Akun Operasional Saja* (`operational_only`).
  - Dapat melihat perangkat sesi aktif tiap pengguna, memutus paksa sesi (*Force Logout*), serta menangguhkan/mengaktifkan kembali akun.
- **Pusat Kendali Sistem & Pemeliharaan (`/sistem` & `/status-sistem`)**:
  - **Backup & Restore WAL-Safe**: Membuat backup ZIP menggunakan `VACUUM INTO` + verifikasi SHA-256 dan pemulihan aman dengan konfirmasi eksplisit.
  - **Mode Pemeliharaan**: Mengaktifkan penguncian baca-saja bagi peran lain (`HTTP 503`) beserta pesan pengumuman sementara, serta menonaktifkannya kembali saat pemeliharaan selesai.
  - **Data Quality Center**: Memantau 7 jenis temuan kualitas data (duplikasi email/NISN/nomor anggota, LKL tertunda >14 hari, dokumen kedaluwarsa, slot jabatan kosong, personel tanpa wilayah, dsb.).

### B. Sekretariat Nasional
- **Siklus Undangan & Persetujuan Akun (`/persetujuan` & `/personalia`)**:
  - Mengelola siklus status undangan (`draft → menunggu_persetujuan → siap_diundang → undangan_terkirim → aktivasi_dibuka → aktif`), mengirim ulang undangan (membatalkan token lama, cooldown 60 detik), dan membatalkan undangan dengan alasan tercatat.
- **Impor Massal CSV & Rollback (`/personalia`)**:
  - Unduh templat resmi CSV, unggah atau tempel CSV dengan pemetaan kolom & pratinjau validasi per baris (duplikasi NISN/email/nomor anggota ditolak otomatis), serta batalkan (*rollback*) batch impor bila diperlukan (baris yang sudah ditautkan ke akun aktif tetap terlindungi).
- **Persuratan Digital & Disposisi (`/persuratan`)**:
  - Mencatat Surat Masuk/Keluar dengan penomoran atomik `DPBI/SURAT/[TAHUN]/[URUTAN]`, mengunggah lampiran surat, dan menerbitkan Disposisi beserta tenggat tindak lanjut ke Bidang atau Koordinator Wilayah.
- **Pusat Email 50 Templat Resmi (`/email`)**:
  - Menggunakan **50 templat resmi DPBI** (dapat diaktifkan/nonaktifkan) dengan **20 variabel aman** (`{{nama}}`, `{{email}}`, `{{jabatan}}`, `{{role}}`, `{{provinsi}}`, `{{kabupaten}}`, `{{angkatan}}`, `{{nomor_anggota}}`, `{{nomor_surat}}`, `{{nomor_pengajuan}}`, `{{nama_program}}`, `{{tanggal}}`, `{{tenggat}}`, `{{tautan}}`, `{{tautan_aktivasi}}`, `{{tautan_dokumen}}`, `{{catatan_pemeriksa}}`, `{{nama_pemeriksa}}`, `{{nama_organisasi}}`, `{{referensi}}`), editor Teks & HTML anti-XSS + pratinjau langsung, lampiran berkas, impor audiens CSV (RFC-4180), serta antrean pengiriman bertahap lengkap dengan jeda/lanjut/batal.

### C. Pengurus Nasional (6 Bidang Resmi)
- **Bidang Resmi DPBI**:
  1. Bidang Administrasi & Organisasi
  2. Bidang Program & Operasional
  3. Bidang Pengembangan Wilayah
  4. Bidang Pendidikan & Kebudayaan
  5. Bidang Hubungan & Kemitraan
  6. Bidang Media, Publikasi & Teknologi
- **Flagship Program Command Center (`/program` & `/program/:slug`)**:
  - Memantau target vs realisasi provinsi, proposal, LKL sah, tugas, dokumen, persuratan, serta evaluasi untuk *Behind The Culture*, *Sedapnya Warisanku*, dan *Budaya Masuk Sekolah*.
- **Pusat Persetujuan & Pusat Revisi (`/persetujuan`)**:
  - Meninjau proposal dan LKL sesuai matriks bidang/tahap, memantau SLA & eskalasi, menugaskan ulang peninjau dengan alasan wajib, dan memantau *Pusat Revisi* (`approval_history` permanen). Kebijakan anti-self-approval mencegah peninjau menyetujui pengajuannya sendiri.
- **CMS & Website Publik (`/pengaturan/cms`)**:
  - Khusus Bidang Media, Publikasi & Teknologi, Sekretariat Nasional, dan Super Admin untuk memperbarui konten informasi publik dan artikel Pusat Bantuan.

### D. Koordinator Wilayah (38 Provinsi)
- **Wilayah & Serah Terima Jabatan / Handover (`/wilayah`)**:
  - Mengelola data kabupaten/kota provinsi tugasnya, mengajukan laporan bulanan/akhir koordinator (`/laporan-koordinator`), serta menjalankan serah terima jabatan dengan paket lengkap (*checklist* serah terima, laporan tertunda, dokumen aktif, inventaris, dan penutupan sesi koordinator lama saat disahkan).
- **Persetujuan Tahap Wilayah (`/persetujuan`)**:
  - Memverifikasi proposal, LKL lapangan, dan permintaan akun dalam batas provinsi sendiri (isolasi lintas provinsi ditegakkan sistem).

### E. Duta Pelajar
- **Pengajuan Proposal, LKL & Antrean Draft (`/proposal`, `/laporan-kegiatan`)**:
  - Mengajukan proposal (terhubung ke Program Unggulan & Bidang terkait), menerima hasil keputusan & catatan revisi pada *Pusat Revisi*, serta mengisi LKL pasca-kegiatan lengkap dengan bukti lokasi lapangan dan penyimpanan *draft* lokal terisolasi per akun (`offlineDraft`).
- **Tugas Saya & Ketergantungan (`/tugas-saya`, `/tugas`)**:
  - Menyelesaikan tugas beserta *checklist*; tugas yang bergantung pada tugas prasyarat (*depends_on_task_id*) terkunci otomatis hingga prasyarat selesai.
- **Evaluasi Multi-Pihak (`/evaluasi`)**:
  - Mengisi atau melihat evaluasi dari 6 perspektif (*Duta, Panitia, Peserta, Sekolah, Komunitas, Mitra*) dan memantau grafik tren kontribusi pribadi.

### F. Alumni
- **Akses Arsip & Jendela Transisi 30 Hari (`/alumni`, `/arsip`, `/dokumen`)**:
  - Tetap memiliki akses baca terhadap arsip kegiatan, sertifikat, riwayat kontribusi pribadi, dan Pusat Bantuan sesuai matriks RBAC Alumni.

---

## 3. Fitur Kenyamanan, Bantuan & Keandalan Operasional
- **Beranda Saya (`/beranda`) & Tampilan (`/pengaturan`)**: Atur halaman awal, skala tampilan (*Ringkas, Nyaman, Besar*), dan pintasan favorit pribadi sesuai peran Anda.
- **Pelacak Proses (`Process Tracker`) & Formulir Bertahap**: Proposal dan LKL dilengkapi langkah terpandu, indikator kelengkapan, penyimpanan *draft* otomatis, dan lini masa pemeriksa yang transparan.
- **Pusat Bantuan (`?`) & Pusat Kendala (`/kendala`)**: Buka panduan halaman atau tur peran kapan saja, serta kirim tiket laporan kendala beserta tangkapan layar ke Super Admin / Sekretariat Nasional.
- **Perlindungan Data Pelajar (U18)**: Data sensitif pelajar (NISN, alamat, kontak wali, laporan *safeguarding*) disamarkan sesuai peran dan setiap akses maupun ekspor terekam dalam `Audit Log`.
- **Dokumen & Versi Usang (`/dokumen`)**: Dokumen yang digantikan versi baru (`replaced_by_id`) menampilkan spanduk peringatan agar pengguna merujuk versi mutakhir.
- **Cetak Resmi A4**: Gunakan tombol **Cetak** di Wilayah, Personalia, Struktur Organisasi, Proposal, LKL, Dokumen Resmi, dan Arsip untuk menghasilkan dokumen berstandar A4.
