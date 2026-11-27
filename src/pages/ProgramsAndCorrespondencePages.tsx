import React, { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  Edit3,
  FileCheck2,
  FileText,
  FolderOpen,
  Inbox,
  ListTodo,
  Mail,
  MapPin,
  Plus,
  Send,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch, apiPost, apiUploadFile } from '../lib/api';
import { INDONESIA_PROVINCES } from '../lib/provinces';
import { formatTanggalIndonesia, OFFICIAL_BIDANGS } from '../lib/rbac';
import type { BatchRecord, CorrespondenceRecord, FlagshipProgramRecord } from '../lib/types';
import { PublicFooter, PublicNavbar } from '../components/public/PublicChrome';
import { EmptyState, GlassCard, Modal, PageHeader, Skeleton, StatusIndicator } from '../components/ui/Primitives';

interface ProgramItem extends Omit<FlagshipProgramRecord, 'metrics'> {
  metrics?: {
    proposalsTotal?: number;
    proposalsApproved?: number;
    approvedProposalsCount?: number;
    lklTotal?: number;
    lklApproved?: number;
    approvedLklCount?: number;
    participantsReached?: number;
    totalParticipants?: number;
    provincesReached?: number;
    tasksTotal?: number;
    tasksCompleted?: number;
    evaluationsCount?: number;
    avgEvaluationScore?: number | null;
  };
}

interface ProgramDetailPayload {
  program: FlagshipProgramRecord;
  proposals: {
    id: string;
    reference_number: string;
    title: string;
    applicant_name: string;
    province_code: string;
    provinceName: string;
    event_date: string;
    status: string;
    estimated_participants: number;
  }[];
  lklReports: {
    id: string;
    reference_number: string;
    activity_name: string;
    submitter_name: string;
    province_code: string;
    provinceName: string;
    regency: string;
    event_date: string;
    participant_count: number;
    status: string;
  }[];
  tasks: {
    id: string;
    reference_number: string;
    title: string;
    priority: string;
    status: string;
    deadline: string;
    assignee_name: string;
  }[];
  documents: {
    id: string;
    document_number: string;
    title: string;
    category: string;
    version: string;
    status: string;
    issued_date: string;
  }[];
  correspondence: {
    id: string;
    reference_number: string;
    direction: string;
    letter_type: string;
    subject: string;
    letter_date: string;
    status: string;
  }[];
  evaluations: {
    id: string;
    personnel_name: string;
    evaluator_name: string;
    evaluator_type: string;
    total_score: number;
    coaching_recommendation: string;
    created_at: string;
  }[];
}

