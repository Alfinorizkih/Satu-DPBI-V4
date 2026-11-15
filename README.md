# SATU DPBI — Sistem Administrasi Terpadu Utama Duta Pelajar Berbudaya Indonesia

> **Satu Sistem, Satu Data, Satu Koordinasi.**  
> **Duta Pelajar Berbudaya Indonesia (DPBI):** *Berbudaya, Bergerak, dan Berdampak Untuk Negeri.*

SATU DPBI adalah portal operasional internal terpadu dan portal akses publik untuk organisasi kepemudaan dan pendidikan budaya independen **Duta Pelajar Berbudaya Indonesia (DPBI)** di seluruh **38 Provinsi Indonesia**.

---

## Catatan Penting Arsitektur & Lingkup Runtime

- **Runtime Aktif:** Full-stack **React + TypeScript + Vite + Tailwind CSS v4** dengan backend **Express (`server.ts`)** dan basis data relasional tersemat **`node:sqlite` (`DatabaseSync`)** pada Node.js v22.
- **Kesiapan cPanel / MySQL:** Skema relasional MySQL/MariaDB yang setara tersedia pada `database/schema_mysql.sql` untuk kebutuhan migrasi ke hosting MySQL/PHP apabila organisasi ingin memindahkan lapisan API ke stack PHP/MySQL di cPanel, atau dapat langsung dijalankan menggunakan Node.js Application Selector di cPanel (`npm run build` dan `npm start`).
- **Status Integrasi Kemendikdasmen:** Secara tegas berstatus **`nonaktif`** hingga tersedia API resmi dan MoU kelembagaan. Input data sekolah menggunakan entri manual terstruktur dengan validasi format **NPSN 8 digit**.
- **Pemisahan Demo & Produksi:**  
  - `DEMO_MODE=true` (pratinjau): menggunakan `data/satu_dpbi_demo.db` dengan data simulasi 8 peran dan pengalih peran cepat berlabel jelas.  
  - `DEMO_MODE=false` (produksi): menggunakan `data/satu_dpbi_prod.db` yang bersih dari data dummy, menonaktifkan `/api/auth/demo-switch`, dan mengaktifkan **Setup Super Admin Satu Kali** saat database masih kosong.

---

## Struktur Direktori

```
├── server.ts                    # Entry point Express + Vite middleware / static serving
├── server/
│   ├── db.ts                    # Inisialisasi skema SQLite (30+ tabel), WAL, penomoran atomik
│   ├── security.ts              # Hashing scryptSync, throttling login, cookie HttpOnly, RBAC, magic-bytes
│   ├── seed.ts                  # Seed 38 provinsi, approval matrix, & simulasi terisolasi DEMO_MODE
│   ├── routes.ts                # Auth, Upload/Download aman, Dashboard, Wilayah, Personalia, Proposal, LKL
│   └── routes_modules.ts        # Tugas, Dokumen + Generator PDF/ZIP, Perlindungan, Evaluasi, Arsip, Sistem
├── src/
│   ├── App.tsx                  # Router internal, RBAC gate (401/403/404/500), ErrorBoundary
│   ├── context/AuthContext.tsx  # State autentikasi, navigasi, tema Light/Dark, toast notifikasi
│   ├── lib/
│   │   ├── types.ts             # Tipe domain terstandar
│   │   ├── provinces.ts         # Master 38 Provinsi Indonesia (termasuk 4 provinsi Papua baru)
│   │   ├── rbac.ts              # Mesin RBAC, delegasi berjangka, approval matrix, jendela alumni 30 hari
│   │   ├── api.ts               # Fetch wrapper terautentikasi
│   │   └── domain.test.ts       # Unit test logika domain (node:test)
│   ├── components/
│   │   ├── AppShell.tsx         # Navigasi grup, Command Palette, Notifikasi, Mode Terang/Gelap
│   │   ├── CommandPalette.tsx   # Pencarian global (Ctrl+K)
│   │   ├── IndonesiaMap.tsx     # Peta interaktif 38 Provinsi
│   │   └── LocationVerifyModal.tsx # Verifikasi lokasi on-demand (HTML5 Geolocation + Bounding Box)
│   └── pages/                   # 19 halaman modul terintegrasi
├── database/
│   └── schema_mysql.sql         # Skema MySQL/MariaDB InnoDB utf8mb4 siap ekspor
└── docs/
    └── HANDOVER_GUIDE.md        # Panduan instalasi, penggunaan per peran, keamanan, & serah terima
```

---

## Variabel Lingkungan (`.env`)

Salin `.env.example` menjadi `.env` sebelum menjalankan aplikasi di lingkungan produksi:

```env
PORT=3000
NODE_ENV=production
DEMO_MODE=false
SESSION_SECRET=ganti-dengan-string-acak-minimal-32-karakter
STORAGE_QUOTA_MB=5120
```

---

## Menjalankan Secara Lokal & Pengujian

```bash
# Instalasi dependensi
npm install

# Jalankan unit test logika domain (RBAC, Alumni 30 Hari, Bounding Box, Kelengkapan Profil)
npm test

# Mode pengembangan (Express + Vite middleware di port 3000)
npm run dev

# Build produksi & jalankan server produksi
npm run build
npm start
```
