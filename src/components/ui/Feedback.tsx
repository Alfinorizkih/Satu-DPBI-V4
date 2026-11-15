import React from 'react';
import { AlertTriangle, ArrowLeft, Clock, LogIn, RefreshCw, ShieldAlert, WifiOff } from 'lucide-react';
import { GlassCard } from './DataDisplay';
import type { HttpErrorCode } from '../../lib/types';

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="text-center py-12 px-6 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl">
      <p className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</p>
      <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-sm font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      ))}
    </div>
  );
}

export const LoadingSkeleton = Skeleton;

const ERROR_DEFAULTS: Record<HttpErrorCode, { title: string; message: string }> = {
  400: {
    title: 'Permintaan Tidak Valid (400)',
    message: 'Format permintaan atau parameter yang dikirim tidak dapat dipahami oleh sistem. Periksa kembali masukan Anda.',
  },
  401: {
    title: 'Autentikasi Diperlukan (401)',
    message: 'Anda belum masuk ke portal SATU DPBI. Silakan masuk terlebih dahulu menggunakan akun resmi Anda.',
  },
  403: {
    title: 'Akses Ditolak — Hak Akses RBAC (403)',
    message: 'Peran atau delegasi aktif Anda tidak memiliki kewenangan untuk mengakses halaman atau tindakan ini.',
  },
  404: {
    title: 'Halaman atau Data Tidak Ditemukan (404)',
    message: 'Tautan atau catatan yang Anda cari tidak tersedia, telah dipindahkan, atau sudah diarsipkan.',
  },
  419: {
    title: 'Sesi atau Token Telah Kedaluwarsa (419)',
    message: 'Demi keamanan data organisasi, sesi Anda telah berakhir atau diakhiri karena tidak ada aktivitas. Silakan masuk kembali.',
  },
  422: {
    title: 'Data Masukan Tidak Valid (422)',
    message: 'Beberapa kolom wajib belum lengkap atau format data tidak memenuhi ketentuan validasi sistem.',
  },
  429: {
    title: 'Terlalu Banyak Permintaan (429)',
    message: 'Sistem mendeteksi frekuensi permintaan yang terlalu tinggi. Mohon tunggu beberapa saat sebelum mencoba lagi.',
  },
  500: {
    title: 'Kesalahan Layanan Internal (500)',
    message: 'Terjadi gangguan sementara saat memproses permintaan Anda. Kejadian ini telah dicatat oleh sistem.',
  },
  502: {
    title: 'Gateway Bermasalah (502)',
    message: 'Layanan penghubung menerima respons tidak valid dari server aplikasi. Silakan muat ulang dalam beberapa saat.',
  },
  503: {
    title: 'Layanan Sementara Tidak Tersedia (503)',
    message: 'Portal sedang dalam pemeliharaan singkat atau beban sistem sedang penuh. Silakan coba kembali sebentar lagi.',
  },
};

export function ErrorView({
  code,
  title,
  message,
  referenceId,
  onBack,
  onLogin,
  onRetry,
}: {
  code: HttpErrorCode;
  title?: string;
  message?: string;
  referenceId?: string;
  onBack: () => void;
  onLogin?: () => void;
  onRetry?: () => void;
}) {
  const defaults = ERROR_DEFAULTS[code];
  return (
    <div className="min-h-[65vh] flex items-center justify-center p-6">
      <GlassCard className="max-w-lg w-full p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 mx-auto flex items-center justify-center text-[#0EA5E9]">
          {code === 419 || code === 401 ? (
            <LogIn className="w-6 h-6" />
          ) : code >= 500 ? (
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          ) : (
            <ShieldAlert className="w-6 h-6" />
          )}
        </div>
        <div>
          <p className="font-mono text-2xl font-bold text-[#0EA5E9] tabular-nums">{code}</p>
          <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white mt-1">
            {title || defaults.title}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
            {message || defaults.message}
          </p>
        </div>
        {referenceId && (
          <p className="text-xs font-mono text-slate-500 dark:text-slate-400">
            Kode Referensi Kejadian: <span className="font-semibold text-slate-800 dark:text-slate-200">{referenceId}</span>
          </p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
          {(code === 401 || code === 419) && onLogin && (
            <button
              type="button"
              onClick={onLogin}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-sm font-semibold transition-colors"
            >
              <LogIn className="w-4 h-4" /> Masuk Kembali
            </button>
          )}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold hover:border-[#0EA5E9]"
            >
              <RefreshCw className="w-4 h-4" /> Coba Lagi
            </button>
          )}
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
              (code === 401 || code === 419) && onLogin
                ? 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200'
                : 'bg-[#0EA5E9] hover:bg-sky-600 text-white'
            }`}
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Halaman Utama
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

export const ErrorState = ErrorView;

export function AccountPendingView({ onBack }: { onBack: () => void }) {
  return (
    <div className="min-h-[65vh] flex items-center justify-center p-6">
      <GlassCard className="max-w-lg w-full p-8 text-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 mx-auto flex items-center justify-center text-amber-600">
          <Clock className="w-6 h-6" />
        </div>
        <h1 className="font-display text-xl font-bold text-slate-900 dark:text-white">
          Akun Menunggu Persetujuan
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
          Pendaftaran akun Anda telah tercatat dan saat ini sedang dalam proses peninjauan oleh Sekretariat Nasional DPBI. Anda akan menerima pemberitahuan setelah akun diaktifkan.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="px-5 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-sm font-semibold"
        >
          Kembali ke Portal Masuk
        </button>
      </GlassCard>
    </div>
  );
}

export function OfflineBanner({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="bg-rose-600 text-white px-4 py-2 text-xs flex items-center justify-center gap-3 no-print"
    >
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Koneksi jaringan terputus atau layanan sedang tidak dapat dijangkau. Perubahan belum tentu tersimpan.</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="px-2.5 py-1 rounded-lg bg-white/20 hover:bg-white/30 font-semibold whitespace-nowrap"
        >
          Coba Sambungkan
        </button>
      )}
    </div>
  );
}

export function FormErrorSummary({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 p-3.5 text-xs text-rose-800 dark:text-rose-200 space-y-1">
      <p className="font-bold">Periksa kembali kolom berikut sebelum melanjutkan:</p>
      <ul className="list-disc pl-4 space-y-0.5">
        {errors.map((err, idx) => (
          <li key={idx}>{err}</li>
        ))}
      </ul>
    </div>
  );
}
