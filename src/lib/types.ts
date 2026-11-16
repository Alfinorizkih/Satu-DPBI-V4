export type RoleCode =
  | 'super_admin'
  | 'wakil_super_admin'
  | 'penanggung_jawab'
  | 'pengurus_nasional'
  | 'sekretariat_nasional'
  | 'koordinator_wilayah'
  | 'duta'
  | 'alumni';

export type OfficialBidang =
  | 'Bidang Administrasi & Organisasi'
  | 'Bidang Program & Operasional'
  | 'Bidang Pengembangan Wilayah'
  | 'Bidang Pendidikan & Kebudayaan'
  | 'Bidang Hubungan & Kemitraan'
  | 'Bidang Media, Publikasi & Teknologi';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'edit'
  | 'delete'
  | 'approve'
  | 'reject'
  | 'review'
  | 'download'
  | 'export'
  | 'assign'
  | 'manage'
  | 'publish'
  | 'archive'
  | 'restore'
  | 'configure';

export type ModuleCode =
  | 'dashboard'
  | 'command_center'
  | 'organisasi'
  | 'personalia'
  | 'wilayah'
  | 'angkatan'
  | 'proposal'
  | 'lkl'
  | 'laporan_koordinator'
  | 'tugas'
  | 'dokumen'
  | 'pengumuman'
  | 'kalender'
  | 'perlindungan'
  | 'evaluasi'
  | 'arsip'
  | 'sistem'
  | 'pengaturan';

export type ProvinceStatus =
  | 'aktif'
  | 'dalam_pengembangan'
  | 'dalam_pembinaan'
  | 'belum_terbentuk'
  | 'tidak_aktif';

export type BatchStatus =
  | 'perencanaan'
  | 'pendaftaran'
  | 'seleksi'
  | 'pembekalan'
  | 'aktif'
  | 'evaluasi'
  | 'selesai'
  | 'diarsipkan';

export type ProfileVerificationStatus =
  | 'belum_lengkap'
  | 'menunggu_verifikasi'
  | 'terverifikasi'
  | 'perlu_perbaikan'
  | 'tidak_valid'
  | 'diarsipkan';

export type ProposalStatus =
  | 'draft'
  | 'diajukan'
  | 'pemeriksaan_administrasi'
  | 'pemeriksaan_wilayah'
  | 'menunggu_persetujuan_nasional'
  | 'perlu_revisi'
  | 'disetujui'
  | 'ditolak'
  | 'dibatalkan'
  | 'diarsipkan';

export type LklStatus =
  | 'draft'
  | 'diajukan'
  | 'menunggu_pemeriksaan'
  | 'perlu_revisi'
  | 'diterima'
  | 'ditolak'
  | 'diarsipkan';

export type TaskStatus =
  | 'belum_dimulai'
  | 'dikerjakan'
  | 'menunggu'
  | 'perlu_perhatian'
  | 'selesai'
  | 'dibatalkan';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  roleLabel: string;
  bidang: string | null;
  provinceCode: string | null;
  provinceName: string | null;
  batchId: string | null;
  personnelId: string | null;
  accountStatus: 'aktif' | 'nonaktif' | 'terkunci' | 'menunggu_persetujuan' | 'alumni_terbatas';
  alumniAccessExpiresAt: string | null;
  permissions: Record<ModuleCode, PermissionAction[]>;
  activeDelegations: DelegationRecord[];
}

export type HttpErrorCode = 400 | 401 | 403 | 404 | 419 | 422 | 429 | 500 | 502 | 503;

export interface RegencyRecord {
  code: string;
  provinceCode: string;
  name: string;
  kind: 'kabupaten' | 'kota';
  status: ProvinceStatus;
  coordinatorName: string | null;
  coachingNote: string | null;
  domicileDutaCount: number;
  assignmentDutaCount: number;
  lklCount: number;
  proposalCount: number;
}

export interface ProvinceRecord {
  code: string;
  name: string;
  island: string;
  status: ProvinceStatus;
  coordinatorId: string | null;
  coordinatorName: string | null;
  logoFileId?: string | null;
  description?: string | null;
  activeDutaCount: number;
  domicileDutaCount?: number;
  assignmentDutaCount?: number;
  alumniCount: number;
  proposalCount: number;
  lklCount: number;
  regencyCount?: number;
  activeRegencyCount?: number;
  monthlyReportSubmitted: boolean;
  finalReportSubmitted: boolean;
  coachingNote: string | null;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
  centerLat: number;
  centerLng: number;
}

export interface DelegationRecord {
  id: string;
  delegateUserId: string;
  delegateName: string;
  grantorUserId: string;
  grantorName: string;
  module: ModuleCode;
  action: PermissionAction;
  provinceCode: string | null;
  startsAt: string;
  endsAt: string;
  reason: string;
  status: 'aktif' | 'dicabut' | 'kedaluwarsa';
}

