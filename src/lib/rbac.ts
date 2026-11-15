import { INDONESIA_PROVINCES, PROVINCE_BY_CODE } from './provinces';
import type {
  DelegationRecord,
  ModuleCode,
  PermissionAction,
  PersonnelRecord,
  RoleCode,
} from './types';

export const ROLE_LABELS: Record<RoleCode, string> = {
  super_admin: 'Super Admin',
  wakil_super_admin: 'Wakil Super Admin',
  penanggung_jawab: 'Penanggung Jawab Organisasi',
  pengurus_nasional: 'Pengurus Nasional',
  sekretariat_nasional: 'Sekretariat Nasional',
  koordinator_wilayah: 'Koordinator Wilayah',
  duta: 'Duta',
  alumni: 'Alumni',
};

const ALL_ACTIONS: PermissionAction[] = [
  'view', 'create', 'edit', 'delete', 'approve', 'reject', 'review',
  'download', 'export', 'assign', 'manage', 'publish', 'archive', 'restore', 'configure',
];

export const BASE_ROLE_PERMISSIONS: Record<RoleCode, Partial<Record<ModuleCode, PermissionAction[]>>> = {
  super_admin: {
    dashboard: ALL_ACTIONS,
    command_center: ALL_ACTIONS,
    organisasi: ALL_ACTIONS,
    personalia: ALL_ACTIONS,
    wilayah: ALL_ACTIONS,
    angkatan: ALL_ACTIONS,
    proposal: ALL_ACTIONS,
    lkl: ALL_ACTIONS,
    laporan_koordinator: ALL_ACTIONS,
    tugas: ALL_ACTIONS,
    dokumen: ALL_ACTIONS,
    pengumuman: ALL_ACTIONS,
    kalender: ALL_ACTIONS,
    perlindungan: ALL_ACTIONS,
    evaluasi: ALL_ACTIONS,
    arsip: ALL_ACTIONS,
    sistem: ALL_ACTIONS,
    pengaturan: ALL_ACTIONS,
  },
  wakil_super_admin: {
    dashboard: ['view', 'export'],
    command_center: ['view', 'review', 'export'],
    organisasi: ['view', 'review', 'assign'],
    personalia: ['view', 'review', 'export'],
    wilayah: ['view', 'review', 'export'],
    angkatan: ['view', 'review'],
    proposal: ['view', 'review', 'approve', 'reject'],
    lkl: ['view', 'review'],
    laporan_koordinator: ['view', 'review'],
    tugas: ['view', 'create', 'edit', 'assign'],
    dokumen: ['view', 'download', 'publish'],
    pengumuman: ['view', 'create', 'publish'],
    kalender: ['view', 'create', 'edit'],
    perlindungan: ['view', 'review'],
    evaluasi: ['view', 'review', 'export'],
    arsip: ['view', 'download'],
    pengaturan: ['view'],
  },
  penanggung_jawab: {
    dashboard: ['view', 'export'],
    command_center: ['view'],
    organisasi: ['view'],
    personalia: ['view'],
    wilayah: ['view'],
    angkatan: ['view'],
    proposal: ['view', 'review'],
    lkl: ['view', 'review'],
    laporan_koordinator: ['view', 'review'],
    tugas: ['view'],
    dokumen: ['view', 'download'],
    pengumuman: ['view'],
    kalender: ['view'],
    perlindungan: ['view', 'review', 'manage'],
    evaluasi: ['view', 'review', 'export'],
    arsip: ['view', 'download'],
    pengaturan: ['view'],
  },
  pengurus_nasional: {
    dashboard: ['view', 'export'],
    command_center: ['view'],
    organisasi: ['view'],
    personalia: ['view'],
    wilayah: ['view'],
    angkatan: ['view', 'create', 'edit'],
    proposal: ['view', 'review', 'approve', 'reject'],
    lkl: ['view', 'review'],
    laporan_koordinator: ['view', 'review'],
    tugas: ['view', 'create', 'edit', 'assign'],
    dokumen: ['view', 'create', 'download', 'publish'],
    pengumuman: ['view', 'create', 'publish'],
    kalender: ['view', 'create', 'edit'],
    perlindungan: ['view', 'review'],
    evaluasi: ['view', 'create', 'review'],
    arsip: ['view', 'download'],
    pengaturan: ['view'],
  },
  sekretariat_nasional: {
    dashboard: ['view', 'export'],
    organisasi: ['view', 'create', 'edit'],
    personalia: ['view', 'create', 'edit', 'review', 'export'],
    wilayah: ['view', 'edit'],
    angkatan: ['view', 'create', 'edit'],
    proposal: ['view', 'review'],
    lkl: ['view'],
    laporan_koordinator: ['view', 'review'],
    tugas: ['view', 'create', 'edit', 'assign'],
    dokumen: ['view', 'create', 'edit', 'download', 'publish', 'archive'],
    pengumuman: ['view', 'create', 'publish'],
    kalender: ['view', 'create', 'edit'],
    perlindungan: ['view', 'create'],
    evaluasi: ['view'],
    arsip: ['view', 'create', 'download', 'archive'],
    pengaturan: ['view'],
  },
  koordinator_wilayah: {
    dashboard: ['view'],
    personalia: ['view', 'create', 'edit', 'review'],
    wilayah: ['view', 'edit'],
    angkatan: ['view'],
    proposal: ['view', 'create', 'edit', 'review'],
    lkl: ['view', 'review', 'approve', 'reject'],
    laporan_koordinator: ['view', 'create', 'edit'],
    tugas: ['view', 'create', 'edit', 'assign'],
    dokumen: ['view', 'download'],
    pengumuman: ['view', 'create'],
    kalender: ['view', 'create', 'edit'],
    perlindungan: ['view', 'create'],
    evaluasi: ['view', 'create'],
    arsip: ['view', 'download'],
    pengaturan: ['view'],
  },
  duta: {
    dashboard: ['view'],
    personalia: ['view', 'edit'],
    angkatan: ['view'],
    proposal: ['view', 'create', 'edit'],
    lkl: ['view', 'create', 'edit'],
    tugas: ['view', 'edit'],
    dokumen: ['view', 'download'],
    pengumuman: ['view'],
    kalender: ['view'],
    perlindungan: ['view', 'create'],
    evaluasi: ['view'],
    arsip: ['view', 'download'],
    pengaturan: ['view'],
  },
  alumni: {
    dashboard: ['view'],
    dokumen: ['view', 'download'],
    arsip: ['view', 'download', 'export'],
    pengaturan: ['view'],
  },
};

