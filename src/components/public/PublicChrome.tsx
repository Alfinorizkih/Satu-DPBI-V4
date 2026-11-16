import React, { useState } from 'react';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Primitives';

const PUBLIC_LINKS = [
  { label: 'Beranda', path: '/' },
  { label: 'Tentang DPBI', path: '/tentang' },
  { label: 'Persebaran Wilayah', path: '/wilayah' },
  { label: 'Bantuan', path: '/bantuan' },
];

export function PublicNavbar() {
  const { currentPath, navigate, theme, toggleTheme } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (path: string) => {
    if (path === '/') return currentPath === '/';
    return currentPath === path || currentPath.startsWith(`${path}/`);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Logo & Name */}
        <button
          type="button"
          onClick={() => {
            navigate('/');
            setMobileOpen(false);
          }}
          className="flex items-center gap-3 whitespace-nowrap shrink-0 text-left"
        >
          <img
            src="/assets/aistudio/logosd_69efa81d.jpg"
            alt="Logo Resmi DPBI"
            referrerPolicy="no-referrer"
            className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            SATU <span className="text-[#0EA5E9]">DPBI</span>
          </span>
        </button>

        {/* Zone 2: 4 Clean Public Links */}
        <nav aria-label="Navigasi Publik" className="hidden md:flex items-center gap-7">
          {PUBLIC_LINKS.map((link) => {
            const active = isActive(link.path);
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => navigate(link.path)}
                aria-current={active ? 'page' : undefined}
                className={`text-sm font-medium transition-colors whitespace-nowrap shrink-0 py-1 border-b-2 ${
                  active
                    ? 'text-[#0EA5E9] border-[#0EA5E9] font-semibold'
                    : 'text-slate-600 dark:text-slate-300 border-transparent hover:text-[#0EA5E9]'
                }`}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Theme Toggle + Primary Portal Entry CTA */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'light' ? 'Aktifkan mode gelap' : 'Aktifkan mode terang'}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-[#0EA5E9] transition-colors shrink-0"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={() => {
              navigate('/login');
              setMobileOpen(false);
            }}
            className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 shadow-xs transition-colors"
          >
            <span>Masuk SATU DPBI</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-label={mobileOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
            aria-expanded={mobileOpen}
            className="md:hidden min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 px-4 py-4 space-y-2">
          {PUBLIC_LINKS.map((link) => {
            const active = isActive(link.path);
            return (
              <button
                key={link.path}
                type="button"
                onClick={() => {
                  navigate(link.path);
                  setMobileOpen(false);
                }}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  active
                    ? 'bg-sky-50 dark:bg-sky-950/50 text-[#0EA5E9] font-semibold'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900'
                }`}
              >
                {link.label}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              navigate('/login');
              setMobileOpen(false);
            }}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0EA5E9] text-white text-sm font-semibold mt-2"
          >
            <span>Masuk SATU DPBI</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </header>
  );
}

export function PublicFooter() {
  const { navigate } = useAuth();
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <>
      <footer className="border-t border-slate-200/80 dark:border-slate-800 bg-white/75 dark:bg-slate-950/75 py-8 px-4 sm:px-6 text-xs text-slate-500 dark:text-slate-400 no-print">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-1">
            <p className="font-display font-bold text-slate-900 dark:text-white text-sm">
              Duta Pelajar Berbudaya Indonesia (DPBI)
            </p>
            <p>
              Organisasi Pelajar Independen di Bawah Naungan Yayasan · Satu Sistem, Satu Data, Satu Koordinasi.
            </p>
            <p className="text-[11px] text-slate-400">
              © {new Date().getFullYear()} SATU DPBI — Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-medium">
            {PUBLIC_LINKS.map((l) => (
              <button
                key={l.path}
                type="button"
                onClick={() => navigate(l.path)}
                className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap"
              >
                {l.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap font-semibold text-slate-800 dark:text-slate-200"
            >
              Portal Masuk
            </button>
            <button
              type="button"
              onClick={() => setPrivacyOpen(true)}
              className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap"
            >
              Privasi &amp; Perlindungan Data
            </button>
          </div>
        </div>
      </footer>

      <Modal
        open={privacyOpen}
        onClose={() => setPrivacyOpen(false)}
        title="Kebijakan Privasi & Perlindungan Data Pelajar"
      >
        <div className="space-y-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <p>
            SATU DPBI menerapkan prinsip minimalisasi data (<em>data minimization</em>), pembatasan tujuan (<em>purpose limitation</em>), dan pengendalian akses berbasis peran (RBAC) untuk melindungi data pribadi peserta didik dan pengurus.
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-xs">
            <li>
              Halaman publik DPBI hanya menampilkan ringkasan agregat wilayah, kegiatan terverifikasi, dan pengumuman yang disetujui publik tanpa data identitas pribadi peserta didik.
            </li>
            <li>
              Dokumen identitas (kartu pelajar, surat izin wali, alamat rinci, kontak orang tua/wali, dan NISN) tersimpan di penyimpanan privat terautentikasi dan disamarkan bagi pihak yang tidak berwenang.
            </li>
            <li>
              Verifikasi koordinat Koordinator Wilayah hanya dilakukan atas permintaan saat pelaporan resmi wilayah tanpa pelacakan latar belakang.
            </li>
            <li>
              Alumni memperoleh akses arsip pribadi selama 30 hari setelah masa tugas berakhir dan dapat mengekspor salinan datanya secara mandiri.
            </li>
          </ul>
        </div>
      </Modal>
    </>
  );
}
