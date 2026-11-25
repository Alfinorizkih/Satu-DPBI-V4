import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileText,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiGet, apiPost, apiUrl } from '../lib/api';
import {
  ALLOWED_EMAIL_VARIABLES,
  formatTanggalIndonesia,
  OFFICIAL_BIDANGS,
  ROLE_LABELS,
  validateEmailTemplatePlaceholders,
} from '../lib/rbac';
import { INDONESIA_PROVINCES } from '../lib/provinces';
import type { EmailCampaignRecord, EmailLogRecord, EmailTemplateRecord, RoleCode } from '../lib/types';
import {
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  Input,
  Modal,
  PageContainer,
  PageHeader,
  Select,
  Skeleton,
  StatusIndicator,
  Switch,
  Tabs,
  Textarea,
} from '../components/ui';

interface EmailOverviewResponse {
  runtime: {
    smtpConfigured: boolean;
    deliveryMode: 'smtp_live' | 'sandbox_outbox';
    senderAddress: string;
    batchLimit: number;
    ratePerMin: number;
    hostLabel: string | null;
  };
  templates: EmailTemplateRecord[];
  campaigns: EmailCampaignRecord[];
  logs: EmailLogRecord[];
}

interface AudiencePreviewResponse {
  totalMatched: number;
  selectedCount: number;
  truncatedByLimit: boolean;
  batchLimit: number;
  sample: { email: string; fullName: string; jabatan: string; provinsi: string }[];
}

const ROLE_OPTIONS: RoleCode[] = [
  'super_admin',
  'wakil_super_admin',
  'penanggung_jawab',
  'pengurus_nasional',
  'sekretariat_nasional',
  'koordinator_wilayah',
  'duta',
  'alumni',
];

