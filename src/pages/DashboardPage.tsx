import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileCheck2,
  ListTodo,
  MapPin,
  Printer,
  Users,
  X,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiGet } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { GlassCard, LoadingSkeleton, StatusIndicator } from '../components/ui/Primitives';
import { IndonesiaMap } from '../components/IndonesiaMap';
import { formatTanggalIndonesia } from '../lib/rbac';
import type { ProvinceRecord, TaskRecord } from '../lib/types';

interface DashboardData {
  summary: {
    totalPersonnel: number;
    activeDuta: number;
    activeProvinces: number;
    totalProvinces: number;
    pendingProposals: number;
    pendingLkl: number;
    overdueTasks: number;
    unreadNotifications: number;
    totalStorageBytes: number;
  };
  attentionItems: { id: string; level: 'kritis' | 'perhatian' | 'info'; title: string; detail: string; path: string }[];
  charts: {
    personnelPerBatch: { name: string; jumlah: number }[];
    provinceStatusChart: { status: string; total: number }[];
    topProvinceActivities: { provinceName: string; proposalCount: number; lklCount: number }[];
  };
  recentActivities: {
    id: string;
    category: string;
    title: string;
    description: string;
    provinceName: string | null;
    actorName: string;
    relatedPath: string;
    createdAt: string;
  }[];
  upcomingEvents: {
    id: string;
    title: string;
    category: string;
    startAt: string;
    location: string;
  }[];
}

