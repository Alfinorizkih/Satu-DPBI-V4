import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateAlumniWindow,
  calculateProfileCompleteness,
  formatReferenceNumber,
  getProvinceCount,
  hasPermission,
  resolveEffectivePermissions,
  resolveProposalApprover,
  verifyCoordinateInProvince,
} from './rbac';
import { matchPrivateRoute, normalizePathname, resolveBaseNavPath } from './routes';
import type { DelegationRecord } from './types';

test('supports all 38 official Indonesian provinces', () => {
  assert.equal(getProvinceCount(), 38);
});

test('RBAC isolates Duta and Alumni from national system/command center actions', () => {
  const dutaPerms = resolveEffectivePermissions('duta');
  assert.equal(hasPermission(dutaPerms, 'proposal', 'create'), true);
  assert.equal(hasPermission(dutaPerms, 'proposal', 'approve'), false);
  assert.equal(hasPermission(dutaPerms, 'command_center', 'view'), false);
  assert.equal(hasPermission(dutaPerms, 'sistem', 'configure'), false);

  const alumniPerms = resolveEffectivePermissions('alumni');
  assert.equal(hasPermission(alumniPerms, 'arsip', 'export'), true);
  assert.equal(hasPermission(alumniPerms, 'proposal', 'create'), false);
  assert.equal(hasPermission(alumniPerms, 'lkl', 'create'), false);

  const sekretariatPerms = resolveEffectivePermissions('sekretariat_nasional');
  assert.equal(hasPermission(sekretariatPerms, 'sistem', 'configure'), false);
  assert.equal(hasPermission(sekretariatPerms, 'dokumen', 'publish'), true);
});

test('Delegation grants temporary permission only within active date window', () => {
  const activeDelegation: DelegationRecord = {
    id: 'del-1',
    delegateUserId: 'u-1',
    delegateName: 'Wakil',
    grantorUserId: 'u-0',
    grantorName: 'Super Admin',
    module: 'wilayah',
    action: 'manage',
    provinceCode: null,
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: '2026-11-30T23:59:59Z',
    reason: 'Pendampingan nasional',
    status: 'aktif',
  };
  const during = resolveEffectivePermissions('wakil_super_admin', [activeDelegation], '2026-11-15T10:00:00Z');
  assert.equal(hasPermission(during, 'wilayah', 'manage'), true);

  const expired = resolveEffectivePermissions('wakil_super_admin', [activeDelegation], '2026-12-05T10:00:00Z');
  assert.equal(hasPermission(expired, 'wilayah', 'manage'), false);
});

test('Approval matrix routes proposals accurately without overloading Super Admin', () => {
  const highRisk = resolveProposalApprover({
    category: 'Festival Budaya',
    riskLevel: 'tinggi',
    usesDpbiIdentity: true,
    externalPermitNeeded: true,
  });
  assert.equal(highRisk.approverRole, 'pengurus_nasional');

  const regionalLow = resolveProposalApprover({
    category: 'Diskusi Pelajar',
    riskLevel: 'rendah',
    usesDpbiIdentity: false,
    externalPermitNeeded: false,
  });
  assert.equal(regionalLow.approverRole, 'koordinator_wilayah');
});

test('Coordinator province coordinate verification accurately checks boundaries', () => {
  const inJakarta = verifyCoordinateInProvince(-6.2088, 106.8456, '31');
  assert.equal(inJakarta.matched, true);

  const inBaliCheckedForJakarta = verifyCoordinateInProvince(-8.4095, 115.1889, '31');
  assert.equal(inBaliCheckedForJakarta.matched, false);
});

test('Alumni 30-day archive window calculates reminders and expiration accurately', () => {
  const termEnd = '2026-11-01T00:00:00Z';
  const day24 = calculateAlumniWindow(termEnd, '2026-11-25T00:00:00Z'); // 6 days left -> h_minus_7
  assert.equal(day24.inWindow, true);
  assert.equal(day24.expired, false);
  assert.equal(day24.reminderStage, 'h_minus_7');

  const day31 = calculateAlumniWindow(termEnd, '2026-12-03T00:00:00Z');
  assert.equal(day31.expired, true);
  assert.equal(day31.reminderStage, 'berakhir');
});

test('Profile completeness & reference number generator produce exact institutional values', () => {
  const partial = calculateProfileCompleteness({
    fullName: 'Nadia Kartika',
    birthPlace: 'Bandung',
    birthDate: '2009-04-12',
    email: 'nadia@example.id',
    phone: '08123456789',
    docsChecklist: {
      pasFoto: true,
      kartuPelajar: false,
      suratSekolah: false,
      izinWali: false,
      suratKesediaan: false,
    },
  });
  assert.equal(partial.score, 40);
  assert.ok(partial.missingFields.includes('Kartu Pelajar / Bukti Status'));

  assert.equal(formatReferenceNumber('PROP', 2026, 42), 'DPBI/PROP/2026/0042');
});

test('Clean parameterized router resolves deep links, sub-routes, and active nav bases safely', () => {
  assert.equal(normalizePathname('/proposal/baru/?ref=1#top'), '/proposal/baru');

  const createProp = matchPrivateRoute('/proposal/baru');
  assert.deepEqual(createProp, {
    kind: 'proposals',
    module: 'proposal',
    title: 'Ajukan Proposal Baru',
    mode: 'create',
  });

  const detailPerson = matchPrivateRoute('/personalia/per-101');
  assert.deepEqual(detailPerson, {
    kind: 'personnel',
    module: 'personalia',
    title: 'Detail Profil Personel',
    mode: 'detail',
    id: 'per-101',
  });

  const editPerson = matchPrivateRoute('/personalia/per-101/ubah');
  assert.deepEqual(editPerson, {
    kind: 'personnel',
    module: 'personalia',
    title: 'Ubah Profil Personel',
    mode: 'edit',
    id: 'per-101',
  });

  const myTasks = matchPrivateRoute('/tugas-saya');
  assert.deepEqual(myTasks, {
    kind: 'tasks',
    module: 'tugas',
    title: 'Tugas Saya',
    scope: 'mine',
  });

  const auditRoute = matchPrivateRoute('/audit-log');
  assert.equal(auditRoute?.kind, 'system');
  if (auditRoute?.kind === 'system') {
    assert.equal(auditRoute.initialTab, 'audit');
  }

  assert.equal(matchPrivateRoute('/personalia/..%2Fetc'), null);
  assert.equal(matchPrivateRoute('/tidak-ada'), null);

  assert.equal(resolveBaseNavPath('/proposal/prop-12'), '/proposal');
  assert.equal(resolveBaseNavPath('/pengaturan/sesi'), '/pengaturan');
  assert.equal(resolveBaseNavPath('/pengaturan/hak-akses'), '/pengaturan/hak-akses');
});
