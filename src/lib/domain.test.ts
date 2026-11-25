import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_ROLE_PERMISSIONS,
  calculateAlumniWindow,
  calculateProfileCompleteness,
  classifyRegencyPresence,
  csvSafeCell,
  formatReferenceNumber,
  getProvinceCount,
  hasPermission,
  hasScopedPermission,
  isRecordRelevantToBidang,
  OFFICIAL_BIDANGS,
  renderEmailTemplate,
  resolveBidangDefinition,
  resolveEffectivePermissions,
  resolveProposalApprover,
  sanitizePublicStatsPayload,
  summarizeRegencyCoverage,
  validateEmailTemplatePlaceholders,
  verifyCoordinateInProvince,
} from './rbac';
import {
  computeCollectionBBox,
  computeFeatureSvgCenter,
  geometryToSvgPath,
  projectPoint,
  type GeoJsonFeature,
} from './geojson';
import { isPublicWebsitePath, matchPrivateRoute, normalizePathname, resolveBaseNavPath } from './routes';
import type { DelegationRecord, RegencyRecord } from './types';

test('supports all 38 official Indonesian provinces', () => {
  assert.equal(getProvinceCount(), 38);
});

test('defines all 6 official national Bidang and matches proposals accurately', () => {
  assert.equal(OFFICIAL_BIDANGS.length, 6);
  assert.deepEqual(
    OFFICIAL_BIDANGS.map((b) => b.number),
    ['01', '02', '03', '04', '05', '06']
  );

  const edu = resolveBidangDefinition('Bidang Pendidikan & Kebudayaan');
  assert.equal(edu?.code, 'pendidikan_kebudayaan');

  const mediaAlias = resolveBidangDefinition('Media Publikasi');
  assert.equal(mediaAlias?.code, 'media_publikasi_teknologi');

  assert.equal(
    isRecordRelevantToBidang('Bidang Pendidikan & Kebudayaan', 'Kebudayaan', 'Festival / Pameran Budaya'),
    true
  );
  assert.equal(
    isRecordRelevantToBidang('Bidang Pendidikan & Kebudayaan', 'Bidang Hubungan & Kemitraan', 'MoU Lembaga'),
    false
  );
});

test('distinguishes Duta domicile vs assignment vs coordinator/activity coverage in regencies', () => {
  const domicileOnly = classifyRegencyPresence({
    coordinatorName: null,
    domicileDutaCount: 2,
    assignmentDutaCount: 0,
    lklCount: 0,
    proposalCount: 0,
  });
  assert.equal(domicileOnly.derivedStatus, 'dalam_pembinaan');
  assert.equal(domicileOnly.hasDomicileOnly, true);

  const activeReg = classifyRegencyPresence({
    coordinatorName: 'Siti Koordinator',
    domicileDutaCount: 1,
    assignmentDutaCount: 2,
    lklCount: 1,
    proposalCount: 1,
  });
  assert.equal(activeReg.derivedStatus, 'aktif');
  assert.equal(activeReg.hasOfficialCoordinator, true);

  const sampleRegencies: RegencyRecord[] = [
    {
      code: '3273',
      provinceCode: '32',
      name: 'Kota Bandung',
      kind: 'kota',
      status: 'aktif',
      coordinatorName: 'Koordinator Bandung',
      coachingNote: null,
      domicileDutaCount: 2,
      assignmentDutaCount: 2,
      lklCount: 3,
      proposalCount: 1,
    },
    {
      code: '3204',
      provinceCode: '32',
      name: 'Kabupaten Bandung',
      kind: 'kabupaten',
      status: 'dalam_pembinaan',
      coordinatorName: null,
      coachingNote: null,
      domicileDutaCount: 1,
      assignmentDutaCount: 0,
      lklCount: 0,
      proposalCount: 0,
    },
  ];
  const summary = summarizeRegencyCoverage(sampleRegencies);
  assert.equal(summary.total, 2);
  assert.equal(summary.active, 1);
  assert.equal(summary.domicileCovered, 2);
  assert.equal(summary.assignmentCovered, 1);
  assert.equal(summary.withActivities, 1);
});

test('sanitizes public statistics payload based on privacy approval flag', () => {
  const hidden = sanitizePublicStatsPayload(
    {
      activeProvinces: 12,
      developingProvinces: 8,
      totalProvinces: 38,
      coveredRegencies: 45,
      totalRegencies: 514,
      activePersonnel: 240,
      approvedActivities: 38,
      activeBatches: 1,
      showPublicDutaCount: false,
    },
    false
  );
  assert.equal(hidden.activePersonnel, null);
  assert.equal(hidden.totalProvinces, 38);

  const shown = sanitizePublicStatsPayload(
    {
      activeProvinces: 12,
      totalProvinces: 38,
      activePersonnel: 240,
      approvedActivities: 38,
      activeBatches: 1,
    },
    true
  );
  assert.equal(shown.activePersonnel, 240);
});

