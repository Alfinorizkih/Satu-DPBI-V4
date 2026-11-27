import type { DisplayScale, RoleCode } from './types';

export interface PageHelpGuide {
  pathPrefix: string;
  title: string;
  purpose: string;
  steps: string[];
  tips: string[];
  commonMistakes: string[];
  relatedPaths: { label: string; path: string }[];
}

export interface RoleTourStep {
  title: string;
  description: string;
  targetPath: string;
  actionLabel: string;
}

export interface GlossaryEntry {
  term: string;
  fullName: string;
  definition: string;
  relatedPath?: string;
}

export interface FaqEntry {
  id: string;
  category: string;
  question: string;
  answer: string;
  actionPath?: string;
  actionLabel?: string;
}

export const ROLE_TOURS: Record<RoleCode, { headline: string; summary: string; steps: RoleTourStep[] }> = {
  duta: {
    headline: 'Panduan Cepat Duta Pelajar Berbudaya Indonesia',
    summary: 'Alur utama Anda di portal adalah menjaga kelengkapan profil, mengajukan proposal kegiatan, melaksanakan tugas, dan mengirim LKL.',
    steps: [
      {
        title: '1. Mulai dari Beranda Saya',
        description: 'Lihat tugas aktif, status pengajuan proposal/LKL, catatan revisi, serta jadwal kegiatan mendatang khusus wilayah Anda.',
        targetPath: '/beranda',
        actionLabel: 'Buka Beranda Saya',
      },
      {
        title: '2. Lengkapi Profil & Berkas Verifikasi',
        description: 'Pastikan data sekolah, kontak wali, dan checklist dokumen pribadi mencapai 100% agar akun terverifikasi penuh.',
        targetPath: '/personalia',
        actionLabel: 'Periksa Profil Saya',
      },
      {
        title: '3. Ajukan Proposal dengan Panduan Bertahap',
        description: 'Gunakan formulir bertahap (4 langkah). Sistem otomatis menyimpan draf lokal dan menampilkan pemeriksa tujuan.',
        targetPath: '/proposal/baru',
        actionLabel: 'Coba Formulir Proposal',
      },
      {
        title: '4. Kirim LKL Setelah Kegiatan Selesai',
        description: 'Tautkan LKL ke proposal yang telah disetujui, unggah PDF laporan dan foto dokumentasi untuk menutup checklist tugas.',
        targetPath: '/laporan-kegiatan/baru',
        actionLabel: 'Buka Formulir LKL',
      },
    ],
  },
  koordinator_wilayah: {
    headline: 'Panduan Cepat Koordinator Wilayah',
    summary: 'Anda berperan mengoordinasikan Duta di provinsi tugas, memeriksa proposal & LKL daerah, serta mengirim Laporan Bulanan Wilayah.',
    steps: [
      {
        title: '1. Pantau Antrean Persetujuan Wilayah',
        description: 'Tinjau proposal dan LKL masuk dari Duta di provinsi Anda sesuai batas waktu SLA 72 jam.',
        targetPath: '/persetujuan',
        actionLabel: 'Buka Pusat Persetujuan',
      },
      {
        title: '2. Verifikasi Profil & Sebaran Kabupaten/Kota',
        description: 'Pastikan profil Duta provinsi lengkap dan pantau pembinaan kab/kota pada menu Wilayah.',
        targetPath: '/wilayah',
        actionLabel: 'Buka Data Wilayah',
      },
      {
        title: '3. Kirim Laporan Koordinator Wilayah (LKW)',
        description: 'Laporkan perkembangan pembinaan provinsi dan rencana bulan berikutnya secara berkala.',
        targetPath: '/laporan-koordinator',
        actionLabel: 'Buka Laporan Wilayah',
      },
    ],
  },
  sekretariat_nasional: {
    headline: 'Panduan Cepat Sekretariat Nasional',
    summary: 'Sekretariat mengelola persuratan resmi, disposisi, dokumen/SK, email pengumuman, dan penanganan tiket kendala pengguna.',
    steps: [
      {
        title: '1. Kelola Persuratan & Disposisi',
        description: 'Catat surat masuk dan keluar dengan penomoran otomatis DPBI/SURAT serta pantau status disposisinya.',
        targetPath: '/persuratan',
        actionLabel: 'Buka Persuratan',
      },
      {
        title: '2. Terbitkan Dokumen & Pedoman Resmi',
        description: 'Unggah SK, SOP, dan materi pembekalan beserta kontrol hak akses baca per tingkatan peran.',
        targetPath: '/dokumen',
        actionLabel: 'Buka Pusat Dokumen',
      },
      {
        title: '3. Tangani Tiket Kendala Pengguna',
        description: 'Tindak lanjuti laporan kendala dari Duta atau Koordinator dan perbarui status penyelesaiannya.',
        targetPath: '/kendala',
        actionLabel: 'Buka Pusat Kendala',
      },
    ],
  },
  pengurus_nasional: {
    headline: 'Panduan Cepat Pengurus Nasional',
    summary: 'Pengurus Nasional mengawal program unggulan lintas provinsi, meninjau proposal berisiko/nasional, dan melakukan evaluasi kinerja.',
    steps: [
      {
        title: '1. Putuskan Proposal Bidang & Nasional',
        description: 'Gunakan filter bidang pada Proposal dan Pusat Persetujuan untuk meninjau kegiatan berdampak nasional.',
        targetPath: '/persetujuan',
        actionLabel: 'Buka Pusat Persetujuan',
      },
      {
        title: '2. Kawal Program Unggulan',
        description: 'Pantau ketercapaian target provinsi dan peserta pada setiap program unggulan nasional.',
        targetPath: '/program',
        actionLabel: 'Lihat Program Unggulan',
      },
      {
        title: '3. Lakukan Evaluasi Kinerja Berkala',
        description: 'Susun penilaian kinerja Duta & koordinator serta berikan rekomendasi pembinaan.',
        targetPath: '/evaluasi',
        actionLabel: 'Buka Evaluasi Kinerja',
      },
    ],
  },
  penanggung_jawab: {
    headline: 'Panduan Cepat Penanggung Jawab Organisasi',
    summary: 'Anda memiliki akses pengawasan strategis nasional, persetujuan tingkat lanjut, dan penanganan kasus perlindungan (Safeguarding).',
    steps: [
      {
        title: '1. Pengawasan Kepatuhan & Safeguarding',
        description: 'Pantau asesmen risiko kegiatan pelajar, insiden lapangan, dan jalur pelaporan rahasia.',
        targetPath: '/perlindungan',
        actionLabel: 'Buka Safeguarding',
      },
      {
        title: '2. Pusat Persetujuan & Eskalasi',
        description: 'Tinjau pengajuan yang dieskalasikan atau melewati batas SLA nasional.',
        targetPath: '/persetujuan',
        actionLabel: 'Buka Pusat Persetujuan',
      },
    ],
  },
  wakil_super_admin: {
    headline: 'Panduan Cepat Wakil Super Admin',
    summary: 'Mendampingi Super Admin dalam pengawasan operasional harian, persetujuan, delegasi, dan audit kepatuhan.',
    steps: [
      {
        title: '1. Tinjau Beranda & Executive Dashboard',
        description: 'Lihat ringkasan kinerja 38 provinsi dan antrean yang membutuhkan keputusan.',
        targetPath: '/dashboard',
        actionLabel: 'Buka Dashboard',
      },
      {
        title: '2. Kelola Pusat Kendala & Sistem',
        description: 'Monitor tiket kendala pengguna dan kesehatan layanan portal.',
        targetPath: '/kendala',
        actionLabel: 'Buka Pusat Kendala',
      },
    ],
  },
  super_admin: {
    headline: 'Panduan Cepat Super Admin',
    summary: 'Kendali administratif penuh atas pengguna, RBAC, mode pemeliharaan, backup WAL-safe, pusat kendala, dan kesehatan sistem.',
    steps: [
      {
        title: '1. Pantau Kesehatan Sistem & Pemeliharaan',
        description: 'Periksa latensi database, antrean email, status migrasi, backup SHA-256, dan log error sistem.',
        targetPath: '/status-sistem',
        actionLabel: 'Buka Status Sistem',
      },
      {
        title: '2. Kelola Akun, Sesi & RBAC',
        description: 'Aktifkan/nonaktifkan akun, putus paksa sesi mencurigakan, dan atur kebijakan batas sesi maksimal 24 jam.',
        targetPath: '/pengaturan/pengguna',
        actionLabel: 'Buka Manajemen Pengguna',
      },
      {
        title: '3. Triage Pusat Kendala Pengguna',
        description: 'Tetapkan prioritas, tugaskan PIC, dan selesaikan laporan kendala dengan referensi error sistem.',
        targetPath: '/kendala',
        actionLabel: 'Buka Pusat Kendala',
      },
    ],
  },
  alumni: {
    headline: 'Panduan Cepat Portal Alumni DPBI',
    summary: 'Akses terbatas pasca masa tugas untuk mengunduh SK/sertifikat resmi, melihat arsip, dan mengikuti perkembangan program.',
    steps: [
      {
        title: '1. Cek Status & Masa Berlaku Akses Alumni',
        description: 'Pantau sisa masa akses alumni Anda dan ajukan perpanjangan bila diperlukan.',
        targetPath: '/alumni',
        actionLabel: 'Buka Direktori Alumni',
      },
      {
        title: '2. Unduh Arsip & Sertifikat Resmi',
        description: 'Akses dokumen pedoman, SK pengangkatan, dan arsip kegiatan yang diizinkan.',
        targetPath: '/arsip',
        actionLabel: 'Buka Arsip',
      },
    ],
  },
};

