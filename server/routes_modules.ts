import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Express, Response } from 'express';
import JSZip from 'jszip';
import { jsPDF } from 'jspdf';
import { BACKUP_STORAGE_DIR, DB_PATH, getDb, IS_DEMO_MODE, nextReferenceNumber, PRIVATE_STORAGE_DIR, resetDbConnection } from './db';
import {
  type AuthenticatedRequest,
  hashPassword,
  requireAuth,
  requirePermission,
  sha256,
  writeActivityTimeline,
  writeAuditLog,
} from './security';
import { calculateAlumniWindow, ROLE_LABELS } from '../src/lib/rbac';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';
import type { RoleCode } from '../src/lib/types';

export function registerModuleRoutes(app: Express): void {
  // ==================== TASKS ====================
  app.get('/api/tasks', requireAuth, requirePermission('tugas', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    let sql = 'SELECT * FROM tasks WHERE 1=1';
    const params: string[] = [];
    if (user.role === 'duta') {
      sql += ' AND assignee_id = ?';
      params.push(user.id);
    } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
      sql += ' AND (province_code = ? OR assignee_id = ?)';
      params.push(user.provinceCode, user.id);
    }
    sql += ' ORDER BY deadline ASC';
    const rows = db.prepare(sql).all(...params) as Record<string, unknown>[];

    const tasks = rows.map((r) => {
      const commentCount = (db.prepare('SELECT COUNT(*) AS c FROM task_comments WHERE task_id = ?').get(String(r.id)) as { c: number }).c;
      return {
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        title: String(r.title),
        description: String(r.description),
        priority: String(r.priority),
        status: String(r.status),
        deadline: String(r.deadline),
        provinceCode: r.province_code ? String(r.province_code) : null,
        provinceName: r.province_code ? PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? null : null,
        batchId: r.batch_id ? String(r.batch_id) : null,
        assigneeId: String(r.assignee_id),
        assigneeName: String(r.assignee_name),
        creatorName: String(r.creator_name),
        checklist: JSON.parse(String(r.checklist_json || '[]')),
        isTemplate: Boolean(r.is_template),
        recurrence: String(r.recurrence),
        commentCount,
        createdAt: String(r.created_at),
      };
    });
    res.json({ tasks });
  });

  app.post('/api/tasks', requireAuth, requirePermission('tugas', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.title || !b.deadline) {
      res.status(422).json({ error: 'Judul tugas dan tenggat waktu wajib diisi.' });
      return;
    }
    const db = getDb();
    const user = req.authUser!;
    const refNo = nextReferenceNumber(db, 'TGS');
    const id = crypto.randomUUID();
    const assigneeId = String(b.assigneeId || user.id);
    const assigneeRow = db.prepare('SELECT full_name FROM users WHERE id = ?').get(assigneeId) as { full_name: string } | undefined;

    db.prepare(
      `INSERT INTO tasks (id, reference_number, title, description, priority, status, deadline, province_code, batch_id, assignee_id, assignee_name, creator_id, creator_name, checklist_json, is_template, recurrence, created_at)
       VALUES (?, ?, ?, ?, ?, 'belum_dimulai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, refNo, String(b.title), String(b.description || ''), String(b.priority || 'sedang'), String(b.deadline),
      b.provinceCode ? String(b.provinceCode) : user.provinceCode, String(b.batchId || 'batch-3'),
      assigneeId, assigneeRow?.full_name || user.fullName, user.id, user.fullName,
      JSON.stringify(Array.isArray(b.checklist) ? b.checklist : []), b.isTemplate ? 1 : 0, String(b.recurrence || 'tidak'), new Date().toISOString()
    );

    if (assigneeId !== user.id) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
         VALUES (?, ?, ?, ?, 'tugas', '/tugas', 0, ?)`
      ).run(crypto.randomUUID(), assigneeId, `Tugas Baru ${refNo}`, String(b.title), new Date().toISOString());
    }

    writeAuditLog(db, user, 'CREATE_TASK', 'task', refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.post('/api/tasks/bulk-assign', requireAuth, requirePermission('tugas', 'assign'), (req: AuthenticatedRequest, res: Response) => {
    const { title, description, deadline, provinceCode, priority } = req.body ?? {};
    if (!title || !deadline || !provinceCode) {
      res.status(422).json({ error: 'Judul tugas, tenggat, dan provinsi target wajib diisi.' });
      return;
    }
    const db = getDb();
    const targets = db
      .prepare("SELECT id, full_name FROM users WHERE province_code = ? AND account_status = 'aktif'")
      .all(String(provinceCode)) as { id: string; full_name: string }[];

    let created = 0;
    const now = new Date().toISOString();
    for (const t of targets) {
      const refNo = nextReferenceNumber(db, 'TGS');
      db.prepare(
        `INSERT INTO tasks (id, reference_number, title, description, priority, status, deadline, province_code, batch_id, assignee_id, assignee_name, creator_id, creator_name, checklist_json, is_template, recurrence, created_at)
         VALUES (?, ?, ?, ?, ?, 'belum_dimulai', ?, ?, 'batch-3', ?, ?, ?, ?, '[]', 0, 'tidak', ?)`
      ).run(crypto.randomUUID(), refNo, String(title), String(description || ''), String(priority || 'sedang'), String(deadline), String(provinceCode), t.id, t.full_name, req.authUser!.id, req.authUser!.fullName, now);
      created += 1;
    }
    writeAuditLog(db, req.authUser!, 'BULK_ASSIGN_TASK', 'task', `prov:${provinceCode}`, 'berhasil', `${created} penerima`);
    res.json({ ok: true, assignedCount: created });
  });

  app.patch('/api/tasks/:id', requireAuth, requirePermission('tugas', 'edit'), (req: AuthenticatedRequest, res: Response) => {
    const { status, checklist } = req.body ?? {};
    const db = getDb();
    db.prepare('UPDATE tasks SET status = COALESCE(?, status), checklist_json = COALESCE(?, checklist_json) WHERE id = ?').run(
      status ?? null,
      checklist ? JSON.stringify(checklist) : null,
      String(req.params.id)
    );
    res.json({ ok: true });
  });

  app.get('/api/tasks/:id/comments', requireAuth, requirePermission('tugas', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const comments = db.prepare('SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC').all(String(req.params.id));
    res.json({ comments });
  });

  app.post('/api/tasks/:id/comments', requireAuth, requirePermission('tugas', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const body = String(req.body?.body || '').trim();
    if (!body) {
      res.status(422).json({ error: 'Isi komentar tidak boleh kosong.' });
      return;
    }
    const db = getDb();
    db.prepare('INSERT INTO task_comments (id, task_id, author_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      crypto.randomUUID(), String(req.params.id), req.authUser!.id, req.authUser!.fullName, body, new Date().toISOString()
    );
    res.status(201).json({ ok: true });
  });

  // ==================== DOCUMENTS, SOP LIBRARY & BULK GENERATOR ====================
  app.get('/api/documents', requireAuth, requirePermission('dokumen', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    let sql = 'SELECT * FROM documents WHERE 1=1';
    if (user.role === 'duta' || user.role === 'alumni') {
      sql += " AND access_level IN ('internal_semua')";
    } else if (user.role === 'koordinator_wilayah') {
      sql += " AND access_level IN ('internal_semua', 'koordinator_ke_atas')";
    }
    sql += ' ORDER BY created_at DESC';
    const rows = db.prepare(sql).all() as Record<string, unknown>[];
    res.json({
      documents: rows.map((d) => ({
        id: String(d.id),
        documentNumber: String(d.document_number),
        title: String(d.title),
        category: String(d.category),
        ownerName: String(d.owner_name),
        issuerName: String(d.issuer_name),
        issuedDate: String(d.issued_date),
        status: String(d.status),
        version: String(d.version),
        accessLevel: String(d.access_level),
        fileId: d.file_id ? String(d.file_id) : null,
        fileName: d.file_name ? String(d.file_name) : null,
        fileSizeBytes: Number(d.file_size_bytes || 0),
        notes: String(d.notes || ''),
        expiresAt: d.expires_at ? String(d.expires_at) : null,
      })),
    });
  });

  app.post('/api/documents', requireAuth, requirePermission('dokumen', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.title || !b.category) {
      res.status(422).json({ error: 'Judul dan kategori dokumen wajib diisi.' });
      return;
    }
    const db = getDb();
    const docNo = nextReferenceNumber(db, 'DOC');
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO documents (id, document_number, title, category, owner_name, issuer_name, issued_date, status, version, access_level, file_id, file_name, file_size_bytes, notes, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'berlaku', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, docNo, String(b.title), String(b.category), String(b.ownerName || req.authUser!.fullName),
      req.authUser!.fullName, String(b.issuedDate || now.slice(0, 10)), String(b.version || '1.0'),
      String(b.accessLevel || 'internal_semua'), b.fileId ? String(b.fileId) : null, b.fileName ? String(b.fileName) : null,
      Number(b.fileSizeBytes || 0), String(b.notes || ''), b.expiresAt ? String(b.expiresAt) : null, now
    );
    writeAuditLog(db, req.authUser!, 'PUBLISH_DOCUMENT', 'document', docNo);
    writeActivityTimeline(db, 'Dokumen', `Dokumen ${docNo} Diterbitkan`, `${b.title} (${b.category}) diterbitkan.`, req.authUser!.fullName, null, null, '/dokumen');
    res.status(201).json({ ok: true, id, documentNumber: docNo });
  });

  app.post('/api/documents/bulk-generate', requireAuth, requirePermission('dokumen', 'publish'), async (req: AuthenticatedRequest, res: Response) => {
    const { personnelIds, templateTitle, templateBody, category } = req.body ?? {};
    const ids: string[] = Array.isArray(personnelIds) ? personnelIds : [];
    if (ids.length === 0 || !templateTitle || !templateBody) {
      res.status(422).json({ error: 'Pilih minimal satu personel serta judul dan isi template dokumen.' });
      return;
    }
    const db = getDb();
    const zip = new JSZip();
    const now = new Date();
    const dateStr = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta' }).format(now);

    for (const pid of ids) {
      const p = db
        .prepare('SELECT p.*, b.name AS batch_name FROM personnel p LEFT JOIN batches b ON b.id = p.batch_id WHERE p.id = ?')
        .get(String(pid)) as Record<string, unknown> | undefined;
      if (!p) continue;
      const docNo = nextReferenceNumber(db, 'DOC');
      const provName = PROVINCE_BY_CODE.get(String(p.province_code))?.name ?? String(p.province_code);
      const rendered = String(templateBody)
        .replace(/\{\{nama\}\}/g, String(p.full_name))
        .replace(/\{\{provinsi\}\}/g, provName)
        .replace(/\{\{angkatan\}\}/g, String(p.batch_name || p.batch_id))
        .replace(/\{\{jabatan\}\}/g, String(p.position_title))
        .replace(/\{\{nomor_surat\}\}/g, docNo)
        .replace(/\{\{tanggal\}\}/g, dateStr);

      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      doc.setFontSize(16);
      doc.text('DUTA PELAJAR BERBUDAYA INDONESIA (DPBI)', 50, 60);
      doc.setFontSize(12);
      doc.text(String(templateTitle), 50, 88);
      doc.setFontSize(10);
      doc.text(`Nomor Dokumen: ${docNo}`, 50, 110);
      doc.text(`Tanggal Terbit: ${dateStr}`, 50, 126);
      doc.line(50, 140, 545, 140);
      const lines = doc.splitTextToSize(rendered, 490);
      doc.text(lines, 50, 168);

      const pdfBytes = Buffer.from(doc.output('arraybuffer'));
      const safeName = String(p.full_name).replace(/[^a-zA-Z0-9]/g, '_');
      zip.file(`${docNo.replace(/\//g, '_')}_${safeName}.pdf`, pdfBytes);

      // Register generated document record
      db.prepare(
        `INSERT INTO documents (id, document_number, title, category, owner_name, issuer_name, issued_date, status, version, access_level, file_size_bytes, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'berlaku', '1.0', 'internal_semua', ?, ?, ?)`
      ).run(
        crypto.randomUUID(), docNo, `${templateTitle} — ${p.full_name}`, String(category || 'Sertifikat'),
        String(p.full_name), req.authUser!.fullName, now.toISOString().slice(0, 10), pdfBytes.length,
        `Diterbitkan massal melalui Bulk Document Generator`, now.toISOString()
      );
    }

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    writeAuditLog(db, req.authUser!, 'BULK_GENERATE_DOCUMENTS', 'document', `count:${ids.length}`);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="SATU_DPBI_Dokumen_Massal.zip"');
    res.send(zipBuf);
  });

  // ==================== ANNOUNCEMENTS, CALENDAR, NOTIFICATIONS, SAVED VIEWS ====================
  app.get('/api/announcements', requireAuth, (_req, res: Response) => {
    const db = getDb();
    const announcements = db.prepare('SELECT * FROM announcements ORDER BY published_at DESC').all();
    res.json({ announcements });
  });

  app.post('/api/announcements', requireAuth, requirePermission('pengumuman', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const { title, body, scope, provinceCode, priority } = req.body ?? {};
    if (!title || !body) {
      res.status(422).json({ error: 'Judul dan isi pengumuman wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO announcements (id, title, body, scope, province_code, batch_id, priority, author_name, published_at, status)
       VALUES (?, ?, ?, ?, ?, 'batch-3', ?, ?, ?, 'terbit')`
    ).run(id, String(title), String(body), String(scope || 'nasional'), provinceCode ? String(provinceCode) : null, String(priority || 'normal'), req.authUser!.fullName, now);
    writeActivityTimeline(db, 'Pengumuman', String(title), String(body).slice(0, 140), req.authUser!.fullName, provinceCode ? String(provinceCode) : null, null, '/pengumuman');
    res.status(201).json({ ok: true, id });
  });

  app.get('/api/calendar', requireAuth, (_req, res: Response) => {
    const db = getDb();
    const events = db.prepare('SELECT * FROM calendar_events ORDER BY start_at ASC').all();
    res.json({ events });
  });

  app.post('/api/calendar', requireAuth, requirePermission('kalender', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const { title, category, startAt, endAt, location, description, provinceCode } = req.body ?? {};
    if (!title || !startAt) {
      res.status(422).json({ error: 'Judul agenda dan waktu mulai wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO calendar_events (id, title, category, start_at, end_at, province_code, batch_id, location, description)
       VALUES (?, ?, ?, ?, ?, ?, 'batch-3', ?, ?)`
    ).run(id, String(title), String(category || 'Agenda Organisasi'), String(startAt), String(endAt || startAt), provinceCode ? String(provinceCode) : null, String(location || 'Daring / Nasional'), String(description || ''));
    res.status(201).json({ ok: true, id });
  });

  app.get('/api/notifications', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.authUser!.id) as Record<string, unknown>[];
    res.json({
      notifications: rows.map((n) => ({
        id: String(n.id),
        userId: String(n.user_id),
        title: String(n.title),
        message: String(n.message),
        category: String(n.category),
        targetPath: String(n.target_path),
        isRead: Boolean(n.is_read),
        createdAt: String(n.created_at),
      })),
    });
  });

  app.post('/api/notifications/:id/read', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(String(req.params.id), req.authUser!.id);
    res.json({ ok: true });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.authUser!.id);
    res.json({ ok: true });
  });

  app.get('/api/saved-views', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const views = db.prepare('SELECT * FROM saved_views WHERE user_id = ? ORDER BY created_at DESC').all(req.authUser!.id);
    res.json({ views });
  });

  app.post('/api/saved-views', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const { module, name, filter } = req.body ?? {};
    if (!module || !name) {
      res.status(422).json({ error: 'Nama tampilan tersimpan wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    db.prepare('INSERT INTO saved_views (id, user_id, module, name, filter_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      id, req.authUser!.id, String(module), String(name), JSON.stringify(filter || {}), new Date().toISOString()
    );
    res.status(201).json({ ok: true, id });
  });

  // ==================== SAFEGUARDING & EVALUATIONS ====================
  app.get('/api/safeguarding', requireAuth, requirePermission('perlindungan', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const risks = db.prepare('SELECT * FROM risk_assessments ORDER BY created_at DESC').all();
    const consents = db
      .prepare(`SELECT * FROM consent_records ${user.role === 'duta' ? 'WHERE personnel_id = ?' : ''} ORDER BY recorded_at DESC`)
      .all(...(user.role === 'duta' ? [user.personnelId || ''] : []));

    const isAuthorizedSafety = ['super_admin', 'penanggung_jawab', 'wakil_super_admin'].includes(user.role);
    const incidents = isAuthorizedSafety
      ? db.prepare('SELECT * FROM incidents ORDER BY created_at DESC').all()
      : db.prepare('SELECT * FROM incidents WHERE reported_by_user_id = ? ORDER BY created_at DESC').all(user.id);
    const whistleblowing = isAuthorizedSafety
      ? db.prepare('SELECT * FROM whistleblowing_reports ORDER BY created_at DESC').all()
      : [];

    res.json({ risks, consents, incidents, whistleblowing, isAuthorizedSafety });
  });

  app.post('/api/safeguarding/risks', requireAuth, requirePermission('perlindungan', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.activityTitle || !b.emergencyPlan || !b.emergencyContact) {
      res.status(422).json({ error: 'Nama kegiatan, rencana darurat, dan kontak darurat wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    const chaperones = Number(b.adultChaperoneCount || 0);
    const u18 = b.participantUnder18 !== false;
    const status = u18 && chaperones < 2 ? 'perlu_peninjauan' : 'disetujui';

    db.prepare(
      `INSERT INTO risk_assessments (id, proposal_id, activity_title, province_code, participant_under_18, adult_chaperone_count, environment_notes, transport_plan, emergency_plan, emergency_contact, risk_level, status, submitted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, b.proposalId ? String(b.proposalId) : null, String(b.activityTitle), String(b.provinceCode || req.authUser!.provinceCode || '31'),
      u18 ? 1 : 0, chaperones, String(b.environmentNotes || ''), String(b.transportPlan || ''),
      String(b.emergencyPlan), String(b.emergencyContact), String(b.riskLevel || 'sedang'), status, req.authUser!.fullName, new Date().toISOString()
    );
    res.status(201).json({ ok: true, id, status });
  });

  app.post('/api/safeguarding/consents', requireAuth, requirePermission('perlindungan', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.activityTitle) {
      res.status(422).json({ error: 'Nama kegiatan wajib diisi.' });
      return;
    }
    const db = getDb();
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO consent_records (id, personnel_id, personnel_name, activity_title, consent_participation, consent_guardian, consent_documentation, consent_publication, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, req.authUser!.personnelId || req.authUser!.id, String(b.personnelName || req.authUser!.fullName),
      String(b.activityTitle), b.consentParticipation ? 1 : 0, b.consentGuardian ? 1 : 0,
      b.consentDocumentation ? 1 : 0, b.consentPublication ? 1 : 0, new Date().toISOString()
    );
    res.status(201).json({ ok: true, id });
  });

  app.post('/api/safeguarding/incidents', requireAuth, requirePermission('perlindungan', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.location || !b.category || !b.chronology) {
      res.status(422).json({ error: 'Lokasi, kategori, dan kronologi faktual insiden wajib diisi.' });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, 'INS');
    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO incidents (id, reference_number, occurred_at, location, province_code, category, urgency, chronology, initial_action, escalated_to, status, reported_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Penanggung Jawab Organisasi', 'ditangani', ?, ?)`
    ).run(
      id, refNo, String(b.occurredAt || new Date().toISOString()), String(b.location),
      String(b.provinceCode || req.authUser!.provinceCode || '31'), String(b.category), String(b.urgency || 'sedang'),
      String(b.chronology), String(b.initialAction || ''), req.authUser!.id, new Date().toISOString()
    );
    writeAuditLog(db, req.authUser!, 'REPORT_INCIDENT', 'incident', refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.post('/api/safeguarding/whistleblowing', requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.category || !b.chronology) {
      res.status(422).json({ error: 'Kategori dan kronologi pengaduan wajib diisi.' });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, 'ADU');
    const id = crypto.randomUUID();
    const conflictRerouted = Boolean(b.conflictWithPrimaryHandler);
    const handlerRole = conflictRerouted ? 'super_admin' : 'penanggung_jawab';
    db.prepare(
      `INSERT INTO whistleblowing_reports (id, reference_number, reporter_mode, category, chronology, assigned_handler_role, conflict_rerouted, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'baru', ?)`
    ).run(id, refNo, String(b.reporterMode || 'rahasia'), String(b.category), String(b.chronology), handlerRole, conflictRerouted ? 1 : 0, new Date().toISOString());
    writeAuditLog(db, req.authUser!, 'SUBMIT_WHISTLEBLOWING', 'whistleblowing', refNo, 'berhasil', conflictRerouted ? 'Dialihkan karena konflik kepentingan' : 'Penanggung Jawab');
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });

  app.get('/api/evaluations', requireAuth, requirePermission('evaluasi', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    let sql = 'SELECT * FROM evaluations WHERE 1=1';
    const params: string[] = [];
    if (user.role === 'duta') {
      sql += ' AND personnel_id = ?';
      params.push(user.personnelId || '__none__');
    } else if (user.role === 'koordinator_wilayah' && user.provinceCode) {
      sql += ' AND province_code = ?';
      params.push(user.provinceCode);
    }
    sql += ' ORDER BY created_at DESC';
    const evaluations = db.prepare(sql).all(...params);
    res.json({ evaluations });
  });

  app.post('/api/evaluations', requireAuth, requirePermission('evaluasi', 'create'), (req: AuthenticatedRequest, res: Response) => {
    const b = req.body ?? {};
    if (!b.personnelId || !b.coachingRecommendation) {
      res.status(422).json({ error: 'Personel dan catatan rekomendasi pembinaan wajib diisi.' });
      return;
    }
    const db = getDb();
    const pers = db.prepare('SELECT full_name, role_code, province_code, batch_id FROM personnel WHERE id = ?').get(String(b.personnelId)) as Record<string, unknown> | undefined;
    if (!pers) {
      res.status(404).json({ error: 'Personel tidak ditemukan.' });
      return;
    }
    const t = Number(b.taskCompletionScore || 85);
    const tl = Number(b.reportTimelinessScore || 85);
    const q = Number(b.reportQualityScore || 85);
    const c = Number(b.coordinationScore || 85);
    const total = Math.round((t * 0.3 + tl * 0.25 + q * 0.25 + c * 0.2) * 10) / 10;

    const id = crypto.randomUUID();
    db.prepare(
      `INSERT INTO evaluations (id, personnel_id, personnel_name, role_code, province_code, batch_id, task_completion_score, report_timeliness_score, report_quality_score, coordination_score, total_score, evaluator_name, coaching_recommendation, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'final', ?)`
    ).run(
      id, String(b.personnelId), String(pers.full_name), String(pers.role_code), String(pers.province_code),
      String(pers.batch_id), t, tl, q, c, total, req.authUser!.fullName, String(b.coachingRecommendation), new Date().toISOString()
    );
    writeAuditLog(db, req.authUser!, 'CREATE_EVALUATION', 'evaluation', String(b.personnelId));
    res.status(201).json({ ok: true, id, totalScore: total });
  });

  // ==================== ARCHIVE & ALUMNI 30-DAY WINDOW ====================
  app.get('/api/archive', requireAuth, requirePermission('arsip', 'view'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const archivedBatches = db.prepare("SELECT * FROM batches WHERE status IN ('selesai', 'diarsipkan') ORDER BY batch_number DESC").all();
    const personalDocs = db
      .prepare(`SELECT * FROM documents WHERE access_level = 'internal_semua' OR owner_name = ? ORDER BY issued_date DESC`)
      .all(user.fullName);
    const personalLkl = db
      .prepare(`SELECT reference_number, activity_name, event_date, participant_count, status FROM lkl_reports ${user.personnelId ? 'WHERE submitter_personnel_id = ?' : 'LIMIT 10'}`)
      .all(...(user.personnelId ? [user.personnelId] : []));

    let alumniWindow = null;
    if (user.alumniAccessExpiresAt) {
      const termEnd = new Date(Date.parse(user.alumniAccessExpiresAt) - 30 * 24 * 60 * 60 * 1000).toISOString();
      alumniWindow = calculateAlumniWindow(termEnd);
    }

    const alumniUsers = ['super_admin', 'sekretariat_nasional'].includes(user.role)
      ? db.prepare("SELECT id, full_name, email, alumni_access_expires_at FROM users WHERE role = 'alumni'").all()
      : [];

    res.json({ archivedBatches, personalDocs, personalLkl, alumniWindow, alumniUsers });
  });

  app.get('/api/archive/export-personal', requireAuth, requirePermission('arsip', 'download'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const user = req.authUser!;
    const profile = user.personnelId
      ? db.prepare('SELECT * FROM personnel WHERE id = ?').get(user.personnelId)
      : null;
    const lkl = user.personnelId
      ? db.prepare('SELECT reference_number, activity_name, event_date, participant_count, status FROM lkl_reports WHERE submitter_personnel_id = ?').all(user.personnelId)
      : [];
    const proposals = user.personnelId
      ? db.prepare('SELECT reference_number, title, event_date, status FROM proposals WHERE applicant_personnel_id = ?').all(user.personnelId)
      : [];

    writeAuditLog(db, user, 'EXPORT_PERSONAL_ARCHIVE', 'user', user.id);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="Arsip_Pribadi_${user.id.slice(0, 8)}.json"`);
    res.send(JSON.stringify({ exportedAt: new Date().toISOString(), user: { fullName: user.fullName, email: user.email, role: user.roleLabel }, profile, proposals, lkl }, null, 2));
  });

  app.post('/api/archive/alumni/:userId/extend', requireAuth, requirePermission('arsip', 'manage'), (req: AuthenticatedRequest, res: Response) => {
    const { days, reason } = req.body ?? {};
    if (!reason) {
      res.status(422).json({ error: 'Alasan perpanjangan akses Alumni wajib dicatat.' });
      return;
    }
    const db = getDb();
    const target = db.prepare("SELECT id, alumni_access_expires_at FROM users WHERE id = ? AND role = 'alumni'").get(String(req.params.userId)) as { id: string; alumni_access_expires_at: string | null } | undefined;
    if (!target) {
      res.status(404).json({ error: 'Akun Alumni tidak ditemukan.' });
      return;
    }
    const baseMs = target.alumni_access_expires_at ? Math.max(Date.now(), Date.parse(target.alumni_access_expires_at)) : Date.now();
    const nextExp = new Date(baseMs + Number(days || 30) * 24 * 60 * 60 * 1000).toISOString();
    db.prepare('UPDATE users SET alumni_access_expires_at = ? WHERE id = ?').run(nextExp, target.id);
    writeAuditLog(db, req.authUser!, 'EXTEND_ALUMNI_ACCESS', 'user', target.id, 'berhasil', `+${days || 30} hari: ${reason}`);
    res.json({ ok: true, newExpiresAt: nextExp });
  });

  // ==================== SYSTEM ADMIN: STORAGE, BACKUP, DATA QUALITY, HEALTH, AUTOMATION, AUDIT ====================
  app.get('/api/system/overview', requireAuth, requirePermission('sistem', 'view'), (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const files = db.prepare('SELECT * FROM stored_files ORDER BY created_at DESC').all() as Record<string, unknown>[];
    const totalUsedBytes = files.reduce((acc, f) => acc + Number(f.size_bytes || 0), 0);
    const dbSizeBytes = fs.existsSync(DB_PATH) ? fs.statSync(DB_PATH).size : 0;
    const quotaMbRow = db.prepare("SELECT value FROM system_settings WHERE key = 'storage_quota_mb'").get() as { value: string } | undefined;
    const quotaBytes = Number(quotaMbRow?.value || 10240) * 1024 * 1024;

    const byModule: Record<string, number> = {};
    for (const f of files) {
      const mod = String(f.module || 'umum');
      byModule[mod] = (byModule[mod] || 0) + Number(f.size_bytes || 0);
    }

    const backups = db.prepare('SELECT * FROM backups ORDER BY created_at DESC').all();
    const automationJobs = db.prepare('SELECT * FROM automation_jobs ORDER BY id ASC').all();
    const auditLogs = db.prepare('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50').all();
    const timeline = db.prepare('SELECT * FROM activity_timeline ORDER BY created_at DESC LIMIT 50').all();
    const settings = db.prepare('SELECT * FROM system_settings').all();

    // Data Quality scanner (read-only recommendations, never auto-deletes)
    const findings: { id: string; severity: 'tinggi' | 'sedang' | 'rendah'; type: string; detail: string; actionPath: string }[] = [];
    const incompleteProfiles = db
      .prepare("SELECT id, full_name FROM personnel WHERE verification_status != 'terverifikasi'")
      .all() as { id: string; full_name: string }[];
    for (const ip of incompleteProfiles) {
      findings.push({
        id: `dq-prof-${ip.id}`,
        severity: 'sedang',
        type: 'Profil Belum Terverifikasi',
        detail: `${ip.full_name} belum menyelesaikan verifikasi berkas identitas.`,
        actionPath: '/personalia',
      });
    }
    const coachingProvs = db
      .prepare("SELECT code, name FROM provinces WHERE status = 'dalam_pembinaan' AND coordinator_name IS NULL")
      .all() as { code: string; name: string }[];
    for (const cp of coachingProvs) {
      findings.push({
        id: `dq-prov-${cp.code}`,
        severity: 'tinggi',
        type: 'Wilayah Dalam Pembinaan Tanpa Koordinator',
        detail: `Provinsi ${cp.name} memerlukan penetapan Koordinator Wilayah.`,
        actionPath: '/wilayah',
      });
    }

    const kemendikdasmenStatus = (db.prepare("SELECT value FROM system_settings WHERE key = 'kemendikdasmen_status'").get() as { value: string } | undefined)?.value || 'nonaktif';

    res.json({
      storage: {
        quotaBytes,
        usedFilesBytes: totalUsedBytes,
        dbSizeBytes,
        usedTotalBytes: totalUsedBytes + dbSizeBytes,
        percentUsed: Math.round(((totalUsedBytes + dbSizeBytes) / quotaBytes) * 10000) / 100,
        fileCount: files.length,
        byModule,
        largestFiles: files.slice(0, 6),
      },
      backups,
      automationJobs,
      findings,
      health: {
        database: 'sehat',
        storage: totalUsedBytes + dbSizeBytes < quotaBytes * 0.85 ? 'sehat' : 'peringatan',
        authSessionEngine: 'sehat',
        demoMode: IS_DEMO_MODE,
        kemendikdasmenIntegration: kemendikdasmenStatus,
        uptimeSeconds: Math.round(process.uptime()),
      },
      auditLogs,
      timeline,
      settings,
    });
  });

  app.post('/api/system/backup', requireAuth, requirePermission('sistem', 'manage'), async (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const backupName = `satu_dpbi_backup_${stamp}.zip`;
    const zip = new JSZip();

    if (fs.existsSync(DB_PATH)) {
      zip.file('database.sqlite', fs.readFileSync(DB_PATH));
    }
    const filesFolder = zip.folder('private_files');
    if (filesFolder && fs.existsSync(PRIVATE_STORAGE_DIR)) {
      for (const fn of fs.readdirSync(PRIVATE_STORAGE_DIR)) {
        const fp = path.join(PRIVATE_STORAGE_DIR, fn);
        if (fs.statSync(fp).isFile()) {
          filesFolder.file(fn, fs.readFileSync(fp));
        }
      }
    }
    zip.file('manifest.json', JSON.stringify({ createdAt: now.toISOString(), isDemoMode: IS_DEMO_MODE, createdBy: req.authUser!.fullName }, null, 2));

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer' });
    const outPath = path.join(BACKUP_STORAGE_DIR, backupName);
    fs.writeFileSync(outPath, zipBuf);
    const checksum = sha256(zipBuf);
    const id = crypto.randomUUID();

    db.prepare(
      `INSERT INTO backups (id, backup_name, backup_type, size_bytes, checksum_sha256, status, notes, created_by, created_at)
       VALUES (?, ?, 'manual', ?, ?, 'berhasil', 'Backup database & berkas privat tervalidasi SHA-256.', ?, ?)`
    ).run(id, backupName, zipBuf.length, checksum, req.authUser!.fullName, now.toISOString());

    writeAuditLog(db, req.authUser!, 'CREATE_BACKUP', 'backup', backupName);
    res.status(201).json({ ok: true, id, backupName, sizeBytes: zipBuf.length, checksum });
  });

  app.get('/api/system/backup/:id/download', requireAuth, requirePermission('sistem', 'manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const b = db.prepare('SELECT * FROM backups WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!b) {
      res.status(404).json({ error: 'Arsip backup tidak ditemukan.' });
      return;
    }
    const filePath = path.join(BACKUP_STORAGE_DIR, path.basename(String(b.backup_name)));
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas backup fisik tidak tersedia.' });
      return;
    }
    writeAuditLog(db, req.authUser!, 'DOWNLOAD_BACKUP', 'backup', String(b.backup_name));
    res.download(filePath, String(b.backup_name));
  });

  app.post('/api/system/backup/:id/validate', requireAuth, requirePermission('sistem', 'restore'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const b = db.prepare('SELECT * FROM backups WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!b) {
      res.status(404).json({ error: 'Backup tidak ditemukan.' });
      return;
    }
    const filePath = path.join(BACKUP_STORAGE_DIR, path.basename(String(b.backup_name)));
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas fisik backup hilang.' });
      return;
    }
    const actualChecksum = sha256(fs.readFileSync(filePath));
    const valid = actualChecksum === String(b.checksum_sha256);
    writeAuditLog(db, req.authUser!, 'VALIDATE_BACKUP', 'backup', String(b.backup_name), valid ? 'berhasil' : 'gagal');
    res.json({ ok: true, valid, actualChecksum, expectedChecksum: String(b.checksum_sha256) });
  });

  app.post('/api/system/backup/:id/restore', requireAuth, requirePermission('sistem', 'restore'), async (req: AuthenticatedRequest, res: Response) => {
    const { confirmed } = req.body ?? {};
    if (confirmed !== true) {
      res.status(422).json({ error: 'Konfirmasi eksplisit wajib dicentang sebelum menjalankan pemulihan (restore).' });
      return;
    }
    const db = getDb();
    const b = db.prepare('SELECT * FROM backups WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!b) {
      res.status(404).json({ error: 'Backup tidak ditemukan.' });
      return;
    }
    const filePath = path.join(BACKUP_STORAGE_DIR, path.basename(String(b.backup_name)));
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'Berkas backup tidak ditemukan.' });
      return;
    }
    const buf = fs.readFileSync(filePath);
    if (sha256(buf) !== String(b.checksum_sha256)) {
      res.status(422).json({ error: 'Validasi integritas SHA-256 gagal. Pemulihan dibatalkan.' });
      return;
    }
    const zip = await JSZip.loadAsync(buf);
    const dbEntry = zip.file('database.sqlite');
    if (!dbEntry) {
      res.status(422).json({ error: 'Berkas database.sqlite tidak ada di dalam arsip backup.' });
      return;
    }
    const restoredDbBuf = await dbEntry.async('nodebuffer');
    const actor = req.authUser!;
    resetDbConnection();
    fs.writeFileSync(DB_PATH, restoredDbBuf);
    const freshDb = getDb();
    writeAuditLog(freshDb, actor, 'RESTORE_BACKUP', 'backup', String(b.backup_name), 'berhasil', 'Database dipulihkan setelah validasi SHA-256.');
    res.json({ ok: true, message: 'Pemulihan database berhasil dijalankan dan diverifikasi.' });
  });

  app.post('/api/system/automation/:id/toggle', requireAuth, requirePermission('sistem', 'configure'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const job = db.prepare('SELECT * FROM automation_jobs WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!job) {
      res.status(404).json({ error: 'Job otomatisasi tidak ditemukan.' });
      return;
    }
    const nextEnabled = job.enabled ? 0 : 1;
    db.prepare('UPDATE automation_jobs SET enabled = ? WHERE id = ?').run(nextEnabled, String(job.id));
    writeAuditLog(db, req.authUser!, 'TOGGLE_AUTOMATION', 'automation_job', String(job.job_key), 'berhasil', nextEnabled ? 'diaktifkan' : 'dinonaktifkan');
    res.json({ ok: true, enabled: Boolean(nextEnabled) });
  });

  app.post('/api/system/automation/:id/run', requireAuth, requirePermission('sistem', 'manage'), (req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const job = db.prepare('SELECT * FROM automation_jobs WHERE id = ?').get(String(req.params.id)) as Record<string, unknown> | undefined;
    if (!job) {
      res.status(404).json({ error: 'Job otomatisasi tidak ditemukan.' });
      return;
    }
    const now = new Date().toISOString();
    const msg = `Eksekusi manual aman dijalankan pada ${now} oleh ${req.authUser!.fullName}.`;
    db.prepare("UPDATE automation_jobs SET last_run_at = ?, last_status = 'berhasil', last_message = ? WHERE id = ?").run(now, msg, String(job.id));
    writeAuditLog(db, req.authUser!, 'RUN_AUTOMATION', 'automation_job', String(job.job_key));
    res.json({ ok: true, message: msg });
  });

  // Public timeline endpoint for non-super-admin roles who have dashboard access
  app.get('/api/timeline', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const timeline = db.prepare('SELECT * FROM activity_timeline ORDER BY created_at DESC LIMIT 30').all();
    res.json({ timeline });
  });

  // ==================== USER & SETTINGS MANAGEMENT ====================
  app.get('/api/settings/users', requireAuth, requirePermission('pengaturan', 'manage'), (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const users = db
      .prepare('SELECT id, email, full_name, role, bidang, province_code, account_status, last_login_at, created_at FROM users ORDER BY created_at DESC')
      .all() as Record<string, unknown>[];
    res.json({
      users: users.map((u) => ({
        id: String(u.id),
        email: String(u.email),
        fullName: String(u.full_name),
        role: String(u.role) as RoleCode,
        roleLabel: ROLE_LABELS[u.role as RoleCode] ?? String(u.role),
        bidang: u.bidang ? String(u.bidang) : null,
        provinceCode: u.province_code ? String(u.province_code) : null,
        provinceName: u.province_code ? PROVINCE_BY_CODE.get(String(u.province_code))?.name ?? null : null,
        accountStatus: String(u.account_status),
        lastLoginAt: u.last_login_at ? String(u.last_login_at) : null,
      })),
    });
  });

  app.post('/api/settings/users', requireAuth, requirePermission('pengaturan', 'manage'), (req: AuthenticatedRequest, res: Response) => {
    const { fullName, email, password, role, provinceCode, bidang } = req.body ?? {};
    if (!fullName || !email || !password || !role) {
      res.status(422).json({ error: 'Nama, email, kata sandi, dan role wajib diisi.' });
      return;
    }
    const db = getDb();
    const cleanEmail = String(email).trim().toLowerCase();
    const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
    if (exists) {
      res.status(422).json({ error: 'Email sudah terdaftar.' });
      return;
    }
    const now = new Date().toISOString();
    const userId = crypto.randomUUID();
    const persId = crypto.randomUUID();
    const refNo = nextReferenceNumber(db, 'PERS');
    const memberNo = `DPBI-${new Date().getFullYear()}-${String(Math.floor(1000 + Math.random() * 8999))}`;

    db.prepare(
      `INSERT INTO personnel (id, member_number, reference_number, user_id, full_name, email, province_code, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'batch-3', ?, ?, ?, 'aktif', 'terverifikasi', '{}', ?, ?)`
    ).run(persId, memberNo, refNo, userId, String(fullName), cleanEmail, String(provinceCode || '31'), ROLE_LABELS[role as RoleCode] ?? String(role), String(bidang || 'Umum'), String(role), now, now);

    db.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, bidang, province_code, batch_id, personnel_id, account_status, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'batch-3', ?, 'aktif', ?, ?)`
    ).run(userId, cleanEmail, hashPassword(String(password)), String(fullName), String(role), String(bidang || 'Umum'), String(provinceCode || '31'), persId, IS_DEMO_MODE ? 1 : 0, now);

    writeAuditLog(db, req.authUser!, 'CREATE_USER_DIRECT', 'user', cleanEmail, 'berhasil', `Role: ${role}`);
    res.status(201).json({ ok: true, id: userId });
  });

  app.patch('/api/settings/users/:id/status', requireAuth, requirePermission('pengaturan', 'manage'), (req: AuthenticatedRequest, res: Response) => {
    const { accountStatus, role } = req.body ?? {};
    const db = getDb();
    const targetId = String(req.params.id);
    db.prepare('UPDATE users SET account_status = COALESCE(?, account_status), role = COALESCE(?, role) WHERE id = ?').run(
      accountStatus ?? null,
      role ?? null,
      targetId
    );
    // Security rule: invalidate existing sessions immediately whenever role or account status changes
    if (accountStatus || role) {
      db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetId);
    }
    writeAuditLog(db, req.authUser!, 'UPDATE_USER_ACCOUNT', 'user', targetId, 'berhasil', `${accountStatus || ''} ${role || ''}`);
    res.json({ ok: true });
  });

  app.get('/api/settings/config', requireAuth, (_req: AuthenticatedRequest, res: Response) => {
    const db = getDb();
    const rows = db.prepare('SELECT key, value FROM system_settings').all() as { key: string; value: string }[];
    const settings: Record<string, string> = {};
    for (const r of rows) settings[r.key] = r.value;
    const seqs = db.prepare('SELECT category, year, last_seq FROM reference_sequences ORDER BY year DESC, category ASC').all();
    res.json({ settings, sequences: seqs });
  });

  app.patch('/api/system/settings', requireAuth, requirePermission('sistem', 'configure'), (req: AuthenticatedRequest, res: Response) => {
    const updates = req.body?.settings;
    if (!updates || typeof updates !== 'object') {
      res.status(422).json({ error: 'Format pengaturan tidak valid.' });
      return;
    }
    const db = getDb();
    const now = new Date().toISOString();
    const stmt = db.prepare('INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at');
    for (const [k, v] of Object.entries(updates)) {
      if (k === 'kemendikdasmen_integration_status') continue; // Locked nonaktif until official API/MoU
      stmt.run(String(k), String(v), now);
    }
    writeAuditLog(db, req.authUser!, 'UPDATE_SYSTEM_SETTINGS', 'system_settings', Object.keys(updates).join(','));
    res.json({ ok: true });
  });

  // Data Export Center (permission-gated + audit logged)
  app.get('/api/export/bundle', requireAuth, requirePermission('arsip', 'export'), (req: AuthenticatedRequest, res: Response) => {
    const scope = String(req.query.scope || 'proposals');
    const db = getDb();
    const user = req.authUser!;
    let csv = '';

    if (scope === 'personnel') {
      const rows = db.prepare('SELECT member_number, reference_number, full_name, province_code, school_name, role_code, verification_status FROM personnel ORDER BY created_at DESC').all() as Record<string, unknown>[];
      csv = 'Nomor Anggota,Nomor Referensi,Nama Lengkap,Kode Provinsi,Sekolah,Peran,Verifikasi\n' +
        rows.map((r) => `"${r.member_number}","${r.reference_number}","${r.full_name}","${r.province_code}","${r.school_name}","${r.role_code}","${r.verification_status}"`).join('\n');
    } else if (scope === 'lkl') {
      const rows = db.prepare('SELECT reference_number, activity_name, submitter_name, province_code, event_date, participant_count, status FROM lkl_reports ORDER BY created_at DESC').all() as Record<string, unknown>[];
      csv = 'Nomor LKL,Kegiatan,Pelapor,Kode Provinsi,Tanggal,Peserta,Status\n' +
        rows.map((r) => `"${r.reference_number}","${r.activity_name}","${r.submitter_name}","${r.province_code}","${r.event_date}",${r.participant_count},"${r.status}"`).join('\n');
    } else {
      const rows = db.prepare('SELECT reference_number, title, applicant_name, province_code, event_date, status FROM proposals ORDER BY created_at DESC').all() as Record<string, unknown>[];
      csv = 'Nomor Proposal,Judul,Pengaju,Kode Provinsi,Tanggal,Status\n' +
        rows.map((r) => `"${r.reference_number}","${r.title}","${r.applicant_name}","${r.province_code}","${r.event_date}","${r.status}"`).join('\n');
    }

    writeAuditLog(db, user, 'EXPORT_DATA_CENTER', 'export', scope, 'berhasil', `Ekspor CSV ${scope}`);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="SATU_DPBI_${scope}_${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });
}