test('computes GeoJSON bounding boxes and SVG path projections faithfully', () => {
  const polyFeature: GeoJsonFeature = {
    type: 'Feature',
    properties: { KODE_PROV: '31' },
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [106.7, -6.3],
          [106.9, -6.3],
          [106.9, -6.1],
          [106.7, -6.1],
          [106.7, -6.3],
        ],
      ],
    },
  };
  const bbox = computeCollectionBBox([polyFeature]);
  assert.ok(bbox.minLng < 106.7);
  assert.ok(bbox.maxLng > 106.9);
  assert.ok(bbox.minLat < -6.3);
  assert.ok(bbox.maxLat > -6.1);

  const bounds = { width: 400, height: 300, padding: 10 };
  const [x1, y1] = projectPoint(106.7, -6.1, bbox, bounds);
  const [x2, y2] = projectPoint(106.9, -6.3, bbox, bounds);
  assert.ok(x2 > x1);
  assert.ok(y2 > y1);

  const path = geometryToSvgPath(polyFeature.geometry, bbox, bounds);
  assert.ok(path.startsWith('M'));
  assert.ok(path.endsWith('Z'));

  const [cx, cy] = computeFeatureSvgCenter(polyFeature.geometry, bbox, bounds);
  assert.ok(cx > x1 && cx < x2);
  assert.ok(cy > y1 && cy < y2);
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

test('Clean parameterized router resolves public paths, CMS route, deep links, and active nav bases safely', () => {
  assert.equal(normalizePathname('/proposal/baru/?ref=1#top'), '/proposal/baru');

  assert.equal(isPublicWebsitePath('/'), true);
  assert.equal(isPublicWebsitePath('/tentang'), true);
  assert.equal(isPublicWebsitePath('/wilayah'), true);
  assert.equal(isPublicWebsitePath('/wilayah/32'), true);
  assert.equal(isPublicWebsitePath('/bantuan'), true);
  assert.equal(isPublicWebsitePath('/login'), true);
  assert.equal(isPublicWebsitePath('/dashboard'), false);

  const cmsRoute = matchPrivateRoute('/pengaturan/cms');
  assert.deepEqual(cmsRoute, {
    kind: 'settings',
    module: 'pengaturan',
    title: 'CMS Portal Publik & Bantuan',
    initialTab: 'cms',
  });
  assert.equal(matchPrivateRoute('/cms')?.kind, 'settings');

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
  assert.equal(resolveBaseNavPath('/pengaturan/cms'), '/pengaturan/cms');
  assert.equal(resolveBaseNavPath('/pusat-bantuan'), '/bantuan');
  assert.equal(resolveBaseNavPath('/hak-cipta'), '/ketentuan');

  assert.equal(isPublicWebsitePath('/privasi'), true);
  assert.equal(isPublicWebsitePath('/ketentuan'), true);
  assert.equal(isPublicWebsitePath('/hak-cipta'), true);
  assert.equal(isPublicWebsitePath('/pusat-bantuan'), true);
  assert.equal(isPublicWebsitePath('/pemeliharaan'), true);

  assert.deepEqual(matchPrivateRoute('/privasi'), {
    kind: 'legal',
    section: 'privasi',
    title: 'Kebijakan Privasi & Data Pelajar',
  });
  assert.deepEqual(matchPrivateRoute('/hak-cipta'), {
    kind: 'legal',
    section: 'ketentuan',
    title: 'Hak Cipta & Ketentuan Penggunaan',
  });
  assert.equal(matchPrivateRoute('/pusat-bantuan')?.kind, 'help');
});

