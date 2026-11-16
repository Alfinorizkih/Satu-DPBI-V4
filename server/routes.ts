import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Response } from 'express';
import multer from 'multer';
import { getDb, IS_DEMO_MODE, nextReferenceNumber, PRIVATE_STORAGE_DIR } from './db';
import {
  type AuthenticatedRequest,
  checkLoginThrottle,
  clearLoginFailures,
  clearSessionCookie,
  createSession,
  hashPassword,
  inspectFileMagicBytes,
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
    if (!email) {
      res.status(422).json({ error: 'Masukkan email akun yang terdaftar.' });
      return;
    }
    const db = getDb();
    const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email) as { id: string } | undefined;
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
    res.json({ ok: true, message: 'Kata sandi berhasil diperbarui.' });
  });

  app.post('/api/auth/accept-invitation', (req, res: Response) => {
    const { token, password } = req.body ?? {};
    if (!token || !password || String(password).length < 8) {
      res.status(422).json({ error: 'Token undangan dan kata sandi minimal 8 karakter wajib diisi.' });
      return;
    }
    const db = getDb();
    const inv = db
      .prepare('SELECT * FROM invitations WHERE token_hash = ? AND used_at IS NULL')
      .get(sha256(String(token))) as Record<string, unknown> | undefined;
    if (!inv || Date.parse(String(inv.expires_at)) < Date.now()) {
      res.status(400).json({ error: 'Undangan tidak valid atau telah kedaluwarsa.' });
      return;
    }
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const persId = crypto.randomUUID();
    const refNo = nextReferenceNumber(db, 'PERS');
    const memberNo = `DPBI-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
    db.exec('BEGIN IMMEDIATE;');
    try {
      db.prepare(
        `INSERT INTO personnel (id, member_number, reference_number, user_id, full_name, email, province_code, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Duta Pelajar Berbudaya', 'Kebudayaan', ?, 'aktif', 'belum_lengkap', '{}', ?, ?)`
      ).run(persId, memberNo, refNo, userId, String(inv.full_name), String(inv.email), String(inv.province_code || '31'), String(inv.batch_id || 'batch-3'), String(inv.role), now, now);

      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, province_code, batch_id, personnel_id, account_status, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`
      ).run(userId, String(inv.email), hashPassword(String(password)), String(inv.full_name), String(inv.role), String(inv.province_code || '31'), String(inv.batch_id || 'batch-3'), persId, IS_DEMO_MODE ? 1 : 0, now);

      db.prepare('UPDATE invitations SET used_at = ? WHERE id = ?').run(now, String(inv.id));
      db.exec('COMMIT;');
    } catch {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: 'Gagal mengaktifkan akun undangan.' });
      return;
    }
    res.json({ ok: true, message: 'Akun berhasil diaktifkan. Silakan masuk menggunakan email dan password Anda.' });
  });

  // ==================== SECURE FILE UPLOAD & AUTHENTICATED DOWNLOAD ====================
  app.post('/api/files/upload', requireAuth, upload.single('file'), (req: AuthenticatedRequest, res: Response) => {
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
    const existing = db
      .prepare('SELECT id, original_name, mime_type, size_bytes FROM stored_files WHERE checksum_sha256 = ?')
      .get(checksum) as Record<string, unknown> | undefined;

    if (existing) {
      res.json({
        fileId: String(existing.id),
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
      req.authUser!.id,
      new Date().toISOString()
    );

    writeAuditLog(db, req.authUser!, 'UPLOAD_FILE', 'file', fileId, 'berhasil', `${file.originalname} (${check.detectedMime})`);
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
    const fileId = String(req.params.id).replace(/[^a-zA-Z0-9-]/g, '');
    const row = db.prepare('SELECT * FROM stored_files WHERE id = ?').get(fileId) as Record<string, unknown> | undefined;
    if (!row) {
      res.status(404).json({ error: 'Berkas tidak ditemukan.' });
      return;
    }
    const safeStored = path.basename(String(row.stored_name));
    const fullPath = path.join(PRIVATE_STORAGE_DIR, safeStored);
    if (!fullPath.startsWith(PRIVATE_STORAGE_DIR) || !fs.existsSync(fullPath)) {
      res.status(404).json({ error: 'Berkas fisik tidak ditemukan di penyimpanan privat.' });
      return;
    }
    writeAuditLog(db, req.authUser!, forceDownload ? 'DOWNLOAD_FILE' : 'PREVIEW_FILE', 'file', fileId, 'berhasil', String(row.original_name));
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

  app.get('/api/files/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    serveStoredFile(req, res, req.query.download === '1');
  });

  // ==================== DASHBOARD & GLOBAL SEARCH ====================
  app.get('/api/dashboard', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const isNational = ['super_admin', 'wakil_super_admin', 'penanggung_jawab', 'pengurus_nasional', 'sekretariat_nasional'].includes(user.role);
    const isKorwil = user.role === 'koordinator_wilayah';

    const provFilter = isKorwil && user.provinceCode ? `WHERE province_code = '${user.provinceCode.replace(/[^0-9]/g, '')}'` : '';
    const personnelFilter =
      user.role === 'duta' || user.role === 'alumni'
        ? `WHERE id = '${(user.personnelId || '').replace(/[^a-zA-Z0-9-]/g, '')}'`
        : provFilter;

    const totalPersonnel = (db.prepare(`SELECT COUNT(*) AS c FROM personnel ${personnelFilter}`).get() as { c: number }).c;
    const activeDuta = (db.prepare(`SELECT COUNT(*) AS c FROM personnel ${personnelFilter ? personnelFilter + " AND role_code = 'duta' AND personnel_status = 'aktif'" : "WHERE role_code = 'duta' AND personnel_status = 'aktif'"}`).get() as { c: number }).c;
    const activeProvinces = (db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'aktif'").get() as { c: number }).c;
    const pendingProposals = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM proposals ${
            user.role === 'duta'
              ? `WHERE applicant_personnel_id = '${user.personnelId || ''}' AND status IN ('diajukan', 'menunggu_persetujuan_nasional', 'perlu_revisi')`
              : isKorwil && user.provinceCode
              ? `WHERE province_code = '${user.provinceCode}' AND status IN ('diajukan', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')`
              : "WHERE status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')"
          }`
        )
        .get() as { c: number }
    ).c;

    const pendingLkl = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM lkl_reports ${
            user.role === 'duta'
              ? `WHERE submitter_personnel_id = '${user.personnelId || ''}' AND status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')`
              : isKorwil && user.provinceCode
              ? `WHERE province_code = '${user.provinceCode}' AND status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')`
              : "WHERE status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')"
          }`
        )
        .get() as { c: number }
    ).c;

    const overdueTasks = (
      db
        .prepare(
          `SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('selesai', 'dibatalkan') AND deadline < ? ${
            user.role === 'duta' ? `AND assignee_id = '${user.id}'` : isKorwil && user.provinceCode ? `AND province_code = '${user.provinceCode}'` : ''
          }`
        )
        .get(new Date().toISOString().slice(0, 10)) as { c: number }
    ).c;

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

    const recentActivities = (
      db
        .prepare(
          `SELECT id, category, title, description, province_code, actor_name, related_path, created_at
           FROM activity_timeline
           ${isKorwil && user.provinceCode ? `WHERE province_code IS NULL OR province_code = '${user.provinceCode}'` : ''}
           ORDER BY created_at DESC
           LIMIT 8`
        )
        .all() as Record<string, unknown>[]
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

    // Personnel (RBAC isolated)
    if (hasPermission(user.permissions, 'personalia', 'view')) {
      let sql = 'SELECT id, full_name, member_number, province_code FROM personnel WHERE (LOWER(full_name) LIKE ? OR LOWER(member_number) LIKE ?)';
      if (user.role === 'duta' || user.role === 'alumni') {
        sql += ` AND id = '${user.personnelId || ''}'`;
      } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
        sql += ` AND province_code = '${user.provinceCode}'`;
      }
      sql += ' LIMIT 5';
      const pers = db.prepare(sql).all(like, like) as Record<string, unknown>[];
      for (const p of pers) {
        results.push({ type: 'Personalia', title: String(p.full_name), subtitle: `${p.member_number} · ${PROVINCE_BY_CODE.get(String(p.province_code))?.name ?? ''}`, path: '/personalia' });
      }
    }

    // Proposals
    if (hasPermission(user.permissions, 'proposal', 'view')) {
      const props = db
        .prepare('SELECT reference_number, title, status FROM proposals WHERE (LOWER(title) LIKE ? OR LOWER(reference_number) LIKE ?) LIMIT 5')
        .all(like, like) as Record<string, unknown>[];
      for (const pr of props) {
        results.push({ type: 'Proposal', title: String(pr.title), subtitle: `${pr.reference_number} · ${String(pr.status).replace(/_/g, ' ')}`, path: '/proposal' });
      }
    }

    // LKL
    if (hasPermission(user.permissions, 'lkl', 'view')) {
      const lmls = db
        .prepare('SELECT reference_number, activity_name, status FROM lkl_reports WHERE (LOWER(activity_name) LIKE ? OR LOWER(reference_number) LIKE ?) LIMIT 5')
        .all(like, like) as Record<string, unknown>[];
      for (const l of lmls) {
        results.push({ type: 'LKL', title: String(l.activity_name), subtitle: `${l.reference_number} · ${String(l.status).replace(/_/g, ' ')}`, path: '/laporan-kegiatan' });
      }
    }

    // Documents
    if (hasPermission(user.permissions, 'dokumen', 'view')) {
      const docs = db
        .prepare('SELECT document_number, title, category FROM documents WHERE (LOWER(title) LIKE ? OR LOWER(document_number) LIKE ?) LIMIT 5')
        .all(like, like) as Record<string, unknown>[];
      for (const d of docs) {
        results.push({ type: 'Dokumen', title: String(d.title), subtitle: `${d.document_number} · ${d.category}`, path: '/dokumen' });
      }
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
        outgoingCoordinatorName: String(r.outgoing_coordinator_name),
        incomingCoordinatorName: String(r.incoming_coordinator_name),
        activeTasksCount: Number(r.active_tasks_count),
        openProposalsCount: Number(r.open_proposals_count),
        notes: String(r.notes),
        status: String(r.status),
        approvedBy: r.approved_by ? String(r.approved_by) : null,
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/handovers', requireAuth, requirePermission('wilayah', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { provinceCode, outgoingCoordinatorName, incomingCoordinatorName, notes } = req.body ?? {};
    if (!provinceCode || !outgoingCoordinatorName || !incomingCoordinatorName) {
      res.status(422).json({ error: 'Provinsi, Koordinator lama, dan calon pengganti wajib diisi.' });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, 'HND');
    const id = crypto.randomUUID();
    const taskCnt = (db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE province_code = ? AND status != 'selesai'").get(provinceCode) as { c: number }).c;
    const propCnt = (db.prepare("SELECT COUNT(*) AS c FROM proposals WHERE province_code = ? AND status NOT IN ('disetujui', 'ditolak', 'diarsipkan')").get(provinceCode) as { c: number }).c;

    db.prepare(
      `INSERT INTO handovers (id, reference_number, province_code, outgoing_coordinator_name, incoming_coordinator_name, active_tasks_count, open_proposals_count, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_persetujuan', ?)`
    ).run(id, refNo, provinceCode, outgoingCoordinatorName, incomingCoordinatorName, taskCnt, propCnt, String(notes || ''), new Date().toISOString());

    writeAuditLog(db, req.authUser!, 'CREATE_HANDOVER', 'handover', refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.post('/api/handovers/:id/approve', requireAuth, requirePermission('organisasi', 'assign'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const h = db.prepare('SELECT * FROM handovers WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!h) {
      res.status(404).json({ error: 'Data serah terima tidak ditemukan.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare("UPDATE handovers SET status = 'disetujui', approved_by = ?, approved_at = ? WHERE id = ?").run(req.authUser!.fullName, now, String(h.id));
    db.prepare('UPDATE provinces SET coordinator_name = ? WHERE code = ?').run(String(h.incoming_coordinator_name), String(h.province_code));
    writeAuditLog(db, req.authUser!, 'APPROVE_HANDOVER', 'handover', String(h.reference_number), 'berhasil', `Serah terima ke ${h.incoming_coordinator_name}`);
    writeActivityTimeline(db, 'Organisasi', `Serah Terima Koordinator ${PROVINCE_BY_CODE.get(String(h.province_code))?.name}`, `Berita acara ${h.reference_number} disahkan.`, req.authUser!.fullName, String(h.province_code), null, '/wilayah');
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
    const { latitude, longitude, provinceCode, actionType, mode } = req.body ?? {};
    const targetProvince = String(provinceCode || req.authUser!.provinceCode || '31');
    const db = getDb();

    let matched = false;
    let reason = '';
    if (mode === 'manual_daring') {
      matched = true;
      reason = 'Verifikasi manual / kegiatan daring tercatat tanpa GPS fisik.';
    } else if (typeof latitude === 'number' && typeof longitude === 'number') {
      const check = verifyCoordinateInProvince(latitude, longitude, targetProvince);
      matched = check.matched;
      reason = check.reason;
    } else {
      matched = false;
      reason = 'Koordinat lokasi browser tidak tersedia atau izin lokasi ditolak.';
    }

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO location_verifications (id, user_id, user_name, province_code, action_type, latitude, longitude, matched, verification_mode, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.authUser!.id, req.authUser!.fullName, targetProvince, String(actionType || 'aksi_wilayah'), latitude ?? null, longitude ?? null, matched ? 1 : 0, String(mode || 'gps_browser'), reason, new Date().toISOString());

    res.json({ id, matched, reason, provinceName: PROVINCE_BY_CODE.get(targetProvince)?.name ?? targetProvince });
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
    db.prepare('UPDATE location_exceptions SET status = ?, decided_by = ? WHERE id = ?').run(status, req.authUser!.fullName, String(req.params.id));
    writeAuditLog(db, req.authUser!, 'DECIDE_LOCATION_EXCEPTION', 'location_exception', String(req.params.id), 'berhasil', status);
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
    const proposals = db.prepare('SELECT id, reference_number, title, status, event_date FROM proposals WHERE applicant_personnel_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
    const lkl = db.prepare('SELECT id, reference_number, activity_name, status, event_date, participant_count FROM lkl_reports WHERE submitter_personnel_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
    const evaluations = db.prepare('SELECT id, total_score, coaching_recommendation, evaluator_name, created_at FROM evaluations WHERE personnel_id = ? ORDER BY created_at DESC LIMIT 10').all(id);
    res.json({ proposals, lkl, evaluations });
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
      new Date().toISOString(),
      id
    );
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
    writeAuditLog(db, req.authUser!, 'VERIFY_PERSONNEL', 'personnel', String(existing.reference_number), 'berhasil', `${status}: ${note || ''}`);
    res.json({ ok: true });
  });

  app.post('/api/personnel/import', requireAuth, requirePermission('personalia', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      res.status(422).json({ error: 'Tidak ada baris data yang dikirim untuk diimpor.' });
      return;
    }
    const db = getDb();
    const now = new Date().toISOString();
    let inserted = 0;
    const skipped: { email: string; reason: string }[] = [];

    db.exec('BEGIN IMMEDIATE;');
    try {
      for (const r of rows) {
        const email = String(r.email || '').trim().toLowerCase();
        const fullName = String(r.fullName || '').trim();
        const prov = String(r.provinceCode || '31').trim();
        if (!email || !fullName) {
          skipped.push({ email: email || '(kosong)', reason: 'Nama atau email kosong' });
          continue;
        }
        const dup = db.prepare('SELECT id FROM personnel WHERE LOWER(email) = ?').get(email);
        if (dup) {
          skipped.push({ email, reason: 'Email duplikat sudah ada di database' });
          continue;
        }
        const refNo = nextReferenceNumber(db, 'PERS');
        const memberNo = `DPBI-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;
        db.prepare(
          `INSERT INTO personnel (id, member_number, reference_number, full_name, email, province_code, school_name, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Duta Pelajar Berbudaya', 'Kebudayaan', 'duta', 'aktif', 'menunggu_verifikasi', '{}', ?, ?)`
        ).run(crypto.randomUUID(), memberNo, refNo, fullName, email, prov, String(r.schoolName || ''), String(r.batchId || 'batch-3'), now, now);
        inserted += 1;
      }
      db.exec('COMMIT;');
    } catch {
      db.exec('ROLLBACK;');
      res.status(500).json({ error: 'Gagal memproses impor massal dalam transaksi database.' });
      return;
    }
    writeAuditLog(db, req.authUser!, 'BULK_IMPORT_PERSONNEL', 'personnel', `imported:${inserted}`, 'berhasil', `Dilewati: ${skipped.length}`);
    res.json({ ok: true, inserted, skipped });
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
    const positions = db.prepare('SELECT * FROM organization_positions ORDER BY level, title').all();
    const delegations = db.prepare('SELECT * FROM delegations ORDER BY created_at DESC').all();
    res.json({ positions, delegations });
  });

  app.post('/api/organization/positions', requireAuth, requirePermission('organisasi', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { title, bidang, level, holderName, skNumber, termStartsAt, termEndsAt } = req.body ?? {};
    if (!title || !bidang) {
      res.status(422).json({ error: 'Nama jabatan dan bidang wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO organization_positions (id, title, bidang, level, holder_name, sk_number, term_starts_at, term_ends_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?)`
    ).run(id, String(title), String(bidang), String(level || 'Nasional'), String(holderName || ''), String(skNumber || ''), String(termStartsAt || ''), String(termEndsAt || ''), new Date().toISOString());
    writeAuditLog(db, req.authUser!, 'CREATE_ORG_POSITION', 'organization_position', id);
    res.status(201).json({ ok: true, id });
  });

  app.post('/api/organization/delegations', requireAuth, requirePermission('organisasi', 'assign'), (req: AuthenticatedRequest, res: Response) => {
    const { delegateUserId, module, action, provinceCode, startsAt, endsAt, reason } = req.body ?? {};
    if (!delegateUserId || !module || !action || !startsAt || !endsAt || !reason) {
      res.status(422).json({ error: 'Semua data delegasi dan alasan wajib diisi.' });
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
    ).run(id, targetUser.id, targetUser.full_name, req.authUser!.id, req.authUser!.fullName, String(module), String(action), provinceCode ? String(provinceCode) : null, String(startsAt), String(endsAt), String(reason), new Date().toISOString());
    writeAuditLog(db, req.authUser!, 'CREATE_DELEGATION', 'delegation', id, 'berhasil', `${targetUser.full_name} -> ${module}:${action}`);
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
    let sql = `SELECT p.*, b.name AS batch_name FROM proposals p LEFT JOIN batches b ON b.id = p.batch_id WHERE 1=1`;
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

  app.get('/api/proposals/:id/versions', requireAuth, requirePermission('proposal', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const versions = db.prepare('SELECT * FROM proposal_versions WHERE proposal_id = ? ORDER BY version DESC').all(String(req.params.id));
    res.json({ versions });
  });

  app.post('/api/proposals', requireAuth, requirePermission('proposal', 'create'), (req: AuthenticatedRequest, res: Response) => {
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
    const refNo = nextReferenceNumber(db, 'PROP');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const provCode = String(b.provinceCode || user.provinceCode || '31');
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
        activity_mode, pdf_file_id, pdf_file_name, status, created_at, updated_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, refNo, String(b.title).trim(), user.personnelId || user.id, user.fullName, provCode, String(b.batchId || user.batchId || 'batch-3'),
      String(b.bidang || 'Kebudayaan'), String(b.category || 'Lokakarya / Literasi Pelajar'), riskLevel, usesDpbiIdentity ? 1 : 0, externalPermitNeeded ? 1 : 0, route.approverRole,
      String(b.objective || ''), String(b.targetAudience || 'Pelajar'), String(b.eventDate || '2026-12-10'), String(b.eventTime || '09:00 WIB'),
      String(b.location || ''), String(b.picName || user.fullName), Number(b.estimatedParticipants || 30), String(b.activityMode || 'luring'),
      b.pdfFileId ? String(b.pdfFileId) : null, b.pdfFileName ? String(b.pdfFileName) : null, initialStatus, now, now
    );

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
      res.status(403).json({ error: 'Anda hanya dapat mengubah draft proposal milik sendiri.' });
      return;
    }
    const b = req.body ?? {};
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
        status = ?,
        updated_at = ?
       WHERE id = ?`
    ).run(
      b.title ?? null, b.bidang ?? null, b.category ?? null, riskLevel, usesDpbiIdentity ? 1 : 0, externalPermitNeeded ? 1 : 0,
      route.approverRole, b.objective ?? null, b.eventDate ?? null, b.location ?? null,
      b.estimatedParticipants ? Number(b.estimatedParticipants) : null, b.activityMode ?? null,
      b.pdfFileId ?? null, b.pdfFileName ?? null, nextStatus, now, id
    );

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
    if (decision === 'disetujui' && !hasPermission(user.permissions, 'proposal', 'approve')) {
      // Allow Koordinator Wilayah ONLY if proposal is routed to koordinator_wilayah
      if (!(user.role === 'koordinator_wilayah' && prop.assigned_approver_role === 'koordinator_wilayah' && user.provinceCode === prop.province_code)) {
        res.status(403).json({ error: 'Proposal ini memerlukan persetujuan Pengurus Nasional sesuai Approval Matrix.' });
        return;
      }
    }

    const now = new Date().toISOString();
    db.prepare('UPDATE proposals SET status = ?, decision_note = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?').run(
      String(decision), String(note || ''), user.fullName, now, now, String(prop.id)
    );

    // Notify applicant
    const applicantUser = db.prepare('SELECT id FROM users WHERE personnel_id = ?').get(String(prop.applicant_personnel_id)) as { id: string } | undefined;
    if (applicantUser) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
         VALUES (?, ?, ?, ?, 'proposal', '/proposal', 0, ?)`
      ).run(crypto.randomUUID(), applicantUser.id, `Status Proposal ${prop.reference_number}: ${decision.replace(/_/g, ' ')}`, String(note || prop.title), now);
    }

    writeAuditLog(db, user, `DECIDE_PROPOSAL_${String(decision).toUpperCase()}`, 'proposal', String(prop.reference_number), 'berhasil', String(note || ''));
    writeActivityTimeline(db, 'Proposal', `Proposal ${prop.reference_number} ${decision.replace(/_/g, ' ')}`, `${prop.title} ditindaklanjuti oleh ${user.fullName}.`, user.fullName, String(prop.province_code), String(prop.batch_id), '/proposal');

    res.json({ ok: true });
  });

  app.post('/api/proposals/:id/revise', requireAuth, requirePermission('proposal', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { pdfFileId, pdfFileName, changeNote } = req.body ?? {};
    const db = getDb();
    const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!prop) {
      res.status(404).json({ error: 'Proposal tidak ditemukan.' });
      return;
    }
    const nextVersion = Number(prop.version) + 1;
    const now = new Date().toISOString();
    const nextStatus = prop.assigned_approver_role === 'pengurus_nasional' ? 'menunggu_persetujuan_nasional' : 'diajukan';

    db.prepare('UPDATE proposals SET version = ?, pdf_file_id = COALESCE(?, pdf_file_id), pdf_file_name = COALESCE(?, pdf_file_name), status = ?, updated_at = ? WHERE id = ?').run(
      nextVersion, pdfFileId ?? null, pdfFileName ?? null, nextStatus, now, String(prop.id)
    );
    db.prepare(
      `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), String(prop.id), nextVersion, pdfFileId ?? prop.pdf_file_id, pdfFileName ?? prop.pdf_file_name, String(changeNote || `Revisi versi ${nextVersion}`), req.authUser!.fullName, now);

    writeAuditLog(db, req.authUser!, 'REVISE_PROPOSAL', 'proposal', String(prop.reference_number), 'berhasil', `Versi ${nextVersion}`);
    res.json({ ok: true, version: nextVersion });
  });

  // ==================== LKL & COORDINATOR REPORTS ====================
  app.get('/api/lkl', requireAuth, requirePermission('lkl', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    let sql = 'SELECT * FROM lkl_reports WHERE 1=1';
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
        createdAt: String(r.created_at),
      })),
    });
  });

  app.post('/api/lkl', requireAuth, requirePermission('lkl', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.activityName || !b.eventDate || !b.summary) {
      res.status(422).json({ error: 'Nama kegiatan, tanggal pelaksanaan, dan ringkasan kegiatan wajib diisi.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const refNo = nextReferenceNumber(db, 'LKL');
    const id = crypto.randomUUID();
    const provCode = String(b.provinceCode || user.provinceCode || '31');
    const mode = b.activityMode === 'daring' ? 'daring' : 'luring';

    let proposalRef: string | null = null;
    if (b.proposalId) {
      const p = db.prepare('SELECT reference_number FROM proposals WHERE id = ?').get(String(b.proposalId)) as { reference_number: string } | undefined;
      if (p) proposalRef = p.reference_number;
    }

    db.prepare(
      `INSERT INTO lkl_reports (
        id, reference_number, version, activity_name, proposal_id, proposal_ref, submitter_personnel_id, submitter_name,
        province_code, regency, district, village, venue_name, venue_address, event_date, start_time, end_time,
        category, activity_mode, platform_name, platform_link, pic_name, participant_count, summary, outcomes,
        obstacles, follow_up, pdf_file_id, pdf_file_name, photo_file_ids_json, status, created_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_pemeriksaan', ?)`
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
      JSON.stringify(Array.isArray(b.photoFileIds) ? b.photoFileIds : []), new Date().toISOString()
    );

    writeAuditLog(db, user, 'SUBMIT_LKL', 'lkl', refNo);
    writeActivityTimeline(db, 'LKL', `LKL ${refNo} Dikirim`, `${b.activityName} (${mode}) dikirim oleh ${user.fullName}.`, user.fullName, provCode, user.batchId, '/laporan-kegiatan');
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.post('/api/lkl/:id/review', requireAuth, requirePermission('lkl', 'review'), (req: AuthenticatedRequest, res: Response) => {
    const { decision, note } = req.body ?? {};
    if (!['diterima', 'perlu_revisi', 'ditolak'].includes(String(decision))) {
      res.status(422).json({ error: 'Keputusan harus diterima, perlu_revisi, atau ditolak.' });
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
      res.status(403).json({ error: 'Koordinator hanya dapat memeriksa LKL di provinsinya.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare('UPDATE lkl_reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
      String(decision), String(note || ''), user.fullName, now, String(lkl.id)
    );

    const submitterUser = db.prepare('SELECT id FROM users WHERE personnel_id = ?').get(String(lkl.submitter_personnel_id)) as { id: string } | undefined;
    if (submitterUser) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
         VALUES (?, ?, ?, ?, 'lkl', '/laporan-kegiatan', 0, ?)`
      ).run(crypto.randomUUID(), submitterUser.id, `Pemeriksaan LKL ${lkl.reference_number}: ${decision.replace(/_/g, ' ')}`, String(note || lkl.activity_name), now);
    }

    writeAuditLog(db, user, `REVIEW_LKL_${String(decision).toUpperCase()}`, 'lkl', String(lkl.reference_number), 'berhasil', String(note || ''));
    writeActivityTimeline(db, 'LKL', `LKL ${lkl.reference_number} ${decision.replace(/_/g, ' ')}`, `${lkl.activity_name} diperiksa oleh ${user.fullName}.`, user.fullName, String(lkl.province_code), null, '/laporan-kegiatan');
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
    const refNo = nextReferenceNumber(db, 'LKW');
    const id = crypto.randomUUID();
    const lklCnt = (db.prepare("SELECT COUNT(*) AS c FROM lkl_reports WHERE province_code = ? AND status = 'diterima'").get(provCode) as { c: number }).c;

    db.prepare(
      `INSERT INTO coordinator_reports (id, reference_number, report_type, province_code, batch_id, coordinator_id, coordinator_name, period_label, personnel_condition, activities_summary, lkl_recap_count, obstacles, coaching_needs, follow_up_plan, pdf_file_id, pdf_file_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dikirim', ?)`
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

  app.post('/api/coordinator-reports/:id/review', requireAuth, requirePermission('laporan_koordinator', 'review'), (req: AuthenticatedRequest, res: Response) => {
    const { decision, note } = req.body ?? {};
    if (!['diterima', 'perlu_revisi'].includes(String(decision))) {
      res.status(422).json({ error: 'Keputusan harus diterima atau perlu_revisi.' });
      return;
    }
    const db = getDb();
    const r = db.prepare('SELECT * FROM coordinator_reports WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!r) {
      res.status(404).json({ error: 'Laporan koordinator tidak ditemukan.' });
      return;
    }
    db.prepare('UPDATE coordinator_reports SET status = ?, review_note = ?, reviewed_by = ? WHERE id = ?').run(
      String(decision),
      String(note || ''),
      req.authUser!.fullName,
      String(r.id)
    );
    writeAuditLog(db, req.authUser!, 'REVIEW_COORDINATOR_REPORT', 'coordinator_report', String(r.reference_number), 'berhasil', String(decision));
    res.json({ ok: true });
  });
}
