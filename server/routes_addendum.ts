import crypto from 'node:crypto';
import type { Express, Response } from 'express';
import { getDb, nextReferenceNumber } from './db';
import {
  type AuthenticatedRequest,
  idempotencyGuard,
  requireAuth,
  requirePermission,
  writeActivityTimeline,
  writeAuditLog,
} from './security';
import { hasPermission, ROLE_LABELS } from '../src/lib/rbac';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';
import type {
  PersonalWorkspacePayload,
  ProcessTrackerPayload,
  ProcessTrackerStep,
  RoleCode,
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketStatus,
  UserPreferences,
} from '../src/lib/types';

const VALID_SCALES = new Set(['ringkas', 'nyaman', 'besar']);
const VALID_START_PAGES = new Set([
  '/beranda',
  '/dashboard',
  '/aktivitas-saya',
  '/tugas-saya',
  '/proposal',
  '/laporan-kegiatan',
  '/persetujuan',
  '/persuratan',
]);

function parsePreferencesRow(row: Record<string, unknown> | undefined): UserPreferences {
  if (!row) {
    return {
      startPage: '/beranda',
      displayScale: 'nyaman',
      favoritePaths: [],
      notificationPrefs: { emailProposal: true, emailTugas: true, pengingatSesi: true },
      tourCompletedRoles: [],
    };
  }
  let favs: string[] = [];
  let notif = { emailProposal: true, emailTugas: true, pengingatSesi: true };
  let tours: string[] = [];
  try {
    const parsedFavs = JSON.parse(String(row.favorite_paths_json || '[]'));
    if (Array.isArray(parsedFavs)) favs = parsedFavs.filter((x): x is string => typeof x === 'string' && x.startsWith('/'));
  } catch {
    favs = [];
  }
  try {
    const parsedNotif = JSON.parse(String(row.notification_prefs_json || '{}'));
    notif = {
      emailProposal: parsedNotif.emailProposal !== false,
      emailTugas: parsedNotif.emailTugas !== false,
      pengingatSesi: parsedNotif.pengingatSesi !== false,
    };
  } catch {
    // default
  }
  try {
    const parsedTours = JSON.parse(String(row.tour_completed_roles_json || '[]'));
    if (Array.isArray(parsedTours)) tours = parsedTours.filter((x): x is string => typeof x === 'string');
  } catch {
    tours = [];
  }
  const rawScale = String(row.display_scale || 'nyaman');
  const rawStart = String(row.start_page || '/beranda');
  return {
    startPage: VALID_START_PAGES.has(rawStart) ? rawStart : '/beranda',
    displayScale: VALID_SCALES.has(rawScale) ? (rawScale as UserPreferences['displayScale']) : 'nyaman',
    favoritePaths: favs.slice(0, 8),
    notificationPrefs: notif,
    tourCompletedRoles: tours,
    updatedAt: row.updated_at ? String(row.updated_at) : undefined,
  };
}

