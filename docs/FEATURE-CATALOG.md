# Katalog Fitur — SATU DPBI

Dokumen ini merangkum modul, rute, kewenangan utama, dan keterhubungan operasional platform **SATU DPBI** (*Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia*).

---

## 1. Zona Publik & Autentikasi
- **Portal Publik Institusional (`/`, `/tentang`, `/wilayah`, `/bantuan`, `/privasi`, `/ketentuan`, `/hak-cipta`)**: Halaman informasi resmi DPBI, peta interaktif 38 provinsi Indonesia, statistik agregat non-PII yang dikendalikan admin, FAQ/bantuan publik, dan footer hak cipta 4 kolom.
- **Gerbang Autentikasi & Pemulihan (`/login`, `/lupa-password`, `/reset-password`, `/aktivasi`, `/verifikasi-undangan`, `/sesi-berakhir`, `/403`, `/pemeliharaan`)**: Masuk berbasis sesi cookie `HttpOnly` + rotasi sesi, pelacakan percobaan gagal dengan penguncian sementara (`429`), reset kata sandi berbasis token acak berbatas waktu, aktivasi undangan resmi (tanpa pendaftaran mandiri terbuka), dan halaman status sesi/pemeliharaan.

## 2. Dashboard, Analitik & Pusat Aktivitas Pribadi
- **Dashboard & National Command Center (`/dashboard`)**: KPI operasional sesuai cakupan peran, fokus 6 Bidang untuk Pengurus Nasional, analitik kecepatan keputusan dan rasio persetujuan lintas jendela `7 Hari / 30 Hari / 90 Hari` (`computeDashboardAnalytics`), lencana jejak kontribusi terverifikasi, peta 38 provinsi, grafik aktivitas provinsi, dan timeline terbaru.
- **Aktivitas Saya (`/aktivitas-saya`)** & **Tugas Saya (`/tugas-saya`)**: Ruang kerja ringkas bagi Duta, Koordinator, dan pengurus untuk memantau pengajuan, tugas pribadi, dan notifikasi terkait.

## 3. Organisasi, Wilayah & Personalia
- **Personalia & Direktori Duta (`/personalia`, `/personalia/tambah`, `/personalia/:id`)**: Biodata Duta/Pengurus/Koordinator bertingkat (provinsi domisili vs penugasan, kabupaten/kota, kecamatan, kelurahan), indikator kelengkapan profil, permintaan akun baru oleh Koordinator Wilayah, serta penerbitan undangan aktivasi.
- **Wilayah 38 Provinsi & Kabupaten/Kota (`/wilayah`)**: Peta GeoJSON 38 provinsi + drilldown poligon Kabupaten/Kota (BIG/BPS), status kepengurusan (`aktif`, `dalam_pengembangan`, `dalam_pembinaan`, `belum_terbentuk`), catatan pembinaan, dan proses serah terima Koordinator Wilayah.
- **Angkatan (`/angkatan`), Alumni (`/alumni`), Struktur Organisasi (`/organisasi`)**: Pengelolaan periode angkatan 4 bulan, jendela akses arsip alumni 30 hari pasca masa tugas, dan direktori 6 Bidang resmi Pengurus Nasional.

