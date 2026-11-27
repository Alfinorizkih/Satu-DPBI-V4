# Catatan Rilis Resmi — SATU DPBI v4.1.0

**Tanggal Rilis:** November 2026  
**Versi Aplikasi:** `4.1.0` (diperiksa via `/api/system/version` dan ditampilkan pada footer publik, footer portal, serta Pusat Kendali Sistem)

---

## Sorotan Pembaruan Utama (v4.1.0)

1. **Pemisahan Bersih Personel, Akun Login, Jabatan & Siklus Undangan**
   - Tiga mode pembuatan akun di `/pengaturan/pengguna` (`create_both`, `link_existing`, `operational_only`) beserta pengaman anti-tautan ganda (`HTTP 409`) dan opsi eksplisit `allowMultipleAccounts`.
   - Impor CSV Personalia dengan templat resmi, pemetaan kolom, deteksi duplikasi (email, NISN, nomor anggota), laporan validasi per baris, dan *rollback* batch impor yang mempertahankan baris tertaut akun.
   - Siklus penuh undangan (`draft → menunggu_persetujuan → siap_diundang → undangan_terkirim → aktivasi_dibuka → aktif`), cooldown kirim ulang `60 detik`, invalidasi token lama saat kirim ulang, dan pencatatan riwayat jabatan `org_position_history`.

2. **Bagan Organisasi Hierarkis & Handover Paket Lengkap**
   - Bagan organisasi interaktif dari tingkat Pembina hingga Duta & Alumni, pemisahan *Role Sistem* vs *Jabatan Organisasi*, pelacakan posisi kosong, cetak A4, dan ringkasan publik bebas-PII.
   - Serah terima Koordinator Wilayah mencakup paket serah terima (`checklist_json`, laporan tertunda, dokumen aktif, inventaris) serta pencabutan otomatis sesi pejabat lama saat handover disahkan.

3. **Approval Engine Permanen, SLA & Pusat Revisi Terpusat**
   - Tabel permanen `approval_history` lintas modul, penanda SLA & eskalasi, penugasan ulang peninjau beralasan, blokir ketat *self-approval* (`HTTP 403`), dan tab **Pusat Revisi Terpusat** di Pusat Persetujuan & Proposal.

4. **Flagship Program Command Center & Persuratan Digital**
   - Modul terpadu **Program Unggulan Nasional** (*Behind The Culture*, *Sedapnya Warisanku*, *Budaya Masuk Sekolah*) di `/program` & `/program/:slug` yang terhubung ke Proposal, LKL, Tugas, Dokumen, Persuratan, dan Evaluasi.
   - Modul **Persuratan & Disposisi Digital** (`/persuratan`) dengan penomoran atomik `DPBI/SURAT/[TAHUN]/[URUTAN]` dan pelacakan status disposisi (`dibaca`, `ditindaklanjuti`, `selesai`).

5. **Pusat Email 18 Templat Resmi DPBI & Repositori Dokumen Versi**
   - 18 templat resmi DPBI tersemai secara idempoten dengan dukungan `body_html`, pratinjau Teks/HTML, riwayat sunting templat (`email_template_history`), 11 variabel aman, dan impor penerima CSV.
   - Repositori dokumen mendukung rantai penggantian versi (`replaced_by_id`) dengan peringatan otomatis pada versi usang.

6. **Ketahanan Sistem, Backup WAL-Safe & Mode Pemeliharaan**
   - Backup SQLite menggunakan `VACUUM INTO` (aman terhadap frame `-wal`) dan pemulihan aman dengan pembersihan `-wal`/`-shm`.
   - Mode Pemeliharaan global yang memblokir operasi tulis non-Super Admin (`HTTP 503`) dan menampilkan banner **Mode Baca-Saja** di seluruh antarmuka portal.
   - Perbaikan keandalan transaksi SQLite: `nextReferenceNumber()` menggunakan `SAVEPOINT` agar aman dipanggil di dalam transaksi outer (`accept-invitation` & impor personalia).

7. **Pengujian & Keamanan Terverifikasi**
   - **26/26** pengujian otomatis lulus (`18` unit domain/RBAC/router/offlineDraft + `8` integrasi keamanan & alur kerja API).
   - `tsc --noEmit` lulus dengan `0` galat, build produksi `vite build && esbuild` sukses, `bun audit` melaporkan `0` kerentanan di 341 paket, serta verifikasi browser Playwright pada Desktop (`1440x900` Light/Dark), Tablet (`768x1024`), dan Mobile (`390x844`).
