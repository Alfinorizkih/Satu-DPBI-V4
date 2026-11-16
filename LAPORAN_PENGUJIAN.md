# Laporan Pengujian & Audit Kualitas — SATU DPBI

Dokumen ini mencatat hasil verifikasi teknis dan pengujian fungsional yang dijalankan **setelah perubahan kode terakhir** pada platform **SATU DPBI** (*Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia*). Seluruh status dilaporkan secara objektif menggunakan label **LULUS**, **GAGAL**, atau **BELUM DIUJI**.

---

## 1. Ringkasan Eksekutif

| Kategori Pengujian | Metode | Status | Keterangan |
|---|---|---|---|
| Pemeriksaan Tipe TypeScript (`npm run lint`) | `tsc --noEmit` | **LULUS** | 0 galat tipe di seluruh `src/` dan `server/`. |
| Build Produksi (`npm run build`) | Vite 8 + esbuild (`compile_applet`) | **LULUS** | Berhasil mengompilasi bundel klien `dist/` dan server produksi `server.js`. |
| Pengujian Unit Logika Domain & Router (`npm test`) | `npx --yes tsx --test src/lib/domain.test.ts` | **LULUS** | **12 dari 12** sub-tes lulus (38 provinsi, 6 Bidang resmi, pemisahan domisili vs penugasan Kab/Kota, sanitasi statistik publik, bounding box & proyeksi GeoJSON, RBAC, delegasi, approval matrix, verifikasi koordinat, kalkulator alumni 30 hari, kelengkapan profil + nomor surat, dan router URL bersih). |
| Uji Kesehatan API (`/api/health`) | `curl http://localhost:3000/api/health` | **LULUS** | Mengembalikan HTTP 200 JSON `{"ok":true,"service":"SATU DPBI","mode":"DEMO_SIMULASI"}`. |
| Uji UI/UX, Peta GeoJSON, CMS, RBAC & Responsivitas Browser Nyata (Putaran 1 & 2) | Chromium Headless (`playwright-cli`) | **LULUS** | **0 galat konsol** (`Errors: 0`), diuji pada desktop `1440x900` dan seluler `390x844` tanpa luapan horizontal (`scrollWidth <= innerWidth`). |
| Kelengkapan Dokumentasi (`/docs/` + Root) | Audit Direktori | **LULUS** | 17 dokumen teknis & panduan di `docs/` plus `README.md`, `CHANGELOG.md`, `LAPORAN_PENGUJIAN.md`, dan `PANDUAN_DEPLOYMENT_SATU_DPBI.md`. |
| Pengemasan Arsip Rilis Bersih (`npm run package:zip`) | `scripts/create-release-zip.mjs` | **LULUS** | Menghasilkan `satu-dpbi-paket-final.zip` yang telah diverifikasi bebas `node_modules/`, `.db*`, `.env`, `dist/`, `storage/`, dan `.playwright-cli/`. |
| Deployment Langsung Eksternal (GitHub, Vercel, Domainesia, ArenHost) | Infrastruktur Eksternal | **BELUM DIUJI** | Memerlukan kredensial akun produksi, domain, dan server hosting Node.js/MySQL milik organisasi DPBI. |

---

## 2. Rincian Hasil Pengujian Unit (`src/lib/domain.test.ts`)

Seluruh **12 sub-tes** pada `npx --yes tsx --test src/lib/domain.test.ts` lulus (`pass 12`, `fail 0`):

1. `supports all 38 official Indonesian provinces` (`getProvinceCount() === 38`) — **LULUS**
2. `defines all 6 official national Bidang and matches proposals accurately` (`OFFICIAL_BIDANGS`, 6 Bidang resmi tanpa duplikasi Kemendikdasmen aktif) — **LULUS**
3. `distinguishes Duta domicile vs assignment vs coordinator/activity coverage in regencies` — **LULUS**
4. `sanitizes public statistics payload based on privacy approval flag` (nol PII pada payload publik) — **LULUS**
5. `computes GeoJSON bounding boxes and SVG path projections faithfully` — **LULUS**
6. `RBAC isolates Duta and Alumni from national system/command center actions` — **LULUS**
7. `Delegation grants temporary permission only within active date window` — **LULUS**
8. `Approval matrix routes proposals accurately without overloading Super Admin` — **LULUS**
9. `Coordinator province coordinate verification accurately checks boundaries` — **LULUS**
10. `Alumni 30-day archive window calculates reminders and expiration accurately` — **LULUS**
11. `Profile completeness & reference number generator produce exact institutional values` (`DPBI/PROP/2026/0042`) — **LULUS**
12. `Clean parameterized router resolves public paths, CMS route, deep links, and active nav bases safely` — **LULUS**

---

## 3. Rincian Pengujian Browser Nyata (`playwright-cli` di `http://localhost:3000`)

