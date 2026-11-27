import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Response } from 'express';
import multer from 'multer';
import { getDb, IS_DEMO_MODE, nextReferenceNumber, PRIVATE_STORAGE_DIR } from './db';
import {
  type AuthenticatedRequest,
  canAccessStoredFile,
  checkGenericThrottle,
  checkLoginThrottle,
  clearLoginFailures,
  clearSessionCookie,
  createNotificationIdempotent,
  createSession,
  hashPassword,
  hasScopedUserPermission,
  idempotencyGuard,
  inspectFileMagicBytes,
  logSensitivePiiAccess,
  recordLoginFailure,
  requireAuth,
  requirePermission,
  resolveOptionalAuth,
  rotateSession,
  setSessionCookie,
  sha256,
  verifyPassword,
  writeActivityTimeline,
  writeAuditLog,
} from './security';
import {
  computeDashboardAnalytics,
  computeObjectDiff,
  onLklApproved,
  onProposalApproved,
  onProposalScheduleUpdated,
  recordApprovalHistory,
} from './workflow';
import { csvSafeCell } from '../src/lib/rbac';
import {
  calculateAlumniWindow,
  calculateProfileCompleteness,
  hasPermission,
  isRecordRelevantToBidang,
  resolveBidangDefinition,
  resolveProposalApprover,
  ROLE_LABELS,
  sanitizePublicStatsPayload,
  verifyCoordinateInProvince,
} from '../src/lib/rbac';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';
import type { RoleCode } from '../src/lib/types';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

