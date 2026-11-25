import React, { useEffect, useState } from 'react';
import { Award, Building2, Eye, Plus, ShieldCheck } from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ConfirmDialog } from '../components/ui';
import { GlassCard, LoadingSkeleton, Modal, StatusIndicator } from '../components/ui/Primitives';
import type { BatchRecord, BatchStatus, ModuleCode, PermissionAction } from '../lib/types';
import { formatTanggalIndonesia, isRecordRelevantToBidang, OFFICIAL_BIDANGS } from '../lib/rbac';

export function OrganizationPage() {
  const { user, can, notify } = useAuth();
  const [positions, setPositions] = useState<Record<string, unknown>[]>([]);
  const [delegations, setDelegations] = useState<Record<string, unknown>[]>([]);
  const [users, setUsers] = useState<{ id: string; fullName: string; roleLabel: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [posOpen, setPosOpen] = useState(false);
  const [delOpen, setDelOpen] = useState(false);
  const [confirmRevokeDel, setConfirmRevokeDel] = useState<{ id: string; name: string } | null>(null);

  const [posForm, setPosForm] = useState<{ title: string; bidang: string; level: string; holderName: string; skNumber: string }>({
    title: '',
    bidang: OFFICIAL_BIDANGS[0].id,
    level: 'Nasional',
    holderName: '',
    skNumber: '',
  });
  const [delForm, setDelForm] = useState({
    delegateUserId: '',
    module: 'wilayah' as ModuleCode,
    action: 'manage' as PermissionAction,
    startsAt: new Date().toISOString().slice(0, 10),
    endsAt: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    reason: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ positions: Record<string, unknown>[]; delegations: Record<string, unknown>[] }>('/api/organization');
      setPositions(res.positions);
      setDelegations(res.delegations);
      if (can('pengaturan', 'manage')) {
        const uRes = await apiGet<{ users: { id: string; fullName: string; roleLabel: string }[] }>('/api/settings/users');
        setUsers(uRes.users);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleCreatePos = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/organization/positions', posForm);
      notify('Jabatan organisasi berhasil ditambahkan.', 'success');
      setPosOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menambah jabatan.', 'error');
    }
  };

  const handleCreateDel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (delForm.startsAt >= delForm.endsAt) {
      notify('Tanggal berakhir delegasi harus lebih lambat dari tanggal mulai.', 'error');
      return;
    }
    try {
      await apiPost('/api/organization/delegations', {
        ...delForm,
        provinceCode: user?.role === 'koordinator_wilayah' ? user.provinceCode : undefined,
        startsAt: `${delForm.startsAt}T00:00:00Z`,
        endsAt: `${delForm.endsAt}T23:59:59Z`,
      });
      notify('Delegasi kewenangan aktif diterbitkan.', 'success');
      setDelOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menerbitkan delegasi.', 'error');
    }
  };

  const handleRevoke = async (id: string) => {
    try {
      await apiPost(`/api/organization/delegations/${id}/revoke`);
      notify('Delegasi berhasil dicabut.', 'info');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mencabut delegasi.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Struktur Organisasi & Delegasi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pemisahan tegas antara jabatan organisasi dengan hak akses sistem (RBAC + Delegasi Terbatas Waktu).
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('organisasi', 'edit') && (
            <button type="button" onClick={() => setPosOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
              <Plus className="w-4 h-4" /> Tambah Jabatan
            </button>
          )}
          {can('organisasi', 'assign') && users.length > 0 && (
            <button type="button" onClick={() => setDelOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">
              <ShieldCheck className="w-4 h-4 text-[#0EA5E9]" /> Beri Delegasi
            </button>
          )}
        </div>
      </div>

      <GlassCard className="p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              6 Bidang Pengurus Nasional Resmi
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Struktur enam bidang resmi tingkat nasional sesuai tata kelola DPBI.
            </p>
          </div>
          <span className="font-mono text-xs text-slate-500 tabular-nums">
            {OFFICIAL_BIDANGS.length} Bidang Resmi
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {OFFICIAL_BIDANGS.map((b) => {
            const matchedPositions = positions.filter((p) =>
              isRecordRelevantToBidang(b.id, String(p.bidang || ''), String(p.title || ''))
            );
            const activeHolders = matchedPositions.filter((p) => String(p.holder_name || '').trim()).length;
            return (
              <div
                key={b.code}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono font-bold text-[#0EA5E9] tabular-nums">{b.number}.</span>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {activeHolders} pemegang aktif
                  </span>
                </div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">{b.id}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{b.summary}</p>
              </div>
            );
          })}
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-4">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Building2 className="w-4 h-4 text-[#0EA5E9]" /> Struktur Kepengurusan Nasional
        </h2>
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2.5 pr-4">Jabatan</th>
                <th className="py-2.5 pr-4">Bidang</th>
                <th className="py-2.5 pr-4">Pemegang Jabatan</th>
                <th className="py-2.5 pr-4">Nomor SK</th>
                <th className="py-2.5">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {positions.map((p) => (
                <tr key={String(p.id)}>
                  <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">{String(p.title)}</td>
                  <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">{String(p.bidang)}</td>
                  <td className="py-3 pr-4">{String(p.holder_name || 'Belum diisi')}</td>
                  <td className="py-3 pr-4 font-mono tabular-nums">{String(p.sk_number || '—')}</td>
                  <td className="py-3"><StatusIndicator status={String(p.status)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
          {positions.map((p) => (
            <div key={String(p.id)} className="py-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold text-slate-900 dark:text-white">{String(p.title)}</p>
                <StatusIndicator status={String(p.status)} />
              </div>
              <p className="text-slate-500">{String(p.bidang)} · {String(p.holder_name || 'Belum diisi')}</p>
              <p className="font-mono text-[11px] text-slate-400">SK: {String(p.sk_number || '—')}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5 space-y-4">
        <h2 className="text-sm font-bold">Riwayat Delegasi Kewenangan</h2>
        <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
          {delegations.map((d) => (
            <div key={String(d.id)} className="py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <p className="font-semibold text-slate-900 dark:text-white">
                  {String(d.delegate_name)} · Izin: <span className="font-mono">{String(d.module)}:{String(d.action)}</span>
                </p>
                <p className="text-slate-500 dark:text-slate-400">
                  Pemberi: {String(d.grantor_name)} · Alasan: {String(d.reason)}
                </p>
                <p className="text-[11px] text-slate-400 tabular-nums">
                  Berlaku: {formatTanggalIndonesia(String(d.starts_at))} s/d {formatTanggalIndonesia(String(d.ends_at))}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusIndicator status={String(d.status) === 'aktif' ? 'aktif' : 'nonaktif'} customLabel={String(d.status)} />
                {String(d.status) === 'aktif' && can('organisasi', 'assign') && (
                  <button
                    type="button"
                    onClick={() => setConfirmRevokeDel({ id: String(d.id), name: String(d.delegate_name) })}
                    className="px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 text-[11px] font-semibold"
                  >
                    Cabut
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <Modal open={posOpen} onClose={() => setPosOpen(false)} title="Tambah Jabatan Organisasi">
        <form onSubmit={handleCreatePos} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Nama Jabatan</label>
            <input required value={posForm.title} onChange={(e) => setPosForm({ ...posForm, title: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Bidang Resmi</label>
            <select
              required
              value={posForm.bidang}
              onChange={(e) => setPosForm({ ...posForm, bidang: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            >
              {OFFICIAL_BIDANGS.map((b) => (
                <option key={b.code} value={b.id}>
                  {b.number}. {b.id}
                </option>
              ))}
              <option value="Pimpinan & Tata Kelola Nasional">Pimpinan &amp; Tata Kelola Nasional</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Pemegang Jabatan</label>
            <input value={posForm.holderName} onChange={(e) => setPosForm({ ...posForm, holderName: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Nomor SK Penetapan</label>
            <input value={posForm.skNumber} onChange={(e) => setPosForm({ ...posForm, skNumber: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm font-mono" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold">Simpan Jabatan</button>
        </form>
      </Modal>

      <Modal open={delOpen} onClose={() => setDelOpen(false)} title="Terbitkan Delegasi Kewenangan Terbatas">
        <form onSubmit={handleCreateDel} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1">Penerima Delegasi</label>
            <select required value={delForm.delegateUserId} onChange={(e) => setDelForm({ ...delForm, delegateUserId: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
              <option value="">Pilih pengguna...</option>
              {users.map((u) => <option key={u.id} value={u.id}>{u.fullName} ({u.roleLabel})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Modul</label>
              <select value={delForm.module} onChange={(e) => setDelForm({ ...delForm, module: e.target.value as ModuleCode })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
                <option value="wilayah">wilayah</option>
                <option value="proposal">proposal</option>
                <option value="personalia">personalia</option>
                <option value="dokumen">dokumen</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Aksi</label>
              <select value={delForm.action} onChange={(e) => setDelForm({ ...delForm, action: e.target.value as PermissionAction })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm">
                <option value="manage">manage</option>
                <option value="approve">approve</option>
                <option value="review">review</option>
                <option value="edit">edit</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Tanggal Mulai</label>
              <input type="date" required value={delForm.startsAt} onChange={(e) => setDelForm({ ...delForm, startsAt: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Tanggal Berakhir</label>
              <input type="date" required value={delForm.endsAt} onChange={(e) => setDelForm({ ...delForm, endsAt: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Alasan Delegasi</label>
            <input required value={delForm.reason} onChange={(e) => setDelForm({ ...delForm, reason: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold">Terbitkan Delegasi</button>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmRevokeDel)}
        title="Cabut Delegasi Kewenangan?"
        message={
          confirmRevokeDel
            ? `Yakin ingin mencabut delegasi sementara milik ${confirmRevokeDel.name}? Hak akses delegasi akan langsung berhenti.`
            : ''
        }
        confirmLabel="Ya, Cabut Delegasi"
        danger
        onConfirm={() => {
          const target = confirmRevokeDel;
          setConfirmRevokeDel(null);
          if (target) handleRevoke(target.id);
        }}
        onCancel={() => setConfirmRevokeDel(null)}
      />
    </div>
  );
}

export function BatchesPage({ initialId }: { initialId?: string }) {
  const { can, notify, navigate } = useAuth();
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<BatchRecord | null>(null);
  const [form, setForm] = useState({
    batchNumber: 4,
    name: 'Angkatan IV — Harmoni Nusantara',
    termStartsAt: '2027-02-01',
    termEndsAt: '2027-06-01',
    durationMonths: 4,
    status: 'perencanaan' as BatchStatus,
  });

  const load = () => {
    setLoading(true);
    apiGet<{ batches: BatchRecord[] }>('/api/batches')
      .then((res) => {
        setBatches(res.batches);
        if (initialId) {
          const match = res.batches.find((b) => b.id === initialId || String(b.batchNumber) === initialId);
          if (match) setSelectedBatch(match);
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [initialId]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/batches', form);
      notify('Angkatan baru berhasil dibuat tanpa menimpa data historis sebelumnya.', 'success');
      setOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal membuat angkatan.', 'error');
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiPatch(`/api/batches/${id}`, { status });
      notify('Status angkatan diperbarui.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui status.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Manajemen Batch & Angkatan</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Siklus masa tugas dapat dikonfigurasi dengan pelestarian penuh riwayat kegiatan dan personel antarangkatan.
          </p>
        </div>
        {can('angkatan', 'create') && (
          <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
            <Plus className="w-4 h-4" /> Buat Angkatan Baru
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {batches.map((b) => (
          <GlassCard key={b.id} className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-xs text-[#0EA5E9] font-semibold">Angkatan #{b.batchNumber}</p>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">{b.name}</h2>
              </div>
              <StatusIndicator status={b.status} />
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 tabular-nums">
              <p>Masa Tugas: {formatTanggalIndonesia(b.termStartsAt)} – {formatTanggalIndonesia(b.termEndsAt)} ({b.durationMonths} bulan)</p>
              <p>Personel: {b.activePersonnelCount} · Proposal: {b.proposalCount} · LKL: {b.lklCount}</p>
            </div>

            <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setSelectedBatch(b)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0EA5E9] hover:underline"
              >
                <Eye className="w-3.5 h-3.5" /> Detail Angkatan
              </button>
              {can('angkatan', 'edit') && (
                <select
                  aria-label={`Ubah status ${b.name}`}
                  value={b.status}
                  onChange={(e) => handleStatusChange(b.id, e.target.value)}
                  className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                >
                  <option value="perencanaan">Perencanaan</option>
                  <option value="pendaftaran">Pendaftaran</option>
                  <option value="seleksi">Seleksi</option>
                  <option value="pembekalan">Pembekalan</option>
                  <option value="aktif">Aktif</option>
                  <option value="evaluasi">Evaluasi</option>
                  <option value="selesai">Selesai</option>
                  <option value="diarsipkan">Diarsipkan</option>
                </select>
              )}
            </div>
          </GlassCard>
        ))}
      </div>

      {/* Batch Comparison Table */}
      <GlassCard className="p-5 space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Award className="w-4 h-4 text-[#0EA5E9]" /> Perbandingan Capaian Antarangkatan (Arsip Terjaga)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
              <tr>
                <th className="py-2 pr-4">Angkatan</th>
                <th className="py-2 pr-4">Durasi</th>
                <th className="py-2 pr-4 text-right">Personel</th>
                <th className="py-2 pr-4 text-right">Proposal</th>
                <th className="py-2 pr-4 text-right">LKL</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
              {batches.map((b) => (
                <tr key={b.id} onClick={() => setSelectedBatch(b)} className="cursor-pointer hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                  <td className="py-2.5 pr-4 font-semibold">{b.name}</td>
                  <td className="py-2.5 pr-4">{b.durationMonths} bulan</td>
                  <td className="py-2.5 pr-4 text-right">{b.activePersonnelCount}</td>
                  <td className="py-2.5 pr-4 text-right">{b.proposalCount}</td>
                  <td className="py-2.5 pr-4 text-right">{b.lklCount}</td>
                  <td className="py-2.5"><StatusIndicator status={b.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Batch Detail Modal */}
      <Modal
        open={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
        title={selectedBatch?.name || 'Detail Angkatan'}
        subtitle={selectedBatch ? `Angkatan #${selectedBatch.batchNumber} · Durasi ${selectedBatch.durationMonths} Bulan` : ''}
      >
        {selectedBatch && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <StatusIndicator status={selectedBatch.status} />
              <span className="text-slate-500 tabular-nums">
                {formatTanggalIndonesia(selectedBatch.termStartsAt)} – {formatTanggalIndonesia(selectedBatch.termEndsAt)}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 tabular-nums">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-slate-500">Personel Tercatat</p>
                <p className="font-mono text-xl font-bold mt-0.5">{selectedBatch.activePersonnelCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-slate-500">Total Proposal</p>
                <p className="font-mono text-xl font-bold mt-0.5">{selectedBatch.proposalCount}</p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                <p className="text-slate-500">Total LKL</p>
                <p className="font-mono text-xl font-bold mt-0.5">{selectedBatch.lklCount}</p>
              </div>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              Seluruh riwayat kegiatan, proposal, LKL, dan keanggotaan angkatan ini tetap tersimpan utuh di database dan tidak pernah ditimpa ketika angkatan baru diterbitkan.
            </p>
            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSelectedBatch(null);
                  navigate('/personalia');
                }}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
              >
                Lihat Daftar Personel
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedBatch(null);
                  navigate('/arsip');
                }}
                className="px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold"
              >
                Buka Arsip & Alumni
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Buat Batch / Angkatan Baru">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Nomor Angkatan</label>
              <input type="number" required value={form.batchNumber} onChange={(e) => setForm({ ...form, batchNumber: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Durasi Masa Tugas (Bulan)</label>
              <input type="number" min={1} max={24} required value={form.durationMonths} onChange={(e) => setForm({ ...form, durationMonths: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold mb-1">Nama Batch</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold mb-1">Mulai Masa Tugas</label>
              <input type="date" required value={form.termStartsAt} onChange={(e) => setForm({ ...form, termStartsAt: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1">Akhir Masa Tugas</label>
              <input type="date" required value={form.termEndsAt} onChange={(e) => setForm({ ...form, termEndsAt: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold">Simpan Angkatan</button>
        </form>
      </Modal>
    </div>
  );
}
