# Panduan Pengguna Koordinator Wilayah — SATU DPBI

Panduan ini merangkum tugas dan wewenang **Koordinator Wilayah (`koordinator_wilayah`)** yang ruang lingkup datanya terisolasi pada provinsi penugasannya masing-masing.

---

## 1. Memantau Provinsi & Kabupaten/Kota (`/wilayah`)

1. Buka menu **Wilayah** (`/wilayah`) untuk melihat peta GeoJSON 38 provinsi beserta panel detail provinsi Anda.
2. Klik provinsi Anda pada peta atau pilih dari daftar untuk membuka **Peta & Daftar Kabupaten/Kota**.
3. Perhatikan perbedaan indikator penting:
   - **Duta Domisili**: Jumlah Duta yang berdomisili di kabupaten/kota tersebut.
   - **Duta Penugasan**: Jumlah Duta yang ditugaskan menjalankan program di kabupaten/kota tersebut.
   - **Koordinator & Aktivitas**: Keberadaan tim penggerak dan jumlah Proposal/LKL aktif.
4. Anda dapat memperbarui status pembinaan dan catatan koordinasi kabupaten/kota di provinsi Anda (`PATCH /api/regencies/:code`), menambah daerah pemekaran bila diperlukan, serta melihat ringkasan cetak A4 Peta & Statistik Wilayah.

---

## 2. Verifikasi Personalia & Pengajuan Akun Duta Baru (`/personalia`)

1. **Verifikasi Profil Duta Wilayah**:
   - Buka daftar personel provinsi Anda, periksa kelengkapan identitas serta berkas wajib (minimal Pas Foto & Kartu Pelajar harus tercentang sebelum dapat disetujui).
   - Tetapkan status verifikasi: `terverifikasi`, `perlu_perbaikan`, atau `tidak_valid` dengan catatan jelas.
2. **Usulan Akun Duta Baru (`DPBI/AKUN/...`)**:
   - Gunakan tab **Permintaan Akun** untuk mengajukan calon Duta baru dari sekolah di provinsi Anda.
   - Sekretariat Nasional atau Super Admin akan meninjau usulan tersebut dan menerbitkan token aktivasi undangan bagi calon Duta.

---

## 3. Pemeriksaan Proposal & LKL Wilayah (`/proposal`, `/laporan-kegiatan`)

- **Proposal Lokal**: Proposal kegiatan lokal berisiko rendah tanpa identitas DPBI nasional dapat langsung Anda putuskan (`Disetujui`, `Perlu Revisi`, atau `Ditolak`). Proposal berdampak luas diteruskan otomatis oleh sistem ke **Pengurus Nasional**.
- **Pemeriksaan LKL**: Periksa kebenaran dokumentasi foto, jumlah peserta, dan kesesuaian laporan LKL Duta di wilayah Anda lalu tetapkan keputusan `Diterima`, `Perlu Revisi`, atau `Ditolak`.

---

## 4. Laporan Bulanan & Akhir Koordinator (`/laporan-koordinator`)

1. **Laporan Bulanan**: Wajib dikirim maksimal **tanggal 5** setiap bulan berjalan.
2. **Laporan Akhir Angkatan**: Wajib dikirim maksimal **7 hari (168 jam)** setelah masa tugas angkatan berakhir.
3. Sistem secara otomatis merekap jumlah LKL berstatus **Diterima** di provinsi Anda dan menyediakan tombol **Cetak A4** untuk arsip fisik laporan koordinator.

---

## 5. Penugasan & Serah Terima Wilayah (`/tugas`, `/wilayah`)

- Buat dan distribusikan tugas ke Duta di wilayah Anda pada `/tugas` (dapat melampirkan dokumen arahan PDF/gambar).
- Saat pergantian periode kepengurusan wilayah, ajukan **Serah Terima Koordinator** (`DPBI/HND/...`) agar beban tugas terbuka dan proposal berjalan tercatat sah ke koordinator berikutnya.
