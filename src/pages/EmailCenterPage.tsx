import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  FileText,
  History,
  Mail,
  Paperclip,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut, apiUploadFile, apiUrl } from '../lib/api';
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
  const [bodyHtml, setBodyHtml] = useState('');
  const [composerView, setComposerView] = useState<'text' | 'html' | 'preview'>('text');
  const [nomorSurat, setNomorSurat] = useState('');
  const [tenggat, setTenggat] = useState('');
  const [tautan, setTautan] = useState('');
  const [allActive, setAllActive] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['koordinator_wilayah']);
  const [bidang, setBidang] = useState('');
  const [provinceCode, setProvinceCode] = useState(user?.role === 'koordinator_wilayah' ? user.provinceCode || '' : '');
  const [batchId, setBatchId] = useState('');
  const [manualEmailsText, setManualEmailsText] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [useQueue, setUseQueue] = useState(false);
  const [attachmentFiles, setAttachmentFiles] = useState<{ fileId: string; fileName: string; sizeBytes: number }[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [csvParsing, setCsvParsing] = useState(false);
  const [csvSummary, setCsvSummary] = useState<{
    totalValid: number;
    ignoredCount: number;
    delimiter: string;
    matchedInSystem: number;
    errorCsv: string;
  } | null>(null);

  const [preview, setPreview] = useState<AudiencePreviewResponse | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);

  // Campaign / log management
  const [logCampaignFilter, setLogCampaignFilter] = useState('');
  const [cancelCampaignId, setCancelCampaignId] = useState<string | null>(null);
  const [queueBusyId, setQueueBusyId] = useState<string | null>(null);

  // Template create / edit / history / attachments / filters
  const [tplSearch, setTplSearch] = useState('');
  const [tplCategoryFilter, setTplCategoryFilter] = useState('');
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplCategory, setTplCategory] = useState('Koordinasi Nasional');
  const [tplSubject, setTplSubject] = useState('');
  const [tplBody, setTplBody] = useState('');
  const [tplBodyHtml, setTplBodyHtml] = useState('');
  const [savingTpl, setSavingTpl] = useState(false);
  const [historyModalTpl, setHistoryModalTpl] = useState<EmailTemplateRecord | null>(null);
  const [tplHistory, setTplHistory] = useState<
    { id: string; version: number; subject: string; body_text: string; body_html: string | null; updated_by: string; created_at: string }[]
  >([]);
  const [tplHistoryLoading, setTplHistoryLoading] = useState(false);
  const [attModalTpl, setAttModalTpl] = useState<EmailTemplateRecord | null>(null);
  const [uploadingTplAtt, setUploadingTplAtt] = useState(false);

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
      setBodyHtml(tpl.bodyHtml || '');
      if (tpl.attachments && tpl.attachments.length > 0) {
        setAttachmentFiles(
          tpl.attachments.map((a) => ({
            fileId: a.fileId,
            fileName: a.fileName,
            sizeBytes: a.sizeBytes,
          }))
        );
      }
    }
  };

  const handleComposerAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const up = await apiUploadFile(file, 'email');
      setAttachmentFiles((prev) =>
        prev.some((f) => f.fileId === up.fileId)
          ? prev
          : [...prev, { fileId: up.fileId, fileName: up.fileName, sizeBytes: up.sizeBytes }]
      );
      notify(`Lampiran "${up.fileName}" siap disertakan.`, 'success');
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengunggah lampiran email.', 'error');
    } finally {
      setUploadingAttachment(false);
      e.target.value = '';
    }
  };

  const placeholderCheck = useMemo(() => {
    const s = validateEmailTemplatePlaceholders(subject);
    const b = validateEmailTemplatePlaceholders(bodyText);
    const h = bodyHtml.trim() ? validateEmailTemplatePlaceholders(bodyHtml) : { valid: true, invalidVariables: [] as string[] };
    return {
      valid: s.valid && b.valid && h.valid,
      invalid: [...s.invalidVariables, ...b.invalidVariables, ...h.invalidVariables],
    };
  }, [subject, bodyText, bodyHtml]);

  const insertVariableIntoComposer = (varName: string) => {
    const token = `{{${varName}}}`;
    if (composerView === 'html') {
      setBodyHtml((prev) => (prev ? `${prev} ${token}` : token));
    } else {
      setBodyText((prev) => (prev ? `${prev} ${token}` : token));
    }
  };

  const handleCsvRecipientsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvParsing(true);
    try {
      const csvText = await file.text();
      const res = await apiPost<{
        emails: string[];
        totalValid: number;
        ignoredCount: number;
        delimiter: string;
        matchedInSystem: number;
        errorCsv: string;
      }>('/api/email/parse-csv', { csvText });
      const existing = parsedManualEmails.map((em) => em.toLowerCase());
      const merged = Array.from(new Set([...existing, ...res.emails]));
      setManualEmailsText(merged.join('\n'));
      setCsvSummary({
        totalValid: res.totalValid,
        ignoredCount: res.ignoredCount,
        delimiter: res.delimiter || ',',
        matchedInSystem: res.matchedInSystem || 0,
        errorCsv: res.errorCsv || '',
      });
      notify(
        `${res.totalValid} email valid diekstrak dari CSV${res.ignoredCount > 0 ? ` (${res.ignoredCount} baris diabaikan)` : ''}.`,
        'success'
      );
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses berkas CSV penerima.', 'error');
    } finally {
      setCsvParsing(false);
      e.target.value = '';
    }
  };

  const downloadCsvErrors = () => {
    if (!csvSummary?.errorCsv) return;
    const blob = new Blob([csvSummary.errorCsv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'baris-gagal-penerima-email.csv';
    a.click();
  };

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
        queuedCount?: number;
        failedCount: number;
      }>('/api/email/send', {
        title: title.trim() || subject.trim(),
        templateId: selectedTemplateId || null,
        subject: subject.trim(),
        bodyText: bodyText.trim(),
        bodyHtml: bodyHtml.trim() || null,
        nomorSurat: nomorSurat.trim() || undefined,
        tenggat: tenggat.trim() || undefined,
        tautan: tautan.trim() || undefined,
        audienceFilter: buildAudienceFilter(),
        actionMode,
        scheduledAt: actionMode === 'schedule' ? new Date(scheduledAt).toISOString() : null,
        attachmentFileIds: attachmentFiles.map((f) => f.fileId),
        useQueue,
      });

      const modeInfo =
        res.deliveryMode === 'smtp_live'
          ? 'melalui SMTP Live'
          : 'ke antrean Sandbox Outbox (SQLite)';
      if (actionMode === 'save_draft') {
        notify('Draf kampanye email berhasil disimpan.', 'success');
      } else if (actionMode === 'schedule') {
        notify('Kampanye email berhasil dijadwalkan.', 'success');
      } else if (res.queuedCount && res.queuedCount > 0) {
        notify(
          `Kampanye masuk antrean (${res.sentCount} selesai, ${res.queuedCount} mengantre dari ${res.totalRecipients} penerima). Pantau di tab Riwayat Kampanye.`,
          'success'
        );
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

  const handlePauseCampaign = async (id: string) => {
    setQueueBusyId(id);
    try {
      await apiPost(`/api/email/campaigns/${id}/pause`);
      notify('Antrean kampanye dijeda.', 'info');
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menjeda kampanye.', 'error');
    } finally {
      setQueueBusyId(null);
    }
  };

  const handleResumeCampaign = async (id: string) => {
    setQueueBusyId(id);
    try {
      const res = await apiPost<{ processed: number; remaining: number }>(`/api/email/campaigns/${id}/resume`);
      notify(`Kampanye dilanjutkan (${res.processed} diproses, ${res.remaining} tersisa).`, 'success');
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal melanjutkan kampanye.', 'error');
    } finally {
      setQueueBusyId(null);
    }
  };

  const handleProcessNextBatch = async (id: string) => {
    setQueueBusyId(id);
    try {
      const res = await apiPost<{ processed: number; remaining: number }>(`/api/email/campaigns/${id}/process-next`);
      notify(`Batch antrean diproses (${res.processed} penerima, sisa ${res.remaining}).`, 'info');
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal memproses batch berikutnya.', 'error');
    } finally {
      setQueueBusyId(null);
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

  const openCreateTemplateModal = () => {
    setEditingTemplateId(null);
    setTplName('');
    setTplCategory('Koordinasi Nasional');
    setTplSubject('');
    setTplBody('');
    setTplBodyHtml('');
    setTemplateModalOpen(true);
  };

  const openEditTemplateModal = (tpl: EmailTemplateRecord) => {
    setEditingTemplateId(tpl.id);
    setTplName(tpl.name);
    setTplCategory(tpl.category);
    setTplSubject(tpl.subject);
    setTplBody(tpl.bodyText);
    setTplBodyHtml(tpl.bodyHtml || '');
    setTemplateModalOpen(true);
  };

  const openTemplateHistory = async (tpl: EmailTemplateRecord) => {
    setHistoryModalTpl(tpl);
    setTplHistory([]);
    setTplHistoryLoading(true);
    try {
      const res = await apiGet<{
        history: { id: string; version: number; subject: string; body_text: string; body_html: string | null; updated_by: string; created_at: string }[];
      }>(`/api/email/templates/${tpl.id}/history`);
      setTplHistory(res.history || []);
    } catch {
      setTplHistory([]);
    } finally {
      setTplHistoryLoading(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTpl(true);
    try {
      if (editingTemplateId) {
        const res = await apiPut<{ version: number }>(`/api/email/templates/${editingTemplateId}`, {
          name: tplName,
          category: tplCategory,
          subject: tplSubject,
          bodyText: tplBody,
          bodyHtml: tplBodyHtml.trim() || null,
        });
        notify(`Templat diperbarui ke Versi ${res.version} (versi lama disimpan di riwayat).`, 'success');
      } else {
        await apiPost('/api/email/templates', {
          name: tplName,
          category: tplCategory,
          subject: tplSubject,
          bodyText: tplBody,
          bodyHtml: tplBodyHtml.trim() || null,
        });
        notify('Templat email resmi berhasil ditambahkan.', 'success');
      }
      setTemplateModalOpen(false);
      setEditingTemplateId(null);
      setTplName('');
      setTplSubject('');
      setTplBody('');
      setTplBodyHtml('');
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

  const handleToggleTemplateStatus = async (tpl: EmailTemplateRecord) => {
    try {
      await apiPatch(`/api/email/templates/${tpl.id}/status`, { isActive: !tpl.isActive });
      notify(`Templat "${tpl.name}" ${!tpl.isActive ? 'diaktifkan' : 'dinonaktifkan'}.`, 'success');
      await loadOverview();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal mengubah status templat.', 'error');
    }
  };

  const handleAttachFileToTemplate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !attModalTpl) return;
    setUploadingTplAtt(true);
    try {
      const up = await apiUploadFile(file, 'email');
      await apiPost(`/api/email/templates/${attModalTpl.id}/attachments`, { fileId: up.fileId });
      notify(`Lampiran "${up.fileName}" ditambahkan ke templat.`, 'success');
      const refreshed = await apiGet<EmailOverviewResponse>('/api/email/overview');
      setData(refreshed);
      const updated = refreshed.templates.find((item) => item.id === attModalTpl.id) || null;
      setAttModalTpl(updated);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menambahkan lampiran templat.', 'error');
    } finally {
      setUploadingTplAtt(false);
      e.target.value = '';
    }
  };

  const handleRemoveTemplateAttachment = async (templateId: string, attachmentId: string) => {
    try {
      await apiDelete(`/api/email/templates/${templateId}/attachments/${attachmentId}`);
      notify('Lampiran templat dihapus.', 'info');
      const refreshed = await apiGet<EmailOverviewResponse>('/api/email/overview');
      setData(refreshed);
      const updated = refreshed.templates.find((item) => item.id === templateId) || null;
      setAttModalTpl(updated);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Gagal menghapus lampiran templat.', 'error');
    }
  };

  const filteredLogs = useMemo(() => {
    if (!data) return [];
    if (!logCampaignFilter) return data.logs;
    return data.logs.filter((l) => l.campaignId === logCampaignFilter);
  }, [data, logCampaignFilter]);

  const templateCategories = useMemo(() => {
    if (!data) return [];
    return Array.from(new Set(data.templates.map((t) => t.category || 'Umum'))).sort();
  }, [data]);

  const filteredTemplates = useMemo(() => {
    if (!data) return [];
    const q = tplSearch.trim().toLowerCase();
    return data.templates.filter((t) => {
      if (tplCategoryFilter && (t.category || 'Umum') !== tplCategoryFilter) return false;
      if (
        q &&
        !t.name.toLowerCase().includes(q) &&
        !t.subject.toLowerCase().includes(q) &&
        !t.code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [data, tplSearch, tplCategoryFilter]);

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
                onClick={openCreateTemplateModal}
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
                  <option key={t.id} value={t.id} disabled={!t.isActive}>
                    {t.name} ({t.category}){!t.isActive ? ' [Nonaktif]' : ''}
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

            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Editor &amp; Pratinjau Isi Pesan *
                </span>
                <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-[11px] font-semibold">
                  {[
                    ['text', 'Teks Biasa'],
                    ['html', 'HTML Email'],
                    ['preview', 'Pratinjau'],
                  ].map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setComposerView(k as typeof composerView)}
                      className={`px-2.5 py-1 rounded-md ${
                        composerView === k
                          ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                          : 'text-slate-500'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {composerView === 'text' && (
                <Textarea
                  rows={7}
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  placeholder="Yth. {{nama}} ({{jabatan}} - {{provinsi}}), ..."
                />
              )}

              {composerView === 'html' && (
                <Textarea
                  rows={7}
                  value={bodyHtml}
                  onChange={(e) => setBodyHtml(e.target.value)}
                  placeholder="<p>Yth. <strong>{{nama}}</strong> ({{jabatan}} - {{provinsi}}),</p>"
                />
              )}

              {composerView === 'preview' && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 p-4 space-y-2 text-xs min-h-[168px]">
                  <p className="text-[11px] font-semibold text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
                    Subjek Pratinjau:{' '}
                    <span className="text-slate-900 dark:text-white">{subject || '(Belum ada subjek)'}</span>
                  </p>
                  {bodyHtml.trim() ? (
                    <div className="space-y-2">
                      <p className="text-[11px] text-[#0EA5E9] font-semibold">Pratinjau Konten HTML (Teks Terbersihkan Aman):</p>
                      <pre className="whitespace-pre-wrap font-sans text-slate-700 dark:text-slate-200">
                        {bodyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()}
                      </pre>
                    </div>
                  ) : (
                    <p className="whitespace-pre-line text-slate-700 dark:text-slate-200">
                      {bodyText || 'Belum ada isi pesan.'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 px-3.5 py-2.5 space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Klik variabel untuk menyisipkan ke editor ({ALLOWED_EMAIL_VARIABLES.length} variabel resmi):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {ALLOWED_EMAIL_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariableIntoComposer(v)}
                    className="px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 font-mono text-slate-800 dark:text-slate-200 hover:border-[#0EA5E9]"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Variabel {{nomor_surat}} (Opsional)"
                value={nomorSurat}
                onChange={(e) => setNomorSurat(e.target.value)}
                placeholder="DPBI/SURAT/2026/001"
              />
              <Input
                label="Variabel {{tenggat}} (Opsional)"
                value={tenggat}
                onChange={(e) => setTenggat(e.target.value)}
                placeholder="5 Desember 2026"
              />
              <Input
                label="Variabel {{tautan}} (Opsional)"
                value={tautan}
                onChange={(e) => setTautan(e.target.value)}
                placeholder="https://satu.dpbi.or.id/..."
              />
            </div>

            {!placeholderCheck.valid && (
              <div role="alert" className="rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 p-3 text-xs text-rose-700 dark:text-rose-300">
                Variabel tidak dikenali atau tanda kurung belum tertutup: {placeholderCheck.invalid.join(', ')}
              </div>
            )}

            <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-900/50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
                  <Paperclip className="w-3.5 h-3.5 text-[#0EA5E9]" /> Lampiran Email ({attachmentFiles.length})
                </span>
                {canCreate && (
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs font-semibold cursor-pointer hover:border-[#0EA5E9]">
                    <Upload className="w-3.5 h-3.5 text-[#0EA5E9]" />
                    {uploadingAttachment ? 'Mengunggah...' : 'Tambah Lampiran'}
                    <input
                      type="file"
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
                      onChange={handleComposerAttachmentUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              {attachmentFiles.length === 0 ? (
                <p className="text-[11px] text-slate-500">
                  Belum ada berkas terlampir. Lampiran pada templat otomatis ikut terbawa saat memilih templat.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {attachmentFiles.map((f) => (
                    <span
                      key={f.fileId}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-[11px] text-slate-700 dark:text-slate-200"
                    >
                      <Paperclip className="w-3 h-3 text-[#0EA5E9]" />
                      <span className="truncate max-w-[180px]">{f.fileName}</span>
                      <span className="font-mono text-slate-400 tabular-nums">({Math.max(1, Math.round(f.sizeBytes / 1024))} KB)</span>
                      <button
                        type="button"
                        onClick={() => setAttachmentFiles((prev) => prev.filter((item) => item.fileId !== f.fileId))}
                        aria-label={`Hapus lampiran ${f.fileName}`}
                        className="text-rose-500 hover:text-rose-700 ml-0.5"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 items-end">
              <Input
                type="datetime-local"
                label="Jadwalkan Pengiriman (Opsional)"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
              <div className="pb-1">
                <Switch
                  label="Proses bertahap lewat antrean (disarankan untuk >25 penerima)"
                  checked={useQueue}
                  onChange={setUseQueue}
                />
              </div>
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

            {canCreate && (
              <div className="space-y-2">
                <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:border-[#0EA5E9] cursor-pointer">
                  <Upload className="w-3.5 h-3.5 text-[#0EA5E9]" />
                  {csvParsing ? 'Membaca Berkas CSV...' : 'Unggah CSV Daftar Email Penerima'}
                  <input
                    type="file"
                    accept=".csv,.txt,text/csv,text/plain"
                    onChange={handleCsvRecipientsUpload}
                    className="hidden"
                  />
                </label>
                {csvSummary && (
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 p-2.5 text-[11px] space-y-1">
                    <p className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums">
                      CSV ({csvSummary.delimiter === ';' ? 'titik koma' : 'koma'}): {csvSummary.totalValid} valid ·{' '}
                      {csvSummary.matchedInSystem} cocok di sistem · {csvSummary.ignoredCount} diabaikan
                    </p>
                    {csvSummary.errorCsv && (
                      <button
                        type="button"
                        onClick={downloadCsvErrors}
                        className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-semibold hover:underline"
                      >
                        <Download className="w-3 h-3" /> Unduh Laporan Baris Gagal (CSV)
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

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
              {data.campaigns.map((c) => {
                const pct = c.totalRecipients > 0 ? Math.min(100, Math.round((c.sentCount / c.totalRecipients) * 100)) : 0;
                const isQueued = ['dalam_antrean', 'sedang_dikirim'].includes(c.status);
                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900 dark:text-white">{c.title}</p>
                        <StatusIndicator status={c.paused ? 'menunggu' : c.status} customLabel={c.paused ? 'Dijeda' : undefined} />
                        <span className="text-[11px] font-mono text-slate-500">
                          {c.deliveryMode === 'smtp_live' ? 'SMTP Live' : 'Sandbox Outbox'}
                        </span>
                        {c.attachments && c.attachments.length > 0 && (
                          <span className="text-[11px] text-[#0EA5E9] inline-flex items-center gap-1 font-medium">
                            <Paperclip className="w-3 h-3" /> {c.attachments.length} lampiran
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-300 truncate">Subjek: {c.subject}</p>
                      <div className="max-w-md space-y-1">
                        <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                          <div className="h-full bg-[#0EA5E9] transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                          Oleh {c.createdByName} · {c.sentCount}/{c.totalRecipients} terkirim ({pct}%) · {c.queuedCount ?? 0} antre · {c.failedCount} gagal ·{' '}
                          {formatTanggalIndonesia(c.sentAt || c.scheduledAt || c.createdAt, true)}
                        </p>
                      </div>
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
                      {isQueued && canCreate && !c.paused && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={queueBusyId === c.id}
                          onClick={() => handlePauseCampaign(c.id)}
                        >
                          <Pause className="w-3.5 h-3.5" /> Jeda
                        </Button>
                      )}
                      {isQueued && canCreate && c.paused && (
                        <Button
                          size="sm"
                          variant="primary"
                          loading={queueBusyId === c.id}
                          onClick={() => handleResumeCampaign(c.id)}
                        >
                          <Play className="w-3.5 h-3.5" /> Lanjutkan
                        </Button>
                      )}
                      {isQueued && canCreate && (
                        <Button
                          size="sm"
                          variant="secondary"
                          loading={queueBusyId === c.id}
                          onClick={() => handleProcessNextBatch(c.id)}
                        >
                          Proses Batch
                        </Button>
                      )}
                      {['draft', 'terjadwal', 'dalam_antrean', 'sedang_dikirim'].includes(c.status) && canCreate && (
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
                );
              })}
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
                    <th className="py-2.5 px-3">Kanal</th>
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
                      <td className="py-2.5 px-3 text-xs font-mono text-slate-600 dark:text-slate-300">
                        {l.deliveryChannel || l.deliveryMode}
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
        <div className="space-y-5">
          <Card className="p-4 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={tplSearch}
                onChange={(e) => setTplSearch(e.target.value)}
                placeholder="Cari dari 50+ templat email resmi berdasarkan nama, kode, atau subjek..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-xs"
              />
            </div>
            <Select
              aria-label="Filter kategori templat"
              value={tplCategoryFilter}
              onChange={(e) => setTplCategoryFilter(e.target.value)}
            >
              <option value="">Semua Kategori ({data.templates.length})</option>
              {templateCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>
          </Card>

          {filteredTemplates.length === 0 ? (
            <EmptyState
              title="Templat tidak ditemukan"
              description="Sesuaikan kata kunci atau kategori untuk menampilkan templat email resmi."
            />
          ) : (
            Object.entries(
              filteredTemplates.reduce<Record<string, EmailTemplateRecord[]>>((acc, t) => {
                const cat = t.category || 'Umum';
                if (!acc[cat]) acc[cat] = [];
                acc[cat].push(t);
                return acc;
              }, {})
            ).map(([cat, tpls]) => (
              <div key={cat} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {cat} ({tpls.length})
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {tpls.map((t) => (
                    <Card key={t.id} className="p-4 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[11px] text-[#0EA5E9] font-semibold">
                              {t.category} · v{t.version || 1}
                            </p>
                            <StatusIndicator status={t.isActive ? 'aktif' : 'nonaktif'} />
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5 mt-0.5">
                            <FileText className="w-3.5 h-3.5 text-[#0EA5E9] shrink-0" />
                            <span className="truncate">{t.name}</span>
                          </h4>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openTemplateHistory(t)}
                          >
                            <History className="w-3.5 h-3.5" /> Versi
                          </Button>
                          {can('email', 'edit') && (
                            <>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => setAttModalTpl(t)}
                              >
                                <Paperclip className="w-3.5 h-3.5" /> {t.attachments?.length || 0}
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => openEditTemplateModal(t)}
                              >
                                <Edit3 className="w-3.5 h-3.5" /> Ubah
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => handleToggleTemplateStatus(t)}
                              >
                                {t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="primary"
                            disabled={!t.isActive}
                            onClick={() => {
                              handleSelectTemplate(t.id);
                              setActiveTab('composer');
                            }}
                          >
                            Pakai
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Subjek: {t.subject}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 whitespace-pre-line line-clamp-3">{t.bodyText}</p>
                      <div className="flex flex-wrap items-center gap-3 text-[11px]">
                        {t.bodyHtml && (
                          <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1 font-medium">
                            <Eye className="w-3 h-3" /> Format HTML
                          </span>
                        )}
                        {t.attachments && t.attachments.length > 0 && (
                          <span className="text-[#0EA5E9] inline-flex items-center gap-1 font-medium">
                            <Paperclip className="w-3 h-3" /> {t.attachments.length} lampiran default
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* New / Edit Template Modal */}
      <Modal
        open={templateModalOpen}
        onClose={() => {
          setTemplateModalOpen(false);
          setEditingTemplateId(null);
        }}
        title={editingTemplateId ? 'Ubah Templat Email Resmi' : 'Buat Templat Email Resmi'}
        subtitle={`Variabel valid: ${ALLOWED_EMAIL_VARIABLES.map((v) => `{{${v}}}`).join(', ')}`}
      >
        <form onSubmit={handleSaveTemplate} className="space-y-3.5">
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
            label="Isi Teks Templat *"
            required
            rows={4}
            value={tplBody}
            onChange={(e) => setTplBody(e.target.value)}
            placeholder="Yth. {{nama}} ({{jabatan}}), ..."
          />
          <Textarea
            label="Isi HTML Templat (Opsional)"
            rows={4}
            value={tplBodyHtml}
            onChange={(e) => setTplBodyHtml(e.target.value)}
            placeholder="<p>Yth. <strong>{{nama}}</strong> ({{jabatan}}), ...</p>"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setTemplateModalOpen(false);
                setEditingTemplateId(null);
              }}
            >
              Batal
            </Button>
            <Button type="submit" loading={savingTpl}>
              {editingTemplateId ? 'Simpan Versi Baru' : 'Simpan Templat'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Template Attachments Modal */}
      <Modal
        open={Boolean(attModalTpl)}
        onClose={() => setAttModalTpl(null)}
        title={`Lampiran Templat — ${attModalTpl?.name || ''}`}
        subtitle="Lampiran ini akan otomatis disertakan saat Anda memakai templat di komposer."
      >
        {attModalTpl && (
          <div className="space-y-4 text-xs">
            <label className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 font-semibold cursor-pointer hover:border-[#0EA5E9]">
              <Upload className="w-3.5 h-3.5 text-[#0EA5E9]" />
              {uploadingTplAtt ? 'Mengunggah Berkas...' : 'Unggah & Pasang Lampiran Baru'}
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.csv,.txt"
                onChange={handleAttachFileToTemplate}
                className="hidden"
              />
            </label>
            {!attModalTpl.attachments || attModalTpl.attachments.length === 0 ? (
              <p className="text-slate-500 py-3 text-center">Belum ada lampiran pada templat ini.</p>
            ) : (
              <div className="divide-y divide-slate-200 dark:divide-slate-800">
                {attModalTpl.attachments.map((att) => (
                  <div key={att.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white truncate">{att.fileName}</p>
                      <p className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {Math.max(1, Math.round(att.sizeBytes / 1024))} KB · {att.mimeType}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleRemoveTemplateAttachment(attModalTpl.id, att.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Template Version History Modal */}
      <Modal
        open={Boolean(historyModalTpl)}
        onClose={() => setHistoryModalTpl(null)}
        title={`Riwayat Versi Templat — ${historyModalTpl?.name || ''}`}
        subtitle={`Versi aktif saat ini: v${historyModalTpl?.version || 1}`}
        maxWidth="max-w-2xl"
      >
        {historyModalTpl && (
          <div className="space-y-3 text-xs">
            {tplHistoryLoading ? (
              <p className="text-slate-500 py-4">Memuat riwayat versi templat...</p>
            ) : tplHistory.length === 0 ? (
              <p className="text-slate-500 py-4">
                Templat ini masih berada pada versi awal (v{historyModalTpl.version || 1}) dan belum memiliki arsip revisi sebelumnya.
              </p>
            ) : (
              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {tplHistory.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl border border-slate-200 dark:border-slate-800 p-3 space-y-1.5 bg-slate-50/70 dark:bg-slate-900/50"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-mono font-bold text-[#0EA5E9]">Versi {h.version}</span>
                      <span className="text-slate-500 tabular-nums">
                        Diubah oleh {h.updated_by} · {formatTanggalIndonesia(h.created_at, true)}
                      </span>
                    </div>
                    <p className="font-semibold text-slate-900 dark:text-white">Subjek: {h.subject}</p>
                    <p className="text-slate-600 dark:text-slate-300 whitespace-pre-line">{h.body_text}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
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
