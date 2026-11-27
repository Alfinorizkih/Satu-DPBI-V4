import React, { useEffect, useState } from 'react';
import { ArrowRight, Clock, Command, Search, X } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import type { ModuleCode } from '../lib/types';

const QUICK_ROUTES: { label: string; path: string; module?: ModuleCode }[] = [
  { label: 'Buka Dashboard & Command Center', path: '/dashboard', module: 'dashboard' },
  { label: 'Aktivitas Saya', path: '/aktivitas-saya', module: 'dashboard' },
  { label: 'Tugas Saya (Fokus Pribadi)', path: '/tugas-saya', module: 'tugas' },
  { label: 'Data Personalia & Profil Duta', path: '/personalia', module: 'personalia' },
  { label: 'Peta & Pengelolaan 38 Provinsi', path: '/wilayah', module: 'wilayah' },
  { label: 'Manajemen Batch & Angkatan', path: '/angkatan', module: 'angkatan' },
  { label: 'Direktori & Akses Alumni', path: '/alumni', module: 'arsip' },
  { label: 'Program Unggulan Nasional DPBI', path: '/program', module: 'program' },
  { label: 'Persuratan & Disposisi Digital', path: '/persuratan', module: 'persuratan' },
  { label: 'Pusat Persetujuan Nasional (Approval Queue)', path: '/persetujuan', module: 'persetujuan' },
  { label: 'Pengajuan & Persetujuan Proposal', path: '/proposal', module: 'proposal' },
  { label: 'Laporan Kegiatan Lapangan (LKL)', path: '/laporan-kegiatan', module: 'lkl' },
  { label: 'Laporan Koordinator Wilayah', path: '/laporan-koordinator', module: 'laporan_koordinator' },
  { label: 'Task Management Center', path: '/tugas', module: 'tugas' },
  { label: 'Digital Document Center & SOP', path: '/dokumen', module: 'dokumen' },
  { label: 'Pusat Email & Pengiriman Massal', path: '/email', module: 'email' },
  { label: 'Kalender Organisasi', path: '/kalender', module: 'kalender' },
  { label: 'Arsip Organisasi & Ekspor', path: '/arsip', module: 'arsip' },
  { label: 'Perlindungan Peserta & Pengaduan', path: '/perlindungan', module: 'perlindungan' },
  { label: 'Audit Log Keamanan', path: '/audit-log', module: 'sistem' },
  { label: 'Status & Kesehatan Sistem', path: '/status-sistem', module: 'sistem' },
  { label: 'Perangkat & Sesi Aktif', path: '/pengaturan/sesi', module: 'pengaturan' },
  { label: 'Hak Akses & Peran (RBAC)', path: '/pengaturan/hak-akses', module: 'pengaturan' },
  { label: 'Pengaturan & Keamanan Akun', path: '/pengaturan', module: 'pengaturan' },
  { label: 'Pusat Bantuan Internal', path: '/bantuan' },
];

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { navigate, can, recentlyViewed } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ type: string; title: string; subtitle: string; path: string }[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setResults([]);
      return;
    }
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiGet<{ results: { type: string; title: string; subtitle: string; path: string }[] }>(
          `/api/search?q=${encodeURIComponent(query.trim())}`
        );
        setResults(res.results);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [query, open]);

  if (!open) return null;

  const filteredRoutes = QUICK_ROUTES.filter(
    (r) =>
      (!r.module || can(r.module, 'view')) &&
      (!query.trim() || r.label.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-slate-950/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pencarian Global dan Command Palette"
    >
      <div className="w-full max-w-xl rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari personel, nomor referensi DPBI, provinsi, proposal, dokumen, atau menu..."
            className="w-full bg-transparent text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup Command Palette"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-3 space-y-4">
          {searching && <p className="text-xs text-slate-500 px-2">Mencari di database terpadu...</p>}

          {!query.trim() && recentlyViewed.length > 0 && (
            <div>
              <p className="px-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Terakhir Dibuka
              </p>
              <div className="space-y-1">
                {recentlyViewed.slice(0, 4).map((item) => (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      navigate(item.path);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 truncate">
                      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400 shrink-0">{item.path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {results.length > 0 && (
            <div>
              <p className="px-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                Hasil Data Terkait
              </p>
              <div className="space-y-1">
                {results.map((item, idx) => (
                  <button
                    key={`${item.path}-${idx}`}
                    type="button"
                    onClick={() => {
                      navigate(item.path);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left hover:bg-sky-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.type} · {item.subtitle}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="px-2 text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
              Navigasi Cepat
            </p>
            <div className="space-y-1">
              {filteredRoutes.map((route) => (
                <button
                  key={route.path}
                  type="button"
                  onClick={() => {
                    navigate(route.path);
                    onClose();
                  }}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <span className="text-sm text-slate-700 dark:text-slate-200">{route.label}</span>
                  <span className="font-mono text-[11px] text-slate-400">{route.path}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 dark:bg-slate-950/60 border-t border-slate-200 dark:border-slate-800 text-[11px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5" /> Hasil pencarian mengikuti izin role Anda
          </span>
          <span>ESC untuk tutup</span>
        </div>
      </div>
    </div>
  );
}
