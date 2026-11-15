# Panduan Administrator & Super Admin — SATU DPBI

Dokumen ini ditujukan bagi **Super Admin**, **Wakil Super Admin**, **Sekretariat Nasional**, serta **Pengurus Nasional** dalam menjalankan tata kelola harian dan konfigurasi organisasi di **SATU DPBI**.

---

## 1. Inisialisasi Super Admin Pertama (Mode Produksi)

Saat sistem pertama kali dijalankan dengan `DEMO_MODE="false"` pada basis data kosong:
1. Halaman utama portal otomatis menampilkan formulir **Inisialisasi Super Admin Pertama** (`/api/auth/bootstrap`).
2. Masukkan nama lengkap, email resmi organisasi, dan kata sandi kuat (minimal 8 karakter; disarankan > 12 karakter kombinasi huruf, angka, simbol).
3. Formulir bootstrap hanya berlaku **satu kali** selama tabel `users` belum memiliki data pengguna. Setelah Super Admin terbuat, endpoint bootstrap terkunci otomatis.

---

## 2. Manajemen Pengguna, Undangan & Status Akun (`/pengaturan/pengguna`)

Administrator dengan izin `pengaturan:manage` dapat:
1. **Membuat Undangan Aktivasi Akun**:
   - Pilih peran (*role*), provinsi penugasan (untuk peran regional), dan angkatan.
   - Sistem menghasilkan **token aktivasi sekali pakai** yang dikirim/diberikan kepada calon pengguna untuk melakukan aktivasi mandiri di `/aktivasi`.
2. **Mengelola Status Akun**:
   - **Aktif**: Pengguna dapat masuk dan bekerja sesuai hak aksesnya.
   - **Menunggu Persetujuan**: Pengguna dialihkan ke tampilan akun menunggu persetujuan saat mencoba masuk.
   - **Ditangguhkan / Nonaktif**: Seluruh sesi aktif pengguna tersebut dicabut seketika saat status diubah.

---

## 3. Matriks Peran, Hak Akses & Delegasi (`/pengaturan/hak-akses`, `/organisasi`)

SATU DPBI menggunakan 6 peran baku:
1. `super_admin` — Kontrol penuh sistem, keamanan, cadangan/pemulihan, dan penetapan delegasi.
2. `wakil_super_admin` — Pendamping kontrol nasional & eskalasi operasional.
3. `pengurus_nasional` — Penyetuju proposal berisiko tinggi/lintas provinsi, evaluasi, dan tata kelola nasional.
4. `sekretariat_nasional` — Pengelola personalia nasional, dokumen resmi, penomoran surat, pengumuman, dan penerbitan sertifikat massal.
5. `koordinator_wilayah` — Pengelola personel, proposal berisiko rendah/sedang, LKL, dan laporan bulanan di provinsinya masing-masing.
6. `duta` — Anggota aktif pelaksana kegiatan, pengajuan proposal/LKL, dan tugas pribadi.
7. `alumni` — Akses terbatas arsip pribadi selama 30 hari pasca masa tugas (dapat diperpanjang sementara oleh pengelola arsip).

### Delegasi Wewenang Sementara (`/organisasi`)
- Super Admin dapat memberikan **delegasi sementara** (modul & aksi spesifik, misalnya `wilayah:manage`) kepada pejabat lain dengan tanggal mulai (`starts_at`) dan berakhir (`ends_at`).
- Izin tambahan otomatis aktif selama rentang waktu delegasi dan otomatis gugur saat masa delegasi berakhir atau dicabut.

---

## 4. Manajemen 38 Provinsi, Angkatan & Arsip (`/wilayah`, `/angkatan`, `/alumni`, `/arsip`)

- **Wilayah 38 Provinsi**: Tetapkan Koordinator Wilayah per provinsi, catat pembinaan, dan pantau kelengkapan laporan bulanan/akhir wilayah.
- **Angkatan**: Buat batch angkatan baru tanpa menimpa data angkatan lama. Setiap angkatan memiliki jadwal pembukaan, penutupan, pembekalan, dan masa tugas (`term_starts_at` s/d `term_ends_at`).
- **Perpanjangan Akses Alumni**: Pada modul Arsip (`/arsip` atau `/alumni`), administrator dengan izin `arsip:manage` dapat memperpanjang masa unduh alumni bila terdapat kendala administratif.

---

## 5. Penerbitan Dokumen & Generator Sertifikat Massal (`/dokumen`)

Sekretariat Nasional dan pengelola dokumen dapat:
1. Mengunggah SK, SOP, dan panduan ke kategori terstruktur lengkap dengan nomor dokumen otomatis (`DPBI/DOK/TAHUN/XXXX`) dan pelacakan versi.
2. Menggunakan **Generator Dokumen Massal**:
   - Pilih daftar personel target.
   - Gunakan templat dengan placeholder `{{nama}}`, `{{provinsi}}`, `{{angkatan}}`, `{{jabatan}}`, `{{nomor_surat}}`, dan `{{tanggal}}`.
   - Klik **Generate PDF & Unduh ZIP** untuk menghasilkan puluhan berkas PDF individual terkemas dalam satu arsip `.zip`.

---

## 6. Pusat Kontrol Sistem, Kuota Penyimpanan & Kesehatan (`/sistem`, `/audit-log`, `/status-sistem`)

- **Storage & Backup (`/sistem`)**: Memantau pemakaian kuota penyimpanan (bawaan `10240 MB` / konfigurasi `STORAGE_QUOTA_MB`), membuat snapshot cadangan terkompresi, memvalidasi checksum SHA-256, serta memulihkan database bila diperlukan.
- **Audit Log Keamanan (`/audit-log`)**: Mencatat login berhasil/gagal, rotasi sesi, pengubahan hak akses, ekspor CSV, pengajuan proposal/LKL, serta perubahan konfigurasi sistem beserta IP dan waktu kejadian.
- **Kesehatan & Error Sistem (`/status-sistem`)**: Menampilkan mode berjalan (`PRODUKSI` vs `DEMO_SIMULASI`), waktu aktif server, jadwal otomasi internal, serta daftar catatan error HTTP 500 terbaru (`system_errors`) tanpa membocorkan stack trace ke pengguna akhir.

---

## 7. Kebijakan Integrasi Eksternal

Pada halaman konfigurasi organisasi (`/sistem` dan `/pengaturan`), status integrasi **Kemendikdasmen** dikunci pada status **`nonaktif`** oleh kebijakan arsitektur sistem sampai tersedia perjanjian kerja sama (MoU) resmi dan kredensial API dari pihak terkait.
