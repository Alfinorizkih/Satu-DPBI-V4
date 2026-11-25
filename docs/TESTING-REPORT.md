# Laporan Pengujian Teknis — SATU DPBI

Laporan ini merangkum seluruh pengujian otomatis dan verifikasi browser langsung yang dijalankan **setelah perubahan kode terakhir**.

---

## 1. Ringkasan Eksekusi Akhir

| Jenis Pengujian | Perintah / Alat | Hasil | Cakupan |
|---|---|---|---|
| **Pemeriksaan Tipe (`lint`)** | `npm run lint` (`tsc --noEmit`) | **LULUS** (0 galat) | Seluruh kode sumber TypeScript klien (`src/`) dan server (`server/`). |
| **Build Produksi** | `npm run build` (`vite build` + `esbuild server.ts`) | **LULUS** | Bundel frontend `dist/` dan entry server produksi `server.js`. |
| **Audit Dependensi** | `bun audit` | **LULUS** (0 kerentanan) | 341 paket pada `bun.lock`. |
| **Unit & Integration Test Suite** | `npx --yes tsx --test src/lib/domain.test.ts server/api.security.test.ts` | **LULUS** (**20/20** sub-tes) | Logika domain/RBAC/CSV/templat email (16 sub-tes) + API keamanan, sesi, IDOR, alur kerja terhubung & Pusat Email (4 sub-tes integrasi). |
| **Pemeriksaan Kesehatan Server** | `GET /api/health` (`http://localhost:3000/api/health`) | **LULUS** | HTTP 200 JSON `{"ok":true,"service":"SATU DPBI","mode":"DEMO_SIMULASI"}`. |
| **Verifikasi Browser Langsung (Putaran 1 & Putaran 2)** | Chromium Headless (`playwright-cli`) | **LULUS** (0 galat konsol) | Desktop `1440x900` (Light & Dark Mode) dan Mobile `390x844` (`overflow390: false`), melintasi `/login`, `/dashboard`, `/persetujuan`, `/email`, `/proposal`, `/laporan-kegiatan`, `/laporan-koordinator`, `/pengaturan/pengguna`, `/pengaturan`. |

---

## 2. Rincian Suite Pengujian Otomatis (`20/20 LULUS`)

### A. Pengujian Unit Domain (`src/lib/domain.test.ts` — 16 sub-tes)
1. Dukungan penuh 38 provinsi resmi Indonesia.
2. Validasi 6 Bidang resmi Pengurus Nasional dan pencocokan proposal.
3. Pemisahan domisili vs penugasan Duta dan cakupan Koordinator pada Kabupaten/Kota.
4. Sanitasi payload statistik publik terhadap bendera privasi.
5. Perhitungan bounding box dan proyeksi SVG GeoJSON.
6. Isolasi RBAC Duta & Alumni terhadap modul nasional/sistem.
7. Jendela masa aktif delegasi sementara.
8. Perutean persetujuan proposal melalui Approval Matrix.
9. Verifikasi koordinat lokasi Koordinator Wilayah terhadap batas provinsi.
10. Kalkulasi masa akses arsip Alumni 30 hari.
11. Kelengkapan profil & generator nomor referensi `DPBI/[KATEGORI]/[TAHUN]/[URUTAN]`.
12. Router bersih untuk rute publik, CMS, deep link, dan basis navigasi aktif.
13. `hasScopedPermission` memblokir aksi Koordinator lintas provinsi dan menegakkan cakupan provinsi pada delegasi.
14. `csvSafeCell` menetralkan sel awalan formula spreadsheet (`=`, `+`, `-`, `@`, tab, CR) serta tanda kutip.
15. Validasi dan rendering variabel templat email hanya mengizinkan variabel resmi DPBI.
16. Perutean dan batas hak akses `BASE_ROLE_PERMISSIONS` untuk `/persetujuan` dan `/email`.

### B. Pengujian Keamanan & Alur Kerja Terhubung API (`server/api.security.test.ts` — 4 sub-tes integrasi SQLite terisolasi)
1. **Autentikasi, Kebijakan Sesi & Lockout**: Verifikasi batas TTL sesi maksimal 24 jam, penolakan TTL > 24 jam, inspeksi sesi aktif pengguna oleh Super Admin, pemutusan paksa seluruh sesi sehingga token lama mendapat `419`, dan penguncian `429` setelah 5 kali kegagalan login berturut-turut.
2. **Isolasi IDOR & RBAC Lintas Peran/Provinsi**: Verifikasi `duta` diblokir membaca `audit_logs` & berkas privat pengguna lain (`403`), `koordinator_wilayah` Jawa Barat diblokir meninjau proposal provinsi Bali (`403`), sementara Koordinator menerima akses hanya setelah delegasi dengan provinsi yang cocok aktif.
3. **Alur Kerja Terhubung End-to-End**: `POST /api/proposals/check-duplicate` -> pengajuan & persetujuan proposal -> pembuatan otomatis 1 agenda kalender + 4 checklist tugas -> sinkronisasi perubahan jadwal proposal ke kalender -> validasi LKL wajib menautkan proposal berstatus `disetujui` -> permintaan revisi LKL & persetujuan LKL menandai tugas `dokumentasi`/`pelaporan` sebagai `selesai` -> revisi & pengiriman ulang Laporan Koordinator -> persetujuan Permintaan Akun menghasilkan token undangan aktivasi yang valid -> analitik dashboard lintas jendela `7`, `30`, dan `90` hari.
4. **Pusat Email**: Pratinjau audiens terdeduplikasi, penolakan variabel templat tidak dikenal (`400`), pembatasan peran terhadap `email:publish`, pengiriman `sandbox_outbox`, pembuatan & pembatalan kampanye terjadwal (`409` bila sudah terkirim), retry log gagal, dan proteksi formula pada ekspor log CSV.

---

## 3. Verifikasi Visual & Perbaikan Browser (Putaran 1 -> Putaran 2)
- **Putaran 1**: Memeriksa desktop Light/Dark Mode `/dashboard`, `/persetujuan`, `/email`, `/proposal`, `/laporan-kegiatan`, `/laporan-koordinator`, `/pengaturan/pengguna`, `/pengaturan`, serta mobile `390x844`. Ditemukan: (1) tab filter `/persetujuan` sempat meluap horizontal (`scrollWidth = 428` pada lebar `390px`), (2) angka fallback sintetis `14.5 jam` pada jendela analitik `7 Hari` saat belum ada keputusan, (3) pemisah `•` di awal ringkasan LKL daring tanpa nama kabupaten/kota, dan (4) tabel `email_templates` perlu terisi pada database demo lama.
- **Putaran 2 (Pasca-Perbaikan)**: Setelah seluruh perbaikan diterapkan, diuji ulang:
  - `npx --yes tsx --test src/lib/domain.test.ts server/api.security.test.ts` (**20/20 lulus**), `compile_applet` + `lint_applet` (**lulus**).
  - Pada browser nyata: tab `Templat Resmi (4)` muncul di `/email`, tab filter `/persetujuan` terbungkus rapi di layar `390x844` (`w390_scroll: 390`, `overflow390: false`), `console` melaporkan `Errors: 0, Warnings: 0`.
  - Catatan kecil: pada layar ultra-sempit `320px` terdapat `scrollWidth: 376` (`overflow320: true`) di halaman filter tabel karena lebar teks opsi dropdown `<select>`; viewport standar ponsel (`390x844`) bersih tanpa luapan horizontal.
