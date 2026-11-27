import crypto from 'node:crypto';
import type { Express, Response } from 'express';
import { getDb, nextReferenceNumber } from './db';
import {
  type AuthenticatedRequest,
  createNotificationIdempotent,
  requireAuth,
  requirePermission,
  writeActivityTimeline,
  writeAuditLog,
} from './security';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';

export function registerProgramAndCorrespondenceRoutes(app: Express): void {
  // ==================== PUBLIC SHOWCASE: PROGRAMS & ORG STRUCTURE ====================
  app.get('/api/public/programs', (_req, res: Response) => {
    const db = getDb();
    const rows = db
      .prepare('SELECT * FROM flagship_programs WHERE is_public = 1 ORDER BY id ASC')
      .all() as Record<string, unknown>[];

    const programs = rows.map((p) => {
      const pid = String(p.id);
      const lklAgg = db
        .prepare(
          `SELECT COUNT(*) AS lkl_count,
                  COALESCE(SUM(participant_count), 0) AS total_participants,
                  COUNT(DISTINCT province_code) AS prov_count
           FROM lkl_reports
           WHERE program_id = ? AND status = 'diterima'`
        )
        .get(pid) as { lkl_count: number; total_participants: number; prov_count: number };
      const propAgg = db
        .prepare("SELECT COUNT(*) AS prop_count FROM proposals WHERE program_id = ? AND status = 'disetujui'")
        .get(pid) as { prop_count: number };

      return {
        id: pid,
        slug: String(p.slug),
        name: String(p.name),
        tagline: String(p.tagline),
        description: String(p.description),
        objectives: String(p.objectives),
        bidang: String(p.bidang),
        leadName: String(p.lead_name),
        status: String(p.status),
        targetProvinces: Number(p.target_provinces || 38),
        targetParticipants: Number(p.target_participants || 0),
        periodLabel: String(p.period_label || '2026–2027'),
        metrics: {
          approvedProposalsCount: Number(propAgg?.prop_count || 0),
          approvedLklCount: Number(lklAgg?.lkl_count || 0),
          totalParticipants: Number(lklAgg?.total_participants || 0),
          provincesReached: Number(lklAgg?.prov_count || 0),
        },
      };
    });

    res.json({ programs });
  });

  app.get('/api/public/organization', (_req, res: Response) => {
    const db = getDb();
    const rows = db
      .prepare(
        `SELECT id, title, bidang, level, parent_id, category, sort_order, is_vacant, holder_name, status
         FROM organization_positions
         WHERE status = 'aktif'
         ORDER BY sort_order ASC, level ASC, title ASC`
      )
      .all() as Record<string, unknown>[];

    const positions = rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      bidang: String(r.bidang),
      level: String(r.level),
      parentId: r.parent_id ? String(r.parent_id) : null,
      category: String(r.category || 'Bidang'),
      sortOrder: Number(r.sort_order || 10),
      isVacant: Boolean(r.is_vacant) || !r.holder_name,
      holderName: r.holder_name ? String(r.holder_name).replace(/\s*\(Simulasi\)\s*$/i, '') : null,
    }));

    res.json({ positions });
  });

  // ==================== FLAGSHIP PROGRAMS COMMAND CENTER ====================
  app.get('/api/programs', requireAuth, requirePermission('program', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const provinceCode = req.query.provinceCode ? String(req.query.provinceCode) : '';
    const batchId = req.query.batchId ? String(req.query.batchId) : '';
    const regency = req.query.regency ? String(req.query.regency).trim() : '';

    const rows = db.prepare('SELECT * FROM flagship_programs ORDER BY id ASC').all() as Record<string, unknown>[];
    const programs = rows.map((p) => {
      const pid = String(p.id);
      const pConds = ['program_id = ?'];
      const pParams: string[] = [pid];
      if (provinceCode) {
        pConds.push('province_code = ?');
        pParams.push(provinceCode);
      }
      if (batchId) {
        pConds.push('batch_id = ?');
        pParams.push(batchId);
      }

      const lConds = ['program_id = ?'];
      const lParams: string[] = [pid];
      if (provinceCode) {
        lConds.push('province_code = ?');
        lParams.push(provinceCode);
      }
      if (regency) {
        lConds.push('LOWER(regency) LIKE ?');
        lParams.push(`%${regency.toLowerCase()}%`);
      }

      const propStats = db
        .prepare(
          `SELECT COUNT(*) AS total_c,
                  SUM(CASE WHEN status = 'disetujui' THEN 1 ELSE 0 END) AS ok_c
           FROM proposals WHERE ${pConds.join(' AND ')}`
        )
        .get(...pParams) as { total_c: number; ok_c: number | null };

      const lklStats = db
        .prepare(
          `SELECT COUNT(*) AS total_c,
                  SUM(CASE WHEN status = 'diterima' THEN 1 ELSE 0 END) AS ok_c,
                  COALESCE(SUM(CASE WHEN status = 'diterima' THEN participant_count ELSE 0 END), 0) AS part_c,
                  COUNT(DISTINCT province_code) AS prov_c
           FROM lkl_reports WHERE ${lConds.join(' AND ')}`
        )
        .get(...lParams) as { total_c: number; ok_c: number | null; part_c: number; prov_c: number };

      const tConds = ['program_id = ?'];
      const tParams: string[] = [pid];
      if (provinceCode) {
        tConds.push('province_code = ?');
        tParams.push(provinceCode);
      }
      if (batchId) {
        tConds.push('batch_id = ?');
        tParams.push(batchId);
      }
      const taskStats = db
        .prepare(
          `SELECT COUNT(*) AS total_c,
                  SUM(CASE WHEN status = 'selesai' THEN 1 ELSE 0 END) AS done_c
           FROM tasks WHERE ${tConds.join(' AND ')}`
        )
        .get(...tParams) as { total_c: number; done_c: number | null };

      const evalStats = db
        .prepare('SELECT COUNT(*) AS eval_c, AVG(total_score) AS avg_score FROM evaluations WHERE program_id = ?')
        .get(pid) as { eval_c: number; avg_score: number | null };

      return {
        id: pid,
        slug: String(p.slug),
        name: String(p.name),
        tagline: String(p.tagline),
        description: String(p.description),
        objectives: String(p.objectives),
        bidang: String(p.bidang),
        leadName: String(p.lead_name),
        status: String(p.status),
        targetProvinces: Number(p.target_provinces || 38),
        targetParticipants: Number(p.target_participants || 0),
        periodLabel: String(p.period_label || '2026–2027'),
        isPublic: Boolean(p.is_public),
        updatedAt: String(p.updated_at),
        metrics: {
          proposalsTotal: Number(propStats?.total_c || 0),
          proposalsApproved: Number(propStats?.ok_c || 0),
          lklTotal: Number(lklStats?.total_c || 0),
          lklApproved: Number(lklStats?.ok_c || 0),
          participantsReached: Number(lklStats?.part_c || 0),
          provincesReached: Number(lklStats?.prov_c || 0),
          tasksTotal: Number(taskStats?.total_c || 0),
          tasksCompleted: Number(taskStats?.done_c || 0),
          evaluationsCount: Number(evalStats?.eval_c || 0),
          avgEvaluationScore: evalStats?.avg_score !== null && evalStats?.avg_score !== undefined ? Math.round(evalStats.avg_score * 10) / 10 : null,
        },
      };
    });

    res.json({ programs });
  });

  app.get('/api/programs/:slug', requireAuth, requirePermission('program', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const slug = String(req.params.slug);
    const p = db.prepare('SELECT * FROM flagship_programs WHERE slug = ? OR id = ?').get(slug, slug) as Record<string, unknown> | undefined;
    if (!p) {
      res.status(404).json({ error: 'Program unggulan tidak ditemukan.', code: 404 });
      return;
    }
    const pid = String(p.id);
    const proposals = db
      .prepare('SELECT id, reference_number, title, applicant_name, province_code, event_date, status, estimated_participants FROM proposals WHERE program_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(pid) as Record<string, unknown>[];
    const lklReports = db
      .prepare('SELECT id, reference_number, activity_name, submitter_name, province_code, regency, event_date, participant_count, status FROM lkl_reports WHERE program_id = ? ORDER BY created_at DESC LIMIT 50')
      .all(pid) as Record<string, unknown>[];
    const tasks = db
      .prepare('SELECT id, reference_number, title, priority, status, deadline, assignee_name, province_code FROM tasks WHERE program_id = ? ORDER BY deadline ASC LIMIT 50')
      .all(pid) as Record<string, unknown>[];
    const documents = db
      .prepare('SELECT id, document_number, title, category, version, status, issued_date, file_id FROM documents WHERE program_id = ? ORDER BY issued_date DESC LIMIT 30')
      .all(pid) as Record<string, unknown>[];
    const correspondence = db
      .prepare('SELECT id, reference_number, direction, letter_type, subject, letter_date, status FROM correspondence WHERE program_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(pid) as Record<string, unknown>[];
    const evaluations = db
      .prepare('SELECT id, personnel_name, province_code, evaluator_name, evaluator_type, total_score, coaching_recommendation, created_at FROM evaluations WHERE program_id = ? ORDER BY created_at DESC LIMIT 30')
      .all(pid) as Record<string, unknown>[];

    res.json({
      program: {
        id: pid,
        slug: String(p.slug),
        name: String(p.name),
        tagline: String(p.tagline),
        description: String(p.description),
        objectives: String(p.objectives),
        bidang: String(p.bidang),
        leadName: String(p.lead_name),
        status: String(p.status),
        targetProvinces: Number(p.target_provinces || 38),
        targetParticipants: Number(p.target_participants || 0),
        periodLabel: String(p.period_label || '2026–2027'),
        isPublic: Boolean(p.is_public),
        updatedAt: String(p.updated_at),
      },
      proposals: proposals.map((x) => ({
        ...x,
        provinceName: PROVINCE_BY_CODE.get(String(x.province_code))?.name ?? String(x.province_code),
      })),
      lklReports: lklReports.map((x) => ({
        ...x,
        provinceName: PROVINCE_BY_CODE.get(String(x.province_code))?.name ?? String(x.province_code),
      })),
      tasks,
      documents,
      correspondence,
      evaluations,
    });
  });

  app.patch('/api/programs/:id', requireAuth, requirePermission('program', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM flagship_programs WHERE id = ? OR slug = ?').get(id, id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Program unggulan tidak ditemukan.', code: 404 });
      return;
    }
    const b = req.body ?? {};
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE flagship_programs SET
        name = COALESCE(?, name),
        tagline = COALESCE(?, tagline),
        description = COALESCE(?, description),
        objectives = COALESCE(?, objectives),
        bidang = COALESCE(?, bidang),
        lead_name = COALESCE(?, lead_name),
        status = COALESCE(?, status),
        target_provinces = COALESCE(?, target_provinces),
        target_participants = COALESCE(?, target_participants),
        period_label = COALESCE(?, period_label),
        is_public = COALESCE(?, is_public),
        updated_at = ?
       WHERE id = ?`
    ).run(
      b.name ?? null,
      b.tagline ?? null,
      b.description ?? null,
      b.objectives ?? null,
      b.bidang ?? null,
      b.leadName ?? null,
      b.status ?? null,
      b.targetProvinces !== undefined ? Number(b.targetProvinces) : null,
      b.targetParticipants !== undefined ? Number(b.targetParticipants) : null,
      b.periodLabel ?? null,
      b.isPublic !== undefined ? (b.isPublic ? 1 : 0) : null,
      now,
      String(existing.id)
    );
    writeAuditLog(db, req.authUser!, 'UPDATE_FLAGSHIP_PROGRAM', 'flagship_program', String(existing.id), 'berhasil', String(b.name || existing.name));
    res.json({ ok: true });
  });

  // ==================== PERSURATAN & DISPOSISI DIGITAL ====================
  app.get('/api/correspondence', requireAuth, requirePermission('persuratan', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const direction = req.query.direction ? String(req.query.direction) : '';
    const status = req.query.status ? String(req.query.status) : '';
    const provinceCode = req.query.provinceCode ? String(req.query.provinceCode) : '';

    const conds: string[] = [];
    const params: string[] = [];
    if (direction) {
      conds.push('direction = ?');
      params.push(direction);
    }
    if (status) {
      conds.push('status = ?');
      params.push(status);
    }
    if (user.role === 'koordinator_wilayah' && user.provinceCode) {
      conds.push('(province_code = ? OR province_code IS NULL OR id IN (SELECT correspondence_id FROM correspondence_dispositions WHERE to_user_id = ?))');
      params.push(user.provinceCode, user.id);
    } else if (user.role === 'duta' || user.role === 'alumni') {
      conds.push('(created_by = ? OR id IN (SELECT correspondence_id FROM correspondence_dispositions WHERE to_user_id = ?))');
      params.push(user.id, user.id);
    } else if (provinceCode) {
      conds.push('province_code = ?');
      params.push(provinceCode);
    }

    const whereSql = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
    const rows = db
      .prepare(`SELECT * FROM correspondence ${whereSql} ORDER BY created_at DESC LIMIT 120`)
      .all(...params) as Record<string, unknown>[];

    const letters = rows.map((r) => {
      const disps = db
        .prepare('SELECT * FROM correspondence_dispositions WHERE correspondence_id = ? ORDER BY created_at DESC')
        .all(String(r.id)) as Record<string, unknown>[];
      const provCode = r.province_code ? String(r.province_code) : null;
      return {
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        direction: String(r.direction) as 'masuk' | 'keluar',
        letterType: String(r.letter_type),
        subject: String(r.subject),
        senderName: String(r.sender_name),
        recipientName: String(r.recipient_name),
        letterDate: String(r.letter_date),
        receivedDate: r.received_date ? String(r.received_date) : null,
        provinceCode: provCode,
        provinceName: provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : 'Nasional',
        programId: r.program_id ? String(r.program_id) : null,
        urgency: String(r.urgency),
        status: String(r.status),
        fileId: r.file_id ? String(r.file_id) : null,
        fileName: r.file_name ? String(r.file_name) : null,
        summary: String(r.summary || ''),
        createdBy: String(r.created_by),
        createdByName: String(r.created_by_name),
        createdAt: String(r.created_at),
        dispositions: disps.map((d) => ({
          id: String(d.id),
          correspondenceId: String(d.correspondence_id),
          fromUserId: String(d.from_user_id),
          fromUserName: String(d.from_user_name),
          toUserId: d.to_user_id ? String(d.to_user_id) : null,
          toUserName: String(d.to_user_name),
          instruction: String(d.instruction),
          dueDate: d.due_date ? String(d.due_date) : null,
          status: String(d.status),
          responseNote: d.response_note ? String(d.response_note) : null,
          createdAt: String(d.created_at),
          completedAt: d.completed_at ? String(d.completed_at) : null,
        })),
      };
    });

    const users = db
      .prepare("SELECT id, full_name, role, province_code FROM users WHERE account_status = 'aktif' ORDER BY full_name ASC")
      .all() as Record<string, unknown>[];
    const programs = db.prepare('SELECT id, name, slug FROM flagship_programs ORDER BY id ASC').all();

    res.json({
      letters,
      recipients: users.map((u) => ({
        id: String(u.id),
        fullName: String(u.full_name),
        role: String(u.role),
        provinceCode: u.province_code ? String(u.province_code) : null,
      })),
      programs,
    });
  });

  app.post('/api/correspondence', requireAuth, requirePermission('persuratan', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.subject || !b.senderName || !b.recipientName || !b.letterType) {
      res.status(422).json({ error: 'Jenis surat, perihal, pengirim, dan penerima wajib diisi.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const provCode = b.provinceCode ? String(b.provinceCode) : user.role === 'koordinator_wilayah' ? user.provinceCode : null;
    if (user.role === 'koordinator_wilayah' && user.provinceCode && provCode && provCode !== user.provinceCode) {
      res.status(403).json({ error: 'Koordinator hanya dapat mencatat surat pada provinsinya sendiri atau surat nasional.' });
      return;
    }
    const id = crypto.randomUUID();
    const refNo = nextReferenceNumber(db, 'SURAT');
    const now = new Date().toISOString();
    const direction = b.direction === 'masuk' ? 'masuk' : 'keluar';

    db.prepare(
      `INSERT INTO correspondence
       (id, reference_number, direction, letter_type, subject, sender_name, recipient_name, letter_date, received_date, province_code, program_id, urgency, status, file_id, file_name, summary, created_by, created_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      refNo,
      direction,
      String(b.letterType),
      String(b.subject).trim(),
      String(b.senderName).trim(),
      String(b.recipientName).trim(),
      String(b.letterDate || now.slice(0, 10)),
      b.receivedDate ? String(b.receivedDate) : direction === 'masuk' ? now.slice(0, 10) : null,
      provCode,
      b.programId ? String(b.programId) : null,
      ['biasa', 'segera', 'sangat_segera'].includes(String(b.urgency)) ? String(b.urgency) : 'biasa',
      direction === 'masuk' ? 'baru' : 'terkirim',
      b.fileId ? String(b.fileId) : null,
      b.fileName ? String(b.fileName) : null,
      String(b.summary || ''),
      user.id,
      user.fullName,
      now
    );

    writeAuditLog(db, user, 'CREATE_CORRESPONDENCE', 'correspondence', refNo, 'berhasil', `${direction}: ${String(b.subject)}`);
    writeActivityTimeline(
      db,
      'Persuratan',
      `Surat ${direction === 'masuk' ? 'Masuk' : 'Keluar'} ${refNo}`,
      `${String(b.subject)} (${String(b.letterType)}) dicatat oleh ${user.fullName}.`,
      user.fullName,
      provCode,
      null,
      '/persuratan'
    );

    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.get('/api/correspondence/:id', requireAuth, requirePermission('persuratan', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const id = String(req.params.id);
    const r = db.prepare('SELECT * FROM correspondence WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!r) {
      res.status(404).json({ error: 'Data surat tidak ditemukan.', code: 404 });
      return;
    }
    const dispositions = db
      .prepare('SELECT * FROM correspondence_dispositions WHERE correspondence_id = ? ORDER BY created_at DESC')
      .all(id);
    res.json({ letter: r, dispositions });
  });

  app.post('/api/correspondence/:id/dispose', requireAuth, requirePermission('persuratan', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const corrId = String(req.params.id);
    const letter = db.prepare('SELECT * FROM correspondence WHERE id = ?').get(corrId) as Record<string, unknown> | undefined;
    if (!letter) {
      res.status(404).json({ error: 'Surat tidak ditemukan.', code: 404 });
      return;
    }
    const { toUserId, toUserName, instruction, dueDate } = req.body ?? {};
    if (!String(instruction || '').trim() || (!toUserId && !String(toUserName || '').trim())) {
      res.status(422).json({ error: 'Penerima disposisi dan instruksi tindak lanjut wajib diisi.' });
      return;
    }
    let targetName = String(toUserName || '').trim();
    if (toUserId) {
      const u = db.prepare('SELECT full_name FROM users WHERE id = ?').get(String(toUserId)) as { full_name: string } | undefined;
      if (u) targetName = u.full_name;
    }
    const dispId = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO correspondence_dispositions
       (id, correspondence_id, from_user_id, from_user_name, to_user_id, to_user_name, instruction, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'belum_dibaca', ?)`
    ).run(
      dispId,
      corrId,
      user.id,
      user.fullName,
      toUserId ? String(toUserId) : null,
      targetName,
      String(instruction).trim(),
      dueDate ? String(dueDate) : null,
      now
    );

    db.prepare("UPDATE correspondence SET status = 'didisposisikan' WHERE id = ?").run(corrId);

    if (toUserId) {
      createNotificationIdempotent(db, {
        userId: String(toUserId),
        title: `Disposisi Surat ${String(letter.reference_number)}`,
        message: `${String(letter.subject)} — Instruksi: ${String(instruction).trim()}`,
        category: 'persuratan',
        targetPath: '/persuratan',
        eventKey: `corr_disp_${dispId}`,
      });
    }

    writeAuditLog(db, user, 'DISPOSE_CORRESPONDENCE', 'correspondence', String(letter.reference_number), 'berhasil', `Ke: ${targetName}`);
    res.status(201).json({ ok: true, id: dispId });
  });

  app.patch('/api/correspondence/dispositions/:dispId', requireAuth, requirePermission('persuratan', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const dispId = String(req.params.dispId);
    const disp = db.prepare('SELECT * FROM correspondence_dispositions WHERE id = ?').get(dispId) as Record<string, unknown> | undefined;
    if (!disp) {
      res.status(404).json({ error: 'Disposisi tidak ditemukan.', code: 404 });
      return;
    }
    const isAdminOrSek = ['super_admin', 'wakil_super_admin', 'sekretariat_nasional', 'penanggung_jawab'].includes(user.role);
    if (!isAdminOrSek && disp.to_user_id !== user.id && disp.from_user_id !== user.id) {
      res.status(403).json({ error: 'Anda tidak berwenang memperbarui status disposisi ini.', code: 403 });
      return;
    }
    const { status, responseNote } = req.body ?? {};
    if (!['belum_dibaca', 'dibaca', 'ditindaklanjuti', 'selesai'].includes(String(status))) {
      res.status(422).json({ error: 'Status disposisi tidak valid.' });
      return;
    }
    const now = new Date().toISOString();
    db.prepare(
      `UPDATE correspondence_dispositions
       SET status = ?, response_note = COALESCE(?, response_note), completed_at = ?
       WHERE id = ?`
    ).run(String(status), responseNote ? String(responseNote) : null, status === 'selesai' ? now : null, dispId);

    if (status === 'selesai') {
      const pending = db
        .prepare("SELECT COUNT(*) AS c FROM correspondence_dispositions WHERE correspondence_id = ? AND status != 'selesai'")
        .get(String(disp.correspondence_id)) as { c: number };
      if (Number(pending.c) === 0) {
        db.prepare("UPDATE correspondence SET status = 'selesai' WHERE id = ?").run(String(disp.correspondence_id));
      }
    }

    writeAuditLog(db, user, 'UPDATE_DISPOSITION', 'correspondence_disposition', dispId, 'berhasil', String(status));
    res.json({ ok: true });
  });
}
