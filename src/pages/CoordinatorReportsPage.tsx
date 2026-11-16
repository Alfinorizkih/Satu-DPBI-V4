import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Clock,
  Download,
  FileCheck2,
  FileText,
  MapPin,
  Plus,
  Printer,
  RotateCcw,
} from 'lucide-react';
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
import { A4PrintModal, type PrintDocumentConfig } from '../components/print/A4PrintEngine';
import { formatTanggalIndonesia } from '../lib/rbac';

interface CoordReport {
  id: string;
  referenceNumber: string;
  reportType: string;
  provinceCode: string;
  provinceName: string;
  coordinatorName: string;
  periodLabel: string;
  personnelCondition: string;
  activitiesSummary: string;
  lklRecapCount: number;
  obstacles: string;
  coachingNeeds: string;
  followUpPlan: string;
  pdfFileId: string | null;
  pdfFileName: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
}

const PAGE_SIZE = 6;

function computeCompleteness(r: CoordReport): { score: number; completed: number; total: number } {
  const checks = [
    Boolean(r.personnelCondition.trim()),
    Boolean(r.activitiesSummary.trim()),
    Boolean(r.obstacles.trim() || r.coachingNeeds.trim() || r.followUpPlan.trim()),
    Boolean(r.pdfFileId),
  ];
  const completed = checks.filter(Boolean).length;
  return {
    completed,
    total: checks.length,
    score: Math.round((completed / checks.length) * 100),
  };
}

