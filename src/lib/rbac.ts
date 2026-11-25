import { INDONESIA_PROVINCES, PROVINCE_BY_CODE } from './provinces';
import type {
  DelegationRecord,
  ModuleCode,
  OfficialBidang,
  PermissionAction,
  PersonnelRecord,
  ProvinceStatus,
  RegencyRecord,
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

export interface BidangDefinition {
  id: OfficialBidang;
  code: string;
  label: OfficialBidang;
  number: string;
  shortName: string;
  summary: string;
  description: string;
  primaryModules: ModuleCode[];
  proposalFocus: string[];
  aliases: string[];
}

export const OFFICIAL_BIDANGS: BidangDefinition[] = [
  {
    id: 'Bidang Administrasi & Organisasi',
    code: 'administrasi_organisasi',
    label: 'Bidang Administrasi & Organisasi',
    number: '01',
    shortName: 'Administrasi & Organisasi',
    summary: 'Tata kelola struktur organisasi, SK jabatan, verifikasi personalia, dan persuratan internal.',
    description: 'Tata kelola struktur organisasi, SK jabatan, verifikasi personalia, dan persuratan internal.',
    primaryModules: ['dashboard', 'organisasi', 'personalia', 'angkatan', 'dokumen', 'arsip'],
    proposalFocus: ['Administrasi', 'Organisasi', 'Tata Kelola'],
    aliases: ['administrasi', 'organisasi', 'administrasi dan pengembangan organisasi', 'tata kelola nasional'],
  },
  {
    id: 'Bidang Program & Operasional',
    code: 'program_operasional',
    label: 'Bidang Program & Operasional',
    number: '02',
    shortName: 'Program & Operasional',
    summary: 'Pengendalian alur proposal kegiatan, evaluasi LKL, kalender kerja, dan penugasan operasional.',
    description: 'Pengendalian alur proposal kegiatan, evaluasi LKL, kalender kerja, dan penugasan operasional.',
    primaryModules: ['dashboard', 'proposal', 'lkl', 'laporan_koordinator', 'tugas', 'kalender', 'evaluasi'],
    proposalFocus: ['Program dan Operasional', 'Operasional', 'Lokakarya / Literasi Pelajar', 'Aksi Pelajar'],
    aliases: ['program', 'operasional', 'program dan operasional'],
  },
  {
    id: 'Bidang Pengembangan Wilayah',
    code: 'pengembangan_wilayah',
    label: 'Bidang Pengembangan Wilayah',
    number: '03',
    shortName: 'Pengembangan Wilayah',
    summary: 'Pembinaan 38 provinsi dan kabupaten/kota, serah terima koordinator, dan laporan bulanan wilayah.',
    description: 'Pembinaan 38 provinsi dan kabupaten/kota, serah terima koordinator, dan laporan bulanan wilayah.',
    primaryModules: ['dashboard', 'wilayah', 'laporan_koordinator', 'personalia', 'tugas', 'evaluasi'],
    proposalFocus: ['Pengembangan Wilayah', 'Koordinasi Wilayah'],
    aliases: ['wilayah', 'pengembangan wilayah', 'koordinasi wilayah'],
  },
  {
    id: 'Bidang Pendidikan & Kebudayaan',
    code: 'pendidikan_kebudayaan',
    label: 'Bidang Pendidikan & Kebudayaan',
    number: '04',
    shortName: 'Pendidikan & Kebudayaan',
    summary: 'Kurikulum pembekalan, festival budaya pelajar, literasi aksara/bahasa daerah, dan materi edukasi.',
    description: 'Kurikulum pembekalan, festival budaya pelajar, literasi aksara/bahasa daerah, dan materi edukasi.',
    primaryModules: ['dashboard', 'proposal', 'lkl', 'dokumen', 'kalender', 'angkatan'],
    proposalFocus: ['Kebudayaan', 'Pendidikan', 'Festival / Pameran Budaya', 'Lokakarya / Literasi Pelajar', 'Seminar Daring'],
    aliases: ['pendidikan', 'kebudayaan', 'pendidikan dan kebudayaan'],
  },
  {
    id: 'Bidang Hubungan & Kemitraan',
    code: 'hubungan_kemitraan',
    label: 'Bidang Hubungan & Kemitraan',
    number: '05',
    shortName: 'Hubungan & Kemitraan',
    summary: 'Verifikasi proposal kemitraan eksternal, jejaring sekolah/komunitas, dan kepatuhan izin lembaga.',
    description: 'Verifikasi proposal kemitraan eksternal, jejaring sekolah/komunitas, dan kepatuhan izin lembaga.',
    primaryModules: ['dashboard', 'proposal', 'dokumen', 'pengumuman', 'kalender'],
    proposalFocus: ['Hubungan dan Kemitraan', 'Kemitraan Eksternal / Lintas Lembaga', 'Kemitraan'],
    aliases: ['hubungan', 'kemitraan', 'hubungan dan kemitraan'],
  },
  {
    id: 'Bidang Media, Publikasi & Teknologi',
    code: 'media_publikasi_teknologi',
    label: 'Bidang Media, Publikasi & Teknologi',
    number: '06',
    shortName: 'Media, Publikasi & Teknologi',
    summary: 'Pengelolaan informasi website publik (CMS), pengumuman resmi, dokumentasi kegiatan, dan pusat bantuan.',
    description: 'Pengelolaan informasi website publik (CMS), pengumuman resmi, dokumentasi kegiatan, dan pusat bantuan.',
    primaryModules: ['dashboard', 'pengumuman', 'dokumen', 'kalender', 'lkl'],
    proposalFocus: ['Media', 'Publikasi', 'Teknologi', 'Kampanye Digital'],
    aliases: ['media', 'publikasi', 'teknologi', 'media publikasi & teknologi'],
  },
];

export function resolveBidangDefinition(rawBidang: string | null | undefined): BidangDefinition | null {
  if (!rawBidang) return null;
  const clean = rawBidang.trim().toLowerCase();
  const exact = OFFICIAL_BIDANGS.find(
    (b) => b.id.toLowerCase() === clean || b.code.toLowerCase() === clean || b.shortName.toLowerCase() === clean
  );
  if (exact) return exact;
  return (
    OFFICIAL_BIDANGS.find((b) =>
      b.aliases.some((alias) => clean.includes(alias))
    ) ?? null
  );
}

export function isRecordRelevantToBidang(
  userBidang: string | null | undefined,
  recordBidang: string | null | undefined,
  recordCategory?: string | null | undefined
): boolean {
  const def = resolveBidangDefinition(userBidang);
  if (!def) return true;
  const targets = [recordBidang, recordCategory].filter((v): v is string => Boolean(v && v.trim()));
  if (targets.length === 0) return false;
  return targets.some((target) => {
    const cleanTarget = target.trim().toLowerCase();
    if (cleanTarget === def.id.toLowerCase() || cleanTarget.includes(def.shortName.toLowerCase())) return true;
    if (def.aliases.some((a) => cleanTarget.includes(a))) return true;
    if (def.proposalFocus.some((f) => cleanTarget.includes(f.toLowerCase()))) return true;
    return false;
  });
}

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
    persetujuan: ALL_ACTIONS,
    email: ALL_ACTIONS,
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
    pengumuman: ['view', 'create', 'edit', 'publish'],
    kalender: ['view', 'create', 'edit'],
    perlindungan: ['view', 'review'],
    evaluasi: ['view', 'review', 'export'],
    arsip: ['view', 'download'],
    persetujuan: ['view', 'review', 'approve', 'reject', 'assign'],
    email: ['view', 'create', 'publish'],
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
    persetujuan: ['view', 'review', 'approve', 'reject'],
    email: ['view'],
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
    pengumuman: ['view', 'create', 'edit', 'publish'],
    kalender: ['view', 'create', 'edit'],
    perlindungan: ['view', 'review'],
    evaluasi: ['view', 'create', 'review'],
    arsip: ['view', 'download'],
    persetujuan: ['view', 'review', 'approve', 'reject'],
    email: ['view', 'create'],
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
    pengumuman: ['view', 'create', 'edit', 'publish'],
    kalender: ['view', 'create', 'edit'],
    perlindungan: ['view', 'create'],
    evaluasi: ['view'],
    arsip: ['view', 'create', 'download', 'archive'],
    persetujuan: ['view', 'review'],
    email: ['view', 'create', 'publish'],
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
    persetujuan: ['view', 'review', 'approve', 'reject'],
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
    'pengumuman', 'kalender', 'perlindungan', 'evaluasi', 'arsip',
    'persetujuan', 'email', 'sistem', 'pengaturan',
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
    if (result[del.module] && !result[del.module].includes(del.action)) {
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

/**
 * Verifikasi izin dengan containment cakupan provinsi pada delegasi aktif.
 * Jika izin berasal dari delegasi wilayah tertentu (del.provinceCode !== null),
 * aksi terhadap targetProvinceCode di luar cakupan delegasi akan ditolak.
 */
export function hasScopedPermission(
  role: RoleCode,
  delegations: DelegationRecord[] = [],
  module: ModuleCode,
  action: PermissionAction,
  targetProvinceCode?: string | null,
  userProvinceCode?: string | null,
  nowIso: string = new Date().toISOString()
): boolean {
  const baseActions = BASE_ROLE_PERMISSIONS[role]?.[module] ?? [];
  if (baseActions.includes(action)) {
    if (role === 'koordinator_wilayah' && targetProvinceCode && userProvinceCode && targetProvinceCode !== userProvinceCode) {
      return false;
    }
    return true;
  }

  const nowMs = Date.parse(nowIso);
  for (const del of delegations) {
    if (del.status !== 'aktif') continue;
    if (del.module !== module || del.action !== action) continue;
    const startMs = Date.parse(del.startsAt);
    const endMs = Date.parse(del.endsAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs) || nowMs < startMs || nowMs > endMs) continue;
    if (!del.provinceCode) return true;
    if (!targetProvinceCode || del.provinceCode === targetProvinceCode) return true;
  }
  return false;
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

/**
 * Derive honest regency operational status without conflating domicile vs official assignment vs active activities.
 */
export function classifyRegencyPresence(reg: {
  coordinatorName?: string | null;
  domicileDutaCount: number;
  assignmentDutaCount: number;
  lklCount: number;
  proposalCount: number;
}): {
  derivedStatus: ProvinceStatus;
  hasOfficialCoordinator: boolean;
  hasActivity: boolean;
  hasDomicileOnly: boolean;
  summaryLabel: string;
} {
  const hasOfficialCoordinator = Boolean(reg.coordinatorName?.trim());
  const hasActivity = reg.lklCount > 0 || reg.proposalCount > 0;
  const hasAssignment = reg.assignmentDutaCount > 0;
  const hasDomicileOnly = reg.domicileDutaCount > 0 && !hasAssignment && !hasActivity && !hasOfficialCoordinator;

  if (hasOfficialCoordinator && (hasAssignment || hasActivity)) {
    return {
      derivedStatus: 'aktif',
      hasOfficialCoordinator,
      hasActivity,
      hasDomicileOnly: false,
      summaryLabel: 'Aktif (Koordinator & Kegiatan/Penugasan)',
    };
  }
  if (hasAssignment || hasActivity || hasOfficialCoordinator) {
    return {
      derivedStatus: 'dalam_pengembangan',
      hasOfficialCoordinator,
      hasActivity,
      hasDomicileOnly: false,
      summaryLabel: hasAssignment ? 'Memiliki Duta Penugasan' : 'Dalam Pengembangan / Ada Kegiatan',
    };
  }
  if (hasDomicileOnly) {
    return {
      derivedStatus: 'dalam_pembinaan',
      hasOfficialCoordinator: false,
      hasActivity: false,
      hasDomicileOnly: true,
      summaryLabel: 'Domisili Duta Saja (Belum Ada Penugasan/Koordinator)',
    };
  }
  return {
    derivedStatus: 'belum_terbentuk',
    hasOfficialCoordinator: false,
    hasActivity: false,
    hasDomicileOnly: false,
    summaryLabel: 'Belum Terjangkau',
  };
}

export function summarizeRegencyCoverage(regencies: RegencyRecord[]): {
  total: number;
  active: number;
  developing: number;
  domicileCovered: number;
  assignmentCovered: number;
  withActivities: number;
} {
  return {
    total: regencies.length,
    active: regencies.filter((r) => r.status === 'aktif').length,
    developing: regencies.filter((r) => r.status === 'dalam_pengembangan' || r.status === 'dalam_pembinaan').length,
    domicileCovered: regencies.filter((r) => r.domicileDutaCount > 0).length,
    assignmentCovered: regencies.filter((r) => r.assignmentDutaCount > 0).length,
    withActivities: regencies.filter((r) => r.lklCount > 0 || r.proposalCount > 0).length,
  };
}

export function sanitizePublicStatsPayload(
  raw: {
    activeProvinces: number;
    developingProvinces?: number;
    totalProvinces: number;
    coveredRegencies?: number;
    totalRegencies?: number;
    activePersonnel: number;
    approvedActivities: number;
    activeBatches: number;
    showPublicDutaCount?: boolean;
  },
  showDutaOverride?: boolean
) {
  const allowDutaCount = showDutaOverride ?? raw.showPublicDutaCount ?? false;
  return {
    activeProvinces: raw.activeProvinces,
    developingProvinces: raw.developingProvinces ?? 0,
    totalProvinces: raw.totalProvinces,
    coveredRegencies: raw.coveredRegencies ?? 0,
    totalRegencies: raw.totalRegencies ?? 0,
    approvedActivities: raw.approvedActivities,
    activeBatches: raw.activeBatches,
    activePersonnel: allowDutaCount ? raw.activePersonnel : null,
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

export const ALLOWED_EMAIL_VARIABLES = [
  'nama',
  'email',
  'jabatan',
  'provinsi',
  'angkatan',
  'tanggal',
  'referensi',
] as const;

export function validateEmailTemplatePlaceholders(template: string): {
  valid: boolean;
  variables: string[];
  invalidVariables: string[];
  unclosedBraces: boolean;
} {
  const stripped = template.replace(/\{\{[a-z0-9_]+\}\}/gi, '');
  const unclosedBraces = stripped.includes('{{') || stripped.includes('}}');
  const matches = [...template.matchAll(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi)].map((m) => m[1].toLowerCase());
  const unique = [...new Set(matches)];
  const allowed = new Set<string>(ALLOWED_EMAIL_VARIABLES);
  const invalidVariables = unique.filter((v) => !allowed.has(v));
  return {
    valid: !unclosedBraces && invalidVariables.length === 0,
    variables: unique,
    invalidVariables,
    unclosedBraces,
  };
}

export function renderEmailTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_full, key: string) => {
    const k = key.toLowerCase();
    return vars[k] ?? '';
  });
}

export function csvSafeCell(value: unknown): string {
  let str = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

