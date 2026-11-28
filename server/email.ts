import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import nodemailer from 'nodemailer';
import type { DatabaseSync } from 'node:sqlite';
import { PRIVATE_STORAGE_DIR } from './db';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';
import { csvSafeCell, renderEmailTemplate, ROLE_LABELS, validateEmailTemplatePlaceholders } from '../src/lib/rbac';
import type { EmailAttachmentRecord, RoleCode } from '../src/lib/types';

export interface AudienceFilter {
  mode?: 'single' | 'bulk' | 'transactional';
  allActive?: boolean;
  roles?: string[];
  bidang?: string;
  provinceCode?: string;
  batchId?: string;
  manualEmails?: string[];
}

export interface ResolvedRecipient {
  userId: string | null;
  email: string;
  fullName: string;
  jabatan: string;
  role?: string;
  provinsi: string;
  kabupaten?: string;
  angkatan: string;
  nomorAnggota?: string;
}

const BLOCKED_ATTACHMENT_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.js', '.mjs', '.cjs', '.vbs', '.ps1', '.php', '.py', '.rb', '.jar',
]);

export function getEmailRuntimeStatus(): {
  smtpConfigured: boolean;
  deliveryMode: 'smtp_live' | 'sandbox_outbox';
  senderAddress: string;
  batchLimit: number;
  ratePerMin: number;
  hostLabel: string | null;
} {
  const host = (process.env.SMTP_HOST || '').trim();
  const smtpConfigured = Boolean(host);
  return {
    smtpConfigured,
    deliveryMode: smtpConfigured ? 'smtp_live' : 'sandbox_outbox',
    senderAddress: (process.env.SMTP_FROM || 'SATU DPBI <noreply@dpbi.or.id>').trim(),
    batchLimit: Math.max(1, Math.min(1000, Number(process.env.EMAIL_BATCH_LIMIT || 250) || 250)),
    ratePerMin: Math.max(5, Math.min(600, Number(process.env.EMAIL_RATE_PER_MIN || 60) || 60)),
    hostLabel: smtpConfigured ? host : null,
  };
}

function isValidEmailAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function resolveEmailAttachmentsForOwner(
  db: DatabaseSync,
  ownerType: 'template' | 'campaign',
  ownerId: string
): { records: EmailAttachmentRecord[]; mailAttachments: { filename: string; path: string; contentType?: string }[] } {
  const rows = db
    .prepare(
      `SELECT ea.id, ea.owner_type, ea.owner_id, ea.file_id, ea.file_name, ea.mime_type, ea.size_bytes, ea.created_at,
              sf.stored_name, sf.is_archived
       FROM email_attachments ea
       JOIN stored_files sf ON sf.id = ea.file_id
       WHERE ea.owner_type = ? AND ea.owner_id = ?
       ORDER BY ea.created_at ASC`
    )
    .all(ownerType, ownerId) as Record<string, unknown>[];

  const records: EmailAttachmentRecord[] = [];
  const mailAttachments: { filename: string; path: string; contentType?: string }[] = [];
  const resolvedBase = path.resolve(PRIVATE_STORAGE_DIR);

  for (const r of rows) {
    const fileName = String(r.file_name || 'lampiran');
    const ext = path.extname(fileName).toLowerCase();
    const isArchived = Number(r.is_archived || 0) === 1;
    records.push({
      id: String(r.id),
      ownerType: ownerType,
      ownerId: String(r.owner_id),
      fileId: String(r.file_id),
      fileName,
      mimeType: String(r.mime_type || 'application/octet-stream'),
      sizeBytes: Number(r.size_bytes || 0),
      createdAt: String(r.created_at),
    });
    if (isArchived || BLOCKED_ATTACHMENT_EXTENSIONS.has(ext)) continue;
    const storedName = String(r.stored_name || '');
    const targetPath = path.resolve(resolvedBase, storedName);
    if (!targetPath.startsWith(resolvedBase + path.sep)) continue;
    if (fs.existsSync(targetPath)) {
      mailAttachments.push({
        filename: fileName,
        path: targetPath,
        contentType: String(r.mime_type || 'application/octet-stream'),
      });
    }
  }

  return { records, mailAttachments };
}

