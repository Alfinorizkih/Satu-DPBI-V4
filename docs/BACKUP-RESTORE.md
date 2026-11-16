# Panduan Pencadangan & Pemulihan (Backup & Restore) — SATU DPBI

Fitur Backup & Restore tersedia pada menu **Kontrol Sistem** (`/sistem`, khusus peran `super_admin` dengan izin `sistem:manage` dan `sistem:restore`).

---

## 1. Isi Paket Backup Resmi (`satu_dpbi_backup_*.zip`)

Saat Super Admin menekan **Buat Backup Sekarang** (`POST /api/system/backup`), server membuat arsip ZIP di `storage/backups/` yang berisi:
1. `database.sqlite` — salinan lengkap basis data SQLite aktif.
2. `private_files/*` — seluruh berkas lampiran PDF/foto/dokumen dari `storage/private/`.
3. `manifest.json` — metadata waktu pencadangan, mode (`DEMO_SIMULASI` / `PRODUKSI`), dan nama pembuat backup.

Sistem menghitung checksum **`SHA-256`** atas keseluruhan berkas ZIP dan mencatatnya pada tabel `backups`.

---

## 2. Validasi Integritas Sebelum Pemulihan

Sebelum menjalankan *restore* atau setelah memindahkan berkas backup antar server:
1. Klik **Validasi SHA-256** pada baris backup terkait (`POST /api/system/backup/:id/validate`).
2. Server membaca berkas fisik ZIP di `storage/backups/`, menghitung ulang SHA-256, dan membandingkannya dengan `checksum_sha256` yang tercatat.
3. Jika tidak cocok, proses restore otomatis diblokir untuk mencegah pemulihan dari arsip korup.

---

## 3. Prosedur Pemulihan (Restore) Aman

1. **Unduh Cadangan Tambahan Terlebih Dahulu**: Selalu klik **Unduh ZIP** untuk menyimpan salinan offline sebelum menimpa database berjalan.
2. **Konfirmasi Eksplisit**: Endpoint `POST /api/system/backup/:id/restore` menolak permintaan kecuali payload menyertakan `{ confirmed: true }` (dicentang melalui dialog konfirmasi eksplisit di UI).
3. **Proses Server**:
   - Memverifikasi ulang SHA-256 arsip ZIP.
   - Mengekstrak `database.sqlite`.
   - Menutup koneksi database aktif dengan aman (`resetDbConnection()`), menulis ulang `DB_PATH`, membuka ulang koneksi (`getDb()`), dan menulis entri `RESTORE_BACKUP` ke `audit_logs`.

---

## 4. Strategi Cadangan Tingkat Server (Cron / Offsite)

Untuk ketahanan produksi jangka panjang, jadwalkan salinan harian folder `data/` dan `storage/` ke penyimpanan eksternal terenkripsi:

```bash
# Contoh sinkronisasi harian pukul 02:00 WIB ke direktori backup offsite
0 2 * * * tar -czf /backup/offsite/satudpbi_$(date +\%F).tar.gz -C /var/www/satu-dpbi data storage/private
```
