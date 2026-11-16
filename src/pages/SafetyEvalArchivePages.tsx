import React, { useEffect, useState } from 'react';
import { Award, Download, FileSpreadsheet, Lock, Plus, Printer } from 'lucide-react';
import { apiGet, apiPost, apiUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, GlassCard, LoadingSkeleton, Modal, StatusIndicator } from '../components/ui/Primitives';
import { A4PrintModal, type PrintDocumentConfig } from '../components/print/A4PrintEngine';
import { formatTanggalIndonesia } from '../lib/rbac';
import type { PersonnelRecord } from '../lib/types';

export function SafeguardingPage() {
  const { can, notify } = useAuth();
  const [tab, setTab] = useState<'risiko' | 'persetujuan' | 'insiden' | 'pengaduan'>('risiko');
  const [data, setData] = useState<{
    risks: Record<string, unknown>[];
    consents: Record<string, unknown>[];
    incidents: Record<string, unknown>[];
    whistleblowing: Record<string, unknown>[];
    isAuthorizedSafety: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [riskOpen, setRiskOpen] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [incOpen, setIncOpen] = useState(false);
  const [aduOpen, setAduOpen] = useState(false);

  const [riskForm, setRiskForm] = useState({
    activityTitle: '',
    participantUnder18: true,
    adultChaperoneCount: 2,
    environmentNotes: '',
    transportPlan: '',
    emergencyPlan: '',
    emergencyContact: '',
    riskLevel: 'sedang',
  });
  const [consentForm, setConsentForm] = useState({
    activityTitle: '',
    consentParticipation: true,
    consentGuardian: true,
    consentDocumentation: true,
    consentPublication: false,
  });
  const [incForm, setIncForm] = useState({
    location: '',
    category: 'Keselamatan Kegiatan',
    urgency: 'sedang',
    chronology: '',
    initialAction: '',
  });
  const [aduForm, setAduForm] = useState({
    reporterMode: 'rahasia',
    category: 'Tata Kelola Administrasi',
    chronology: '',
    conflictWithPrimaryHandler: false,
  });

  const load = () => {
    setLoading(true);
    apiGet<typeof data>('/api/safeguarding')
      .then(setData)
      .catch((err) => notify(err instanceof Error ? err.message : 'Gagal memuat data perlindungan.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  if (loading || !data) return <LoadingSkeleton rows={5} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Safeguarding & Perlindungan Peserta
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Penilaian risiko, persetujuan terpisah (partisipasi vs publikasi), pelaporan insiden terbatas, dan pengaduan internal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('perlindungan', 'create') && (
            <>
              <button type="button" onClick={() => setRiskOpen(true)} className="px-3 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold">
                + Penilaian Risiko
              </button>
              <button type="button" onClick={() => setConsentOpen(true)} className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold">
                + Catat Persetujuan Terpisah
              </button>
              <button type="button" onClick={() => setIncOpen(true)} className="px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                + Lapor Insiden
              </button>
            </>
          )}
          <button type="button" onClick={() => setAduOpen(true)} className="px-3 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-semibold">
            Kanal Pengaduan Rahasia
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-sky-50/80 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 p-4 text-xs text-slate-700 dark:text-slate-300">
        <strong>Kebijakan Internal Perlindungan Peserta DPBI:</strong> Untuk kegiatan tatap muka yang melibatkan pelajar di bawah 18 tahun, kebijakan internal DPBI menetapkan standar awal minimal <strong className="tabular-nums">2 pendamping dewasa</strong> (disesuaikan menurut tingkat risiko). Kebijakan ini merupakan standar internal organisasi.
      </div>

      <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1 flex-wrap">
        <button type="button" onClick={() => setTab('risiko')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === 'risiko' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          Penilaian Risiko ({data.risks.length})
        </button>
        <button type="button" onClick={() => setTab('persetujuan')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === 'persetujuan' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          Persetujuan Terpisah ({data.consents.length})
        </button>
        <button type="button" onClick={() => setTab('insiden')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === 'insiden' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          Laporan Insiden ({data.incidents.length})
        </button>
        <button type="button" onClick={() => setTab('pengaduan')} className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${tab === 'pengaduan' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
          Whistleblowing / Pengaduan
        </button>
      </div>

      {tab === 'risiko' && (
        <GlassCard className="p-5 divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
          {data.risks.length === 0 ? (
            <EmptyState title="Belum ada penilaian risiko" description="Tambahkan formulir penilaian risiko sebelum kegiatan tatap muka berlangsung." />
          ) : (
            data.risks.map((r) => (
              <div key={String(r.id)} className="py-3 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{String(r.activity_title)}</p>
                  <p className="text-slate-500">
                    Pendamping Dewasa: <strong className="tabular-nums">{Number(r.adult_chaperone_count)}</strong> · Risiko: {String(r.risk_level)} · Kontak Darurat: {String(r.emergency_contact)}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400">Rencana Darurat: {String(r.emergency_plan)}</p>
                </div>
                <StatusIndicator status={String(r.status)} />
              </div>
            ))
          )}
        </GlassCard>
      )}

      {tab === 'persetujuan' && (
        <GlassCard className="p-5">
          {data.consents.length === 0 ? (
            <EmptyState title="Belum ada catatan persetujuan" description="Catat persetujuan peserta, wali, dokumentasi, dan publikasi secara terpisah." />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2 pr-4">Peserta & Kegiatan</th>
                      <th className="py-2 pr-4">Ikut Kegiatan</th>
                      <th className="py-2 pr-4">Izin Orang Tua/Wali</th>
                      <th className="py-2 pr-4">Dokumentasi</th>
                      <th className="py-2">Publikasi Foto/Video</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {data.consents.map((c) => (
                      <tr key={String(c.id)}>
                        <td className="py-2.5 pr-4">
                          <p className="font-semibold text-slate-900 dark:text-white">{String(c.personnel_name)}</p>
                          <p className="text-[11px] text-slate-500">{String(c.activity_title)}</p>
                        </td>
                        <td className="py-2.5 pr-4">{c.consent_participation ? 'Ya' : 'Tidak'}</td>
                        <td className="py-2.5 pr-4">{c.consent_guardian ? 'Ya' : 'Tidak'}</td>
                        <td className="py-2.5 pr-4">{c.consent_documentation ? 'Ya' : 'Tidak'}</td>
                        <td className="py-2.5 font-semibold">{c.consent_publication ? 'Diizinkan Terpisah' : 'Tidak Dipublikasikan'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {data.consents.map((c) => (
                  <div key={String(c.id)} className="py-3 space-y-1.5">
                    <p className="font-bold text-slate-900 dark:text-white">{String(c.personnel_name)}</p>
                    <p className="text-slate-500">{String(c.activity_title)}</p>
                    <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                      <span>Ikut: <strong>{c.consent_participation ? 'Ya' : 'Tidak'}</strong></span>
                      <span>Izin Wali: <strong>{c.consent_guardian ? 'Ya' : 'Tidak'}</strong></span>
                      <span>Dokumentasi: <strong>{c.consent_documentation ? 'Ya' : 'Tidak'}</strong></span>
                      <span>Publikasi: <strong>{c.consent_publication ? 'Diizinkan' : 'Tidak'}</strong></span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </GlassCard>
      )}

      {tab === 'insiden' && (
        <GlassCard className="p-5 divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
          {data.incidents.length === 0 ? (
            <p className="text-slate-500 py-4">Tidak ada laporan insiden yang dapat ditampilkan pada level akses Anda.</p>
          ) : (
            data.incidents.map((inc) => (
              <div key={String(inc.id)} className="py-3 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[#0EA5E9] font-semibold">{String(inc.reference_number)} · Urgensi {String(inc.urgency)}</p>
                  <StatusIndicator status={String(inc.status)} />
                </div>
                <p className="font-bold text-sm text-slate-900 dark:text-white">{String(inc.category)} — {String(inc.location)}</p>
                <p className="text-slate-600 dark:text-slate-300">{String(inc.chronology)}</p>
                <p className="text-slate-500">Tindakan Awal: {String(inc.initial_action)} · Eskalasi: {String(inc.escalated_to)}</p>
              </div>
            ))
          )}
        </GlassCard>
      )}

      {tab === 'pengaduan' && (
        <GlassCard className="p-5 space-y-3 text-xs">
          <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
            <Lock className="w-4 h-4 text-[#0EA5E9]" />
            <span>Akses isi pengaduan dibatasi secara ketat hanya untuk Penanggung Jawab Organisasi & pihak berwenang tanpa konflik kepentingan.</span>
          </div>
          {!data.isAuthorizedSafety ? (
            <p className="text-slate-500 py-4">Anda dapat mengirimkan pengaduan rahasia melalui tombol "Kanal Pengaduan Rahasia" di atas. Daftar laporan masuk bersifat rahasia dan hanya dibuka oleh pejabat perlindungan yang berwenang.</p>
          ) : (
            <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
              {data.whistleblowing.map((w) => (
                <div key={String(w.id)} className="py-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-mono text-[#0EA5E9] font-semibold">{String(w.reference_number)} · Mode {String(w.reporter_mode)}</p>
                    <StatusIndicator status={String(w.status)} />
                  </div>
                  <p className="font-bold">{String(w.category)} {w.conflict_rerouted ? '(Dialihkan karena Konflik Kepentingan)' : ''}</p>
                  <p className="text-slate-600 dark:text-slate-300">{String(w.chronology)}</p>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      )}

      {/* Modals */}
      <Modal open={riskOpen} onClose={() => setRiskOpen(false)} title="Formulir Penilaian Risiko Kegiatan">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiPost('/api/safeguarding/risks', riskForm);
              notify('Penilaian risiko disimpan.', 'success');
              setRiskOpen(false);
              load();
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Gagal menyimpan penilaian risiko.', 'error');
            }
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block font-semibold mb-1">Nama Kegiatan</label>
            <input required value={riskForm.activityTitle} onChange={(e) => setRiskForm({ ...riskForm, activityTitle: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Jumlah Pendamping Dewasa</label>
              <input type="number" min={0} required value={riskForm.adultChaperoneCount} onChange={(e) => setRiskForm({ ...riskForm, adultChaperoneCount: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Kontak Darurat Lapangan</label>
              <input required value={riskForm.emergencyContact} onChange={(e) => setRiskForm({ ...riskForm, emergencyContact: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Rencana Darurat & Mitigasi</label>
            <textarea rows={2} required value={riskForm.emergencyPlan} onChange={(e) => setRiskForm({ ...riskForm, emergencyPlan: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Simpan Penilaian Risiko</button>
          </div>
        </form>
      </Modal>

      <Modal open={consentOpen} onClose={() => setConsentOpen(false)} title="Catat Persetujuan Terpisah Peserta">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await apiPost('/api/safeguarding/consents', consentForm);
              notify('Persetujuan terpisah tercatat.', 'success');
              setConsentOpen(false);
              load();
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Gagal mencatat persetujuan.', 'error');
            }
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block font-semibold mb-1">Nama Kegiatan</label>
            <input required value={consentForm.activityTitle} onChange={(e) => setConsentForm({ ...consentForm, activityTitle: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div className="space-y-2 pt-1">
            <label className="flex items-center gap-2"><input type="checkbox" checked={consentForm.consentParticipation} onChange={(e) => setConsentForm({ ...consentForm, consentParticipation: e.target.checked })} /> Persetujuan Mengikuti Kegiatan</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={consentForm.consentGuardian} onChange={(e) => setConsentForm({ ...consentForm, consentGuardian: e.target.checked })} /> Persetujuan Orang Tua / Wali (Di Bawah 18 Tahun)</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={consentForm.consentDocumentation} onChange={(e) => setConsentForm({ ...consentForm, consentDocumentation: e.target.checked })} /> Persetujuan Dokumentasi Arsip Internal</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={consentForm.consentPublication} onChange={(e) => setConsentForm({ ...consentForm, consentPublication: e.target.checked })} /> Persetujuan Terpisah Publikasi Foto/Video</label>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Simpan Persetujuan</button>
          </div>
        </form>
      </Modal>

      <Modal open={incOpen} onClose={() => setIncOpen(false)} title="Laporkan Insiden Kegiatan">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await apiPost<{ referenceNumber: string }>('/api/safeguarding/incidents', incForm);
              notify(`Laporan insiden ${res.referenceNumber} dieskalasikan ke Penanggung Jawab.`, 'success');
              setIncOpen(false);
              load();
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Gagal mengirim laporan insiden.', 'error');
            }
          }}
          className="space-y-3 text-xs"
        >
          <div>
            <label className="block font-semibold mb-1">Lokasi Kejadian</label>
            <input required value={incForm.location} onChange={(e) => setIncForm({ ...incForm, location: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Kronologi Faktual</label>
            <textarea rows={3} required value={incForm.chronology} onChange={(e) => setIncForm({ ...incForm, chronology: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div>
            <label className="block font-semibold mb-1">Tindakan Awal</label>
            <input required value={incForm.initialAction} onChange={(e) => setIncForm({ ...incForm, initialAction: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-rose-600 text-white font-semibold">Kirim Laporan Insiden</button>
          </div>
        </form>
      </Modal>

      <Modal open={aduOpen} onClose={() => setAduOpen(false)} title="Kanal Pengaduan Internal & Whistleblowing">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              const res = await apiPost<{ referenceNumber: string }>('/api/safeguarding/whistleblowing', aduForm);
              notify(`Pengaduan ${res.referenceNumber} dicatat secara rahasia.`, 'success');
              setAduOpen(false);
              load();
            } catch (err) {
              notify(err instanceof Error ? err.message : 'Gagal mengirim pengaduan.', 'error');
            }
          }}
          className="space-y-3 text-xs"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Kategori</label>
              <input required value={aduForm.category} onChange={(e) => setAduForm({ ...aduForm, category: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
            </div>
            <div>
              <label className="block font-semibold mb-1">Identitas Pelapor</label>
              <select value={aduForm.reporterMode} onChange={(e) => setAduForm({ ...aduForm, reporterMode: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2">
                <option value="rahasia">Dirahasiakan</option>
                <option value="terbuka">Terbuka</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Kronologi Laporan</label>
            <textarea rows={3} required value={aduForm.chronology} onChange={(e) => setAduForm({ ...aduForm, chronology: e.target.value })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" />
          </div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={aduForm.conflictWithPrimaryHandler} onChange={(e) => setAduForm({ ...aduForm, conflictWithPrimaryHandler: e.target.checked })} />
            <span>Terdapat potensi konflik kepentingan dengan pemeriksa utama (alihkan ke pemeriksa alternatif)</span>
          </label>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-semibold">Kirim Pengaduan</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function EvaluationsPage() {
  const { can, notify } = useAuth();
  const [evaluations, setEvaluations] = useState<Record<string, unknown>[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    personnelId: '',
    taskCompletionScore: 90,
    reportTimelinessScore: 88,
    reportQualityScore: 90,
    coordinationScore: 85,
    coachingRecommendation: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [eRes, pRes] = await Promise.all([
        apiGet<{ evaluations: Record<string, unknown>[] }>('/api/evaluations'),
        can('personalia', 'view') ? apiGet<{ personnel: PersonnelRecord[] }>('/api/personnel') : Promise.resolve({ personnel: [] }),
      ]);
      setEvaluations(eRes.evaluations);
      setPersonnel(pRes.personnel);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat evaluasi.', 'error');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/evaluations', form);
      notify('Evaluasi kinerja berhasil disimpan.', 'success');
      setOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan evaluasi.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Pusat Evaluasi Kinerja</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Penilaian berbasis penyelesaian tugas (30%), ketepatan laporan (25%), kualitas laporan (25%), dan koordinasi (20%) disertai tinjauan manusia.
          </p>
        </div>
        {can('evaluasi', 'create') && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Input Evaluasi
          </button>
        )}
      </div>

      <GlassCard className="p-5">
        {evaluations.length === 0 ? (
          <EmptyState title="Belum ada evaluasi" description="Catatan evaluasi kinerja periode berjalan akan muncul di sini." />
        ) : (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                  <tr>
                    <th className="py-2.5 pr-4">Personel</th>
                    <th className="py-2.5 pr-4 text-right">Tugas</th>
                    <th className="py-2.5 pr-4 text-right">Ketepatan</th>
                    <th className="py-2.5 pr-4 text-right">Kualitas</th>
                    <th className="py-2.5 pr-4 text-right">Koordinasi</th>
                    <th className="py-2.5 pr-4 text-right">Skor Total</th>
                    <th className="py-2.5">Rekomendasi Pembinaan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800 tabular-nums">
                  {evaluations.map((ev) => (
                    <tr key={String(ev.id)}>
                      <td className="py-3 pr-4 font-semibold text-slate-900 dark:text-white">{String(ev.personnel_name)}</td>
                      <td className="py-3 pr-4 text-right">{Number(ev.task_completion_score)}</td>
                      <td className="py-3 pr-4 text-right">{Number(ev.report_timeliness_score)}</td>
                      <td className="py-3 pr-4 text-right">{Number(ev.report_quality_score)}</td>
                      <td className="py-3 pr-4 text-right">{Number(ev.coordination_score)}</td>
                      <td className="py-3 pr-4 text-right font-mono font-bold text-[#0EA5E9]">{Number(ev.total_score)}</td>
                      <td className="py-3 text-slate-600 dark:text-slate-300">{String(ev.coaching_recommendation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs tabular-nums">
              {evaluations.map((ev) => (
                <div key={String(ev.id)} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-slate-900 dark:text-white">{String(ev.personnel_name)}</p>
                    <span className="font-mono font-bold text-[#0EA5E9]">Skor {Number(ev.total_score)}</span>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Tugas {Number(ev.task_completion_score)} · Ketepatan {Number(ev.report_timeliness_score)} · Kualitas {Number(ev.report_quality_score)} · Koordinasi {Number(ev.coordination_score)}
                  </p>
                  <p className="text-slate-600 dark:text-slate-300">{String(ev.coaching_recommendation)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </GlassCard>

      <Modal open={open} onClose={() => setOpen(false)} title="Input Evaluasi Kinerja Personel">
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Personel</label>
            <select
              required
              value={form.personnelId}
              onChange={(e) => setForm({ ...form, personnelId: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              <option value="">Pilih personel...</option>
              {personnel.map((p) => (
                <option key={p.id} value={p.id}>{p.fullName} ({p.provinceName})</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div><label className="block font-semibold mb-1">Tugas (30%)</label><input type="number" min={0} max={100} value={form.taskCompletionScore} onChange={(e) => setForm({ ...form, taskCompletionScore: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" /></div>
            <div><label className="block font-semibold mb-1">Ketepatan (25%)</label><input type="number" min={0} max={100} value={form.reportTimelinessScore} onChange={(e) => setForm({ ...form, reportTimelinessScore: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" /></div>
            <div><label className="block font-semibold mb-1">Kualitas (25%)</label><input type="number" min={0} max={100} value={form.reportQualityScore} onChange={(e) => setForm({ ...form, reportQualityScore: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" /></div>
            <div><label className="block font-semibold mb-1">Koordinasi (20%)</label><input type="number" min={0} max={100} value={form.coordinationScore} onChange={(e) => setForm({ ...form, coordinationScore: Number(e.target.value) })} className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2" /></div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Catatan & Rekomendasi Pembinaan (Human Review)</label>
            <textarea
              rows={3}
              required
              value={form.coachingRecommendation}
              onChange={(e) => setForm({ ...form, coachingRecommendation: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Simpan Evaluasi</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ArchivePage() {
  const { user, can, notify } = useAuth();
  const [data, setData] = useState<{
    archivedBatches: Record<string, unknown>[];
    personalDocs: Record<string, unknown>[];
    personalLkl: Record<string, unknown>[];
    alumniWindow: { daysRemaining: number; expiresAtIso: string; reminderStage: string } | null;
    alumniUsers: Record<string, unknown>[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [printConfig, setPrintConfig] = useState<PrintDocumentConfig | null>(null);

  const load = () => {
    setLoading(true);
    apiGet<typeof data>('/api/archive')
      .then(setData)
      .catch((err) => notify(err instanceof Error ? err.message : 'Gagal memuat arsip.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const handleExtend = async (userId: string) => {
    try {
      await apiPost(`/api/archive/alumni/${userId}/extend`, {
        days: 30,
        reason: 'Perpanjangan akses verifikasi dokumen alumni oleh pengelola.',
      });
      notify('Masa akses arsip Alumni diperpanjang 30 hari & dicatat pada audit log.', 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memperpanjang akses.', 'error');
    }
  };

  if (loading || !data) return <LoadingSkeleton rows={4} />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Arsip Organisasi & Portal Alumni (30 Hari)
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Arsip permanen angkatan terdahulu, ekspor data teraudit, dan akses dokumen pribadi Alumni selama 30 hari pasca masa tugas.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setPrintConfig({
                template: 'arsip',
                documentNumber: `DPBI/ARSIP/${new Date().getFullYear()}/REKAP`,
                title: 'Rekapitulasi Arsip Angkatan & Dokumen Organisasi',
                subtitle: 'Salinan ringkasan arsip resmi SATU DPBI sesuai kewenangan akun.',
                issuedDate: new Date().toISOString().slice(0, 10),
                defaultOrientation: 'landscape',
                metadata: [
                  { label: 'Pengakses', value: user?.fullName || 'Anggota DPBI' },
                  { label: 'Peran', value: user?.roleLabel || '—' },
                  { label: 'Angkatan Diarsipkan', value: `${data.archivedBatches.length} Angkatan` },
                  { label: 'Dokumen Tercatat', value: `${data.personalDocs.length} Dokumen` },
                ],
                table: {
                  headers: ['Nomor Dokumen', 'Judul Dokumen', 'Kategori', 'Tanggal Terbit', 'Status'],
                  rows: data.personalDocs.map((d) => [
                    String(d.document_number || '—'),
                    String(d.title || '—'),
                    String(d.category || '—'),
                    formatTanggalIndonesia(String(d.issued_date || '')),
                    String(d.status || '—'),
                  ]),
                },
                signatoryName: user?.fullName || 'Sekretariat Nasional DPBI',
                signatoryRole: user?.roleLabel || 'Pengelola Arsip DPBI',
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9]"
          >
            <Printer className="w-4 h-4 text-[#0EA5E9]" /> Cetak Rekap Arsip A4
          </button>
          <a
            href={apiUrl('/api/archive/export-personal')}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
          >
            <Download className="w-4 h-4" /> Ekspor Arsip Pribadi (JSON)
          </a>
        </div>
      </div>

      {data.alumniWindow && (
        <div className="rounded-2xl bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900 dark:text-white">
              Masa Akses Arsip Alumni Anda Tersisa {data.alumniWindow.daysRemaining} Hari
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Berakhir pada {formatTanggalIndonesia(data.alumniWindow.expiresAtIso, true)}. Segera unduh sertifikat dan ekspor riwayat pribadi Anda. Dokumen pertanggungjawaban organisasi tetap tersimpan sesuai kebijakan retensi.
            </p>
          </div>
          <span className="font-mono text-2xl font-bold text-[#0EA5E9] tabular-nums">
            {data.alumniWindow.daysRemaining} Hari
          </span>
        </div>
      )}

      {/* Data Export Center (CSV) */}
      {can('arsip', 'export') && (
        <GlassCard className="p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <FileSpreadsheet className="w-4 h-4 text-[#0EA5E9]" /> Pusat Ekspor Data Teraudit (CSV)
              </h2>
              <p className="text-xs text-slate-500">
                Setiap unduhan CSV dicatat otomatis pada Audit Log keamanan organisasi.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <a
              href={apiUrl('/api/export/bundle?scope=personnel')}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] bg-white/70 dark:bg-slate-900/60 font-semibold transition-colors"
            >
              <span>Data Personalia & Duta</span>
              <Download className="w-4 h-4 text-[#0EA5E9]" />
            </a>
            <a
              href={apiUrl('/api/export/bundle?scope=proposals')}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] bg-white/70 dark:bg-slate-900/60 font-semibold transition-colors"
            >
              <span>Rekap Proposal Kegiatan</span>
              <Download className="w-4 h-4 text-[#0EA5E9]" />
            </a>
            <a
              href={apiUrl('/api/export/bundle?scope=lkl')}
              className="flex items-center justify-between gap-2 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-[#0EA5E9] bg-white/70 dark:bg-slate-900/60 font-semibold transition-colors"
            >
              <span>Rekap Laporan LKL</span>
              <Download className="w-4 h-4 text-[#0EA5E9]" />
            </a>
          </div>
        </GlassCard>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Award className="w-4 h-4 text-[#0EA5E9]" /> Angkatan Selesai & Diarsipkan
          </h2>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
            {data.archivedBatches.map((b) => (
              <div key={String(b.id)} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{String(b.name)}</p>
                  <p className="text-slate-500 tabular-nums">
                    {formatTanggalIndonesia(String(b.term_starts_at))} s/d {formatTanggalIndonesia(String(b.term_ends_at))}
                  </p>
                </div>
                <StatusIndicator status={String(b.status)} />
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold">Dokumen & Riwayat Kegiatan Tersimpan</h2>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
            {data.personalDocs.slice(0, 6).map((d) => (
              <div key={String(d.id)} className="py-2.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold truncate text-slate-900 dark:text-white">{String(d.title)}</p>
                  <p className="text-slate-500 font-mono text-[11px]">{String(d.document_number)}</p>
                </div>
                {d.file_id ? (
                  <a href={`/api/files/${d.file_id}?download=1`} target="_blank" rel="noreferrer" className="text-[#0EA5E9] font-semibold shrink-0 hover:underline">
                    Unduh PDF
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {data.alumniUsers.length > 0 && can('arsip', 'manage') && (
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold">Pengelolaan Batas Waktu Akses Alumni ({user?.roleLabel})</h2>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
            {data.alumniUsers.map((au) => (
              <div key={String(au.id)} className="py-2.5 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{String(au.full_name)}</p>
                  <p className="text-slate-500 tabular-nums">Batas akses: {formatTanggalIndonesia(String(au.alumni_access_expires_at), true)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleExtend(String(au.id))}
                  className="px-3 py-1.5 rounded-lg bg-[#0EA5E9] text-white font-semibold"
                >
                  Perpanjang +30 Hari
                </button>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
      <A4PrintModal
        open={Boolean(printConfig)}
        config={printConfig}
        onClose={() => setPrintConfig(null)}
      />
    </div>
  );
}
