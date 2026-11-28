import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  RefreshCw,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { apiGet } from '../lib/api';
import { formatTanggalIndonesia } from '../lib/rbac';
import type { ProcessTrackerPayload } from '../lib/types';
import { Skeleton, StatusIndicator } from './ui';

export function ProcessTracker({
  entityType,
  entityId,
  refreshKey = 0,
}: {
  entityType: 'proposal' | 'lkl' | 'persuratan';
  entityId: string;
  refreshKey?: number;
}) {
  const [tracker, setTracker] = useState<ProcessTrackerPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    apiGet<ProcessTrackerPayload>(`/api/process-tracker/${entityType}/${encodeURIComponent(entityId)}`)
      .then((res) => {
        if (!cancelled) setTracker(res);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Gagal memuat pelacak proses.');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId, refreshKey]);

  if (loading) return <Skeleton rows={3} />;

  if (error || !tracker) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-xs text-slate-600 dark:text-slate-400">
        <p className="font-semibold text-slate-800 dark:text-slate-200">Pelacak Proses Tidak Tersedia</p>
        <p className="mt-1">{error || 'Riwayat tahapan belum tersedia untuk item ini.'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[#0EA5E9] uppercase tracking-wider">
              Pelacak Status &amp; Alur Kerja
            </p>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
              {tracker.currentStageLabel}
            </h3>
          </div>
          <StatusIndicator status={tracker.status} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs pt-2 border-t border-slate-200/80 dark:border-slate-800">
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Pemeriksa Saat Ini</p>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{tracker.currentReviewerLabel}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Penanggung Jawab Tindakan</p>
            <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{tracker.actionOwner}</p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Tahap Sebelumnya</p>
            <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5 capitalize">
              {tracker.previousStageLabel || 'Pengajuan Awal'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Tahap Berikutnya</p>
            <p className="font-medium text-slate-700 dark:text-slate-300 mt-0.5">
              {tracker.nextStageLabel || 'Alur Selesai'}
            </p>
          </div>
        </div>

        <div className="rounded-xl bg-white dark:bg-slate-950/70 border border-slate-200/90 dark:border-slate-800 p-3 text-xs space-y-1">
          <p className="font-semibold text-slate-800 dark:text-slate-100">Tindakan yang Diperlukan:</p>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{tracker.actionRequired}</p>
          {tracker.slaDueAt && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums pt-1">
              Tenggat SLA: {formatTanggalIndonesia(tracker.slaDueAt, true)}
            </p>
          )}
        </div>

        {tracker.reviewerNote && (
          <div className="rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70 p-3 text-xs space-y-0.5">
            <p className="font-semibold text-amber-900 dark:text-amber-200">Catatan Pemeriksa:</p>
            <p className="text-amber-800 dark:text-amber-300 whitespace-pre-line">{tracker.reviewerNote}</p>
          </div>
        )}
      </div>

      {/* Stepper Visualization */}
      <div>
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2.5">Peta Tahapan Proses</p>
        <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {tracker.steps.map((step) => {
            const Icon =
              step.state === 'selesai'
                ? CheckCircle2
                : step.state === 'revisi'
                ? AlertCircle
                : step.state === 'ditolak'
                ? XCircle
                : step.state === 'aktif'
                ? RefreshCw
                : Clock;
            const borderClass =
              step.state === 'selesai'
                ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/30'
                : step.state === 'aktif'
                ? 'border-[#0EA5E9] bg-sky-50/70 dark:bg-sky-950/40'
                : step.state === 'revisi'
                ? 'border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-950/40'
                : step.state === 'ditolak'
                ? 'border-rose-300 dark:border-rose-800 bg-rose-50/60 dark:bg-rose-950/40'
                : 'border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50';
            const iconColor =
              step.state === 'selesai'
                ? 'text-emerald-600 dark:text-emerald-400'
                : step.state === 'aktif'
                ? 'text-[#0EA5E9]'
                : step.state === 'revisi'
                ? 'text-amber-600 dark:text-amber-400'
                : step.state === 'ditolak'
                ? 'text-rose-600 dark:text-rose-400'
                : 'text-slate-400';

            return (
              <li key={step.key} className={`rounded-xl border p-3 text-xs space-y-1 ${borderClass}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white">{step.label}</span>
                  <Icon className={`w-4 h-4 shrink-0 ${iconColor}`} aria-hidden="true" />
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">{step.description}</p>
                {step.ownerRoleLabel && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    Pihak: <span className="font-medium text-slate-700 dark:text-slate-300">{step.ownerRoleLabel}</span>
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* Audit / Movement History */}
      <div>
        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2">Riwayat Perpindahan &amp; Keputusan</p>
        {tracker.history.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
            Belum ada catatan perpindahan tahap. Pengajuan berada di tahap awal.
          </p>
        ) : (
          <ul className="divide-y divide-slate-200/80 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl bg-white/70 dark:bg-slate-900/50">
            {tracker.history.map((h) => (
              <li key={h.id} className="p-3 text-xs space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                    <UserCheck className="w-3.5 h-3.5 text-[#0EA5E9] shrink-0" aria-hidden="true" />
                    <span>{h.stageLabel}</span>
                  </div>
                  <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                    {formatTanggalIndonesia(h.createdAt, true)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Oleh <span className="font-semibold text-slate-800 dark:text-slate-200">{h.actorName}</span> · {h.actorRole}
                  {h.fromStatus && (
                    <span className="inline-flex items-center gap-1 ml-2 text-slate-500">
                      ({h.fromStatus.replace(/_/g, ' ')} <ArrowRight className="w-3 h-3 inline" /> {h.toStatus.replace(/_/g, ' ')})
                    </span>
                  )}
                </p>
                {h.note && <p className="text-xs text-slate-700 dark:text-slate-300 pt-0.5">{h.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
