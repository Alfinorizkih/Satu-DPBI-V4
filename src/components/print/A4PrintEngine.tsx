import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { formatTanggalIndonesia } from '../../lib/rbac';
import { apiUrl } from '../../lib/api';

export type A4TemplateType =
  | 'surat_resmi'
  | 'sk_tugas'
  | 'sertifikat'
  | 'proposal'
  | 'lkl'
  | 'laporan_koordinator'
  | 'rekap_tabel'
  | 'arsip';

export interface PrintMetadataItem {
  label: string;
  value: string;
}

export interface PrintSection {
  heading: string;
  body: string;
}

export interface PrintTableData {
  headers: string[];
  rows: (string | number)[][];
}

export interface PrintDocumentConfig {
  template: A4TemplateType;
  documentNumber: string;
  title: string;
  subtitle?: string;
  issuedDate?: string;
  defaultOrientation?: 'portrait' | 'landscape';
  metadata: PrintMetadataItem[];
  sections?: PrintSection[];
  table?: PrintTableData;
  photoFileIds?: string[];
  signatoryName?: string;
  signatoryRole?: string;
  signatoryLocation?: string;
  footerNote?: string;
}

const TEMPLATE_LABELS: Record<A4TemplateType, string> = {
  surat_resmi: 'Surat Resmi Organisasi',
  sk_tugas: 'Surat Keputusan / Surat Tugas',
  sertifikat: 'Sertifikat / Piagam Pengabdian',
  proposal: 'Ringkasan Pengajuan Proposal',
  lkl: 'Laporan Kegiatan Lapangan (LKL)',
  laporan_koordinator: 'Laporan Koordinator Wilayah',
  rekap_tabel: 'Rekapitulasi Data Terstruktur',
  arsip: 'Salinan Arsip Organisasi',
};