## 4. Alur Operasional Terpadu
- **Pusat Persetujuan Nasional (`/persetujuan`)**: Antrean persetujuan terpadu lintas Proposal, LKL, Laporan Koordinator Wilayah, Permintaan Akun Baru, dan Serah Terima Koordinator, lengkap dengan filter status/SLA/kategori/provinsi, indikator keterlambatan SLA, serta keputusan langsung dan tautan modul asal.
- **Manajemen Proposal Kegiatan (`/proposal`, `/proposal/baru`, `/proposal/:id`)**: Penyimpanan draft, deteksi potensi duplikasi judul/tanggal/provinsi, rute persetujuan berbasis Approval Matrix, penyimpanan versi dokumen PDF, catatan keputusan, dan cetak ringkasan A4.
- **Laporan Kegiatan Lapangan / LKL (`/laporan-kegiatan`, `/laporan-kegiatan/baru`, `/laporan-kegiatan/:id`)**: Pelaporan pasca-kegiatan yang tertaut langsung ke proposal disetujui, indikator kelengkapan, alur pemeriksaan & revisi, galeri foto terkompresi, serta pratinjau/unduh PDF.
- **Laporan Koordinator Wilayah (`/laporan-koordinator`)**: Laporan bulanan (tenggat tanggal 5) dan laporan akhir masa tugas wilayah (tenggat 7×24 jam), rekap jumlah LKL diterima, pemeriksaan nasional, serta pengiriman ulang revisi.
- **Manajemen Tugas (`/tugas`)** & **Kalender Kerja (`/kalender`)**: Checklist bertahap, prioritas/tenggat waktu, pengingat otomatis, serta sinkronisasi jadwal kegiatan.

## 5. Komunikasi, Dokumen & Tata Kelola
- **Pusat Email & Pengiriman Massal (`/email`)**:
  - Komposer mode tunggal maupun segmen massal berdasarkan Peran, Bidang, Provinsi, Angkatan, atau daftar email manual terdeduplikasi.
  - Pengelolaan Templat Resmi berparameter (`{{nama}}`, `{{email}}`, `{{jabatan}}`, `{{provinsi}}`, `{{angkatan}}`, `{{tanggal}}`, `{{referensi}}`) dengan validasi variabel allowlist.
  - Mendukung pengiriman langsung (`send_now`), simpan draft, penjadwalan dengan opsi pembatalan, uji kirim ke email pengirim, riwayat kampanye, log status per penerima, retry penerima gagal, serta ekspor log CSV tahan injeksi formula.
  - Berjalan dalam mode **Sandbox Outbox (SQLite)** secara aman ketika `SMTP_HOST` belum dikonfigurasi, dan beralih ke **SMTP Live (`nodemailer`)** saat kredensial SMTP produksi diatur.
- **Pengumuman (`/pengumuman`), Notifikasi (`/notifikasi`), Dokumen & SOP (`/dokumen`), Arsip (`/arsip`), Pusat Bantuan (`/bantuan`)**: Publikasi pengumuman berjenjang, pusat notifikasi idempoten, pustaka SOP/SK berhak akses, arsip sertifikat/portofolio, dan panduan peran.
- **Perlindungan Pelajar & Pengawasan (`/perlindungan`, `/evaluasi`)**: Penilaian risiko U-18, persetujuan orang tua/wali, pencatatan insiden, kanal pelaporan tertutup dengan pengalihan konflik kepentingan otomatis, serta evaluasi kinerja.

## 6. Pengelolaan Sistem & Keamanan (Super Admin / Wakil Super Admin)
- **Pengguna & Kontrol Sesi (`/pengaturan/pengguna`, `/pengaturan`)**: Pembuatan/penonaktifan akun, inspeksi daftar sesi aktif milik pengguna tertentu, pemutusan paksa seluruh sesi perangkat pengguna, serta rotasi/penghapusan sesi otomatis saat peran atau status akun berubah.
- **Hak Akses & Delegasi (`/pengaturan/hak-akses`)**: Matriks RBAC 8 peran dan delegasi wewenang berbatas modul, aksi, provinsi, dan rentang tanggal.
- **Konfigurasi Sistem, CMS Publik, Audit Log & Status Sistem (`/pengaturan`, `/pengaturan/cms`, `/audit-log`, `/sistem`)**: Batas TTL sesi maksimal 24 jam, batas idle timeout, penomoran dokumen atomik (`DPBI/[KATEGORI]/[TAHUN]/[URUTAN]`), CMS halaman publik, backup/restore SQLite, serta rekam jejak audit permanen.