export function CoordinatorReportsPage() {
  const { user, can, notify } = useAuth();
  const [reports, setReports] = useState<CoordReport[]>([]);
  const [filterType, setFilterType] = useState<'semua' | 'bulanan' | 'akhir'>('semua');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [locOpen, setLocOpen] = useState(false);
  const [locVerified, setLocVerified] = useState(false);
  const [previewPdfId, setPreviewPdfId] = useState<string | null>(null);
  const [reviewTarget, setReviewTarget] = useState<CoordReport | null>(null);
  const [reviewNote, setReviewNote] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [printConfig, setPrintConfig] = useState<PrintDocumentConfig | null>(null);

  const [form, setForm] = useState({
    reportType: 'bulanan' as 'bulanan' | 'akhir',
    periodLabel: 'November 2026',
    personnelCondition: '',
    activitiesSummary: '',
    obstacles: '',
    coachingNeeds: '',
    followUpPlan: '',
    pdfFileId: null as string | null,
    pdfFileName: null as string | null,
  });

  const load = () => {
    setLoading(true);
    apiGet<{ reports: CoordReport[] }>('/api/coordinator-reports')
      .then((res) => setReports(res.reports))
      .catch((err) => notify(err instanceof Error ? err.message : 'Gagal memuat laporan.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{ referenceNumber: string }>('/api/coordinator-reports', form);
      notify(`Laporan Koordinator ${res.referenceNumber} berhasil dikirim.`, 'success');
      setCreateOpen(false);
      setForm({
        reportType: 'bulanan',
        periodLabel: 'November 2026',
        personnelCondition: '',
        activitiesSummary: '',
        obstacles: '',
        coachingNeeds: '',
        followUpPlan: '',
        pdfFileId: null,
        pdfFileName: null,
      });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim laporan koordinator.', 'error');
    }
  };

  const handleReview = async (decision: 'diterima' | 'perlu_revisi') => {
    if (!reviewTarget) return;
    if (decision === 'perlu_revisi' && !reviewNote.trim()) {
      notify('Mohon isi catatan perbaikan ketika meminta revisi laporan.', 'error');
      return;
    }
    setSubmittingReview(true);
    try {
      await apiPost(`/api/coordinator-reports/${reviewTarget.id}/review`, {
        decision,
        note: reviewNote,
      });
      notify(
        decision === 'diterima'
          ? `Laporan ${reviewTarget.referenceNumber} ditandai Diterima.`
          : `Permintaan revisi dikirim untuk ${reviewTarget.referenceNumber}.`,
        'success'
      );
      setReviewTarget(null);
      setReviewNote('');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses pemeriksaan.', 'error');
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  const filtered = reports.filter((r) => (filterType === 'semua' ? true : r.reportType === filterType));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const canReviewNational = can('laporan_koordinator', 'review') && user?.role !== 'koordinator_wilayah';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Laporan Koordinator Wilayah
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Laporan bulanan berkala dan laporan akhir masa tugas wilayah beserta indikator kelengkapan dan pemeriksaan nasional.
          </p>
        </div>
        {can('laporan_koordinator', 'create') && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Kirim Laporan Wilayah
          </button>
        )}
      </div>

      {/* Deadline Policy Banner */}
      <GlassCard className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-start gap-2.5">
          <Clock className="w-4 h-4 text-[#0EA5E9] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-slate-900 dark:text-white">
              Ketentuan Tenggat & Kelengkapan Laporan Wilayah
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Laporan Bulanan dikirim paling lambat <strong className="tabular-nums">tanggal 5</strong> setiap bulan. Laporan Akhir Wilayah dikirim maksimal <strong className="tabular-nums">7×24 jam</strong> setelah periode angkatan selesai.
            </p>
          </div>
        </div>
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
          {[
            ['semua', `Semua (${reports.length})`],
            ['bulanan', 'Bulanan'],
            ['akhir', 'Akhir Wilayah'],
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setFilterType(k as typeof filterType);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                filterType === k
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>
      </GlassCard>

      {filtered.length === 0 ? (
        <EmptyState
          title="Belum ada laporan koordinator pada kategori ini"
          description="Kirim laporan bulanan atau laporan akhir wilayah untuk rekapitulasi dan verifikasi tingkat nasional."
          actionLabel={can('laporan_koordinator', 'create') ? 'Kirim Laporan Wilayah' : undefined}
          onAction={can('laporan_koordinator', 'create') ? () => setCreateOpen(true) : undefined}
        />
      ) : (
        <div className="space-y-4">
          {paged.map((r) => {
            const comp = computeCompleteness(r);
            const isPreviewOpen = previewPdfId === r.pdfFileId && r.pdfFileId !== null;
            return (
              <GlassCard key={r.id} className="p-5 space-y-4 text-xs">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-[#0EA5E9] font-semibold tabular-nums">
                      {r.referenceNumber} · {r.reportType === 'akhir' ? 'Laporan Akhir Wilayah' : 'Laporan Bulanan'}
                    </p>
                    <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {r.provinceName} — Periode {r.periodLabel}
                    </h2>
                    <p className="text-slate-500 dark:text-slate-400">
                      Koordinator: {r.coordinatorName} · Dikirim {formatTanggalIndonesia(r.createdAt, true)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusIndicator status={r.status} />
                    <button
                      type="button"
                      onClick={() =>
                        setPrintConfig({
                          template: 'laporan_koordinator',
                          documentNumber: r.referenceNumber,
                          title: `${r.reportType === 'akhir' ? 'Laporan Akhir Wilayah' : 'Laporan Bulanan Wilayah'} — ${r.provinceName}`,
                          subtitle: `Periode ${r.periodLabel}`,
                          issuedDate: r.createdAt,
                          metadata: [
                            { label: 'Provinsi', value: r.provinceName },
                            { label: 'Koordinator Wilayah', value: r.coordinatorName },
                            { label: 'Periode Laporan', value: r.periodLabel },
                            { label: 'Rekap LKL Diterima', value: `${r.lklRecapCount} kegiatan` },
                            { label: 'Kelengkapan', value: `${comp.completed}/${comp.total} (${comp.score}%)` },
                            { label: 'Status', value: r.status.replace(/_/g, ' ') },
                          ],
                          sections: [
                            { heading: 'Kondisi Personel Wilayah', body: r.personnelCondition },
                            { heading: 'Ringkasan Kegiatan & Capaian', body: r.activitiesSummary },
                            ...(r.obstacles || r.coachingNeeds
                              ? [{ heading: 'Kendala & Kebutuhan Pembinaan', body: `${r.obstacles || '—'}\nPembinaan: ${r.coachingNeeds || '—'}` }]
                              : []),
                            ...(r.followUpPlan ? [{ heading: 'Rencana Tindak Lanjut', body: r.followUpPlan }] : []),
                            ...(r.reviewNote ? [{ heading: 'Catatan Pemeriksaan Nasional', body: r.reviewNote }] : []),
                          ],
                          signatoryName: r.coordinatorName,
                          signatoryRole: `Koordinator Wilayah ${r.provinceName}`,
                          signatoryLocation: r.provinceName,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                    >
                      <Printer className="w-3.5 h-3.5 text-[#0EA5E9]" /> Cetak A4
                    </button>
                    {r.pdfFileId && (
                      <>
                        <button
                          type="button"
                          onClick={() => setPreviewPdfId((prev) => (prev === r.pdfFileId ? null : r.pdfFileId))}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#0EA5E9]" /> {isPreviewOpen ? 'Tutup PDF' : 'Pratinjau PDF'}
                        </button>
                        <a
                          href={`/api/files/${r.pdfFileId}?download=1`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-[#0EA5E9] font-semibold"
                        >
                          <Download className="w-3.5 h-3.5" /> Unduh
                        </a>
                      </>
                    )}
                    {canReviewNational && (
                      <button
                        type="button"
                        onClick={() => {
                          setReviewTarget(r);
                          setReviewNote(r.reviewNote || '');
                        }}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white font-semibold hover:bg-sky-600"
                      >
                        <FileCheck2 className="w-3.5 h-3.5" /> Periksa
                      </button>
                    )}
                  </div>
                </div>

                {/* Completeness Bar */}
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 p-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      Kelengkapan Berkas: <span className="font-mono tabular-nums text-[#0EA5E9]">{comp.completed}/{comp.total} ({comp.score}%)</span>
                    </span>
                    <span className="text-slate-400">·</span>
                    <span className="text-slate-600 dark:text-slate-400 tabular-nums">
                      Rekap LKL Diterima: <strong>{r.lklRecapCount} kegiatan</strong>
                    </span>
                  </div>
                  <div className="w-36 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div
                      className={`h-full transition-all ${comp.score === 100 ? 'bg-emerald-500' : 'bg-[#0EA5E9]'}`}
                      style={{ width: `${comp.score}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Kondisi Personel Wilayah</p>
                    <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{r.personnelCondition}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Ringkasan Kegiatan & Capaian</p>
                    <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">{r.activitiesSummary}</p>
                  </div>
                  {(r.obstacles || r.coachingNeeds) && (
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Kendala & Kebutuhan Pembinaan</p>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">
                        {r.obstacles || 'Tidak ada kendala signifikan'} {r.coachingNeeds ? `· Pembinaan: ${r.coachingNeeds}` : ''}
                      </p>
                    </div>
                  )}
                  {r.followUpPlan && (
                    <div>
                      <p className="font-semibold text-slate-800 dark:text-slate-200">Rencana Tindak Lanjut</p>
                      <p className="text-slate-600 dark:text-slate-300 mt-1">{r.followUpPlan}</p>
                    </div>
                  )}
                </div>

                {r.reviewNote && (
                  <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                    <p className="font-semibold text-amber-800 dark:text-amber-300">Catatan Pemeriksaan Nasional:</p>
                    <p className="text-slate-700 dark:text-slate-200 mt-0.5">{r.reviewNote}</p>
                  </div>
                )}

                {isPreviewOpen && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950">
                    <iframe
                      title={`Pratinjau PDF ${r.referenceNumber}`}
                      src={`/api/files/${r.pdfFileId}/preview`}
                      className="w-full h-[50vh] sm:h-[60vh]"
                    />
                  </div>
                )}
              </GlassCard>
            );
          })}
          <GlassCard className="px-5 pb-4">
            <Pagination page={page} totalItems={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </GlassCard>
        </div>
      )}

      {/* Submit Coordinator Report Modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Kirim Laporan Koordinator Wilayah">
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          {user?.role === 'koordinator_wilayah' && (
            <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3 flex flex-wrap items-center justify-between gap-3">
              <span>
                {locVerified
                  ? 'Lokasi wilayah telah diverifikasi untuk sesi laporan ini.'
                  : 'Verifikasi keberadaan wilayah (on-demand) sebelum pengiriman laporan.'}
              </span>
              <button
                type="button"
                onClick={() => setLocOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white font-semibold shrink-0"
              >
                <MapPin className="w-3.5 h-3.5" /> {locVerified ? 'Terverifikasi' : 'Verifikasi Lokasi'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Jenis Laporan</label>
              <select
                value={form.reportType}
                onChange={(e) => setForm({ ...form, reportType: e.target.value as 'bulanan' | 'akhir' })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="bulanan">Laporan Bulanan (Tenggat Tgl 5)</option>
                <option value="akhir">Laporan Akhir Wilayah (7×24 Jam)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Periode Laporan *</label>
              <input
                required
                value={form.periodLabel}
                onChange={(e) => setForm({ ...form, periodLabel: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Kondisi Personel Wilayah *</label>
            <textarea
              rows={2}
              required
              value={form.personnelCondition}
              onChange={(e) => setForm({ ...form, personnelCondition: e.target.value })}
              placeholder="Keaktifan Duta, keterlibatan sekolah mitra, dan kehadiran pembekalan..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Ringkasan Kegiatan & Program Berjalan *</label>
            <textarea
              rows={2}
              required
              value={form.activitiesSummary}
              onChange={(e) => setForm({ ...form, activitiesSummary: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Kendala Lapangan</label>
              <input
                value={form.obstacles}
                onChange={(e) => setForm({ ...form, obstacles: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Kebutuhan Pembinaan</label>
              <input
                value={form.coachingNeeds}
                onChange={(e) => setForm({ ...form, coachingNeeds: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Rencana Tindak Lanjut Bulan Berikutnya</label>
            <input
              value={form.followUpPlan}
              onChange={(e) => setForm({ ...form, followUpPlan: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <FileDropzone
            label="Unggah PDF Laporan Resmi Wilayah"
            accept=".pdf,application/pdf"
            moduleName="laporan_koordinator"
            uploadedFileName={form.pdfFileName}
            onUploaded={(res) => setForm({ ...form, pdfFileId: res.fileId, pdfFileName: res.fileName })}
          />
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white font-semibold">
              Kirim Laporan Wilayah
            </button>
          </div>
        </form>
      </Modal>

      {/* National Review Modal */}
      <Modal
        open={Boolean(reviewTarget)}
        onClose={() => setReviewTarget(null)}
        title={`Pemeriksaan Laporan ${reviewTarget?.referenceNumber || ''}`}
        subtitle={reviewTarget ? `${reviewTarget.provinceName} · Periode ${reviewTarget.periodLabel}` : ''}
      >
        {reviewTarget && (
          <div className="space-y-4 text-xs">
            <p className="text-slate-600 dark:text-slate-300">
              Tinjau kelengkapan narasi wilayah, kesesuaian rekap LKL ({reviewTarget.lklRecapCount} kegiatan), dan berkas PDF resmi sebelum menetapkan status penerimaan.
            </p>
            <div>
              <label className="block font-semibold mb-1">Catatan Pemeriksaan / Arahan Revisi</label>
              <textarea
                rows={3}
                value={reviewNote}
                onChange={(e) => setReviewNote(e.target.value)}
                placeholder="Wajib diisi jika meminta revisi laporan koordinator..."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={submittingReview}
                onClick={() => handleReview('perlu_revisi')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Minta Revisi
              </button>
              <button
                type="button"
                disabled={submittingReview}
                onClick={() => handleReview('diterima')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Terima Laporan
              </button>
            </div>
          </div>
        )}
      </Modal>

      <LocationVerifyModal
        open={locOpen}
        onClose={() => setLocOpen(false)}
        provinceCode={user?.provinceCode || '32'}
        provinceName={user?.provinceName || 'Jawa Barat'}
        actionType="kirim_laporan_koordinator"
        onVerified={() => {
          setLocVerified(true);
          setLocOpen(false);
        }}
      />

      <A4PrintModal
        open={Boolean(printConfig)}
        config={printConfig}
        onClose={() => setPrintConfig(null)}
      />
    </div>
  );
}
