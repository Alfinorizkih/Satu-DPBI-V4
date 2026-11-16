# Laporan Audit & Perombakan UI/UX — SATU DPBI

Dokumen ini mencatat hasil evaluasi menyeluruh terhadap rancangan lama SATU DPBI serta perombakan arsitektur UI/UX, aksesibilitas, dan kejelasan alur kerja yang diterapkan pada versi terbaru.

---

## 1. Masalah Utama pada Rancangan Sebelumnya

1. **Batas Publik vs Internal Kurang Tegas**: Pengunjung umum yang hanya ingin mengenal DPBI atau melihat persebaran 38 provinsi langsung berhadapan dengan layar login aplikasi internal beserta switcher simulasi.
2. **Representasi Peta Wilayah Terlalu Abstrak**: Peta sebelumnya masih mengandalkan representasi sederhana tanpa batas geometris provinsi maupun *drilldown* kabupaten/kota, serta berisiko mencampuradukkan domisili Duta dengan lokasi penugasan resmi.
3. **Kelebihan Elemen Dekoratif ("Dashboard Template Syndrome")**: Penggunaan badge pil berlebih, aksen garis samping (`border-l-4`), titik berkedip (`animate-pulse`), dan angka non-tabular mengurangi keterbacaan jangka panjang untuk tugas administrasi.
4. **Ketiadaan CMS & Dokumen Siap Cetak A4**: Teks pengenalan publik dan Pusat Bantuan sebelumnya statis di kode sumber, sementara ekspor dokumen administratif (Proposal, LKL, Laporan Koordinator, Profil Duta, Rekap Arsip, SK/Sertifikat) belum memiliki mesin tata letak cetak A4 terpadu.

---

## 2. Prinsip & Standar Desain Baru (*Minimal Institutional Dashboard*)

| Aspek | Standar yang Diterapkan |
| :--- | :--- |
| **Palet Warna Resmi** | Primary `#0EA5E9` (Sky Blue), Highlight `#38BDF8`, Deep Slate `#1E293B`, Background `#F1F5F9` (terang) / Slate-950 (gelap), border netral lembut berkejelasan tinggi. |
| **Paritas Light & Dark Mode** | Seluruh permukaan, form input, modal, peta GeoJSON, tabel, dan halaman publik mendukung mode terang dan mode gelap secara konsisten lewat token `dark:` dan `@custom-variant dark`. |
| **Disiplin Tipografi & Nol Pil Statis** | Menghapus *rounded-full* status pill dekoratif yang menuh-menuhi antarmuka; menggunakan penanda teks/border terstruktur yang ringkas, seluruh angka memakai `tabular-nums`, dan teks kendali tetap satu baris bersih (`whitespace-nowrap`). |
| **Tata Letak Terpadu (`AppShell`)** | Sidebar kiri yang dapat diciutkan di desktop dengan pengelompokan 5 klaster menu sesuai RBAC, drawer responsif pada mobile (`<1024px`), serta Header kompak berisi *breadcrumb*, judul halaman, pencarian global (`Cmd/Ctrl+K`), notifikasi, pengalih tema, dan profil pengguna. |

---

## 3. Ringkasan Perombakan Struktural Per Area

1. **Pemisahan 3 Zona**:
   - Website Publik informatif (`/`, `/tentang`, `/wilayah`, `/wilayah/:code`, `/bantuan`) terpisah total dari layar `/login`.
   - Panel *Demo Account Switcher* hanya muncul pada halaman `/login` saat `DEMO_MODE=true`.
2. **Peta Nusantara GeoJSON 38 Provinsi + 517 Kabupaten/Kota**:
   - Komponen `IndonesiaMap.tsx` + `geojson.ts` merender poligon nyata Indonesia dan mendukung *drilldown* kabupaten/kota dengan pembedaan jujur **Domisili vs Penugasan**.
   - Tetap disertai tabel/daftar provinsi dan kabupaten/kota yang dapat disaring agar tidak ada pengguna yang bergantung pada klik peta saja.
3. **6 Bidang Resmi & Fokus Kerja Pengurus Nasional**:
   - `OFFICIAL_BIDANGS` terintegrasi pada halaman Tentang, Struktur Organisasi, Dashboard (`Fokus Bidang Saya`), Manajemen Pengguna, dan filter Proposal (`Hanya Bidang Saya`).
4. **Mesin Cetak A4 Terpadu (`A4PrintEngine.tsx`)**:
   - Mendukung pratinjau ukuran kertas A4 **Potret & Lanskap** lengkap dengan kop institusi resmi DPBI, metadata, tabel rapi, dan gaya cetak `@page { size: A4; margin: 12mm; }` di 7 modul utama (Wilayah, Personalia, Proposal, LKL, Laporan Koordinator, Dokumen/Sertifikat/SK, Arsip).
5. **Pengelolaan CMS & Pusat Bantuan Mandiri**:
   - Tab `/pengaturan/cms` memungkinkan tim Pengurus Bidang Media & Sekretariat memperbarui konten website publik dan artikel bantuan tanpa perlu mengubah kode sumber.
