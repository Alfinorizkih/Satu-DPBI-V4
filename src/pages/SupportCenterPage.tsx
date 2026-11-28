import React, { useEffect, useState } from 'react';
import { LifeBuoy, Paperclip, Send, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPatch, apiPost, apiUploadFile, generateIdempotencyKey } from '../lib/api';
import { formatTanggalIndonesia } from '../lib/rbac';
import type {
  SupportTicketCategory,
  SupportTicketPriority,
  SupportTicketRecord,
  SupportTicketStatus,
} from '../lib/types';
import {
  EmptyState,
  GlassCard,
  Modal,
  PageContainer,
  PageHeader,
  Skeleton,
  StatusIndicator,
} from '../components/ui';

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  bug_fungsional: 'Gangguan Fitur / Error Sistem',
  kesalahan_akses: 'Masalah Hak Akses / RBAC',
  data_tidak_sesuai: 'Data Tidak Sesuai / Sinkronisasi',
  kendala_unggah: 'Kendala Unggah Dokumen / Foto',
  kinerja_lambat: 'Halaman Lambat / Time Out',
  saran_perbaikan: 'Saran Peningkatan Layanan',
};

const PRIORITY_LABELS: Record<SupportTicketPriority, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
  kritis: 'Kritis (Menghambat Kerja)',
};

