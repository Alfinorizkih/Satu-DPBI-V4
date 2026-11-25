import React, { useEffect, useState } from 'react';
import {
  Activity,
  Archive,
  Award,
  Bell,
  Building2,
  Calendar,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileCheck2,
  FileSpreadsheet,
  FolderOpen,
  Globe,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Mail,
  Map as MapIcon,
  Megaphone,
  Menu,
  Moon,
  Search,
  ServerCog,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Sun,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost } from '../lib/api';
import type { ModuleCode, NotificationRecord, PermissionAction } from '../lib/types';
import { getRouteTitle, resolveBaseNavPath } from '../lib/routes';
import { CommandPalette } from './CommandPalette';
import { OfflineBanner } from './ui';
import { formatTanggalIndonesia } from '../lib/rbac';

interface NavItem {
  label: string;
  path: string;
  module?: ModuleCode;
  action?: PermissionAction;
  canShow?: (user: { role: string; bidang?: string | null } | null, can: (m: ModuleCode, a: PermissionAction) => boolean) => boolean;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  id: string;
  group: string;
  collapsible?: boolean;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    id: 'utama',
    group: 'Utama',
    items: [
      { label: 'Dashboard', path: '/dashboard', module: 'dashboard', icon: LayoutDashboard },
      { label: 'Aktivitas Saya', path: '/aktivitas-saya', module: 'dashboard', icon: Activity },
      { label: 'Tugas Saya', path: '/tugas-saya', module: 'tugas', icon: CheckSquare },
    ],
  },
  {
    id: 'organisasi',
    group: 'Organisasi',
    collapsible: true,
    items: [
      { label: 'Personalia', path: '/personalia', module: 'personalia', icon: Users },
      { label: 'Wilayah', path: '/wilayah', module: 'wilayah', icon: MapIcon },
      { label: 'Angkatan', path: '/angkatan', module: 'angkatan', icon: Award },
      { label: 'Alumni', path: '/alumni', module: 'arsip', icon: GraduationCap },
      { label: 'Struktur Organisasi', path: '/organisasi', module: 'organisasi', icon: Building2 },
    ],
  },
  {
    id: 'operasional',
    group: 'Operasional',
    collapsible: true,
    items: [
      { label: 'Pusat Persetujuan', path: '/persetujuan', module: 'persetujuan', icon: CheckCircle2 },
      { label: 'Proposal', path: '/proposal', module: 'proposal', icon: FileCheck2 },
      { label: 'Laporan Kegiatan', path: '/laporan-kegiatan', module: 'lkl', icon: ClipboardCheck },
      { label: 'Laporan Koordinator', path: '/laporan-koordinator', module: 'laporan_koordinator', icon: FileSpreadsheet },
      { label: 'Tugas', path: '/tugas', module: 'tugas', icon: ListTodo },
      { label: 'Kalender', path: '/kalender', module: 'kalender', icon: Calendar },
    ],
  },
  {
    id: 'informasi',
    group: 'Informasi',
    collapsible: true,
    items: [
      { label: 'Pusat Email', path: '/email', module: 'email', icon: Mail },
      { label: 'Pengumuman', path: '/pengumuman', module: 'pengumuman', icon: Megaphone },
      { label: 'Notifikasi', path: '/notifikasi', icon: Bell },
      { label: 'Dokumen', path: '/dokumen', module: 'dokumen', icon: FolderOpen },
      { label: 'Arsip', path: '/arsip', module: 'arsip', icon: Archive },
      { label: 'Pusat Bantuan', path: '/bantuan', icon: HelpCircle },
    ],
  },
  {
    id: 'pengelolaan',
    group: 'Pengelolaan',
    collapsible: true,
    items: [
      { label: 'Pengguna', path: '/pengaturan/pengguna', module: 'pengaturan', action: 'manage', icon: Users },
      { label: 'Hak Akses', path: '/pengaturan/hak-akses', module: 'pengaturan', icon: KeyRound },
      { label: 'Pengaturan', path: '/pengaturan', module: 'pengaturan', icon: Settings },
      {
        label: 'CMS & Website Publik',
        path: '/pengaturan/cms',
        icon: Globe,
        canShow: (u, checkCan) =>
          checkCan('pengaturan', 'manage') ||
          u?.role === 'sekretariat_nasional' ||
          (u?.role === 'pengurus_nasional' && (u.bidang || '').toLowerCase().includes('media')),
      },
      { label: 'Audit Log', path: '/audit-log', module: 'sistem', icon: ShieldCheck },
      { label: 'Status Sistem', path: '/status-sistem', module: 'sistem', icon: ServerCog },
      { label: 'Perlindungan', path: '/perlindungan', module: 'perlindungan', icon: ShieldAlert },
      { label: 'Evaluasi', path: '/evaluasi', module: 'evaluasi', icon: Award },
    ],
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    user,
    currentPath,
    navigate,
    theme,
    toggleTheme,
    logout,
    can,
    isDemoMode,
    offline,
    refreshUser,
    idleWarningSecondsLeft,
    extendSession,
  } = useAuth();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
        setNotifOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!user) return;
    apiGet<{ notifications: NotificationRecord[] }>('/api/notifications')
      .then((d) => setNotifications(d.notifications))
      .catch(() => {});
  }, [user, currentPath]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const markAllRead = async () => {
    try {
      await apiPost('/api/notifications/read-all');
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch {
      // ignore
    }
  };

  const toggleGroup = (id: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const baseActivePath = resolveBaseNavPath(currentPath);
  const activeGroup = NAV_GROUPS.find((g) => g.items.some((i) => i.path === baseActivePath));
  const pageTitle = getRouteTitle(currentPath);

  const initials = (user?.fullName || 'DP')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');

  const SidebarBody = (
    <div className="flex flex-col h-full">
      {/* Brand header */}
      <div className="flex items-center justify-between gap-2 px-3.5 h-14 border-b border-slate-200/80 dark:border-slate-800 shrink-0">
        <button
          type="button"
          onClick={() => {
            navigate('/dashboard');
            setMobileOpen(false);
          }}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <img
            src="/assets/aistudio/logosd_69efa81d.jpg"
            alt="Logo SATU DPBI"
            referrerPolicy="no-referrer"
            className="w-8 h-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
          />
          {!collapsed && (
            <div className="min-w-0">
              <p className="font-display text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap truncate">
                SATU <span className="text-[#0EA5E9]">DPBI</span>
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                Satu Sistem, Satu Data
              </p>
            </div>
          )}
        </button>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className="hidden lg:inline-flex p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Tutup menu navigasi"
          className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Grouped navigation with collapsible submenus */}
      <nav aria-label="Navigasi Portal Internal" className="flex-1 overflow-y-auto px-2.5 py-3 space-y-3">
        {NAV_GROUPS.map((grp) => {
          const visibleItems = grp.items.filter((item) => {
            if (item.canShow) return item.canShow(user, can);
            return !item.module || can(item.module, item.action || 'view');
          });
          if (visibleItems.length === 0) return null;
          const isGroupCollapsed = Boolean(collapsedGroups[grp.id]) && !collapsed;

          return (
            <div key={grp.id}>
              {!collapsed && (
                grp.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(grp.id)}
                    aria-expanded={!isGroupCollapsed}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded-lg transition-colors"
                  >
                    <span>{grp.group}</span>
                    {isGroupCollapsed ? (
                      <ChevronRight className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                ) : (
                  <p className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {grp.group}
                  </p>
                )
              )}

              {!isGroupCollapsed && (
                <div className="space-y-0.5 mt-0.5">
                  {visibleItems.map((item) => {
                    const Icon = item.icon;
                    const active = baseActivePath === item.path;
                    return (
                      <button
                        key={item.path}
                        type="button"
                        onClick={() => {
                          navigate(item.path);
                          setMobileOpen(false);
                        }}
                        title={collapsed ? item.label : undefined}
                        aria-current={active ? 'page' : undefined}
                        className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'gap-2.5 px-3'} min-h-[44px] lg:min-h-[38px] py-2 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                          active
                            ? 'bg-[#0EA5E9] text-white shadow-sm'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                        }`}
                      >
                        <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Compact User Footer */}
      {user && (
        <div className="p-2.5 border-t border-slate-200/80 dark:border-slate-800 shrink-0">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between gap-2'}`}>
            {!collapsed && (
              <button
                type="button"
                onClick={() => {
                  navigate('/pengaturan');
                  setMobileOpen(false);
                }}
                className="flex items-center gap-2.5 min-w-0 text-left hover:opacity-85 transition-opacity"
              >
                <div className="w-8 h-8 rounded-lg bg-[#0EA5E9]/10 text-[#0EA5E9] font-bold text-xs flex items-center justify-center shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">{user.fullName}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {user.roleLabel}{user.provinceName ? ` · ${user.provinceName}` : ''}
                  </p>
                </div>
              </button>
            )}
            <button
              type="button"
              onClick={logout}
              aria-label="Keluar dari portal"
              title="Keluar"
              className="p-2 min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 border-r border-slate-200/80 dark:border-slate-800 glass-sidebar sticky top-0 h-screen transition-all duration-200 no-print ${
          collapsed ? 'w-[72px]' : 'w-64'
        }`}
      >
        {SidebarBody}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] h-full bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-10">
            {SidebarBody}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0">
        {offline && <OfflineBanner onRetry={refreshUser} />}

        {isDemoMode && (
          <div className="bg-amber-50/90 dark:bg-amber-950/70 border-b border-amber-200 dark:border-amber-800 px-4 py-1 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between gap-2 no-print">
            <span className="truncate">
              <strong>Mode Simulasi Aktif</strong> — Database demo terpisah untuk evaluasi fitur & peran.
            </span>
            <span className="hidden sm:inline font-semibold shrink-0">Simulasi Internal</span>
          </div>
        )}

        {/* Compact Top Header */}
        <header className="sticky top-0 z-30 glass-sidebar border-b border-slate-200/80 dark:border-slate-800 px-4 lg:px-6 h-14 flex items-center justify-between gap-3 no-print">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Buka menu navigasi"
              className="lg:hidden min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>
            <nav aria-label="Breadcrumb" className="min-w-0 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="hidden sm:inline whitespace-nowrap hover:text-[#0EA5E9]"
              >
                SATU DPBI
              </button>
              {activeGroup && (
                <>
                  <span className="hidden md:inline" aria-hidden="true">/</span>
                  <span className="hidden md:inline whitespace-nowrap text-slate-500 dark:text-slate-400">
                    {activeGroup.group}
                  </span>
                </>
              )}
              <span className="hidden sm:inline" aria-hidden="true">/</span>
              <span className="truncate font-semibold text-slate-900 dark:text-white">{pageTitle}</span>
            </nav>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Buka pencarian global"
              className="inline-flex items-center gap-2 px-3 py-1.5 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-xs text-slate-500 dark:text-slate-400 hover:border-[#0EA5E9] transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="hidden sm:inline whitespace-nowrap">Cari cepat...</span>
              <kbd className="hidden md:inline font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
              className="p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:border-[#0EA5E9] transition-colors"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Notifications popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((v) => !v);
                  setProfileOpen(false);
                }}
                aria-label="Pusat Notifikasi"
                className="relative p-2 min-w-[36px] min-h-[36px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-300 hover:border-[#0EA5E9] transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#0EA5E9] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 max-w-[90vw] rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-3 z-40">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white">Notifikasi Terbaru</span>
                    <button
                      type="button"
                      onClick={markAllRead}
                      className="text-[11px] font-medium text-[#0EA5E9] hover:underline"
                    >
                      Tandai semua dibaca
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {notifications.length === 0 ? (
                      <p className="py-6 text-center text-xs text-slate-500">Belum ada notifikasi baru.</p>
                    ) : (
                      notifications.slice(0, 6).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            navigate(n.targetPath);
                          }}
                          className="w-full text-left py-2.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-800/60 rounded-lg transition-colors"
                        >
                          <p className={`text-xs font-semibold ${n.isRead ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{n.message}</p>
                          <p className="text-[10px] text-slate-400 mt-1 tabular-nums">{formatTanggalIndonesia(n.createdAt, true)}</p>
                        </button>
                      ))
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      navigate('/notifikasi');
                    }}
                    className="w-full mt-2 py-1.5 text-center text-xs font-semibold text-[#0EA5E9] hover:bg-sky-50 dark:hover:bg-slate-800 rounded-lg"
                  >
                    Lihat Semua Notifikasi
                  </button>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            {user && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setProfileOpen((v) => !v);
                    setNotifOpen(false);
                  }}
                  aria-label="Menu profil pengguna"
                  className="inline-flex items-center gap-2 pl-2 pr-2.5 py-1 min-h-[36px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 hover:border-[#0EA5E9] transition-colors"
                >
                  <span className="w-6 h-6 rounded-lg bg-[#0EA5E9] text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials}
                  </span>
                  <span className="hidden md:inline text-xs font-medium text-slate-800 dark:text-slate-200 max-w-[120px] truncate">
                    {user.fullName.split(' ')[0]}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden md:inline" />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl p-2 z-40">
                    <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user.fullName}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {user.roleLabel}{user.provinceName ? ` · ${user.provinceName}` : ''}
                      </p>
                    </div>
                    <div className="py-1 space-y-0.5 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/pengaturan');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                      >
                        <UserCheck className="w-3.5 h-3.5 text-[#0EA5E9]" />
                        <span>Profil, Sesi & Pengaturan Akun</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/bantuan');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                      >
                        <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Pusat Bantuan Internal</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          navigate('/tentang');
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                      >
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span>Website Publik DPBI</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setProfileOpen(false);
                          logout();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 text-left font-medium"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Keluar dari Portal</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 p-4 lg:p-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        {/* Quiet Institutional Copyright Footer */}
        <footer className="border-t border-slate-200/80 dark:border-slate-800/80 px-4 lg:px-6 py-3.5 text-[11px] text-slate-500 dark:text-slate-400 no-print">
          <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <p>
              Hak Cipta © {new Date().getFullYear()} Duta Pelajar Berbudaya Indonesia (DPBI) ·{' '}
              <span className="font-medium text-slate-700 dark:text-slate-300">SATU DPBI</span> — Satu Sistem, Satu Data, Satu Koordinasi.
            </p>
            <div className="flex flex-wrap items-center gap-4 font-medium shrink-0">
              <button
                type="button"
                onClick={() => navigate('/privasi')}
                className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap"
              >
                Kebijakan Privasi
              </button>
              <button
                type="button"
                onClick={() => navigate('/ketentuan')}
                className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap"
              >
                Hak Cipta &amp; Ketentuan
              </button>
              <button
                type="button"
                onClick={() => navigate('/bantuan')}
                className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap"
              >
                Pusat Bantuan
              </button>
            </div>
          </div>
        </footer>
      </div>

      {/* Idle Timeout Pre-Expiry Warning Dialog */}
      {idleWarningSecondsLeft !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm"
          role="alertdialog"
          aria-modal="true"
          aria-label="Peringatan Batas Waktu Tidak Aktif"
        >
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center shrink-0">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Sesi Akan Segera Berakhir</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Tidak ada aktivitas terdeteksi di portal.
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Demi keamanan data DPBI, sesi Anda akan otomatis berakhir dalam{' '}
              <span className="font-mono font-bold text-amber-600 tabular-nums">{idleWarningSecondsLeft} detik</span>.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={logout}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Keluar Sekarang
              </button>
              <button
                type="button"
                onClick={extendSession}
                className="px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
              >
                Perpanjang Sesi
              </button>
            </div>
          </div>
        </div>
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
