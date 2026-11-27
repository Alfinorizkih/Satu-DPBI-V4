import React, { useEffect, useState } from 'react';
import { AlertTriangle, Calendar, CheckSquare, Download, Edit3, Eye, FileText, History, Info, Plus, Printer, Send } from 'lucide-react';
import { apiGet, apiPatch, apiPost, apiUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import {
  ConfirmDialog,
  EmptyState,
  FileDropzone,
  GlassCard,
  LoadingSkeleton,
  Modal,
  Pagination,
  StatusIndicator,
} from '../components/ui';
import { A4PrintModal, type PrintDocumentConfig } from '../components/print/A4PrintEngine';
import type { FlagshipProgramRecord, ProposalRecord } from '../lib/types';
import { formatTanggalIndonesia, OFFICIAL_BIDANGS, ROLE_LABELS } from '../lib/rbac';
import { clearOfflineDraft, loadOfflineDraft, saveOfflineDraft } from '../lib/offlineDraft';

const PAGE_SIZE = 10;

function getNextActionSummary(p: ProposalRecord): string {
  switch (p.status) {
    case 'draft':
      return 'Langkah Berikutnya: Lengkapi rincian kegiatan dan klik "Kirim Pengajuan" agar dapat diperiksa peninjau.';
    case 'diajukan':
    case 'pemeriksaan_administrasi':
    case 'pemeriksaan_wilayah':
    case 'menunggu_persetujuan_nasional':
      return `Langkah Berikutnya: Menunggu pemeriksaan & keputusan dari ${ROLE_LABELS[p.assignedApproverRole] || p.assignedApproverRole.replace(/_/g, ' ')}.`;
    case 'perlu_revisi':
      return 'Langkah Berikutnya: Pengaju wajib mengunggah revisi PDF sesuai catatan pemeriksaan di bawah.';
    case 'disetujui':
      return 'Langkah Berikutnya: Proposal telah disetujui. Laksanakan kegiatan lalu kirim Laporan Kegiatan Lapangan (LKL).';
    case 'ditolak':
      return 'Status Final: Proposal ditolak. Periksa catatan keputusan bila ingin mengajukan proposal baru.';
    default:
      return 'Proposal diarsipkan dalam catatan organisasi.';
  }
}

export function ProposalsPage({
  initialMode = 'list',
  initialId,
}: {
  initialMode?: 'list' | 'create' | 'detail';
  initialId?: string;
}) {
  const { user, can, notify, navigate } = useAuth();
  const [proposals, setProposals] = useState<(ProposalRecord & { bidangRelevant?: boolean })[]>([]);
  const [matrixRules, setMatrixRules] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const { showConfirmDialog, guardAction, confirmLeave, cancelLeave } = useUnsavedChanges(formDirty);
  const [statusFilter, setStatusFilter] = useState('');
  const [bidangOnly, setBidangOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [createOpen, setCreateOpen] = useState(false);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [selected, setSelected] = useState<ProposalRecord | null>(null);
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [decisionNote, setDecisionNote] = useState('');
  const [reviseNote, setReviseNote] = useState('');
  const [reviseFile, setReviseFile] = useState<{ fileId: string; fileName: string } | null>(null);
  const [showMatrix, setShowMatrix] = useState(false);
  const [previewPdfId, setPreviewPdfId] = useState<string | null>(null);
  const [printConfig, setPrintConfig] = useState<PrintDocumentConfig | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<
    { id: string; referenceNumber: string; title: string; eventDate: string; provinceName: string; status: string }[]
  >([]);
  const [pendingDecision, setPendingDecision] = useState<'disetujui' | 'ditolak' | null>(null);

  const [programs, setPrograms] = useState<FlagshipProgramRecord[]>([]);
  const [offlineDraftBanner, setOfflineDraftBanner] = useState<{ savedAt: string; data: typeof defaultForm } | null>(null);

  const defaultForm = {
    title: '',
    bidang: OFFICIAL_BIDANGS[3].id as string,
    programId: '',
    category: 'Lokakarya / Literasi Pelajar',
    riskLevel: 'sedang' as 'rendah' | 'sedang' | 'tinggi',
    usesDpbiIdentity: true,
    externalPermitNeeded: false,
    objective: '',
    targetAudience: 'Pelajar SMA/SMK/MA',
    eventDate: '2026-12-10',
    eventTime: '09:00 - 13:00 WIB',
    location: '',
    estimatedParticipants: 50,
    activityMode: 'luring' as 'luring' | 'daring' | 'hibrida',
    pdfFileId: null as string | null,
    pdfFileName: null as string | null,
  };

  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    apiGet<{ programs: FlagshipProgramRecord[] }>('/api/programs')
      .then((res) => setPrograms(res.programs || []))
      .catch(() => setPrograms([]));
  }, []);

  const load = (onlyMyBidang = bidangOnly) => {
    setLoading(true);
    apiGet<{ proposals: (ProposalRecord & { bidangRelevant?: boolean })[]; matrixRules: Record<string, unknown>[] }>(
      `/api/proposals${onlyMyBidang ? '?bidangOnly=1' : ''}`
    )
      .then((res) => {
        setProposals(res.proposals);
        setMatrixRules(res.matrixRules);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(bidangOnly);
  }, [bidangOnly]);
  useEffect(() => {
    setPage(1);
  }, [statusFilter, bidangOnly]);

  useEffect(() => {
    if (initialMode === 'create' && can('proposal', 'create')) {
      setEditingDraftId(null);
      setForm(defaultForm);
      setFormDirty(false);
      setCreateOpen(true);
    }
  }, [initialMode]);

  const openDetail = async (p: ProposalRecord, updateUrl = true) => {
    setSelected(p);
    setDecisionNote('');
    setReviseNote('');
    setReviseFile(null);
    setPreviewPdfId(null);
    if (updateUrl) navigate(`/proposal/${p.id}`);
    try {
      const vRes = await apiGet<{ versions: Record<string, unknown>[] }>(`/api/proposals/${p.id}/versions`);
      setVersions(vRes.versions);
    } catch {
      setVersions([]);
    }
  };

  useEffect(() => {
    if (!loading && initialMode === 'detail' && initialId && proposals.length > 0) {
      const target = proposals.find((p) => p.id === initialId || p.referenceNumber === initialId);
      if (target && selected?.id !== target.id) {
        openDetail(target, false);
      }
    }
  }, [loading, initialMode, initialId, proposals]);

  const openEditDraft = (p: ProposalRecord) => {
    setEditingDraftId(p.id);
    setOfflineDraftBanner(null);
    setForm({
      title: p.title,
      bidang: p.bidang,
      programId: p.programId || '',
      category: p.category,
      riskLevel: p.riskLevel,
      usesDpbiIdentity: p.usesDpbiIdentity,
      externalPermitNeeded: p.externalPermitNeeded,
      objective: p.objective,
      targetAudience: p.targetAudience,
      eventDate: p.eventDate,
      eventTime: p.eventTime,
      location: p.location,
      estimatedParticipants: p.estimatedParticipants,
      activityMode: p.activityMode,
      pdfFileId: p.pdfFileId,
      pdfFileName: p.pdfFileName,
    });
    setFormDirty(false);
    setCreateOpen(true);
  };

  const updateProposalForm = (patch: Partial<typeof defaultForm>) => {
    setFormDirty(true);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  useEffect(() => {
    if (!createOpen || editingDraftId || !formDirty) return;
    const t = window.setTimeout(() => {
      saveOfflineDraft(user?.id, 'proposal_form', form);
    }, 500);
    return () => window.clearTimeout(t);
  }, [createOpen, editingDraftId, formDirty, form, user?.id]);

  useEffect(() => {
    if (!createOpen) {
      setDuplicateMatches([]);
      return;
    }
    const cleanTitle = form.title.trim();
    if (cleanTitle.length < 4) {
      setDuplicateMatches([]);
      return;
    }
    const timer = window.setTimeout(() => {
      const qs = new URLSearchParams({
        title: cleanTitle,
        eventDate: form.eventDate || '',
      });
      if (editingDraftId) qs.set('excludeId', editingDraftId);
      apiGet<{
        duplicates: { id: string; referenceNumber: string; title: string; eventDate: string; provinceName: string; status: string }[];
      }>(`/api/proposals/check-duplicate?${qs.toString()}`)
        .then((res) => setDuplicateMatches(res.duplicates || []))
        .catch(() => setDuplicateMatches([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [createOpen, form.title, form.eventDate, editingDraftId]);

  const closeCreateModal = () => {
    guardAction(() => {
      setFormDirty(false);
      setCreateOpen(false);
      navigate('/proposal');
    });
  };

  const submitProposal = async (saveAsDraft: boolean) => {
    if (submitting) return;
    if (!form.title.trim()) {
      notify('Judul kegiatan wajib diisi.', 'error');
      return;
    }
    if (!saveAsDraft && (!form.objective.trim() || !form.location.trim())) {
      notify('Tujuan dan lokasi kegiatan wajib diisi sebelum dikirim.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      if (editingDraftId) {
        await apiPatch(`/api/proposals/${editingDraftId}`, {
          ...form,
          programId: form.programId || null,
          submitNow: !saveAsDraft,
        });
        notify(
          saveAsDraft ? 'Draft proposal diperbarui.' : 'Draft proposal berhasil dikirim untuk pemeriksaan.',
          'success'
        );
      } else {
        const res = await apiPost<{ referenceNumber: string; assignedApproverRole: string }>('/api/proposals', {
          ...form,
          programId: form.programId || null,
          saveAsDraft,
        });
        clearOfflineDraft(user?.id, 'proposal_form');
        setOfflineDraftBanner(null);
        notify(
          saveAsDraft
            ? `Draft ${res.referenceNumber} tersimpan. Anda dapat melengkapinya kapan saja.`
            : `Proposal ${res.referenceNumber} diajukan. Peninjau: ${res.assignedApproverRole.replace(/_/g, ' ')}.`,
          'success'
        );
      }
      setFormDirty(false);
      setCreateOpen(false);
      setEditingDraftId(null);
      setForm(defaultForm);
      navigate('/proposal');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan proposal.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDecide = async (decision: 'disetujui' | 'perlu_revisi' | 'ditolak') => {
    if (!selected) return;
    try {
      await apiPost(`/api/proposals/${selected.id}/decide`, { decision, note: decisionNote });
      notify(`Keputusan proposal: ${decision.replace(/_/g, ' ')}.`, 'success');
      setSelected(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses keputusan.', 'error');
    }
  };

  const handleRevise = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      const res = await apiPost<{ version: number }>(`/api/proposals/${selected.id}/revise`, {
        pdfFileId: reviseFile?.fileId,
        pdfFileName: reviseFile?.fileName,
        changeNote: reviseNote,
      });
      notify(`Revisi versi ${res.version} berhasil diunggah. Versi lama tetap tersimpan.`, 'success');
      setSelected(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengunggah revisi.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  const filtered = proposals.filter((p) => !statusFilter || p.status === statusFilter);
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Manajemen Proposal Kegiatan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Simpan draft atau ajukan proposal terstruktur + PDF, lihat tindakan berikutnya dengan jelas, dan kelola riwayat versi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowMatrix(true)}
            className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            Approval Matrix
          </button>
          {can('proposal', 'create') && (
            <button
              type="button"
              onClick={() => {
                setEditingDraftId(null);
                setForm(defaultForm);
                setFormDirty(false);
                const saved = loadOfflineDraft<typeof defaultForm>(user?.id, 'proposal_form');
                setOfflineDraftBanner(saved ? { savedAt: saved.savedAt, data: saved.data } : null);
                setCreateOpen(true);
                navigate('/proposal/baru');
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Ajukan Proposal Baru
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-xl w-fit max-w-full overflow-x-auto">
          {[
            ['', 'Semua'],
            ['draft', 'Draft'],
            ['diajukan', 'Diajukan'],
            ['menunggu_persetujuan_nasional', 'Menunggu Nasional'],
            ['perlu_revisi', 'Perlu Revisi'],
            ['disetujui', 'Disetujui'],
            ['ditolak', 'Ditolak'],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setStatusFilter(val)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
                statusFilter === val ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {user?.role === 'pengurus_nasional' && user.bidang && (
          <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
            <button
              type="button"
              onClick={() => setBidangOnly(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                !bidangOnly ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Semua Bidang
            </button>
            <button
              type="button"
              onClick={() => setBidangOnly(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                bidangOnly ? 'bg-white dark:bg-slate-900 shadow-xs text-[#0EA5E9]' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Hanya Bidang Saya ({user.bidang.replace(/^Bidang\s+/i, '')})
            </button>
          </div>
        )}
      </div>

      <GlassCard className="p-5 space-y-4">
        {filtered.length === 0 ? (
          <EmptyState
            title="Belum ada proposal pada filter ini"
            description="Simpan sebagai draft atau ajukan proposal kegiatan terstruktur dengan dokumen PDF pendukung."
            actionLabel={can('proposal', 'create') ? 'Buat Proposal Pertama' : undefined}
            onAction={can('proposal', 'create') ? () => setCreateOpen(true) : undefined}
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Nomor Referensi</th>
                    <th className="py-2.5 pr-4">Judul Kegiatan</th>
                    <th className="py-2.5 pr-4">Pengaju & Wilayah</th>
                    <th className="py-2.5 pr-4">Jadwal</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {paged.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-4 font-mono tabular-nums">
                        <p className="font-semibold text-[#0EA5E9]">{p.referenceNumber}</p>
                        <p className="text-[11px] text-slate-400">Versi {p.version}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{p.title}</p>
                        <p className="text-[11px] text-slate-500">{p.bidang} · Risiko {p.riskLevel} · {p.activityMode}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <p>{p.applicantName}</p>
                        <p className="text-[11px] text-slate-500">{p.provinceName}</p>
                      </td>
                      <td className="py-3 pr-4 tabular-nums">
                        <p>{formatTanggalIndonesia(p.eventDate)}</p>
                        <p className="text-[11px] text-slate-500">{p.estimatedParticipants} peserta</p>
                      </td>
                      <td className="py-3 pr-4"><StatusIndicator status={p.status} /></td>
                      <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                        {p.status === 'draft' && can('proposal', 'edit') && (
                          <button
                            type="button"
                            onClick={() => openEditDraft(p)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] font-semibold"
                          >
                            <Edit3 className="w-3.5 h-3.5" /> Lanjutkan Draft
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => openDetail(p)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0EA5E9] hover:text-white font-semibold transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" /> Detail
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
              {paged.map((p) => (
                <div key={p.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] text-[#0EA5E9]">{p.referenceNumber} · v{p.version}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{p.title}</p>
                      <p className="text-[11px] text-slate-500">{p.applicantName} · {p.provinceName}</p>
                    </div>
                    <StatusIndicator status={p.status} />
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {p.status === 'draft' && can('proposal', 'edit') && (
                      <button
                        type="button"
                        onClick={() => openEditDraft(p)}
                        className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Lanjutkan Draft
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDetail(p)}
                      className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                    >
                      <Eye className="w-3.5 h-3.5" /> Tinjau Proposal
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </GlassCard>

      {/* Create / Edit Draft Proposal Modal */}
      <Modal
        open={createOpen}
        onClose={closeCreateModal}
        title={editingDraftId ? 'Lanjutkan Draft Proposal' : 'Ajukan Proposal Kegiatan Baru'}
      >
        <div className="space-y-4 text-xs">
          {offlineDraftBanner && !editingDraftId && (
            <div className="rounded-xl border border-sky-200 dark:border-sky-800 bg-sky-50/80 dark:bg-sky-950/40 p-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">Draf Lokal Tersimpan Otomatis</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Tersimpan pada {formatTanggalIndonesia(offlineDraftBanner.savedAt, true)}. Pulihkan isian sebelumnya?
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...defaultForm, ...offlineDraftBanner.data });
                    setFormDirty(true);
                    setOfflineDraftBanner(null);
                    notify('Draf proposal lokal dipulihkan.', 'info');
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white font-semibold"
                >
                  Pulihkan
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearOfflineDraft(user?.id, 'proposal_form');
                    setOfflineDraftBanner(null);
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold"
                >
                  Hapus Draf
                </button>
              </div>
            </div>
          )}
          {duplicateMatches.length > 0 && (
            <div
              role="alert"
              className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/50 p-3 space-y-1 text-amber-900 dark:text-amber-200"
            >
              <p className="font-bold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" /> Proposal Serupa Ditemukan di Tanggal / Judul Terdekat
              </p>
              {duplicateMatches.map((d) => (
                <p key={d.id} className="text-[11px]">
                  <span className="font-mono font-semibold">{d.referenceNumber}</span> · {d.title} ({d.provinceName} · {d.eventDate} · {d.status.replace(/_/g, ' ')})
                </p>
              ))}
            </div>
          )}
          <div>
            <label className="block font-semibold mb-1">Judul Kegiatan *</label>
            <input type="text" required value={form.title} onChange={(e) => updateProposalForm({ title: e.target.value })} placeholder="Contoh: Gelar Sastra & Aksara Daerah Pelajar" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Program Unggulan Terkait (Opsional)</label>
            <select
              value={form.programId}
              onChange={(e) => updateProposalForm({ programId: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              <option value="">-- Tidak Terkait Program Khusus / Reguler --</option>
              {programs.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.name} ({prog.periodLabel})
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Bidang</label>
              <select value={form.bidang} onChange={(e) => updateProposalForm({ bidang: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                {!OFFICIAL_BIDANGS.some((b) => b.id === form.bidang) && form.bidang && (
                  <option value={form.bidang}>{form.bidang}</option>
                )}
                {OFFICIAL_BIDANGS.map((b) => (
                  <option key={b.code} value={b.id}>
                    {b.number}. {b.id}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Kategori</label>
              <input type="text" required value={form.category} onChange={(e) => updateProposalForm({ category: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Tingkat Risiko</label>
              <select value={form.riskLevel} onChange={(e) => updateProposalForm({ riskLevel: e.target.value as 'rendah' | 'sedang' | 'tinggi' })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                <option value="rendah">Rendah</option>
                <option value="sedang">Sedang</option>
                <option value="tinggi">Tinggi</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Tanggal Kegiatan</label>
              <input type="date" required value={form.eventDate} onChange={(e) => updateProposalForm({ eventDate: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Moda Pelaksanaan</label>
              <select value={form.activityMode} onChange={(e) => updateProposalForm({ activityMode: e.target.value as 'luring' | 'daring' | 'hibrida' })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                <option value="luring">Luring (Tatap Muka)</option>
                <option value="daring">Daring (Online)</option>
                <option value="hibrida">Hibrida</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Estimasi Peserta</label>
              <input type="number" min={1} required value={form.estimatedParticipants} onChange={(e) => updateProposalForm({ estimatedParticipants: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Lokasi / Platform Kegiatan</label>
            <input type="text" value={form.location} onChange={(e) => updateProposalForm({ location: e.target.value })} placeholder="Nama gedung/sekolah atau platform daring" className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Tujuan & Sasaran Kegiatan *</label>
            <textarea rows={3} required value={form.objective} onChange={(e) => updateProposalForm({ objective: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.usesDpbiIdentity} onChange={(e) => updateProposalForm({ usesDpbiIdentity: e.target.checked })} />
              <span>Menggunakan Identitas Resmi DPBI</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input type="checkbox" checked={form.externalPermitNeeded} onChange={(e) => updateProposalForm({ externalPermitNeeded: e.target.checked })} />
              <span>Memerlukan Izin Eksternal / Mitra</span>
            </label>
          </div>
          <FileDropzone
            label="Unggah Dokumen Proposal Utama (PDF)"
            accept=".pdf,application/pdf"
            moduleName="proposal"
            uploadedFileName={form.pdfFileName}
            onUploaded={(res) => updateProposalForm({ pdfFileId: res.fileId, pdfFileName: res.fileName })}
          />
          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitProposal(true)}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9] disabled:opacity-50"
            >
              {submitting ? 'Menyimpan...' : 'Simpan Draft'}
            </button>
            <button
              type="button"
              disabled={submitting}
              onClick={() => submitProposal(false)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0EA5E9] text-white font-semibold hover:bg-sky-600 disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" /> {submitting ? 'Mengirim...' : 'Kirim Pengajuan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Proposal Detail, Preview, Decision, & Revision Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          navigate('/proposal');
        }}
        title={selected?.title || 'Detail Proposal'}
        subtitle={selected ? `${selected.referenceNumber} · Versi ${selected.version} · Peninjau: ${ROLE_LABELS[selected.assignedApproverRole] || selected.assignedApproverRole.replace(/_/g, ' ')}` : ''}
        maxWidth="max-w-3xl"
      >
        {selected && (
          <div className="space-y-5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <StatusIndicator status={selected.status} />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPrintConfig({
                      template: 'proposal',
                      documentNumber: selected.referenceNumber,
                      title: selected.title,
                      subtitle: `${selected.bidang} · ${selected.category}`,
                      issuedDate: selected.createdAt,
                      metadata: [
                        { label: 'Pengaju', value: selected.applicantName },
                        { label: 'Wilayah', value: selected.provinceName },
                        { label: 'Angkatan', value: selected.batchName },
                        { label: 'Jadwal', value: `${formatTanggalIndonesia(selected.eventDate)} (${selected.eventTime})` },
                        { label: 'Moda & Peserta', value: `${selected.activityMode} · ${selected.estimatedParticipants} orang` },
                        { label: 'Status', value: selected.status.replace(/_/g, ' ') },
                      ],
                      sections: [
                        { heading: 'Tujuan & Sasaran Kegiatan', body: selected.objective },
                        { heading: 'Lokasi / Platform & Target Audiens', body: `${selected.location || '—'} · Target: ${selected.targetAudience}` },
                        ...(selected.decisionNote
                          ? [{ heading: `Catatan Keputusan (${selected.decidedBy || 'Peninjau'})`, body: selected.decisionNote }]
                          : []),
                      ],
                      signatoryName: selected.decidedBy || selected.applicantName,
                      signatoryRole: selected.decidedBy ? 'Pejabat Penyetuju Proposal DPBI' : 'Pengaju Proposal',
                      signatoryLocation: selected.provinceName,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0EA5E9]" /> Cetak Ringkasan A4
                </button>
                {selected.pdfFileId && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewPdfId((prev) => (prev ? null : selected.pdfFileId))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0EA5E9]" /> {previewPdfId ? 'Tutup Pratinjau' : 'Pratinjau PDF'}
                    </button>
                    <a
                      href={apiUrl(`/api/files/${selected.pdfFileId}`)}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-[#0EA5E9] font-semibold"
                    >
                      <Download className="w-3.5 h-3.5" /> Unduh ({selected.pdfFileName})
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Clear Next Action Guidance */}
            <div className="rounded-xl bg-sky-50/70 dark:bg-sky-950/30 border border-sky-200/80 dark:border-sky-800/60 p-3 space-y-2">
              <div className="flex items-start gap-2.5">
                <Info className="w-4 h-4 text-[#0EA5E9] shrink-0 mt-0.5" />
                <p className="text-slate-700 dark:text-slate-200 leading-relaxed">{getNextActionSummary(selected)}</p>
              </div>
              {selected.status === 'disetujui' && (
                <div className="flex flex-wrap gap-2 pl-6">
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      navigate('/kalender');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 text-[#0EA5E9] font-semibold"
                  >
                    <Calendar className="w-3.5 h-3.5" /> Lihat Agenda di Kalender
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(null);
                      navigate('/tugas');
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-sky-200 dark:border-sky-800 text-[#0EA5E9] font-semibold"
                  >
                    <CheckSquare className="w-3.5 h-3.5" /> Buka 4 Checklist Tugas
                  </button>
                  {can('lkl', 'create') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        navigate('/laporan-kegiatan/baru');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0EA5E9] text-white font-semibold"
                    >
                      Buat LKL Terkait
                    </button>
                  )}
                </div>
              )}
            </div>

            {previewPdfId && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950">
                <iframe
                  title="Pratinjau Dokumen Proposal PDF"
                  src={apiUrl(`/api/files/${previewPdfId}/preview`)}
                  className="w-full h-[55vh]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <p><strong>Pengaju:</strong> {selected.applicantName}</p>
              <p><strong>Wilayah:</strong> {selected.provinceName}</p>
              <p><strong>Bidang:</strong> {selected.bidang}</p>
              <p><strong>Jadwal:</strong> {formatTanggalIndonesia(selected.eventDate)} ({selected.eventTime})</p>
              <p><strong>Lokasi:</strong> {selected.location || '—'}</p>
              <p><strong>Estimasi Peserta:</strong> {selected.estimatedParticipants} ({selected.activityMode})</p>
              {selected.programId && (
                <p className="sm:col-span-2">
                  <strong>Program Unggulan:</strong>{' '}
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-[#0EA5E9] font-semibold">
                    {programs.find((pr) => pr.id === selected.programId)?.name || selected.programId}
                  </span>
                </p>
              )}
            </div>

            <div>
              <p className="font-semibold mb-1">Tujuan Kegiatan:</p>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{selected.objective}</p>
            </div>

            {selected.decisionNote && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3 border border-slate-200 dark:border-slate-700">
                <p className="font-semibold">Catatan Keputusan ({selected.decidedBy}):</p>
                <p className="mt-1">{selected.decisionNote}</p>
              </div>
            )}

            {selected.status === 'draft' && can('proposal', 'edit') && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const target = selected;
                    setSelected(null);
                    openEditDraft(target);
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold"
                >
                  Lanjutkan & Kirim Draft Ini
                </button>
              </div>
            )}

            {/* Version History */}
            <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
              <p className="font-semibold flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-[#0EA5E9]" /> Riwayat Versi Dokumen</p>
              {versions.length === 0 ? (
                <p className="text-slate-500">Belum ada riwayat versi tambahan.</p>
              ) : (
                versions.map((v) => (
                  <div key={String(v.id)} className="flex items-center justify-between py-1.5 border-b border-slate-100 dark:border-slate-800/60">
                    <span>Versi {Number(v.version)} · {String(v.change_note)} ({String(v.uploaded_by)})</span>
                    {v.pdf_file_id ? (
                      <a href={apiUrl(`/api/files/${v.pdf_file_id}`)} target="_blank" rel="noreferrer" className="text-[#0EA5E9] font-semibold">PDF</a>
                    ) : null}
                  </div>
                ))
              )}
            </div>

            {/* Revision upload for applicant when perlu_revisi */}
            {selected.status === 'perlu_revisi' && can('proposal', 'edit') && (
              <form onSubmit={handleRevise} className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="font-bold">Unggah Revisi Versi {selected.version + 1}</p>
                <input required value={reviseNote} onChange={(e) => setReviseNote(e.target.value)} placeholder="Ringkasan perbaikan yang dilakukan..." className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                <FileDropzone
                  label="Unggah PDF Revisi Baru"
                  accept=".pdf,application/pdf"
                  moduleName="proposal"
                  uploadedFileName={reviseFile?.fileName}
                  onUploaded={(res) => setReviseFile({ fileId: res.fileId, fileName: res.fileName })}
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Kirim Revisi</button>
              </form>
            )}

            {/* Decision controls for authorized reviewers */}
            {can('proposal', 'review') && user?.role !== 'duta' && selected.status !== 'draft' && (
              <div className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                <p className="font-bold">Keputusan Peninjau / Persetujuan</p>
                <input
                  value={decisionNote}
                  onChange={(e) => setDecisionNote(e.target.value)}
                  placeholder="Catatan persetujuan atau alasan wajib untuk revisi/penolakan..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPendingDecision('disetujui')} className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">
                    Setujui Proposal
                  </button>
                  <button type="button" onClick={() => handleDecide('perlu_revisi')} className="px-3.5 py-2 rounded-xl bg-amber-500 text-white font-semibold">
                    Minta Revisi
                  </button>
                  <button type="button" onClick={() => setPendingDecision('ditolak')} className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-semibold">
                    Tolak
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={showMatrix} onClose={() => setShowMatrix(false)} title="Approval Matrix Proposal SATU DPBI">
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            Aturan persetujuan menentukan peninjau akhir secara otomatis berdasarkan bidang, risiko, penggunaan identitas DPBI, dan kebutuhan izin eksternal.
          </p>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {matrixRules.map((r) => (
              <div key={String(r.id)} className="py-2.5">
                <p className="font-bold">{String(r.bidang)} — {String(r.category)} (Risiko {String(r.risk_level)})</p>
                <p className="text-[#0EA5E9] font-semibold mt-0.5">Penyetuju Akhir: {String(r.approver_role).replace(/_/g, ' ')}</p>
                <p className="text-slate-500 mt-0.5">{String(r.notes)}</p>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={showConfirmDialog}
        title="Batalkan Perubahan Proposal?"
        message="Anda memiliki perubahan formulir proposal yang belum disimpan. Yakin ingin keluar dan membuang perubahan?"
        confirmLabel="Buang Perubahan"
        cancelLabel="Lanjutkan Mengisi"
        danger
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />

      <ConfirmDialog
        open={Boolean(pendingDecision)}
        title={pendingDecision === 'disetujui' ? 'Setujui Proposal & Buat Agenda Tugas?' : 'Konfirmasi Penolakan Proposal'}
        message={
          pendingDecision === 'disetujui'
            ? 'Menyetujui proposal ini akan otomatis membuat agenda di Kalender Kerja serta 4 tugas pelaksanaan/pelaporan bertahap.'
            : 'Proposal yang ditolak akan berstatus final dan tidak dapat dilanjutkan lagi. Pastikan alasan penolakan telah tertulis dengan jelas.'
        }
        confirmLabel={pendingDecision === 'disetujui' ? 'Ya, Setujui Proposal' : 'Ya, Tolak Proposal'}
        danger={pendingDecision === 'ditolak'}
        onConfirm={() => {
          const dec = pendingDecision;
          setPendingDecision(null);
          if (dec) handleDecide(dec);
        }}
        onCancel={() => setPendingDecision(null)}
      />

      <A4PrintModal
        open={Boolean(printConfig)}
        config={printConfig}
        onClose={() => setPrintConfig(null)}
      />
    </div>
  );
}