export function DashboardPage() {
  const { user, navigate, can, onboardingDone, dismissOnboarding, recentlyViewed } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [provinces, setProvinces] = useState<ProvinceRecord[]>([]);
  const [tasksDue, setTasksDue] = useState<TaskRecord[]>([]);
  const [selectedProv, setSelectedProv] = useState<ProvinceRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reqs: Promise<unknown>[] = [
      apiGet<DashboardData>('/api/dashboard'),
      apiGet<{ provinces: ProvinceRecord[] }>('/api/provinces'),
    ];
    if (can('tugas', 'view')) {
      reqs.push(apiGet<{ tasks: TaskRecord[] }>('/api/tasks').catch(() => ({ tasks: [] })));
    }
    Promise.all(reqs)
      .then(([dash, provRes, taskRes]) => {
        setData(dash as DashboardData);
        setProvinces((provRes as { provinces: ProvinceRecord[] }).provinces);
        if (taskRes) {
          const allTasks = (taskRes as { tasks: TaskRecord[] }).tasks || [];
          setTasksDue(
            allTasks
              .filter((t) => t.status !== 'selesai' && t.status !== 'dibatalkan')
              .sort((a, b) => a.deadline.localeCompare(b.deadline))
              .slice(0, 5)
          );
        }
      })
      .finally(() => setLoading(false));
  }, [can]);

  if (loading || !data || !user) {
    return <LoadingSkeleton rows={6} />;
  }

  const isCommandCenter = can('command_center', 'view');
  const formatMb = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(2)} MB`;

  const kpis = [
    {
      label: isCommandCenter ? 'Personel Terdaftar' : 'Profil & Personalia',
      value: data.summary.totalPersonnel,
      sub: `${data.summary.activeDuta} Duta aktif`,
      path: '/personalia',
    },
    {
      label: 'Provinsi Aktif',
      value: `${data.summary.activeProvinces}/${data.summary.totalProvinces}`,
      sub: 'Pemetaan nasional 38 provinsi',
      path: '/wilayah',
    },
    {
      label: 'Proposal Berjalan',
      value: data.summary.pendingProposals,
      sub: 'Menunggu keputusan / revisi',
      path: '/proposal',
    },
    {
      label: 'LKL & Tenggat Tugas',
      value: data.summary.pendingLkl,
      sub: `${data.summary.overdueTasks} tugas lewat tenggat · ${data.summary.unreadNotifications} notif baru`,
      path: '/laporan-kegiatan',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            {isCommandCenter ? 'National Command Center' : `Dashboard ${user.roleLabel}`}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Selamat bertugas, {user.fullName}{user.provinceName ? ` · Wilayah ${user.provinceName}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 no-print">
          {can('proposal', 'create') && (
            <button
              type="button"
              onClick={() => navigate('/proposal')}
              className="px-3.5 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Ajukan Proposal
            </button>
          )}
          {can('lkl', 'create') && (
            <button
              type="button"
              onClick={() => navigate('/laporan-kegiatan')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9] transition-colors whitespace-nowrap"
            >
              Kirim LKL
            </button>
          )}
          {can('tugas', 'create') && (
            <button
              type="button"
              onClick={() => navigate('/tugas')}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9] transition-colors whitespace-nowrap"
            >
              Buat Tugas
            </button>
          )}
          <button
            type="button"
            onClick={() => window.print()}
            aria-label="Cetak ringkasan dashboard"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-[#0EA5E9]"
          >
            <Printer className="w-3.5 h-3.5" /> Cetak
          </button>
        </div>
      </div>

      {/* First-Time Onboarding Walkthrough (Dismissible) */}
      {!onboardingDone && (
        <GlassCard className="p-5 border-sky-200 dark:border-sky-800/80">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3 flex-1">
              <div>
                <p className="text-xs font-semibold text-[#0EA5E9]">Panduan Memulai Portal SATU DPBI</p>
                <h2 className="text-base font-bold text-slate-900 dark:text-white mt-0.5">
                  Tiga Langkah Cepat untuk Peran {user.roleLabel}
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => navigate('/personalia')}
                  className="text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">01. Periksa Data Profil</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Pastikan identitas, sekolah, foto profil, dan status verifikasi Anda sudah mutakhir.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => navigate(can('proposal', 'view') ? '/proposal' : '/kalender')}
                  className="text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">02. Kelola Alur Kerja</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Ajukan atau tinjau Proposal, LKL, dan tenggat tugas melalui menu terstruktur di sidebar.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/pengaturan')}
                  className="text-left p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <p className="font-semibold text-slate-900 dark:text-white">03. Keamanan & Sesi</p>
                  <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Pantau perangkat aktif dan perbarui kata sandi akun secara berkala di Pengaturan.
                  </p>
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismissOnboarding}
              aria-label="Tutup panduan memulai"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </GlassCard>
      )}

      {/* Recently Viewed Quick Strip */}
      {recentlyViewed.length > 1 && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
          <span className="font-semibold text-slate-700 dark:text-slate-300 inline-flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-[#0EA5E9]" /> Terakhir dibuka:
          </span>
          {recentlyViewed.slice(0, 4).map((item, idx) => (
            <React.Fragment key={item.path}>
              {idx > 0 && <span aria-hidden="true">·</span>}
              <button
                type="button"
                onClick={() => navigate(item.path)}
                className="hover:text-[#0EA5E9] font-medium transition-colors"
              >
                {item.title}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* 4 Clickable KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <button
            key={kpi.label}
            type="button"
            onClick={() => navigate(kpi.path)}
            className="text-left glass-surface rounded-2xl p-5 hover:border-[#0EA5E9] transition-all group"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{kpi.label}</p>
              <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#0EA5E9] transition-colors" />
            </div>
            <p className="font-mono text-3xl font-bold text-slate-900 dark:text-white mt-2 tabular-nums">
              {kpi.value}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{kpi.sub}</p>
          </button>
        ))}
      </div>

      {/* Priority Attention Center + Tasks Due + Upcoming Agenda */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <GlassCard className="lg:col-span-5 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Pusat Perhatian</h2>
            </div>
            <span className="text-xs text-slate-500 tabular-nums">{data.attentionItems.length} item</span>
          </div>
          {data.attentionItems.length === 0 ? (
            <div className="py-6 text-center space-y-1">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 mx-auto" />
              <p className="text-xs text-slate-500">Seluruh proses administrasi berjalan tanpa tunggakan prioritas.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {data.attentionItems.map((item) => (
                <div key={item.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <StatusIndicator status={item.level} />
                      <span className="text-xs font-semibold text-slate-900 dark:text-white">{item.title}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{item.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(item.path)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0EA5E9] hover:text-white text-xs font-semibold shrink-0 transition-colors"
                  >
                    Buka
                  </button>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-4 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <ListTodo className="w-4 h-4 text-[#0EA5E9]" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Tugas & Tenggat Waktu</h2>
            </div>
            <button type="button" onClick={() => navigate('/tugas')} className="text-xs font-semibold text-[#0EA5E9] hover:underline">
              Semua Tugas
            </button>
          </div>
          {tasksDue.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">Tidak ada tugas aktif yang mendekati tenggat.</p>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {tasksDue.map((task) => {
                const isOverdue = task.deadline < new Date().toISOString().slice(0, 10);
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate('/tugas')}
                    className="w-full text-left py-2.5 hover:bg-slate-50/60 dark:hover:bg-slate-800/40 rounded-lg px-1 transition-colors"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{task.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      Prioritas {task.priority} · Tenggat{' '}
                      <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>
                        {formatTanggalIndonesia(task.deadline)}
                      </span>
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard className="lg:col-span-3 p-5 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200/70 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[#0EA5E9]" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">Agenda Mendatang</h2>
            </div>
            <button type="button" onClick={() => navigate('/kalender')} className="text-xs font-semibold text-[#0EA5E9] hover:underline">
              Kalender
            </button>
          </div>
          {data.upcomingEvents.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">Belum ada agenda terjadwal.</p>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {data.upcomingEvents.map((ev) => (
                <div key={ev.id} className="py-2.5">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white">{ev.title}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                    {ev.category} · {formatTanggalIndonesia(ev.startAt, true)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Interactive 38-Province Map (Shown for Command Center & Regional/National roles) */}
      {(isCommandCenter || can('wilayah', 'view')) && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                Peta Persebaran 38 Provinsi Indonesia
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Visualisasi status kepengurusan dan aktivitas wilayah secara terpadu.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/wilayah')}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-[#0EA5E9]"
            >
              <MapPin className="w-3.5 h-3.5 text-[#0EA5E9]" /> Kelola Daftar Wilayah
            </button>
          </div>

          <IndonesiaMap
            provinces={provinces}
            selectedCode={selectedProv?.code ?? null}
            onSelect={(prov) => setSelectedProv(prov)}
          />

          {selectedProv && (
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="space-y-1">
                <p className="text-sm font-bold text-slate-900 dark:text-white">
                  {selectedProv.name} ({selectedProv.island})
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  Koordinator: {selectedProv.coordinatorName || 'Belum ditetapkan'} · Catatan: {selectedProv.coachingNote || 'Tidak ada catatan khusus'}
                </p>
              </div>
              <div className="flex items-center gap-4 tabular-nums font-medium">
                <span><Users className="w-3.5 h-3.5 inline mr-1 text-[#0EA5E9]" />{selectedProv.activeDutaCount} Duta</span>
                <span><FileCheck2 className="w-3.5 h-3.5 inline mr-1 text-[#0EA5E9]" />{selectedProv.proposalCount} Proposal</span>
                <span>{selectedProv.lklCount} LKL</span>
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* Charts + Activity Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <GlassCard className="lg:col-span-6 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Aktivitas Proposal & LKL per Provinsi</h2>
            <span className="text-xs text-slate-500">Data langsung database</span>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts.topProvinceActivities} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#94a3b833" />
                <XAxis dataKey="provinceName" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="proposalCount" name="Proposal" fill="#0EA5E9" radius={[6, 6, 0, 0]} />
                <Bar dataKey="lklCount" name="LKL" fill="#38BDF8" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="lg:col-span-6 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Aktivitas Organisasi Terbaru</h2>
            <span className="text-xs text-slate-500 tabular-nums">
              Storage: {formatMb(data.summary.totalStorageBytes)}
            </span>
          </div>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 max-h-64 overflow-y-auto">
            {data.recentActivities.map((act) => (
              <div key={act.id} className="py-2.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{act.title}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">{act.description}</p>
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                    {act.category} · {act.actorName}{act.provinceName ? ` · ${act.provinceName}` : ''} · {formatTanggalIndonesia(act.createdAt, true)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(act.relatedPath)}
                  className="text-xs font-semibold text-[#0EA5E9] hover:underline shrink-0"
                >
                  Buka
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
