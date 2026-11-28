import React, { useEffect, useState } from 'react';
import { AlertTriangle, Archive, CheckSquare, Download, Edit3, Eye, Plus, Printer, RotateCcw, Trash2, Upload, UserCheck } from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost, apiUrl } from '../lib/api';
import { parseCsvObjects } from '../lib/csvParser';
import { useAuth } from '../context/AuthContext';
import { INDONESIA_PROVINCES } from '../lib/provinces';
import { A4PrintModal, type PrintDocumentConfig } from '../components/print/A4PrintEngine';
import {
  ConfirmDialog,
  EmptyState,
  FileDropzone,
  FormErrorSummary,
  GlassCard,
  LoadingSkeleton,
  Modal,
  Pagination,
  StatusIndicator,
} from '../components/ui';
import { formatTanggalIndonesia, ROLE_LABELS } from '../lib/rbac';
import type { ImportBatchRecord, InvitationRecord, OrgPositionHistoryRecord, PersonnelRecord, RoleCode } from '../lib/types';

interface DuplicateMatch {
  id: string;
  fullName: string;
  memberNumber: string;
  provinceName: string;
  reason: string;
}

interface CascadeOption {
  code: string;
  name: string;
}

interface AccountRequest {
  id: string;
  referenceNumber: string;
  fullName: string;
  email: string;
  phone: string;
  provinceCode: string;
  provinceName: string;
  batchId?: string;
  schoolName: string;
  schoolNpsn?: string;
  guardianName?: string;
  docsChecklist?: Record<string, boolean>;
  revisionCount?: number;
  autoApproved?: boolean;
  requestedByName: string;
  status: string;
  decisionNote: string | null;
  decidedBy?: string | null;
  createdAt: string;
}

interface PersonnelHistory {
  proposals: { id: string; reference_number: string; title: string; status: string; event_date: string }[];
  lkl: { id: string; reference_number: string; activity_name: string; status: string; event_date: string; participant_count: number }[];
  evaluations: { id: string; total_score: number; coaching_recommendation: string; evaluator_name: string; created_at: string }[];
  positionHistory?: {
    id: string;
    position_title: string;
    bidang: string;
    sk_number: string | null;
    started_at: string;
    ended_at: string | null;
    change_reason: string;
    actor_name: string;
  }[];
}

type DetailTab = 'identitas' | 'pendidikan' | 'domisili' | 'penugasan' | 'dokumen' | 'riwayat';

const PAGE_SIZE = 10;

