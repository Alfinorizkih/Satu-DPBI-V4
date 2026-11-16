import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Megaphone,
  Plus,
} from 'lucide-react';
import { apiGet, apiPatch, apiPost } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { EmptyState, GlassCard, LoadingSkeleton, Modal } from '../components/ui/Primitives';
import { formatTanggalIndonesia } from '../lib/rbac';
import type { NotificationRecord, TaskRecord } from '../lib/types';

export function AnnouncementsPage() {
  const { user, can, notify } = useAuth();
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [scopeTab, setScopeTab] = useState<'semua' | 'nasional' | 'wilayah' | 'angkatan'>('semua');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', body: '', scope: 'nasional', priority: 'normal', isPublic: false });
  const canPublishPublic = ['super_admin', 'wakil_super_admin', 'sekretariat_nasional', 'pengurus_nasional'].includes(
    user?.role || ''
  );

  const load = () => {
    setLoading(true);
    apiGet<{ announcements: Record<string, unknown>[] }>('/api/announcements')
      .then((res) => setItems(res.announcements))
      .catch((err) => notify(err instanceof Error ? err.message : 'Gagal memuat pengumuman.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/announcements', form);
      notify('Pengumuman diterbitkan.', 'success');
      setOpen(false);
      setForm({ title: '', body: '', scope: 'nasional', priority: 'normal', isPublic: false });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menerbitkan pengumuman.', 'error');
    }
  };

  const togglePublic = async (id: string, currentlyPublic: boolean) => {
    try {
      await apiPatch(`/api/announcements/${id}`, { isPublic: !currentlyPublic });
      notify(
        !currentlyPublic ? 'Pengumuman ditampilkan di Website Publik DPBI.' : 'Pengumuman ditarik ke lingkup internal saja.',
        'success'
      );
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengubah visibilitas publik.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  const filtered = items.filter((a) => (scopeTab === 'semua' ? true : String(a.scope) === scopeTab));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Pusat Pengumuman</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Informasi resmi berjenjang: Nasional, Wilayah Provinsi, dan Angkatan.
          </p>
        </div>
        {can('pengumuman', 'create') && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Buat Pengumuman
          </button>
        )}
      </div>

      {/* Scope Tabs */}
      <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1 flex-wrap">
        {[
          ['semua', `Semua (${items.length})`],
          ['nasional', 'Nasional'],
          ['wilayah', 'Wilayah'],
          ['angkatan', 'Angkatan'],
        ].map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setScopeTab(k as typeof scopeTab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
              scopeTab === k ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Belum ada pengumuman pada lingkup ini"
          description="Pengumuman nasional, wilayah, atau angkatan yang baru diterbitkan akan langsung tampil di sini."
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => {
            const prio = String(a.priority || 'normal');
            const isPub = Boolean(a.is_public);
            return (
              <GlassCard key={String(a.id)} className="p-5 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                  <span
                    className={`inline-flex items-center gap-1.5 font-semibold ${
                      prio === 'darurat'
                        ? 'text-rose-600 dark:text-rose-400'
                        : prio === 'penting'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-[#0EA5E9]'
                    }`}
                  >
                    <Megaphone className="w-3.5 h-3.5" /> Lingkup {String(a.scope).toUpperCase()} · Prioritas {prio}
                    {isPub && (
                      <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                        · <Globe className="w-3 h-3" /> Tampil di Website Publik
                      </span>
                    )}
                  </span>
                  <span className="tabular-nums">{formatTanggalIndonesia(String(a.published_at), true)}</span>
                </div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">{String(a.title)}</h2>
                <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{String(a.body)}</p>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <p className="text-slate-400">Diterbitkan oleh: {String(a.author_name)}</p>
                  {canPublishPublic && can('pengumuman', 'edit') && (
                    <button
                      type="button"
                      onClick={() => togglePublic(String(a.id), isPub)}
                      className="inline-flex items-center gap-1 text-[#0EA5E9] font-semibold hover:underline"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {isPub ? 'Sembunyikan dari Website Publik' : 'Tampilkan di Website Publik'}
                    </button>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Buat Pengumuman Baru">
        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Judul Pengumuman *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Lingkup</label>
              <select
                value={form.scope}
                onChange={(e) => setForm({ ...form, scope: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="nasional">Nasional</option>
                <option value="wilayah">Wilayah</option>
                <option value="angkatan">Angkatan</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Prioritas</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="normal">Normal</option>
                <option value="penting">Penting</option>
                <option value="darurat">Darurat</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Isi Pengumuman *</label>
            <textarea
              rows={4}
              required
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          {canPublishPublic && (
            <label className="flex items-center gap-2 pt-1 cursor-pointer text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={form.isPublic}
                onChange={(e) => setForm({ ...form, isPublic: e.target.checked })}
              />
              <span>Tampilkan di Pengumuman Publik Website (tanpa data internal/PII)</span>
            </label>
          )}
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">
              Terbitkan Pengumuman
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

interface UnifiedEvent {
  id: string;
  title: string;
  category: string;
  startAt: string;
  location: string;
  description: string;
  isDeadline?: boolean;
}

export function CalendarPage() {
  const { can, notify, navigate } = useAuth();
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [viewMode, setViewMode] = useState<'bulanan' | 'mingguan' | 'agenda'>('bulanan');
  const [cursorDate, setCursorDate] = useState(() => new Date());
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'Rapat Nasional',
    startAt: '2026-12-01T19:00',
    location: 'Daring Nasional',
    description: '',
  });

  const load = async () => {
    setLoading(true);
    try {
      const [evRes, taskRes] = await Promise.all([
        apiGet<{ events: Record<string, unknown>[] }>('/api/calendar'),
        can('tugas', 'view') ? apiGet<{ tasks: TaskRecord[] }>('/api/tasks').catch(() => ({ tasks: [] })) : Promise.resolve({ tasks: [] }),
      ]);
      const orgEvents: UnifiedEvent[] = evRes.events.map((ev) => ({
        id: String(ev.id),
        title: String(ev.title),
        category: String(ev.category),
        startAt: String(ev.start_at),
        location: String(ev.location || 'Daring / Nasional'),
        description: String(ev.description || ''),
      }));
      const taskDeadlines: UnifiedEvent[] = taskRes.tasks
        .filter((t) => t.status !== 'selesai')
        .map((t) => ({
          id: `task-${t.id}`,
          title: `Tenggat: ${t.title}`,
          category: 'Tenggat Tugas',
          startAt: `${t.deadline.slice(0, 10)}T23:59:00`,
          location: t.provinceName || 'Nasional',
          description: `${t.referenceNumber} · Penanggung jawab: ${t.assigneeName}`,
          isDeadline: true,
        }));
      const combined = [...orgEvents, ...taskDeadlines].sort((a, b) => a.startAt.localeCompare(b.startAt));
      setEvents(combined);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat kalender.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/calendar', form);
      notify('Agenda kalender ditambahkan.', 'success');
      setOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menambahkan agenda.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  // Build month grid starting Monday
  const year = cursorDate.getFullYear();
  const month = cursorDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 .. Sun=6
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthTitle = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(firstDay);

  const monthCells: (Date | null)[] = [];
  for (let i = 0; i < startOffset; i++) monthCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) monthCells.push(new Date(year, month, d));
  while (monthCells.length % 7 !== 0) monthCells.push(null);

  // Build 7-day strip for current week around cursorDate
  const weekOffset = (cursorDate.getDay() + 6) % 7;
  const weekStart = new Date(cursorDate);
  weekStart.setDate(cursorDate.getDate() - weekOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(weekStart);
    dt.setDate(weekStart.getDate() + i);
    return dt;
  });

  const toDateKey = (dt: Date) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Kalender Organisasi Terpadu</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Agenda organisasi dan tenggat tugas aktif tersinkronisasi langsung dari database.
          </p>
        </div>
        {can('kalender', 'create') && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Tambah Agenda
          </button>
        )}
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
          {[
            ['bulanan', 'Bulanan'],
            ['mingguan', 'Mingguan'],
            ['agenda', 'Daftar Agenda'],
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => setViewMode(k as typeof viewMode)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                viewMode === k ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lbl}
            </button>
          ))}
        </div>

        {viewMode !== 'agenda' && (
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() =>
                setCursorDate((prev) =>
                  viewMode === 'bulanan'
                    ? new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
                    : new Date(prev.getTime() - 7 * 86400000)
                )
              }
              aria-label="Periode sebelumnya"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-semibold min-w-[140px] text-center capitalize text-slate-900 dark:text-white">
              {monthTitle}
            </span>
            <button
              type="button"
              onClick={() =>
                setCursorDate((prev) =>
                  viewMode === 'bulanan'
                    ? new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
                    : new Date(prev.getTime() + 7 * 86400000)
                )
              }
              aria-label="Periode berikutnya"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {viewMode === 'bulanan' && (
        <GlassCard className="p-4 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-slate-500 pb-2 border-b border-slate-200 dark:border-slate-800">
              {['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px bg-slate-200/70 dark:bg-slate-800 border border-slate-200/70 dark:border-slate-800 mt-2 rounded-xl overflow-hidden">
              {monthCells.map((cell, idx) => {
                if (!cell) return <div key={`empty-${idx}`} className="min-h-[84px] bg-slate-50/70 dark:bg-slate-900/40" />;
                const key = toDateKey(cell);
                const dayEvents = events.filter((e) => e.startAt.slice(0, 10) === key);
                const isToday = key === toDateKey(new Date());
                return (
                  <div
                    key={key}
                    className={`min-h-[84px] p-1.5 bg-white dark:bg-slate-900 space-y-1 ${
                      isToday ? 'ring-1 ring-inset ring-[#0EA5E9]' : ''
                    }`}
                  >
                    <p
                      className={`text-[11px] font-mono tabular-nums font-semibold ${
                        isToday ? 'text-[#0EA5E9]' : 'text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {cell.getDate()}
                    </p>
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => setSelectedEvent(ev)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-[10px] font-medium truncate ${
                            ev.isDeadline
                              ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                              : 'bg-sky-50 dark:bg-sky-950/50 text-[#0EA5E9]'
                          }`}
                        >
                          {ev.title}
                        </button>
                      ))}
                      {dayEvents.length > 2 && (
                        <p className="text-[10px] text-slate-400 px-1">+{dayEvents.length - 2} lainnya</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </GlassCard>
      )}

      {viewMode === 'mingguan' && (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-3">
          {weekDays.map((day) => {
            const key = toDateKey(day);
            const dayEvents = events.filter((e) => e.startAt.slice(0, 10) === key);
            return (
              <GlassCard key={key} className="p-3.5 space-y-2 text-xs">
                <div className="pb-2 border-b border-slate-200 dark:border-slate-800">
                  <p className="text-[11px] text-slate-500">
                    {new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(day)}
                  </p>
                  <p className="font-mono font-bold text-sm tabular-nums text-slate-900 dark:text-white">
                    {day.getDate()} {new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(day)}
                  </p>
                </div>
                {dayEvents.length === 0 ? (
                  <p className="text-[11px] text-slate-400">Tidak ada agenda</p>
                ) : (
                  <div className="space-y-1.5">
                    {dayEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => setSelectedEvent(ev)}
                        className="w-full text-left p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 hover:border-[#0EA5E9] border border-transparent"
                      >
                        <p className="font-semibold text-slate-900 dark:text-white line-clamp-2">{ev.title}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{ev.category}</p>
                      </button>
                    ))}
                  </div>
                )}
              </GlassCard>
            );
          })}
        </div>
      )}

      {viewMode === 'agenda' && (
        <GlassCard className="p-5 divide-y divide-slate-200/70 dark:divide-slate-800">
          {events.length === 0 ? (
            <EmptyState title="Belum ada agenda" description="Agenda organisasi dan tenggat tugas akan tampil di sini." />
          ) : (
            events.map((ev) => (
              <div key={ev.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-start gap-3">
                  {ev.isDeadline ? (
                    <Clock className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
                  ) : (
                    <CalendarIcon className="w-4 h-4 text-[#0EA5E9] mt-0.5 shrink-0" />
                  )}
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{ev.title}</p>
                    <p className="text-slate-500 mt-0.5">{ev.description}</p>
                  </div>
                </div>
                <div className="text-right tabular-nums">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {formatTanggalIndonesia(ev.startAt, !ev.isDeadline)}
                  </p>
                  <p className="text-[11px] text-slate-500">{ev.category} · {ev.location}</p>
                </div>
              </div>
            ))
          )}
        </GlassCard>
      )}

      <Modal open={Boolean(selectedEvent)} onClose={() => setSelectedEvent(null)} title={selectedEvent?.title || 'Detail Agenda'}>
        {selectedEvent && (
          <div className="space-y-3 text-xs">
            <p className="font-semibold text-[#0EA5E9]">{selectedEvent.category}</p>
            <p className="tabular-nums"><strong>Waktu:</strong> {formatTanggalIndonesia(selectedEvent.startAt, !selectedEvent.isDeadline)}</p>
            <p><strong>Lokasi / Wilayah:</strong> {selectedEvent.location}</p>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{selectedEvent.description || 'Tidak ada catatan.'}</p>
            {selectedEvent.isDeadline && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEvent(null);
                    navigate('/tugas');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold"
                >
                  Buka Halaman Tugas
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={open} onClose={() => setOpen(false)} title="Tambah Agenda Kalender">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Judul Agenda</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Kategori</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="Rapat Nasional">Rapat Nasional</option>
                <option value="Pembekalan">Pembekalan</option>
                <option value="Kegiatan Wilayah">Kegiatan Wilayah</option>
                <option value="Tenggat Laporan">Tenggat Laporan</option>
                <option value="Evaluasi">Evaluasi</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Waktu Mulai</label>
              <input
                type="datetime-local"
                required
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Lokasi / Platform</label>
            <input
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Keterangan</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Simpan Agenda</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function NotificationsPage() {
  const { navigate, notify } = useAuth();
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [tab, setTab] = useState<'semua' | 'belum_dibaca' | 'pribadi'>('semua');
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    apiGet<{ notifications: NotificationRecord[] }>('/api/notifications')
      .then((res) => setItems(res.notifications))
      .catch((err) => notify(err instanceof Error ? err.message : 'Gagal memuat notifikasi.', 'error'))
      .finally(() => setLoading(false));
  };
  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: string, path: string) => {
    await apiPost(`/api/notifications/${id}/read`);
    navigate(path);
  };

  const markAll = async () => {
    await apiPost('/api/notifications/read-all');
    notify('Semua notifikasi ditandai sudah dibaca.', 'success');
    load();
  };

  if (loading) return <LoadingSkeleton rows={4} />;

  const filtered = items.filter((n) => {
    if (tab === 'belum_dibaca') return !n.isRead;
    if (tab === 'pribadi') return ['tugas', 'proposal', 'lkl', 'akun'].includes(n.category);
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">Pusat Notifikasi</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Pemberitahuan pribadi terkait tugas, keputusan proposal, pemeriksaan LKL, dan tenggat organisasi.
          </p>
        </div>
        <button
          type="button"
          onClick={markAll}
          className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9]"
        >
          Tandai Semua Dibaca
        </button>
      </div>

      <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
        {[
          ['semua', `Semua (${items.length})`],
          ['belum_dibaca', `Belum Dibaca (${items.filter((n) => !n.isRead).length})`],
          ['pribadi', 'Tugas & Pengajuan Pribadi'],
        ].map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTab(k as typeof tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
              tab === k ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>

      <GlassCard className="p-5 divide-y divide-slate-200/70 dark:divide-slate-800">
        {filtered.length === 0 ? (
          <EmptyState title="Tidak ada notifikasi" description="Semua pemberitahuan pada kategori ini telah ditindaklanjuti." />
        ) : (
          filtered.map((n) => (
            <div key={n.id} className="py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-start gap-3">
                <Bell className={`w-4 h-4 mt-0.5 shrink-0 ${n.isRead ? 'text-slate-400' : 'text-[#0EA5E9]'}`} />
                <div>
                  <p className={`font-semibold ${n.isRead ? 'text-slate-600 dark:text-slate-400' : 'text-slate-900 dark:text-white'}`}>
                    {n.title}
                  </p>
                  <p className="text-slate-500 mt-0.5">{n.message}</p>
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                    Kategori {n.category} · {formatTanggalIndonesia(n.createdAt, true)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => markRead(n.id, n.targetPath)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0EA5E9] hover:text-white font-semibold shrink-0 transition-colors"
              >
                Buka Halaman
              </button>
            </div>
          ))
        )}
      </GlassCard>
    </div>
  );
}
