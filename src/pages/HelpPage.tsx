import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Compass,
  HelpCircle,
  LifeBuoy,
  PlayCircle,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import { DPBI_GLOSSARY, FAQ_ITEMS, ROLE_TOURS } from '../lib/guidance';
import { ROLE_LABELS } from '../lib/rbac';
import type { HelpArticleRecord, RoleCode } from '../lib/types';
import { PublicFooter, PublicNavbar } from '../components/public/PublicChrome';
import { GlassCard, SearchBar } from '../components/ui/Primitives';

type HelpTab = 'artikel' | 'alur' | 'faq' | 'glosarium';

const ROLE_ORDER: RoleCode[] = [
  'duta',
  'koordinator_wilayah',
  'sekretariat_nasional',
  'pengurus_nasional',
  'penanggung_jawab',
  'wakil_super_admin',
  'super_admin',
  'alumni',
];

export function HelpPage() {
  const { user, setTourOpen, navigate } = useAuth();
  const [articles, setArticles] = useState<HelpArticleRecord[]>([]);
  const [activeTab, setActiveTab] = useState<HelpTab>('artikel');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [openFaqId, setOpenFaqId] = useState<string | null>(FAQ_ITEMS[0]?.id ?? null);
  const [guideRole, setGuideRole] = useState<RoleCode>(user?.role ?? 'duta');

  useEffect(() => {
    if (user?.role) setGuideRole(user.role);
  }, [user?.role]);

  useEffect(() => {
    apiGet<{ articles: HelpArticleRecord[] }>('/api/public/help', true)
      .then((d) => {
        setArticles(d.articles || []);
        if (d.articles?.length) setOpenId(d.articles[0].id);
      })
      .catch(() => {});
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(articles.map((a) => a.category))).sort(),
    [articles]
  );

  const q = search.trim().toLowerCase();

  const filteredArticles = useMemo(() => {
    return articles.filter((a) => {
      if (selectedCategory && a.category !== selectedCategory) return false;
      if (selectedRole && a.roleTarget !== selectedRole) return false;
      if (
        q &&
        !a.title.toLowerCase().includes(q) &&
        !a.summary.toLowerCase().includes(q) &&
        !a.content.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [articles, search, selectedCategory, selectedRole, q]);

  const filteredFaqs = useMemo(() => {
    return FAQ_ITEMS.filter((f) => {
      if (!q) return true;
      return (
        f.question.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      );
    });
  }, [q]);

  const filteredGlossary = useMemo(() => {
    return DPBI_GLOSSARY.filter((g) => {
      if (!q) return true;
      return (
        g.term.toLowerCase().includes(q) ||
        g.fullName.toLowerCase().includes(q) ||
        g.definition.toLowerCase().includes(q)
      );
    });
  }, [q]);

  const activeTour = ROLE_TOURS[guideRole] || ROLE_TOURS.duta;

  const body = (
    <div className="space-y-6 max-w-5xl mx-auto py-6 px-4 sm:px-6 w-full">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0EA5E9]">
            Pusat Bantuan &amp; Dokumentasi Operasional
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
            Panduan Penggunaan SATU DPBI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Panduan langkah demi langkah per peran, FAQ interaktif, glosarium istilah DPBI, dan kontak Sekretariat Nasional.
          </p>
        </div>

        {user && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold transition-colors"
            >
              <PlayCircle className="w-4 h-4" /> Mulai Tur Peran Interaktif
            </button>
            <button
              type="button"
              onClick={() => navigate('/kendala')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:border-[#0EA5E9] text-slate-700 dark:text-slate-200 text-xs font-semibold transition-colors"
            >
              <LifeBuoy className="w-4 h-4 text-[#0EA5E9]" /> Laporkan Kendala
            </button>
          </div>
        )}
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 space-y-2">
          <BookOpen className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Panduan Duta</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Lengkapi profil &amp; dokumen identitas, ajukan proposal PDF 4-langkah, kirim LKL setelah kegiatan, dan pantau tugas pribadi.
          </p>
        </GlassCard>
        <GlassCard className="p-5 space-y-2">
          <ShieldCheck className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Panduan Koordinator Wilayah</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Kelola keterwakilan kabupaten/kota, ajukan akun Duta wilayah, periksa LKL, dan kirim laporan bulanan sebelum tanggal 5.
          </p>
        </GlassCard>
        <GlassCard className="p-5 space-y-2">
          <HelpCircle className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Sekretariat Nasional</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Email resmi: sekretariat@dpbi.or.id · Jam layanan koordinasi: Senin–Jumat 09:00–17:00 WIB.
          </p>
        </GlassCard>
      </div>

      {/* Search & Section Tabs */}
      <GlassCard className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Cari panduan, pertanyaan FAQ, istilah DPBI, proposal, atau LKL..."
            className="flex-1 min-w-[220px]"
          />
          {activeTab === 'artikel' && (
            <>
              <select
                aria-label="Filter kategori bantuan"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="pl-3 pr-8 py-2.5 min-w-[165px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter sasaran peran"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="pl-3 pr-8 py-2.5 min-w-[155px] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
              >
                <option value="">Semua Peran</option>
                <option value="umum">Umum &amp; Publik</option>
                <option value="duta">Duta</option>
                <option value="koordinator_wilayah">Koordinator Wilayah</option>
                <option value="pengurus">Pengurus / Sekretariat</option>
              </select>
            </>
          )}
        </div>

        <div className="flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80">
          {(
            [
              ['artikel', `Artikel Panduan (${filteredArticles.length})`],
              ['alur', 'Alur Kerja Peran'],
              ['faq', `Pertanyaan Umum (${filteredFaqs.length})`],
              ['glosarium', `Glosarium DPBI (${filteredGlossary.length})`],
            ] as [HelpTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </GlassCard>

      {activeTab === 'artikel' && (
        <GlassCard className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Artikel &amp; Panduan Tersedia
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">
              {filteredArticles.length} artikel
            </span>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredArticles.map((item) => {
              const expanded = openId === item.id;
              return (
                <div key={item.id} className="py-3.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(expanded ? null : item.id)}
                    aria-expanded={expanded}
                    className="w-full text-left flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-[11px] font-semibold text-[#0EA5E9]">
                        {item.category} · Sasaran: {item.roleTarget.replace(/_/g, ' ')}
                      </p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{item.title}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{item.summary}</p>
                    </div>
                    <span className="p-1 text-slate-400 shrink-0">
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {item.content}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredArticles.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500">
                Tidak ada artikel bantuan yang sesuai dengan filter Anda.
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {activeTab === 'alur' && (
        <GlassCard className="p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Compass className="w-4 h-4 text-[#0EA5E9]" /> {activeTour.headline}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{activeTour.summary}</p>
            </div>
            <select
              aria-label="Pilih alur kerja berdasarkan peran"
              value={guideRole}
              onChange={(e) => setGuideRole(e.target.value as RoleCode)}
              className="pl-3 pr-8 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-900 dark:text-slate-100"
            >
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTour.steps.map((step) => (
              <div
                key={step.title}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">{step.title}</h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{step.description}</p>
                </div>
                {user && (
                  <div>
                    <button
                      type="button"
                      onClick={() => navigate(step.targetPath)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#0EA5E9] hover:underline"
                    >
                      {step.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {activeTab === 'faq' && (
        <GlassCard className="p-6 space-y-3">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Pertanyaan yang Sering Diajukan (FAQ)
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">{filteredFaqs.length} topik</span>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-800">
            {filteredFaqs.map((faq) => {
              const expanded = openFaqId === faq.id;
              return (
                <div key={faq.id} className="py-3.5">
                  <button
                    type="button"
                    onClick={() => setOpenFaqId(expanded ? null : faq.id)}
                    aria-expanded={expanded}
                    className="w-full text-left flex items-start justify-between gap-4"
                  >
                    <div>
                      <p className="text-[11px] font-semibold text-[#0EA5E9]">{faq.category}</p>
                      <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">{faq.question}</p>
                    </div>
                    <span className="p-1 text-slate-400 shrink-0">
                      {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </span>
                  </button>
                  {expanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2 text-xs sm:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                      <p>{faq.answer}</p>
                      {user && faq.actionPath && faq.actionLabel && (
                        <button
                          type="button"
                          onClick={() => navigate(faq.actionPath!)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0EA5E9] hover:underline"
                        >
                          {faq.actionLabel} <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredFaqs.length === 0 && (
              <p className="py-8 text-center text-xs text-slate-500">
                Tidak ada FAQ yang cocok dengan kata kunci pencarian Anda.
              </p>
            )}
          </div>
        </GlassCard>
      )}

      {activeTab === 'glosarium' && (
        <GlassCard className="p-6 space-y-4">
          <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">
              Glosarium Istilah Organisasi DPBI
            </h2>
            <span className="text-xs font-mono text-slate-500 tabular-nums">{filteredGlossary.length} istilah</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredGlossary.map((g) => (
              <div
                key={g.term}
                className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-4 space-y-1.5"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{g.term}</p>
                  <span className="text-[11px] font-medium text-[#0EA5E9] truncate">{g.fullName}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{g.definition}</p>
                {user && g.relatedPath && (
                  <button
                    type="button"
                    onClick={() => navigate(g.relatedPath!)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0EA5E9] hover:underline pt-1"
                  >
                    Buka Modul Terkait <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
            {filteredGlossary.length === 0 && (
              <p className="col-span-full py-8 text-center text-xs text-slate-500">
                Tidak ada istilah glosarium yang cocok dengan pencarian Anda.
              </p>
            )}
          </div>
        </GlassCard>
      )}
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col bg-[#F1F5F9] dark:bg-slate-950 text-[#1E293B] dark:text-slate-100">
        <PublicNavbar />
        <main className="flex-1">{body}</main>
        <PublicFooter />
      </div>
    );
  }

  return body;
}
