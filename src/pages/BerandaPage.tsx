import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  CheckSquare,
  Clock,
  Compass,
  FileCheck2,
  History,
  LifeBuoy,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import { formatTanggalIndonesia } from '../lib/rbac';
import type { PersonalWorkspacePayload } from '../lib/types';
import {
  EmptyState,
  ErrorView,
  GlassCard,
  PageContainer,
  PageHeader,
  Skeleton,
  StatusIndicator,
} from '../components/ui';

export function BerandaPage() {
  const { user, navigate, preferences, setTourOpen, setHelpDrawerOpen } = useAuth();
  const [data, setData] = useState<PersonalWorkspacePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorkspace = () => {
    setLoading(true);
    setError(null);
    apiGet<PersonalWorkspacePayload>('/api/beranda')
      .then((res) => setData(res))
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat Beranda Saya.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadWorkspace();
  }, [user?.id]);

  if (loading) {
    return (
      <PageContainer>
        <PageHeader title="Beranda Saya" description="Menyiapkan ruang kerja personal sesuai peran Anda..." />
        <Skeleton rows={6} />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <ErrorView
        code={500}
        message={error || 'Data Beranda Saya belum dapat dimuat.'}
        onRetry={loadWorkspace}
        onBack={() => navigate('/dashboard')}
        onReportIssue={() => navigate('/kendala?from=/beranda')}
      />
    );
  }

  const tourDone = user ? preferences.tourCompletedRoles.includes(user.role) : true;
  const totalAttentionCount =
    data.revisionsRequired.length + data.pendingApprovals.length + data.tasksToDo.length;

  return (
    <PageContainer>
      <PageHeader
        title={`Selamat Datang, ${data.identity.fullName}`}
        description={`${data.identity.roleLabel} · ${data.identity.positionTitle} · Wilayah ${data.identity.provinceName}${
          data.identity.batchName ? ` · ${data.identity.batchName}` : ''
        }${data.identity.memberNumber ? ` · No. Anggota ${data.identity.memberNumber}` : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9]"
            >
              <Compass className="w-3.5 h-3.5 text-[#0EA5E9]" />
              <span>Tur Panduan Peran</span>
            </button>
            <button
              type="button"
              onClick={() => setHelpDrawerOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9]"
            >
              <LifeBuoy className="w-3.5 h-3.5 text-slate-500" />
              <span>Panduan Halaman</span>
            </button>
          </div>
        }
      />

      {/* Non-blocking Role Tour Invitation */}
      {!tourDone && (
        <GlassCard className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-sky-50/70 dark:bg-sky-950/30 border-sky-200 dark:border-sky-800">
          <div className="flex items-start gap-3">
            <Compass className="w-5 h-5 text-[#0EA5E9] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-xs font-bold text-slate-900 dark:text-white">
                Baru menggunakan ruang kerja {data.identity.roleLabel}?
              </p>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Ikuti tur singkat 1 menit untuk mengenal tugas utama, alur pengajuan, dan pintasan navigasi Anda.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold whitespace-nowrap shrink-0"
          >
            Mulai Tur Sekarang
          </button>
        </GlassCard>
      )}

      {/* Priority Summary Strip (Clean Single-Elevation Metrics) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tugas Aktif Anda</p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {data.tasksToDo.length}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Perlu diselesaikan</p>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Revisi Diperlukan</p>
          <p
            className={`font-mono text-2xl font-bold tabular-nums mt-1 ${
              data.revisionsRequired.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
            }`}
          >
            {data.revisionsRequired.length}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">Proposal / LKL dikembalikan</p>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Persetujuan Menunggu</p>
          <p className="font-mono text-2xl font-bold text-[#0EA5E9] tabular-nums mt-1">
            {data.pendingApprovals.length}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {data.pendingApprovals.some((a) => a.isOverdue)
              ? 'Ada berkas melewati SLA'
              : 'Antrean sesuai kewenangan'}
          </p>
        </GlassCard>

        <GlassCard className="p-4">
          <p className="text-xs text-slate-500 dark:text-slate-400">Tenggat Terdekat</p>
          <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
            {data.nearestDeadlines.length}
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            {totalAttentionCount === 0 ? 'Semua terkendali' : 'Terjadwal dalam antrean'}
          </p>
        </GlassCard>
      </div>

      {/* Role-Specific Quick Action Shortcuts */}
      <GlassCard className="p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 dark:text-white">
            <Sparkles className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
            <span>Pintasan Aksi Utama ({data.identity.roleLabel})</span>
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Disesuaikan dengan kewenangan peran
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.quickActions.map((act) => (
            <button
              key={act.path}
              type="button"
              onClick={() => navigate(act.path)}
              className={`text-left p-3.5 rounded-xl border transition-colors flex flex-col justify-between gap-2 ${
                act.primary
                  ? 'border-[#0EA5E9] bg-[#0EA5E9] text-white hover:bg-sky-600'
                  : 'border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 hover:border-[#0EA5E9]'
              }`}
            >
              <div>
                <p className={`text-xs font-bold ${act.primary ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                  {act.label}
                </p>
                <p
                  className={`text-[11px] mt-0.5 leading-snug ${
                    act.primary ? 'text-sky-50' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {act.description}
                </p>
              </div>
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                  act.primary ? 'text-white' : 'text-[#0EA5E9]'
                }`}
              >
                <span>Buka</span>
                <ArrowRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* Revisions Required & Pending Approvals */}
      {(data.revisionsRequired.length > 0 || data.pendingApprovals.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {data.revisionsRequired.length > 0 && (
            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <h2>Revisi yang Harus Diselesaikan</h2>
                </div>
                <span className="font-mono text-xs font-bold text-amber-600 tabular-nums">
                  {data.revisionsRequired.length} item
                </span>
              </div>
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.revisionsRequired.map((rev) => (
                  <div key={`${rev.type}-${rev.id}`} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {rev.type === 'proposal' ? 'Proposal' : 'LKL'} · {rev.referenceNumber}
                      </p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{rev.title}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">{rev.note}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(rev.targetPath)}
                      className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                    >
                      Perbaiki
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}

          {data.pendingApprovals.length > 0 && (
            <GlassCard className="p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                  <CheckCircle2 className="w-4 h-4 text-[#0EA5E9] shrink-0" aria-hidden="true" />
                  <h2>Persetujuan Menunggu Keputusan</h2>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/persetujuan')}
                  className="text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap"
                >
                  Lihat Semua
                </button>
              </div>
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.pendingApprovals.map((app) => (
                  <div key={`${app.itemType}-${app.id}`} className="py-3 first:pt-0 last:pb-0 flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {app.referenceNumber} · {app.applicantName}
                        {app.provinceName ? ` · ${app.provinceName}` : ''}
                      </p>
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{app.title}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <StatusIndicator status={app.status} />
                        {app.isOverdue && (
                          <span className="font-semibold text-rose-600 dark:text-rose-400">Melewati SLA</span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(app.targetPath)}
                      className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] hover:bg-sky-600 text-white text-[11px] font-semibold whitespace-nowrap shrink-0"
                    >
                      Tinjau
                    </button>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      )}

      {/* Main Operational Two-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left: Tasks + Submissions */}
        <div className="lg:col-span-7 space-y-5">
          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <CheckSquare className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
                <h2>Tugas yang Harus Dikerjakan</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/tugas-saya')}
                className="text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap"
              >
                Buka Tugas Saya
              </button>
            </div>
            {data.tasksToDo.length === 0 ? (
              <EmptyState
                title="Tidak ada tugas tertunda"
                description="Semua tugas Anda saat ini sudah selesai atau belum ada penugasan baru."
              />
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.tasksToDo.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => navigate(`/tugas/${task.id}`)}
                    className="w-full text-left py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 hover:opacity-85 transition-opacity"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {task.referenceNumber} · Prioritas {task.priority}
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {task.title}
                      </p>
                    </div>
                    <div className="text-right shrink-0 space-y-0.5">
                      <StatusIndicator status={task.status} />
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                        {formatTanggalIndonesia(task.deadline)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </GlassCard>

          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <FileCheck2 className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
                <h2>Pengajuan Saya yang Membutuhkan Tindakan</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/proposal')}
                className="text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap"
              >
                Kelola Proposal
              </button>
            </div>
            {data.submissionsNeedingAction.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-3">
                Belum ada draf atau pengajuan berjalan milik Anda.
              </p>
            ) : (
              <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.submissionsNeedingAction.map((sub) => (
                  <button
                    key={`${sub.type}-${sub.id}`}
                    type="button"
                    onClick={() => navigate(sub.targetPath)}
                    className="w-full text-left py-2.5 first:pt-0 last:pb-0 flex items-center justify-between gap-3 hover:opacity-85"
                  >
                    <div className="min-w-0">
                      <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                        {sub.type === 'proposal' ? 'Proposal' : 'LKL'} · {sub.referenceNumber}
                      </p>
                      <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {sub.title}
                      </p>
                    </div>
                    <StatusIndicator status={sub.status} />
                  </button>
                ))}
              </div>
            )}
          </GlassCard>
        </div>

        {/* Right: Nearest Deadlines, Events, Notifications & Activity */}
        <div className="lg:col-span-5 space-y-5">
          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
              <Clock className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
              <h2>Tenggat Terdekat</h2>
            </div>
            {data.nearestDeadlines.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada tenggat mendesak.</p>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.nearestDeadlines.map((dl) => (
                  <li key={dl.id} className="py-2 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => navigate(dl.targetPath)}
                      className="w-full text-left flex items-center justify-between gap-3 hover:text-[#0EA5E9]"
                    >
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">{dl.kind}</p>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{dl.title}</p>
                      </div>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-slate-300 tabular-nums shrink-0">
                        {formatTanggalIndonesia(dl.dueAt)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Calendar className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
                <h2>Jadwal Kegiatan Mendatang</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/kalender')}
                className="text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap"
              >
                Kalender
              </button>
            </div>
            {data.upcomingEvents.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada jadwal terdekat.</p>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.upcomingEvents.map((ev) => (
                  <li key={ev.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                    <p className="font-semibold text-slate-900 dark:text-white">{ev.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
                      {formatTanggalIndonesia(ev.startAt)} · {ev.location}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <Bell className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
                <h2>Notifikasi Penting</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/notifikasi')}
                className="text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap"
              >
                Semua
              </button>
            </div>
            {data.importantNotifications.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada notifikasi baru.</p>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.importantNotifications.slice(0, 4).map((n) => (
                  <li key={n.id} className="py-2 first:pt-0 last:pb-0">
                    <button
                      type="button"
                      onClick={() => navigate(n.targetPath || '/notifikasi')}
                      className="w-full text-left"
                    >
                      <p className={`text-xs ${n.isRead ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                        {n.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>

          <GlassCard className="p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900 dark:text-white">
                <History className="w-4 h-4 text-[#0EA5E9]" aria-hidden="true" />
                <h2>Aktivitas Terakhir Anda</h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/aktivitas-saya')}
                className="text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap"
              >
                Riwayat
              </button>
            </div>
            {data.recentActivity.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Belum ada aktivitas tercatat.</p>
            ) : (
              <ul className="divide-y divide-slate-200/80 dark:divide-slate-800">
                {data.recentActivity.slice(0, 5).map((act) => (
                  <li key={act.id} className="py-2 first:pt-0 last:pb-0 text-xs flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {act.action.replace(/_/g, ' ')}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {act.contextNote || `${act.targetType} · ${act.targetId}`}
                      </p>
                    </div>
                    <span className="font-mono text-[10px] text-slate-400 tabular-nums shrink-0">
                      {formatTanggalIndonesia(act.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      </div>
    </PageContainer>
  );
}
