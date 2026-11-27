import crypto from 'node:crypto';
import type { Express } from 'express';
import { getDb } from './db';
import {
  AuthenticatedRequest,
  checkGenericThrottle,
  createNotificationIdempotent,
  hasScopedUserPermission,
  requireAuth,
  requirePermission,
  sha256,
  writeActivityTimeline,
  writeAuditLog,
} from './security';
import { computeObjectDiff, onLklApproved, onProposalApproved, recordApprovalHistory } from './workflow';
import {
  executeEmailCampaign,
  exportCampaignLogsCsv,
  getEmailRuntimeStatus,
  resolveEmailAudience,
  retryCampaignFailedLogs,
} from './email';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';
import { validateEmailTemplatePlaceholders } from '../src/lib/rbac';
import type { ApprovalQueueItem, RoleCode } from '../src/lib/types';

function computeDefaultSla(createdAt: string, hours: number): string {
  const base = Date.parse(createdAt);
  if (Number.isNaN(base)) return new Date(Date.now() + hours * 3600000).toISOString();
  return new Date(base + hours * 3600000).toISOString();
}

export function registerWorkflowAndEmailRoutes(app: Express): void {
  // ---------------------------------------------------------------------------
  // PUSAT PERSETUJUAN NASIONAL (NATIONAL APPROVAL CENTER)
  // ---------------------------------------------------------------------------
  app.get(
    '/api/approval-center',
    requireAuth,
    requirePermission('persetujuan', 'view'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const user = req.authUser!;
      const filterType = String(req.query.type || 'semua');
      const filterStatus = String(req.query.status || 'pending');
      const filterProv = String(req.query.provinceCode || '');
      const nowMs = Date.now();
      const isKorwil = user.role === 'koordinator_wilayah';

      const items: ApprovalQueueItem[] = [];

      // 1. Proposals
      if (filterType === 'semua' || filterType === 'proposal') {
        const pConds: string[] = [];
        const pParams: string[] = [];
        if (filterStatus === 'pending' || filterStatus === 'overdue') {
          pConds.push("status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')");
        } else if (filterStatus === 'revisi') {
          pConds.push("status IN ('perlu_revisi', 'perlu_kelengkapan')");
        }
        if (isKorwil && user.provinceCode) {
          pConds.push('province_code = ?');
          pParams.push(user.provinceCode);
        } else if (filterProv) {
          pConds.push('province_code = ?');
          pParams.push(filterProv);
        }
        const whereSql = pConds.length ? `WHERE ${pConds.join(' AND ')}` : '';
        const props = db
          .prepare(`SELECT * FROM proposals ${whereSql} ORDER BY created_at DESC LIMIT 100`)
          .all(...pParams) as Record<string, unknown>[];

        for (const p of props) {
          const slaDueAt = p.sla_due_at ? String(p.sla_due_at) : computeDefaultSla(String(p.created_at), 72);
          const isOverdue =
            ['diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional'].includes(
              String(p.status)
            ) && Date.parse(slaDueAt) < nowMs;
          if (filterStatus === 'overdue' && !isOverdue) continue;
          const pCode = String(p.province_code);
          items.push({
            id: String(p.id),
            itemType: 'proposal',
            referenceNumber: String(p.reference_number),
            title: String(p.title),
            applicantName: String(p.applicant_name),
            provinceCode: pCode,
            provinceName: PROVINCE_BY_CODE.get(pCode)?.name ?? pCode,
            status: String(p.status),
            priority: (p.risk_level as 'rendah' | 'sedang' | 'tinggi') || 'sedang',
            assignedReviewerName: p.assigned_approver_role ? String(p.assigned_approver_role) : null,
            escalatedTo: p.escalated_to ? String(p.escalated_to) : null,
            submittedAt: String(p.created_at),
            slaDueAt,
            isOverdue,
            targetPath: `/proposal/${String(p.id)}`,
            summary: `${String(p.category)} • ${String(p.event_date)} • ${String(p.location)}`,
          });
        }
      }

      // 2. LKL Reports
      if (filterType === 'semua' || filterType === 'lkl') {
        const lConds: string[] = [];
        const lParams: string[] = [];
        if (filterStatus === 'pending' || filterStatus === 'overdue') {
          lConds.push("status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')");
        } else if (filterStatus === 'revisi') {
          lConds.push("status = 'perlu_revisi'");
        }
        if (isKorwil && user.provinceCode) {
          lConds.push('province_code = ?');
          lParams.push(user.provinceCode);
        } else if (filterProv) {
          lConds.push('province_code = ?');
          lParams.push(filterProv);
        }
        const whereSql = lConds.length ? `WHERE ${lConds.join(' AND ')}` : '';
        const lkls = db
          .prepare(`SELECT * FROM lkl_reports ${whereSql} ORDER BY created_at DESC LIMIT 100`)
          .all(...lParams) as Record<string, unknown>[];

        for (const l of lkls) {
          const slaDueAt = computeDefaultSla(String(l.created_at), 48);
          const isOverdue =
            ['diajukan', 'menunggu_pemeriksaan'].includes(String(l.status)) && Date.parse(slaDueAt) < nowMs;
          if (filterStatus === 'overdue' && !isOverdue) continue;
          const pCode = String(l.province_code);
          items.push({
            id: String(l.id),
            itemType: 'lkl',
            referenceNumber: String(l.reference_number),
            title: String(l.activity_name),
            applicantName: String(l.submitter_name),
            provinceCode: pCode,
            provinceName: PROVINCE_BY_CODE.get(pCode)?.name ?? pCode,
            status: String(l.status),
            priority: 'sedang',
            assignedReviewerName: 'Koordinator Wilayah',
            escalatedTo: null,
            submittedAt: String(l.created_at),
            slaDueAt,
            isOverdue,
            targetPath: `/laporan-kegiatan/${String(l.id)}`,
            summary: [
              String(l.regency || l.platform_name || (l.activity_mode === 'daring' ? 'Daring' : '')).trim(),
              `${Number(l.participant_count)} peserta`,
              String(l.event_date),
            ]
              .filter(Boolean)
              .join(' • '),
          });
        }
      }

      // 3. Coordinator Reports
      if (filterType === 'semua' || filterType === 'coordinator_report') {
        const cConds: string[] = [];
        const cParams: string[] = [];
        if (filterStatus === 'pending' || filterStatus === 'overdue') {
          cConds.push("status IN ('dikirim', 'perlu_revisi')");
        } else if (filterStatus === 'revisi') {
          cConds.push("status = 'perlu_revisi'");
        }
        if (isKorwil && user.provinceCode) {
          cConds.push('province_code = ?');
          cParams.push(user.provinceCode);
        } else if (filterProv) {
          cConds.push('province_code = ?');
          pParamsGuard(cParams, filterProv);
        }
        const whereSql = cConds.length ? `WHERE ${cConds.join(' AND ')}` : '';
        const coords = db
          .prepare(`SELECT * FROM coordinator_reports ${whereSql} ORDER BY created_at DESC LIMIT 100`)
          .all(...cParams) as Record<string, unknown>[];

        for (const c of coords) {
          const createdAt = String(c.created_at);
          const slaDueAt = computeDefaultSla(createdAt, 72);
          const isOverdue = String(c.status) === 'dikirim' && Date.parse(slaDueAt) < nowMs;
          if (filterStatus === 'overdue' && !isOverdue) continue;
          const pCode = String(c.province_code);
          items.push({
            id: String(c.id),
            itemType: 'coordinator_report',
            referenceNumber: String(c.reference_number),
            title: `${String(c.report_type).toUpperCase()} — ${String(c.period_label)}`,
            applicantName: String(c.coordinator_name),
            provinceCode: pCode,
            provinceName: PROVINCE_BY_CODE.get(pCode)?.name ?? pCode,
            status: String(c.status),
            priority: 'sedang',
            assignedReviewerName: 'Sekretariat Nasional',
            escalatedTo: null,
            submittedAt: createdAt,
            slaDueAt,
            isOverdue,
            targetPath: '/laporan-koordinator',
            summary: `${Number(c.lkl_recap_count)} rekap LKL • ${String(c.activities_summary || '').slice(0, 90)}`,
          });
        }
      }

      // 4. Account Requests (National Secretariat / Super Admin / Korwil own province view)
      if (filterType === 'semua' || filterType === 'account_request') {
        const aConds: string[] = [];
        const aParams: string[] = [];
        if (filterStatus === 'pending' || filterStatus === 'overdue') {
          aConds.push("status = 'menunggu'");
        } else if (filterStatus === 'revisi') {
          aConds.push('1 = 0');
        }
        if (isKorwil && user.provinceCode) {
          aConds.push('province_code = ?');
          aParams.push(user.provinceCode);
        } else if (filterProv) {
          aConds.push('province_code = ?');
          aParams.push(filterProv);
        }
        const whereSql = aConds.length ? `WHERE ${aConds.join(' AND ')}` : '';
        const reqs = db
          .prepare(`SELECT * FROM account_requests ${whereSql} ORDER BY created_at DESC LIMIT 100`)
          .all(...aParams) as Record<string, unknown>[];

        for (const a of reqs) {
          const slaDueAt = computeDefaultSla(String(a.created_at), 48);
          const isOverdue = String(a.status) === 'menunggu' && Date.parse(slaDueAt) < nowMs;
          if (filterStatus === 'overdue' && !isOverdue) continue;
          const pCode = a.province_code ? String(a.province_code) : null;
          items.push({
            id: String(a.id),
            itemType: 'account_request',
            referenceNumber: String(a.reference_number),
            title: `Permintaan Akun: ${String(a.full_name)}`,
            applicantName: String(a.requested_by_name),
            provinceCode: pCode,
            provinceName: pCode ? PROVINCE_BY_CODE.get(pCode)?.name ?? pCode : 'Nasional',
            status: String(a.status),
            priority: 'tinggi',
            assignedReviewerName: 'Sekretariat Nasional / Super Admin',
            escalatedTo: null,
            submittedAt: String(a.created_at),
            slaDueAt,
            isOverdue,
            targetPath: '/personalia',
            summary: `${String(a.email)} • ${String(a.school_name || '')} (${String(a.batch_id || '')})`,
          });
        }
      }

      // 5. Handovers
      if (filterType === 'semua' || filterType === 'handover') {
        const hConds: string[] = [];
        const hParams: string[] = [];
        if (filterStatus === 'pending' || filterStatus === 'overdue') {
          hConds.push("status = 'menunggu_persetujuan'");
        } else if (filterStatus === 'revisi') {
          hConds.push('1 = 0');
        }
        if (isKorwil && user.provinceCode) {
          hConds.push('province_code = ?');
          hParams.push(user.provinceCode);
        } else if (filterProv) {
          hConds.push('province_code = ?');
          hParams.push(filterProv);
        }
        const whereSql = hConds.length ? `WHERE ${hConds.join(' AND ')}` : '';
        const hnds = db
          .prepare(`SELECT * FROM handovers ${whereSql} ORDER BY created_at DESC LIMIT 100`)
          .all(...hParams) as Record<string, unknown>[];

        for (const h of hnds) {
          const slaDueAt = computeDefaultSla(String(h.created_at), 72);
          const isOverdue = String(h.status) === 'menunggu_persetujuan' && Date.parse(slaDueAt) < nowMs;
          if (filterStatus === 'overdue' && !isOverdue) continue;
          const pCode = String(h.province_code);
          items.push({
            id: String(h.id),
            itemType: 'handover',
            referenceNumber: String(h.reference_number),
            title: `Serah Terima Wilayah ${PROVINCE_BY_CODE.get(pCode)?.name ?? pCode}`,
            applicantName: `${String(h.outgoing_coordinator_name)} -> ${String(h.incoming_coordinator_name)}`,
            provinceCode: pCode,
            provinceName: PROVINCE_BY_CODE.get(pCode)?.name ?? pCode,
            status: String(h.status),
            priority: 'tinggi',
            assignedReviewerName: 'Super Admin / Wakil Super Admin',
            escalatedTo: null,
            submittedAt: String(h.created_at),
            slaDueAt,
            isOverdue,
            targetPath: `/wilayah/${pCode}`,
            summary: String(h.notes || 'Berita acara serah terima koordinator wilayah.'),
          });
        }
      }

      items.sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
        return Date.parse(b.submittedAt) - Date.parse(a.submittedAt);
      });

      const summary = {
        totalCount: items.length,
        overdueCount: items.filter((i) => i.isOverdue).length,
        revisionCount: items.filter((i) => i.status === 'perlu_revisi' || i.status === 'perlu_kelengkapan').length,
        byType: {
          proposal: items.filter((i) => i.itemType === 'proposal').length,
          lkl: items.filter((i) => i.itemType === 'lkl').length,
          coordinator_report: items.filter((i) => i.itemType === 'coordinator_report').length,
          account_request: items.filter((i) => i.itemType === 'account_request').length,
          handover: items.filter((i) => i.itemType === 'handover').length,
        },
      };

      const reviewers = db
        .prepare(
          `SELECT id, full_name, role, province_code FROM users
           WHERE account_status = 'aktif'
             AND role IN ('super_admin', 'wakil_super_admin', 'penanggung_jawab', 'pengurus_nasional', 'sekretariat_nasional', 'koordinator_wilayah')
           ORDER BY full_name ASC`
        )
        .all() as Record<string, unknown>[];

      res.json({ items, summary, reviewers });
    }
  );

  app.get(
    '/api/approval-center/:type/:id/history',
    requireAuth,
    requirePermission('persetujuan', 'view'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const itemType = String(req.params.type);
      const itemId = String(req.params.id);
      const rows = db
        .prepare('SELECT * FROM approval_history WHERE entity_type = ? AND entity_id = ? ORDER BY created_at DESC')
        .all(itemType, itemId) as Record<string, unknown>[];
      res.json({
        history: rows.map((r) => ({
          id: String(r.id),
          entityType: String(r.entity_type),
          entityId: String(r.entity_id),
          action: String(r.action),
          fromStatus: r.from_status ? String(r.from_status) : null,
          toStatus: String(r.to_status),
          stageLabel: String(r.stage_label || ''),
          actorUserId: String(r.actor_user_id),
          actorName: String(r.actor_name),
          actorRole: String(r.actor_role),
          note: String(r.note || ''),
          diff: r.diff_json ? (() => { try { return JSON.parse(String(r.diff_json)); } catch { return null; } })() : null,
          createdAt: String(r.created_at),
        })),
      });
    }
  );

  app.post(
    '/api/approval-center/:type/:id/action',
    requireAuth,
    requirePermission('persetujuan', 'review'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const user = req.authUser!;
      const itemType = String(req.params.type);
      const itemId = String(req.params.id);
      const action = String(req.body?.action || '');
      const reason = String(req.body?.reason || '').trim();
      const targetRole = req.body?.targetRole ? (String(req.body.targetRole) as RoleCode) : undefined;
      const escalateTarget = String(req.body?.escalateTo || 'Super Admin & Penanggung Jawab').trim();
      const now = new Date().toISOString();

      const allowedActions = [
        'approve',
        'advance_stage',
        'reject',
        'request_revision',
        'request_completeness',
        'reassign',
        'escalate',
        'cancel',
      ];
      if (!allowedActions.includes(action)) {
        res.status(400).json({ error: 'Aksi persetujuan tidak dikenali.', code: 400 });
        return;
      }

      if (['reject', 'request_revision', 'request_completeness', 'cancel', 'escalate'].includes(action) && reason.length < 5) {
        res.status(400).json({ error: 'Alasan atau catatan wajib diisi minimal 5 karakter untuk tindakan ini.', code: 400 });
        return;
      }

      if (action === 'approve' && !hasScopedUserPermission(user, 'persetujuan', 'approve')) {
        res.status(403).json({ error: 'Peran Anda tidak memiliki kewenangan menyetujui dari Pusat Persetujuan.', code: 403 });
        return;
      }
      if (action === 'reject' && !hasScopedUserPermission(user, 'persetujuan', 'reject')) {
        res.status(403).json({ error: 'Peran Anda tidak memiliki kewenangan menolak dari Pusat Persetujuan.', code: 403 });
        return;
      }

      if (itemType === 'proposal') {
        const prop = db.prepare('SELECT * FROM proposals WHERE id = ?').get(itemId) as Record<string, unknown> | undefined;
        if (!prop) {
          res.status(404).json({ error: 'Proposal tidak ditemukan.', code: 404 });
          return;
        }
        const provCode = String(prop.province_code);
        if (!hasScopedUserPermission(user, 'persetujuan', 'review', provCode)) {
          writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'proposal', itemId, 'ditolak', 'Akses pusat persetujuan lintas provinsi.');
          res.status(403).json({ error: 'Akses ditolak: proposal berada di luar cakupan wilayah Anda.', code: 403 });
          return;
        }
        if (['approve', 'reject', 'advance_stage'].includes(action) && (prop.applicant_personnel_id === user.personnelId || prop.applicant_personnel_id === user.id)) {
          res.status(403).json({ error: 'Self-approval dilarang: pengaju tidak boleh menyetujui proposalnya sendiri.', code: 403 });
          return;
        }
        if (['disetujui', 'ditolak', 'dibatalkan', 'diarsipkan'].includes(String(prop.status))) {
          res.status(409).json({ error: `Proposal sudah berada pada status final (${String(prop.status)}).`, code: 409 });
          return;
        }

        if (action === 'reassign') {
          if (reason.length < 3) {
            res.status(400).json({ error: 'Alasan pengalihan peninjau wajib diisi minimal 3 karakter.', code: 400 });
            return;
          }
          const validRoles: RoleCode[] = ['super_admin', 'wakil_super_admin', 'penanggung_jawab', 'pengurus_nasional', 'sekretariat_nasional', 'koordinator_wilayah'];
          const nextRole = targetRole && validRoles.includes(targetRole) ? targetRole : 'pengurus_nasional';
          const prevRole = prop.assigned_approver_role ? String(prop.assigned_approver_role) : null;
          db.prepare('UPDATE proposals SET assigned_approver_role = ?, updated_at = ? WHERE id = ?').run(nextRole, now, itemId);
          recordApprovalHistory(db, {
            entityType: 'proposal',
            entityId: itemId,
            action: 'reassign',
            fromStatus: String(prop.status),
            toStatus: String(prop.status),
            stageLabel: `Alih Peninjau -> ${nextRole}`,
            actor: user,
            note: reason,
            diff: { assigned_approver_role: { before: prevRole, after: nextRole } },
          });
          writeAuditLog(db, user, 'REASSIGN_REVIEWER', 'proposal', String(prop.reference_number), 'berhasil', `Dialihkan ke ${nextRole}: ${reason}`);
          res.json({ ok: true, message: `Peninjau proposal dialihkan ke ${nextRole}.` });
          return;
        }

        if (action === 'escalate') {
          db.prepare('UPDATE proposals SET escalated_to = ?, escalated_at = ?, updated_at = ? WHERE id = ?').run(
            escalateTarget,
            now,
            now,
            itemId
          );
          recordApprovalHistory(db, {
            entityType: 'proposal',
            entityId: itemId,
            action: 'escalate',
            fromStatus: String(prop.status),
            toStatus: String(prop.status),
            stageLabel: `Eskalasi -> ${escalateTarget}`,
            actor: user,
            note: reason,
          });
          const admins = db
            .prepare("SELECT id FROM users WHERE role IN ('super_admin', 'penanggung_jawab') AND account_status = 'aktif'")
            .all() as { id: string }[];
          for (const adm of admins) {
            createNotificationIdempotent(db, {
              userId: adm.id,
              title: `Eskalasi Persetujuan: ${String(prop.reference_number)}`,
              message: `Dieskalasi oleh ${user.fullName}: ${reason}`,
              category: 'proposal',
              targetPath: `/proposal/${itemId}`,
              eventKey: `prop_escalate_${itemId}_${adm.id}_${now.slice(0, 13)}`,
            });
          }
          writeAuditLog(db, user, 'ESCALATE_PROPOSAL', 'proposal', String(prop.reference_number), 'berhasil', `${escalateTarget}: ${reason}`);
          res.json({ ok: true, message: 'Proposal berhasil dieskalasi ke tingkat pimpinan.' });
          return;
        }

        if (action === 'advance_stage') {
          const prevStatus = String(prop.status);
          const nextStageStatus = 'menunggu_persetujuan_nasional';
          db.prepare('UPDATE proposals SET status = ?, decision_note = ?, updated_at = ? WHERE id = ?').run(
            nextStageStatus,
            reason || `Diteruskan oleh ${user.fullName} ke tahap persetujuan nasional.`,
            now,
            itemId
          );
          recordApprovalHistory(db, {
            entityType: 'proposal',
            entityId: itemId,
            action: 'advance_stage',
            fromStatus: prevStatus,
            toStatus: nextStageStatus,
            stageLabel: 'Verifikasi Wilayah -> Persetujuan Nasional',
            actor: user,
            note: reason || 'Memenuhi verifikasi tahap wilayah',
          });
          writeAuditLog(db, user, 'ADVANCE_PROPOSAL_STAGE', 'proposal', String(prop.reference_number), 'berhasil', `${prevStatus} -> ${nextStageStatus}`);
          res.json({ ok: true, status: nextStageStatus, message: 'Proposal diteruskan ke tahap Persetujuan Nasional.' });
          return;
        }

        if (action === 'cancel') {
          db.prepare("UPDATE proposals SET status = 'dibatalkan', cancelled_reason = ?, decision_note = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?").run(
            reason,
            reason,
            user.fullName,
            now,
            now,
            itemId
          );
          recordApprovalHistory(db, {
            entityType: 'proposal',
            entityId: itemId,
            action: 'cancel',
            fromStatus: String(prop.status),
            toStatus: 'dibatalkan',
            stageLabel: 'Pembatalan Proposal',
            actor: user,
            note: reason,
          });
          writeAuditLog(db, user, 'CANCEL_PROPOSAL', 'proposal', String(prop.reference_number), 'berhasil', reason);
          res.json({ ok: true, message: 'Proposal dibatalkan dengan alasan tercatat.' });
          return;
        }

        const nextStatus =
          action === 'approve'
            ? 'disetujui'
            : action === 'reject'
            ? 'ditolak'
            : 'perlu_revisi';

        if (nextStatus === 'disetujui' && user.role === 'koordinator_wilayah' && prop.assigned_approver_role !== 'koordinator_wilayah') {
          res.status(403).json({ error: 'Proposal risiko sedang/tinggi/nasional hanya boleh disetujui oleh Pengurus Nasional atau Super Admin.', code: 403 });
          return;
        }

        const prevStatus = String(prop.status);
        db.prepare('UPDATE proposals SET status = ?, decision_note = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?').run(
          nextStatus,
          reason || (action === 'approve' ? 'Disetujui melalui Pusat Persetujuan Nasional.' : ''),
          user.fullName,
          now,
          now,
          itemId
        );

        recordApprovalHistory(db, {
          entityType: 'proposal',
          entityId: itemId,
          action,
          fromStatus: prevStatus,
          toStatus: nextStatus,
          stageLabel: nextStatus === 'disetujui' ? 'Keputusan Akhir (Disetujui)' : nextStatus === 'ditolak' ? 'Keputusan Akhir (Ditolak)' : 'Pengembalian Revisi',
          actor: user,
          note: reason || (action === 'approve' ? 'Disetujui melalui Pusat Persetujuan Nasional.' : ''),
          diff: computeObjectDiff(prop, { ...prop, status: nextStatus }, ['status']),
        });

        let workflowInfo = null;
        if (nextStatus === 'disetujui') {
          workflowInfo = onProposalApproved(db, prop, user);
        } else {
          const applicantUser = db
            .prepare('SELECT id FROM users WHERE personnel_id = ? LIMIT 1')
            .get(String(prop.applicant_personnel_id)) as { id: string } | undefined;
          if (applicantUser) {
            createNotificationIdempotent(db, {
              userId: applicantUser.id,
              title: `Proposal ${String(prop.reference_number)}: ${nextStatus === 'ditolak' ? 'Ditolak' : 'Perlu Revisi / Kelengkapan'}`,
              message: reason,
              category: 'proposal',
              targetPath: `/proposal/${itemId}`,
            });
          }
        }

        writeAuditLog(db, user, `APPROVAL_CENTER_${action.toUpperCase()}`, 'proposal', String(prop.reference_number), 'berhasil', reason || nextStatus);
        res.json({ ok: true, status: nextStatus, workflowInfo });
        return;
      }

      if (itemType === 'lkl') {
        const lkl = db.prepare('SELECT * FROM lkl_reports WHERE id = ?').get(itemId) as Record<string, unknown> | undefined;
        if (!lkl) {
          res.status(404).json({ error: 'LKL tidak ditemukan.', code: 404 });
          return;
        }
        const provCode = String(lkl.province_code);
        if (!hasScopedUserPermission(user, 'persetujuan', 'review', provCode)) {
          writeAuditLog(db, user, 'ACCESS_DENIED_IDOR', 'lkl', itemId, 'ditolak', 'Review LKL lintas provinsi.');
          res.status(403).json({ error: 'Akses ditolak: LKL berada di luar wilayah Anda.', code: 403 });
          return;
        }
        if (['approve', 'reject'].includes(action) && (lkl.submitter_personnel_id === user.personnelId || lkl.submitter_personnel_id === user.id)) {
          res.status(403).json({ error: 'Self-approval dilarang: pengirim LKL tidak boleh menyetujui laporannya sendiri.', code: 403 });
          return;
        }
        const prevStatus = String(lkl.status);
        const nextStatus = action === 'approve' ? 'diterima' : action === 'reject' ? 'ditolak' : 'perlu_revisi';
        db.prepare('UPDATE lkl_reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
          nextStatus,
          reason || 'Diterima melalui Pusat Persetujuan.',
          user.fullName,
          now,
          itemId
        );
        recordApprovalHistory(db, {
          entityType: 'lkl',
          entityId: itemId,
          action,
          fromStatus: prevStatus,
          toStatus: nextStatus,
          stageLabel: nextStatus === 'diterima' ? 'Verifikasi LKL Selesai' : 'Pengembalian / Penolakan LKL',
          actor: user,
          note: reason || 'Diterima melalui Pusat Persetujuan.',
        });
        if (nextStatus === 'diterima') {
          onLklApproved(db, lkl, user);
        }
        writeAuditLog(db, user, `APPROVAL_CENTER_${action.toUpperCase()}`, 'lkl', String(lkl.reference_number), 'berhasil', reason || nextStatus);
        res.json({ ok: true, status: nextStatus });
        return;
      }

      if (itemType === 'coordinator_report') {
        const rep = db.prepare('SELECT * FROM coordinator_reports WHERE id = ?').get(itemId) as Record<string, unknown> | undefined;
        if (!rep) {
          res.status(404).json({ error: 'Laporan Koordinator tidak ditemukan.', code: 404 });
          return;
        }
        if (user.role === 'koordinator_wilayah') {
          res.status(403).json({ error: 'Laporan Koordinator Wilayah hanya dapat diputuskan oleh tingkat nasional.', code: 403 });
          return;
        }
        const nextStatus = action === 'approve' ? 'diterima' : 'perlu_revisi';
        db.prepare('UPDATE coordinator_reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?').run(
          nextStatus,
          reason || 'Diterima oleh tim nasional.',
          user.fullName,
          now,
          itemId
        );
        if (nextStatus === 'diterima') {
          if (String(rep.report_type) === 'akhir') {
            db.prepare('UPDATE provinces SET final_report_submitted = 1 WHERE code = ?').run(String(rep.province_code));
          } else {
            db.prepare('UPDATE provinces SET monthly_report_submitted = 1 WHERE code = ?').run(String(rep.province_code));
          }
        }
        createNotificationIdempotent(db, {
          userId: String(rep.coordinator_id),
          title: `Laporan Koordinator ${String(rep.reference_number)} ${nextStatus === 'diterima' ? 'Diterima' : 'Perlu Revisi'}`,
          message: reason || 'Status laporan wilayah Anda telah diperbarui.',
          category: 'laporan_koordinator',
          targetPath: '/laporan-koordinator',
        });
        writeAuditLog(db, user, `APPROVAL_CENTER_${action.toUpperCase()}`, 'coordinator_report', String(rep.reference_number), 'berhasil', reason || nextStatus);
        res.json({ ok: true, status: nextStatus });
        return;
      }

      if (itemType === 'account_request') {
        if (!['super_admin', 'wakil_super_admin', 'sekretariat_nasional'].includes(user.role)) {
          res.status(403).json({ error: 'Hanya Super Admin, Wakil, atau Sekretariat Nasional yang dapat memutus permintaan akun.', code: 403 });
          return;
        }
        const reqRow = db.prepare('SELECT * FROM account_requests WHERE id = ?').get(itemId) as Record<string, unknown> | undefined;
        if (!reqRow) {
          res.status(404).json({ error: 'Permintaan akun tidak ditemukan.', code: 404 });
          return;
        }
        if (String(reqRow.status) !== 'menunggu') {
          res.status(409).json({ error: 'Permintaan akun ini sudah diproses sebelumnya.', code: 409 });
          return;
        }
        const nextStatus = action === 'approve' ? 'disetujui' : 'ditolak';
        db.prepare('UPDATE account_requests SET status = ?, decided_by = ?, decision_note = ?, decided_at = ? WHERE id = ?').run(
          nextStatus,
          user.fullName,
          reason || (action === 'approve' ? 'Disetujui melalui Pusat Persetujuan.' : 'Ditolak'),
          now,
          itemId
        );
        let inviteToken: string | null = null;
        if (nextStatus === 'disetujui') {
          inviteToken = crypto.randomBytes(20).toString('hex');
          const exp = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
          db.prepare(
            `INSERT INTO invitations (id, email, full_name, role, province_code, batch_id, token_hash, expires_at, created_by, created_at)
             VALUES (?, ?, ?, 'duta', ?, ?, ?, ?, ?, ?)`
          ).run(
            crypto.randomUUID(),
            String(reqRow.email),
            String(reqRow.full_name),
            String(reqRow.province_code),
            String(reqRow.batch_id || 'batch-3'),
            sha256(inviteToken),
            exp,
            user.id,
            now
          );
        }
        writeAuditLog(db, user, `APPROVAL_CENTER_${action.toUpperCase()}`, 'account_request', String(reqRow.reference_number), 'berhasil', reason || nextStatus);
        res.json({ ok: true, status: nextStatus, inviteToken });
        return;
      }

      if (itemType === 'handover') {
        if (!['super_admin', 'wakil_super_admin', 'penanggung_jawab'].includes(user.role)) {
          res.status(403).json({ error: 'Hanya pimpinan nasional yang dapat menyetujui serah terima koordinator.', code: 403 });
          return;
        }
        const hnd = db.prepare('SELECT * FROM handovers WHERE id = ?').get(itemId) as Record<string, unknown> | undefined;
        if (!hnd) {
          res.status(404).json({ error: 'Serah terima tidak ditemukan.', code: 404 });
          return;
        }
        if (String(hnd.status) !== 'menunggu_persetujuan') {
          res.status(409).json({ error: 'Serah terima ini sudah diputuskan sebelumnya.', code: 409 });
          return;
        }
        const nextStatus = action === 'approve' ? 'disetujui' : 'ditolak';
        db.prepare('UPDATE handovers SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?').run(
          nextStatus,
          user.fullName,
          now,
          itemId
        );
        if (nextStatus === 'disetujui') {
          db.prepare('UPDATE provinces SET coordinator_name = ? WHERE code = ?').run(
            String(hnd.incoming_coordinator_name),
            String(hnd.province_code)
          );
          writeActivityTimeline(
            db,
            'Wilayah',
            `Serah Terima Koordinator ${PROVINCE_BY_CODE.get(String(hnd.province_code))?.name ?? ''}`,
            `${String(hnd.outgoing_coordinator_name)} menyerahkan tugas kepada ${String(hnd.incoming_coordinator_name)}.`,
            user.fullName,
            String(hnd.province_code),
            null,
            `/wilayah/${String(hnd.province_code)}`
          );
        }
        writeAuditLog(db, user, `APPROVAL_CENTER_${action.toUpperCase()}`, 'handover', String(hnd.reference_number), 'berhasil', reason || nextStatus);
        res.json({ ok: true, status: nextStatus });
        return;
      }

      res.status(400).json({ error: 'Tipe item persetujuan tidak didukung.', code: 400 });
    }
  );

  // ---------------------------------------------------------------------------
  // PUSAT EMAIL & PENGIRIMAN MASSAL (INTEGRATED EMAIL CENTER)
  // ---------------------------------------------------------------------------
  app.get('/api/email/overview', requireAuth, requirePermission('email', 'view'), (_req, res) => {
    const db = getDb();
    const templates = db.prepare('SELECT * FROM email_templates ORDER BY name ASC').all() as Record<string, unknown>[];
    const campaigns = db
      .prepare('SELECT * FROM email_campaigns ORDER BY created_at DESC LIMIT 50')
      .all() as Record<string, unknown>[];
    const logs = db
      .prepare('SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 100')
      .all() as Record<string, unknown>[];

    res.json({
      runtime: getEmailRuntimeStatus(),
      templates: templates.map((t) => ({
        id: String(t.id),
        code: String(t.code),
        name: String(t.name),
        category: String(t.category),
        subject: String(t.subject),
        bodyText: String(t.body_text),
        bodyHtml: t.body_html ? String(t.body_html) : null,
        version: Number(t.version || 1),
        isActive: Boolean(t.is_active),
        updatedAt: String(t.updated_at),
      })),
      campaigns: campaigns.map((c) => ({
        id: String(c.id),
        title: String(c.title),
        templateId: c.template_id ? String(c.template_id) : null,
        subject: String(c.subject),
        bodyText: String(c.body_text),
        bodyHtml: c.body_html ? String(c.body_html) : null,
        audienceFilter: (() => {
          try {
            return JSON.parse(String(c.audience_filter_json || '{}'));
          } catch {
            return { mode: 'single' };
          }
        })(),
        deliveryMode: c.delivery_mode,
        status: c.status,
        totalRecipients: Number(c.total_recipients || 0),
        sentCount: Number(c.sent_count || 0),
        failedCount: Number(c.failed_count || 0),
        scheduledAt: c.scheduled_at ? String(c.scheduled_at) : null,
        sentAt: c.sent_at ? String(c.sent_at) : null,
        createdByName: String(c.created_by_name),
        createdAt: String(c.created_at),
      })),
      logs: logs.map((l) => ({
        id: String(l.id),
        campaignId: String(l.campaign_id),
        recipientEmail: String(l.recipient_email),
        recipientName: String(l.recipient_name),
        subjectRendered: String(l.subject_rendered),
        status: l.status,
        deliveryMode: l.delivery_mode,
        deliveryChannel: l.delivery_channel ? String(l.delivery_channel) : String(l.delivery_mode),
        errorMessage: l.error_message ? String(l.error_message) : null,
        providerMessageId: l.provider_message_id ? String(l.provider_message_id) : null,
        sentAt: l.sent_at ? String(l.sent_at) : null,
        createdAt: String(l.created_at),
      })),
    });
  });

  app.post('/api/email/templates', requireAuth, requirePermission('email', 'create'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const name = String(req.body?.name || '').trim();
    const code = String(req.body?.code || name.toLowerCase().replace(/[^a-z0-9]+/g, '_')).trim();
    const category = String(req.body?.category || 'Umum').trim();
    const subject = String(req.body?.subject || '').trim();
    const bodyText = String(req.body?.bodyText || '').trim();
    const bodyHtml = req.body?.bodyHtml ? String(req.body.bodyHtml).trim() : null;

    if (!name || !subject || !bodyText) {
      res.status(400).json({ error: 'Nama templat, subjek, dan isi email wajib diisi.', code: 400 });
      return;
    }

    const subVal = validateEmailTemplatePlaceholders(subject);
    const bodyVal = validateEmailTemplatePlaceholders(bodyText);
    const htmlVal = bodyHtml ? validateEmailTemplatePlaceholders(bodyHtml) : { valid: true, invalidVariables: [], unclosedBraces: false };
    if (!subVal.valid || !bodyVal.valid || !htmlVal.valid) {
      res.status(400).json({
        error: 'Templat mengandung variabel tidak dikenal atau tanda kurung {{...}} yang belum tertutup.',
        invalidVariables: [...subVal.invalidVariables, ...bodyVal.invalidVariables, ...htmlVal.invalidVariables],
        code: 400,
      });
      return;
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    try {
      db.prepare(
        `INSERT INTO email_templates (id, code, name, category, subject, body_text, body_html, version, is_active, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1, ?)`
      ).run(id, code, name, category, subject, bodyText, bodyHtml, now);
    } catch {
      res.status(409).json({ error: 'Kode templat sudah digunakan. Gunakan nama/kode berbeda.', code: 409 });
      return;
    }

    writeAuditLog(db, user, 'CREATE_EMAIL_TEMPLATE', 'email_template', id, 'berhasil', name);
    res.status(201).json({ ok: true, id });
  });

  app.put('/api/email/templates/:id', requireAuth, requirePermission('email', 'edit'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const id = String(req.params.id);
    const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      res.status(404).json({ error: 'Templat email tidak ditemukan.', code: 404 });
      return;
    }
    const subject = String(req.body?.subject ?? existing.subject).trim();
    const bodyText = String(req.body?.bodyText ?? existing.body_text).trim();
    const bodyHtml = req.body?.bodyHtml !== undefined ? (req.body.bodyHtml ? String(req.body.bodyHtml) : null) : (existing.body_html ? String(existing.body_html) : null);
    const name = String(req.body?.name ?? existing.name).trim();
    const category = String(req.body?.category ?? existing.category).trim();

    const subVal = validateEmailTemplatePlaceholders(subject);
    const bodyVal = validateEmailTemplatePlaceholders(bodyText);
    const htmlVal = bodyHtml ? validateEmailTemplatePlaceholders(bodyHtml) : { valid: true, invalidVariables: [], unclosedBraces: false };
    if (!subVal.valid || !bodyVal.valid || !htmlVal.valid) {
      res.status(400).json({
        error: 'Templat mengandung variabel tidak dikenal atau tanda kurung {{...}} yang belum tertutup.',
        invalidVariables: [...subVal.invalidVariables, ...bodyVal.invalidVariables, ...htmlVal.invalidVariables],
        code: 400,
      });
      return;
    }

    const prevVersion = Number(existing.version || 1);
    const nextVersion = prevVersion + 1;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO email_template_history (id, template_id, version, subject, body_text, body_html, updated_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      crypto.randomUUID(),
      id,
      prevVersion,
      String(existing.subject),
      String(existing.body_text),
      existing.body_html ? String(existing.body_html) : null,
      user.fullName,
      now
    );

    db.prepare(
      'UPDATE email_templates SET name = ?, category = ?, subject = ?, body_text = ?, body_html = ?, version = ?, updated_at = ? WHERE id = ?'
    ).run(name, category, subject, bodyText, bodyHtml, nextVersion, now, id);

    writeAuditLog(db, user, 'UPDATE_EMAIL_TEMPLATE', 'email_template', id, 'berhasil', `v${prevVersion} -> v${nextVersion}`);
    res.json({ ok: true, version: nextVersion });
  });

  app.get('/api/email/templates/:id/history', requireAuth, requirePermission('email', 'view'), (req, res) => {
    const db = getDb();
    const id = String(req.params.id);
    const history = db
      .prepare('SELECT * FROM email_template_history WHERE template_id = ? ORDER BY version DESC')
      .all(id);
    res.json({ history });
  });

  app.post('/api/email/parse-csv', requireAuth, requirePermission('email', 'create'), (req, res) => {
    const csvText = String(req.body?.csvText || '').trim();
    if (!csvText) {
      res.status(400).json({ error: 'Konten CSV penerima kosong.', code: 400 });
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const tokens = csvText
      .split(/[\r\n,;]+/)
      .map((s) => s.trim().replace(/^["']|["']$/g, '').toLowerCase())
      .filter(Boolean);
    const validEmails = Array.from(new Set(tokens.filter((t) => emailRegex.test(t))));
    const ignoredCount = tokens.filter((t) => !emailRegex.test(t) && t !== 'email').length;
    res.json({
      emails: validEmails.slice(0, 500),
      totalValid: validEmails.length,
      ignoredCount,
    });
  });

  app.post('/api/email/audience-preview', requireAuth, requirePermission('email', 'view'), (req, res) => {
    const db = getDb();
    const filter = (req.body?.filter || {}) as Record<string, unknown>;
    const preview = resolveEmailAudience(db, {
      mode: filter.mode === 'bulk' ? 'bulk' : 'single',
      allActive: Boolean(filter.allActive),
      roles: Array.isArray(filter.roles) ? filter.roles.map(String) : undefined,
      bidang: filter.bidang ? String(filter.bidang) : undefined,
      provinceCode: filter.provinceCode ? String(filter.provinceCode) : undefined,
      batchId: filter.batchId ? String(filter.batchId) : undefined,
      manualEmails: Array.isArray(filter.manualEmails) ? filter.manualEmails.map(String) : undefined,
    });
    res.json({
      totalMatched: preview.totalMatched,
      selectedCount: preview.recipients.length,
      truncatedByLimit: preview.truncatedByLimit,
      batchLimit: preview.batchLimit,
      sample: preview.recipients.slice(0, 15).map((r) => ({
        email: r.email,
        fullName: r.fullName,
        jabatan: r.jabatan,
        provinsi: r.provinsi,
      })),
    });
  });

  app.post(
    '/api/email/send',
    requireAuth,
    requirePermission('email', 'create'),
    async (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const user = req.authUser!;
      const throttle = checkGenericThrottle(`email-send:${user.id}`, 10, 60_000);
      if (!throttle.allowed) {
        res.status(429).json({
          error: `Batas laju pengiriman tercapai. Tunggu ${throttle.retryAfterSec} detik sebelum mengirim lagi.`,
          code: 429,
        });
        return;
      }

      const title = String(req.body?.title || '').trim();
      const templateId = req.body?.templateId ? String(req.body.templateId) : null;
      const subject = String(req.body?.subject || '').trim();
      const bodyText = String(req.body?.bodyText || '').trim();
      const actionMode = String(req.body?.actionMode || 'send_now') as
        | 'send_now'
        | 'save_draft'
        | 'schedule'
        | 'test_self';
      const scheduledAt = req.body?.scheduledAt ? String(req.body.scheduledAt) : null;
      const filter = (req.body?.audienceFilter || {}) as Record<string, unknown>;

      if (!subject || !bodyText) {
        res.status(400).json({ error: 'Subjek dan isi email wajib diisi.', code: 400 });
        return;
      }
      if (actionMode === 'schedule' && (!scheduledAt || Number.isNaN(Date.parse(scheduledAt)))) {
        res.status(400).json({ error: 'Tanggal & waktu penjadwalan tidak valid.', code: 400 });
        return;
      }

      const resolved =
        actionMode === 'test_self'
          ? {
              recipients: [
                {
                  userId: user.id,
                  email: user.email,
                  fullName: user.fullName,
                  jabatan: user.roleLabel,
                  provinsi: user.provinceName || 'Nasional',
                  angkatan: 'Nasional',
                },
              ],
              totalMatched: 1,
              truncatedByLimit: false,
              batchLimit: 250,
            }
          : resolveEmailAudience(db, {
              mode: filter.mode === 'bulk' ? 'bulk' : 'single',
              allActive: Boolean(filter.allActive),
              roles: Array.isArray(filter.roles) ? filter.roles.map(String) : undefined,
              bidang: filter.bidang ? String(filter.bidang) : undefined,
              provinceCode: filter.provinceCode ? String(filter.provinceCode) : undefined,
              batchId: filter.batchId ? String(filter.batchId) : undefined,
              manualEmails: Array.isArray(filter.manualEmails) ? filter.manualEmails.map(String) : undefined,
            });

      if (resolved.recipients.length === 0) {
        res.status(400).json({ error: 'Tidak ada alamat email penerima yang valid dari kriteria audiens tersebut.', code: 400 });
        return;
      }

      if (actionMode === 'send_now' && resolved.recipients.length > 1 && !hasScopedUserPermission(user, 'email', 'publish')) {
        res.status(403).json({
          error: 'Peran Anda hanya diizinkan mengirim uji/tunggal atau menyimpan draf. Pengiriman massal memerlukan izin publish email.',
          code: 403,
        });
        return;
      }

      try {
        const bodyHtml = req.body?.bodyHtml ? String(req.body.bodyHtml) : null;
        const result = await executeEmailCampaign(db, {
          title: title || (actionMode === 'test_self' ? `[Uji Diri] ${subject}` : subject),
          templateId,
          subject,
          bodyText,
          bodyHtml,
          nomorSurat: req.body?.nomorSurat ? String(req.body.nomorSurat) : undefined,
          tenggat: req.body?.tenggat ? String(req.body.tenggat) : undefined,
          tautan: req.body?.tautan ? String(req.body.tautan) : undefined,
          audienceFilter: {
            mode: resolved.recipients.length > 1 ? 'bulk' : 'single',
            allActive: Boolean(filter.allActive),
            roles: Array.isArray(filter.roles) ? filter.roles.map(String) : undefined,
            bidang: filter.bidang ? String(filter.bidang) : undefined,
            provinceCode: filter.provinceCode ? String(filter.provinceCode) : undefined,
            batchId: filter.batchId ? String(filter.batchId) : undefined,
            manualEmails: Array.isArray(filter.manualEmails) ? filter.manualEmails.map(String) : undefined,
          },
          recipients: resolved.recipients,
          actionMode,
          scheduledAt,
          createdBy: user.id,
          createdByName: user.fullName,
        });

        writeAuditLog(
          db,
          user,
          `EMAIL_${actionMode.toUpperCase()}`,
          'email_campaign',
          result.campaignId,
          'berhasil',
          `Mode: ${result.deliveryMode} | Penerima: ${result.totalRecipients} | Terkirim/Antre: ${result.sentCount}`
        );

        res.status(201).json({ ok: true, ...result });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memproses pengiriman email.', code: 400 });
      }
    }
  );

  app.post(
    '/api/email/campaigns/:id/cancel',
    requireAuth,
    requirePermission('email', 'create'),
    (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const user = req.authUser!;
      const id = String(req.params.id);
      const cmp = db.prepare('SELECT status FROM email_campaigns WHERE id = ?').get(id) as { status: string } | undefined;
      if (!cmp) {
        res.status(404).json({ error: 'Kampanye email tidak ditemukan.', code: 404 });
        return;
      }
      if (!['draft', 'terjadwal'].includes(cmp.status)) {
        res.status(409).json({ error: 'Hanya draf atau kampanye terjadwal yang dapat dibatalkan.', code: 409 });
        return;
      }
      db.prepare("UPDATE email_campaigns SET status = 'dibatalkan' WHERE id = ?").run(id);
      writeAuditLog(db, user, 'EMAIL_CAMPAIGN_CANCEL', 'email_campaign', id, 'berhasil', 'Dibatalkan oleh operator.');
      res.json({ ok: true });
    }
  );

  app.post(
    '/api/email/campaigns/:id/retry',
    requireAuth,
    requirePermission('email', 'create'),
    async (req: AuthenticatedRequest, res) => {
      const db = getDb();
      const user = req.authUser!;
      const id = String(req.params.id);
      const result = await retryCampaignFailedLogs(db, id);
      writeAuditLog(db, user, 'EMAIL_CAMPAIGN_RETRY', 'email_campaign', id, 'berhasil', `Ulang: ${result.retried}, Berhasil: ${result.succeeded}`);
      res.json({ ok: true, ...result });
    }
  );

  app.get('/api/email/logs/export', requireAuth, requirePermission('email', 'view'), (req: AuthenticatedRequest, res) => {
    const db = getDb();
    const user = req.authUser!;
    const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
    const csv = exportCampaignLogsCsv(db, campaignId);
    writeAuditLog(db, user, 'EXPORT_EMAIL_LOGS_CSV', 'email_logs', campaignId || 'all', 'berhasil', 'Ekspor log email CSV');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="satu-dpbi-email-logs.csv"');
    res.send(csv);
  });
}

function pParamsGuard(params: string[], prov: string) {
  params.push(prov);
}
