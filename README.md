# SATU DPBI — Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia

> **Satu Sistem, Satu Data, Satu Koordinasi.**

**SATU DPBI** adalah platform administrasi, koordinasi nasional, manajemen kegiatan, pengarsipan, dan tata kelola internal resmi bagi **Duta Pelajar Berbudaya Indonesia (DPBI)** di seluruh **38 provinsi Indonesia**.

> Catatan kelembagaan: DPBI adalah organisasi pelajar independen di Indonesia dan **bukan** lembaga pemerintah. Integrasi eksternal (seperti Kemendikdasmen) berada pada status **nonaktif** secara permanen sampai terdapat MoU resmi dan kredensial API yang sah.

---

## Ringkasan Fitur Utama

- **Portal Publik & Autentikasi Aman**: Halaman masuk minimalis, lupa/reset kata sandi berbasis token sekali pakai, aktivasi undangan, deteksi sesi berakhir (`419`), persetujuan akun tertunda, serta halaman error khusus (`400`, `401`, `403`, `404`, `419`, `422`, `429`, `500`, `502`, `503`).
- **Dashboard & Aktivitas Pribadi**: Ringkasan statistik langsung dari basis data (dapat diklik ke modul terkait), panel perhatian tindakan, jadwal mendatang, serta halaman terdedikasi `/aktivitas-saya` dan `/tugas-saya`.
- **Personalia & Profil Duta**: Direktori personel, verifikasi kelengkapan profil (`0–100%`), formulir tambah/ubah dengan penjaga perubahan belum tersimpan (*unsaved changes guard*), riwayat jabatan, serta pengelolaan dokumen identitas yang dibatasi hak akses.
- **Wilayah 38 Provinsi & Angkatan**: Peta interaktif Indonesia + daftar tabel 38 provinsi, pelaporan koordinator wilayah, manajemen siklus angkatan, serta direktori & jendela akses **Alumni 30 hari** (`/alumni`).
- **Operasional Proposal, LKL & Tugas**: Alur persetujuan proposal berbasis matriks risiko, Laporan Kegiatan Lapangan (LKL) dengan pratinjau PDF/foto aman dan verifikasi koordinat, daftar tugas/Kanban/kalender, serta penguncian anti-duplikasi kirim (*double-submit lock*).
- **Pusat Dokumen, Kalender & Komunikasi**: Unggah PDF, generator sertifikat/dokumen massal dalam paket ZIP, pengumuman tersegmentasi (Nasional, Wilayah, Angkatan), notifikasi dapat diklik, dan kalender organisasi terpadu.
- **Keamanan, Perlindungan & Kontrol Sistem**: Enam peran RBAC + delegasi tugas berbatas waktu, audit log (`/audit-log`), pemantauan kesehatan & error sistem (`/status-sistem`), kontrol kuota penyimpanan, serta pencadangan & pemulihan basis data.

---

## Tumpukan Teknologi

| Lapisan | Teknologi |
|---|---|
| Frontend SPA | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React |
| Backend API | Node.js (>= 22), Express 4, Multer, Cookie-Parser, jsPDF, JSZip |
| Basis Data Lokal / Staging | SQLite (`node:sqlite` bawaan Node.js 22+, mode WAL & Foreign Keys aktif) |
| Skema Produksi Relasional | `database/schema_mysql.sql` (MySQL / MariaDB InnoDB `utf8mb4_unicode_ci`) |
| Pengujian Unit | `node:test` + `tsx` (`npm test`) |

---

## Cara Menjalankan di Lingkungan Lokal

### Prasyarat
- Node.js versi **22.x** atau lebih baru (diperlukan untuk modul `node:sqlite`).
- npm versi 10+.

### Langkah Instalasi

```bash
# 1. Pasang dependensi
npm install

# 2. Salin templat konfigurasi lingkungan
cp .env.example .env

# 3. Jalankan server pengembangan (port 3000)
npm run dev
```

Buka `http://localhost:3000` di peramban.

### Perintah NPM Tersedia

| Perintah | Fungsi |
|---|---|
| `npm run dev` | Menjalankan backend Express + middleware Vite dev server di port `3000` |
| `npm run lint` | Memeriksa tipe TypeScript (`tsc --noEmit`) di seluruh proyek |
| `npm test` | Menjalankan pengujian unit logika domain, RBAC, dan router (`tsx --test src/lib/domain.test.ts`) |
| `npm run build` | Membangun frontend (`dist/`) dan bundel server (`server.js`) untuk produksi |
| `npm start` | Menjalankan bundel produksi (`NODE_ENV=production node server.js`) |
| `npm run package:zip` | Mengemas arsip rilis bersih `satu-dpbi-paket-final.zip` tanpa `node_modules`, `.db`, atau `.env` |