export function resolveEffectivePermissions(
  role: RoleCode,
  delegations: DelegationRecord[] = [],
  nowIso: string = new Date().toISOString()
): Record<ModuleCode, PermissionAction[]> {
  const base = BASE_ROLE_PERMISSIONS[role] ?? {};
  const result = {} as Record<ModuleCode, PermissionAction[]>;
  const modules: ModuleCode[] = [
    'dashboard', 'command_center', 'organisasi', 'personalia', 'wilayah',
    'angkatan', 'proposal', 'lkl', 'laporan_koordinator', 'tugas', 'dokumen',
    'pengumuman', 'kalender', 'perlindungan', 'evaluasi', 'arsip', 'sistem', 'pengaturan',
  ];

  for (const mod of modules) {
    result[mod] = [...(base[mod] ?? [])];
  }

  const nowMs = Date.parse(nowIso);
  for (const del of delegations) {
    if (del.status !== 'aktif') continue;
    const startMs = Date.parse(del.startsAt);
    const endMs = Date.parse(del.endsAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
    if (nowMs < startMs || nowMs > endMs) continue;
    if (!result[del.module].includes(del.action)) {
      result[del.module].push(del.action);
    }
  }

  return result;
}

export function hasPermission(
  permissions: Partial<Record<ModuleCode, PermissionAction[]>>,
  module: ModuleCode,
  action: PermissionAction
): boolean {
  const list = permissions[module];
  if (!list) return false;
  return list.includes(action);
}

export function resolveProposalApprover(input: {
  category: string;
  riskLevel: 'rendah' | 'sedang' | 'tinggi';
  usesDpbiIdentity: boolean;
  externalPermitNeeded: boolean;
}): { approverRole: RoleCode; stageLabel: string } {
  if (input.riskLevel === 'tinggi' || input.externalPermitNeeded) {
    return {
      approverRole: 'pengurus_nasional',
      stageLabel: 'Persetujuan Pengurus Nasional (Bidang & Kepatuhan Risiko)',
    };
  }
  if (input.usesDpbiIdentity || input.category.toLowerCase().includes('nasional')) {
    return {
      approverRole: 'pengurus_nasional',
      stageLabel: 'Persetujuan Pengurus Nasional Sesuai Bidang',
    };
  }
  return {
    approverRole: 'koordinator_wilayah',
    stageLabel: 'Pemeriksaan & Persetujuan Koordinator Wilayah',
  };
}

export function calculateAlumniWindow(
  termEndsAtIso: string,
  nowIso: string = new Date().toISOString()
): {
  inWindow: boolean;
  expired: boolean;
  daysRemaining: number;
  expiresAtIso: string;
  reminderStage: 'none' | 'h_minus_7' | 'h_minus_3' | 'hari_terakhir' | 'berakhir';
} {
  const endMs = Date.parse(termEndsAtIso);
  const windowDays = 30;
  const expiresMs = endMs + windowDays * 24 * 60 * 60 * 1000;
  const nowMs = Date.parse(nowIso);
  const diffDays = Math.ceil((expiresMs - nowMs) / (24 * 60 * 60 * 1000));

  if (nowMs > expiresMs) {
    return {
      inWindow: false,
      expired: true,
      daysRemaining: 0,
      expiresAtIso: new Date(expiresMs).toISOString(),
      reminderStage: 'berakhir',
    };
  }

  let reminderStage: 'none' | 'h_minus_7' | 'h_minus_3' | 'hari_terakhir' | 'berakhir' = 'none';
  if (diffDays <= 1) reminderStage = 'hari_terakhir';
  else if (diffDays <= 3) reminderStage = 'h_minus_3';
  else if (diffDays <= 7) reminderStage = 'h_minus_7';

  return {
    inWindow: nowMs >= endMs && nowMs <= expiresMs,
    expired: false,
    daysRemaining: Math.max(0, diffDays),
    expiresAtIso: new Date(expiresMs).toISOString(),
    reminderStage,
  };
}

export function verifyCoordinateInProvince(
  lat: number,
  lng: number,
  provinceCode: string
): {
  matched: boolean;
  provinceName: string;
  distanceKmFromCenter: number;
  reason: string;
} {
  const prov = PROVINCE_BY_CODE.get(provinceCode);
  if (!prov) {
    return {
      matched: false,
      provinceName: 'Wilayah Tidak Dikenal',
      distanceKmFromCenter: 9999,
      reason: 'Kode provinsi tidak terdaftar pada data referensi 38 provinsi.',
    };
  }

  // Allow small coastal/GPS tolerance of ~0.25 deg
  const tol = 0.25;
  const inBox =
    lat >= prov.minLat - tol &&
    lat <= prov.maxLat + tol &&
    lng >= prov.minLng - tol &&
    lng <= prov.maxLng + tol;

  const dLat = (lat - prov.centerLat) * 111;
  const dLng = (lng - prov.centerLng) * 111 * Math.cos((prov.centerLat * Math.PI) / 180);
  const distanceKmFromCenter = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));

  return {
    matched: inBox,
    provinceName: prov.name,
    distanceKmFromCenter,
    reason: inBox
      ? `Koordinat terkonfirmasi berada dalam cakupan wilayah ${prov.name}.`
      : `Koordinat berada di luar batas referensi ${prov.name} (jarak ~${distanceKmFromCenter} km dari titik tengah provinsi).`,
  };
}

