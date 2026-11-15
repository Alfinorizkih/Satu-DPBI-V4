# Panduan Serah Terima & Operasional SATU DPBI

Dokumen ini disusun sebagai panduan resmi instalasi, operasional peran, keamanan sistem, dan pemeliharaan **SATU DPBI (Sistem Administrasi Terpadu Utama Duta Pelajar Berbudaya Indonesia)**.

---

## 1. Panduan Instalasi & Konfigurasi Produksi

1. **Prasyarat Runtime:** Node.js v22+ (menggunakan `node:sqlite` bawaan tanpa kompilasi native C++ tambahan).
2. **Konfigurasi Lingkungan:**
   - Salin `.env.example` ke `.env`.
   - Pastikan `DEMO_MODE=false` untuk deployment produksi.
   - Isi `SESSION_SECRET` dengan string acak minimal 32 karakter.
3. **Bootstrap Super Admin Pertama:**
   - Saat database produksi (`data/satu_dpbi_prod.db`) masih kosong (0 pengguna), Portal Akses Publik otomatis menampilkan formulir **Inisialisasi Super Admin Pertama**.
   - Setelah akun Super Admin pertama dibuat, formulir bootstrap otomatis terkunci permanen.
4. **Deployment ke cPanel:**
   - **Opsi A (Node.js App di cPanel):** Unggah proyek, jalankan `npm install --omit=dev && npm run build`, dan set Startup File ke `server.js` dengan `NODE_ENV=production` serta `DEMO_MODE=false`.
   - **Opsi B (Migrasi Database ke MySQL cPanel):** Gunakan `database/schema_mysql.sql` melalui phpMyAdmin untuk membentuk seluruh tabel relasional (`InnoDB`, `utf8mb4_unicode_ci`).

---

## 2. Ringkasan 8 Peran & Matriks Hak Akses

| Peran | Ruang Lingkup Data | Wewenang Utama |
| :--- | :--- | :--- |
| **Super Admin** | Seluruh Nasional (38 Provinsi) | Konfigurasi penuh sistem, pengguna, delegasi wewenang, backup/restore ZIP, persetujuan tingkat tertinggi, hapus permanen dengan re-autentikasi. |
| **Wakil Super Admin** | Seluruh Nasional | Cadangan operasional nasional, verifikasi profil, pengelolaan proposal, tugas, dan pelaporan lintas provinsi. |
| **Penanggung Jawab** | Seluruh Nasional | Persetujuan strategis/risiko tinggi, penanganan pengaduan *whistleblowing* dengan pemisahan konflik kepentingan, pengawasan perlindungan peserta. |
| **Pengurus Nasional** | Seluruh Nasional (per Bidang) | Persetujuan proposal bidang terkait, penetapan tugas lintas provinsi, verifikasi dokumen, dan evaluasi kinerja. |
| **Sekretariat Nasional** | Seluruh Nasional | Administrasi surat/SK, generator dokumen massal PDF/ZIP, verifikasi data anggota, impor CSV transaksional, peninjauan laporan koordinator. |
| **Koordinator Wilayah** | **Terisolasi per Provinsi** | Verifikasi data duta di provinsinya, pemeriksaan LKL, pengajuan akun anggota baru, laporan bulanan & akhir angkatan, usulan serah terima wilayah. |
| **Duta** | **Terisolasi Pribadi & Provinsi** | Pemutakhiran profil mandiri, pengajuan proposal kegiatan, pelaporan LKL (Daring/Luring), eksekusi tugas, akses dokumen & kalender. |
| **Alumni** | **Read-Only + Jendela Ekspor 30 Hari** | Melihat & mengunduh portofolio pribadi (LKL, evaluasi, sertifikat) selama masa tenggang 30 hari pasca masa tugas berakhir (dapat diperpanjang Super Admin). |

---

## 3. Alur Kerja Inti Organisasi

1. **Penomoran Referensi Atomik (`DPBI/<KATEGORI>/<TAHUN>/<URUT>`):**  
   Setiap pengajuan (`PROP`, `LKL`, `LKW`, `AKUN`, `DOC`, `TGS`, `ADU`, `INS`, `PERS`, `HND`) mengambil nomor secara atomik melalui transaksi database `BEGIN IMMEDIATE` pada tabel `reference_sequences` untuk mencegah duplikasi.
2. **Matriks Persetujuan Proposal (`resolveProposalApprover`):**
   - Risiko tinggi / butuh izin eksternal → **Penanggung Jawab**.
   - Menggunakan identitas resmi DPBI / lintas provinsi → **Pengurus Nasional**.
   - Kegiatan lokal risiko rendah-sedang → **Koordinator Wilayah** (atau Pengurus Nasional bila Koordinator belum ditetapkan).
3. **Verifikasi Lokasi On-Demand (Privasi Duta):**
   - Pelacakan latar belakang terus-menerus **dilarang**. Koordinat GPS hanya diminta saat pengguna menekan tombol *Verifikasi Lokasi* pada aksi tertentu (check-in LKL atau kegiatan wilayah) lalu dicocokkan terhadap *bounding box* 38 provinsi di server. Tersedia mekanisme **Pengajuan Pengecualian Lokasi** bila GPS tidak akurat atau kegiatan berlangsung di luar domisili.
4. **Perlindungan Peserta (*Safeguarding*):**
   - Untuk kegiatan dengan peserta di bawah 18 tahun, penilaian risiko otomatis menandai peringatan kepatuhan bila jumlah pendamping dewasa kurang dari **2 orang**.
   - Persetujuan (*consent*) partisipasi, wali, dokumentasi, dan publikasi dicatat secara terpisah.
   - Kanal *Whistleblowing* melakukan pengalihan penangan (*conflict rerouting*) secara otomatis ke **Penanggung Jawab** atau **Wakil Super Admin** apabila laporan menyangkut pengelola internal.

---

## 4. Keamanan, Backup & Audit

- **Password:** Di-hash menggunakan `crypto.scryptSync` dengan salt acak 16-byte per akun dan diverifikasi dengan `crypto.timingSafeEqual`.
- **Sesi & Anti-Brute-Force:** Cookie `HttpOnly`, `SameSite=Lax`, pembatasan percobaan login gagal (`HTTP 429`), dan fitur *Cabut Semua Sesi* dari menu Pengaturan.
- **Upload Berkas Aman:** Validasi *magic bytes* pada sisi server (PDF `%PDF-`, JPEG `FF D8 FF`, PNG `89 50 4E 47`, WebP `RIFF...WEBP`, CSV teks) sebelum disimpan di luar `public/` (`storage/private/`). Berkas hanya diunduh melalui endpoint `/api/files/:id` yang terproteksi sesi dan kontrol peran.
- **Backup & Restore:** Paket ZIP memuat `database.sqlite`, `manifest.json`, dan hash `SHA-256` seluruh file lampiran. Proses *Restore* memverifikasi checksum `SHA-256` sebelum menimpa database aktif.
- **Pemisahan Jejak:** *Audit Log* mencatat mutasi keamanan dan keputusan administratif secara *append-only*, terpisah dari *Linimasa Aktivitas* operasional.
