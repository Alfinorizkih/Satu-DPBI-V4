import React, { useEffect, useState } from 'react';
import { Download, Eye, FileText, MapPin, Plus, Save } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import {
  EmptyState,
  FileDropzone,
  GlassCard,
  LoadingSkeleton,
  Modal,
  Pagination,
  StatusIndicator,
} from '../components/ui/Primitives';
import { LocationVerifyModal } from '../components/LocationVerifyModal';
import type { LklRecord, ProposalRecord } from '../lib/types';
import { formatTanggalIndonesia } from '../lib/rbac';

const PAGE_SIZE = 10;

export function LklPage() {
  const { user, can, notify } = useAuth();
  const [reports, setReports] = useState<LklRecord[]>([]);
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selected, setSelected] = useState<LklRecord | null>(null);
  const [previewPdfId, setPreviewPdfId] = useState<string | null>(null);
  const [lightboxPhotoId, setLightboxPhotoId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [locModalOpen, setLocModalOpen] = useState(false);

  const draftKey = user ? `satu_dpbi_lkl_draft_${user.id}` : 'satu_dpbi_lkl_draft';

  const defaultForm = {
    activityName: '',
    proposalId: '',
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
      const [lRes, pRes] = await Promise.all([
        apiGet<{ reports: LklRecord[] }>('/api/lkl'),
        can('proposal', 'view') ? apiGet<{ proposals: ProposalRecord[] }>('/api/proposals') : Promise.resolve({ proposals: [] }),
      ]);
      setReports(lRes.reports);
      setProposals(pRes.proposals);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openCreateModal = () => {
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        setForm({ ...defaultForm, ...JSON.parse(saved) });
      } else {
        setForm(defaultForm);
      }
    } catch {
      setForm(defaultForm);
    }
    setCreateOpen(true);
  };

  const saveLocalDraft = () => {
    try {
      localStorage.setItem(draftKey, JSON.stringify(form));
      notify('Draft LKL tersimpan di perangkat Anda dan akan dipulihkan saat formulir dibuka lagi.', 'info');
    } catch {
      notify('Tidak dapat menyimpan draft lokal.', 'error');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{ referenceNumber: string }>('/api/lkl', form);
      localStorage.removeItem(draftKey);
      notify(`LKL ${res.referenceNumber} berhasil dikirim untuk pemeriksaan Koordinator Wilayah.`, 'success');
      setCreateOpen(false);
      setForm(defaultForm);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim LKL.', 'error');
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

  if (loading) return <LoadingSkeleton rows={5} />;

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
            onClick={openCreateModal}
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
            onAction={can('lkl', 'create') ? openCreateModal : undefined}
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
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Kirim Laporan Kegiatan Lapangan (LKL)">
        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold mb-1">Nama Kegiatan</label>
            <input required value={form.activityName} onChange={(e) => setForm({ ...form, activityName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Hubungkan ke Proposal (Opsional)</label>
              <select value={form.proposalId} onChange={(e) => setForm({ ...form, proposalId: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                <option value="">Tidak terhubung ke proposal</option>
                {proposals.map((p) => <option key={p.id} value={p.id}>{p.referenceNumber} — {p.title}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Moda Kegiatan</label>
              <select value={form.activityMode} onChange={(e) => setForm({ ...form, activityMode: e.target.value as 'luring' | 'daring' })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                <option value="luring">Luring (Lokasi Fisik)</option>
                <option value="daring">Daring (Platform Digital)</option>
              </select>
            </div>
          </div>

          {form.activityMode === 'luring' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40">
              <div>
                <label className="block font-semibold mb-1">Kabupaten / Kota</label>
                <input required value={form.regency} onChange={(e) => setForm({ ...form, regency: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Nama Tempat</label>
                <input required value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">Alamat Lengkap Tempat Kegiatan</label>
                <input required value={form.venueAddress} onChange={(e) => setForm({ ...form, venueAddress: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-sky-50/60 dark:bg-sky-950/30">
              <div>
                <label className="block font-semibold mb-1">Platform Daring</label>
                <input required value={form.platformName} onChange={(e) => setForm({ ...form, platformName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
              <div>
                <label className="block font-semibold mb-1">Tautan Kegiatan (Opsional)</label>
                <input value={form.platformLink} onChange={(e) => setForm({ ...form, platformLink: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Tanggal</label>
              <input type="date" required value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Waktu Mulai</label>
              <input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Jumlah Peserta</label>
              <input type="number" min={1} required value={form.participantCount} onChange={(e) => setForm({ ...form, participantCount: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>

          <div>
            <label className="block font-semibold mb-1">Ringkasan Pelaksanaan</label>
            <textarea rows={3} required value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Hasil & Capaian Kegiatan</label>
            <textarea rows={2} required value={form.outcomes} onChange={(e) => setForm({ ...form, outcomes: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FileDropzone
              label="PDF LKL Resmi"
              accept=".pdf,application/pdf"
              moduleName="lkl"
              uploadedFileName={form.pdfFileName}
              onUploaded={(res) => setForm({ ...form, pdfFileId: res.fileId, pdfFileName: res.fileName })}
            />
            <FileDropzone
              label="Foto Dokumentasi (JPG/PNG/WebP)"
              accept="image/jpeg,image/png,image/webp"
              moduleName="lkl"
              uploadedFileName={form.photoNames.join(', ')}
              onUploaded={(res) =>
                setForm({
                  ...form,
                  photoFileIds: [...form.photoFileIds, res.fileId],
                  photoNames: [...form.photoNames, res.fileName],
                })
              }
            />
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={saveLocalDraft}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
            >
              <Save className="w-3.5 h-3.5" /> Simpan Draft Lokal
            </button>
            <button type="submit" className="px-4 py-2.5 rounded-xl bg-[#0EA5E9] text-white font-semibold">Kirim LKL</button>
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
        }}
        title={selected?.activityName || 'Pemeriksaan LKL'}
        subtitle={selected ? `${selected.referenceNumber} · ${selected.submitterName} · ${selected.provinceName}` : ''}
        maxWidth="max-w-4xl"
      >
        {selected && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <StatusIndicator status={selected.status} />
              {selected.pdfFileId && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewPdfId((prev) => (prev ? null : selected.pdfFileId))}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                  >
                    <FileText className="w-3.5 h-3.5 text-[#0EA5E9]" /> {previewPdfId ? 'Sembunyikan PDF' : 'Tampilkan Pratinjau PDF'}
                  </button>
                  <a href={`/api/files/${selected.pdfFileId}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-[#0EA5E9] font-semibold">
                    <Download className="w-3.5 h-3.5" /> Unduh PDF LKL
                  </a>
                </div>
              )}
            </div>

            {previewPdfId && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950">
                <iframe
                  title="Pratinjau PDF Laporan Kegiatan Lapangan"
                  src={`/api/files/${previewPdfId}/preview`}
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
                      <img src={`/api/files/${fid}/preview`} alt="Dokumentasi kegiatan" referrerPolicy="no-referrer" className="object-cover h-28 w-full" />
                    </button>
                  ))}
                </div>
              </div>
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
                  <button type="button" onClick={() => handleReview('diterima')} className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white font-semibold">Terima LKL</button>
                  <button type="button" onClick={() => handleReview('perlu_revisi')} className="px-3.5 py-2 rounded-xl bg-amber-500 text-white font-semibold">Minta Revisi</button>
                  <button type="button" onClick={() => handleReview('ditolak')} className="px-3.5 py-2 rounded-xl bg-rose-600 text-white font-semibold">Tolak</button>
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
            src={`/api/files/${lightboxPhotoId}/preview`}
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
    </div>
  );
}
