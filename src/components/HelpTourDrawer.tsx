import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Compass,
  HelpCircle,
  LifeBuoy,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_TOURS, resolvePageHelp } from '../lib/guidance';

export function ContextualHelpDrawer() {
  const {
    user,
    currentPath,
    navigate,
    helpDrawerOpen,
    setHelpDrawerOpen,
    setTourOpen,
  } = useAuth();

  if (!helpDrawerOpen) return null;

  const guide = resolvePageHelp(currentPath);

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-xs no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Bantuan Kontekstual Halaman"
    >
      <div className="w-full max-w-md h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2 min-w-0">
            <HelpCircle className="w-4 h-4 text-[#0EA5E9] shrink-0" aria-hidden="true" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white truncate">
              Bantuan Halaman Ini
            </h2>
          </div>
          <button
            type="button"
            onClick={() => setHelpDrawerOpen(false)}
            aria-label="Tutup panel bantuan"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0EA5E9]">
              Panduan Kontekstual
            </p>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{guide.title}</h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{guide.purpose}</p>
          </div>

          <div className="space-y-2">
            <p className="font-bold text-slate-900 dark:text-white">Langkah Penggunaan Utama</p>
            <ol className="space-y-2 list-decimal pl-4 text-slate-700 dark:text-slate-300 leading-relaxed">
              {guide.steps.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>

          {guide.tips.length > 0 && (
            <div className="rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-3.5 space-y-1.5">
              <p className="font-bold text-slate-900 dark:text-white">Tips Operasional</p>
              <ul className="space-y-1 list-disc pl-4 text-slate-700 dark:text-slate-300">
                {guide.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          )}

          {guide.commonMistakes.length > 0 && (
            <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3.5 space-y-1.5">
              <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                <span>Hal yang Perlu Dihindari</span>
              </p>
              <ul className="space-y-1 list-disc pl-4 text-amber-900/90 dark:text-amber-200">
                {guide.commonMistakes.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </div>
          )}

          {guide.relatedPaths.length > 0 && (
            <div className="space-y-2">
              <p className="font-bold text-slate-900 dark:text-white">Tautan Terkait</p>
              <div className="flex flex-wrap gap-2">
                {guide.relatedPaths.map((rp) => (
                  <button
                    key={rp.path}
                    type="button"
                    onClick={() => {
                      setHelpDrawerOpen(false);
                      navigate(rp.path);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] font-semibold text-slate-700 dark:text-slate-200"
                  >
                    <span>{rp.label}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 space-y-2">
          {user && (
            <button
              type="button"
              onClick={() => {
                setHelpDrawerOpen(false);
                setTourOpen(true);
              }}
              className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>Mulai Tur Interaktif ({user.roleLabel})</span>
            </button>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setHelpDrawerOpen(false);
                navigate('/bantuan');
              }}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9]"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Pusat Bantuan</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setHelpDrawerOpen(false);
                navigate(`/kendala?from=${encodeURIComponent(currentPath)}`);
              }}
              className="inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9]"
            >
              <LifeBuoy className="w-3.5 h-3.5" />
              <span>Lapor Kendala</span>
            </button>
          </div>
          <p className="text-[11px] text-center text-slate-500 dark:text-slate-400">
            Pintasan keyboard: tekan <kbd className="font-mono px-1 rounded bg-slate-200 dark:bg-slate-800">?</kbd> kapan saja untuk membuka panduan ini.
          </p>
        </div>
      </div>
    </div>
  );
}

export function RoleTourModal() {
  const { user, tourOpen, setTourOpen, navigate, markTourCompleted, notify } = useAuth();
  const [stepIdx, setStepIdx] = useState(0);

  if (!tourOpen || !user) return null;

  const tour = ROLE_TOURS[user.role] || ROLE_TOURS.duta;
  const activeStep = tour.steps[Math.min(stepIdx, tour.steps.length - 1)];
  const isLast = stepIdx >= tour.steps.length - 1;

  const finishTour = async () => {
    await markTourCompleted(user.role);
    setTourOpen(false);
    setStepIdx(0);
    notify('Tur peran selesai ditandai. Anda dapat membukanya kembali dari Pusat Bantuan.', 'success');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Tur Interaktif Berdasarkan Peran"
    >
      <div className="max-w-lg w-full rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-[#0EA5E9]">
              Tur Onboarding · {user.roleLabel}
            </p>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
              {tour.headline}
            </h2>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{tour.summary}</p>
          </div>
          <button
            type="button"
            onClick={() => setTourOpen(false)}
            aria-label="Tutup tur peran"
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step progress indicator */}
        <div className="flex items-center gap-1.5">
          {tour.steps.map((st, idx) => (
            <button
              key={st.title}
              type="button"
              aria-label={`Langkah ${idx + 1}: ${st.title}`}
              onClick={() => setStepIdx(idx)}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                idx <= stepIdx ? 'bg-[#0EA5E9]' : 'bg-slate-200 dark:bg-slate-800'
              }`}
            />
          ))}
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-2.5">
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            Langkah {stepIdx + 1} dari {tour.steps.length}
          </p>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">{activeStep.title}</h3>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {activeStep.description}
          </p>
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setTourOpen(false);
                navigate(activeStep.targetPath);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0EA5E9] hover:underline"
            >
              <span>{activeStep.actionLabel}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Sebelumnya</span>
          </button>

          {!isLast ? (
            <button
              type="button"
              onClick={() => setStepIdx((i) => Math.min(tour.steps.length - 1, i + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
            >
              <span>Berikutnya</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={finishTour}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Selesai &amp; Tandai Dipahami</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
