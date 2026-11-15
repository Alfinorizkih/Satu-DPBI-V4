import React from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileEdit,
  Info,
  ShieldAlert,
  XCircle,
} from 'lucide-react';

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`glass-surface rounded-2xl ${className}`}>{children}</section>;
}

export const GlassCard = Card;

export function PageContainer({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`space-y-5 ${className}`}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function Breadcrumb({
  items,
  onNavigate,
}: {
  items: { label: string; path?: string }[];
  onNavigate: (path: string) => void;
}) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <React.Fragment key={`${item.label}-${idx}`}>
            {idx > 0 && <span aria-hidden="true">/</span>}
            {item.path && !isLast ? (
              <button type="button" onClick={() => onNavigate(item.path!)} className="hover:text-[#0EA5E9]">
                {item.label}
              </button>
            ) : (
              <span className={isLast ? 'font-semibold text-slate-900 dark:text-white' : ''}>{item.label}</span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'sky' | 'emerald' | 'amber' | 'rose';
}) {
  const toneClass: Record<string, string> = {
    neutral: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300',
    sky: 'bg-sky-50 dark:bg-sky-950/60 text-sky-700 dark:text-sky-300',
    emerald: 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300',
    amber: 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300',
    rose: 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold ${toneClass[tone]}`}>
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size = 'md',
}: {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md' | 'lg';
}) {
  const initials = (name || 'DP')
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || '')
    .join('');
  const sizeClass =
    size === 'sm' ? 'w-7 h-7 text-[11px]' : size === 'lg' ? 'w-12 h-12 text-sm' : 'w-9 h-9 text-xs';
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        className={`${sizeClass} rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0`}
      />
    );
  }
  return (
    <div
      aria-label={name}
      className={`${sizeClass} rounded-xl bg-[#0EA5E9]/15 text-[#0EA5E9] font-bold flex items-center justify-center shrink-0`}
    >
      {initials}
    </div>
  );
}

const STATUS_STYLE_MAP: Record<
  string,
  { text: string; icon: React.ComponentType<{ className?: string }>; label: string }
> = {
  aktif: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Aktif' },
  disetujui: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Disetujui' },
  diterima: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Diterima' },
  terverifikasi: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Terverifikasi' },
  selesai: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Selesai' },
  berhasil: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Berhasil' },
  berlaku: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Berlaku' },
  sehat: { text: 'text-emerald-700 dark:text-emerald-400', icon: CheckCircle2, label: 'Sehat' },

  draft: { text: 'text-slate-600 dark:text-slate-300', icon: FileEdit, label: 'Draft' },
  diajukan: { text: 'text-sky-700 dark:text-sky-400', icon: Info, label: 'Diajukan' },
  dikirim: { text: 'text-sky-700 dark:text-sky-400', icon: Info, label: 'Dikirim' },
  dikerjakan: { text: 'text-sky-700 dark:text-sky-400', icon: Info, label: 'Dikerjakan' },
  dalam_pengembangan: { text: 'text-sky-700 dark:text-sky-400', icon: Info, label: 'Dalam Pengembangan' },
  pembekalan: { text: 'text-sky-700 dark:text-sky-400', icon: Info, label: 'Pembekalan' },
  ditangani: { text: 'text-sky-700 dark:text-sky-400', icon: Info, label: 'Ditangani' },

  menunggu: { text: 'text-amber-700 dark:text-amber-400', icon: Clock, label: 'Menunggu' },
  menunggu_verifikasi: { text: 'text-amber-700 dark:text-amber-400', icon: Clock, label: 'Menunggu Verifikasi' },
  menunggu_pemeriksaan: { text: 'text-amber-700 dark:text-amber-400', icon: Clock, label: 'Menunggu Pemeriksaan' },
  menunggu_persetujuan: { text: 'text-amber-700 dark:text-amber-400', icon: Clock, label: 'Menunggu Persetujuan' },
  menunggu_persetujuan_nasional: {
    text: 'text-amber-700 dark:text-amber-400',
    icon: Clock,
    label: 'Menunggu Persetujuan Nasional',
  },
  perlu_revisi: { text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle, label: 'Perlu Revisi' },
  perlu_perbaikan: { text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle, label: 'Perlu Perbaikan' },
  perlu_perhatian: { text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle, label: 'Perlu Perhatian' },
  dalam_pembinaan: { text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle, label: 'Dalam Pembinaan' },
  peringatan: { text: 'text-amber-700 dark:text-amber-400', icon: AlertCircle, label: 'Peringatan' },

  ditolak: { text: 'text-rose-700 dark:text-rose-400', icon: XCircle, label: 'Ditolak' },
  gagal: { text: 'text-rose-700 dark:text-rose-400', icon: XCircle, label: 'Gagal' },
  tidak_valid: { text: 'text-rose-700 dark:text-rose-400', icon: XCircle, label: 'Tidak Valid' },
  kritis: { text: 'text-rose-700 dark:text-rose-400', icon: ShieldAlert, label: 'Kritis' },

  diarsipkan: { text: 'text-slate-600 dark:text-slate-400', icon: Info, label: 'Diarsipkan' },
  belum_terbentuk: { text: 'text-slate-500 dark:text-slate-400', icon: Info, label: 'Belum Terbentuk' },
  belum_dimulai: { text: 'text-slate-600 dark:text-slate-400', icon: Clock, label: 'Belum Dimulai' },
  nonaktif: { text: 'text-slate-500 dark:text-slate-400', icon: Info, label: 'Nonaktif' },
  alumni_terbatas: { text: 'text-sky-700 dark:text-sky-400', icon: Info, label: 'Alumni (Akses Terbatas)' },
};

export function StatusIndicator({ status, customLabel }: { status: string; customLabel?: string }) {
  const normalized = status.toLowerCase();
  const cfg = STATUS_STYLE_MAP[normalized] ?? {
    text: 'text-slate-600 dark:text-slate-400',
    icon: Info,
    label: status.replace(/_/g, ' '),
  };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${cfg.text}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
      <span>{customLabel ?? cfg.label}</span>
    </span>
  );
}

export function DataTable<T>({
  columns,
  rows,
  keyExtractor,
  onRowClick,
  emptyState,
}: {
  columns: { key: string; header: string; align?: 'left' | 'right'; render: (row: T) => React.ReactNode }[];
  rows: T[];
  keyExtractor: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyState?: React.ReactNode;
}) {
  if (rows.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={`py-2.5 px-3 font-semibold ${c.align === 'right' ? 'text-right' : ''}`}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
          {rows.map((row) => (
            <tr
              key={keyExtractor(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors' : ''}
            >
              {columns.map((c) => (
                <td key={c.key} className={`py-3 px-3 ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Pagination({
  page,
  totalItems,
  pageSize,
  onPageChange,
}: {
  page: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (nextPage: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalPages <= 1) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(totalItems, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200/70 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400">
      <p className="tabular-nums">
        Menampilkan <span className="font-semibold text-slate-900 dark:text-white">{start}–{end}</span> dari{' '}
        <span className="font-semibold text-slate-900 dark:text-white">{totalItems}</span> data
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Halaman sebelumnya"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:border-[#0EA5E9]"
        >
          <ChevronLeft className="w-3.5 h-3.5" /> Sebelumnya
        </button>
        <span className="px-2 font-mono tabular-nums font-semibold">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Halaman berikutnya"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-40 hover:border-[#0EA5E9]"
        >
          Berikutnya <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
