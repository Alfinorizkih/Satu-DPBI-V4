import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileWarning,
  RefreshCw,
  Send,
  ShieldAlert,
  UserCog,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import { formatTanggalIndonesia, ROLE_LABELS } from '../lib/rbac';
import { INDONESIA_PROVINCES } from '../lib/provinces';
import type { ApprovalQueueItem, RoleCode } from '../lib/types';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageContainer,
  PageHeader,
  SearchBar,
  Select,
  Skeleton,
  StatusIndicator,
  Textarea,
} from '../components/ui';

const TYPE_LABELS: Record<ApprovalQueueItem['itemType'], string> = {
  proposal: 'Proposal Kegiatan',
  lkl: 'Laporan Kegiatan (LKL)',
  coordinator_report: 'Laporan Koordinator',
  account_request: 'Permintaan Akun',
  handover: 'Serah Terima Wilayah',
};

const REASSIGNABLE_ROLES: { value: RoleCode; label: string }[] = [
  { value: 'koordinator_wilayah', label: ROLE_LABELS.koordinator_wilayah },
  { value: 'pengurus_nasional', label: ROLE_LABELS.pengurus_nasional },
  { value: 'sekretariat_nasional', label: ROLE_LABELS.sekretariat_nasional },
  { value: 'penanggung_jawab', label: ROLE_LABELS.penanggung_jawab },
  { value: 'wakil_super_admin', label: ROLE_LABELS.wakil_super_admin },
  { value: 'super_admin', label: ROLE_LABELS.super_admin },
];

