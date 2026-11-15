import React, { useEffect, useState } from 'react';
import { ArrowLeftRight, List, Map as MapIcon, MapPin } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { IndonesiaMap } from '../components/IndonesiaMap';
import { LocationVerifyModal } from '../components/LocationVerifyModal';
import { GlassCard, LoadingSkeleton, Modal, StatusIndicator } from '../components/ui/Primitives';
import type { ProvinceRecord, ProvinceStatus } from '../lib/types';

export function RegionsPage() {
  const { user, can, notify } = useAuth();
  const [tab, setTab] = useState<'peta' | 'handover' | 'lokasi'>('peta');
  const [viewMode, setViewMode] = useState<'gabungan' | 'daftar'>('gabungan');
  const [provinces, setProvinces] = useState<ProvinceRecord[]>([]);
  const [selected, setSelected] = useState<ProvinceRecord | null>(null);
  const [handovers, setHandovers] = useState<Record<string, unknown>[]>([]);
  const [locLogs, setLocLogs] = useState<Record<string, unknown>[]>([]);
  const [locExceptions, setLocExceptions] = useState<Record<string, unknown>[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [locModalOpen, setLocModalOpen] = useState(false);
  const [handoverOpen, setHandoverOpen] = useState(false);
  const [hForm, setHForm] = useState({ provinceCode: '32', outgoingCoordinatorName: '', incomingCoordinatorName: '', notes: '' });

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, hRes, lRes] = await Promise.all([
        apiGet<{ provinces: ProvinceRecord[] }>('/api/provinces'),
        apiGet<{ handovers: Record<string, unknown>[] }>('/api/handovers'),
        apiGet<{ logs: Record<string, unknown>[]; exceptions: Record<string, unknown>[] }>('/api/location/logs'),
      ]);
      setProvinces(pRes.provinces);
      setHandovers(hRes.handovers);
      setLocLogs(lRes.logs);
      setLocExceptions(lRes.exceptions);
      if (pRes.provinces.length > 0) {
        setSelected((prev) => {
          if (prev) return pRes.provinces.find((p) => p.code === prev.code) || prev;
          return pRes.provinces.find((p) => p.code === (user?.provinceCode || '32')) || pRes.provinces[0];
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleUpdateProvince = async (code: string, status: ProvinceStatus, coachingNote: string) => {
    try {
      await apiPatch(`/api/provinces/${code}`, { status, coachingNote });
      notify('Status wilayah berhasil diperbarui.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui wilayah.', 'error');
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
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Wilayah 38 Provinsi & Handover Center</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Akses data 38 provinsi Indonesia melalui daftar terstruktur maupun peta interaktif, termasuk serah terima koordinator.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setLocModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            <MapPin className="w-4 h-4 text-[#0EA5E9]" /> Uji Verifikasi Lokasi
          </button>
          {can('wilayah', 'edit') && (
            <button
              type="button"
              onClick={() => setHandoverOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold"
            >
              <ArrowLeftRight className="w-4 h-4" /> Ajukan Serah Terima
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
          <button type="button" onClick={() => setTab('peta')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === 'peta' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
            Peta & Daftar 38 Provinsi
          </button>
          <button type="button" onClick={() => setTab('handover')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === 'handover' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
            Handover Center ({handovers.length})
          </button>
          <button type="button" onClick={() => setTab('lokasi')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === 'lokasi' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}>
            Verifikasi Lokasi & Pengecualian
          </button>
        </div>

        {tab === 'peta' && (
          <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
            <button
              type="button"
              onClick={() => setViewMode('gabungan')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${viewMode === 'gabungan' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
            >
              <MapIcon className="w-3.5 h-3.5" /> Peta + Daftar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('daftar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold ${viewMode === 'daftar' ? 'bg-white dark:bg-slate-900 shadow-xs' : 'text-slate-600 dark:text-slate-400'}`}
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
              <IndonesiaMap provinces={provinces} selectedCode={selected?.code ?? null} onSelect={setSelected} />
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
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
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
                      <th className="py-2 pr-3 text-right">Duta</th>
                      <th className="py-2 pr-3 text-right">LKL</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                    {filteredProvinces.map((p) => (
                      <tr
                        key={p.code}
                        onClick={() => setSelected(p)}
                        className={`cursor-pointer hover:bg-sky-50/50 dark:hover:bg-slate-800/40 ${selected?.code === p.code ? 'bg-sky-50/80 dark:bg-slate-800/60' : ''}`}
                      >
                        <td className="py-2 pr-3 font-mono">{p.code}</td>
                        <td className="py-2 pr-3 font-semibold text-slate-900 dark:text-white">{p.name}</td>
                        <td className="py-2 pr-3">{p.coordinatorName || '—'}</td>
                        <td className="py-2 pr-3 text-right">{p.activeDutaCount}</td>
                        <td className="py-2 pr-3 text-right">{p.lklCount}</td>
                        <td className="py-2"><StatusIndicator status={p.status} /></td>
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
                      <span className="font-bold text-slate-900 dark:text-white">{p.code} · {p.name}</span>
                      <StatusIndicator status={p.status} />
                    </div>
                    <p className="text-slate-500 tabular-nums">
                      {p.coordinatorName || 'Belum ada koordinator'} · {p.activeDutaCount} Duta · {p.lklCount} LKL
                    </p>
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>

          <GlassCard className="lg:col-span-4 p-5 space-y-4 h-fit">
            {selected ? (
              <>
                <div>
                  <p className="font-mono text-xs text-[#0EA5E9]">Kode Wilayah {selected.code}</p>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">{selected.name}</h2>
                  <p className="text-xs text-slate-500">{selected.island}</p>
                </div>
                <StatusIndicator status={selected.status} />
                <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-200 dark:border-slate-800 tabular-nums">
                  <div>
                    <p className="text-slate-500">Duta Aktif</p>
                    <p className="font-mono text-lg font-bold">{selected.activeDutaCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Alumni</p>
                    <p className="font-mono text-lg font-bold">{selected.alumniCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Proposal</p>
                    <p className="font-mono text-lg font-bold">{selected.proposalCount}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">LKL</p>
                    <p className="font-mono text-lg font-bold">{selected.lklCount}</p>
                  </div>
                </div>
                <div className="text-xs space-y-1">
                  <p className="font-semibold">Koordinator Wilayah</p>
                  <p className="text-slate-600 dark:text-slate-300">{selected.coordinatorName || 'Belum ditetapkan'}</p>
                  <p className="font-semibold pt-2">Laporan Bulanan / Akhir Wilayah</p>
                  <p className="text-slate-600 dark:text-slate-300">
                    Bulanan: {selected.monthlyReportSubmitted ? 'Sudah dikirim' : 'Belum'} · Akhir: {selected.finalReportSubmitted ? 'Sudah' : 'Belum'}
                  </p>
                  <p className="font-semibold pt-2">Catatan Pembinaan</p>
                  <p className="text-slate-600 dark:text-slate-300">{selected.coachingNote || 'Tidak ada catatan khusus.'}</p>
                </div>
                {can('wilayah', 'edit') && (user?.role !== 'koordinator_wilayah' || user.provinceCode === selected.code) && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
                    <label className="block font-semibold">Perbarui Status Wilayah</label>
                    <select
                      value={selected.status}
                      onChange={(e) => handleUpdateProvince(selected.code, e.target.value as ProvinceStatus, selected.coachingNote || '')}
                      className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                    >
                      <option value="aktif">Aktif</option>
                      <option value="dalam_pengembangan">Dalam Pengembangan</option>
                      <option value="dalam_pembinaan">Dalam Pembinaan</option>
                      <option value="belum_terbentuk">Belum Terbentuk</option>
                      <option value="tidak_aktif">Tidak Aktif</option>
                    </select>
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
                  <p className="font-bold text-sm">{String(h.provinceName)}: {String(h.outgoingCoordinatorName)} → {String(h.incomingCoordinatorName)}</p>
                  <p className="text-slate-500">Tugas aktif dialihkan: {Number(h.activeTasksCount)} · Proposal terbuka: {Number(h.openProposalsCount)}</p>
                  <p className="text-slate-600 dark:text-slate-400">{String(h.notes)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusIndicator status={String(h.status)} />
                  {String(h.status) === 'menunggu_persetujuan' && can('organisasi', 'assign') && (
                    <button type="button" onClick={() => handleApproveHandover(String(h.id))} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold">
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
                  <p className="font-semibold">{String(l.user_name)} · {String(l.action_type)}</p>
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
                      <p className="font-semibold">{String(ex.user_name)} (Prov {String(ex.province_code)})</p>
                      <p className="text-slate-500">{String(ex.reason)} · Berlaku s/d {String(ex.valid_until)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusIndicator status={String(ex.status)} />
                      {String(ex.status) === 'menunggu' && can('wilayah', 'manage') && (
                        <>
                          <button type="button" onClick={() => handleDecideException(String(ex.id), 'disetujui')} className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold">Setujui</button>
                          <button type="button" onClick={() => handleDecideException(String(ex.id), 'ditolak')} className="px-2 py-1 rounded bg-rose-600 text-white font-semibold">Tolak</button>
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

      <Modal open={handoverOpen} onClose={() => setHandoverOpen(false)} title="Ajukan Serah Terima Koordinator Wilayah">
        <form onSubmit={handleCreateHandover} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Provinsi</label>
            <select value={hForm.provinceCode} onChange={(e) => setHForm({ ...hForm, provinceCode: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
              {provinces.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Koordinator Lama</label>
            <input required value={hForm.outgoingCoordinatorName} onChange={(e) => setHForm({ ...hForm, outgoingCoordinatorName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Calon Koordinator Pengganti</label>
            <input required value={hForm.incomingCoordinatorName} onChange={(e) => setHForm({ ...hForm, incomingCoordinatorName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Catatan Aset & Dokumen Serah Terima</label>
            <textarea rows={3} required value={hForm.notes} onChange={(e) => setHForm({ ...hForm, notes: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold">Ajukan Berita Acara</button>
        </form>
      </Modal>
    </div>
  );
}
