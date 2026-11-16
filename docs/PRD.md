# Product Requirements Document (PRD) — SATU DPBI

> **SATU DPBI** — *Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia*  
> Tagline Portal: **Satu Sistem, Satu Data, Satu Koordinasi.**  
> Semangat Gerakan DPBI: **Berbudaya, Bergerak, dan Berdampak Untuk Negeri.**

---

## 1. Latar Belakang & Batasan Kelembagaan

**Duta Pelajar Berbudaya Indonesia (DPBI)** adalah organisasi kepemimpinan dan penggerak literasi budaya pelajar SMA/SMK/MA/sederajat yang beroperasi secara **independen** di **38 provinsi Indonesia**.

- DPBI **bukan** lembaga pemerintah ataupun unit di bawah kementerian mana pun.
- Seluruh integrasi eksternal (termasuk `kemendikdasmen_status` pada `system_settings`) dikunci permanen dalam status **`nonaktif`** hingga terdapat nota kesepahaman (MoU) dan kredensial API resmi yang sah.
- Platform memisahkan secara tegas **Website Publik & Informasi Resmi DPBI** (tanpa data pribadi pelajar/PII) dari **Portal Administrasi Internal SATU DPBI** (dilindungi sesi `HttpOnly`, RBAC, dan isolasi wilayah).

---

## 2. Pemisahan 3 Zona Aplikasi

| Zona | Rute Utama | Audiens | Prinsip Konten & Privasi |
| :--- | :--- | :--- | :--- |
| **1. Website Publik DPBI** | `/`, `/tentang`, `/wilayah`, `/wilayah/:code`, `/bantuan` | Masyarakat umum, sekolah, calon mitra, orang tua/wali | Menampilkan profil gerakan, 6 Bidang Pengurus Nasional, peta GeoJSON 38 provinsi & kabupaten/kota, statistik agregat publik yang disetujui admin (`public_stats_approved` / `public_show_duta_count`), pengumuman publik (`is_public = 1`), dan Pusat Bantuan. **Nol PII pelajar.** |
| **2. Portal Autentikasi** | `/login`, `/lupa-password`, `/reset-password`, `/aktivasi`, `/verifikasi-undangan` | Personel terdaftar & pemegang undangan | Masuk aman berbatas percobaan (`429`), reset password token sekali pakai, aktivasi akun undangan, deteksi sesi berakhir (`419`), dan panel *Demo Switcher* khusus saat `DEMO_MODE=true`. |
| **3. Portal Internal SATU DPBI** | `/dashboard`, `/personalia/*`, `/wilayah/*`, `/angkatan/*`, `/proposal/*`, `/laporan-kegiatan/*`, `/laporan-koordinator`, `/tugas/*`, `/dokumen/*`, `/pengumuman`, `/kalender`, `/perlindungan`, `/evaluasi`, `/arsip`, `/alumni`, `/sistem`, `/pengaturan/*` | 8 peran terdaftar sesuai matriks RBAC | Tata kelola internal berjenjang berbasis peran, Bidang, provinsi, serta dukungan pencetakan dokumen resmi ukuran A4 (`A4PrintEngine`). |

---

## 3. Tujuan Produk & Pilar Fungsional

1. **Keseragaman & Aksesibilitas (*Minimal Institutional Dashboard*)**:
   - Palet warna institusional konsisten (`#0EA5E9` Primary, `#38BDF8` Highlight, `#1E293B` Deep Slate, `#F1F5F9` Background) dengan dukungan penuh *Light Mode* dan *Dark Mode*.
   - Tipografi angka teratur (`tabular-nums`), kontrol navigasi satu baris rapi, penanda status tegas non-dekoratif, serta responsivitas penuh untuk desktop (`>=1024px`) dan ponsel (`<768px`).
2. **Struktur Kepengurusan 6 Bidang Resmi (`OFFICIAL_BIDANGS`)**:
   - `01` Bidang Administrasi & Organisasi
   - `02` Bidang Program & Operasional
   - `03` Bidang Pengembangan Wilayah
   - `04` Bidang Pendidikan & Kebudayaan
   - `05` Bidang Hubungan & Kemitraan
   - `06` Bidang Media, Publikasi & Teknologi
   - Setiap Pengurus Nasional terikat pada Bidang kerjanya sehingga Dashboard dan antrean Proposal dapat difilter sesuai relevansi Bidang (`?bidangOnly=1`).
3. **Pemetaan Nusantara Berbasis GeoJSON Nyata (38 Provinsi & ~514 Kab/Kota)**:
   - Visualisasi peta SVG dari geometri GeoJSON Indonesia 38 provinsi dan fitur *drilldown* batas Kabupaten/Kota per provinsi, dibarengi tabel dan pencarian agar akses tidak pernah bergantung pada peta semata.
   - Membedakan secara jujur antara **Duta Domisili** vs **Duta Penugasan**, koordinator aktif, dan realisasi kegiatan/LKL di kabupaten/kota.
4. **Sistem Administrasi, Safeguarding & Mesin Cetak A4**:
   - Penomoran referensi atomik (`DPBI/<KATEGORI>/<TAHUN>/<URUT>`).
   - Alur persetujuan Proposal sesuai *Approval Matrix* risiko & penggunaan identitas DPBI.
   - Pelaporan LKL lengkap dengan foto dokumentasi, pratinjau PDF privat, dan verifikasi koordinat *on-demand*.
   - Mesin Cetak A4 HTML/CSS (`A4PrintEngine`) siap ekspor PDF/cetak peramban untuk Proposal, LKL, Laporan Koordinator, Dokumen Resmi/SK/Sertifikat, Profil Duta, Rekap Arsip, dan Peta Wilayah.

---

## 4. Kriteria Keberhasilan Rilis

- 100% rute publik bebas dari kebocoran email pribadi, NISN, alamat rumah, nomor telepon, dan data wali.
- 12+ pengujian unit domain (`npm test`), pemeriksaan tipe (`npm run lint`), dan build produksi (`npm run build`) lolos tanpa galat.
- Verifikasi langsung melalui peramban Chromium (*desktop* & *mobile*, *light* & *dark*) lolos tanpa galat konsol atau permintaan API gagal tak tertangani.