function maskPersonnelRow(row: Record<string, unknown>, viewer: AuthenticatedRequest['authUser']) {
  const isOwner = viewer?.personnelId === row.id;
  const canSeeSensitive =
    isOwner ||
    ['super_admin', 'wakil_super_admin', 'sekretariat_nasional', 'penanggung_jawab'].includes(
      viewer?.role ?? ''
    ) ||
    (viewer?.role === 'koordinator_wilayah' && viewer.provinceCode === row.province_code);

  const docsChecklist = JSON.parse(String(row.docs_checklist_json || '{}'));
  const comp = calculateProfileCompleteness({
    fullName: String(row.full_name || ''),
    birthPlace: String(row.birth_place || ''),
    birthDate: String(row.birth_date || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    provinceCode: String(row.province_code || ''),
    regency: String(row.regency || ''),
    fullAddress: String(row.full_address || ''),
    schoolName: String(row.school_name || ''),
    educationLevel: String(row.education_level || ''),
    gradeClass: String(row.grade_class || ''),
    guardianName: String(row.guardian_name || ''),
    guardianPhone: String(row.guardian_phone || ''),
    docsChecklist,
  });

  return {
    id: String(row.id),
    memberNumber: String(row.member_number),
    referenceNumber: String(row.reference_number),
    userId: row.user_id ? String(row.user_id) : null,
    fullName: String(row.full_name),
    nickname: String(row.nickname || ''),
    birthPlace: canSeeSensitive ? String(row.birth_place || '') : 'Terlindungi',
    birthDate: canSeeSensitive ? String(row.birth_date || '') : 'Terlindungi',
    gender: String(row.gender || ''),
    email: String(row.email),
    phone: canSeeSensitive ? String(row.phone || '') : 'Terlindungi',
    provinceCode: String(row.province_code),
    provinceName: PROVINCE_BY_CODE.get(String(row.province_code))?.name ?? String(row.province_code),
    assignmentProvinceCode: row.assignment_province_code ? String(row.assignment_province_code) : String(row.province_code),
    assignmentProvinceName: PROVINCE_BY_CODE.get(String(row.assignment_province_code || row.province_code))?.name ?? String(row.province_code),
    regencyCode: row.regency_code ? String(row.regency_code) : null,
    regency: String(row.regency || ''),
    district: canSeeSensitive ? String(row.district || '') : '',
    village: canSeeSensitive ? String(row.village || '') : '',
    postalCode: canSeeSensitive ? String(row.postal_code || '') : '',
    fullAddress: canSeeSensitive ? String(row.full_address || '') : 'Akses alamat dibatasi',
    schoolName: String(row.school_name || ''),
    educationLevel: String(row.education_level || ''),
    gradeClass: String(row.grade_class || ''),
    major: String(row.major || ''),
    npsn: String(row.npsn || ''),
    nisn: canSeeSensitive ? String(row.nisn || '') : '********',
    entryYear: Number(row.entry_year || 2024),
    expectedGradYear: Number(row.expected_grad_year || 2027),
    schoolAddress: String(row.school_address || ''),
    schoolRegency: String(row.school_regency || ''),
    schoolProvince: String(row.school_province || ''),
    batchId: String(row.batch_id),
    batchName: String(row.batch_name || row.batch_id),
    positionTitle: String(row.position_title || ''),
    bidang: String(row.bidang || ''),
    roleCode: row.role_code as RoleCode,
    appointedAt: String(row.appointed_at || ''),
    termStartsAt: String(row.term_starts_at || ''),
    termEndsAt: String(row.term_ends_at || ''),
    personnelStatus: String(row.personnel_status),
    verificationStatus: String(row.verification_status),
    verificationNote: row.verification_note ? String(row.verification_note) : null,
    culturalInterests: String(row.cultural_interests || ''),
    activityInterests: String(row.activity_interests || ''),
    orgExperience: String(row.org_experience || ''),
    skills: String(row.skills || ''),
    guardianName: canSeeSensitive ? String(row.guardian_name || '') : 'Terlindungi',
    guardianRelation: canSeeSensitive ? String(row.guardian_relation || '') : '-',
    guardianPhone: canSeeSensitive ? String(row.guardian_phone || '') : 'Terlindungi',
    docsChecklist,
    avatarFileId: row.avatar_file_id ? String(row.avatar_file_id) : null,
    completenessScore: comp.score,
    missingFields: comp.missingFields,
    restrictedFieldsMasked: !canSeeSensitive,
  };
}

export function registerCoreRoutes(app: Express): void {
  // ==================== PUBLIC PORTAL & CMS ====================
  app.get('/api/public/overview', (_req, res: Response) => {
    const db = getDb();
    const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
    const settingsRows = db
      .prepare("SELECT key, value FROM system_settings WHERE key IN ('public_stats_approved', 'public_show_duta_count')")
      .all() as { key: string; value: string }[];
    const settingsMap = new Map(settingsRows.map((r) => [r.key, r.value]));
    const statsApproved = settingsMap.get('public_stats_approved') === 'true';
    const showDutaCount = settingsMap.get('public_show_duta_count') !== 'false';

    const activeProvinces = (db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'aktif'").get() as { c: number }).c;
    const developingProvinces = (db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'dalam_pengembangan'").get() as { c: number }).c;
    const totalRegencies = (db.prepare('SELECT COUNT(*) AS c FROM regencies').get() as { c: number }).c;
    const coveredRegencies = (db.prepare("SELECT COUNT(*) AS c FROM regencies WHERE status IN ('aktif', 'dalam_pengembangan', 'dalam_pembinaan')").get() as { c: number }).c;
    const activePersonnel = (db.prepare("SELECT COUNT(*) AS c FROM personnel WHERE personnel_status = 'aktif'").get() as { c: number }).c;
    const approvedActivities = (db.prepare("SELECT COUNT(*) AS c FROM lkl_reports WHERE status = 'diterima'").get() as { c: number }).c;
    const activeBatches = (db.prepare("SELECT COUNT(*) AS c FROM batches WHERE status = 'aktif'").get() as { c: number }).c;

    const publicStats = statsApproved
      ? {
          ...sanitizePublicStatsPayload(
            {
              activeProvinces,
              totalProvinces: 38,
              activePersonnel,
              approvedActivities,
              activeBatches,
            },
            showDutaCount
          ),
          developingProvinces,
          coveredRegencies,
          totalRegencies,
        }
      : null;

    // CMS Public Content (Sanitized)
    const cmsRows = db.prepare('SELECT key, title, body, updated_at FROM cms_contents').all() as {
      key: string;
      title: string;
      body: string;
      updated_at: string;
    }[];
    const cms: Record<string, { title: string; body: string; updatedAt: string }> = {};
    for (const row of cmsRows) {
      cms[row.key] = { title: row.title, body: row.body, updatedAt: row.updated_at };
    }

    // Approved Public Announcements Only (never leaks internal operational notices)
    const publicAnnouncements = db
      .prepare(
        `SELECT id, title, body, scope, priority, published_at
         FROM announcements
         WHERE is_public = 1 AND status = 'terbit'
         ORDER BY published_at DESC
         LIMIT 6`
      )
      .all() as { id: string; title: string; body: string; scope: string; priority: string; published_at: string }[];

    // Public-safe province aggregate summary (ZERO PII: no email, phone, home address, or personal ID)
    const provRows = db
      .prepare(
        `SELECT pr.code, pr.name, pr.island, pr.status, pr.logo_file_id, pr.description,
          (SELECT COUNT(*) FROM regencies rg WHERE rg.province_code = pr.code) AS regency_count,
          (SELECT COUNT(*) FROM regencies rg WHERE rg.province_code = pr.code AND rg.status IN ('aktif', 'dalam_pengembangan')) AS active_regency_count,
          (SELECT COUNT(*) FROM lkl_reports l WHERE l.province_code = pr.code AND l.status = 'diterima') AS approved_lkl_count,
          (SELECT COUNT(*) FROM personnel p WHERE p.province_code = pr.code AND p.role_code = 'duta' AND p.personnel_status = 'aktif') AS active_duta_count
         FROM provinces pr
         ORDER BY pr.code ASC`
      )
      .all() as Record<string, unknown>[];

    const publicProvinces = provRows.map((r) => ({
      code: String(r.code),
      name: String(r.name),
      island: String(r.island),
      status: String(r.status),
      logoFileId: r.logo_file_id ? String(r.logo_file_id) : null,
      description: r.description ? String(r.description) : null,
      regencyCount: Number(r.regency_count || 0),
      activeRegencyCount: Number(r.active_regency_count || 0),
      approvedLklCount: Number(r.approved_lkl_count || 0),
      activeDutaCount: showDutaCount ? Number(r.active_duta_count || 0) : null,
    }));

    const demoAccounts = IS_DEMO_MODE
      ? (
          db
            .prepare(
              'SELECT id, email, full_name, role, bidang, province_code FROM users WHERE is_demo = 1 ORDER BY created_at ASC'
            )
            .all() as Record<string, unknown>[]
        ).map((u) => ({
          id: String(u.id),
          email: String(u.email),
          fullName: String(u.full_name),
          role: String(u.role) as RoleCode,
          roleLabel: ROLE_LABELS[u.role as RoleCode] ?? String(u.role),
          bidang: u.bidang ? String(u.bidang) : null,
          provinceName: u.province_code ? PROVINCE_BY_CODE.get(String(u.province_code))?.name ?? null : null,
        }))
      : [];

    res.json({
      isDemoMode: IS_DEMO_MODE,
      bootstrapRequired: !IS_DEMO_MODE && userCount === 0,
      statsApproved,
      showDutaCount,
      publicStats,
      cms,
      publicAnnouncements: publicAnnouncements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        scope: a.scope,
        priority: a.priority,
        publishedAt: a.published_at,
      })),
      provinces: publicProvinces,
      demoAccounts,
    });
  });

  app.get('/api/public/provinces/:code', (req, res: Response) => {
    const code = String(req.params.code).replace(/[^0-9]/g, '');
    const db = getDb();
    const row = db
      .prepare(
        `SELECT pr.code, pr.name, pr.island, pr.status, pr.logo_file_id, pr.description,
                (SELECT COUNT(*) FROM lkl_reports l WHERE l.province_code = pr.code AND l.status = 'diterima') AS approved_lkl_count
         FROM provinces pr WHERE pr.code = ?`
      )
      .get(code) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Provinsi tidak ditemukan.' });
      return;
    }
    const regRows = db
      .prepare('SELECT code, name, kind, status, coordinator_name FROM regencies WHERE province_code = ? ORDER BY kind DESC, name ASC')
      .all(code) as Record<string, unknown>[];

    res.json({
      province: {
        code: String(row.code),
        name: String(row.name),
        island: String(row.island),
        status: String(row.status),
        logoFileId: row.logo_file_id ? String(row.logo_file_id) : null,
        description: row.description ? String(row.description) : null,
        approvedLklCount: Number(row.approved_lkl_count || 0),
        regencyCount: regRows.length,
        activeRegencyCount: regRows.filter((r) => r.status === 'aktif' || r.status === 'dalam_pengembangan').length,
      },
      regencies: regRows.map((r) => ({
        code: String(r.code),
        provinceCode: code,
        name: String(r.name),
        kind: String(r.kind),
        status: String(r.status),
        hasCoordinator: Boolean(r.coordinator_name),
      })),
    });
  });

  app.get('/api/public/help', (_req, res: Response) => {
    const db = getDb();
    const articles = db
      .prepare('SELECT id, slug, category, role_target, title, summary, content, sort_order, is_published, updated_at FROM help_articles WHERE is_published = 1 ORDER BY sort_order ASC, title ASC')
      .all() as Record<string, unknown>[];
    res.json({
      articles: articles.map((a) => ({
        id: String(a.id),
        slug: String(a.slug),
        category: String(a.category),
        roleTarget: String(a.role_target),
        title: String(a.title),
        summary: String(a.summary),
        content: String(a.content),
        sortOrder: Number(a.sort_order),
        isPublished: Boolean(a.is_published),
        updatedAt: String(a.updated_at),
      })),
    });
  });

  app.get('/api/public/files/:id', (req, res: Response) => {
    const db = getDb();
    const fileId = String(req.params.id).replace(/[^a-zA-Z0-9-]/g, '');
    const row = db
      .prepare("SELECT stored_name, mime_type, original_name FROM stored_files WHERE id = ? AND module IN ('province_logo', 'public_media')")
      .get(fileId) as { stored_name: string; mime_type: string; original_name: string } | undefined;
    if (!row || !['image/jpeg', 'image/png', 'image/webp'].includes(row.mime_type)) {
      res.status(404).json({ error: 'Aset media publik tidak ditemukan.' });
      return;
    }
    const fullPath = path.join(PRIVATE_STORAGE_DIR, path.basename(row.stored_name));
    if (!fullPath.startsWith(PRIVATE_STORAGE_DIR) || !fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Berkas aset tidak ditemukan.' });
      return;
    }
    res.setHeader('Content-Type', row.mime_type);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.sendFile(fullPath);
  });

  app.get('/api/locations/cascade', (req, res: Response) => {
    const db = getDb();
    const provinceCode = req.query.provinceCode ? String(req.query.provinceCode).replace(/[^0-9]/g, '') : '';
    const regencyCode = req.query.regencyCode ? String(req.query.regencyCode).replace(/[^0-9.]/g, '') : '';
    const districtCode = req.query.districtCode ? String(req.query.districtCode).replace(/[^0-9.]/g, '') : '';

    const regencies = provinceCode
      ? db.prepare('SELECT code, province_code, name, kind, status FROM regencies WHERE province_code = ? ORDER BY kind DESC, name ASC').all(provinceCode)
      : [];
    const districts = regencyCode
      ? db.prepare('SELECT code, regency_code, name FROM districts WHERE regency_code = ? ORDER BY name ASC').all(regencyCode)
      : [];
    const villages = districtCode
      ? db.prepare('SELECT code, district_code, name FROM villages WHERE district_code = ? ORDER BY name ASC').all(districtCode)
      : [];

    res.json({ regencies, districts, villages });
  });

  // ==================== AUTHENTICATION ====================
  app.post('/api/auth/bootstrap', (req, res: Response) => {
    const db = getDb();
    const userCount = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
    if (userCount > 0) {
      res.status(403).json({
        error: 'Bootstrap awal telah dinonaktifkan karena Super Admin sudah terdaftar.',
      });
      return;
    }
    const { fullName, email, password } = req.body ?? {};
    if (!fullName || !email || !password || String(password).length < 10) {
      res.status(422).json({
        error: 'Nama lengkap, email resmi, dan password minimal 10 karakter wajib diisi.',
      });
      return;
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const persId = crypto.randomUUID();
    const refNo = nextReferenceNumber(db, 'PERS');

    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare(
        `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
         VALUES ('batch-init', 1, 'Angkatan I — Periode Awal', ?, ?, ?, ?, ?, 4, 'aktif', ?)`
      ).run(now.slice(0, 10), now.slice(0, 10), now.slice(0, 10), now.slice(0, 10), '2027-03-15', now);

      db.prepare(
        `INSERT INTO personnel (id, member_number, reference_number, user_id, full_name, email, province_code, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
         VALUES (?, 'DPBI-2026-0001', ?, ?, ?, ?, '31', 'batch-init', 'Super Admin Sistem', 'Tata Kelola Nasional', 'super_admin', 'aktif', 'terverifikasi', '{}', ?, ?)`
      ).run(persId, refNo, userId, String(fullName).trim(), String(email).trim().toLowerCase(), now, now);

      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, bidang, province_code, batch_id, personnel_id, account_status, is_demo, created_at)
         VALUES (?, ?, ?, ?, 'super_admin', 'Tata Kelola Nasional', '31', 'batch-init', ?, 'aktif', 0, ?)`
      ).run(userId, String(email).trim().toLowerCase(), hashPassword(String(password)), String(fullName).trim(), persId, now);

      writeAuditLog(db, { id: userId, fullName: String(fullName), role: 'super_admin' }, 'BOOTSTRAP_SUPER_ADMIN', 'user', userId, 'berhasil', 'Pendaftaran satu kali Super Admin pertama.');
      db.exec('COMMIT;');
    } catch (err) {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: 'Gagal membuat akun Super Admin awal.' });
      return;
    }

    const { rawToken } = createSession(db, userId, req.headers['user-agent']?.slice(0, 80) || 'Browser', req.ip || '127.0.0.1');
    setSessionCookie(res, rawToken);
    res.status(201).json({ ok: true, message: 'Super Admin berhasil diinisialisasi. Endpoint bootstrap kini dikunci.' });
  });

  app.post('/api/auth/login', (req, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const password = String(req.body?.password ?? '');
    if (!email || !password) {
      res.status(422).json({ error: 'Email dan kata sandi wajib diisi.' });
      return;
    }

    const throttleKey = `${req.ip}:${email}`;
    const throttle = checkLoginThrottle(throttleKey);
    if (!throttle.allowed) {
      res.status(429).json({
        error: `Terlalu banyak percobaan masuk gagal. Silakan coba lagi dalam ${throttle.retryAfterSec} detik.`,
        code: 429,
      });
      return;
    }

    const db = getDb();
    const userRow = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as Record<string, unknown> | undefined;

    if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
      recordLoginFailure(throttleKey);
      writeAuditLog(
        db,
        { id: userRow ? String(userRow.id) : 'anonymous', fullName: email || 'Tidak Dikenal', role: userRow ? String(userRow.role) : 'anonymous' },
        'LOGIN_FAILED',
        'session',
        email || 'empty',
        'gagal',
        `IP: ${req.ip || '127.0.0.1'}`
      );
      res.status(401).json({ error: 'Email atau kata sandi tidak sesuai.', code: 401 });
      return;
    }

    if (userRow.account_status === 'menunggu_persetujuan') {
      res.status(403).json({
        error: 'Akun Anda sedang menunggu persetujuan Sekretariat Nasional.',
        code: 403,
        accountStatus: 'menunggu_persetujuan',
      });
      return;
    }

    if (userRow.account_status === 'nonaktif' || userRow.account_status === 'terkunci') {
      res.status(403).json({ error: 'Akun ini sedang dinonaktifkan atau terkunci.', code: 403 });
      return;
    }

    if (userRow.role === 'alumni' && userRow.alumni_access_expires_at) {
      if (Date.parse(String(userRow.alumni_access_expires_at)) < Date.now()) {
        res.status(403).json({
          error: 'Masa akses arsip Alumni 30 hari telah berakhir. Hubungi Sekretariat Nasional.',
          code: 403,
        });
        return;
      }
    }

    clearLoginFailures(throttleKey);
    const userId = String(userRow.id);
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), userId);

    const { rawToken } = createSession(
      db,
      userId,
      String(req.headers['user-agent'] || 'Web Browser').slice(0, 80),
      req.ip || '127.0.0.1'
    );
    setSessionCookie(res, rawToken);
    writeAuditLog(
      db,
      { id: userId, fullName: String(userRow.full_name), role: String(userRow.role) },
      'LOGIN',
      'session',
      userId,
      'berhasil',
      IS_DEMO_MODE ? 'Login lingkungan simulasi' : 'Login portal internal'
    );

    res.json({ ok: true });
  });

  app.post('/api/auth/demo-switch', (req, res: Response) => {
    if (!IS_DEMO_MODE) {
      res.status(403).json({ error: 'Mode Demo dinonaktifkan pada lingkungan produksi.' });
      return;
    }
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const db = getDb();
    const userRow = db
      .prepare('SELECT * FROM users WHERE email = ? AND is_demo = 1')
      .get(email) as Record<string, unknown> | undefined;
    if (!userRow) {
      res.status(404).json({ error: 'Akun simulasi tidak ditemukan.' });
      return;
    }
    const userId = String(userRow.id);
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(new Date().toISOString(), userId);
    const { rawToken } = createSession(db, userId, 'Demo Role Switcher', req.ip || '127.0.0.1');
    setSessionCookie(res, rawToken);
    writeAuditLog(
      db,
      { id: userId, fullName: String(userRow.full_name), role: String(userRow.role) },
      'DEMO_SWITCH',
      'session',
      userId,
      'berhasil',
      'Berpindah peran simulasi demo'
    );
    res.json({ ok: true });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    if (req.sessionId) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(req.sessionId);
    }
    if (req.authUser) {
      writeAuditLog(db, req.authUser, 'LOGOUT', 'session', req.authUser.id);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/auth/session', (req: AuthenticatedRequest, res: Response) => {
    const resolved = resolveOptionalAuth(req, res);
    if (!resolved) {
      res.json({ authenticated: false, user: null, isDemoMode: IS_DEMO_MODE, expiredReason: null });
      return;
    }
    if ('expiredReason' in resolved && resolved.user === null) {
      res.json({
        authenticated: false,
        user: null,
        isDemoMode: IS_DEMO_MODE,
        expiredReason: resolved.expiredReason,
      });
      return;
    }
    res.json({
      authenticated: true,
      user: resolved.user,
      isDemoMode: IS_DEMO_MODE,
      sessionExpiresAt: resolved.expiresAt,
      idleMinutes: resolved.idleMinutes,
      expiredReason: null,
    });
  });

  app.get('/api/auth/me', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    res.json({ user: req.authUser, isDemoMode: IS_DEMO_MODE });
  });

  app.get('/api/auth/sessions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT id, device_label, ip_address, expires_at, created_at, last_seen_at FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC')
      .all(req.authUser!.id) as Record<string, unknown>[];
    res.json({
      sessions: rows.map((r) => ({
        id: String(r.id),
        deviceLabel: String(r.device_label),
        ipAddress: String(r.ip_address),
        expiresAt: String(r.expires_at),
        createdAt: String(r.created_at),
        lastSeenAt: String(r.last_seen_at),
        isCurrent: String(r.id) === req.sessionId,
      })),
    });
  });

  app.delete('/api/auth/sessions/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const targetId = String(req.params.id);
    const owned = db.prepare('SELECT id FROM sessions WHERE id = ? AND user_id = ?').get(targetId, req.authUser!.id);
    if (!owned) {
      res.status(404).json({ error: 'Sesi perangkat tidak ditemukan.' });
      return;
    }
    db.prepare('DELETE FROM sessions WHERE id = ?').run(targetId);
    writeAuditLog(db, req.authUser!, 'REVOKE_SINGLE_SESSION', 'session', targetId);
    if (targetId === req.sessionId) {
      clearSessionCookie(res);
    }
    res.json({ ok: true, revokedCurrent: targetId === req.sessionId });
  });

  app.post('/api/auth/sessions/revoke-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(req.authUser!.id);
    writeAuditLog(db, req.authUser!, 'REVOKE_ALL_SESSIONS', 'user', req.authUser!.id);
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.post('/api/auth/change-password', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      res.status(422).json({ error: 'Kata sandi saat ini dan kata sandi baru (minimal 8 karakter) wajib diisi.' });
      return;
    }
    const db = getDb();
    const userRow = db.prepare('SELECT * FROM users WHERE id = ?').get(req.authUser!.id) as Record<string, unknown> | undefined;
    if (!userRow || !verifyPassword(String(currentPassword), String(userRow.password_hash))) {
      res.status(401).json({ error: 'Kata sandi saat ini tidak sesuai.' });
      return;
    }
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(newPassword)), req.authUser!.id);
    // Invalidate all other sessions and rotate current session ID
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(req.authUser!.id, req.sessionId || '');
    const rotated = rotateSession(
      db,
      req.sessionId,
      req.authUser!.id,
      String(req.headers['user-agent'] || 'Web Browser').slice(0, 80),
      req.ip || '127.0.0.1'
    );
    setSessionCookie(res, rotated.rawToken);
    writeAuditLog(db, req.authUser!, 'CHANGE_PASSWORD_ROTATE_SESSION', 'user', req.authUser!.id);
    res.json({ ok: true, message: 'Kata sandi diperbarui dan ID sesi dirotasi dengan aman.' });
  });

  app.patch('/api/auth/profile', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { fullName, notificationPrefs } = req.body ?? {};
    const db = getDb();
    const user = req.authUser!;
    if (fullName && String(fullName).trim().length >= 3) {
      db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(String(fullName).trim(), user.id);
      if (user.personnelId) {
        db.prepare('UPDATE personnel SET full_name = ?, updated_at = ? WHERE id = ?').run(
          String(fullName).trim(),
          new Date().toISOString(),
          user.personnelId
        );
      }
    }
    if (notificationPrefs && typeof notificationPrefs === 'object') {
      db.prepare('UPDATE users SET notification_prefs_json = ? WHERE id = ?').run(
        JSON.stringify(notificationPrefs),
        user.id
      );
    }
    writeAuditLog(db, user, 'UPDATE_SELF_PROFILE', 'user', user.id);
    res.json({ ok: true });
  });

  app.get('/api/auth/login-history', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const logs = db
      .prepare(
        `SELECT id, action, outcome, context_note, created_at
         FROM audit_logs
         WHERE actor_user_id = ? AND action IN ('LOGIN', 'DEMO_SWITCH', 'LOGOUT', 'REVOKE_ALL_SESSIONS', 'CHANGE_PASSWORD_ROTATE_SESSION')
         ORDER BY created_at DESC LIMIT 20`
      )
      .all(req.authUser!.id);
    res.json({ logs });
  });

  app.post('/api/auth/request-reset', (req, res: Response) => {
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const throttle = checkGenericThrottle(`reset-req:${req.ip || 'local'}:${email}`, 5, 15 * 60_000);
    if (!throttle.allowed) {
      res.status(429).json({ error: `Terlalu banyak permintaan reset. Coba lagi dalam ${throttle.retryAfterSec} detik.`, code: 429 });
      return;
    }
    if (!email) {
      res.status(422).json({ error: 'Masukkan email akun yang terdaftar.' });
      return;
    }
    const db = getDb();
    const user = db.prepare('SELECT id, full_name, role FROM users WHERE email = ?').get(email) as
      | { id: string; full_name: string; role: string }
      | undefined;
    writeAuditLog(
      db,
      user ? { id: user.id, fullName: user.full_name, role: user.role } : { id: 'anonymous', fullName: email, role: 'anonymous' },
      'PASSWORD_RESET_REQUEST',
      'user',
      email,
      'berhasil',
      `IP: ${req.ip || '127.0.0.1'}`
    );
    if (user) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = sha256(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      db.prepare(
        'INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)'
      ).run(crypto.randomUUID(), user.id, tokenHash, expiresAt, new Date().toISOString());
      // Return token ONLY in isolated demo mode for testing; in production send via SMTP
      res.json({
        ok: true,
        message: 'Jika email terdaftar, instruksi reset password telah diproses.',
        ...(IS_DEMO_MODE ? { demoResetToken: rawToken } : {}),
      });
      return;
    }
    res.json({ ok: true, message: 'Jika email terdaftar, instruksi reset password telah diproses.' });
  });

  app.post('/api/auth/complete-reset', (req, res: Response) => {
    const throttle = checkGenericThrottle(`reset-complete:${req.ip || 'local'}`, 8, 15 * 60_000);
    if (!throttle.allowed) {
      res.status(429).json({ error: `Terlalu banyak percobaan reset. Tunggu ${throttle.retryAfterSec} detik.`, code: 429 });
      return;
    }
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword || String(newPassword).length < 8) {
      res.status(422).json({ error: 'Token valid dan password baru minimal 8 karakter diperlukan.' });
      return;
    }
    const db = getDb();
    const row = db
      .prepare('SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL')
      .get(sha256(String(token))) as Record<string, unknown> | undefined;
    if (!row || Date.parse(String(row.expires_at)) < Date.now()) {
      res.status(400).json({ error: 'Token reset password tidak valid atau sudah kedaluwarsa.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(String(newPassword)), String(row.user_id));
    db.prepare('UPDATE password_resets SET used_at = ? WHERE id = ?').run(now, String(row.id));
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(String(row.user_id));
    writeAuditLog(db, { id: String(row.user_id), fullName: String(row.user_id), role: 'user' }, 'PASSWORD_RESET_COMPLETE', 'user', String(row.user_id));
    res.json({ ok: true, message: 'Kata sandi berhasil diperbarui.' });
  });

  app.get('/api/invitations/verify-token/:token', (req, res: Response) => {
    const token = String(req.params.token || '').trim();
    if (!token) {
      res.status(400).json({ error: 'Token undangan tidak valid.' });
      return;
    }
    const db = getDb();
    const inv = db
      .prepare('SELECT * FROM invitations WHERE token_hash = ?')
      .get(sha256(token)) as Record<string, unknown> | undefined;
    if (!inv || ['dibatalkan', 'ditolak', 'aktif'].includes(String(inv.status)) || inv.used_at) {
      res.status(404).json({ error: 'Undangan tidak valid, sudah digunakan, atau telah dibatalkan.' });
      return;
    }
    if (Date.parse(String(inv.expires_at)) < Date.now()) {
      db.prepare("UPDATE invitations SET status = 'kedaluwarsa' WHERE id = ? AND status IN ('undangan_terkirim', 'aktivasi_dibuka')").run(String(inv.id));
      res.status(410).json({ error: 'Tautan undangan telah kedaluwarsa. Minta pengelola mengirim ulang undangan.' });
      return;
    }
    if (String(inv.status) === 'undangan_terkirim') {
      db.prepare("UPDATE invitations SET status = 'aktivasi_dibuka', opened_at = ? WHERE id = ?").run(
        new Date().toISOString(),
        String(inv.id)
      );
    }
    const email = String(inv.email);
    const [uPart, dPart] = email.split('@');
    const maskedEmail = uPart ? `${uPart.slice(0, 2)}***@${dPart || ''}` : '***';
    res.json({
      valid: true,
      fullName: String(inv.full_name),
      emailMasked: maskedEmail,
      role: String(inv.role),
      roleLabel: ROLE_LABELS[inv.role as RoleCode] ?? String(inv.role),
      provinceCode: inv.province_code ? String(inv.province_code) : null,
      provinceName: inv.province_code ? PROVINCE_BY_CODE.get(String(inv.province_code))?.name ?? String(inv.province_code) : 'Nasional',
      batchId: String(inv.batch_id || 'batch-3'),
      expiresAt: String(inv.expires_at),
    });
  });

  app.post('/api/auth/accept-invitation', (req, res: Response) => {
    const throttle = checkGenericThrottle(`invite-accept:${req.ip || 'local'}`, 10, 15 * 60_000);
    if (!throttle.allowed) {
      res.status(429).json({ error: `Terlalu banyak percobaan aktivasi. Tunggu ${throttle.retryAfterSec} detik.`, code: 429 });
      return;
    }
    const { token, password } = req.body ?? {};
    if (!token || !password || String(password).length < 8) {
      res.status(422).json({ error: 'Token undangan dan kata sandi minimal 8 karakter wajib diisi.' });
      return;
    }
    const db = getDb();
    const inv = db
      .prepare("SELECT * FROM invitations WHERE token_hash = ? AND used_at IS NULL AND status NOT IN ('aktif', 'dibatalkan', 'ditolak')")
      .get(sha256(String(token))) as Record<string, unknown> | undefined;
    if (!inv || Date.parse(String(inv.expires_at)) < Date.now()) {
      res.status(400).json({ error: 'Undangan tidak valid, sudah dibatalkan, atau telah kedaluwarsa.' });
      return;
    }
    const cleanEmail = String(inv.email).trim().toLowerCase();
    const dupUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (dupUser) {
      res.status(409).json({ error: 'Akun login untuk email ini sudah aktif sebelumnya.' });
      return;
    }

    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const linkedPersonnelId = inv.personnel_id ? String(inv.personnel_id) : null;
    let finalPersId = linkedPersonnelId;

    db.exec('BEGIN IMMEDIATE;');
    try {
      if (linkedPersonnelId) {
        const existingPers = db.prepare('SELECT id FROM personnel WHERE id = ?').get(linkedPersonnelId) as { id: string } | undefined;
        if (existingPers) {
          db.prepare('UPDATE personnel SET user_id = ?, updated_at = ? WHERE id = ?').run(userId, now, linkedPersonnelId);
        } else {
          finalPersId = null;
        }
      } else {
        const byEmailPers = db.prepare('SELECT id FROM personnel WHERE LOWER(email) = ? LIMIT 1').get(cleanEmail) as { id: string } | undefined;
        if (byEmailPers) {
          finalPersId = byEmailPers.id;
          db.prepare('UPDATE personnel SET user_id = ?, updated_at = ? WHERE id = ?').run(userId, now, finalPersId);
        } else {
          finalPersId = crypto.randomUUID();
          const refNo = nextReferenceNumber(db, 'PERS');
          const memberNo = `DPBI-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
          db.prepare(
            `INSERT INTO personnel (id, member_number, reference_number, user_id, full_name, email, province_code, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Kebudayaan', ?, 'aktif', 'belum_lengkap', '{}', ?, ?)`
          ).run(
            finalPersId,
            memberNo,
            refNo,
            userId,
            String(inv.full_name),
            cleanEmail,
            String(inv.province_code || '31'),
            String(inv.batch_id || 'batch-3'),
            ROLE_LABELS[inv.role as RoleCode] ?? 'Duta Pelajar Berbudaya',
            String(inv.role),
            now,
            now
          );
        }
      }

      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, province_code, batch_id, personnel_id, account_status, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`
      ).run(userId, cleanEmail, hashPassword(String(password)), String(inv.full_name), String(inv.role), String(inv.province_code || '31'), String(inv.batch_id || 'batch-3'), finalPersId, IS_DEMO_MODE ? 1 : 0, now);

      db.prepare("UPDATE invitations SET used_at = ?, status = 'aktif' WHERE id = ?").run(now, String(inv.id));
      db.exec('COMMIT;');
    } catch {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: 'Gagal mengaktifkan akun undangan.' });
      return;
    }
    writeAuditLog(db, { id: userId, fullName: String(inv.full_name), role: String(inv.role) }, 'ACCEPT_INVITATION', 'user', userId, 'berhasil', `Personnel linked: ${finalPersId || 'none'}`);
    res.json({ ok: true, message: 'Akun berhasil diaktifkan. Silakan masuk menggunakan email dan password Anda.' });
  });

  // ==================== SECURE FILE UPLOAD & AUTHENTICATED DOWNLOAD ====================
  app.post('/api/files/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
    const user = req.authUser!;
    const throttle = checkGenericThrottle(`file-upload:${user.id}`, 30, 60_000);
    if (!throttle.allowed) {
      res.status(429).json({ error: `Batas unggah sementara tercapai. Tunggu ${throttle.retryAfterSec} detik.`, code: 429 });
      return;
    }
    const file = req.file;
    if (!file) {
      res.status(422).json({ error: 'Tidak ada berkas yang diunggah.' });
      return;
    }
    const check = inspectFileMagicBytes(file.buffer, file.mimetype, file.originalname);
    if (!check.valid) {
      res.status(422).json({ error: check.reason || 'Berkas gagal validasi keamanan.' });
      return;
    }
    const db = getDb();
    const checksum = sha256(file.buffer);
    const moduleName = String(req.body?.module || 'umum');
    const now = new Date().toISOString();
    const existing = db
      .prepare('SELECT id, original_name, mime_type, size_bytes FROM stored_files WHERE checksum_sha256 = ?')
      .get(checksum) as Record<string, unknown> | undefined;

    if (existing) {
      const existingFileId = String(existing.id);
      db.prepare(
        `INSERT OR IGNORE INTO file_access_grants (id, file_id, user_id, province_code, module, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), existingFileId, user.id, user.provinceCode, moduleName, now);
      res.json({
        fileId: existingFileId,
        fileName: file.originalname,
        mimeType: String(existing.mime_type),
        sizeBytes: Number(existing.size_bytes),
        deduplicated: true,
      });
      return;
    }

    const fileId = crypto.randomUUID();
    const ext = path.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, '') || '.bin';
    const storedName = `${fileId}${ext}`;
    fs.writeFileSync(path.join(PRIVATE_STORAGE_DIR, storedName), file.buffer);

    db.prepare(
      `INSERT INTO stored_files (id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, module, uploaded_by, is_archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      fileId,
      file.originalname,
      storedName,
      check.detectedMime,
      file.size,
      checksum,
      moduleName,
      user.id,
      now
    );

    db.prepare(
      `INSERT OR IGNORE INTO file_access_grants (id, file_id, user_id, province_code, module, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), fileId, user.id, user.provinceCode, moduleName, now);

    writeAuditLog(db, user, 'UPLOAD_FILE', 'file', fileId, 'berhasil', `${file.originalname} (${check.detectedMime})`);
    res.status(201).json({
      fileId,
      fileName: file.originalname,
      mimeType: check.detectedMime,
      sizeBytes: file.size,
      deduplicated: false,
    });
  });

  const serveStoredFile = (req: AuthenticatedRequest, res: Response, forceDownload: boolean) => {
    const db = getDb();
    const user = req.authUser!;
    const fileId = String(req.params.id).replace(/[^a-zA-Z0-9-]/g, '');
    const acl = canAccessStoredFile(db, user, fileId);
    if (!acl.exists || !acl.file) {
      res.status(404).json({ error: 'Berkas tidak ditemukan.', code: 404 });
      return;
    }
    if (!acl.allowed) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'file', fileId, 'ditolak', 'Percobaan akses berkas lintas objek/wilayah.');
      res.status(403).json({ error: 'Akses ditolak: Anda tidak berwenang melihat atau mengunduh berkas ini.', code: 403 });
      return;
    }
    const row = acl.file;
    const safeStored = path.basename(String(row.stored_name));
    const fullPath = path.join(PRIVATE_STORAGE_DIR, safeStored);
    if (!fullPath.startsWith(PRIVATE_STORAGE_DIR) || !fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Berkas fisik tidak ditemukan di penyimpanan privat.' });
      return;
    }
    writeAuditLog(db, user, forceDownload ? 'DOWNLOAD_FILE' : 'PREVIEW_FILE', 'file', fileId, 'berhasil', String(row.original_name));
    res.setHeader('Content-Type', String(row.mime_type));
    res.setHeader(
      'Content-Disposition',
      `${forceDownload ? 'attachment' : 'inline'}; filename="${encodeURIComponent(String(row.original_name))}"`
    );
    res.sendFile(fullPath);
  };

  app.get('/api/files/:id/preview', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    serveStoredFile(req, res, false);
  });

  app.get('/api/files/:id/download', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    serveStoredFile(req, res, true);
  });

  app.get('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    serveStoredFile(req, res, req.query.download === '1');
  });

  // ==================== DASHBOARD & GLOBAL SEARCH ====================
  app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const isNational = ['super_admin', 'wakil_super_admin', 'penanggung_jawab', 'pengurus_nasional', 'sekretariat_nasional'].includes(user.role);
    const isKorwil = user.role === 'koordinator_wilayah';
    const rawDays = Number(req.query.days || 30);
    const daysWindow: 7 | 30 | 90 = rawDays === 7 || rawDays === 90 ? rawDays : 30;

    let persSql = 'SELECT COUNT(*) AS c FROM personnel WHERE 1=1';
    let dutaSql = "SELECT COUNT(*) AS c FROM personnel WHERE role_code = 'duta' AND personnel_status = 'aktif'";
    const persParams: string[] = [];
    if (user.role === 'duta' || user.role === 'alumni') {
      persSql += ' AND id = ?';
      dutaSql += ' AND id = ?';
      persParams.push(user.personnelId || '__none__');
    } else if (isKorwil && user.provinceCode) {
      persSql += ' AND province_code = ?';
      dutaSql += ' AND province_code = ?';
      persParams.push(user.provinceCode);
    }

    const totalPersonnel = (db.prepare(persSql).get(...persParams) as { c: number }).c;
    const activeDuta = (db.prepare(dutaSql).get(...persParams) as { c: number }).c;
    const activeProvinces = (db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'aktif'").get() as { c: number }).c;

    let propSql = 'SELECT COUNT(*) AS c FROM proposals WHERE 1=1';
    const propParams: string[] = [];
    if (user.role === 'duta') {
      propSql += " AND applicant_personnel_id = ? AND status IN ('diajukan', 'menunggu_persetujuan_nasional', 'perlu_revisi')";
      propParams.push(user.personnelId || '__none__');
    } else if (isKorwil && user.provinceCode) {
      propSql += " AND province_code = ? AND status IN ('diajukan', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')";
      propParams.push(user.provinceCode);
    } else {
      propSql += " AND status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')";
    }
    const pendingProposals = (db.prepare(propSql).get(...propParams) as { c: number }).c;

    let lklSql = 'SELECT COUNT(*) AS c FROM lkl_reports WHERE 1=1';
    const lklParams: string[] = [];
    if (user.role === 'duta') {
      lklSql += " AND submitter_personnel_id = ? AND status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')";
      lklParams.push(user.personnelId || '__none__');
    } else if (isKorwil && user.provinceCode) {
      lklSql += " AND province_code = ? AND status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')";
      lklParams.push(user.provinceCode);
    } else {
      lklSql += " AND status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')";
    }
    const pendingLkl = (db.prepare(lklSql).get(...lklParams) as { c: number }).c;

    let taskSql = "SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('selesai', 'dibatalkan') AND deadline < ?";
    const taskParams: string[] = [new Date().toISOString().slice(0, 10)];
    if (user.role === 'duta') {
      taskSql += ' AND assignee_id = ?';
      taskParams.push(user.id);
    } else if (isKorwil && user.provinceCode) {
      taskSql += ' AND province_code = ?';
      taskParams.push(user.provinceCode);
    }
    const overdueTasks = (db.prepare(taskSql).get(...taskParams) as { c: number }).c;

    const unreadNotifications = (
      db.prepare('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0').get(user.id) as { c: number }
    ).c;

    const totalStorageBytes = (
      db.prepare('SELECT COALESCE(SUM(size_bytes), 0) AS s FROM stored_files').get() as { s: number }
    ).s;

    // Attention Center (strictly non-sensitive summaries)
    const attentionItems: { id: string; level: 'kritis' | 'perhatian' | 'info'; title: string; detail: string; path: string }[] = [];

    if (isNational || isKorwil) {
      if (pendingProposals > 0) {
        attentionItems.push({
          id: 'att-prop',
          level: 'perhatian',
          title: `${pendingProposals} Proposal Menunggu Tindak Lanjut`,
          detail: 'Terdapat pengajuan proposal kegiatan yang memerlukan peninjauan atau revisi.',
          path: '/proposal',
        });
      }
      if (pendingLkl > 0) {
        attentionItems.push({
          id: 'att-lkl',
          level: 'perhatian',
          title: `${pendingLkl} LKL Menunggu Pemeriksaan`,
          detail: 'Laporan Kegiatan Lapangan perlu diverifikasi oleh Koordinator Wilayah.',
          path: '/laporan-kegiatan',
        });
      }
    }

    if (user.role === 'super_admin' || user.role === 'sekretariat_nasional') {
      const pendingAccReq = (db.prepare("SELECT COUNT(*) AS c FROM account_requests WHERE status = 'menunggu'").get() as { c: number }).c;
      if (pendingAccReq > 0) {
        attentionItems.push({
          id: 'att-acc',
          level: 'info',
          title: `${pendingAccReq} Permintaan Akun Duta Baru`,
          detail: 'Diajukan oleh Koordinator Wilayah untuk verifikasi Sekretariat/Admin.',
          path: '/personalia',
        });
      }
      const coachingProv = (db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'dalam_pembinaan'").get() as { c: number }).c;
      if (coachingProv > 0) {
        attentionItems.push({
          id: 'att-prov',
          level: 'perhatian',
          title: `${coachingProv} Provinsi dalam Status Pembinaan`,
          detail: 'Perlu pendampingan koordinasi wilayah dan penetapan koordinator aktif.',
          path: '/wilayah',
        });
      }
    }

    if (overdueTasks > 0) {
      attentionItems.push({
        id: 'att-task',
        level: 'kritis',
        title: `${overdueTasks} Tugas Melewati Tenggat`,
        detail: 'Segera selesaikan atau eskalasikan tugas operasional terkait.',
        path: '/tugas',
      });
    }

    if (user.role === 'penanggung_jawab' || user.role === 'super_admin') {
      const newAduan = (db.prepare("SELECT COUNT(*) AS c FROM whistleblowing_reports WHERE status IN ('baru', 'ditinjau')").get() as { c: number }).c;
      if (newAduan > 0) {
        attentionItems.push({
          id: 'att-adu',
          level: 'kritis',
          title: `${newAduan} Laporan Pengaduan Membutuhkan Tindak Lanjut Berwenang`,
          detail: 'Akses terbatas hanya untuk Penanggung Jawab dan pihak berwenang.',
          path: '/perlindungan',
        });
      }
    }

    if (user.role === 'alumni' && user.alumniAccessExpiresAt) {
      const win = calculateAlumniWindow(
        new Date(Date.parse(user.alumniAccessExpiresAt) - 30 * 24 * 60 * 60 * 1000).toISOString()
      );
      attentionItems.push({
        id: 'att-alumni',
        level: win.daysRemaining <= 7 ? 'kritis' : 'info',
        title: `Masa Akses Arsip Alumni Tersisa ${win.daysRemaining} Hari`,
        detail: 'Unduh sertifikat dan ekspor riwayat kegiatan pribadi sebelum masa akses 30 hari berakhir.',
        path: '/arsip',
      });
    }

    // Real DB queries for Recharts
    const personnelPerBatch = (
      db
        .prepare(
          `SELECT b.name AS batchName, COUNT(p.id) AS total
           FROM batches b
           LEFT JOIN personnel p ON p.batch_id = b.id
           GROUP BY b.id
           ORDER BY b.batch_number ASC`
        )
        .all() as { batchName: string; total: number }[]
    ).map((r) => ({ name: r.batchName.split('—')[0].trim(), jumlah: r.total }));

    const provinceStatusChart = (
      db
        .prepare(
          `SELECT status, COUNT(*) AS total FROM provinces GROUP BY status`
        )
        .all() as { status: string; total: number }[]
    ).map((r) => ({ status: r.status.replace(/_/g, ' '), total: r.total }));

    const topProvinceActivities = (
      db
        .prepare(
          `SELECT pr.name AS provinceName,
                  (SELECT COUNT(*) FROM proposals p WHERE p.province_code = pr.code) AS proposalCount,
                  (SELECT COUNT(*) FROM lkl_reports l WHERE l.province_code = pr.code) AS lklCount
           FROM provinces pr
           WHERE pr.status IN ('aktif', 'dalam_pengembangan')
           ORDER BY (proposalCount + lklCount) DESC, pr.name ASC
           LIMIT 8`
        )
        .all() as { provinceName: string; proposalCount: number; lklCount: number }[]
    );

    const timelineSql = `SELECT id, category, title, description, province_code, actor_name, related_path, created_at
       FROM activity_timeline
       ${isKorwil && user.provinceCode ? 'WHERE province_code IS NULL OR province_code = ?' : ''}
       ORDER BY created_at DESC
       LIMIT 8`;
    const recentActivities = (
      db
        .prepare(timelineSql)
        .all(...(isKorwil && user.provinceCode ? [user.provinceCode] : [])) as Record<string, unknown>[]
    ).map((a) => ({
      id: String(a.id),
      category: String(a.category),
      title: String(a.title),
      description: String(a.description),
      provinceName: a.province_code ? PROVINCE_BY_CODE.get(String(a.province_code))?.name ?? null : null,
      actorName: String(a.actor_name),
      relatedPath: String(a.related_path),
      createdAt: String(a.created_at),
    }));

    const upcomingEvents = (
      db
        .prepare('SELECT id, title, category, start_at, location FROM calendar_events ORDER BY start_at ASC LIMIT 5')
        .all() as Record<string, unknown>[]
    ).map((e) => ({
      id: String(e.id),
      title: String(e.title),
      category: String(e.category),
      startAt: String(e.start_at),
      location: String(e.location),
    }));

    const activeBidang = user.role === 'pengurus_nasional' ? resolveBidangDefinition(user.bidang) : null;
    const bidangStats = activeBidang
      ? (() => {
          const allProps = db
            .prepare("SELECT id, bidang, category, status FROM proposals WHERE status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')")
            .all() as { id: string; bidang: string; category: string; status: string }[];
          const scopedProps = allProps.filter((p) => isRecordRelevantToBidang(user.bidang, p.bidang, p.category));
          return {
            code: activeBidang.code,
            label: activeBidang.label,
            description: activeBidang.description,
            primaryModules: activeBidang.primaryModules,
            scopedPendingProposals: scopedProps.length,
          };
        })()
      : null;

    const analytics = computeDashboardAnalytics(db, user, daysWindow);

    res.json({
      summary: {
        totalPersonnel,
        activeDuta,
        activeProvinces,
        totalProvinces: 38,
        pendingProposals,
        pendingLkl,
        overdueTasks,
        unreadNotifications,
        totalStorageBytes,
      },
      analytics,
      bidangScope: bidangStats,
      attentionItems,
      charts: {
        personnelPerBatch,
        provinceStatusChart,
        topProvinceActivities,
      },
      recentActivities,
      upcomingEvents,
    });
  });

  app.get('/api/search', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const q = String(req.query.q || '').trim().toLowerCase();
    if (!q) {
      res.json({ results: [] });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const like = `%${q}%`;
    const results: { type: string; title: string; subtitle: string; path: string }[] = [];

    // Provinces
    const provs = db.prepare('SELECT code, name, status FROM provinces WHERE LOWER(name) LIKE ? LIMIT 5').all(like) as Record<string, unknown>[];
    for (const p of provs) {
      results.push({ type: 'Wilayah', title: String(p.name), subtitle: `Kode ${p.code} · Status ${String(p.status).replace(/_/g, ' ')}`, path: '/wilayah' });
    }

    // Personnel (RBAC isolated + parameterized)
    if (hasPermission(user.permissions, 'personalia', 'view')) {
      let sql = 'SELECT id, full_name, member_number, province_code FROM personnel WHERE (LOWER(full_name) LIKE ? OR LOWER(member_number) LIKE ?)';
      const params: string[] = [like, like];
      if (user.role === 'duta' || user.role === 'alumni') {
        sql += ' AND id = ?';
        params.push(user.personnelId || '__none__');
      } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
        sql += ' AND province_code = ?';
        params.push(user.provinceCode);
      }
      sql += ' LIMIT 5';
      const pers = db.prepare(sql).all(...params) as Record<string, unknown>[];
      for (const p of pers) {
        results.push({ type: 'Personalia', title: String(p.full_name), subtitle: `${p.member_number} · ${PROVINCE_BY_CODE.get(String(p.province_code))?.name ?? ''}`, path: `/personalia/${String(p.id)}` });
      }
    }

    // Proposals (RBAC scoped)
    if (hasPermission(user.permissions, 'proposal', 'view')) {
      let pSql = 'SELECT id, reference_number, title, status FROM proposals WHERE (LOWER(title) LIKE ? OR LOWER(reference_number) LIKE ?)';
      const pParams: string[] = [like, like];
      if (user.role === 'duta') {
        pSql += ' AND applicant_personnel_id = ?';
        pParams.push(user.personnelId || '__none__');
      } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
        pSql += ' AND province_code = ?';
        pParams.push(user.provinceCode);
      }
      pSql += ' LIMIT 5';
      const props = db.prepare(pSql).all(...pParams) as Record<string, unknown>[];
      for (const pr of props) {
        results.push({ type: 'Proposal', title: String(pr.title), subtitle: `${pr.reference_number} · ${String(pr.status).replace(/_/g, ' ')}`, path: `/proposal/${String(pr.id)}` });
      }
    }

    // LKL (RBAC scoped)
    if (hasPermission(user.permissions, 'lkl', 'view')) {
      let lSql = 'SELECT id, reference_number, activity_name, status FROM lkl_reports WHERE (LOWER(activity_name) LIKE ? OR LOWER(reference_number) LIKE ?)';
      const lParams: string[] = [like, like];
      if (user.role === 'duta') {
        lSql += ' AND submitter_personnel_id = ?';
        lParams.push(user.personnelId || '__none__');
      } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
        lSql += ' AND province_code = ?';
        lParams.push(user.provinceCode);
      }
      lSql += ' LIMIT 5';
      const lmls = db.prepare(lSql).all(...lParams) as Record<string, unknown>[];
      for (const l of lmls) {
        results.push({ type: 'LKL', title: String(l.activity_name), subtitle: `${l.reference_number} · ${String(l.status).replace(/_/g, ' ')}`, path: `/laporan-kegiatan/${String(l.id)}` });
      }
    }

    // Documents (RBAC scoped)
    if (hasPermission(user.permissions, 'dokumen', 'view')) {
      let dSql = 'SELECT id, document_number, title, category FROM documents WHERE (LOWER(title) LIKE ? OR LOWER(document_number) LIKE ?)';
      if (user.role === 'duta' || user.role === 'alumni') {
        dSql += " AND access_level = 'internal_semua'";
      } else if (user.role === 'koordinator_wilayah') {
        dSql += " AND access_level IN ('internal_semua', 'koordinator_ke_atas')";
      }
      dSql += ' LIMIT 5';
      const docs = db.prepare(dSql).all(like, like) as Record<string, unknown>[];
      for (const d of docs) {
        results.push({ type: 'Dokumen', title: String(d.title), subtitle: `${d.document_number} · ${d.category}`, path: `/dokumen/${String(d.id)}` });
      }
    }

    // Flagship Programs (RBAC scoped)
    if (hasPermission(user.permissions, 'program', 'view')) {
      const progs = db
        .prepare("SELECT id, slug, name, bidang, period_label FROM flagship_programs WHERE status != 'diarsipkan' AND (LOWER(name) LIKE ? OR LOWER(bidang) LIKE ?) LIMIT 4")
        .all(like, like) as Record<string, unknown>[];
      for (const pr of progs) {
        results.push({ type: 'Program Unggulan', title: String(pr.name), subtitle: `${pr.bidang} · ${pr.period_label}`, path: `/program/${String(pr.slug)}` });
      }
    }

    // Tasks (RBAC scoped)
    if (hasPermission(user.permissions, 'tugas', 'view')) {
      let tSql = 'SELECT id, reference_number, title, status FROM tasks WHERE soft_deleted_at IS NULL AND (LOWER(title) LIKE ? OR LOWER(reference_number) LIKE ?)';
      const tParams: string[] = [like, like];
      if (user.role === 'duta') {
        tSql += ' AND assignee_id = ?';
        tParams.push(user.id);
      } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
        tSql += ' AND (province_code = ? OR assignee_id = ?)';
        tParams.push(user.provinceCode, user.id);
      }
      tSql += ' LIMIT 5';
      const tasks = db.prepare(tSql).all(...tParams) as Record<string, unknown>[];
      for (const tk of tasks) {
        results.push({ type: 'Tugas', title: String(tk.title), subtitle: `${tk.reference_number} · ${String(tk.status).replace(/_/g, ' ')}`, path: `/tugas/${String(tk.id)}` });
      }
    }

    // Correspondence (RBAC scoped)
    if (hasPermission(user.permissions, 'persuratan', 'view')) {
      let cSql = 'SELECT id, reference_number, subject, direction, status FROM correspondence WHERE (LOWER(subject) LIKE ? OR LOWER(reference_number) LIKE ?)';
      const cParams: string[] = [like, like];
      if (user.role === 'duta') {
        cSql += ' AND (created_by = ? OR province_code = ?)';
        cParams.push(user.id, user.provinceCode || '__none__');
      } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
        cSql += ' AND (province_code IS NULL OR province_code = ? OR created_by = ?)';
        cParams.push(user.provinceCode, user.id);
      }
      cSql += ' LIMIT 5';
      const corrs = db.prepare(cSql).all(...cParams) as Record<string, unknown>[];
      for (const cr of corrs) {
        results.push({ type: 'Persuratan', title: String(cr.subject), subtitle: `${cr.reference_number} · Surat ${cr.direction}`, path: `/persuratan/${String(cr.id)}` });
      }
    }

    // Support Tickets (RBAC scoped: user own tickets or Admin triage)
    const isTicketAdmin = ['super_admin', 'wakil_super_admin', 'penanggung_jawab', 'sekretariat_nasional'].includes(user.role);
    let sSql = 'SELECT id, ticket_number, title, page_path, status FROM support_tickets WHERE (LOWER(title) LIKE ? OR LOWER(ticket_number) LIKE ? OR LOWER(description) LIKE ?)';
    const sParams: string[] = [like, like, like];
    if (!isTicketAdmin) {
      sSql += ' AND user_id = ?';
      sParams.push(user.id);
    }
    sSql += ' LIMIT 4';
    const tks = db.prepare(sSql).all(...sParams) as Record<string, unknown>[];
    for (const tk of tks) {
      results.push({ type: 'Tiket Kendala', title: String(tk.title || tk.ticket_number), subtitle: `${tk.ticket_number} · ${String(tk.status).replace(/_/g, ' ')}`, path: '/kendala' });
    }

    res.json({ results });
  });

  // ==================== PROVINCES, REGENCIES, HANDOVER & LOCATION ====================
  app.get('/api/provinces', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT pr.*,
          (SELECT COUNT(*) FROM personnel p WHERE p.province_code = pr.code AND p.role_code = 'duta' AND p.personnel_status = 'aktif') AS active_duta_count,
          (SELECT COUNT(*) FROM personnel p WHERE COALESCE(NULLIF(p.assignment_province_code, ''), p.province_code) = pr.code AND p.role_code = 'duta' AND p.personnel_status = 'aktif') AS assignment_duta_count,
          (SELECT COUNT(*) FROM personnel p WHERE p.province_code = pr.code AND p.personnel_status = 'alumni') AS alumni_count,
          (SELECT COUNT(*) FROM proposals prop WHERE prop.province_code = pr.code) AS proposal_count,
          (SELECT COUNT(*) FROM lkl_reports l WHERE l.province_code = pr.code) AS lkl_count,
          (SELECT COUNT(*) FROM regencies rg WHERE rg.province_code = pr.code) AS regency_count,
          (SELECT COUNT(*) FROM regencies rg WHERE rg.province_code = pr.code AND rg.status IN ('aktif', 'dalam_pengembangan')) AS active_regency_count
         FROM provinces pr
         ORDER BY pr.code ASC`
      )
      .all() as Record<string, unknown>[];

    res.json({
      provinces: rows.map((r) => ({
        code: String(r.code),
        name: String(r.name),
        island: String(r.island),
        status: String(r.status),
        coordinatorId: r.coordinator_id ? String(r.coordinator_id) : null,
        coordinatorName: r.coordinator_name ? String(r.coordinator_name) : null,
        logoFileId: r.logo_file_id ? String(r.logo_file_id) : null,
        description: r.description ? String(r.description) : null,
        activeDutaCount: Number(r.active_duta_count),
        domicileDutaCount: Number(r.active_duta_count),
        assignmentDutaCount: Number(r.assignment_duta_count),
        alumniCount: Number(r.alumni_count),
        proposalCount: Number(r.proposal_count),
        lklCount: Number(r.lkl_count),
        regencyCount: Number(r.regency_count || 0),
        activeRegencyCount: Number(r.active_regency_count || 0),
        monthlyReportSubmitted: Number(r.lkl_count) > 0,
        finalReportSubmitted: false,
        coachingNote: r.coaching_note ? String(r.coaching_note) : null,
        minLat: Number(r.min_lat),
        maxLat: Number(r.max_lat),
        minLng: Number(r.min_lng),
        maxLng: Number(r.max_lng),
        centerLat: Number(r.center_lat),
        centerLng: Number(r.center_lng),
      })),
    });
  });

  app.patch('/api/provinces/:code', requireAuth, requirePermission('wilayah', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const code = String(req.params.code);
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== code) {
      res.status(403).json({ error: 'Koordinator Wilayah hanya dapat memperbarui provinsi penugasannya.' });
      return;
    }
    const { status, coordinatorName, coachingNote, logoFileId, description } = req.body ?? {};
    const db = getDb();
    db.prepare(
      `UPDATE provinces SET
         status = COALESCE(?, status),
         coordinator_name = COALESCE(?, coordinator_name),
         coaching_note = COALESCE(?, coaching_note),
         logo_file_id = COALESCE(?, logo_file_id),
         description = COALESCE(?, description)
       WHERE code = ?`
    ).run(
      status ?? null,
      coordinatorName ?? null,
      coachingNote ?? null,
      logoFileId ?? null,
      description ?? null,
      code
    );
    db.prepare(
      `INSERT INTO region_history (id, region_type, region_code, action, summary, actor_name, created_at)
       VALUES (?, 'provinsi', ?, 'PEMBARUAN_DATA', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      code,
      `Pembaruan provinsi ${PROVINCE_BY_CODE.get(code)?.name ?? code}${status ? ` (status: ${status})` : ''}${logoFileId ? ' + logo wilayah' : ''}`,
      user.fullName,
      new Date().toISOString()
    );
    writeAuditLog(db, user, 'UPDATE_PROVINCE', 'province', code, 'berhasil', `Pembaruan data wilayah ${code}`);
    res.json({ ok: true });
  });

  app.get('/api/provinces/:code/regencies', requireAuth, requirePermission('wilayah', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const code = String(req.params.code).replace(/[^0-9]/g, '');
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM regencies WHERE province_code = ? ORDER BY kind DESC, name ASC')
      .all(code) as Record<string, unknown>[];
    res.json({
      regencies: rows.map((r) => ({
        code: String(r.code),
        provinceCode: String(r.province_code),
        name: String(r.name),
        kind: String(r.kind),
        status: String(r.status),
        coordinatorName: r.coordinator_name ? String(r.coordinator_name) : null,
        coachingNote: r.coaching_note ? String(r.coaching_note) : null,
      })),
    });
  });

  app.post('/api/regencies', requireAuth, requirePermission('wilayah', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { code, provinceCode, name, kind, status, coordinatorName, coachingNote } = req.body ?? {};
    if (!code || !provinceCode || !name) {
      res.status(422).json({ error: 'Kode wilayah, kode provinsi, dan nama Kabupaten/Kota wajib diisi.' });
      return;
    }
    const db = getDb();
    const exists = db.prepare('SELECT code FROM regencies WHERE code = ?').get(String(code));
    if (exists) {
      res.status(422).json({ error: 'Kode Kabupaten/Kota sudah terdaftar.' });
      return;
    }
    db.prepare(
      `INSERT INTO regencies (code, province_code, name, kind, status, coordinator_name, coaching_note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      String(code).trim(),
      String(provinceCode).trim(),
      String(name).trim(),
      kind === 'kota' ? 'kota' : 'kabupaten',
      String(status || 'dalam_pengembangan'),
      coordinatorName ? String(coordinatorName) : null,
      coachingNote ? String(coachingNote) : null
    );
    db.prepare(
      `INSERT INTO region_history (id, region_type, region_code, action, summary, actor_name, created_at)
       VALUES (?, 'kabupaten', ?, 'PEMEKARAN_TAMBAH', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      String(code).trim(),
      `Penambahan daerah ${name} (${provinceCode})`,
      req.authUser!.fullName,
      new Date().toISOString()
    );
    writeAuditLog(db, req.authUser!, 'CREATE_REGENCY', 'regency', String(code), 'berhasil', String(name));
    res.status(201).json({ ok: true, code: String(code).trim() });
  });

  app.patch('/api/regencies/:code', requireAuth, requirePermission('wilayah', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const code = String(req.params.code);
    const { name, status, coordinatorName, coachingNote } = req.body ?? {};
    const db = getDb();
    const existing = db.prepare('SELECT * FROM regencies WHERE code = ?').get(code) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Kabupaten/Kota tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== existing.province_code) {
      res.status(403).json({ error: 'Koordinator hanya dapat mengubah daerah di provinsinya.' });
      return;
    }
    db.prepare(
      `UPDATE regencies SET
         name = COALESCE(?, name),
         status = COALESCE(?, status),
         coordinator_name = COALESCE(?, coordinator_name),
         coaching_note = COALESCE(?, coaching_note)
       WHERE code = ?`
    ).run(name ?? null, status ?? null, coordinatorName ?? null, coachingNote ?? null, code);
    db.prepare(
      `INSERT INTO region_history (id, region_type, region_code, action, summary, actor_name, created_at)
       VALUES (?, 'kabupaten', ?, 'PEMBARUAN_DAERAH', ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      code,
      `Pembaruan ${existing.name}${status ? ` -> status ${status}` : ''}${name && name !== existing.name ? ` (nama baru: ${name})` : ''}`,
      user.fullName,
      new Date().toISOString()
    );
    writeAuditLog(db, user, 'UPDATE_REGENCY', 'regency', code);
    res.json({ ok: true });
  });

  app.get('/api/regions/history', requireAuth, requirePermission('wilayah', 'view'), (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const history = db.prepare('SELECT * FROM region_history ORDER BY created_at DESC LIMIT 40').all();
    res.json({ history });
  });

  app.get('/api/handovers', requireAuth, requirePermission('wilayah', 'view'), (_req, res: Response) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM handovers ORDER BY created_at DESC').all() as Record<string, unknown>[];
    res.json({
      handovers: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        outgoingCoordinatorId: r.outgoing_coordinator_id ? String(r.outgoing_coordinator_id) : null,
        outgoingCoordinatorName: String(r.outgoing_coordinator_name),
        incomingCoordinatorId: r.incoming_coordinator_id ? String(r.incoming_coordinator_id) : null,
        incomingCoordinatorName: String(r.incoming_coordinator_name),
        activeTasksCount: Number(r.active_tasks_count),
        openProposalsCount: Number(r.open_proposals_count),
        notes: String(r.notes),
        status: String(r.status),
        approvedBy: r.approved_by ? String(r.approved_by) : null,
        approvedAt: r.approved_at ? String(r.approved_at) : null,
        packageSnapshot: r.package_json ? (() => { try { return JSON.parse(String(r.package_json)); } catch { return null; } })() : null,
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/handovers', requireAuth, requirePermission('wilayah', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { provinceCode, outgoingCoordinatorId, outgoingCoordinatorName, incomingCoordinatorId, incomingCoordinatorName, notes } = req.body ?? {};
    if (!provinceCode || !outgoingCoordinatorName || !incomingCoordinatorName) {
      res.status(422).json({ error: 'Provinsi, Koordinator lama, dan calon pengganti wajib diisi.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== String(provinceCode)) {
      const db = getDb();
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'handover', String(provinceCode), 'ditolak', 'Koordinator mencoba membuat serah terima provinsi lain');
      res.status(403).json({ error: 'Koordinator hanya dapat mengajukan serah terima untuk provinsinya sendiri.' });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, 'HND');
    const id = crypto.randomUUID();
    const pCode = String(provinceCode);
    const activeTasks = db.prepare("SELECT id, reference_number, title, deadline FROM tasks WHERE province_code = ? AND status != 'selesai' LIMIT 20").all(pCode) as Record<string, unknown>[];
    const openProposals = db.prepare("SELECT id, reference_number, title, status FROM proposals WHERE province_code = ? AND status NOT IN ('disetujui', 'ditolak', 'dibatalkan', 'diarsipkan') LIMIT 20").all(pCode) as Record<string, unknown>[];
    const pendingReports = db.prepare("SELECT COUNT(*) AS c FROM coordinator_reports WHERE province_code = ? AND status != 'diterima'").get(pCode) as { c: number };
    const upcomingEvents = db.prepare("SELECT COUNT(*) AS c FROM calendar_events WHERE province_code = ?").get(pCode) as { c: number };

    const packageSnapshot = {
      generatedAt: new Date().toISOString(),
      activeTasks: activeTasks.map((t) => ({ id: t.id, ref: t.reference_number, title: t.title, deadline: t.deadline })),
      openProposals: openProposals.map((p) => ({ id: p.id, ref: p.reference_number, title: p.title, status: p.status })),
      pendingReportsCount: Number(pendingReports?.c || 0),
      upcomingEventsCount: Number(upcomingEvents?.c || 0),
    };

    db.prepare(
      `INSERT INTO handovers (id, reference_number, province_code, outgoing_coordinator_id, outgoing_coordinator_name, incoming_coordinator_id, incoming_coordinator_name, active_tasks_count, open_proposals_count, package_json, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_persetujuan', ?)`
    ).run(
      id,
      refNo,
      pCode,
      outgoingCoordinatorId ? String(outgoingCoordinatorId) : null,
      String(outgoingCoordinatorName),
      incomingCoordinatorId ? String(incomingCoordinatorId) : null,
      String(incomingCoordinatorName),
      activeTasks.length,
      openProposals.length,
      JSON.stringify(packageSnapshot),
      String(notes || ''),
      new Date().toISOString()
    );

    recordApprovalHistory(db, {
      entityType: 'handover',
      entityId: id,
      action: 'submit',
      fromStatus: null,
      toStatus: 'menunggu_persetujuan',
      stageLabel: 'Pengajuan Paket Serah Terima Wilayah',
      actor: user,
      note: `${outgoingCoordinatorName} -> ${incomingCoordinatorName} (${activeTasks.length} tugas, ${openProposals.length} proposal)`,
    });

    writeAuditLog(db, user, 'CREATE_HANDOVER', 'handover', refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo, packageSnapshot });
  });

  app.post('/api/handovers/:id/approve', requireAuth, requirePermission('organisasi', 'assign'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const h = db.prepare('SELECT * FROM handovers WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!h) {
      res.status(404).json({ error: 'Data serah terima tidak ditemukan.' });
      return;
    }
    if (String(h.status) !== 'menunggu_persetujuan') {
      res.status(409).json({ error: 'Serah terima ini sudah diproses dan tidak dapat disahkan ulang.' });
      return;
    }
    const now = new Date().toISOString();
    const pCode = String(h.province_code);
    db.prepare("UPDATE handovers SET status = 'disetujui', approved_by = ?, approved_at = ? WHERE id = ?").run(req.authUser!.fullName, now, String(h.id));
    db.prepare('UPDATE provinces SET coordinator_name = ? WHERE code = ?').run(String(h.incoming_coordinator_name), pCode);

    // Close outgoing coordinator org_position_history & record incoming holder
    const outPersId = h.outgoing_coordinator_id ? String(h.outgoing_coordinator_id) : null;
    const inPersId = h.incoming_coordinator_id ? String(h.incoming_coordinator_id) : null;
    if (outPersId) {
      db.prepare('UPDATE org_position_history SET ended_at = ? WHERE personnel_id = ? AND ended_at IS NULL').run(now, outPersId);
      const outUser = db.prepare('SELECT id FROM users WHERE personnel_id = ? OR id = ? LIMIT 1').get(outPersId, outPersId) as { id: string } | undefined;
      if (outUser) {
        // Revoke active sessions of outgoing coordinator upon handover approval
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(outUser.id);
        createNotificationIdempotent(db, {
          userId: outUser.id,
          title: `Serah Terima Wilayah ${PROVINCE_BY_CODE.get(pCode)?.name ?? pCode} Disahkan`,
          message: `Jabatan koordinator telah diserahkan kepada ${String(h.incoming_coordinator_name)} (${String(h.reference_number)}).`,
          category: 'wilayah',
          targetPath: '/wilayah',
          eventKey: `hnd_out_${String(h.id)}`,
        });
      }
    }
    const provPos = db
      .prepare("SELECT id, title, bidang FROM organization_positions WHERE role_binding = 'koordinator_wilayah' AND (title LIKE ? OR id LIKE ?) LIMIT 1")
      .get(`%${PROVINCE_BY_CODE.get(pCode)?.name ?? pCode}%`, `%${pCode}%`) as { id: string; title: string; bidang: string } | undefined;
    db.prepare(
      `INSERT INTO org_position_history (id, position_id, position_title, personnel_id, holder_name, bidang, province_code, sk_number, started_at, ended_at, change_reason, actor_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      provPos?.id || `pos-korwil-${pCode}`,
      provPos?.title || `Koordinator Wilayah ${PROVINCE_BY_CODE.get(pCode)?.name ?? pCode}`,
      inPersId,
      String(h.incoming_coordinator_name),
      provPos?.bidang || 'Bidang Pengembangan Wilayah',
      pCode,
      String(h.reference_number),
      now,
      `Serah terima resmi dari ${String(h.outgoing_coordinator_name)}`,
      req.authUser!.fullName,
      now
    );

    if (inPersId) {
      const inUser = db.prepare('SELECT id FROM users WHERE personnel_id = ? OR id = ? LIMIT 1').get(inPersId, inPersId) as { id: string } | undefined;
      if (inUser) {
        createNotificationIdempotent(db, {
          userId: inUser.id,
          title: `Penetapan Koordinator Wilayah ${PROVINCE_BY_CODE.get(pCode)?.name ?? pCode}`,
          message: `Anda resmi ditetapkan menerima serah terima ${String(h.reference_number)}.`,
          category: 'wilayah',
          targetPath: `/wilayah/${pCode}`,
          eventKey: `hnd_in_${String(h.id)}`,
        });
      }
    }

    recordApprovalHistory(db, {
      entityType: 'handover',
      entityId: String(h.id),
      action: 'approve',
      fromStatus: 'menunggu_persetujuan',
      toStatus: 'disetujui',
      stageLabel: 'Pengesahan Serah Terima & Rotasi Sesi',
      actor: req.authUser!,
      note: `${String(h.outgoing_coordinator_name)} -> ${String(h.incoming_coordinator_name)}`,
    });

    writeAuditLog(db, req.authUser!, 'APPROVE_HANDOVER', 'handover', String(h.reference_number), 'berhasil', `Serah terima ke ${h.incoming_coordinator_name}; sesi lama dicabut`);
    writeActivityTimeline(db, 'Organisasi', `Serah Terima Koordinator ${PROVINCE_BY_CODE.get(pCode)?.name}`, `Berita acara ${h.reference_number} disahkan.`, req.authUser!.fullName, pCode, null, '/wilayah');
    res.json({ ok: true });
  });

  // Location verification (On-Demand ONLY, no background tracking)
  app.get('/api/location/logs', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const isNational = ['super_admin', 'wakil_super_admin', 'penanggung_jawab', 'sekretariat_nasional'].includes(req.authUser!.role);
    const logs = db
      .prepare(
        `SELECT * FROM location_verifications ${isNational ? '' : 'WHERE user_id = ?'} ORDER BY created_at DESC LIMIT 20`
      )
      .all(...(isNational ? [] : [req.authUser!.id])) as Record<string, unknown>[];

    const exceptions = db
      .prepare(
        `SELECT * FROM location_exceptions ${isNational ? '' : 'WHERE user_id = ?'} ORDER BY created_at DESC LIMIT 20`
      )
      .all(...(isNational ? [] : [req.authUser!.id])) as Record<string, unknown>[];

    res.json({ logs, exceptions });
  });

  app.post('/api/location/verify', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { latitude, longitude, provinceCode, actionType, mode, reportedLocationText } = req.body ?? {};
    const targetProvince = String(provinceCode || req.authUser!.provinceCode || '31');
    const db = getDb();

    let matched = false;
    let reason = '';
    let verifiedProof = '';
    if (mode === 'manual_daring') {
      matched = true;
      reason = 'Verifikasi manual / kegiatan daring tercatat tanpa GPS fisik.';
      verifiedProof = 'Daring / Pengecualian Manual Terverifikasi';
    } else if (typeof latitude === 'number' && typeof longitude === 'number') {
      const check = verifyCoordinateInProvince(latitude, longitude, targetProvince);
      matched = check.matched;
      reason = check.reason;
      verifiedProof = `GPS Browser (${latitude.toFixed(4)}, ${longitude.toFixed(4)}) -> ${check.matched ? 'Sesuai Provinsi' : 'Luar Batas Provinsi'}`;
    } else {
      matched = false;
      reason = 'Koordinat lokasi browser tidak tersedia atau izin lokasi ditolak.';
      verifiedProof = 'Tidak ada bukti koordinat GPS';
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO location_verifications (id, user_id, user_name, province_code, action_type, latitude, longitude, matched, verification_mode, reason, reported_location_text, verified_location_proof, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.authUser!.id,
      req.authUser!.fullName,
      targetProvince,
      String(actionType || 'aksi_wilayah'),
      latitude ?? null,
      longitude ?? null,
      matched ? 1 : 0,
      String(mode || 'gps_browser'),
      reason,
      String(reportedLocationText || PROVINCE_BY_CODE.get(targetProvince)?.name || targetProvince),
      verifiedProof,
      new Date().toISOString()
    );

    res.json({
      id,
      matched,
      reason,
      reportedLocationText: String(reportedLocationText || PROVINCE_BY_CODE.get(targetProvince)?.name || targetProvince),
      verifiedLocationProof: verifiedProof,
      provinceName: PROVINCE_BY_CODE.get(targetProvince)?.name ?? targetProvince,
    });
  });

  app.post('/api/location/exceptions', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { provinceCode, reason, evidenceNote, validUntil } = req.body ?? {};
    if (!reason || !validUntil) {
      res.status(422).json({ error: 'Alasan dan masa berlaku pengecualian wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO location_exceptions (id, user_id, user_name, province_code, reason, evidence_note, valid_until, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'menunggu', ?)`
    ).run(id, req.authUser!.id, req.authUser!.fullName, String(provinceCode || req.authUser!.provinceCode || '31'), String(reason), String(evidenceNote || ''), String(validUntil), new Date().toISOString());

    writeAuditLog(db, req.authUser!, 'REQUEST_LOCATION_EXCEPTION', 'location_exception', id);
    res.status(201).json({ ok: true, id });
  });

  app.post('/api/location/exceptions/:id/decide', requireAuth, requirePermission('wilayah', 'manage'), (req: AuthenticatedRequest, res: Response) => {
    const { decision } = req.body ?? {};
    const status = decision === 'disetujui' ? 'disetujui' : 'ditolak';
    const db = getDb();
    const ex = db.prepare('SELECT * FROM location_exceptions WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!ex) {
      res.status(404).json({ error: 'Pengajuan pengecualian lokasi tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== String(ex.province_code)) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'location_exception', String(ex.id), 'ditolak', 'Koordinator mencoba memutus pengecualian provinsi lain');
      res.status(403).json({ error: 'Koordinator hanya dapat memutus pengecualian di wilayahnya.' });
      return;
    }
    if (String(ex.status) !== 'menunggu') {
      res.status(409).json({ error: 'Pengajuan pengecualian ini sudah diputuskan.' });
      return;
    }
    db.prepare('UPDATE location_exceptions SET status = ?, decided_by = ? WHERE id = ?').run(status, user.fullName, String(ex.id));
    writeAuditLog(db, user, 'DECIDE_LOCATION_EXCEPTION', 'location_exception', String(ex.id), 'berhasil', status);
    res.json({ ok: true });
  });

  // ==================== PERSONNEL & ACCOUNT REQUESTS ====================
  app.get('/api/personnel', requireAuth, requirePermission('personalia', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    let sql = `SELECT p.*, b.name AS batch_name FROM personnel p LEFT JOIN batches b ON b.id = p.batch_id WHERE 1=1`;
    const params: string[] = [];

    if (user.role === 'duta' || user.role === 'alumni') {
      sql += ' AND p.id = ?';
      params.push(user.personnelId || '__none__');
    } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
      sql += ' AND p.province_code = ?';
      params.push(user.provinceCode);
    }

    if (req.query.provinceCode) {
      sql += ' AND p.province_code = ?';
      params.push(String(req.query.provinceCode));
    }
    if (req.query.batchId) {
      sql += ' AND p.batch_id = ?';
      params.push(String(req.query.batchId));
    }
    if (req.query.status) {
      sql += ' AND p.verification_status = ?';
      params.push(String(req.query.status));
    }
    sql += ' ORDER BY p.created_at DESC';

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    res.json({ personnel: rows.map((r) => maskPersonnelRow(r, user)) });
  });

  app.get('/api/personnel/check-duplicate', requireAuth, requirePermission('personalia', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const email = String(req.query.email || '').trim().toLowerCase();
    const nisn = String(req.query.nisn || '').trim();
    const fullName = String(req.query.fullName || '').trim().toLowerCase();
    const excludeId = String(req.query.excludeId || '');
    const db = getDb();

    const matches: { id: string; fullName: string; memberNumber: string; provinceName: string; reason: string }[] = [];
    if (email) {
      const rows = db.prepare('SELECT id, full_name, member_number, province_code FROM personnel WHERE LOWER(email) = ? AND id != ?').all(email, excludeId) as Record<string, unknown>[];
      for (const r of rows) {
        matches.push({ id: String(r.id), fullName: String(r.full_name), memberNumber: String(r.member_number), provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? '', reason: 'Email sama sudah terdaftar' });
      }
    }
    if (nisn && nisn.length >= 6 && nisn !== '-') {
      const rows = db.prepare('SELECT id, full_name, member_number, province_code FROM personnel WHERE nisn = ? AND id != ?').all(nisn, excludeId) as Record<string, unknown>[];
      for (const r of rows) {
        if (!matches.some((m) => m.id === String(r.id))) {
          matches.push({ id: String(r.id), fullName: String(r.full_name), memberNumber: String(r.member_number), provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? '', reason: 'NISN sama sudah terdaftar' });
        }
      }
    }
    if (fullName && fullName.length >= 4) {
      const rows = db.prepare('SELECT id, full_name, member_number, province_code FROM personnel WHERE LOWER(full_name) = ? AND id != ?').all(fullName, excludeId) as Record<string, unknown>[];
      for (const r of rows) {
        if (!matches.some((m) => m.id === String(r.id))) {
          matches.push({ id: String(r.id), fullName: String(r.full_name), memberNumber: String(r.member_number), provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? '', reason: 'Nama lengkap identik tercatat (cek lintas angkatan)' });
        }
      }
    }
    res.json({ duplicates: matches });
  });

  app.post('/api/personnel', requireAuth, requirePermission('personalia', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.fullName || !b.email || !b.provinceCode) {
      res.status(422).json({ error: 'Nama lengkap, email, dan provinsi wajib diisi.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== b.provinceCode) {
      res.status(403).json({ error: 'Koordinator hanya dapat menambahkan personel di provinsinya sendiri.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    const refNo = nextReferenceNumber(db, 'PERS');
    const memberNo = `DPBI-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO personnel (
        id, member_number, reference_number, full_name, nickname, birth_place, birth_date, gender,
        email, phone, province_code, assignment_province_code, regency_code, regency, district, village, postal_code, full_address,
        school_name, education_level, grade_class, major, npsn, nisn,
        batch_id, position_title, bidang, role_code, personnel_status, verification_status,
        guardian_name, guardian_relation, guardian_phone, docs_checklist_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 'menunggu_verifikasi', ?, ?, ?, ?, ?, ?)`
    ).run(
      id, memberNo, refNo, String(b.fullName), String(b.nickname || ''), String(b.birthPlace || ''), String(b.birthDate || ''), String(b.gender || ''),
      String(b.email).toLowerCase(), String(b.phone || ''), String(b.provinceCode), String(b.assignmentProvinceCode || b.provinceCode),
      b.regencyCode ? String(b.regencyCode) : null, String(b.regency || ''), String(b.district || ''), String(b.village || ''), String(b.postalCode || ''), String(b.fullAddress || ''),
      String(b.schoolName || ''), String(b.educationLevel || 'SMA/SMK/MA'), String(b.gradeClass || ''), String(b.major || ''), String(b.npsn || ''), String(b.nisn || ''),
      String(b.batchId || 'batch-3'), String(b.positionTitle || 'Duta Pelajar Berbudaya'), String(b.bidang || 'Bidang Pendidikan & Kebudayaan'), String(b.roleCode || 'duta'),
      String(b.guardianName || ''), String(b.guardianRelation || ''), String(b.guardianPhone || ''),
      JSON.stringify(b.docsChecklist || { pasFoto: false, kartuPelajar: false, suratSekolah: false, izinWali: false, suratKesediaan: false }),
      now, now
    );

    writeAuditLog(db, user, 'CREATE_PERSONNEL', 'personnel', refNo);
    writeActivityTimeline(db, 'Personalia', `Personel Baru ${b.fullName}`, `${refNo} didaftarkan di ${PROVINCE_BY_CODE.get(String(b.provinceCode))?.name}.`, user.fullName, String(b.provinceCode), String(b.batchId || 'batch-3'), '/personalia');
    res.status(201).json({ ok: true, id, referenceNumber: refNo, memberNumber: memberNo });
  });

  app.get('/api/personnel/:id/history', requireAuth, requirePermission('personalia', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const id = String(req.params.id);
    const user = req.authUser!;
    const person = db.prepare('SELECT id, province_code FROM personnel WHERE id = ?').get(id) as { id: string; province_code: string } | undefined;
    if (!person) {
      res.status(404).json({ error: 'Personel tidak ditemukan.' });
      return;
    }
    if ((user.role === 'duta' || user.role === 'alumni') && user.personnelId !== id) {
      res.status(403).json({ error: 'Akses riwayat personel lain dibatasi.' });
      return;
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== person.province_code) {
      res.status(403).json({ error: 'Personel berada di luar wilayah Anda.' });
      return;
    }
    if (req.query.reveal === '1') {
      logSensitivePiiAccess(db, user, 'personnel', id, 'Membuka detail riwayat & identitas personel');
    }
    const proposals = db.prepare('SELECT id, reference_number, title, status, event_date FROM proposals WHERE applicant_personnel_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
    const lkl = db.prepare('SELECT id, reference_number, activity_name, status, event_date, participant_count FROM lkl_reports WHERE submitter_personnel_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
    const evaluations = db.prepare('SELECT id, total_score, evaluator_type, coaching_recommendation, evaluator_name, created_at FROM evaluations WHERE personnel_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
    const positionHistory = db.prepare('SELECT * FROM org_position_history WHERE personnel_id = ? ORDER BY started_at DESC LIMIT 20').all(id);
    res.json({ proposals, lkl, evaluations, positionHistory });
  });

  app.patch('/api/personnel/:id', requireAuth, requirePermission('personalia', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM personnel WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Personel tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'duta' && user.personnelId !== id) {
      res.status(403).json({ error: 'Duta hanya dapat mengubah profil pribadinya sendiri.' });
      return;
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== existing.province_code) {
      res.status(403).json({ error: 'Koordinator hanya dapat mengelola personel di wilayahnya.' });
      return;
    }
    const b = req.body ?? {};
    db.prepare(
      `UPDATE personnel SET
        full_name = COALESCE(?, full_name),
        nickname = COALESCE(?, nickname),
        birth_place = COALESCE(?, birth_place),
        birth_date = COALESCE(?, birth_date),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        assignment_province_code = COALESCE(?, assignment_province_code),
        regency_code = COALESCE(?, regency_code),
        regency = COALESCE(?, regency),
        district = COALESCE(?, district),
        village = COALESCE(?, village),
        postal_code = COALESCE(?, postal_code),
        full_address = COALESCE(?, full_address),
        school_name = COALESCE(?, school_name),
        education_level = COALESCE(?, education_level),
        grade_class = COALESCE(?, grade_class),
        major = COALESCE(?, major),
        npsn = COALESCE(?, npsn),
        nisn = COALESCE(?, nisn),
        guardian_name = COALESCE(?, guardian_name),
        guardian_relation = COALESCE(?, guardian_relation),
        guardian_phone = COALESCE(?, guardian_phone),
        cultural_interests = COALESCE(?, cultural_interests),
        activity_interests = COALESCE(?, activity_interests),
        org_experience = COALESCE(?, org_experience),
        skills = COALESCE(?, skills),
        avatar_file_id = COALESCE(?, avatar_file_id),
        docs_checklist_json = COALESCE(?, docs_checklist_json),
        position_title = COALESCE(?, position_title),
        bidang = COALESCE(?, bidang),
        role_code = COALESCE(?, role_code),
        updated_at = ?
       WHERE id = ?`
    ).run(
      b.fullName ?? null,
      b.nickname ?? null,
      b.birthPlace ?? null,
      b.birthDate ?? null,
      b.gender ?? null,
      b.phone ?? null,
      b.assignmentProvinceCode ?? null,
      b.regencyCode ?? null,
      b.regency ?? null,
      b.district ?? null,
      b.village ?? null,
      b.postalCode ?? null,
      b.fullAddress ?? null,
      b.schoolName ?? null,
      b.educationLevel ?? null,
      b.gradeClass ?? null,
      b.major ?? null,
      b.npsn ?? null,
      b.nisn ?? null,
      b.guardianName ?? null,
      b.guardianRelation ?? null,
      b.guardianPhone ?? null,
      b.culturalInterests ?? null,
      b.activityInterests ?? null,
      b.orgExperience ?? null,
      b.skills ?? null,
      b.avatarFileId ?? null,
      b.docsChecklist ? JSON.stringify(b.docsChecklist) : null,
      user.role !== 'duta' ? (b.positionTitle ?? null) : null,
      user.role !== 'duta' ? (b.bidang ?? null) : null,
      user.role !== 'duta' ? (b.roleCode ?? null) : null,
      new Date().toISOString(),
      id
    );
    if (user.role !== 'duta' && (b.positionTitle || b.bidang) && (b.positionTitle !== existing.position_title || b.bidang !== existing.bidang)) {
      const nowIso = new Date().toISOString();
      db.prepare('UPDATE org_position_history SET ended_at = ? WHERE personnel_id = ? AND ended_at IS NULL').run(nowIso, id);
      db.prepare(
        `INSERT INTO org_position_history (id, position_id, position_title, personnel_id, holder_name, bidang, province_code, sk_number, started_at, ended_at, change_reason, actor_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, NULL, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        `pers-pos-${id}`,
        String(b.positionTitle || existing.position_title || 'Duta Pelajar Berbudaya'),
        id,
        String(b.fullName || existing.full_name),
        String(b.bidang || existing.bidang || 'Kebudayaan'),
        String(existing.province_code),
        nowIso,
        String(b.positionChangeReason || 'Pembaruan jabatan pada profil personel'),
        user.fullName,
        nowIso
      );
    }
    writeAuditLog(db, user, 'UPDATE_PERSONNEL', 'personnel', String(existing.reference_number));
    res.json({ ok: true });
  });

  app.post('/api/personnel/:id/verify', requireAuth, requirePermission('personalia', 'review'), (req: AuthenticatedRequest, res: Response) => {
    const { status, note } = req.body ?? {};
    const validStatuses = ['terverifikasi', 'perlu_perbaikan', 'tidak_valid', 'menunggu_verifikasi'];
    if (!validStatuses.includes(String(status))) {
      res.status(422).json({ error: 'Status verifikasi tidak valid.' });
      return;
    }
    const db = getDb();
    const existing = db.prepare('SELECT * FROM personnel WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Personel tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== String(existing.province_code)) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'personnel', String(existing.reference_number), 'ditolak', 'Koordinator mencoba verifikasi personel luar provinsi');
      res.status(403).json({ error: 'Koordinator hanya dapat memverifikasi personel di wilayahnya sendiri.' });
      return;
    }
    if (status === 'terverifikasi') {
      const docs = JSON.parse(String(existing.docs_checklist_json || '{}'));
      if (!docs.pasFoto || !docs.kartuPelajar) {
        res.status(422).json({ error: 'Tidak dapat memverifikasi sebelum dokumen wajib (Pas Foto & Kartu Pelajar) dicentang/diperiksa.' });
        return;
      }
    }
    db.prepare('UPDATE personnel SET verification_status = ?, verification_note = ?, updated_at = ? WHERE id = ?').run(
      String(status),
      String(note || ''),
      new Date().toISOString(),
      String(existing.id)
    );
    writeAuditLog(db, user, 'VERIFY_PERSONNEL', 'personnel', String(existing.reference_number), 'berhasil', `${status}: ${note || ''}`);
    res.json({ ok: true });
  });

  app.get('/api/personnel/import-template', requireAuth, requirePermission('personalia', 'view'), (_req, res: Response) => {
    const header = ['fullName', 'email', 'provinceCode', 'schoolName', 'batchId', 'nisn', 'phone', 'regency', 'positionTitle', 'bidang', 'roleCode'];
    const sample = ['Alya Ramadhani', 'alya.calon@dpbi.or.id', '32', 'SMAN 3 Bandung', 'batch-3', '0089123456', '081234567890', 'Kota Bandung', 'Duta Pelajar Berbudaya', 'Bidang Pendidikan & Kebudayaan', 'duta'];
    const csv = [header.map(csvSafeCell).join(','), sample.map(csvSafeCell).join(',')].join('\n');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="template-impor-personel-satu-dpbi.csv"');
    res.send(csv);
  });

  app.get('/api/personnel/import-batches', requireAuth, requirePermission('personalia', 'view'), (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const batches = db.prepare('SELECT * FROM import_batches ORDER BY created_at DESC LIMIT 30').all();
    res.json({ batches });
  });

  app.post('/api/personnel/import', requireAuth, requirePermission('personalia', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const fileName = String(req.body?.fileName || 'impor-personel.csv').trim();
    if (rows.length === 0) {
      res.status(422).json({ error: 'Tidak ada baris data yang dikirim untuk diimpor.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const now = new Date().toISOString();
    const batchImportId = crypto.randomUUID();
    let inserted = 0;
    const skipped: { row: number; email: string; reason: string }[] = [];

    db.exec('BEGIN IMMEDIATE;');
    try {
      for (let i = 0; i < rows.length; i += 1) {
        const r = rows[i] as Record<string, unknown>;
        const email = String(r.email || '').trim().toLowerCase();
        const fullName = String(r.fullName || '').trim();
        const nisn = String(r.nisn || '').trim();
        const memberNoInput = String(r.memberNumber || '').trim();
        const prov = String(r.provinceCode || user.provinceCode || '31').trim();

        if (!email || !fullName) {
          skipped.push({ row: i + 1, email: email || '(kosong)', reason: 'Nama atau email kosong' });
          continue;
        }
        if (user.role === 'koordinator_wilayah' && prov !== user.provinceCode) {
          skipped.push({ row: i + 1, email, reason: `Di luar wilayah Koordinator (${prov})` });
          continue;
        }
        const dupEmail = db.prepare('SELECT id FROM personnel WHERE LOWER(email) = ?').get(email);
        if (dupEmail) {
          skipped.push({ row: i + 1, email, reason: 'Email duplikat sudah terdaftar' });
          continue;
        }
        if (nisn && nisn.length >= 6 && nisn !== '-') {
          const dupNisn = db.prepare('SELECT id FROM personnel WHERE nisn = ?').get(nisn);
          if (dupNisn) {
            skipped.push({ row: i + 1, email, reason: `NISN ${nisn} duplikat sudah terdaftar` });
            continue;
          }
        }
        if (memberNoInput) {
          const dupMem = db.prepare('SELECT id FROM personnel WHERE member_number = ?').get(memberNoInput);
          if (dupMem) {
            skipped.push({ row: i + 1, email, reason: `Nomor anggota ${memberNoInput} sudah terdaftar` });
            continue;
          }
        }

        const refNo = nextReferenceNumber(db, 'PERS');
        const memberNo = memberNoInput || `DPBI-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
        db.prepare(
          `INSERT INTO personnel (id, member_number, reference_number, full_name, email, phone, province_code, regency, school_name, nisn, batch_id, position_title, bidang, role_code, personnel_status, verification_status, import_batch_id, docs_checklist_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 'menunggu_verifikasi', ?, '{}', ?, ?)`
        ).run(
          crypto.randomUUID(),
          memberNo,
          refNo,
          fullName,
          email,
          String(r.phone || ''),
          prov,
          String(r.regency || ''),
          String(r.schoolName || ''),
          nisn,
          String(r.batchId || 'batch-3'),
          String(r.positionTitle || 'Duta Pelajar Berbudaya'),
          String(r.bidang || 'Bidang Pendidikan & Kebudayaan'),
          String(r.roleCode || 'duta'),
          batchImportId,
          now,
          now
        );
        inserted += 1;
      }

      db.prepare(
        `INSERT INTO import_batches (id, file_name, total_rows, success_count, skipped_count, error_count, status, imported_by, imported_by_name, notes, created_at)
         VALUES (?, ?, ?, ?, ?, 0, 'selesai', ?, ?, ?, ?)`
      ).run(
        batchImportId,
        fileName,
        rows.length,
        inserted,
        skipped.length,
        user.id,
        user.fullName,
        `Impor massal CSV oleh ${user.fullName}: ${inserted} masuk, ${skipped.length} dilewati.`,
        now
      );
      db.exec('COMMIT;');
    } catch {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: 'Gagal memproses impor massal dalam transaksi database.' });
      return;
    }
    writeAuditLog(db, user, 'BULK_IMPORT_PERSONNEL', 'import_batch', batchImportId, 'berhasil', `Masuk: ${inserted}, Dilewati: ${skipped.length}`);
    res.json({ ok: true, batchId: batchImportId, inserted, skipped });
  });

  app.post('/api/personnel/import-batches/:id/rollback', requireAuth, requirePermission('personalia', 'manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const batchId = String(req.params.id);
    const batch = db.prepare('SELECT * FROM import_batches WHERE id = ?').get(batchId) as Record<string, unknown> | undefined;
    if (!batch) {
      res.status(404).json({ error: 'Batch impor tidak ditemukan.' });
      return;
    }
    if (String(batch.status) === 'dibatalkan_rollback') {
      res.status(409).json({ error: 'Batch impor ini sudah di-rollback sebelumnya.' });
      return;
    }
    const candidates = db.prepare('SELECT id, user_id, full_name FROM personnel WHERE import_batch_id = ?').all(batchId) as { id: string; user_id: string | null; full_name: string }[];
    let deletedCount = 0;
    let retainedCount = 0;
    const now = new Date().toISOString();

    db.exec('BEGIN IMMEDIATE;');
    try {
      for (const c of candidates) {
        const hasProp = db.prepare('SELECT 1 FROM proposals WHERE applicant_personnel_id = ? LIMIT 1').get(c.id);
        const hasLkl = db.prepare('SELECT 1 FROM lkl_reports WHERE submitter_personnel_id = ? LIMIT 1').get(c.id);
        if (c.user_id || hasProp || hasLkl) {
          retainedCount += 1;
        } else {
          db.prepare('DELETE FROM personnel WHERE id = ?').run(c.id);
          deletedCount += 1;
        }
      }
      db.prepare("UPDATE import_batches SET status = 'dibatalkan_rollback', rolled_back_at = ?, notes = notes || ? WHERE id = ?").run(
        now,
        ` | Rollback oleh ${user.fullName}: ${deletedCount} dihapus, ${retainedCount} dipertahankan karena sudah tertaut aktivitas/akun.`,
        batchId
      );
      db.exec('COMMIT;');
    } catch {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: 'Gagal membatalkan batch impor.' });
      return;
    }
    writeAuditLog(db, user, 'ROLLBACK_IMPORT_BATCH', 'import_batch', batchId, 'berhasil', `Dihapus: ${deletedCount}, Dipertahankan: ${retainedCount}`);
    res.json({ ok: true, deletedCount, retainedCount });
  });

  // ==================== INVITATION LIFECYCLE ====================
  app.get('/api/invitations', requireAuth, requirePermission('personalia', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    let sql = 'SELECT * FROM invitations WHERE 1=1';
    const params: string[] = [];
    if (user.role === 'koordinator_wilayah' && user.provinceCode) {
      sql += ' AND province_code = ?';
      params.push(user.provinceCode);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    res.json({
      invitations: rows.map((r) => ({
        id: String(r.id),
        email: String(r.email),
        fullName: String(r.full_name),
        role: String(r.role) as RoleCode,
        roleLabel: ROLE_LABELS[r.role as RoleCode] ?? String(r.role),
        provinceCode: r.province_code ? String(r.province_code) : null,
        provinceName: r.province_code ? PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code) : 'Nasional',
        batchId: String(r.batch_id || 'batch-3'),
        personnelId: r.personnel_id ? String(r.personnel_id) : null,
        status: String(r.status || (r.used_at ? 'aktif' : 'undangan_terkirim')),
        resendCount: Number(r.resend_count || 0),
        lastSentAt: r.last_sent_at ? String(r.last_sent_at) : String(r.created_at),
        openedAt: r.opened_at ? String(r.opened_at) : null,
        expiresAt: String(r.expires_at),
        usedAt: r.used_at ? String(r.used_at) : null,
        cancelledAt: r.cancelled_at ? String(r.cancelled_at) : null,
        cancelledBy: r.cancelled_by ? String(r.cancelled_by) : null,
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/invitations', requireAuth, requirePermission('personalia', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const { email, fullName, role, provinceCode, batchId, personnelId } = req.body ?? {};
    if (!email || !fullName) {
      res.status(422).json({ error: 'Nama lengkap dan email penerima undangan wajib diisi.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const cleanEmail = String(email).trim().toLowerCase();
    const existingUser = db.prepare('SELECT id FROM users WHERE LOWER(email) = ?').get(cleanEmail);
    if (existingUser) {
      res.status(409).json({ error: 'Email tersebut sudah memiliki akun login aktif.' });
      return;
    }
    const prov = provinceCode ? String(provinceCode) : (user.provinceCode || '31');
    if (user.role === 'koordinator_wilayah' && user.provinceCode && prov !== user.provinceCode) {
      res.status(403).json({ error: 'Koordinator hanya dapat mengirim undangan untuk provinsinya sendiri.' });
      return;
    }
    const id = crypto.randomUUID();
    const rawToken = crypto.randomBytes(20).toString('hex');
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 72 * 3600000).toISOString();

    db.prepare(
      `INSERT INTO invitations (id, email, full_name, role, province_code, batch_id, personnel_id, token_hash, status, resend_count, last_sent_at, expires_at, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'undangan_terkirim', 0, ?, ?, ?, ?)`
    ).run(
      id,
      cleanEmail,
      String(fullName).trim(),
      String(role || 'duta'),
      prov,
      String(batchId || 'batch-3'),
      personnelId ? String(personnelId) : null,
      sha256(rawToken),
      now,
      exp,
      user.id,
      now
    );

    writeAuditLog(db, user, 'CREATE_INVITATION', 'invitation', cleanEmail, 'berhasil', `Role: ${role || 'duta'}`);
    res.status(201).json({
      ok: true,
      id,
      expiresAt: exp,
      activationLink: IS_DEMO_MODE ? `/aktivasi-undangan?token=${rawToken}` : undefined,
      inviteToken: IS_DEMO_MODE ? rawToken : undefined,
    });
  });

  app.post('/api/invitations/:id/resend', requireAuth, requirePermission('personalia', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const id = String(req.params.id);
    const inv = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!inv) {
      res.status(404).json({ error: 'Undangan tidak ditemukan.' });
      return;
    }
    if (String(inv.status) === 'aktif' || inv.used_at || String(inv.status) === 'dibatalkan') {
      res.status(409).json({ error: `Undangan berstatus ${String(inv.status)} tidak dapat dikirim ulang.` });
      return;
    }
    const lastSentMs = Date.parse(String(inv.last_sent_at || inv.created_at));
    const elapsedSec = Math.floor((Date.now() - lastSentMs) / 1000);
    if (Number.isFinite(elapsedSec) && elapsedSec < 60) {
      res.status(429).json({ error: `Harap tunggu ${60 - elapsedSec} detik sebelum mengirim ulang undangan.`, code: 429 });
      return;
    }

    const rawToken = crypto.randomBytes(20).toString('hex');
    const now = new Date().toISOString();
    const exp = new Date(Date.now() + 72 * 3600000).toISOString();
    const nextResend = Number(inv.resend_count || 0) + 1;

    db.prepare(
      `UPDATE invitations
       SET token_hash = ?, status = 'undangan_terkirim', resend_count = ?, last_sent_at = ?, expires_at = ?
       WHERE id = ?`
    ).run(sha256(rawToken), nextResend, now, exp, id);

    writeAuditLog(db, user, 'RESEND_INVITATION', 'invitation', String(inv.email), 'berhasil', `Kirim ulang ke-${nextResend}`);
    res.json({
      ok: true,
      resendCount: nextResend,
      expiresAt: exp,
      activationLink: IS_DEMO_MODE ? `/aktivasi-undangan?token=${rawToken}` : undefined,
      inviteToken: IS_DEMO_MODE ? rawToken : undefined,
    });
  });

  app.post('/api/invitations/:id/cancel', requireAuth, requirePermission('personalia', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const id = String(req.params.id);
    const inv = db.prepare('SELECT * FROM invitations WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!inv) {
      res.status(404).json({ error: 'Undangan tidak ditemukan.' });
      return;
    }
    if (String(inv.status) === 'aktif' || inv.used_at) {
      res.status(409).json({ error: 'Akun undangan sudah aktif dan tidak dapat dibatalkan.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE invitations SET status = 'dibatalkan', cancelled_at = ?, cancelled_by = ? WHERE id = ?").run(
      now,
      user.fullName,
      id
    );
    writeAuditLog(db, user, 'CANCEL_INVITATION', 'invitation', String(inv.email), 'berhasil', 'Undangan dibatalkan sebelum aktivasi');
    res.json({ ok: true });
  });

  app.get('/api/account-requests', requireAuth, requirePermission('personalia', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const rows = db
      .prepare(
        `SELECT * FROM account_requests ${user.role === 'koordinator_wilayah' && user.provinceCode ? 'WHERE province_code = ?' : ''} ORDER BY created_at DESC`
      )
      .all(...(user.role === 'koordinator_wilayah' && user.provinceCode ? [user.provinceCode] : [])) as Record<string, unknown>[];

    res.json({
      requests: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        fullName: String(r.full_name),
        email: String(r.email),
        phone: String(r.phone),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        batchId: String(r.batch_id),
        schoolName: String(r.school_name),
        requestedByName: String(r.requested_by_name),
        status: String(r.status),
        decisionNote: r.decision_note ? String(r.decision_note) : null,
        decidedBy: r.decided_by ? String(r.decided_by) : null,
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/account-requests', requireAuth, requirePermission('personalia', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const { fullName, email, phone, provinceCode, batchId, schoolName } = req.body ?? {};
    if (!fullName || !email || !provinceCode || !schoolName) {
      res.status(422).json({ error: 'Nama calon Duta, email, provinsi, dan nama sekolah wajib diisi.' });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, 'AKUN');
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO account_requests (id, reference_number, full_name, email, phone, province_code, batch_id, school_name, requested_by_user_id, requested_by_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?)`
    ).run(id, refNo, String(fullName), String(email).toLowerCase(), String(phone || ''), String(provinceCode), String(batchId || 'batch-3'), String(schoolName), req.authUser!.id, req.authUser!.fullName, new Date().toISOString());

    writeAuditLog(db, req.authUser!, 'CREATE_ACCOUNT_REQUEST', 'account_request', refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.post('/api/account-requests/:id/decide', requireAuth, requirePermission('personalia', 'review'), (req: AuthenticatedRequest, res: Response) => {
    if (!['super_admin', 'wakil_super_admin', 'sekretariat_nasional'].includes(req.authUser!.role)) {
      res.status(403).json({ error: 'Persetujuan permintaan akun Duta hanya dapat dilakukan pihak Nasional.' });
      return;
    }
    const { decision, note } = req.body ?? {};
    if (!['disetujui', 'ditolak'].includes(String(decision))) {
      res.status(422).json({ error: 'Keputusan harus disetujui atau ditolak.' });
      return;
    }
    const db = getDb();
    const reqRow = db.prepare('SELECT * FROM account_requests WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!reqRow) {
      res.status(404).json({ error: 'Permintaan akun tidak ditemukan.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE account_requests SET status = ?, decision_note = ?, decided_by = ?, decided_at = ? WHERE id = ?').run(
      String(decision),
      String(note || ''),
      req.authUser!.fullName,
      now,
      String(reqRow.id)
    );

    let inviteToken: string | null = null;
    if (decision === 'disetujui') {
      inviteToken = crypto.randomBytes(20).toString('hex');
      const exp = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
      db.prepare(
        `INSERT INTO invitations (id, email, full_name, role, province_code, batch_id, token_hash, expires_at, created_by, created_at)
         VALUES (?, ?, ?, 'duta', ?, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), String(reqRow.email), String(reqRow.full_name), String(reqRow.province_code), String(reqRow.batch_id), sha256(inviteToken), exp, req.authUser!.id, now);
    }

    writeAuditLog(db, req.authUser!, 'DECIDE_ACCOUNT_REQUEST', 'account_request', String(reqRow.reference_number), 'berhasil', String(decision));
    res.json({ ok: true, inviteToken });
  });

  // ==================== ORGANIZATION & BATCHES ====================
  app.get('/api/organization', requireAuth, requirePermission('organisasi', 'view'), (_req, res: Response) => {
    const db = getDb();
    const positions = db.prepare('SELECT * FROM organization_positions ORDER BY sort_order ASC, level ASC, title ASC').all();
    const delegations = db.prepare('SELECT * FROM delegations ORDER BY created_at DESC').all();
    const positionHistory = db.prepare('SELECT * FROM org_position_history ORDER BY created_at DESC LIMIT 60').all();
    res.json({ positions, delegations, positionHistory });
  });

  app.post('/api/organization/positions', requireAuth, requirePermission('organisasi', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { title, bidang, level, holderPersonnelId, holderName, skNumber, termStartsAt, termEndsAt, parentId, category, roleBinding } = req.body ?? {};
    if (!title || !bidang) {
      res.status(422).json({ error: 'Nama jabatan dan bidang wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isVacant = !String(holderName || '').trim();
    db.prepare(
      `INSERT INTO organization_positions (id, title, bidang, level, holder_personnel_id, holder_name, sk_number, term_starts_at, term_ends_at, status, parent_id, category, sort_order, is_vacant, role_binding, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?, 30, ?, ?, ?)`
    ).run(
      id,
      String(title),
      String(bidang),
      String(level || 'Nasional'),
      holderPersonnelId ? String(holderPersonnelId) : null,
      isVacant ? null : String(holderName),
      String(skNumber || ''),
      String(termStartsAt || ''),
      String(termEndsAt || ''),
      parentId ? String(parentId) : null,
      String(category || level || 'Bidang'),
      isVacant ? 1 : 0,
      roleBinding ? String(roleBinding) : null,
      now
    );
    if (!isVacant) {
      db.prepare(
        `INSERT INTO org_position_history (id, position_id, position_title, personnel_id, holder_name, bidang, province_code, sk_number, started_at, ended_at, change_reason, actor_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, 'Penetapan jabatan baru', ?, ?)`
      ).run(crypto.randomUUID(), id, String(title), holderPersonnelId ? String(holderPersonnelId) : null, String(holderName), String(bidang), String(skNumber || ''), String(termStartsAt || now), req.authUser!.fullName, now);
    }
    writeAuditLog(db, req.authUser!, 'CREATE_ORG_POSITION', 'organization_position', id);
    res.status(201).json({ ok: true, id });
  });

  app.patch('/api/organization/positions/:id', requireAuth, requirePermission('organisasi', 'assign'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const posId = String(req.params.id);
    const existing = db.prepare('SELECT * FROM organization_positions WHERE id = ?').get(posId) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Jabatan organisasi tidak ditemukan.' });
      return;
    }
    const { holderPersonnelId, holderName, skNumber, termStartsAt, termEndsAt, isVacant, changeReason } = req.body ?? {};
    const vacate = Boolean(isVacant) || !String(holderName || '').trim();
    const now = new Date().toISOString();

    db.prepare('UPDATE org_position_history SET ended_at = ? WHERE position_id = ? AND ended_at IS NULL').run(now, posId);

    db.prepare(
      `UPDATE organization_positions SET
        holder_personnel_id = ?,
        holder_name = ?,
        sk_number = COALESCE(?, sk_number),
        term_starts_at = COALESCE(?, term_starts_at),
        term_ends_at = COALESCE(?, term_ends_at),
        is_vacant = ?
       WHERE id = ?`
    ).run(
      vacate ? null : (holderPersonnelId ? String(holderPersonnelId) : null),
      vacate ? null : String(holderName).trim(),
      skNumber ?? null,
      termStartsAt ?? null,
      termEndsAt ?? null,
      vacate ? 1 : 0,
      posId
    );

    if (!vacate) {
      db.prepare(
        `INSERT INTO org_position_history (id, position_id, position_title, personnel_id, holder_name, bidang, province_code, sk_number, started_at, ended_at, change_reason, actor_name, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL, ?, ?, ?)`
      ).run(
        crypto.randomUUID(),
        posId,
        String(existing.title),
        holderPersonnelId ? String(holderPersonnelId) : null,
        String(holderName).trim(),
        String(existing.bidang),
        skNumber ? String(skNumber) : (existing.sk_number ? String(existing.sk_number) : null),
        termStartsAt ? String(termStartsAt) : now,
        String(changeReason || 'Penetapan pejabat posisi organisasi'),
        req.authUser!.fullName,
        now
      );
    }

    writeAuditLog(db, req.authUser!, 'UPDATE_ORG_POSITION', 'organization_position', posId, 'berhasil', vacate ? 'Posisi dikosongkan (Kosong)' : `Diisi oleh ${String(holderName)}`);
    res.json({ ok: true });
  });

  app.post('/api/organization/delegations', requireAuth, requirePermission('organisasi', 'assign'), (req: AuthenticatedRequest, res: Response) => {
    const { delegateUserId, module, action, provinceCode, startsAt, endsAt, reason } = req.body ?? {};
    if (!delegateUserId || !module || !action || !startsAt || !endsAt || !reason) {
      res.status(422).json({ error: 'Semua data delegasi dan alasan wajib diisi.' });
      return;
    }
    const startMs = Date.parse(String(startsAt));
    const endMs = Date.parse(String(endsAt));
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
      res.status(422).json({ error: 'Rentang waktu delegasi tidak valid: waktu mulai harus lebih awal dari waktu berakhir.' });
      return;
    }
    const user = req.authUser!;
    if (user.role !== 'super_admin' && !hasPermission(user.permissions, String(module) as never, String(action) as never)) {
      res.status(403).json({ error: 'Anda tidak dapat mendelegasikan kewenangan yang tidak Anda miliki.' });
      return;
    }
    const scopedProvince = user.role === 'koordinator_wilayah'
      ? (user.provinceCode || null)
      : (provinceCode ? String(provinceCode) : null);
    if (user.role === 'koordinator_wilayah' && (!scopedProvince || (provinceCode && String(provinceCode) !== user.provinceCode))) {
      res.status(403).json({ error: 'Koordinator Wilayah hanya dapat mendelegasikan kewenangan untuk provinsinya sendiri.' });
      return;
    }
    const db = getDb();
    const targetUser = db.prepare('SELECT id, full_name FROM users WHERE id = ?').get(String(delegateUserId)) as { id: string; full_name: string } | undefined;
    if (!targetUser) {
      res.status(404).json({ error: 'Pengguna penerima delegasi tidak ditemukan.' });
      return;
    }
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO delegations (id, delegate_user_id, delegate_name, grantor_user_id, grantor_name, module, action, province_code, starts_at, ends_at, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?)`
    ).run(id, targetUser.id, targetUser.full_name, user.id, user.fullName, String(module), String(action), scopedProvince, String(startsAt), String(endsAt), String(reason), new Date().toISOString());
    writeAuditLog(db, user, 'CREATE_DELEGATION', 'delegation', id, 'berhasil', `${targetUser.full_name} -> ${module}:${action}`);
    res.status(201).json({ ok: true, id });
  });

  app.post('/api/organization/delegations/:id/revoke', requireAuth, requirePermission('organisasi', 'assign'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    db.prepare("UPDATE delegations SET status = 'dicabut' WHERE id = ?").run(String(req.params.id));
    writeAuditLog(db, req.authUser!, 'REVOKE_DELEGATION', 'delegation', String(req.params.id));
    res.json({ ok: true });
  });

  app.get('/api/batches', requireAuth, requirePermission('angkatan', 'view'), (_req, res: Response) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT b.*,
          (SELECT COUNT(*) FROM personnel p WHERE p.batch_id = b.id) AS personnel_count,
          (SELECT COUNT(*) FROM proposals pr WHERE pr.batch_id = b.id) AS proposal_count,
          (SELECT COUNT(*) FROM lkl_reports l JOIN proposals pr ON pr.id = l.proposal_id WHERE pr.batch_id = b.id) AS lkl_count
         FROM batches b
         ORDER BY b.batch_number DESC`
      )
      .all() as Record<string, unknown>[];
    res.json({
      batches: rows.map((b) => ({
        id: String(b.id),
        batchNumber: Number(b.batch_number),
        name: String(b.name),
        openedAt: String(b.opened_at),
        closedAt: String(b.closed_at),
        briefingAt: String(b.briefing_at),
        termStartsAt: String(b.term_starts_at),
        termEndsAt: String(b.term_ends_at),
        durationMonths: Number(b.duration_months),
        status: String(b.status),
        activePersonnelCount: Number(b.personnel_count),
        proposalCount: Number(b.proposal_count),
        lklCount: Number(b.lkl_count),
      })),
    });
  });

  app.post('/api/batches', requireAuth, requirePermission('angkatan', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const { batchNumber, name, openedAt, closedAt, briefingAt, termStartsAt, termEndsAt, durationMonths, status } = req.body ?? {};
    if (!batchNumber || !name || !termStartsAt || !termEndsAt) {
      res.status(422).json({ error: 'Nomor angkatan, nama batch, dan tanggal masa tugas wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = `batch-${batchNumber}-${Date.now()}`;
    db.prepare(
      `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, Number(batchNumber), String(name),
      String(openedAt || termStartsAt), String(closedAt || termStartsAt), String(briefingAt || termStartsAt),
      String(termStartsAt), String(termEndsAt), Number(durationMonths || 4), String(status || 'perencanaan'), new Date().toISOString()
    );
    writeAuditLog(db, req.authUser!, 'CREATE_BATCH', 'batch', id);
    res.status(201).json({ ok: true, id });
  });

  app.patch('/api/batches/:id', requireAuth, requirePermission('angkatan', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { status, durationMonths } = req.body ?? {};
    const db = getDb();
    db.prepare('UPDATE batches SET status = COALESCE(?, status), duration_months = COALESCE(?, duration_months) WHERE id = ?').run(
      status ?? null,
      durationMonths ? Number(durationMonths) : null,
      String(req.params.id)
    );
    writeAuditLog(db, req.authUser!, 'UPDATE_BATCH', 'batch', String(req.params.id), 'berhasil', `Status: ${status}`);
    res.json({ ok: true });
  });

  // ==================== PROPOSALS & APPROVAL MATRIX ====================
  app.get('/api/proposals', requireAuth, requirePermission('proposal', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const includeTrash = req.query.includeDeleted === '1';
    let sql = `SELECT p.*, b.name AS batch_name FROM proposals p LEFT JOIN batches b ON b.id = p.batch_id WHERE 1=1`;
    if (!includeTrash) {
      sql += ' AND p.soft_deleted_at IS NULL';
    }
    const params: string[] = [];

    if (user.role === 'duta') {
      sql += ' AND p.applicant_personnel_id = ?';
      params.push(user.personnelId || '__none__');
    } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
      sql += ' AND p.province_code = ?';
      params.push(user.provinceCode);
    }
    if (req.query.status) {
      sql += ' AND p.status = ?';
      params.push(String(req.query.status));
    }
    sql += ' ORDER BY p.created_at DESC';

    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    const matrixRules = db.prepare('SELECT * FROM approval_matrix_rules').all();
    const mapped = rows.map((r) => ({
      id: String(r.id),
      referenceNumber: String(r.reference_number),
      version: Number(r.version),
      title: String(r.title),
      applicantPersonnelId: String(r.applicant_personnel_id),
      applicantName: String(r.applicant_name),
      provinceCode: String(r.province_code),
      provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
      batchId: String(r.batch_id),
      batchName: String(r.batch_name || r.batch_id),
      bidang: String(r.bidang),
      category: String(r.category),
      riskLevel: String(r.risk_level),
      usesDpbiIdentity: Boolean(r.uses_dpbi_identity),
      externalPermitNeeded: Boolean(r.external_permit_needed),
      assignedApproverRole: String(r.assigned_approver_role),
      bidangRelevant: user.role === 'pengurus_nasional' ? isRecordRelevantToBidang(user.bidang, String(r.bidang), String(r.category)) : true,
      objective: String(r.objective),
      targetAudience: String(r.target_audience),
      eventDate: String(r.event_date),
      eventTime: String(r.event_time),
      location: String(r.location),
      picName: String(r.pic_name),
      estimatedParticipants: Number(r.estimated_participants),
      activityMode: String(r.activity_mode),
      pdfFileId: r.pdf_file_id ? String(r.pdf_file_id) : null,
      pdfFileName: r.pdf_file_name ? String(r.pdf_file_name) : null,
      status: String(r.status),
      decisionNote: r.decision_note ? String(r.decision_note) : null,
      decidedBy: r.decided_by ? String(r.decided_by) : null,
      decidedAt: r.decided_at ? String(r.decided_at) : null,
      slaDueAt: r.sla_due_at ? String(r.sla_due_at) : null,
      escalatedTo: r.escalated_to ? String(r.escalated_to) : null,
      escalatedAt: r.escalated_at ? String(r.escalated_at) : null,
      cancelledReason: r.cancelled_reason ? String(r.cancelled_reason) : null,
      programId: r.program_id ? String(r.program_id) : null,
      softDeletedAt: r.soft_deleted_at ? String(r.soft_deleted_at) : null,
      createdAt: String(r.created_at),
      updatedAt: String(r.updated_at),
    }));

    const bidangOnly = req.query.bidangOnly === '1';
    res.json({
      proposals: bidangOnly ? mapped.filter((p) => p.bidangRelevant) : mapped,
      activeBidang: user.role === 'pengurus_nasional' ? resolveBidangDefinition(user.bidang) : null,
      matrixRules,
    });
  });

  app.get('/api/proposals/check-duplicate', requireAuth, requirePermission('proposal', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const title = String(req.query.title || '').trim().toLowerCase();
    const eventDate = String(req.query.eventDate || '').trim();
    const provinceCode = String(req.query.provinceCode || req.authUser!.provinceCode || '').trim();
    const excludeId = String(req.query.excludeId || '');
    if (title.length < 4) {
      res.json({ duplicates: [] });
      return;
    }
    const db = getDb();
    const token = title.split(/\s+/).filter((w) => w.length >= 3).slice(0, 3).join('%');
    const rows = db
      .prepare(
        `SELECT id, reference_number, title, event_date, province_code, status
         FROM proposals
         WHERE id != ? AND status NOT IN ('ditolak', 'dibatalkan', 'diarsipkan')
           AND (LOWER(title) LIKE ? OR (event_date = ? AND province_code = ?))
         ORDER BY created_at DESC LIMIT 8`
      )
      .all(excludeId, `%${token || title}%`, eventDate, provinceCode) as Record<string, unknown>[];

    res.json({
      duplicates: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        title: String(r.title),
        eventDate: String(r.event_date),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        status: String(r.status),
      })),
    });
  });

  app.get('/api/proposals/:id/versions', requireAuth, requirePermission('proposal', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const prop = db.prepare('SELECT id, applicant_personnel_id, province_code FROM proposals WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: 'Proposal tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'duta' && prop.applicant_personnel_id !== user.personnelId && prop.applicant_personnel_id !== user.id) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal_versions', String(req.params.id), 'ditolak', 'Duta mencoba melihat versi proposal lain');
      res.status(403).json({ error: 'Anda hanya dapat melihat riwayat versi proposal milik sendiri.' });
      return;
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== prop.province_code) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal_versions', String(req.params.id), 'ditolak', 'Koordinator mencoba melihat versi proposal provinsi lain');
      res.status(403).json({ error: 'Proposal ini berada di luar wilayah provinsi Anda.' });
      return;
    }
    const versions = db.prepare('SELECT * FROM proposal_versions WHERE proposal_id = ? ORDER BY version DESC').all(String(req.params.id));
    res.json({ versions });
  });

  app.post('/api/proposals', requireAuth, requirePermission('proposal', 'create'), idempotencyGuard, (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    const isDraft = Boolean(b.saveAsDraft);
    if (!String(b.title || '').trim()) {
      res.status(422).json({ error: 'Judul kegiatan wajib diisi untuk menyimpan proposal.' });
      return;
    }
    if (!isDraft && (!b.bidang || !b.category || !b.eventDate || !String(b.location || '').trim())) {
      res.status(422).json({ error: 'Judul, bidang, kategori, tanggal, dan lokasi kegiatan wajib diisi sebelum diajukan.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const provCode = String(b.provinceCode || user.provinceCode || '31');
    if ((user.role === 'duta' || user.role === 'koordinator_wilayah') && user.provinceCode && provCode !== user.provinceCode) {
      res.status(403).json({ error: 'Anda hanya dapat mengajukan proposal pada provinsi asal Anda.' });
      return;
    }
    const refNo = nextReferenceNumber(db, 'PROP');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const slaDue = isDraft ? null : new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
    const riskLevel = (['rendah', 'sedang', 'tinggi'].includes(b.riskLevel) ? b.riskLevel : 'rendah') as 'rendah' | 'sedang' | 'tinggi';
    const usesDpbiIdentity = b.usesDpbiIdentity !== false;
    const externalPermitNeeded = Boolean(b.externalPermitNeeded);
    const route = resolveProposalApprover({ category: String(b.category || 'Lokakarya / Literasi Pelajar'), riskLevel, usesDpbiIdentity, externalPermitNeeded });
    const initialStatus = isDraft
      ? 'draft'
      : route.approverRole === 'pengurus_nasional'
      ? 'menunggu_persetujuan_nasional'
      : 'diajukan';

    db.prepare(
      `INSERT INTO proposals (
        id, reference_number, version, title, applicant_personnel_id, applicant_name, province_code, batch_id,
        bidang, category, risk_level, uses_dpbi_identity, external_permit_needed, assigned_approver_role,
        objective, target_audience, event_date, event_time, location, pic_name, estimated_participants,
        activity_mode, pdf_file_id, pdf_file_name, program_id, status, sla_due_at, created_at, updated_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, refNo, String(b.title).trim(), user.personnelId || user.id, user.fullName, provCode, String(b.batchId || user.batchId || 'batch-3'),
      String(b.bidang || 'Kebudayaan'), String(b.category || 'Lokakarya / Literasi Pelajar'), riskLevel, usesDpbiIdentity ? 1 : 0, externalPermitNeeded ? 1 : 0, route.approverRole,
      String(b.objective || ''), String(b.targetAudience || 'Pelajar'), String(b.eventDate || '2026-12-10'), String(b.eventTime || '09:00 WIB'),
      String(b.location || ''), String(b.picName || user.fullName), Number(b.estimatedParticipants || 30), String(b.activityMode || 'luring'),
      b.pdfFileId ? String(b.pdfFileId) : null, b.pdfFileName ? String(b.pdfFileName) : null, b.programId ? String(b.programId) : null,
      initialStatus, slaDue, now, now
    );

    if (!isDraft) {
      recordApprovalHistory(db, {
        entityType: 'proposal',
        entityId: id,
        action: 'submit',
        fromStatus: null,
        toStatus: initialStatus,
        stageLabel: 'Pengajuan Awal Proposal',
        actor: user,
        note: String(b.title).trim(),
      });
    }

    if (b.pdfFileId) {
      db.prepare(
        `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`
      ).run(crypto.randomUUID(), id, String(b.pdfFileId), String(b.pdfFileName || 'proposal.pdf'), isDraft ? 'Simpan draft dokumen proposal' : 'Pengajuan awal dokumen proposal PDF', user.fullName, now);
    }

    writeAuditLog(db, user, isDraft ? 'SAVE_PROPOSAL_DRAFT' : 'SUBMIT_PROPOSAL', 'proposal', refNo);
    if (!isDraft) {
      writeActivityTimeline(db, 'Proposal', `Proposal Baru ${refNo}`, `${b.title} diajukan oleh ${user.fullName}.`, user.fullName, provCode, String(b.batchId || 'batch-3'), '/proposal');
    }

    res.status(201).json({ ok: true, id, referenceNumber: refNo, status: initialStatus, assignedApproverRole: route.approverRole });
  });

  app.patch('/api/proposals/:id', requireAuth, requirePermission('proposal', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const id = String(req.params.id);
    const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: 'Proposal tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'duta' && prop.applicant_personnel_id !== user.personnelId && prop.applicant_personnel_id !== user.id) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal', String(prop.reference_number), 'ditolak', 'Duta mencoba mengubah proposal lain');
      res.status(403).json({ error: 'Anda hanya dapat mengubah proposal milik sendiri.' });
      return;
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== prop.province_code) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal', String(prop.reference_number), 'ditolak', 'Koordinator mencoba mengubah proposal luar provinsi');
      res.status(403).json({ error: 'Koordinator hanya dapat mengubah proposal di provinsinya.' });
      return;
    }
    if (prop.soft_deleted_at) {
      res.status(409).json({ error: 'Draft proposal berada di tempat sampah sementara. Pulihkan terlebih dahulu sebelum mengubah.' });
      return;
    }
    if (['ditolak', 'dibatalkan', 'diarsipkan'].includes(String(prop.status))) {
      res.status(409).json({ error: 'Proposal dengan status final (ditolak/dibatalkan/diarsipkan) tidak dapat diubah.' });
      return;
    }
    const b = req.body ?? {};
    if (b.expectedUpdatedAt && String(b.expectedUpdatedAt) !== String(prop.updated_at)) {
      res.status(409).json({
        error: 'Proposal ini telah diperbarui oleh pihak lain atau sesi lain. Muat ulang versi terbaru sebelum menyimpan perubahan agar data tidak tertimpa.',
        code: 409,
        conflict: true,
        latestRecord: {
          id: String(prop.id),
          title: String(prop.title),
          status: String(prop.status),
          updatedAt: String(prop.updated_at),
        },
      });
      return;
    }
    const submitNow = Boolean(b.submitNow);
    const mergedTitle = String(b.title !== undefined ? b.title : prop.title || '').trim();
    const mergedObjective = String(b.objective !== undefined ? b.objective : prop.objective || '').trim();
    const mergedLocation = String(b.location !== undefined ? b.location : prop.location || '').trim();
    if (submitNow && (!mergedTitle || !mergedObjective || !mergedLocation)) {
      res.status(422).json({ error: 'Judul, tujuan, dan lokasi kegiatan wajib diisi sebelum draft diajukan.' });
      return;
    }
    const riskLevel = (['rendah', 'sedang', 'tinggi'].includes(b.riskLevel) ? b.riskLevel : prop.risk_level) as 'rendah' | 'sedang' | 'tinggi';
    const usesDpbiIdentity = b.usesDpbiIdentity !== undefined ? Boolean(b.usesDpbiIdentity) : Boolean(prop.uses_dpbi_identity);
    const externalPermitNeeded = b.externalPermitNeeded !== undefined ? Boolean(b.externalPermitNeeded) : Boolean(prop.external_permit_needed);
    const route = resolveProposalApprover({
      category: String(b.category || prop.category),
      riskLevel,
      usesDpbiIdentity,
      externalPermitNeeded,
    });
    const nextStatus = submitNow
      ? route.approverRole === 'pengurus_nasional'
        ? 'menunggu_persetujuan_nasional'
        : 'diajukan'
      : String(prop.status);
    const now = new Date().toISOString();
    const nextSla = submitNow && !prop.sla_due_at ? new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString() : (prop.sla_due_at ? String(prop.sla_due_at) : null);

    db.prepare(
      `UPDATE proposals SET
        title = COALESCE(?, title),
        bidang = COALESCE(?, bidang),
        category = COALESCE(?, category),
        risk_level = ?,
        uses_dpbi_identity = ?,
        external_permit_needed = ?,
        assigned_approver_role = ?,
        objective = COALESCE(?, objective),
        event_date = COALESCE(?, event_date),
        location = COALESCE(?, location),
        estimated_participants = COALESCE(?, estimated_participants),
        activity_mode = COALESCE(?, activity_mode),
        pdf_file_id = COALESCE(?, pdf_file_id),
        pdf_file_name = COALESCE(?, pdf_file_name),
        program_id = COALESCE(?, program_id),
        status = ?,
        sla_due_at = ?,
        updated_at = ?
       WHERE id = ?`
    ).run(
      b.title ?? null, b.bidang ?? null, b.category ?? null, riskLevel, usesDpbiIdentity ? 1 : 0, externalPermitNeeded ? 1 : 0,
      route.approverRole, b.objective ?? null, b.eventDate ?? null, b.location ?? null,
      b.estimatedParticipants ? Number(b.estimatedParticipants) : null, b.activityMode ?? null,
      b.pdfFileId ?? null, b.pdfFileName ?? null, b.programId ?? null, nextStatus, nextSla, now, id
    );

    if (String(prop.status) === 'disetujui' || b.eventDate !== undefined || b.location !== undefined || b.title !== undefined) {
      const updated = db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as Record<string, unknown> | undefined;
      if (updated) {
        onProposalScheduleUpdated(db, updated);
      }
    }

    writeAuditLog(db, user, submitNow ? 'SUBMIT_PROPOSAL_FROM_DRAFT' : 'UPDATE_PROPOSAL_DRAFT', 'proposal', String(prop.reference_number));
    res.json({ ok: true, status: nextStatus, assignedApproverRole: route.approverRole });
  });

  app.post('/api/proposals/:id/decide', requireAuth, requirePermission('proposal', 'review'), (req: AuthenticatedRequest, res: Response) => {
    const { decision, note } = req.body ?? {};
    const valid = ['disetujui', 'perlu_revisi', 'ditolak'];
    if (!valid.includes(String(decision))) {
      res.status(422).json({ error: 'Keputusan harus disetujui, perlu_revisi, atau ditolak.' });
      return;
    }
    if ((decision === 'perlu_revisi' || decision === 'ditolak') && !String(note || '').trim()) {
      res.status(422).json({ error: 'Alasan atau catatan wajib diisi untuk revisi atau penolakan.' });
      return;
    }
    const db = getDb();
    const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: 'Proposal tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== prop.province_code) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal', String(prop.reference_number), 'ditolak', 'Koordinator mencoba memutus proposal provinsi lain');
      res.status(403).json({ error: 'Koordinator hanya dapat memeriksa proposal dari provinsinya sendiri.' });
      return;
    }
    if (prop.applicant_personnel_id === user.personnelId || prop.applicant_personnel_id === user.id) {
      res.status(403).json({ error: 'Pengusul tidak dapat menyetujui atau memeriksa proposalnya sendiri (pemisahan wewenang).' });
      return;
    }
    if (['disetujui', 'ditolak', 'dibatalkan', 'diarsipkan'].includes(String(prop.status))) {
      res.status(409).json({ error: 'Proposal ini sudah memiliki keputusan final dan tidak dapat diputuskan ulang.' });
      return;
    }
    if (decision === 'disetujui' && !hasScopedUserPermission(user, 'proposal', 'approve', String(prop.province_code))) {
      if (!(user.role === 'koordinator_wilayah' && prop.assigned_approver_role === 'koordinator_wilayah' && user.provinceCode === prop.province_code)) {
        res.status(403).json({ error: 'Proposal ini memerlukan persetujuan Pengurus Nasional sesuai Approval Matrix.' });
        return;
      }
    }

    const now = new Date().toISOString();
    const prevStatus = String(prop.status);
    db.prepare('UPDATE proposals SET status = ?, decision_note = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?').run(
      String(decision), String(note || ''), user.fullName, now, now, String(prop.id)
    );
    recordApprovalHistory(db, {
      entityType: 'proposal',
      entityId: String(prop.id),
      action: String(decision),
      fromStatus: prevStatus,
      toStatus: String(decision),
      stageLabel: decision === 'disetujui' ? 'Keputusan Akhir (Disetujui)' : decision === 'ditolak' ? 'Keputusan Akhir (Ditolak)' : 'Pengembalian Revisi',
      actor: user,
      note: String(note || ''),
      diff: computeObjectDiff(prop, { ...prop, status: decision, decision_note: note }, ['status', 'decision_note']),
    });

    const applicantUser = db.prepare('SELECT id FROM users WHERE personnel_id = ?').get(String(prop.applicant_personnel_id)) as { id: string } | undefined;
    if (applicantUser) {
      createNotificationIdempotent(db, {
        userId: applicantUser.id,
        title: `Status Proposal ${prop.reference_number}: ${String(decision).replace(/_/g, ' ')}`,
        message: String(note || prop.title),
        category: 'proposal',
        targetPath: '/proposal',
        eventKey: `proposal:${prop.id}:${decision}:${now.slice(0, 16)}`,
      });
    }

    let workflowEffects: { eventId: string; createdTaskIds: string[] } | null = null;
    if (decision === 'disetujui') {
      workflowEffects = onProposalApproved(db, prop, user);
    }

    writeAuditLog(db, user, `DECIDE_PROPOSAL_${String(decision).toUpperCase()}`, 'proposal', String(prop.reference_number), 'berhasil', String(note || ''));
    writeActivityTimeline(db, 'Proposal', `Proposal ${prop.reference_number} ${String(decision).replace(/_/g, ' ')}`, `${prop.title} ditindaklanjuti oleh ${user.fullName}.`, user.fullName, String(prop.province_code), String(prop.batch_id), '/proposal');

    res.json({ ok: true, workflowEffects });
  });

  app.post('/api/proposals/:id/revise', requireAuth, requirePermission('proposal', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { pdfFileId, pdfFileName, changeNote } = req.body ?? {};
    const db = getDb();
    const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: 'Proposal tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'duta' && prop.applicant_personnel_id !== user.personnelId && prop.applicant_personnel_id !== user.id) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal', String(prop.reference_number), 'ditolak', 'Duta mencoba merevisi proposal lain');
      res.status(403).json({ error: 'Anda hanya dapat mengirim revisi untuk proposal milik sendiri.' });
      return;
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== prop.province_code) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal', String(prop.reference_number), 'ditolak', 'Koordinator mencoba merevisi proposal provinsi lain');
      res.status(403).json({ error: 'Proposal ini berada di luar wilayah provinsi Anda.' });
      return;
    }
    if (!['draft', 'perlu_revisi', 'perlu_kelengkapan'].includes(String(prop.status))) {
      res.status(409).json({ error: 'Revisi hanya dapat dikirim untuk proposal berstatus draft, perlu revisi, atau perlu kelengkapan.' });
      return;
    }
    const nextVersion = Number(prop.version) + 1;
    const now = new Date().toISOString();
    const prevStatus = String(prop.status);
    const nextStatus = prop.assigned_approver_role === 'pengurus_nasional' ? 'menunggu_persetujuan_nasional' : 'diajukan';
    const nextSla = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();

    db.prepare('UPDATE proposals SET version = ?, pdf_file_id = COALESCE(?, pdf_file_id), pdf_file_name = COALESCE(?, pdf_file_name), status = ?, sla_due_at = ?, updated_at = ? WHERE id = ?').run(
      nextVersion, pdfFileId ?? null, pdfFileName ?? null, nextStatus, nextSla, now, String(prop.id)
    );
    db.prepare(
      `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), String(prop.id), nextVersion, pdfFileId ?? prop.pdf_file_id, pdfFileName ?? prop.pdf_file_name, String(changeNote || `Revisi versi ${nextVersion}`), user.fullName, now);

    recordApprovalHistory(db, {
      entityType: 'proposal',
      entityId: String(prop.id),
      action: 'revise',
      fromStatus: prevStatus,
      toStatus: nextStatus,
      stageLabel: `Pengiriman Ulang Revisi v${nextVersion}`,
      actor: user,
      note: String(changeNote || `Revisi versi ${nextVersion}`),
      diff: computeObjectDiff(prop, { ...prop, version: nextVersion, pdf_file_name: pdfFileName ?? prop.pdf_file_name, status: nextStatus }, ['version', 'pdf_file_name', 'status']),
    });

    writeAuditLog(db, user, 'REVISE_PROPOSAL', 'proposal', String(prop.reference_number), 'berhasil', `Versi ${nextVersion}`);
    res.json({ ok: true, version: nextVersion });
  });

  // ==================== LKL & COORDINATOR REPORTS ====================
  app.get('/api/lkl', requireAuth, requirePermission('lkl', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    let sql = 'SELECT * FROM lkl_reports WHERE soft_deleted_at IS NULL';
    const params: string[] = [];
    if (user.role === 'duta') {
      sql += ' AND submitter_personnel_id = ?';
      params.push(user.personnelId || '__none__');
    } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
      sql += ' AND province_code = ?';
      params.push(user.provinceCode);
    }
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];
    res.json({
      reports: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        version: Number(r.version),
        activityName: String(r.activity_name),
        proposalId: r.proposal_id ? String(r.proposal_id) : null,
        proposalRef: r.proposal_ref ? String(r.proposal_ref) : null,
        submitterPersonnelId: String(r.submitter_personnel_id),
        submitterName: String(r.submitter_name),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        regency: String(r.regency || ''),
        district: String(r.district || ''),
        village: String(r.village || ''),
        venueName: String(r.venue_name || ''),
        venueAddress: String(r.venue_address || ''),
        eventDate: String(r.event_date),
        startTime: String(r.start_time),
        endTime: String(r.end_time),
        category: String(r.category),
        activityMode: String(r.activity_mode) as 'luring' | 'daring',
        platformName: r.platform_name ? String(r.platform_name) : null,
        platformLink: r.platform_link ? String(r.platform_link) : null,
        picName: String(r.pic_name),
        participantCount: Number(r.participant_count),
        summary: String(r.summary),
        outcomes: String(r.outcomes),
        obstacles: String(r.obstacles || ''),
        followUp: String(r.follow_up || ''),
        pdfFileId: r.pdf_file_id ? String(r.pdf_file_id) : null,
        pdfFileName: r.pdf_file_name ? String(r.pdf_file_name) : null,
        photoFileIds: JSON.parse(String(r.photo_file_ids_json || '[]')),
        status: String(r.status),
        reviewNote: r.review_note ? String(r.review_note) : null,
        reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
        reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
        programId: r.program_id ? String(r.program_id) : null,
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/lkl', requireAuth, requirePermission('lkl', 'create'), idempotencyGuard, (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.activityName || !b.eventDate || !b.summary) {
      res.status(422).json({ error: 'Nama kegiatan, tanggal pelaksanaan, dan ringkasan kegiatan wajib diisi.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const provCode = String(b.provinceCode || user.provinceCode || '31');
    if ((user.role === 'duta' || user.role === 'koordinator_wilayah') && user.provinceCode && provCode !== user.provinceCode) {
      res.status(403).json({ error: 'Anda hanya dapat mengirim LKL untuk provinsi asal Anda.' });
      return;
    }

    let proposalRef: string | null = null;
    let proposalProgramId: string | null = null;
    if (b.proposalId) {
      const p = db.prepare('SELECT id, reference_number, status, province_code, applicant_personnel_id, program_id FROM proposals WHERE id = ?').get(String(b.proposalId)) as Record<string, unknown> | undefined;
      if (!p) {
        res.status(404).json({ error: 'Proposal rujukan tidak ditemukan.' });
        return;
      }
      if (user.role === 'duta' && p.applicant_personnel_id !== user.personnelId && p.applicant_personnel_id !== user.id) {
        res.status(403).json({ error: 'Proposal rujukan bukan milik akun Anda.' });
        return;
      }
      if (user.role === 'koordinator_wilayah' && p.province_code !== user.provinceCode) {
        res.status(403).json({ error: 'Proposal rujukan berada di luar wilayah provinsi Anda.' });
        return;
      }
      if (String(p.status) !== 'disetujui') {
        res.status(422).json({ error: 'Proposal rujukan harus berstatus disetujui sebelum LKL dapat dikirim.' });
        return;
      }
      proposalRef = String(p.reference_number);
      proposalProgramId = p.program_id ? String(p.program_id) : null;
    }

    const refNo = nextReferenceNumber(db, 'LKL');
    const id = crypto.randomUUID();
    const mode = b.activityMode === 'daring' ? 'daring' : 'luring';

    db.prepare(
      `INSERT INTO lkl_reports (
        id, reference_number, version, activity_name, proposal_id, proposal_ref, submitter_personnel_id, submitter_name,
        province_code, regency, district, village, venue_name, venue_address, event_date, start_time, end_time,
        category, activity_mode, platform_name, platform_link, pic_name, participant_count, summary, outcomes,
        obstacles, follow_up, pdf_file_id, pdf_file_name, photo_file_ids_json, program_id, status, created_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_pemeriksaan', ?)`
    ).run(
      id, refNo, String(b.activityName), b.proposalId ? String(b.proposalId) : null, proposalRef,
      user.personnelId || user.id, user.fullName, provCode,
      mode === 'luring' ? String(b.regency || '') : '',
      mode === 'luring' ? String(b.district || '') : '',
      mode === 'luring' ? String(b.village || '') : '',
      mode === 'luring' ? String(b.venueName || '') : '',
      mode === 'luring' ? String(b.venueAddress || '') : '',
      String(b.eventDate), String(b.startTime || '09:00'), String(b.endTime || '12:00'),
      String(b.category || 'Kegiatan Budaya'), mode,
      mode === 'daring' ? String(b.platformName || 'Platform Konferensi Video') : null,
      mode === 'daring' ? String(b.platformLink || '') : null,
      String(b.picName || user.fullName), Number(b.participantCount || 0), String(b.summary), String(b.outcomes || ''),
      String(b.obstacles || ''), String(b.followUp || ''),
      b.pdfFileId ? String(b.pdfFileId) : null, b.pdfFileName ? String(b.pdfFileName) : null,
      JSON.stringify(Array.isArray(b.photoFileIds) ? b.photoFileIds : []), b.programId ? String(b.programId) : proposalProgramId, new Date().toISOString()
    );

    recordApprovalHistory(db, {
      entityType: 'lkl',
      entityId: id,
      action: 'submit',
      fromStatus: null,
      toStatus: 'menunggu_pemeriksaan',
      stageLabel: 'Pengiriman Awal LKL',
      actor: user,
      note: String(b.activityName),
    });

    writeAuditLog(db, user, 'SUBMIT_LKL', 'lkl', refNo);
    writeActivityTimeline(db, 'LKL', `LKL ${refNo} Dikirim`, `${b.activityName} (${mode}) dikirim oleh ${user.fullName}.`, user.fullName, provCode, user.batchId, '/laporan-kegiatan');
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.post('/api/lkl/:id/revise', requireAuth, requirePermission('lkl', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const lkl = db.prepare('SELECT * FROM lkl_reports WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!lkl) {
      res.status(404).json({ error: 'LKL tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'duta' && lkl.submitter_personnel_id !== user.personnelId && lkl.submitter_personnel_id !== user.id) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'lkl', String(lkl.reference_number), 'ditolak', 'Duta mencoba merevisi LKL milik orang lain');
      res.status(403).json({ error: 'Anda hanya dapat merevisi LKL milik sendiri.' });
      return;
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== lkl.province_code) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'lkl', String(lkl.reference_number), 'ditolak', 'Koordinator mencoba merevisi LKL provinsi lain');
      res.status(403).json({ error: 'LKL berada di luar wilayah provinsi Anda.' });
      return;
    }
    if (!['perlu_revisi', 'draft'].includes(String(lkl.status))) {
      res.status(409).json({ error: 'Revisi hanya dapat dikirim untuk LKL berstatus perlu revisi atau draft.' });
      return;
    }
    const b = req.body ?? {};
    const nextVersion = Number(lkl.version || 1) + 1;
    db.prepare(
      `UPDATE lkl_reports SET
        version = ?,
        activity_name = COALESCE(?, activity_name),
        summary = COALESCE(?, summary),
        outcomes = COALESCE(?, outcomes),
        obstacles = COALESCE(?, obstacles),
        follow_up = COALESCE(?, follow_up),
        participant_count = COALESCE(?, participant_count),
        pdf_file_id = COALESCE(?, pdf_file_id),
        pdf_file_name = COALESCE(?, pdf_file_name),
        photo_file_ids_json = COALESCE(?, photo_file_ids_json),
        status = 'menunggu_pemeriksaan'
       WHERE id = ?`
    ).run(
      nextVersion,
      b.activityName ?? null,
      b.summary ?? null,
      b.outcomes ?? null,
      b.obstacles ?? null,
      b.followUp ?? null,
      b.participantCount !== undefined ? Number(b.participantCount) : null,
      b.pdfFileId ?? null,
      b.pdfFileName ?? null,
      Array.isArray(b.photoFileIds) ? JSON.stringify(b.photoFileIds) : null,
      String(lkl.id)
    );
    writeAuditLog(db, user, 'REVISE_LKL', 'lkl', String(lkl.reference_number), 'berhasil', `Versi ${nextVersion}`);
    res.json({ ok: true, version: nextVersion });
  });

  app.post('/api/lkl/:id/review', requireAuth, requirePermission('lkl', 'review'), (req: AuthenticatedRequest, res: Response) => {
    const { decision, note } = req.body ?? {};
    if (!['diterima', 'perlu_revisi', 'ditolak'].includes(String(decision))) {
      res.status(422).json({ error: 'Keputusan harus diterima, perlu_revisi, atau ditolak.' });
      return;
    }
    if ((decision === 'perlu_revisi' || decision === 'ditolak') && !String(note || '').trim()) {
      res.status(422).json({ error: 'Alasan atau catatan perbaikan wajib diisi saat meminta revisi atau menolak LKL.' });
      return;
    }
    const db = getDb();
    const lkl = db.prepare('SELECT * FROM lkl_reports WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!lkl) {
      res.status(404).json({ error: 'LKL tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== lkl.province_code) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'lkl', String(lkl.reference_number), 'ditolak', 'Koordinator mencoba memeriksa LKL provinsi lain');
      res.status(403).json({ error: 'Koordinator hanya dapat memeriksa LKL di provinsinya.' });
      return;
    }
    if (lkl.submitter_personnel_id === user.personnelId || lkl.submitter_personnel_id === user.id) {
      res.status(403).json({ error: 'Pengirim LKL tidak dapat memeriksa laporannya sendiri (pemisahan wewenang).' });
      return;
    }
    const now = new Date().toISOString();
    const prevStatus = String(lkl.status);
    db.prepare('UPDATE lkl_reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
      String(decision), String(note || ''), user.fullName, now, String(lkl.id)
    );
    recordApprovalHistory(db, {
      entityType: 'lkl',
      entityId: String(lkl.id),
      action: String(decision),
      fromStatus: prevStatus,
      toStatus: String(decision),
      stageLabel: decision === 'diterima' ? 'Pemeriksaan LKL Diterima' : 'Pemeriksaan LKL Dikembalikan/Ditolak',
      actor: user,
      note: String(note || ''),
      diff: computeObjectDiff(lkl, { ...lkl, status: decision, review_note: note }, ['status', 'review_note']),
    });

    const submitterUser = db.prepare('SELECT id FROM users WHERE personnel_id = ?').get(String(lkl.submitter_personnel_id)) as { id: string } | undefined;
    if (submitterUser) {
      createNotificationIdempotent(db, {
        userId: submitterUser.id,
        title: `Pemeriksaan LKL ${lkl.reference_number}: ${String(decision).replace(/_/g, ' ')}`,
        message: String(note || lkl.activity_name),
        category: 'lkl',
        targetPath: '/laporan-kegiatan',
        eventKey: `lkl:${lkl.id}:${decision}:${now.slice(0, 16)}`,
      });
    }

    if (decision === 'diterima') {
      onLklApproved(db, lkl, user);
    }

    writeAuditLog(db, user, `REVIEW_LKL_${String(decision).toUpperCase()}`, 'lkl', String(lkl.reference_number), 'berhasil', String(note || ''));
    writeActivityTimeline(db, 'LKL', `LKL ${lkl.reference_number} ${String(decision).replace(/_/g, ' ')}`, `${lkl.activity_name} diperiksa oleh ${user.fullName}.`, user.fullName, String(lkl.province_code), null, '/laporan-kegiatan');
    res.json({ ok: true });
  });

  app.get('/api/coordinator-reports', requireAuth, requirePermission('laporan_koordinator', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const rows = db
      .prepare(
        `SELECT * FROM coordinator_reports ${user.role === 'koordinator_wilayah' && user.provinceCode ? 'WHERE province_code = ?' : ''} ORDER BY created_at DESC`
      )
      .all(...(user.role === 'koordinator_wilayah' && user.provinceCode ? [user.provinceCode] : [])) as Record<string, unknown>[];

    res.json({
      reports: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        reportType: String(r.report_type),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        batchId: String(r.batch_id),
        coordinatorName: String(r.coordinator_name),
        periodLabel: String(r.period_label),
        personnelCondition: String(r.personnel_condition),
        activitiesSummary: String(r.activities_summary),
        lklRecapCount: Number(r.lkl_recap_count),
        obstacles: String(r.obstacles),
        coachingNeeds: String(r.coaching_needs),
        followUpPlan: String(r.follow_up_plan),
        pdfFileId: r.pdf_file_id ? String(r.pdf_file_id) : null,
        pdfFileName: r.pdf_file_name ? String(r.pdf_file_name) : null,
        status: String(r.status),
        reviewNote: r.review_note ? String(r.review_note) : null,
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/coordinator-reports', requireAuth, requirePermission('laporan_koordinator', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.periodLabel || !b.personnelCondition || !b.activitiesSummary) {
      res.status(422).json({ error: 'Periode laporan, kondisi personel, dan ringkasan kegiatan wajib diisi.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const provCode = String(b.provinceCode || user.provinceCode || '31');
    if (user.role === 'koordinator_wilayah' && user.provinceCode && provCode !== user.provinceCode) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'coordinator_report', provCode, 'ditolak', 'Koordinator mencoba membuat laporan untuk provinsi lain');
      res.status(403).json({ error: 'Koordinator hanya dapat membuat laporan untuk provinsinya sendiri.' });
      return;
    }
    const refNo = nextReferenceNumber(db, 'LKW');
    const id = crypto.randomUUID();
    const lklCnt = (db.prepare("SELECT COUNT(*) AS c FROM lkl_reports WHERE province_code = ? AND status = 'diterima'").get(provCode) as { c: number }).c;

    db.prepare(
      `INSERT INTO coordinator_reports (id, reference_number, report_type, province_code, batch_id, coordinator_id, coordinator_name, period_label, personnel_condition, activities_summary, lkl_recap_count, obstacles, coaching_needs, follow_up_plan, pdf_file_id, pdf_file_name, status, version, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dikirim', 1, ?)`
    ).run(
      id, refNo, b.reportType === 'akhir' ? 'akhir' : 'bulanan', provCode, String(b.batchId || user.batchId || 'batch-3'),
      user.id, user.fullName, String(b.periodLabel), String(b.personnelCondition), String(b.activitiesSummary),
      lklCnt, String(b.obstacles || ''), String(b.coachingNeeds || ''), String(b.followUpPlan || ''),
      b.pdfFileId ? String(b.pdfFileId) : null, b.pdfFileName ? String(b.pdfFileName) : null, new Date().toISOString()
    );

    writeAuditLog(db, user, 'SUBMIT_COORDINATOR_REPORT', 'coordinator_report', refNo);
    writeActivityTimeline(db, 'Laporan Wilayah', `Laporan ${b.reportType === 'akhir' ? 'Akhir' : 'Bulanan'} ${PROVINCE_BY_CODE.get(provCode)?.name}`, `${refNo} (${b.periodLabel}) dikirim oleh ${user.fullName}.`, user.fullName, provCode, String(b.batchId || 'batch-3'), '/laporan-koordinator');
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.post('/api/coordinator-reports/:id/revise', requireAuth, requirePermission('laporan_koordinator', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const r = db.prepare('SELECT * FROM coordinator_reports WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!r) {
      res.status(404).json({ error: 'Laporan koordinator tidak ditemukan.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah' && user.provinceCode !== r.province_code) {
      writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'coordinator_report', String(r.reference_number), 'ditolak', 'Koordinator mencoba merevisi laporan provinsi lain');
      res.status(403).json({ error: 'Laporan koordinator ini berada di luar wilayah provinsi Anda.' });
      return;
    }
    if (String(r.status) !== 'perlu_revisi') {
      res.status(409).json({ error: 'Revisi hanya dapat dikirim untuk laporan koordinator berstatus perlu revisi.' });
      return;
    }
    const b = req.body ?? {};
    const nextVersion = Number(r.version || 1) + 1;
    db.prepare(
      `UPDATE coordinator_reports SET
        version = ?,
        period_label = COALESCE(?, period_label),
        personnel_condition = COALESCE(?, personnel_condition),
        activities_summary = COALESCE(?, activities_summary),
        obstacles = COALESCE(?, obstacles),
        coaching_needs = COALESCE(?, coaching_needs),
        follow_up_plan = COALESCE(?, follow_up_plan),
        pdf_file_id = COALESCE(?, pdf_file_id),
        pdf_file_name = COALESCE(?, pdf_file_name),
        status = 'dikirim'
       WHERE id = ?`
    ).run(
      nextVersion,
      b.periodLabel ?? null,
      b.personnelCondition ?? null,
      b.activitiesSummary ?? null,
      b.obstacles ?? null,
      b.coachingNeeds ?? null,
      b.followUpPlan ?? null,
      b.pdfFileId ?? null,
      b.pdfFileName ?? null,
      String(r.id)
    );
    writeAuditLog(db, user, 'REVISE_COORDINATOR_REPORT', 'coordinator_report', String(r.reference_number), 'berhasil', `Versi ${nextVersion}`);
    writeActivityTimeline(db, 'Laporan Wilayah', `Revisi Laporan ${r.reference_number}`, `${r.period_label} diperbaiki dan dikirim ulang oleh ${user.fullName}.`, user.fullName, String(r.province_code), String(r.batch_id), '/laporan-koordinator');
    res.json({ ok: true, version: nextVersion });
  });

  app.post('/api/coordinator-reports/:id/review', requireAuth, requirePermission('laporan_koordinator', 'review'), (req: AuthenticatedRequest, res: Response) => {
    const { decision, note } = req.body ?? {};
    if (!['diterima', 'perlu_revisi'].includes(String(decision))) {
      res.status(422).json({ error: 'Keputusan harus diterima atau perlu_revisi.' });
      return;
    }
    if (decision === 'perlu_revisi' && !String(note || '').trim()) {
      res.status(422).json({ error: 'Catatan perbaikan wajib diisi saat mengembalikan laporan koordinator.' });
      return;
    }
    const user = req.authUser!;
    if (user.role === 'koordinator_wilayah') {
      res.status(403).json({ error: 'Pemeriksaan laporan koordinator dilakukan oleh Sekretariat Nasional / Admin.' });
      return;
    }
    const db = getDb();
    const r = db.prepare('SELECT * FROM coordinator_reports WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!r) {
      res.status(404).json({ error: 'Laporan koordinator tidak ditemukan.' });
      return;
    }
    if (r.coordinator_id === user.id) {
      res.status(403).json({ error: 'Pembuat laporan tidak dapat mengesahkan laporannya sendiri.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE coordinator_reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
      String(decision),
      String(note || ''),
      user.fullName,
      now,
      String(r.id)
    );
    if (decision === 'diterima') {
      if (String(r.report_type) === 'akhir') {
        db.prepare('UPDATE provinces SET final_report_submitted = 1 WHERE code = ?').run(String(r.province_code));
      } else {
        db.prepare('UPDATE provinces SET monthly_report_submitted = 1 WHERE code = ?').run(String(r.province_code));
      }
      if (r.coordinator_id) {
        createNotificationIdempotent(db, {
          userId: String(r.coordinator_id),
          title: `Laporan Koordinator ${r.reference_number} Diterima`,
          message: `Laporan ${r.period_label} telah disahkan oleh ${user.fullName}.`,
          category: 'laporan_koordinator',
          targetPath: '/laporan-koordinator',
          eventKey: `cr:${r.id}:diterima:${now.slice(0, 16)}`,
        });
      }
    } else if (r.coordinator_id) {
      createNotificationIdempotent(db, {
        userId: String(r.coordinator_id),
        title: `Laporan Koordinator ${r.reference_number} Perlu Revisi`,
        message: String(note || ''),
        category: 'laporan_koordinator',
        targetPath: '/laporan-koordinator',
        eventKey: `cr:${r.id}:perlu_revisi:${now.slice(0, 16)}`,
      });
    }
    writeAuditLog(db, user, 'REVIEW_COORDINATOR_REPORT', 'coordinator_report', String(r.reference_number), 'berhasil', String(decision));
    res.json({ ok: true });
  });
}
