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
  | 'persetujuan'
  | 'email'
  | 'program'
  | 'persuratan'
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
  slaDueAt?: string | null;
  escalatedTo?: string | null;
  escalatedAt?: string | null;
  cancelledReason?: string | null;
  programId?: string | null;
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
  programId?: string | null;
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
  proposalId?: string | null;
  lklId?: string | null;
  eventId?: string | null;
  programId?: string | null;
  dependsOnTaskId?: string | null;
  category?: string | null;
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
    | 'Surat Masuk'
    | 'Surat Keluar'
    | 'Rekomendasi'
    | 'Sertifikat'
    | 'Proposal'
    | 'LKL'
    | 'Laporan'
    | 'SOP'
    | 'Pedoman'
    | 'Pedoman Program'
    | 'Juknis'
    | 'AD/ART'
    | 'Identitas Visual'
    | 'Logo'
    | 'Template Resmi'
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
  parentDocumentId?: string | null;
  replacedById?: string | null;
  programId?: string | null;
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

export type ToastVariant = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ApprovalQueueItem {
  id: string;
  itemType: 'proposal' | 'lkl' | 'coordinator_report' | 'account_request' | 'handover';
  referenceNumber: string;
  title: string;
  applicantName: string;
  provinceCode: string | null;
  provinceName: string | null;
  status: string;
  priority: 'rendah' | 'sedang' | 'tinggi';
  assignedReviewerName: string | null;
  escalatedTo: string | null;
  submittedAt: string;
  slaDueAt: string | null;
  isOverdue: boolean;
  targetPath: string;
  summary: string;
}

export interface EmailTemplateRecord {
  id: string;
  code: string;
  name: string;
  category: string;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  version?: number;
  isActive: boolean;
  updatedAt: string;
}

export interface EmailCampaignRecord {
  id: string;
  title: string;
  templateId: string | null;
  subject: string;
  bodyText: string;
  audienceFilter: {
    mode: 'single' | 'bulk';
    allActive?: boolean;
    roles?: string[];
    bidang?: string;
    provinceCode?: string;
    batchId?: string;
    manualEmails?: string[];
  };
  deliveryMode: 'smtp_live' | 'sandbox_outbox';
  status: 'draft' | 'terjadwal' | 'terkirim' | 'sebagian_gagal' | 'dibatalkan';
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdByName: string;
  createdAt: string;
}

export interface EmailLogRecord {
  id: string;
  campaignId: string;
  recipientEmail: string;
  recipientName: string;
  subjectRendered: string;
  status: 'terkirim' | 'terantre_outbox' | 'gagal' | 'dibatalkan';
  deliveryMode: 'smtp_live' | 'sandbox_outbox';
  deliveryChannel?: string;
  errorMessage: string | null;
  providerMessageId: string | null;
  sentAt: string | null;
  createdAt: string;
}

export type InvitationStatus =
  | 'draft'
  | 'menunggu_persetujuan'
  | 'siap_diundang'
  | 'undangan_terkirim'
  | 'aktivasi_dibuka'
  | 'aktif'
  | 'kedaluwarsa'
  | 'dibatalkan'
  | 'ditolak';

export interface InvitationRecord {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  provinceCode: string | null;
  batchId: string | null;
  personnelId: string | null;
  status: InvitationStatus;
  resendCount: number;
  lastSentAt: string | null;
  openedAt: string | null;
  expiresAt: string;
  usedAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  createdBy: string;
  createdAt: string;
}

export interface ImportBatchRecord {
  id: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  skippedCount: number;
  errorCount: number;
  status: 'selesai' | 'sebagian' | 'dibatalkan_rollback';
  importedByName: string;
  notes: string;
  createdAt: string;
  rolledBackAt?: string | null;
}

export interface OrgPositionHistoryRecord {
  id: string;
  positionId: string;
  positionTitle: string;
  personnelId: string | null;
  holderName: string;
  bidang: string;
  provinceCode: string | null;
  skNumber: string | null;
  startedAt: string;
  endedAt: string | null;
  changeReason: string;
  actorName: string;
  createdAt: string;
}

export interface FlagshipProgramRecord {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  objectives: string;
  bidang: string;
  leadName: string;
  status: 'aktif' | 'perencanaan' | 'evaluasi' | 'diarsipkan';
  targetProvinces: number;
  targetParticipants: number;
  periodLabel: string;
  isPublic: boolean;
  metrics?: {
    proposalsCount: number;
    approvedProposalsCount: number;
    lklCount: number;
    approvedLklCount: number;
    participantsTotal: number;
    provincesCovered: number;
    tasksCount: number;
    evaluationsCount: number;
  };
  updatedAt: string;
}

export interface ApprovalHistoryRecord {
  id: string;
  entityType: 'proposal' | 'lkl' | 'coordinator_report' | 'account_request' | 'handover';
  entityId: string;
  action: string;
  fromStatus: string | null;
  toStatus: string;
  stageLabel: string;
  actorUserId: string;
  actorName: string;
  actorRole: string;
  note: string;
  diffJson?: string | null;
  createdAt: string;
}

