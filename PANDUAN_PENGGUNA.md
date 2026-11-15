# Panduan Pengguna — SATU DPBI

Panduan ini disusun untuk seluruh anggota aktif, Duta Pelajar, Koordinator Wilayah, Pengurus Nasional, serta Alumni **Duta Pelajar Berbudaya Indonesia (DPBI)** dalam menggunakan portal **SATU DPBI**.

---

## 1. Masuk ke Sistem & Aktivasi Akun

1. Buka halaman utama portal SATU DPBI (`/` atau `/login`).
2. Masukkan **Email Resmi** dan **Kata Sandi**, lalu klik **Masuk ke Portal**.
3. Jika Anda baru diundang oleh Pengelola/Sekretariat:
   - Klik tab **Aktivasi Undangan** (`/aktivasi` atau `/verifikasi-undangan`).
   - Masukkan **Kode Undangan** sekali pakai dari administrator serta buat kata sandi baru minimal 8 karakter.
4. Jika Anda lupa kata sandi:
   - Klik tab **Reset Password** (`/lupa-password`).
   - Ajukan email terdaftar Anda untuk memperoleh token reset sekali pakai, lalu tetapkan kata sandi baru.
5. **Akun Menunggu Persetujuan**: Bila akun berstatus `menunggu_persetujuan`, portal menampilkan halaman tunggu khusus sampai Administrator mengaktifkan akun Anda.

> **Keamanan Sesi**: Bila sesi tidak aktif melewati batas waktu kebijakan atau token kedaluwarsa, sistem menampilkan halaman **419 Sesi Berakhir** dan meminta Anda masuk kembali secara aman.

---

## 2. Navigasi & Antarmuka Utama

- **Sidebar Desktop & Drawer Mobile**:
  - Menu dikelompokkan dalam 5 kategori: **Utama**, **Organisasi**, **Operasional**, **Informasi**, dan **Pengelolaan**.
  - Hanya menu yang sesuai dengan peran (*role*) Anda yang ditampilkan.
  - Pada layar desktop, klik tombol ciutkan di samping logo untuk memperlebar area baca konten. Pada perangkat ponsel, gunakan tombol menu di pojok kiri atas.
- **Header & Pencarian Global (`Ctrl + K` / `Cmd + K`)**:
  - Tekan kolom pencarian di header untuk mencari personel, nomor referensi `DPBI/...`, provinsi, proposal, dokumen, atau melompat langsung ke rute modul.
  - Gunakan tombol **Tema (Terang / Gelap)** dan **Notifikasi** di pojok kanan atas.

---

## 3. Panduan Fitur Utama per Alur Kerja

### A. Dashboard & Aktivitas Saya (`/dashboard`, `/aktivitas-saya`)
- **Dashboard** menampilkan metrik relevan dari database yang dapat diklik langsung menuju daftar terkait (Proposal aktif, LKL, Tugas, Personalia).
- **Aktivitas Saya** merangkum proposal yang Anda ajukan, LKL Anda, daftar tugas pribadi, serta catatan audit tindakan Anda sendiri.

### B. Profil & Personalia (`/personalia`, `/profil`)
- Buka `/personalia` untuk melihat daftar personel (disesuaikan dengan cakupan provinsi/role).
- Klik salah satu personel (`/personalia/:id`) untuk membuka tab detail:
  - **Identitas & Domisili**, **Pendidikan & Sekolah**, **Organisasi & Angkatan**, **Dokumen Identitas** (hanya terlihat oleh pemilik profil dan peran berwenang), dan **Riwayat Jabatan**.
- Untuk mengubah data, klik **Ubah Profil** (`/personalia/:id/ubah`). Bila Anda menekan tombol kembali saat ada perubahan belum tersimpan, portal memunculkan **dialog konfirmasi** agar pekerjaan tidak hilang secara tidak sengaja.

### C. Pengajuan Proposal Kegiatan (`/proposal`, `/proposal/baru`)
1. Klik **Ajukan Proposal Baru** (`/proposal/baru`).
2. Isi judul, tanggal, lokasi, bidang, tingkat risiko, penggunaan identitas DPBI, kebutuhan izin eksternal, deskripsi, dan unggah dokumen PDF pendukung.
3. Sistem menentukan **Penyetuju Otomatis** berdasarkan matriks organisasi (misalnya risiko tinggi/identitas nasional dirutekan ke Pengurus Nasional; kegiatan lokal berisiko rendah dirutekan ke Koordinator Wilayah).
4. Klik **Kirim Proposal** (tombol dikunci otomatis selama proses pengiriman guna mencegah pengiriman ganda).
5. Pantau status: *Draft*, *Menunggu Tinjauan*, *Perlu Revisi*, *Disetujui*, atau *Ditolak* di halaman detail `/proposal/:id`.

### D. Laporan Kegiatan Lapangan — LKL (`/laporan-kegiatan`, `/laporan-kegiatan/baru`)
1. Ajukan laporan kegiatan setelah kegiatan terlaksana melalui `/laporan-kegiatan/baru`.
2. Lampirkan **PDF Laporan** dan **Foto Dokumentasi** dengan pratinjau langsung di layar.
3. Sistem dapat mencatat koordinat lokasi (*geolocation*) jika diizinkan perangkat untuk membantu Koordinator memverifikasi kesesuaian wilayah provinsi.

### E. Tugas & Kalender (`/tugas`, `/tugas-saya`, `/kalender`)
- Gunakan `/tugas-saya` untuk berfokus pada daftar tugas pribadi Anda, atau `/tugas` untuk tampilan **Daftar**, **Papan Kanban**, dan jadwal tim.
- Klik kartu tugas untuk memperbarui progres *checklist*, mengubah status, atau menambahkan komentar tindak lanjut.
- Buka `/kalender` untuk melihat agenda nasional, jadwal pembekalan angkatan, serta tenggat laporan koordinator dalam tampilan bulan, minggu, atau daftar.

### F. Pusat Dokumen & Pengumuman (`/dokumen`, `/pengumuman`, `/notifikasi`)
- Di `/dokumen`, cari SOP, templat surat, atau sertifikat, lalu klik **Pratinjau** (`/dokumen/:id`) untuk membaca berkas langsung di layar atau mengunduhnya.
- Di `/pengumuman`, pengumuman dipilah berdasarkan cakupan **Nasional**, **Wilayah**, dan **Angkatan**.

### G. Portal Alumni 30 Hari (`/alumni`, `/arsip`)
- Personel yang masa tugas angkatannya telah selesai memperoleh jendela akses **Alumni selama 30 hari** untuk mengunduh sertifikat pribadi dan mengekspor riwayat kegiatannya (`/api/archive/export-personal`).
- Sisa hari akses ditampilkan jelas di halaman `/alumni` dan `/arsip`.

### H. Pengaturan Pribadi & Sesi Aktif (`/pengaturan`, `/pengaturan/keamanan`, `/pengaturan/sesi`)
- Ubah kata sandi akun pada tab **Keamanan** (`/pengaturan/keamanan`).
- Tinjau daftar perangkat yang sedang login di **Perangkat & Sesi Aktif** (`/pengaturan/sesi`). Anda dapat mencabut sesi tertentu atau memilih **Keluar dari Semua Perangkat** kapan saja.
