import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cookieParser from 'cookie-parser';

const TEMP_DATA_ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'satu-dpbi-test-'));
process.env.DEMO_MODE = 'true';
process.env.NODE_ENV = 'test';
process.env.SATU_DPBI_DATA_ROOT = TEMP_DATA_ROOT;

const { getDb, resetDbConnection } = await import('./db');
const { ensureSeeded } = await import('./seed');
const { registerCoreRoutes } = await import('./routes');
const { registerModuleRoutes } = await import('./routes_modules');
const { registerWorkflowAndEmailRoutes } = await import('./routes_workflow_email');
const { registerProgramAndCorrespondenceRoutes } = await import('./routes_programs_correspondence');
const { registerAddendumRoutes } = await import('./routes_addendum');
const { requireNotInMaintenance, requireSafeOrigin } = await import('./security');

let server: http.Server;
let baseUrl = '';

async function requestApi(
  urlPath: string,
  options: {
    method?: string;
    cookie?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): Promise<{
  status: number;
  json: Record<string, unknown> | null;
  text: string;
  setCookie: string | null;
}> {
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };
  if (options.cookie) {
    headers.cookie = options.cookie;
  }
  let bodyStr: string | undefined;
  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    bodyStr = JSON.stringify(options.body);
  }
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method: options.method || 'GET',
    headers,
    body: bodyStr,
  });
  const text = await res.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    json = null;
  }
  const setCookieHeader = res.headers.get('set-cookie');
  const cookiePair = setCookieHeader ? setCookieHeader.split(';')[0] : null;
  return { status: res.status, json, text, setCookie: cookiePair };
}

async function loginAs(email: string, password = 'Simulasi2026!'): Promise<string> {
  const res = await requestApi('/api/auth/login', {
    method: 'POST',
    body: { email, password },
  });
  assert.equal(res.status, 200, `Login failed for ${email}: ${res.text}`);
  assert.ok(res.setCookie, `Expected session cookie for ${email}`);
  return res.setCookie!;
}

before(async () => {
  const db = getDb();
  ensureSeeded(db);

  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());
  app.use('/api', requireSafeOrigin);
  app.use('/api', requireNotInMaintenance);
  registerCoreRoutes(app);
  registerModuleRoutes(app);
  registerWorkflowAndEmailRoutes(app);
  registerProgramAndCorrespondenceRoutes(app);
  registerAddendumRoutes(app);

  await new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        baseUrl = `http://127.0.0.1:${addr.port}`;
      }
      resolve();
    });
  });
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  resetDbConnection();
  fs.rmSync(TEMP_DATA_ROOT, { recursive: true, force: true });
});

test('Auth, session policy bounds (<= 24h), admin session inspection/revocation, and login failure lockout', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');
  const dutaCookie = await loginAs('duta.jabar@simulasi.dpbi.or.id');

  // Verify Duta session works
  const meDuta = await requestApi('/api/auth/me', { cookie: dutaCookie });
  assert.equal(meDuta.status, 200);

  // Reject session_ttl_hours > 24
  const badTtl = await requestApi('/api/system/settings', {
    method: 'PATCH',
    cookie: superCookie,
    body: { settings: { session_ttl_hours: '48' } },
  });
  assert.equal(badTtl.status, 422);

  // Accept valid session_ttl_hours <= 24
  const okTtl = await requestApi('/api/system/settings', {
    method: 'PATCH',
    cookie: superCookie,
    body: { settings: { session_ttl_hours: '12' } },
  });
  assert.equal(okTtl.status, 200);

  // Super Admin inspects active sessions for usr-duta-jabar
  const listSess = await requestApi('/api/settings/users/usr-duta-jabar/sessions', {
    cookie: superCookie,
  });
  assert.equal(listSess.status, 200);
  const sessionsArr = listSess.json?.sessions as unknown[];
  assert.ok(Array.isArray(sessionsArr) && sessionsArr.length >= 1);

  // Super Admin revokes all active sessions of usr-duta-jabar
  const revokeSess = await requestApi('/api/settings/users/usr-duta-jabar/sessions', {
    method: 'DELETE',
    cookie: superCookie,
  });
  assert.equal(revokeSess.status, 200);
  assert.ok(Number(revokeSess.json?.revokedCount || 0) >= 1);

  // Old Duta token is immediately rejected (419 session revoked)
  const afterRevoke = await requestApi('/api/auth/me', { cookie: dutaCookie });
  assert.equal(afterRevoke.status, 419);

  // Audit log records ADMIN_REVOKE_USER_SESSIONS
  const db = getDb();
  const auditRevoke = db
    .prepare("SELECT action, target_id FROM audit_logs WHERE action = 'ADMIN_REVOKE_USER_SESSIONS' AND target_id = 'usr-duta-jabar'")
    .get() as { action: string; target_id: string } | undefined;
  assert.equal(auditRevoke?.action, 'ADMIN_REVOKE_USER_SESSIONS');

  // Wrong password attempts log LOGIN_FAILED and trigger 429 throttle on 6th attempt
  const throttleEmail = 'duta.jateng@simulasi.dpbi.or.id';
  for (let i = 0; i < 5; i += 1) {
    const fail = await requestApi('/api/auth/login', {
      method: 'POST',
      body: { email: throttleEmail, password: 'WrongPassword123!' },
    });
    assert.equal(fail.status, 401);
  }
  const locked = await requestApi('/api/auth/login', {
    method: 'POST',
    body: { email: throttleEmail, password: 'WrongPassword123!' },
  });
  assert.equal(locked.status, 429);

  const loginFailedAudit = db
    .prepare("SELECT COUNT(*) AS c FROM audit_logs WHERE action = 'LOGIN_FAILED' AND target_id = ?")
    .get(throttleEmail) as { c: number };
  assert.ok(loginFailedAudit.c >= 5);
});

