# Arsitektur Sistem — SATU DPBI

Dokumen ini merangkum arsitektur teknis **SATU DPBI** mencakup pemisahan lapisan antarmuka, router, manajemen status, API backend, keamanan, penyimpanan berkas, serta topologi deployment terpisah.

---

## 1. Gambaran Umum Arsitektur

SATU DPBI dirancang sebagai aplikasi web **Single Page Application (SPA)** modern dengan **REST API Backend** yang dapat dijalankan secara **monolit** (satu domain pada Node.js server) maupun **terpisah** (Frontend statis di Vercel + Backend API di Node.js/VPS/Hosting).

```text
+-----------------------------------+        HTTPS (JSON + HttpOnly Cookie)        +-----------------------------------+
|        FRONTEND (React SPA)       |  <---------------------------------------->  |      BACKEND API (Express 4)      |
|  - Vite 8 + React 19 + TypeScript |         Header: X-Requested-With             |  - CORS & Origin Validation       |
|  - Tailwind CSS v4 (Light/Dark)   |         credentials: 'include'               |  - Session Rotation + Idle Guard  |
|  - Design System (src/components/ui)|                                            |  - RBAC Middleware + Audit Log    |
+-----------------------------------+                                              +-----------------+-----------------+
                                                                                                     |
                                                                           +-------------------------+-------------------------+
                                                                           |                                                   |
                                                                           v                                                   v
                                                           +-------------------------------+                 +-------------------------------+
                                                           |      BASIS DATA RELASIONAL    |                 |      PENYIMPANAN BERKAS       |
                                                           |  - Dev/Staging: SQLite WAL    |                 |  - storage/private/ (terproteksi) |
                                                           |  - Prod Schema: MySQL/MariaDB |                 |  - storage/backups/ (ZIP+SHA) |
                                                           +-------------------------------+                 +-------------------------------+
```

---

## 2. Arsitektur Frontend (`src/`)

### A. Sistem Desain Modular (`src/components/ui/`)
Seluruh komponen antarmuka dipusatkan pada modul terpisah dan diekspor ulang melalui `src/components/ui/index.ts` (serta alias kompatibilitas `Primitives.tsx`):
- `Button.tsx`: `Button`, `IconButton` dengan dukungan status *loading* dan variasi warna institusional.
- `FormControls.tsx`: `Input`, `Textarea`, `Select`, `Combobox`, `DatePicker`, `Checkbox`, `Radio`, `Switch`, `SearchBar`, `FilterPanel`.
- `DataDisplay.tsx`: `Card`, `GlassCard`, `PageContainer`, `PageHeader`, `Breadcrumb`, `Badge`, `Avatar`, `StatusIndicator`, `DataTable`, `Pagination`.
- `Overlay.tsx`: `Modal`, `Dialog`, `ConfirmDialog`, `Drawer`, `DropdownMenu`, `Tabs`, `Tooltip`.
- `Feedback.tsx`: `EmptyState`, `LoadingSkeleton`, `ErrorView` (HTTP 400–503), `AccountPendingView`, `OfflineBanner`, `FormErrorSummary`.
- `DocumentPreview.tsx`: `FileDropzone` / `FileUploader`, `DocumentPreview` (PDF iframe + gambar terautentikasi).

### B. Routing URL Bersih & Deep Linking (`src/lib/routes.ts`)
- Seluruh rute privat menggunakan pola URL deterministik tanpa ketergantungan state memori sementara, seperti `/personalia/:id`, `/personalia/:id/ubah`, `/proposal/baru`, `/proposal/:id`, `/laporan-kegiatan/:id`, `/dokumen/:id`, `/aktivitas-saya`, `/tugas-saya`, `/alumni`, `/audit-log`, `/status-sistem`, serta `/pengaturan/sesi` dan `/pengaturan/hak-akses`.
- Segmen ID divalidasi (`safeSegment`) untuk mencegah *path traversal* sebelum mencocokkan komponen halaman.
- Jika pengguna mengakses rute privat dalam kondisi belum login, sistem menampilkan `401` dan menyimpan `pendingRedirectPath` untuk dikembalikan tepat ke halaman tujuan setelah login berhasil.

### C. Klien HTTP Terpadu (`src/lib/api.ts`)
- Menggunakan `apiUrl(path)` yang menggabungkan `VITE_API_BASE_URL` saat frontend di-hosting terpisah dari backend.
- Selalu mengirim `credentials: 'include'` dan header `X-Requested-With: SATU-DPBI`.
- Intersepsi otomatis respons `419` (sesi kedaluwarsa) agar aplikasi segera menghentikan interaksi dan menampilkan layar login ulang.

---

## 3. Arsitektur Backend (`server.ts`, `server/`)

| Berkas | Tanggung Jawab |
|---|---|
| `server.ts` | Bootstrapping Express, CORS berbasis `CORS_ALLOWED_ORIGINS`, header keamanan HTTP, asset statis `/assets`, endpoint `/api/health`, dan Vite/static fallback. |
| `server/db.ts` | Koneksi SQLite `WAL` mode, foreign key aktif, pembuatan tabel idempoten, serta migrasi kolom aman. |
| `server/seed.ts` | Penanaman 38 provinsi Indonesia lengkap dengan batas koordinat (*bounding box*) serta dataset simulasi bila `DEMO_MODE=true`. |
| `server/security.ts` | Derivasi kata sandi `scrypt`, generasi token acak, rotasi sesi, *rate limiting* login, verifikasi origin/CSRF, pencatatan `audit_logs`, dan pencatatan `system_errors`. |
| `server/routes.ts` | Autentikasi, manajemen sesi, publik, dashboard, organisasi/delegasi, personalia, wilayah 38 provinsi, angkatan, proposal, LKL, dan laporan koordinator. |
| `server/routes_modules.ts` | Tugas, dokumen + bulk PDF/ZIP generator, pengumuman, kalender, notifikasi, aktivitas pribadi, perlindungan peserta, evaluasi, arsip & ekspor CSV, kontrol sistem/backup, dan pengaturan. |

---

## 4. Topologi Deployment Terpisah (Vercel + Backend Hosting)

- **Frontend (Vercel)**: Mengompilasi berkas statis `dist/` dari Vite, melayani rute SPA lewat `vercel.json` (`/(.*) -> /index.html`), dan menunjuk ke backend via variabel `VITE_API_BASE_URL`.
- **Backend API (Hosting Node.js / VPS)**: Melayani seluruh `/api/*` di balik HTTPS, mengizinkan domain Vercel di `CORS_ALLOWED_ORIGINS`, dan menggunakan `COOKIE_SAMESITE="none"` (jika domain berbeda) atau `COOKIE_SAMESITE="lax"` + `COOKIE_DOMAIN=".dpbi.or.id"` (jika satu domain induk, mis. `satu.dpbi.or.id` dan `api.dpbi.or.id`).
