# Alur Kerja Operasional — SATU DPBI

Dokumen ini memetakan alur kerja inti dari hulu ke hilir beserta perubahan status dan pihak penanggung jawab pada tiap tahap.

---

## 1. Alur Proposal Kegiatan & Matriks Persetujuan

1. **Penyusunan (`draft` / `diajukan`)**:
   - Duta atau Koordinator Wilayah mengisi formulir proposal, memilih **Bidang Resmi (`OFFICIAL_BIDANGS`)**, kategori kegiatan, tingkat risiko (`rendah`/`sedang`/`tinggi`), penggunaan identitas DPBI, dan kebutuhan izin eksternal, serta mengunggah berkas PDF proposal.
   - Formulir dilengkapi *double-submit lock* dan penjaga perubahan belum tersimpan (`useUnsavedChanges`).
2. **Penentuan Penyetuju Otomatis (`resolveProposalApprover`)**:
   - `riskLevel === 'tinggi'` atau `externalPermitNeeded === true` -> **`pengurus_nasional`** (status awal `menunggu_persetujuan_nasional`).
   - `usesDpbiIdentity === true` atau kategori `"nasional"` -> **`pengurus_nasional`** (diterima oleh Pengurus Nasional sesuai Bidang terkait).
   - Kegiatan lokal berisiko rendah tanpa izin eksternal khusus -> **`koordinator_wilayah`**.
3. **Pemeriksaan & Keputusan (`disetujui` / `perlu_revisi` / `ditolak`)**:
   - Pengurus Nasional dapat menyalakan filter **"Hanya Bidang Saya"** (`?bidangOnly=1`) agar hanya meninjau proposal yang relevan dengan Bidang kerjanya.
   - Keputusan `perlu_revisi` atau `ditolak` mewajibkan catatan alasan. Notifikasi otomatis dikirim ke pengaju.
4. **Revisi Versi (`proposal_versions`)**:
   - Pengaju mengunggah PDF revisi; versi naik (`v1 -> v2 -> ...`) dan catatan perubahan tersimpan permanen.
5. **Cetak Ringkasan A4**:
   - Detail proposal dapat dicetak atau diekspor ke PDF ukuran A4 lewat `A4PrintModal` (`template: 'proposal'`).

---

## 2. Alur Laporan Kegiatan Lapangan (LKL)

1. **Pengajuan LKL**:
   - Pelaksana memilih mode kegiatan: **Luring** (mengisi wilayah/lokasi tempat acara) atau **Daring** (mengisi platform & tautan konferensi).
   - Dapat ditautkan ke proposal disetujui (`proposal_id`), mengunggah laporan PDF serta beberapa foto dokumentasi, dan opsional mencatat verifikasi koordinat *on-demand*.
2. **Pemeriksaan Koordinator Wilayah / Nasional**:
   - Status awal `menunggu_pemeriksaan` -> ditinjau menjadi `diterima`, `perlu_revisi`, atau `ditolak`.
   - LKL berstatus `diterima` otomatis masuk ke hitungan agregat realisasi kegiatan provinsi & publik.
3. **Pratinjau & Cetak A4**:
   - Lampiran PDF & foto dirender langsung di dalam modal melalui endpoint terotentikasi `/api/files/:id/preview`, serta mendukung cetak laporan LKL A4 (`template: 'lkl'`).

---

## 3. Alur Laporan Koordinator Wilayah

1. **Laporan Bulanan**: Wajib dikirim oleh Koordinator Wilayah dengan tenggat rutin **tanggal 5** setiap bulan (`monthly_report_deadline_day = 5`).
2. **Laporan Akhir Angkatan**: Dikirim paling lambat **7 hari / 168 jam** setelah masa tugas angkatan berakhir (`final_report_deadline_hours = 168`).
3. **Rekap Otomatis & Cetak A4**: Server otomatis menghitung `lkl_recap_count` dari jumlah LKL `diterima` di provinsi terkait dan menyediakan tampilan cetak A4 (`template: 'laporan_koordinator'`).

---

## 4. Alur Wilayah, Kabupaten/Kota & Serah Terima (Handover)

1. **Pemantauan Provinsi & Drilldown Kabupaten/Kota**:
   - Peta GeoJSON 38 provinsi memungkinkan klik provinsi untuk membuka batas seluruh Kabupaten/Kota di provinsi tersebut.
   - Status daerah diklasifikasikan jujur via `classifyRegencyPresence`: membedakan **Duta Domisili**, **Duta Penugasan**, **Koordinator Aktif**, dan **Aktivitas LKL/Proposal**.
2. **Pemekaran & Pembaruan Daerah**:
   - Administrator/Korwil berwenang dapat menambah kabupaten/kota pemekaran (`POST /api/regencies`) atau mengubah status & catatan pembinaan (`PATCH /api/regencies/:code`), seluruhnya tercatat ke `region_history`.
3. **Serah Terima Koordinator (`handovers`)**:
   - Mengajukan berita acara `DPBI/HND/...` yang merekam jumlah tugas aktif & proposal berjalan; setelah disetujui (`POST /api/handovers/:id/approve`), koordinator aktif pada tabel `provinces` diperbarui atomik.

---

## 5. Siklus Angkatan & Masa Akses Alumni 30 Hari

1. **Arsip Angkatan Berjenjang**: Angkatan baru tidak menimpa data angkatan lama. Saat angkatan selesai, data tersimpan historis dan tetap bisa dibuka di `/angkatan` dan `/arsip`.
2. **Jendela Akses Alumni 30 Hari (`calculateAlumniWindow`)**:
   - Setelah masa tugas 4 bulan berakhir, Duta beralih ke peran `alumni` dengan batas `alumni_access_expires_at` = akhir masa tugas + 30 hari.
   - Pengingat otomatis aktif pada tahap `h_minus_7`, `h_minus_3`, dan `hari_terakhir`.
   - Alumni dapat mengekspor arsip JSON pribadinya (`/api/archive/export-personal`) serta mengunduh sertifikat A4.
   - Setelah hari ke-30 lewat, login diblokir (`HTTP 403`) sampai diperpanjang secara resmi oleh Super Admin/Sekretariat Nasional (`POST /api/archive/alumni/:userId/extend`) dengan alasan wajib tercatat.