test('IDOR & RBAC enforce user and province boundaries strictly', async () => {
  const dutaJabarCookie = await loginAs('duta.jabar@simulasi.dpbi.or.id');
  const korwilJabarCookie = await loginAs('korwil.jabar@simulasi.dpbi.or.id');
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');

  // Duta Jabar cannot view foreign proposal versions (prop-2 belongs to Duta Jateng)
  const foreignVersions = await requestApi('/api/proposals/prop-2/versions', { cookie: dutaJabarCookie });
  assert.equal(foreignVersions.status, 403);

  // Duta Jabar cannot revise foreign proposal (prop-3 is perlu_revisi owned by Bali)
  const foreignRevise = await requestApi('/api/proposals/prop-3/revise', {
    method: 'POST',
    cookie: dutaJabarCookie,
    body: { changeNote: 'Percobaan IDOR' },
  });
  assert.equal(foreignRevise.status, 403);

  // Duta Jabar cannot access a private document restricted to koordinator_ke_atas
  const db = getDb();
  const restrictedFileId = 'file-korwil-only-test';
  db.prepare(
    `INSERT INTO stored_files (id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, module, uploaded_by, is_archived, created_at)
     VALUES (?, 'rahasia-korwil.pdf', 'rahasia-korwil.pdf', 'application/pdf', 128, 'abc123', 'dokumen', 'usr-super', 0, ?)`
  ).run(restrictedFileId, new Date().toISOString());
  db.prepare(
    `INSERT INTO documents (id, document_number, title, category, owner_name, issuer_name, issued_date, status, version, access_level, file_id, file_name, file_size_bytes, notes, created_at)
     VALUES ('doc-korwil-only', 'DPBI/DOC/2026/9099', 'Panduan Internal Korwil', 'SOP', 'Pusat', 'Super Admin', '2026-11-01', 'berlaku', '1.0', 'koordinator_ke_atas', ?, 'rahasia-korwil.pdf', 128, '', ?)`
  ).run(restrictedFileId, new Date().toISOString());

  const foreignFile = await requestApi(`/api/files/${restrictedFileId}`, { cookie: dutaJabarCookie });
  assert.equal(foreignFile.status, 403);

  // Duta Jabar cannot update foreign task (tgs-3 assigned to usr-pengurus in province 51)
  const foreignTask = await requestApi('/api/tasks/tgs-3', {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { status: 'selesai' },
  });
  assert.equal(foreignTask.status, 403);

  // Duta Jabar cannot access export bundle (lacks arsip:export), Email Center, or Approval Center
  const expBundle = await requestApi('/api/export/bundle?scope=proposals', { cookie: dutaJabarCookie });
  assert.equal(expBundle.status, 403);

  const emailView = await requestApi('/api/email/overview', { cookie: dutaJabarCookie });
  assert.equal(emailView.status, 403);

  const approvalView = await requestApi('/api/approval-center', { cookie: dutaJabarCookie });
  assert.equal(approvalView.status, 403);

  // Korwil Jabar ('32') receives 403 on cross-province actions (Jateng '33' & Bali '51')
  const crossPropEdit = await requestApi('/api/proposals/prop-2', {
    method: 'PATCH',
    cookie: korwilJabarCookie,
    body: { title: 'Edit Lintas Provinsi' },
  });
  assert.equal(crossPropEdit.status, 403);

  const crossPropDecide = await requestApi('/api/proposals/prop-2/decide', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { decision: 'perlu_revisi', note: 'Coba lintas wilayah' },
  });
  assert.equal(crossPropDecide.status, 403);

  const crossLklReview = await requestApi('/api/lkl/lkl-2/review', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { decision: 'diterima', note: 'Coba review Jateng' },
  });
  assert.equal(crossLklReview.status, 403);

  const crossPersVerify = await requestApi('/api/personnel/pers-9/verify', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { status: 'perlu_perbaikan', note: 'Coba verifikasi Jateng' },
  });
  assert.equal(crossPersVerify.status, 403);

  // Cross-province location exception decide blocked
  const exRes = await requestApi('/api/location/exceptions', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { provinceCode: '51', reason: 'Perjalanan dinas ke Bali', validUntil: '2026-12-31' },
  });
  assert.equal(exRes.status, 201);
  const exId = String(exRes.json?.id);

  // Grant temporary wilayah:manage to Korwil Jabar and verify Korwil STILL cannot decide Bali ('51') exception
  await requestApi('/api/organization/delegations', {
    method: 'POST',
    cookie: superCookie,
    body: {
      delegateUserId: 'usr-korwil-jabar',
      module: 'wilayah',
      action: 'manage',
      provinceCode: '32',
      startsAt: '2026-01-01T00:00:00Z',
      endsAt: '2027-12-31T23:59:59Z',
      reason: 'Mandat khusus wilayah Jabar',
    },
  });
  const crossLocEx = await requestApi(`/api/location/exceptions/${exId}/decide`, {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { decision: 'disetujui' },
  });
  assert.equal(crossLocEx.status, 403);

  // Delegation creation validation: startsAt >= endsAt rejected with 422
  const invalidDel = await requestApi('/api/organization/delegations', {
    method: 'POST',
    cookie: superCookie,
    body: {
      delegateUserId: 'usr-wakil',
      module: 'proposal',
      action: 'review',
      startsAt: '2026-12-10T00:00:00Z',
      endsAt: '2026-12-01T00:00:00Z',
      reason: 'Rentang tanggal terbalik',
    },
  });
  assert.equal(invalidDel.status, 422);
});

