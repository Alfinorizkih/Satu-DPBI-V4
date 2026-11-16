import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, HelpCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet } from '../lib/api';
import type { HelpArticleRecord } from '../lib/types';
import { PublicFooter, PublicNavbar } from '../components/public/PublicChrome';
import { GlassCard, SearchBar } from '../components/ui/Primitives';

export function HelpPage() {
  const { user } = useAuth();
  const [articles, setArticles] = useState<HelpArticleRecord[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
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
  }, [articles, search, selectedCategory, selectedRole]);

  const body = (
    <div className="space-y-6 max-w-5xl mx-auto py-6 px-4 sm:px-6 w-full">
      <div className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#0EA5E9]">
          Pusat Bantuan &amp; Dokumentasi Operasional
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          Panduan Penggunaan SATU DPBI
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
          Panduan langkah demi langkah per peran, tata cara pelaporan, dan kontak resmi Sekretariat Nasional.
        </p>
      </div>

      {/* Role Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 space-y-2">
          <BookOpen className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Panduan Duta</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
            Lengkapi profil &amp; dokumen identitas, ajukan proposal PDF, kirim LKL setelah kegiatan, dan pantau tugas pribadi.
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

      {/* Search & Filters */}
      <GlassCard className="p-4 flex flex-wrap items-center gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Cari panduan, topik proposal, LKL, atau aktivasi..."
          className="flex-1 min-w-[220px]"
        />
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
      </GlassCard>

      {/* Accordion Articles from CMS/DB */}
      <GlassCard className="p-6 space-y-3">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-bold text-slate-900 dark:text-white">
            Artikel &amp; Panduan Tersedia
          </h2>
          <span className="text-xs font-mono text-slate-500 tabular-nums">
            {filtered.length} artikel
          </span>
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {filtered.map((item) => {
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
          {filtered.length === 0 && (
            <p className="py-8 text-center text-xs text-slate-500">
              Tidak ada artikel bantuan yang sesuai dengan filter Anda.
            </p>
          )}
        </div>
      </GlassCard>
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
