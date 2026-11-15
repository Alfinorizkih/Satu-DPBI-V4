# Panduan Backup & Restore — SATU DPBI

Menjaga keberlanjutan data organisasi adalah prioritas utama. Panduan ini menjelaskan mekanisme pencadangan (*backup*) dan pemulihan (*restore*) bawaan aplikasi serta cadangan tingkat server/database produksi.

---

## 1. Backup & Restore Melalui Portal Web (`/sistem`)

Hanya pengguna dengan peran berizin `sistem:manage` (untuk backup) dan `sistem:restore` (**Super Admin**) yang dapat mengakses fitur ini.

### A. Membuat Snapshot Cadangan Baru
1. Masuk sebagai Super Admin dan buka **Kontrol Sistem (`/sistem`)** tab **Storage & Backup**.
2. Klik tombol **Buat Backup Sistem Sekarang** (`POST /api/system/backup`).
3. Backend akan menjalankan proses berikut:
   - Memastikan penulisan WAL SQLite terkonsolidasi.
   - Mengarsipkan basis data aktif ke dalam file `.zip` terkompresi di `storage/backups/`.
   - Menghitung hash integritas **SHA-256** dan mencatat ukuran serta metadata pada tabel `backups`.
4. Klik **Unduh Arsip** pada baris backup terkait untuk menyimpan salinan offline ke perangkat pengelola atau penyimpanan cloud terenkripsi organisasi.

### B. Memvalidasi & Memulihkan (*Restore*) Cadangan
1. Sebelum melakukan pemulihan, selalu jalankan **Validasi Checksum** (`POST /api/system/backup/:id/validate`) untuk memastikan berkas `.zip` cadangan tidak rusak (*corrupt*) dan hash SHA-256 cocok.
2. Klik **Pulihkan Backup** (`POST /api/system/backup/:id/restore`).
3. Sebelum menimpa database berjalan, sistem otomatis membuat **pre-restore safety snapshot** sebagai pengaman ganda jika terjadi kegagalan di tengah proses.
4. Setelah pemulihan selesai, pengguna diminta menyegarkan halaman atau masuk ulang sesuai sesi terbaru di database yang dipulihkan.

---

## 2. Backup Terjadwal di Server Produksi (VPS / cPanel / MySQL)

Jika Anda menjalankan SATU DPBI di produksi dengan basis data **MySQL / MariaDB** (`database/schema_mysql.sql`) atau Node.js di VPS/ArenHost:

### A. Backup Database MySQL Harian (`mysqldump`)
Contoh perintah ekspor database aman (jalankan via Cron Job setiap pukul 02.00 WIB):

```bash
mysqldump --single-transaction --routines --triggers \
  -u DB_USER -p'DB_PASSWORD' satu_dpbi_db \
  | gzip > /var/backups/satu-dpbi/db_$(date +\%F).sql.gz
```

### B. Backup Lampiran Berkas Privat (`storage/private/`)
Selain basis data, pastikan folder `storage/private/` (tempat PDF proposal, LKL, dan dokumen identitas tersimpan) dicadangkan secara berkala:

```bash
tar -czf /var/backups/satu-dpbi/storage_$(date +\%F).tar.gz /path/to/app/storage/private
```

---

## 3. Prosedur Pemulihan Darurat (*Disaster Recovery*)

1. **Hentikan layanan API** sementara untuk mencegah penulisan data baru saat proses restore berlangsung.
2. **Pulihkan Database**:
   - Untuk SQLite: salin berkas `.db` dari arsip backup valid ke `data/satu_dpbi_prod.db` dan hapus file `-wal`/`-shm` sisa.
   - Untuk MySQL: jalankan `gunzip < db_YYYY-MM-DD.sql.gz | mysql -u DB_USER -p satu_dpbi_db`.
3. **Pulihkan Lampiran**: Ekstrak kembali folder `storage/private/`.
4. **Jalankan ulang server** dan periksa endpoint `/api/health` serta menu `/status-sistem`.
5. Catat insiden dan verifikasi keutuhan data terakhir pada `/audit-log`.

---

## 4. Kebijakan Retensi Cadangan

- **Harian**: Simpan minimal 7 hari terakhir di server/hosting.
- **Mingguan**: Simpan 4 salinan mingguan di penyimpanan terpisah (*off-site backup*).
- **Akhir Angkatan**: Sebelum menutup masa tugas angkatan, wajib membuat 1 arsip penuh permanen plus unduhan ekspor CSV/JSON dari modul Arsip (`/arsip`).
