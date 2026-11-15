import React, { useMemo, useState } from 'react';
import { INDONESIA_PROVINCES } from '../lib/provinces';
import type { ProvinceRecord, ProvinceStatus } from '../lib/types';
import { StatusIndicator } from './ui/Primitives';

const STATUS_FILL: Record<ProvinceStatus, string> = {
  aktif: 'fill-[#0EA5E9] hover:fill-[#38BDF8] stroke-white dark:stroke-slate-900',
  dalam_pengembangan: 'fill-sky-300 dark:fill-sky-700 hover:fill-sky-400 stroke-white dark:stroke-slate-900',
  dalam_pembinaan: 'fill-amber-400 dark:fill-amber-600 hover:fill-amber-300 stroke-white dark:stroke-slate-900',
  belum_terbentuk: 'fill-slate-300 dark:fill-slate-700 hover:fill-slate-400 stroke-white dark:stroke-slate-900',
  tidak_aktif: 'fill-rose-300 dark:fill-rose-800 hover:fill-rose-400 stroke-white dark:stroke-slate-900',
};

export function IndonesiaMap({
  provinces,
  selectedCode,
  onSelect,
}: {
  provinces: ProvinceRecord[];
  selectedCode: string | null;
  onSelect: (province: ProvinceRecord) => void;
}) {
  const [hoveredCode, setHoveredCode] = useState<string | null>(null);

  const provinceMap = useMemo(() => {
    const m = new Map<string, ProvinceRecord>();
    for (const p of provinces) m.set(p.code, p);
    return m;
  }, [provinces]);

  const hovered = hoveredCode ? provinceMap.get(hoveredCode) : null;
  const selected = selectedCode ? provinceMap.get(selectedCode) : null;

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-4 text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-[#0EA5E9] inline-block" /> Aktif
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-sky-300 dark:bg-sky-700 inline-block" /> Dalam Pengembangan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-amber-400 dark:bg-amber-600 inline-block" /> Dalam Pembinaan
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-slate-300 dark:bg-slate-700 inline-block" /> Belum Terbentuk
          </span>
        </div>
        <span className="text-slate-500 dark:text-slate-400 tabular-nums">
          Klik provinsi untuk detail wilayah · 38 Provinsi
        </span>
      </div>

      {/* Map Canvas */}
      <div className="relative rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-gradient-to-b from-sky-50/60 to-slate-100/70 dark:from-slate-900 dark:to-slate-950 p-3 overflow-hidden">
        <svg
          viewBox="0 0 950 365"
          className="w-full h-auto max-h-[380px] select-none"
          role="img"
          aria-label="Peta interaktif 38 provinsi Indonesia SATU DPBI"
        >
          {/* Subtle archipelago grid lines */}
          <line x1="0" y1="180" x2="950" y2="180" className="stroke-sky-200/40 dark:stroke-slate-800/60" strokeDasharray="4 4" />
          <line x1="475" y1="0" x2="475" y2="365" className="stroke-sky-200/40 dark:stroke-slate-800/60" strokeDasharray="4 4" />

          {INDONESIA_PROVINCES.map((shape) => {
            const rec = provinceMap.get(shape.code);
            const status = rec?.status ?? 'belum_terbentuk';
            const isSelected = selectedCode === shape.code;
            return (
              <g
                key={shape.code}
                className="cursor-pointer transition-opacity"
                onMouseEnter={() => setHoveredCode(shape.code)}
                onMouseLeave={() => setHoveredCode(null)}
                onClick={() => rec && onSelect(rec)}
                role="button"
                tabIndex={0}
                aria-label={`Provinsi ${shape.name}, status ${status.replace(/_/g, ' ')}`}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && rec) {
                    e.preventDefault();
                    onSelect(rec);
                  }
                }}
              >
                <path
                  d={shape.svgPath}
                  strokeWidth={isSelected ? 2.5 : 1.2}
                  className={`${STATUS_FILL[status]} transition-colors duration-150 ${
                    isSelected ? 'ring-2 stroke-slate-900 dark:stroke-white' : ''
                  }`}
                />
                <text
                  x={shape.labelX}
                  y={shape.labelY}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="pointer-events-none fill-slate-900/80 dark:fill-white/90 text-[7px] font-mono font-semibold"
                >
                  {shape.code}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Live hover or selected summary strip */}
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200/70 dark:border-slate-800 text-xs">
          {hovered || selected ? (
            (() => {
              const target = (hovered || selected)!;
              return (
                <>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">{target.name}</span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <span className="text-slate-500 dark:text-slate-400">{target.island}</span>
                    <span aria-hidden="true" className="text-slate-400">·</span>
                    <StatusIndicator status={target.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-slate-600 dark:text-slate-300 tabular-nums">
                    <span>Koordinator: {target.coordinatorName || 'Belum ditetapkan'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{target.activeDutaCount} Duta</span>
                    <span aria-hidden="true">·</span>
                    <span>{target.proposalCount} Proposal</span>
                    <span aria-hidden="true">·</span>
                    <span>{target.lklCount} LKL</span>
                  </div>
                </>
              );
            })()
          ) : (
            <p className="text-slate-500 dark:text-slate-400">
              Arahkan kursor atau klik salah satu dari 38 provinsi di peta untuk memeriksa statistik dan koordinator wilayah.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