export function registerAddendumRoutes(app: Express): void {
  // ==================== 1. PERSONAL WORKSPACE (/beranda) ====================
  app.get('/api/beranda', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const personnelId = user.personnelId || user.id;

    // Identity + Personnel position details
    const pers = user.personnelId
      ? (db
          .prepare(
            `SELECT p.member_number, p.position_title, p.province_code, p.assignment_province_code, b.name AS batch_name
             FROM personnel p LEFT JOIN batches b ON b.id = p.batch_id WHERE p.id = ?`
          )
          .get(user.personnelId) as Record<string, unknown> | undefined)
      : undefined;

    const effectiveProvCode = pers?.assignment_province_code
      ? String(pers.assignment_province_code)
      : user.provinceCode;
    const effectiveProvName = effectiveProvCode
      ? PROVINCE_BY_CODE.get(effectiveProvCode)?.name ?? effectiveProvCode
      : 'Nasional';

    // Tasks to do (assigned to user, or provincial tasks for Korwil if assigned)
    const tasksToDoRows = db
      .prepare(
        `SELECT id, reference_number, title, priority, status, deadline
         FROM tasks
         WHERE soft_deleted_at IS NULL AND status != 'selesai' AND status != 'dibatalkan'
           AND (assignee_id = ? OR creator_id = ?)
         ORDER BY deadline ASC LIMIT 8`
      )
      .all(user.id, user.id) as Record<string, unknown>[];

    // User's own submissions needing action (draft / perlu_revisi)
    const propSubRows = hasPermission(user.permissions, 'proposal', 'view')
      ? (db
          .prepare(
            `SELECT id, reference_number, title, status, updated_at, decision_note
             FROM proposals
             WHERE soft_deleted_at IS NULL
               AND (applicant_personnel_id = ? OR applicant_name = ?)
               AND status IN ('draft', 'perlu_revisi', 'diajukan', 'menunggu_persetujuan_nasional')
             ORDER BY updated_at DESC LIMIT 6`
          )
          .all(personnelId, user.fullName) as Record<string, unknown>[])
      : [];

    const lklSubRows = hasPermission(user.permissions, 'lkl', 'view')
      ? (db
          .prepare(
            `SELECT id, reference_number, activity_name, status, created_at, review_note
             FROM lkl_reports
             WHERE soft_deleted_at IS NULL
               AND (submitter_personnel_id = ? OR submitter_name = ?)
               AND status IN ('draft', 'perlu_revisi', 'menunggu_pemeriksaan')
             ORDER BY created_at DESC LIMIT 6`
          )
          .all(personnelId, user.fullName) as Record<string, unknown>[])
      : [];

    // Revisions required explicitly
    const revisionsRequired: PersonalWorkspacePayload['revisionsRequired'] = [];
    for (const p of propSubRows) {
      if (String(p.status) === 'perlu_revisi') {
        revisionsRequired.push({
          id: String(p.id),
          type: 'proposal',
          referenceNumber: String(p.reference_number),
          title: String(p.title),
          note: String(p.decision_note || 'Periksa catatan peninjau untuk detail perbaikan.'),
          updatedAt: String(p.updated_at),
          targetPath: `/proposal/${String(p.id)}`,
        });
      }
    }
    for (const l of lklSubRows) {
      if (String(l.status) === 'perlu_revisi') {
        revisionsRequired.push({
          id: String(l.id),
          type: 'lkl',
          referenceNumber: String(l.reference_number),
          title: String(l.activity_name),
          note: String(l.review_note || 'Periksa catatan pemeriksaan LKL.'),
          updatedAt: String(l.created_at),
          targetPath: `/laporan-kegiatan/${String(l.id)}`,
        });
      }
    }

    // Pending approvals for reviewers only (role-scoped, never shown to Duta/Alumni)
    const pendingApprovals: PersonalWorkspacePayload['pendingApprovals'] = [];
    const nowMs = Date.now();
    if (hasPermission(user.permissions, 'persetujuan', 'review') && user.role !== 'duta' && user.role !== 'alumni') {
      const isKorwil = user.role === 'koordinator_wilayah';
      const propPendingSql = isKorwil && user.provinceCode
        ? `SELECT id, reference_number, title, applicant_name, province_code, status, sla_due_at, created_at
           FROM proposals WHERE soft_deleted_at IS NULL AND status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah') AND province_code = ? ORDER BY created_at ASC LIMIT 6`
        : `SELECT id, reference_number, title, applicant_name, province_code, status, sla_due_at, created_at
           FROM proposals WHERE soft_deleted_at IS NULL AND status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional') ORDER BY created_at ASC LIMIT 6`;
      const pendingProps = db
        .prepare(propPendingSql)
        .all(...(isKorwil && user.provinceCode ? [user.provinceCode] : [])) as Record<string, unknown>[];

      for (const p of pendingProps) {
        if (String(p.applicant_name) === user.fullName) continue;
        const sla = p.sla_due_at ? String(p.sla_due_at) : null;
        pendingApprovals.push({
          id: String(p.id),
          itemType: 'proposal',
          referenceNumber: String(p.reference_number),
          title: String(p.title),
          applicantName: String(p.applicant_name),
          provinceName: p.province_code ? PROVINCE_BY_CODE.get(String(p.province_code))?.name ?? null : null,
          status: String(p.status),
          slaDueAt: sla,
          isOverdue: Boolean(sla && Date.parse(sla) < nowMs),
          targetPath: `/proposal/${String(p.id)}`,
        });
      }

      const lklPendingSql = isKorwil && user.provinceCode
        ? `SELECT id, reference_number, activity_name, submitter_name, province_code, status, created_at
           FROM lkl_reports WHERE soft_deleted_at IS NULL AND status = 'menunggu_pemeriksaan' AND province_code = ? ORDER BY created_at ASC LIMIT 4`
        : `SELECT id, reference_number, activity_name, submitter_name, province_code, status, created_at
           FROM lkl_reports WHERE soft_deleted_at IS NULL AND status = 'menunggu_pemeriksaan' ORDER BY created_at ASC LIMIT 4`;
      const pendingLkls = db
        .prepare(lklPendingSql)
        .all(...(isKorwil && user.provinceCode ? [user.provinceCode] : [])) as Record<string, unknown>[];
      for (const l of pendingLkls) {
        if (String(l.submitter_name) === user.fullName) continue;
        pendingApprovals.push({
          id: String(l.id),
          itemType: 'lkl',
          referenceNumber: String(l.reference_number),
          title: String(l.activity_name),
          applicantName: String(l.submitter_name),
          provinceName: l.province_code ? PROVINCE_BY_CODE.get(String(l.province_code))?.name ?? null : null,
          status: String(l.status),
          slaDueAt: null,
          isOverdue: false,
          targetPath: `/laporan-kegiatan/${String(l.id)}`,
        });
      }
    }

    // Upcoming events (province scoped for Korwil/Duta if province_code exists)
    const upcomingEventsRows = db
      .prepare('SELECT id, title, category, start_at, location FROM calendar_events ORDER BY start_at ASC LIMIT 5')
      .all() as Record<string, unknown>[];

    // Nearest deadlines combined from tasks + SLA approvals
    const nearestDeadlines: PersonalWorkspacePayload['nearestDeadlines'] = [];
    for (const t of tasksToDoRows.slice(0, 4)) {
      nearestDeadlines.push({
        id: `t-${String(t.id)}`,
        kind: 'Tugas',
        title: String(t.title),
        dueAt: String(t.deadline),
        targetPath: `/tugas/${String(t.id)}`,
      });
    }
    for (const a of pendingApprovals.filter((x) => x.slaDueAt).slice(0, 3)) {
      nearestDeadlines.push({
        id: `a-${a.id}`,
        kind: 'SLA Pemeriksaan',
        title: `${a.referenceNumber} — ${a.title}`,
        dueAt: a.slaDueAt!,
        targetPath: a.targetPath,
      });
    }
    nearestDeadlines.sort((a, b) => Date.parse(a.dueAt) - Date.parse(b.dueAt));

    // Important notifications
    const notifRows = db
      .prepare('SELECT id, title, message, category, target_path, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY is_read ASC, created_at DESC LIMIT 6')
      .all(user.id) as Record<string, unknown>[];

    // Recent user activity
    const auditRows = db
      .prepare('SELECT id, action, target_type, target_id, context_note, created_at FROM audit_logs WHERE actor_user_id = ? ORDER BY created_at DESC LIMIT 6')
      .all(user.id) as Record<string, unknown>[];

    // Role-tailored primary quick actions (only operationally relevant shortcuts)
    const quickActions: PersonalWorkspacePayload['quickActions'] = [];
    if (user.role === 'duta') {
      quickActions.push(
        { label: 'Ajukan Proposal Baru', description: 'Panduan bertahap pengajuan kegiatan', path: '/proposal/baru', primary: true },
        { label: 'Kirim LKL Kegiatan', description: 'Laporkan dokumentasi & capaian', path: '/laporan-kegiatan/baru' },
        { label: 'Tugas Saya', description: 'Periksa checklist dan tenggat', path: '/tugas-saya' },
        { label: 'Laporkan Kendala', description: 'Hubungi tim dukungan portal', path: '/kendala' }
      );
    } else if (user.role === 'koordinator_wilayah') {
      quickActions.push(
        { label: 'Pusat Persetujuan Wilayah', description: 'Tinjau proposal & LKL provinsi', path: '/persetujuan', primary: true },
        { label: 'Laporan Bulanan Wilayah', description: 'Kirim rekap pembinaan daerah', path: '/laporan-koordinator' },
        { label: 'Personalia Provinsi', description: 'Verifikasi profil Duta daerah', path: '/personalia' },
        { label: 'Tugaskan Duta Wilayah', description: 'Koordinasi agenda & tugas', path: '/tugas' }
      );
    } else if (user.role === 'sekretariat_nasional') {
      quickActions.push(
        { label: 'Persuratan & Disposisi', description: 'Kelola surat masuk/keluar resmi', path: '/persuratan', primary: true },
        { label: 'Pusat Dokumen & SK', description: 'Terbitkan pedoman & SK resmi', path: '/dokumen' },
        { label: 'Pusat Kendala Pengguna', description: 'Tangani tiket bantuan operasional', path: '/kendala' },
        { label: 'Pusat Email & Undangan', description: 'Kirim pengumuman & aktivasi akun', path: '/email' }
      );
    } else if (user.role === 'alumni') {
      quickActions.push(
        { label: 'Direktori & Akses Alumni', description: 'Status masa akses alumni', path: '/alumni', primary: true },
        { label: 'Arsip & Dokumen', description: 'Unduh SK & sertifikat resmi', path: '/arsip' },
        { label: 'Program Unggulan', description: 'Ikuti perkembangan program', path: '/program' },
        { label: 'Pusat Bantuan', description: 'Panduan & kontak sekretariat', path: '/bantuan' }
      );
    } else if (user.role === 'super_admin' || user.role === 'wakil_super_admin') {
      quickActions.push(
        { label: 'Pusat Persetujuan Nasional', description: 'Antrean keputusan & SLA', path: '/persetujuan', primary: true },
        { label: 'Status & Kesehatan Sistem', description: 'Audit DB, queue email & error', path: '/status-sistem' },
        { label: 'Pusat Kendala & Tiket', description: 'Triage laporan pengguna', path: '/kendala' },
        { label: 'Kelola Pengguna & RBAC', description: 'Akun aktif & delegasi wewenang', path: '/pengaturan/pengguna' }
      );
    } else {
      quickActions.push(
        { label: 'Pusat Persetujuan Nasional', description: 'Tinjau proposal lintas bidang', path: '/persetujuan', primary: true },
        { label: 'Program Unggulan', description: 'Pantau realisasi & target', path: '/program' },
        { label: 'Evaluasi Kinerja', description: 'Tinjau capaian Duta & wilayah', path: '/evaluasi' },
        { label: 'Pusat Persuratan', description: 'Disposisi & surat resmi', path: '/persuratan' }
      );
    }

    const payload: PersonalWorkspacePayload = {
      identity: {
        fullName: user.fullName,
        role: user.role,
        roleLabel: user.roleLabel || ROLE_LABELS[user.role],
        bidang: user.bidang,
        provinceCode: effectiveProvCode,
        provinceName: effectiveProvName,
        positionTitle: pers?.position_title ? String(pers.position_title) : (ROLE_LABELS[user.role] ?? user.role),
        memberNumber: pers?.member_number ? String(pers.member_number) : null,
        batchName: pers?.batch_name ? String(pers.batch_name) : null,
      },
      tasksToDo: tasksToDoRows.map((t) => ({
        id: String(t.id),
        referenceNumber: String(t.reference_number),
        title: String(t.title),
        priority: String(t.priority),
        status: String(t.status),
        deadline: String(t.deadline),
      })),
      submissionsNeedingAction: [
        ...propSubRows.map((p) => ({
          id: String(p.id),
          type: 'proposal' as const,
          referenceNumber: String(p.reference_number),
          title: String(p.title),
          status: String(p.status),
          updatedAt: String(p.updated_at),
          targetPath: `/proposal/${String(p.id)}`,
        })),
        ...lklSubRows.map((l) => ({
          id: String(l.id),
          type: 'lkl' as const,
          referenceNumber: String(l.reference_number),
          title: String(l.activity_name),
          status: String(l.status),
          updatedAt: String(l.created_at),
          targetPath: `/laporan-kegiatan/${String(l.id)}`,
        })),
      ].slice(0, 8),
      pendingApprovals,
      revisionsRequired,
      nearestDeadlines: nearestDeadlines.slice(0, 6),
      upcomingEvents: upcomingEventsRows.map((e) => ({
        id: String(e.id),
        title: String(e.title),
        category: String(e.category),
        startAt: String(e.start_at),
        location: String(e.location),
      })),
      importantNotifications: notifRows.map((n) => ({
        id: String(n.id),
        title: String(n.title),
        message: String(n.message),
        category: String(n.category),
        targetPath: String(n.target_path),
        isRead: Boolean(n.is_read),
        createdAt: String(n.created_at),
      })),
      recentActivity: auditRows.map((a) => ({
        id: String(a.id),
        action: String(a.action),
        targetType: String(a.target_type),
        targetId: String(a.target_id),
        contextNote: String(a.context_note || ''),
        createdAt: String(a.created_at),
      })),
      quickActions,
    };

    res.json(payload);
  });

  // ==================== 2. USER PREFERENCES & ACCESSIBILITY ====================
  app.get('/api/auth/preferences', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .get(req.authUser!.id) as Record<string, unknown> | undefined;
    res.json({ preferences: parsePreferencesRow(row) });
  });

  app.patch('/api/auth/preferences', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const userId = req.authUser!.id;
    const currentRow = db
      .prepare('SELECT * FROM user_preferences WHERE user_id = ?')
      .get(userId) as Record<string, unknown> | undefined;
    const current = parsePreferencesRow(currentRow);
    const b = req.body ?? {};

    const nextStartPage =
      typeof b.startPage === 'string' && VALID_START_PAGES.has(b.startPage) ? b.startPage : current.startPage;
    const nextScale =
      typeof b.displayScale === 'string' && VALID_SCALES.has(b.displayScale)
        ? (b.displayScale as UserPreferences['displayScale'])
        : current.displayScale;
    const nextFavorites = Array.isArray(b.favoritePaths)
      ? [...new Set(b.favoritePaths.filter((p: unknown): p is string => typeof p === 'string' && p.startsWith('/')))].slice(0, 8)
      : current.favoritePaths;
    const nextNotif = b.notificationPrefs && typeof b.notificationPrefs === 'object'
      ? {
          emailProposal: b.notificationPrefs.emailProposal !== false,
          emailTugas: b.notificationPrefs.emailTugas !== false,
          pengingatSesi: b.notificationPrefs.pengingatSesi !== false,
        }
      : current.notificationPrefs;
    const nextTours = Array.isArray(b.tourCompletedRoles)
      ? [...new Set(b.tourCompletedRoles.filter((r: unknown): r is string => typeof r === 'string'))].slice(0, 12)
      : current.tourCompletedRoles;

    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO user_preferences (
        user_id, start_page, display_scale, favorite_paths_json, notification_prefs_json, tour_completed_roles_json, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        start_page = excluded.start_page,
        display_scale = excluded.display_scale,
        favorite_paths_json = excluded.favorite_paths_json,
        notification_prefs_json = excluded.notification_prefs_json,
        tour_completed_roles_json = excluded.tour_completed_roles_json,
        updated_at = excluded.updated_at`
    ).run(
      userId,
      nextStartPage,
      nextScale,
      JSON.stringify(nextFavorites),
      JSON.stringify(nextNotif),
      JSON.stringify(nextTours),
      now
    );

    const updated = {
      startPage: nextStartPage,
      displayScale: nextScale,
      favoritePaths: nextFavorites,
      notificationPrefs: nextNotif,
      tourCompletedRoles: nextTours,
      updatedAt: now,
    };
    res.json({ ok: true, preferences: updated });
  });

  // ==================== 3. PROCESS TRACKER (RICH SUBMISSION TIMELINE) ====================
  app.get('/api/process-tracker/:entityType/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const entityType = String(req.params.entityType);
    const id = String(req.params.id);
    if (!['proposal', 'lkl', 'persuratan'].includes(entityType)) {
      res.status(400).json({ error: 'Jenis pengajuan tidak valid untuk pelacak proses.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;

    if (entityType === 'proposal') {
      if (!hasPermission(user.permissions, 'proposal', 'view')) {
        res.status(403).json({ error: 'Tidak memiliki izin melihat proposal.' });
        return;
      }
      const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (!prop) {
        res.status(404).json({ error: 'Proposal tidak ditemukan.' });
        return;
      }
      if (user.role === 'duta' && prop.applicant_personnel_id !== user.personnelId && prop.applicant_personnel_id !== user.id) {
        res.status(403).json({ error: 'Proposal ini bukan milik akun Anda.' });
        return;
      }
      if (user.role === 'koordinator_wilayah' && user.provinceCode !== prop.province_code) {
        res.status(403).json({ error: 'Proposal berada di luar wilayah provinsi Anda.' });
        return;
      }

      const historyRows = db
        .prepare('SELECT * FROM approval_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC')
        .all('proposal', id) as Record<string, unknown>[];

      const status = String(prop.status);
      const approverRole = String(prop.assigned_approver_role || 'koordinator_wilayah') as RoleCode;
      const approverLabel = ROLE_LABELS[approverRole] ?? approverRole.replace(/_/g, ' ');
      const lastHist = historyRows.length > 0 ? historyRows[historyRows.length - 1] : null;
      const prevHist = historyRows.length > 1 ? historyRows[historyRows.length - 2] : null;

      let currentStageLabel = 'Pengajuan Awal';
      let actionRequired = 'Lengkapi formulir proposal dan kirimkan untuk diperiksa.';
      let actionOwner = String(prop.applicant_name);
      let nextStageLabel: string | null = 'Pemeriksaan & Persetujuan';

      if (status === 'draft') {
        currentStageLabel = 'Draft (Belum Diajukan)';
        actionRequired = 'Lengkapi deskripsi, jadwal, dan dokumen PDF lalu klik "Kirim Pengajuan".';
        actionOwner = String(prop.applicant_name);
        nextStageLabel = `Pemeriksaan oleh ${approverLabel}`;
      } else if (status === 'diajukan' || status === 'pemeriksaan_administrasi' || status === 'pemeriksaan_wilayah') {
        currentStageLabel = 'Pemeriksaan Administrasi & Wilayah';
        actionRequired = 'Pemeriksa meninjau kelengkapan PDF, tujuan, risiko, dan kesiapan wilayah.';
        actionOwner = approverLabel;
        nextStageLabel = approverRole === 'pengurus_nasional' ? 'Persetujuan Pengurus Nasional' : 'Keputusan Final & Pembuatan Agenda';
      } else if (status === 'menunggu_persetujuan_nasional') {
        currentStageLabel = 'Menunggu Persetujuan Pengurus Nasional';
        actionRequired = 'Pengurus Nasional bidang terkait memeriksa kelayakan dan memberikan keputusan.';
        actionOwner = 'Pengurus Nasional / Pimpinan';
        nextStageLabel = 'Keputusan Final & Pembuatan Agenda Kerja';
      } else if (status === 'perlu_revisi') {
        currentStageLabel = 'Dikembalikan untuk Revisi';
        actionRequired = 'Pengusul wajib memperbaiki proposal atau mengunggah PDF revisi sesuai catatan pemeriksa.';
        actionOwner = String(prop.applicant_name);
        nextStageLabel = `Pemeriksaan Ulang oleh ${approverLabel}`;
      } else if (status === 'disetujui') {
        currentStageLabel = 'Disetujui & Masuk Kalender Kegiatan';
        actionRequired = 'Laksanakan kegiatan sesuai jadwal dan kirimkan LKL setelah kegiatan selesai.';
        actionOwner = String(prop.applicant_name);
        nextStageLabel = 'Pelaporan Kegiatan Lapangan (LKL)';
      } else if (status === 'ditolak' || status === 'dibatalkan') {
        currentStageLabel = status === 'ditolak' ? 'Ditolak (Final)' : 'Dibatalkan';
        actionRequired = 'Proses pengajuan dihentikan. Tinjau catatan keputusan bila perlu menyusun pengajuan baru.';
        actionOwner = 'Selesai';
        nextStageLabel = null;
      }

      const steps: ProcessTrackerStep[] = [
        {
          key: 'draft_submit',
          label: '1. Penyusunan & Pengajuan',
          description: 'Pengisian rincian kegiatan dan unggah dokumen PDF proposal.',
          state: status === 'draft' ? 'aktif' : 'selesai',
          ownerRoleLabel: 'Pengusul',
        },
        {
          key: 'review_stage',
          label: '2. Pemeriksaan Wilayah / Admin',
          description: 'Verifikasi kelayakan jadwal, peserta, dan kesiapan daerah.',
          state:
            status === 'draft'
              ? 'menunggu'
              : status === 'perlu_revisi'
              ? 'revisi'
              : ['diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah'].includes(status)
              ? 'aktif'
              : 'selesai',
          ownerRoleLabel: 'Koordinator Wilayah / Sekretariat',
        },
        {
          key: 'national_approval',
          label: '3. Persetujuan Akhir',
          description: 'Penetapan keputusan resmi oleh peninjau berwenang.',
          state:
            ['draft', 'diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'perlu_revisi'].includes(status)
              ? 'menunggu'
              : status === 'menunggu_persetujuan_nasional'
              ? 'aktif'
              : status === 'ditolak' || status === 'dibatalkan'
              ? 'ditolak'
              : 'selesai',
          ownerRoleLabel: approverLabel,
        },
        {
          key: 'execution_lkl',
          label: '4. Pelaksanaan & LKL',
          description: 'Agenda otomatis di kalender, checklist tugas, dan pengiriman LKL.',
          state: status === 'disetujui' ? 'aktif' : status === 'ditolak' || status === 'dibatalkan' ? 'ditolak' : 'menunggu',
          ownerRoleLabel: 'Pengusul',
        },
      ];

      const tracker: ProcessTrackerPayload = {
        entityType: 'proposal',
        entityId: id,
        referenceNumber: String(prop.reference_number),
        title: String(prop.title),
        status,
        currentStageLabel,
        previousStageLabel: prevHist
          ? String(prevHist.stage_label || prevHist.to_status)
          : lastHist?.from_status
          ? String(lastHist.from_status).replace(/_/g, ' ')
          : null,
        currentReviewerLabel: prop.decided_by ? String(prop.decided_by) : approverLabel,
        actionRequired,
        actionOwner,
        reviewerNote: prop.decision_note ? String(prop.decision_note) : lastHist?.note ? String(lastHist.note) : null,
        slaDueAt: prop.sla_due_at ? String(prop.sla_due_at) : null,
        nextStageLabel,
        steps,
        history: historyRows.map((h) => ({
          id: String(h.id),
          action: String(h.action),
          fromStatus: h.from_status ? String(h.from_status) : null,
          toStatus: String(h.to_status),
          stageLabel: String(h.stage_label || h.to_status),
          actorName: String(h.actor_name),
          actorRole: ROLE_LABELS[h.actor_role as RoleCode] ?? String(h.actor_role),
          note: String(h.note || ''),
          createdAt: String(h.created_at),
        })),
      };
      res.json(tracker);
      return;
    }

    if (entityType === 'lkl') {
      if (!hasPermission(user.permissions, 'lkl', 'view')) {
        res.status(403).json({ error: 'Tidak memiliki izin melihat LKL.' });
        return;
      }
      const lkl = db.prepare('SELECT * FROM lkl_reports WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (!lkl) {
        res.status(404).json({ error: 'LKL tidak ditemukan.' });
        return;
      }
      if (user.role === 'duta' && lkl.submitter_personnel_id !== user.personnelId && lkl.submitter_personnel_id !== user.id) {
        res.status(403).json({ error: 'LKL ini bukan milik akun Anda.' });
        return;
      }
      if (user.role === 'koordinator_wilayah' && user.provinceCode !== lkl.province_code) {
        res.status(403).json({ error: 'LKL berada di luar wilayah provinsi Anda.' });
        return;
      }
      const historyRows = db
        .prepare('SELECT * FROM approval_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at ASC')
        .all('lkl', id) as Record<string, unknown>[];

      const status = String(lkl.status);
      const lastHist = historyRows.length > 0 ? historyRows[historyRows.length - 1] : null;
      const prevHist = historyRows.length > 1 ? historyRows[historyRows.length - 2] : null;

      let currentStageLabel = 'Laporan Terkirim';
      let actionRequired = 'Koordinator Wilayah / Pemeriksa memverifikasi hasil kegiatan dan dokumentasi.';
      let actionOwner = 'Koordinator Wilayah / Pengurus Nasional';
      let nextStageLabel: string | null = 'Penerimaan LKL & Penyelesaian Tugas';

      if (status === 'perlu_revisi') {
        currentStageLabel = 'Dikembalikan untuk Perbaikan';
        actionRequired = 'Pelapor wajib melengkapi ringkasan, capaian, atau PDF/foto dokumentasi sesuai catatan.';
        actionOwner = String(lkl.submitter_name);
        nextStageLabel = 'Pemeriksaan Ulang LKL';
      } else if (status === 'diterima') {
        currentStageLabel = 'LKL Diterima & Tervalidasi';
        actionRequired = 'Pelaporan selesai dan tercatat pada statistik kinerja wilayah serta program.';
        actionOwner = 'Selesai';
        nextStageLabel = null;
      } else if (status === 'ditolak') {
        currentStageLabel = 'LKL Ditolak';
        actionRequired = 'Laporan ditolak oleh pemeriksa. Periksa catatan alasan di bawah.';
        actionOwner = 'Selesai';
        nextStageLabel = null;
      }

      const steps: ProcessTrackerStep[] = [
        {
          key: 'submit',
          label: '1. Pengiriman LKL & Dokumentasi',
          description: 'Pelapor mengisi ringkasan, jumlah peserta, PDF, dan foto kegiatan.',
          state: 'selesai',
          ownerRoleLabel: 'Pelapor',
        },
        {
          key: 'review',
          label: '2. Pemeriksaan Wilayah & Bukti',
          description: 'Verifikasi laporan, dokumentasi foto, dan kesesuaian lokasi.',
          state: status === 'perlu_revisi' ? 'revisi' : status === 'menunggu_pemeriksaan' ? 'aktif' : 'selesai',
          ownerRoleLabel: 'Koordinator Wilayah',
        },
        {
          key: 'final',
          label: '3. Validasi Akhir & Arsip',
          description: 'Pembaruan metrik kinerja dan penutupan checklist tugas pelaporan.',
          state: status === 'diterima' ? 'selesai' : status === 'ditolak' ? 'ditolak' : 'menunggu',
          ownerRoleLabel: 'Sistem & Peninjau',
        },
      ];

      res.json({
        entityType: 'lkl',
        entityId: id,
        referenceNumber: String(lkl.reference_number),
        title: String(lkl.activity_name),
        status,
        currentStageLabel,
        previousStageLabel: prevHist ? String(prevHist.stage_label || prevHist.to_status) : lastHist?.from_status ? String(lastHist.from_status) : null,
        currentReviewerLabel: lkl.reviewed_by ? String(lkl.reviewed_by) : 'Koordinator Wilayah',
        actionRequired,
        actionOwner,
        reviewerNote: lkl.review_note ? String(lkl.review_note) : null,
        slaDueAt: null,
        nextStageLabel,
        steps,
        history: historyRows.map((h) => ({
          id: String(h.id),
          action: String(h.action),
          fromStatus: h.from_status ? String(h.from_status) : null,
          toStatus: String(h.to_status),
          stageLabel: String(h.stage_label || h.to_status),
          actorName: String(h.actor_name),
          actorRole: ROLE_LABELS[h.actor_role as RoleCode] ?? String(h.actor_role),
          note: String(h.note || ''),
          createdAt: String(h.created_at),
        })),
      } satisfies ProcessTrackerPayload);
      return;
    }

    // Persuratan
    if (!hasPermission(user.permissions, 'persuratan', 'view')) {
      res.status(403).json({ error: 'Tidak memiliki izin melihat persuratan.' });
      return;
    }
    const corr = db.prepare('SELECT * FROM correspondence WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!corr) {
      res.status(404).json({ error: 'Surat tidak ditemukan.' });
      return;
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode && corr.province_code && corr.province_code !== user.provinceCode && corr.created_by !== user.id) {
      res.status(403).json({ error: 'Surat berada di luar wilayah provinsi Anda.' });
      return;
    }
    if (user.role === 'duta' && corr.created_by !== user.id && corr.province_code !== user.provinceCode) {
      res.status(403).json({ error: 'Tidak memiliki akses ke surat ini.' });
      return;
    }
    const dispRows = db
      .prepare('SELECT * FROM correspondence_dispositions WHERE correspondence_id = ? ORDER BY created_at ASC')
      .all(id) as Record<string, unknown>[];

    const status = String(corr.status);
    const activeDisp = dispRows.find((d) => String(d.status) !== 'selesai') || dispRows[dispRows.length - 1];
    const steps: ProcessTrackerStep[] = [
      {
        key: 'recorded',
        label: '1. Registrasi Surat',
        description: `Surat ${String(corr.direction)} tercatat dengan nomor ${String(corr.reference_number)}.`,
        state: 'selesai',
        ownerRoleLabel: String(corr.created_by_name),
      },
      {
        key: 'disposition',
        label: '2. Disposisi & Tindak Lanjut',
        description: dispRows.length > 0 ? `${dispRows.length} disposisi diterbitkan.` : 'Menunggu arahan disposisi pimpinan/sekretariat.',
        state: status === 'selesai' || status === 'diarsipkan' ? 'selesai' : 'aktif',
        ownerRoleLabel: activeDisp ? String(activeDisp.to_user_name) : 'Sekretariat Nasional',
      },
      {
        key: 'archived',
        label: '3. Penyelesaian & Arsip',
        description: 'Seluruh disposisi selesai dan surat diarsipkan.',
        state: status === 'selesai' || status === 'diarsipkan' ? 'selesai' : 'menunggu',
        ownerRoleLabel: 'Sekretariat Nasional',
      },
    ];

    res.json({
      entityType: 'persuratan',
      entityId: id,
      referenceNumber: String(corr.reference_number),
      title: String(corr.subject),
      status,
      currentStageLabel: status === 'selesai' ? 'Selesai Ditindaklanjuti' : dispRows.length > 0 ? 'Dalam Proses Disposisi' : 'Tercatat di Agenda Surat',
      previousStageLabel: dispRows.length > 0 ? 'Registrasi Surat' : null,
      currentReviewerLabel: activeDisp ? String(activeDisp.to_user_name) : String(corr.created_by_name),
      actionRequired: activeDisp ? String(activeDisp.instruction) : 'Tentukan penerima disposisi atau tandai tindak lanjut surat selesai.',
      actionOwner: activeDisp ? String(activeDisp.to_user_name) : 'Sekretariat / Pimpinan',
      reviewerNote: activeDisp?.response_note ? String(activeDisp.response_note) : null,
      slaDueAt: activeDisp?.due_date ? String(activeDisp.due_date) : null,
      nextStageLabel: status === 'selesai' ? null : 'Penyelesaian & Arsip Surat',
      steps,
      history: dispRows.map((d) => ({
        id: String(d.id),
        action: String(d.status),
        fromStatus: null,
        toStatus: String(d.status),
        stageLabel: `Disposisi ke ${String(d.to_user_name)}`,
        actorName: String(d.from_user_name),
        actorRole: 'Disposisi',
        note: String(d.instruction),
        createdAt: String(d.created_at),
      })),
    } satisfies ProcessTrackerPayload);
  });

  // ==================== 4. PROPOSAL SOFT-DELETE & RESTORE ====================
  app.post('/api/proposals/:id/soft-delete', requireAuth, requirePermission('proposal', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: 'Proposal tidak ditemukan.' });
      return;
    }
    const isAdmin = ['super_admin', 'wakil_super_admin'].includes(user.role);
    const isOwner = prop.applicant_personnel_id === user.personnelId || prop.applicant_personnel_id === user.id;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Anda hanya dapat menghapus draft proposal milik sendiri.' });
      return;
    }
    if (String(prop.status) !== 'draft') {
      res.status(409).json({ error: 'Hanya proposal berstatus draft yang dapat dipindahkan ke tempat sampah. Proposal aktif tidak dapat dihapus.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE proposals SET soft_deleted_at = ?, soft_deleted_by = ?, pre_delete_status = ?, updated_at = ? WHERE id = ?').run(
      now,
      user.fullName,
      String(prop.status),
      now,
      String(prop.id)
    );
    writeAuditLog(db, user, 'SOFT_DELETE_PROPOSAL_DRAFT', 'proposal', String(prop.reference_number));
    res.json({ ok: true, softDeletedAt: now });
  });

  app.post('/api/proposals/:id/restore', requireAuth, requirePermission('proposal', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: 'Proposal tidak ditemukan.' });
      return;
    }
    const isAdmin = ['super_admin', 'wakil_super_admin'].includes(user.role);
    const isOwner = prop.applicant_personnel_id === user.personnelId || prop.applicant_personnel_id === user.id;
    if (!isAdmin && !isOwner) {
      res.status(403).json({ error: 'Akses ditolak untuk memulihkan proposal ini.' });
      return;
    }
    if (!prop.soft_deleted_at) {
      res.status(409).json({ error: 'Proposal tidak sedang berada di tempat sampah.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE proposals SET soft_deleted_at = NULL, soft_deleted_by = NULL, status = COALESCE(pre_delete_status, \'draft\'), updated_at = ? WHERE id = ?').run(
      now,
      String(prop.id)
    );
    writeAuditLog(db, user, 'RESTORE_PROPOSAL_DRAFT', 'proposal', String(prop.reference_number));
    res.json({ ok: true });
  });

  // ==================== 5. GLOBAL ERROR & SUPPORT CENTER (/kendala) ====================
  app.get('/api/support-tickets', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const canManageAll = ['super_admin', 'wakil_super_admin', 'penanggung_jawab', 'sekretariat_nasional'].includes(user.role);

    let sql = 'SELECT * FROM support_tickets WHERE 1=1';
    const params: string[] = [];
    if (!canManageAll) {
      sql += ' AND user_id = ?';
      params.push(user.id);
    } else if (req.query.mine === '1') {
      sql += ' AND user_id = ?';
      params.push(user.id);
    }
    if (req.query.status && typeof req.query.status === 'string') {
      sql += ' AND status = ?';
      params.push(req.query.status);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    const tickets = rows.map((r) => ({
      id: String(r.id),
      ticketNumber: String(r.ticket_number),
      userId: String(r.user_id),
      userName: String(r.user_name),
      userRole: String(r.user_role),
      provinceCode: r.province_code ? String(r.province_code) : null,
      provinceName: r.province_code ? PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? null : null,
      pagePath: String(r.page_path),
      moduleName: String(r.module_name),
      category: String(r.category) as SupportTicketCategory,
      title: String(r.title || ''),
      description: String(r.description),
      screenshotFileId: r.screenshot_file_id ? String(r.screenshot_file_id) : null,
      screenshotFileName: r.screenshot_file_name ? String(r.screenshot_file_name) : null,
      errorRefCode: r.error_ref_code ? String(r.error_ref_code) : null,
      priority: String(r.priority) as SupportTicketPriority,
      status: String(r.status) as SupportTicketStatus,
      assignedToId: r.assigned_to_id ? String(r.assigned_to_id) : null,
      assignedToName: r.assigned_to_name ? String(r.assigned_to_name) : null,
      adminNote: canManageAll ? String(r.admin_note || '') : '',
      resolutionNote: String(r.resolution_note || ''),
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
      resolvedAt: r.resolved_at ? String(r.resolved_at) : null,
    }));

    // Sanitized system error list strictly for admin triage
    const systemErrors = canManageAll
      ? (db
          .prepare('SELECT reference_code, http_status, route, created_at FROM system_errors ORDER BY created_at DESC LIMIT 15')
          .all() as { reference_code: string; http_status: number; route: string; created_at: string }[])
      : [];

    const handlers = canManageAll
      ? (db
          .prepare("SELECT id, full_name, role FROM users WHERE account_status = 'aktif' AND role IN ('super_admin', 'wakil_super_admin', 'sekretariat_nasional', 'penanggung_jawab') ORDER BY full_name ASC")
          .all() as { id: string; full_name: string; role: string }[])
      : [];

    res.json({ tickets, canManageAll, systemErrors, handlers });
  });

  app.post('/api/support-tickets', requireAuth, idempotencyGuard, (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    const title = String(b.title || '').trim();
    const description = String(b.description || '').trim();
    const pagePath = String(b.pagePath || '/beranda').trim().slice(0, 180);
    if (title.length < 4 || description.length < 10) {
      res.status(422).json({ error: 'Ringkasan judul (min. 4 karakter) dan uraian kendala (min. 10 karakter) wajib diisi.' });
      return;
    }

    const validCategories = new Set(['bug_fungsional', 'kesalahan_akses', 'data_tidak_sesuai', 'kendala_unggah', 'kinerja_lambat', 'saran_perbaikan']);
    const category = validCategories.has(String(b.category)) ? String(b.category) : 'bug_fungsional';
    const validPriority = new Set(['rendah', 'sedang', 'tinggi', 'kritis']);
    const priority = validPriority.has(String(b.priority)) ? String(b.priority) : 'sedang';

    const db = getDb();
    const user = req.authUser!;
    const id = crypto.randomUUID();
    const ticketNumber = nextReferenceNumber(db, 'TIKET');
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO support_tickets (
        id, ticket_number, user_id, user_name, user_role, province_code, page_path, module_name,
        category, title, description, screenshot_file_id, screenshot_file_name, error_ref_code,
        priority, status, admin_note, resolution_note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'baru', '', '', ?, ?)`
    ).run(
      id,
      ticketNumber,
      user.id,
      user.fullName,
      user.role,
      user.provinceCode,
      pagePath,
      String(b.moduleName || 'umum').slice(0, 64),
      category,
      title.slice(0, 200),
      description.slice(0, 2500),
      b.screenshotFileId ? String(b.screenshotFileId) : null,
      b.screenshotFileName ? String(b.screenshotFileName) : null,
      b.errorRefCode ? String(b.errorRefCode).slice(0, 64) : null,
      priority,
      now,
      now
    );

    writeAuditLog(db, user, 'CREATE_SUPPORT_TICKET', 'support_ticket', ticketNumber, 'berhasil', title.slice(0, 80));
    writeActivityTimeline(db, 'Dukungan', `Tiket Kendala ${ticketNumber}`, `${user.fullName} melaporkan kendala pada ${pagePath}.`, user.fullName, user.provinceCode, user.batchId, '/kendala');
    res.status(201).json({ ok: true, id, ticketNumber });
  });

  app.patch('/api/support-tickets/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = req.authUser!;
    const canManageAll = ['super_admin', 'wakil_super_admin', 'penanggung_jawab', 'sekretariat_nasional'].includes(user.role);
    if (!canManageAll) {
      res.status(403).json({ error: 'Hanya Super Admin, Penanggung Jawab, atau Sekretariat Nasional yang dapat menindaklanjuti tiket kendala.' });
      return;
    }

    const db = getDb();
    const id = String(req.params.id);
    const ticket = db.prepare('SELECT * FROM support_tickets WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!ticket) {
      res.status(404).json({ error: 'Tiket kendala tidak ditemukan.' });
      return;
    }

    const b = req.body ?? {};
    const validStatus = new Set(['baru', 'ditinjau', 'diproses', 'selesai', 'ditolak']);
    const validPriority = new Set(['rendah', 'sedang', 'tinggi', 'kritis']);
    const nextStatus = b.status && validStatus.has(String(b.status)) ? String(b.status) : String(ticket.status);
    const nextPriority = b.priority && validPriority.has(String(b.priority)) ? String(b.priority) : String(ticket.priority);

    let assignedToId = ticket.assigned_to_id ? String(ticket.assigned_to_id) : null;
    let assignedToName = ticket.assigned_to_name ? String(ticket.assigned_to_name) : null;
    if (b.assignedToId !== undefined) {
      if (!b.assignedToId) {
        assignedToId = null;
        assignedToName = null;
      } else {
        const pic = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(String(b.assignedToId)) as { id: string; full_name: string } | undefined;
        if (pic) {
          assignedToId = pic.id;
          assignedToName = pic.full_name;
        }
      }
    }

    const now = new Date().toISOString();
    const resolvedAt = nextStatus === 'selesai' || nextStatus === 'ditolak' ? (ticket.resolved_at ? String(ticket.resolved_at) : now) : null;

    db.prepare(
      `UPDATE support_tickets SET
         priority = ?,
         status = ?,
         assigned_to_id = ?,
         assigned_to_name = ?,
         admin_note = COALESCE(?, admin_note),
         resolution_note = COALESCE(?, resolution_note),
         updated_at = ?,
         resolved_at = ?
       WHERE id = ?`
    ).run(
      nextPriority,
      nextStatus,
      assignedToId,
      assignedToName,
      b.adminNote !== undefined ? String(b.adminNote) : null,
      b.resolutionNote !== undefined ? String(b.resolutionNote) : null,
      now,
      resolvedAt,
      id
    );

    if (nextStatus === 'selesai' || nextStatus === 'diproses' || nextStatus === 'ditolak') {
      db.prepare(
        `INSERT OR IGNORE INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
         VALUES (?, ?, ?, ?, 'dukungan', '/kendala', 0, ?)`
      ).run(
        crypto.randomUUID(),
        String(ticket.user_id),
        `Tiket ${String(ticket.ticket_number)} berstatus ${nextStatus.replace(/_/g, ' ')}`,
        String(b.resolutionNote || ticket.title || 'Pembaruan penanganan tiket kendala Anda.'),
        now
      );
    }

    writeAuditLog(db, user, 'UPDATE_SUPPORT_TICKET', 'support_ticket', String(ticket.ticket_number), 'berhasil', `Status: ${nextStatus} · Prioritas: ${nextPriority}`);
    res.json({ ok: true, status: nextStatus, priority: nextPriority });
  });
}