export interface PersonnelRecord {
  id: string;
  memberNumber: string;
  referenceNumber: string;
  userId: string | null;
  fullName: string;
  nickname: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  email: string;
  phone: string;
  altContact?: string;
  provinceCode: string;
  provinceName: string;
  assignmentProvinceCode?: string;
  assignmentProvinceName?: string;
  regency: string;
  regencyCode?: string;
  district: string;
  village: string;
  postalCode: string;
  fullAddress: string;
  schoolName: string;
  educationLevel: string;
  gradeClass: string;
  major: string;
  npsn: string;
  nisn: string;
  entryYear: number;
  expectedGradYear: number;
  schoolAddress: string;
  schoolRegency: string;
  schoolProvince: string;
  batchId: string;
  batchName: string;
  positionTitle: string;
  bidang: string;
  roleCode: RoleCode;
  appointedAt: string;
  termStartsAt: string;
  termEndsAt: string;
  personnelStatus: 'aktif' | 'menunggu_penetapan' | 'menyelesaikan_masa_jabatan' | 'alumni' | 'mengundurkan_diri' | 'diberhentikan';
  verificationStatus: ProfileVerificationStatus;
  verificationNote: string | null;
  culturalInterests: string;
  activityInterests: string;
  orgExperience: string;
  skills: string;
  guardianName: string;
  guardianRelation: string;
  guardianPhone: string;
  docsChecklist: {
    pasFoto: boolean;
    kartuPelajar: boolean;
    suratSekolah: boolean;
    izinWali: boolean;
    suratKesediaan: boolean;
  };
  avatarFileId?: string | null;
  completenessScore: number;
  restrictedFieldsMasked?: boolean;
}

export interface BatchRecord {
  id: string;
  batchNumber: number;
  name: string;
  openedAt: string;
  closedAt: string;
  briefingAt: string;
  termStartsAt: string;
  termEndsAt: string;
  durationMonths: number;
  status: BatchStatus;
  activePersonnelCount: number;
  proposalCount: number;
  lklCount: number;
}

export interface ProposalRecord {
  id: string;
  referenceNumber: string;
  version: number;
  title: string;
  applicantPersonnelId: string;
  applicantName: string;
  provinceCode: string;
  provinceName: string;
  batchId: string;
  batchName: string;
  bidang: string;
  category: string;
  riskLevel: 'rendah' | 'sedang' | 'tinggi';
  usesDpbiIdentity: boolean;
  externalPermitNeeded: boolean;
  assignedApproverRole: RoleCode;
  objective: string;
  targetAudience: string;
  eventDate: string;
  eventTime: string;
  location: string;
  picName: string;
  estimatedParticipants: number;
  activityMode: 'luring' | 'daring' | 'hibrida';
  pdfFileId: string | null;
  pdfFileName: string | null;
  status: ProposalStatus;
  decisionNote: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LklRecord {
  id: string;
  referenceNumber: string;
  version: number;
  activityName: string;
  proposalId: string | null;
  proposalRef: string | null;
  submitterPersonnelId: string;
  submitterName: string;
  provinceCode: string;
  provinceName: string;
  regency: string;
  district: string;
  village: string;
  venueName: string;
  venueAddress: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  category: string;
  activityMode: 'luring' | 'daring';
  platformName: string | null;
  platformLink: string | null;
  picName: string;
  participantCount: number;
  summary: string;
  outcomes: string;
  obstacles: string;
  followUp: string;
  pdfFileId: string | null;
  pdfFileName: string | null;
  photoFileIds: string[];
  status: LklStatus;
  reviewNote: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface TaskRecord {
  id: string;
  referenceNumber: string;
  title: string;
  description: string;
  priority: 'rendah' | 'sedang' | 'tinggi' | 'mendesak';
  status: TaskStatus;
  deadline: string;
  provinceCode: string | null;
  provinceName: string | null;
  batchId: string | null;
  assigneeId: string;
  assigneeName: string;
  creatorName: string;
  checklist: { id: string; text: string; done: boolean }[];
  attachmentFileId?: string | null;
  attachmentFileName?: string | null;
  isTemplate: boolean;
  recurrence: 'tidak' | 'bulanan' | 'mingguan';
  commentCount: number;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  documentNumber: string;
  title: string;
  category:
    | 'SK'
    | 'Surat Tugas'
    | 'Rekomendasi'
    | 'Sertifikat'
    | 'Proposal'
    | 'LKL'
    | 'Laporan'
    | 'SOP'
    | 'Pedoman'
    | 'Materi Pembekalan'
    | 'Formulir'
    | 'Arsip';
  ownerName: string;
  issuerName: string;
  issuedDate: string;
  status: 'berlaku' | 'revisi' | 'diarsipkan';
  version: string;
  accessLevel: 'internal_semua' | 'koordinator_ke_atas' | 'nasional_saja' | 'pribadi';
  fileId: string | null;
  fileName: string | null;
  fileSizeBytes: number;
  notes: string;
  expiresAt: string | null;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  title: string;
  message: string;
  category: string;
  targetPath: string;
  isRead: boolean;
  createdAt: string;
}

export interface CmsSectionContent {
  key: string;
  title: string;
  body: string;
  updatedAt?: string;
}

export interface HelpArticleRecord {
  id: string;
  slug: string;
  category: string;
  roleTarget: string;
  title: string;
  summary: string;
  content: string;
  sortOrder: number;
  isPublished: boolean;
  updatedAt: string;
}
