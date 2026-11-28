import React from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Info, RotateCcw, Save } from 'lucide-react';
import { FormErrorSummary } from './ui';

export interface GuidedStepDef {
  id: string;
  title: string;
  description: string;
}

export interface ChecklistItem {
  label: string;
  ok: boolean;
}

export function GuidedFieldHint({
  hint,
  example,
}: {
  hint: string;
  example?: string;
}) {
  return (
    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
      {hint}
      {example ? (
        <>
          {' '}
          <span className="text-slate-600 dark:text-slate-300 font-medium">Contoh: {example}</span>
        </>
      ) : null}
    </p>
  );
}

export function GuidedStepperForm({
  steps,
  currentStep,
  onStepChange,
  checklist,
  autosavedAt,
  hasDraftRecovery,
  draftSavedAtLabel,
  onRecoverDraft,
  onDiscardDraft,
  errors,
  submitting,
  submitLabel,
  onSaveDraft,
  onSubmit,
  saveDraftLabel = 'Simpan Draft',
  children,
}: {
  steps: GuidedStepDef[];
  currentStep: number;
  onStepChange: (nextStep: number) => void;
  checklist: ChecklistItem[];
  autosavedAt?: string | null;
  hasDraftRecovery?: boolean;
  draftSavedAtLabel?: string;
  onRecoverDraft?: () => void;
  onDiscardDraft?: () => void;
  errors: string[];
  submitting: boolean;
  submitLabel: string;
  onSaveDraft?: () => void;
  onSubmit: () => void;
  saveDraftLabel?: string;
  children: React.ReactNode;
}) {
  const completedCount = checklist.filter((c) => c.ok).length;
  const percent = checklist.length > 0 ? Math.round((completedCount / checklist.length) * 100) : 100;
  const isLastStep = currentStep >= steps.length - 1;

  return (
    <div className="space-y-4">
      {hasDraftRecovery && onRecoverDraft && (
        <div
          role="region"
          aria-label="Pemulihan draf lokal"
          className="rounded-xl bg-sky-50/90 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-start gap-2.5 min-w-0">
            <RotateCcw className="w-4 h-4 text-[#0EA5E9] shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">
                Draf Lokal Tersedia untuk Dipulihkan
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                Terakhir tersimpan otomatis pada {draftSavedAtLabel || 'sesi sebelumnya'}.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onDiscardDraft && (
              <button
                type="button"
                onClick={onDiscardDraft}
                className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-semibold hover:bg-white dark:hover:bg-slate-800"
              >
                Abaikan
              </button>
            )}
            <button
              type="button"
              onClick={onRecoverDraft}
              className="px-3.5 py-1.5 rounded-lg bg-[#0EA5E9] hover:bg-sky-600 text-white font-semibold"
            >
              Pulihkan Draf
            </button>
          </div>
        </div>
      )}

      {/* Completeness Bar + Autosave Telemetry */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              Kelengkapan Pengisian: <span className="font-mono tabular-nums text-[#0EA5E9]">{percent}%</span>
            </span>
            <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
              ({completedCount}/{checklist.length} syarat terpenuhi)
            </span>
          </div>
          {autosavedAt && (
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              Tersimpan otomatis pukul {autosavedAt}
            </span>
          )}
        </div>
        <div className="h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
          <div
            className="h-full bg-[#0EA5E9] transition-all duration-200"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
          {checklist.map((c) => (
            <span
              key={c.label}
              className={`inline-flex items-center gap-1 ${
                c.ok ? 'text-emerald-700 dark:text-emerald-400 font-medium' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              {c.ok ? (
                <CheckCircle2 className="w-3 h-3 shrink-0" aria-hidden="true" />
              ) : (
                <Info className="w-3 h-3 shrink-0" aria-hidden="true" />
              )}
              <span>{c.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Interactive Stepper Navigation */}
      <nav aria-label="Tahapan pengisian formulir">
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          {steps.map((step, idx) => {
            const active = idx === currentStep;
            const past = idx < currentStep;
            return (
              <li key={step.id}>
                <button
                  type="button"
                  onClick={() => onStepChange(idx)}
                  aria-current={active ? 'step' : undefined}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                    active
                      ? 'border-[#0EA5E9] bg-sky-50/70 dark:bg-sky-950/40'
                      : past
                      ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/40 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        active ? 'text-[#0EA5E9]' : past ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {idx + 1}. {step.title}
                    </span>
                    {past && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />}
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">{step.description}</p>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <FormErrorSummary errors={errors} />

      {/* Current Step Form Body */}
      <div className="pt-1">{children}</div>

      {/* Footer Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentStep === 0 || submitting}
            onClick={() => onStepChange(Math.max(0, currentStep - 1))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 disabled:opacity-40 hover:border-[#0EA5E9]"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Langkah Sebelumnya</span>
          </button>
          {onSaveDraft && (
            <button
              type="button"
              disabled={submitting}
              onClick={onSaveDraft}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9] disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saveDraftLabel}</span>
            </button>
          )}
        </div>

        <div>
          {!isLastStep ? (
            <button
              type="button"
              disabled={submitting}
              onClick={() => onStepChange(Math.min(steps.length - 1, currentStep + 1))}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              <span>Lanjut ke {steps[currentStep + 1]?.title}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={onSubmit}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{submitting ? 'Memproses...' : submitLabel}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