export function resolveEmailAudience(
  db: DatabaseSync,
  filter: AudienceFilter
): {
  recipients: ResolvedRecipient[];
  totalMatched: number;
  truncatedByLimit: boolean;
  batchLimit: number;
} {
  const { batchLimit } = getEmailRuntimeStatus();
  const byEmail = new Map<string, ResolvedRecipient>();

  const hasUserFilters =
    Boolean(filter.allActive) ||
    Boolean(filter.roles && filter.roles.length > 0) ||
    Boolean(filter.bidang?.trim()) ||
    Boolean(filter.provinceCode?.trim()) ||
    Boolean(filter.batchId?.trim());

  if (hasUserFilters) {
    const conds: string[] = ["u.account_status IN ('aktif', 'alumni_terbatas')"];
    const params: unknown[] = [];

    if (filter.roles && filter.roles.length > 0) {
      conds.push(`u.role IN (${filter.roles.map(() => '?').join(',')})`);
      params.push(...filter.roles);
    }
    if (filter.bidang?.trim()) {
      conds.push("LOWER(COALESCE(u.bidang, '')) = LOWER(?)");
      params.push(filter.bidang.trim());
    }
    if (filter.provinceCode?.trim()) {
      conds.push('u.province_code = ?');
      params.push(filter.provinceCode.trim());
    }
    if (filter.batchId?.trim()) {
      conds.push('u.batch_id = ?');
      params.push(filter.batchId.trim());
    }

    const rows = db
      .prepare(
        `SELECT u.id, u.email, u.full_name, u.role, u.province_code, u.batch_id,
                b.name AS batch_name, p.regency, p.member_number
         FROM users u
         LEFT JOIN batches b ON b.id = u.batch_id
         LEFT JOIN personnel p ON p.id = u.personnel_id
         WHERE ${conds.join(' AND ')}
         ORDER BY u.full_name ASC`
      )
      .all(...(params as string[])) as Record<string, unknown>[];

    for (const r of rows) {
      const email = String(r.email || '').trim().toLowerCase();
      if (!isValidEmailAddress(email) || byEmail.has(email)) continue;
      const role = String(r.role) as RoleCode;
      const provCode = r.province_code ? String(r.province_code) : null;
      byEmail.set(email, {
        userId: String(r.id),
        email,
        fullName: String(r.full_name || email),
        jabatan: ROLE_LABELS[role] ?? role,
        role: ROLE_LABELS[role] ?? role,
        provinsi: provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : 'Nasional',
        kabupaten: r.regency ? String(r.regency) : '—',
        angkatan: r.batch_name ? String(r.batch_name) : 'Nasional',
        nomorAnggota: r.member_number ? String(r.member_number) : '—',
      });
    }
  }

  for (const raw of filter.manualEmails ?? []) {
    const email = raw.trim().toLowerCase();
    if (!isValidEmailAddress(email) || byEmail.has(email)) continue;
    const existing = db
      .prepare(
        `SELECT u.id, u.full_name, u.role, u.province_code, b.name AS batch_name, p.regency, p.member_number
         FROM users u
         LEFT JOIN batches b ON b.id = u.batch_id
         LEFT JOIN personnel p ON p.id = u.personnel_id
         WHERE LOWER(u.email) = ? LIMIT 1`
      )
      .get(email) as Record<string, unknown> | undefined;

    if (existing) {
      const role = String(existing.role) as RoleCode;
      const provCode = existing.province_code ? String(existing.province_code) : null;
      byEmail.set(email, {
        userId: String(existing.id),
        email,
        fullName: String(existing.full_name),
        jabatan: ROLE_LABELS[role] ?? role,
        role: ROLE_LABELS[role] ?? role,
        provinsi: provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : 'Nasional',
        kabupaten: existing.regency ? String(existing.regency) : '—',
        angkatan: existing.batch_name ? String(existing.batch_name) : 'Nasional',
        nomorAnggota: existing.member_number ? String(existing.member_number) : '—',
      });
    } else {
      const persOnly = db
        .prepare(
          `SELECT p.full_name, p.position_title, p.role_code, p.province_code, p.regency, p.member_number, b.name AS batch_name
           FROM personnel p LEFT JOIN batches b ON b.id = p.batch_id
           WHERE LOWER(p.email) = ? LIMIT 1`
        )
        .get(email) as Record<string, unknown> | undefined;

      if (persOnly) {
        const provCode = persOnly.province_code ? String(persOnly.province_code) : null;
        byEmail.set(email, {
          userId: null,
          email,
          fullName: String(persOnly.full_name),
          jabatan: String(persOnly.position_title || 'Personel DPBI'),
          role: ROLE_LABELS[String(persOnly.role_code) as RoleCode] ?? String(persOnly.role_code || 'duta'),
          provinsi: provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : 'Nasional',
          kabupaten: persOnly.regency ? String(persOnly.regency) : '—',
          angkatan: persOnly.batch_name ? String(persOnly.batch_name) : 'Nasional',
          nomorAnggota: persOnly.member_number ? String(persOnly.member_number) : '—',
        });
      } else {
        byEmail.set(email, {
          userId: null,
          email,
          fullName: email.split('@')[0],
          jabatan: 'Penerima Eksternal / Undangan',
          role: 'Eksternal',
          provinsi: 'Nasional',
          kabupaten: '—',
          angkatan: '—',
          nomorAnggota: '—',
        });
      }
    }
  }

  const all = [...byEmail.values()];
  return {
    recipients: all.slice(0, batchLimit),
    totalMatched: all.length,
    truncatedByLimit: all.length > batchLimit,
    batchLimit,
  };
}