test('End-to-end connected workflow: Duplicate check -> Proposal Approval -> Calendar & 4 Tasks -> LKL Revision & Approval -> Coordinator Revise -> Approval Center Invite -> Analytics', async () => {
  const dutaJabarCookie = await loginAs('duta.jabar@simulasi.dpbi.or.id');
  const korwilJabarCookie = await loginAs('korwil.jabar@simulasi.dpbi.or.id');
  const pengurusCookie = await loginAs('pengurus.budaya@simulasi.dpbi.or.id');
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');

  // 1. Duta creates a Proposal in Jabar ('32')
  const createProp = await requestApi('/api/proposals', {
    method: 'POST',
    cookie: dutaJabarCookie,
    body: {
      title: 'Festival Aksara Sunda Pelajar Terpadu',
      bidang: 'Kebudayaan',
      category: 'Lokakarya / Literasi Pelajar',
      riskLevel: 'sedang',
      usesDpbiIdentity: true,
      externalPermitNeeded: false,
      objective: 'Menguatkan literasi aksara Sunda pelajar Bogor dan Bandung.',
      targetAudience: 'Pelajar SMA/SMK Jawa Barat',
      eventDate: '2026-12-15',
      eventTime: '09:00 WIB',
      location: 'Aula Dinas Pendidikan Kota Bandung',
      estimatedParticipants: 90,
      activityMode: 'luring',
    },
  });
  assert.equal(createProp.status, 201);
  const propId = String(createProp.json?.id);

  // 2. Duplicate check detects matching title/date
  const dupCheck = await requestApi(
    `/api/proposals/check-duplicate?title=${encodeURIComponent('Festival Aksara Sunda')}&eventDate=2026-12-15&provinceCode=32`,
    { cookie: dutaJabarCookie }
  );
  assert.equal(dupCheck.status, 200);
  const dups = (dupCheck.json?.duplicates as { id: string }[]) || [];
  assert.ok(dups.some((d) => d.id === propId));

  // 3. Pengurus Nasional approves the Proposal -> creates 1 Calendar event + 4 Checklist Tasks
  const approveProp = await requestApi(`/api/proposals/${propId}/decide`, {
    method: 'POST',
    cookie: pengurusCookie,
    body: { decision: 'disetujui', note: 'Disetujui untuk pelaksanaan resmi wilayah Jawa Barat.' },
  });
  assert.equal(approveProp.status, 200);
  const workflowEffects = approveProp.json?.workflowEffects as { eventId: string; createdTaskIds: string[] };
  assert.ok(workflowEffects?.eventId);
  assert.equal(workflowEffects.createdTaskIds.length, 4);

  const db = getDb();
  const calEventBefore = db
    .prepare('SELECT id, start_at, location FROM calendar_events WHERE proposal_id = ?')
    .get(propId) as { id: string; start_at: string; location: string } | undefined;
  assert.ok(calEventBefore);
  assert.equal(calEventBefore.location, 'Aula Dinas Pendidikan Kota Bandung');

  // 4. Patch proposal date/location (by Koordinator Wilayah 32 with proposal:edit) syncs Calendar event automatically
  const patchProp = await requestApi(`/api/proposals/${propId}`, {
    method: 'PATCH',
    cookie: korwilJabarCookie,
    body: {
      eventDate: '2026-12-18',
      location: 'Gedung Sate Aula Barat Bandung',
    },
  });
  assert.equal(patchProp.status, 200);
  const calEventAfter = db
    .prepare('SELECT start_at, location FROM calendar_events WHERE proposal_id = ?')
    .get(propId) as { start_at: string; location: string };
  assert.ok(calEventAfter.start_at.startsWith('2026-12-18'));
  assert.equal(calEventAfter.location, 'Gedung Sate Aula Barat Bandung');

  // 5. Submitting LKL linked to non-approved proposal (prop-2 is pending) must fail with 422
  const badLkl = await requestApi('/api/lkl', {
    method: 'POST',
    cookie: superCookie,
    body: {
      activityName: 'Uji LKL Proposal Belum Disetujui',
      proposalId: 'prop-2',
      eventDate: '2026-12-06',
      summary: 'Tidak boleh lolos sebelum proposal disetujui.',
    },
  });
  assert.equal(badLkl.status, 422);

  // 6. Duta submits LKL linked to approved proposal -> Korwil sends perlu_revisi -> Duta revises -> Korwil approves -> linked dokumentasi/pelaporan Tasks become selesai
  const createLkl = await requestApi('/api/lkl', {
    method: 'POST',
    cookie: dutaJabarCookie,
    body: {
      activityName: 'Laporan Pelaksanaan Festival Aksara Sunda',
      proposalId: propId,
      provinceCode: '32',
      regency: 'Kota Bandung',
      venueName: 'Gedung Sate Aula Barat Bandung',
      eventDate: '2026-12-18',
      category: 'Lokakarya / Literasi Pelajar',
      activityMode: 'luring',
      participantCount: 94,
      summary: 'Kegiatan berlangsung tertib dengan 94 pelajar hadir.',
      outcomes: 'Terbentuk 3 sanggar aksara pelajar.',
    },
  });
  assert.equal(createLkl.status, 201);
  const lklId = String(createLkl.json?.id);

  const reqReviseLkl = await requestApi(`/api/lkl/${lklId}/review`, {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { decision: 'perlu_revisi', note: 'Mohon tambahkan rincian tindak lanjut pascakegiatan.' },
  });
  assert.equal(reqReviseLkl.status, 200);

  const reviseLkl = await requestApi(`/api/lkl/${lklId}/revise`, {
    method: 'POST',
    cookie: dutaJabarCookie,
    body: {
      summary: 'Kegiatan berlangsung tertib dengan 94 pelajar hadir dan 2 pendamping dewasa.',
      followUp: 'Pendampingan lanjutan daring 2 minggu pascakegiatan.',
      participantCount: 95,
    },
  });
  assert.equal(reviseLkl.status, 200);
  assert.equal(reviseLkl.json?.version, 2);

  const approveLkl = await requestApi(`/api/lkl/${lklId}/review`, {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { decision: 'diterima', note: 'Revisi lengkap dan diterima.' },
  });
  assert.equal(approveLkl.status, 200);

  const completedTasks = db
    .prepare("SELECT category, status, lkl_id FROM tasks WHERE proposal_id = ? AND category IN ('dokumentasi', 'pelaporan')")
    .all(propId) as { category: string; status: string; lkl_id: string | null }[];
  assert.equal(completedTasks.length, 2);
  for (const t of completedTasks) {
    assert.equal(t.status, 'selesai');
    assert.equal(t.lkl_id, lklId);
  }

  // 7. Coordinator report perlu_revisi -> Korwil revises via /api/coordinator-reports/:id/revise
  const createCoord = await requestApi('/api/coordinator-reports', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: {
      reportType: 'bulanan',
      provinceCode: '32',
      periodLabel: 'November 2026',
      personnelCondition: 'Semua Duta aktif dan sehat.',
      activitiesSummary: 'Rekapitulasi awal kegiatan November.',
    },
  });
  assert.equal(createCoord.status, 201);
  const coordId = String(createCoord.json?.id);

  const returnCoord = await requestApi(`/api/coordinator-reports/${coordId}/review`, {
    method: 'POST',
    cookie: superCookie,
    body: { decision: 'perlu_revisi', note: 'Lengkapi rencana tindak lanjut Desember.' },
  });
  assert.equal(returnCoord.status, 200);

  const reviseCoord = await requestApi(`/api/coordinator-reports/${coordId}/revise`, {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: {
      activitiesSummary: 'Rekapitulasi lengkap 5 kegiatan pelajar Jawa Barat bulan November.',
      followUpPlan: 'Finalisasi evaluasi kinerja Duta sebelum 20 Desember.',
    },
  });
  assert.equal(reviseCoord.status, 200);
  assert.equal(reviseCoord.json?.version, 2);

  // 8. Approval Center approving account_request creates usable 72h one-time invite token
  const approveAccReq = await requestApi('/api/approval-center/account_request/req-1/action', {
    method: 'POST',
    cookie: superCookie,
    body: { action: 'approve', reason: 'Disetujui melalui Pusat Persetujuan Terpadu' },
  });
  assert.equal(approveAccReq.status, 200);
  const inviteToken = String(approveAccReq.json?.inviteToken || '');
  assert.ok(inviteToken.length >= 32);

  const acceptInvite = await requestApi('/api/auth/accept-invitation', {
    method: 'POST',
    body: { token: inviteToken, password: 'AktivasiDuta2026!' },
  });
  assert.equal(acceptInvite.status, 200);

  // 9. Dashboard time window analytics respects days=7|30|90
  for (const days of [7, 30, 90] as const) {
    const dash = await requestApi(`/api/dashboard?days=${days}`, { cookie: superCookie });
    assert.equal(dash.status, 200);
    const analytics = dash.json?.analytics as Record<string, unknown>;
    assert.equal(analytics?.daysWindow, days);
    assert.ok(Number(analytics?.approvedProposalsInWindow || 0) >= 1);
    assert.ok(Array.isArray(analytics?.contributionBadges));
  }
});