export const PAGE_HELP_GUIDES: PageHelpGuide[] = [
  {
    pathPrefix: '/beranda',
    title: 'Panduan Beranda Saya (Personal Workspace)',
    purpose: 'Menampilkan ringkasan tugas pribadi, pengajuan yang menunggu tindakan, catatan revisi, tenggat terdekat, dan pintasan kerja sesuai peran Anda.',
    steps: [
      'Periksa kartu "Perlu Segera Ditindaklanjuti" di bagian atas jika ada revisi proposal/LKL atau persetujuan yang menunggu.',
      'Gunakan tombol pintasan utama untuk langsung menuju pekerjaan paling prioritas.',
      'Klik item tugas atau notifikasi untuk membuka detailnya secara langsung.',
    ],
    tips: [
      'Anda dapat menjadikan Beranda Saya atau Dashboard sebagai halaman awal setelah login di menu Pengaturan > Tampilan.',
      'Pin menu yang paling sering dibuka agar muncul di bagian Menu Favorit di bilah samping.',
    ],
    commonMistakes: ['Melewatkan catatan revisi yang hanya muncul di tab detail pengajuan.'],
    relatedPaths: [
      { label: 'Pengaturan Tampilan', path: '/pengaturan' },
      { label: 'Pusat Bantuan', path: '/bantuan' },
    ],
  },
  {
    pathPrefix: '/proposal',
    title: 'Panduan Pengajuan & Pemeriksaan Proposal',
    purpose: 'Menyusun proposal kegiatan terstruktur dengan 4 langkah terpandu, pengecekan duplikasi otomatis, pelacak proses, dan kontrol revisi PDF.',
    steps: [
      'Klik "Ajukan Proposal Baru" untuk membuka panduan 4 langkah (Identitas, Jadwal & Lokasi, Risiko & Berkas PDF, lalu Konfirmasi Akhir).',
      'Jika belum siap dikirim, pilih "Simpan Draft" agar dapat dilanjutkan nanti tanpa kehilangan data.',
      'Setelah dikirim, buka "Detail" untuk melihat Pelacak Proses (tahap sekarang, pemeriksa saat ini, tenggat SLA, dan riwayat perpindahan).',
    ],
    tips: [
      'Proposal berisiko tinggi atau membutuhkan izin mitra eksternal otomatis diteruskan ke Pengurus Nasional.',
      'Bila dikembalikan dengan status Perlu Revisi, baca catatan pemeriksa terlebih dahulu sebelum mengunggah PDF revisi baru.',
    ],
    commonMistakes: [
      'Mengajukan proposal tanpa memilih lokasi/platform atau melampirkan uraian tujuan yang jelas.',
      'Mengirim klik ganda saat jaringan lambat — sistem kini melindungi dengan kunci idempotensi otomatis.',
    ],
    relatedPaths: [
      { label: 'Pusat Persetujuan', path: '/persetujuan' },
      { label: 'Buat LKL Kegiatan', path: '/laporan-kegiatan/baru' },
    ],
  },
  {
    pathPrefix: '/laporan-kegiatan',
    title: 'Panduan Laporan Kegiatan Lapangan (LKL)',
    purpose: 'Mendokumentasikan kegiatan yang telah dilaksanakan, jumlah peserta riil, hasil capaian, PDF laporan, dan foto dokumentasi.',
    steps: [
      'Tautkan ke Proposal berstatus Disetujui jika kegiatan berasal dari proposal resmi.',
      'Pilih moda Luring (isi lokasi fisik kabupaten/kota) atau Daring (isi nama platform konferensi).',
      'Unggah dokumen PDF laporan serta minimal 1 foto dokumentasi JPG/PNG/WebP.',
      'Periksa ringkasan akhir pada langkah ke-4 sebelum menekan Kirim LKL.',
    ],
    tips: [
      'Pengisian LKL yang diterima otomatis menutup tugas dokumentasi terkait proposal.',
      'Draf yang belum dikirim otomatis tersimpan sementara di peramban.',
    ],
    commonMistakes: ['Mencoba menautkan LKL ke proposal yang statusnya masih menunggu persetujuan atau masih draft.'],
    relatedPaths: [
      { label: 'Lihat Proposal Saya', path: '/proposal' },
      { label: 'Tugas Saya', path: '/tugas-saya' },
    ],
  },
  {
    pathPrefix: '/persetujuan',
    title: 'Panduan Pusat Persetujuan Nasional',
    purpose: 'Satu antrean terpadu untuk meninjau proposal, LKL, laporan koordinator, permintaan akun, dan serah terima wilayah sesuai batas SLA.',
    steps: [
      'Gunakan tab filter "Terlambat SLA" untuk memprioritaskan berkas yang melewati batas 72 jam.',
      'Klik item untuk melihat riwayat perpindahan, catatan sebelumnya, dan tahap berikutnya.',
      'Wajib tuliskan alasan yang jelas saat meminta revisi atau menolak agar pengusul tahu apa yang harus diperbaiki.',
    ],
    tips: ['Anda tidak dapat menyetujui pengajuan yang Anda buat sendiri (pemisahan wewenang).'],
    commonMistakes: ['Menekan Tolak padahal pengusul hanya perlu melengkapi satu dokumen (gunakan Minta Revisi / Kelengkapan).'],
    relatedPaths: [{ label: 'Pelacak Proses Proposal', path: '/proposal' }],
  },
  {
    pathPrefix: '/kendala',
    title: 'Panduan Pusat Kendala & Laporan Error',
    purpose: 'Saluran resmi melaporkan gangguan teknis, kesalahan tampilan, atau kendala akses agar ditangani Sekretariat/Super Admin secara terukur.',
    steps: [
      'Pilih halaman/modul tempat kendala terjadi dan jelaskan langkah kejadian secara ringkas.',
      'Lampirkan tangkapan layar (opsional) dan kode referensi error (ERR-...) bila muncul.',
      'Simpan nomor tiket (DPBI/TIKET/...) untuk memantau perkembangan penanganan.',
    ],
    tips: ['Jika Anda mengklik "Laporkan Kendala" dari halaman error, nama halaman dan kode referensi terisi otomatis.'],
    commonMistakes: ['Mengirim kata sandi atau data pribadi sensitif di dalam kolom deskripsi tiket.'],
    relatedPaths: [{ label: 'Pusat Bantuan', path: '/bantuan' }],
  },
  {
    pathPrefix: '/pengaturan',
    title: 'Panduan Pengaturan, Preferensi & Aksesibilitas',
    purpose: 'Mengatur tema Terang/Gelap, ukuran tampilan teks (Ringkas/Nyaman/Besar), halaman awal setelah masuk, menu favorit, keamanan sandi, dan RBAC.',
    steps: [
      'Buka tab "Tampilan & Preferensi" untuk menyesuaikan skala teks dan halaman awal default Anda.',
      'Kelola daftar "Menu Favorit" agar pintasan penting selalu tampil di bagian atas bilah samping.',
      'Periksa tab "Sesi Aktif" secara berkala untuk memastikan tidak ada perangkat asing yang masuk.',
    ],
    tips: ['Pengubahan kata sandi otomatis merotasi ID sesi dan mengeluarkan seluruh perangkat lain.'],
    commonMistakes: ['Lupa menyimpan preferensi setelah mengubah pilihan halaman awal.'],
    relatedPaths: [{ label: 'Beranda Saya', path: '/beranda' }],
  },
  {
    pathPrefix: '/status-sistem',
    title: 'Panduan Pusat Kesehatan & Pemeliharaan Sistem',
    purpose: 'Pemantauan kondisi database SQLite WAL, kapasitas penyimpanan, antrean email, riwayat backup SHA-256, latensi API, dan kendali mode pemeliharaan.',
    steps: [
      'Pantau indikator latensi DB dan persentase pemakaian storage secara berkala.',
      'Jalankan validasi SHA-256 pada arsip backup terbaru untuk memastikan cadangan siap dipulihkan.',
      'Aktifkan Mode Pemeliharaan hanya saat melakukan perbaikan atau pemulihan basis data.',
    ],
    tips: ['Semua metrik bersumber langsung dari layanan aktif tanpa menampilkan rahasia konfigurasi atau data pribadi pengguna.'],
    commonMistakes: ['Lupa menonaktifkan Mode Pemeliharaan setelah pekerjaan selesai sehingga pengguna lain tertahan HTTP 503.'],
    relatedPaths: [{ label: 'Pusat Kendala', path: '/kendala' }],
  },
];

