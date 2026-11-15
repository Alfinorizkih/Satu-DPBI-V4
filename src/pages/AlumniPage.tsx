import React, { useEffect, useState } from 'react';
import { Award, Clock, ShieldCheck } from 'lucide-react';
import { apiGet, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatTanggalIndonesia } from '../lib/rbac';
import {
  Button,
  EmptyState,
  GlassCard,
  LoadingSkeleton,
  PageContainer,
  PageHeader,
  SearchBar,
  StatusIndicator,
} from '../components/ui';
import type { PersonnelRecord } from '../lib/types';

interface AlumniArchiveResponse {
  archivedBatches: {
    id: string;
    batch_number: number;
    name: string;
    term_starts_at: string;
    term_ends_at: string;
    status: string;
  }[];
  alumniWindow: {
    inWindow: boolean;
    expired: boolean;
    daysRemaining: number;
    expiresAtIso: string;
  } | null;
  alumniUsers: {
    id: string;
    full_name: string;
    email: string;
    alumni_access_expires_at: string | null;
  }[];
}

export function AlumniPage() {
  const { user, can, notify, navigate } = useAuth();
  const [archiveData, setArchiveData] = useState<AlumniArchiveResponse | null>(null);
  const [alumniPersonnel, setAlumniPersonnel] = useState<PersonnelRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [extendingId, setExtendingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [arch, pers] = await Promise.all([
        apiGet<AlumniArchiveResponse>('/api/archive'),
        can('personalia', 'view')
          ? apiGet<{ personnel: PersonnelRecord[] }>('/api/personnel').catch(() => ({ personnel: [] }))
          : Promise.resolve({ personnel: [] }),
      ]);
      setArchiveData(arch);
      setAlumniPersonnel(
        (pers.personnel || []).filter(
          (p) => p.personnelStatus === 'alumni' || p.roleCode === 'alumni' || p.personnelStatus === 'menyelesaikan_masa_jabatan'
        )
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat data alumni.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const extendAccess = async (userId: string) => {
    setExtendingId(userId);
    try {
      await apiPost(`/api/archive/alumni/${userId}/extend`, {
        days: 30,
        reason: 'Perpanjangan jendela unduh arsip alumni melalui Direktori Alumni',
      });
      notify('Masa akses arsip Alumni diperpanjang 30 hari.', 'success');
      await load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperpanjang akses alumni.', 'error');
    } finally {
      setExtendingId(null);
    }
  };

  if (loading && !archiveData) return <LoadingSkeleton rows={4} />;

  const q = search.trim().toLowerCase();
  const userExpiresMap = new Map<string, string | null>(
    (archiveData?.alumniUsers || []).map((u) => [u.id, u.alumni_access_expires_at])
  );

  const filteredAlumni = alumniPersonnel.filter((p) => {
    if (!q) return true;
    return (
      p.fullName.toLowerCase().includes(q) ||
      p.memberNumber.toLowerCase().includes(q) ||
      p.provinceName.toLowerCase().includes(q) ||
      p.batchName.toLowerCase().includes(q)
    );
  });

  const archivedBatches = archiveData?.archivedBatches || [];

  return (
    <PageContainer>
      <PageHeader
        title="Direktori & Masa Akses Alumni"
        description="Pengelolaan purna tugas Duta Pelajar Berbudaya Indonesia beserta jendela akses baca arsip 30 hari."
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate('/arsip')}>
            Buka Arsip Lengkap
          </Button>
        }
      />

      {archiveData?.alumniWindow && (
        <GlassCard className="p-4 flex items-center gap-3">
          <Clock className="w-5 h-5 text-[#0EA5E9] shrink-0" />
          <div className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">
              Status Akses Arsip Alumni Anda (Sisa {archiveData.alumniWindow.daysRemaining} Hari):
            </span>{' '}
            Berlaku hingga {formatTanggalIndonesia(archiveData.alumniWindow.expiresAtIso, true)}.
          </div>
        </GlassCard>
      )}

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Cari alumni berdasarkan nama, nomor anggota, angkatan, atau provinsi..."
      />

      {filteredAlumni.length === 0 ? (
        <EmptyState
          title="Belum ada data alumni yang sesuai filter"
          description="Data alumni otomatis terbentuk ketika sebuah angkatan telah selesai masa tugas dan dipindahkan ke arsip."
          actionLabel="Lihat Arsip Angkatan"
          onAction={() => navigate('/arsip')}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAlumni.map((al) => {
            const expiresAt = al.userId ? userExpiresMap.get(al.userId) : null;
            return (
              <GlassCard key={al.id} className="p-4 space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-500">{al.memberNumber || al.referenceNumber || '-'}</p>
                    <button
                      type="button"
                      onClick={() => navigate(`/personalia/${al.id}`)}
                      className="text-sm font-bold text-slate-900 dark:text-white hover:text-[#0EA5E9] truncate block text-left"
                    >
                      {al.fullName}
                    </button>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {al.provinceName || 'Nasional'} · {al.batchName || 'Purna Tugas'}
                    </p>
                  </div>
                  <StatusIndicator status={al.personnelStatus} />
                </div>
                <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-[#0EA5E9] shrink-0" />
                  <span>
                    {expiresAt
                      ? `Akses arsip s.d. ${formatTanggalIndonesia(expiresAt)}`
                      : `Purna tugas · ${formatTanggalIndonesia(al.termEndsAt)}`}
                  </span>
                </div>
                {can('arsip', 'manage') && al.userId && userExpiresMap.has(al.userId) && (
                  <div className="pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      loading={extendingId === al.userId}
                      onClick={() => extendAccess(al.userId!)}
                    >
                      Perpanjang Akses +30 Hari
                    </Button>
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {archivedBatches.length > 0 && (
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-[#0EA5E9]" /> Riwayat Angkatan Purna Tugas
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {archivedBatches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => navigate(`/angkatan/${b.id}`)}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 hover:border-[#0EA5E9] p-3 text-xs transition-colors"
              >
                <p className="font-bold text-slate-900 dark:text-white">{b.name}</p>
                <p className="text-slate-500 mt-0.5">
                  Masa tugas: {formatTanggalIndonesia(b.term_starts_at)} – {formatTanggalIndonesia(b.term_ends_at)}
                </p>
              </button>
            ))}
          </div>
        </GlassCard>
      )}
    </PageContainer>
  );
}