export function ProgramsPage({
  initialSlug,
  isPublicMode = false,
}: {
  initialSlug?: string;
  isPublicMode?: boolean;
}) {
  const { user, can, navigate, notify } = useAuth();
  const [programs, setPrograms] = useState<ProgramItem[]>([]);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [provinceCode, setProvinceCode] = useState('');
  const [batchId, setBatchId] = useState('');
  const [regency, setRegency] = useState('');
  const [detailSlug, setDetailSlug] = useState<string | null>(initialSlug || null);
  const [detail, setDetail] = useState<ProgramDetailPayload | null>(null);
  const [detailTab, setDetailTab] = useState<'overview' | 'proposals' | 'lkl' | 'tasks' | 'docs' | 'evals'>('overview');

  const [editModal, setEditModal] = useState<ProgramItem | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    tagline: '',
    description: '',
    objectives: '',
    bidang: OFFICIAL_BIDANGS[1].id,
    leadName: '',
    status: 'aktif',
    targetProvinces: 38,
    targetParticipants: 1000,
    periodLabel: '2026–2027',
    isPublic: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDetailSlug(initialSlug || null);
  }, [initialSlug]);

  const loadPrograms = useCallback(async () => {
    setLoading(true);
    try {
      if (isPublicMode || !user) {
        const res = await apiGet<{ programs: ProgramItem[] }>('/api/public/programs', true);
        setPrograms(res.programs || []);
      } else {
        const qs = new URLSearchParams();
        if (provinceCode) qs.set('provinceCode', provinceCode);
        if (batchId) qs.set('batchId', batchId);
        if (regency.trim()) qs.set('regency', regency.trim());
        const [progRes, batchRes] = await Promise.all([
          apiGet<{ programs: ProgramItem[] }>(`/api/programs${qs.toString() ? `?${qs}` : ''}`),
          apiGet<{ batches: BatchRecord[] }>('/api/batches').catch(() => ({ batches: [] })),
        ]);
        setPrograms(progRes.programs || []);
        setBatches(batchRes.batches || []);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat program unggulan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [isPublicMode, user, provinceCode, batchId, regency, notify]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  useEffect(() => {
    if (!detailSlug || isPublicMode || !user) {
      setDetail(null);
      return;
    }
    apiGet<ProgramDetailPayload>(`/api/programs/${encodeURIComponent(detailSlug)}`)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null));
  }, [detailSlug, isPublicMode, user]);

  const openEdit = (prog: ProgramItem) => {
    setEditModal(prog);
    setEditForm({
      name: prog.name,
      tagline: prog.tagline,
      description: prog.description,
      objectives: prog.objectives,
      bidang: (prog.bidang as typeof OFFICIAL_BIDANGS[number]['id']) || OFFICIAL_BIDANGS[1].id,
      leadName: prog.leadName,
      status: prog.status,
      targetProvinces: prog.targetProvinces,
      targetParticipants: prog.targetParticipants,
      periodLabel: prog.periodLabel,
      isPublic: prog.isPublic,
    });
  };

  const handleSaveProgram = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal) return;
    setSaving(true);
    try {
      await apiPatch(`/api/programs/${editModal.id}`, editForm);
      notify('Detail Program Unggulan berhasil diperbarui.', 'success');
      setEditModal(null);
      await loadPrograms();
      if (detailSlug) {
        const d = await apiGet<ProgramDetailPayload>(`/api/programs/${encodeURIComponent(detailSlug)}`);
        setDetail(d);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan program unggulan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const selectedPublicProgram = detailSlug ? programs.find((p) => p.slug === detailSlug || p.id === detailSlug) || null : null;

  const content = (
    <div className="space-y-6">
      <PageHeader
        title="Program Unggulan Nasional DPBI"
        description="Tiga pilar gerakan literasi dan pelestarian budaya Nusantara: Behind The Culture, Sedapnya Warisanku, dan Budaya Masuk Sekolah."
        actions={
          detailSlug ? (
            <button
              type="button"
              onClick={() => {
                setDetailSlug(null);
                navigate('/program');
              }}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9]"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Semua Program Unggulan
            </button>
          ) : !user ? (
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
            >
              Masuk Portal Internal <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : null
        }
      />

      {!detailSlug && user && (
        <GlassCard className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label htmlFor="prog-prov" className="block text-[11px] font-semibold text-slate-500 mb-1">
                Filter Provinsi
              </label>
              <select
                id="prog-prov"
                value={provinceCode}
                onChange={(e) => setProvinceCode(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="">Seluruh 38 Provinsi</option>
                {INDONESIA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="prog-batch" className="block text-[11px] font-semibold text-slate-500 mb-1">
                Filter Angkatan
              </label>
              <select
                id="prog-batch"
                value={batchId}
                onChange={(e) => setBatchId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              >
                <option value="">Semua Angkatan</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="prog-reg" className="block text-[11px] font-semibold text-slate-500 mb-1">
                Kabupaten / Kota (LKL)
              </label>
              <input
                id="prog-reg"
                type="text"
                value={regency}
                onChange={(e) => setRegency(e.target.value)}
                placeholder="Cari kabupaten/kota..."
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => {
                  setProvinceCode('');
                  setBatchId('');
                  setRegency('');
                }}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-[#0EA5E9]"
              >
                Reset Filter
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {loading ? (
        <Skeleton rows={4} />
      ) : detailSlug && isPublicMode && selectedPublicProgram ? (
        <GlassCard className="p-6 space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-4">
            <div>
              <p className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-wider">
                {selectedPublicProgram.bidang} · {selectedPublicProgram.periodLabel}
              </p>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                {selectedPublicProgram.name}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{selectedPublicProgram.tagline}</p>
            </div>
            <StatusIndicator status={selectedPublicProgram.status} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Provinsi Terjangkau</p>
              <p className="font-mono text-xl font-bold text-[#0EA5E9] tabular-nums mt-0.5">
                {selectedPublicProgram.metrics?.provincesReached ?? 0}/{selectedPublicProgram.targetProvinces}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Kegiatan Terverifikasi</p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {selectedPublicProgram.metrics?.approvedLklCount ?? 0}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Penerima Manfaat</p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {selectedPublicProgram.metrics?.totalParticipants ?? 0}
              </p>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
              <p className="text-[11px] text-slate-500">Proposal Disetujui</p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                {selectedPublicProgram.metrics?.approvedProposalsCount ?? 0}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Deskripsi Program</h3>
              <p className="whitespace-pre-line">{selectedPublicProgram.description}</p>
            </div>
            <div className="space-y-1.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Tujuan &amp; Sasaran Dampak</h3>
              <p className="whitespace-pre-line">{selectedPublicProgram.objectives}</p>
            </div>
          </div>
        </GlassCard>
      ) : detailSlug && detail ? (
        <div className="space-y-5">
          <GlassCard className="p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-4">
              <div>
                <p className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-wider">
                  {detail.program.bidang} · Periode {detail.program.periodLabel}
                </p>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                  {detail.program.name}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{detail.program.tagline}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusIndicator status={detail.program.status} />
                {can('program', 'edit') && (
                  <button
                    type="button"
                    onClick={() => openEdit(detail.program)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-[#0EA5E9]"
                  >
                    <Edit3 className="w-3.5 h-3.5" /> Edit Program
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">Proposal Terkait</p>
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {detail.proposals.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">Laporan LKL</p>
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {detail.lklReports.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">Tugas Program</p>
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {detail.tasks.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">Dokumen &amp; Surat</p>
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {detail.documents.length + detail.correspondence.length}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
                <p className="text-[11px] text-slate-500">Evaluasi Kinerja</p>
                <p className="font-mono text-xl font-bold text-slate-900 dark:text-white tabular-nums">
                  {detail.evaluations.length}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
              {[
                { id: 'overview', label: 'Ringkasan & Target' },
                { id: 'proposals', label: `Proposal (${detail.proposals.length})` },
                { id: 'lkl', label: `Laporan LKL (${detail.lklReports.length})` },
                { id: 'tasks', label: `Tugas (${detail.tasks.length})` },
                { id: 'docs', label: `Dokumen & Surat (${detail.documents.length + detail.correspondence.length})` },
                { id: 'evals', label: `Evaluasi (${detail.evaluations.length})` },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDetailTab(t.id as typeof detailTab)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    detailTab === t.id
                      ? 'bg-[#0EA5E9] text-white'
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Deskripsi Operasional</p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {detail.program.description}
                  </p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tujuan, Target &amp; Koordinator</p>
                  <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                    {detail.program.objectives}
                  </p>
                  <div className="pt-2 text-xs text-slate-500 space-y-1">
                    <p>Penanggung Jawab Program: <strong className="text-slate-900 dark:text-white">{detail.program.leadName}</strong></p>
                    <p>Target Cakupan: <strong className="text-slate-900 dark:text-white">{detail.program.targetProvinces} Provinsi</strong> · <strong className="text-slate-900 dark:text-white">{detail.program.targetParticipants.toLocaleString('id-ID')} Peserta</strong></p>
                  </div>
                </div>
              </div>
            )}

            {detailTab === 'proposals' && (
              detail.proposals.length === 0 ? (
                <EmptyState title="Belum ada proposal terkait" description="Proposal baru dapat ditautkan ke program unggulan ini." />
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {detail.proposals.map((p) => (
                    <div key={p.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[11px] text-[#0EA5E9]">{p.reference_number}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{p.title}</p>
                        <p className="text-xs text-slate-500">{p.applicant_name} · {p.provinceName} · {formatTanggalIndonesia(p.event_date)}</p>
                      </div>
                      <StatusIndicator status={p.status} />
                    </div>
                  ))}
                </div>
              )
            )}

            {detailTab === 'lkl' && (
              detail.lklReports.length === 0 ? (
                <EmptyState title="Belum ada LKL terkait" description="Laporan kegiatan lapangan yang memilih program ini akan tampil di sini." />
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {detail.lklReports.map((l) => (
                    <div key={l.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[11px] text-[#0EA5E9]">{l.reference_number}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{l.activity_name}</p>
                        <p className="text-xs text-slate-500">
                          {l.submitter_name} · {l.regency}, {l.provinceName} · {l.participant_count} peserta
                        </p>
                      </div>
                      <StatusIndicator status={l.status} />
                    </div>
                  ))}
                </div>
              )
            )}

            {detailTab === 'tasks' && (
              detail.tasks.length === 0 ? (
                <EmptyState title="Belum ada tugas program" description="Tugas di Task Management Center dapat ditautkan ke program ini." />
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {detail.tasks.map((t) => (
                    <div key={t.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-mono text-[11px] text-[#0EA5E9]">{t.reference_number}</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{t.title}</p>
                        <p className="text-xs text-slate-500">PJ: {t.assignee_name} · Tenggat {formatTanggalIndonesia(t.deadline)}</p>
                      </div>
                      <StatusIndicator status={t.status} />
                    </div>
                  ))}
                </div>
              )
            )}

            {detailTab === 'docs' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Dokumen &amp; Pedoman</p>
                  {detail.documents.length === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada dokumen program.</p>
                  ) : (
                    detail.documents.map((d) => (
                      <div key={d.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-[#0EA5E9]">{d.document_number} · v{d.version}</p>
                          <p className="text-xs font-semibold truncate">{d.title}</p>
                        </div>
                        <StatusIndicator status={d.status} />
                      </div>
                    ))
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-bold text-slate-500 uppercase">Persuratan Terkait</p>
                  {detail.correspondence.length === 0 ? (
                    <p className="text-xs text-slate-500">Belum ada surat terkait.</p>
                  ) : (
                    detail.correspondence.map((c) => (
                      <div key={c.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-[#0EA5E9]">{c.reference_number} · {c.direction.toUpperCase()}</p>
                          <p className="text-xs font-semibold truncate">{c.subject}</p>
                        </div>
                        <StatusIndicator status={c.status} />
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {detailTab === 'evals' && (
              detail.evaluations.length === 0 ? (
                <EmptyState title="Belum ada evaluasi program" description="Penilaian lintas pihak terhadap pelaksanaan program ini akan muncul di sini." />
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-slate-800">
                  {detail.evaluations.map((ev) => (
                    <div key={ev.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{ev.personnel_name}</p>
                        <p className="text-xs text-slate-500">
                          Penilai: {ev.evaluator_name} ({ev.evaluator_type.replace(/_/g, ' ')})
                        </p>
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{ev.coaching_recommendation}</p>
                      </div>
                      <span className="font-mono text-lg font-bold text-[#0EA5E9] tabular-nums">{ev.total_score}/100</span>
                    </div>
                  ))}
                </div>
              )
            )}
          </GlassCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {programs.map((prog) => {
            const provincesReached = prog.metrics?.provincesReached ?? 0;
            const participants = prog.metrics?.participantsReached ?? prog.metrics?.totalParticipants ?? 0;
            const lklApproved = prog.metrics?.lklApproved ?? prog.metrics?.approvedLklCount ?? 0;
            const propApproved = prog.metrics?.proposalsApproved ?? prog.metrics?.approvedProposalsCount ?? 0;
            const pctProv = Math.min(100, Math.round((provincesReached / Math.max(1, prog.targetProvinces)) * 100));

            return (
              <GlassCard key={prog.id} className="p-6 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#0EA5E9]">
                      <Sparkles className="w-3.5 h-3.5" /> {prog.bidang}
                    </span>
                    <StatusIndicator status={prog.status} />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">{prog.name}</h2>
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{prog.tagline}</p>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed line-clamp-3">
                    {prog.description}
                  </p>

                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] text-slate-500">
                      <span>Cakupan Provinsi</span>
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                        {provincesReached}/{prog.targetProvinces} ({pctProv}%)
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                      <div className="h-full bg-[#0EA5E9] rounded-full" style={{ width: `${pctProv}%` }} />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-1 text-center">
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                      <p className="text-[10px] text-slate-500">Proposal</p>
                      <p className="font-mono text-sm font-bold tabular-nums">{propApproved}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                      <p className="text-[10px] text-slate-500">LKL Sah</p>
                      <p className="font-mono text-sm font-bold tabular-nums">{lklApproved}</p>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-900">
                      <p className="text-[10px] text-slate-500">Peserta</p>
                      <p className="font-mono text-sm font-bold tabular-nums">{participants}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 truncate">PJ: {prog.leadName}</span>
                  <div className="flex items-center gap-2">
                    {user && can('program', 'edit') && (
                      <button
                        type="button"
                        onClick={() => openEdit(prog)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-[#0EA5E9]"
                      >
                        Ubah
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDetailSlug(prog.slug);
                        navigate(`/program/${prog.slug}`);
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0EA5E9] hover:bg-sky-600 text-white text-[11px] font-semibold"
                    >
                      {user ? 'Buka Command Center' : 'Lihat Detail Program'} <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <Modal open={Boolean(editModal)} onClose={() => setEditModal(null)} title={`Perbarui ${editModal?.name || ''}`}>
        <form onSubmit={handleSaveProgram} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ep-name" className="block text-xs font-semibold mb-1">Nama Program</label>
              <input
                id="ep-name"
                required
                value={editForm.name}
                onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ep-lead" className="block text-xs font-semibold mb-1">Penanggung Jawab</label>
              <input
                id="ep-lead"
                required
                value={editForm.leadName}
                onChange={(e) => setEditForm((f) => ({ ...f, leadName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label htmlFor="ep-tagline" className="block text-xs font-semibold mb-1">Tagline Program</label>
            <input
              id="ep-tagline"
              required
              value={editForm.tagline}
              onChange={(e) => setEditForm((f) => ({ ...f, tagline: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ep-desc" className="block text-xs font-semibold mb-1">Deskripsi</label>
            <textarea
              id="ep-desc"
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="ep-obj" className="block text-xs font-semibold mb-1">Tujuan &amp; Sasaran</label>
            <textarea
              id="ep-obj"
              rows={2}
              value={editForm.objectives}
              onChange={(e) => setEditForm((f) => ({ ...f, objectives: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="ep-status" className="block text-xs font-semibold mb-1">Status</label>
              <select
                id="ep-status"
                value={editForm.status}
                onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="aktif">Aktif</option>
                <option value="perencanaan">Perencanaan</option>
                <option value="evaluasi">Evaluasi</option>
                <option value="diarsipkan">Diarsipkan</option>
              </select>
            </div>
            <div>
              <label htmlFor="ep-tprov" className="block text-xs font-semibold mb-1">Target Provinsi</label>
              <input
                id="ep-tprov"
                type="number"
                min={1}
                max={38}
                value={editForm.targetProvinces}
                onChange={(e) => setEditForm((f) => ({ ...f, targetProvinces: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="ep-tpart" className="block text-xs font-semibold mb-1">Target Peserta</label>
              <input
                id="ep-tpart"
                type="number"
                min={1}
                value={editForm.targetParticipants}
                onChange={(e) => setEditForm((f) => ({ ...f, targetParticipants: Number(e.target.value) }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={editForm.isPublic}
              onChange={(e) => setEditForm((f) => ({ ...f, isPublic: e.target.checked }))}
            />
            Tampilkan pada portal publik DPBI
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditModal(null)} className="px-4 py-2 rounded-xl border text-xs font-semibold">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );

  if (isPublicMode || !user) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
        <PublicNavbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">{content}</main>
        <PublicFooter />
      </div>
    );
  }

  return content;
}

interface CorrespondenceListItem extends CorrespondenceRecord {
  provinceName?: string;
  dispositions: {
    id: string;
    correspondenceId: string;
    fromUserId: string;
    fromUserName: string;
    toUserId: string | null;
    toUserName: string;
    instruction: string;
    dueDate: string | null;
    status: string;
    responseNote: string | null;
    createdAt: string;
    completedAt: string | null;
  }[];
}

export function CorrespondencePage() {
  const { can, notify } = useAuth();
  const [letters, setLetters] = useState<CorrespondenceListItem[]>([]);
  const [recipients, setRecipients] = useState<{ id: string; fullName: string; role: string; provinceCode: string | null }[]>([]);
  const [programs, setPrograms] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dirFilter, setDirFilter] = useState<'' | 'masuk' | 'keluar'>('');
  const [createOpen, setCreateOpen] = useState(false);
  const [dispTarget, setDispTarget] = useState<CorrespondenceListItem | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    direction: 'masuk' as 'masuk' | 'keluar',
    letterType: 'Surat Undangan',
    subject: '',
    senderName: '',
    recipientName: '',
    letterDate: new Date().toISOString().slice(0, 10),
    provinceCode: '',
    programId: '',
    urgency: 'biasa',
    summary: '',
    fileId: '',
    fileName: '',
  });

  const [dispForm, setDispForm] = useState({
    toUserId: '',
    toUserName: '',
    instruction: '',
    dueDate: '',
  });

  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});

  const loadLetters = useCallback(async () => {
    setLoading(true);
    try {
      const qs = dirFilter ? `?direction=${dirFilter}` : '';
      const res = await apiGet<{
        letters: CorrespondenceListItem[];
        recipients: { id: string; fullName: string; role: string; provinceCode: string | null }[];
        programs: { id: string; name: string; slug: string }[];
      }>(`/api/correspondence${qs}`);
      setLetters(res.letters || []);
      setRecipients(res.recipients || []);
      setPrograms(res.programs || []);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat daftar persuratan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [dirFilter, notify]);

  useEffect(() => {
    loadLetters();
  }, [loadLetters]);

  const handleUploadAttachment = async (file: File) => {
    setUploading(true);
    try {
      const up = await apiUploadFile(file, 'correspondence');
      setForm((f) => ({ ...f, fileId: up.fileId, fileName: up.fileName }));
      notify(`Lampiran "${up.fileName}" berhasil diunggah.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengunggah lampiran surat.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateLetter = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiPost('/api/correspondence', form);
      notify('Surat resmi berhasil dicatat ke buku agenda persuratan.', 'success');
      setCreateOpen(false);
      setForm({
        direction: 'masuk',
        letterType: 'Surat Undangan',
        subject: '',
        senderName: '',
        recipientName: '',
        letterDate: new Date().toISOString().slice(0, 10),
        provinceCode: '',
        programId: '',
        urgency: 'biasa',
        summary: '',
        fileId: '',
        fileName: '',
      });
      await loadLetters();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mencatat surat.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDispose = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispTarget) return;
    setSaving(true);
    try {
      await apiPost(`/api/correspondence/${dispTarget.id}/dispose`, dispForm);
      notify('Disposisi surat berhasil dikirim dengan notifikasi penerima.', 'success');
      setDispTarget(null);
      setDispForm({ toUserId: '', toUserName: '', instruction: '', dueDate: '' });
      await loadLetters();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim disposisi.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDispositionStatus = async (dispId: string, status: 'dibaca' | 'ditindaklanjuti' | 'selesai') => {
    try {
      await apiPatch(`/api/correspondence/dispositions/${dispId}`, {
        status,
        responseNote: responseNotes[dispId] || undefined,
      });
      notify(`Status disposisi diperbarui menjadi ${status}.`, 'success');
      await loadLetters();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui status disposisi.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Persuratan & Disposisi Digital"
        description="Agenda resmi Surat Masuk, Surat Keluar, Surat Tugas, serta pelacakan instruksi disposisi lintas Sekretariat & Bidang."
        actions={
          can('persuratan', 'create') ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold shadow-sm"
            >
              <Plus className="w-4 h-4" /> Catat Surat Resmi
            </button>
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        {[
          { id: '', label: 'Semua Agenda Surat' },
          { id: 'masuk', label: 'Surat Masuk' },
          { id: 'keluar', label: 'Surat Keluar' },
        ].map((tab) => (
          <button
            key={tab.id || 'all'}
            type="button"
            onClick={() => setDirFilter(tab.id as '' | 'masuk' | 'keluar')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
              dirFilter === tab.id
                ? 'bg-[#0EA5E9] text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <Skeleton rows={4} />
      ) : letters.length === 0 ? (
        <EmptyState
          title="Belum ada agenda persuratan"
          description="Catat surat masuk atau surat keluar resmi organisasi beserta lampiran dan disposisinya."
        />
      ) : (
        <div className="space-y-4">
          {letters.map((letter) => (
            <GlassCard key={letter.id} className="p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span className="font-mono font-bold text-[#0EA5E9]">{letter.referenceNumber}</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-semibold uppercase">
                      {letter.direction === 'masuk' ? 'Surat Masuk' : 'Surat Keluar'}
                    </span>
                    <span className="text-slate-500">{letter.letterType}</span>
                    <span
                      className={`px-2 py-0.5 rounded font-semibold ${
                        letter.urgency === 'sangat_segera'
                          ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                          : letter.urgency === 'segera'
                          ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      Sifat: {letter.urgency.replace('_', ' ')}
                    </span>
                  </div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">{letter.subject}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Dari: <strong className="text-slate-700 dark:text-slate-200">{letter.senderName}</strong> → Kepada:{' '}
                    <strong className="text-slate-700 dark:text-slate-200">{letter.recipientName}</strong> ·{' '}
                    {formatTanggalIndonesia(letter.letterDate)} · {letter.provinceName || 'Nasional'}
                  </p>
                  {letter.summary && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 leading-relaxed">{letter.summary}</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <StatusIndicator status={letter.status} />
                  {letter.fileId && (
                    <a
                      href={`/api/files/${letter.fileId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-[#0EA5E9]"
                    >
                      <FileText className="w-3.5 h-3.5" /> Lampiran
                    </a>
                  )}
                  {can('persuratan', 'edit') && (
                    <button
                      type="button"
                      onClick={() => {
                        setDispTarget(letter);
                        setDispForm({ toUserId: '', toUserName: '', instruction: '', dueDate: '' });
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0EA5E9] hover:bg-sky-600 text-white text-[11px] font-semibold"
                    >
                      <Send className="w-3 h-3" /> Disposisi
                    </button>
                  )}
                </div>
              </div>

              {letter.dispositions.length > 0 && (
                <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 space-y-2.5">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Riwayat Disposisi ({letter.dispositions.length})
                  </p>
                  <div className="space-y-2">
                    {letter.dispositions.map((d) => (
                      <div
                        key={d.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 text-xs">
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {d.fromUserName} → {d.toUserName}
                          </p>
                          <p className="text-slate-600 dark:text-slate-300">Instruksi: {d.instruction}</p>
                          <p className="text-[11px] text-slate-500">
                            {formatTanggalIndonesia(d.createdAt, true)}
                            {d.dueDate ? ` · Tenggat: ${formatTanggalIndonesia(d.dueDate)}` : ''}
                            {d.responseNote ? ` · Catatan: ${d.responseNote}` : ''}
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <StatusIndicator status={d.status} />
                          {d.status !== 'selesai' && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="text"
                                placeholder="Catatan tindak lanjut..."
                                value={responseNotes[d.id] || ''}
                                onChange={(e) =>
                                  setResponseNotes((prev) => ({ ...prev, [d.id]: e.target.value }))
                                }
                                className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px] w-40"
                              />
                              <button
                                type="button"
                                onClick={() => handleDispositionStatus(d.id, 'ditindaklanjuti')}
                                className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-[11px] font-semibold hover:border-[#0EA5E9]"
                              >
                                Proses
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDispositionStatus(d.id, 'selesai')}
                                className="px-2 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold"
                              >
                                Selesai
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Catat Agenda Surat Resmi">
        <form onSubmit={handleCreateLetter} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="c-dir" className="block text-xs font-semibold mb-1">Arah Surat</label>
              <select
                id="c-dir"
                value={form.direction}
                onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as 'masuk' | 'keluar' }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="masuk">Surat Masuk</option>
                <option value="keluar">Surat Keluar</option>
              </select>
            </div>
            <div>
              <label htmlFor="c-type" className="block text-xs font-semibold mb-1">Jenis Surat</label>
              <select
                id="c-type"
                value={form.letterType}
                onChange={(e) => setForm((f) => ({ ...f, letterType: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="Surat Undangan">Surat Undangan</option>
                <option value="Surat Tugas">Surat Tugas</option>
                <option value="Surat Keputusan">Surat Keputusan (SK)</option>
                <option value="Surat Rekomendasi">Surat Rekomendasi</option>
                <option value="Surat Kemitraan">Surat Kemitraan</option>
                <option value="Surat Pemberitahuan">Surat Pemberitahuan</option>
              </select>
            </div>
            <div>
              <label htmlFor="c-urg" className="block text-xs font-semibold mb-1">Sifat / Urgensi</label>
              <select
                id="c-urg"
                value={form.urgency}
                onChange={(e) => setForm((f) => ({ ...f, urgency: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="biasa">Biasa</option>
                <option value="segera">Segera</option>
                <option value="sangat_segera">Sangat Segera</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="c-subj" className="block text-xs font-semibold mb-1">Perihal Surat *</label>
            <input
              id="c-subj"
              required
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="c-sender" className="block text-xs font-semibold mb-1">Pengirim *</label>
              <input
                id="c-sender"
                required
                value={form.senderName}
                onChange={(e) => setForm((f) => ({ ...f, senderName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="c-rec" className="block text-xs font-semibold mb-1">Penerima *</label>
              <input
                id="c-rec"
                required
                value={form.recipientName}
                onChange={(e) => setForm((f) => ({ ...f, recipientName: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="c-date" className="block text-xs font-semibold mb-1">Tanggal Surat</label>
              <input
                id="c-date"
                type="date"
                value={form.letterDate}
                onChange={(e) => setForm((f) => ({ ...f, letterDate: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label htmlFor="c-prov" className="block text-xs font-semibold mb-1">Wilayah Terkait</label>
              <select
                id="c-prov"
                value={form.provinceCode}
                onChange={(e) => setForm((f) => ({ ...f, provinceCode: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">Nasional</option>
                {INDONESIA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="c-prog" className="block text-xs font-semibold mb-1">Program Unggulan</label>
              <select
                id="c-prog"
                value={form.programId}
                onChange={(e) => setForm((f) => ({ ...f, programId: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="">Umum / Non-program</option>
                {programs.map((pr) => (
                  <option key={pr.id} value={pr.id}>
                    {pr.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="c-sum" className="block text-xs font-semibold mb-1">Ringkasan Isi Surat</label>
            <textarea
              id="c-sum"
              rows={2}
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="c-file" className="block text-xs font-semibold mb-1">Lampiran PDF / Scan Surat (Opsional)</label>
            <div className="flex items-center gap-2">
              <input
                id="c-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadAttachment(file);
                }}
                className="text-xs"
              />
              {uploading && <span className="text-xs text-[#0EA5E9]">Mengunggah...</span>}
              {form.fileName && <span className="text-xs text-emerald-600">{form.fileName}</span>}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setCreateOpen(false)} className="px-4 py-2 rounded-xl border text-xs font-semibold">
              Batal
            </button>
            <button type="submit" disabled={saving || uploading} className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
              {saving ? 'Menyimpan...' : 'Simpan Surat'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(dispTarget)} onClose={() => setDispTarget(null)} title={`Disposisi ${dispTarget?.referenceNumber || ''}`}>
        <form onSubmit={handleDispose} className="space-y-3">
          <div>
            <label htmlFor="d-user" className="block text-xs font-semibold mb-1">Teruskan Kepada Pengguna</label>
            <select
              id="d-user"
              value={dispForm.toUserId}
              onChange={(e) => {
                const chosen = recipients.find((r) => r.id === e.target.value);
                setDispForm((f) => ({
                  ...f,
                  toUserId: e.target.value,
                  toUserName: chosen ? chosen.fullName : f.toUserName,
                }));
              }}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              <option value="">-- Pilih Pengurus / Koordinator --</option>
              {recipients.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName} ({r.role.replace(/_/g, ' ')})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="d-name" className="block text-xs font-semibold mb-1">Atau Nama Penerima Manual</label>
            <input
              id="d-name"
              value={dispForm.toUserName}
              onChange={(e) => setDispForm((f) => ({ ...f, toUserName: e.target.value }))}
              placeholder="Contoh: Kepala Bidang Pendidikan & Kebudayaan"
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="d-inst" className="block text-xs font-semibold mb-1">Instruksi Tindak Lanjut *</label>
            <textarea
              id="d-inst"
              required
              rows={3}
              value={dispForm.instruction}
              onChange={(e) => setDispForm((f) => ({ ...f, instruction: e.target.value }))}
              placeholder="Jelaskan tindak lanjut yang diperlukan..."
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="d-due" className="block text-xs font-semibold mb-1">Tenggat Waktu (Opsional)</label>
            <input
              id="d-due"
              type="date"
              value={dispForm.dueDate}
              onChange={(e) => setDispForm((f) => ({ ...f, dueDate: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setDispTarget(null)} className="px-4 py-2 rounded-xl border text-xs font-semibold">
              Batal
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
              {saving ? 'Mengirim...' : 'Kirim Disposisi'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
