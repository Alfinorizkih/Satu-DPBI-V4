import React, { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, HelpCircle, Lock, Mail, Moon, ShieldCheck, Sun } from 'lucide-react';
import { ApiError, apiGet, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { GlassCard, Modal } from '../components/ui/Primitives';
import type { RoleCode } from '../lib/types';

interface PublicOverview {
  isDemoMode: boolean;
  bootstrapRequired: boolean;
  statsApproved: boolean;
  publicStats: {
    activeProvinces: number;
    totalProvinces: number;
    activePersonnel: number;
    approvedActivities: number;
    activeBatches: number;
  } | null;
  demoAccounts: {
    id: string;
    email: string;
    fullName: string;
    role: RoleCode;
    roleLabel: string;
    provinceName: string | null;
  }[];
}

export function PublicPortalPage({
  initialAuthTab = 'login',
}: {
  initialAuthTab?: 'login' | 'reset' | 'invite';
}) {
  const {
    refreshUser,
    navigate,
    theme,
    toggleTheme,
    notify,
    setAccountPending,
    pendingRedirectPath,
    setPendingRedirectPath,
  } = useAuth();
  const [overview, setOverview] = useState<PublicOverview | null>(null);
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
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    setAuthTab(initialAuthTab);
  }, [initialAuthTab]);

  useEffect(() => {
    apiGet<PublicOverview>('/api/public/overview', true)
      .then(setOverview)
      .catch(() => {});
  }, []);

  const redirectAfterAuth = () => {
    const destination = pendingRedirectPath || '/dashboard';
    if (pendingRedirectPath) {
      setPendingRedirectPath(null);
    }
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

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
      {/* Top Bar */}
      <header className="w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-3 whitespace-nowrap shrink-0 text-left"
          >
            <img
              src="/assets/aistudio/logosd_69efa81d.jpg"
              alt="Logo Resmi SATU DPBI"
              referrerPolicy="no-referrer"
              className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700"
            />
            <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
              SATU DPBI
            </span>
          </button>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
            <button
              type="button"
              onClick={() => navigate('/bantuan')}
              className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap shrink-0"
            >
              Pusat Bantuan
            </button>
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap shrink-0"
            >
              Kebijakan Privasi
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-[#0EA5E9]"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => navigate('/bantuan')}
              className="md:hidden inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
            >
              <HelpCircle className="w-4 h-4" /> Bantuan
            </button>
          </div>
        </div>
      </header>

      {overview?.isDemoMode && (
        <div className="bg-amber-50 dark:bg-amber-950/60 border-b border-amber-200 dark:border-amber-800 px-4 py-2 text-center text-xs text-amber-900 dark:text-amber-200">
          <strong>Lingkungan Simulasi (Demo Mode)</strong> — Data di portal ini bersifat fiktif untuk demonstrasi alur kerja. Tidak terhubung dengan database organisasi asli.
        </div>
      )}

      {/* Main Two-Column Portal Entrance */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-10 lg:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Institutional Identity & Approved Public Stats */}
        <div className="lg:col-span-7 space-y-7">
          <div className="space-y-4">
            <p className="text-xs font-semibold text-[#0EA5E9] tracking-wide">
              Portal Internal Resmi · Duta Pelajar Berbudaya Indonesia
            </p>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-slate-900 dark:text-white leading-tight [text-wrap:balance]">
              Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia
            </h1>
            <p className="text-base text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Pusat administrasi, koordinasi, informasi, dan pengelolaan nasional.
              <span className="block font-semibold text-slate-800 dark:text-slate-100 mt-1">
                Satu Sistem, Satu Data, Satu Koordinasi.
              </span>
            </p>
          </div>

          {overview?.statsApproved && overview.publicStats && (
            <GlassCard className="p-6">
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-slate-200/70 dark:border-slate-800">
                <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Statistik Umum Organisasi
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  Ringkasan agregat nasional
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 pt-4">
                <div>
                  <p className="font-mono text-2xl font-bold text-[#0EA5E9] tabular-nums">
                    {overview.publicStats.activeProvinces}/{overview.publicStats.totalProvinces}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Provinsi Aktif</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {overview.publicStats.activePersonnel}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Personel Aktif</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {overview.publicStats.approvedActivities}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Kegiatan Terverifikasi</p>
                </div>
                <div>
                  <p className="font-mono text-2xl font-bold text-slate-900 dark:text-white tabular-nums">
                    {overview.publicStats.activeBatches}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Angkatan Berjalan</p>
                </div>
              </div>
            </GlassCard>
          )}

          <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 p-5 text-xs text-slate-600 dark:text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200">
              <ShieldCheck className="w-4 h-4 text-[#0EA5E9]" />
              <span>Tata Kelola & Keamanan Akses</span>
            </div>
            <p className="leading-relaxed">
              DPBI merupakan organisasi pelajar independen di bawah naungan yayasan. Tidak tersedia pendaftaran publik secara bebas; akun personel diterbitkan melalui pengajuan resmi Koordinator Wilayah dan verifikasi Sekretariat Nasional.
            </p>
          </div>
        </div>

        {/* Right Login / Reset / Invite / Bootstrap Card */}
        <div className="lg:col-span-5 space-y-5">
          <GlassCard className="p-6 sm:p-7">
            {overview?.bootstrapRequired ? (
              <form onSubmit={handleBootstrap} className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    Inisialisasi Super Admin Pertama
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Basis data produksi masih kosong. Buat akun Super Admin awal; setelah selesai, halaman ini akan terkunci permanen.
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={bootstrapName}
                    onChange={(e) => setBootstrapName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email Resmi</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Kata Sandi (Min. 10 Karakter)</label>
                  <input
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
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Masuk ke Portal Internal</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Gunakan email dan kata sandi akun DPBI Anda.
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
                          Langkah 1: Minta token pemulihan satu kali pakai (berlaku 30 menit).
                        </p>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Email Terdaftar</label>
                        <input
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
                        Langkah 2: Masukkan Token & Sandi Baru
                      </p>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Token Reset</label>
                        <input
                          type="text"
                          required
                          value={token}
                          onChange={(e) => setToken(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold mb-1">Kata Sandi Baru (Min. 8 Karakter)</label>
                        <input
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
                      <h2 className="text-base font-bold text-slate-900 dark:text-white">Verifikasi Undangan & Aktivasi Akun</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Masukkan token undangan satu kali pakai yang diterbitkan setelah pengajuan Koordinator Wilayah disetujui.
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Token Undangan</label>
                      <input
                        type="text"
                        required
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3.5 py-2 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold mb-1">Buat Kata Sandi Pribadi (Min. 8 Karakter)</label>
                      <input
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

          {/* Demo Mode Role Quick Switcher — strictly absent in Production */}
          {overview?.isDemoMode && overview.demoAccounts.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                    Akses Simulasi Peran (Khusus Demo Mode)
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Klik salah satu peran fiktif untuk menguji isolasi hak akses & alur kerja.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {overview.demoAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDemoSwitch(acc.email)}
                    className="text-left px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/70 hover:border-[#0EA5E9] hover:bg-sky-50/60 dark:hover:bg-slate-800 transition-colors"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {acc.roleLabel}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {acc.fullName.replace(' (Simulasi)', '')}{acc.provinceName ? ` · ${acc.provinceName}` : ''}
                    </p>
                  </button>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/60 dark:bg-slate-950/60 py-5 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p>© {new Date().getFullYear()} Duta Pelajar Berbudaya Indonesia (DPBI). Organisasi Independen di Bawah Naungan Yayasan.</p>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => navigate('/bantuan')} className="hover:text-[#0EA5E9]">
              Pusat Bantuan
            </button>
            <button type="button" onClick={() => setPrivacyOpen(true)} className="hover:text-[#0EA5E9]">
              Kebijakan Privasi & Perlindungan Data
            </button>
          </div>
        </div>
      </footer>

      <Modal open={privacyOpen} onClose={() => setPrivacyOpen(false)} title="Kebijakan Privasi & Perlindungan Data Pelajar">
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            SATU DPBI menerapkan prinsip minimalisasi data (<em>data minimization</em>), pembatasan tujuan (<em>purpose limitation</em>), dan pengendalian akses berbasis peran (RBAC) untuk melindungi data pribadi peserta didik dan pengurus.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>Dokumen identitas (kartu pelajar, surat izin wali, alamat rinci, kontak orang tua/wali, dan NISN) tidak pernah ditampilkan di portal publik dan disamarkan bagi pengguna yang tidak memiliki kewenangan.</li>
            <li>Persetujuan keikutsertaan kegiatan, izin orang tua/wali, dokumentasi, dan publikasi media dicatat secara terpisah.</li>
            <li>Pemeriksaan lokasi Koordinator Wilayah hanya dilakukan atas permintaan saat tindakan penting wilayah dan tidak melakukan pelacakan latar belakang.</li>
            <li>Alumni memperoleh akses arsip pribadi selama 30 hari setelah masa jabatan berakhir dan dapat mengekspor salinan datanya.</li>
          </ul>
        </div>
      </Modal>
    </div>
  );
}
