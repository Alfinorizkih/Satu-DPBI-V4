import type { HttpErrorCode, ModuleCode } from './types';

export type MatchedPrivateRoute =
  | { kind: 'dashboard'; module: ModuleCode; title: string }
  | { kind: 'my_activity'; module: ModuleCode; title: string }
  | { kind: 'organization'; module: ModuleCode; title: string }
  | { kind: 'personnel'; module: ModuleCode; title: string; mode: 'list' | 'create' | 'detail' | 'edit' | 'history'; id?: string }
  | { kind: 'regions'; module: ModuleCode; title: string; id?: string }
  | { kind: 'batches'; module: ModuleCode; title: string; id?: string }
  | { kind: 'alumni'; module: ModuleCode; title: string }
  | { kind: 'proposals'; module: ModuleCode; title: string; mode: 'list' | 'create' | 'detail'; id?: string }
  | { kind: 'lkl'; module: ModuleCode; title: string; mode: 'list' | 'create' | 'detail'; id?: string }
  | { kind: 'coordinator_reports'; module: ModuleCode; title: string }
  | { kind: 'tasks'; module: ModuleCode; title: string; scope: 'all' | 'mine'; id?: string }
  | { kind: 'documents'; module: ModuleCode; title: string; id?: string }
  | { kind: 'announcements'; module: ModuleCode; title: string }
  | { kind: 'calendar'; module: ModuleCode; title: string }
  | { kind: 'notifications'; title: string }
  | { kind: 'safeguarding'; module: ModuleCode; title: string }
  | { kind: 'evaluations'; module: ModuleCode; title: string }
  | { kind: 'archive'; module: ModuleCode; title: string }
  | { kind: 'system'; module: ModuleCode; title: string; initialTab: 'storage' | 'audit' | 'kesehatan' }
  | { kind: 'settings'; module: ModuleCode; title: string; initialTab: 'profil' | 'keamanan' | 'sesi' | 'preferensi' | 'pengguna' | 'hak_akses' | 'organisasi' | 'cms' }
  | { kind: 'help'; title: string }
  | { kind: 'legal'; section: 'privasi' | 'ketentuan'; title: string };

export const VALID_ERROR_CODES: HttpErrorCode[] = [400, 401, 403, 404, 419, 422, 429, 500, 502, 503];

export function normalizePathname(pathname: string): string {
  const clean = (pathname || '/').split('?')[0].split('#')[0];
  if (clean.length > 1 && clean.endsWith('/')) {
    return clean.slice(0, -1);
  }
  return clean || '/';
}

export function isPublicWebsitePath(pathname: string): boolean {
  const p = normalizePathname(pathname);
  return (
    p === '/' ||
    p === '/tentang' ||
    p === '/wilayah' ||
    p.startsWith('/wilayah/') ||
    p === '/bantuan' ||
    p === '/pusat-bantuan' ||
    p === '/privasi' ||
    p === '/ketentuan' ||
    p === '/hak-cipta' ||
    p === '/pemeliharaan' ||
    p === '/login' ||
    p === '/lupa-password' ||
    p === '/reset-password' ||
    p === '/aktivasi' ||
    p === '/aktivasi-akun' ||
    p === '/verifikasi-undangan'
  );
}

function safeSegment(raw: string): string | null {
  const decoded = decodeURIComponent(raw).trim();
  if (!decoded || decoded.includes('/') || decoded.includes('..') || decoded.length > 96) {
    return null;
  }
  return decoded;
}