export const DPBI_GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Duta',
    fullName: 'Duta Pelajar Berbudaya Indonesia',
    definition: 'Pelajar terpilih per angkatan yang melaksanakan program literasi, pelestarian budaya, dan kegiatan di tingkat sekolah/wilayah.',
    relatedPath: '/personalia',
  },
  {
    term: 'Korwil',
    fullName: 'Koordinator Wilayah',
    definition: 'Koordinator tingkat provinsi yang membina Duta daerah, memverifikasi proposal & LKL wilayah, serta menyusun Laporan Koordinator Wilayah.',
    relatedPath: '/wilayah',
  },
  {
    term: 'Proposal Kegiatan',
    fullName: 'Pengajuan Rencana Kegiatan Resmi DPBI',
    definition: 'Dokumen perencanaan kegiatan sebelum pelaksanaan. Bila disetujui, otomatis membuat agenda kalender dan 4 checklist tugas kerja.',
    relatedPath: '/proposal',
  },
  {
    term: 'LKL',
    fullName: 'Laporan Kegiatan Lapangan',
    definition: 'Laporan pertanggungjawaban setelah kegiatan terlaksana, berisi ringkasan, jumlah peserta, capaian, PDF resmi, dan foto dokumentasi.',
    relatedPath: '/laporan-kegiatan',
  },
  {
    term: 'LKW',
    fullName: 'Laporan Koordinator Wilayah',
    definition: 'Rekapitulasi periodik pembinaan Duta dan kondisi wilayah tingkat provinsi yang dikirimkan Koordinator Wilayah kepada pusat.',
    relatedPath: '/laporan-koordinator',
  },
  {
    term: 'Disposisi',
    fullName: 'Arahan Tindak Lanjut Surat Resmi',
    definition: 'Instruksi tertulis dari pimpinan atau sekretariat kepada pejabat/unit tertentu untuk menindaklanjuti surat masuk atau keluar beserta tenggatnya.',
    relatedPath: '/persuratan',
  },
  {
    term: 'SLA (72 Jam)',
    fullName: 'Service Level Agreement Pemeriksaan',
    definition: 'Batas waktu standar pemeriksaan pengajuan (umumnya 72 jam sejak diajukan) sebelum ditandai terlambat atau dieskalasikan.',
    relatedPath: '/persetujuan',
  },
  {
    term: 'Handover / Serah Terima',
    fullName: 'Serah Terima Jabatan Wilayah',
    definition: 'Proses pengalihan tanggung jawab, arsip, dan inventaris pembinaan provinsi dari koordinator lama kepada koordinator baru.',
    relatedPath: '/wilayah',
  },
  {
    term: 'Safeguarding',
    fullName: 'Perlindungan Peserta Didik & Keamanan Kegiatan',
    definition: 'Kerangka pencegahan risiko, persetujuan orang tua/wali, asesmen keselamatan kegiatan pelajar, serta pelaporan insiden secara aman.',
    relatedPath: '/perlindungan',
  },
  {
    term: 'RBAC & Delegasi',
    fullName: 'Role-Based Access Control & Pelimpahan Wewenang',
    definition: 'Pengaturan hak akses berbasis peran dan pelimpahan wewenang sementara bertanggal kadaluwarsa untuk kebutuhan operasional tertentu.',
    relatedPath: '/organisasi',
  },
  {
    term: 'SK',
    fullName: 'Surat Keputusan Resmi',
    definition: 'Dokumen penetapan jabatan, kepengurusan, atau kebijakan organisasi resmi yang diterbitkan Sekretariat Nasional.',
    relatedPath: '/dokumen',
  },
  {
    term: 'Idempotensi',
    fullName: 'Perlindungan Pengiriman Ganda',
    definition: 'Mekanisme pengaman agar klik berulang atau gangguan jaringan tidak menghasilkan dua proposal, dua LKL, atau dua tiket yang sama.',
  },
];

