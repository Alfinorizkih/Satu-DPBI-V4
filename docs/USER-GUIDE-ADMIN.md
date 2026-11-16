# Panduan Administrator, Pengurus Nasional & Sekretariat — SATU DPBI

Panduan ini ditujukan bagi pengelola tingkat nasional: **Super Admin**, **Wakil Super Admin**, **Penanggung Jawab Organisasi**, **Pengurus Nasional (6 Bidang)**, dan **Sekretariat Nasional**.

---

## 1. Alur Kerja Pengurus Nasional (6 Bidang Resmi)

1. Setiap Pengurus Nasional terdaftar pada salah satu dari 6 Bidang (`OFFICIAL_BIDANGS`): Administrasi & Organisasi, Program & Operasional, Pengembangan Wilayah, Pendidikan & Kebudayaan, Hubungan & Kemitraan, atau Media, Publikasi & Teknologi.
2. **Dashboard Fokus Bidang**: Halaman `/dashboard` menampilkan ringkasan antrean proposal yang relevan dengan Bidang Anda serta akses cepat modul utama Bidang.
3. **Filter Proposal Bidang Saya (`/proposal`)**: Gunakan tombol **"Hanya Bidang Saya"** untuk menyaring antrean persetujuan agar hanya menampilkan proposal yang sesuai dengan Bidang kerja Anda.

---

## 2. Pengelolaan Organisasi, Delegasi & Angkatan (`/organisasi`, `/angkatan`, `/alumni`)

- **Struktur Jabatan & SK**: Tetapkan pejabat struktur organisasi nasional beserta nomor SK dan masa bakti.
- **Delegasi Wewenang Berbatas Waktu**: Berikan izin sementara atas modul/aksi tertentu (misal saat pengurus berhalangan) lengkap dengan tanggal mulai, tanggal berakhir, alasan, dan opsi pencabutan seketika.
- **Siklus Angkatan**: Kelola pembukaan, masa aktif, hingga pengarsipan angkatan baru tanpa menimpa data angkatan sebelumnya.
- **Manajemen Alumni (`/alumni`)**: Pantau daftar alumni dan perpanjang jendela akses arsip 30 hari apabila diperlukan dengan alasan audit.

---

## 3. Pengelolaan Website Publik, CMS & Pusat Bantuan (`/pengaturan/cms`, `/pengumuman`)

Dapat diakses oleh **Super Admin**, **Wakil Super Admin**, **Sekretariat Nasional**, serta **Pengurus Nasional Bidang Media, Publikasi & Teknologi**:
1. **CMS Konten Publik (`/pengaturan/cms`)**: Sunting judul dan isi teks untuk `hero_subtitle`, `about_dpbi`, `vision_mission`, `official_contact`, dan `social_links`. Perubahan langsung tampil pada Website Publik `/`, `/tentang`, dan `/bantuan`.
2. **CRUD Artikel Pusat Bantuan (`/bantuan`)**: Tambah, ubah, atur urutan tampil (`sort_order`), target peran (`umum`, `duta`, `koordinator_wilayah`, `pengurus_nasional`), serta status terbit artikel.
3. **Publikasi Pengumuman ke Website Publik (`/pengumuman`)**: Saat membuat pengumuman atau pada kartu pengumuman nasional, centang/toggle **"Tampil di Website Publik"** (`isPublic`) untuk menerbitkan pengumuman resmi ke halaman utama publik tanpa membocorkan pemberitahuan operasional internal.
4. **Kontrol Statistik Publik (`public_show_duta_count`)**: Khusus `super_admin`, tentukan apakah angka jumlah Duta aktif ditampilkan di publik atau disembunyikan demi kebijakan privasi.

---

## 4. Dokumen Massal, Keamanan Akun & Kontrol Sistem (`/dokumen`, `/pengaturan/*`, `/sistem`)

- **Generator Dokumen Massal PDF/ZIP (`/dokumen`)**: Pilih banyak personel sekaligus dan terbitkan sertifikat/surat tugas personal ber-nomor referensi atomik dalam satu unduhan ZIP.
- **Pengelolaan Pengguna & Sesi (`/pengaturan/pengguna`, `/pengaturan/sesi`)**: Tambah akun dengan pilihan Bidang resmi, nonaktifkan/aktifkan akun, atau pantau sesi perangkat aktif. Setiap perubahan peran/status otomatis mencabut sesi lama target.
- **Kontrol Sistem & Backup (`/sistem`, `/audit-log`, `/status-sistem`)**: Pantau kapasitas penyimpanan `storage/private/`, buat & validasi arsip backup ZIP SHA-256, jalankan pekerjaan otomasi, serta tinjau log audit *append-only* dan referensi error `system_errors`.
- **Integrasi Kemendikdasmen**: Tetap terkunci **`nonaktif`** secara sistem dan tidak dapat diaktifkan sampai terdapat MoU serta kredensial resmi.
