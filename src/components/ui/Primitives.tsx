import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileEdit,
  FileUp,
  Info,
  LogIn,
  RefreshCw,
  ShieldAlert,
  WifiOff,
  X,
  XCircle,
} from 'lucide-react';
import { apiUploadFile } from '../../lib/api';
import type { HttpErrorCode } from '../../lib/types';

export function GlassCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <section className={`glass-surface rounded-2xl ${className}`}>{children}</section>;
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
  menunggu_persetujuan_nasional: { text: 'text-amber-700 dark:text-amber-400', icon: Clock, label: 'Menunggu Persetujuan Nasional' },
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

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-2xl',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`w-full ${maxWidth} rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden my-8`}>
        <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={`Tutup dialog ${title}`}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onCancel} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            disabled={loading}
            onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-white text-xs font-semibold transition-colors ${
              danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-[#0EA5E9] hover:bg-sky-600'
            }`}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

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

export function LoadingSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-slate-200/70 dark:bg-slate-800/70 animate-pulse" />
      ))}
    </div>
  );
}

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

export function FileDropzone({
  label,
  accept,
  moduleName,
  uploadedFileName,
  onUploaded,
}: {
  label: string;
  accept: string;
  moduleName: string;
  uploadedFileName?: string | null;
  onUploaded: (res: { fileId: string; fileName: string; sizeBytes: number }) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const res = await apiUploadFile(file, moduleName);
      onUploaded(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah berkas.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files?.[0]);
        }}
        className="flex items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 px-4 py-3"
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileUp className="w-5 h-5 text-[#0EA5E9] shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-800 dark:text-slate-200 truncate">
              {uploading ? 'Memvalidasi MIME & menyimpan berkas...' : uploadedFileName || 'Tarik & lepas berkas ke sini, atau pilih file'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Validasi signature MIME aktif · Maksimal 15 MB
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9] shrink-0 transition-colors"
        >
          Pilih File
        </button>
      </div>
      {error && <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">{error}</p>}
    </div>
  );
}
