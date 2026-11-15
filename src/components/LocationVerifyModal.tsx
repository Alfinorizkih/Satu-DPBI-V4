import React, { useState } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Modal } from './ui/Primitives';

export function LocationVerifyModal({
  open,
  onClose,
  provinceCode,
  provinceName,
  actionType,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  provinceCode: string;
  provinceName: string;
  actionType: string;
  onVerified: () => void;
}) {
  const { notify } = useAuth();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<{ matched: boolean; reason: string } | null>(null);
  const [showExceptionForm, setShowExceptionForm] = useState(false);
  const [reason, setReason] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [validUntil, setValidUntil] = useState(() => {
    const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10);
  });

  const handleBrowserGps = () => {
    setChecking(true);
    setResult(null);
    if (!('geolocation' in navigator)) {
      setChecking(false);
      setResult({ matched: false, reason: 'Perangkat atau browser tidak mendukung Geolocation.' });
      setShowExceptionForm(true);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await apiPost<{ matched: boolean; reason: string }>('/api/location/verify', {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            provinceCode,
            actionType,
            mode: 'gps_browser',
          });
          setResult(res);
          if (res.matched) {
            notify('Lokasi terverifikasi sesuai wilayah penugasan.', 'success');
            onVerified();
          } else {
            setShowExceptionForm(true);
          }
        } catch (err) {
          notify(err instanceof Error ? err.message : 'Gagal memverifikasi koordinat.', 'error');
        } finally {
          setChecking(false);
        }
      },
      async () => {
        try {
          const res = await apiPost<{ matched: boolean; reason: string }>('/api/location/verify', {
            provinceCode,
            actionType,
            mode: 'gps_ditolak',
          });
          setResult(res);
        } catch {
          setResult({ matched: false, reason: 'Izin lokasi ditolak atau GPS tidak tersedia.' });
        } finally {
          setChecking(false);
          setShowExceptionForm(true);
        }
      },
      { timeout: 8000 }
    );
  };

  const handleManualDaring = async () => {
    setChecking(true);
    try {
      await apiPost('/api/location/verify', {
        provinceCode,
        actionType,
        mode: 'manual_daring',
      });
      notify('Verifikasi manual/daring dicatat dalam log audit.', 'success');
      onVerified();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mencatat verifikasi manual.', 'error');
    } finally {
      setChecking(false);
    }
  };

  const handleRequestException = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/location/exceptions', {
        provinceCode,
        reason,
        evidenceNote,
        validUntil,
      });
      notify('Permintaan pengecualian lokasi dikirim ke pihak Nasional.', 'success');
      onClose();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim pengecualian.', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Verifikasi Lokasi Koordinator Wilayah"
      subtitle={`Penugasan wilayah: ${provinceName}`}
      maxWidth="max-w-lg"
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-4 text-xs text-slate-700 dark:text-slate-300 space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-sky-900 dark:text-sky-200">
            <ShieldCheck className="w-4 h-4 text-[#0EA5E9]" />
            <span>Kebijakan Privasi Lokasi SATU DPBI</span>
          </div>
          <p>
            Lokasi hanya diperiksa saat Anda melakukan tindakan penting wilayah ({actionType.replace(/_/g, ' ')}).
            Sistem <strong>tidak melakukan pelacakan latar belakang</strong>, tidak menyimpan lokasi lebih lama dari kebutuhan, dan menyediakan jalur pengecualian resmi jika Anda sedang berada di luar provinsi.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            type="button"
            disabled={checking}
            onClick={handleBrowserGps}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
          >
            <MapPin className="w-4 h-4" />
            {checking ? 'Memeriksa Koordinat...' : 'Izinkan & Verifikasi Lokasi'}
          </button>
          <button
            type="button"
            disabled={checking}
            onClick={handleManualDaring}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          >
            Verifikasi Manual / Kegiatan Daring
          </button>
        </div>

        {result && (
          <div
            className={`rounded-xl p-3.5 text-xs border ${
              result.matched
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'
            }`}
          >
            {result.reason}
          </div>
        )}

        {showExceptionForm && (
          <form onSubmit={handleRequestException} className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-800">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              Ajukan Pengecualian Lokasi (Jika Sedang di Luar Provinsi / GPS Terkendala)
            </p>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Alasan Pengecualian</label>
              <input
                type="text"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Contoh: Mengikuti rapat koordinasi di luar kota / tugas sekolah"
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Bukti / Keterangan</label>
                <input
                  type="text"
                  value={evidenceNote}
                  onChange={(e) => setEvidenceNote(e.target.value)}
                  placeholder="Nomor surat tugas / keterangan"
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Berlaku Hingga</label>
                <input
                  type="date"
                  required
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold"
            >
              Kirim Permintaan Pengecualian
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}
