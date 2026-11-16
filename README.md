# SATU DPBI — Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia

> **Satu Sistem, Satu Data, Satu Koordinasi.**  
> Semangat Gerakan DPBI: **Berbudaya, Bergerak, dan Berdampak Untuk Negeri.**

**SATU DPBI** adalah platform informasi publik, administrasi terpadu, koordinasi wilayah 38 provinsi dan kabupaten/kota, manajemen kegiatan, serta tata kelola internal resmi bagi **Duta Pelajar Berbudaya Indonesia (DPBI)**.

> **Catatan Kelembagaan**: DPBI adalah organisasi kepemimpinan dan literasi budaya pelajar yang beroperasi secara **independen** dan **bukan** lembaga pemerintah. Integrasi eksternal (seperti Kemendikdasmen) dikunci pada status **`nonaktif`** secara permanen hingga tersedia MoU resmi dan kredensial API yang sah.

---

## Tiga Zona Aplikasi & Fitur Utama

1. **Website Publik DPBI (`/`, `/tentang`, `/wilayah`, `/wilayah/:code`, `/bantuan`)**:
   - Pengenalan organisasi, visi-misi, struktur 6 Bidang Pengurus Nasional (`OFFICIAL_BIDANGS`), serta pengumuman publik terpilih (`is_public = 1`).
   - **Peta Nusantara GeoJSON Nyata**: 38 provinsi dengan *drilldown* batas poligon ~517 kabupaten/kota, pembedaan jujur Duta Domisili vs Penugasan, disertai daftar tabel & filter agar akses mudah di seluruh perangkat.
   - **Zero PII Publik**: Data pribadi pelajar (NISN, alamat rumah, nomor telepon, kontak wali) tidak pernah diekspos pada endpoint publik.
2. **Portal Autentikasi Aman (`/login`, `/lupa-password`, `/reset-password`, `/aktivasi`, `/verifikasi-undangan`)**:
   - Cookie `HttpOnly` + `SameSite`, rotasi ID sesi saat ganti kata sandi, deteksi sesi kedaluwarsa (`HTTP 419`), *rate limiting* anti brute-force (`HTTP 429`), token sekali pakai, serta *Demo Switcher* khusus `DEMO_MODE=true`.
3. **Portal Administrasi Internal (RBAC 8 Peran + 6 Bidang + Mesin Cetak A4)**:
   - Dashboard berbasis peran & Fokus Bidang, Direktori & Verifikasi Personalia (lokasi bertingkat 4 level + deteksi duplikasi), Proposal + *Approval Matrix* + versi PDF, LKL (Daring/Luring) + foto/PDF + verifikasi koordinat *on-demand*, Laporan Bulanan & Akhir Koordinator, Task Management + lampiran + Kanban/Kalender, Pusat Dokumen + Generator Massal PDF/ZIP, Perlindungan Peserta (*Safeguarding* U18 & *Whistleblowing*), Evaluasi, Arsip & Jendela Alumni **30 Hari**, CMS Publik (`/pengaturan/cms`), Kontrol Storage, Backup ZIP + Validasi SHA-256, dan **Mesin Cetak A4** (`A4PrintEngine`).

---

## Tumpukan Teknologi

| Lapisan | Teknologi |
| :--- | :--- |
| **Frontend SPA** | React 19, TypeScript, Vite 8, Tailwind CSS v4, Lucide React, Recharts |
| **Peta & Cetak** | GeoJSON lokal 38 provinsi & 517 kab/kota (`public/maps/`), SVG Projector, HTML/CSS `@page A4` Print Engine |
| **Backend API** | Node.js (>= 22), Express 4, Multer, Cookie-Parser, jsPDF, JSZip |
| **Basis Data** | SQLite Mode WAL (`node:sqlite` bawaan Node.js 22+); disertai skema MySQL/MariaDB di `database/schema_mysql.sql` |
| **Pengujian** | `node:test` + `tsx` (`npm test`), TypeScript (`npm run lint`), Chromium headless verification |

---

## Menjalankan di Lingkungan Lokal

```bash
# 1. Pasang dependensi (membutuhkan Node.js >= 22 dan npm 10+)
npm install

# 2. Salin konfigurasi lingkungan contoh
cp .env.example .env

# 3. Jalankan server pengembangan di http://localhost:3000
npm run dev
```

### Daftar Perintah NPM

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server Express + middleware Vite dev server di port `3000` |
| `npm run lint` | Memeriksa tipe TypeScript (`tsc --noEmit`) di seluruh proyek |
| `npm test` | Menjalankan 12+ pengujian unit logika domain, RBAC, GeoJSON, & router (`tsx --test src/lib/domain.test.ts`) |
| `npm run build` | Membangun frontend (`dist/`) dan bundel backend (`server.js`) siap produksi |
| `npm start` | Menjalankan bundel produksi (`NODE_ENV=production node server.js`) |
| `npm run package:zip` | Mengemas arsip rilis bersih `satu-dpbi-paket-final.zip` |