export function calculateProfileCompleteness(
  p: Partial<PersonnelRecord>
): { score: number; missingFields: string[] } {
  const checks: [string, boolean][] = [
    ['Nama Lengkap', Boolean(p.fullName?.trim())],
    ['Tempat & Tanggal Lahir', Boolean(p.birthPlace?.trim() && p.birthDate?.trim())],
    ['Email & Nomor Telepon', Boolean(p.email?.trim() && p.phone?.trim())],
    ['Alamat Domisili Lengkap', Boolean(p.provinceCode && p.regency && p.fullAddress)],
    ['Identitas Sekolah & Jenjang', Boolean(p.schoolName && p.educationLevel && p.gradeClass)],
    ['Kontak Orang Tua/Wali', Boolean(p.guardianName && p.guardianPhone)],
    ['Pas Foto Resmi', Boolean(p.docsChecklist?.pasFoto)],
    ['Kartu Pelajar / Bukti Status', Boolean(p.docsChecklist?.kartuPelajar)],
    ['Surat Rekomendasi Sekolah', Boolean(p.docsChecklist?.suratSekolah)],
    ['Surat Izin Orang Tua/Wali', Boolean(p.docsChecklist?.izinWali)],
  ];

  const missingFields = checks.filter(([, ok]) => !ok).map(([label]) => label);
  const completed = checks.length - missingFields.length;
  return {
    score: Math.round((completed / checks.length) * 100),
    missingFields,
  };
}

export function formatReferenceNumber(
  category: 'PROP' | 'LKL' | 'LKW' | 'AKUN' | 'DOC' | 'TGS' | 'ADU' | 'INS' | 'PERS' | 'HND',
  year: number,
  sequence: number
): string {
  return `DPBI/${category}/${year}/${String(sequence).padStart(4, '0')}`;
}

export function formatTanggalIndonesia(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  try {
    const opts: Intl.DateTimeFormatOptions = {
      timeZone: 'Asia/Jakarta',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      ...(withTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
    };
    const formatted = new Intl.DateTimeFormat('id-ID', opts).format(d);
    return withTime ? `${formatted} WIB` : formatted;
  } catch {
    return iso;
  }
}

export function getProvinceCount(): number {
  return INDONESIA_PROVINCES.length;
}
