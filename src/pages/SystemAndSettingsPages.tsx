import React, { useEffect, useState } from 'react';
import {
  Activity,
  Building2,
  CheckCircle2,
  DatabaseBackup,
  Download,
  HardDrive,
  Hash,
  KeyRound,
  Laptop,
  Play,
  Plus,
  RefreshCw,
  Save,
  Shield,
  SlidersHorizontal,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import { apiDelete, apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { INDONESIA_PROVINCES } from '../lib/provinces';
import {
  ConfirmDialog,
  EmptyState,
  GlassCard,
  LoadingSkeleton,
  Modal,
  StatusIndicator,
} from '../components/ui/Primitives';
import { BASE_ROLE_PERMISSIONS, formatTanggalIndonesia, ROLE_LABELS } from '../lib/rbac';
import type { ModuleCode, RoleCode } from '../lib/types';

export function SystemAdminPage() {
  const { can, notify } = useAuth();
  const [tab, setTab] = useState<
    'storage' | 'backup' | 'kualitas' | 'kesehatan' | 'otomatisasi' | 'kemendikdasmen' | 'audit' | 'timeline'
  >('storage');
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [restoreConfirmOpen, setRestoreConfirmOpen] = useState<string | null>(null);
  const [restoreChecked, setRestoreChecked] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet('/api/system/overview')
      .then(setData)
      .catch((err) => notify(err instanceof Error ? err.message : 'Gagal memuat ikhtisar sistem.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const handleBackup = async () => {
    try {
      const res = await apiPost<{ backupName: string }>('/api/system/backup');
      notify(`Backup ${res.backupName} berhasil dibuat & diverifikasi SHA-256.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Backup gagal.', 'error');
    }
  };

  const handleValidateBackup = async (id: string) => {
    try {
      const res = await apiPost<{ valid: boolean }>(`/api/system/backup/${id}/validate`);
      notify(
        res.valid ? 'Integritas SHA-256 arsip backup VALID.' : 'Integritas arsip backup GAGAL!',
        res.valid ? 'success' : 'error'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Validasi gagal.', 'error');
    }
  };

  const handleRestore = async () => {
    if (!restoreConfirmOpen || !restoreChecked) return;
    try {
      const res = await apiPost<{ message: string }>(`/api/system/backup/${restoreConfirmOpen}/restore`, {
        confirmed: true,
      });
      notify(res.message, 'success');
      setRestoreConfirmOpen(null);
      setRestoreChecked(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Pemulihan gagal.', 'error');
    }
  };

  const toggleJob = async (id: string) => {
    try {
      await apiPost(`/api/system/automation/${id}/toggle`);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengubah status otomatisasi.', 'error');
    }
  };

  const runJob = async (id: string) => {
    try {
      const res = await apiPost<{ message: string }>(`/api/system/automation/${id}/run`);
      notify(res.message, 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menjalankan otomatisasi.', 'error');
    }
  };

  if (loading || !data) return <LoadingSkeleton rows={6} />;

  const pct = data.storage.percentUsed;
  const alertLevel = pct >= 95 ? 'kritis' : pct >= 85 ? 'peringatan' : pct >= 70 ? 'info' : 'sehat';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Pusat Kendali Sistem, Storage & Audit
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Monitoring kapasitas penyimpanan, backup & pemulihan tervalidasi, kualitas data, otomatisasi, integrasi pendidikan, dan Audit Log.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
        </button>
      </div>

      <div className="flex flex-wrap p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
        {[
          ['storage', 'Storage Control'],
          ['backup', 'Backup & Restore'],
          ['kualitas', 'Data Quality'],
          ['kesehatan', 'System Health'],
          ['otomatisasi', 'Automation Center'],
          ['kemendikdasmen', 'Integrasi Kemendikdasmen'],
          ['audit', 'Audit Log'],
          ['timeline', 'Activity Timeline'],
        ].map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k as typeof tab)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              tab === k ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {tab === 'storage' && (
        <div className="space-y-4">
          <GlassCard className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-[#0EA5E9]" />
                <h2 className="text-base font-bold">Kapasitas Penyimpanan Privat & Database</h2>
              </div>
              <StatusIndicator status={alertLevel} customLabel={`${pct}% Terpakai`} />
            </div>
            <div className="w-full h-3 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div className="h-full bg-[#0EA5E9] transition-all" style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs tabular-nums">
              <div><p className="text-slate-500">Kuota Total</p><p className="font-mono font-bold text-base">{(data.storage.quotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB</p></div>
              <div><p className="text-slate-500">Total Berkas Privat</p><p className="font-mono font-bold text-base">{(data.storage.usedFilesBytes / 1024).toFixed(1)} KB ({data.storage.fileCount} file)</p></div>
              <div><p className="text-slate-500">Ukuran Database</p><p className="font-mono font-bold text-base">{(data.storage.dbSizeBytes / 1024).toFixed(1)} KB</p></div>
              <div><p className="text-slate-500">Ambang Peringatan</p><p className="font-mono font-bold text-base">70% / 85% / 95%</p></div>
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-3 text-xs">
            <h3 className="font-bold text-sm">Berkas Terbesar di Penyimpanan Privat (Deduplikasi SHA-256 Aktif)</h3>
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {data.storage.largestFiles.map((f: any) => (
                <div key={f.id} className="py-2 flex items-center justify-between gap-4">
                  <span className="truncate font-medium">{f.original_name} ({f.module})</span>
                  <span className="font-mono tabular-nums text-slate-500">{(f.size_bytes / 1024).toFixed(1)} KB</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      {tab === 'backup' && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <DatabaseBackup className="w-4 h-4 text-[#0EA5E9]" /> Manajemen Backup & Pemulihan
              </h2>
              <p className="text-xs text-slate-500">
                Salinan database & berkas privat dikemas dalam arsip ZIP dengan checksum SHA-256.
              </p>
            </div>
            {can('sistem', 'manage') && (
              <button type="button" onClick={handleBackup} className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
                Buat Backup Sekarang
              </button>
            )}
          </div>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
            {data.backups.length === 0 ? (
              <p className="py-6 text-center text-slate-500">Belum ada arsip backup. Klik "Buat Backup Sekarang" untuk membuat snapshot pertama.</p>
            ) : (
              data.backups.map((b: any) => (
                <div key={b.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono font-semibold text-slate-900 dark:text-white">{b.backup_name}</p>
                    <p className="text-slate-500 tabular-nums">{(b.size_bytes / 1024).toFixed(1)} KB · {formatTanggalIndonesia(b.created_at, true)} · Oleh {b.created_by}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={() => handleValidateBackup(b.id)} className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold">
                      Validasi SHA-256
                    </button>
                    <a href={`/api/system/backup/${b.id}/download`} className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-[#0EA5E9] font-semibold">
                      <Download className="w-3.5 h-3.5" /> Unduh ZIP
                    </a>
                    {can('sistem', 'restore') && (
                      <button type="button" onClick={() => setRestoreConfirmOpen(b.id)} className="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white font-semibold">
                        Restore
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      )}

      {tab === 'kualitas' && (
        <GlassCard className="p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold">Data Quality Center (Rekomendasi Tindak Lanjut — Tidak Menghapus Otomatis)</h2>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {data.findings.length === 0 ? (
              <p className="py-4 text-emerald-600 font-semibold">Tidak ada anomali kualitas data yang terdeteksi.</p>
            ) : (
              data.findings.map((f: any) => (
                <div key={f.id} className="py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {f.type} <span className="text-slate-400">({f.severity})</span>
                    </p>
                    <p className="text-slate-500 mt-0.5">{f.detail}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>
      )}

      {tab === 'kesehatan' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <GlassCard className="p-5 space-y-1">
            <Activity className="w-5 h-5 text-emerald-500" />
            <p className="font-bold text-sm mt-2">Database SQLite WAL</p>
            <StatusIndicator status={data.health.database} />
          </GlassCard>
          <GlassCard className="p-5 space-y-1">
            <Shield className="w-5 h-5 text-emerald-500" />
            <p className="font-bold text-sm mt-2">Autentikasi & RBAC Server</p>
            <StatusIndicator status={data.health.authSessionEngine} />
          </GlassCard>
          <GlassCard className="p-5 space-y-1">
            <CheckCircle2 className="w-5 h-5 text-[#0EA5E9]" />
            <p className="font-bold text-sm mt-2">Uptime Layanan</p>
            <p className="font-mono text-lg font-bold tabular-nums">{data.health.uptimeSeconds} detik</p>
          </GlassCard>
        </div>
      )}

      {tab === 'otomatisasi' && (
        <GlassCard className="p-5 divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
          {data.automationJobs.map((j: any) => (
            <div key={j.id} className="py-3 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-bold text-sm">{j.name}</p>
                <p className="text-slate-500">Jadwal: {j.schedule_label} · Terakhir: {j.last_message}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => toggleJob(j.id)} className={`px-3 py-1.5 rounded-lg font-semibold ${j.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 dark:bg-slate-800'}`}>
                  {j.enabled ? 'Aktif' : 'Nonaktif'}
                </button>
                <button type="button" onClick={() => runJob(j.id)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold">
                  <Play className="w-3.5 h-3.5" /> Jalankan
                </button>
              </div>
            </div>
          ))}
        </GlassCard>
      )}

      {tab === 'kemendikdasmen' && (
        <GlassCard className="p-6 space-y-3 text-xs">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Modul Integrasi Data Pendidikan Kemendikdasmen
            </h2>
            <StatusIndicator status="nonaktif" customLabel="Nonaktif (Menunggu Akses Resmi)" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            Sesuai kebijakan tata kelola dan kepatuhan hukum data pribadi peserta didik, modul integrasi Kemendikdasmen sengaja berada dalam status <strong>Nonaktif</strong> hingga terdapat perjanjian kerja sama resmi, surat permohonan yang disetujui, dan kredensial API resmi.
          </p>
          <p className="text-slate-500">
            <strong>Fallback Aktif Saat Ini:</strong> Pengisian data sekolah dan pencocokan NPSN dilakukan secara manual serta diverifikasi oleh Sekretariat Nasional tanpa melakukan scraping tidak sah maupun pengambilan data siswa massal.
          </p>
        </GlassCard>
      )}

      {tab === 'audit' && (
        <GlassCard className="p-5">
          <h2 className="text-sm font-bold mb-3">Audit Log Keamanan (Tindakan Sensitif)</h2>
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Waktu</th>
                  <th className="py-2 pr-4">Aktor</th>
                  <th className="py-2 pr-4">Aksi</th>
                  <th className="py-2 pr-4">Objek</th>
                  <th className="py-2">Keterangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                {data.auditLogs.map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-2.5 pr-4 font-mono">{formatTanggalIndonesia(a.created_at, true)}</td>
                    <td className="py-2.5 pr-4">{a.actor_name} ({a.actor_role})</td>
                    <td className="py-2.5 pr-4 font-mono font-semibold text-[#0EA5E9]">{a.action}</td>
                    <td className="py-2.5 pr-4 font-mono">{a.target_type}:{a.target_id}</td>
                    <td className="py-2.5 text-slate-500">{a.context_note || a.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs tabular-nums">
            {data.auditLogs.map((a: any) => (
              <div key={a.id} className="py-3 space-y-1">
                <p className="font-mono font-semibold text-[#0EA5E9]">{a.action}</p>
                <p className="font-semibold text-slate-900 dark:text-white">{a.actor_name} ({a.actor_role})</p>
                <p className="text-[11px] text-slate-500">{formatTanggalIndonesia(a.created_at, true)} · {a.target_type}:{a.target_id}</p>
                {a.context_note && <p className="text-slate-600 dark:text-slate-400">{a.context_note}</p>}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === 'timeline' && (
        <GlassCard className="p-5 divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
          {data.timeline.map((t: any) => (
            <div key={t.id} className="py-3">
              <p className="font-bold text-slate-900 dark:text-white">{t.title}</p>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5">{t.description}</p>
              <p className="text-[11px] text-slate-400 mt-1 tabular-nums">
                {t.category} · {t.actor_name} · {formatTanggalIndonesia(t.created_at, true)}
              </p>
            </div>
          ))}
        </GlassCard>
      )}

      <Modal open={Boolean(restoreConfirmOpen)} onClose={() => setRestoreConfirmOpen(null)} title="Konfirmasi Pemulihan Database (Restore)">
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300">
            Pemulihan akan mengganti basis data aktif dengan salinan dari arsip backup setelah validasi SHA-256 berhasil. Pastikan Anda telah mengunduh backup terkini sebelum melanjutkan.
          </p>
          <label className="flex items-center gap-2 font-semibold">
            <input type="checkbox" checked={restoreChecked} onChange={(e) => setRestoreChecked(e.target.checked)} />
            <span>Saya memahami dan mengonfirmasi pemulihan database ini.</span>
          </label>
          <button
            type="button"
            disabled={!restoreChecked}
            onClick={handleRestore}
            className="px-4 py-2 rounded-xl bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            Jalankan Pemulihan
          </button>
        </div>
      </Modal>
    </div>
  );
}

const MODULE_LABELS: Record<ModuleCode, string> = {
  dashboard: 'Dashboard',
  command_center: 'Executive View',
  organisasi: 'Struktur & Delegasi',
  personalia: 'Personalia Duta',
  wilayah: 'Wilayah (38 Prov)',
  angkatan: 'Angkatan',
  proposal: 'Proposal',
  lkl: 'LKL Kegiatan',
  laporan_koordinator: 'Lap. Koordinator',
  tugas: 'Tugas',
  dokumen: 'Dokumen & SOP',
  pengumuman: 'Pengumuman',
  kalender: 'Kalender',
  perlindungan: 'Safeguarding',
  evaluasi: 'Evaluasi Kinerja',
  arsip: 'Arsip & Ekspor',
  sistem: 'Pusat Kendali Sistem',
  pengaturan: 'Pengaturan',
};

export function SettingsPage() {
  const { user, can, theme, toggleTheme, notify, logout, refreshUser, navigate } = useAuth();
  const [tab, setTab] = useState<'profil' | 'keamanan' | 'sesi' | 'tampilan' | 'pengguna' | 'rbac' | 'sistem'>('profil');

  const [sessions, setSessions] = useState<any[]>([]);
  const [loginLogs, setLoginLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [config, setConfig] = useState<{ settings: Record<string, string>; sequences: any[] }>({
    settings: {},
    sequences: [],
  });
  const [loading, setLoading] = useState(true);

  // Profile & notification prefs
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [notifPrefs, setNotifPrefs] = useState({
    emailProposal: true,
    emailTugas: true,
    pengingatSesi: true,
  });

  // Change password
  const [pwdForm, setPwdForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  // User modal & confirmation
  const [createUserOpen, setCreateUserOpen] = useState(false);
  const [userForm, setUserForm] = useState({
    fullName: '',
    email: '',
    password: '',
    role: 'duta' as RoleCode,
    provinceCode: '32',
    bidang: 'Kebudayaan',
  });
  const [confirmToggleUser, setConfirmToggleUser] = useState<{ id: string; name: string; next: string } | null>(null);
  const [confirmRevokeAll, setConfirmRevokeAll] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [sRes, hRes, cRes] = await Promise.all([
        apiGet<{ sessions: any[] }>('/api/auth/sessions'),
        apiGet<{ logs: any[] }>('/api/auth/login-history'),
        apiGet<{ settings: Record<string, string>; sequences: any[] }>('/api/settings/config'),
      ]);
      setSessions(sRes.sessions);
      setLoginLogs(hRes.logs);
      setConfig(cRes);
      if (can('pengaturan', 'manage')) {
        const uRes = await apiGet<{ users: any[] }>('/api/settings/users');
        setUsers(uRes.users);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat pengaturan.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (user?.fullName) setFullName(user.fullName);
  }, [user?.fullName]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPatch('/api/auth/profile', { fullName, notificationPrefs: notifPrefs });
      await refreshUser();
      notify('Profil dan preferensi notifikasi disimpan.', 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan profil.', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwdForm.newPassword !== pwdForm.confirmPassword) {
      notify('Konfirmasi kata sandi baru tidak cocok.', 'error');
      return;
    }
    try {
      const res = await apiPost<{ message: string }>('/api/auth/change-password', {
        currentPassword: pwdForm.currentPassword,
        newPassword: pwdForm.newPassword,
      });
      notify(res.message || 'Kata sandi diperbarui.', 'success');
      setPwdForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperbarui kata sandi.', 'error');
    }
  };

  const revokeSingleSession = async (sessionId: string) => {
    try {
      const res = await apiDelete<{ revokedCurrent: boolean }>(`/api/auth/sessions/${sessionId}`);
      if (res.revokedCurrent) {
        await logout();
        return;
      }
      notify('Sesi perangkat dihentikan.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menghentikan sesi.', 'error');
    }
  };

  const revokeAll = async () => {
    await apiPost('/api/auth/sessions/revoke-all');
    setConfirmRevokeAll(false);
    await logout();
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/settings/users', userForm);
      notify('Akun pengguna baru berhasil dibuat.', 'success');
      setCreateUserOpen(false);
      setUserForm({ fullName: '', email: '', password: '', role: 'duta', provinceCode: '32', bidang: 'Kebudayaan' });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal membuat akun.', 'error');
    }
  };

  const confirmStatusChange = async () => {
    if (!confirmToggleUser) return;
    try {
      await apiPatch(`/api/settings/users/${confirmToggleUser.id}/status`, {
        accountStatus: confirmToggleUser.next,
      });
      notify(`Status akun ${confirmToggleUser.name} diubah menjadi ${confirmToggleUser.next} & seluruh sesinya dicabut.`, 'info');
      setConfirmToggleUser(null);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengubah status akun.', 'error');
    }
  };

  const handleSaveSystemConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPatch('/api/system/settings', { settings: config.settings });
      notify('Konfigurasi organisasi dan kebijakan sesi disimpan.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan konfigurasi.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  const settingsTabs = [
    { key: 'profil', label: 'Profil & Notifikasi', icon: UserCheck },
    { key: 'keamanan', label: 'Ubah Password', icon: KeyRound },
    { key: 'sesi', label: `Perangkat & Sesi (${sessions.length})`, icon: Laptop },
    { key: 'tampilan', label: 'Tampilan', icon: SlidersHorizontal },
    ...(can('pengaturan', 'manage') ? [{ key: 'pengguna', label: `Pengguna (${users.length})`, icon: Users }] : []),
    { key: 'rbac', label: 'Peran & Hak Akses', icon: Shield },
    { key: 'sistem', label: 'Organisasi, Penomoran & Sistem', icon: Building2 },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
          Pengaturan Akun, Keamanan Sesi & Konfigurasi
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kelola profil pribadi, kata sandi, perangkat aktif, preferensi notifikasi, peran RBAC, dan penomoran dokumen nasional.
        </p>
      </div>

      {/* Tab Bar */}
      <div className="flex flex-wrap p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
        {settingsTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key as typeof tab)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
                tab === t.key
                  ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              <Icon className="w-3.5 h-3.5 text-[#0EA5E9]" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === 'profil' && (
        <GlassCard className="p-6 max-w-2xl">
          <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Profil Pribadi & Preferensi Notifikasi</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold mb-1">Nama Lengkap *</label>
                <input
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Email Resmi</label>
                <input
                  disabled
                  value={user?.email || ''}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-sm text-slate-500"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Peran Sistem</label>
                <input
                  disabled
                  value={user?.roleLabel || ''}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-slate-500"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Wilayah Penugasan</label>
                <input
                  disabled
                  value={user?.provinceName || 'Nasional'}
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-slate-500"
                />
              </div>
            </div>

            <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2">
              <p className="font-bold text-slate-800 dark:text-slate-200">Preferensi Notifikasi Portal</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.emailProposal}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, emailProposal: e.target.checked })}
                />
                <span>Pemberitahuan keputusan Proposal & revisi LKL</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.emailTugas}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, emailTugas: e.target.checked })}
                />
                <span>Pengingat tugas baru & tenggat H-3</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifPrefs.pengingatSesi}
                  onChange={(e) => setNotifPrefs({ ...notifPrefs, pengingatSesi: e.target.checked })}
                />
                <span>Tampilkan peringatan sebelum sesi kedaluwarsa karena tidak aktif</span>
              </label>
            </div>

            <div className="pt-2 flex justify-end">
              <button type="submit" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white font-semibold">
                <Save className="w-4 h-4" /> Simpan Profil & Preferensi
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {tab === 'keamanan' && (
        <GlassCard className="p-6 max-w-xl">
          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Ubah Kata Sandi & Rotasi Sesi</h2>
            <p className="text-slate-500">
              Demi keamanan organisasi, perubahan kata sandi akan langsung merotasi ID sesi aktif Anda dan mengakhiri sesi di seluruh perangkat lain.
            </p>
            <div>
              <label className="block font-semibold mb-1">Kata Sandi Saat Ini *</label>
              <input
                type="password"
                required
                value={pwdForm.currentPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, currentPassword: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Kata Sandi Baru (Minimal 8 karakter) *</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwdForm.newPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, newPassword: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Konfirmasi Kata Sandi Baru *</label>
              <input
                type="password"
                required
                minLength={8}
                value={pwdForm.confirmPassword}
                onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="pt-2 flex justify-end">
              <button type="submit" className="px-4 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white font-semibold">
                Perbarui Kata Sandi
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {tab === 'sesi' && (
        <div className="space-y-6">
          <GlassCard className="p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                  <Laptop className="w-4 h-4 text-[#0EA5E9]" /> Perangkat & Sesi Aktif ({sessions.length})
                </h2>
                <p className="text-xs text-slate-500">Login sebagai {user?.email} ({user?.roleLabel})</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmRevokeAll(true)}
                className="px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Keluar dari Seluruh Perangkat
              </button>
            </div>
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
              {sessions.map((s) => (
                <div key={s.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-white">
                      {s.deviceLabel} {s.isCurrent ? '— Sesi Perangkat Ini' : ''}
                    </p>
                    <p className="text-slate-500 font-mono text-[11px] tabular-nums">
                      IP: {s.ipAddress} · Terakhir aktif: {formatTanggalIndonesia(s.lastSeenAt, true)} · Kedaluwarsa: {formatTanggalIndonesia(s.expiresAt, true)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusIndicator status="aktif" />
                    <button
                      type="button"
                      onClick={() => revokeSingleSession(s.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Akhiri
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Riwayat Aktivitas Autentikasi</h2>
            {loginLogs.length === 0 ? (
              <EmptyState title="Belum ada riwayat login" description="Catatan login, perubahan sandi, dan penghentian sesi akan direkam di sini." />
            ) : (
              <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs tabular-nums">
                {loginLogs.map((l) => (
                  <div key={l.id} className="py-2.5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-mono font-semibold text-[#0EA5E9]">{l.action}</p>
                      <p className="text-slate-500">{l.context_note || l.outcome}</p>
                    </div>
                    <span className="font-mono text-slate-500">{formatTanggalIndonesia(l.created_at, true)}</span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>
        </div>
      )}

      {tab === 'tampilan' && (
        <GlassCard className="p-6 max-w-xl space-y-4 text-xs">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Preferensi Tema Antarmuka</h2>
          <p className="text-slate-500">
            Pilih tema yang paling nyaman digunakan dalam jangka waktu lama. Pengaturan diterapkan konsisten di seluruh halaman.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => theme === 'dark' && toggleTheme()}
              className={`p-4 rounded-xl border text-left transition-all ${
                theme === 'light'
                  ? 'border-[#0EA5E9] bg-sky-50/60 dark:bg-sky-950/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <p className="font-bold text-sm text-slate-900 dark:text-white">Mode Terang (Light)</p>
              <p className="text-slate-500 mt-1">Latar bersih #F1F5F9 dengan permukaan putih lembut untuk pencahayaan siang hari.</p>
            </button>
            <button
              type="button"
              onClick={() => theme === 'light' && toggleTheme()}
              className={`p-4 rounded-xl border text-left transition-all ${
                theme === 'dark'
                  ? 'border-[#0EA5E9] bg-sky-50/60 dark:bg-sky-950/30'
                  : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <p className="font-bold text-sm text-slate-900 dark:text-white">Mode Gelap (Dark)</p>
              <p className="text-slate-500 mt-1">Latar slate gelap kontras tinggi untuk mengurangi silau pada ruang redup.</p>
            </button>
          </div>
        </GlassCard>
      )}

      {tab === 'pengguna' && can('pengaturan', 'manage') && (
        <GlassCard className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-bold">Pengelolaan Akun & Role Sistem ({users.length})</h2>
            <button
              type="button"
              onClick={() => setCreateUserOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Buat Akun Langsung
            </button>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-4">Nama & Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Wilayah</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 text-right">Kontrol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-2.5 pr-4">
                      <p className="font-semibold text-slate-900 dark:text-white">{u.fullName}</p>
                      <p className="text-[11px] text-slate-500">{u.email}</p>
                    </td>
                    <td className="py-2.5 pr-4">{u.roleLabel}</td>
                    <td className="py-2.5 pr-4">{u.provinceName || 'Nasional'}</td>
                    <td className="py-2.5 pr-4"><StatusIndicator status={u.accountStatus} /></td>
                    <td className="py-2.5 text-right">
                      {u.id !== user?.id && (
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmToggleUser({
                              id: u.id,
                              name: u.fullName,
                              next: u.accountStatus === 'aktif' ? 'nonaktif' : 'aktif',
                            })
                          }
                          className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                        >
                          {u.accountStatus === 'aktif' ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
            {users.map((u) => (
              <div key={u.id} className="py-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">{u.fullName}</p>
                    <p className="text-[11px] text-slate-500">{u.email}</p>
                    <p className="text-[11px] text-slate-500">{u.roleLabel} · {u.provinceName || 'Nasional'}</p>
                  </div>
                  <StatusIndicator status={u.accountStatus} />
                </div>
                {u.id !== user?.id && (
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmToggleUser({
                        id: u.id,
                        name: u.fullName,
                        next: u.accountStatus === 'aktif' ? 'nonaktif' : 'aktif',
                      })
                    }
                    className="w-full min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                  >
                    {u.accountStatus === 'aktif' ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {tab === 'rbac' && (
        <GlassCard className="p-5 space-y-3">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">Matriks Peran & Hak Akses RBAC Nasional</h2>
            <p className="text-xs text-slate-500">
              Menampilkan hak akses dasar setiap peran pada 18 modul SATU DPBI. Perubahan otoritas sementara dapat diberikan melalui Delegasi di halaman Organisasi.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                <tr>
                  <th className="py-2 pr-3">Modul</th>
                  {(Object.keys(ROLE_LABELS) as RoleCode[]).map((rc) => (
                    <th key={rc} className="py-2 px-2 whitespace-nowrap">{ROLE_LABELS[rc].split(' ')[0]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                {(Object.keys(MODULE_LABELS) as ModuleCode[]).map((mod) => (
                  <tr key={mod}>
                    <td className="py-2 pr-3 font-semibold text-slate-800 dark:text-slate-200 whitespace-nowrap">{MODULE_LABELS[mod]}</td>
                    {(Object.keys(ROLE_LABELS) as RoleCode[]).map((rc) => {
                      const acts = BASE_ROLE_PERMISSIONS[rc]?.[mod] || [];
                      return (
                        <td key={rc} className="py-2 px-2 font-mono text-slate-600 dark:text-slate-400">
                          {acts.length > 0 ? acts.slice(0, 3).join(', ') + (acts.length > 3 ? `+${acts.length - 3}` : '') : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      )}

      {tab === 'sistem' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <GlassCard className="p-5 space-y-4 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0EA5E9]" /> Pengaturan Organisasi & Kebijakan Sesi
            </h2>
            <form onSubmit={handleSaveSystemConfig} className="space-y-3">
              <div>
                <label className="block font-semibold mb-1">Nama Organisasi Resmi</label>
                <input
                  disabled={!can('sistem', 'configure')}
                  value={config.settings.organization_name || 'Duta Pelajar Berbudaya Indonesia (DPBI)'}
                  onChange={(e) => setConfig({ ...config, settings: { ...config.settings, organization_name: e.target.value } })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Masa Berlaku Sesi (Jam)</label>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    disabled={!can('sistem', 'configure')}
                    value={config.settings.session_ttl_hours || '12'}
                    onChange={(e) => setConfig({ ...config, settings: { ...config.settings, session_ttl_hours: e.target.value } })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Batas Tidak Aktif / Idle (Menit)</label>
                  <input
                    type="number"
                    min={5}
                    max={240}
                    disabled={!can('sistem', 'configure')}
                    value={config.settings.session_idle_minutes || '45'}
                    onChange={(e) => setConfig({ ...config, settings: { ...config.settings, session_idle_minutes: e.target.value } })}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 tabular-nums"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Statistik Ringkas Portal Publik</label>
                <select
                  disabled={!can('sistem', 'configure')}
                  value={config.settings.public_stats_approved || 'true'}
                  onChange={(e) => setConfig({ ...config, settings: { ...config.settings, public_stats_approved: e.target.value } })}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                >
                  <option value="true">Disetujui Tampil di Halaman Publik</option>
                  <option value="false">Disembunyikan (Khusus Internal)</option>
                </select>
              </div>
              {can('sistem', 'configure') && (
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => navigate('/sistem')}
                    className="text-[#0EA5E9] font-semibold hover:underline"
                  >
                    Buka Pusat Kendali Sistem & Backup
                  </button>
                  <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">
                    Simpan Konfigurasi
                  </button>
                </div>
              )}
            </form>
          </GlassCard>

          <GlassCard className="p-5 space-y-3 text-xs">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Hash className="w-4 h-4 text-[#0EA5E9]" /> Penomoran Dokumen Atomik Berjalan
            </h2>
            <p className="text-slate-500">
              Format standar nasional: <code className="font-mono text-[#0EA5E9]">DPBI/[KATEGORI]/[TAHUN]/[URUTAN]</code>. Urutan dijamin unik secara transaksional di database.
            </p>
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
              {config.sequences.map((seq, idx) => (
                <div key={`${seq.category}-${seq.year}-${idx}`} className="py-2 flex items-center justify-between">
                  <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                    DPBI/{seq.category}/{seq.year}/XXXX
                  </span>
                  <span className="font-mono text-[#0EA5E9]">Urutan Terakhir: {String(seq.last_seq).padStart(4, '0')}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </div>
      )}

      <Modal open={createUserOpen} onClose={() => setCreateUserOpen(false)} title="Buat Akun Pengguna Langsung (Super Admin)">
        <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Nama Lengkap *</label>
            <input
              required
              value={userForm.fullName}
              onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Email *</label>
            <input
              type="email"
              required
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Kata Sandi Awal *</label>
            <input
              type="password"
              required
              minLength={8}
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Role</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as RoleCode })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                {Object.entries(ROLE_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>{lbl}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Provinsi</label>
              <select
                value={userForm.provinceCode}
                onChange={(e) => setUserForm({ ...userForm, provinceCode: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                {INDONESIA_PROVINCES.map((p) => (
                  <option key={p.code} value={p.code}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Buat Akun</button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmToggleUser)}
        title="Konfirmasi Perubahan Status Akun"
        message={
          confirmToggleUser
            ? `Ubah status akun ${confirmToggleUser.name} menjadi "${confirmToggleUser.next}"? Seluruh sesi aktif milik akun ini akan langsung dicabut.`
            : ''
        }
        danger={confirmToggleUser?.next === 'nonaktif'}
        confirmLabel="Ya, Terapkan"
        onConfirm={confirmStatusChange}
        onCancel={() => setConfirmToggleUser(null)}
      />

      <ConfirmDialog
        open={confirmRevokeAll}
        title="Keluar dari Seluruh Perangkat?"
        message="Tindakan ini akan menghentikan seluruh sesi aktif Anda termasuk sesi perangkat ini, dan Anda akan diminta masuk kembali."
        danger
        confirmLabel="Keluar Semua Perangkat"
        onConfirm={revokeAll}
        onCancel={() => setConfirmRevokeAll(false)}
      />
    </div>
  );
}
