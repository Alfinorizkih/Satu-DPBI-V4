import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, Eye, FileText, MapPin, Plus, Printer, RotateCcw, Save } from 'lucide-react';
import { apiGet, apiPost, apiUrl } from '../lib/api';
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
import { LocationVerifyModal } from '../components/LocationVerifyModal';
import { A4PrintModal, type PrintDocumentConfig } from '../components/print/A4PrintEngine';
import type { FlagshipProgramRecord, LklRecord, ProposalRecord } from '../lib/types';
import { formatTanggalIndonesia } from '../lib/rbac';
import { clearOfflineDraft, loadOfflineDraft, saveOfflineDraft } from '../lib/offlineDraft';

const PAGE_SIZE = 10;

export function LklPage({
  initialMode = 'list',
  initialId,
}: {
  initialMode?: 'list' | 'create' | 'detail';
  initialId?: string;
}) {
  const { user, can, notify, navigate } = useAuth();
  const [reports, setReports] = useState<LklRecord[]>([]);
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formDirty, setFormDirty] = useState(false);
  const { showConfirmDialog, guardAction, confirmLeave, cancelLeave } = useUnsavedChanges(formDirty);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<LklRecord | null>(null);
  const [previewPdfId, setPreviewPdfId] = useState<string | null>(null);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState<PrintDocumentConfig | null>(null);
  const [pendingReview, setPendingReview] = useState<'diterima' | 'ditolak' | null>(null);
  const [reviseForm, setReviseForm] = useState<{
    summary: string;
    outcomes: string;
    participantCount: number;
    pdfFileId: string | null;
    pdfFileName: string | null;
  } | null>(null);

  const [programs, setPrograms] = useState<FlagshipProgramRecord[]>([]);
  const [offlineDraftBanner, setOfflineDraftBanner] = useState<{ savedAt: string; data: typeof defaultForm } | null>(null);

  const defaultForm = {
    activityName: '',
    proposalId: '',
    programId: '',
    activityMode: 'luring' as 'luring' | 'daring',
    regency: '',
    district: '',
    village: '',
    venueName: '',
    venueAddress: '',
    platformName: 'Zoom Meeting',
    platformLink: '',
    eventDate: new Date().toISOString().slice(0, 10),
    startTime: '09:00',
    endTime: '12:00',
    category: 'Edukasi & Pelestarian Budaya',
    participantCount: 40,
    summary: '',
    outcomes: '',
    obstacles: '',
    followUp: '',
    pdfFileId: null as string | null,
    pdfFileName: null as string | null,
    photoFileIds: [] as string[],
    photoNames: [] as string[],
  };

  const [form, setForm] = useState(defaultForm);

  const load = async () => {
    setLoading(true);
    try {
      const [lRes, pRes, progRes] = await Promise.all([
        apiGet<{ reports: LklRecord[] }>('/api/lkl'),
        can('proposal', 'view') ? apiGet<{ proposals: ProposalRecord[] }>('/api/proposals') : Promise.resolve({ proposals: [] }),
        apiGet<{ programs: FlagshipProgramRecord[] }>('/api/programs').catch(() => ({ programs: [] })),
      ]);
      setReports(lRes.reports);
      setProposals(pRes.proposals);
      setPrograms(progRes.programs || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreateModal = (updateUrl = true) => {
    setForm(defaultForm);
    const saved = loadOfflineDraft<typeof defaultForm>(user?.id, 'lkl_form');
    if (saved && saved.data && (saved.data.activityName || saved.data.summary || saved.data.outcomes)) {
      setOfflineDraftBanner(saved);
    } else {
      setOfflineDraftBanner(null);
    }
    setFormDirty(false);
    setCreateOpen(true);
    if (updateUrl) navigate('/laporan-kegiatan/baru');
  };

  useEffect(() => {
    if (initialMode === 'create' && can('lkl', 'create')) {
      openCreateModal(false);
    }
  }, [initialMode]);

  useEffect(() => {
    if (!createOpen || !formDirty) return;
    const t = window.setTimeout(() => {
      saveOfflineDraft(user?.id, 'lkl_form', form);
    }, 500);
    return () => window.clearTimeout(t);
  }, [createOpen, formDirty, form, user?.id]);

  useEffect(() => {
    if (!loading && initialMode === 'detail' && initialId && reports.length > 0) {
      const target = reports.find((r) => r.id === initialId || r.referenceNumber === initialId);
      if (target && selected?.id !== target.id) {
        setSelected(target);
        setPreviewPdfId(target.pdfFileId);
        setReviewNote('');
        setReviseForm(
          target.status === 'perlu_revisi'
            ? {
                summary: target.summary,
                outcomes: target.outcomes,
                participantCount: target.participantCount,
                pdfFileId: target.pdfFileId,
                pdfFileName: target.pdfFileName,
              }
            : null
        );
      }
    }
  }, [loading, initialMode, initialId, reports]);

  const updateLklForm = (patch: Partial<typeof defaultForm>) => {
    setFormDirty(true);
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const closeCreateModal = () => {
    guardAction(() => {
      setFormDirty(false);
      setCreateOpen(false);
      navigate('/laporan-kegiatan');
    });
  };

  const saveLocalDraft = () => {
    const savedAt = saveOfflineDraft(user?.id, 'lkl_form', form);
    if (savedAt) {
      setFormDirty(false);
      notify('Draft LKL tersimpan di perangkat Anda dan akan dipulihkan saat formulir dibuka lagi.', 'info');
    } else {
      notify('Tidak dapat menyimpan draft lokal.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await apiPost<{ referenceNumber: string }>('/api/lkl', {
        ...form,
        programId: form.programId || null,
      });
      clearOfflineDraft(user?.id, 'lkl_form');
      setOfflineDraftBanner(null);
      setFormDirty(false);
      notify(`LKL ${res.referenceNumber} berhasil dikirim untuk pemeriksaan Koordinator Wilayah.`, 'success');
      setCreateOpen(false);
      setForm(defaultForm);
      navigate('/laporan-kegiatan');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim LKL.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReview = async (decision: 'diterima' | 'perlu_revisi' | 'ditolak') => {
    if (!selected) return;
    try {
      await apiPost(`/api/lkl/${selected.id}/review`, { decision, note: reviewNote });
      notify(`Pemeriksaan LKL selesai: ${decision.replace(/_/g, ' ')}.`, 'success');
      setSelected(null);
      setReviewNote('');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan pemeriksaan LKL.', 'error');
    }
  };

  const handleReviseLkl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !reviseForm) return;
    try {
      const res = await apiPost<{ version: number }>(`/api/lkl/${selected.id}/revise`, reviseForm);
      notify(`Revisi LKL versi ${res.version} berhasil dikirim ulang untuk pemeriksaan.`, 'success');
      setSelected(null);
      setReviseForm(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim revisi LKL.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  const approvedProposals = proposals.filter((p) => p.status === 'disetujui');

  const paged = reports.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Laporan Kegiatan Lapangan (LKL)</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pelaporan digital luring & daring terhubung dengan proposal, pratinjau PDF nyaman di desktop & mobile, serta galeri dokumentasi.
          </p>
        </div>
        {can('lkl', 'create') && (
          <button
            type="button"
            onClick={() => openCreateModal(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Kirim LKL Baru
          </button>
        )}
      </div>

      <GlassCard className="p-5 space-y-4">
        {reports.length === 0 ? (
          <EmptyState
            title="Belum ada LKL terkirim"
            description="Setelah melaksanakan kegiatan, kirimkan LKL beserta PDF laporan dan foto dokumentasi."
            actionLabel={can('lkl', 'create') ? 'Buat LKL Pertama' : undefined}
            onAction={can('lkl', 'create') ? () => openCreateModal(true) : undefined}
          />
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Nomor LKL</th>
                    <th className="py-2.5 pr-4">Nama Kegiatan & Moda</th>
                    <th className="py-2.5 pr-4">Pelapor & Wilayah</th>
                    <th className="py-2.5 pr-4 text-right">Peserta</th>
                    <th className="py-2.5 pr-4">Status</th>
                    <th className="py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                  {paged.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                      <td className="py-3 pr-4 font-mono tabular-nums">
                        <p className="font-semibold text-[#0EA5E9]">{r.referenceNumber}</p>
                        {r.proposalRef && <p className="text-[11px] text-slate-400">Ref: {r.proposalRef}</p>}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-semibold text-slate-900 dark:text-white">{r.activityName}</p>
                        <p className="text-[11px] text-slate-500">
                          {r.activityMode === 'daring' ? `Daring · ${r.platformName}` : `Luring · ${r.venueName || r.regency}`}
                        </p>
                      </td>
                      <td className="py-3 pr-4">
                        <p>{r.submitterName}</p>
                        <p className="text-[11px] text-slate-500">{r.provinceName} · {formatTanggalIndonesia(r.eventDate)}</p>
                      </td>
                      <td className="py-3 pr-4 text-right font-mono tabular-nums">{r.participantCount}</td>
                      <td className="py-3 pr-4"><StatusIndicator status={r.status} /></td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelected(r);
                            setPreviewPdfId(r.pdfFileId);
                            setReviewNote('');
                            setReviseForm(
                              r.status === 'perlu_revisi'
                                ? {
                                    summary: r.summary,
                                    outcomes: r.outcomes,
                                    participantCount: r.participantCount,
                                    pdfFileId: r.pdfFileId,
                                    pdfFileName: r.pdfFileName,
                                  }
                                : null
                            );
                            navigate(`/laporan-kegiatan/${r.id}`);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0EA5E9] hover:text-white font-semibold"
                        >
                          <Eye className="w-3.5 h-3.5" /> Periksa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
              {paged.map((r) => (
                <div key={r.id} className="py-3.5 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono text-[11px] text-[#0EA5E9]">{r.referenceNumber}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{r.activityName}</p>
                      <p className="text-[11px] text-slate-500">
                        {r.submitterName} · {r.provinceName} · {r.participantCount} peserta
                      </p>
                    </div>
                    <StatusIndicator status={r.status} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(r);
                      setPreviewPdfId(r.pdfFileId);
                      setReviewNote('');
                      setReviseForm(
                        r.status === 'perlu_revisi'
                          ? {
                              summary: r.summary,
                              outcomes: r.outcomes,
                              participantCount: r.participantCount,
                              pdfFileId: r.pdfFileId,
                              pdfFileName: r.pdfFileName,
                            }
                          : null
                      );
                    }}
                    className="w-full min-h-[40px] inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                  >
                    <Eye className="w-3.5 h-3.5" /> Buka Laporan & Pratinjau PDF
                  </button>
                </div>
              ))}
            </div>

            <Pagination page={page} totalItems={reports.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </>
        )}
      </GlassCard>

      {/* Create LKL Modal */}
      <Modal open={createOpen} onClose={closeCreateModal} title="Kirim Laporan Kegiatan Lapangan (LKL)">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {offlineDraftBanner && (
            <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sky-900 dark:text-sky-100">
                Tersimpan draft LKL lokal ({formatTanggalIndonesia(offlineDraftBanner.savedAt, true)}). Pulihkan isian sebelumnya?
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...defaultForm, ...offlineDraftBanner.data });
                    setOfflineDraftBanner(null);
                    setFormDirty(true);
                    notify('Draft LKL lokal dipulihkan.', 'info');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-[#0EA5E9] text-white font-semibold"
                >
                  Pulihkan Draft
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearOfflineDraft(user?.id, 'lkl_form');
                    setOfflineDraftBanner(null);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                >
                  Hapus Draft
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block font-semibold mb-1">Nama Kegiatan</label>
            <input type="text" required value={form.activityName} onChange={(e) => updateLklForm({ activityName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Hubungkan ke Proposal Disetujui (Opsional)</label>
              <select
                value={form.proposalId}
                onChange={(e) => {
                  const chosenId = e.target.value;
                  const prop = approvedProposals.find((p) => p.id === chosenId);
                  if (prop) {
                    updateLklForm({
                      proposalId: chosenId,
                      programId: prop.programId || form.programId,
                      activityName: form.activityName || prop.title,
                      eventDate: prop.eventDate || form.eventDate,
                      category: prop.category || form.category,
                      activityMode: prop.activityMode === 'daring' ? 'daring' : 'luring',
                      participantCount: prop.estimatedParticipants || form.participantCount,
                    });
                  } else {
                    updateLklForm({ proposalId: chosenId });
                  }
                }}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="">Kegiatan Non-Proposal (Mandiri)</option>
                {approvedProposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.referenceNumber} — {p.title}
                  </option>
                ))}
              </select>
              {approvedProposals.length === 0 && (
                <p className="text-[11px] text-slate-500 mt-1">
                  Hanya proposal berstatus <strong>Disetujui</strong> yang dapat ditautkan ke LKL.
                </p>
              )}
            </div>
            <div>
              <label className="block font-semibold mb-1">Moda Kegiatan</label>
              <select value={form.activityMode} onChange={(e) => updateLklForm({ activityMode: e.target.value as 'luring' | 'daring' })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                <option value="luring">Luring (Lokasi Fisik)</option>
                <option value="daring">Daring (Platform Digital)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Program Unggulan Terkait (Opsional)</label>
            <select
              value={form.programId}
              onChange={(e) => updateLklForm({ programId: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              <option value="">Kegiatan Umum / Non-Program Unggulan</option>
              {programs.map((pr) => (
                <option key={pr.id} value={pr.id}>
                  {pr.name}
                </option>
              ))}
            </select>
          </div>

          {form.activityMode === 'luring' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <div>
                <label className="block font-semibold mb-1">Kabupaten / Kota</label>
                <input required value={form.regency} onChange={(e) => updateLklForm({ regency: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nama Tempat</label>
                <input required value={form.venueName} onChange={(e) => updateLklForm({ venueName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Alamat Lengkap Tempat Kegiatan</label>
                <input required value={form.venueAddress} onChange={(e) => updateLklForm({ venueAddress: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/30">
              <div>
                <label className="block font-semibold mb-1">Platform Daring</label>
                <input required value={form.platformName} onChange={(e) => updateLklForm({ platformName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Tautan Kegiatan (Opsional)</label>
                <input value={form.platformLink} onChange={(e) => updateLklForm({ platformLink: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Tanggal</label>
              <input type="date" required value={form.eventDate} onChange={(e) => updateLklForm({ eventDate: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Waktu Mulai</label>
              <input type="time" value={form.startTime} onChange={(e) => updateLklForm({ startTime: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Jumlah Peserta</label>
              <input type="number" min={1} required value={form.participantCount} onChange={(e) => updateLklForm({ participantCount: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Ringkasan Pelaksanaan</label>
            <textarea rows={3} required value={form.summary} onChange={(e) => updateLklForm({ summary: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Hasil & Capaian Kegiatan</label>
            <textarea rows={2} required value={form.outcomes} onChange={(e) => updateLklForm({ outcomes: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FileDropzone
              label="PDF LKL Resmi"
              accept=".pdf,application/pdf"
              moduleName="lkl"
              uploadedFileName={form.pdfFileName}
              onUploaded={(res) => updateLklForm({ pdfFileId: res.fileId, pdfFileName: res.fileName })}
            />
            <FileDropzone
              label="Foto Dokumentasi (JPG/PNG/WebP)"
              accept="image/jpeg,image/png,image/webp"
              moduleName="lkl"
              uploadedFileName={form.photoNames.join(', ')}
              onUploaded={(res) =>
                updateLklForm({
                  photoFileIds: [...form.photoFileIds, res.fileId],
                  photoNames: [...form.photoNames, res.fileName],
                })
              }
            />
          </div>

          {/* Pre-submit readiness checklist */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-3 space-y-1.5">
            <p className="font-semibold text-slate-800 dark:text-slate-200">Daftar Periksa Kelengkapan Sebelum Kirim</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${form.summary.trim() ? 'text-emerald-600' : 'text-slate-400'}`} />
                Ringkasan &amp; capaian terisi
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${form.pdfFileId ? 'text-emerald-600' : 'text-slate-400'}`} />
                PDF laporan resmi {form.pdfFileId ? 'terunggah' : '(disarankan)'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${form.photoFileIds.length > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                Foto dokumentasi ({form.photoFileIds.length} berkas)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className={`w-3.5 h-3.5 ${form.proposalId ? 'text-emerald-600' : 'text-slate-400'}`} />
                {form.proposalId ? 'Tautan proposal disetujui' : 'Kegiatan non-proposal'}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              disabled={submitting}
              onClick={saveLocalDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Draft Lokal
            </button>
            <button type="submit" disabled={submitting} className="px-4 py-2.5 rounded-xl bg-[#0EA5E9] text-white font-semibold disabled:opacity-60">
              {submitting ? 'Mengirim LKL...' : 'Kirim LKL'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Review LKL Modal with Responsive PDF Preview & Photo Lightbox */}
      <Modal
        open={Boolean(selected)}
        onClose={() => {
          setSelected(null);
          setPreviewPdfId(null);
          setLightboxPhotoId(null);
          navigate('/laporan-kegiatan');
        }}
        title={selected?.activityName || 'Pemeriksaan LKL'}
        subtitle={selected ? `${selected.referenceNumber} · ${selected.submitterName} · ${selected.provinceName}` : ''}
        maxWidth="max-w-4xl"
      >
        {selected && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <StatusIndicator status={selected.status} />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPrintConfig({
                      template: 'lkl',
                      documentNumber: selected.referenceNumber,
                      title: selected.activityName,
                      subtitle: `Laporan Kegiatan Lapangan · ${selected.provinceName}`,
                      issuedDate: selected.eventDate,
                      metadata: [
                        { label: 'Pelapor', value: selected.submitterName },
                        { label: 'Wilayah', value: selected.provinceName },
                        { label: 'Moda & Lokasi', value: selected.activityMode === 'daring' ? `Daring (${selected.platformName || 'Online'})` : `${selected.venueName}, ${selected.regency}` },
                        { label: 'Tanggal & Waktu', value: `${formatTanggalIndonesia(selected.eventDate)} (${selected.startTime}–${selected.endTime})` },
                        { label: 'Jumlah Peserta', value: `${selected.participantCount} orang` },
                        { label: 'Ref Proposal', value: selected.proposalRef || 'Non-Proposal' },
                      ],
                      sections: [
                        { heading: 'Ringkasan Pelaksanaan', body: selected.summary },
                        { heading: 'Hasil & Dampak Kegiatan', body: selected.outcomes },
                        ...(selected.obstacles ? [{ heading: 'Kendala Lapangan', body: selected.obstacles }] : []),
                        ...(selected.followUp ? [{ heading: 'Rencana Tindak Lanjut', body: selected.followUp }] : []),
                      ],
                      photoFileIds: selected.photoFileIds,
                      signatoryName: selected.submitterName,
                      signatoryRole: 'Pelapor Kegiatan Lapangan',
                      signatoryLocation: selected.provinceName,
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                >
                  <Printer className="w-3.5 h-3.5 text-[#0EA5E9]" /> Cetak LKL A4
                </button>
                {selected.pdfFileId && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPreviewPdfId((prev) => (prev ? null : selected.pdfFileId))}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                    >
                      <FileText className="w-3.5 h-3.5 text-[#0EA5E9]" /> {previewPdfId ? 'Sembunyikan PDF' : 'Tampilkan Pratinjau PDF'}
                    </button>
                    <a href={apiUrl(`/api/files/${selected.pdfFileId}`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-[#0EA5E9] font-semibold">
                      <Download className="w-3.5 h-3.5" /> Unduh PDF LKL
                    </a>
                  </>
                )}
              </div>
            </div>

            {previewPdfId && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950">
                <iframe
                  title="Pratinjau PDF Laporan Kegiatan Lapangan"
                  src={apiUrl(`/api/files/${previewPdfId}/preview`)}
                  className="w-full h-[50vh] sm:h-[60vh]"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <p><strong>Moda:</strong> {selected.activityMode === 'daring' ? `Daring (${selected.platformName})` : `Luring (${selected.venueName}, ${selected.regency})`}</p>
              <p><strong>Peserta:</strong> {selected.participantCount} orang</p>
              <p><strong>Tanggal:</strong> {formatTanggalIndonesia(selected.eventDate)} ({selected.startTime}–{selected.endTime})</p>
              <p><strong>Ref Proposal:</strong> {selected.proposalRef || 'Kegiatan Non-Proposal'}</p>
            </div>

            <div>
              <p className="font-semibold">Ringkasan Kegiatan</p>
              <p className="text-slate-600 dark:text-slate-300 mt-1">{selected.summary}</p>
            </div>
            <div>
              <p className="font-semibold">Hasil & Dampak</p>
              <p className="text-slate-600 dark:text-slate-300 mt-1">{selected.outcomes}</p>
            </div>

            {selected.photoFileIds.length > 0 && (
              <div>
                <p className="font-semibold mb-2">Foto Dokumentasi ({selected.photoFileIds.length}) — klik foto untuk memperbesar</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selected.photoFileIds.map((fid) => (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => setLightboxPhotoId(fid)}
                      className="rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] transition-colors"
                    >
                      <img src={apiUrl(`/api/files/${fid}/preview`)} alt="Dokumentasi kegiatan" referrerPolicy="no-referrer" className="object-cover h-28 w-full" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selected.status === 'perlu_revisi' && can('lkl', 'edit') && reviseForm && (
              <form onSubmit={handleReviseLkl} className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <p className="font-bold flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                  <RotateCcw className="w-4 h-4" /> Perbaiki &amp; Kirim Revisi LKL
                </p>
                {selected.reviewNote && (
                  <p className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-2.5 text-amber-900 dark:text-amber-200">
                    Catatan Peninjau: {selected.reviewNote}
                  </p>
                )}
                <div>
                  <label className="block font-semibold mb-1">Ringkasan Pelaksanaan *</label>
                  <textarea
                    rows={2}
                    required
                    value={reviseForm.summary}
                    onChange={(e) => setReviseForm({ ...reviseForm, summary: e.target.value })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Hasil &amp; Capaian *</label>
                    <input
                      required
                      value={reviseForm.outcomes}
                      onChange={(e) => setReviseForm({ ...reviseForm, outcomes: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Jumlah Peserta</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={reviseForm.participantCount}
                      onChange={(e) => setReviseForm({ ...reviseForm, participantCount: Number(e.target.value) })}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                    />
                  </div>
                </div>
                <FileDropzone
                  label="Unggah PDF LKL Revisi (Opsional)"
                  accept=".pdf,application/pdf"
                  moduleName="lkl"
                  uploadedFileName={reviseForm.pdfFileName}
                  onUploaded={(res) => setReviseForm({ ...reviseForm, pdfFileId: res.fileId, pdfFileName: res.fileName })}
                />
                <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white font-semibold">
                  Kirim Revisi LKL
                </button>
              </form>
            )}

            {can('lkl', 'review') && user?.role !== 'duta' && (
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">Pemeriksaan Koordinator Wilayah</p>
                  {selected.activityMode === 'luring' && user?.role === 'koordinator_wilayah' && (
                    <button type="button" onClick={() => setLocModalOpen(true)} className="inline-flex items-center gap-1 text-[#0EA5E9] font-semibold hover:underline">
                      <MapPin className="w-3.5 h-3.5" /> Verifikasi Lokasi Wilayah
                    </button>
                  )}
                </div>
                <input value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder="Catatan pemeriksaan atau arahan revisi..." className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPendingReview('diterima')} className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Terima LKL</button>
                  <button type="button" onClick={() => handleReview('perlu_revisi')} className="px-3.5 py-2 rounded-xl bg-amber-500 text-white font-semibold">Minta Revisi</button>
                  <button type="button" onClick={() => setPendingReview('ditolak')} className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-semibold">Tolak</button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Photo Lightbox Modal */}
      <Modal
        open={Boolean(lightboxPhotoId)}
        onClose={() => setLightboxPhotoId(null)}
        title="Pratinjau Dokumentasi Foto"
        maxWidth="max-w-3xl"
      >
        {lightboxPhotoId && (
          <img
            src={apiUrl(`/api/files/${lightboxPhotoId}/preview`)}
            alt="Dokumentasi kegiatan LKL"
            className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-950"
          />
        )}
      </Modal>

      <LocationVerifyModal
        open={locModalOpen}
        onClose={() => setLocModalOpen(false)}
        provinceCode={user?.provinceCode || '32'}
        provinceName={user?.provinceName || 'Jawa Barat'}
        actionType="verifikasi_lkl_luring"
        onVerified={() => setLocModalOpen(false)}
      />

      <ConfirmDialog
        open={showConfirmDialog}
        title="Batalkan Pengisian LKL?"
        message="Anda memiliki isian LKL yang belum dikirim atau disimpan sebagai draft lokal. Yakin ingin keluar?"
        confirmLabel="Buang Perubahan"
        cancelLabel="Lanjutkan Mengisi"
        danger
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
      />

      <ConfirmDialog
        open={Boolean(pendingReview)}
        title={pendingReview === 'diterima' ? 'Terima LKL & Selesaikan Tugas Pelaporan?' : 'Konfirmasi Penolakan LKL'}
        message={
          pendingReview === 'diterima'
            ? 'Menerima LKL ini akan otomatis menyelesaikan tugas dokumentasi & pelaporan terkait pada proposal yang terhubung.'
            : 'LKL yang ditolak tidak dapat diajukan ulang pada laporan yang sama. Pastikan catatan alasan sudah lengkap.'
        }
        confirmLabel={pendingReview === 'diterima' ? 'Ya, Terima LKL' : 'Ya, Tolak LKL'}
        danger={pendingReview === 'ditolak'}
        onConfirm={() => {
          const d = pendingReview;
          setPendingReview(null);
          if (d) handleReview(d);
        }}
        onCancel={() => setPendingReview(null)}
      />

      <A4PrintModal
        open={Boolean(printConfig)}
        config={printConfig}
        onClose={() => setPrintConfig(null)}
      />
    </div>
  );
}
