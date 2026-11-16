import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  ShieldCheck,
} from 'lucide-react';
import { ApiError, apiGet, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatTanggalIndonesia } from '../lib/rbac';
import type { ProvinceRecord, RegencyRecord, RoleCode } from '../lib/types';
import { IndonesiaMap } from '../components/IndonesiaMap';
import { PublicFooter, PublicNavbar } from '../components/public/PublicChrome';
import { GlassCard, StatusIndicator } from '../components/ui/Primitives';
import heroBudayaImg from '../assets/images/hero_dpbi_budaya_1794822751932.jpg';

interface PublicOverviewPayload {
  isDemoMode: boolean;
  bootstrapRequired: boolean;
  statsApproved: boolean;
  showDutaCount?: boolean;
  publicStats: {
    activeProvinces: number;
    developingProvinces?: number;
    totalProvinces: number;
    coveredRegencies?: number;
    totalRegencies?: number;
    activePersonnel: number | null;
    approvedActivities: number;
    activeBatches: number;
  } | null;
  cms?: Record<string, { title: string; body: string; updatedAt?: string }>;
  publicAnnouncements?: {
    id: string;
    title: string;
    body: string;
    scope: string;
    priority: string;
    publishedAt: string;
  }[];
  provinces?: (ProvinceRecord & { approvedLklCount?: number })[];
  demoAccounts: {
    id: string;
    email: string;
    fullName: string;
    role: RoleCode;
    roleLabel: string;
    bidang?: string | null;
    provinceName: string | null;
  }[];
}

