import React, { useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/AppShell';
import { AccountPendingView, ErrorView, LoadingSkeleton } from './components/ui';
import type { HttpErrorCode } from './lib/types';
import { matchPrivateRoute, normalizePathname, VALID_ERROR_CODES, type MatchedPrivateRoute } from './lib/routes';

import { PublicPortalPage } from './pages/PublicPortalPage';
import { PublicAboutPage } from './pages/PublicAboutPage';
import { PublicRegionsPage } from './pages/PublicRegionsPage';
import { PublicLegalPage } from './pages/PublicLegalPage';
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
import { MyActivityPage } from './pages/MyActivityPage';
import { AlumniPage } from './pages/AlumniPage';

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

function renderMatchedPage(route: MatchedPrivateRoute): React.ReactNode {
  switch (route.kind) {
    case 'dashboard':
      return <DashboardPage />;
    case 'my_activity':
      return <MyActivityPage />;
    case 'organization':
      return <OrganizationPage />;
    case 'personnel':
      return <PersonnelPage initialMode={route.mode} initialId={route.id} />;
    case 'regions':
      return <RegionsPage initialId={route.id} />;
    case 'batches':
      return <BatchesPage initialId={route.id} />;
    case 'alumni':
      return <AlumniPage />;
    case 'proposals':
      return <ProposalsPage initialMode={route.mode} initialId={route.id} />;
    case 'lkl':
      return <LklPage initialMode={route.mode} initialId={route.id} />;
    case 'coordinator_reports':
      return <CoordinatorReportsPage />;
    case 'tasks':
      return <TasksPage scope={route.scope} initialId={route.id} />;
    case 'documents':
      return <DocumentsPage initialId={route.id} />;
    case 'announcements':
      return <AnnouncementsPage />;
    case 'calendar':
      return <CalendarPage />;
    case 'notifications':
      return <NotificationsPage />;
    case 'safeguarding':
      return <SafeguardingPage />;
    case 'evaluations':
      return <EvaluationsPage />;
    case 'archive':
      return <ArchivePage />;
    case 'system':
      return <SystemAdminPage initialTab={route.initialTab} />;
    case 'settings':
      return <SettingsPage initialTab={route.initialTab} />;
    case 'help':
      return <HelpPage />;
    case 'legal':
      return <PublicLegalPage section={route.section} />;
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
    pendingRedirectPath,
    setPendingRedirectPath,
  } = useAuth();

  const normalizedPath = normalizePathname(currentPath);

  useEffect(() => {
    if (!loading && user && normalizedPath === '/login') {
      if (pendingRedirectPath) {
        const dest = pendingRedirectPath;
        setPendingRedirectPath(null);
        navigate(dest);
      } else {
        navigate('/dashboard');
      }
    }
  }, [loading, user, normalizedPath, navigate, pendingRedirectPath, setPendingRedirectPath]);

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
          navigate('/login');
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
          navigate('/login');
        }}
        onBack={() => {
          clearSessionExpired();
          navigate('/');
        }}
      />
    );
  }

  if (normalizedPath === '/pemeliharaan') {
    const view = (
      <ErrorView
        code={503}
        title="Portal Sedang Dalam Pemeliharaan Terjadwal (503)"
        message="SATU DPBI sedang menjalani pemeliharaan sistem terjadwal untuk meningkatkan keandalan layanan nasional. Seluruh data tersimpan dengan aman."
        onRetry={() => window.location.reload()}
        onBack={() => navigate(user ? '/dashboard' : '/')}
      />
    );
    return user ? <AppShell>{view}</AppShell> : view;
  }

  const directErrorCodeMatch = /^\/(400|401|403|404|419|422|429|500|502|503)$/.exec(normalizedPath);
  if (normalizedPath.startsWith('/error/') || directErrorCodeMatch) {
    const rawCode = directErrorCodeMatch
      ? Number(directErrorCodeMatch[1])
      : Number(normalizedPath.replace('/error/', ''));
    const errorCode: HttpErrorCode = VALID_ERROR_CODES.includes(rawCode as HttpErrorCode)
      ? (rawCode as HttpErrorCode)
      : 404;
    const view = (
      <ErrorView
        code={errorCode}
        onLogin={!user ? () => navigate('/login') : undefined}
        onRetry={errorCode >= 500 ? () => window.location.reload() : undefined}
        onBack={() => navigate(user ? '/dashboard' : '/')}
      />
    );
    return user ? <AppShell>{view}</AppShell> : view;
  }

  if (!user) {
    if (normalizedPath === '/') {
      return <PublicPortalPage mode="home" />;
    }
    if (normalizedPath === '/tentang') {
      return <PublicAboutPage />;
    }
    if (normalizedPath === '/privasi') {
      return <PublicLegalPage section="privasi" />;
    }
    if (normalizedPath === '/ketentuan' || normalizedPath === '/hak-cipta') {
      return <PublicLegalPage section="ketentuan" />;
    }
    if (normalizedPath === '/wilayah') {
      return <PublicRegionsPage />;
    }
    if (normalizedPath.startsWith('/wilayah/')) {
      const code = decodeURIComponent(normalizedPath.slice('/wilayah/'.length)).replace(/[^0-9]/g, '');
      return <PublicRegionsPage initialCode={code || undefined} />;
    }
    if (normalizedPath === '/login') {
      return <PublicPortalPage mode="auth" initialAuthTab="login" />;
    }
    if (normalizedPath === '/lupa-password' || normalizedPath === '/reset-password') {
      return <PublicPortalPage mode="auth" initialAuthTab="reset" />;
    }
    if (normalizedPath === '/aktivasi' || normalizedPath === '/aktivasi-akun' || normalizedPath === '/verifikasi-undangan') {
      return <PublicPortalPage mode="auth" initialAuthTab="invite" />;
    }
    if (normalizedPath === '/bantuan' || normalizedPath === '/pusat-bantuan') {
      return <HelpPage />;
    }
    if (matchPrivateRoute(normalizedPath)) {
      return (
        <ErrorView
          code={401}
          onLogin={() => {
            setPendingRedirectPath(normalizedPath);
            navigate('/login');
          }}
          onBack={() => navigate('/')}
        />
      );
    }
    return <ErrorView code={404} onBack={() => navigate('/')} />;
  }

  if (normalizedPath === '/tentang') {
    return <PublicAboutPage />;
  }

  const effectivePath =
    normalizedPath === '/' || normalizedPath === '/login' ? '/dashboard' : normalizedPath;
  const route = matchPrivateRoute(effectivePath);

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

  if ('module' in route && route.module && !can(route.module, 'view')) {
    return (
      <AppShell>
        <ErrorView
          code={403}
          onBack={() => navigate('/dashboard')}
        />
      </AppShell>
    );
  }

  if (effectivePath === '/pengaturan/pengguna' && !can('pengaturan', 'manage')) {
    return (
      <AppShell>
        <ErrorView code={403} onBack={() => navigate('/dashboard')} />
      </AppShell>
    );
  }

  const canCmsAccess =
    can('pengaturan', 'manage') ||
    user.role === 'sekretariat_nasional' ||
    (user.role === 'pengurus_nasional' && (user.bidang || '').toLowerCase().includes('media'));

  if ((effectivePath === '/pengaturan/cms' || effectivePath === '/cms') && !canCmsAccess) {
    return (
      <AppShell>
        <ErrorView code={403} onBack={() => navigate('/dashboard')} />
      </AppShell>
    );
  }

  return <AppShell>{renderMatchedPage(route)}</AppShell>;
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