export const FAQ_ITEMS: FaqEntry[] = [
  {
    id: 'faq-1',
    category: 'Proposal & LKL',
    question: 'Mengapa saya tidak bisa mengunggah LKL dengan menautkan proposal saya?',
    answer: 'Hanya proposal yang berstatus "Disetujui" yang dapat ditautkan ke LKL. Jika proposal Anda masih Draft, Diajukan, atau Perlu Revisi, selesaikan proses persetujuannya terlebih dahulu atau pilih opsi "Kegiatan Non-Proposal (Mandiri)".',
    actionPath: '/proposal',
    actionLabel: 'Periksa Status Proposal',
  },
  {
    id: 'faq-2',
    category: 'Proposal & LKL',
    question: 'Apa yang terjadi jika halaman tertutup saat saya sedang mengisi formulir panjang?',
    answer: 'SATU DPBI menyimpan draf lokal secara otomatis setiap beberapa detik di peramban Anda. Saat membuka kembali formulir Proposal atau LKL baru, klik tombol "Pulihkan" pada banner di bagian atas.',
    actionPath: '/proposal/baru',
    actionLabel: 'Buka Formulir Proposal',
  },
  {
    id: 'faq-3',
    category: 'Persetujuan & Revisi',
    question: 'Bagaimana cara mengetahui berkas saya sedang berada di tahap mana dan siapa pemeriksanya?',
    answer: 'Buka detail Proposal, LKL, atau Surat Resmi lalu lihat panel "Pelacak Proses". Panel tersebut menjelaskan tahap saat ini, siapa yang harus bertindak berikutnya, tenggat SLA, catatan pemeriksa, dan riwayat perpindahan.',
    actionPath: '/beranda',
    actionLabel: 'Pantau di Beranda Saya',
  },
  {
    id: 'faq-4',
    category: 'Akun & Keamanan',
    question: 'Mengapa saya otomatis keluar (sesi 419) setelah lama tidak membuka halaman?',
    answer: 'Demi keamanan data organisasi dan peserta didik, sesi otomatis berakhir jika melebihi batas tidak aktif (idle) atau masa berlaku sesi maksimal 24 jam. Masuk kembali dan draf lokal formulir Anda tetap aman untuk dipulihkan.',
    actionPath: '/pengaturan/sesi',
    actionLabel: 'Lihat Kebijakan Sesi',
  },
  {
    id: 'faq-5',
    category: 'Navigasi & Tampilan',
    question: 'Bisakah saya memperbesar ukuran teks atau mengubah halaman pertama saat login?',
    answer: 'Ya. Buka Pengaturan > Tampilan & Preferensi untuk memilih skala tampilan (Ringkas, Nyaman, atau Besar), memilih halaman awal default (Beranda Saya / Dashboard / Tugas Saya), dan mengatur Menu Favorit.',
    actionPath: '/pengaturan',
    actionLabel: 'Buka Pengaturan Tampilan',
  },
  {
    id: 'faq-6',
    category: 'Kendala & Error',
    question: 'Bagaimana cara melaporkan error atau data yang tidak sesuai?',
    answer: 'Klik menu "Laporkan Kendala" di profil atau footer, atau buka halaman Pusat Kendala (/kendala). Sertakan halaman kejadian, uraian singkat, dan tangkapan layar bila ada agar tim pengelola dapat menindaklanjuti.',
    actionPath: '/kendala',
    actionLabel: 'Buka Pusat Kendala',
  },
];