export function EmailCenterPage() {
  const { user, can, notify } = useAuth();
  const [data, setData] = useState<EmailOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('composer');

  // Composer state
  const [mode, setMode] = useState<'single' | 'bulk'>('bulk');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  const [allActive, setAllActive] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['koordinator_wilayah']);
  const [bidang, setBidang] = useState('');
  const [provinceCode, setProvinceCode] = useState(user?.role === 'koordinator_wilayah' ? user.provinceCode || '' : '');
  const [batchId, setBatchId] = useState('');
  const [manualEmailsText, setManualEmailsText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');

  const [preview, setPreview] = useState<AudiencePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  // Campaign / log management
  const [logCampaignFilter, setLogCampaignFilter] = useState('');
  const [cancelCampaignId, setCancelCampaignId] = useState<string | null>(null);

  // Template modal
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('Koordinasi Nasional');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet<EmailOverviewResponse>('/api/email/overview');
      setData(res);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memuat Pusat Email.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    loadOverview();
  }, [loadOverview]);

  const parsedManualEmails = useMemo(
    () =>
      manualEmailsText
        .split(/[\n,;]+/)
        .map((e) => e.trim())
        .filter(Boolean),
    [manualEmailsText]
  );

  const buildAudienceFilter = useCallback(
    () => ({
      mode,
      allActive: mode === 'bulk' ? allActive : false,
      roles: mode === 'bulk' && !allActive ? selectedRoles : undefined,
      bidang: mode === 'bulk' && bidang ? bidang : undefined,
      provinceCode: mode === 'bulk' && provinceCode ? provinceCode : undefined,
      batchId: mode === 'bulk' && batchId ? batchId : undefined,
      manualEmails: parsedManualEmails.length > 0 ? parsedManualEmails : undefined,
    }),
    [mode, allActive, selectedRoles, bidang, provinceCode, batchId, parsedManualEmails]
  );

  const handleSelectTemplate = (tplId: string) => {
    setSelectedTemplateId(tplId);
    const tpl = data?.templates.find((t) => t.id === tplId);
    if (tpl) {
      if (!title) setTitle(tpl.name);
      setSubject(tpl.subject);
      setBodyText(tpl.bodyText);
    }
  };

  const placeholderCheck = useMemo(() => {
    const s = validateEmailTemplatePlaceholders(subject);
    const b = validateEmailTemplatePlaceholders(bodyText);
    return {
      valid: s.valid && b.valid,
      invalid: [...s.invalidVariables, ...b.invalidVariables],
    };
  }, [subject, bodyText]);

  const handlePreviewAudience = async () => {
    setPreviewLoading(true);
    try {
      const res = await apiPost<AudiencePreviewResponse>('/api/email/audience-preview', {
        filter: buildAudienceFilter(),
      });
      setPreview(res);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menghitung pratinjau penerima.', 'error');
    } finally {
      setPreviewLoading(false);
    }
  };

  const submitCampaign = async (actionMode: 'send_now' | 'save_draft' | 'schedule' | 'test_self') => {
    if (!subject.trim() || !bodyText.trim()) {
      notify('Subjek dan isi email wajib diisi.', 'warning');
      return;
    }
    if (!placeholderCheck.valid) {
      notify(`Terdapat variabel templat tidak valid: ${placeholderCheck.invalid.join(', ')}`, 'error');
      return;
    }
    if (actionMode === 'schedule' && !scheduledAt) {
      notify('Pilih tanggal dan jam penjadwalan terlebih dahulu.', 'warning');
      return;
    }

    setSending(true);
    try {
      const res = await apiPost<{
        ok: boolean;
        campaignId: string;
        deliveryMode: string;
        totalRecipients: number;
        sentCount: number;
        failedCount: number;
      }>('/api/email/send', {
        title: title.trim() || subject.trim(),
        templateId: selectedTemplateId || null,
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        audienceFilter: buildAudienceFilter(),
        actionMode,
        scheduledAt: actionMode === 'schedule' ? new Date(scheduledAt).toISOString() : null,
      });

      const modeInfo =
        res.deliveryMode === 'smtp_live'
          ? 'melalui SMTP Live'
          : 'ke antrean Sandbox Outbox (SQLite)';
      if (actionMode === 'save_draft') {
        notify('Draf kampanye email berhasil disimpan.', 'success');
      } else if (actionMode === 'schedule') {
        notify('Kampanye email berhasil dijadwalkan.', 'success');
      } else {
        notify(
          `Berhasil diproses ${modeInfo}: ${res.sentCount} dari ${res.totalRecipients} penerima.`,
          res.failedCount > 0 ? 'warning' : 'success'
        );
      }
      setConfirmSendOpen(false);
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses pengiriman email.', 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCancelCampaign = async () => {
    if (!cancelCampaignId) return;
    try {
      await apiPost(`/api/email/campaigns/${cancelCampaignId}/cancel`);
      notify('Kampanye berhasil dibatalkan.', 'success');
      setCancelCampaignId(null);
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal membatalkan kampanye.', 'error');
    }
  };

  const handleRetryCampaign = async (id: string) => {
    try {
      const res = await apiPost<{ retried: number; succeeded: number }>(`/api/email/campaigns/${id}/retry`);
      notify(`Percobaan ulang selesai: ${res.succeeded} dari ${res.retried} penerima berhasil diproses.`, 'info');
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mencoba ulang pengiriman.', 'error');
    }
  };

  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTpl(true);
    try {
      await apiPost('/api/email/templates', {
        name: tplName,
        category: tplCategory,
        subject: tplSubject,
        bodyText: tplBody,
      });
      notify('Templat email resmi berhasil ditambahkan.', 'success');
      setTemplateModalOpen(false);
      setTplName('');
      setTplSubject('');
      setTplBody('');
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menyimpan templat.', 'error');
    } finally {
      setSavingTpl(false);
    }
  };

  const toggleRole = (role: string) => {
    setSelectedRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const filteredLogs = useMemo(() => {
    if (!data) return [];
    if (!logCampaignFilter) return data.logs;
    return data.logs.filter((l) => l.campaignId === logCampaignFilter);
  }, [data, logCampaignFilter]);

  const canPublishBulk = can('email', 'publish');
  const canCreate = can('email', 'create');

  if (loading || !data) {
    return (
      <PageContainer>
        <PageHeader title="Pusat Email & Pengiriman Massal" />
        <Skeleton rows={5} />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Pusat Email & Pengiriman Massal"
        description="Komunikasi resmi DPBI ke individu maupun segmen peran/wilayah/angkatan secara teraudit dan terhindar dari duplikasi penerima."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canCreate && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTemplateModalOpen(true)}
              >
                <Plus className="w-4 h-4" /> Templat Baru
              </Button>
            )}
            <a
              href={apiUrl(`/api/email/logs/export${logCampaignFilter ? `?campaignId=${encodeURIComponent(logCampaignFilter)}` : ''}`)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9]"
            >
              <Download className="w-3.5 h-3.5" /> Ekspor Log CSV
            </a>
          </div>
        }
      />

      {/* Honest Runtime Mode Banner */}
      <Card
        className={`p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          data.runtime.deliveryMode === 'smtp_live'
            ? 'border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/50 dark:bg-emerald-950/30'
            : 'border-amber-200 dark:border-amber-800/70 bg-amber-50/50 dark:bg-amber-950/25'
        }`}
      >
        <div className="flex items-start gap-3">
          {data.runtime.deliveryMode === 'smtp_live' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
              {data.runtime.deliveryMode === 'smtp_live'
                ? `Mode Pengiriman Aktif: SMTP Live (${data.runtime.hostLabel})`
                : 'Mode Pengiriman Saat Ini: Sandbox Outbox (Simulasi Antrean SQLite)'}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
              {data.runtime.deliveryMode === 'smtp_live'
                ? `Email dikirim langsung melalui server SMTP resmi (${data.runtime.hostLabel}) dengan batas laju ${data.runtime.ratePerMin}/menit.`
                : 'SMTP_HOST belum dikonfigurasi di server. Email dicatat dan dipratinjau secara aman di log antrean SQLite tanpa mengirimkan email keluar sungguhan.'}
            </p>
          </div>
        </div>
        <div className="text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-400 shrink-0">
          Pengirim: {data.runtime.senderAddress} · Maks {data.runtime.batchLimit} penerima/batch
        </div>
      </Card>

      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'composer', label: 'Komposer & Audiens' },
          { id: 'campaigns', label: `Riwayat Kampanye (${data.campaigns.length})` },
          { id: 'logs', label: `Log Pengiriman (${data.logs.length})` },
          { id: 'templates', label: `Templat Resmi (${data.templates.length})` },
        ]}
      />

      {activeTab === 'composer' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left 2 Columns: Composer */}
          <Card className="lg:col-span-2 p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Susun Pesan Email</h2>
              <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
                <button
                  type="button"
                  onClick={() => setMode('single')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    mode === 'single' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Penerima Tunggal / Manual
                </button>
                <button
                  type="button"
                  onClick={() => setMode('bulk')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold ${
                    mode === 'bulk' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs' : 'text-slate-500'
                  }`}
                >
                  Segmen Massal (Bulk)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select
                label="Gunakan Templat Resmi (Opsional)"
                value={selectedTemplateId}
                onChange={(e) => handleSelectTemplate(e.target.value)}
              >
                <option value="">-- Tulis Manual --</option>
                {data.templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.category})
                  </option>
                ))}
              </Select>
              <Input
                label="Judul Kampanye / Catatan Internal"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Mis. Pengingat Batas LKL November 2026"
              />
            </div>

            <Input
              label="Subjek Email *"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="[SATU DPBI] Pengingat Batas Pengumpulan LKL {{provinsi}}"
            />

            <Textarea
              label="Isi Pesan *"
              rows={7}
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              placeholder="Yth. {{nama}} ({{jabatan}} - {{provinsi}}), ..."
            />

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 text-[11px] text-slate-600 dark:text-slate-400">
              Variabel tersedia:{' '}
              <span className="font-mono text-slate-800 dark:text-slate-200">
                {ALLOWED_EMAIL_VARIABLES.map((v) => `{{${v}}}`).join(' · ')}
              </span>
            </div>

            {!placeholderCheck.valid && (
              <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-300">
                Variabel tidak dikenali atau tanda kurung belum tertutup: {placeholderCheck.invalid.join(', ')}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <Input
                type="datetime-local"
                label="Jadwalkan Pengiriman (Opsional)"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>

            {canCreate && (
              <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  variant="secondary"
                  loading={sending}
                  onClick={() => submitCampaign('test_self')}
                >
                  Uji Kirim ke Email Saya
                </Button>
                <Button
                  variant="secondary"
                  loading={sending}
                  onClick={() => submitCampaign('save_draft')}
                >
                  Simpan Draft
                </Button>
                <Button
                  variant="secondary"
                  loading={sending}
                  disabled={!scheduledAt}
                  onClick={() => submitCampaign('schedule')}
                >
                  Jadwalkan
                </Button>
                <Button
                  variant="primary"
                  loading={sending}
                  onClick={async () => {
                    await handlePreviewAudience();
                    setConfirmSendOpen(true);
                  }}
                >
                  <Send className="w-4 h-4" /> {mode === 'bulk' && !canPublishBulk ? 'Kirim (Perlu Izin Publish)' : 'Kirim Sekarang'}
                </Button>
              </div>
            )}
          </Card>

          {/* Right Column: Audience Builder & Deduplicated Preview */}
          <Card className="p-5 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-[#0EA5E9]" /> Target Penerima
            </h2>

            {mode === 'bulk' && (
              <div className="space-y-3.5">
                <Switch
                  label="Kirim ke seluruh akun aktif tervalidasi"
                  checked={allActive}
                  onChange={setAllActive}
                />

                {!allActive && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Pilih Peran (Role)</p>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLE_OPTIONS.map((r) => {
                        const active = selectedRoles.includes(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            aria-pressed={active}
                            onClick={() => toggleRole(r)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-colors ${
                              active
                                ? 'bg-[#0EA5E9] text-white border-[#0EA5E9]'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                            }`}
                          >
                            {ROLE_LABELS[r]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <Select label="Filter Bidang" value={bidang} onChange={(e) => setBidang(e.target.value)}>
                  <option value="">Semua Bidang</option>
                  {OFFICIAL_BIDANGS.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </Select>

                <Select
                  label="Filter Provinsi"
                  value={provinceCode}
                  disabled={user?.role === 'koordinator_wilayah'}
                  onChange={(e) => setProvinceCode(e.target.value)}
                >
                  <option value="">Semua Provinsi</option>
                  {INDONESIA_PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.name}
                    </option>
                  ))}
                </Select>

                <Select label="Filter Angkatan" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
                  <option value="">Semua Angkatan</option>
                  <option value="batch-3">Angkatan 3 (Aktif)</option>
                  <option value="batch-2">Angkatan 2</option>
                  <option value="batch-1">Angkatan 1</option>
                </Select>
              </div>
            )}

            <Textarea
              label={mode === 'single' ? 'Alamat Email Penerima (pisah dengan koma / baris baru)' : 'Tambahan Email Manual (Opsional)'}
              rows={3}
              value={manualEmailsText}
              onChange={(e) => setManualEmailsText(e.target.value)}
              placeholder="duta@dpbi.id, koordinator@dpbi.id"
            />

            <Button
              variant="secondary"
              className="w-full"
              loading={previewLoading}
              onClick={handlePreviewAudience}
            >
              <RefreshCw className="w-3.5 h-3.5" /> Hitung &amp; Pratinjau Penerima
            </Button>

            {preview && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 space-y-2 bg-slate-50/70 dark:bg-slate-950/40">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Penerima Terdeduplikasi:</span>
                  <span className="font-mono font-bold text-[#0EA5E9] tabular-nums">
                    {preview.selectedCount} alamat email
                  </span>
                </div>
                {preview.truncatedByLimit && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400">
                    Dibatasi maksimal {preview.batchLimit} penerima per pengiriman dari total {preview.totalMatched} cocok.
                  </p>
                )}
                {preview.sample.length > 0 && (
                  <ul className="divide-y divide-slate-200/60 dark:divide-slate-800 max-h-44 overflow-y-auto text-[11px]">
                    {preview.sample.map((s) => (
                      <li key={s.email} className="py-1.5">
                        <p className="font-semibold text-slate-800 dark:text-slate-200 truncate">{s.fullName}</p>
                        <p className="text-slate-500 dark:text-slate-400 truncate">
                          {s.email} · {s.provinsi}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === 'campaigns' && (
        <Card className="p-5">
          {data.campaigns.length === 0 ? (
            <EmptyState
              title="Belum ada riwayat kampanye email"
              description="Kampanye yang dikirim, dijadwalkan, atau disimpan sebagai draf akan tercatat di sini."
            />
          ) : (
            <div className="space-y-3">
              {data.campaigns.map((c) => (
                <div
                  key={c.id}
                  className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{c.title}</p>
                      <StatusIndicator status={c.status} />
                      <span className="text-[11px] font-mono text-slate-500">
                        {c.deliveryMode === 'smtp_live' ? 'SMTP Live' : 'Sandbox Outbox'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">Subjek: {c.subject}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                      Oleh {c.createdByName} · {c.sentCount}/{c.totalRecipients} terkirim · {c.failedCount} gagal ·{' '}
                      {formatTanggalIndonesia(c.sentAt || c.scheduledAt || c.createdAt, true)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setLogCampaignFilter(c.id);
                        setActiveTab('logs');
                      }}
                    >
                      Lihat Log
                    </Button>
                    {['draft', 'terjadwal'].includes(c.status) && canCreate && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => setCancelCampaignId(c.id)}
                      >
                        <XCircle className="w-3.5 h-3.5" /> Batalkan
                      </Button>
                    )}
                    {c.failedCount > 0 && canCreate && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleRetryCampaign(c.id)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" /> Ulangi Gagal
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {activeTab === 'logs' && (
        <Card className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Select
              label="Filter Kampanye"
              value={logCampaignFilter}
              onChange={(e) => setLogCampaignFilter(e.target.value)}
            >
              <option value="">Semua Kampanye</option>
              {data.campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </Select>
          </div>

          {filteredLogs.length === 0 ? (
            <EmptyState
              title="Belum ada log pengiriman email"
              description="Setiap pengiriman atau simulasi outbox akan mencatat status penerima secara individual di sini."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-800 text-[11px] uppercase text-slate-500">
                  <tr>
                    <th className="py-2.5 px-3">Penerima</th>
                    <th className="py-2.5 px-3">Subjek</th>
                    <th className="py-2.5 px-3">Mode</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3">Waktu / Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLogs.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5 px-3">
                        <p className="font-semibold text-slate-900 dark:text-white">{l.recipientName}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{l.recipientEmail}</p>
                      </td>
                      <td className="py-2.5 px-3 max-w-xs truncate">{l.subjectRendered}</td>
                      <td className="py-2.5 px-3 text-xs font-mono">
                        {l.deliveryMode === 'smtp_live' ? 'SMTP Live' : 'Sandbox Outbox'}
                      </td>
                      <td className="py-2.5 px-3">
                        <StatusIndicator status={l.status} />
                      </td>
                      <td className="py-2.5 px-3 text-xs text-slate-500 tabular-nums">
                        <p>{formatTanggalIndonesia(l.sentAt || l.createdAt, true)}</p>
                        {l.errorMessage && <p className="text-rose-600 text-[11px]">{l.errorMessage}</p>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.templates.map((t) => (
            <Card key={t.id} className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-[#0EA5E9] font-semibold">{t.category}</p>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-[#0EA5E9]" /> {t.name}
                  </h3>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    handleSelectTemplate(t.id);
                    setActiveTab('composer');
                  }}
                >
                  Pakai Templat
                </Button>
              </div>
              <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Subjek: {t.subject}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line line-clamp-4">{t.bodyText}</p>
            </Card>
          ))}
        </div>
      )}

      {/* New Template Modal */}
      <Modal
        open={templateModalOpen}
        onClose={() => setTemplateModalOpen(false)}
        title="Buat Templat Email Resmi"
        subtitle={`Variabel valid: ${ALLOWED_EMAIL_VARIABLES.map((v) => `{{${v}}}`).join(', ')}`}
      >
        <form onSubmit={handleCreateTemplate} className="space-y-3.5">
          <Input
            label="Nama Templat *"
            required
            value={tplName}
            onChange={(e) => setTplName(e.target.value)}
            placeholder="Mis. Surat Undangan Rapat Koordinasi Nasional"
          />
          <Input
            label="Kategori *"
            required
            value={tplCategory}
            onChange={(e) => setTplCategory(e.target.value)}
          />
          <Input
            label="Subjek Email *"
            required
            value={tplSubject}
            onChange={(e) => setTplSubject(e.target.value)}
            placeholder="[SATU DPBI] Undangan Koordinasi {{provinsi}}"
          />
          <Textarea
            label="Isi Templat *"
            required
            rows={5}
            value={tplBody}
            onChange={(e) => setTplBody(e.target.value)}
            placeholder="Yth. {{nama}} ({{jabatan}}), ..."
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => setTemplateModalOpen(false)}>
              Batal
            </Button>
            <Button type="submit" loading={savingTpl}>
              Simpan Templat
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={confirmSendOpen}
        title="Konfirmasi Pengiriman Email"
        message={
          preview
            ? `Pesan "${subject}" akan diproses untuk ${preview.selectedCount} penerima unik melalui mode ${
                data.runtime.deliveryMode === 'smtp_live' ? 'SMTP Live' : 'Sandbox Outbox (SQLite)'
              }. Lanjutkan?`
            : `Kirim pesan "${subject}" sekarang?`
        }
        confirmLabel="Ya, Proses Sekarang"
        loading={sending}
        onCancel={() => setConfirmSendOpen(false)}
        onConfirm={() => submitCampaign('send_now')}
      />

      <ConfirmDialog
        open={Boolean(cancelCampaignId)}
        title="Batalkan Kampanye Email?"
        message="Kampanye yang dibatalkan tidak akan diproses oleh antrean pengiriman."
        danger
        confirmLabel="Ya, Batalkan"
        onCancel={() => setCancelCampaignId(null)}
        onConfirm={handleCancelCampaign}
      />
    </PageContainer>
  );
}
