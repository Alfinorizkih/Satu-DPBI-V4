import React, { useState } from 'react';
import { ArrowLeft, BookOpen, HelpCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GlassCard } from '../components/ui/Primitives';

const FAQ_ITEMS = [
  {
    q: 'Bagaimana cara mendapatkan akun Duta SATU DPBI?',
    a: 'SATU DPBI tidak membuka pendaftaran publik bebas. Koordinator Wilayah mengajukan permintaan akun Duta disertai dokumen pendukung, lalu Sekretariat Nasional atau Super Admin memverifikasi dan menerbitkan tautan undangan satu kali pakai.',
  },
  {
    q: 'Bagaimana alur pengajuan Proposal dan LKL?',
    a: 'Pengaju mengisi formulir terstruktur dan mengunggah dokumen PDF sebagai berkas utama. Proposal dirutekan sesuai Approval Matrix (Koordinator Wilayah atau Pengurus Nasional sesuai bidang & risiko). Setelah kegiatan terlaksana, Duta mengirimkan LKL (luring/daring) beserta PDF dan foto dokumentasi untuk diperiksa Koordinator Wilayah.',
  },
  {
    q: 'Kapan sistem memeriksa lokasi Koordinator Wilayah?',
    a: 'Lokasi hanya diperiksa secara on-demand ketika Koordinator mengirimkan laporan wilayah atau memverifikasi kegiatan luring. Sistem tidak melakukan pelacakan latar belakang dan menyediakan pengecualian resmi jika berada di luar provinsi.',
  },
  {
    q: 'Apa yang terjadi setelah masa tugas 4 bulan berakhir?',
    a: 'Status beralih menjadi Alumni dengan masa akses arsip pribadi selama 30 hari (disertai pengingat H-7, H-3, dan hari terakhir) untuk mengunduh sertifikat dan riwayat kegiatan. Dokumen organisasi tetap tersimpan sesuai kebijakan retensi.',
  },
];

export function HelpPage() {
  const { user, navigate } = useAuth();
  const [openIdx, setOpenIdx] = useState<number | null>(0);

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4 px-2">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Pusat Bantuan & Panduan SATU DPBI</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Panduan operasional per role, pertanyaan umum, dan kontak Sekretariat Nasional.
          </p>
        </div>
        {!user && (
          <button
            type="button"
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Kembali ke Login
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <GlassCard className="p-5 space-y-2">
          <BookOpen className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold">Panduan Duta</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Lengkapi profil & dokumen identitas, ajukan proposal PDF, isi LKL setelah kegiatan, dan pantau tugas pribadi.
          </p>
        </GlassCard>
        <GlassCard className="p-5 space-y-2">
          <ShieldCheck className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold">Panduan Koordinator Wilayah</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Ajukan akun Duta wilayah, verifikasi berkas, periksa LKL wilayah, dan kirim Laporan Bulanan sebelum tanggal 5.
          </p>
        </GlassCard>
        <GlassCard className="p-5 space-y-2">
          <HelpCircle className="w-5 h-5 text-[#0EA5E9]" />
          <h2 className="text-sm font-bold">Kontak Sekretariat Nasional</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Email resmi: sekretariat@dpbi.or.id · Jam layanan koordinasi: Senin–Sabtu 08:00–17:00 WIB.
          </p>
        </GlassCard>
      </div>

      <GlassCard className="p-6 space-y-3">
        <h2 className="text-base font-bold text-slate-900 dark:text-white">Pertanyaan yang Sering Diajukan (FAQ)</h2>
        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {FAQ_ITEMS.map((item, i) => (
            <div key={item.q} className="py-3">
              <button
                type="button"
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full text-left flex items-center justify-between gap-4 text-sm font-semibold text-slate-800 dark:text-slate-100"
              >
                <span>{item.q}</span>
                <span className="text-[#0EA5E9] text-xs">{openIdx === i ? 'Tutup' : 'Baca'}</span>
              </button>
              {openIdx === i && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">{item.a}</p>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
