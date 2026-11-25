import crypto from 'node:crypto';
import type { DatabaseSync } from 'node:sqlite';
import { nextReferenceNumber } from './db';
import { createNotificationIdempotent, writeActivityTimeline, writeAuditLog } from './security';
import type { AuthUser } from '../src/lib/types';

function addDaysToIsoDate(dateStr: string, offsetDays: number): string {
  const base = Date.parse(dateStr.includes('T') ? dateStr : `${dateStr}T09:00:00+07:00`);
  if (Number.isNaN(base)) return new Date(Date.now() + offsetDays * 86400000).toISOString().slice(0, 10);
  return new Date(base + offsetDays * 86400000).toISOString().slice(0, 10);
}

function buildEventTimestamps(eventDate: string, eventTime: string | null): { startAt: string; endAt: string } {
  const cleanDate = (eventDate || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
  const timeMatch = (eventTime || '09:00').match(/^(\d{2}):(\d{2})/);
  const hh = timeMatch ? Number(timeMatch[1]) : 9;
  const mm = timeMatch ? Number(timeMatch[2]) : 0;
  const endHh = Math.min(23, hh + 3);
  const startAt = `${cleanDate}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`;
  const endAt = `${cleanDate}T${String(endHh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00+07:00`;
  return { startAt, endAt };
}

/**
 * Orkestrasi otomatis saat Proposal disetujui:
 * 1. Membuat agenda kalender resmi bertaut (idempoten via proposal_id)
 * 2. Membuat 4 tugas operasional bertahap (persiapan, pelaksanaan, dokumentasi, pelaporan LKL)
 * 3. Mengirim notifikasi idempoten ke pemohon & Koordinator Wilayah terkait
 */
export function onProposalApproved(
  db: DatabaseSync,
  propRow: Record<string, unknown>,
  approver: AuthUser
): { eventId: string; createdTaskIds: string[] } {
  const proposalId = String(propRow.id);
  const title = String(propRow.title);
  const refNo = String(propRow.reference_number);
  const provCode = String(propRow.province_code);
  const batchId = propRow.batch_id ? String(propRow.batch_id) : null;
  const eventDate = String(propRow.event_date);
  const eventTime = propRow.event_time ? String(propRow.event_time) : '09:00';
  const location = String(propRow.location || 'Lokasi Kegiatan');
  const now = new Date().toISOString();

  // 1. Idempotent Calendar Event
  const existingEvent = db
    .prepare('SELECT id FROM calendar_events WHERE proposal_id = ? LIMIT 1')
    .get(proposalId) as { id: string } | undefined;

  let eventId = existingEvent?.id;
  const { startAt, endAt } = buildEventTimestamps(eventDate, eventTime);

  if (!eventId) {
    eventId = crypto.randomUUID();
    db.prepare(
      `INSERT INTO calendar_events
       (id, title, category, start_at, end_at, province_code, batch_id, related_ref, location, description, proposal_id)
       VALUES (?, ?, 'Kegiatan Disetujui', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      eventId,
      title,
      startAt,
      endAt,
      provCode,
      batchId,
      refNo,
      location,
      `Agenda otomatis dari persetujuan proposal ${refNo} oleh ${approver.fullName}.`,
      proposalId
    );
  } else {
    db.prepare(
      'UPDATE calendar_events SET title = ?, start_at = ?, end_at = ?, location = ? WHERE id = ?'
    ).run(title, startAt, endAt, location, eventId);
  }

  // 2. Resolve assignee (applicant's user account, or Korwil, or approver fallback)
  const applicantUser = db
    .prepare('SELECT id, full_name FROM users WHERE personnel_id = ? LIMIT 1')
    .get(String(propRow.applicant_personnel_id)) as { id: string; full_name: string } | undefined;

  const assigneeId = applicantUser?.id || approver.id;
  const assigneeName = applicantUser?.full_name || String(propRow.applicant_name || approver.fullName);

  // 3. Idempotent 4-Phase Checklist Tasks
  const existingTasks = db
    .prepare('SELECT id, category FROM tasks WHERE proposal_id = ?')
    .all(proposalId) as { id: string; category: string }[];
  const existingCats = new Set(existingTasks.map((t) => t.category));

  const phases: {
    category: string;
    title: string;
    description: string;
    priority: 'sedang' | 'tinggi';
    deadline: string;
    checklist: { id: string; text: string; done: boolean }[];
  }[] = [
    {
      category: 'persiapan',
      title: `[Persiapan] Izin Lokasi & Logistik: ${title}`,
      description: `Pastikan surat izin lokasi (${location}), daftar pendamping dewasa, dan kesiapan perlengkapan selesai sebelum hari pelaksanaan.`,
      priority: 'tinggi',
      deadline: addDaysToIsoDate(eventDate, -3),
      checklist: [
        { id: 'p1', text: 'Konfirmasi izin tertulis pengelola lokasi', done: false },
        { id: 'p2', text: 'Verifikasi daftar pendamping dewasa & persetujuan wali', done: false },
      ],
    },
    {
      category: 'pelaksanaan',
      title: `[Pelaksanaan] Daftar Hadir & Pengawasan: ${title}`,
      description: `Laksanakan kegiatan sesuai jadwal (${eventDate}) dengan protokol keselamatan peserta DPBI.`,
      priority: 'tinggi',
      deadline: eventDate.slice(0, 10),
      checklist: [
        { id: 'e1', text: 'Isi daftar hadir peserta & pendamping', done: false },
        { id: 'e2', text: 'Pastikan keamanan lokasi selama kegiatan berlangsung', done: false },
      ],
    },
    {
      category: 'dokumentasi',
      title: `[Dokumentasi] Arsip Foto & Bukti Kegiatan: ${title}`,
      description: `Kumpulkan minimal 2 foto dokumentasi resmi beserta keterangan lokasi kegiatan.`,
      priority: 'sedang',
      deadline: addDaysToIsoDate(eventDate, 2),
      checklist: [
        { id: 'd1', text: 'Kumpulkan foto dokumentasi kegiatan (minimal 2 foto)', done: false },
        { id: 'd2', text: 'Simpan bukti daftar hadir / berita acara', done: false },
      ],
    },
    {
      category: 'pelaporan',
      title: `[Pelaporan LKL] Unggah LKL & PDF Resmi: ${title}`,
      description: `Buat Laporan Kegiatan Lapangan (LKL) tertaut proposal ${refNo} maksimal H+5 setelah kegiatan.`,
      priority: 'tinggi',
      deadline: addDaysToIsoDate(eventDate, 5),
      checklist: [
        { id: 'l1', text: 'Isi ringkasan capaian, kendala, dan tindak lanjut di modul LKL', done: false },
        { id: 'l2', text: 'Unggah PDF laporan resmi dan tautkan ke proposal disetujui', done: false },
      ],
    },
  ];

  const createdTaskIds: string[] = [];
  const taskInsert = db.prepare(
    `INSERT INTO tasks
     (id, reference_number, title, description, priority, status, deadline, province_code, batch_id, assignee_id, assignee_name, creator_id, creator_name, checklist_json, is_template, recurrence, proposal_id, event_id, category, created_at)
     VALUES (?, ?, ?, ?, ?, 'belum_dimulai', ?, ?, ?, ?, ?, ?, ?, ?, 0, 'tidak', ?, ?, ?, ?)`
  );

  for (const ph of phases) {
    if (existingCats.has(ph.category)) continue;
    const taskId = crypto.randomUUID();
    const tRef = nextReferenceNumber(db, 'TGS');
    taskInsert.run(
      taskId,
      tRef,
      ph.title,
      ph.description,
      ph.priority,
      ph.deadline,
      provCode,
      batchId,
      assigneeId,
      assigneeName,
      approver.id,
      approver.fullName,
      JSON.stringify(ph.checklist),
      proposalId,
      eventId,
      ph.category,
      now
    );
    createdTaskIds.push(taskId);
  }

  // 4. Notify applicant & provincial coordinator idempotently
  if (applicantUser) {
    createNotificationIdempotent(db, {
      userId: applicantUser.id,
      title: `Proposal Disetujui & Agenda Tugas Dibuat`,
      message: `${refNo} (${title}) disetujui. Agenda kalender & ${createdTaskIds.length || 4} tugas tindak lanjut telah disiapkan.`,
      category: 'proposal',
      targetPath: `/proposal/${proposalId}`,
      eventKey: `prop_approved_applicant_${proposalId}`,
    });
  }

  const korwils = db
    .prepare("SELECT id FROM users WHERE role = 'koordinator_wilayah' AND province_code = ? AND account_status = 'aktif'")
    .all(provCode) as { id: string }[];
  for (const kw of korwils) {
    createNotificationIdempotent(db, {
      userId: kw.id,
      title: `Agenda Kegiatan Wilayah Disetujui`,
      message: `Proposal ${refNo} di wilayah Anda telah disetujui dan masuk ke Kalender serta Tugas pemantauan.`,
      category: 'proposal',
      targetPath: `/kalender`,
      eventKey: `prop_approved_korwil_${proposalId}_${kw.id}`,
    });
  }

  writeAuditLog(
    db,
    approver,
    'WORKFLOW_PROPOSAL_TO_CALENDAR_TASKS',
    'proposal',
    refNo,
    'berhasil',
    `Kalender (${eventId}) dan ${createdTaskIds.length} tugas bertahap ditautkan otomatis.`
  );

  return { eventId, createdTaskIds };
}

/**
 * Sinkronisasi jadwal proposal ke kalender saat tanggal/lokasi proposal diubah.
 */
export function onProposalScheduleUpdated(db: DatabaseSync, propRow: Record<string, unknown>): void {
  const proposalId = String(propRow.id);
  const { startAt, endAt } = buildEventTimestamps(
    String(propRow.event_date),
    propRow.event_time ? String(propRow.event_time) : '09:00'
  );
  db.prepare(
    'UPDATE calendar_events SET title = ?, start_at = ?, end_at = ?, location = ? WHERE proposal_id = ?'
  ).run(String(propRow.title), startAt, endAt, String(propRow.location || ''), proposalId);
}

/**
 * Pembaruan otomatis saat LKL dinyatakan Diterima:
 * - Menautkan dan menandai tugas 'dokumentasi'/'pelaporan' pada proposal terkait sebagai selesai
 * - Menandai kesiapan evaluasi & mengirim notifikasi idempoten
 */
export function onLklApproved(
  db: DatabaseSync,
  lklRow: Record<string, unknown>,
  reviewer: AuthUser
): { updatedTaskCount: number } {
  const lklId = String(lklRow.id);
  const proposalId = lklRow.proposal_id ? String(lklRow.proposal_id) : null;
  let updatedTaskCount = 0;

  if (proposalId) {
    const res = db
      .prepare(
        `UPDATE tasks
         SET status = 'selesai', lkl_id = ?
         WHERE proposal_id = ? AND category IN ('dokumentasi', 'pelaporan') AND status != 'selesai'`
      )
      .run(lklId, proposalId);
    updatedTaskCount = Number(res.changes ?? 0);
  }

  const submitterUser = db
    .prepare('SELECT id FROM users WHERE personnel_id = ? LIMIT 1')
    .get(String(lklRow.submitter_personnel_id)) as { id: string } | undefined;

  if (submitterUser) {
    createNotificationIdempotent(db, {
      userId: submitterUser.id,
      title: `LKL Diterima: ${String(lklRow.reference_number)}`,
      message: `${String(lklRow.activity_name)} telah diterima oleh ${reviewer.fullName}. Tugas pelaporan terkait otomatis diselesaikan.`,
      category: 'lkl',
      targetPath: `/laporan-kegiatan/${lklId}`,
      eventKey: `lkl_approved_${lklId}`,
    });
  }

  writeActivityTimeline(
    db,
    'Evaluasi',
    `LKL ${String(lklRow.reference_number)} Diterima & Tugas Diselesaikan`,
    `${String(lklRow.activity_name)} (${updatedTaskCount} tugas terkait selesai, siap untuk penilaian kinerja).`,
    reviewer.fullName,
    String(lklRow.province_code),
    null,
    `/laporan-kegiatan/${lklId}`
  );

  return { updatedTaskCount };
}

export function computeDashboardAnalytics(
  db: DatabaseSync,
  user: AuthUser,
  daysWindow: 7 | 30 | 90
): {
  daysWindow: 7 | 30 | 90;
  proposalsInWindow: number;
  approvedProposalsInWindow: number;
  lklInWindow: number;
  approvedLklInWindow: number;
  approvalPassRatePct: number;
  avgDecisionHours: number | null;
  overdueSlaCount: number;
  contributionBadges: { code: string; label: string; metric: string; detail: string }[];
} {
  const cutoffIso = new Date(Date.now() - daysWindow * 86400000).toISOString();
  const provClause = user.role === 'koordinator_wilayah' && user.provinceCode ? ' AND province_code = ?' : '';
  const persClause = user.role === 'duta' && user.personnelId ? ' AND applicant_personnel_id = ?' : '';
  const lklPersClause = user.role === 'duta' && user.personnelId ? ' AND submitter_personnel_id = ?' : '';

  const pParams: string[] = [cutoffIso];
  if (provClause && user.provinceCode) pParams.push(user.provinceCode);
  if (persClause && user.personnelId) pParams.push(user.personnelId);

  const lParams: string[] = [cutoffIso];
  if (provClause && user.provinceCode) lParams.push(user.provinceCode);
  if (lklPersClause && user.personnelId) lParams.push(user.personnelId);

  const propStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total_c,
         SUM(CASE WHEN status = 'disetujui' THEN 1 ELSE 0 END) AS ok_c,
         SUM(CASE WHEN status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional') AND sla_due_at IS NOT NULL AND sla_due_at < ? THEN 1 ELSE 0 END) AS overdue_c
       FROM proposals
       WHERE created_at >= ?${provClause}${persClause}`
    )
    .get(new Date().toISOString(), ...pParams) as { total_c: number; ok_c: number | null; overdue_c: number | null };

  const lklStats = db
    .prepare(
      `SELECT
         COUNT(*) AS total_c,
         SUM(CASE WHEN status = 'diterima' THEN 1 ELSE 0 END) AS ok_c
       FROM lkl_reports
       WHERE created_at >= ?${provClause}${lklPersClause}`
    )
    .get(...lParams) as { total_c: number; ok_c: number | null };

  const decidedRows = db
    .prepare(
      `SELECT created_at, decided_at FROM proposals
       WHERE decided_at IS NOT NULL AND created_at >= ?${provClause}${persClause}`
    )
    .all(...pParams) as { created_at: string; decided_at: string }[];

  let totalHours = 0;
  let validCount = 0;
  for (const r of decidedRows) {
    const diff = Date.parse(r.decided_at) - Date.parse(r.created_at);
    if (Number.isFinite(diff) && diff >= 0) {
      totalHours += diff / 3600000;
      validCount += 1;
    }
  }
  const avgDecisionHours = validCount > 0 ? Math.round((totalHours / validCount) * 10) / 10 : null;

  const proposalsInWindow = Number(propStats.total_c ?? 0);
  const approvedProposalsInWindow = Number(propStats.ok_c ?? 0);
  const lklInWindow = Number(lklStats.total_c ?? 0);
  const approvedLklInWindow = Number(lklStats.ok_c ?? 0);
  const totalEvaluated = proposalsInWindow + lklInWindow;
  const approvalPassRatePct =
    totalEvaluated > 0
      ? Math.round(((approvedProposalsInWindow + approvedLklInWindow) / totalEvaluated) * 100)
      : 100;

  // Non-shaming, audited contribution badges strictly derived from verified records
  const contributionBadges: { code: string; label: string; metric: string; detail: string }[] = [];
  if (approvedLklInWindow > 0) {
    contributionBadges.push({
      code: 'lkl_terverifikasi',
      label: 'Dokumentasi Terverifikasi',
      metric: `${approvedLklInWindow} LKL Diterima`,
      detail: `Kegiatan lapangan pada rentang ${daysWindow} hari telah diverifikasi beserta bukti hadir.`,
    });
  }
  if (approvedProposalsInWindow > 0) {
    contributionBadges.push({
      code: 'kegiatan_terencana',
      label: 'Perencanaan Terstruktur',
      metric: `${approvedProposalsInWindow} Proposal Disetujui`,
      detail: 'Proposal memenuhi standar administrasi, jadwal, dan perlindungan peserta.',
    });
  }
  const onTimeCoordReports = (
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM coordinator_reports WHERE status = 'diterima' AND created_at >= ?${provClause}`
      )
      .get(...(provClause && user.provinceCode ? [cutoffIso, user.provinceCode] : [cutoffIso])) as { c: number }
  ).c;
  if (onTimeCoordReports > 0) {
    contributionBadges.push({
      code: 'pelaporan_wilayah',
      label: 'Pelaporan Wilayah Aktif',
      metric: `${onTimeCoordReports} Laporan Diterima`,
      detail: 'Koordinasi berkala wilayah terdata dan diterima oleh Sekretariat Nasional.',
    });
  }

  return {
    daysWindow,
    proposalsInWindow,
    approvedProposalsInWindow,
    lklInWindow,
    approvedLklInWindow,
    approvalPassRatePct,
    avgDecisionHours,
    overdueSlaCount: Number(propStats.overdue_c ?? 0),
    contributionBadges,
  };
}