export function matchPrivateRoute(pathname: string): MatchedPrivateRoute | null {
  const p = normalizePathname(pathname);

  if (p === '/dashboard') return { kind: 'dashboard', module: 'dashboard', title: 'Dashboard & Ringkasan' };
  if (p === '/aktivitas-saya') return { kind: 'my_activity', module: 'dashboard', title: 'Aktivitas Saya' };
  if (p === '/tugas-saya') return { kind: 'tasks', module: 'tugas', title: 'Tugas Saya', scope: 'mine' };
  if (p === '/organisasi') return { kind: 'organization', module: 'organisasi', title: 'Struktur Organisasi & Delegasi' };
  if (p === '/alumni') return { kind: 'alumni', module: 'arsip', title: 'Direktori & Akses Alumni' };
  if (p === '/laporan-koordinator') {
    return { kind: 'coordinator_reports', module: 'laporan_koordinator', title: 'Laporan Koordinator Wilayah' };
  }
  if (p === '/pengumuman') return { kind: 'announcements', module: 'pengumuman', title: 'Pusat Pengumuman' };
  if (p === '/kalender') return { kind: 'calendar', module: 'kalender', title: 'Kalender Organisasi' };
  if (p === '/notifikasi') return { kind: 'notifications', title: 'Pusat Notifikasi' };
  if (p === '/perlindungan') return { kind: 'safeguarding', module: 'perlindungan', title: 'Perlindungan Peserta & Pengaduan' };
  if (p === '/evaluasi') return { kind: 'evaluations', module: 'evaluasi', title: 'Monitoring & Evaluasi Kinerja' };
  if (p === '/arsip') return { kind: 'archive', module: 'arsip', title: 'Arsip Organisasi' };
  if (p === '/bantuan' || p === '/pusat-bantuan') return { kind: 'help', title: 'Pusat Bantuan & Panduan' };
  if (p === '/privasi') return { kind: 'legal', section: 'privasi', title: 'Kebijakan Privasi & Data Pelajar' };
  if (p === '/ketentuan' || p === '/hak-cipta') return { kind: 'legal', section: 'ketentuan', title: 'Hak Cipta & Ketentuan Penggunaan' };

  // System & Governance sub-routes
  if (p === '/sistem') return { kind: 'system', module: 'sistem', title: 'Kontrol Sistem, Storage & Backup', initialTab: 'storage' };
  if (p === '/audit-log') return { kind: 'system', module: 'sistem', title: 'Audit Log Keamanan', initialTab: 'audit' };
  if (p === '/status-sistem') return { kind: 'system', module: 'sistem', title: 'Status & Kesehatan Sistem', initialTab: 'kesehatan' };

  // Settings & Profile sub-routes
  if (p === '/profil' || p === '/pengaturan/profil') return { kind: 'settings', module: 'pengaturan', title: 'Profil Pribadi', initialTab: 'profil' };
  if (p === '/pengaturan') return { kind: 'settings', module: 'pengaturan', title: 'Pengaturan Akun & Sistem', initialTab: 'profil' };
  if (p === '/pengaturan/keamanan') return { kind: 'settings', module: 'pengaturan', title: 'Keamanan & Kata Sandi', initialTab: 'keamanan' };
  if (p === '/pengaturan/sesi') return { kind: 'settings', module: 'pengaturan', title: 'Perangkat & Sesi Aktif', initialTab: 'sesi' };
  if (p === '/pengaturan/pengguna') return { kind: 'settings', module: 'pengaturan', title: 'Manajemen Pengguna', initialTab: 'pengguna' };
  if (p === '/pengaturan/hak-akses') return { kind: 'settings', module: 'pengaturan', title: 'Hak Akses & Peran (RBAC)', initialTab: 'hak_akses' };
  if (p === '/pengaturan/cms' || p === '/cms') return { kind: 'settings', module: 'pengaturan', title: 'CMS Portal Publik & Bantuan', initialTab: 'cms' };

  // Personalia
  if (p === '/personalia' || p === '/personalia/daftar') return { kind: 'personnel', module: 'personalia', title: 'Personalia & Verifikasi Profil', mode: 'list' };
  if (p === '/personalia/tambah') return { kind: 'personnel', module: 'personalia', title: 'Tambah Personel Baru', mode: 'create' };
  if (p === '/personalia/riwayat') return { kind: 'personnel', module: 'personalia', title: 'Riwayat Jabatan & Aktivitas Personel', mode: 'history' };
  if (p.startsWith('/personalia/')) {
    const rest = p.slice('/personalia/'.length);
    if (rest.endsWith('/ubah')) {
      const id = safeSegment(rest.slice(0, -'/ubah'.length));
      if (id) return { kind: 'personnel', module: 'personalia', title: 'Ubah Profil Personel', mode: 'edit', id };
    } else {
      const id = safeSegment(rest);
      if (id) return { kind: 'personnel', module: 'personalia', title: 'Detail Profil Personel', mode: 'detail', id };
    }
    return null;
  }

  // Wilayah
  if (p === '/wilayah') return { kind: 'regions', module: 'wilayah', title: 'Wilayah 38 Provinsi & Kabupaten/Kota' };
  if (p.startsWith('/wilayah/')) {
    const id = safeSegment(p.slice('/wilayah/'.length));
    return id ? { kind: 'regions', module: 'wilayah', title: 'Detail Wilayah Provinsi', id } : null;
  }

  // Angkatan
  if (p === '/angkatan') return { kind: 'batches', module: 'angkatan', title: 'Angkatan & Siklus Masa Tugas' };
  if (p.startsWith('/angkatan/')) {
    const id = safeSegment(p.slice('/angkatan/'.length));
    return id ? { kind: 'batches', module: 'angkatan', title: 'Detail Angkatan', id } : null;
  }

  // Proposal
  if (p === '/proposal') return { kind: 'proposals', module: 'proposal', title: 'Manajemen Proposal Kegiatan', mode: 'list' };
  if (p === '/proposal/baru') return { kind: 'proposals', module: 'proposal', title: 'Ajukan Proposal Baru', mode: 'create' };
  if (p.startsWith('/proposal/')) {
    const id = safeSegment(p.slice('/proposal/'.length));
    return id ? { kind: 'proposals', module: 'proposal', title: 'Detail Proposal Kegiatan', mode: 'detail', id } : null;
  }

  // Laporan Kegiatan (LKL)
  if (p === '/laporan-kegiatan') return { kind: 'lkl', module: 'lkl', title: 'Laporan Kegiatan Lapangan (LKL)', mode: 'list' };
  if (p === '/laporan-kegiatan/baru') return { kind: 'lkl', module: 'lkl', title: 'Ajukan Laporan Kegiatan (LKL)', mode: 'create' };
  if (p.startsWith('/laporan-kegiatan/')) {
    const id = safeSegment(p.slice('/laporan-kegiatan/'.length));
    return id ? { kind: 'lkl', module: 'lkl', title: 'Detail Laporan Kegiatan (LKL)', mode: 'detail', id } : null;
  }

  // Tugas
  if (p === '/tugas') return { kind: 'tasks', module: 'tugas', title: 'Task Management Center', scope: 'all' };
  if (p.startsWith('/tugas/')) {
    const id = safeSegment(p.slice('/tugas/'.length));
    return id ? { kind: 'tasks', module: 'tugas', title: 'Detail Tugas', scope: 'all', id } : null;
  }

  // Dokumen
  if (p === '/dokumen') return { kind: 'documents', module: 'dokumen', title: 'Pusat Dokumen & SOP' };
  if (p.startsWith('/dokumen/')) {
    const id = safeSegment(p.slice('/dokumen/'.length));
    return id ? { kind: 'documents', module: 'dokumen', title: 'Pratinjau Dokumen Resmi', id } : null;
  }

  return null;
}