export function A4PrintModal({
  open,
  config,
  onClose,
}: {
  open: boolean;
  config: PrintDocumentConfig | null;
  onClose: () => void;
}) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(
    config?.defaultOrientation ?? (config?.template === 'sertifikat' ? 'landscape' : 'portrait')
  );

  useEffect(() => {
    if (!config) return;
    setOrientation(
      config.defaultOrientation ?? (config.template === 'sertifikat' ? 'landscape' : 'portrait')
    );
  }, [config]);

  useEffect(() => {
    if (open) {
      document.body.classList.add('a4-printing-active');
    } else {
      document.body.classList.remove('a4-printing-active');
    }
    return () => {
      document.body.classList.remove('a4-printing-active');
    };
  }, [open]);

  if (!open || !config) return null;

  const effectiveOrientation = orientation;

  const modalNode = (
    <div
      className="a4-print-portal fixed inset-0 z-50 bg-slate-950/65 backdrop-blur-xs overflow-y-auto p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau Cetak A4 ${config.title}`}
    >
      {/* Print orientation style override */}
      <style>
        {effectiveOrientation === 'landscape'
          ? '@media print { @page { size: A4 landscape; margin: 12mm; } }'
          : '@media print { @page { size: A4 portrait; margin: 14mm; } }'}
      </style>

      {/* Non-printing Toolbar */}
      <div className="no-print max-w-5xl mx-auto mb-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-lg">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[#0EA5E9] uppercase tracking-wider">
            Pratinjau Cetak A4 · {TEMPLATE_LABELS[config.template]}
          </p>
          <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{config.title}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div
            role="group"
            aria-label="Pilih orientasi kertas A4"
            className="inline-flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"
          >
            <button
              type="button"
              aria-pressed={effectiveOrientation === 'portrait'}
              onClick={() => setOrientation('portrait')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                effectiveOrientation === 'portrait'
                  ? 'bg-white dark:bg-slate-900 text-[#0EA5E9] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              A4 Potret
            </button>
            <button
              type="button"
              aria-pressed={effectiveOrientation === 'landscape'}
              onClick={() => setOrientation('landscape')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                effectiveOrientation === 'landscape'
                  ? 'bg-white dark:bg-slate-900 text-[#0EA5E9] shadow-xs'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              A4 Lanskap
            </button>
          </div>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak / Simpan PDF (A4)
          </button>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pratinjau cetak"
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:text-slate-900 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dedicated A4 Sheet */}
      <article
        className={`a4-sheet ${
          effectiveOrientation === 'landscape' ? 'landscape' : ''
        } rounded-xl border border-slate-200 shadow-2xl p-8 sm:p-10 text-slate-900 text-[12px] leading-relaxed`}
      >
        {/* Institutional Letterhead (Kop Surat) */}
        <header className="flex items-center justify-between gap-4 pb-4 border-b-2 border-slate-900">
          <div className="flex items-center gap-3.5">
            <img
              src="/assets/aistudio/icon-utama_7bb14cc7.png"
              alt="Logo Resmi SATU DPBI"
              className="h-14 w-auto object-contain rounded-lg bg-white px-2 py-1 border border-slate-300 shrink-0"
            />
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#0EA5E9]">
                Duta Pelajar Berbudaya Indonesia
              </p>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight">
                SATU DPBI — Sistem Administrasi Terpadu
              </h1>
              <p className="text-[11px] text-slate-600">
                Satu Sistem, Satu Data, Satu Koordinasi · sekretariat@dpbi.or.id
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">Nomor Dokumen</p>
            <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">
              {config.documentNumber}
            </p>
            {config.issuedDate && (
              <p className="text-[11px] text-slate-600 tabular-nums mt-0.5">
                {formatTanggalIndonesia(config.issuedDate)}
              </p>
            )}
          </div>
        </header>

        {/* Document Heading */}
        <div className="py-5 text-center border-b border-slate-200">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">
            {TEMPLATE_LABELS[config.template]}
          </p>
          <h2 className="text-base sm:text-lg font-bold text-slate-900 mt-1">{config.title}</h2>
          {config.subtitle && (
            <p className="text-xs text-slate-600 mt-1 max-w-2xl mx-auto">{config.subtitle}</p>
          )}
        </div>

        {/* Metadata Grid */}
        {config.metadata.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3 py-4 border-b border-slate-200 avoid-break">
            {config.metadata.map((item) => (
              <div key={item.label}>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                  {item.label}
                </p>
                <p className="text-xs font-semibold text-slate-900 mt-0.5 break-words tabular-nums">
                  {item.value || '—'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Narrative Sections */}
        {config.sections && config.sections.length > 0 && (
          <div className="space-y-4 py-5">
            {config.sections.map((sec) => (
              <section key={sec.heading} className="avoid-break">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  {sec.heading}
                </h3>
                <p className="text-xs text-slate-800 whitespace-pre-line leading-relaxed">
                  {sec.body || '—'}
                </p>
              </section>
            ))}
          </div>
        )}

        {/* Repeating Header Table for Recaps / Reports */}
        {config.table && config.table.rows.length > 0 && (
          <div className="py-4">
            <table className="a4-table w-full border-collapse text-left text-[11px]">
              <thead>
                <tr className="border-y border-slate-400 bg-slate-100 text-slate-800">
                  {config.table.headers.map((h) => (
                    <th key={h} className="py-2 px-2.5 font-bold uppercase tracking-wider">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {config.table.rows.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx} className="py-1.5 px-2.5 text-slate-800 tabular-nums">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Attached Evidence Photos (e.g., LKL Documentation) */}
        {config.photoFileIds && config.photoFileIds.length > 0 && (
          <div className="py-4 avoid-break">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-2">
              Lampiran Dokumentasi Kegiatan
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {config.photoFileIds.map((fid, idx) => (
                <div key={fid} className="border border-slate-200 rounded-lg p-1.5 bg-slate-50">
                  <img
                    src={apiUrl(`/api/files/${fid}/preview`)}
                    alt={`Dokumentasi ${idx + 1}`}
                    className="w-full h-32 object-cover rounded"
                  />
                  <p className="text-[10px] text-slate-500 mt-1 text-center font-mono">
                    Foto #{idx + 1}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature Block */}
        <footer className="mt-8 pt-5 border-t border-slate-200 flex items-end justify-between gap-6 avoid-break">
          <div className="max-w-sm text-[10px] text-slate-500 space-y-1">
            <p>
              {config.footerNote ||
                'Dokumen ini diterbitkan secara resmi melalui Sistem Administrasi Terpadu Duta Pelajar Berbudaya Indonesia (SATU DPBI).'}
            </p>
            <p className="font-mono">Verifikasi Nomor Referensi: {config.documentNumber}</p>
          </div>
          <div className="text-center min-w-[200px]">
            <p className="text-[11px] text-slate-600">
              {config.signatoryLocation || 'Jakarta'},{' '}
              {formatTanggalIndonesia(config.issuedDate || new Date().toISOString())}
            </p>
            <p className="text-[11px] font-semibold text-slate-800 mt-0.5">
              {config.signatoryRole || 'Pengurus / Pejabat Berwenang DPBI'}
            </p>
            <div className="h-14" />
            <p className="text-xs font-bold text-slate-900 border-t border-slate-400 pt-1">
              {config.signatoryName || 'Sekretariat Nasional DPBI'}
            </p>
          </div>
        </footer>
      </article>
    </div>
  );

  return createPortal(modalNode, document.body);
}
