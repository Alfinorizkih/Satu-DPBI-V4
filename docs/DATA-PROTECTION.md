# Perlindungan Data Pribadi & Keselamatan Pelajar — SATU DPBI

Karena mayoritas Duta Pelajar Berbudaya Indonesia merupakan pelajar SMA/SMK/MA (termasuk usia di bawah 18 tahun), perlindungan data pribadi (PDP) dan keselamatan peserta (*safeguarding*) menjadi prinsip rancangan utama SATU DPBI.

---

## 1. Pemisahan Ketat Data Publik vs Internal

1. **Zero PII pada Website Publik (`/`, `/tentang`, `/wilayah`, `/wilayah/:code`, `/bantuan`)**:
   - Endpoint `GET /api/public/overview` dan `GET /api/public/provinces/:code` hanya mengembalikan angka agregat organisasi dan status wilayah (`hasCoordinator: boolean`).
   - Tidak ada nama pribadi pelajar, email pribadi, NISN, nomor telepon, alamat rumah, nama sekolah individu, ataupun kontak orang tua/wali yang dikirim ke publik.
   - Pengumuman internal tidak tampil di publik kecuali pengelola nasional secara sadar mencentang `isPublic` (`is_public = 1`).
2. **Kontrol Visibilitas Statistik Publik (`sanitizePublicStatsPayload`)**:
   - Pengaturan `public_stats_approved` mengendalikan penayangan angka ringkasan publik secara keseluruhan.
   - Pengaturan `public_show_duta_count` mengendalikan apakah jumlah Duta aktif ditampilkan atau diset `null` di publik dan rincian provinsi publik.

---

## 2. Masking Data Sensitif di Modul Personalia (`maskPersonnelRow`)

Pada endpoint `GET /api/personnel`, kolom sensitif berikut hanya dibuka untuk pemilik profil itu sendiri, `super_admin`, `wakil_super_admin`, `sekretariat_nasional`, `penanggung_jawab`, dan `koordinator_wilayah` **khusus untuk provinsinya sendiri**:
- `birthPlace` & `birthDate` -> disamarkan menjadi `'Terlindungi'`
- `phone` -> disamarkan menjadi `'Terlindungi'`
- `district`, `village`, `postalCode` -> dikosongkan
- `fullAddress` -> diganti `'Akses alamat dibatasi'`
- `nisn` -> disamarkan menjadi `'********'`
- `guardianName`, `guardianRelation`, `guardianPhone` -> disamarkan menjadi `'Terlindungi'` / `'-'`

---

## 3. Verifikasi Lokasi On-Demand (Tanpa Pelacakan Berkelanjutan)

- SATU DPBI **tidak melakukan pelacakan lokasi latar belakang** (*no background GPS tracking*).
- Verifikasi koordinat hanya berjalan ketika pengguna menekan tombol verifikasi lokasi pada halaman Wilayah atau LKL (`POST /api/location/verify`).
- Pengguna yang melaksanakan kegiatan daring atau mengalami kendala perangkat dapat memilih mode `manual_daring` atau mengajukan pengecualian lokasi resmi (`POST /api/location/exceptions`).

---

## 4. Perlindungan Peserta (*Safeguarding*) & Kanal Pengaduan Rahasia

1. **Penilaian Risiko Kegiatan Pelajar (`risk_assessments`)**:
   - Jika kegiatan melibatkan peserta di bawah 18 tahun (`participantUnder18 === true`) dan jumlah pendamping dewasa kurang dari **2 orang** (`safeguarding_min_chaperones_u18 = 2`), sistem otomatis menandai status **`perlu_peninjauan`** dan memperingatkan tim pengawas.
2. **Persetujuan Berpisah (*Granular Consents* — `consent_records`)**:
   - Persetujuan partisipasi, persetujuan orang tua/wali, izin dokumentasi foto/video, dan izin publikasi media disimpan sebagai bendera terpisah sehingga izin ikut kegiatan **tidak otomatis** berarti izin publikasi foto pelajar.
3. **Pelaporan Insiden & *Whistleblowing* (`incidents`, `whistleblowing_reports`)**:
   - Pengaduan rahasia mendukung mode pelapor anonim/rahasia serta fitur *Conflict Rerouting*: bila pengaduan menyangkut penangan utama, sistem otomatis mengalihkan penanggung jawab penanganan dari `penanggung_jawab` ke `super_admin` (`conflict_rerouted = 1`).
   - Daftar pengaduan rahasia hanya dapat diakses oleh peran berwenang (`super_admin`, `penanggung_jawab`, `wakil_super_admin`).