export function PublicPortalPage({
  mode = 'home',
  initialAuthTab = 'login',
}: {
  mode?: 'home' | 'auth';
  initialAuthTab?: 'login' | 'reset' | 'invite';
}) {
  const {
    refreshUser,
    navigate,
    notify,
    setAccountPending,
    pendingRedirectPath,
    setPendingRedirectPath,
  } = useAuth();

  const [overview, setOverview] = useState<PublicOverviewPayload | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>('31');
  const [drillCode, setDrillCode] = useState<string | null>(null);
  const [drillRegencies, setDrillRegencies] = useState<RegencyRecord[]>([]);

  // Auth Portal State (mode === 'auth')
  const [authTab, setAuthTab] = useState<'login' | 'reset' | 'invite'>(initialAuthTab);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [bootstrapName, setBootstrapName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);
  const [demoExpanded, setDemoExpanded] = useState(true);

  useEffect(() => {
    setAuthTab(initialAuthTab);
  }, [initialAuthTab]);

  useEffect(() => {
    apiGet<PublicOverviewPayload>('/api/public/overview', true)
      .then((d) => {
        setOverview(d);
        if (d.provinces && d.provinces.length > 0 && !d.provinces.some((p) => p.code === selectedCode)) {
          setSelectedCode(d.provinces[0].code);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const code = drillCode || selectedCode;
    if (!code || mode !== 'home') return;
    apiGet<{ regencies: RegencyRecord[] }>(`/api/public/provinces/${code}`, true)
      .then((d) => setDrillRegencies(d.regencies))
      .catch(() => setDrillRegencies([]));
  }, [drillCode, selectedCode, mode]);

  const redirectAfterAuth = () => {
    const destination = pendingRedirectPath || '/dashboard';
    if (pendingRedirectPath) setPendingRedirectPath(null);
    navigate(destination);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiPost('/api/auth/login', { email, password }, true);
      await refreshUser();
      redirectAfterAuth();
    } catch (err) {
      if (err instanceof ApiError && err.accountStatus === 'menunggu_persetujuan') {
        setAccountPending(true);
        return;
      }
      setError(err instanceof Error ? err.message : 'Gagal masuk ke sistem.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBootstrap = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiPost('/api/auth/bootstrap', { fullName: bootstrapName, email, password }, true);
      await refreshUser();
      notify('Super Admin pertama berhasil diinisialisasi.', 'success');
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal inisialisasi Super Admin.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDemoSwitch = async (demoEmail: string) => {
    setError(null);
    setSubmitting(true);
    try {
      await apiPost('/api/auth/demo-switch', { email: demoEmail }, true);
      await refreshUser();
      redirectAfterAuth();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke akun simulasi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMsg(null);
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string; demoResetToken?: string }>(
        '/api/auth/request-reset',
        { email },
        true
      );
      setInfoMsg(
        res.demoResetToken
          ? `${res.message} Token simulasi: ${res.demoResetToken}`
          : res.message
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memproses permintaan reset.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>(
        '/api/auth/complete-reset',
        { token, newPassword },
        true
      );
      setInfoMsg(res.message);
      setAuthTab('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Token reset tidak valid.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAcceptInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await apiPost<{ message: string }>(
        '/api/auth/accept-invitation',
        { token, password: newPassword },
        true
      );
      setInfoMsg(res.message);
      setAuthTab('login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Aktivasi undangan gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== PUBLIC WEBSITE HOME (/) ====================
  if (mode === 'home') {
    const heroSubtitle =
      overview?.cms?.hero_subtitle?.body ||
      'Program kepemimpinan pelajar independen berskala nasional yang menghubungkan generasi muda di 38 provinsi untuk berkarya melalui literasi budaya, pendidikan karakter, dan kolaborasi daerah.';
    const aboutSummary =
      overview?.cms?.about_dpbi?.body ||
      'Duta Pelajar Berbudaya Indonesia (DPBI) membina pelajar tingkat menengah di 38 provinsi dengan prinsip tata kelola terstruktur, pelaporan kegiatan berbasis bukti, dan perlindungan peserta didik.';

    const provincesList = overview?.provinces || [];
    const selectedProv = provincesList.find((p) => p.code === selectedCode) || null;
    const stats = overview?.publicStats;

    return (
      <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
        <PublicNavbar />

        <main className="flex-1">
          {/* Hero Section */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pt-10 pb-12 lg:pt-14 lg:pb-16">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-6 space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0EA5E9]">
                  Duta Pelajar Berbudaya Indonesia · Organisasi Independen
                </p>
                <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 dark:text-white leading-[1.15] [text-wrap:balance]">
                  Berbudaya, Bergerak, dan Berdampak Untuk Negeri.
                </h1>
                <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-xl">
                  {heroSubtitle}
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => navigate('/wilayah')}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-sm font-semibold shadow-sm transition-colors"
                  >
                    <MapPin className="w-4 h-4" />
                    <span>Lihat Persebaran Wilayah</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:border-[#0EA5E9] text-sm font-semibold transition-colors"
                  >
                    <span>Masuk SATU DPBI</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">SATU DPBI</span> — Satu Sistem, Satu Data, Satu Koordinasi.
                </p>
              </div>

              <div className="lg:col-span-6">
                <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-lg bg-slate-900 aspect-[16/9]">
                  <img
                    src={heroBudayaImg}
                    alt="Pelajar Indonesia berkolaborasi dalam literasi budaya Nusantara"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* 4-Column National Aggregate KPI Strip (Directly from DB, zero PII) */}
            {overview?.statsApproved && stats && (
              <div className="mt-10 grid grid-cols-2 lg:grid-cols-4 gap-4">
                <GlassCard className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Provinsi Aktif</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-[#0EA5E9] tabular-nums mt-1">
                    {stats.activeProvinces}
                    <span className="text-sm font-normal text-slate-400">/{stats.totalProvinces}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    +{stats.developingProvinces ?? 0} dalam pengembangan
                  </p>
                </GlassCard>

                <GlassCard className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kabupaten / Kota Terjangkau</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                    {stats.coveredRegencies ?? 0}
                    <span className="text-sm font-normal text-slate-400">/{stats.totalRegencies ?? 514}</span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Cakupan administratif daerah
                  </p>
                </GlassCard>

                <GlassCard className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Kegiatan Terverifikasi</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                    {stats.approvedActivities}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    Laporan LKL tervalidasi koordinator
                  </p>
                </GlassCard>

                <GlassCard className="p-5">
                  <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Duta &amp; Personel Aktif</p>
                  <p className="font-mono text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tabular-nums mt-1">
                    {stats.activePersonnel !== null ? stats.activePersonnel : 'Internal'}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                    {stats.activeBatches} angkatan berjalan
                  </p>
                </GlassCard>
              </div>
            )}
          </section>

          {/* Interactive 38-Province GeoJSON Map Section */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  Peta Persebaran Wilayah 38 Provinsi &amp; Kabupaten/Kota
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Pantau keterwakilan resmi DPBI secara transparan tanpa menampilkan data pribadi peserta didik.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/wilayah')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap shrink-0"
              >
                <span>Buka Direktori Lengkap 38 Provinsi</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <GlassCard className="lg:col-span-8 p-4 sm:p-5">
                <IndonesiaMap
                  provinces={provincesList}
                  selectedCode={selectedCode}
                  onSelect={(p) => {
                    setSelectedCode(p.code);
                    setDrillCode(null);
                  }}
                  drillProvinceCode={drillCode}
                  onChangeDrillProvince={setDrillCode}
                  regencies={drillRegencies}
                />
              </GlassCard>

              <GlassCard className="lg:col-span-4 p-5 space-y-4">
                {selectedProv ? (
                  <>
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          Kode Wilayah {selectedProv.code} · {selectedProv.island}
                        </p>
                        <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                          {selectedProv.name}
                        </h3>
                      </div>
                      <StatusIndicator status={selectedProv.status} />
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <p className="text-slate-500 dark:text-slate-400">Kab/Kota Aktif</p>
                        <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                          {selectedProv.activeRegencyCount ?? 0}/{selectedProv.regencyCount ?? 0}
                        </p>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
                        <p className="text-slate-500 dark:text-slate-400">LKL Disetujui</p>
                        <p className="font-mono text-lg font-bold text-slate-900 dark:text-white tabular-nums mt-0.5">
                          {selectedProv.approvedLklCount ?? 0}
                        </p>
                      </div>
                    </div>

                    {selectedProv.description && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        {selectedProv.description}
                      </p>
                    )}

                    <div className="flex flex-col gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setDrillCode(drillCode === selectedProv.code ? null : selectedProv.code)}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold transition-colors"
                      >
                        {drillCode === selectedProv.code ? 'Kembali ke Peta Nasional' : `Lihat Peta Kab/Kota ${selectedProv.name}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(`/wilayah/${selectedProv.code}`)}
                        className="w-full py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9] transition-colors"
                      >
                        Detail Wilayah Provinsi
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-slate-500">Pilih provinsi pada peta untuk melihat ringkasan publik.</p>
                )}
              </GlassCard>
            </div>
          </section>

          {/* Two-Column Institutional About + Public Announcements */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-14 grid grid-cols-1 lg:grid-cols-12 gap-6">
            <GlassCard className="lg:col-span-6 p-6 space-y-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <Building2 className="w-4 h-4" />
                <span>Tentang Organisasi &amp; Tata Kelola</span>
              </div>
              <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
                {overview?.cms?.about_dpbi?.title || 'Duta Pelajar Berbudaya Indonesia (DPBI)'}
              </h2>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line line-clamp-6">
                {aboutSummary}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => navigate('/tentang')}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#0EA5E9] hover:underline"
                >
                  <span>Baca Profil Lengkap &amp; 6 Bidang</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/bantuan')}
                  className="font-medium text-slate-600 dark:text-slate-300 hover:text-[#0EA5E9]"
                >
                  Pusat Bantuan Publik
                </button>
              </div>
            </GlassCard>

            <GlassCard className="lg:col-span-6 p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                  <Megaphone className="w-4 h-4" />
                  <span>Pengumuman Resmi Publik</span>
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  Terverifikasi Sekretariat
                </span>
              </div>
              {overview?.publicAnnouncements && overview.publicAnnouncements.length > 0 ? (
                <div className="divide-y divide-slate-200/80 dark:divide-slate-800">
                  {overview.publicAnnouncements.slice(0, 4).map((ann) => (
                    <article key={ann.id} className="py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                        <span className="uppercase tracking-wider font-semibold text-[#0EA5E9]">
                          {ann.scope}
                        </span>
                        <span className="tabular-nums">{formatTanggalIndonesia(ann.publishedAt)}</span>
                      </div>
                      <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{ann.title}</h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 line-clamp-2 leading-relaxed">
                        {ann.body}
                      </p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  Belum ada pengumuman publik terbaru saat ini.
                </p>
              )}
            </GlassCard>
          </section>
        </main>

        <PublicFooter />
      </div>
    );
  }

  // ==================== PORTAL AUTHENTICATION (/login, /lupa-password, /aktivasi) ====================
  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
      <PublicNavbar />

      {overview?.isDemoMode && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-xs text-amber-900 dark:text-amber-200">
          <strong>Lingkungan Simulasi (Demo Mode)</strong> — Database demo terpisah untuk evaluasi peran, RBAC, 6 Bidang, dan alur administrasi.
        </div>
      )}

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 lg:py-14 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-5 space-y-5">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0EA5E9]">
              Portal Internal Terpadu
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white leading-tight">
              Masuk ke SATU DPBI
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Pusat administrasi internal bagi Duta Pelajar, Koordinator Wilayah, Pengurus Nasional 6 Bidang, Sekretariat Nasional, dan Pengawas Organisasi.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-5 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-[#0EA5E9]" />
              <span>Akses Berbasis Undangan &amp; RBAC</span>
            </div>
            <p className="leading-relaxed">
              Pendaftaran akun baru diterbitkan secara resmi melalui Koordinator Wilayah dan diverifikasi Sekretariat Nasional. Tidak tersedia pendaftaran mandiri terbuka demi menjaga perlindungan data pelajar.
            </p>
          </div>
        </div>

        <div className="lg:col-span-7 space-y-5">
          <GlassCard className="p-6 sm:p-7">
            {overview?.bootstrapRequired ? (
              <form onSubmit={handleBootstrap} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Inisialisasi Super Admin Pertama
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Basis data produksi masih kosong. Buat akun Super Admin awal; setelah selesai, halaman ini terkunci permanen.
                  </p>
                </div>
                <div>
                  <label htmlFor="bs-name" className="block text-xs font-semibold mb-1">Nama Lengkap</label>
                  <input
                    id="bs-name"
                    type="text"
                    required
                    value={bootstrapName}
                    onChange={(e) => setBootstrapName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="bs-email" className="block text-xs font-semibold mb-1">Email Resmi</label>
                  <input
                    id="bs-email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="bs-pass" className="block text-xs font-semibold mb-1">Kata Sandi (Min. 10 Karakter)</label>
                  <input
                    id="bs-pass"
                    type="password"
                    required
                    minLength={10}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
                {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-sm font-semibold transition-colors"
                >
                  {submitting ? 'Memproses...' : 'Buat Akun Super Admin'}
                </button>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setAuthTab('login'); setError(null); setInfoMsg(null); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      authTab === 'login' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Masuk Portal
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthTab('reset'); setError(null); setInfoMsg(null); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      authTab === 'reset' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Lupa / Reset Sandi
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAuthTab('invite'); setError(null); setInfoMsg(null); }}
                    className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap ${
                      authTab === 'invite' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Aktivasi Undangan
                  </button>
                </div>

                {authTab === 'login' && (
                  <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Autentikasi Akun</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Masukkan email dan kata sandi akun SATU DPBI Anda.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                        Email
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="login-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@dpbi.or.id"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-3.5 py-2.5 text-sm"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                          Kata Sandi
                        </label>
                        <button
                          type="button"
                          onClick={() => setAuthTab('reset')}
                          className="text-[11px] font-medium text-[#0EA5E9] hover:underline"
                        >
                          Lupa kata sandi?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Masukkan kata sandi"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 pl-10 pr-10 py-2.5 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    {error && (
                      <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 px-3.5 py-2.5 text-xs text-rose-700 dark:text-rose-300">
                        {error}
                      </div>
                    )}
                    {infoMsg && (
                      <div className="rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 px-3.5 py-2.5 text-xs text-sky-800 dark:text-sky-200 break-all">
                        {infoMsg}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      <span>{submitting ? 'Memverifikasi...' : 'Masuk ke Portal'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </form>
                )}

                {authTab === 'reset' && (
                  <div className="space-y-4">
                    <form onSubmit={handleResetRequest} className="space-y-3">
                      <div>
                        <h2 className="text-base font-bold text-slate-900 dark:text-white">Lupa Kata Sandi</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          Langkah 1: Minta token pemulihan satu kali pakai (berlaku 60 menit).
                        </p>
                      </div>
                      <div>
                        <label htmlFor="reset-email" className="block text-xs font-semibold mb-1">Email Terdaftar</label>
                        <input
                          id="reset-email"
                          type="email"
                          required
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="nama@dpbi.or.id"
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
                      >
                        Kirim Token Reset
                      </button>
                    </form>
                    <form onSubmit={handleCompleteReset} className="space-y-3 pt-3 border-t border-slate-200 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Langkah 2: Masukkan Token &amp; Sandi Baru
                      </p>
                      <div>
                        <label htmlFor="reset-token" className="block text-xs font-semibold mb-1">Token Reset</label>
                        <input
                          id="reset-token"
                          type="text"
                          required
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label htmlFor="reset-newpass" className="block text-xs font-semibold mb-1">Kata Sandi Baru (Min. 8 Karakter)</label>
                        <input
                          id="reset-newpass"
                          type="password"
                          required
                          minLength={8}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                        />
                      </div>
                      {error && <p className="text-xs text-rose-600">{error}</p>}
                      {infoMsg && <p className="text-xs text-sky-700 dark:text-sky-300 break-all">{infoMsg}</p>}
                      <button
                        type="submit"
                        disabled={submitting}
                        className="w-full py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold"
                      >
                        Simpan Kata Sandi Baru
                      </button>
                    </form>
                  </div>
                )}

                {authTab === 'invite' && (
                  <form onSubmit={handleAcceptInvite} className="space-y-3">
                    <div>
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Verifikasi Undangan &amp; Aktivasi Akun</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Masukkan token undangan satu kali pakai yang diterbitkan setelah pengajuan Koordinator Wilayah disetujui.
                      </p>
                    </div>
                    <div>
                      <label htmlFor="inv-token" className="block text-xs font-semibold mb-1">Token Undangan</label>
                      <input
                        id="inv-token"
                        type="text"
                        required
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label htmlFor="inv-pass" className="block text-xs font-semibold mb-1">Buat Kata Sandi Pribadi (Min. 8 Karakter)</label>
                      <input
                        id="inv-pass"
                        type="password"
                        required
                        minLength={8}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm"
                      />
                    </div>
                    {error && <p className="text-xs text-rose-600">{error}</p>}
                    {infoMsg && <p className="text-xs text-sky-700">{infoMsg}</p>}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-2.5 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold"
                    >
                      Aktifkan Akun Duta
                    </button>
                  </form>
                )}
              </div>
            )}
          </GlassCard>

          {/* Demo Mode Role Quick Switcher — strictly ONLY on /login when Demo Mode active */}
          {overview?.isDemoMode && overview.demoAccounts.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Akses Simulasi Peran (Khusus Demo Mode)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Uji isolasi hak akses RBAC dan cakupan 6 Bidang secara instan.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDemoExpanded((v) => !v)}
                  className="text-xs font-semibold text-[#0EA5E9] hover:underline shrink-0"
                >
                  {demoExpanded ? 'Sembunyikan' : 'Tampilkan'}
                </button>
              </div>
              {demoExpanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
                  {overview.demoAccounts.map((acc) => (
                    <button
                      key={acc.id}
                      type="button"
                      disabled={submitting}
                      onClick={() => handleDemoSwitch(acc.email)}
                      className="text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 hover:border-[#0EA5E9] hover:bg-sky-50/60 dark:hover:bg-slate-800 transition-colors"
                    >
                      <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {acc.roleLabel}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {acc.bidang || acc.provinceName || acc.fullName.replace(' (Simulasi)', '')}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </GlassCard>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
