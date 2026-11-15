import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { AccountPendingView, ErrorView, LoadingSkeleton } from './components/ui/Primitives';
import type { HttpErrorCode, ModuleCode } from './lib/types';

import { PublicPortalPage } from './pages/PublicPortalPage';
import { HelpPage } from './pages/HelpPage';
import { DashboardPage } from './pages/DashboardPage';
import { OrganizationPage, BatchesPage } from './pages/OrganizationAndBatchesPages';
import { PersonnelPage } from './pages/PersonnelPage';
import { RegionsPage } from './pages/RegionsPage';
import { ProposalsPage } from './pages/ProposalsPage';
import { LklPage } from './pages/LklPage';
import { CoordinatorReportsPage } from './pages/CoordinatorReportsPage';
import { TasksPage, DocumentsPage } from './pages/TasksAndDocsPages';
import { AnnouncementsPage, CalendarPage, NotificationsPage } from './pages/CommsPages';
import { SafeguardingPage, EvaluationsPage, ArchivePage } from './pages/SafetyEvalArchivePages';
import { SystemAdminPage, SettingsPage } from './pages/SystemAndSettingsPages';

interface RouteConfig {
  module?: ModuleCode;
  render: () => React.ReactNode;
}

const PRIVATE_ROUTES: Record<string, RouteConfig> = {
  '/dashboard': { module: 'dashboard', render: () => <DashboardPage /> },
  '/organisasi': { module: 'organisasi', render: () => <OrganizationPage /> },
  '/personalia': { module: 'personalia', render: () => <PersonnelPage /> },
  '/wilayah': { module: 'wilayah', render: () => <RegionsPage /> },
  '/angkatan': { module: 'angkatan', render: () => <BatchesPage /> },
  '/proposal': { module: 'proposal', render: () => <ProposalsPage /> },
  '/laporan-kegiatan': { module: 'lkl', render: () => <LklPage /> },
  '/laporan-koordinator': { module: 'laporan_koordinator', render: () => <CoordinatorReportsPage /> },
  '/tugas': { module: 'tugas', render: () => <TasksPage /> },
  '/dokumen': { module: 'dokumen', render: () => <DocumentsPage /> },
  '/pengumuman': { module: 'pengumuman', render: () => <AnnouncementsPage /> },
  '/kalender': { module: 'kalender', render: () => <CalendarPage /> },
  '/notifikasi': { render: () => <NotificationsPage /> },
  '/perlindungan': { module: 'perlindungan', render: () => <SafeguardingPage /> },
  '/evaluasi': { module: 'evaluasi', render: () => <EvaluationsPage /> },
  '/arsip': { module: 'arsip', render: () => <ArchivePage /> },
  '/sistem': { module: 'sistem', render: () => <SystemAdminPage /> },
  '/pengaturan': { module: 'pengaturan', render: () => <SettingsPage /> },
  '/bantuan': { render: () => <HelpPage /> },
};

const VALID_ERROR_CODES: HttpErrorCode[] = [400, 401, 403, 404, 419, 422, 429, 500, 502, 503];

class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
      message: 'Terjadi gangguan sementara pada antarmuka portal. Tidak ada data teknis sensitif yang ditampilkan.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorView
          code={500}
          message={this.state.message}
          onRetry={() => window.location.reload()}
          onBack={() => {
            this.setState({ hasError: false, message: '' });
            window.location.href = '/';
          }}
        />
      );
    }
    return this.props.children;
  }
}

function AppRouter() {
  const {
    user,
    loading,
    currentPath,
    navigate,
    can,
    sessionExpiredReason,
    clearSessionExpired,
    accountPending,
    setAccountPending,
  } = useAuth();

  const normalizedPath =
    currentPath.length > 1 && currentPath.endsWith('/')
      ? currentPath.slice(0, -1)
      : currentPath || '/';

  useEffect(() => {
    if (!loading && user && (normalizedPath === '/' || normalizedPath === '/login')) {
      navigate('/dashboard');
    }
  }, [loading, user, normalizedPath, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-[#F1F5F9] dark:bg-slate-950">
        <div className="w-full max-w-md space-y-4">
          <div className="flex items-center gap-3">
            <img
              src="/assets/aistudio/logosd_69efa81d.jpg"
              alt="Logo DPBI"
              className="w-10 h-10 rounded-xl object-cover border border-slate-200 dark:border-slate-800"
            />
            <div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">SATU DPBI</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Memverifikasi sesi otentikasi...</p>
            </div>
          </div>
          <LoadingSkeleton rows={3} />
        </div>
      </div>
    );
  }

  if (accountPending) {
    return (
      <AccountPendingView
        onBack={() => {
          setAccountPending(false);
          navigate('/');
        }}
      />
    );
  }

  if (sessionExpiredReason) {
    return (
      <ErrorView
        code={419}
        message={sessionExpiredReason}
        onLogin={() => {
          clearSessionExpired();
          navigate('/');
        }}
        onBack={() => {
          clearSessionExpired();
          navigate('/');
        }}
      />
    );
  }

  if (normalizedPath.startsWith('/error/')) {
    const rawCode = Number(normalizedPath.replace('/error/', ''));
    const errorCode: HttpErrorCode = VALID_ERROR_CODES.includes(rawCode as HttpErrorCode)
      ? (rawCode as HttpErrorCode)
      : 404;
    const view = (
      <ErrorView
        code={errorCode}
        onLogin={!user ? () => navigate('/') : undefined}
        onRetry={errorCode >= 500 ? () => window.location.reload() : undefined}
        onBack={() => navigate(user ? '/dashboard' : '/')}
      />
    );
    return user ? <AppShell>{view}</AppShell> : view;
  }

  if (!user) {
    if (normalizedPath === '/' || normalizedPath === '/login') {
      return <PublicPortalPage initialAuthTab="login" />;
    }
    if (normalizedPath === '/lupa-password' || normalizedPath === '/reset-password') {
      return <PublicPortalPage initialAuthTab="reset" />;
    }
    if (normalizedPath === '/aktivasi' || normalizedPath === '/verifikasi-undangan') {
      return <PublicPortalPage initialAuthTab="invite" />;
    }
    if (normalizedPath === '/bantuan') {
      return <HelpPage />;
    }
    if (PRIVATE_ROUTES[normalizedPath]) {
      return (
        <ErrorView
          code={401}
          onLogin={() => navigate('/')}
          onBack={() => navigate('/')}
        />
      );
    }
    return <ErrorView code={404} onBack={() => navigate('/')} />;
  }

  const effectivePath =
    normalizedPath === '/' || normalizedPath === '/login' ? '/dashboard' : normalizedPath;
  const route = PRIVATE_ROUTES[effectivePath];

  if (!route) {
    return (
      <AppShell>
        <ErrorView
          code={404}
          message={`Modul untuk rute "${effectivePath}" tidak tersedia di dalam sistem.`}
          onBack={() => navigate('/dashboard')}
        />
      </AppShell>
    );
  }

  if (route.module && !can(route.module, 'view')) {
    return (
      <AppShell>
        <ErrorView
          code={403}
          onBack={() => navigate('/dashboard')}
        />
      </AppShell>
    );
  }

  return <AppShell>{route.render()}</AppShell>;
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </AppErrorBoundary>
  );
}