test('hasScopedPermission blocks cross-province Korwil actions and enforces province-scoped delegation windows', () => {
  const provDelegation: DelegationRecord = {
    id: 'del-prov-32',
    delegateUserId: 'usr-duta-jabar',
    delegateName: 'Raka Pratama',
    grantorUserId: 'usr-korwil-jabar',
    grantorName: 'Siti Nurhaliza',
    module: 'proposal',
    action: 'approve',
    provinceCode: '32',
    startsAt: '2026-11-01T00:00:00Z',
    endsAt: '2026-11-30T23:59:59Z',
    reason: 'Pendampingan administratif Jawa Barat',
    status: 'aktif',
  };

  // Korwil Jabar ('32') base permission cannot cross into Jawa Tengah ('33')
  assert.equal(
    hasScopedPermission('koordinator_wilayah', [], 'proposal', 'review', '32', '32', '2026-11-15T10:00:00Z'),
    true
  );
  assert.equal(
    hasScopedPermission('koordinator_wilayah', [], 'proposal', 'review', '33', '32', '2026-11-15T10:00:00Z'),
    false
  );
  // Even with a delegation scoped to province '32', Korwil cannot act on province '33'
  assert.equal(
    hasScopedPermission('koordinator_wilayah', [provDelegation], 'proposal', 'approve', '33', '32', '2026-11-15T10:00:00Z'),
    false
  );

  // Active province-scoped delegation works only within target province & active dates
  assert.equal(
    hasScopedPermission('duta', [provDelegation], 'proposal', 'approve', '32', '32', '2026-11-15T10:00:00Z'),
    true
  );
  assert.equal(
    hasScopedPermission('duta', [provDelegation], 'proposal', 'approve', '33', '32', '2026-11-15T10:00:00Z'),
    false
  );
  assert.equal(
    hasScopedPermission('duta', [provDelegation], 'proposal', 'approve', '32', '32', '2026-12-05T10:00:00Z'),
    false
  );
});

test('csvSafeCell escapes spreadsheet formula prefixes and embedded quotes safely', () => {
  assert.equal(csvSafeCell('=cmd|"/C calc"!A0'), `"'=cmd|""/C calc""!A0"`);
  assert.equal(csvSafeCell('+1+1'), `"'${'+1+1'}"`);
  assert.equal(csvSafeCell('-2+3'), `"'${'-2+3'}"`);
  assert.equal(csvSafeCell('@SUM(A1:A2)'), `"'${'@SUM(A1:A2)'}"`);
  assert.equal(csvSafeCell('\twhoami'), `"'${'\twhoami'}"`);
  assert.equal(csvSafeCell('Nama "Pelajar"'), `"Nama ""Pelajar"""`);
  assert.equal(csvSafeCell(null), '""');
});

test('Email template placeholder validation & rendering accept only allowlisted variables', () => {
  const valid = validateEmailTemplatePlaceholders(
    'Halo {{nama}}, undangan untuk {{jabatan}} wilayah {{provinsi}} ({{angkatan}}) pada {{tanggal}} ref {{referensi}} ke {{email}}.'
  );
  assert.equal(valid.valid, true);
  assert.deepEqual(valid.invalidVariables, []);
  assert.equal(valid.unclosedBraces, false);

  const invalidVar = validateEmailTemplatePlaceholders('Halo {{nama}}, token {{password_hash}}');
  assert.equal(invalidVar.valid, false);
  assert.deepEqual(invalidVar.invalidVariables, ['password_hash']);

  const unclosed = validateEmailTemplatePlaceholders('Halo {{nama}, cek lagi');
  assert.equal(unclosed.valid, false);
  assert.equal(unclosed.unclosedBraces, true);

  const rendered = renderEmailTemplate('Yth. {{nama}} ({{provinsi}})', {
    nama: 'Raka Pratama',
    provinsi: 'Jawa Barat',
  });
  assert.equal(rendered, 'Yth. Raka Pratama (Jawa Barat)');
});

test('Approval Center and Email Center routes and BASE_ROLE_PERMISSIONS enforce role boundaries', () => {
  assert.deepEqual(matchPrivateRoute('/persetujuan'), {
    kind: 'approval_center',
    module: 'persetujuan',
    title: 'Pusat Persetujuan Nasional',
  });
  assert.deepEqual(matchPrivateRoute('/email'), {
    kind: 'email',
    module: 'email',
    title: 'Pusat Email & Pengiriman Massal',
  });
  assert.equal(resolveBaseNavPath('/persetujuan'), '/persetujuan');
  assert.equal(resolveBaseNavPath('/email'), '/email');

  assert.ok(BASE_ROLE_PERMISSIONS.super_admin.persetujuan?.includes('approve'));
  assert.ok(BASE_ROLE_PERMISSIONS.super_admin.email?.includes('publish'));
  assert.ok(BASE_ROLE_PERMISSIONS.koordinator_wilayah.persetujuan?.includes('approve'));
  assert.equal(BASE_ROLE_PERMISSIONS.koordinator_wilayah.email, undefined);
  assert.equal(BASE_ROLE_PERMISSIONS.duta.persetujuan, undefined);
  assert.equal(BASE_ROLE_PERMISSIONS.duta.email, undefined);
  assert.equal(BASE_ROLE_PERMISSIONS.alumni.persetujuan, undefined);
  assert.equal(BASE_ROLE_PERMISSIONS.alumni.email, undefined);
});

