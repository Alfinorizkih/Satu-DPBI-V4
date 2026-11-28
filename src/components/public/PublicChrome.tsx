import React, { useState } from 'react';
import { ArrowRight, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Primitives';

const PUBLIC_LINKS = [
  { label: 'Beranda', path: '/' },
  { label: 'Program Unggulan', path: '/program' },
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
            src="/assets/aistudio/icon-utama_7bb14cc7.png"
            alt="Logo Utama SATU DPBI"
            referrerPolicy="no-referrer"
            className="h-9 w-auto object-contain rounded-lg bg-white px-1.5 py-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
          />
          <span className="sr-only">SATU DPBI</span>
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
  const { navigate, appVersion } = useAuth();
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const currentYear = new Date().getFullYear();

  return (
    <>
      <footer className="border-t border-slate-200/90 dark:border-slate-800 bg-white/85 dark:bg-slate-950/90 pt-10 pb-8 px-4 sm:px-6 text-xs text-slate-600 dark:text-slate-400 no-print">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
            {/* Column 1: Institutional Identity */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center gap-3">
                <img
                  src="/assets/aistudio/icon-utama_7bb14cc7.png"
                  alt="Logo Utama SATU DPBI"
                  referrerPolicy="no-referrer"
                  className="h-11 w-auto object-contain rounded-xl bg-white px-2 py-1 border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div>
                  <p className="font-display font-bold text-slate-900 dark:text-white text-sm">
                    SATU <span className="text-[#0EA5E9]">DPBI</span>
                  </p>
                  <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                    Duta Pelajar Berbudaya Indonesia (DPBI)
                  </p>
                </div>
              </div>
              <p className="leading-relaxed max-w-md text-slate-600 dark:text-slate-400">
                Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia — organisasi kepemimpinan pelajar independen di bawah naungan yayasan dengan fokus literasi budaya dan kolaborasi 38 provinsi.
              </p>
              <div className="flex items-center gap-3 pt-1">
                <img
                  src="/assets/aistudio/logotp_bf31c116.png"
                  alt="Lambang Duta Pelajar Berbudaya Indonesia"
                  referrerPolicy="no-referrer"
                  className="w-11 h-11 rounded-full object-contain bg-white p-0.5 border border-slate-200 dark:border-slate-700 shrink-0"
                />
                <div>
                  <p className="text-[11px] font-semibold text-slate-800 dark:text-slate-200">
                    Didukung &amp; Dikelola Oleh Duta Pelajar Berbudaya Indonesia
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Satu Sistem, Satu Data, Satu Koordinasi · Berbudaya, Bergerak, Berdampak Untuk Negeri.
                  </p>
                </div>
              </div>
            </div>

            {/* Column 2: Portal Navigation */}
            <div className="lg:col-span-2 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Navigasi Portal
              </p>
              <ul className="space-y-2 font-medium">
                {PUBLIC_LINKS.map((l) => (
                  <li key={l.path}>
                    <button
                      type="button"
                      onClick={() => navigate(l.path)}
                      className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap"
                    >
                      {l.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/login')}
                    className="hover:text-[#0EA5E9] transition-colors whitespace-nowrap font-semibold text-slate-900 dark:text-slate-100"
                  >
                    Portal Masuk Internal
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Legal, Copyright & Data Protection */}
            <div className="lg:col-span-3 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Hak Cipta &amp; Tata Kelola
              </p>
              <ul className="space-y-2 font-medium">
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/privasi')}
                    className="hover:text-[#0EA5E9] transition-colors text-left"
                  >
                    Kebijakan Privasi &amp; Data Pelajar
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate('/ketentuan')}
                    className="hover:text-[#0EA5E9] transition-colors text-left"
                  >
                    Hak Cipta &amp; Ketentuan Penggunaan
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setPrivacyOpen(true)}
                    className="hover:text-[#0EA5E9] transition-colors text-left"
                  >
                    Ringkasan Perlindungan Data
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 4: Official Secretariat Contact */}
            <div className="lg:col-span-2 space-y-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                Sekretariat Resmi
              </p>
              <div className="space-y-1.5 text-slate-600 dark:text-slate-400 leading-relaxed">
                <p>Sekretariat Nasional DPBI</p>
                <p>
                  Email:{' '}
                  <a
                    href="mailto:sekretariat@dpbi.or.id"
                    className="font-medium text-slate-800 dark:text-slate-200 hover:text-[#0EA5E9] transition-colors"
                  >
                    sekretariat@dpbi.or.id
                  </a>
                </p>
                <p className="text-[11px]">Senin–Jumat · 09:00–17:00 WIB</p>
              </div>
            </div>
          </div>

          {/* Bottom Copyright, Intellectual Property & Geospatial Attribution Strip */}
          <div className="pt-6 border-t border-slate-200/80 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="space-y-1">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Hak Cipta © {currentYear} Duta Pelajar Berbudaya Indonesia (DPBI) · SATU DPBI v{appVersion}. Seluruh hak cipta dilindungi undang-undang.
              </p>
              <p>
                Nama, logo resmi DPBI, identitas SATU DPBI, serta materi dan dokumen resmi organisasi merupakan kekayaan intelektual DPBI (organisasi independen di bawah naungan yayasan) · <em>Berbudaya, Bergerak, dan Berdampak Untuk Negeri.</em>
              </p>
            </div>
            <div className="lg:text-right shrink-0 space-y-0.5">
              <p>Batas wilayah: GeoJSON 38 Provinsi &amp; Kab/Kota (BIG/BPS · MIT / CC BY 4.0)</p>
              <p>Akses Portal Resmi Berbasis Undangan &amp; RBAC</p>
            </div>
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
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                setPrivacyOpen(false);
                navigate('/privasi');
              }}
              className="px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
            >
              Baca Kebijakan Lengkap
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