function buildTemplateVars(
  r: ResolvedRecipient,
  campaignId: string,
  tanggalLabel: string,
  meta?: {
    referenceCode?: string;
    nomorSurat?: string;
    nomorPengajuan?: string;
    namaProgram?: string;
    tenggat?: string;
    tautan?: string;
    tautanAktivasi?: string;
    tautanDokumen?: string;
    catatanPemeriksa?: string;
    namaPemeriksa?: string;
  }
): Record<string, string> {
  const appUrl = (process.env.APP_URL || 'https://satu.dpbi.or.id').replace(/\/$/, '');
  const ref = meta?.referenceCode || campaignId.slice(0, 8).toUpperCase();
  const baseLink = meta?.tautan || appUrl;
  return {
    nama: r.fullName,
    email: r.email,
    jabatan: r.jabatan,
    role: r.role || r.jabatan,
    provinsi: r.provinsi,
    kabupaten: r.kabupaten || '—',
    angkatan: r.angkatan,
    nomor_anggota: r.nomorAnggota || '—',
    nomor_surat: meta?.nomorSurat || ref,
    nomor_pengajuan: meta?.nomorPengajuan || ref,
    nama_program: meta?.namaProgram || 'Program Resmi DPBI',
    tanggal: tanggalLabel,
    tenggat: meta?.tenggat || tanggalLabel,
    tautan: baseLink,
    tautan_aktivasi: meta?.tautanAktivasi || baseLink,
    tautan_dokumen: meta?.tautanDokumen || `${appUrl}/dokumen`,
    catatan_pemeriksa: meta?.catatanPemeriksa || '—',
    nama_pemeriksa: meta?.namaPemeriksa || 'Sekretariat Nasional DPBI',
    nama_organisasi: 'Duta Pelajar Berbudaya Indonesia (DPBI)',
    referensi: ref,
  };
}

function redactSensitiveTokenInLog(text: string): string {
  return text.replace(/([?&]token=)[a-zA-Z0-9_-]{12,}/g, '$1[TOKEN_TERLINDUNGI]');
}

