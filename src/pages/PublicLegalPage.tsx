import React, { useEffect, useState } from 'react';
import { ArrowLeft, BookOpen, Copyright, Lock, Mail, MapPin, ShieldCheck } from 'lucide-react';
import { apiGet } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { PublicFooter, PublicNavbar } from '../components/public/PublicChrome';
import { GlassCard } from '../components/ui/Primitives';

interface PublicCmsPayload {
  cms?: Record<string, { title: string; body: string }>;
}

export function PublicLegalPage({ section }: { section: 'privasi' | 'ketentuan' }) {
  const { user, navigate } = useAuth();
  const [cms, setCms] = useState<Record<string, { title: string; body: string }>>({});

  useEffect(() => {
    apiGet<PublicCmsPayload>('/api/public/overview', true)
      .then((d) => {
        if (d.cms) setCms(d.cms);
      })
      .catch(() => {});
  }, []);

  const currentYear = new Date().getFullYear();
  const officialContact =
    cms.official_contact?.body ||
    'Sekretariat Nasional Duta Pelajar Berbudaya Indonesia (DPBI)\nEmail Resmi: sekretariat@dpbi.or.id';

  const content = (
    <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-10 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0EA5E9]">
            Tata Kelola &amp; Kepastian Hukum Organisasi
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {section === 'privasi'
              ? 'Kebijakan Privasi & Perlindungan Data Pelajar'
              : 'Hak Cipta, Kekayaan Intelektual & Ketentuan Penggunaan'}
          </h1>
        </div>
        <div className="inline-flex items-center p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
          <button
            type="button"
            onClick={() => navigate('/privasi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              section === 'privasi'
                ? 'bg-white dark:bg-slate-900 text-[#0EA5E9] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Kebijakan Privasi
          </button>
          <button
            type="button"
            onClick={() => navigate('/ketentuan')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap ${
              section === 'ketentuan'
                ? 'bg-white dark:bg-slate-900 text-[#0EA5E9] shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Hak Cipta &amp; Ketentuan
          </button>
        </div>
      </div>

      {section === 'privasi' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-8 p-6 space-y-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <ShieldCheck className="w-4 h-4" />
                <span>01. Prinsip Minimalisasi &amp; Tujuan Penggunaan Data</span>
              </div>
              <p>
                SATU DPBI (<em>Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia</em>) mengumpulkan data pribadi pelajar hanya sejauh yang diperlukan untuk administrasi keanggotaan resmi, verifikasi status pelajar, pelaksanaan kegiatan, dan keselamatan peserta didik.
              </p>
              <p>
                Sistem tidak mengumpulkan Nomor Induk Kependudukan (NIK), rekam medis, atau data agama yang tidak relevan dengan kebutuhan operasional organisasi.
              </p>
            </section>

            <section className="space-y-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <Lock className="w-4 h-4" />
                <span>02. Pemisahan Data Publik &amp; Berkas Privat</span>
              </div>
              <ul className="list-disc pl-5 space-y-1.5 text-xs sm:text-sm">
                <li>
                  Website publik hanya menayangkan data agregat tingkat provinsi/kabupaten/kota serta pengumuman resmi yang telah disetujui untuk publikasi.
                </li>
                <li>
                  Kartu pelajar, surat rekomendasi sekolah, surat izin orang tua/wali, kontak wali, alamat lengkap, dan NISN disimpan di penyimpanan privat terautentikasi dan tidak dapat diakses tanpa otorisasi RBAC.
                </li>
                <li>
                  Peta publik maupun peta internal tidak pernah memetakan titik koordinat rumah tinggal pribadi Duta.
                </li>
              </ul>
            </section>

            <section className="space-y-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <BookOpen className="w-4 h-4" />
                <span>03. Masa Retensi, Akses Alumni 30 Hari &amp; Hak Subjek Data</span>
              </div>
              <p>
                Setelah masa tugas berakhir, Alumni memperoleh akses arsip pribadi selama 30 hari dengan pengingat otomatis pada hari ke-7, ke-3, dan hari terakhir untuk mengunduh dokumen miliknya. Perpanjangan akses hanya dapat disetujui Super Admin dengan alasan resmi dan tercatat pada audit log.
              </p>
            </section>
          </GlassCard>

          <GlassCard className="lg:col-span-4 p-6 space-y-4 h-fit">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#0EA5E9]" />
              <span>Kontak Permintaan Data &amp; Privasi</span>
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {officialContact}
            </p>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate(user ? '/dashboard' : '/')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{user ? 'Kembali ke Dashboard' : 'Kembali ke Beranda Publik'}</span>
              </button>
            </div>
          </GlassCard>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-8 p-6 space-y-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            <section className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <Copyright className="w-4 h-4" />
                <span>01. Pemberitahuan Hak Cipta &amp; Kekayaan Intelektual</span>
              </div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Hak Cipta © {currentYear} Duta Pelajar Berbudaya Indonesia (DPBI). Seluruh hak cipta dilindungi undang-undang.
              </p>
              <p>
                Nama <strong>Duta Pelajar Berbudaya Indonesia (DPBI)</strong>, identitas platform <strong>SATU DPBI</strong>, semboyan <em>&ldquo;Satu Sistem, Satu Data, Satu Koordinasi&rdquo;</em> dan <em>&ldquo;Berbudaya, Bergerak, dan Berdampak Untuk Negeri&rdquo;</em>, logo resmi DPBI, tata letak dokumen surat/SK/sertifikat, serta materi pembekalan merupakan milik organisasi DPBI di bawah naungan yayasan.
              </p>
              <p>
                Penggunaan logo atau nama DPBI pada proposal maupun kegiatan eksternal wajib memperoleh persetujuan Pengurus Nasional sesuai bidang yang berwenang.
              </p>
            </section>

            <section className="space-y-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <ShieldCheck className="w-4 h-4" />
                <span>02. Penafian Status Organisasi Independen</span>
              </div>
              <p>
                DPBI merupakan organisasi kepemimpinan pelajar independen di bawah naungan yayasan. DPBI bukan bagian dari kementerian, pemerintah daerah, atau instansi pemerintah mana pun kecuali dinyatakan secara tertulis berdasarkan perjanjian kerja sama resmi.
              </p>
            </section>

            <section className="space-y-2 pt-4 border-t border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <MapPin className="w-4 h-4" />
                <span>03. Atribusi Data Geospasial &amp; Lisensi Terbuka</span>
              </div>
              <p>
                Batas wilayah administratif 38 Provinsi dan Kabupaten/Kota Indonesia bersumber dari data geospasial referensi Badan Informasi Geospasial (BIG) &amp; Badan Pusat Statistik (BPS) yang didokumentasikan dan digunakan sesuai ketentuan lisensi MIT / CC BY 4.0.
              </p>
            </section>
          </GlassCard>

          <GlassCard className="lg:col-span-4 p-6 space-y-4 h-fit">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Ketentuan Penggunaan Akun Internal
            </h2>
            <ul className="list-disc pl-4 space-y-2 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              <li>Akses portal bersifat personal melalui undangan resmi dan tidak dapat dipindahtangankan.</li>
              <li>Seluruh tindakan administratif, persetujuan proposal, dan pengunduhan dokumen terekam dalam audit log keamanan.</li>
              <li>Pengurus dilarang menggandakan atau mempublikasikan data pribadi peserta didik di luar sistem tanpa izin resmi.</li>
            </ul>
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => navigate(user ? '/dashboard' : '/')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{user ? 'Kembali ke Dashboard' : 'Kembali ke Beranda Publik'}</span>
              </button>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  );

  if (user) {
    return content;
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
      <PublicNavbar />
      <main className="flex-1">{content}</main>
      <PublicFooter />
    </div>
  );
}