### A. Putaran 1 — Pemisahan 3 Zona, Peran Bidang & Responsivitas
1. **Zona 1 Website Publik (`/`, `/tentang`, `/wilayah`, `/bantuan`)**: Tampil sebagai halaman publik institusional independen dengan logo resmi DPBI, nol PII peserta didik, tanpa Demo Switcher di beranda, serta toggle mode terang/gelap konsisten (`1440x900`) — **LULUS**
2. **Responsivitas Seluler (`390x844`)**: Navigasi drawer dan kartu informasi pada `/` terender rapi tanpa luapan horizontal (`scrollWidth === innerWidth`) — **LULUS**
3. **Zona 2 Portal Masuk (`/login`)**: Demo Switcher terisolasi khusus di `/login`, formulir masuk dan tautan pemulihan kata sandi/aktivasi undangan berjalan lancar — **LULUS**
4. **Pengurus Nasional per Bidang (`/dashboard`, `/proposal`)**: Filter `Fokus Bidang Saya` dan `Hanya Bidang Saya` menyaring antrean sesuai Bidang Pendidikan & Kebudayaan — **LULUS**
5. **Super Admin (`/wilayah`, `/personalia/tambah`, `/tugas`, `/dokumen`, `/pengaturan/cms`)**: Seluruh rute utama terbuka tanpa galat konsol — **LULUS**

### B. Temuan Kritik Putaran 1 & Perbaikan Sebelum Putaran 2
1. **Kontrol Orientasi Cetak A4 (`A4PrintEngine.tsx`)**: Mengganti tombol siklus tunggal menjadi tombol tersegmentasi eksplisit **A4 Potret** dan **A4 Lanskap** dengan atribut `aria-pressed` agar orientasi dapat dipilih langsung (dan berlaku penuh termasuk pada pratinjau sertifikat).
2. **Padding Kanan Dropdown `<select>` (`PublicRegionsPage.tsx`, `RegionsPage.tsx`, `SystemAndSettingsPages.tsx`)**: Menambah `pl-3 pr-8` serta `min-w` proporsional agar ikon panah bawaan browser tidak menumpuk teks `"Semua Kepulauan"` maupun `"Tampilkan Jumlah Agregat Duta"`.
3. **Atribut Eksplisit Kode GeoJSON (`IndonesiaMap.tsx`)**: Menambahkan `data-province-code` dan `data-regency-code` pada elemen `<g>` SVG untuk mempermudah inspeksi aksesibilitas dan pengujian drilldown.
4. **Baris Tab Pengaturan & Tinggi Textarea CMS (`SystemAndSettingsPages.tsx`)**: Merapikan label 8 tab agar muat sempurna dalam satu baris horizontal pada `1440px` tanpa terpotong di tepi kanan, serta memperbesar `<textarea rows={5}>` pada editor CMS agar teks multi-paragraf terbaca utuh.

### C. Putaran 2 — Verifikasi Pasca-Perbaikan
1. **Drilldown Peta GeoJSON (`/wilayah`, `1440x900`)**: Klik provinsi Jawa Barat (`[data-province-code="32"]`) lalu klik `Buka Peta Kabupaten/Kota` merender seluruh 27 poligon Kab/Kota secara akurat; padding dropdown `"Semua Kepulauan"` lega — **LULUS**
2. **Pratinjau Cetak A4 (`A4PrintModal` pada `/proposal/prop-1`)**: Tombol **A4 Potret** dan **A4 Lanskap** tampil berdampingan, mengaktifkan status `aria-pressed="true"` saat diklik dan mengubah lebar lembar A4 ke mode lanskap — **LULUS**
3. **Formulir Personalia Bertingkat (`/personalia/tambah` Langkah `2. Pendidikan & Domisili`)**: Dropdown berjenjang Provinsi, Kabupaten/Kota, Kecamatan, Desa/Kelurahan beserta opsi input manual terender bersih — **LULUS**
4. **Alur CMS Live & Tata Letak Tab Pengaturan (`/pengaturan/cms` -> `/`)**: Penyuntingan `hero_subtitle` disimpan via UI, langsung tayang di halaman depan `/`, lalu dipulihkan kembali ke teks institusional baku; seluruh 8 tab pengaturan muat dalam 1 baris tanpa overflow (`tabOverflow: false`) dan 0 galat konsol — **LULUS**

---

## 4. Daftar Item Belum Diuji (Lingkungan Produksi Eksternal)

Item berikut hanya dapat diverifikasi saat organisasi melakukan tahap deployment produksi sesuai `docs/DEPLOYMENT.md` dan `docs/DEPLOYMENT-ARENHOST.md`:
- Push repositori ke akun GitHub organisasi DPBI & eksekusi workflow CI pada runner GitHub — **BELUM DIUJI**
- Build & penayangan SPA pada akun Vercel produksi beserta SSL & `VITE_API_BASE_URL` — **BELUM DIUJI**
- Propagasi DNS `A`/`CNAME` pada panel Domainesia — **BELUM DIUJI**
- Pengaktifan proses Node.js (`>= 22.x`), impor `database/schema_mysql.sql`, serta uji cookie lintas subdomain HTTPS pada server/VPS ArenHost — **BELUM DIUJI**