export function getRouteTitle(pathname: string): string {
  const matched = matchPrivateRoute(pathname);
  return matched?.title || 'Portal Internal SATU DPBI';
}

export function resolveBaseNavPath(pathname: string): string {
  const p = normalizePathname(pathname);
  if (p === '/aktivitas-saya') return '/aktivitas-saya';
  if (p === '/tugas-saya') return '/tugas-saya';
  if (p === '/alumni') return '/alumni';
  if (p === '/audit-log') return '/audit-log';
  if (p === '/status-sistem') return '/status-sistem';
  if (p === '/profil' || p === '/pengaturan' || p === '/pengaturan/profil' || p === '/pengaturan/keamanan' || p === '/pengaturan/sesi') return '/pengaturan';
  if (p === '/pengaturan/pengguna') return '/pengaturan/pengguna';
  if (p === '/pengaturan/hak-akses') return '/pengaturan/hak-akses';
  if (p === '/pengaturan/cms' || p === '/cms') return '/pengaturan/cms';
  if (p.startsWith('/personalia')) return '/personalia';
  if (p.startsWith('/wilayah')) return '/wilayah';
  if (p.startsWith('/angkatan')) return '/angkatan';
  if (p.startsWith('/proposal')) return '/proposal';
  if (p.startsWith('/laporan-kegiatan')) return '/laporan-kegiatan';
  if (p.startsWith('/tugas')) return '/tugas';
  if (p === '/pusat-bantuan') return '/bantuan';
  if (p === '/hak-cipta') return '/ketentuan';
  if (p.startsWith('/dokumen')) return '/dokumen';
  return p;
}