export function resolvePageHelp(pathname: string): PageHelpGuide {
  const clean = (pathname || '/beranda').split('?')[0];
  const exact = PAGE_HELP_GUIDES.find((g) => clean === g.pathPrefix || clean.startsWith(`${g.pathPrefix}/`));
  if (exact) return exact;
  return {
    pathPrefix: clean,
    title: 'Panduan Navigasi & Bantuan Halaman',
    purpose: 'Halaman ini merupakan bagian dari Portal Administrasi Terpadu SATU DPBI yang dilindungi kontrol akses berbasis peran (RBAC).',
    steps: [
      'Gunakan Pencarian Cepat (Ctrl+K) di bilah atas untuk melompat ke halaman atau data tertentu.',
      'Buka Beranda Saya untuk melihat tugas dan pengajuan yang paling relevan bagi peran Anda.',
      'Jika menemukan kendala teknis atau ketidaksesuaian data, gunakan menu Laporkan Kendala.',
    ],
    tips: ['Anda dapat menyematkan halaman ini ke Menu Favorit melalui Command Palette (Ctrl+K).'],
    commonMistakes: [],
    relatedPaths: [
      { label: 'Beranda Saya', path: '/beranda' },
      { label: 'Pusat Bantuan Lengkap', path: '/bantuan' },
      { label: 'Laporkan Kendala', path: '/kendala' },
    ],
  };
}

export function normalizeDisplayScale(raw: string | null | undefined): DisplayScale {
  if (raw === 'ringkas' || raw === 'besar') return raw;
  return 'nyaman';
}

export function sanitizeFavoritePaths(paths: unknown, allowedPaths?: Set<string>): string[] {
  if (!Array.isArray(paths)) return [];
  const unique: string[] = [];
  for (const item of paths) {
    if (typeof item !== 'string') continue;
    const trimmed = item.trim();
    if (!trimmed.startsWith('/')) continue;
    if (allowedPaths && !allowedPaths.has(trimmed)) continue;
    if (!unique.includes(trimmed)) unique.push(trimmed);
    if (unique.length >= 8) break;
  }
  return unique;
}

export function calculateChecklistCompleteness(items: { ok: boolean }[]): {
  completed: number;
  total: number;
  percent: number;
} {
  if (items.length === 0) return { completed: 0, total: 0, percent: 100 };
  const completed = items.filter((i) => i.ok).length;
  return {
    completed,
    total: items.length,
    percent: Math.round((completed / items.length) * 100),
  };
}
