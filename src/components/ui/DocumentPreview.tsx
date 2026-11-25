import React, { useRef, useState } from 'react';
import { Download, FileText, FileUp } from 'lucide-react';
import { apiUploadFile, apiUrl } from '../../lib/api';
import { compressImageFile } from '../../lib/imageCompress';

function formatBytesShort(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const [compressionNote, setCompressionNote] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setCompressionNote(null);
    setUploading(true);
    try {
      const { file: readyFile, compressed, originalSize, finalSize } = await compressImageFile(file);
      if (compressed) {
        setCompressionNote(`Gambar dioptimalkan: ${formatBytesShort(originalSize)} -> ${formatBytesShort(finalSize)}`);
      }
      const res = await apiUploadFile(readyFile, moduleName);
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
              {uploading ? 'Mengoptimalkan & memvalidasi berkas...' : uploadedFileName || 'Tarik & lepas berkas ke sini, atau pilih file'}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {compressionNote || 'Validasi signature MIME & kompresi foto otomatis · Maksimal 15 MB'}
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

export const FileUploader = FileDropzone;

export function DocumentPreview({
  fileId,
  fileName,
  heightClass = 'h-72',
}: {
  fileId: string;
  fileName?: string | null;
  heightClass?: string;
}) {
  const previewHref = apiUrl(`/api/files/${fileId}/preview`);
  const downloadHref = apiUrl(`/api/files/${fileId}/download`);
  const isImage = /\.(png|jpe?g|webp)$/i.test(fileName || '');

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-slate-50 dark:bg-slate-950/60">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-200 truncate">
          <FileText className="w-3.5 h-3.5 text-[#0EA5E9] shrink-0" />
          <span className="truncate">{fileName || 'Pratinjau Dokumen'}</span>
        </span>
        <a
          href={downloadHref}
          className="inline-flex items-center gap-1 text-[#0EA5E9] font-semibold hover:underline shrink-0"
        >
          <Download className="w-3.5 h-3.5" /> Unduh
        </a>
      </div>
      {isImage ? (
        <div className="p-3 flex justify-center">
          <img
            src={previewHref}
            alt={fileName || 'Pratinjau Gambar'}
            className={`max-w-full ${heightClass} object-contain rounded-lg`}
          />
        </div>
      ) : (
        <iframe
          title={`Pratinjau ${fileName || 'Dokumen PDF'}`}
          src={previewHref}
          className={`w-full ${heightClass} bg-white`}
        />
      )}
    </div>
  );
}
