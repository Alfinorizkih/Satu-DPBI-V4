import React, { useEffect, useState } from 'react';
import { Bell, ClipboardCheck, FileCheck2, History, ListTodo, RefreshCw } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatTanggalIndonesia } from '../lib/rbac';
import {
  Button,
  EmptyState,
  GlassCard,
  LoadingSkeleton,
  PageContainer,
  PageHeader,
  StatusIndicator,
} from '../components/ui';

interface MyActivityResponse {
  proposals: {
    id: string;
    reference_number: string;
    title: string;
    category: string;
    event_date: string;
    status: string;
    updated_at: string;
  }[];
  lklReports: {
    id: string;
    reference_number: string;
    activity_name: string;
    event_date: string;
    participant_count: number;
    status: string;
    created_at: string;
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
  recentActions: {
    id: string;
    action: string;
    target_type: string;
    target_id: string;
    outcome: string;
    context_note: string;
    created_at: string;
  }[];
  unreadNotifications: {
    id: string;
    title: string;
    message: string;
    category: string;
    target_path: string;
    is_read: number;
    created_at: string;
  }[];
}

export function MyActivityPage() {
  const { user, navigate } = useAuth();
  const [data, setData] = useState<MyActivityResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiGet<MyActivityResponse>('/api/my-activity');
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) return <LoadingSkeleton rows={5} />;

  return (
    <PageContainer>
      <PageHeader
        title="Aktivitas Saya"
        description={`Ringkasan pengajuan pribadi, laporan lapangan, tugas terkait, dan riwayat tindakan akun ${user?.fullName || ''}.`}
        actions={
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => navigate('/proposal')}
          className="glass-surface rounded-2xl p-4 text-left hover:border-[#0EA5E9] transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">Proposal Saya</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {data?.proposals.length ?? 0}
          </p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/laporan-kegiatan')}
          className="glass-surface rounded-2xl p-4 text-left hover:border-[#0EA5E9] transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">LKL Saya</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {data?.lklReports.length ?? 0}
          </p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/tugas-saya')}
          className="glass-surface rounded-2xl p-4 text-left hover:border-[#0EA5E9] transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">Tugas Terkait</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums">
            {data?.tasks.length ?? 0}
          </p>
        </button>
        <button
          type="button"
          onClick={() => navigate('/notifikasi')}
          className="glass-surface rounded-2xl p-4 text-left hover:border-[#0EA5E9] transition-colors"
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">Notifikasi Terakhir</p>
          <p className="text-2xl font-bold text-[#0EA5E9] mt-1 tabular-nums">
            {data?.unreadNotifications.length ?? 0}
          </p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-[#0EA5E9]" /> Proposal Kegiatan Pribadi
            </h2>
            <button
              type="button"
              onClick={() => navigate('/proposal/baru')}
              className="text-xs font-semibold text-[#0EA5E9] hover:underline"
            >
              + Ajukan Baru
            </button>
          </div>
          {!data || data.proposals.length === 0 ? (
            <EmptyState
              title="Belum ada proposal pribadi"
              description="Proposal kegiatan yang Anda ajukan akan tampil di daftar ini untuk pemantauan status persetujuan."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.proposals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/proposal/${p.id}`)}
                  className="w-full py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-lg px-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-500">{p.reference_number}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.category} · {formatTanggalIndonesia(p.event_date)}</p>
                  </div>
                  <StatusIndicator status={p.status} />
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-[#0EA5E9]" /> Laporan Kegiatan Lapangan (LKL)
            </h2>
            <button
              type="button"
              onClick={() => navigate('/laporan-kegiatan/baru')}
              className="text-xs font-semibold text-[#0EA5E9] hover:underline"
            >
              + Buat LKL
            </button>
          </div>
          {!data || data.lklReports.length === 0 ? (
            <EmptyState
              title="Belum ada LKL tercatat"
              description="Dokumentasi laporan pelaksanaan kegiatan yang Anda kirim akan terarsip di sini."
            />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.lklReports.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => navigate(`/laporan-kegiatan/${l.id}`)}
                  className="w-full py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-lg px-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-500">{l.reference_number}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{l.activity_name}</p>
                    <p className="text-xs text-slate-500 tabular-nums">
                      {formatTanggalIndonesia(l.event_date)} · {l.participant_count} peserta
                    </p>
                  </div>
                  <StatusIndicator status={l.status} />
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[#0EA5E9]" /> Tugas Saya Terkini
            </h2>
            <button
              type="button"
              onClick={() => navigate('/tugas-saya')}
              className="text-xs font-semibold text-[#0EA5E9] hover:underline"
            >
              Buka Semua Tugas
            </button>
          </div>
          {!data || data.tasks.length === 0 ? (
            <EmptyState title="Belum ada tugas pribadi" description="Tugas yang ditugaskan kepada Anda akan muncul di sini." />
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.tasks.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => navigate(`/tugas/${t.id}`)}
                  className="w-full py-2.5 text-left flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-slate-800/40 rounded-lg px-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-slate-500">{t.reference_number}</p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{t.title}</p>
                    <p className="text-xs text-slate-500 tabular-nums">Tenggat: {formatTanggalIndonesia(t.deadline)}</p>
                  </div>
                  <StatusIndicator status={t.status} />
                </button>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <History className="w-4 h-4 text-[#0EA5E9]" /> Jejak Aktivitas Akun Saya
          </h2>
          {!data || data.recentActions.length === 0 ? (
            <EmptyState
              title="Belum ada log aktivitas"
              description="Aktivitas masuk, pengajuan, dan pembaruan profil Anda akan tercatat secara kronologis."
            />
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {data.recentActions.map((act) => (
                <div
                  key={act.id}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 px-3 py-2.5 flex items-start justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{act.action}</p>
                    <p className="text-slate-500 dark:text-slate-400 truncate">
                      {act.target_type}: {act.target_id}
                      {act.context_note ? ` · ${act.context_note}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <StatusIndicator status={act.outcome} />
                    <p className="text-[10px] text-slate-400 mt-0.5 tabular-nums">
                      {formatTanggalIndonesia(act.created_at, true)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {data && data.unreadNotifications.length > 0 && (
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-[#0EA5E9]" /> Pemberitahuan Terkait
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {data.unreadNotifications.slice(0, 4).map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => navigate(n.target_path || '/notifikasi')}
                className="text-left rounded-xl border border-slate-200 dark:border-slate-800 p-3 hover:border-[#0EA5E9] transition-colors"
              >
                <p className="text-xs font-bold text-slate-900 dark:text-white">{n.title}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
              </button>
            ))}
          </div>
        </GlassCard>
      )}
    </PageContainer>
  );
}