async function dispatchSingleEmail(
  recipientEmail: string,
  subject: string,
  bodyText: string,
  bodyHtml?: string | null,
  attachments: { filename: string; path: string; contentType?: string }[] = []
): Promise<{ ok: boolean; status: 'terkirim' | 'terantre_outbox' | 'gagal'; mode: 'smtp_live' | 'sandbox_outbox'; messageId?: string; error?: string }> {
  const runtime = getEmailRuntimeStatus();
  if (!runtime.smtpConfigured) {
    return {
      ok: true,
      status: 'terantre_outbox',
      mode: 'sandbox_outbox',
      messageId: `outbox-${crypto.randomBytes(6).toString('hex')}`,
    };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth:
        process.env.SMTP_USER && process.env.SMTP_PASS
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
    });
    const info = await transporter.sendMail({
      from: runtime.senderAddress,
      to: recipientEmail,
      subject,
      text: bodyText,
      ...(bodyHtml ? { html: bodyHtml } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    });
    return {
      ok: true,
      status: 'terkirim',
      mode: 'smtp_live',
      messageId: info.messageId || `smtp-${crypto.randomBytes(6).toString('hex')}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 'gagal',
      mode: 'smtp_live',
      error: err instanceof Error ? err.message : 'Gagal menghubungi server SMTP.',
    };
  }
}

export async function processQueuedCampaignChunk(
  db: DatabaseSync,
  campaignId: string,
  chunkSize = 10
): Promise<{ processed: number; remaining: number; status: string }> {
  const cmp = db.prepare('SELECT * FROM email_campaigns WHERE id = ?').get(campaignId) as Record<string, unknown> | undefined;
  if (!cmp) {
    return { processed: 0, remaining: 0, status: 'tidak_ditemukan' };
  }
  if (Number(cmp.paused || 0) === 1 || cmp.cancelled_at || String(cmp.status) === 'dibatalkan') {
    const rem = (db.prepare("SELECT COUNT(*) AS c FROM email_queue WHERE campaign_id = ? AND queue_status = 'dalam_antrean'").get(campaignId) as { c: number }).c;
    return { processed: 0, remaining: rem, status: String(cmp.status) };
  }

  const pendingItems = db
    .prepare("SELECT * FROM email_queue WHERE campaign_id = ? AND queue_status = 'dalam_antrean' ORDER BY created_at ASC LIMIT ?")
    .all(campaignId, chunkSize) as Record<string, unknown>[];

  if (pendingItems.length === 0) {
    const counts = db
      .prepare(
        `SELECT
           SUM(CASE WHEN status IN ('terkirim', 'terantre_outbox') THEN 1 ELSE 0 END) AS sent_c,
           SUM(CASE WHEN status = 'gagal' THEN 1 ELSE 0 END) AS fail_c
         FROM email_logs WHERE campaign_id = ?`
      )
      .get(campaignId) as { sent_c: number | null; fail_c: number | null };
    const sentCount = Number(counts?.sent_c ?? 0);
    const failedCount = Number(counts?.fail_c ?? 0);
    const finalStatus = failedCount > 0 && sentCount === 0 ? 'gagal' : failedCount > 0 ? 'sebagian_gagal' : 'terkirim';
    db.prepare(
      'UPDATE email_campaigns SET status = ?, sent_count = ?, failed_count = ?, queued_count = 0, sent_at = COALESCE(sent_at, ?) WHERE id = ?'
    ).run(finalStatus, sentCount, failedCount, new Date().toISOString(), campaignId);
    return { processed: 0, remaining: 0, status: finalStatus };
  }

  const { mailAttachments } = resolveEmailAttachmentsForOwner(db, 'campaign', campaignId);
  const logStmt = db.prepare(
    `INSERT INTO email_logs
     (id, campaign_id, recipient_user_id, recipient_email, recipient_name, subject_rendered, body_rendered, status, delivery_mode, delivery_channel, error_message, provider_message_id, sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const updQueue = db.prepare(
    'UPDATE email_queue SET queue_status = ?, attempts = attempts + 1, last_error = ?, processed_at = ? WHERE id = ?'
  );

  let processed = 0;
  for (const item of pendingItems) {
    const now = new Date().toISOString();
    const res = await dispatchSingleEmail(
      String(item.recipient_email),
      String(item.subject_rendered),
      String(item.body_rendered),
      item.html_rendered ? String(item.html_rendered) : null,
      mailAttachments
    );
    logStmt.run(
      crypto.randomUUID(),
      campaignId,
      item.recipient_user_id ? String(item.recipient_user_id) : null,
      String(item.recipient_email),
      String(item.recipient_name || item.recipient_email),
      String(item.subject_rendered),
      redactSensitiveTokenInLog(String(item.body_rendered)),
      res.status,
      res.mode,
      res.mode,
      res.error || null,
      res.messageId || null,
      res.ok ? now : null,
      now
    );
    updQueue.run(res.ok ? 'selesai' : 'gagal', res.error || null, now, String(item.id));
    processed += 1;
  }

  const remaining = (
    db.prepare("SELECT COUNT(*) AS c FROM email_queue WHERE campaign_id = ? AND queue_status = 'dalam_antrean'").get(campaignId) as { c: number }
  ).c;
  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN ('terkirim', 'terantre_outbox') THEN 1 ELSE 0 END) AS sent_c,
         SUM(CASE WHEN status = 'gagal' THEN 1 ELSE 0 END) AS fail_c
       FROM email_logs WHERE campaign_id = ?`
    )
    .get(campaignId) as { sent_c: number | null; fail_c: number | null };
  const sentCount = Number(counts?.sent_c ?? 0);
  const failedCount = Number(counts?.fail_c ?? 0);

  const nextStatus =
    remaining > 0
      ? 'sedang_dikirim'
      : failedCount > 0 && sentCount === 0
      ? 'gagal'
      : failedCount > 0
      ? 'sebagian_gagal'
      : 'terkirim';

  db.prepare(
    'UPDATE email_campaigns SET status = ?, sent_count = ?, failed_count = ?, queued_count = ?, sent_at = COALESCE(sent_at, ?) WHERE id = ?'
  ).run(nextStatus, sentCount, failedCount, remaining, new Date().toISOString(), campaignId);

  return { processed, remaining, status: nextStatus };
}

export function scheduleCampaignQueueTick(db: DatabaseSync, campaignId: string, delayMs = 250): void {
  setTimeout(async () => {
    try {
      const res = await processQueuedCampaignChunk(db, campaignId, 10);
      if (res.remaining > 0 && res.status === 'sedang_dikirim') {
        scheduleCampaignQueueTick(db, campaignId, delayMs);
      }
    } catch {
      // Non-fatal background queue tick failure; remaining items can be retried via /process-next
    }
  }, delayMs);
}

export async function executeEmailCampaign(
  db: DatabaseSync,
  input: {
    title: string;
    templateId?: string | null;
    subject: string;
    bodyText: string;
    bodyHtml?: string | null;
    audienceFilter: AudienceFilter;
    recipients: ResolvedRecipient[];
    actionMode: 'send_now' | 'save_draft' | 'schedule' | 'test_self';
    scheduledAt?: string | null;
    createdBy: string;
    createdByName: string;
    referenceCode?: string;
    nomorSurat?: string;
    nomorPengajuan?: string;
    namaProgram?: string;
    tenggat?: string;
    tautan?: string;
    attachmentFiles?: { fileId: string; fileName: string; mimeType: string; sizeBytes: number }[];
    useQueue?: boolean;
  }
): Promise<{
  campaignId: string;
  deliveryMode: 'smtp_live' | 'sandbox_outbox';
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  queuedCount: number;
}> {
  const subCheck = validateEmailTemplatePlaceholders(input.subject);
  const bodyCheck = validateEmailTemplatePlaceholders(input.bodyText);
  const htmlCheck = input.bodyHtml
    ? validateEmailTemplatePlaceholders(input.bodyHtml)
    : { valid: true, invalidVariables: [], unclosedBraces: false };
  if (!subCheck.valid || !bodyCheck.valid || !htmlCheck.valid) {
    const bad = [...subCheck.invalidVariables, ...bodyCheck.invalidVariables, ...htmlCheck.invalidVariables];
    throw new Error(
      bad.length > 0
        ? `Variabel templat tidak valid: ${bad.map((v) => `{{${v}}}`).join(', ')}.`
        : 'Format tanda kurung kurawal {{variabel}} pada templat email belum tertutup dengan benar.'
    );
  }

  const runtime = getEmailRuntimeStatus();
  const campaignId = crypto.randomUUID();
  const now = new Date().toISOString();
  const tanggalLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const persistCampaignAttachments = () => {
    if (!input.attachmentFiles?.length) return;
    const attStmt = db.prepare(
      `INSERT INTO email_attachments (id, owner_type, owner_id, file_id, file_name, mime_type, size_bytes, uploaded_by, created_at)
       VALUES (?, 'campaign', ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const f of input.attachmentFiles) {
      attStmt.run(crypto.randomUUID(), campaignId, f.fileId, f.fileName, f.mimeType, f.sizeBytes, input.createdBy, now);
    }
  };

  if (input.actionMode === 'save_draft' || input.actionMode === 'schedule') {
    const status = input.actionMode === 'schedule' ? 'terjadwal' : 'draft';
    db.prepare(
      `INSERT INTO email_campaigns
       (id, title, template_id, subject, body_text, body_html, audience_filter_json, delivery_mode, status, total_recipients, sent_count, failed_count, queued_count, scheduled_at, sent_at, created_by, created_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0, ?, NULL, ?, ?, ?)`
    ).run(
      campaignId,
      input.title,
      input.templateId || null,
      input.subject,
      input.bodyText,
      input.bodyHtml || null,
      JSON.stringify(input.audienceFilter),
      runtime.deliveryMode,
      status,
      input.recipients.length,
      input.scheduledAt || null,
      input.createdBy,
      input.createdByName,
      now
    );
    persistCampaignAttachments();

    return {
      campaignId,
      deliveryMode: runtime.deliveryMode,
      status,
      totalRecipients: input.recipients.length,
      sentCount: 0,
      failedCount: 0,
      queuedCount: 0,
    };
  }

  const shouldUseQueue = input.actionMode === 'send_now' && (Boolean(input.useQueue) || input.recipients.length > 10);

  if (shouldUseQueue) {
    db.prepare(
      `INSERT INTO email_campaigns
       (id, title, template_id, subject, body_text, body_html, audience_filter_json, delivery_mode, status, total_recipients, sent_count, failed_count, queued_count, paused, scheduled_at, sent_at, created_by, created_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'sedang_dikirim', ?, 0, 0, ?, 0, NULL, ?, ?, ?, ?)`
    ).run(
      campaignId,
      input.title,
      input.templateId || null,
      input.subject,
      input.bodyText,
      input.bodyHtml || null,
      JSON.stringify(input.audienceFilter),
      runtime.deliveryMode,
      input.recipients.length,
      input.recipients.length,
      now,
      input.createdBy,
      input.createdByName,
      now
    );
    persistCampaignAttachments();

    const qStmt = db.prepare(
      `INSERT INTO email_queue
       (id, campaign_id, recipient_user_id, recipient_email, recipient_name, subject_rendered, body_rendered, html_rendered, queue_status, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'dalam_antrean', 0, ?)`
    );
    for (const r of input.recipients) {
      const vars = buildTemplateVars(r, campaignId, tanggalLabel, input);
      const subjectRendered = renderEmailTemplate(input.subject, vars);
      const bodyRendered = renderEmailTemplate(input.bodyText, vars);
      const htmlRendered = input.bodyHtml ? renderEmailTemplate(input.bodyHtml, vars, { htmlEscape: true }) : null;
      qStmt.run(crypto.randomUUID(), campaignId, r.userId, r.email, r.fullName, subjectRendered, bodyRendered, htmlRendered, now);
    }

    const firstChunk = await processQueuedCampaignChunk(db, campaignId, 10);
    if (firstChunk.remaining > 0 && firstChunk.status === 'sedang_dikirim') {
      scheduleCampaignQueueTick(db, campaignId, 250);
    }
    const updatedRow = db.prepare('SELECT status, sent_count, failed_count, queued_count FROM email_campaigns WHERE id = ?').get(campaignId) as {
      status: string;
      sent_count: number;
      failed_count: number;
      queued_count: number;
    };
    return {
      campaignId,
      deliveryMode: runtime.deliveryMode,
      status: String(updatedRow?.status || firstChunk.status),
      totalRecipients: input.recipients.length,
      sentCount: Number(updatedRow?.sent_count ?? 0),
      failedCount: Number(updatedRow?.failed_count ?? 0),
      queuedCount: Number(updatedRow?.queued_count ?? 0),
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  db.prepare(
    `INSERT INTO email_campaigns
     (id, title, template_id, subject, body_text, body_html, audience_filter_json, delivery_mode, status, total_recipients, sent_count, failed_count, queued_count, scheduled_at, sent_at, created_by, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'terkirim', ?, 0, 0, 0, NULL, ?, ?, ?, ?)`
  ).run(
    campaignId,
    input.title,
    input.templateId || null,
    input.subject,
    input.bodyText,
    input.bodyHtml || null,
    JSON.stringify(input.audienceFilter),
    runtime.deliveryMode,
    input.recipients.length,
    now,
    input.createdBy,
    input.createdByName,
    now
  );
  persistCampaignAttachments();

  const { mailAttachments } = resolveEmailAttachmentsForOwner(db, 'campaign', campaignId);
  const logStmt = db.prepare(
    `INSERT INTO email_logs
     (id, campaign_id, recipient_user_id, recipient_email, recipient_name, subject_rendered, body_rendered, status, delivery_mode, delivery_channel, error_message, provider_message_id, sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const r of input.recipients) {
    const vars = buildTemplateVars(r, campaignId, tanggalLabel, input);
    const subjectRendered = renderEmailTemplate(input.subject, vars);
    const bodyRendered = renderEmailTemplate(input.bodyText, vars);
    const htmlRendered = input.bodyHtml ? renderEmailTemplate(input.bodyHtml, vars, { htmlEscape: true }) : null;
    const result = await dispatchSingleEmail(r.email, subjectRendered, bodyRendered, htmlRendered, mailAttachments);

    if (result.ok) sentCount += 1;
    else failedCount += 1;

    logStmt.run(
      crypto.randomUUID(),
      campaignId,
      r.userId,
      r.email,
      r.fullName,
      subjectRendered,
      redactSensitiveTokenInLog(bodyRendered),
      result.status,
      result.mode,
      result.mode,
      result.error || null,
      result.messageId || null,
      result.ok ? new Date().toISOString() : null,
      now
    );
  }

  const finalStatus =
    failedCount > 0 && sentCount === 0
      ? 'gagal'
      : failedCount > 0
      ? 'sebagian_gagal'
      : 'terkirim';

  db.prepare('UPDATE email_campaigns SET status = ?, sent_count = ?, failed_count = ? WHERE id = ?').run(
    finalStatus,
    sentCount,
    failedCount,
    campaignId
  );

  return {
    campaignId,
    deliveryMode: runtime.deliveryMode,
    status: finalStatus,
    totalRecipients: input.recipients.length,
    sentCount,
    failedCount,
    queuedCount: 0,
  };
}

export async function sendTransactionalEmail(
  db: DatabaseSync,
  input: {
    templateCode: string;
    toEmail: string;
    toName: string;
    userId?: string | null;
    role?: string;
    provinsi?: string;
    kabupaten?: string;
    angkatan?: string;
    nomorAnggota?: string;
    referenceCode?: string;
    nomorSurat?: string;
    nomorPengajuan?: string;
    namaProgram?: string;
    tenggat?: string;
    tautan?: string;
    tautanAktivasi?: string;
    tautanDokumen?: string;
    catatanPemeriksa?: string;
    namaPemeriksa?: string;
    fallbackSubject: string;
    fallbackBody: string;
    actorId?: string;
    actorName?: string;
  }
): Promise<{ ok: boolean; campaignId: string; status: string }> {
  const email = input.toEmail.trim().toLowerCase();
  if (!isValidEmailAddress(email)) {
    return { ok: false, campaignId: '', status: 'invalid_email' };
  }
  const tpl = db
    .prepare('SELECT id, subject, body_text, body_html, is_active FROM email_templates WHERE code = ? LIMIT 1')
    .get(input.templateCode) as Record<string, unknown> | undefined;

  const useTpl = tpl && Number(tpl.is_active ?? 1) === 1;
  const subject = useTpl ? String(tpl.subject) : input.fallbackSubject;
  const bodyText = useTpl ? String(tpl.body_text) : input.fallbackBody;
  const bodyHtml = useTpl && tpl.body_html ? String(tpl.body_html) : null;

  const runtime = getEmailRuntimeStatus();
  const campaignId = crypto.randomUUID();
  const now = new Date().toISOString();
  const tanggalLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const recipient: ResolvedRecipient = {
    userId: input.userId || null,
    email,
    fullName: input.toName,
    jabatan: input.role || 'Pengguna SATU DPBI',
    role: input.role || 'Pengguna SATU DPBI',
    provinsi: input.provinsi || 'Nasional',
    kabupaten: input.kabupaten || '—',
    angkatan: input.angkatan || 'Angkatan Aktif',
    nomorAnggota: input.nomorAnggota || '—',
  };

  const vars = buildTemplateVars(recipient, campaignId, tanggalLabel, input);
  const subjectRendered = renderEmailTemplate(subject, vars);
  const bodyRendered = renderEmailTemplate(bodyText, vars);
  const htmlRendered = bodyHtml ? renderEmailTemplate(bodyHtml, vars, { htmlEscape: true }) : null;

  const dispatchRes = await dispatchSingleEmail(email, subjectRendered, bodyRendered, htmlRendered);
  const cmpStatus = dispatchRes.ok ? 'terkirim' : 'gagal';

  db.prepare(
    `INSERT INTO email_campaigns
     (id, title, template_id, subject, body_text, body_html, audience_filter_json, delivery_mode, status, total_recipients, sent_count, failed_count, queued_count, scheduled_at, sent_at, created_by, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, 0, NULL, ?, ?, ?, ?)`
  ).run(
    campaignId,
    `[Transaksional] ${subjectRendered.slice(0, 80)}`,
    useTpl ? String(tpl.id) : null,
    subject,
    bodyText,
    bodyHtml,
    JSON.stringify({ mode: 'transactional', templateCode: input.templateCode }),
    runtime.deliveryMode,
    cmpStatus,
    dispatchRes.ok ? 1 : 0,
    dispatchRes.ok ? 0 : 1,
    now,
    input.actorId || 'system',
    input.actorName || 'Sistem SATU DPBI',
    now
  );

  db.prepare(
    `INSERT INTO email_logs
     (id, campaign_id, recipient_user_id, recipient_email, recipient_name, subject_rendered, body_rendered, status, delivery_mode, delivery_channel, error_message, provider_message_id, sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'transactional', ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    campaignId,
    input.userId || null,
    email,
    input.toName,
    subjectRendered,
    redactSensitiveTokenInLog(bodyRendered),
    dispatchRes.status,
    dispatchRes.mode,
    dispatchRes.error || null,
    dispatchRes.messageId || null,
    dispatchRes.ok ? now : null,
    now
  );

  return { ok: dispatchRes.ok, campaignId, status: dispatchRes.status };
}

export async function retryCampaignFailedLogs(
  db: DatabaseSync,
  campaignId: string
): Promise<{ retried: number; succeeded: number; stillFailed: number }> {
  const failedLogs = db
    .prepare("SELECT * FROM email_logs WHERE campaign_id = ? AND status = 'gagal'")
    .all(campaignId) as Record<string, unknown>[];

  const { mailAttachments } = resolveEmailAttachmentsForOwner(db, 'campaign', campaignId);
  let succeeded = 0;
  let stillFailed = 0;

  for (const row of failedLogs) {
    const res = await dispatchSingleEmail(
      String(row.recipient_email),
      String(row.subject_rendered),
      String(row.body_rendered),
      null,
      mailAttachments
    );
    if (res.ok) {
      succeeded += 1;
      db.prepare(
        'UPDATE email_logs SET status = ?, delivery_mode = ?, error_message = NULL, provider_message_id = ?, sent_at = ? WHERE id = ?'
      ).run(res.status, res.mode, res.messageId || null, new Date().toISOString(), String(row.id));
    } else {
      stillFailed += 1;
      db.prepare('UPDATE email_logs SET error_message = ? WHERE id = ?').run(
        res.error || 'Pengiriman ulang gagal.',
        String(row.id)
      );
    }
  }

  const counts = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN ('terkirim', 'terantre_outbox') THEN 1 ELSE 0 END) AS sent_c,
         SUM(CASE WHEN status = 'gagal' THEN 1 ELSE 0 END) AS fail_c
       FROM email_logs WHERE campaign_id = ?`
    )
    .get(campaignId) as { sent_c: number | null; fail_c: number | null };

  const sentCount = Number(counts?.sent_c ?? 0);
  const failedCount = Number(counts?.fail_c ?? 0);
  const newStatus = failedCount > 0 && sentCount === 0 ? 'gagal' : failedCount > 0 ? 'sebagian_gagal' : 'terkirim';
  db.prepare('UPDATE email_campaigns SET sent_count = ?, failed_count = ?, status = ? WHERE id = ?').run(
    sentCount,
    failedCount,
    newStatus,
    campaignId
  );

  return { retried: failedLogs.length, succeeded, stillFailed };
}

export function exportCampaignLogsCsv(db: DatabaseSync, campaignId?: string): string {
  const rows = (campaignId
    ? db
        .prepare(
          `SELECT l.id, c.title AS campaign_title, l.recipient_email, l.recipient_name, l.subject_rendered,
                  l.status, l.delivery_mode, l.provider_message_id, l.error_message, l.sent_at, l.created_at
           FROM email_logs l
           LEFT JOIN email_campaigns c ON c.id = l.campaign_id
           WHERE l.campaign_id = ?
           ORDER BY l.created_at DESC`
        )
        .all(campaignId)
    : db
        .prepare(
          `SELECT l.id, c.title AS campaign_title, l.recipient_email, l.recipient_name, l.subject_rendered,
                  l.status, l.delivery_mode, l.provider_message_id, l.error_message, l.sent_at, l.created_at
           FROM email_logs l
           LEFT JOIN email_campaigns c ON c.id = l.campaign_id
           ORDER BY l.created_at DESC LIMIT 1000`
        )
        .all()) as Record<string, unknown>[];

  const header = [
    'ID Log',
    'Kampanye',
    'Email Penerima',
    'Nama Penerima',
    'Subjek',
    'Status',
    'Mode Pengiriman',
    'Referensi Provider',
    'Catatan Error',
    'Waktu Kirim',
  ]
    .map(csvSafeCell)
    .join(',');

  const lines = rows.map((r) =>
    [
      r.id,
      r.campaign_title || '—',
      r.recipient_email,
      r.recipient_name,
      r.subject_rendered,
      r.status,
      r.delivery_mode,
      r.provider_message_id || '',
      r.error_message || '',
      r.sent_at || r.created_at,
    ]
      .map(csvSafeCell)
      .join(',')
  );

  return [header, ...lines].join('\n');
}
