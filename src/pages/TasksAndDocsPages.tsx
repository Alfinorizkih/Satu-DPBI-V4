import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckSquare, Download, Eye, FileText, FolderOpen, Link2, Lock, MessageSquare, Paperclip, Plus, Printer, RefreshCw, Search, Users } from 'lucide-react';
import { ApiError, apiGet, apiPatch, apiPost, apiUrl } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { INDONESIA_PROVINCES } from '../lib/provinces';
import {
  EmptyState,
  FileDropzone,
  GlassCard,
  LoadingSkeleton,
  Modal,
  Pagination,
  StatusIndicator,
} from '../components/ui/Primitives';
import { A4PrintModal, type PrintDocumentConfig } from '../components/print/A4PrintEngine';
import type { DocumentRecord, FlagshipProgramRecord, PersonnelRecord, TaskRecord, TaskStatus } from '../lib/types';
import { formatTanggalIndonesia } from '../lib/rbac';

function getTaskProgress(t: TaskRecord): number {
  if (t.checklist && t.checklist.length > 0) {
    const doneCount = t.checklist.filter((c) => c.done).length;
    return Math.round((doneCount / t.checklist.length) * 100);
  }
  if (t.status === 'selesai') return 100;
  if (t.status === 'dikerjakan' || t.status === 'menunggu') return 50;
  if (t.status === 'perlu_perhatian') return 35;
  return 0;
}

const PRIORITY_STYLES: Record<string, string> = {
  mendesak: 'text-rose-600 dark:text-rose-400 font-bold',
  tinggi: 'text-amber-600 dark:text-amber-400 font-semibold',
  sedang: 'text-sky-600 dark:text-sky-400 font-medium',
  rendah: 'text-slate-500 dark:text-slate-400',
};

