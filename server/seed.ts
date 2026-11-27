import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { INDONESIA_PROVINCES } from '../src/lib/provinces';
import { IS_DEMO_MODE, PRIVATE_STORAGE_DIR } from './db';
import { hashPassword, sha256 } from './security';

function createMinimalPdfBuffer(title: string, refNo: string, bodyLine: string): Buffer {
  const safeText = (t: string) => t.replace(/[()\\]/g, '');
  const content = `BT /F1 14 Tf 50 750 Td (${safeText(title)}) Tj 0 -24 Td /F1 10 Tf (Nomor Referensi: ${safeText(refNo)}) Tj 0 -18 Td (${safeText(bodyLine)}) Tj 0 -18 Td (Dokumen Resmi SATU DPBI - Sistem Administrasi Terpadu Utama) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${content.length} >> stream
${content}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000450 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
520
%%EOF`;
  return Buffer.from(pdf, 'utf8');
}

function saveSeedPdf(
  db: DatabaseSync,
  title: string,
  refNo: string,
  bodyLine: string,
  module: string,
  uploadedBy: string
): { fileId: string; fileName: string; sizeBytes: number } {
  const buf = createMinimalPdfBuffer(title, refNo, bodyLine);
  const fileId = crypto.randomUUID();
  const storedName = `${fileId}.pdf`;
  const fileName = `${refNo.replace(/\//g, '_')}.pdf`;
  fs.writeFileSync(path.join(PRIVATE_STORAGE_DIR, storedName), buf);
  db.prepare(
    `INSERT INTO stored_files (id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, module, uploaded_by, is_archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    fileId,
    fileName,
    storedName,
    'application/pdf',
    buf.length,
    sha256(buf),
    module,
    uploadedBy,
    new Date().toISOString()
  );
  return { fileId, fileName, sizeBytes: buf.length };
}

export function ensureSeeded(db: DatabaseSync): void {
  const now = new Date().toISOString();

  // 1. Always seed 38 Provinces if empty
  const provCount = (db.prepare('SELECT COUNT(*) AS c FROM provinces').get() as { c: number }).c;
  if (provCount === 0) {
    const stmt = db.prepare(
      `INSERT INTO provinces (code, name, island, status, coordinator_id, coordinator_name, coaching_note, min_lat, max_lat, min_lng, max_lng, center_lat, center_lng)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of INDONESIA_PROVINCES) {
      stmt.run(p.code, p.name, p.island, 'belum_terbentuk', p.minLat, p.maxLat, p.minLng, p.maxLng, p.centerLat, p.centerLng);
    }
  }

  // 1b. Always seed Regencies (~514 real kabupaten/kota) from public/maps/regencies-index.json if empty
  const regCount = (db.prepare('SELECT COUNT(*) AS c FROM regencies').get() as { c: number }).c;
  if (regCount === 0) {
    const regIndexPath = path.resolve(process.cwd(), 'public', 'maps', 'regencies-index.json');
    if (fs.existsSync(regIndexPath)) {
      const regItems = JSON.parse(fs.readFileSync(regIndexPath, 'utf8')) as {
        code: string;
        provinceCode: string;
        name: string;
        kind: string;
      }[];
      const regStmt = db.prepare(
        `INSERT OR IGNORE INTO regencies (code, province_code, name, kind, status, coordinator_name, coaching_note)
         VALUES (?, ?, ?, ?, 'belum_terbentuk', NULL, NULL)`
      );
      for (const r of regItems) {
        if (!r.code || r.code.includes('/') || r.code.length > 6) continue;
        regStmt.run(r.code, r.provinceCode, r.name, r.kind || 'kabupaten');
      }
    }
  }

  // 1c. Seed cascading sample districts & villages for major operational regions if empty
  const distCount = (db.prepare('SELECT COUNT(*) AS c FROM districts').get() as { c: number }).c;
  if (distCount === 0) {
    const distRows: [string, string, string][] = [
      ['31.74.01', '31.74', 'Kebayoran Baru'],
      ['31.74.02', '31.74', 'Tebet'],
      ['31.71.01', '31.71', 'Menteng'],
      ['31.75.01', '31.75', 'Pulo Gadung'],
      ['32.73.01', '32.73', 'Coblong'],
      ['32.73.02', '32.73', 'Bandung Wetan'],
      ['32.71.01', '32.71', 'Bogor Tengah'],
      ['32.71.02', '32.71', 'Tanah Sareal'],
      ['32.76.01', '32.76', 'Beji'],
      ['33.72.01', '33.72', 'Laweyan'],
      ['33.74.01', '33.74', 'Semarang Tengah'],
      ['34.71.01', '34.71', 'Gondokusuman'],
      ['35.73.01', '35.73', 'Klojen'],
      ['35.78.01', '35.78', 'Genteng'],
      ['51.71.01', '51.71', 'Denpasar Timur'],
      ['51.71.02', '51.71', 'Denpasar Barat'],
      ['12.71.01', '12.71', 'Medan Baru'],
      ['13.71.01', '13.71', 'Padang Barat'],
      ['73.71.01', '73.71', 'Makassar'],
      ['64.72.01', '64.72', 'Samarinda Ulu'],
    ];
    const dStmt = db.prepare('INSERT OR IGNORE INTO districts (code, regency_code, name) VALUES (?, ?, ?)');
    for (const d of distRows) dStmt.run(...d);

    const vilRows: [string, string, string][] = [
      ['31.74.01.1001', '31.74.01', 'Senayan'],
      ['31.74.01.1002', '31.74.01', 'Selong'],
      ['31.74.02.1001', '31.74.02', 'Tebet Barat'],
      ['31.71.01.1001', '31.71.01', 'Cikini'],
      ['31.75.01.1001', '31.75.01', 'Jati'],
      ['32.73.01.1001', '32.73.01', 'Dago'],
      ['32.73.01.1002', '32.73.01', 'Lebak Siliwangi'],
      ['32.73.02.1001', '32.73.02', 'Citarum'],
      ['32.71.01.1001', '32.71.01', 'Paledang'],
      ['32.71.01.1002', '32.71.01', 'Pabaton'],
      ['33.72.01.1001', '33.72.01', 'Sriwedari'],
      ['33.74.01.1001', '33.74.01', 'Sekayu'],
      ['34.71.01.1001', '34.71.01', 'Terban'],
      ['35.73.01.1001', '35.73.01', 'Oro-oro Dowo'],
      ['35.78.01.1001', '35.78.01', 'Ketabang'],
      ['51.71.01.1001', '51.71.01', 'Sumerta'],
      ['51.71.02.1001', '51.71.02', 'Pemecutan'],
      ['12.71.01.1001', '12.71.01', 'Babura'],
      ['13.71.01.1001', '13.71.01', 'Belakang Tangsi'],
      ['73.71.01.1001', '73.71.01', 'Maricaya'],
    ];
    const vStmt = db.prepare('INSERT OR IGNORE INTO villages (code, district_code, name) VALUES (?, ?, ?)');
    for (const v of vilRows) vStmt.run(...v);
  }

  // 2. Always seed default system settings & approval matrix rules
  const settingsCount = (db.prepare('SELECT COUNT(*) AS c FROM system_settings').get() as { c: number }).c;
  const defaultSettings: [string, string][] = [
    ['public_stats_approved', 'true'],
    ['public_show_duta_count', 'true'],
    ['default_batch_duration_months', '4'],
    ['monthly_report_deadline_day', '5'],
    ['final_report_deadline_hours', '168'],
    ['alumni_access_window_days', '30'],
    ['storage_quota_mb', process.env.STORAGE_QUOTA_MB || '10240'],
    ['max_pdf_upload_mb', '15'],
    ['max_photo_upload_mb', '5'],
    ['kemendikdasmen_status', 'nonaktif'],
    ['safeguarding_min_chaperones_u18', '2'],
    ['eval_weight_task', '30'],
    ['eval_weight_timeliness', '25'],
    ['eval_weight_quality', '25'],
    ['eval_weight_coordination', '20'],
    ['session_ttl_hours', '24'],
    ['idle_timeout_minutes', '45'],
  ];
  const sStmt = db.prepare('INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)');
  if (settingsCount === 0) {
    for (const [k, v] of defaultSettings) {
      sStmt.run(k, v, now);
    }
  } else {
    sStmt.run('public_show_duta_count', 'true', now);
    sStmt.run('session_ttl_hours', '24', now);
    sStmt.run('idle_timeout_minutes', '45', now);
  }

  // 2b. Always seed CMS Public Contents & Help Center Articles if empty
  const cmsCount = (db.prepare('SELECT COUNT(*) AS c FROM cms_contents').get() as { c: number }).c;
  if (cmsCount === 0) {
    const cmsItems: [string, string, string][] = [
      [
        'hero_subtitle',
        'Duta Pelajar Berbudaya Indonesia',
        'Program kepemimpinan pelajar independen berskala nasional yang menghubungkan generasi muda di 38 provinsi untuk berkarya melalui literasi budaya, pendidikan karakter, dan kolaborasi daerah.',
      ],
      [
        'about_dpbi',
        'Tentang Duta Pelajar Berbudaya Indonesia (DPBI)',
        'Duta Pelajar Berbudaya Indonesia (DPBI) adalah organisasi kepemimpinan dan penggerak literasi budaya pelajar yang berdiri secara independen di Indonesia.\n\nDengan semangat "Berbudaya, Bergerak, dan Berdampak Untuk Negeri", DPBI membina pelajar SMA/SMK/MA/sederajat di 38 provinsi dan lebih dari 500 kabupaten/kota melalui masa tugas terstruktur per angkatan, pelaporan berbasis bukti, serta standar perlindungan peserta didik.',
      ],
      [
        'vision_mission',
        'Visi, Misi, dan Prinsip Tata Kelola',
        'Visi: Mewujudkan generasi pelajar Indonesia yang berakar pada nilai budaya Nusantara, aktif bergerak di daerahnya, dan memberi dampak sosial yang terukur.\n\nMisi:\n1. Menghadirkan pembinaan terstruktur lintas 38 provinsi dan kabupaten/kota.\n2. Menyelenggarakan kegiatan literasi, edukasi, dan pelestarian budaya berbasis bukti lapangan.\n3. Menjaga integritas administrasi, keamanan data peserta didik, dan tata kelola organisasi yang akuntabel.',
      ],
      [
        'official_contact',
        'Sekretariat Nasional & Kontak Resmi',
        'Sekretariat Nasional Duta Pelajar Berbudaya Indonesia\nEmail Resmi: sekretariat@dpbi.or.id\nPortal Administrasi: https://satu.dpbi.or.id\nJam Layanan Administrasi: Senin–Jumat, 09.00–17.00 WIB',
      ],
      [
        'social_links',
        'Kanal Informasi Resmi',
        'Instagram: @dutapelajarberbudaya.id | YouTube: DPBI Official Nusantara | Portal Dokumentasi: SATU DPBI',
      ],
    ];
    const cmsStmt = db.prepare(
      'INSERT OR IGNORE INTO cms_contents (key, title, body, updated_by, updated_at) VALUES (?, ?, ?, ?, ?)'
    );
    for (const [k, t, b] of cmsItems) {
      cmsStmt.run(k, t, b, 'Sekretariat Nasional', now);
    }
  }

  const helpCount = (db.prepare('SELECT COUNT(*) AS c FROM help_articles').get() as { c: number }).c;
  if (helpCount === 0) {
    const articles: [string, string, string, string, string, string, string, number][] = [
      [
        'hlp-1', 'pengenalan-satu-dpbi', 'Umum & Publik', 'umum',
        'Apa itu SATU DPBI dan Perbedaannya dengan Website Informasi DPBI?',
        'Penjelasan ringkas mengenai fungsi portal administrasi internal SATU DPBI serta keterbukaan informasi publik yang aman.',
        'Website Informasi DPBI menyediakan pengenalan organisasi, visi-misi, serta peta persebaran wilayah 38 provinsi dan kabupaten/kota yang aman diakses masyarakat. Sementara itu, Portal Internal SATU DPBI digunakan khusus oleh personel terdaftar (Duta, Koordinator Wilayah, Pengurus Nasional, Sekretariat, dan Pengawas) untuk mengelola proposal, LKL, personalia, dokumen SK/Sertifikat, dan arsip.',
        1,
      ],
      [
        'hlp-2', 'cara-aktivasi-dan-login', 'Akun & Keamanan', 'umum',
        'Cara Aktivasi Akun Undangan dan Pemulihan Kata Sandi',
        'Langkah-langkah mengaktifkan akun baru dari undangan Sekretariat Nasional serta prosedur lupa kata sandi.',
        'Setiap akun baru diterbitkan melalui pengajuan Koordinator Wilayah atau undangan resmi Sekretariat Nasional dengan token aktivasi sekali pakai berbatas waktu. Gunakan halaman Verifikasi Undangan/Aktivasi untuk mengatur kata sandi minimal 8 karakter. Bila lupa kata sandi, ajukan tautan pemulihan melalui menu Lupa Kata Sandi pada halaman Masuk SATU DPBI.',
        2,
      ],
      [
        'hlp-3', 'panduan-duta-proposal-lkl', 'Operasional Duta', 'duta',
        'Panduan Pengajuan Proposal Kegiatan dan Laporan Kegiatan Lapangan (LKL)',
        'Alur pengajuan proposal berdasarkan Approval Matrix hingga pelaporan LKL beserta foto dokumentasi dan cetak A4.',
        '1. Lengkapi profil personalia (termasuk wilayah domisili bertingkat dan berkas wajib).\n2. Ajukan proposal pada menu Proposal dengan mencantumkan kategori, tingkat risiko, penggunaan identitas DPBI, dan estimasi peserta.\n3. Setelah disetujui (oleh Koordinator Wilayah untuk kegiatan lokal berisiko rendah atau Pengurus Nasional sesuai Bidang untuk kegiatan berdampak luas), laksanakan kegiatan dan kirim LKL beserta unggahan PDF serta foto dokumentasi.',
        3,
      ],
      [
        'hlp-4', 'panduan-koordinator-wilayah', 'Koordinasi Wilayah', 'koordinator_wilayah',
        'Tugas Koordinator Wilayah, Verifikasi LKL, dan Laporan Bulanan',
        'Tanggung jawab pemantauan kabupaten/kota, pemeriksaan LKL Duta, dan batas waktu laporan bulanan tanggal 5.',
        'Koordinator Wilayah memantau keterwakilan kabupaten/kota di provinsinya, memeriksa kelengkapan berkas Duta baru, meninjau proposal lokal maupun LKL kegiatan wilayah, serta menyampaikan Laporan Bulanan Koordinator paling lambat tanggal 5 setiap bulan (serta Laporan Akhir maksimal 7 hari setelah penutupan angkatan).',
        4,
      ],
      [
        'hlp-5', 'struktur-6-bidang-pengurus', 'Kepengurusan Nasional', 'pengurus_nasional',
        'Struktur 6 Bidang Resmi Pengurus Nasional DPBI',
        'Pembagian ruang kerja 6 Bidang Pengurus Nasional dalam meninjau proposal, program wilayah, dan publikasi.',
        'Pengurus Nasional terbagi menjadi 6 Bidang resmi: (1) Bidang Administrasi & Organisasi, (2) Bidang Program & Operasional, (3) Bidang Pengembangan Wilayah, (4) Bidang Pendidikan & Kebudayaan, (5) Bidang Hubungan & Kemitraan, serta (6) Bidang Media, Publikasi & Teknologi. Masing-masing bidang memiliki fokus antrean persetujuan dan pemantauan program yang relevan.',
        5,
      ],
      [
        'hlp-6', 'keamanan-data-perlindungan', 'Keamanan & Privasi', 'umum',
        'Kebijakan Privasi, Perlindungan Pelajar, dan Masa Akses Alumni 30 Hari',
        'Bagaimana SATU DPBI melindungi data pribadi siswa (NISN, alamat, kontak wali) serta masa transisi alumni.',
        'Data pribadi seperti alamat lengkap, NISN, nomor telepon pribadi, dan kontak orang tua/wali dilindungi ketat dan tidak pernah ditampilkan di halaman publik maupun kepada pihak tanpa kewenangan. Setelah masa tugas 4 bulan berakhir, akun Alumni memperoleh jendela akses 30 hari untuk mengunduh sertifikat resmi dan arsip pribadinya.',
        6,
      ],
    ];
    const hStmt = db.prepare(
      `INSERT OR IGNORE INTO help_articles (id, slug, category, role_target, title, summary, content, sort_order, is_published, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
    );
    for (const a of articles) {
      hStmt.run(...a, now);
    }
  }

  const matrixCount = (db.prepare('SELECT COUNT(*) AS c FROM approval_matrix_rules').get() as { c: number }).c;
  if (matrixCount === 0) {
    const rules = [
      ['amr-1', 'Kebudayaan', 'Festival / Pameran Budaya', 'tinggi', 1, 1, 'pengurus_nasional', 'Melibatkan peserta luas & izin eksternal; diputuskan Pengurus Nasional Bidang Kebudayaan.'],
      ['amr-2', 'Pendidikan', 'Lokakarya / Literasi Pelajar', 'sedang', 1, 0, 'pengurus_nasional', 'Menggunakan identitas resmi DPBI tingkat wilayah/nasional; ditinjau Pengurus Nasional Bidang Pendidikan.'],
      ['amr-3', 'Program dan Operasional', 'Diskusi / Aksi Sekolah Lokal', 'rendah', 0, 0, 'koordinator_wilayah', 'Kegiatan berisiko rendah tingkat sekolah/kota; disetujui oleh Koordinator Wilayah setempat.'],
      ['amr-4', 'Hubungan dan Kemitraan', 'Kemitraan Eksternal / Lintas Lembaga', 'tinggi', 1, 1, 'pengurus_nasional', 'Wajib verifikasi Pengurus Nasional Bidang Kemitraan dan Penilaian Risiko.'],
    ];
    const mStmt = db.prepare(
      `INSERT INTO approval_matrix_rules (id, bidang, category, risk_level, uses_dpbi_identity, external_permit_needed, approver_role, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of rules) {
      mStmt.run(...r);
    }
  }

  const autoCount = (db.prepare('SELECT COUNT(*) AS c FROM automation_jobs').get() as { c: number }).c;
  if (autoCount === 0) {
    const jobs = [
      ['job-1', 'penomoran_otomatis', 'Penomoran Referensi Atomik DPBI', 'Real-time saat pembuatan objek', 1, now, 'berhasil', 'Sequence terjamin unik per tahun.'],
      ['job-2', 'pengingat_laporan_bulanan', 'Pengingat Laporan Bulanan Koordinator', 'Setiap tanggal 1 & 4 pukul 08:00 WIB', 1, now, 'berhasil', 'Notifikasi pengingat tanggal 5 aktif.'],
      ['job-3', 'pengingat_alumni_30_hari', 'Pengingat Batas Akses Alumni (H-7, H-3, H-1)', 'Harian pukul 07:00 WIB', 1, now, 'berhasil', 'Memantau jendela arsip 30 hari alumni.'],
      ['job-4', 'pengingat_tenggat_tugas', 'Eskalasi Tugas & Proposal Mendekati Tenggat', 'Setiap 6 jam', 1, now, 'berhasil', 'Idempotency key aktif untuk cegah duplikasi.'],
      ['job-5', 'pemeriksaan_kapasitas_storage', 'Pemantauan Kapasitas Storage (70% / 85% / 95%)', 'Setiap jam', 1, now, 'berhasil', 'Ambang batas terpantau normal.'],
    ];
    const jStmt = db.prepare(
      `INSERT INTO automation_jobs (id, job_key, name, schedule_label, enabled, last_run_at, last_status, last_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const j of jobs) jStmt.run(...j);
  }

  // Always ensure flagship programs & 18 official email templates exist in both Prod & Demo
  seedFlagshipPrograms(db, now);
  seedDefaultEmailTemplates(db, now);

  // Stop here if NOT in Demo Mode — production starts clean with zero demo accounts!
  if (!IS_DEMO_MODE) return;

  // Idempotent migration/alignment on existing demo DBs: align Pengurus Bidang to the 6 official Bidang & active sample regencies
  const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  if (userCount > 0) {
    db.prepare("UPDATE users SET bidang = 'Bidang Pendidikan & Kebudayaan' WHERE id = 'usr-pengurus' AND (bidang = 'Kebudayaan' OR bidang IS NULL)").run();
    db.prepare("UPDATE personnel SET bidang = 'Bidang Pendidikan & Kebudayaan', position_title = 'Ketua Bidang Pendidikan & Kebudayaan' WHERE id = 'pers-4' AND bidang = 'Kebudayaan'").run();
    db.prepare("UPDATE announcements SET is_public = 1 WHERE id IN ('ann-1', 'ann-2')").run();
    const activeRegs: [string, string, string][] = [
      ['31.74', 'aktif', 'Tim Koordinasi Jakarta Selatan'],
      ['32.73', 'aktif', 'Koordinator Kota Bandung'],
      ['32.71', 'aktif', 'Koordinator Kota Bogor'],
      ['33.72', 'dalam_pengembangan', 'Tim Pelopor Kota Surakarta'],
      ['34.71', 'aktif', 'Koordinator Kota Yogyakarta'],
      ['35.73', 'dalam_pengembangan', 'Alumni & Pendamping Malang'],
      ['51.71', 'aktif', 'Koordinator Kota Denpasar'],
    ];
    const rUpd = db.prepare("UPDATE regencies SET status = ?, coordinator_name = COALESCE(coordinator_name, ?) WHERE code = ? AND status = 'belum_terbentuk'");
    for (const [rc, st, cn] of activeRegs) rUpd.run(st, cn, rc);
    seedOrgHierarchyPositions(db, now);
    // Link seeded proposals/LKL/tasks to Flagship Programs idempotently
    db.prepare("UPDATE proposals SET program_id = 'prog-btc' WHERE id = 'prop-1' AND program_id IS NULL").run();
    db.prepare("UPDATE proposals SET program_id = 'prog-bms' WHERE id = 'prop-2' AND program_id IS NULL").run();
    db.prepare("UPDATE proposals SET program_id = 'prog-sw' WHERE id = 'prop-3' AND program_id IS NULL").run();
    db.prepare("UPDATE lkl_reports SET program_id = 'prog-btc' WHERE id = 'lkl-1' AND program_id IS NULL").run();
    db.prepare("UPDATE lkl_reports SET program_id = 'prog-bms' WHERE id = 'lkl-2' AND program_id IS NULL").run();
    db.prepare("UPDATE tasks SET program_id = 'prog-btc' WHERE id = 'tgs-4' AND program_id IS NULL").run();
    return;
  }

  // 3. Seed Isolated Demo Simulation Data
  const demoPassHash = hashPassword('Simulasi2026!');

  // Batches
  db.prepare(
    `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('batch-1', 1, 'Angkatan I — Perintis Nusantara', '2025-11-01', '2025-12-01', '2025-12-15', '2026-01-01', '2026-04-30', 4, 'diarsipkan', now);
  db.prepare(
    `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('batch-2', 2, 'Angkatan II — Gelora Budaya', '2026-03-01', '2026-04-05', '2026-04-20', '2026-05-01', '2026-08-31', 4, 'selesai', now);
  db.prepare(
    `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run('batch-3', 3, 'Angkatan III — Karya Pelajar Berbudaya', '2026-08-01', '2026-09-01', '2026-09-12', '2026-09-15', '2027-01-15', 4, 'aktif', now);

  // Sequences initialized
  const seqStmt = db.prepare('INSERT INTO reference_sequences (category, year, last_seq) VALUES (?, 2026, ?)');
  seqStmt.run('PERS', 10);
  seqStmt.run('PROP', 4);
  seqStmt.run('LKL', 4);
  seqStmt.run('LKW', 3);
  seqStmt.run('TGS', 5);
  seqStmt.run('DOC', 6);
  seqStmt.run('AKUN', 2);
  seqStmt.run('INS', 1);
  seqStmt.run('ADU', 1);
  seqStmt.run('HND', 1);

  // Demo Users & Personnel across all 8 roles
  const demoUsers = [
    {
      id: 'usr-super', email: 'superadmin@simulasi.dpbi.or.id', fullName: 'Raden Bagus Prasetyo (Simulasi)',
      role: 'super_admin', bidang: 'Tata Kelola Nasional', provinceCode: '31', batchId: 'batch-3', personnelId: 'pers-1',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-wakil', email: 'wakil@simulasi.dpbi.or.id', fullName: 'Ayu Lestari Kusuma (Simulasi)',
      role: 'wakil_super_admin', bidang: 'Koordinasi Wilayah & Sistem', provinceCode: '31', batchId: 'batch-3', personnelId: 'pers-2',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-pj', email: 'pengawas@simulasi.dpbi.or.id', fullName: 'Dr. Hendra Wijaya (Simulasi)',
      role: 'penanggung_jawab', bidang: 'Pengawasan & Perlindungan', provinceCode: '31', batchId: 'batch-3', personnelId: 'pers-3',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-pengurus', email: 'pengurus.budaya@simulasi.dpbi.or.id', fullName: 'Niken Larasati (Simulasi)',
      role: 'pengurus_nasional', bidang: 'Bidang Pendidikan & Kebudayaan', provinceCode: '34', batchId: 'batch-3', personnelId: 'pers-4',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-pengurus-wilayah', email: 'pengurus.wilayah@simulasi.dpbi.or.id', fullName: 'Bagas Prakoso (Simulasi)',
      role: 'pengurus_nasional', bidang: 'Bidang Pengembangan Wilayah', provinceCode: '31', batchId: 'batch-3', personnelId: 'pers-4',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-sekretariat', email: 'sekretariat@simulasi.dpbi.or.id', fullName: 'Fajar Ramadhan (Simulasi)',
      role: 'sekretariat_nasional', bidang: 'Administrasi dan Pengembangan Organisasi', provinceCode: '31', batchId: 'batch-3', personnelId: 'pers-5',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-korwil-jabar', email: 'korwil.jabar@simulasi.dpbi.or.id', fullName: 'Siti Nurhaliza Putri (Simulasi)',
      role: 'koordinator_wilayah', bidang: 'Program dan Operasional', provinceCode: '32', batchId: 'batch-3', personnelId: 'pers-6',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-korwil-bali', email: 'korwil.bali@simulasi.dpbi.or.id', fullName: 'I Made Arya Putra (Simulasi)',
      role: 'koordinator_wilayah', bidang: 'Kebudayaan', provinceCode: '51', batchId: 'batch-3', personnelId: 'pers-7',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-duta-jabar', email: 'duta.jabar@simulasi.dpbi.or.id', fullName: 'Raka Pratama (Simulasi)',
      role: 'duta', bidang: 'Kebudayaan', provinceCode: '32', batchId: 'batch-3', personnelId: 'pers-8',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-duta-jateng', email: 'duta.jateng@simulasi.dpbi.or.id', fullName: 'Sekar Arum Sari (Simulasi)',
      role: 'duta', bidang: 'Pendidikan', provinceCode: '33', batchId: 'batch-3', personnelId: 'pers-9',
      status: 'aktif', alumniExp: null,
    },
    {
      id: 'usr-alumni', email: 'alumni.b2@simulasi.dpbi.or.id', fullName: 'Bima Sakti Nugroho (Simulasi)',
      role: 'alumni', bidang: 'Kebudayaan', provinceCode: '35', batchId: 'batch-2', personnelId: 'pers-10',
      status: 'alumni_terbatas', alumniExp: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    },
  ];

  const uStmt = db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, bidang, province_code, batch_id, personnel_id, account_status, alumni_access_expires_at, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  for (const u of demoUsers) {
    uStmt.run(u.id, u.email, demoPassHash, u.fullName, u.role, u.bidang, u.provinceCode, u.batchId, u.personnelId, u.status, u.alumniExp, now);
  }

  // Personnel records
  const persList = [
    {
      id: 'pers-1', memberNo: 'DPBI-2026-0001', ref: 'DPBI/PERS/2026/0001', userId: 'usr-super',
      name: 'Raden Bagus Prasetyo (Simulasi)', nick: 'Bagus', bp: 'Jakarta', bd: '2001-05-14', gender: 'Laki-laki',
      email: 'superadmin@simulasi.dpbi.or.id', phone: '081100000001', prov: '31', reg: 'Jakarta Selatan', dist: 'Kebayoran Baru', vil: 'Senayan',
      addr: 'Jl. Hang Tuah Raya No. 12', school: 'Sekretariat Pusat DPBI', lvl: 'Pengelola', cls: 'Pusat', major: 'Tata Kelola', npsn: '20100001', nisn: '-',
      batch: 'batch-3', pos: 'Super Admin Sistem', bidang: 'Tata Kelola Nasional', role: 'super_admin',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: 'Keluarga Prasetyo', gRel: 'Orang Tua', gPhone: '081100009001',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-2', memberNo: 'DPBI-2026-0002', ref: 'DPBI/PERS/2026/0002', userId: 'usr-wakil',
      name: 'Ayu Lestari Kusuma (Simulasi)', nick: 'Ayu', bp: 'Surabaya', bd: '2002-08-22', gender: 'Perempuan',
      email: 'wakil@simulasi.dpbi.or.id', phone: '081100000002', prov: '31', reg: 'Jakarta Pusat', dist: 'Menteng', vil: 'Cikini',
      addr: 'Jl. Cikini Raya No. 48', school: 'Sekretariat Pusat DPBI', lvl: 'Pengelola', cls: 'Pusat', major: 'Koordinasi', npsn: '20100002', nisn: '-',
      batch: 'batch-3', pos: 'Wakil Super Admin', bidang: 'Koordinasi Wilayah & Sistem', role: 'wakil_super_admin',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: 'Kusuma Wijaya', gRel: 'Orang Tua', gPhone: '081100009002',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-3', memberNo: 'DPBI-2026-0003', ref: 'DPBI/PERS/2026/0003', userId: 'usr-pj',
      name: 'Dr. Hendra Wijaya (Simulasi)', nick: 'Hendra', bp: 'Semarang', bd: '1984-03-10', gender: 'Laki-laki',
      email: 'pengawas@simulasi.dpbi.or.id', phone: '081100000003', prov: '31', reg: 'Jakarta Timur', dist: 'Rawamangun', vil: 'Jati',
      addr: 'Jl. Pemuda No. 88', school: 'Dewan Pembina Yayasan', lvl: 'Pembina', cls: 'Pusat', major: 'Pengawasan', npsn: '-', nisn: '-',
      batch: 'batch-3', pos: 'Penanggung Jawab Organisasi', bidang: 'Pengawasan & Perlindungan', role: 'penanggung_jawab',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: '-', gRel: '-', gPhone: '-',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-4', memberNo: 'DPBI-2026-0004', ref: 'DPBI/PERS/2026/0004', userId: 'usr-pengurus',
      name: 'Niken Larasati (Simulasi)', nick: 'Niken', bp: 'Yogyakarta', bd: '2003-11-04', gender: 'Perempuan',
      email: 'pengurus.budaya@simulasi.dpbi.or.id', phone: '081100000004', prov: '34', reg: 'Kota Yogyakarta', dist: 'Gondokusuman', vil: 'Terban',
      addr: 'Jl. Suroto No. 19', school: 'Pengurus Nasional DPBI', lvl: 'Pengurus', cls: 'Nasional', major: 'Kebudayaan', npsn: '-', nisn: '-',
      batch: 'batch-3', pos: 'Ketua Bidang Pendidikan & Kebudayaan', bidang: 'Bidang Pendidikan & Kebudayaan', role: 'pengurus_nasional',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: 'Sri Wahyuni', gRel: 'Ibu', gPhone: '081100009004',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-5', memberNo: 'DPBI-2026-0005', ref: 'DPBI/PERS/2026/0005', userId: 'usr-sekretariat',
      name: 'Fajar Ramadhan (Simulasi)', nick: 'Fajar', bp: 'Bekasi', bd: '2004-01-20', gender: 'Laki-laki',
      email: 'sekretariat@simulasi.dpbi.or.id', phone: '081100000005', prov: '31', reg: 'Jakarta Selatan', dist: 'Tebet', vil: 'Tebet Barat',
      addr: 'Jl. Tebet Barat Dalam No. 25', school: 'Sekretariat Nasional DPBI', lvl: 'Sekretariat', cls: 'Nasional', major: 'Administrasi', npsn: '-', nisn: '-',
      batch: 'batch-3', pos: 'Kepala Sekretariat Nasional', bidang: 'Administrasi dan Pengembangan Organisasi', role: 'sekretariat_nasional',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: 'Hendra Ramadhan', gRel: 'Ayah', gPhone: '081100009005',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-6', memberNo: 'DPBI-2026-0006', ref: 'DPBI/PERS/2026/0006', userId: 'usr-korwil-jabar',
      name: 'Siti Nurhaliza Putri (Simulasi)', nick: 'Siti', bp: 'Bandung', bd: '2006-07-17', gender: 'Perempuan',
      email: 'korwil.jabar@simulasi.dpbi.or.id', phone: '081222000006', prov: '32', reg: 'Kota Bandung', dist: 'Coblong', vil: 'Dago',
      addr: 'Jl. Ir. H. Juanda No. 114', school: 'SMAN 3 Bandung', lvl: 'SMA/SMK/MA', cls: 'XII', major: 'IPS', npsn: '20219256', nisn: '0061234506',
      batch: 'batch-3', pos: 'Koordinator Wilayah Jawa Barat', bidang: 'Program dan Operasional', role: 'koordinator_wilayah',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: 'Dedi Mulyono', gRel: 'Ayah', gPhone: '081222009006',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-7', memberNo: 'DPBI-2026-0007', ref: 'DPBI/PERS/2026/0007', userId: 'usr-korwil-bali',
      name: 'I Made Arya Putra (Simulasi)', nick: 'Arya', bp: 'Denpasar', bd: '2006-09-02', gender: 'Laki-laki',
      email: 'korwil.bali@simulasi.dpbi.or.id', phone: '081236000007', prov: '51', reg: 'Kota Denpasar', dist: 'Denpasar Timur', vil: 'Sumerta',
      addr: 'Jl. Hayam Wuruk No. 72', school: 'SMAN 1 Denpasar', lvl: 'SMA/SMK/MA', cls: 'XII', major: 'IPA', npsn: '50103127', nisn: '0061234507',
      batch: 'batch-3', pos: 'Koordinator Wilayah Bali', bidang: 'Kebudayaan', role: 'koordinator_wilayah',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: 'I Nyoman Putra', gRel: 'Ayah', gPhone: '081236009007',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-8', memberNo: 'DPBI-2026-0008', ref: 'DPBI/PERS/2026/0008', userId: 'usr-duta-jabar',
      name: 'Raka Pratama (Simulasi)', nick: 'Raka', bp: 'Bogor', bd: '2009-02-11', gender: 'Laki-laki',
      email: 'duta.jabar@simulasi.dpbi.or.id', phone: '081311000008', prov: '32', reg: 'Kota Bogor', dist: 'Bogor Tengah', vil: 'Paledang',
      addr: 'Jl. Kapten Muslihat No. 31', school: 'SMAN 1 Bogor', lvl: 'SMA/SMK/MA', cls: 'XI', major: 'Bahasa & Budaya', npsn: '20220331', nisn: '0091234508',
      batch: 'batch-3', pos: 'Duta Pelajar Berbudaya Jawa Barat', bidang: 'Kebudayaan', role: 'duta',
      pStatus: 'aktif', vStatus: 'terverifikasi', guardian: 'Ratna Dewi', gRel: 'Ibu', gPhone: '081311009008',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
    {
      id: 'pers-9', memberNo: 'DPBI-2026-0009', ref: 'DPBI/PERS/2026/0009', userId: 'usr-duta-jateng',
      name: 'Sekar Arum Sari (Simulasi)', nick: 'Sekar', bp: 'Surakarta', bd: '2009-06-28', gender: 'Perempuan',
      email: 'duta.jateng@simulasi.dpbi.or.id', phone: '081326000009', prov: '33', reg: 'Kota Surakarta', dist: 'Laweyan', vil: 'Sriwedari',
      addr: 'Jl. Slamet Riyadi No. 210', school: 'SMAN 1 Surakarta', lvl: 'SMA/SMK/MA', cls: 'XI', major: 'IPA', npsn: '20327966', nisn: '0091234509',
      batch: 'batch-3', pos: 'Duta Pelajar Berbudaya Jawa Tengah', bidang: 'Pendidikan', role: 'duta',
      pStatus: 'aktif', vStatus: 'menunggu_verifikasi', guardian: 'Bambang Sutrisno', gRel: 'Ayah', gPhone: '081326009009',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: false, suratKesediaan: true },
    },
    {
      id: 'pers-10', memberNo: 'DPBI-2026-0010', ref: 'DPBI/PERS/2026/0010', userId: 'usr-alumni',
      name: 'Bima Sakti Nugroho (Simulasi)', nick: 'Bima', bp: 'Malang', bd: '2008-04-05', gender: 'Laki-laki',
      email: 'alumni.b2@simulasi.dpbi.or.id', phone: '081334000010', prov: '35', reg: 'Kota Malang', dist: 'Klojen', vil: 'Oro-oro Dowo',
      addr: 'Jl. Ijen No. 44', school: 'SMAN 3 Malang', lvl: 'SMA/SMK/MA', cls: 'XII', major: 'IPS', npsn: '20533660', nisn: '0081234510',
      batch: 'batch-2', pos: 'Alumni Duta Angkatan II', bidang: 'Kebudayaan', role: 'alumni',
      pStatus: 'alumni', vStatus: 'terverifikasi', guardian: 'Agus Nugroho', gRel: 'Ayah', gPhone: '081334009010',
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true },
    },
  ];

  const pStmt = db.prepare(
    `INSERT INTO personnel (
      id, member_number, reference_number, user_id, full_name, nickname, birth_place, birth_date, gender,
      email, phone, province_code, regency, district, village, postal_code, full_address,
      school_name, education_level, grade_class, major, npsn, nisn, entry_year, expected_grad_year,
      school_address, school_regency, school_province, batch_id, position_title, bidang, role_code,
      appointed_at, term_starts_at, term_ends_at, personnel_status, verification_status, verification_note,
      cultural_interests, activity_interests, org_experience, skills, guardian_name, guardian_relation, guardian_phone,
      docs_checklist_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '10000', ?, ?, ?, ?, ?, ?, ?, 2024, 2027, ?, ?, ?, ?, ?, ?, ?, '2026-09-15', '2026-09-15', '2027-01-15', ?, ?, NULL, 'Tari Tradisional, Sastra Daerah', 'Edukasi Pelajar, Pelestarian Bahasa Daerah', 'OSIS & Forum Pelajar', 'Public Speaking, Dokumentasi', ?, ?, ?, ?, ?, ?)`
  );

  for (const p of persList) {
    pStmt.run(
      p.id, p.memberNo, p.ref, p.userId, p.name, p.nick, p.bp, p.bd, p.gender,
      p.email, p.phone, p.prov, p.reg, p.dist, p.vil, p.addr,
      p.school, p.lvl, p.cls, p.major, p.npsn, p.nisn,
      `${p.addr} (Kampus Sekolah)`, p.reg, p.prov, p.batch, p.pos, p.bidang, p.role,
      p.pStatus, p.vStatus, p.guardian, p.gRel, p.gPhone,
      JSON.stringify(p.docs), now, now
    );
  }

  // Update province statuses & coordinators for realistic 38-province national map
  const activeProvinces = [
    ['31', 'aktif', 'usr-sekretariat', 'Fajar Ramadhan (Simulasi)', 'Pusat koordinasi nasional & perwakilan DKI Jakarta berjalan optimal.'],
    ['32', 'aktif', 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', 'Program Gelora Aksara Sunda aktif di 8 sekolah.'],
    ['33', 'aktif', null, 'Ratri Puspita (Simulasi)', 'Pendampingan verifikasi berkas Duta Angkatan III.'],
    ['34', 'aktif', 'usr-pengurus', 'Niken Larasati (Simulasi)', 'Aktif dalam program literasi budaya Yogyakarta.'],
    ['35', 'aktif', null, 'Bagas Adi Wijaya (Simulasi)', 'Menunggu pengumpulan laporan bulanan wilayah.'],
    ['51', 'aktif', 'usr-korwil-bali', 'I Made Arya Putra (Simulasi)', 'Festival Aksara Bali siap dilaksanakan.'],
    ['12', 'aktif', null, 'M. Rizky Siregar (Simulasi)', 'Koordinasi aktif lintas sekolah Medan & Deli Serdang.'],
    ['13', 'aktif', null, 'Aulia Putri Minang (Simulasi)', 'Program edukasi adat Minangkabau berjalan.'],
    ['73', 'aktif', null, 'Andi Fikri (Simulasi)', 'Kegiatan literasi maritim pelajar aktif.'],
    ['64', 'aktif', null, 'Rizka Amelia (Simulasi)', 'Pembinaan Duta Kalimantan Timur berjalan baik.'],
    ['11', 'dalam_pengembangan', null, 'Cut Nabila (Simulasi)', 'Tahap konsolidasi tim wilayah Aceh.'],
    ['14', 'dalam_pengembangan', null, 'Hafiz Alamsyah (Simulasi)', 'Menunggu kelengkapan 2 surat rekomendasi sekolah.'],
    ['36', 'dalam_pengembangan', null, 'Dewi Anggraini (Simulasi)', 'Penjadwalan pembekalan wilayah Banten.'],
    ['52', 'dalam_pengembangan', null, 'Lalu Ahmad (Simulasi)', 'Persiapan forum budaya pelajar NTB.'],
    ['61', 'dalam_pengembangan', null, 'Stefanus Yoga (Simulasi)', 'Konsolidasi awal Kalimantan Barat.'],
    ['71', 'dalam_pengembangan', null, 'Gabriel Tumbel (Simulasi)', 'Penjajakan kemitraan sekolah di Manado.'],
    ['18', 'dalam_pembinaan', null, null, 'Membutuhkan pendampingan Koordinator baru pasca transisi.'],
    ['63', 'dalam_pembinaan', null, null, 'Perlu tindak lanjut laporan bulanan wilayah.'],
    ['81', 'dalam_pembinaan', null, null, 'Pembinaan aktif oleh Pengurus Nasional Bidang Program.'],
    ['91', 'dalam_pembinaan', null, null, 'Pembinaan awal kepengurusan wilayah Papua.'],
  ];

  const updProv = db.prepare(
    'UPDATE provinces SET status = ?, coordinator_id = ?, coordinator_name = ?, coaching_note = ? WHERE code = ?'
  );
  for (const [code, status, cid, cname, note] of activeProvinces) {
    updProv.run(status, cid, cname, note, code);
  }

  // Update active demo regencies so Kabupaten/Kota drilldown shows realistic coverage
  const activeRegenciesSeed: [string, string, string, string][] = [
    ['31.74', 'aktif', 'Fajar Ramadhan (Simulasi)', 'Pusat koordinasi Jakarta Selatan aktif.'],
    ['31.71', 'aktif', 'Ayu Lestari (Simulasi)', 'Koordinasi program pusat Jakarta Pusat.'],
    ['32.73', 'aktif', 'Siti Nurhaliza Putri (Simulasi)', 'Program aktif di 5 sekolah Kota Bandung.'],
    ['32.71', 'aktif', 'Raka Pratama (Simulasi)', 'Lokasi kegiatan Pekan Literasi Aksara Sunda.'],
    ['32.76', 'dalam_pengembangan', 'Tim Pelopor Depok', 'Penjajakan pembina OSIS Kota Depok.'],
    ['33.72', 'dalam_pengembangan', 'Sekar Arum Sari (Simulasi)', 'Persiapan simposium bahasa daerah Surakarta.'],
    ['34.71', 'aktif', 'Niken Larasati (Simulasi)', 'Aktif literasi budaya Yogyakarta.'],
    ['35.73', 'aktif', 'Bima Sakti Nugroho (Simulasi)', 'Pembinaan komunitas pelajar Kota Malang.'],
    ['51.71', 'aktif', 'I Made Arya Putra (Simulasi)', 'Pusat persiapan Festival Tenun & Sastra Bali.'],
    ['12.71', 'aktif', 'M. Rizky Siregar (Simulasi)', 'Program budaya pelajar Kota Medan.'],
    ['73.71', 'aktif', 'Andi Fikri (Simulasi)', 'Literasi maritim pelajar Kota Makassar.'],
  ];
  const updReg = db.prepare('UPDATE regencies SET status = ?, coordinator_name = ?, coaching_note = ? WHERE code = ?');
  for (const [rcode, rstat, rcoor, rnote] of activeRegenciesSeed) {
    updReg.run(rstat, rcoor, rnote, rcode);
  }

  // Organization structure (all 6 Official Pengurus Nasional Bidang + Pengawas) & delegations
  const posStmt = db.prepare(
    `INSERT INTO organization_positions (id, title, bidang, level, holder_personnel_id, holder_name, sk_number, term_starts_at, term_ends_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '2026-09-15', '2027-01-15', 'aktif', ?)`
  );
  posStmt.run('pos-1', 'Penanggung Jawab Organisasi', 'Pengawasan & Perlindungan', 'Nasional', 'pers-3', 'Dr. Hendra Wijaya (Simulasi)', 'DPBI/DOC/2026/0001', now);
  posStmt.run('pos-2', 'Ketua Bidang Administrasi & Organisasi', 'Bidang Administrasi & Organisasi', 'Nasional', 'pers-5', 'Fajar Ramadhan (Simulasi)', 'DPBI/DOC/2026/0002', now);
  posStmt.run('pos-3', 'Ketua Bidang Program & Operasional', 'Bidang Program & Operasional', 'Nasional', 'pers-2', 'Ayu Lestari Kusuma (Simulasi)', 'DPBI/DOC/2026/0003', now);
  posStmt.run('pos-4', 'Ketua Bidang Pengembangan Wilayah', 'Bidang Pengembangan Wilayah', 'Nasional', null, 'Bagas Prakoso (Simulasi)', 'DPBI/DOC/2026/0004', now);
  posStmt.run('pos-5', 'Ketua Bidang Pendidikan & Kebudayaan', 'Bidang Pendidikan & Kebudayaan', 'Nasional', 'pers-4', 'Niken Larasati (Simulasi)', 'DPBI/DOC/2026/0005', now);
  posStmt.run('pos-6', 'Ketua Bidang Hubungan & Kemitraan', 'Bidang Hubungan & Kemitraan', 'Nasional', null, 'Ratna Kusumawardani (Simulasi)', 'DPBI/DOC/2026/0006', now);
  posStmt.run('pos-7', 'Ketua Bidang Media, Publikasi & Teknologi', 'Bidang Media, Publikasi & Teknologi', 'Nasional', 'pers-1', 'Raden Bagus Prasetyo (Simulasi)', 'DPBI/DOC/2026/0007', now);

  db.prepare(
    `INSERT INTO delegations (id, delegate_user_id, delegate_name, grantor_user_id, grantor_name, module, action, province_code, starts_at, ends_at, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'aktif', ?)`
  ).run(
    'del-demo-1', 'usr-wakil', 'Ayu Lestari Kusuma (Simulasi)', 'usr-super', 'Raden Bagus Prasetyo (Simulasi)',
    'wilayah', 'manage', '2026-10-01T00:00:00Z', '2027-02-01T23:59:59Z',
    'Delegasi pengelolaan operasional 38 wilayah periode Angkatan III', now
  );

  // Handover demo
  db.prepare(
    `INSERT INTO handovers (id, reference_number, province_code, outgoing_coordinator_id, outgoing_coordinator_name, incoming_coordinator_id, incoming_coordinator_name, active_tasks_count, open_proposals_count, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 3, 2, ?, 'menunggu_persetujuan', ?)`
  ).run(
    'hnd-1', 'DPBI/HND/2026/0001', '35', 'pers-10', 'Bagas Adi Wijaya (Simulasi)',
    null, 'Calon Koordinator Jawa Timur (Simulasi)',
    'Serah terima dokumen wilayah, daftar Duta aktif Jawa Timur, serta agenda kegiatan bulan berjalan.', now
  );

  // Account requests
  db.prepare(
    `INSERT INTO account_requests (id, reference_number, full_name, email, phone, province_code, batch_id, school_name, requested_by_user_id, requested_by_name, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?)`
  ).run(
    'req-1', 'DPBI/AKUN/2026/0001', 'Tariq Alfarizi (Simulasi)', 'tariq.simulasi@dpbi.or.id', '081299887766',
    '32', 'batch-3', 'SMAN 5 Bandung', 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', now
  );
  db.prepare(
    `INSERT INTO account_requests (id, reference_number, full_name, email, phone, province_code, batch_id, school_name, requested_by_user_id, requested_by_name, status, decision_note, decided_by, decided_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disetujui', 'Berkas lengkap dan sesuai kuota wilayah Bali.', 'Fajar Ramadhan (Simulasi)', ?, ?)`
  ).run(
    'req-2', 'DPBI/AKUN/2026/0002', 'Ni Putu Ayu Lestari (Simulasi)', 'putu.simulasi@dpbi.or.id', '081236778899',
    '51', 'batch-3', 'SMAN 4 Denpasar', 'usr-korwil-bali', 'I Made Arya Putra (Simulasi)', now, now
  );

  // Seed PDF files & Proposals
  const propPdf1 = saveSeedPdf(db, 'Proposal Pekan Literasi Aksara Sunda Pelajar', 'DPBI/PROP/2026/0001', 'Lokasi: Aula SMAN 1 Bogor - Bidang Kebudayaan', 'proposal', 'usr-duta-jabar');
  const propPdf2 = saveSeedPdf(db, 'Proposal Simposium Bahasa Daerah Nusantara', 'DPBI/PROP/2026/0002', 'Lokasi: Daring Nasional - Bidang Pendidikan', 'proposal', 'usr-duta-jateng');
  const propPdf3 = saveSeedPdf(db, 'Proposal Pameran Tenun & Sastra Bali', 'DPBI/PROP/2026/0003', 'Lokasi: Taman Budaya Denpasar - Bidang Kebudayaan', 'proposal', 'usr-korwil-bali');

  const propStmt = db.prepare(
    `INSERT INTO proposals (
      id, reference_number, version, title, applicant_personnel_id, applicant_name, province_code, batch_id,
      bidang, category, risk_level, uses_dpbi_identity, external_permit_needed, assigned_approver_role,
      objective, target_audience, event_date, event_time, location, pic_name, estimated_participants,
      activity_mode, pdf_file_id, pdf_file_name, status, decision_note, decided_by, decided_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  propStmt.run(
    'prop-1', 'DPBI/PROP/2026/0001', 1, 'Pekan Literasi Aksara Sunda Pelajar Jawa Barat', 'pers-8', 'Raka Pratama (Simulasi)',
    '32', 'batch-3', 'Kebudayaan', 'Lokakarya / Literasi Pelajar', 'sedang', 1, 0, 'pengurus_nasional',
    'Mengenalkan aksara Sunda dan manuskrip lokal kepada 80 pelajar SMA di Kota Bogor.', 'Pelajar SMA/SMK Kota Bogor',
    '2026-11-28', '09:00 - 14:00 WIB', 'Aula SMAN 1 Bogor', 'Raka Pratama (Simulasi)', 80, 'luring',
    propPdf1.fileId, propPdf1.fileName, 'disetujui', 'Disetujui sesuai program kerja Bidang Kebudayaan. Pastikan 2 pendamping dewasa hadir.', 'Niken Larasati (Simulasi)', now, now, now
  );
  propStmt.run(
    'prop-2', 'DPBI/PROP/2026/0002', 1, 'Simposium Daring Bahasa Daerah Nusantara', 'pers-9', 'Sekar Arum Sari (Simulasi)',
    '33', 'batch-3', 'Pendidikan', 'Seminar Daring', 'rendah', 1, 0, 'pengurus_nasional',
    'Diskusi interaktif pelestarian bahasa ibu di sekolah menengah.', 'Pelajar lintas provinsi',
    '2026-12-06', '13:00 - 15:30 WIB', 'Platform Konferensi Video Daring', 'Sekar Arum Sari (Simulasi)', 150, 'daring',
    propPdf2.fileId, propPdf2.fileName, 'menunggu_persetujuan_nasional', null, null, null, now, now
  );
  propStmt.run(
    'prop-3', 'DPBI/PROP/2026/0003', 2, 'Festival Tenun & Sastra Pelajar Bali', 'pers-7', 'I Made Arya Putra (Simulasi)',
    '51', 'batch-3', 'Kebudayaan', 'Festival / Pameran Budaya', 'tinggi', 1, 1, 'pengurus_nasional',
    'Pameran karya kriya tenun pelajar dan pembacaan puisi Bali.', 'Pelajar & Masyarakat Umum',
    '2026-12-14', '08:30 - 16:00 WITA', 'Taman Budaya Art Center Denpasar', 'I Made Arya Putra (Simulasi)', 200, 'luring',
    propPdf3.fileId, propPdf3.fileName, 'perlu_revisi', 'Mohon lengkapi lampiran surat izin penggunaan gedung dan daftar 3 pendamping dewasa.', 'Niken Larasati (Simulasi)', now, now, now
  );

  // Proposal version history
  db.prepare(
    `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
     VALUES (?, ?, 1, ?, ?, 'Pengajuan awal dokumen proposal PDF', 'Raka Pratama (Simulasi)', ?)`
  ).run('pv-1', 'prop-1', propPdf1.fileId, propPdf1.fileName, now);
  db.prepare(
    `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
     VALUES (?, ?, 1, ?, ?, 'Dokumen awal sebelum revisi', 'I Made Arya Putra (Simulasi)', ?)`
  ).run('pv-2', 'prop-3', propPdf3.fileId, propPdf3.fileName, now);
  db.prepare(
    `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
     VALUES (?, ?, 2, ?, ?, 'Pembaruan estimasi peserta dan rincian keamanan', 'I Made Arya Putra (Simulasi)', ?)`
  ).run('pv-3', 'prop-3', propPdf3.fileId, propPdf3.fileName, now);

  // LKL Reports (Luring & Daring)
  const lklPdf1 = saveSeedPdf(db, 'LKL Klinik Aksara Sunda Tahap 1', 'DPBI/LKL/2026/0001', 'Jumlah Peserta: 64 Pelajar - Lokasi: Kota Bogor', 'lkl', 'usr-duta-jabar');
  const lklPdf2 = saveSeedPdf(db, 'LKL Webinar Budaya Tutur Jawa Tengah', 'DPBI/LKL/2026/0002', 'Kegiatan Daring - Jumlah Peserta: 112 Pelajar', 'lkl', 'usr-duta-jateng');

  const lklStmt = db.prepare(
    `INSERT INTO lkl_reports (
      id, reference_number, version, activity_name, proposal_id, proposal_ref, submitter_personnel_id, submitter_name,
      province_code, regency, district, village, venue_name, venue_address, event_date, start_time, end_time,
      category, activity_mode, platform_name, platform_link, pic_name, participant_count, summary, outcomes,
      obstacles, follow_up, pdf_file_id, pdf_file_name, photo_file_ids_json, status, review_note, reviewed_by, reviewed_at, created_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`
  );

  lklStmt.run(
    'lkl-1', 'DPBI/LKL/2026/0001', 'Klinik Aksara Sunda Tahap 1 — SMAN 1 Bogor', 'prop-1', 'DPBI/PROP/2026/0001',
    'pers-8', 'Raka Pratama (Simulasi)', '32', 'Kota Bogor', 'Bogor Tengah', 'Paledang', 'Aula SMAN 1 Bogor',
    'Jl. Ir. H. Juanda No. 16, Bogor', '2026-11-10', '09:00', '12:30', 'Lokakarya Budaya', 'luring', null, null,
    'Raka Pratama (Simulasi)', 64,
    'Pelatihan menulis dan membaca aksara Sunda bersama komunitas literasi sekolah dengan pendampingan 2 guru pembina.',
    '85% peserta mampu menyalin 1 paragraf aksara Sunda dan terbentuk kelompok belajar aksara di sekolah.',
    'Keterbatasan proyektor di ruang kedua teratasi dengan pembagian lembar kerja cetak.',
    'Lanjutan sesi praktik digitalisasi font aksara pada pekan berikutnya.',
    lklPdf1.fileId, lklPdf1.fileName, 'diterima', 'Dokumentasi lengkap dan sesuai SOP kegiatan luring.', 'Siti Nurhaliza Putri (Simulasi)', now, now
  );
  lklStmt.run(
    'lkl-2', 'DPBI/LKL/2026/0002', 'Webinar Budaya Tutur Pelajar Jawa Tengah', null, null,
    'pers-9', 'Sekar Arum Sari (Simulasi)', '33', '', '', '', '', '', '2026-11-12', '15:30', '17:00',
    'Edukasi Daring', 'daring', 'Zoom Meeting Resmi DPBI', 'https://meeting.dpbi.or.id/tutur-jateng',
    'Sekar Arum Sari (Simulasi)', 112,
    'Sesi bincang daring mengenai pelestarian tembang dan cerita rakyat Jawa Tengah di kalangan siswa SMA.',
    '112 peserta dari 14 kabupaten/kota di Jawa Tengah hadir aktif dan mengumpulkan 28 karya ringkas cerita rakyat.',
    'Sebagian peserta mengalami kendala jaringan ringan di awal sesi.',
    'Kompilasi naskah cerita rakyat akan diterbitkan di repositori materi pembekalan.',
    lklPdf2.fileId, lklPdf2.fileName, 'menunggu_pemeriksaan', null, null, null, now
  );

  // Coordinator reports
  const lkwPdf1 = saveSeedPdf(db, 'Laporan Bulanan Koordinator Jawa Barat Oktober 2026', 'DPBI/LKW/2026/0001', 'Provinsi Jawa Barat - Status Operasional Aktif', 'laporan_koordinator', 'usr-korwil-jabar');
  db.prepare(
    `INSERT INTO coordinator_reports (id, reference_number, report_type, province_code, batch_id, coordinator_id, coordinator_name, period_label, personnel_condition, activities_summary, lkl_recap_count, obstacles, coaching_needs, follow_up_plan, pdf_file_id, pdf_file_name, status, created_at)
     VALUES (?, ?, 'bulanan', '32', 'batch-3', 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', 'Oktober 2026', ?, ?, 4, ?, ?, ?, ?, ?, 'diterima', ?)`
  ).run(
    'lkw-1', 'DPBI/LKW/2026/0001',
    'Seluruh 12 Duta Jawa Barat aktif dan sehat; 1 calon Duta sedang proses verifikasi akun.',
    'Terlaksana 4 kegiatan literasi budaya tingkat kota/kabupaten dengan total 260 peserta pelajar.',
    'Penyelarasan jadwal kegiatan dengan ujian tengah semester di beberapa sekolah.',
    'Dukungan template surat izin sekolah untuk kegiatan bulan November.',
    'Pemantauan LKL Pekan Literasi Aksara Sunda dan verifikasi profil berkas.',
    lkwPdf1.fileId, lkwPdf1.fileName, now
  );

  // Tasks
  const tStmt = db.prepare(
    `INSERT INTO tasks (id, reference_number, title, description, priority, status, deadline, province_code, batch_id, assignee_id, assignee_name, creator_id, creator_name, checklist_json, is_template, recurrence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'batch-3', ?, ?, 'usr-sekretariat', 'Fajar Ramadhan (Simulasi)', ?, 0, ?, ?)`
  );
  tStmt.run('tgs-1', 'DPBI/TGS/2026/0001', 'Verifikasi Surat Izin Wali Duta Jawa Tengah', 'Periksa dan lengkapi unggahan surat izin orang tua/wali pada profil Sekar Arum Sari.', 'tinggi', 'perlu_perhatian', '2026-11-20', '33', 'usr-duta-jateng', 'Sekar Arum Sari (Simulasi)', JSON.stringify([{ id: 'c1', text: 'Unduh format surat izin wali', done: true }, { id: 'c2', text: 'Unggah PDF bertanda tangan', done: false }]), 'tidak', now);
  tStmt.run('tgs-2', 'DPBI/TGS/2026/0002', 'Kirim Laporan Bulanan Wilayah November 2026', 'Susun rekapitulasi kegiatan, kondisi personel, dan LKL sebelum tanggal 5 bulan berikutnya.', 'tinggi', 'dikerjakan', '2026-12-05', '32', 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', JSON.stringify([{ id: 'c1', text: 'Rekap LKL bulan berjalan', done: true }, { id: 'c2', text: 'Unggah PDF resmi laporan', done: false }]), 'bulanan', now);
  tStmt.run('tgs-3', 'DPBI/TGS/2026/0003', 'Tinjau Revisi Proposal Festival Tenun Bali', 'Pastikan lampiran izin lokasi dan daftar 3 pendamping dewasa telah diperbarui.', 'sedang', 'menunggu', '2026-11-25', '51', 'usr-pengurus', 'Niken Larasati (Simulasi)', JSON.stringify([{ id: 'c1', text: 'Periksa aspek safeguarding U18', done: true }]), 'tidak', now);
  tStmt.run('tgs-4', 'DPBI/TGS/2026/0004', 'Finalisasi LKL Pekan Literasi Aksara Sunda', 'Lampirkan foto dokumentasi dan daftar hadir kegiatan luring di SMAN 1 Bogor.', 'sedang', 'selesai', '2026-11-15', '32', 'usr-duta-jabar', 'Raka Pratama (Simulasi)', JSON.stringify([{ id: 'c1', text: 'Unggah PDF LKL', done: true }, { id: 'c2', text: 'Unggah foto dokumentasi', done: true }]), 'tidak', now);

  // Documents & SOP Library
  const sopPdf = saveSeedPdf(db, 'SOP Perlindungan Peserta Pelajar & Standar Pendampingan', 'DPBI/DOC/2026/0001', 'Standar Operasional Prosedur Perlindungan Anak dan Keselamatan Kegiatan DPBI v2.1', 'dokumen', 'usr-pj');
  const skPdf = saveSeedPdf(db, 'SK Penetapan Duta & Koordinator Angkatan III', 'DPBI/DOC/2026/0002', 'Surat Keputusan Penetapan Personel Angkatan III Masa Tugas 4 Bulan', 'dokumen', 'usr-sekretariat');
  const modPdf = saveSeedPdf(db, 'Modul Pembekalan Kepemimpinan Budaya Pelajar', 'DPBI/DOC/2026/0003', 'Materi Wajib Pembekalan Duta Angkatan III - Sekretariat Nasional', 'dokumen', 'usr-pengurus');

  const dStmt = db.prepare(
    `INSERT INTO documents (id, document_number, title, category, owner_name, issuer_name, issued_date, status, version, access_level, file_id, file_name, file_size_bytes, notes, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'berlaku', ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  dStmt.run('doc-1', 'DPBI/DOC/2026/0001', 'SOP Perlindungan Peserta Pelajar & Keselamatan Kegiatan', 'SOP', 'Bidang Pengawasan & Perlindungan', 'Penanggung Jawab Organisasi', '2026-09-01', '2.1', 'internal_semua', sopPdf.fileId, sopPdf.fileName, sopPdf.sizeBytes, 'Kebijakan internal minimal 2 pendamping dewasa untuk kegiatan luring peserta di bawah 18 tahun.', null, now);
  dStmt.run('doc-2', 'DPBI/DOC/2026/0002', 'SK Penetapan Pengurus, Koordinator, dan Duta Angkatan III', 'SK', 'Sekretariat Nasional', 'Ketua Yayasan & Super Admin', '2026-09-15', '1.0', 'internal_semua', skPdf.fileId, skPdf.fileName, skPdf.sizeBytes, 'Berlaku selama masa tugas 4 bulan hingga 15 Januari 2027.', '2027-01-15', now);
  dStmt.run('doc-3', 'DPBI/DOC/2026/0003', 'Modul Pembekalan: Tata Kelola & Pelaporan LKL Berbasis Bukti', 'Materi Pembekalan', 'Bidang Kebudayaan', 'Pengurus Nasional', '2026-09-10', '1.2', 'internal_semua', modPdf.fileId, modPdf.fileName, modPdf.sizeBytes, 'Panduan penyusunan proposal PDF dan LKL lapangan.', null, now);

  // Announcements (2 public approved announcements + 1 internal notice)
  const annStmt = db.prepare(
    `INSERT INTO announcements (id, title, body, scope, province_code, batch_id, priority, author_name, published_at, status, is_public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'terbit', ?)`
  );
  annStmt.run('ann-1', 'Pembukaan Pemutakhiran Data Wilayah 38 Provinsi & Kabupaten/Kota', 'Koordinator Wilayah di 38 provinsi telah memulai pendataan keterwakilan Kabupaten/Kota serta dokumentasi kegiatan literasi budaya Angkatan III.', 'nasional', null, 'batch-3', 'penting', 'Fajar Ramadhan (Simulasi)', now, 1);
  annStmt.run('ann-2', 'Standar Perlindungan Peserta Pelajar & Pendampingan Kegiatan', 'Seluruh kegiatan luring resmi DPBI menerapkan rasio pendamping dewasa dan persetujuan orang tua/wali sebagai komitmen tata kelola pelajar berbudaya.', 'nasional', null, 'batch-3', 'normal', 'Dr. Hendra Wijaya (Simulasi)', now, 1);
  annStmt.run('ann-3', 'Batas Waktu Pengiriman Laporan Bulanan Wilayah (Internal)', 'Mohon seluruh Koordinator Wilayah mengirimkan Laporan Bulanan beserta rekap LKL paling lambat tanggal 5 setiap bulan pukul 23:59 WIB.', 'nasional', null, 'batch-3', 'penting', 'Fajar Ramadhan (Simulasi)', now, 0);

  // Calendar events
  const calStmt = db.prepare(
    `INSERT INTO calendar_events (id, title, category, start_at, end_at, province_code, batch_id, related_ref, location, description)
     VALUES (?, ?, ?, ?, ?, ?, 'batch-3', ?, ?, ?)`
  );
  calStmt.run('cal-1', 'Rapat Koordinasi Nasional Tengah Periode Angkatan III', 'Rapat Nasional', '2026-11-22T19:00:00+07:00', '2026-11-22T21:00:00+07:00', null, 'DPBI/DOC/2026/0002', 'Daring Nasional', 'Evaluasi capaian 38 provinsi dan kesiapan program bulan Desember.');
  calStmt.run('cal-2', 'Pekan Literasi Aksara Sunda Pelajar Jawa Barat', 'Kegiatan Wilayah', '2026-11-28T09:00:00+07:00', '2026-11-28T14:00:00+07:00', '32', 'DPBI/PROP/2026/0001', 'Aula SMAN 1 Bogor', 'Kegiatan luring disetujui dengan 2 pendamping dewasa.');
  calStmt.run('cal-3', 'Tenggat Laporan Bulanan Koordinator Wilayah', 'Tenggat Laporan', '2026-12-05T23:59:00+07:00', '2026-12-05T23:59:00+07:00', null, 'DPBI/TGS/2026/0002', 'Portal SATU DPBI', 'Batas pengumpulan rutin laporan bulanan koordinator.');
  calStmt.run('cal-4', 'Penutupan Masa Tugas Angkatan III (4 Bulan)', 'Penutupan Batch', '2027-01-15T17:00:00+07:00', '2027-01-15T17:00:00+07:00', null, null, 'Nasional', 'Peralihan status ke Alumni dengan jendela akses arsip 30 hari.');

  // Safeguarding
  db.prepare(
    `INSERT INTO risk_assessments (id, proposal_id, activity_title, province_code, participant_under_18, adult_chaperone_count, environment_notes, transport_plan, emergency_plan, emergency_contact, risk_level, status, submitted_by, created_at)
     VALUES (?, 'prop-1', 'Pekan Literasi Aksara Sunda Pelajar Jawa Barat', '32', 1, 2, ?, ?, ?, ?, 'sedang', 'disetujui', 'Raka Pratama (Simulasi)', ?)`
  ).run(
    'rsk-1',
    'Ruang aula sekolah tertutup dengan ventilasi baik dan akses P3K.',
    'Peserta diantar langsung oleh orang tua/wali atau guru pendamping sekolah.',
    'Titik kumpul halaman utama sekolah, koordinasi UKS dan Puskesmas Bogor Tengah.',
    'Pembina OSIS SMAN 1 Bogor (0812-0000-1122)', now
  );

  db.prepare(
    `INSERT INTO consent_records (id, personnel_id, personnel_name, activity_title, consent_participation, consent_guardian, consent_documentation, consent_publication, recorded_at)
     VALUES (?, 'pers-8', 'Raka Pratama (Simulasi)', 'Pekan Literasi Aksara Sunda Pelajar', 1, 1, 1, 1, ?)`
  ).run('cns-1', now);
  db.prepare(
    `INSERT INTO consent_records (id, personnel_id, personnel_name, activity_title, consent_participation, consent_guardian, consent_documentation, consent_publication, recorded_at)
     VALUES (?, 'pers-9', 'Sekar Arum Sari (Simulasi)', 'Simposium Daring Bahasa Daerah Nusantara', 1, 1, 1, 0, ?)`
  ).run('cns-2', now);

  db.prepare(
    `INSERT INTO incidents (id, reference_number, occurred_at, location, province_code, category, urgency, chronology, initial_action, escalated_to, status, reported_by_user_id, created_at)
     VALUES (?, 'DPBI/INS/2026/0001', '2026-11-10T11:15:00+07:00', 'Aula SMAN 1 Bogor', '32', 'Kesehatan Ringan Peserta', 'rendah', ?, ?, 'Penanggung Jawab Organisasi', 'selesai', 'usr-korwil-jabar', ?)`
  ).run(
    'inc-1',
    'Salah satu peserta mengalami kelelahan ringan saat sesi siang dan langsung diarahkan beristirahat di ruang UKS didampingi pembina.',
    'Pemberian air minum, istirahat di UKS 20 menit, dan pemberitahuan kepada orang tua.', now
  );

  db.prepare(
    `INSERT INTO whistleblowing_reports (id, reference_number, reporter_mode, category, chronology, assigned_handler_role, conflict_rerouted, status, follow_up_note, created_at)
     VALUES (?, 'DPBI/ADU/2026/0001', 'rahasia', 'Tata Kelola Administrasi', ?, 'penanggung_jawab', 0, 'ditinjau', 'Sedang dilakukan klarifikasi tertutup oleh Penanggung Jawab Organisasi.', ?)`
  ).run(
    'adu-1',
    'Laporan simulasi terkait keterlambatan penerbitan surat rekomendasi wilayah oleh salah satu tim administrasi lokal.', now
  );

  // Evaluations
  db.prepare(
    `INSERT INTO evaluations (id, personnel_id, personnel_name, role_code, province_code, batch_id, task_completion_score, report_timeliness_score, report_quality_score, coordination_score, total_score, evaluator_name, coaching_recommendation, status, created_at)
     VALUES (?, 'pers-6', 'Siti Nurhaliza Putri (Simulasi)', 'koordinator_wilayah', '32', 'batch-3', 92, 95, 90, 94, 92.6, 'Niken Larasati (Simulasi)', 'Kinerja sangat baik. Pertahankan ketepatan waktu laporan dan dampingi Duta baru.', 'final', ?)`
  ).run('ev-1', now);
  db.prepare(
    `INSERT INTO evaluations (id, personnel_id, personnel_name, role_code, province_code, batch_id, task_completion_score, report_timeliness_score, report_quality_score, coordination_score, total_score, evaluator_name, coaching_recommendation, status, created_at)
     VALUES (?, 'pers-8', 'Raka Pratama (Simulasi)', 'duta', '32', 'batch-3', 90, 88, 92, 89, 89.8, 'Siti Nurhaliza Putri (Simulasi)', 'Dokumentasi LKL sangat rapi. Tingkatkan koordinasi lintas sekolah pada bulan Desember.', 'final', ?)`
  ).run('ev-2', now);

  // Location verifications & exception
  db.prepare(
    `INSERT INTO location_verifications (id, user_id, user_name, province_code, action_type, latitude, longitude, matched, verification_mode, reason, created_at)
     VALUES (?, 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', '32', 'review_lkl', -6.9175, 107.6191, 1, 'gps_browser', 'Koordinat terkonfirmasi berada dalam cakupan wilayah Jawa Barat.', ?)`
  ).run('loc-1', now);

  // Notifications
  const nStmt = db.prepare(
    `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  );
  nStmt.run('not-1', 'usr-super', '1 Permintaan Akun Duta Menunggu Persetujuan', 'DPBI/AKUN/2026/0001 diajukan oleh Koordinator Jawa Barat.', 'akun', '/personalia', now);
  nStmt.run('not-2', 'usr-pengurus', 'Proposal Menunggu Keputusan Nasional', 'DPBI/PROP/2026/0002 (Simposium Daring Bahasa Daerah) siap ditinjau.', 'proposal', '/proposal', now);
  nStmt.run('not-3', 'usr-duta-jabar', 'Proposal Disetujui', 'Proposal DPBI/PROP/2026/0001 telah disetujui oleh Pengurus Nasional.', 'proposal', '/proposal', now);
  nStmt.run('not-4', 'usr-alumni', 'Pengingat Masa Akses Arsip Alumni 30 Hari', 'Anda memiliki sisa 18 hari untuk mengekspor sertifikat dan arsip pribadi.', 'alumni', '/arsip', now);

  // Audit log & Timeline
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, target_type, target_id, outcome, context_note, created_at)
     VALUES (?, 'usr-pengurus', 'Niken Larasati (Simulasi)', 'pengurus_nasional', 'APPROVE_PROPOSAL', 'proposal', 'DPBI/PROP/2026/0001', 'berhasil', 'Persetujuan bidang kebudayaan dengan syarat 2 pendamping dewasa.', ?)`
  ).run('aud-1', now);
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, target_type, target_id, outcome, context_note, created_at)
     VALUES (?, 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', 'koordinator_wilayah', 'VERIFY_LKL', 'lkl', 'DPBI/LKL/2026/0001', 'berhasil', 'LKL luring diverifikasi dengan konfirmasi lokasi wilayah Jawa Barat.', ?)`
  ).run('aud-2', now);

  const tlStmt = db.prepare(
    `INSERT INTO activity_timeline (id, category, title, description, province_code, batch_id, actor_name, related_path, created_at)
     VALUES (?, ?, ?, ?, ?, 'batch-3', ?, ?, ?)`
  );
  tlStmt.run('tl-1', 'Proposal', 'Proposal DPBI/PROP/2026/0001 Disetujui', 'Pekan Literasi Aksara Sunda Pelajar Jawa Barat memperoleh persetujuan nasional.', '32', 'Niken Larasati (Simulasi)', '/proposal', now);
  tlStmt.run('tl-2', 'LKL', 'LKL DPBI/LKL/2026/0001 Diterima', 'Klinik Aksara Sunda Tahap 1 di SMAN 1 Bogor diterima dengan 64 peserta pelajar.', '32', 'Siti Nurhaliza Putri (Simulasi)', '/laporan-kegiatan', now);
  tlStmt.run('tl-3', 'Dokumen', 'SOP Perlindungan Peserta v2.1 Diterbitkan', 'Pembaruan standar pendampingan peserta di bawah 18 tahun berlaku nasional.', null, 'Dr. Hendra Wijaya (Simulasi)', '/dokumen', now);

  // Backfill file_access_grants for seeded files
  db.prepare(
    `INSERT OR IGNORE INTO file_access_grants (id, file_id, user_id, province_code, module, created_at)
     SELECT 'fg-' || id, id, uploaded_by, NULL, module, created_at FROM stored_files`
  ).run();

  seedOrgHierarchyPositions(db, now);
  db.prepare("UPDATE proposals SET program_id = 'prog-btc' WHERE id = 'prop-1'").run();
  db.prepare("UPDATE proposals SET program_id = 'prog-bms' WHERE id = 'prop-2'").run();
  db.prepare("UPDATE proposals SET program_id = 'prog-sw' WHERE id = 'prop-3'").run();
  db.prepare("UPDATE lkl_reports SET program_id = 'prog-btc' WHERE id = 'lkl-1'").run();
  db.prepare("UPDATE lkl_reports SET program_id = 'prog-bms' WHERE id = 'lkl-2'").run();
  db.prepare("UPDATE tasks SET program_id = 'prog-btc' WHERE id = 'tgs-4'").run();
  seedDefaultEmailTemplates(db, now);
}

function seedFlagshipPrograms(db: DatabaseSync, now: string) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO flagship_programs
     (id, slug, name, tagline, description, objectives, bidang, lead_name, status, target_provinces, target_participants, period_label, is_public, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  stmt.run(
    'prog-btc',
    'behind-the-culture',
    'Behind The Culture',
    'Eksplorasi Riset, Narasi, dan Dokumentasi Warisan Budaya Pelajar Nusantara',
    'Program unggulan dokumentasi dan literasi riset budaya daerah berbasis karya tulis, arsip lisan, dan pameran pelajar lintas provinsi.',
    'Menghasilkan dokumentasi terverifikasi atas aksara, sastra lisan, seni kriya, dan tradisi lokal di 38 provinsi dengan keterlibatan aktif Duta Pelajar.',
    'Bidang Pendidikan & Kebudayaan',
    'Niken Larasati',
    'aktif',
    38,
    2500,
    '2026–2027',
    now
  );
  stmt.run(
    'prog-sw',
    'sedapnya-warisanku',
    'Sedapnya Warisanku',
    'Pelestarian Gastronomi Tradisional & Kuliner Warisan Nusantara di Kalangan Pelajar',
    'Program eksplorasi sejarah pangan lokal, resep warisan keluarga, dan festival edukasi gastronomi tradisional oleh Duta Pelajar Berbudaya.',
    'Mendokumentasikan kekayaan kuliner daerah, nilai filosofi bahan pangan Nusantara, dan menggelar lokakarya edukatif di sekolah maupun komunitas.',
    'Bidang Program & Operasional',
    'Ayu Lestari Kusuma',
    'aktif',
    38,
    1800,
    '2026–2027',
    now
  );
  stmt.run(
    'prog-bms',
    'budaya-masuk-sekolah',
    'Budaya Masuk Sekolah',
    'Gerakan Ekosistem Budaya Nusantara & Literasi Karakter di Satuan Pendidikan',
    'Program kolaborasi Duta Pelajar bersama OSIS, guru pembina, dan satuan pendidikan untuk menghadirkan ruang ekspresi budaya di lingkungan sekolah.',
    'Menjangkau sekolah menengah di seluruh Indonesia melalui simposium, klinik aksara/bahasa daerah, dan kelas literasi budaya terstruktur.',
    'Bidang Hubungan & Kemitraan',
    'Fajar Ramadhan',
    'aktif',
    38,
    4000,
    '2026–2027',
    now
  );
}

function seedOrgHierarchyPositions(db: DatabaseSync, now: string) {
  const updExisting = db.prepare(
    `UPDATE organization_positions
     SET parent_id = COALESCE(parent_id, ?), category = ?, sort_order = ?, role_binding = ?
     WHERE id = ?`
  );
  updExisting.run('pos-root-pembina', 'Pengawasan & Perlindungan', 3, 'penanggung_jawab', 'pos-1');
  updExisting.run('pos-pimpinan-sekretariat', 'Bidang Nasional', 11, 'sekretariat_nasional', 'pos-2');
  updExisting.run('pos-pimpinan-wakil', 'Bidang Nasional', 12, 'wakil_super_admin', 'pos-3');
  updExisting.run('pos-pimpinan-wakil', 'Bidang Nasional', 13, 'pengurus_nasional', 'pos-4');
  updExisting.run('pos-pimpinan-wakil', 'Bidang Nasional', 14, 'pengurus_nasional', 'pos-5');
  updExisting.run('pos-pimpinan-wakil', 'Bidang Nasional', 15, 'pengurus_nasional', 'pos-6');
  updExisting.run('pos-pimpinan-super', 'Bidang Nasional', 16, 'super_admin', 'pos-7');

  const ins = db.prepare(
    `INSERT OR IGNORE INTO organization_positions
     (id, title, bidang, level, holder_personnel_id, holder_name, sk_number, term_starts_at, term_ends_at, status, parent_id, category, sort_order, is_vacant, role_binding, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '2026-09-15', '2027-01-15', 'aktif', ?, ?, ?, ?, ?, ?)`
  );
  ins.run('pos-root-pembina', 'Dewan Pembina Nasional DPBI', 'Tata Kelola & Pembinaan', 'Pembina', null, 'Dewan Pembina Organisasi', 'DPBI/DOC/2026/0000', null, 'Pembina', 1, 0, 'penanggung_jawab', now);
  ins.run('pos-pimpinan-super', 'Pimpinan Sistem & Tata Kelola (Super Admin)', 'Tata Kelola Nasional', 'Pimpinan Nasional', 'pers-1', 'Raden Bagus Prasetyo (Simulasi)', 'DPBI/DOC/2026/0007', 'pos-root-pembina', 'Pimpinan Nasional', 2, 0, 'super_admin', now);
  ins.run('pos-pimpinan-wakil', 'Wakil Pimpinan Operasional (Wakil Super Admin)', 'Koordinasi Wilayah & Sistem', 'Pimpinan Nasional', 'pers-2', 'Ayu Lestari Kusuma (Simulasi)', 'DPBI/DOC/2026/0003', 'pos-pimpinan-super', 'Pimpinan Nasional', 4, 0, 'wakil_super_admin', now);
  ins.run('pos-pimpinan-sekretariat', 'Sekretariat Nasional DPBI', 'Bidang Administrasi & Organisasi', 'Sekretariat', 'pers-5', 'Fajar Ramadhan (Simulasi)', 'DPBI/DOC/2026/0002', 'pos-pimpinan-super', 'Sekretariat', 5, 0, 'sekretariat_nasional', now);
  ins.run('pos-korwil-jabar', 'Koordinator Wilayah Jawa Barat', 'Bidang Pengembangan Wilayah', 'Wilayah', 'pers-6', 'Siti Nurhaliza Putri (Simulasi)', 'DPBI/DOC/2026/0011', 'pos-4', 'Koordinator Wilayah', 21, 0, 'koordinator_wilayah', now);
  ins.run('pos-korwil-bali', 'Koordinator Wilayah Bali', 'Bidang Pengembangan Wilayah', 'Wilayah', 'pers-7', 'I Made Arya Putra (Simulasi)', 'DPBI/DOC/2026/0012', 'pos-4', 'Koordinator Wilayah', 22, 0, 'koordinator_wilayah', now);
  ins.run('pos-vacant-kaltim', 'Koordinator Wilayah Kalimantan Timur', 'Bidang Pengembangan Wilayah', 'Wilayah', null, null, null, 'pos-4', 'Koordinator Wilayah', 23, 1, 'koordinator_wilayah', now);
  ins.run('pos-vacant-sekbid', 'Sekretaris Bidang Media, Publikasi & Teknologi', 'Bidang Media, Publikasi & Teknologi', 'Bidang', null, null, null, 'pos-7', 'Tim Bidang', 24, 1, 'pengurus_nasional', now);
}

function wrapOfficialEmailHtml(heading: string, bodyParagraphs: string): string {
  const htmlBody = bodyParagraphs
    .split('\n\n')
    .map((p) => `<p style="margin:0 0 12px 0;line-height:1.6;color:#334155;">${p.replace(/\n/g, '<br/>')}</p>`)
    .join('');
  return `<!DOCTYPE html>
<html lang="id"><body style="margin:0;padding:24px;background:#F1F5F9;font-family:Inter,Segoe UI,Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid #E2E8F0;border-radius:14px;overflow:hidden;">
  <div style="background:#1E293B;color:#FFFFFF;padding:18px 24px;">
    <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#38BDF8;font-weight:700;">SATU DPBI · RESMI</p>
    <h1 style="margin:6px 0 0 0;font-size:18px;font-weight:700;">${heading}</h1>
  </div>
  <div style="padding:24px;">${htmlBody}</div>
  <div style="background:#F8FAFC;border-top:1px solid #E2E8F0;padding:14px 24px;font-size:11px;color:#64748B;">
    <strong>SATU DPBI</strong> — Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia · Satu Sistem, Satu Data, Satu Koordinasi.
  </div>
</div></body></html>`;
}

function seedDefaultEmailTemplates(db: DatabaseSync, now: string) {
  const templates: [string, string, string, string, string, string][] = [
    [
      'etpl-1', 'undangan_akun', 'Undangan Aktivasi Akun Resmi SATU DPBI', 'Akun & Aktivasi',
      '[SATU DPBI] Undangan Aktivasi Akun {{jabatan}} — {{provinsi}}',
      'Yth. {{nama}},\n\nAkun resmi Anda pada portal SATU DPBI ({{jabatan}} · {{role}} — {{provinsi}}, {{angkatan}}) telah disiapkan.\nSilakan selesaikan aktivasi melalui tautan undangan resmi berikut sebelum {{tenggat}}:\n{{tautan}}\n\nReferensi: {{referensi}}\nSatu Sistem, Satu Data, Satu Koordinasi.',
    ],
    [
      'etpl-2', 'kirim_ulang_undangan', 'Kirim Ulang Undangan Aktivasi Akun', 'Akun & Aktivasi',
      '[SATU DPBI] Pengingat & Tautan Baru Aktivasi Akun — {{nama}}',
      'Yth. {{nama}},\n\nBerikut tautan undangan aktivasi terbaru untuk akun SATU DPBI Anda ({{jabatan}} — {{provinsi}}). Tautan sebelumnya otomatis dinonaktifkan demi keamanan.\nTautan aktivasi: {{tautan}}\nBerlaku hingga: {{tenggat}}\n\nReferensi: {{referensi}}',
    ],
    [
      'etpl-3', 'aktivasi_berhasil', 'Konfirmasi Aktivasi Akun Berhasil', 'Akun & Aktivasi',
      '[SATU DPBI] Akun Resmi Anda Telah Aktif — {{nama}}',
      'Halo {{nama}},\n\nAktivasi akun SATU DPBI Anda ({{jabatan}} · {{role}} — {{provinsi}}) berhasil diselesaikan pada {{tanggal}}.\nAnda kini dapat masuk ke portal melalui {{tautan}} untuk mengakses tugas, proposal, dan koordinasi wilayah.\n\nReferensi: {{referensi}}',
    ],
    [
      'etpl-4', 'reset_password', 'Tautan Reset Kata Sandi Akun', 'Keamanan Akun',
      '[SATU DPBI] Permintaan Reset Kata Sandi — {{nama}}',
      'Yth. {{nama}},\n\nKami menerima permintaan pengaturan ulang kata sandi untuk akun {{email}} pada {{tanggal}}.\nGunakan tautan satu kali pakai berikut (kedaluwarsa {{tenggat}}):\n{{tautan}}\n\nJika Anda tidak merasa meminta reset sandi, abaikan pesan ini dan hubungi Sekretariat Nasional.',
    ],
    [
      'etpl-5', 'konfirmasi_reset_password', 'Konfirmasi Perubahan Kata Sandi', 'Keamanan Akun',
      '[SATU DPBI] Kata Sandi Berhasil Diperbarui',
      'Yth. {{nama}},\n\nKata sandi untuk akun {{email}} telah diperbarui pada {{tanggal}} dan seluruh sesi perangkat sebelumnya telah dirotasi.\nJika bukan Anda yang melakukan perubahan ini, segera hubungi Super Admin SATU DPBI.\n\nReferensi: {{referensi}}',
    ],
    [
      'etpl-6', 'notifikasi_pengajuan', 'Notifikasi Pengajuan Proposal / Permohonan Baru', 'Persetujuan & Alur Kerja',
      '[SATU DPBI] Pengajuan Baru Menunggu Tinjauan ({{referensi}})',
      'Yth. {{nama}},\n\nTerdapat pengajuan baru bernomor {{referensi}} dari wilayah {{provinsi}} ({{angkatan}}) yang memerlukan peninjauan Anda sebelum {{tenggat}}.\nBuka antrean persetujuan pada: {{tautan}}\n\nSatu Sistem, Satu Data, Satu Koordinasi.',
    ],
    [
      'etpl-7', 'notifikasi_revisi', 'Permintaan Revisi Proposal atau Laporan (LKL)', 'Persetujuan & Alur Kerja',
      '[SATU DPBI] Pengajuan Perlu Revisi — {{referensi}}',
      'Yth. {{nama}},\n\nPengajuan {{referensi}} ({{provinsi}}) berstatus Perlu Revisi setelah pemeriksaan tahap persetujuan pada {{tanggal}}.\nMohon perbaiki dokumen sesuai catatan peninjau dan ajukan ulang sebelum {{tenggat}} melalui:\n{{tautan}}',
    ],
    [
      'etpl-8', 'proposal_disetujui', 'Pemberitahuan Proposal Kegiatan Disetujui', 'Persetujuan & Alur Kerja',
      '[SATU DPBI] Proposal Disetujui — {{referensi}}',
      'Selamat {{nama}},\n\nProposal kegiatan {{referensi}} untuk wilayah {{provinsi}} ({{angkatan}}) telah resmi disetujui pada {{tanggal}}.\nAgenda kalender dan tugas tindak lanjut (termasuk kewajiban LKL) telah dibuat otomatis di portal:\n{{tautan}}',
    ],
    [
      'etpl-9', 'proposal_ditolak', 'Pemberitahuan Proposal Tidak Dapat Disetujui', 'Persetujuan & Alur Kerja',
      '[SATU DPBI] Keputusan Penolakan Proposal — {{referensi}}',
      'Yth. {{nama}},\n\nBerdasarkan evaluasi administrasi dan kesesuaian risiko, proposal {{referensi}} ({{provinsi}}) belum dapat disetujui pada {{tanggal}}.\nSilakan tinjau catatan keputusan lengkap pada: {{tautan}}',
    ],
    [
      'etpl-10', 'konfirmasi_kegiatan', 'Konfirmasi Jadwal & Pelaksanaan Kegiatan Resmi', 'Program & Kegiatan',
      '[Informasi Kegiatan] Konfirmasi Program {{angkatan}} — {{provinsi}}',
      'Halo {{nama}},\n\nBerikut konfirmasi jadwal pelaksanaan kegiatan resmi DPBI untuk wilayah {{provinsi}} pada {{tanggal}}.\nPastikan daftar hadir, izin lokasi, dan pendamping dewasa tersedia sesuai SOP. Detail agenda:\n{{tautan}}\n\nReferensi: {{referensi}}',
    ],
    [
      'etpl-11', 'pengingat_tenggat', 'Pengingat Tenggat Tugas, Proposal & Laporan Bulanan', 'Koordinasi Wilayah',
      '[Pengingat Tenggat] Kewajiban {{jabatan}} {{provinsi}} — Batas {{tenggat}}',
      'Yth. {{nama}} ({{jabatan}} — {{provinsi}}),\n\nMohon segera menuntaskan kewajiban administrasi/laporan Anda sebelum tenggat {{tenggat}}.\nAkses modul pelaporan langsung di:\n{{tautan}}\n\nReferensi: {{referensi}}',
    ],
    [
      'etpl-12', 'notifikasi_laporan', 'Status Pemeriksaan LKL / Laporan Koordinator', 'Laporan & Evaluasi',
      '[SATU DPBI] Pembaruan Status Laporan {{referensi}}',
      'Yth. {{nama}},\n\nLaporan {{referensi}} wilayah {{provinsi}} telah diperiksa pada {{tanggal}}.\nLihat hasil verifikasi dan catatan evaluasi kinerja melalui:\n{{tautan}}',
    ],
    [
      'etpl-13', 'penetapan_jabatan', 'Surat Keputusan & Penetapan Jabatan Resmi', 'Struktur Organisasi',
      '[SATU DPBI] Penetapan Jabatan Resmi: {{jabatan}} ({{nomor_surat}})',
      'Yth. {{nama}},\n\nSelamat atas penetapan amanah resmi Anda sebagai {{jabatan}} di wilayah {{provinsi}} ({{angkatan}}) berdasarkan surat nomor {{nomor_surat}} tertanggal {{tanggal}}.\nUnduh SK dan kelengkapan tugas di:\n{{tautan}}',
    ],
    [
      'etpl-14', 'perubahan_jabatan', 'Pemberitahuan Perubahan / Rotasi Jabatan', 'Struktur Organisasi',
      '[SATU DPBI] Pembaruan Penugasan Jabatan — {{nama}} ({{nomor_surat}})',
      'Yth. {{nama}},\n\nTerdapat pembaruan penugasan jabatan Anda menjadi {{jabatan}} ({{provinsi}}) efektif per {{tanggal}} sesuai catatan nomor {{nomor_surat}}.\nRiwayat jabatan telah tercatat permanen di profil Anda:\n{{tautan}}',
    ],
    [
      'etpl-15', 'pengumuman_organisasi', 'Pengumuman Resmi Organisasi DPBI', 'Komunikasi Nasional',
      '[Pengumuman Resmi DPBI] Informasi Organisasi — {{tanggal}}',
      'Yth. {{nama}} ({{jabatan}} — {{provinsi}}),\n\nSekretariat Nasional DPBI menyampaikan pengumuman resmi organisasi terkait pelaksanaan program {{angkatan}}.\nSilakan membaca naskah lengkap pengumuman pada:\n{{tautan}}\n\nReferensi: {{referensi}}',
    ],
    [
      'etpl-16', 'rekap_bulanan', 'Rekapitulasi Bulanan Operasional Wilayah & Program', 'Laporan & Evaluasi',
      '[SATU DPBI] Rekapitulasi Bulanan Wilayah {{provinsi}} — {{tanggal}}',
      'Yth. {{nama}},\n\nBerikut ringkasan rekapitulasi operasional bulanan wilayah {{provinsi}} untuk periode berjalan per {{tanggal}}.\nTinjau indikator capaian proposal, LKL, dan tugas di:\n{{tautan}}\n\nNomor Rekap: {{nomor_surat}}',
    ],
    [
      'etpl-17', 'informasi_alumni', 'Informasi Transisi & Jendela Akses Arsip Alumni', 'Alumni',
      '[SATU DPBI] Informasi Alumni & Jendela Arsip 30 Hari — {{nama}}',
      'Yth. {{nama}},\n\nMasa tugas {{angkatan}} telah memasuki fase Alumni. Anda memiliki akses arsip pribadi & unduh sertifikat hingga {{tenggat}} melalui:\n{{tautan}}\n\nReferensi: {{referensi}}',
    ],
    [
      'etpl-18', 'serah_terima_jabatan', 'Berita Acara Serah Terima Jabatan Koordinator Wilayah', 'Struktur Organisasi',
      '[SATU DPBI] Serah Terima Jabatan Wilayah {{provinsi}} ({{nomor_surat}})',
      'Yth. {{nama}},\n\nProses serah terima jabatan Koordinator Wilayah {{provinsi}} ({{nomor_surat}}) telah dicatat pada {{tanggal}} mencakup pengalihan tugas, proposal aktif, dan arsip dokumen.\nTinjau paket serah terima lengkap di:\n{{tautan}}\n\nReferensi: {{referensi}}',
    ],
  ];

  const insStmt = db.prepare(
    `INSERT OR IGNORE INTO email_templates (id, code, name, category, subject, body_text, body_html, version, is_active, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`
  );
  const updHtmlStmt = db.prepare(
    `UPDATE email_templates SET body_html = ? WHERE code = ? AND (body_html IS NULL OR TRIM(body_html) = '')`
  );

  for (const [id, code, name, cat, subj, bodyText] of templates) {
    const html = wrapOfficialEmailHtml(name, bodyText);
    insStmt.run(id, code, name, cat, subj, bodyText, html, now);
    updHtmlStmt.run(html, code);
  }
}
