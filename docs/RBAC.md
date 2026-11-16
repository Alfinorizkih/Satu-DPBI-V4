# Matriks Hak Akses (RBAC), 6 Bidang Resmi & Delegasi — SATU DPBI

Sistem otorisasi **SATU DPBI** didefinisikan secara terpusat di `src/lib/rbac.ts` dan ditegakkan langsung oleh middleware backend `requirePermission(module, action)` pada setiap endpoint API.

---

## 1. Daftar 8 Peran Resmi (`RoleCode`)

| Kode Peran | Nama Tampilan | Cakupan Data |
| :--- | :--- | :--- |
| `super_admin` | Super Admin | Nasional (38 Provinsi) + Kontrol Sistem penuh |
| `wakil_super_admin` | Wakil Super Admin | Nasional (operasional, tinjauan, delegasi cadangan) |
| `penanggung_jawab` | Penanggung Jawab Organisasi | Nasional (pengawasan strategis, kepatuhan, *whistleblowing*) |
| `pengurus_nasional` | Pengurus Nasional | Nasional (terfokus pada salah satu dari **6 Bidang Resmi**) |
| `sekretariat_nasional` | Sekretariat Nasional | Nasional (persuratan, verifikasi anggota, dokumen massal, CMS publik) |
| `koordinator_wilayah` | Koordinator Wilayah | Terisolasi hanya pada provinsi penugasannya (`province_code`) |
| `duta` | Duta | Terisolasi pada profil pribadi, pengajuan sendiri, dan tugas terkait |
| `alumni` | Alumni | Akses baca-saja (*read-only*) + unduh arsip/sertifikat selama jendela **30 hari** |

---

## 2. Matriks Izin Dasar Per Modul (`BASE_ROLE_PERMISSIONS`)

Keterangan singkatan aksi: `V`=view, `C`=create, `E`=edit, `D`=delete, `A`=approve, `Rj`=reject, `Rv`=review, `Dl`=download, `Ex`=export, `As`=assign, `M`=manage, `P`=publish, `Ar`=archive, `Rs`=restore, `Cf`=configure.

| Modul | Super Admin | Wakil Super Admin | Penanggung Jawab | Pengurus Nasional | Sekretariat Nasional | Koordinator Wilayah | Duta | Alumni |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `dashboard` | Semua | V, Ex | V, Ex | V, Ex | V, Ex | V | V | V |
| `command_center` | Semua | V, Rv, Ex | V | V | — | — | — | — |
| `organisasi` | Semua | V, Rv, As | V | V | V, C, E | — | — | — |
| `personalia` | Semua | V, Rv, Ex | V | V | V, C, E, Rv, Ex | V, C, E, Rv | V, E (pribadi) | — |
| `wilayah` | Semua | V, Rv, Ex | V | V | V, E | V, E (provinsi sendiri) | — | — |
| `angkatan` | Semua | V, Rv | V | V, C, E | V, C, E | V | V | — |
| `proposal` | Semua | V, Rv, A, Rj | V, Rv | V, Rv, A, Rj | V, Rv | V, C, E, Rv (+A lokal) | V, C, E | — |
| `lkl` | Semua | V, Rv | V, Rv | V, Rv | V | V, Rv, A, Rj | V, C, E | — |
| `laporan_koordinator` | Semua | V, Rv | V, Rv | V, Rv | V, Rv | V, C, E | — | — |
| `tugas` | Semua | V, C, E, As | V | V, C, E, As | V, C, E, As | V, C, E, As | V, E | — |
| `dokumen` | Semua | V, Dl, P | V, Dl | V, C, Dl, P | V, C, E, Dl, P, Ar | V, Dl | V, Dl | V, Dl |
| `pengumuman` | Semua | V, C, E, P | V | V, C, E, P | V, C, E, P | V, C | V | — |
| `kalender` | Semua | V, C, E | V | V, C, E | V, C, E | V, C, E | V | — |
| `perlindungan` | Semua | V, Rv | V, Rv, M | V, Rv | V, C | V, C | V, C | — |
| `evaluasi` | Semua | V, Rv, Ex | V, Rv, Ex | V, C, Rv | V | V, C | V | — |
| `arsip` | Semua | V, Dl | V, Dl | V, Dl | V, C, Dl, Ar | V, Dl | V, Dl | V, Dl, Ex |
| `sistem` | Semua | — | — | — | — | — | — | — |
| `pengaturan` | Semua | V | V | V | V | V | V | V |