export function SupportCenterPage() {
  const { notify } = useAuth();
  const [tickets, setTickets] = useState<SupportTicketRecord[]>([]);
  const [canManageAll, setCanManageAll] = useState(false);
  const [systemErrors, setSystemErrors] = useState<{ reference_code: string; http_status: number; route: string; created_at: string }[]>([]);
  const [handlers, setHandlers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('semua');
  const [scopeFilter, setScopeFilter] = useState<'all' | 'mine'>('all');

  // Create Ticket State
  const initialQuery = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SupportTicketCategory>('bug_fungsional');
  const [priority, setPriority] = useState<SupportTicketPriority>('sedang');
  const [pagePath, setPagePath] = useState(initialQuery?.get('from') || '/beranda');
  const [errorRefCode, setErrorRefCode] = useState(initialQuery?.get('ref') || '');
  const [description, setDescription] = useState('');
  const [screenshotFileId, setScreenshotFileId] = useState<string | null>(null);
  const [screenshotFileName, setScreenshotFileName] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitIdempotencyKey, setSubmitIdempotencyKey] = useState(() => generateIdempotencyKey('tiket'));

  // Admin Triage Modal
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketRecord | null>(null);
  const [triageStatus, setTriageStatus] = useState<SupportTicketStatus>('diproses');
  const [triagePriority, setTriagePriority] = useState<SupportTicketPriority>('sedang');
  const [triagePicId, setTriagePicId] = useState<string>('');
  const [triageAdminNote, setTriageAdminNote] = useState('');
  const [triageResolution, setTriageResolution] = useState('');
  const [updatingTriage, setUpdatingTriage] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (scopeFilter === 'mine') qs.set('mine', '1');
      if (statusFilter !== 'semua') qs.set('status', statusFilter);
      const res = await apiGet<{
        tickets: SupportTicketRecord[];
        canManageAll: boolean;
        systemErrors: { reference_code: string; http_status: number; route: string; created_at: string }[];
        handlers: { id: string; full_name: string; role: string }[];
      }>(`/api/support-tickets${qs.toString() ? `?${qs.toString()}` : ''}`);
      setTickets(res.tickets);
      setCanManageAll(res.canManageAll);
      setSystemErrors(res.systemErrors || []);
      setHandlers(res.handlers || []);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat tiket kendala.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [statusFilter, scopeFilter]);

  const handleUploadScreenshot = async (file: File) => {
    setUploading(true);
    try {
      const up = await apiUploadFile(file, 'support_ticket');
      setScreenshotFileId(up.fileId);
      setScreenshotFileName(up.fileName);
      notify('Lampiran tangkapan layar berhasil diunggah.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengunggah lampiran.', 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 4 || description.trim().length < 10) {
      notify('Judul (minimal 4 karakter) dan uraian kendala (minimal 10 karakter) wajib diisi.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const created = await apiPost<{ ok: boolean; ticketNumber: string }>(
        '/api/support-tickets',
        {
          title: title.trim(),
          category,
          priority,
          pagePath: pagePath.trim() || '/beranda',
          moduleName: pagePath.replace(/^\//, '').split('/')[0] || 'umum',
          errorRefCode: errorRefCode.trim() || null,
          description: description.trim(),
          screenshotFileId,
          screenshotFileName,
        },
        false,
        { idempotencyKey: submitIdempotencyKey }
      );
      notify(`Laporan kendala ${created.ticketNumber} berhasil dikirim.`, 'success');
      setTitle('');
      setDescription('');
      setErrorRefCode('');
      setScreenshotFileId(null);
      setScreenshotFileName(null);
      setSubmitIdempotencyKey(generateIdempotencyKey('tiket'));
      await loadTickets();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim tiket kendala.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openTriage = (t: SupportTicketRecord) => {
    setSelectedTicket(t);
    setTriageStatus(t.status);
    setTriagePriority(t.priority);
    setTriagePicId(t.assignedToId || '');
    setTriageAdminNote(t.adminNote || '');
    setTriageResolution(t.resolutionNote || '');
  };

  const handleSaveTriage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setUpdatingTriage(true);
    try {
      await apiPatch(`/api/support-tickets/${selectedTicket.id}`, {
        status: triageStatus,
        priority: triagePriority,
        assignedToId: triagePicId || null,
        adminNote: triageAdminNote,
        resolutionNote: triageResolution,
      });
      notify(`Tiket ${selectedTicket.ticketNumber} diperbarui.`, 'success');
      setSelectedTicket(null);
      await loadTickets();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui tiket.', 'error');
    } finally {
      setUpdatingTriage(false);
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title="Pusat Kendala & Pemulihan Operasional"
        description="Laporkan gangguan aplikasi, kendala akses, atau perbedaan data secara terstruktur tanpa memaparkan informasi teknis sensitif."
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Form Kirim Laporan Kendala */}
        <GlassCard className="lg:col-span-5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Kirim Laporan Kendala</h2>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            <div>
              <label htmlFor="tiket-title" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Ringkasan Masalah
              </label>
              <input
                id="tiket-title"
                type="text"
                required
                minLength={4}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Tombol simpan LKL tidak merespons setelah unggah foto"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tiket-cat" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Kategori Kendala
                </label>
                <select
                  id="tiket-cat"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as SupportTicketCategory)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  {(Object.keys(CATEGORY_LABELS) as SupportTicketCategory[]).map((k) => (
                    <option key={k} value={k}>
                      {CATEGORY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="tiket-prio" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Tingkat Dampak
                </label>
                <select
                  id="tiket-prio"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as SupportTicketPriority)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                >
                  {(Object.keys(PRIORITY_LABELS) as SupportTicketPriority[]).map((k) => (
                    <option key={k} value={k}>
                      {PRIORITY_LABELS[k]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="tiket-path" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Halaman Kejadian
                </label>
                <input
                  id="tiket-path"
                  type="text"
                  value={pagePath}
                  onChange={(e) => setPagePath(e.target.value)}
                  placeholder="/proposal/baru"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                />
              </div>
              <div>
                <label htmlFor="tiket-ref" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Kode Error (Opsional)
                </label>
                <input
                  id="tiket-ref"
                  type="text"
                  value={errorRefCode}
                  onChange={(e) => setErrorRefCode(e.target.value)}
                  placeholder="ERR-..."
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="tiket-desc" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Uraian Langkah &amp; Kejadian
              </label>
              <textarea
                id="tiket-desc"
                rows={4}
                required
                minLength={10}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan apa yang Anda klik dan pesan apa yang muncul. Jangan sertakan kata sandi."
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="tiket-file" className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Lampiran Tangkapan Layar (Opsional)
              </label>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="tiket-file"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:border-[#0EA5E9] cursor-pointer font-medium"
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  <span>{uploading ? 'Mengunggah...' : screenshotFileName || 'Pilih Gambar / PDF'}</span>
                </label>
                <input
                  id="tiket-file"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadScreenshot(f);
                  }}
                  className="sr-only"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || uploading}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs sm:text-sm font-semibold disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              <span>{submitting ? 'Mengirim Tiket...' : 'Kirim Laporan Kendala'}</span>
            </button>
          </form>
        </GlassCard>

        {/* Daftar Tiket & Panel Triage */}
        <div className="lg:col-span-7 space-y-4">
          <GlassCard className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                  {canManageAll ? 'Antrean Tiket Kendala Pengguna' : 'Riwayat Laporan Kendala Saya'}
                </h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Setiap tiket dilengkapi nomor referensi dan pembaruan status penanganan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {canManageAll && (
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setScopeFilter('all')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        scopeFilter === 'all' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Semua Tiket
                    </button>
                    <button
                      type="button"
                      onClick={() => setScopeFilter('mine')}
                      className={`px-2.5 py-1 rounded-lg font-semibold ${
                        scopeFilter === 'mine' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                      }`}
                    >
                      Tiket Saya
                    </button>
                  </div>
                )}
                <select
                  aria-label="Filter status tiket"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-1.5 text-xs"
                >
                  <option value="semua">Semua Status</option>
                  <option value="baru">Baru</option>
                  <option value="ditinjau">Ditinjau</option>
                  <option value="diproses">Diproses</option>
                  <option value="selesai">Selesai</option>
                  <option value="ditolak">Ditolak</option>
                </select>
              </div>
            </div>

            {loading ? (
              <Skeleton rows={4} />
            ) : tickets.length === 0 ? (
              <EmptyState
                title="Belum ada laporan kendala"
                description="Semua layanan berjalan lancar. Gunakan formulir di samping bila Anda menemui kendala."
              />
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {tickets.map((t) => (
                  <div key={t.id} className="py-3.5 first:pt-0 last:pb-0 space-y-2 text-xs">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {t.ticketNumber} · {CATEGORY_LABELS[t.category] || t.category} · Dampak {PRIORITY_LABELS[t.priority] || t.priority}
                        </p>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{t.title}</h3>
                      </div>
                      <StatusIndicator status={t.status} />
                    </div>
                    <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{t.description}</p>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span>
                        Pelapor: <span className="font-medium text-slate-700 dark:text-slate-300">{t.userName}</span> · Rute{' '}
                        <span className="font-mono">{t.pagePath}</span>
                        {t.errorRefCode ? ` · Ref ${t.errorRefCode}` : ''}
                      </span>
                      <span className="font-mono tabular-nums">{formatTanggalIndonesia(t.createdAt, true)}</span>
                    </div>
                    {t.resolutionNote && (
                      <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/70 p-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                        <strong>Tindak Lanjut Tim:</strong> {t.resolutionNote}
                      </div>
                    )}
                    {canManageAll && (
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="text-[11px] text-slate-500">
                          Penanggung jawab: <span className="font-semibold text-slate-700 dark:text-slate-200">{t.assignedToName || 'Belum ditugaskan'}</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => openTriage(t)}
                          className="px-3 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:border-[#0EA5E9] font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Kelola &amp; Perbarui Status
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          {canManageAll && systemErrors.length > 0 && (
            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
                <ShieldCheck className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
                <span>Log Error Sistem Terbaru (Tersanitasi untuk Triage)</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500">
                    <tr>
                      <th className="py-2 pr-3">Kode Referensi</th>
                      <th className="py-2 pr-3">Status</th>
                      <th className="py-2 pr-3">Rute</th>
                      <th className="py-2">Waktu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {systemErrors.slice(0, 6).map((err) => (
                      <tr key={err.reference_code}>
                        <td className="py-2 pr-3 font-mono font-semibold text-slate-800 dark:text-slate-200">{err.reference_code}</td>
                        <td className="py-2 pr-3 font-mono tabular-nums">{err.http_status}</td>
                        <td className="py-2 pr-3 font-mono text-slate-500 truncate max-w-[200px]">{err.route}</td>
                        <td className="py-2 font-mono text-[11px] text-slate-500 tabular-nums">
                          {formatTanggalIndonesia(err.created_at, true)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(selectedTicket)}
        onClose={() => setSelectedTicket(null)}
        title={`Tindak Lanjut Tiket ${selectedTicket?.ticketNumber || ''}`}
      >
        <form onSubmit={handleSaveTriage} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="triage-status" className="block font-semibold mb-1">Status Penanganan</label>
              <select
                id="triage-status"
                value={triageStatus}
                onChange={(e) => setTriageStatus(e.target.value as SupportTicketStatus)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="baru">Baru</option>
                <option value="ditinjau">Ditinjau</option>
                <option value="diproses">Diproses</option>
                <option value="selesai">Selesai</option>
                <option value="ditolak">Ditolak</option>
              </select>
            </div>
            <div>
              <label htmlFor="triage-prio" className="block font-semibold mb-1">Prioritas</label>
              <select
                id="triage-prio"
                value={triagePriority}
                onChange={(e) => setTriagePriority(e.target.value as SupportTicketPriority)}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="rendah">Rendah</option>
                <option value="sedang">Sedang</option>
                <option value="tinggi">Tinggi</option>
                <option value="kritis">Kritis</option>
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="triage-pic" className="block font-semibold mb-1">Penanggung Jawab (PIC)</label>
            <select
              id="triage-pic"
              value={triagePicId}
              onChange={(e) => setTriagePicId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              <option value="">— Belum Ditugaskan —</option>
              {handlers.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.full_name} ({h.role})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="triage-admin" className="block font-semibold mb-1">Catatan Internal Pengelola</label>
            <textarea
              id="triage-admin"
              rows={2}
              value={triageAdminNote}
              onChange={(e) => setTriageAdminNote(e.target.value)}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="triage-res" className="block font-semibold mb-1">Catatan Penyelesaian (Tampil ke Pelapor)</label>
            <textarea
              id="triage-res"
              rows={3}
              value={triageResolution}
              onChange={(e) => setTriageResolution(e.target.value)}
              placeholder="Jelaskan tindakan pemulihan atau solusi bagi pelapor..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setSelectedTicket(null)}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={updatingTriage}
              className="px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white font-semibold disabled:opacity-50"
            >
              {updatingTriage ? 'Menyimpan...' : 'Simpan Pembaruan'}
            </button>
          </div>
        </form>
      </Modal>
    </PageContainer>
  );
}
