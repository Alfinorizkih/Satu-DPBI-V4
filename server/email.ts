import crypto from 'node:crypto';
import nodemailer from 'nodemailer';
import type { DatabaseSync } from 'node:sqlite';
import { PROVINCE_BY_CODE } from '../src/lib/provinces';
import { csvSafeCell, renderEmailTemplate, ROLE_LABELS, validateEmailTemplatePlaceholders } from '../src/lib/rbac';
import type { RoleCode } from '../src/lib/types';

export interface AudienceFilter {
  mode?: 'single' | 'bulk';
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
  provinsi: string;
  angkatan: string;
}

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

export function resolveEmailAudience(db: DatabaseSync, filter: AudienceFilter): {
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
      conds.push('LOWER(COALESCE(u.bidang, \'\')) = LOWER(?)');
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
        `SELECT u.id, u.email, u.full_name, u.role, u.province_code, u.batch_id, b.name AS batch_name
         FROM users u
         LEFT JOIN batches b ON b.id = u.batch_id
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
        provinsi: provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : 'Nasional',
        angkatan: r.batch_name ? String(r.batch_name) : 'Nasional',
      });
    }
  }

  for (const raw of filter.manualEmails ?? []) {
    const email = raw.trim().toLowerCase();
    if (!isValidEmailAddress(email) || byEmail.has(email)) continue;
    const existing = db
      .prepare(
        `SELECT u.id, u.full_name, u.role, u.province_code, b.name AS batch_name
         FROM users u
         LEFT JOIN batches b ON b.id = u.batch_id
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
        provinsi: provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : 'Nasional',
        angkatan: existing.batch_name ? String(existing.batch_name) : 'Nasional',
      });
    } else {
      byEmail.set(email, {
        userId: null,
        email,
        fullName: email.split('@')[0],
        jabatan: 'Penerima Eksternal / Undangan',
        provinsi: 'Nasional',
        angkatan: '—',
      });
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

async function dispatchSingleEmail(
  recipientEmail: string,
  subject: string,
  bodyText: string
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

export async function executeEmailCampaign(
  db: DatabaseSync,
  input: {
    title: string;
    templateId?: string | null;
    subject: string;
    bodyText: string;
    audienceFilter: AudienceFilter;
    recipients: ResolvedRecipient[];
    actionMode: 'send_now' | 'save_draft' | 'schedule' | 'test_self';
    scheduledAt?: string | null;
    createdBy: string;
    createdByName: string;
    referenceCode?: string;
  }
): Promise<{
  campaignId: string;
  deliveryMode: 'smtp_live' | 'sandbox_outbox';
  status: string;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
}> {
  const subCheck = validateEmailTemplatePlaceholders(input.subject);
  const bodyCheck = validateEmailTemplatePlaceholders(input.bodyText);
  if (!subCheck.valid || !bodyCheck.valid) {
    const bad = [...subCheck.invalidVariables, ...bodyCheck.invalidVariables];
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

  if (input.actionMode === 'save_draft' || input.actionMode === 'schedule') {
    const status = input.actionMode === 'schedule' ? 'terjadwal' : 'draft';
    db.prepare(
      `INSERT INTO email_campaigns
       (id, title, template_id, subject, body_text, audience_filter_json, delivery_mode, status, total_recipients, sent_count, failed_count, scheduled_at, sent_at, created_by, created_by_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, ?, ?, ?)`
    ).run(
      campaignId,
      input.title,
      input.templateId || null,
      input.subject,
      input.bodyText,
      JSON.stringify(input.audienceFilter),
      runtime.deliveryMode,
      status,
      input.recipients.length,
      input.scheduledAt || null,
      input.createdBy,
      input.createdByName,
      now
    );

    return {
      campaignId,
      deliveryMode: runtime.deliveryMode,
      status,
      totalRecipients: input.recipients.length,
      sentCount: 0,
      failedCount: 0,
    };
  }

  let sentCount = 0;
  let failedCount = 0;

  db.prepare(
    `INSERT INTO email_campaigns
     (id, title, template_id, subject, body_text, audience_filter_json, delivery_mode, status, total_recipients, sent_count, failed_count, scheduled_at, sent_at, created_by, created_by_name, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'terkirim', ?, 0, 0, NULL, ?, ?, ?, ?)`
  ).run(
    campaignId,
    input.title,
    input.templateId || null,
    input.subject,
    input.bodyText,
    JSON.stringify(input.audienceFilter),
    runtime.deliveryMode,
    input.recipients.length,
    now,
    input.createdBy,
    input.createdByName,
    now
  );

  const logStmt = db.prepare(
    `INSERT INTO email_logs
     (id, campaign_id, recipient_user_id, recipient_email, recipient_name, subject_rendered, body_rendered, status, delivery_mode, error_message, provider_message_id, sent_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );

  for (const r of input.recipients) {
    const vars: Record<string, string> = {
      nama: r.fullName,
      email: r.email,
      jabatan: r.jabatan,
      provinsi: r.provinsi,
      angkatan: r.angkatan,
      tanggal: tanggalLabel,
      referensi: input.referenceCode || campaignId.slice(0, 8).toUpperCase(),
    };
    const subjectRendered = renderEmailTemplate(input.subject, vars);
    const bodyRendered = renderEmailTemplate(input.bodyText, vars);
    const result = await dispatchSingleEmail(r.email, subjectRendered, bodyRendered);

    if (result.ok) sentCount += 1;
    else failedCount += 1;

    logStmt.run(
      crypto.randomUUID(),
      campaignId,
      r.userId,
      r.email,
      r.fullName,
      subjectRendered,
      bodyRendered,
      result.status,
      result.mode,
      result.error || null,
      result.messageId || null,
      result.ok ? new Date().toISOString() : null,
      now
    );
  }

  const finalStatus =
    failedCount > 0 && sentCount > 0
      ? 'sebagian_gagal'
      : failedCount > 0 && sentCount === 0
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
  };
}

export async function retryCampaignFailedLogs(
  db: DatabaseSync,
  campaignId: string
): Promise<{ retried: number; succeeded: number; stillFailed: number }> {
  const failedLogs = db
    .prepare("SELECT * FROM email_logs WHERE campaign_id = ? AND status = 'gagal'")
    .all(campaignId) as Record<string, unknown>[];

  let succeeded = 0;
  let stillFailed = 0;

  for (const row of failedLogs) {
    const res = await dispatchSingleEmail(
      String(row.recipient_email),
      String(row.subject_rendered),
      String(row.body_rendered)
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
  const newStatus = failedCount > 0 ? 'sebagian_gagal' : 'terkirim';
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