export function PersonnelPage({
  initialMode = 'list',
  initialId,
}: {
  initialMode?: 'list' | 'create' | 'detail' | 'edit' | 'history';
  initialId?: string;
}) {
  const { user, can, notify, navigate } = useAuth();
  const [tab, setTab] = useState<'direktori' | 'permintaan' | 'undangan' | 'impor'>('direktori');
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [invitations, setInvitations] = useState<(InvitationRecord & { roleLabel?: string; provinceName?: string })[]>([]);
  const [importBatches, setImportBatches] = useState<(ImportBatchRecord & { file_name?: string; total_rows?: number; success_count?: number; skipped_count?: number; imported_by_name?: string; created_at?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [provFilter, setProvFilter] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [page, setPage] = useState(1);

  const [selected, setSelected] = useState<PersonnelRecord | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>('identitas');
  const [history, setHistory] = useState<PersonnelHistory | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [formMode, setFormMode] = useState<'create' | 'edit' | null>(null);
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);
  const [formDirty, setFormDirty] = useState(false);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [reqOpen, setReqOpen] = useState(false);
  const [verifyNote, setVerifyNote] = useState('');
  const [issuedToken, setIssuedToken] = useState<string | null>(null);
  const [reqDecisionModal, setReqDecisionModal] = useState<{
    id: string;
    fullName: string;
    decision: 'perlu_revisi' | 'ditolak';
    note: string;
  } | null>(null);
  const [resubmitReqModal, setResubmitReqModal] = useState<AccountRequest | null>(null);
  const [resubmitForm, setResubmitForm] = useState({
    fullName: '',
    phone: '',
    schoolName: '',
    schoolNpsn: '',
    guardianName: '',
    docsChecklist: { pasFoto: false, kartuPelajar: false, suratSekolah: false, izinWali: false },
  });
  const [confirmArchive, setConfirmArchive] = useState<{ id: string; fullName: string; reason: string } | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<{ id: string; fullName: string } | null>(null);
  const [confirmDeletePerm, setConfirmDeletePerm] = useState<{ id: string; fullName: string } | null>(null);
  const [printConfig, setPrintConfig] = useState<PrintDocumentConfig | null>(null);

  const [duplicates, setDuplicates] = useState<DuplicateMatch[]>([]);
  const [manualLocation, setManualLocation] = useState(false);
  const [cascadeRegencies, setCascadeRegencies] = useState<CascadeOption[]>([]);
  const [cascadeDistricts, setCascadeDistricts] = useState<CascadeOption[]>([]);
  const [cascadeVillages, setCascadeVillages] = useState<CascadeOption[]>([]);
  const [selectedDistrictCode, setSelectedDistrictCode] = useState('');

  const emptyPersonForm = {
    fullName: '',
    nickname: '',
    birthPlace: '',
    birthDate: '',
    gender: 'Perempuan',
    email: '',
    phone: '',
    provinceCode: user?.provinceCode || '32',
    assignmentProvinceCode: user?.provinceCode || '32',
    regencyCode: '',
    regency: '',
    district: '',
    village: '',
    postalCode: '',
    fullAddress: '',
    schoolName: '',
    educationLevel: 'SMA/SMK/MA',
    gradeClass: 'XI',
    major: '',
    npsn: '',
    nisn: '',
    guardianName: '',
    guardianRelation: 'Ibu',
    guardianPhone: '',
    culturalInterests: '',
    activityInterests: '',
    orgExperience: '',
    skills: '',
    avatarFileId: '' as string | null,
    avatarFileName: '' as string | null,
    docsChecklist: { pasFoto: false, kartuPelajar: false, suratSekolah: false, izinWali: false, suratKesediaan: false },
  };

  const [personForm, setPersonForm] = useState(emptyPersonForm);

  const [newReq, setNewReq] = useState({
    fullName: '',
    email: '',
    phone: '',
    provinceCode: user?.provinceCode || '32',
    batchId: 'batch-3',
    schoolName: '',
    schoolNpsn: '',
    guardianName: '',
    docsChecklist: { pasFoto: false, kartuPelajar: false, suratSekolah: false, izinWali: false },
  });

  // Bulk CSV Import state & column mapping
  const [csvFileName, setCsvFileName] = useState('impor-personel.csv');
  const [csvText, setCsvText] = useState(
    'fullName,email,provinceCode,schoolName,batchId,nisn,phone,regency\nPutri Andini,putri.andini@simulasi.dpbi.or.id,32,SMAN 2 Bandung,batch-3,0089112233,08123456789,Kota Bandung'
  );
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvColumnMap, setCsvColumnMap] = useState<Record<string, number>>({
    fullName: 0,
    email: 1,
    provinceCode: 2,
    schoolName: 3,
    batchId: 4,
    nisn: 5,
    phone: 6,
    regency: 7,
  });
  const [csvPreview, setCsvPreview] = useState<
    { fullName: string; email: string; provinceCode: string; schoolName: string; batchId?: string; nisn?: string; phone?: string; regency?: string }[]
  >([]);
  const [importResult, setImportResult] = useState<{ batchId?: string; inserted: number; skipped: { row?: number; email: string; reason: string }[] } | null>(null);

  // Invitation lifecycle state
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invForm, setInvForm] = useState({
    fullName: '',
    email: '',
    role: 'duta' as RoleCode,
    provinceCode: user?.provinceCode || '32',
    batchId: 'batch-3',
    personnelId: '',
  });
  const [latestInviteLink, setLatestInviteLink] = useState<{ link?: string; token?: string; email: string } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, rRes, invRes, batchRes] = await Promise.all([
        apiGet<{ personnel: PersonnelRecord[] }>(`/api/personnel${includeArchived ? '?includeArchived=1' : ''}`),
        apiGet<{ requests: AccountRequest[] }>('/api/account-requests'),
        apiGet<{ invitations: (InvitationRecord & { roleLabel?: string; provinceName?: string })[] }>('/api/invitations').catch(() => ({ invitations: [] })),
        apiGet<{ batches: ImportBatchRecord[] }>('/api/personnel/import-batches').catch(() => ({ batches: [] })),
      ]);
      setPersonnel(pRes.personnel);
      setRequests(rRes.requests);
      setInvitations(invRes.invitations || []);
      setImportBatches(batchRes.batches || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [includeArchived]);

  useEffect(() => {
    setPage(1);
  }, [search, provFilter]);

  useEffect(() => {
    if (!formDirty) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, [formDirty]);

  useEffect(() => {
    if (!selected || detailTab !== 'riwayat') return;
    setHistoryLoading(true);
    apiGet<PersonnelHistory>(`/api/personnel/${selected.id}/history?reveal=1`)
      .then(setHistory)
      .catch(() => setHistory({ proposals: [], lkl: [], evaluations: [], positionHistory: [] }))
      .finally(() => setHistoryLoading(false));
  }, [selected, detailTab]);

  // Cascading location fetch when form is open
  useEffect(() => {
    if (!formMode) return;
    const params = new URLSearchParams({ provinceCode: personForm.provinceCode || '' });
    if (personForm.regencyCode) params.set('regencyCode', personForm.regencyCode);
    if (selectedDistrictCode) params.set('districtCode', selectedDistrictCode);
    apiGet<{ regencies: CascadeOption[]; districts: CascadeOption[]; villages: CascadeOption[] }>(
      `/api/locations/cascade?${params.toString()}`
    )
      .then((res) => {
        setCascadeRegencies(res.regencies || []);
        setCascadeDistricts(res.districts || []);
        setCascadeVillages(res.villages || []);
      })
      .catch(() => {
        setCascadeRegencies([]);
        setCascadeDistricts([]);
        setCascadeVillages([]);
      });
  }, [formMode, personForm.provinceCode, personForm.regencyCode, selectedDistrictCode]);

  // Live duplicate personnel detection
  useEffect(() => {
    if (!formMode) {
      setDuplicates([]);
      return;
    }
    const cleanEmail = personForm.email.trim();
    const cleanNisn = personForm.nisn.trim();
    const cleanName = personForm.fullName.trim();
    if (!cleanEmail && cleanNisn.length < 6 && cleanName.length < 4) {
      setDuplicates([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const qs = new URLSearchParams();
      if (cleanEmail) qs.set('email', cleanEmail);
      if (cleanNisn.length >= 6) qs.set('nisn', cleanNisn);
      if (cleanName.length >= 4) qs.set('fullName', cleanName);
      if (editingId) qs.set('excludeId', editingId);
      apiGet<{ duplicates: DuplicateMatch[] }>(`/api/personnel/check-duplicate?${qs.toString()}`)
        .then((res) => setDuplicates(res.duplicates || []))
        .catch(() => setDuplicates([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [formMode, personForm.email, personForm.nisn, personForm.fullName, editingId]);

  const filtered = personnel.filter((p) => {
    const matchText =
      !search.trim() ||
      p.fullName.toLowerCase().includes(search.toLowerCase()) ||
      p.memberNumber.toLowerCase().includes(search.toLowerCase()) ||
      p.schoolName.toLowerCase().includes(search.toLowerCase());
    const matchProv = !provFilter || p.provinceCode === provFilter;
    return matchText && matchProv;
  });

  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const openCreateForm = (updateUrl = true) => {
    setEditingId(null);
    setPersonForm(emptyPersonForm);
    setManualLocation(false);
    setSelectedDistrictCode('');
    setDuplicates([]);
    setFormErrors([]);
    setFormDirty(false);
    setFormStep(1);
    setFormMode('create');
    if (updateUrl) navigate('/personalia/tambah');
  };

  const openEditForm = (p: PersonnelRecord, updateUrl = true) => {
    setEditingId(p.id);
    setPersonForm({
      fullName: p.fullName,
      nickname: p.nickname || '',
      birthPlace: p.restrictedFieldsMasked ? '' : p.birthPlace,
      birthDate: p.restrictedFieldsMasked ? '' : p.birthDate,
      gender: p.gender || 'Perempuan',
      email: p.email,
      phone: p.restrictedFieldsMasked ? '' : p.phone,
      provinceCode: p.provinceCode,
      assignmentProvinceCode: p.assignmentProvinceCode || p.provinceCode,
      regencyCode: p.regencyCode || '',
      regency: p.regency || '',
      district: p.restrictedFieldsMasked ? '' : p.district,
      village: p.restrictedFieldsMasked ? '' : p.village,
      postalCode: p.restrictedFieldsMasked ? '' : p.postalCode,
      fullAddress: p.restrictedFieldsMasked ? '' : p.fullAddress,
      schoolName: p.schoolName || '',
      educationLevel: p.educationLevel || 'SMA/SMK/MA',
      gradeClass: p.gradeClass || 'XI',
      major: p.major || '',
      npsn: p.npsn || '',
      nisn: p.restrictedFieldsMasked ? '' : p.nisn,
      guardianName: p.restrictedFieldsMasked ? '' : p.guardianName,
      guardianRelation: p.restrictedFieldsMasked ? 'Ibu' : p.guardianRelation || 'Ibu',
      guardianPhone: p.restrictedFieldsMasked ? '' : p.guardianPhone,
      culturalInterests: p.culturalInterests || '',
      activityInterests: p.activityInterests || '',
      orgExperience: p.orgExperience || '',
      skills: p.skills || '',
      avatarFileId: p.avatarFileId || null,
      avatarFileName: p.avatarFileId ? 'Foto Profil Terunggah' : null,
      docsChecklist: { ...p.docsChecklist },
    });
    setManualLocation(!p.regencyCode && Boolean(p.regency));
    setSelectedDistrictCode('');
    setDuplicates([]);
    setFormErrors([]);
    setFormDirty(false);
    setFormStep(1);
    setFormMode('edit');
    if (updateUrl) navigate(`/personalia/${p.id}/ubah`);
  };

  useEffect(() => {
    if (loading) return;
    if (initialMode === 'create' && can('personalia', 'create')) {
      openCreateForm(false);
      return;
    }
    if ((initialMode === 'detail' || initialMode === 'edit') && initialId && personnel.length > 0) {
      const target = personnel.find((p) => p.id === initialId || p.memberNumber === initialId);
      if (target) {
        if (initialMode === 'edit' && can('personalia', 'edit')) {
          openEditForm(target, false);
        } else if (selected?.id !== target.id) {
          setSelected(target);
          setDetailTab('identitas');
          setHistory(null);
        }
      }
      return;
    }
    if (initialMode === 'history' && personnel.length > 0 && !selected) {
      const mine = personnel.find((p) => p.id === user?.personnelId) || personnel[0];
      if (mine) {
        setSelected(mine);
        setDetailTab('riwayat');
        setHistory(null);
      }
    }
  }, [loading, initialMode, initialId, personnel]);

  const attemptCloseForm = () => {
    if (formDirty) {
      setConfirmDiscardOpen(true);
    } else {
      setFormMode(null);
      navigate('/personalia');
    }
  };

  const updateForm = (patch: Partial<typeof personForm>) => {
    setFormDirty(true);
    setPersonForm((prev) => ({ ...prev, ...patch }));
  };

  const handleSavePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const errs: string[] = [];
    if (!personForm.fullName.trim()) errs.push('Nama lengkap wajib diisi.');
    if (!personForm.email.trim()) errs.push('Alamat email wajib diisi.');
    if (!personForm.schoolName.trim()) errs.push('Nama sekolah wajib diisi.');
    if (errs.length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors([]);
    setSaving(true);
    try {
      if (formMode === 'create') {
        const res = await apiPost<{ referenceNumber: string }>('/api/personnel', personForm);
        notify(`Personel ${res.referenceNumber} ditambahkan ke database induk.`, 'success');
      } else if (formMode === 'edit' && editingId) {
        await apiPatch(`/api/personnel/${editingId}`, personForm);
        notify('Perubahan profil personel berhasil disimpan.', 'success');
      }
      setFormDirty(false);
      setFormMode(null);
      setSelected(null);
      navigate('/personalia');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan data personel.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleVerify = async (id: string, status: string) => {
    try {
      await apiPost(`/api/personnel/${id}/verify`, { status, note: verifyNote });
      notify(`Status verifikasi diperbarui menjadi ${status.replace(/_/g, ' ')}.`, 'success');
      setSelected(null);
      setVerifyNote('');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Verifikasi gagal.', 'error');
    }
  };

  const handleCreateReq = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{
        referenceNumber: string;
        status?: string;
        autoApproved?: boolean;
        inviteToken?: string | null;
      }>('/api/account-requests', newReq);
      if (res.autoApproved && res.inviteToken) {
        setIssuedToken(res.inviteToken);
        notify(`Permintaan ${res.referenceNumber} disetujui otomatis dan token undangan diterbitkan.`, 'success');
      } else {
        notify(`Permintaan akun ${res.referenceNumber} diajukan ke Sekretariat Nasional.`, 'success');
      }
      setReqOpen(false);
      setNewReq({
        fullName: '',
        email: '',
        phone: '',
        provinceCode: user?.provinceCode || '32',
        batchId: 'batch-3',
        schoolName: '',
        schoolNpsn: '',
        guardianName: '',
        docsChecklist: { pasFoto: false, kartuPelajar: false, suratSekolah: false, izinWali: false },
      });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim permintaan akun.', 'error');
    }
  };

  const handleDecideReq = async (id: string, decision: 'disetujui' | 'perlu_revisi' | 'ditolak', customNote?: string) => {
    try {
      const note =
        customNote?.trim() ||
        (decision === 'disetujui'
          ? 'Disetujui dan tautan undangan satu kali pakai diterbitkan.'
          : decision === 'perlu_revisi'
          ? 'Mohon lengkapi berkas atau perbaiki data calon Duta.'
          : 'Pengajuan akun belum memenuhi persyaratan verifikasi.');
      const res = await apiPost<{ inviteToken?: string | null }>(`/api/account-requests/${id}/decide`, {
        decision,
        note,
      });
      if (res.inviteToken) setIssuedToken(res.inviteToken);
      notify(
        decision === 'disetujui'
          ? 'Permintaan akun disetujui dan undangan aktivasi diterbitkan.'
          : decision === 'perlu_revisi'
          ? 'Permintaan akun dikembalikan untuk revisi.'
          : 'Permintaan akun ditolak.',
        'success'
      );
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses permintaan.', 'error');
    }
  };

  const handleResubmitReq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resubmitReqModal) return;
    try {
      await apiPatch(`/api/account-requests/${resubmitReqModal.id}/resubmit`, resubmitForm);
      notify(`Permintaan ${resubmitReqModal.referenceNumber} diperbarui dan diajukan ulang.`, 'success');
      setResubmitReqModal(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengajukan ulang permintaan akun.', 'error');
    }
  };

  const handleArchivePerson = async () => {
    if (!confirmArchive) return;
    try {
      await apiPost(`/api/personnel/${confirmArchive.id}/archive`, {
        reason: confirmArchive.reason.trim() || 'Diarsipkan dari direktori aktif operasional',
      });
      notify(`Data personel ${confirmArchive.fullName} dipindahkan ke arsip.`, 'info');
      setConfirmArchive(null);
      setSelected(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengarsipkan personel.', 'error');
    }
  };

  const handleRestorePerson = async () => {
    if (!confirmRestore) return;
    try {
      await apiPost(`/api/personnel/${confirmRestore.id}/restore`);
      notify(`Data personel ${confirmRestore.fullName} dipulihkan ke direktori aktif.`, 'success');
      setConfirmRestore(null);
      setSelected(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memulihkan personel.', 'error');
    }
  };

  const handleDeletePersonPerm = async () => {
    if (!confirmDeletePerm) return;
    try {
      await apiDelete(`/api/personnel/${confirmDeletePerm.id}`);
      notify(`Data personel ${confirmDeletePerm.fullName} dihapus permanen.`, 'info');
      setConfirmDeletePerm(null);
      setSelected(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menghapus permanen personel.', 'error');
    }
  };

  const parseCsvPreview = (rawInput?: string, customMap?: Record<string, number>) => {
    const raw = (rawInput ?? csvText).trim();
    const { headers, records } = parseCsvObjects(raw, { maxRows: 1000 });
    if (headers.length === 0) {
      setCsvHeaders([]);
      setCsvPreview([]);
      return;
    }
    setCsvHeaders(headers);
    let colMap = customMap ?? csvColumnMap;
    if (!customMap) {
      const autoMap: Record<string, number> = { ...csvColumnMap };
      headers.forEach((h, idx) => {
        const hl = h.toLowerCase();
        if (hl.includes('nama') || hl === 'fullname') autoMap.fullName = idx;
        else if (hl.includes('email')) autoMap.email = idx;
        else if (hl.includes('prov') || hl === 'provincecode') autoMap.provinceCode = idx;
        else if (hl.includes('sekolah') || hl === 'schoolname') autoMap.schoolName = idx;
        else if (hl.includes('batch')) autoMap.batchId = idx;
        else if (hl.includes('nisn')) autoMap.nisn = idx;
        else if (hl.includes('telp') || hl.includes('phone') || hl.includes('hp')) autoMap.phone = idx;
        else if (hl.includes('kab') || hl.includes('regency')) autoMap.regency = idx;
      });
      colMap = autoMap;
      setCsvColumnMap(autoMap);
    }

    const pick = (data: Record<string, string>, idx: number | undefined) => {
      if (idx === undefined || idx < 0 || idx >= headers.length) return '';
      return (data[headers[idx]] || '').trim();
    };

    const parsed = records
      .filter(({ data }) => Boolean(pick(data, colMap.fullName) || pick(data, colMap.email)))
      .map(({ data }) => ({
        fullName: pick(data, colMap.fullName),
        email: pick(data, colMap.email),
        provinceCode: pick(data, colMap.provinceCode) || user?.provinceCode || '31',
        schoolName: pick(data, colMap.schoolName),
        batchId: colMap.batchId !== undefined ? pick(data, colMap.batchId) || 'batch-3' : 'batch-3',
        nisn: colMap.nisn !== undefined ? pick(data, colMap.nisn) : '',
        phone: colMap.phone !== undefined ? pick(data, colMap.phone) : '',
        regency: colMap.regency !== undefined ? pick(data, colMap.regency) : '',
      }));
    setCsvPreview(parsed);
    setImportResult(null);
  };

  const handleCsvFileUpload = async (file: File) => {
    setCsvFileName(file.name);
    const text = await file.text();
    setCsvText(text);
    parseCsvPreview(text);
  };

  const executeCsvImport = async () => {
    try {
      const res = await apiPost<{ batchId?: string; inserted: number; skipped: { row?: number; email: string; reason: string }[] }>(
        '/api/personnel/import',
        { rows: csvPreview, fileName: csvFileName }
      );
      setImportResult(res);
      notify(`Impor selesai: ${res.inserted} masuk, ${res.skipped.length} dilewati.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal impor massal.', 'error');
    }
  };

  const handleRollbackBatch = async (batchId: string) => {
    try {
      const res = await apiPost<{ deletedCount: number; retainedCount: number }>(
        `/api/personnel/import-batches/${batchId}/rollback`
      );
      notify(`Rollback selesai: ${res.deletedCount} data baru dihapus, ${res.retainedCount} dipertahankan karena memiliki riwayat/akun.`, 'info');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal melakukan rollback batch.', 'error');
    }
  };

  const handleCreateInvitation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{ activationLink?: string; inviteToken?: string }>('/api/invitations', invForm);
      notify(`Undangan akun untuk ${invForm.fullName} berhasil diterbitkan.`, 'success');
      setLatestInviteLink({ link: res.activationLink, token: res.inviteToken, email: invForm.email });
      setInvModalOpen(false);
      setInvForm({ fullName: '', email: '', role: 'duta', provinceCode: user?.provinceCode || '32', batchId: 'batch-3', personnelId: '' });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menerbitkan undangan.', 'error');
    }
  };

  const handleResendInvite = async (inv: InvitationRecord) => {
    try {
      const res = await apiPost<{ activationLink?: string; inviteToken?: string; resendCount: number }>(
        `/api/invitations/${inv.id}/resend`
      );
      notify(`Undangan dikirim ulang (ke-${res.resendCount}).`, 'success');
      if (res.inviteToken || res.activationLink) {
        setLatestInviteLink({ link: res.activationLink, token: res.inviteToken, email: inv.email });
      }
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim ulang undangan.', 'error');
    }
  };

  const handleCancelInvite = async (inv: InvitationRecord) => {
    try {
      await apiPost(`/api/invitations/${inv.id}/cancel`);
      notify(`Undangan untuk ${inv.email} dibatalkan.`, 'info');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal membatalkan undangan.', 'error');
    }
  };

  const exportCsv = () => {
    const header = 'No Anggota,Nama Lengkap,Provinsi,Sekolah,Jabatan,Status Verifikasi\n';
    const body = filtered
      .map((p) => `"${p.memberNumber}","${p.fullName}","${p.provinceName}","${p.schoolName}","${p.positionTitle}","${p.verificationStatus}"`)
      .join('\n');
    const blob = new Blob([header + body], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'SATU_DPBI_Personalia.csv';
    a.click();
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {user?.role === 'duta' ? 'Profil & Kelengkapan Berkas Pribadi' : 'Personalia & Verifikasi Duta'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Data induk personel terpusat dengan pemisahan identitas, pendidikan, domisili, riwayat kegiatan, dan kontrol akses privasi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {can('personalia', 'export') && (
            <button type="button" onClick={exportCsv} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">
              <Download className="w-3.5 h-3.5" /> Ekspor CSV
            </button>
          )}
          {can('personalia', 'create') && user?.role !== 'duta' && (
            <>
              <button type="button" onClick={() => setReqOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">
                <UserCheck className="w-4 h-4 text-[#0EA5E9]" /> Ajukan Akun Duta
              </button>
              <button type="button" onClick={() => openCreateForm(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
                <Plus className="w-4 h-4" /> Tambah Personel
              </button>
            </>
          )}
        </div>
      </div>

      {/* Segmented Tabs */}
      {user?.role !== 'duta' && (
        <div className="inline-flex flex-wrap p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
          <button type="button" onClick={() => setTab('direktori')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'direktori' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
            Daftar Personel ({personnel.length})
          </button>
          <button type="button" onClick={() => setTab('permintaan')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'permintaan' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
            Permintaan Akun Duta ({requests.length})
          </button>
          <button type="button" onClick={() => setTab('undangan')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'undangan' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
            Undangan Akun ({invitations.length})
          </button>
          {can('personalia', 'create') && (
            <button type="button" onClick={() => setTab('impor')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${tab === 'impor' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
              Impor CSV &amp; Rollback
            </button>
          )}
        </div>
      )}

      {tab === 'direktori' && (
        <GlassCard className="p-5 space-y-4">
          {user?.role !== 'duta' && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama, nomor anggota, atau sekolah..."
                className="flex-1 min-w-[220px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
              />
              <select
                value={provFilter}
                onChange={(e) => setProvFilter(e.target.value)}
                className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">Semua 38 Provinsi</option>
                {INDONESIA_PROVINCES.map((pr) => (
                  <option key={pr.code} value={pr.code}>{pr.name}</option>
                ))}
              </select>
              {['super_admin', 'wakil_super_admin', 'sekretariat_nasional', 'koordinator_wilayah'].includes(user?.role || '') && (
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={includeArchived}
                    onChange={(e) => {
                      setIncludeArchived(e.target.checked);
                      setPage(1);
                    }}
                  />
                  <span>Tampilkan Arsip</span>
                </label>
              )}
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState title="Belum ada data personel" description="Sesuaikan filter pencarian atau tambahkan data personel baru." />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4">Nomor Anggota</th>
                      <th className="py-2.5 pr-4">Nama Lengkap</th>
                      <th className="py-2.5 pr-4">Provinsi & Sekolah</th>
                      <th className="py-2.5 pr-4">Kelengkapan</th>
                      <th className="py-2.5 pr-4">Verifikasi</th>
                      <th className="py-2.5 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {paged.map((p) => (
                      <tr key={p.id} className={`hover:bg-slate-50/70 dark:hover:bg-slate-800/40 ${p.archivedAt ? 'opacity-75' : ''}`}>
                        <td className="py-3 pr-4 font-mono tabular-nums">{p.memberNumber}</td>
                        <td className="py-3 pr-4">
                          <div className="flex items-center gap-2.5">
                            {p.avatarFileId ? (
                              <img
                                src={apiUrl(`/api/files/${p.avatarFileId}/preview`)}
                                alt={p.fullName}
                                className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-[#0EA5E9]/10 text-[#0EA5E9] font-bold text-[11px] flex items-center justify-center shrink-0">
                                {p.fullName.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <div>
                              <p className="font-semibold text-slate-900 dark:text-white">{p.fullName}</p>
                              <p className="text-[11px] text-slate-500">
                                {p.positionTitle} · {p.batchName}
                                {p.archivedAt ? ' · Diarsipkan' : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 pr-4">
                          <p>{p.provinceName}</p>
                          <p className="text-[11px] text-slate-500">{p.schoolName || 'Sekolah belum diisi'}</p>
                        </td>
                        <td className="py-3 pr-4 font-mono tabular-nums">{p.completenessScore}%</td>
                        <td className="py-3 pr-4">
                          <StatusIndicator status={p.archivedAt ? 'diarsipkan' : p.verificationStatus} />
                        </td>
                        <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                          {can('personalia', 'edit') && !p.archivedAt && (
                            <button
                              type="button"
                              onClick={() => openEditForm(p, true)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] text-xs font-semibold"
                            >
                              <Edit3 className="w-3.5 h-3.5" /> Ubah
                            </button>
                          )}
                          {can('personalia', 'edit') && !['duta', 'alumni'].includes(user?.role || '') && (
                            p.archivedAt ? (
                              <button
                                type="button"
                                onClick={() => setConfirmRestore({ id: p.id, fullName: p.fullName })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmArchive({ id: p.id, fullName: p.fullName, reason: '' })}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 text-xs font-semibold"
                              >
                                <Archive className="w-3.5 h-3.5" /> Arsipkan
                              </button>
                            )
                          )}
                          {user?.role === 'super_admin' && (
                            <button
                              type="button"
                              onClick={() => setConfirmDeletePerm({ id: p.id, fullName: p.fullName })}
                              aria-label={`Hapus permanen ${p.fullName}`}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setSelected(p);
                              setDetailTab('identitas');
                              setHistory(null);
                              navigate(`/personalia/${p.id}`);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0EA5E9] hover:text-white text-xs font-semibold transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> Detail
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards (< md) */}
              <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800">
                {paged.map((p) => (
                  <div key={p.id} className={`py-3.5 space-y-2 text-xs ${p.archivedAt ? 'opacity-75' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-[11px] text-[#0EA5E9] tabular-nums">{p.memberNumber}</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{p.fullName}</p>
                        <p className="text-[11px] text-slate-500">
                          {p.positionTitle} · {p.provinceName}
                          {p.archivedAt ? ' · Diarsipkan' : ''}
                        </p>
                      </div>
                      <StatusIndicator status={p.archivedAt ? 'diarsipkan' : p.verificationStatus} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">
                      {p.schoolName || 'Sekolah belum diisi'} · Kelengkapan <span className="font-mono tabular-nums font-semibold">{p.completenessScore}%</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setSelected(p);
                          setDetailTab('identitas');
                          setHistory(null);
                        }}
                        className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                      >
                        <Eye className="w-3.5 h-3.5" /> Detail Profil
                      </button>
                      {can('personalia', 'edit') && !p.archivedAt && (
                        <button
                          type="button"
                          onClick={() => openEditForm(p)}
                          className="min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                        >
                          <Edit3 className="w-3.5 h-3.5" /> Ubah
                        </button>
                      )}
                      {can('personalia', 'edit') && !['duta', 'alumni'].includes(user?.role || '') && (
                        p.archivedAt ? (
                          <button
                            type="button"
                            onClick={() => setConfirmRestore({ id: p.id, fullName: p.fullName })}
                            className="min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-semibold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Pulihkan
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmArchive({ id: p.id, fullName: p.fullName, reason: '' })}
                            className="min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-semibold"
                          >
                            <Archive className="w-3.5 h-3.5" /> Arsipkan
                          </button>
                        )
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </GlassCard>
      )}

      {tab === 'permintaan' && (
        <GlassCard className="p-5 space-y-4">
          <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/70 dark:border-sky-800/60 p-3.5 text-xs space-y-1">
            <p className="font-bold text-slate-900 dark:text-white">
              Jalur 1 Onboarding Duta (Korwil → Verifikasi Sekretariat/Nasional → Undangan Aktivasi)
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Pengurus &amp; Admin juga dapat menerbitkan akun secara langsung melalui <strong>Jalur 2 (Tab Undangan Akun)</strong>. Jika kebijakan persetujuan otomatis aktif di Pengaturan Sistem dan syarat Duta lengkap, token undangan langsung terbit.
            </p>
          </div>
          {issuedToken && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-4 text-xs">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">Token Undangan Satu Kali Pakai Diterbitkan:</p>
              <p className="font-mono mt-1 select-all break-all">{issuedToken}</p>
              <p className="text-emerald-700 dark:text-emerald-300 mt-1">Calon Duta menggunakannya pada halaman Aktivasi Undangan untuk membuat kata sandi sendiri.</p>
            </div>
          )}
          {requests.length === 0 ? (
            <EmptyState title="Belum ada permintaan akun" description="Pengajuan pembuatan akun Duta oleh Koordinator Wilayah akan tampil di sini." />
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {requests.map((r) => {
                const canDecide = r.status === 'menunggu' && ['super_admin', 'wakil_super_admin', 'sekretariat_nasional'].includes(user?.role || '');
                const canResubmit = r.status === 'perlu_revisi' && can('personalia', 'create');
                return (
                  <div key={r.id} className="py-3.5 flex flex-wrap items-start justify-between gap-4 text-xs">
                    <div className="space-y-1 min-w-0 flex-1">
                      <p className="font-mono text-[11px] text-[#0EA5E9]">
                        {r.referenceNumber}
                        {r.revisionCount ? ` · Revisi ke-${r.revisionCount}` : ''}
                        {r.autoApproved ? ' · Disetujui Otomatis' : ''}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{r.fullName}</p>
                      <p className="text-slate-500">
                        {r.email} · {r.provinceName} · {r.schoolName}
                        {r.schoolNpsn ? ` (NPSN ${r.schoolNpsn})` : ''}
                      </p>
                      <p className="text-[11px] text-slate-500">
                        Diajukan oleh: {r.requestedByName}
                        {r.guardianName ? ` · Wali: ${r.guardianName}` : ''}
                      </p>
                      {r.decisionNote && (
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium pt-0.5">
                          Catatan Pemeriksa: {r.decisionNote}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <StatusIndicator status={r.status} />
                      {canDecide && (
                        <>
                          <button type="button" onClick={() => handleDecideReq(r.id, 'disetujui')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">
                            Setujui &amp; Buat Undangan
                          </button>
                          <button
                            type="button"
                            onClick={() => setReqDecisionModal({ id: r.id, fullName: r.fullName, decision: 'perlu_revisi', note: '' })}
                            className="px-3 py-1.5 rounded-lg border border-amber-300 text-amber-700 dark:text-amber-300 font-semibold"
                          >
                            Minta Revisi
                          </button>
                          <button
                            type="button"
                            onClick={() => setReqDecisionModal({ id: r.id, fullName: r.fullName, decision: 'ditolak', note: '' })}
                            className="px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-semibold"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                      {canResubmit && (
                        <button
                          type="button"
                          onClick={() => {
                            setResubmitReqModal(r);
                            setResubmitForm({
                              fullName: r.fullName,
                              phone: r.phone || '',
                              schoolName: r.schoolName || '',
                              schoolNpsn: r.schoolNpsn || '',
                              guardianName: r.guardianName || '',
                              docsChecklist: {
                                pasFoto: Boolean(r.docsChecklist?.pasFoto),
                                kartuPelajar: Boolean(r.docsChecklist?.kartuPelajar),
                                suratSekolah: Boolean(r.docsChecklist?.suratSekolah),
                                izinWali: Boolean(r.docsChecklist?.izinWali),
                              },
                            });
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white font-semibold"
                        >
                          Perbaiki &amp; Ajukan Ulang
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {tab === 'undangan' && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Jalur 2 Onboarding — Undangan Aktivasi Akun Langsung</h2>
              <p className="text-xs text-slate-500">
                Terbitkan tautan aktivasi langsung oleh Pengurus/Sekretariat/Super Admin, pantau status (terkirim, dibuka, aktif, kedaluwarsa, dibatalkan), kirim ulang dengan jeda 60 detik, atau batalkan sebelum dipakai.
              </p>
            </div>
            {can('personalia', 'create') && (
              <button
                type="button"
                onClick={() => setInvModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold"
              >
                <Plus className="w-4 h-4" /> Kirim Undangan Baru
              </button>
            )}
          </div>

          {latestInviteLink && (
            <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 p-4 text-xs space-y-1">
              <p className="font-bold text-emerald-900 dark:text-emerald-200">
                Tautan Aktivasi Undangan untuk {latestInviteLink.email}:
              </p>
              {latestInviteLink.link && <p className="font-mono select-all break-all">{latestInviteLink.link}</p>}
              {latestInviteLink.token && <p className="font-mono select-all break-all">Token: {latestInviteLink.token}</p>}
            </div>
          )}

          {invitations.length === 0 ? (
            <EmptyState title="Belum ada undangan" description="Kirim undangan akun untuk personel yang telah disetujui." />
          ) : (
            <div className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
              {invitations.map((inv) => {
                const canModify = inv.status !== 'aktif' && inv.status !== 'dibatalkan';
                return (
                  <div key={inv.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <p className="font-bold text-slate-900 dark:text-white">{inv.fullName}</p>
                      <p className="text-slate-500">
                        {inv.email} · {inv.roleLabel || ROLE_LABELS[inv.role]} · {inv.provinceName || 'Nasional'}
                      </p>
                      <p className="text-[11px] text-slate-400 tabular-nums">
                        Kirim ulang: {inv.resendCount}x · Terakhir: {formatTanggalIndonesia(inv.lastSentAt || inv.createdAt, true)} · Kedaluwarsa:{' '}
                        {formatTanggalIndonesia(inv.expiresAt, true)}
                        {inv.openedAt ? ` · Dibuka: ${formatTanggalIndonesia(inv.openedAt, true)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusIndicator status={inv.status} />
                      {canModify && can('personalia', 'create') && (
                        <button
                          type="button"
                          onClick={() => handleResendInvite(inv)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] font-semibold"
                        >
                          Kirim Ulang
                        </button>
                      )}
                      {canModify && can('personalia', 'edit') && (
                        <button
                          type="button"
                          onClick={() => handleCancelInvite(inv)}
                          className="px-2.5 py-1.5 rounded-lg border border-rose-200 text-rose-600 font-semibold"
                        >
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlassCard>
      )}

      {tab === 'impor' && (
        <div className="space-y-5">
          <GlassCard className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-bold flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#0EA5E9]" /> Wizard Impor Personel CSV (Templat → Pemetaan → Validasi → Transaksi)
              </h2>
              <a
                href={apiUrl('/api/personnel/import-template')}
                download="template-impor-personel-satu-dpbi.csv"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-[#0EA5E9]"
              >
                <Download className="w-3.5 h-3.5 text-[#0EA5E9]" /> Unduh Templat CSV Resmi
              </a>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 cursor-pointer hover:border-[#0EA5E9]">
                <Upload className="w-3.5 h-3.5 text-[#0EA5E9]" />
                <span>Pilih File CSV ({csvFileName})</span>
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleCsvFileUpload(f);
                  }}
                />
              </label>
              <span className="text-slate-500">atau tempel teks CSV di bawah ini:</span>
            </div>

            <textarea
              rows={5}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 font-mono text-xs"
            />

            {csvHeaders.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800">
                {(
                  [
                    ['fullName', 'Kolom Nama *'],
                    ['email', 'Kolom Email *'],
                    ['provinceCode', 'Kolom Kode Prov'],
                    ['schoolName', 'Kolom Sekolah'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">{label}</label>
                    <select
                      value={csvColumnMap[field] ?? 0}
                      onChange={(e) => {
                        const next = { ...csvColumnMap, [field]: Number(e.target.value) };
                        setCsvColumnMap(next);
                        parseCsvPreview(csvText, next);
                      }}
                      className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                    >
                      {csvHeaders.map((h, idx) => (
                        <option key={`${field}-${idx}`} value={idx}>
                          {h || `Kolom ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => parseCsvPreview()} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold">
                1. Preview &amp; Petakan Kolom
              </button>
              {csvPreview.length > 0 && (
                <button type="button" onClick={executeCsvImport} className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
                  2. Konfirmasi &amp; Jalankan Impor ({csvPreview.length} Baris)
                </button>
              )}
            </div>
            {csvPreview.length > 0 && (
              <div className="text-xs border rounded-xl p-3 border-slate-200 dark:border-slate-800 space-y-1">
                {csvPreview.map((row, idx) => (
                  <p key={idx}>
                    {idx + 1}. {row.fullName} · {row.email} · Prov {row.provinceCode} · {row.schoolName} {row.nisn ? `· NISN ${row.nisn}` : ''}
                  </p>
                ))}
              </div>
            )}
            {importResult && (
              <div className="text-xs rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 space-y-1">
                <p className="font-semibold">Hasil Impor: {importResult.inserted} personel berhasil masuk, {importResult.skipped.length} dilewati.</p>
                {importResult.skipped.map((s, i) => (
                  <p key={i} className="text-amber-600">
                    {s.row ? `Baris ${s.row} · ` : ''}{s.email}: {s.reason}
                  </p>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat Batch Impor &amp; Rollback Aman</h3>
            {importBatches.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada riwayat batch impor CSV.</p>
            ) : (
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {importBatches.map((b) => (
                  <div key={b.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white">{b.file_name || b.fileName}</p>
                      <p className="text-slate-500">
                        Oleh {b.imported_by_name || b.importedByName} · Masuk: {b.success_count ?? b.successCount} · Dilewati: {b.skipped_count ?? b.skippedCount} ·{' '}
                        {formatTanggalIndonesia(b.created_at || b.createdAt, true)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={b.status} />
                      {b.status !== 'dibatalkan_rollback' && can('personalia', 'manage') && (
                        <button
                          type="button"
                          onClick={() => handleRollbackBatch(b.id)}
                          className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 font-semibold"
                        >
                          Rollback Batch
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {/* Multi-Tab Detail & Verification Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          navigate('/personalia');
        }}
        title={selected?.fullName || 'Detail Profil'}
        subtitle={selected ? `${selected.memberNumber} · ${selected.referenceNumber} · Kelengkapan ${selected.completenessScore}%` : ''}
        maxWidth="max-w-3xl"
      >
        {selected && (
          <div className="space-y-5 text-xs">
            {/* Profile Header & Avatar */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3.5">
                {selected.avatarFileId ? (
                  <img
                    src={apiUrl(`/api/files/${selected.avatarFileId}/preview`)}
                    alt={`Foto profil ${selected.fullName}`}
                    className="w-14 h-14 rounded-2xl object-cover border border-slate-200 dark:border-slate-700"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-2xl bg-[#0EA5E9]/10 text-[#0EA5E9] font-bold text-lg flex items-center justify-center">
                    {selected.fullName.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="text-base font-bold text-slate-900 dark:text-white">{selected.fullName}</p>
                  <p className="text-slate-500">{selected.positionTitle} · {selected.provinceName}</p>
                  <div className="mt-1">
                    <StatusIndicator status={selected.verificationStatus} />
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPrintConfig({
                      template: 'arsip',
                      documentNumber: selected.referenceNumber || selected.memberNumber,
                      title: `Ringkasan Profil Personel — ${selected.fullName}`,
                      subtitle: `${selected.positionTitle} · ${selected.batchName}`,
                      issuedDate: new Date().toISOString().slice(0, 10),
                      metadata: [
                        { label: 'Nomor Anggota', value: selected.memberNumber },
                        { label: 'Provinsi Domisili', value: selected.provinceName },
                        { label: 'Provinsi Penugasan', value: selected.assignmentProvinceName || selected.provinceName },
                        { label: 'Sekolah', value: selected.schoolName || '—' },
                        { label: 'Status Verifikasi', value: selected.verificationStatus.replace(/_/g, ' ') },
                        { label: 'Kelengkapan', value: `${selected.completenessScore}%` },
                      ],
                      sections: [
                        {
                          heading: 'Identitas & Bidang Tugas',
                          body: `Jabatan: ${selected.positionTitle}\nBidang: ${selected.bidang || 'Umum'}\nAngkatan: ${selected.batchName}\nMinat Budaya: ${selected.culturalInterests || '—'}`,
                        },
                        {
                          heading: 'Pendidikan & Pengalaman',
                          body: `Sekolah: ${selected.schoolName || '—'} (${selected.educationLevel} Kelas ${selected.gradeClass})\nKabupaten/Kota: ${selected.regency || '—'}\nPengalaman Organisasi: ${selected.orgExperience || '—'}`,
                        },
                      ],
                      signatoryName: user?.fullName || 'Sekretariat Nasional DPBI',
                      signatoryRole: user?.roleLabel || 'Pengurus DPBI',
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] font-semibold"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0EA5E9]" /> Cetak Ringkasan A4
                </button>
                {can('personalia', 'edit') && (
                  <button
                    type="button"
                    onClick={() => openEditForm(selected)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] font-semibold"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Ubah Data Profil
                  </button>
                )}
              </div>
            </div>

            {/* Detail Section Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
              {(
                [
                  ['identitas', 'Identitas'],
                  ['pendidikan', 'Pendidikan'],
                  ['domisili', 'Domisili & Wali'],
                  ['penugasan', 'Jabatan & Masa Tugas'],
                  ['dokumen', 'Dokumen & Verifikasi'],
                  ['riwayat', 'Riwayat Kegiatan & Organisasi'],
                ] as [DetailTab, string][]
              ).map(([k, lbl]) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDetailTab(k)}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                    detailTab === k ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {detailTab === 'identitas' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p><span className="text-slate-500">Nama Panggilan:</span> {selected.nickname || '—'}</p>
                  <p><span className="text-slate-500">Tempat, Tanggal Lahir:</span> {selected.birthPlace}, {selected.birthDate}</p>
                  <p><span className="text-slate-500">Jenis Kelamin:</span> {selected.gender || '—'}</p>
                  <p><span className="text-slate-500">Email Resmi:</span> {selected.email}</p>
                  <p><span className="text-slate-500">Nomor Telepon:</span> {selected.phone}</p>
                </div>
                <div className="space-y-2">
                  <p><span className="text-slate-500">Minat Budaya:</span> {selected.culturalInterests || '—'}</p>
                  <p><span className="text-slate-500">Minat Kegiatan:</span> {selected.activityInterests || '—'}</p>
                  <p><span className="text-slate-500">Keahlian:</span> {selected.skills || '—'}</p>
                </div>
              </div>
            )}

            {detailTab === 'pendidikan' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p><span className="text-slate-500">Asal Sekolah:</span> {selected.schoolName || '—'}</p>
                  <p><span className="text-slate-500">Jenjang / Kelas:</span> {selected.educationLevel} · Kelas {selected.gradeClass}</p>
                  <p><span className="text-slate-500">Jurusan / Peminatan:</span> {selected.major || '—'}</p>
                </div>
                <div className="space-y-2">
                  <p><span className="text-slate-500">NPSN:</span> <span className="font-mono tabular-nums">{selected.npsn || '—'}</span></p>
                  <p><span className="text-slate-500">NISN (Terbatas):</span> <span className="font-mono tabular-nums">{selected.nisn || '—'}</span></p>
                  <p><span className="text-slate-500">Tahun Masuk / Lulus:</span> <span className="tabular-nums">{selected.entryYear} / {selected.expectedGradYear}</span></p>
                </div>
              </div>
            )}

            {detailTab === 'domisili' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="font-bold text-slate-900 dark:text-white">Domisili & Wilayah</p>
                  <p><span className="text-slate-500">Provinsi:</span> {selected.provinceName}</p>
                  <p><span className="text-slate-500">Kabupaten / Kota:</span> {selected.regency || '—'}</p>
                  <p><span className="text-slate-500">Kecamatan / Kelurahan:</span> {selected.district || '—'} / {selected.village || '—'}</p>
                  <p><span className="text-slate-500">Alamat Lengkap (Terbatas):</span> {selected.fullAddress}</p>
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-slate-900 dark:text-white">Kontak Orang Tua / Wali (Terbatas)</p>
                  <p><span className="text-slate-500">Nama Wali:</span> {selected.guardianName} ({selected.guardianRelation})</p>
                  <p><span className="text-slate-500">Kontak Wali:</span> {selected.guardianPhone}</p>
                </div>
              </div>
            )}

            {detailTab === 'penugasan' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p><span className="text-slate-500">Nomor Anggota:</span> <span className="font-mono tabular-nums">{selected.memberNumber}</span></p>
                  <p><span className="text-slate-500">Angkatan:</span> {selected.batchName}</p>
                  <p><span className="text-slate-500">Jabatan:</span> {selected.positionTitle}</p>
                  <p><span className="text-slate-500">Bidang:</span> {selected.bidang || 'Umum'}</p>
                </div>
                <div className="space-y-2">
                  <p><span className="text-slate-500">Status Keaktifan:</span> <StatusIndicator status={selected.personnelStatus} /></p>
                  <p><span className="text-slate-500">Tanggal Penetapan:</span> {selected.appointedAt || '—'}</p>
                  <p><span className="text-slate-500">Masa Tugas:</span> {selected.termStartsAt || '—'} s/d {selected.termEndsAt || '—'}</p>
                </div>
              </div>
            )}

            {detailTab === 'dokumen' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <p className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-[#0EA5E9]" /> Pas Foto: {selected.docsChecklist.pasFoto ? 'Lengkap' : 'Belum'}</p>
                  <p className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-[#0EA5E9]" /> Kartu Pelajar: {selected.docsChecklist.kartuPelajar ? 'Lengkap' : 'Belum'}</p>
                  <p className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-[#0EA5E9]" /> Surat Rekomendasi Sekolah: {selected.docsChecklist.suratSekolah ? 'Lengkap' : 'Belum'}</p>
                  <p className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-[#0EA5E9]" /> Surat Izin Orang Tua/Wali: {selected.docsChecklist.izinWali ? 'Lengkap' : 'Belum'}</p>
                  <p className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-[#0EA5E9]" /> Surat Kesediaan Mengabdi: {selected.docsChecklist.suratKesediaan ? 'Lengkap' : 'Belum'}</p>
                </div>
                {selected.verificationNote && (
                  <p className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 text-slate-600 dark:text-slate-300">
                    <strong>Catatan Verifikasi Terakhir:</strong> {selected.verificationNote}
                  </p>
                )}
                {can('personalia', 'review') && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                    <p className="font-bold text-slate-900 dark:text-white">Verifikasi Berkas & Status Profil</p>
                    <input
                      type="text"
                      value={verifyNote}
                      onChange={(e) => setVerifyNote(e.target.value)}
                      placeholder="Catatan pemeriksaan verifikasi..."
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => handleVerify(selected.id, 'terverifikasi')} className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">
                        Tandai Terverifikasi
                      </button>
                      <button type="button" onClick={() => handleVerify(selected.id, 'perlu_perbaikan')} className="px-3.5 py-2 rounded-xl bg-amber-500 text-white font-semibold">
                        Perlu Perbaikan
                      </button>
                      <button type="button" onClick={() => handleVerify(selected.id, 'tidak_valid')} className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-semibold">
                        Tidak Valid
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'riwayat' && (
              <div className="space-y-4">
                <div>
                  <p className="font-bold text-slate-900 dark:text-white mb-1">Pengalaman Organisasi Tercatat</p>
                  <p className="text-slate-600 dark:text-slate-300">{selected.orgExperience || 'Belum ada catatan pengalaman organisasi.'}</p>
                </div>
                {historyLoading ? (
                  <LoadingSkeleton rows={3} />
                ) : history ? (
                  <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white mb-1">Riwayat Proposal ({history.proposals.length})</p>
                      {history.proposals.length === 0 ? (
                        <p className="text-slate-500">Belum ada proposal yang diajukan.</p>
                      ) : (
                        <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
                          {history.proposals.map((pr) => (
                            <div key={pr.id} className="py-1.5 flex items-center justify-between gap-2">
                              <span><span className="font-mono text-[#0EA5E9]">{pr.reference_number}</span> · {pr.title}</span>
                              <StatusIndicator status={pr.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white mb-1">Riwayat LKL ({history.lkl.length})</p>
                      {history.lkl.length === 0 ? (
                        <p className="text-slate-500">Belum ada LKL yang dikirim.</p>
                      ) : (
                        <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
                          {history.lkl.map((l) => (
                            <div key={l.id} className="py-1.5 flex items-center justify-between gap-2">
                              <span><span className="font-mono text-[#0EA5E9]">{l.reference_number}</span> · {l.activity_name} ({l.participant_count} peserta)</span>
                              <StatusIndicator status={l.status} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {history.evaluations.length > 0 && (
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white mb-1">Riwayat Evaluasi ({history.evaluations.length})</p>
                        {history.evaluations.map((ev) => (
                          <p key={ev.id} className="text-slate-600 dark:text-slate-300">
                            Skor <span className="font-mono font-bold tabular-nums">{ev.total_score}</span> · {ev.coaching_recommendation} · oleh {ev.evaluator_name} ({formatTanggalIndonesia(ev.created_at)})
                          </p>
                        ))}
                      </div>
                    )}
                    <div>
                      <p className="font-bold text-slate-900 dark:text-white mb-1">
                        Riwayat Jabatan &amp; Mutasi Organisasi ({history.positionHistory?.length ?? 0})
                      </p>
                      {!history.positionHistory || history.positionHistory.length === 0 ? (
                        <p className="text-slate-500">Belum ada catatan mutasi jabatan organisasi.</p>
                      ) : (
                        <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
                          {history.positionHistory.map((ph) => (
                            <div key={ph.id} className="py-1.5 flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {ph.position_title} ({ph.bidang})
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {ph.change_reason} · {ph.sk_number ? `SK: ${ph.sk_number} · ` : ''}oleh {ph.actor_name}
                                </p>
                              </div>
                              <span className="text-[11px] text-slate-500 tabular-nums">
                                {formatTanggalIndonesia(ph.started_at)} – {ph.ended_at ? formatTanggalIndonesia(ph.ended_at) : 'Aktif'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Multi-Step Add / Edit Personnel Modal */}
      <Modal
        open={Boolean(formMode)}
        onClose={attemptCloseForm}
        title={formMode === 'edit' ? 'Ubah Profil Personel DPBI' : 'Tambah Personel Induk DPBI'}
        subtitle={`Langkah ${formStep} dari 3`}
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSavePerson} className="space-y-4 text-xs">
          <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            {([1, 2, 3] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setFormStep(s)}
                className={`flex-1 py-1.5 rounded-lg font-semibold transition-colors ${
                  formStep === s ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                }`}
              >
                {s === 1 ? '1. Identitas & Foto' : s === 2 ? '2. Pendidikan & Domisili' : '3. Wali & Kelengkapan'}
              </button>
            ))}
          </div>

          <FormErrorSummary errors={formErrors} />

          {formStep === 1 && (
            <div className="space-y-3">
              {duplicates.length > 0 && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 p-3 space-y-1 text-amber-900 dark:text-amber-200"
                >
                  <p className="font-bold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" /> Kemungkinan Duplikasi Personel Terdeteksi
                  </p>
                  {duplicates.map((d) => (
                    <p key={d.id} className="text-[11px]">
                      {d.fullName} ({d.memberNumber} · {d.provinceName}) — {d.reason}
                    </p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nama Lengkap *</label>
                  <input required value={personForm.fullName} onChange={(e) => updateForm({ fullName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Email Resmi *</label>
                  <input type="email" required disabled={formMode === 'edit'} value={personForm.email} onChange={(e) => updateForm({ email: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 disabled:opacity-60" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tempat Lahir</label>
                  <input value={personForm.birthPlace} onChange={(e) => updateForm({ birthPlace: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Tanggal Lahir</label>
                  <input type="date" value={personForm.birthDate} onChange={(e) => updateForm({ birthDate: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nomor Telepon / WhatsApp</label>
                  <input value={personForm.phone} onChange={(e) => updateForm({ phone: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Provinsi Domisili</label>
                  <select
                    disabled={formMode === 'edit'}
                    value={personForm.provinceCode}
                    onChange={(e) => {
                      updateForm({ provinceCode: e.target.value, regencyCode: '', regency: '', district: '', village: '' });
                      setSelectedDistrictCode('');
                    }}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 disabled:opacity-60"
                  >
                    {INDONESIA_PROVINCES.map((pr) => <option key={pr.code} value={pr.code}>{pr.name}</option>)}
                  </select>
                </div>
              </div>
              <FileDropzone
                label="Foto Profil Duta (JPG / PNG / WebP)"
                accept="image/png,image/jpeg,image/webp"
                moduleName="personalia_avatar"
                uploadedFileName={personForm.avatarFileName}
                onUploaded={(f) => updateForm({ avatarFileId: f.fileId, avatarFileName: f.fileName })}
              />
            </div>
          )}

          {formStep === 2 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nama Sekolah *</label>
                  <input required value={personForm.schoolName} onChange={(e) => updateForm({ schoolName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Jenjang &amp; Kelas</label>
                  <input value={personForm.gradeClass} onChange={(e) => updateForm({ gradeClass: e.target.value })} placeholder="Misal: XI" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">NPSN</label>
                  <input value={personForm.npsn} onChange={(e) => updateForm({ npsn: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">NISN</label>
                  <input value={personForm.nisn} onChange={(e) => updateForm({ nisn: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Provinsi Penugasan DPBI</label>
                  <select
                    value={personForm.assignmentProvinceCode}
                    onChange={(e) => updateForm({ assignmentProvinceCode: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  >
                    {INDONESIA_PROVINCES.map((pr) => (
                      <option key={pr.code} value={pr.code}>{pr.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={manualLocation}
                      onChange={(e) => setManualLocation(e.target.checked)}
                    />
                    <span>Ketik manual jika daerah belum ada di daftar</span>
                  </label>
                </div>
              </div>

              {!manualLocation && cascadeRegencies.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Kabupaten / Kota (Domisili)</label>
                    <select
                      value={personForm.regencyCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        const found = cascadeRegencies.find((r) => r.code === code);
                        setSelectedDistrictCode('');
                        updateForm({ regencyCode: code, regency: found?.name || '', district: '', village: '' });
                      }}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                    >
                      <option value="">Pilih Kab/Kota...</option>
                      {cascadeRegencies.map((r) => (
                        <option key={r.code} value={r.code}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Kecamatan</label>
                    <select
                      value={selectedDistrictCode}
                      onChange={(e) => {
                        const code = e.target.value;
                        setSelectedDistrictCode(code);
                        const found = cascadeDistricts.find((d) => d.code === code);
                        updateForm({ district: found?.name || '', village: '' });
                      }}
                      disabled={cascadeDistricts.length === 0}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 disabled:opacity-60"
                    >
                      <option value="">{cascadeDistricts.length > 0 ? 'Pilih Kecamatan...' : 'Isi manual / belum tersedia'}</option>
                      {cascadeDistricts.map((d) => (
                        <option key={d.code} value={d.code}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Desa / Kelurahan</label>
                    <select
                      value={personForm.village}
                      onChange={(e) => updateForm({ village: e.target.value })}
                      disabled={cascadeVillages.length === 0}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 disabled:opacity-60"
                    >
                      <option value="">{cascadeVillages.length > 0 ? 'Pilih Kelurahan/Desa...' : 'Isi manual / belum tersedia'}</option>
                      {cascadeVillages.map((v) => (
                        <option key={v.code} value={v.name}>{v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Kabupaten / Kota</label>
                    <input value={personForm.regency} onChange={(e) => updateForm({ regency: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Kecamatan</label>
                    <input value={personForm.district} onChange={(e) => updateForm({ district: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Desa / Kelurahan</label>
                    <input value={personForm.village} onChange={(e) => updateForm({ village: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                  </div>
                </div>
              )}

              <div>
                <label className="block font-semibold mb-1">Alamat Domisili Lengkap</label>
                <input value={personForm.fullAddress} onChange={(e) => updateForm({ fullAddress: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
            </div>
          )}

          {formStep === 3 && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Nama Orang Tua / Wali</label>
                  <input value={personForm.guardianName} onChange={(e) => updateForm({ guardianName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Nomor Kontak Wali</label>
                  <input value={personForm.guardianPhone} onChange={(e) => updateForm({ guardianPhone: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Minat Budaya & Keahlian</label>
                  <input value={personForm.culturalInterests} onChange={(e) => updateForm({ culturalInterests: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Pengalaman Organisasi</label>
                  <input value={personForm.orgExperience} onChange={(e) => updateForm({ orgExperience: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4 pt-2">
                {(['pasFoto', 'kartuPelajar', 'suratSekolah', 'izinWali', 'suratKesediaan'] as const).map((k) => (
                  <label key={k} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={personForm.docsChecklist[k]}
                      onChange={(e) => updateForm({ docsChecklist: { ...personForm.docsChecklist, [k]: e.target.checked } })}
                    />
                    <span>{k}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={attemptCloseForm}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
            >
              Batal
            </button>
            <div className="flex items-center gap-2">
              {formStep > 1 && (
                <button
                  type="button"
                  onClick={() => setFormStep((prev) => (prev === 3 ? 2 : 1))}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Sebelumnya
                </button>
              )}
              {formStep < 3 ? (
                <button
                  type="button"
                  onClick={() => setFormStep((prev) => (prev === 1 ? 2 : 3))}
                  className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold"
                >
                  Lanjut
                </button>
              ) : (
                <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold disabled:opacity-60">
                  {saving ? 'Menyimpan...' : formMode === 'edit' ? 'Simpan Perubahan' : 'Simpan Data Induk'}
                </button>
              )}
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmDiscardOpen}
        title="Buang Perubahan Belum Disimpan?"
        message="Anda memiliki perubahan formulir yang belum disimpan. Yakin ingin menutup formulir?"
        confirmLabel="Ya, Tutup Formulir"
        danger
        onConfirm={() => {
          setConfirmDiscardOpen(false);
          setFormDirty(false);
          setFormMode(null);
          navigate('/personalia');
        }}
        onCancel={() => setConfirmDiscardOpen(false)}
      />

      {/* Account Request Modal */}
      <Modal open={reqOpen} onClose={() => setReqOpen(false)} title="Ajukan Permintaan Akun Duta Baru (Jalur 1)">
        <form onSubmit={handleCreateReq} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Nama Calon Duta *</label>
            <input required value={newReq.fullName} onChange={(e) => setNewReq({ ...newReq, fullName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Email *</label>
              <input type="email" required value={newReq.email} onChange={(e) => setNewReq({ ...newReq, email: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Telepon / WhatsApp *</label>
              <input required value={newReq.phone} onChange={(e) => setNewReq({ ...newReq, phone: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Provinsi *</label>
              <select value={newReq.provinceCode} onChange={(e) => setNewReq({ ...newReq, provinceCode: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                {INDONESIA_PROVINCES.map((pr) => <option key={pr.code} value={pr.code}>{pr.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Asal Sekolah *</label>
              <input required value={newReq.schoolName} onChange={(e) => setNewReq({ ...newReq, schoolName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">NPSN Sekolah (Opsional)</label>
              <input value={newReq.schoolNpsn} onChange={(e) => setNewReq({ ...newReq, schoolNpsn: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Nama Orang Tua / Wali</label>
              <input value={newReq.guardianName} onChange={(e) => setNewReq({ ...newReq, guardianName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>
          <div className="pt-1 space-y-1.5">
            <p className="font-semibold text-slate-700 dark:text-slate-300">Kelengkapan Berkas Calon Duta:</p>
            <div className="flex flex-wrap gap-3">
              {(
                [
                  ['pasFoto', 'Pas Foto'],
                  ['kartuPelajar', 'Kartu Pelajar'],
                  ['suratSekolah', 'Surat Sekolah'],
                  ['izinWali', 'Izin Orang Tua/Wali'],
                ] as const
              ).map(([k, lbl]) => (
                <label key={k} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(newReq.docsChecklist[k])}
                    onChange={(e) =>
                      setNewReq({
                        ...newReq,
                        docsChecklist: { ...newReq.docsChecklist, [k]: e.target.checked },
                      })
                    }
                  />
                  <span>{lbl}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setReqOpen(false)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold">Batal</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Kirim Permintaan Akun</button>
          </div>
        </form>
      </Modal>

      {/* Account Request Revision / Reject Modal */}
      <Modal
        open={Boolean(reqDecisionModal)}
        onClose={() => setReqDecisionModal(null)}
        title={reqDecisionModal?.decision === 'perlu_revisi' ? 'Minta Revisi Permintaan Akun Duta' : 'Tolak Permintaan Akun Duta'}
        subtitle={reqDecisionModal?.fullName || ''}
      >
        {reqDecisionModal && (
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!reqDecisionModal.note.trim()) {
                notify('Alasan atau catatan pemeriksa wajib diisi.', 'error');
                return;
              }
              const target = reqDecisionModal;
              setReqDecisionModal(null);
              await handleDecideReq(target.id, target.decision, target.note);
            }}
            className="space-y-3 text-xs"
          >
            <div>
              <label className="block font-semibold mb-1">
                {reqDecisionModal.decision === 'perlu_revisi' ? 'Catatan Bagian yang Perlu Diperbaiki *' : 'Alasan Penolakan *'}
              </label>
              <textarea
                rows={4}
                required
                value={reqDecisionModal.note}
                onChange={(e) => setReqDecisionModal({ ...reqDecisionModal, note: e.target.value })}
                placeholder="Tuliskan penjelasan yang jelas agar Koordinator Wilayah dapat menindaklanjuti..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReqDecisionModal(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold">Batal</button>
              <button
                type="submit"
                className={`px-4 py-2 rounded-xl text-white font-semibold ${
                  reqDecisionModal.decision === 'perlu_revisi' ? 'bg-amber-600' : 'bg-rose-600'
                }`}
              >
                {reqDecisionModal.decision === 'perlu_revisi' ? 'Kembalikan untuk Revisi' : 'Tolak Permintaan'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Account Request Resubmit Modal */}
      <Modal
        open={Boolean(resubmitReqModal)}
        onClose={() => setResubmitReqModal(null)}
        title="Perbaiki & Ajukan Ulang Permintaan Akun Duta"
        subtitle={resubmitReqModal?.referenceNumber || ''}
      >
        {resubmitReqModal && (
          <form onSubmit={handleResubmitReq} className="space-y-3 text-xs">
            {resubmitReqModal.decisionNote && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 text-amber-800 dark:text-amber-200">
                <p className="font-bold">Catatan Revisi Pemeriksa:</p>
                <p className="mt-0.5">{resubmitReqModal.decisionNote}</p>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">Nama Calon Duta *</label>
                <input required value={resubmitForm.fullName} onChange={(e) => setResubmitForm({ ...resubmitForm, fullName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Telepon / WhatsApp *</label>
                <input required value={resubmitForm.phone} onChange={(e) => setResubmitForm({ ...resubmitForm, phone: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Asal Sekolah *</label>
                <input required value={resubmitForm.schoolName} onChange={(e) => setResubmitForm({ ...resubmitForm, schoolName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">NPSN Sekolah</label>
                <input value={resubmitForm.schoolNpsn} onChange={(e) => setResubmitForm({ ...resubmitForm, schoolNpsn: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono" />
              </div>
            </div>
            <div>
              <label className="block font-semibold mb-1">Nama Orang Tua / Wali</label>
              <input value={resubmitForm.guardianName} onChange={(e) => setResubmitForm({ ...resubmitForm, guardianName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div className="flex flex-wrap gap-3 pt-1">
              {(
                [
                  ['pasFoto', 'Pas Foto'],
                  ['kartuPelajar', 'Kartu Pelajar'],
                  ['suratSekolah', 'Surat Sekolah'],
                  ['izinWali', 'Izin Orang Tua/Wali'],
                ] as const
              ).map(([k, lbl]) => (
                <label key={k} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(resubmitForm.docsChecklist[k])}
                    onChange={(e) =>
                      setResubmitForm({
                        ...resubmitForm,
                        docsChecklist: { ...resubmitForm.docsChecklist, [k]: e.target.checked },
                      })
                    }
                  />
                  <span>{lbl}</span>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setResubmitReqModal(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold">Batal</button>
              <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Simpan &amp; Ajukan Ulang</button>
            </div>
          </form>
        )}
      </Modal>

      {/* Archive Personnel Modal */}
      <Modal
        open={Boolean(confirmArchive)}
        onClose={() => setConfirmArchive(null)}
        title="Arsipkan Data Personel?"
        subtitle={confirmArchive?.fullName || ''}
      >
        {confirmArchive && (
          <div className="space-y-3 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Data yang diarsipkan akan disembunyikan dari direktori operasional harian namun seluruh riwayat proposal, LKL, dan evaluasinya tetap terjaga dan dapat dipulihkan sewaktu-waktu.
            </p>
            <div>
              <label className="block font-semibold mb-1">Alasan Pengarsipan</label>
              <input
                value={confirmArchive.reason}
                onChange={(e) => setConfirmArchive({ ...confirmArchive, reason: e.target.value })}
                placeholder="Misal: Selesai masa tugas / pindah domisili"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setConfirmArchive(null)} className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold">Batal</button>
              <button type="button" onClick={handleArchivePerson} className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold">Ya, Arsipkan</button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmRestore)}
        title="Pulihkan Personel dari Arsip?"
        message={confirmRestore ? `Kembalikan ${confirmRestore.fullName} ke daftar direktori personel aktif?` : ''}
        confirmLabel="Ya, Pulihkan"
        onConfirm={handleRestorePerson}
        onCancel={() => setConfirmRestore(null)}
      />

      <ConfirmDialog
        open={Boolean(confirmDeletePerm)}
        title="Hapus Permanen Data Personel?"
        message={
          confirmDeletePerm
            ? `Hapus permanen data ${confirmDeletePerm.fullName}? Operasi ini hanya diizinkan jika personel belum memiliki riwayat akun, proposal, LKL, atau evaluasi terkait.`
            : ''
        }
        confirmLabel="Ya, Hapus Permanen"
        danger
        onConfirm={handleDeletePersonPerm}
        onCancel={() => setConfirmDeletePerm(null)}
      />

      <Modal open={invModalOpen} onClose={() => setInvModalOpen(false)} title="Kirim Undangan Aktivasi Akun Resmi">
        <form onSubmit={handleCreateInvitation} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Tautkan ke Personel Induk (Opsional)</label>
            <select
              value={invForm.personnelId}
              onChange={(e) => {
                const p = personnel.find((item) => item.id === e.target.value);
                setInvForm((f) => ({
                  ...f,
                  personnelId: e.target.value,
                  fullName: p ? p.fullName : f.fullName,
                  email: p ? p.email : f.email,
                  provinceCode: p ? p.provinceCode : f.provinceCode,
                }));
              }}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              <option value="">-- Buat undangan mandiri --</option>
              {personnel.filter((p) => !p.userId).map((p) => (
                <option key={p.id} value={p.id}>{p.fullName} ({p.memberNumber})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Nama Lengkap *</label>
              <input required value={invForm.fullName} onChange={(e) => setInvForm({ ...invForm, fullName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Email Penerima *</label>
              <input type="email" required value={invForm.email} onChange={(e) => setInvForm({ ...invForm, email: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Peran Sistem (RBAC)</label>
              <select value={invForm.role} onChange={(e) => setInvForm({ ...invForm, role: e.target.value as RoleCode })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                <option value="duta">Duta Pelajar</option>
                <option value="koordinator_wilayah">Koordinator Wilayah</option>
                <option value="pengurus_nasional">Pengurus Nasional</option>
                <option value="sekretariat_nasional">Sekretariat Nasional</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Provinsi</label>
              <select value={invForm.provinceCode} onChange={(e) => setInvForm({ ...invForm, provinceCode: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                {INDONESIA_PROVINCES.map((pr) => <option key={pr.code} value={pr.code}>{pr.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setInvModalOpen(false)} className="px-4 py-2 rounded-xl border font-semibold">Batal</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Terbitkan &amp; Kirim Undangan</button>
          </div>
        </form>
      </Modal>

      <A4PrintModal open={Boolean(printConfig)} config={printConfig} onClose={() => setPrintConfig(null)} />
    </div>
  );
}
