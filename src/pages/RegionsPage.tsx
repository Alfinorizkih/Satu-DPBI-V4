import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, History, List, Map as MapIcon, MapPin, Plus, Printer } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { IndonesiaMap } from '../components/IndonesiaMap';
import { LocationVerifyModal } from '../components/LocationVerifyModal';
import { A4PrintModal, type PrintDocumentConfig } from '../components/print/A4PrintEngine';
import { FileDropzone, GlassCard, LoadingSkeleton, Modal, StatusIndicator } from '../components/ui/Primitives';
import { formatTanggalIndonesia } from '../lib/rbac';
import type { ProvinceRecord, ProvinceStatus, RegencyRecord } from '../lib/types';

interface RegionHistoryEntry {
  id: string;
  region_type: string;
  region_code: string;
  action: string;
  summary: string;
  actor_name: string;
  created_at: string;
}

export function RegionsPage({ initialId }: { initialId?: string }) {
  const { user, can, notify } = useAuth();
  const [tab, setTab] = useState<'peta' | 'handover' | 'lokasi' | 'riwayat'>('peta');
  const [viewMode, setViewMode] = useState<'gabungan' | 'daftar'>('gabungan');
  const [provinces, setProvinces] = useState<ProvinceRecord[]>([]);
  const [selected, setSelected] = useState<ProvinceRecord | null>(null);
  const [drillProvinceCode, setDrillProvinceCode] = useState<string | null>(null);
  const [regencies, setRegencies] = useState<RegencyRecord[]>([]);
  const [selectedRegency, setSelectedRegency] = useState<RegencyRecord | null>(null);
  const [regenciesLoading, setRegenciesLoading] = useState(false);

  const [handovers, setHandovers] = useState<Record<string, unknown>[]>([]);
  const [locLogs, setLocLogs] = useState<Record<string, unknown>[]>([]);
  const [locExceptions, setLocExceptions] = useState<Record<string, unknown>[]>([]);
  const [historyList, setHistoryList] = useState<RegionHistoryEntry[]>([]);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [addRegencyOpen, setAddRegencyOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState<PrintDocumentConfig | null>(null);

  const [descDraft, setDescDraft] = useState('');
  const [coachingDraft, setCoachingDraft] = useState('');
  const [hForm, setHForm] = useState({ provinceCode: '32', outgoingCoordinatorName: '', incomingCoordinatorName: '', notes: '' });
  const [regForm, setRegForm] = useState({
    code: '',
    name: '',
    kind: 'kabupaten' as 'kabupaten' | 'kota',
    status: 'dalam_pengembangan' as ProvinceStatus,
    coordinatorName: '',
    coachingNote: '',
  });

  const loadRegencies = async (provinceCode: string) => {
    setRegenciesLoading(true);
    try {
      const res = await apiGet<{ regencies: RegencyRecord[] }>(`/api/provinces/${provinceCode}/regencies`);
      setRegencies(res.regencies || []);
    } catch {
      setRegencies([]);
    } finally {
      setRegenciesLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, hRes, lRes, histRes] = await Promise.all([
        apiGet<{ provinces: ProvinceRecord[] }>('/api/provinces'),
        apiGet<{ handovers: Record<string, unknown>[] }>('/api/handovers'),
        apiGet<{ logs: Record<string, unknown>[]; exceptions: Record<string, unknown>[] }>('/api/location/logs'),
        apiGet<{ history: RegionHistoryEntry[] }>('/api/regions/history').catch(() => ({ history: [] })),
      ]);
      setProvinces(pRes.provinces);
      setHandovers(hRes.handovers);
      setLocLogs(lRes.logs);
      setLocExceptions(lRes.exceptions);
      setHistoryList(histRes.history || []);
      if (pRes.provinces.length > 0) {
        const requested = initialId
          ? pRes.provinces.find(
              (p) => p.code === initialId || p.name.toLowerCase().replace(/\s+/g, '-') === initialId.toLowerCase()
            )
          : undefined;
        setSelected((prev) => {
          if (requested) return requested;
          if (prev) return pRes.provinces.find((p) => p.code === prev.code) || prev;
          return pRes.provinces.find((p) => p.code === (user?.provinceCode || '32')) || pRes.provinces[0];
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [initialId]);

  useEffect(() => {
    if (!selected) return;
    setDescDraft(selected.description || '');
    setCoachingDraft(selected.coachingNote || '');
    setSelectedRegency(null);
    loadRegencies(selected.code);
  }, [selected?.code]);

  const canEditSelectedProvince =
    can('wilayah', 'edit') && (user?.role !== 'koordinator_wilayah' || user.provinceCode === selected?.code);

  const handleUpdateProvince = async (
    code: string,
    payload: {
      status?: ProvinceStatus;
      coachingNote?: string;
      description?: string;
      logoFileId?: string;
    }
  ) => {
    try {
      await apiPatch(`/api/provinces/${code}`, payload);
      notify('Data wilayah provinsi berhasil diperbarui.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui wilayah.', 'error');
    }
  };

  const handleUpdateRegencyStatus = async (code: string, status: ProvinceStatus) => {
    try {
      await apiPatch(`/api/regencies/${code}`, { status });
      notify('Status Kabupaten/Kota berhasil diperbarui.', 'success');
      if (selected) loadRegencies(selected.code);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui Kabupaten/Kota.', 'error');
    }
  };

  const handleAddRegency = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    try {
      await apiPost('/api/regencies', {
        ...regForm,
        provinceCode: selected.code,
      });
      notify(`Daerah ${regForm.name} berhasil ditambahkan ke ${selected.name}.`, 'success');
      setAddRegencyOpen(false);
      setRegForm({
        code: '',
        name: '',
        kind: 'kabupaten',
        status: 'dalam_pengembangan',
        coordinatorName: '',
        coachingNote: '',
      });
      loadRegencies(selected.code);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menambahkan daerah pemekaran.', 'error');
    }
  };

  const handleCreateHandover = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/handovers', hForm);
      notify('Berita acara serah terima diajukan ke pihak Nasional.', 'success');
      setHandoverOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal membuat serah terima.', 'error');
    }
  };

  const handleApproveHandover = async (id: string) => {
    try {
      await apiPost(`/api/handovers/${id}/approve`);
      notify('Serah terima disetujui & kewenangan wilayah dialihkan.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyetujui serah terima.', 'error');
    }
  };

  const handleDecideException = async (id: string, decision: 'disetujui' | 'ditolak') => {
    try {
      await apiPost(`/api/location/exceptions/${id}/decide`, { decision });
      notify(`Pengecualian lokasi ${decision}.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memutuskan pengecualian.', 'error');
    }
  };

  const openRecapPrint = () => {
    setPrintConfig({
      template: 'rekap_tabel',
      documentNumber: `DPBI/WIL/${new Date().getFullYear()}/REKAP-38`,
      title: 'Rekapitulasi Status Wilayah 38 Provinsi Indonesia',
      subtitle: 'Ringkasan status koordinasi, domisili vs penugasan Duta, cakupan Kabupaten/Kota, dan LKL resmi.',
      issuedDate: new Date().toISOString().slice(0, 10),
      defaultOrientation: 'landscape',
      metadata: [
        { label: 'Total Provinsi', value: `${provinces.length} Provinsi` },
        { label: 'Provinsi Aktif', value: `${provinces.filter((p) => p.status === 'aktif').length} Provinsi` },
        { label: 'Dicetak Oleh', value: user?.fullName || 'Pengurus DPBI' },
      ],
      table: {
        headers: ['Kode', 'Provinsi', 'Status', 'Koordinator', 'Domisili', 'Penugasan', 'Kab/Kota Aktif', 'LKL'],
        rows: provinces.map((p) => [
          p.code,
          p.name,
          p.status.replace(/_/g, ' '),
          p.coordinatorName || 'Belum ditetapkan',
          p.domicileDutaCount ?? p.activeDutaCount,
          p.assignmentDutaCount ?? 0,
          `${p.activeRegencyCount ?? 0}/${p.regencyCount ?? 0}`,
          p.lklCount,
        ]),
      },
      signatoryName: user?.fullName || 'Sekretariat Nasional DPBI',
      signatoryRole: user?.roleLabel || 'Pengelola Wilayah DPBI',
    });
  };

  if (loading) return <LoadingSkeleton rows={6} />;

  const filteredProvinces = provinces.filter((p) => {
    const matchText =
      !search.trim() ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.island.toLowerCase().includes(search.toLowerCase()) ||
      (p.coordinatorName || '').toLowerCase().includes(search.toLowerCase());
    const matchStatus = !statusFilter || p.status === statusFilter;
    return matchText && matchStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Wilayah 38 Provinsi, Kab/Kota &amp; Handover Center
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pemetaan GeoJSON resmi 38 provinsi dan Kabupaten/Kota, pemisahan Duta domisili vs penugasan, serta serah terima koordinator.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openRecapPrint}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9] whitespace-nowrap shrink-0"
          >
            <Printer className="w-4 h-4 text-[#0EA5E9]" /> Cetak Rekap A4
          </button>
          <button
            type="button"
            onClick={() => setLocModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold whitespace-nowrap shrink-0"
          >
            <MapPin className="w-4 h-4 text-[#0EA5E9]" /> Uji Verifikasi Lokasi
          </button>
          {can('wilayah', 'edit') && (
            <button
              type="button"
              onClick={() => setHandoverOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <ArrowLeftRight className="w-4 h-4" /> Ajukan Serah Terima
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
          <button
            type="button"
            onClick={() => setTab('peta')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
              tab === 'peta' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Peta &amp; Daftar 38 Provinsi
          </button>
          <button
            type="button"
            onClick={() => setTab('handover')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
              tab === 'handover' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Handover Center ({handovers.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('lokasi')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
              tab === 'lokasi' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            Verifikasi Lokasi
          </button>
          <button
            type="button"
            onClick={() => setTab('riwayat')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
              tab === 'riwayat' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Riwayat Wilayah ({historyList.length})
          </button>
        </div>

        {tab === 'peta' && (
          <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
            <button
              type="button"
              onClick={() => setViewMode('gabungan')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                viewMode === 'gabungan' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <MapIcon className="w-3.5 h-3.5" /> Peta + Daftar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daftar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 ${
                viewMode === 'daftar' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <List className="w-3.5 h-3.5" /> Fokus Daftar
            </button>
          </div>
        )}
      </div>

      {tab === 'peta' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-8 p-5 space-y-5">
            {viewMode === 'gabungan' && (
              <IndonesiaMap
                provinces={provinces}
                selectedCode={selected?.code ?? null}
                onSelect={(prov) => {
                  setSelected(prov);
                  if (drillProvinceCode && drillProvinceCode !== prov.code) {
                    setDrillProvinceCode(prov.code);
                  }
                }}
                drillProvinceCode={drillProvinceCode}
                onChangeDrillProvince={setDrillProvinceCode}
                regencies={regencies}
                selectedRegencyCode={selectedRegency?.code ?? null}
                onSelectRegency={(reg) => setSelectedRegency(reg)}
              />
            )}

            <div className="space-y-3">
              <div className="flex flex-wrap gap-2.5">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari provinsi, pulau, atau nama koordinator..."
                  className="flex-1 min-w-[200px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                />
                <select
                  aria-label="Filter status wilayah"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-3 pr-8 py-2 min-w-[165px] text-sm text-slate-900 dark:text-slate-100"
                >
                  <option value="">Semua Status</option>
                  <option value="aktif">Aktif</option>
                  <option value="dalam_pengembangan">Dalam Pengembangan</option>
                  <option value="dalam_pembinaan">Dalam Pembinaan</option>
                  <option value="belum_terbentuk">Belum Terbentuk</option>
                </select>
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 sticky top-0 bg-white dark:bg-slate-900">
                    <tr>
                      <th className="py-2 pr-3">Kode</th>
                      <th className="py-2 pr-3">Provinsi</th>
                      <th className="py-2 pr-3">Koordinator</th>
                      <th className="py-2 pr-3 text-right">Domisili</th>
                      <th className="py-2 pr-3 text-right">Penugasan</th>
                      <th className="py-2 pr-3 text-right">Kab/Kota</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                    {filteredProvinces.map((p) => (
                      <tr
                        key={p.code}
                        onClick={() => setSelected(p)}
                        className={`cursor-pointer hover:bg-sky-50/50 dark:hover:bg-slate-800/40 ${
                          selected?.code === p.code ? 'bg-sky-50/80 dark:bg-slate-800/60' : ''
                        }`}
                      >
                        <td className="py-2 pr-3 font-mono">{p.code}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="py-2 pr-3">{p.coordinatorName || '—'}</td>
                        <td className="py-2 pr-3 text-right">{p.domicileDutaCount ?? p.activeDutaCount}</td>
                        <td className="py-2 pr-3 text-right">{p.assignmentDutaCount ?? 0}</td>
                        <td className="py-2 pr-3 text-right">
                          {p.activeRegencyCount ?? 0}/{p.regencyCount ?? 0}
                        </td>
                        <td className="py-2">
                          <StatusIndicator status={p.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 max-h-96 overflow-y-auto">
                {filteredProvinces.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => setSelected(p)}
                    className={`w-full text-left py-3 px-2 rounded-xl space-y-1 text-xs transition-colors ${
                      selected?.code === p.code ? 'bg-sky-50/80 dark:bg-slate-800/60' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {p.code} · {p.name}
                      </span>
                      <StatusIndicator status={p.status} />
                    </div>
                    <p className="text-slate-500 tabular-nums">
                      {p.coordinatorName || 'Belum ada koordinator'} · Domisili {p.domicileDutaCount ?? p.activeDutaCount} · Penugasan{' '}
                      {p.assignmentDutaCount ?? 0}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="lg:col-span-4 p-5 space-y-4 h-fit">
            {selected ? (
              <>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs text-[#0EA5E9]">Kode Wilayah {selected.code}</p>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.name}</h2>
                    <p className="text-xs text-slate-500">{selected.island}</p>
                  </div>
                  {selected.logoFileId && (
                    <img
                      src={`/api/public/files/${selected.logoFileId}`}
                      alt={`Logo Provinsi ${selected.name}`}
                      referrerPolicy="no-referrer"
                      className="w-12 h-12 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                    />
                  )}
                </div>

                <StatusIndicator status={selected.status} />

                <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800 tabular-nums">
                  <div>
                    <p className="text-slate-500">Duta Domisili</p>
                    <p className="font-mono text-lg font-bold">{selected.domicileDutaCount ?? selected.activeDutaCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Duta Penugasan</p>
                    <p className="font-mono text-lg font-bold">{selected.assignmentDutaCount ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Proposal / LKL</p>
                    <p className="font-mono text-lg font-bold">
                      {selected.proposalCount} / {selected.lklCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Kab/Kota Terjangkau</p>
                    <p className="font-mono text-lg font-bold">
                      {selected.activeRegencyCount ?? 0}/{selected.regencyCount ?? 0}
                    </p>
                  </div>
                </div>

                <div className="text-xs space-y-1.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <p className="font-semibold">Koordinator Wilayah</p>
                  <p className="text-slate-600 dark:text-slate-300">{selected.coordinatorName || 'Belum ditetapkan'}</p>
                  <p className="font-semibold pt-1.5">Deskripsi Publik Provinsi</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    {selected.description || 'Belum ada deskripsi khusus provinsi.'}
                  </p>
                  <p className="font-semibold pt-1.5">Catatan Pembinaan</p>
                  <p className="text-slate-600 dark:text-slate-300">{selected.coachingNote || 'Tidak ada catatan khusus.'}</p>
                </div>

                {/* Regency Drilldown List inside Detail Card */}
                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900 dark:text-white">
                      Kabupaten/Kota ({regencies.length})
                    </p>
                    {canEditSelectedProvince && (
                      <button
                        type="button"
                        onClick={() => setAddRegencyOpen(true)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0EA5E9] text-white font-semibold text-[11px] whitespace-nowrap shrink-0"
                      >
                        <Plus className="w-3 h-3" /> Tambah Daerah
                      </button>
                    )}
                  </div>

                  {regenciesLoading ? (
                    <p className="text-slate-500">Memuat daftar Kabupaten/Kota...</p>
                  ) : regencies.length === 0 ? (
                    <p className="text-slate-500">Belum ada data Kabupaten/Kota tersimpan untuk provinsi ini.</p>
                  ) : (
                    <div className="max-h-56 overflow-y-auto divide-y divide-slate-200/60 dark:divide-slate-800 pr-1">
                      {regencies.map((r) => (
                        <div key={r.code} className="py-2 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">{r.name}</p>
                            <p className="text-[11px] text-slate-500 font-mono">
                              {r.code} · {r.kind}
                            </p>
                          </div>
                          {canEditSelectedProvince ? (
                            <select
                              aria-label={`Status ${r.name}`}
                              value={r.status}
                              onChange={(e) => handleUpdateRegencyStatus(r.code, e.target.value as ProvinceStatus)}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-[11px] shrink-0"
                            >
                              <option value="aktif">Aktif</option>
                              <option value="dalam_pengembangan">Pengembangan</option>
                              <option value="dalam_pembinaan">Pembinaan</option>
                              <option value="belum_terbentuk">Belum Terbentuk</option>
                            </select>
                          ) : (
                            <StatusIndicator status={r.status} />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {canEditSelectedProvince && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                    <div>
                      <label className="block font-semibold mb-1">Perbarui Status Wilayah</label>
                      <select
                        value={selected.status}
                        onChange={(e) =>
                          handleUpdateProvince(selected.code, {
                            status: e.target.value as ProvinceStatus,
                          })
                        }
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                      >
                        <option value="aktif">Aktif</option>
                        <option value="dalam_pengembangan">Dalam Pengembangan</option>
                        <option value="dalam_pembinaan">Dalam Pembinaan</option>
                        <option value="belum_terbentuk">Belum Terbentuk</option>
                        <option value="tidak_aktif">Tidak Aktif</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold mb-1">Deskripsi Publik &amp; Catatan Pembinaan</label>
                      <textarea
                        rows={2}
                        value={descDraft}
                        onChange={(e) => setDescDraft(e.target.value)}
                        placeholder="Deskripsi ringkas provinsi untuk halaman wilayah publik..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 mb-2"
                      />
                      <input
                        value={coachingDraft}
                        onChange={(e) => setCoachingDraft(e.target.value)}
                        placeholder="Catatan pembinaan internal..."
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 mb-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateProvince(selected.code, {
                            description: descDraft,
                            coachingNote: coachingDraft,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold"
                      >
                        Simpan Deskripsi &amp; Catatan
                      </button>
                    </div>

                    <FileDropzone
                      label="Logo / Lambang Wilayah Provinsi (JPG / PNG / WebP)"
                      accept="image/png,image/jpeg,image/webp"
                      moduleName="province_logo"
                      uploadedFileName={selected.logoFileId ? `Logo tersimpan (${selected.logoFileId.slice(0, 8)})` : null}
                      onUploaded={(f) => handleUpdateProvince(selected.code, { logoFileId: f.fileId })}
                    />
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Pilih provinsi untuk melihat detail.</p>
            )}
          </GlassCard>
        </div>
      )}

      {tab === 'handover' && (
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold">Berita Acara Serah Terima Koordinator Wilayah</h2>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {handovers.map((h) => (
              <div key={String(h.id)} className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="space-y-1">
                  <p className="font-mono text-[11px] text-[#0EA5E9]">{String(h.referenceNumber)}</p>
                  <p className="font-bold text-sm">
                    {String(h.provinceName)}: {String(h.outgoingCoordinatorName)} → {String(h.incomingCoordinatorName)}
                  </p>
                  <p className="text-slate-500 tabular-nums">
                    Tugas aktif dialihkan: {Number(h.activeTasksCount)} · Proposal terbuka: {Number(h.openProposalsCount)}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">{String(h.notes)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={String(h.status)} />
                  {String(h.status) === 'menunggu_persetujuan' && can('organisasi', 'assign') && (
                    <button
                      type="button"
                      onClick={() => handleApproveHandover(String(h.id))}
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold"
                    >
                      Sahkan Serah Terima
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === 'lokasi' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 space-y-3">
            <h2 className="text-sm font-bold">Riwayat Verifikasi Lokasi On-Demand</h2>
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
              {locLogs.map((l) => (
                <div key={String(l.id)} className="py-2.5">
                  <p className="font-semibold">
                    {String(l.user_name)} · {String(l.action_type)}
                  </p>
                  <p className="text-slate-500 mt-0.5">{String(l.reason)}</p>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-3">
            <h2 className="text-sm font-bold">Permintaan Pengecualian Lokasi</h2>
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
              {locExceptions.length === 0 ? (
                <p className="text-slate-500 py-4">Belum ada permintaan pengecualian lokasi.</p>
              ) : (
                locExceptions.map((ex) => (
                  <div key={String(ex.id)} className="py-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold">
                        {String(ex.user_name)} (Prov {String(ex.province_code)})
                      </p>
                      <p className="text-slate-500">
                        {String(ex.reason)} · Berlaku s/d {String(ex.valid_until)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={String(ex.status)} />
                      {String(ex.status) === 'menunggu' && can('wilayah', 'manage') && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDecideException(String(ex.id), 'disetujui')}
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold"
                          >
                            Setujui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDecideException(String(ex.id), 'ditolak')}
                            className="px-2 py-1 rounded bg-rose-600 text-white font-semibold"
                          >
                            Tolak
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </GlassCard>
        </div>
      )}

      {tab === 'riwayat' && (
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <History className="w-4 h-4 text-[#0EA5E9]" /> Riwayat Pemekaran &amp; Perubahan Data Wilayah
          </h2>
          {historyList.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">Belum ada catatan perubahan wilayah.</p>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
              {historyList.map((h) => (
                <div key={h.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">{h.summary}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      {h.region_type} · Kode {h.region_code} · Aksi {h.action} · Oleh {h.actor_name}
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                    {formatTanggalIndonesia(h.created_at, true)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      <LocationVerifyModal
        open={locModalOpen}
        onClose={() => setLocModalOpen(false)}
        provinceCode={selected?.code || user?.provinceCode || '32'}
        provinceName={selected?.name || user?.provinceName || 'Jawa Barat'}
        actionType="uji_verifikasi_wilayah"
        onVerified={() => {
          setLocModalOpen(false);
          load();
        }}
      />

      {/* Tambah Daerah / Pemekaran Modal */}
      <Modal
        open={addRegencyOpen}
        onClose={() => setAddRegencyOpen(false)}
        title={`Tambah Daerah / Pemekaran — ${selected?.name || ''}`}
      >
        <form onSubmit={handleAddRegency} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Kode Wilayah Kemendagri/BPS *</label>
              <input
                required
                placeholder="Misal: 32.79"
                value={regForm.code}
                onChange={(e) => setRegForm({ ...regForm, code: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 font-mono text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Jenis Administratif</label>
              <select
                value={regForm.kind}
                onChange={(e) => setRegForm({ ...regForm, kind: e.target.value as 'kabupaten' | 'kota' })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="kabupaten">Kabupaten</option>
                <option value="kota">Kota</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Nama Kabupaten / Kota *</label>
            <input
              required
              placeholder="Misal: Kabupaten Pangandaran"
              value={regForm.name}
              onChange={(e) => setRegForm({ ...regForm, name: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Status Awal</label>
              <select
                value={regForm.status}
                onChange={(e) => setRegForm({ ...regForm, status: e.target.value as ProvinceStatus })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              >
                <option value="aktif">Aktif</option>
                <option value="dalam_pengembangan">Dalam Pengembangan</option>
                <option value="dalam_pembinaan">Dalam Pembinaan</option>
                <option value="belum_terbentuk">Belum Terbentuk</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Koordinator Daerah (Opsional)</label>
              <input
                value={regForm.coordinatorName}
                onChange={(e) => setRegForm({ ...regForm, coordinatorName: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Catatan Pemekaran / Pembinaan</label>
            <input
              value={regForm.coachingNote}
              onChange={(e) => setRegForm({ ...regForm, coachingNote: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold">
            Simpan Daerah Baru
          </button>
        </form>
      </Modal>

      <Modal open={handoverOpen} onClose={() => setHandoverOpen(false)} title="Ajukan Serah Terima Koordinator Wilayah">
        <form onSubmit={handleCreateHandover} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Provinsi</label>
            <select
              value={hForm.provinceCode}
              onChange={(e) => setHForm({ ...hForm, provinceCode: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {provinces.map((p) => (
                <option key={p.code} value={p.code}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Koordinator Lama</label>
            <input
              required
              value={hForm.outgoingCoordinatorName}
              onChange={(e) => setHForm({ ...hForm, outgoingCoordinatorName: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Calon Koordinator Pengganti</label>
            <input
              required
              value={hForm.incomingCoordinatorName}
              onChange={(e) => setHForm({ ...hForm, incomingCoordinatorName: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Catatan Aset &amp; Dokumen Serah Terima</label>
            <textarea
              rows={3}
              required
              value={hForm.notes}
              onChange={(e) => setHForm({ ...hForm, notes: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold">
            Ajukan Berita Acara
          </button>
        </form>
      </Modal>

      <A4PrintModal open={Boolean(printConfig)} config={printConfig} onClose={() => setPrintConfig(null)} />
    </div>
  );
}