---

## Struktur Direktori Utama

```text
.
├── .github/workflows/ci.yml        # Pipeline CI otomatis (lint, test, build)
├── database/schema_mysql.sql       # Skema relasional MySQL/MariaDB (InnoDB)
├── docs/                           # Dokumentasi arsitektur, RBAC, API, deployment, & panduan peran
├── public/
│   ├── assets/aistudio/            # Aset gambar & logo resmi DPBI
│   └── maps/                       # GeoJSON 38 provinsi + 38 berkas kabupaten/kota + indeks BPS
├── scripts/create-release-zip.mjs  # Pengemas rilis ZIP bersih
├── server/                         # Backend SQLite, keamanan, seed, API inti & modul CMS
├── server.ts                       # Entrypoint Express 4 + CORS + security headers + SPA
└── src/
    ├── components/
    │   ├── print/A4PrintEngine.tsx # Mesin Pratinjau & Cetak Dokumen A4 (Potret/Lanskap)
    │   ├── IndonesiaMap.tsx        # Peta GeoJSON Interaktif 38 Provinsi & Drilldown Kab/Kota
    │   ├── AppShell.tsx            # Kerangka layout internal (Sidebar, Header, Mobile Drawer)
    │   └── ui/                     # Design System terpusat (Button, FormControls, DataDisplay, Overlay, Feedback)
    ├── lib/                        # api.ts, rbac.ts (6 Bidang), geojson.ts, provinces.ts, routes.ts, domain.test.ts
    └── pages/                      # Seluruh halaman Website Publik, Auth, & Modul Internal
```

---

## Indeks Dokumentasi Lengkap

### Dokumentasi Teknis & Tata Kelola (`/docs/`)
1. [Product Requirements Document (`docs/PRD.md`)](./docs/PRD.md)
2. [Arsitektur Sistem (`docs/ARCHITECTURE.md`)](./docs/ARCHITECTURE.md)
3. [Struktur Basis Data (`docs/DATABASE.md`)](./docs/DATABASE.md)
4. [Matriks RBAC, 6 Bidang & Delegasi (`docs/RBAC.md`)](./docs/RBAC.md)
5. [Referensi Endpoint API (`docs/API.md`)](./docs/API.md)
6. [Alur Kerja Operasional (`docs/WORKFLOWS.md`)](./docs/WORKFLOWS.md)
7. [Keamanan & Manajemen Sesi (`docs/SECURITY.md`)](./docs/SECURITY.md)
8. [Perlindungan Data Pribadi & Safeguarding (`docs/DATA-PROTECTION.md`)](./docs/DATA-PROTECTION.md)
9. [Sumber Data Peta & Lisensi (`docs/MAP-DATA-SOURCES.md`)](./docs/MAP-DATA-SOURCES.md)
10. [Panduan Deployment Produksi (`docs/DEPLOYMENT.md`)](./docs/DEPLOYMENT.md)
11. [Panduan Deployment ArenHost (`docs/DEPLOYMENT-ARENHOST.md`)](./docs/DEPLOYMENT-ARENHOST.md)
12. [Panduan Backup & Restore (`docs/BACKUP-RESTORE.md`)](./docs/BACKUP-RESTORE.md)
13. [Panduan Pengguna: Duta & Alumni (`docs/USER-GUIDE-DUTA.md`)](./docs/USER-GUIDE-DUTA.md)
14. [Panduan Pengguna: Koordinator Wilayah (`docs/USER-GUIDE-KORWIL.md`)](./docs/USER-GUIDE-KORWIL.md)
15. [Panduan Pengguna: Admin & Pengurus Nasional (`docs/USER-GUIDE-ADMIN.md`)](./docs/USER-GUIDE-ADMIN.md)
16. [Laporan Audit & Perombakan UI/UX (`docs/UI-UX-AUDIT.md`)](./docs/UI-UX-AUDIT.md)
17. [Panduan Serah Terima (`docs/HANDOVER_GUIDE.md`)](./docs/HANDOVER_GUIDE.md)

### Dokumentasi Operasional Root
- [Catatan Perubahan (`CHANGELOG.md`)](./CHANGELOG.md)
- [Laporan Pengujian Terbaru (`LAPORAN_PENGUJIAN.md`)](./LAPORAN_PENGUJIAN.md)
- Panduan Pendamping Bahasa Indonesia: `PANDUAN_PENGGUNA.md`, `PANDUAN_ADMIN.md`, `PANDUAN_KEAMANAN.md`, `PANDUAN_BACKUP_RESTORE.md`, `PANDUAN_DEPLOYMENT_SATU_DPBI.md`, `ARSITEKTUR_SISTEM.md`, `STRUKTUR_DATABASE.md`, `PANDUAN_PEMBARUAN.md`, `PANDUAN_TROUBLESHOOTING.md`.
