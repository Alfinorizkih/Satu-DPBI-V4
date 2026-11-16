import React, { useEffect, useState } from 'react';
import { ArrowRight, Building2, Compass, Mail, ShieldCheck } from 'lucide-react';
import { apiGet } from '../lib/api';
import { OFFICIAL_BIDANGS } from '../lib/rbac';
import { useAuth } from '../context/AuthContext';
import { PublicFooter, PublicNavbar } from '../components/public/PublicChrome';
import { GlassCard } from '../components/ui/Primitives';

interface PublicCmsPayload {
  cms?: Record<string, { title: string; body: string; updatedAt?: string }>;
}

export function PublicAboutPage() {
  const { navigate } = useAuth();
  const [cms, setCms] = useState<Record<string, { title: string; body: string }>>({});

  useEffect(() => {
    apiGet<PublicCmsPayload>('/api/public/overview', true)
      .then((d) => {
        if (d.cms) setCms(d.cms);
      })
      .catch(() => {});
  }, []);

  const about = cms.about_dpbi;
  const vision = cms.vision_mission;
  const contact = cms.official_contact;
  const social = cms.social_links;

  return (
    <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
      <PublicNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-10 space-y-10">
        {/* Heading */}
        <section className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0EA5E9]">
            Tentang Organisasi
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight">
            {about?.title || 'Duta Pelajar Berbudaya Indonesia (DPBI)'}
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
            {about?.body ||
              'Duta Pelajar Berbudaya Indonesia (DPBI) adalah organisasi kepemimpinan pelajar independen di bawah naungan yayasan yang membina pelajar di 38 provinsi.'}
          </p>
        </section>

        {/* Vision, Mission & Governance */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <GlassCard className="lg:col-span-7 p-6 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
              <Compass className="w-4 h-4" />
              <span>Arah Gerakan</span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              {vision?.title || 'Visi, Misi, dan Prinsip Tata Kelola'}
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {vision?.body ||
                'Mewujudkan generasi pelajar Indonesia yang berakar pada nilai budaya Nusantara, aktif bergerak di daerahnya, dan memberi dampak sosial yang terukur.'}
            </p>
          </GlassCard>

          <GlassCard className="lg:col-span-5 p-6 space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
              <ShieldCheck className="w-4 h-4" />
              <span>Tata Kelola Independen</span>
            </div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Kejelasan Status &amp; Perlindungan Pelajar
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              DPBI berdiri sebagai organisasi pelajar independen di bawah naungan yayasan, bukan bagian dari kementerian atau instansi pemerintah. Seluruh administrasi internal dikelola melalui SATU DPBI dengan kontrol akses RBAC yang ketat untuk melindungi data pribadi pelajar.
            </p>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
                <Mail className="w-3.5 h-3.5 text-[#0EA5E9]" />
                <span>{contact?.title || 'Sekretariat Nasional & Kontak Resmi'}</span>
              </div>
              <p className="whitespace-pre-line">{contact?.body || 'Email Resmi: sekretariat@dpbi.or.id'}</p>
              {social?.body && <p className="text-[11px] text-slate-500">{social.body}</p>}
            </div>
          </GlassCard>
        </section>

        {/* 6 Official Bidang */}
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-[#0EA5E9]">
                <Building2 className="w-4 h-4" />
                <span>Struktur Pengurus Nasional</span>
              </div>
              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white mt-1">
                6 Bidang Resmi Kepengurusan DPBI
              </h2>
            </div>
            <button
              type="button"
              onClick={() => navigate('/wilayah')}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline whitespace-nowrap shrink-0"
            >
              <span>Lihat Persebaran Wilayah</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {OFFICIAL_BIDANGS.map((b) => (
              <GlassCard key={b.id} className="p-5 space-y-2">
                <p className="font-mono text-xs font-bold text-[#0EA5E9] tabular-nums">{b.number}.</p>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">{b.id}</h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{b.summary}</p>
              </GlassCard>
            ))}
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