---

## Struktur Folder Proyek

```text
.
├── .github/workflows/ci.yml        # Pipeline CI otomatis (lint, test, build)
├── database/schema_mysql.sql       # Skema lengkap MySQL/MariaDB siap cPanel/VPS
├── public/assets/aistudio/         # Aset statis publik (logo resmi DPBI)
├── scripts/create-release-zip.mjs  # Skrip pembuat paket rilis ZIP bersih
├── server/
│   ├── db.ts                       # Inisialisasi SQLite WAL, migrasi ringan, dan direktori storage
│   ├── routes.ts                   # Endpoint autentikasi, sesi, personalia, wilayah, proposal, LKL
│   ├── routes_modules.ts           # Endpoint tugas, dokumen, komunikasi, sistem, pengaturan, ekspor
│   ├── security.ts                 # Scrypt hash, rotasi sesi, rate limit, Origin/CORS check, audit log
│   └── seed.ts                     # Data awal 38 provinsi & akun simulasi (khusus DEMO_MODE=true)
├── server.ts                       # Entrypoint server Express + CORS + security headers + SPA fallback
├── src/
│   ├── components/
│   │   ├── ui/                     # Design System terpusat (Button, FormControls, DataDisplay, Overlay, Feedback, DocumentPreview)
│   │   ├── AppShell.tsx            # Kerangka layout utama (Sidebar dapat diciutkan, Header, Drawer Mobile)
│   │   └── CommandPalette.tsx      # Pencarian global & navigasi cepat (Ctrl/Cmd + K)
│   ├── context/AuthContext.tsx     # State autentikasi, tema terang/gelap, izin RBAC, & recent pages
│   ├── hooks/useUnsavedChanges.ts  # Hook penjaga formulir belum tersimpan
│   ├── lib/
│   │   ├── api.ts                  # Klien HTTP terpadu (credentials: include, VITE_API_BASE_URL, 419 handling)
│   │   ├── provinces.ts            # Daftar resmi 38 provinsi Indonesia
│   │   ├── rbac.ts                 # Matriks RBAC, delegasi, matriks proposal, & kalkulator alumni 30 hari
│   │   ├── routes.ts               # Router URL bersih & berparameter
│   │   └── types.ts                # Definisi tipe TypeScript bersama
│   ├── pages/                      # Seluruh halaman modul aplikasi
│   └── App.tsx                     # Root router & ErrorBoundary
├── vercel.json                     # Konfigurasi SPA rewrite & header keamanan Vercel
└── .env.example                    # Daftar variabel lingkungan tanpa rahasia
```

---

## Indeks Dokumentasi Lengkap

1. [Panduan Pengguna (`PANDUAN_PENGGUNA.md`)](./PANDUAN_PENGGUNA.md)
2. [Panduan Administrator & Super Admin (`PANDUAN_ADMIN.md`)](./PANDUAN_ADMIN.md)
3. [Panduan Keamanan & Tata Kelola Sesi (`PANDUAN_KEAMANAN.md`)](./PANDUAN_KEAMANAN.md)
4. [Panduan Backup & Restore (`PANDUAN_BACKUP_RESTORE.md`)](./PANDUAN_BACKUP_RESTORE.md)
5. [Arsitektur Sistem (`ARSITEKTUR_SISTEM.md`)](./ARSITEKTUR_SISTEM.md)
6. [Struktur Basis Data (`STRUKTUR_DATABASE.md`)](./STRUKTUR_DATABASE.md)
7. [Panduan Pembaruan & Rilis (`PANDUAN_PEMBARUAN.md`)](./PANDUAN_PEMBARUAN.md)
8. [Panduan Troubleshooting (`PANDUAN_TROUBLESHOOTING.md`)](./PANDUAN_TROUBLESHOOTING.md)
9. [Panduan Deployment GitHub → Vercel → Domainesia → ArenHost (`PANDUAN_DEPLOYMENT_SATU_DPBI.md`)](./PANDUAN_DEPLOYMENT_SATU_DPBI.md)
10. [Catatan Perubahan (`CHANGELOG.md`)](./CHANGELOG.md)
11. [Laporan Pengujian (`LAPORAN_PENGUJIAN.md`)](./LAPORAN_PENGUJIAN.md)