export interface CorrespondenceRecord {
  id: string;
  referenceNumber: string;
  direction: 'masuk' | 'keluar';
  letterType: string;
  subject: string;
  senderName: string;
  recipientName: string;
  letterDate: string;
  receivedDate: string | null;
  provinceCode: string | null;
  programId: string | null;
  urgency: 'biasa' | 'penting' | 'segera' | 'sangat_segera';
  status: 'baru' | 'terkirim' | 'didisposisikan' | 'diteruskan' | 'ditindaklanjuti' | 'selesai' | 'diarsipkan';
  fileId: string | null;
  fileName: string | null;
  summary: string;
  createdByName: string;
  createdAt: string;
}

export interface CorrespondenceDispositionRecord {
  id: string;
  correspondenceId: string;
  fromUserName: string;
  toUserId: string | null;
  toUserName: string;
  instruction: string;
  dueDate: string | null;
  status: 'belum_dibaca' | 'dibaca' | 'diproses' | 'ditindaklanjuti' | 'selesai';
  responseNote: string | null;
  createdAt: string;
  completedAt: string | null;
}

export type DisplayScale = 'ringkas' | 'nyaman' | 'besar';

export interface NotificationPreferenceSettings {
  emailProposal: boolean;
  emailTugas: boolean;
  pengingatSesi: boolean;
}

export interface UserPreferences {
  startPage: string;
  displayScale: DisplayScale;
  favoritePaths: string[];
  notificationPrefs: NotificationPreferenceSettings;
  tourCompletedRoles: string[];
  updatedAt?: string;
}

export type SupportTicketCategory =
  | 'bug_fungsional'
  | 'kesalahan_akses'
  | 'data_tidak_sesuai'
  | 'kendala_unggah'
  | 'kinerja_lambat'
  | 'saran_perbaikan';

export type SupportTicketPriority = 'rendah' | 'sedang' | 'tinggi' | 'kritis';
export type SupportTicketStatus = 'baru' | 'ditinjau' | 'diproses' | 'selesai' | 'ditolak';

export interface SupportTicketRecord {
  id: string;
  ticketNumber: string;
  userId: string;
  userName: string;
  userRole: RoleCode | string;
  provinceCode: string | null;
  provinceName?: string | null;
  pagePath: string;
  moduleName: string;
  category: SupportTicketCategory;
  title: string;
  description: string;
  screenshotFileId: string | null;
  screenshotFileName: string | null;
  errorRefCode: string | null;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  assignedToId: string | null;
  assignedToName: string | null;
  adminNote: string;
  resolutionNote: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface ProcessTrackerStep {
  key: string;
  label: string;
  description: string;
  state: 'selesai' | 'aktif' | 'menunggu' | 'revisi' | 'ditolak';
  ownerRoleLabel?: string;
}

export interface ProcessTrackerPayload {
  entityType: 'proposal' | 'lkl' | 'persuratan';
  entityId: string;
  referenceNumber: string;
  title: string;
  status: string;
  currentStageLabel: string;
  previousStageLabel: string | null;
  currentReviewerLabel: string;
  actionRequired: string;
  actionOwner: string;
  reviewerNote: string | null;
  slaDueAt: string | null;
  nextStageLabel: string | null;
  steps: ProcessTrackerStep[];
  history: {
    id: string;
    action: string;
    fromStatus: string | null;
    toStatus: string;
    stageLabel: string;
    actorName: string;
    actorRole: string;
    note: string;
    createdAt: string;
  }[];
}

export interface PersonalWorkspacePayload {
  identity: {
    fullName: string;
    role: RoleCode;
    roleLabel: string;
    bidang: string | null;
    provinceCode: string | null;
    provinceName: string | null;
    positionTitle: string;
    memberNumber: string | null;
    batchName: string | null;
  };
  tasksToDo: {
    id: string;
    referenceNumber: string;
    title: string;
    priority: string;
    status: string;
    deadline: string;
  }[];
  submissionsNeedingAction: {
    id: string;
    type: 'proposal' | 'lkl';
    referenceNumber: string;
    title: string;
    status: string;
    updatedAt: string;
    targetPath: string;
  }[];
  pendingApprovals: {
    id: string;
    itemType: string;
    referenceNumber: string;
    title: string;
    applicantName: string;
    provinceName: string | null;
    status: string;
    slaDueAt: string | null;
    isOverdue: boolean;
    targetPath: string;
  }[];
  revisionsRequired: {
    id: string;
    type: 'proposal' | 'lkl';
    referenceNumber: string;
    title: string;
    note: string;
    updatedAt: string;
    targetPath: string;
  }[];
  nearestDeadlines: {
    id: string;
    kind: string;
    title: string;
    dueAt: string;
    targetPath: string;
  }[];
  upcomingEvents: {
    id: string;
    title: string;
    category: string;
    startAt: string;
    location: string;
  }[];
  importantNotifications: {
    id: string;
    title: string;
    message: string;
    category: string;
    targetPath: string;
    isRead: boolean;
    createdAt: string;
  }[];
  recentActivity: {
    id: string;
    action: string;
    targetType: string;
    targetId: string;
    contextNote: string;
    createdAt: string;
  }[];
  quickActions: {
    label: string;
    description: string;
    path: string;
    primary?: boolean;
  }[];
}