export function TasksPage({ scope = 'all', initialId }: { scope?: 'all' | 'mine'; initialId?: string }) {
  const { user, can, notify, navigate } = useAuth();
  const [tasks, setTasks] = useState<TaskRecord[]>([]);
  const [programs, setPrograms] = useState<FlagshipProgramRecord[]>([]);
  const [view, setView] = useState<'list' | 'kanban' | 'calendar'>('list');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<TaskRecord | null>(null);
  const [comments, setComments] = useState<Record<string, unknown>[]>([]);
  const [commentText, setCommentText] = useState('');
  const [taskConflictError, setTaskConflictError] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'sedang',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    provinceCode: '32',
    recurrence: 'tidak',
    programId: '',
    dependsOnTaskId: '',
    attachmentFileId: null as string | null,
    attachmentFileName: null as string | null,
  });
  const [bulkForm, setBulkForm] = useState({
    title: '',
    description: '',
    priority: 'sedang',
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    provinceCode: '32',
  });

  const load = () => {
    setLoading(true);
    Promise.all([
      apiGet<{ tasks: TaskRecord[] }>('/api/tasks'),
      apiGet<{ programs: FlagshipProgramRecord[] }>('/api/programs').catch(() => ({ programs: [] })),
    ])
      .then(([res, progRes]) => {
        setTasks(res.tasks);
        setPrograms(progRes.programs || []);
        if (initialId) {
          const found = res.tasks.find((t) => t.id === initialId || t.referenceNumber === initialId);
          if (found) setActiveTask(found);
        }
      })
      .catch((err) => notify(err instanceof Error ? err.message : 'Gagal memuat tugas.', 'error'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [initialId]);

  const handleStatus = async (id: string, status: TaskStatus) => {
    const current = tasks.find((t) => t.id === id) || activeTask;
    try {
      const res = await apiPatch<{ ok: boolean; version?: number; updatedAt?: string }>(`/api/tasks/${id}`, {
        status,
        expectedVersion: current?.version,
      });
      setTaskConflictError(null);
      const nextVer = res?.version ?? (current?.version ? current.version + 1 : undefined);
      const nextUpd = res?.updatedAt ?? current?.updatedAt;
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status, version: nextVer, updatedAt: nextUpd } : t))
      );
      if (activeTask?.id === id) {
        setActiveTask({ ...activeTask, status, version: nextVer, updatedAt: nextUpd });
      }
      notify('Status tugas diperbarui.', 'success');
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.conflict) && err.conflict) {
        setTaskConflictError(err.message);
      }
      notify(err instanceof Error ? err.message : 'Gagal memperbarui tugas.', 'error');
    }
  };

  const toggleChecklist = async (task: TaskRecord, itemId: string) => {
    const next = task.checklist.map((c) => (c.id === itemId ? { ...c, done: !c.done } : c));
    try {
      const res = await apiPatch<{ ok: boolean; version?: number; updatedAt?: string }>(`/api/tasks/${task.id}`, {
        checklist: next,
        expectedVersion: task.version,
      });
      setTaskConflictError(null);
      const nextVer = res?.version ?? (task.version ? task.version + 1 : undefined);
      const nextUpd = res?.updatedAt ?? task.updatedAt;
      setTasks((prev) =>
        prev.map((t) => (t.id === task.id ? { ...t, checklist: next, version: nextVer, updatedAt: nextUpd } : t))
      );
      if (activeTask?.id === task.id) {
        setActiveTask({ ...task, checklist: next, version: nextVer, updatedAt: nextUpd });
      }
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || err.conflict) && err.conflict) {
        setTaskConflictError(err.message);
      }
      notify(err instanceof Error ? err.message : 'Gagal memperbarui checklist.', 'error');
    }
  };

  const openTaskDetail = async (task: TaskRecord) => {
    setActiveTask(task);
    try {
      const res = await apiGet<{ comments: Record<string, unknown>[] }>(`/api/tasks/${task.id}/comments`);
      setComments(res.comments);
    } catch {
      setComments([]);
    }
  };

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTask || !commentText.trim()) return;
    try {
      await apiPost(`/api/tasks/${activeTask.id}/comments`, { body: commentText });
      setCommentText('');
      const res = await apiGet<{ comments: Record<string, unknown>[] }>(`/api/tasks/${activeTask.id}/comments`);
      setComments(res.comments);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengirim komentar.', 'error');
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiPost('/api/tasks', {
        ...form,
        programId: form.programId || null,
        dependsOnTaskId: form.dependsOnTaskId || null,
      });
      notify('Tugas baru ditambahkan.', 'success');
      setCreateOpen(false);
      setForm({
        title: '',
        description: '',
        priority: 'sedang',
        deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        provinceCode: '32',
        recurrence: 'tidak',
        programId: '',
        dependsOnTaskId: '',
        attachmentFileId: null,
        attachmentFileName: null,
      });
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal membuat tugas.', 'error');
    }
  };

  const handleBulkAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{ assignedCount: number }>('/api/tasks/bulk-assign', bulkForm);
      notify(`Penugasan massal dikirim ke ${res.assignedCount} akun aktif di provinsi tersebut.`, 'success');
      setBulkOpen(false);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal penugasan massal.', 'error');
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  const kanbanColumns: { status: TaskStatus; label: string }[] = [
    { status: 'belum_dimulai', label: 'Belum Dimulai' },
    { status: 'dikerjakan', label: 'Dikerjakan' },
    { status: 'menunggu', label: 'Menunggu' },
    { status: 'perlu_perhatian', label: 'Perlu Perhatian' },
    { status: 'selesai', label: 'Selesai' },
  ];

  const programNameById = new Map(programs.map((pr) => [pr.id, pr.name]));
  const taskById = new Map(tasks.map((t) => [t.id, t]));

  const scopedTasks =
    scope === 'mine' && user
      ? tasks.filter(
          (t) => t.assigneeId === user.id || t.assigneeName === user.fullName || t.creatorName === user.fullName
        )
      : tasks;
  const visibleTasks = statusFilter ? scopedTasks.filter((t) => t.status === statusFilter) : scopedTasks;
  const doneCount = scopedTasks.filter((t) => t.status === 'selesai').length;
  const urgentCount = scopedTasks.filter((t) => t.priority === 'mendesak' || t.status === 'perlu_perhatian').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            {scope === 'mine' ? 'Tugas Saya' : 'Pusat Pengelolaan Tugas'}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {scope === 'mine'
              ? 'Daftar tugas pribadi, subtugas, komentar koordinasi, dan tenggat waktu yang menjadi tanggung jawab Anda.'
              : 'Pantau tugas operasional, prioritas, dependensi prasyarat, progres subtugas, dan tenggat waktu.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('tugas', 'assign') && (
            <button
              type="button"
              onClick={() => setBulkOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold hover:border-[#0EA5E9]"
            >
              <Users className="w-4 h-4 text-[#0EA5E9]" /> Tugaskan per Provinsi
            </button>
          )}
          {can('tugas', 'create') && (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" /> Buat Tugas
            </button>
          )}
        </div>
      </div>

      {taskConflictError && (
        <div
          role="alert"
          className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/60 px-4 py-3 text-xs text-amber-900 dark:text-amber-200 flex flex-wrap items-center justify-between gap-3"
        >
          <span className="font-medium">{taskConflictError}</span>
          <button
            type="button"
            onClick={() => {
              setTaskConflictError(null);
              load();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang Data Terbaru
          </button>
        </div>
      )}

      {/* Compact Summary Strip */}
      <div className="grid grid-cols-3 gap-3 text-xs">
        <GlassCard className="p-4">
          <p className="text-slate-500">Total Tugas Aktif</p>
          <p className="font-display text-xl font-bold tabular-nums text-slate-900 dark:text-white mt-0.5">{scopedTasks.length}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-slate-500">Mendesak / Perhatian</p>
          <p className="font-display text-xl font-bold tabular-nums text-amber-600 dark:text-amber-400 mt-0.5">{urgentCount}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-slate-500">Tugas Selesai</p>
          <p className="font-display text-xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400 mt-0.5">{doneCount}</p>
        </GlassCard>
      </div>

      {/* View Switcher & Status Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1">
          {(['list', 'kanban', 'calendar'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                view === v ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {v === 'list' ? 'Daftar' : v === 'kanban' ? 'Papan Kanban' : 'Kalender Tenggat'}
            </button>
          ))}
        </div>

        {view === 'list' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter status tugas"
            className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-medium"
          >
            <option value="">Semua Status</option>
            {kanbanColumns.map((c) => (
              <option key={c.status} value={c.status}>{c.label}</option>
            ))}
          </select>
        )}
      </div>

      {view === 'list' && (
        <GlassCard className="p-5">
          {visibleTasks.length === 0 ? (
            <EmptyState title="Tidak ada tugas" description="Belum ada tugas yang tercatat untuk filter ini." />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4">Nomor</th>
                      <th className="py-2.5 pr-4">Judul Tugas & Prioritas</th>
                      <th className="py-2.5 pr-4">Penanggung Jawab</th>
                      <th className="py-2.5 pr-4">Progres</th>
                      <th className="py-2.5 pr-4">Tenggat</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 text-right">Diskusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {visibleTasks.map((t) => {
                      const pct = getTaskProgress(t);
                      const depTask = t.dependsOnTaskId ? taskById.get(t.dependsOnTaskId) : undefined;
                      const isBlocked = Boolean(depTask && depTask.status !== 'selesai');
                      const progName = t.programId ? programNameById.get(t.programId) : null;
                      return (
                        <tr key={t.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 pr-4 font-mono tabular-nums text-[#0EA5E9] font-semibold">
                            {t.referenceNumber}
                          </td>
                          <td className="py-3 pr-4">
                            <p className="font-semibold text-slate-900 dark:text-white">{t.title}</p>
                            <p className="text-[11px] text-slate-500">
                              Prioritas: <span className={PRIORITY_STYLES[t.priority] || ''}>{t.priority}</span>
                              {t.checklist.length > 0 && ` · ${t.checklist.filter((c) => c.done).length}/${t.checklist.length} subtugas`}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {progName && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-[#0EA5E9] text-[10px] font-semibold">
                                  <Link2 className="w-3 h-3" /> {progName}
                                </span>
                              )}
                              {depTask && (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                    isBlocked
                                      ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300'
                                      : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                                  }`}
                                >
                                  <Lock className="w-3 h-3" /> Prasyarat {depTask.referenceNumber} ({isBlocked ? 'Terkunci' : 'Terpenuhi'})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            <p>{t.assigneeName}</p>
                            <p className="text-[11px] text-slate-500">{t.provinceName || 'Nasional'}</p>
                          </td>
                          <td className="py-3 pr-4 w-32">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                                <div className="h-full bg-[#0EA5E9]" style={{ width: `${pct}%` }} />
                              </div>
                              <span className="font-mono tabular-nums text-[11px] text-slate-500">{pct}%</span>
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono tabular-nums">{formatTanggalIndonesia(t.deadline)}</td>
                          <td className="py-3 pr-4">
                            <select
                              value={t.status}
                              onChange={(e) => handleStatus(t.id, e.target.value as TaskStatus)}
                              aria-label={`Status tugas ${t.title}`}
                              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 py-1 text-xs"
                            >
                              {kanbanColumns.map((c) => (
                                <option key={c.status} value={c.status}>{c.label}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openTaskDetail(t)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-[#0EA5E9] hover:text-white font-semibold"
                            >
                              <MessageSquare className="w-3.5 h-3.5" /> {t.commentCount}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {visibleTasks.map((t) => {
                  const pct = getTaskProgress(t);
                  const depTask = t.dependsOnTaskId ? taskById.get(t.dependsOnTaskId) : undefined;
                  const isBlocked = Boolean(depTask && depTask.status !== 'selesai');
                  const progName = t.programId ? programNameById.get(t.programId) : null;
                  return (
                    <div key={t.id} className="py-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-mono text-[11px] text-[#0EA5E9]">{t.referenceNumber} · {formatTanggalIndonesia(t.deadline)}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{t.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {t.assigneeName} ({t.provinceName || 'Nasional'}) · Prioritas <span className={PRIORITY_STYLES[t.priority]}>{t.priority}</span>
                          </p>
                          {(progName || depTask) && (
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {progName && (
                                <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-[#0EA5E9] text-[10px] font-semibold">
                                  {progName}
                                </span>
                              )}
                              {depTask && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${isBlocked ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-emerald-50 text-emerald-700'}`}>
                                  Prasyarat {depTask.referenceNumber} ({isBlocked ? 'Terkunci' : 'Selesai'})
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <StatusIndicator status={t.status} />
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div className="h-full bg-[#0EA5E9]" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="font-mono tabular-nums text-[11px] text-slate-500">{pct}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={t.status}
                          onChange={(e) => handleStatus(t.id, e.target.value as TaskStatus)}
                          className="flex-1 min-h-[40px] rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-xs"
                        >
                          {kanbanColumns.map((c) => (
                            <option key={c.status} value={c.status}>{c.label}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => openTaskDetail(t)}
                          className="min-h-[40px] inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 font-semibold"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> Detail ({t.commentCount})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </GlassCard>
      )}

      {view === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {kanbanColumns.map((col) => {
            const items = visibleTasks.filter((t) => t.status === col.status);
            return (
              <GlassCard key={col.status} className="p-3.5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold pb-2 border-b border-slate-200 dark:border-slate-800">
                  <span>{col.label}</span>
                  <span className="font-mono text-slate-500 tabular-nums">{items.length}</span>
                </div>
                <div className="space-y-2.5">
                  {items.map((t) => {
                    const pct = getTaskProgress(t);
                    const depTask = t.dependsOnTaskId ? taskById.get(t.dependsOnTaskId) : undefined;
                    return (
                      <div key={t.id} className="rounded-xl bg-white/85 dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 p-3 space-y-2 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-mono text-[10px] text-[#0EA5E9]">{t.referenceNumber}</p>
                          <span className={`text-[10px] capitalize ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                        </div>
                        <p className="font-semibold text-slate-900 dark:text-white">{t.title}</p>
                        <p className="text-[11px] text-slate-500">{t.assigneeName}</p>
                        {depTask && (
                          <p className="text-[10px] text-amber-700 dark:text-amber-300 font-semibold">
                            Prasyarat: {depTask.referenceNumber} ({depTask.status === 'selesai' ? 'Selesai' : 'Menunggu'})
                          </p>
                        )}
                        <div className="w-full h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-[#0EA5E9]" style={{ width: `${pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] font-mono text-slate-400 tabular-nums">{formatTanggalIndonesia(t.deadline)}</span>
                          <button type="button" onClick={() => openTaskDetail(t)} className="text-[11px] text-[#0EA5E9] font-semibold hover:underline">
                            Detail
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {view === 'calendar' && (
        <GlassCard className="p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white">Jadwal Tenggat Tugas (Urut Kronologis)</h2>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800 text-xs">
            {visibleTasks.map((t) => (
              <div key={t.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => openTaskDetail(t)}
                  className="text-left hover:text-[#0EA5E9] transition-colors"
                >
                  <span className="font-mono font-semibold text-[#0EA5E9] mr-2 tabular-nums">
                    {formatTanggalIndonesia(t.deadline)}
                  </span>
                  <span className="font-semibold text-slate-900 dark:text-white">{t.title}</span>
                  <span className="text-slate-500 ml-2">({t.assigneeName} · {t.provinceName || 'Nasional'})</span>
                </button>
                <div className="flex items-center gap-3">
                  <span className={`text-[11px] capitalize ${PRIORITY_STYLES[t.priority]}`}>{t.priority}</span>
                  <StatusIndicator status={t.status} />
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Task Detail & Comments Modal */}
      <Modal
        open={Boolean(activeTask)}
        onClose={() => setActiveTask(null)}
        title={activeTask?.title || 'Detail Tugas'}
        subtitle={activeTask ? `${activeTask.referenceNumber} · Tenggat ${formatTanggalIndonesia(activeTask.deadline)}` : ''}
      >
        {activeTask && (
          <div className="space-y-4 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
              <StatusIndicator status={activeTask.status} />
              <select
                value={activeTask.status}
                onChange={(e) => handleStatus(activeTask.id, e.target.value as TaskStatus)}
                className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-1.5 text-xs font-semibold"
              >
                {kanbanColumns.map((c) => (
                  <option key={c.status} value={c.status}>{c.label}</option>
                ))}
              </select>
            </div>
            {(activeTask.programId || activeTask.dependsOnTaskId) && (
              <div className="flex flex-wrap gap-2">
                {activeTask.programId && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/50 text-[#0EA5E9] font-semibold">
                    <Link2 className="w-3.5 h-3.5" /> Program: {programNameById.get(activeTask.programId) || activeTask.programId}
                  </span>
                )}
                {activeTask.dependsOnTaskId && (() => {
                  const dep = taskById.get(activeTask.dependsOnTaskId);
                  if (!dep) return null;
                  const blocked = dep.status !== 'selesai';
                  return (
                    <button
                      type="button"
                      onClick={() => openTaskDetail(dep)}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold ${
                        blocked
                          ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      }`}
                    >
                      <Lock className="w-3.5 h-3.5" /> Prasyarat: {dep.referenceNumber} — {dep.title} ({blocked ? 'Belum Selesai' : 'Selesai'})
                    </button>
                  );
                })()}
              </div>
            )}
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">{activeTask.description || 'Tidak ada catatan tambahan.'}</p>
            {activeTask.attachmentFileId && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Paperclip className="w-4 h-4 text-[#0EA5E9] shrink-0" />
                  <span className="font-semibold truncate">{activeTask.attachmentFileName || 'Lampiran Tugas'}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={apiUrl(`/api/files/${activeTask.attachmentFileId}/preview`)}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                  >
                    Pratinjau
                  </a>
                  <a
                    href={apiUrl(`/api/files/${activeTask.attachmentFileId}?download=1`)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0EA5E9] text-white font-semibold"
                  >
                    <Download className="w-3.5 h-3.5" /> Unduh
                  </a>
                </div>
              </div>
            )}
            {activeTask.checklist.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                <p className="font-bold flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-[#0EA5E9]" /> Checklist Subtugas ({getTaskProgress(activeTask)}%)
                </p>
                {activeTask.checklist.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={c.done} onChange={() => toggleChecklist(activeTask, c.id)} />
                    <span className={c.done ? 'line-through text-slate-400' : ''}>{c.text}</span>
                  </label>
                ))}
              </div>
            )}
            <div className="space-y-2 pt-3 border-t border-slate-200 dark:border-slate-800">
              <p className="font-bold">Komentar Koordinasi ({comments.length})</p>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {comments.map((cm) => (
                  <div key={String(cm.id)} className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-2.5">
                    <p className="font-semibold">
                      {String(cm.author_name)}{' '}
                      <span className="text-slate-400 font-normal">· {formatTanggalIndonesia(String(cm.created_at), true)}</span>
                    </p>
                    <p className="mt-0.5 text-slate-600 dark:text-slate-300">{String(cm.body)}</p>
                  </div>
                ))}
              </div>
              <form onSubmit={submitComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Tulis komentar..."
                  className="flex-1 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
                <button type="submit" className="px-3.5 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Kirim</button>
              </form>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Buat Tugas Baru">
        <form onSubmit={handleCreate} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Judul Tugas *</label>
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Deskripsi</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Prioritas</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="rendah">Rendah</option>
                <option value="sedang">Sedang</option>
                <option value="tinggi">Tinggi</option>
                <option value="mendesak">Mendesak</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Tenggat</label>
              <input
                type="date"
                required
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Perulangan</label>
              <select
                value={form.recurrence}
                onChange={(e) => setForm({ ...form, recurrence: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="tidak">Sekali</option>
                <option value="mingguan">Mingguan</option>
                <option value="bulanan">Bulanan</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Program Unggulan Terkait (Opsional)</label>
              <select
                value={form.programId}
                onChange={(e) => setForm({ ...form, programId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="">Umum / Lintas Program</option>
                {programs.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Tugas Prasyarat / Depends On (Opsional)</label>
              <select
                value={form.dependsOnTaskId}
                onChange={(e) => setForm({ ...form, dependsOnTaskId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="">Tanpa prasyarat</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.referenceNumber} — {t.title}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <FileDropzone
            label="Lampiran Berkas Pendukung Tugas (PDF / Gambar, Opsional)"
            accept=".pdf,image/jpeg,image/png,image/webp"
            moduleName="tugas"
            uploadedFileName={form.attachmentFileName}
            onUploaded={(res) => setForm({ ...form, attachmentFileId: res.fileId, attachmentFileName: res.fileName })}
          />
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">Simpan Tugas</button>
          </div>
        </form>
      </Modal>

      <Modal open={bulkOpen} onClose={() => setBulkOpen(false)} title="Penugasan Massal per Provinsi">
        <form onSubmit={handleBulkAssign} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Provinsi Target</label>
            <select
              value={bulkForm.provinceCode}
              onChange={(e) => setBulkForm({ ...bulkForm, provinceCode: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            >
              {INDONESIA_PROVINCES.map((p) => (
                <option key={p.code} value={p.code}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-semibold mb-1">Judul Tugas</label>
            <input
              required
              value={bulkForm.title}
              onChange={(e) => setBulkForm({ ...bulkForm, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold mb-1">Tenggat</label>
            <input
              type="date"
              required
              value={bulkForm.deadline}
              onChange={(e) => setBulkForm({ ...bulkForm, deadline: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">
              Bagikan ke Semua Akun Aktif Provinsi
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

const DOC_PAGE_SIZE = 10;

export function DocumentsPage({ initialId }: { initialId?: string }) {
  const { can, notify, navigate } = useAuth();
  const [tab, setTab] = useState<'semua' | 'sop' | 'materi' | 'arsip' | 'generator'>('semua');
  const [docs, setDocs] = useState<DocumentRecord[]>([]);
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [programs, setPrograms] = useState<FlagshipProgramRecord[]>([]);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentRecord | null>(null);
  const [printConfig, setPrintConfig] = useState<PrintDocumentConfig | null>(null);

  const openDocumentA4Print = (d: DocumentRecord) => {
    const template =
      d.category === 'Sertifikat'
        ? 'sertifikat'
        : d.category === 'SK' || d.category === 'Surat Tugas'
        ? 'sk_tugas'
        : 'surat_resmi';
    setPrintConfig({
      template,
      documentNumber: d.documentNumber,
      title: d.title,
      subtitle: `${d.category} · Versi ${d.version}`,
      issuedDate: d.issuedDate,
      defaultOrientation: template === 'sertifikat' ? 'landscape' : 'portrait',
      metadata: [
        { label: 'Kategori Dokumen', value: d.category },
        { label: 'Pemilik / Penerima', value: d.ownerName },
        { label: 'Penerbit', value: d.issuerName },
        { label: 'Versi & Status', value: `v${d.version} · ${d.status}` },
      ],
      sections: [
        {
          heading: 'Keterangan & Ketentuan Dokumen',
          body: d.notes || `Dokumen resmi kategori ${d.category} diterbitkan oleh ${d.issuerName} untuk keperluan administrasi SATU DPBI.`,
        },
      ],
      signatoryName: d.issuerName,
      signatoryRole: 'Penerbit Dokumen Resmi DPBI',
    });
  };

  const defaultDocForm = {
    title: '',
    category: 'SK',
    version: '1.0',
    accessLevel: 'internal_semua',
    programId: '',
    parentDocumentId: '',
    notes: '',
    fileId: null as string | null,
    fileName: null as string | null,
    fileSizeBytes: 0,
  };

  const [docForm, setDocForm] = useState(defaultDocForm);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tplTitle, setTplTitle] = useState('Sertifikat Penetapan & Pengabdian Duta Pelajar Berbudaya Indonesia');
  const [tplBody, setTplBody] = useState(
    'Diberikan kepada:\nNama: {{nama}}\nJabatan: {{jabatan}}\nProvinsi Penugasan: {{provinsi}}\nAngkatan: {{angkatan}}\n\nBerdasarkan Nomor Dokumen {{nomor_surat}} tertanggal {{tanggal}}, yang bersangkutan tercatat aktif menjalankan amanah Duta Pelajar Berbudaya Indonesia.'
  );
  const [generating, setGenerating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [dRes, pRes, progRes] = await Promise.all([
        apiGet<{ documents: DocumentRecord[] }>('/api/documents'),
        can('personalia', 'view') ? apiGet<{ personnel: PersonnelRecord[] }>('/api/personnel') : Promise.resolve({ personnel: [] }),
        apiGet<{ programs: FlagshipProgramRecord[] }>('/api/programs').catch(() => ({ programs: [] })),
      ]);
      setDocs(dRes.documents);
      setPersonnel(pRes.personnel);
      setPrograms(progRes.programs || []);
      if (initialId) {
        const match = dRes.documents.find((d) => d.id === initialId || d.documentNumber === initialId);
        if (match) setPreviewDoc(match);
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat pusat dokumen.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [initialId]);

  const handleUploadDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiPost<{ documentNumber: string }>('/api/documents', {
        ...docForm,
        programId: docForm.programId || null,
        parentDocumentId: docForm.parentDocumentId || null,
      });
      notify(`Dokumen ${res.documentNumber} berhasil diterbitkan.`, 'success');
      setUploadOpen(false);
      setDocForm(defaultDocForm);
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menerbitkan dokumen.', 'error');
    }
  };

  const handleBulkGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedIds.length === 0) {
      notify('Pilih minimal satu personel.', 'error');
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch(apiUrl('/api/documents/bulk-generate'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'SATU-DPBI',
        },
        body: JSON.stringify({
          personnelIds: selectedIds,
          templateTitle: tplTitle,
          templateBody: tplBody,
          category: 'Sertifikat',
        }),
      });
      if (!res.ok) throw new Error('Gagal menghasilkan ZIP dokumen.');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'SATU_DPBI_Dokumen_Massal.zip';
      a.click();
      notify(`Berhasil menghasilkan ${selectedIds.length} PDF resmi dalam arsip ZIP.`, 'success');
      load();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal generate massal.', 'error');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return <LoadingSkeleton rows={5} />;

  const categories = Array.from(new Set(docs.map((d) => d.category)));
  const docById = new Map(docs.map((d) => [d.id, d]));
  const docProgramById = new Map(programs.map((pr) => [pr.id, pr.name]));
  const q = search.trim().toLowerCase();

  const filteredDocs = docs.filter((d) => {
    if (tab === 'sop' && !['SOP', 'Pedoman', 'Pedoman Program', 'Juknis', 'AD/ART'].includes(d.category)) return false;
    if (tab === 'materi' && d.category !== 'Materi Pembekalan') return false;
    if (tab === 'arsip' && d.status !== 'diarsipkan') return false;
    if (catFilter && d.category !== catFilter) return false;
    if (q) {
      return (
        d.title.toLowerCase().includes(q) ||
        d.documentNumber.toLowerCase().includes(q) ||
        d.issuerName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const pagedDocs = filteredDocs.slice((page - 1) * DOC_PAGE_SIZE, page * DOC_PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
            Pusat Dokumen & Pustaka SOP
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Repositori SK, SOP berlaku, materi pembekalan, kontrol versi, pratinjau dokumen, dan penerbitan massal PDF/ZIP.
          </p>
        </div>
        {can('dokumen', 'create') && (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] hover:bg-sky-600 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" /> Terbitkan Dokumen
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-xl bg-slate-200/70 dark:bg-slate-800/80 gap-1 flex-wrap">
          {[
            ['semua', `Semua (${docs.length})`],
            ['sop', 'SOP & Pedoman'],
            ['materi', 'Materi Pembekalan'],
            ['arsip', 'Arsip Dokumen'],
          ].map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k as typeof tab);
                setPage(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                tab === k ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {lbl}
            </button>
          ))}
          {can('dokumen', 'publish') && (
            <button
              type="button"
              onClick={() => setTab('generator')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold ${
                tab === 'generator' ? 'bg-white dark:bg-slate-900 shadow-xs text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              Generator Dokumen Massal
            </button>
          )}
        </div>

        {tab !== 'generator' && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Cari nomor atau judul..."
                className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 w-52"
              />
            </div>
            <select
              value={catFilter}
              onChange={(e) => {
                setCatFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter kategori dokumen"
              className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {tab !== 'generator' ? (
        <GlassCard className="p-5 space-y-4">
          {pagedDocs.length === 0 ? (
            <EmptyState title="Dokumen tidak ditemukan" description="Sesuaikan kata kunci pencarian atau filter kategori dokumen." />
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500">
                    <tr>
                      <th className="py-2.5 pr-4">Nomor Dokumen</th>
                      <th className="py-2.5 pr-4">Judul & Catatan</th>
                      <th className="py-2.5 pr-4">Kategori & Versi</th>
                      <th className="py-2.5 pr-4">Tanggal Terbit</th>
                      <th className="py-2.5 pr-4">Status</th>
                      <th className="py-2.5 text-right">Berkas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/60 dark:divide-slate-800">
                    {pagedDocs.map((d) => {
                      const replacement = d.replacedById ? docById.get(d.replacedById) : undefined;
                      const parentDoc = d.parentDocumentId ? docById.get(d.parentDocumentId) : undefined;
                      const progName = d.programId ? docProgramById.get(d.programId) : null;
                      return (
                        <tr key={d.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40">
                          <td className="py-3 pr-4 font-mono tabular-nums text-[#0EA5E9] font-semibold">{d.documentNumber}</td>
                          <td className="py-3 pr-4">
                            <p className="font-semibold text-slate-900 dark:text-white">{d.title}</p>
                            <p className="text-[11px] text-slate-500">{d.notes || `Penerbit: ${d.issuerName}`}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1">
                              {progName && (
                                <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 text-[#0EA5E9] text-[10px] font-semibold">
                                  Program: {progName}
                                </span>
                              )}
                              {parentDoc && (
                                <button
                                  type="button"
                                  onClick={() => setPreviewDoc(parentDoc)}
                                  className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-semibold hover:underline"
                                >
                                  Menggantikan {parentDoc.documentNumber}
                                </button>
                              )}
                              {(d.status === 'diarsipkan' || replacement) && (
                                <button
                                  type="button"
                                  onClick={() => replacement && setPreviewDoc(replacement)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 text-[10px] font-semibold"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  {replacement ? `Digantikan → ${replacement.documentNumber}` : 'Versi Diarsipkan'}
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 pr-4 font-mono">{d.category} · v{d.version}</td>
                          <td className="py-3 pr-4 tabular-nums">{formatTanggalIndonesia(d.issuedDate)}</td>
                          <td className="py-3 pr-4"><StatusIndicator status={d.status} /></td>
                          <td className="py-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => openDocumentA4Print(d)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                            >
                              <Printer className="w-3.5 h-3.5 text-[#0EA5E9]" /> Cetak A4
                            </button>
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(d)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 font-semibold hover:border-[#0EA5E9]"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail
                            </button>
                            {d.fileId ? (
                              <a
                                href={apiUrl(`/api/files/${d.fileId}?download=1`)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950 text-[#0EA5E9] font-semibold"
                              >
                                <Download className="w-3.5 h-3.5" /> Unduh
                              </a>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-slate-200/70 dark:divide-slate-800 text-xs">
                {pagedDocs.map((d) => {
                  const replacement = d.replacedById ? docById.get(d.replacedById) : undefined;
                  return (
                    <div key={d.id} className="py-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-mono text-[11px] text-[#0EA5E9]">{d.documentNumber} · v{d.version}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{d.title}</p>
                          <p className="text-[11px] text-slate-500">{d.category} · {formatTanggalIndonesia(d.issuedDate)}</p>
                          {replacement && (
                            <p className="text-[11px] font-semibold text-amber-700 dark:text-amber-300 mt-1">
                              Digantikan versi baru: {replacement.documentNumber}
                            </p>
                          )}
                        </div>
                        <StatusIndicator status={d.status} />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewDoc(d)}
                          className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-semibold"
                        >
                          <FileText className="w-3.5 h-3.5 text-[#0EA5E9]" /> Detail / Pratinjau
                        </button>
                        {d.fileId && (
                          <a
                            href={apiUrl(`/api/files/${d.fileId}?download=1`)}
                            target="_blank"
                            rel="noreferrer"
                            className="flex-1 min-h-[40px] inline-flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-sky-50 dark:bg-sky-950 text-[#0EA5E9] font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" /> Unduh
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Pagination page={page} totalItems={filteredDocs.length} pageSize={DOC_PAGE_SIZE} onPageChange={setPage} />
            </>
          )}
        </GlassCard>
      ) : (
        <GlassCard className="p-5 space-y-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#0EA5E9]" />
            <h2 className="text-sm font-bold">Penerbitan Sertifikat / Surat Tugas Massal (PDF & ZIP)</h2>
          </div>
          <form onSubmit={handleBulkGenerate} className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-xs">
            <div className="lg:col-span-5 space-y-2">
              <p className="font-semibold">1. Pilih Personel Penerima ({selectedIds.length} dipilih)</p>
              <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl divide-y divide-slate-100 dark:divide-slate-800">
                {personnel.map((p) => (
                  <label key={p.id} className="flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(p.id)}
                      onChange={(e) =>
                        setSelectedIds((prev) =>
                          e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                        )
                      }
                    />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.fullName}</p>
                      <p className="text-[11px] text-slate-500">{p.provinceName} · {p.positionTitle}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="lg:col-span-7 space-y-3">
              <div>
                <label className="block font-semibold mb-1">2. Judul Template Dokumen</label>
                <input
                  required
                  value={tplTitle}
                  onChange={(e) => setTplTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">
                  3. Isi Template (Placeholder: {'{{nama}}'}, {'{{provinsi}}'}, {'{{angkatan}}'}, {'{{jabatan}}'}, {'{{nomor_surat}}'}, {'{{tanggal}}'})
                </label>
                <textarea
                  rows={6}
                  required
                  value={tplBody}
                  onChange={(e) => setTplBody(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 p-3 font-mono"
                />
              </div>
              <button
                type="submit"
                disabled={generating || selectedIds.length === 0}
                className="px-4 py-2.5 rounded-xl bg-[#0EA5E9] text-white font-semibold disabled:opacity-50"
              >
                {generating ? 'Membuat PDF & Mengemas ZIP...' : `Generate ${selectedIds.length} PDF & Unduh ZIP`}
              </button>
            </div>
          </form>
        </GlassCard>
      )}

      {/* Inline PDF Preview & Lineage Modal */}
      <Modal
        open={Boolean(previewDoc)}
        onClose={() => {
          setPreviewDoc(null);
          navigate('/dokumen');
        }}
        title={previewDoc?.title || 'Pratinjau Dokumen'}
        subtitle={previewDoc ? `${previewDoc.documentNumber} · v${previewDoc.version} · ${previewDoc.category}` : ''}
        maxWidth="max-w-4xl"
      >
        {previewDoc && (
          <div className="space-y-3 text-xs">
            {previewDoc.replacedById && (() => {
              const rep = docById.get(previewDoc.replacedById);
              return (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 flex flex-wrap items-center justify-between gap-2 text-amber-900 dark:text-amber-200">
                  <span>
                    Dokumen ini telah diarsipkan dan digantikan oleh versi terbaru
                    {rep ? ` (${rep.documentNumber} — ${rep.title} v${rep.version})` : ''}.
                  </span>
                  {rep && (
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(rep)}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 text-white font-semibold"
                    >
                      Buka Versi Terbaru
                    </button>
                  )}
                </div>
              );
            })()}
            {previewDoc.parentDocumentId && (() => {
              const par = docById.get(previewDoc.parentDocumentId);
              if (!par) return null;
              return (
                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-center justify-between gap-2">
                  <span>Dokumen ini merupakan pembaruan dari: <strong>{par.documentNumber} — {par.title} (v{par.version})</strong></span>
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(par)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 font-semibold"
                  >
                    Lihat Versi Sebelumnya
                  </button>
                </div>
              );
            })()}
            {previewDoc.fileId ? (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-950">
                <iframe
                  title={`Pratinjau ${previewDoc.title}`}
                  src={apiUrl(`/api/files/${previewDoc.fileId}/preview`)}
                  className="w-full h-[60vh]"
                />
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 space-y-1 text-slate-600 dark:text-slate-300">
                <p><strong>Penerbit:</strong> {previewDoc.issuerName} · <strong>Tanggal Terbit:</strong> {formatTanggalIndonesia(previewDoc.issuedDate)}</p>
                <p><strong>Catatan:</strong> {previewDoc.notes || 'Tidak ada catatan tambahan.'}</p>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => openDocumentA4Print(previewDoc)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:border-[#0EA5E9]"
              >
                <Printer className="w-4 h-4 text-[#0EA5E9]" /> Cetak Ringkasan A4
              </button>
              {previewDoc.fileId && (
                <a
                  href={apiUrl(`/api/files/${previewDoc.fileId}?download=1`)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0EA5E9] text-white text-xs font-semibold"
                >
                  <Download className="w-4 h-4" /> Unduh Salinan Resmi
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={uploadOpen} onClose={() => setUploadOpen(false)} title="Terbitkan Dokumen Resmi">
        <form onSubmit={handleUploadDoc} className="space-y-3 text-xs">
          <div>
            <label className="block font-semibold mb-1">Judul Dokumen</label>
            <input
              required
              value={docForm.title}
              onChange={(e) => setDocForm({ ...docForm, title: e.target.value })}
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold mb-1">Kategori</label>
              <select
                value={docForm.category}
                onChange={(e) => setDocForm({ ...docForm, category: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                {[
                  'SK',
                  'Surat Tugas',
                  'Surat Masuk',
                  'Surat Keluar',
                  'Rekomendasi',
                  'Sertifikat',
                  'Proposal',
                  'LKL',
                  'Laporan',
                  'SOP',
                  'Pedoman',
                  'Pedoman Program',
                  'Juknis',
                  'AD/ART',
                  'Identitas Visual',
                  'Logo',
                  'Template Resmi',
                  'Materi Pembekalan',
                  'Formulir',
                  'Arsip',
                ].map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Versi</label>
              <input
                value={docForm.version}
                onChange={(e) => setDocForm({ ...docForm, version: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">Hak Akses</label>
              <select
                value={docForm.accessLevel}
                onChange={(e) => setDocForm({ ...docForm, accessLevel: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="internal_semua">Semua Anggota Aktif</option>
                <option value="koordinator_ke_atas">Koordinator ke Atas</option>
                <option value="nasional_saja">Pengurus Nasional</option>
                <option value="pribadi">Pribadi</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold mb-1">Program Unggulan Terkait (Opsional)</label>
              <select
                value={docForm.programId}
                onChange={(e) => setDocForm({ ...docForm, programId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="">Umum / Non-Program</option>
                {programs.map((pr) => (
                  <option key={pr.id} value={pr.id}>{pr.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">Menggantikan Dokumen Sebelumnya (Opsional)</label>
              <select
                value={docForm.parentDocumentId}
                onChange={(e) => setDocForm({ ...docForm, parentDocumentId: e.target.value })}
                className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
              >
                <option value="">Dokumen Baru (Tidak Menggantikan)</option>
                {docs
                  .filter((d) => d.status === 'berlaku')
                  .map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.documentNumber} — {d.title} (v{d.version})
                    </option>
                  ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block font-semibold mb-1">Catatan / Keterangan Versi</label>
            <input
              value={docForm.notes}
              onChange={(e) => setDocForm({ ...docForm, notes: e.target.value })}
              placeholder="Ringkasan perubahan atau ruang lingkup keberlakuan dokumen..."
              className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2"
            />
          </div>
          <FileDropzone
            label="Unggah Berkas PDF Dokumen"
            accept=".pdf,application/pdf"
            moduleName="dokumen"
            uploadedFileName={docForm.fileName}
            onUploaded={(res) =>
              setDocForm({ ...docForm, fileId: res.fileId, fileName: res.fileName, fileSizeBytes: res.sizeBytes })
            }
          />
          <div className="flex justify-end pt-2">
            <button type="submit" className="px-4 py-2 rounded-xl bg-[#0EA5E9] text-white font-semibold">
              Simpan & Terbitkan
            </button>
          </div>
        </form>
      </Modal>

      <A4PrintModal
        open={Boolean(printConfig)}
        config={printConfig}
        onClose={() => setPrintConfig(null)}
      />
    </div>
  );
}
