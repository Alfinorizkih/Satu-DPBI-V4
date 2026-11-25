import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Loader2, X } from 'lucide-react';
import { apiGet, apiPost, setApiHandlers } from '../lib/api';
import type { AuthUser, ModuleCode, PermissionAction, ToastVariant } from '../lib/types';
import { hasPermission } from '../lib/rbac';
import { getRouteTitle, matchPrivateRoute, normalizePathname } from '../lib/routes';

interface ToastItem {
  id: string;
  type: ToastVariant;
  message: string;
}

export interface RecentRouteItem {
  path: string;
  title: string;
  visitedAt: string;
}

export const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard & Ringkasan',
  '/aktivitas-saya': 'Aktivitas Saya',
  '/tugas-saya': 'Tugas Saya',
  '/organisasi': 'Organisasi & Delegasi',
  '/personalia': 'Personalia & Verifikasi Profil',
  '/wilayah': 'Wilayah 38 Provinsi & Peta Indonesia',
  '/angkatan': 'Angkatan & Siklus Masa Tugas',
  '/alumni': 'Direktori & Akses Alumni',
  '/proposal': 'Manajemen Proposal PDF',
  '/laporan-kegiatan': 'Laporan Kegiatan Lapangan (LKL)',
  '/laporan-koordinator': 'Laporan Koordinator Wilayah',
  '/tugas': 'Task Management Center',
  '/dokumen': 'Digital Document Center & SOP',
  '/pengumuman': 'Pusat Pengumuman',
  '/kalender': 'Kalender Organisasi',
  '/notifikasi': 'Pusat Notifikasi',
  '/perlindungan': 'Safeguarding & Perlindungan Peserta',
  '/evaluasi': 'Monitoring & Evaluasi Kinerja',
  '/arsip': 'Arsip Organisasi & Alumni',
  '/sistem': 'Kontrol Sistem, Storage, Backup & Audit',
  '/audit-log': 'Audit Log Keamanan',
  '/status-sistem': 'Status & Kesehatan Sistem',
  '/profil': 'Profil Pribadi',
  '/pengaturan': 'Pengaturan Akun & Hak Akses',
  '/pengaturan/keamanan': 'Keamanan & Kata Sandi',
  '/pengaturan/sesi': 'Perangkat & Sesi Aktif',
  '/pengaturan/pengguna': 'Manajemen Pengguna',
  '/pengaturan/hak-akses': 'Hak Akses & Peran (RBAC)',
  '/pengaturan/cms': 'CMS Portal Publik & Bantuan',
  '/persetujuan': 'Pusat Persetujuan Nasional',
  '/email': 'Pusat Email & Pengiriman Massal',
  '/bantuan': 'Pusat Bantuan Internal',
};

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  isDemoMode: boolean;
  currentPath: string;
  theme: 'light' | 'dark';
  offline: boolean;
  sessionExpiredReason: string | null;
  accountPending: boolean;
  idleWarningSecondsLeft: number | null;
  idleMinutes: number;
  recentlyViewed: RecentRouteItem[];
  onboardingDone: boolean;
  pendingRedirectPath: string | null;
  setPendingRedirectPath: (path: string | null) => void;
  navigate: (path: string) => void;
  toggleTheme: () => void;
  refreshUser: () => Promise<void>;
  extendSession: () => Promise<void>;
  clearSessionExpired: () => void;
  setAccountPending: (val: boolean) => void;
  dismissOnboarding: () => void;
  logout: () => Promise<void>;
  can: (module: ModuleCode, action?: PermissionAction) => boolean;
  notify: (message: string, type?: ToastVariant, options?: { durationMs?: number }) => string;
  dismissToast: (id: string) => void;
  updateToast: (id: string, message: string, type?: ToastVariant, options?: { durationMs?: number }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentPath, setCurrentPath] = useState(() => window.location.pathname || '/');
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('satu_dpbi_theme');
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [offline, setOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false));
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(null);
  const [accountPending, setAccountPending] = useState(false);
  const [idleMinutes, setIdleMinutes] = useState(30);
  const [idleWarningSecondsLeft, setIdleWarningSecondsLeft] = useState<number | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentRouteItem[]>([]);
  const [onboardingDone, setOnboardingDone] = useState(true);
  const [pendingRedirectPath, setPendingRedirectPath] = useState<string | null>(() => {
    const p = normalizePathname(window.location.pathname || '/');
    return matchPrivateRoute(p) ? p : null;
  });
  const lastActivityRef = useRef<number>(Date.now());

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('satu_dpbi_theme', theme);
  }, [theme]);

  useEffect(() => {
    const onPop = () => setCurrentPath(window.location.pathname || '/');
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener('popstate', onPop);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('popstate', onPop);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const toastTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismissToast = useCallback((id: string) => {
    const existing = toastTimersRef.current.get(id);
    if (existing) {
      clearTimeout(existing);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const scheduleToastDismiss = useCallback(
    (id: string, type: ToastVariant, durationMs?: number) => {
      const existing = toastTimersRef.current.get(id);
      if (existing) {
        clearTimeout(existing);
        toastTimersRef.current.delete(id);
      }
      if (type === 'loading' || durationMs === 0) return;
      const ms = durationMs ?? (type === 'error' || type === 'warning' ? 8000 : 4500);
      const timer = setTimeout(() => {
        toastTimersRef.current.delete(id);
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, ms);
      toastTimersRef.current.set(id, timer);
    },
    []
  );

  const notify = useCallback(
    (message: string, type: ToastVariant = 'info', options?: { durationMs?: number }): string => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message }].slice(-4));
      scheduleToastDismiss(id, type, options?.durationMs);
      return id;
    },
    [scheduleToastDismiss]
  );

  const updateToast = useCallback(
    (id: string, message: string, type: ToastVariant = 'info', options?: { durationMs?: number }) => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, message, type } : t)));
      scheduleToastDismiss(id, type, options?.durationMs);
    },
    [scheduleToastDismiss]
  );

  useEffect(() => {
    setApiHandlers({
      onSessionExpired: (reason) => {
        setUser(null);
        setIdleWarningSecondsLeft(null);
        setSessionExpiredReason(
          reason || 'Sesi Anda telah berakhir karena batas waktu atau periode tidak aktif. Silakan masuk kembali.'
        );
      },
      onNetworkError: (isOffline) => {
        setOffline(isOffline);
      },
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiGet<{
        authenticated: boolean;
        user: AuthUser | null;
        isDemoMode: boolean;
        idleMinutes?: number;
        expiredReason?: string | null;
      }>('/api/auth/session', true);
      setUser(data.user);
      setIsDemoMode(data.isDemoMode);
      if (data.idleMinutes && data.idleMinutes > 0) {
        setIdleMinutes(data.idleMinutes);
      }
      if (data.user) {
        setSessionExpiredReason(null);
        setAccountPending(false);
        lastActivityRef.current = Date.now();
        setIdleWarningSecondsLeft(null);
        const recentRaw = localStorage.getItem(`satu_dpbi_recent_${data.user.id}`);
        if (recentRaw) {
          try {
            setRecentlyViewed(JSON.parse(recentRaw));
          } catch {
            setRecentlyViewed([]);
          }
        }
        setOnboardingDone(localStorage.getItem(`satu_dpbi_onboarded_${data.user.id}`) === '1');
      } else if (data.expiredReason) {
        setSessionExpiredReason(data.expiredReason);
      }
    } catch {
      setUser(null);
      try {
        const pub = await apiGet<{ isDemoMode: boolean }>('/api/public/overview', true);
        setIsDemoMode(pub.isDemoMode);
      } catch {
        // ignore
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // Activity tracking & pre-expiry idle warning (shows 120s before backend idle timeout)
  useEffect(() => {
    if (!user) {
      setIdleWarningSecondsLeft(null);
      return;
    }

    const markActive = () => {
      lastActivityRef.current = Date.now();
      setIdleWarningSecondsLeft((prev) => (prev !== null ? null : prev));
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));

    const interval = setInterval(() => {
      const totalIdleSec = Math.max(180, idleMinutes * 60);
      const elapsedSec = Math.floor((Date.now() - lastActivityRef.current) / 1000);
      const remainingSec = totalIdleSec - elapsedSec;

      if (remainingSec <= 0) {
        setIdleWarningSecondsLeft(null);
        refreshUser();
      } else if (remainingSec <= 120) {
        setIdleWarningSecondsLeft(remainingSec);
      } else {
        setIdleWarningSecondsLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, markActive));
      clearInterval(interval);
    };
  }, [user, idleMinutes, refreshUser]);

  // Track recently viewed internal pages (only when user has access, non-sensitive route names only)
  useEffect(() => {
    if (!user) return;
    const matched = matchPrivateRoute(currentPath);
    if (!matched || currentPath === '/' || currentPath === '/login') return;
    if ('module' in matched && matched.module && !hasPermission(user.permissions, matched.module, 'view')) return;
    const title = getRouteTitle(currentPath);
    setRecentlyViewed((prev) => {
      const next = [
        { path: currentPath, title, visitedAt: new Date().toISOString() },
        ...prev.filter((item) => item.path !== currentPath),
      ].slice(0, 6);
      try {
        localStorage.setItem(`satu_dpbi_recent_${user.id}`, JSON.stringify(next));
      } catch {
        // ignore storage quota
      }
      return next;
    });
  }, [user, currentPath]);

  const extendSession = useCallback(async () => {
    lastActivityRef.current = Date.now();
    setIdleWarningSecondsLeft(null);
    await refreshUser();
    notify('Sesi aktif Anda berhasil diperpanjang.', 'success');
  }, [refreshUser, notify]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpiredReason(null);
  }, []);

  const dismissOnboarding = useCallback(() => {
    if (user) {
      localStorage.setItem(`satu_dpbi_onboarded_${user.id}`, '1');
    }
    setOnboardingDone(true);
  }, [user]);

  const navigate = useCallback((path: string) => {
    const target = path.startsWith('/') ? path : `/${path}`;
    if (window.location.pathname !== target) {
      window.history.pushState({}, '', target);
    }
    setCurrentPath(target);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiPost('/api/auth/logout', undefined, true);
    } catch {
      // ignore
    }
    setUser(null);
    setSessionExpiredReason(null);
    setIdleWarningSecondsLeft(null);
    navigate('/');
    notify('Anda telah keluar dari portal SATU DPBI.', 'info');
  }, [navigate, notify]);

  const can = useCallback(
    (module: ModuleCode, action: PermissionAction = 'view') => {
      if (!user) return false;
      return hasPermission(user.permissions, module, action);
    },
    [user]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isDemoMode,
        currentPath,
        theme,
        offline,
        sessionExpiredReason,
        accountPending,
        idleWarningSecondsLeft,
        idleMinutes,
        recentlyViewed,
        onboardingDone,
        pendingRedirectPath,
        setPendingRedirectPath,
        navigate,
        toggleTheme,
        refreshUser,
        extendSession,
        clearSessionExpired,
        setAccountPending,
        dismissOnboarding,
        logout,
        can,
        notify,
        dismissToast,
        updateToast,
      }}
    >
      {children}
      {/* Toast Notifications */}
      <div
        aria-live="polite"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none px-4 sm:px-0"
      >
        {toasts.map((t) => {
          const isAlert = t.type === 'error' || t.type === 'warning';
          const Icon =
            t.type === 'success'
              ? CheckCircle2
              : t.type === 'error'
              ? AlertCircle
              : t.type === 'warning'
              ? AlertTriangle
              : t.type === 'loading'
              ? Loader2
              : Info;
          const styleClass =
            t.type === 'success'
              ? 'bg-emerald-50/95 dark:bg-emerald-950/95 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-100'
              : t.type === 'error'
              ? 'bg-rose-50/95 dark:bg-rose-950/95 border-rose-200 dark:border-rose-800 text-rose-900 dark:text-rose-100'
              : t.type === 'warning'
              ? 'bg-amber-50/95 dark:bg-amber-950/95 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-100'
              : 'bg-white/95 dark:bg-slate-900/95 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100';
          return (
            <div
              key={t.id}
              role={isAlert ? 'alert' : 'status'}
              className={`pointer-events-auto rounded-xl px-3.5 py-3 text-xs sm:text-sm font-medium shadow-lg border backdrop-blur-md transition-all flex items-start gap-2.5 ${styleClass}`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 mt-0.5 ${t.type === 'loading' ? 'animate-spin text-[#0EA5E9]' : ''}`}
                aria-hidden="true"
              />
              <span className="flex-1 leading-snug">{t.message}</span>
              <button
                type="button"
                onClick={() => dismissToast(t.id)}
                aria-label="Tutup notifikasi"
                className="p-1 -mr-1 -mt-0.5 rounded-lg opacity-65 hover:opacity-100 transition-opacity shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