test('Email Center: deduplicated audience preview, placeholder validation, sandbox_outbox send, schedule cancel, retry, and CSV formula protection', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');
  const pengurusCookie = await loginAs('pengurus.budaya@simulasi.dpbi.or.id'); // email: ['view', 'create'] (no publish)

  // 1. Audience preview deduplicates overlapping user + manual email
  const preview = await requestApi('/api/email/audience-preview', {
    method: 'POST',
    cookie: superCookie,
    body: {
      filter: {
        mode: 'bulk',
        roles: ['koordinator_wilayah'],
        provinceCode: '32',
        manualEmails: ['KORWIL.JABAR@simulasi.dpbi.or.id', 'tamu.eksternal@dpbi.or.id'],
      },
    },
  });
  assert.equal(preview.status, 200);
  assert.equal(preview.json?.selectedCount, 2);

  // 2. Invalid placeholder rejected on template creation & email send
  const badTpl = await requestApi('/api/email/templates', {
    method: 'POST',
    cookie: superCookie,
    body: {
      name: 'Templat Tidak Valid',
      subject: 'Uji {{nama}}',
      bodyText: 'Rahasia {{secret_key}}',
    },
  });
  assert.equal(badTpl.status, 400);

  const badSend = await requestApi('/api/email/send', {
    method: 'POST',
    cookie: superCookie,
    body: {
      actionMode: 'test_self',
      subject: 'Subjek {{unclosed',
      bodyText: 'Halo {{nama}}',
    },
  });
  assert.equal(badSend.status, 400);

  // 3. Pengurus without email:publish cannot bulk send immediately (403)
  const deniedBulk = await requestApi('/api/email/send', {
    method: 'POST',
    cookie: pengurusCookie,
    body: {
      actionMode: 'send_now',
      title: 'Coba Massal Tanpa Publish',
      subject: 'Info {{nama}}',
      bodyText: 'Pesan untuk {{nama}} di {{provinsi}}',
      audienceFilter: {
        mode: 'bulk',
        manualEmails: ['a@dpbi.or.id', 'b@dpbi.or.id'],
      },
    },
  });
  assert.equal(deniedBulk.status, 403);

  // 4. Super Admin sends bulk email in honest sandbox_outbox mode (with CSV formula payload in title to test escaping)
  const sendBulk = await requestApi('/api/email/send', {
    method: 'POST',
    cookie: superCookie,
    body: {
      actionMode: 'send_now',
      title: '=SUM(1,2) Pengumuman Koordinasi',
      subject: 'Undangan {{jabatan}} - {{provinsi}}',
      bodyText: 'Yth. {{nama}}, silakan pantau agenda wilayah {{provinsi}}.',
      audienceFilter: {
        mode: 'bulk',
        roles: ['koordinator_wilayah'],
        manualEmails: ['+62811@dpbi.or.id'],
      },
    },
  });
  assert.equal(sendBulk.status, 201);
  assert.equal(sendBulk.json?.deliveryMode, 'sandbox_outbox');
  assert.equal(sendBulk.json?.status, 'terkirim');
  const sentCampaignId = String(sendBulk.json?.campaignId);

  // Cannot cancel already-sent campaign (409)
  const cancelSent = await requestApi(`/api/email/campaigns/${sentCampaignId}/cancel`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(cancelSent.status, 409);

  // 5. Scheduled campaign can be cancelled cleanly
  const schedRes = await requestApi('/api/email/send', {
    method: 'POST',
    cookie: superCookie,
    body: {
      actionMode: 'schedule',
      scheduledAt: '2026-12-20T09:00',
      title: 'Jadwal Pengingat Akhir Tahun',
      subject: 'Pengingat {{nama}}',
      bodyText: 'Halo {{nama}}, mohon siapkan laporan akhir.',
      audienceFilter: { mode: 'single', roles: ['koordinator_wilayah'], provinceCode: '32' },
    },
  });
  assert.equal(schedRes.status, 201);
  assert.equal(schedRes.json?.status, 'terjadwal');
  const schedId = String(schedRes.json?.campaignId);

  const cancelSched = await requestApi(`/api/email/campaigns/${schedId}/cancel`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(cancelSched.status, 200);

  // 6. Failed email log can be retried cleanly in sandbox_outbox mode
  const db = getDb();
  const failedLogId = 'elog-retry-test';
  db.prepare(
    `INSERT INTO email_logs (id, campaign_id, recipient_user_id, recipient_email, recipient_name, subject_rendered, body_rendered, status, delivery_mode, error_message, created_at)
     VALUES (?, ?, NULL, 'ulang@dpbi.or.id', 'Penerima Ulang', 'Subjek Ulang', 'Isi Ulang', 'gagal', 'smtp_live', 'SMTP timeout', ?)`
  ).run(failedLogId, sentCampaignId, new Date().toISOString());

  const retryRes = await requestApi(`/api/email/campaigns/${sentCampaignId}/retry`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(retryRes.status, 200);
  assert.equal(retryRes.json?.retried, 1);
  assert.equal(retryRes.json?.succeeded, 1);

  // 7. CSV logs export escapes formula prefixes safely
  const csvRes = await requestApi(`/api/email/logs/export?campaignId=${sentCampaignId}`, {
    cookie: superCookie,
  });
  assert.equal(csvRes.status, 200);
  assert.ok(csvRes.text.includes("'=SUM(1,2)"), 'Expected formula prefix in campaign title to be escaped');
});

test('v4.1.0 & v4.2.0 Email Center: 50 seeded templates, active toggle, version history, HTML send, queue pause/resume, and CSV recipient parser', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');

  const overview = await requestApi('/api/email/overview', { cookie: superCookie });
  assert.equal(overview.status, 200);
  const templates = overview.json?.templates as { id: string; version: number; subject: string; bodyText: string }[];
  assert.ok(Array.isArray(templates) && templates.length >= 50, `Expected >= 50 templates, got ${templates?.length}`);

  const targetTpl = templates[0];
  const toggleOff = await requestApi(`/api/email/templates/${targetTpl.id}/status`, {
    method: 'PATCH',
    cookie: superCookie,
    body: { isActive: false },
  });
  assert.equal(toggleOff.status, 200);
  assert.equal(toggleOff.json?.isActive, false);

  const toggleOn = await requestApi(`/api/email/templates/${targetTpl.id}/status`, {
    method: 'PATCH',
    cookie: superCookie,
    body: { isActive: true },
  });
  assert.equal(toggleOn.status, 200);
  assert.equal(toggleOn.json?.isActive, true);
  const updateTpl = await requestApi(`/api/email/templates/${targetTpl.id}`, {
    method: 'PUT',
    cookie: superCookie,
    body: {
      subject: `${targetTpl.subject} [v2]`,
      bodyText: `${targetTpl.bodyText}\nReferensi: {{referensi}}`,
      bodyHtml: '<p>Halo <strong>{{nama}}</strong>, nomor {{nomor_surat}}</p>',
    },
  });
  assert.equal(updateTpl.status, 200);
  assert.equal(updateTpl.json?.version, targetTpl.version + 1);

  const histRes = await requestApi(`/api/email/templates/${targetTpl.id}/history`, { cookie: superCookie });
  assert.equal(histRes.status, 200);
  const history = histRes.json?.history as unknown[];
  assert.ok(Array.isArray(history) && history.length >= 1);

  const parseCsv = await requestApi('/api/email/parse-csv', {
    method: 'POST',
    cookie: superCookie,
    body: {
      csvText: 'email\nbudi.calon@dpbi.or.id\ninvalid-email\nsari.duta@dpbi.or.id,budi.calon@dpbi.or.id',
    },
  });
  assert.equal(parseCsv.status, 200);
  assert.equal(parseCsv.json?.totalValid, 2);
  assert.equal(parseCsv.json?.ignoredCount, 1);

  const htmlSend = await requestApi('/api/email/send', {
    method: 'POST',
    cookie: superCookie,
    body: {
      actionMode: 'test_self',
      title: 'Uji Templat HTML',
      subject: 'Uji HTML {{nama}}',
      bodyText: 'Halo {{nama}}',
      bodyHtml: '<p>Halo <strong>{{nama}}</strong></p>',
    },
  });
  assert.equal(htmlSend.status, 201);
});

test('v4.1.0 Personnel Import + duplicate rejection + batch rollback, Invitation Lifecycle, and 3 User Link Modes', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');

  // 1. Bulk CSV import with duplicate NISN / email detection
  const importRes = await requestApi('/api/personnel/import', {
    method: 'POST',
    cookie: superCookie,
    body: {
      fileName: 'uji-impor-v41.csv',
      rows: [
        { fullName: 'Tari Nusantara', email: 'tari.baru@dpbi.or.id', provinceCode: '32', nisn: '9900112233', schoolName: 'SMAN 5 Bandung' },
        { fullName: 'Duplikat Email', email: 'tari.baru@dpbi.or.id', provinceCode: '32', nisn: '9900112244' },
        { fullName: 'Duplikat NISN', email: 'lain.baru@dpbi.or.id', provinceCode: '32', nisn: '9900112233' },
        { fullName: 'Dian Pertiwi', email: 'dian.pertiwi@dpbi.or.id', provinceCode: '33', nisn: '9900112255', schoolName: 'SMAN 1 Semarang' },
      ],
    },
  });
  assert.equal(importRes.status, 200);
  assert.equal(importRes.json?.inserted, 2);
  const skipped = importRes.json?.skipped as unknown[];
  assert.equal(skipped.length, 2);
  const batchId = String(importRes.json?.batchId);

  // Link Tari to a user account via link_existing so rollback retains Tari and deletes Dian
  const db = getDb();
  const tariRow = db.prepare("SELECT id FROM personnel WHERE email = 'tari.baru@dpbi.or.id'").get() as { id: string };
  assert.ok(tariRow?.id);

  const linkUser = await requestApi('/api/settings/users', {
    method: 'POST',
    cookie: superCookie,
    body: {
      linkMode: 'link_existing',
      personnelId: tariRow.id,
      email: 'tari.akun@dpbi.or.id',
      password: 'PasswordTari2026!',
      role: 'duta',
    },
  });
  assert.equal(linkUser.status, 201);
  assert.equal(linkUser.json?.personnelId, tariRow.id);

  // Duplicate active account link on Tari rejected with 409 unless allowMultipleAccounts: true
  const dupLinkUser = await requestApi('/api/settings/users', {
    method: 'POST',
    cookie: superCookie,
    body: {
      linkMode: 'link_existing',
      personnelId: tariRow.id,
      email: 'tari.kedua@dpbi.or.id',
      password: 'PasswordTari2026!',
      role: 'duta',
    },
  });
  assert.equal(dupLinkUser.status, 409);

  const multiLinkUser = await requestApi('/api/settings/users', {
    method: 'POST',
    cookie: superCookie,
    body: {
      linkMode: 'link_existing',
      personnelId: tariRow.id,
      email: 'tari.kedua@dpbi.or.id',
      password: 'PasswordTari2026!',
      role: 'duta',
      allowMultipleAccounts: true,
    },
  });
  assert.equal(multiLinkUser.status, 201);

  // Operational-only user creates no personnel row
  const opOnly = await requestApi('/api/settings/users', {
    method: 'POST',
    cookie: superCookie,
    body: {
      linkMode: 'operational_only',
      fullName: 'Operator Sekretariat Uji',
      email: 'operator.sekretariat@dpbi.or.id',
      password: 'PasswordOp2026!',
      role: 'sekretariat_nasional',
    },
  });
  assert.equal(opOnly.status, 201);
  assert.equal(opOnly.json?.personnelId, null);

  // create_both mode creates both user & personnel
  const createBoth = await requestApi('/api/settings/users', {
    method: 'POST',
    cookie: superCookie,
    body: {
      linkMode: 'create_both',
      fullName: 'Bagus Prasetio',
      email: 'bagus.prasetio@dpbi.or.id',
      password: 'PasswordBagus2026!',
      role: 'duta',
      provinceCode: '35',
    },
  });
  assert.equal(createBoth.status, 201);
  assert.ok(createBoth.json?.personnelId);

  // Rollback import batch: retains Tari (has linked user) and deletes Dian (unlinked)
  const rollback = await requestApi(`/api/personnel/import-batches/${batchId}/rollback`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(rollback.status, 200);
  assert.equal(rollback.json?.deletedCount, 1);
  assert.equal(rollback.json?.retainedCount, 1);

  // 2. Invitation lifecycle: create -> resend cooldown (429) -> verify-token (aktivasi_dibuka) -> accept (aktif) -> reuse rejected
  const invRes = await requestApi('/api/invitations', {
    method: 'POST',
    cookie: superCookie,
    body: {
      fullName: 'Calon Duta Undangan',
      email: 'undangan.uji@dpbi.or.id',
      role: 'duta',
      provinceCode: '32',
    },
  });
  assert.equal(invRes.status, 201);
  const invId = String(invRes.json?.id);
  const invToken = String(invRes.json?.inviteToken);
  assert.ok(invToken.length >= 20);

  const resendCooldown = await requestApi(`/api/invitations/${invId}/resend`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(resendCooldown.status, 429);

  const verifyTok = await requestApi(`/api/invitations/verify-token/${invToken}`);
  assert.equal(verifyTok.status, 200);
  const invRowAfterOpen = db.prepare('SELECT status FROM invitations WHERE id = ?').get(invId) as { status: string };
  assert.equal(invRowAfterOpen.status, 'aktivasi_dibuka');

  const acceptInv = await requestApi('/api/auth/accept-invitation', {
    method: 'POST',
    body: { token: invToken, password: 'AktivasiValid2026!' },
  });
  assert.equal(acceptInv.status, 200);

  const reuseInv = await requestApi('/api/auth/accept-invitation', {
    method: 'POST',
    body: { token: invToken, password: 'AktivasiValid2026!' },
  });
  assert.ok([400, 409, 410, 422].includes(reuseInv.status), `Expected token reuse rejection, got ${reuseInv.status}`);

  // Cancel unused invitation
  const inv2 = await requestApi('/api/invitations', {
    method: 'POST',
    cookie: superCookie,
    body: { fullName: 'Batal Uji', email: 'batal.undangan@dpbi.or.id', role: 'duta', provinceCode: '32' },
  });
  assert.equal(inv2.status, 201);
  const cancelInv2 = await requestApi(`/api/invitations/${String(inv2.json?.id)}/cancel`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(cancelInv2.status, 200);
});

test('v4.1.0 Approval History & Self-Approval 403, Task Dependency 409 Lock, Doc Supersede Lineage, and 6 Evaluator Types', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');
  const dutaJabarCookie = await loginAs('duta.jabar@simulasi.dpbi.or.id');
  const korwilJabarCookie = await loginAs('korwil.jabar@simulasi.dpbi.or.id');

  // 1. Self-approval guard & advance_stage + approval_history
  const myProp = await requestApi('/api/proposals', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: {
      title: 'Sarasehan Bahasa Daerah Wilayah Jabar',
      bidang: 'Kebudayaan',
      category: 'Diskusi Pelajar',
      riskLevel: 'rendah',
      usesDpbiIdentity: false,
      externalPermitNeeded: false,
      objective: 'Menguatkan penguasaan bahasa daerah pelajar.',
      targetAudience: 'Pelajar SMA Jawa Barat',
      eventDate: '2026-12-22',
      eventTime: '10:00 WIB',
      location: 'Aula SMA Bandung',
      estimatedParticipants: 40,
      activityMode: 'luring',
    },
  });
  assert.equal(myProp.status, 201);
  const myPropId = String(myProp.json?.id);

  // Korwil cannot approve own proposal (403)
  const selfApprove = await requestApi(`/api/approval-center/proposal/${myPropId}/action`, {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: { action: 'approve', reason: 'Mencoba menyetujui pengajuan sendiri' },
  });
  assert.equal(selfApprove.status, 403);

  // Super Admin advances stage and checks approval_history
  const advRes = await requestApi(`/api/approval-center/proposal/${myPropId}/action`, {
    method: 'POST',
    cookie: superCookie,
    body: { action: 'advance_stage', reason: 'Verifikasi awal lengkap, lanjut persetujuan nasional.' },
  });
  assert.equal(advRes.status, 200);
  const histRes = await requestApi(`/api/approval-center/proposal/${myPropId}/history`, { cookie: superCookie });
  assert.equal(histRes.status, 200);
  const histArr = histRes.json?.history as { action: string }[];
  assert.ok(histArr.some((h) => h.action === 'advance_stage'));

  // 2. Task dependency completion guard (409 while prerequisite not selesai)
  const taskA = await requestApi('/api/tasks', {
    method: 'POST',
    cookie: superCookie,
    body: { title: 'Tugas Prasyarat A', deadline: '2026-12-10', assigneeId: 'usr-duta-jabar', provinceCode: '32' },
  });
  assert.equal(taskA.status, 201);
  const taskAId = String(taskA.json?.id);

  const taskB = await requestApi('/api/tasks', {
    method: 'POST',
    cookie: superCookie,
    body: {
      title: 'Tugas Lanjutan B',
      deadline: '2026-12-12',
      assigneeId: 'usr-duta-jabar',
      provinceCode: '32',
      dependsOnTaskId: taskAId,
    },
  });
  assert.equal(taskB.status, 201);
  const taskBId = String(taskB.json?.id);

  const blockedB = await requestApi(`/api/tasks/${taskBId}`, {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { status: 'selesai' },
  });
  assert.equal(blockedB.status, 409);

  const finishA = await requestApi(`/api/tasks/${taskAId}`, {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { status: 'selesai' },
  });
  assert.equal(finishA.status, 200);

  const finishB = await requestApi(`/api/tasks/${taskBId}`, {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { status: 'selesai' },
  });
  assert.equal(finishB.status, 200);

  // 3. Document supersede lineage (parentDocumentId archives old version and links replacedById)
  const docV1 = await requestApi('/api/documents', {
    method: 'POST',
    cookie: superCookie,
    body: { title: 'SOP Pelaporan Lapangan', category: 'SOP', version: '1.0', notes: 'Edisi awal' },
  });
  assert.equal(docV1.status, 201);
  const docV1Id = String(docV1.json?.id);

  const docV2 = await requestApi('/api/documents', {
    method: 'POST',
    cookie: superCookie,
    body: {
      title: 'SOP Pelaporan Lapangan (Revisi)',
      category: 'SOP',
      version: '2.0',
      parentDocumentId: docV1Id,
      notes: 'Pembaruan alur LKL',
    },
  });
  assert.equal(docV2.status, 201);
  const docV2Id = String(docV2.json?.id);

  const db = getDb();
  const oldDoc = db.prepare('SELECT status, replaced_by_id FROM documents WHERE id = ?').get(docV1Id) as {
    status: string;
    replaced_by_id: string;
  };
  assert.equal(oldDoc.status, 'diarsipkan');
  assert.equal(oldDoc.replaced_by_id, docV2Id);

  // 4. Multi-evaluator (all 6 evaluatorType options + programId)
  const evalTypes = ['pengurus_nasional', 'koordinator_wilayah', 'rekan_duta', 'peserta_kegiatan', 'guru_pembina', 'penilaian_mandiri'];
  for (const et of evalTypes) {
    const ev = await requestApi('/api/evaluations', {
      method: 'POST',
      cookie: superCookie,
      body: {
        personnelId: 'pers-8',
        evaluatorType: et,
        programId: 'prog-1',
        taskCompletionScore: 90,
        reportTimelinessScore: 88,
        reportQualityScore: 92,
        coordinationScore: 86,
        coachingRecommendation: `Catatan pembinaan perspektif ${et}.`,
      },
    });
    assert.equal(ev.status, 201, `Evaluation failed for evaluatorType=${et}: ${ev.text}`);
  }
});

test('v4.1.0 Flagship Programs, Persuratan & Disposisi Digital, Handover Session Revocation, WAL Backup/Restore & Maintenance Mode', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');
  const korwilJabarCookie = await loginAs('korwil.jabar@simulasi.dpbi.or.id');
  const dutaJabarCookie = await loginAs('duta.jabar@simulasi.dpbi.or.id');

  // 1. Flagship Programs public + internal + edit
  const pubProgs = await requestApi('/api/public/programs');
  assert.equal(pubProgs.status, 200);
  const progsList = pubProgs.json?.programs as { id: string; slug: string }[];
  assert.ok(Array.isArray(progsList) && progsList.length >= 1);

  const intProgs = await requestApi('/api/programs', { cookie: superCookie });
  assert.equal(intProgs.status, 200);
  const detailProg = await requestApi(`/api/programs/${progsList[0].slug}`, { cookie: superCookie });
  assert.equal(detailProg.status, 200);

  const patchProg = await requestApi(`/api/programs/${progsList[0].id}`, {
    method: 'PATCH',
    cookie: superCookie,
    body: { targetProvinces: 38 },
  });
  assert.equal(patchProg.status, 200);

  // Duta cannot edit flagship programs (403)
  const dutaPatchProg = await requestApi(`/api/programs/${progsList[0].id}`, {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { tagline: 'Coba Ubah' },
  });
  assert.equal(dutaPatchProg.status, 403);

  // 2. Persuratan & Disposisi workflow
  const createLetter = await requestApi('/api/correspondence', {
    method: 'POST',
    cookie: superCookie,
    body: {
      direction: 'masuk',
      letterType: 'Surat Undangan',
      subject: 'Undangan Koordinasi Nasional Kebudayaan 2026',
      senderName: 'Sekretariat Daerah',
      recipientName: 'Pengurus Nasional DPBI',
      provinceCode: '32',
      programId: progsList[0].id,
      urgency: 'segera',
    },
  });
  assert.equal(createLetter.status, 201);
  const corrId = String(createLetter.json?.id);

  const disposeRes = await requestApi(`/api/correspondence/${corrId}/dispose`, {
    method: 'POST',
    cookie: superCookie,
    body: {
      toUserId: 'usr-korwil-jabar',
      instruction: 'Mohon hadir dan laporkan hasil koordinasi.',
      dueDate: '2026-12-10',
    },
  });
  assert.equal(disposeRes.status, 201);
  const dispId = String(disposeRes.json?.id);

  const completeDisp = await requestApi(`/api/correspondence/dispositions/${dispId}`, {
    method: 'PATCH',
    cookie: korwilJabarCookie,
    body: { status: 'selesai', responseNote: 'Siap dilaksanakan dan dihadiri.' },
  });
  assert.equal(completeDisp.status, 200);

  // 3. Handover creates packageSnapshot & approval revokes outgoing coordinator active sessions
  const hndCreate = await requestApi('/api/handovers', {
    method: 'POST',
    cookie: superCookie,
    body: {
      provinceCode: '32',
      outgoingCoordinatorId: 'usr-korwil-jabar',
      outgoingCoordinatorName: 'Siti Nurhaliza',
      incomingCoordinatorName: 'Koordinator Pengganti Jabar',
      notes: 'Serah terima akhir periode 2026',
    },
  });
  assert.equal(hndCreate.status, 201);
  assert.ok(hndCreate.json?.packageSnapshot);
  const hndId = String(hndCreate.json?.id);

  const hndApprove = await requestApi(`/api/handovers/${hndId}/approve`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(hndApprove.status, 200);

  // Outgoing Korwil Jabar active session was revoked immediately upon handover approval
  const afterHandover = await requestApi('/api/auth/me', { cookie: korwilJabarCookie });
  assert.equal(afterHandover.status, 419);

  // 4. WAL-safe Backup, Validate, & Restore
  const backupRes = await requestApi('/api/system/backup', {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(backupRes.status, 201);
  const backupId = String(backupRes.json?.id);

  const validateRes = await requestApi(`/api/system/backup/${backupId}/validate`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(validateRes.status, 200);
  assert.equal(validateRes.json?.valid, true);

  const restoreRes = await requestApi(`/api/system/backup/${backupId}/restore`, {
    method: 'POST',
    cookie: superCookie,
    body: { confirmed: true },
  });
  assert.equal(restoreRes.status, 200);

  // 5. Maintenance Mode blocks writes with 503 while leaving GET and /api/system/maintenance working, then toggles back OFF
  try {
    const maintOn = await requestApi('/api/system/maintenance', {
      method: 'POST',
      cookie: superCookie,
      body: { enabled: true, message: 'Pemeliharaan uji keamanan v4.1.0' },
    });
    assert.equal(maintOn.status, 200);
    assert.equal(maintOn.json?.maintenanceMode, true);

    const blockedWrite = await requestApi('/api/tasks', {
      method: 'POST',
      cookie: superCookie,
      body: { title: 'Tidak boleh lolos saat maintenance', deadline: '2026-12-30' },
    });
    assert.equal(blockedWrite.status, 503);

    const allowedRead = await requestApi('/api/programs', { cookie: superCookie });
    assert.equal(allowedRead.status, 200);
  } finally {
    const maintOff = await requestApi('/api/system/maintenance', {
      method: 'POST',
      cookie: superCookie,
      body: { enabled: false, message: '' },
    });
    assert.equal(maintOff.status, 200);
    assert.equal(maintOff.json?.maintenanceMode, false);
  }
});

test('v4.2.0 Personnel Lifecycle, CSV Role Guard, Last Super Admin Guard, 2-Pathway Duta & Email Queue Control', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');
  const korwilJabarCookie = await loginAs('korwil.jabar@simulasi.dpbi.or.id');
  const dutaJabarCookie = await loginAs('duta.jabar@simulasi.dpbi.or.id');

  // 1. CSV import blocks super_admin & wakil_super_admin roles in skipped
  const blockedCsvImport = await requestApi('/api/personnel/import', {
    method: 'POST',
    cookie: superCookie,
    body: {
      fileName: 'role-escalation.csv',
      rows: [
        { fullName: 'Coba Super', email: 'escalate1@dpbi.or.id', provinceCode: '31', roleCode: 'super_admin' },
        { fullName: 'Coba Wakil', email: 'escalate2@dpbi.or.id', provinceCode: '31', roleCode: 'wakil_super_admin' },
        { fullName: 'Calon Valid', email: 'valid.import.v42@dpbi.or.id', provinceCode: '32', roleCode: 'duta', schoolName: 'SMAN 1 Bandung' },
      ],
    },
  });
  assert.equal(blockedCsvImport.status, 200);
  assert.equal(blockedCsvImport.json?.inserted, 1);
  const skippedCsv = blockedCsvImport.json?.skipped as { email: string; reason: string }[];
  assert.equal(skippedCsv.length, 2);
  assert.ok(skippedCsv.every((s) => s.reason.includes('tidak dapat diberikan')));

  // 2. Last active super_admin cannot be disabled or downgraded (409)
  const db = getDb();
  const superUserRow = db
    .prepare("SELECT id FROM users WHERE role = 'super_admin' AND account_status = 'aktif' LIMIT 1")
    .get() as { id: string };
  const activeSuperCount = (
    db.prepare("SELECT COUNT(*) AS c FROM users WHERE role = 'super_admin' AND account_status = 'aktif'").get() as { c: number }
  ).c;
  assert.equal(activeSuperCount, 1);

  const disableLastSuper = await requestApi(`/api/settings/users/${superUserRow.id}/status`, {
    method: 'PATCH',
    cookie: superCookie,
    body: { accountStatus: 'nonaktif', suspendedReason: 'Uji proteksi super admin terakhir' },
  });
  assert.equal(disableLastSuper.status, 409);

  // 3. Personnel Archive -> includeArchived=1 -> Restore, Duta forbidden, Permanent Delete 409 (linked) vs 200 (unlinked)
  const unlinkedRow = db
    .prepare("SELECT id FROM personnel WHERE email = 'valid.import.v42@dpbi.or.id'")
    .get() as { id: string };
  assert.ok(unlinkedRow?.id);

  const dutaArchiveDenied = await requestApi(`/api/personnel/${unlinkedRow.id}/archive`, {
    method: 'POST',
    cookie: dutaJabarCookie,
    body: { reason: 'Duta tidak boleh arsipkan' },
  });
  assert.equal(dutaArchiveDenied.status, 403);

  const archiveRes = await requestApi(`/api/personnel/${unlinkedRow.id}/archive`, {
    method: 'POST',
    cookie: superCookie,
    body: { reason: 'Uji pengarsipan personel' },
  });
  assert.equal(archiveRes.status, 200);

  const activeOnlyList = await requestApi('/api/personnel', { cookie: superCookie });
  const activeIds = ((activeOnlyList.json?.personnel as { id: string }[]) || []).map((p) => p.id);
  assert.equal(activeIds.includes(unlinkedRow.id), false);

  const withArchivedList = await requestApi('/api/personnel?includeArchived=1', { cookie: superCookie });
  const archivedIds = ((withArchivedList.json?.personnel as { id: string }[]) || []).map((p) => p.id);
  assert.equal(archivedIds.includes(unlinkedRow.id), true);

  const restoreRes = await requestApi(`/api/personnel/${unlinkedRow.id}/restore`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.equal(restoreRes.status, 200);

  const linkedPers = db
    .prepare("SELECT id FROM personnel WHERE user_id IS NOT NULL LIMIT 1")
    .get() as { id: string };
  const deleteLinked409 = await requestApi(`/api/personnel/${linkedPers.id}`, {
    method: 'DELETE',
    cookie: superCookie,
  });
  assert.equal(deleteLinked409.status, 409);

  const deleteUnlinked200 = await requestApi(`/api/personnel/${unlinkedRow.id}`, {
    method: 'DELETE',
    cookie: superCookie,
  });
  assert.equal(deleteUnlinked200.status, 200);

  // 4. Two-pathway Account Request: request -> perlu_revisi -> resubmit -> approval_center request_revision -> auto-approve policy
  const reqCreate = await requestApi('/api/account-requests', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: {
      fullName: 'Nadia Revisi Uji',
      email: 'nadia.revisi@dpbi.or.id',
      phone: '081299900011',
      provinceCode: '32',
      batchId: 'batch-3',
      schoolName: 'SMAN 2 Bogor',
      schoolNpsn: '20220301',
      guardianName: 'Ibu Nadia',
      docsChecklist: { pasFoto: true, kartuPelajar: false },
    },
  });
  assert.equal(reqCreate.status, 201);
  assert.equal(reqCreate.json?.status, 'menunggu');
  const accReqId = String(reqCreate.json?.id);

  const markRevise = await requestApi(`/api/account-requests/${accReqId}/decide`, {
    method: 'POST',
    cookie: superCookie,
    body: { decision: 'perlu_revisi', note: 'Mohon centang kartu pelajar terlebih dahulu.' },
  });
  assert.equal(markRevise.status, 200);
  assert.equal(markRevise.json?.status, 'perlu_revisi');

  const resubmitReq = await requestApi(`/api/account-requests/${accReqId}/resubmit`, {
    method: 'PATCH',
    cookie: korwilJabarCookie,
    body: {
      schoolNpsn: '20220302',
      docsChecklist: { pasFoto: true, kartuPelajar: true },
    },
  });
  assert.equal(resubmitReq.status, 200);
  assert.equal(resubmitReq.json?.status, 'menunggu');
  assert.equal(resubmitReq.json?.revisionCount, 1);

  const approvalCenterRevise = await requestApi(`/api/approval-center/account_request/${accReqId}/action`, {
    method: 'POST',
    cookie: superCookie,
    body: { action: 'request_revision', reason: 'Verifikasi ulang foto kartu pelajar.' },
  });
  assert.equal(approvalCenterRevise.status, 200);
  assert.equal(approvalCenterRevise.json?.status, 'perlu_revisi');

  // Enable auto-approve when sekretariat review is off & complete docs submitted
  const setAuto = await requestApi('/api/system/settings', {
    method: 'PATCH',
    cookie: superCookie,
    body: { settings: { duta_auto_approve: 'true', require_sekretariat_duta_review: 'false' } },
  });
  assert.equal(setAuto.status, 200);

  const autoReq = await requestApi('/api/account-requests', {
    method: 'POST',
    cookie: korwilJabarCookie,
    body: {
      fullName: 'Rafi Otomatis Duta',
      email: 'rafi.auto@dpbi.or.id',
      phone: '081233344455',
      provinceCode: '32',
      batchId: 'batch-3',
      schoolName: 'SMAN 3 Depok',
      schoolNpsn: '20229111',
      guardianName: 'Bapak Rafi',
      docsChecklist: { pasFoto: true, kartuPelajar: true },
    },
  });
  assert.equal(autoReq.status, 201);
  assert.equal(autoReq.json?.autoApproved, true);
  assert.equal(autoReq.json?.status, 'disetujui');
  assert.ok(String(autoReq.json?.inviteToken || '').length >= 20);

  // Restore conservative default policy
  await requestApi('/api/system/settings', {
    method: 'PATCH',
    cookie: superCookie,
    body: { settings: { duta_auto_approve: 'false', require_sekretariat_duta_review: 'true' } },
  });

  // 5. Email Queue chunking, pause, and resume with 12 manual recipients
  const manualBatch = Array.from({ length: 12 }, (_, idx) => `queue.user.${idx + 1}@dpbi.or.id`);
  const queuedSend = await requestApi('/api/email/send', {
    method: 'POST',
    cookie: superCookie,
    body: {
      actionMode: 'send_now',
      useQueue: true,
      title: 'Kampanye Antrean Batch v4.2.0',
      subject: 'Pemberitahuan {{nama}}',
      bodyText: 'Halo {{nama}}, informasi antrean batch.',
      audienceFilter: { mode: 'bulk', manualEmails: manualBatch },
    },
  });
  assert.equal(queuedSend.status, 201);
  const queueCmpId = String(queuedSend.json?.campaignId);
  assert.equal(queuedSend.json?.totalRecipients, 12);

  const pauseRes = await requestApi(`/api/email/campaigns/${queueCmpId}/pause`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.ok([200, 409].includes(pauseRes.status));

  const resumeRes = await requestApi(`/api/email/campaigns/${queueCmpId}/resume`, {
    method: 'POST',
    cookie: superCookie,
  });
  assert.ok([200, 409].includes(resumeRes.status));
});

test('v4.2.0 Zero-Confusion Addendum: Role-scoped Beranda, Process Tracker, Support Tickets, Preferences & Task Optimistic Locking', async () => {
  const superCookie = await loginAs('superadmin@simulasi.dpbi.or.id');
  const dutaJabarCookie = await loginAs('duta.jabar@simulasi.dpbi.or.id');

  // 1. Personal Workspace /api/beranda scoped strictly by role
  const berandaDuta = await requestApi('/api/beranda', { cookie: dutaJabarCookie });
  assert.equal(berandaDuta.status, 200);
  const dutaApprovals = berandaDuta.json?.pendingApprovals as unknown[];
  assert.deepEqual(dutaApprovals, []);
  const dutaQuick = berandaDuta.json?.quickActions as { path: string }[];
  assert.ok(dutaQuick.some((q) => q.path === '/proposal/baru'));
  assert.equal(dutaQuick.some((q) => q.path === '/status-sistem'), false);

  const berandaSuper = await requestApi('/api/beranda', { cookie: superCookie });
  assert.equal(berandaSuper.status, 200);
  const superQuick = berandaSuper.json?.quickActions as { path: string }[];
  assert.ok(superQuick.some((q) => q.path === '/status-sistem'));

  // 2. Process Tracker explains stage, reviewer, action owner, and timeline steps
  const trackerRes = await requestApi('/api/process-tracker/proposal/prop-1', { cookie: superCookie });
  assert.equal(trackerRes.status, 200);
  assert.ok(typeof trackerRes.json?.currentStageLabel === 'string');
  assert.ok(typeof trackerRes.json?.actionRequired === 'string');
  assert.ok(Array.isArray(trackerRes.json?.steps) && trackerRes.json.steps.length === 4);

  // 3. Support Tickets (/api/support-tickets) + RBAC triage guard
  const createTicket = await requestApi('/api/support-tickets', {
    method: 'POST',
    cookie: dutaJabarCookie,
    body: {
      title: 'Uji Kendala Formulir Proposal',
      description: 'Pengisian tanggal kegiatan di langkah 2 gagal disimpan sementara saat simulasi.',
      pagePath: '/proposal/baru',
      moduleName: 'proposal',
      category: 'bug_fungsional',
      priority: 'sedang',
      errorRefCode: 'ERR-TEST01',
    },
  });
  assert.equal(createTicket.status, 201);
  const ticketId = String(createTicket.json?.id);
  assert.ok(String(createTicket.json?.ticketNumber || '').startsWith('DPBI/TIKET/'));

  const dutaTriageDenied = await requestApi(`/api/support-tickets/${ticketId}`, {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { status: 'selesai', resolutionNote: 'Tidak boleh menutup tiket sendiri' },
  });
  assert.equal(dutaTriageDenied.status, 403);

  const adminTriageOk = await requestApi(`/api/support-tickets/${ticketId}`, {
    method: 'PATCH',
    cookie: superCookie,
    body: { status: 'selesai', priority: 'tinggi', resolutionNote: 'Diperiksa dan dikonfirmasi selesai.' },
  });
  assert.equal(adminTriageOk.status, 200);
  assert.equal(adminTriageOk.json?.status, 'selesai');

  // 4. User Preferences persistence (/api/auth/preferences)
  const patchPref = await requestApi('/api/auth/preferences', {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: {
      startPage: '/tugas-saya',
      displayScale: 'besar',
      favoritePaths: ['/beranda', '/proposal/baru', 'invalid-relative'],
      tourCompletedRoles: ['duta'],
    },
  });
  assert.equal(patchPref.status, 200);

  const getPref = await requestApi('/api/auth/preferences', { cookie: dutaJabarCookie });
  assert.equal(getPref.status, 200);
  const prefObj = getPref.json?.preferences as { startPage: string; displayScale: string; favoritePaths: string[]; tourCompletedRoles: string[] };
  assert.equal(prefObj.startPage, '/tugas-saya');
  assert.equal(prefObj.displayScale, 'besar');
  assert.deepEqual(prefObj.favoritePaths, ['/beranda', '/proposal/baru']);
  assert.deepEqual(prefObj.tourCompletedRoles, ['duta']);

  // 5. Optimistic concurrency check on Task PATCH returns 409 on stale expectedVersion
  const taskCreate = await requestApi('/api/tasks', {
    method: 'POST',
    cookie: superCookie,
    body: { title: 'Uji Optimistic Lock Tugas', deadline: '2026-12-28', assigneeId: 'usr-duta-jabar', provinceCode: '32' },
  });
  assert.equal(taskCreate.status, 201);
  const taskId = String(taskCreate.json?.id);

  const okUpdate = await requestApi(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { status: 'sedang_berjalan', expectedVersion: 1 },
  });
  assert.equal(okUpdate.status, 200);
  assert.equal(okUpdate.json?.version, 2);

  const staleUpdate = await requestApi(`/api/tasks/${taskId}`, {
    method: 'PATCH',
    cookie: dutaJabarCookie,
    body: { status: 'selesai', expectedVersion: 1 },
  });
  assert.equal(staleUpdate.status, 409);
  assert.equal(staleUpdate.json?.conflict, true);
});