export function ApprovalCenterPage() {
  const { user, can, navigate, notify } = useAuth();
  const [items, setItems] = useState<ApprovalQueueItem[]>([]);
  const [summary, setSummary] = useState({
    totalCount: 0,
    overdueCount: 0,
    byType: { proposal: 0, lkl: 0, coordinator_report: 0, account_request: 0, handover: 0 },
  });
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'overdue' | 'all'>('pending');
  const [filterType, setFilterType] = useState<string>('semua');
  const [filterProv, setFilterProv] = useState<string>('');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<ApprovalQueueItem | null>(null);
  const [reason, setReason] = useState('');
  const [targetRole, setTargetRole] = useState<RoleCode>('pengurus_nasional');
  const [escalateTo, setEscalateTo] = useState('Super Admin & Penanggung Jawab');
  const [submitting, setSubmitting] = useState(false);
  const [confirmAction, setConfirmAction] = useState<null | {
    action: 'reject' | 'cancel' | 'approve';
    title: string;
    message: string;
    danger: boolean;
  }>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        type: filterType,
        status: filterStatus,
        ...(filterProv ? { provinceCode: filterProv } : {}),
      });
      const res = await apiGet<{
        items: ApprovalQueueItem[];
        summary: typeof summary;
      }>(`/api/approval-center?${qs.toString()}`);
      setItems(res.items || []);
      setSummary(res.summary);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat antrean persetujuan.', 'error');
    } finally {
      setLoading(false);
    }
  }, [filterType, filterStatus, filterProv, notify]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.referenceNumber.toLowerCase().includes(q) ||
        i.applicantName.toLowerCase().includes(q) ||
        (i.provinceName || '').toLowerCase().includes(q)
    );
  }, [items, search]);

  const executeAction = async (
    action: 'approve' | 'reject' | 'request_revision' | 'request_completeness' | 'reassign' | 'escalate' | 'cancel'
  ) => {
    if (!selected) return;
    if (['reject', 'request_revision', 'request_completeness', 'cancel', 'escalate'].includes(action) && reason.trim().length < 5) {
      notify('Alasan atau catatan wajib diisi minimal 5 karakter.', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost<{ ok: boolean; message?: string; status?: string }>(
        `/api/approval-center/${selected.itemType}/${selected.id}/action`,
        {
          action,
          reason: reason.trim(),
          targetRole: action === 'reassign' ? targetRole : undefined,
          escalateTo: action === 'escalate' ? escalateTo.trim() : undefined,
        }
      );
      notify(res.message || `Tindakan persetujuan berhasil disimpan (${res.status || 'selesai'}).`, 'success');
      setConfirmAction(null);
      setSelected(null);
      setReason('');
      await loadQueue();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses tindakan persetujuan.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const canApprove = can('persetujuan', 'approve');
  const canReject = can('persetujuan', 'reject');
  const canReview = can('persetujuan', 'review');

  return (
    <PageContainer>
      <PageHeader
        title="Pusat Persetujuan Nasional"
        description="Antrean persetujuan terpadu lintas Proposal, LKL, Laporan Koordinator, Permintaan Akun, dan Serah Terima Wilayah dengan pemantauan SLA."
        actions={
          <Button variant="secondary" size="sm" onClick={loadQueue}>
            <RefreshCw className="w-4 h-4" /> Segarkan Antrean
          </Button>
        }
      />

      {/* SLA & Queue KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Item Ditampilkan</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {summary.totalCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Sesuai filter & cakupan peran</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-rose-600 dark:text-rose-400">Melewati Batas SLA</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-rose-600 dark:text-rose-400 mt-1">
            {summary.overdueCount}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Perlu prioritas atau eskalasi</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Proposal &amp; LKL</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#0EA5E9] mt-1">
            {summary.byType.proposal + summary.byType.lkl}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {summary.byType.proposal} proposal · {summary.byType.lkl} LKL
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Wilayah &amp; Akun</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 dark:text-white mt-1">
            {summary.byType.coordinator_report + summary.byType.account_request + summary.byType.handover}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {summary.byType.coordinator_report} LKW · {summary.byType.account_request} akun · {summary.byType.handover} serah terima
          </p>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 max-w-full">
            {[
              { id: 'pending', label: 'Menunggu Tindakan' },
              { id: 'overdue', label: `Terlambat SLA (${summary.overdueCount})` },
              { id: 'all', label: 'Semua Riwayat' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilterStatus(tab.id as 'pending' | 'overdue' | 'all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                  filterStatus === tab.id
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto sm:flex-1 justify-end min-w-0">
            <SearchBar
              value={search}
              onChange={setSearch}
              placeholder="Cari nomor referensi, judul, pengaju..."
              className="w-full sm:w-64"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Select
            label="Kategori Pengajuan"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="semua">Semua Jenis Pengajuan</option>
            <option value="proposal">Proposal Kegiatan</option>
            <option value="lkl">Laporan Kegiatan Lapangan (LKL)</option>
            <option value="coordinator_report">Laporan Koordinator Wilayah</option>
            <option value="account_request">Permintaan Akun Baru</option>
            <option value="handover">Serah Terima Koordinator</option>
          </Select>

          {user?.role !== 'koordinator_wilayah' && (
            <Select
              label="Provinsi"
              value={filterProv}
              onChange={(e) => setFilterProv(e.target.value)}
            >
              <option value="">Semua 38 Provinsi</option>
              {INDONESIA_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
        </div>
      </Card>

      {/* Queue List */}
      {loading ? (
        <Skeleton rows={5} />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title="Tidak ada item pada antrean ini"
          description="Seluruh pengajuan yang sesuai filter Anda sudah ditindaklanjuti atau belum ada pengajuan masuk."
          actionLabel={filterStatus !== 'all' ? 'Lihat Semua Riwayat' : undefined}
          onAction={filterStatus !== 'all' ? () => setFilterStatus('all') : undefined}
        />
      ) : (
        <>
          {/* Desktop Table */}
          <Card className="hidden md:block overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Referensi &amp; Jenis</th>
                    <th className="py-3 px-4 font-semibold">Judul &amp; Pengaju</th>
                    <th className="py-3 px-4 font-semibold">Peninjau / Eskalasi</th>
                    <th className="py-3 px-4 font-semibold">Batas SLA</th>
                    <th className="py-3 px-4 font-semibold">Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredItems.map((item) => (
                    <tr
                      key={`${item.itemType}-${item.id}`}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3 px-4 align-top">
                        <p className="font-mono text-xs font-bold text-[#0EA5E9] tabular-nums">
                          {item.referenceNumber}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {TYPE_LABELS[item.itemType]}
                        </p>
                      </td>
                      <td className="py-3 px-4 align-top max-w-md">
                        <p className="font-semibold text-slate-900 dark:text-white leading-snug">{item.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.applicantName} · {item.provinceName || 'Nasional'}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-1 mt-0.5">
                          {item.summary}
                        </p>
                      </td>
                      <td className="py-3 px-4 align-top text-xs">
                        <p className="font-medium text-slate-800 dark:text-slate-200">
                          {item.assignedReviewerName ? ROLE_LABELS[item.assignedReviewerName as RoleCode] || item.assignedReviewerName : '-'}
                        </p>
                        {item.escalatedTo && (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5 inline-flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3" /> {item.escalatedTo}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-4 align-top text-xs tabular-nums">
                        {item.slaDueAt ? (
                          <div>
                            <p className={item.isOverdue ? 'font-semibold text-rose-600 dark:text-rose-400' : 'text-slate-600 dark:text-slate-300'}>
                              {formatTanggalIndonesia(item.slaDueAt, true)}
                            </p>
                            {item.isOverdue && (
                              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1 mt-0.5">
                                <AlertTriangle className="w-3 h-3" /> Melewati SLA
                              </p>
                            )}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="py-3 px-4 align-top">
                        <StatusIndicator status={item.status} />
                      </td>
                      <td className="py-3 px-4 align-top text-right">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setSelected(item);
                            setReason('');
                          }}
                        >
                          Tinjau
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Mobile Stacked Cards */}
          <div className="md:hidden space-y-3">
            {filteredItems.map((item) => (
              <Card key={`${item.itemType}-${item.id}`} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-mono text-xs font-bold text-[#0EA5E9] tabular-nums">
                      {item.referenceNumber} · {TYPE_LABELS[item.itemType]}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-0.5">{item.title}</p>
                  </div>
                  <StatusIndicator status={item.status} />
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {item.applicantName} · {item.provinceName || 'Nasional'}
                </p>
                {item.isOverdue && (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 inline-flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" /> Melewati Batas SLA ({formatTanggalIndonesia(item.slaDueAt || '', true)})
                  </p>
                )}
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => navigate(item.targetPath)}
                    className="text-xs font-semibold text-[#0EA5E9] inline-flex items-center gap-1 min-h-[44px]"
                  >
                    Buka Modul <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelected(item);
                      setReason('');
                    }}
                  >
                    Tinjau &amp; Putuskan
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Detail & Action Modal */}
      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected ? `${selected.referenceNumber} — ${TYPE_LABELS[selected.itemType]}` : ''}
        subtitle={selected ? `${selected.applicantName} · ${selected.provinceName || 'Nasional'}` : undefined}
        maxWidth="max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-2 bg-slate-50/60 dark:bg-slate-950/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{selected.title}</h3>
                <StatusIndicator status={selected.status} />
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300">{selected.summary}</p>
              <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 dark:text-slate-400 pt-1 tabular-nums">
                <span>Diajukan: {formatTanggalIndonesia(selected.submittedAt, true)}</span>
                {selected.slaDueAt && <span>Batas SLA: {formatTanggalIndonesia(selected.slaDueAt, true)}</span>}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  const target = selected.targetPath;
                  setSelected(null);
                  navigate(target);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline"
              >
                Buka Halaman Detail di Modul Sumber <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {canReview && !['disetujui', 'diterima', 'ditolak', 'dibatalkan', 'diarsipkan'].includes(selected.status) && (
              <div className="space-y-4 pt-2 border-t border-slate-200 dark:border-slate-800">
                <Textarea
                  label="Catatan / Alasan Keputusan (wajib minimal 5 karakter untuk Revisi, Tolak, Eskalasi, atau Batalkan)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Tuliskan pertimbangan verifikasi, kelengkapan yang kurang, atau instruksi tindak lanjut..."
                />

                <div className="flex flex-wrap gap-2">
                  {canApprove && (
                    <Button
                      variant="primary"
                      loading={submitting}
                      onClick={() =>
                        setConfirmAction({
                          action: 'approve',
                          title: `Setujui ${selected.referenceNumber}?`,
                          message: `Item "${selected.title}" akan disahkan. Jika berupa Proposal, sistem otomatis membuat agenda kalender dan tugas tindak lanjut.`,
                          danger: false,
                        })
                      }
                    >
                      <CheckCircle2 className="w-4 h-4" /> Setujui
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    loading={submitting}
                    onClick={() => executeAction('request_revision')}
                  >
                    <FileWarning className="w-4 h-4" /> Minta Revisi
                  </Button>
                  {selected.itemType === 'proposal' && (
                    <Button
                      variant="secondary"
                      loading={submitting}
                      onClick={() => executeAction('request_completeness')}
                    >
                      <Send className="w-4 h-4" /> Minta Kelengkapan
                    </Button>
                  )}
                  {canReject && (
                    <Button
                      variant="danger"
                      loading={submitting}
                      onClick={() =>
                        setConfirmAction({
                          action: 'reject',
                          title: `Tolak ${selected.referenceNumber}?`,
                          message: `Item "${selected.title}" akan berstatus ditolak secara permanen dengan alasan yang Anda catat.`,
                          danger: true,
                        })
                      }
                    >
                      <XCircle className="w-4 h-4" /> Tolak
                    </Button>
                  )}
                </div>

                {selected.itemType === 'proposal' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                    <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <UserCog className="w-3.5 h-3.5 text-[#0EA5E9]" /> Alihkan Peninjau
                      </p>
                      <Select
                        value={targetRole}
                        onChange={(e) => setTargetRole(e.target.value as RoleCode)}
                      >
                        {REASSIGNABLE_ROLES.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </Select>
                      <Button size="sm" variant="secondary" loading={submitting} onClick={() => executeAction('reassign')}>
                        Alihkan Antrean
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3">
                      <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-amber-500" /> Eskalasi / Batalkan
                      </p>
                      <Input
                        value={escalateTo}
                        onChange={(e) => setEscalateTo(e.target.value)}
                        placeholder="Tujuan eskalasi..."
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="secondary" loading={submitting} onClick={() => executeAction('escalate')}>
                          Eskalasi
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          loading={submitting}
                          onClick={() =>
                            setConfirmAction({
                              action: 'cancel',
                              title: `Batalkan Proposal ${selected.referenceNumber}?`,
                              message: 'Pembatalan akan menghentikan seluruh proses tinjauan dengan alasan tercatat.',
                              danger: true,
                            })
                          }
                        >
                          Batalkan
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        danger={Boolean(confirmAction?.danger)}
        loading={submitting}
        confirmLabel={confirmAction?.action === 'approve' ? 'Ya, Setujui' : confirmAction?.action === 'cancel' ? 'Ya, Batalkan' : 'Ya, Tolak'}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) executeAction(confirmAction.action);
        }}
      />
    </PageContainer>
  );
}
