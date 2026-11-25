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
const { requireSafeOrigin } = await import('./security');

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
  registerCoreRoutes(app);
  registerModuleRoutes(app);
  registerWorkflowAndEmailRoutes(app);

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