---

## 3. Enam Bidang Resmi Pengurus Nasional (`OFFICIAL_BIDANGS`)

Setiap Pengurus Nasional ditetapkan pada salah satu dari 6 Bidang berikut:

| No | Nama Bidang Resmi | Fokus Tugas & Modul Utama | Fokus Proposal (`proposalFocus`) |
| :--- | :--- | :--- | :--- |
| `01` | **Bidang Administrasi & Organisasi** | Tata kelola struktur organisasi, SK jabatan, verifikasi personalia, dan persuratan internal (`organisasi`, `personalia`, `angkatan`, `dokumen`, `arsip`) | Administrasi, Organisasi, Tata Kelola |
| `02` | **Bidang Program & Operasional** | Pengendalian alur proposal kegiatan, evaluasi LKL, kalender kerja, dan penugasan operasional (`proposal`, `lkl`, `laporan_koordinator`, `tugas`, `kalender`, `evaluasi`) | Program dan Operasional, Lokakarya / Literasi Pelajar, Aksi Pelajar |
| `03` | **Bidang Pengembangan Wilayah** | Pembinaan 38 provinsi dan kabupaten/kota, serah terima koordinator, dan laporan bulanan wilayah (`wilayah`, `laporan_koordinator`, `personalia`, `tugas`, `evaluasi`) | Pengembangan Wilayah, Koordinasi Wilayah |
| `04` | **Bidang Pendidikan & Kebudayaan** | Kurikulum pembekalan, festival budaya pelajar, literasi aksara/bahasa daerah (`proposal`, `lkl`, `dokumen`, `kalender`, `angkatan`) | Kebudayaan, Pendidikan, Festival / Pameran Budaya, Seminar Daring |
| `05` | **Bidang Hubungan & Kemitraan** | Verifikasi proposal kemitraan eksternal, jejaring sekolah/komunitas, dan kepatuhan izin lembaga (`proposal`, `dokumen`, `pengumuman`, `kalender`) | Hubungan dan Kemitraan, Kemitraan Eksternal / Lintas Lembaga |
| `06` | **Bidang Media, Publikasi & Teknologi** | Pengelolaan konten CMS website publik, pengumuman resmi, dokumentasi, dan Pusat Bantuan (`pengumuman`, `dokumen`, `kalender`, `lkl`, plus akses `/pengaturan/cms`) | Media, Publikasi, Teknologi, Kampanye Digital |

---

## 4. Aturan Khusus Kewenangan

1. **Pengelola CMS & Pusat Bantuan (`requireCmsEditor`)**:
   - Diperbolehkan untuk `super_admin`, `wakil_super_admin`, `sekretariat_nasional`, serta `pengurus_nasional` yang kolom `bidang`-nya mengandung kata `"media"`.
   - Perubahan pengaturan sensitif sistem (`PATCH /api/system/settings`, seperti `public_show_duta_count`) tetap membutuhkan izin `sistem:configure` (`super_admin`).
2. **Publikasi Pengumuman ke Website Publik (`isPublic`)**:
   - Hanya `super_admin`, `wakil_super_admin`, `sekretariat_nasional`, dan `pengurus_nasional` yang dapat menerbitkan atau mengubah status `is_public` pada `/api/announcements`.
3. **Delegasi Sementara (`delegations`)**:
   - Super Admin / pemberi wewenang dapat mendelegasikan `(module, action)` untuk rentang `starts_at` s.d. `ends_at`.
   - `resolveEffectivePermissions()` otomatis menggabungkan izin delegasi aktif pada rentang waktu sah tanpa mengubah peran permanen pengguna, dan pencabutan (`status = 'dicabut'`) berlaku seketika.
4. **Inisialisasi Super Admin Pertama**:
   - Endpoint `POST /api/auth/bootstrap` hanya aktif bila `DEMO_MODE=false` dan tabel `users` berjumlah `0`. Setelah 1 akun Super Admin terdaftar, endpoint mengembalikan HTTP `403`.
