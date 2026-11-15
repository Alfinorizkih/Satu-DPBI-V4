# Laporan Pengujian & Audit Kualitas — SATU DPBI

Dokumen ini mencatat hasil verifikasi teknis dan pengujian fungsional yang dijalankan **setelah perubahan kode terakhir** pada platform **SATU DPBI**. Seluruh status dilaporkan secara objektif menggunakan label **LULUS**, **GAGAL**, atau **BELUM DIUJI**.

---

## 1. Ringkasan Eksekutif

| Kategori Pengujian | Metode | Status | Keterangan |
|---|---|---|---|
| Pemeriksaan Tipe TypeScript (`npm run lint`) | `tsc --noEmit` | **LULUS** | 0 galat tipe di seluruh `src/` dan `server/`. |
| Build Produksi (`npm run build`) | Vite 8 + esbuild (`compile_applet`) | **LULUS** | Berhasil menghasilkan `dist/` dan `server.js`. |
| Pengujian Unit Logika Domain & Router (`npm test`) | `tsx --test src/lib/domain.test.ts` | **LULUS** | **8 dari 8** sub-tes lulus (38 provinsi, RBAC, delegasi, approval matrix, verifikasi koordinat, kalkulator alumni 30 hari, kelengkapan profil + nomor surat, router bersih & deep link). |
| Uji Kesehatan API (`/api/health`) | `curl http://localhost:3000/api/health` | **LULUS** | Mengembalikan HTTP 200 JSON `ok: true`, `service: "SATU DPBI"`. |
| Uji UI/UX, Navigasi, RBAC & Responsivitas Browser Nyata | Chromium Headless (`playwright-cli`) | **LULUS** | 0 galat konsol (`console error`), 0 kegagalan `/api/*` pasca-perbaikan `/alumni`, diuji pada desktop `1440x900` & seluler `390x844`. |
| Pengemasan Arsip Rilis Bersih (`npm run package:zip`) | `scripts/create-release-zip.mjs` | **LULUS** | Menghasilkan `satu-dpbi-paket-final.zip` tanpa `node_modules/`, `.db`, `.env`, atau `.git/`. |
| Deployment Langsung Eksternal (GitHub, Vercel, Domainesia, ArenHost) | Infrastruktur Eksternal | **BELUM DIUJI** | Memerlukan kredensial akun produksi, domain, dan server hosting milik organisasi DPBI. |

---

## 2. Rincian Hasil Pengujian Lokal & Browser

### A. Pengujian Unit (`src/lib/domain.test.ts`)
1. Dukungan resmi 38 provinsi Indonesia (`getProvinceCount() === 38`) — **LULUS**
2. Isolasi hak akses RBAC Duta, Alumni, dan Sekretariat Nasional — **LULUS**
3. Delegasi kewenangan sementara aktif & otomatis gugur di luar rentang tanggal — **LULUS**
4. Matriks perutean penyetuju proposal berdasarkan risiko & identitas DPBI — **LULUS**
5. Verifikasi koordinat LKL terhadap batas geografis provinsi — **LULUS**
6. Kalkulasi jendela akses arsip Alumni 30 hari & tahap pengingat H-7 — **LULUS**
7. Perhitungan kelengkapan profil & format penomoran surat `DPBI/PROP/2026/0042` — **LULUS**
8. Router URL bersih (`matchPrivateRoute`, `normalizePathname`, `resolveBaseNavPath`) & proteksi *path traversal* — **LULUS**

### B. Pengujian Browser Nyata (`playwright-cli` di `http://localhost:3000`)
1. **Portal Login & Mode Simulasi (`1440x900`)**: Tata letak institusional, logo resmi DPBI, statistik publik, dan tombol demo render bersih tanpa galat konsol — **LULUS**
2. **Proteksi Rute Privat & Redirect Pasca-Login**: Akses `/aktivitas-saya` dan `/alumni` tanpa sesi menampilkan halaman **401 Autentikasi Diperlukan**, dan setelah login berhasil langsung diarahkan ke URL tujuan awal — **LULUS**
3. **Deep Link & Reload Halaman (`F5`)**: Pengujian langsung + reload penuh pada `/aktivitas-saya`, `/tugas-saya`, `/alumni`, `/audit-log`, `/status-sistem`, `/pengaturan/sesi`, `/pengaturan/hak-akses`, `/personalia/per-101`, `/wilayah`, `/angkatan` — **LULUS**
4. **Penjaga Perubahan Belum Tersimpan (`useUnsavedChanges`)**: Mengisi judul pada `/proposal/baru` lalu menutup dialog memunculkan dialog konfirmasi **"Batalkan Perubahan Proposal?"** sebelum membuang perubahan — **LULUS**
5. **Isolasi RBAC Sisi Antarmuka & Halaman Error**: Login sebagai Duta lalu membuka `/audit-log` dan `/pengaturan/pengguna` menampilkan **403 Akses Ditolak**; rute `/error/419` dan rute tidak dikenal menampilkan **419 Sesi Berakhir** dan **404** — **LULUS**
6. **Mode Terang & Mode Gelap**: Peralihan tema pada `/aktivitas-saya` menerapkan kelas `dark` dengan kontras terbaca — **LULUS**
7. **Responsivitas Seluler (`390x844`)**: Pemeriksaan pada `/dashboard`, `/personalia`, dan `/alumni` memastikan tata letak rapi tanpa luapan horizontal (`scrollWidth <= innerWidth`) — **LULUS**
8. **Temuan & Perbaikan Selama Pengujian**: Pada putaran QA browser awal ditemukan `AlumniPage.tsx` memanggil `/api/archives` (HTTP 404). Telah diperbaiki ke `/api/archive`, `/api/personnel`, dan `/api/archive/alumni/:userId/extend`, kemudian dikompilasi ulang dan diverifikasi kembali dengan hasil **0 galat konsol** dan **0 respons API gagal** — **LULUS**

---

## 3. Daftar Item Belum Diuji (Lingkungan Produksi Eksternal)

Item berikut hanya dapat diverifikasi saat organisasi melakukan tahap deployment produksi sesuai `PANDUAN_DEPLOYMENT_SATU_DPBI.md`:
- Push repositori ke akun GitHub organisasi DPBI & eksekusi workflow CI pada runner GitHub — **BELUM DIUJI**
- Build & penayangan SPA pada akun Vercel produksi beserta SSL & `VITE_API_BASE_URL` — **BELUM DIUJI**
- Propagasi DNS `A`/`CNAME` pada panel Domainesia — **BELUM DIUJI**
- Pengaktifan proses Node.js, impor `database/schema_mysql.sql`, serta uji cookie lintas subdomain HTTPS pada server/VPS ArenHost — **BELUM DIUJI**
