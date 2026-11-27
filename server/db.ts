import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const IS_DEMO_MODE =
  process.env.DEMO_MODE === 'true' ||
  (process.env.DEMO_MODE === undefined && process.env.NODE_ENV !== 'production');

const DATA_ROOT = process.env.SATU_DPBI_DATA_ROOT
  ? path.resolve(process.env.SATU_DPBI_DATA_ROOT)
  : process.cwd();
const DATA_DIR = path.resolve(DATA_ROOT, 'data');
export const PRIVATE_STORAGE_DIR = path.resolve(DATA_ROOT, 'storage', 'private');
export const BACKUP_STORAGE_DIR = path.resolve(DATA_ROOT, 'storage', 'backups');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_STORAGE_DIR, { recursive: true });
fs.mkdirSync(BACKUP_STORAGE_DIR, { recursive: true });

export const DB_PATH = path.join(
  DATA_DIR,
  IS_DEMO_MODE ? 'satu_dpbi_demo.db' : 'satu_dpbi_prod.db'
);

let dbInstance: DatabaseSync | null = null;

export function getDb(): DatabaseSync {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec('PRAGMA journal_mode = WAL;');
    dbInstance.exec('PRAGMA foreign_keys = ON;');
    initSchema(dbInstance);
  }
  return dbInstance;
}

export function resetDbConnection(): void {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // ignore close errors
    }
    dbInstance = null;
  }
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      bidang TEXT,
      province_code TEXT,
      batch_id TEXT,
      personnel_id TEXT,
      account_status TEXT NOT NULL DEFAULT 'aktif',
      alumni_access_expires_at TEXT,
      is_demo INTEGER NOT NULL DEFAULT 0,
      last_login_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      device_label TEXT NOT NULL,
      ip_address TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      last_seen_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL,
      province_code TEXT,
      batch_id TEXT,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      used_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reference_sequences (
      category TEXT NOT NULL,
      year INTEGER NOT NULL,
      last_seq INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (category, year)
    );

    CREATE TABLE IF NOT EXISTS provinces (
      code TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      island TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'belum_terbentuk',
      coordinator_id TEXT,
      coordinator_name TEXT,
      coaching_note TEXT,
      min_lat REAL NOT NULL,
      max_lat REAL NOT NULL,
      min_lng REAL NOT NULL,
      max_lng REAL NOT NULL,
      center_lat REAL NOT NULL,
      center_lng REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
      id TEXT PRIMARY KEY,
      batch_number INTEGER NOT NULL UNIQUE,
      name TEXT NOT NULL,
      opened_at TEXT NOT NULL,
      closed_at TEXT NOT NULL,
      briefing_at TEXT NOT NULL,
      term_starts_at TEXT NOT NULL,
      term_ends_at TEXT NOT NULL,
      duration_months INTEGER NOT NULL DEFAULT 4,
      status TEXT NOT NULL DEFAULT 'perencanaan',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS personnel (
      id TEXT PRIMARY KEY,
      member_number TEXT NOT NULL UNIQUE,
      reference_number TEXT NOT NULL UNIQUE,
      user_id TEXT,
      full_name TEXT NOT NULL,
      nickname TEXT NOT NULL DEFAULT '',
      birth_place TEXT NOT NULL DEFAULT '',
      birth_date TEXT NOT NULL DEFAULT '',
      gender TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      alt_contact TEXT DEFAULT '',
      province_code TEXT NOT NULL,
      regency TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      village TEXT NOT NULL DEFAULT '',
      postal_code TEXT NOT NULL DEFAULT '',
      full_address TEXT NOT NULL DEFAULT '',
      school_name TEXT NOT NULL DEFAULT '',
      education_level TEXT NOT NULL DEFAULT 'SMA/SMK/MA',
      grade_class TEXT NOT NULL DEFAULT '',
      major TEXT NOT NULL DEFAULT '',
      npsn TEXT NOT NULL DEFAULT '',
      nisn TEXT NOT NULL DEFAULT '',
      entry_year INTEGER NOT NULL DEFAULT 2024,
      expected_grad_year INTEGER NOT NULL DEFAULT 2027,
      school_address TEXT NOT NULL DEFAULT '',
      school_regency TEXT NOT NULL DEFAULT '',
      school_province TEXT NOT NULL DEFAULT '',
      batch_id TEXT NOT NULL,
      position_title TEXT NOT NULL DEFAULT 'Duta Pelajar Berbudaya',
      bidang TEXT NOT NULL DEFAULT 'Kebudayaan',
      role_code TEXT NOT NULL DEFAULT 'duta',
      appointed_at TEXT NOT NULL DEFAULT '',
      term_starts_at TEXT NOT NULL DEFAULT '',
      term_ends_at TEXT NOT NULL DEFAULT '',
      personnel_status TEXT NOT NULL DEFAULT 'aktif',
      verification_status TEXT NOT NULL DEFAULT 'menunggu_verifikasi',
      verification_note TEXT,
      cultural_interests TEXT NOT NULL DEFAULT '',
      activity_interests TEXT NOT NULL DEFAULT '',
      org_experience TEXT NOT NULL DEFAULT '',
      skills TEXT NOT NULL DEFAULT '',
      guardian_name TEXT NOT NULL DEFAULT '',
      guardian_relation TEXT NOT NULL DEFAULT '',
      guardian_phone TEXT NOT NULL DEFAULT '',
      docs_checklist_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_personnel_province ON personnel(province_code);
    CREATE INDEX IF NOT EXISTS idx_personnel_batch ON personnel(batch_id);
    CREATE INDEX IF NOT EXISTS idx_personnel_email ON personnel(email);

    CREATE TABLE IF NOT EXISTS account_requests (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      province_code TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      school_name TEXT NOT NULL,
      supporting_file_id TEXT,
      supporting_file_name TEXT,
      requested_by_user_id TEXT NOT NULL,
      requested_by_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'menunggu',
      decision_note TEXT,
      decided_by TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS organization_positions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      bidang TEXT NOT NULL,
      level TEXT NOT NULL,
      holder_personnel_id TEXT,
      holder_name TEXT,
      sk_number TEXT,
      term_starts_at TEXT,
      term_ends_at TEXT,
      status TEXT NOT NULL DEFAULT 'aktif',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS delegations (
      id TEXT PRIMARY KEY,
      delegate_user_id TEXT NOT NULL,
      delegate_name TEXT NOT NULL,
      grantor_user_id TEXT NOT NULL,
      grantor_name TEXT NOT NULL,
      module TEXT NOT NULL,
      action TEXT NOT NULL,
      province_code TEXT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      reason TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aktif',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS handovers (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      province_code TEXT NOT NULL,
      outgoing_coordinator_id TEXT,
      outgoing_coordinator_name TEXT NOT NULL,
      incoming_coordinator_id TEXT,
      incoming_coordinator_name TEXT NOT NULL,
      active_tasks_count INTEGER NOT NULL DEFAULT 0,
      open_proposals_count INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'menunggu_persetujuan',
      approved_by TEXT,
      approved_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approval_matrix_rules (
      id TEXT PRIMARY KEY,
      bidang TEXT NOT NULL,
      category TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      uses_dpbi_identity INTEGER NOT NULL DEFAULT 0,
      external_permit_needed INTEGER NOT NULL DEFAULT 0,
      approver_role TEXT NOT NULL,
      notes TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL DEFAULT 1,
      title TEXT NOT NULL,
      applicant_personnel_id TEXT NOT NULL,
      applicant_name TEXT NOT NULL,
      province_code TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      bidang TEXT NOT NULL,
      category TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'rendah',
      uses_dpbi_identity INTEGER NOT NULL DEFAULT 1,
      external_permit_needed INTEGER NOT NULL DEFAULT 0,
      assigned_approver_role TEXT NOT NULL,
      objective TEXT NOT NULL,
      target_audience TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      location TEXT NOT NULL,
      pic_name TEXT NOT NULL,
      estimated_participants INTEGER NOT NULL DEFAULT 30,
      activity_mode TEXT NOT NULL DEFAULT 'luring',
      pdf_file_id TEXT,
      pdf_file_name TEXT,
      status TEXT NOT NULL DEFAULT 'diajukan',
      decision_note TEXT,
      decided_by TEXT,
      decided_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_proposals_province ON proposals(province_code);
    CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

    CREATE TABLE IF NOT EXISTS proposal_versions (
      id TEXT PRIMARY KEY,
      proposal_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      pdf_file_id TEXT,
      pdf_file_name TEXT,
      change_note TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lkl_reports (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      version INTEGER NOT NULL DEFAULT 1,
      activity_name TEXT NOT NULL,
      proposal_id TEXT,
      proposal_ref TEXT,
      submitter_personnel_id TEXT NOT NULL,
      submitter_name TEXT NOT NULL,
      province_code TEXT NOT NULL,
      regency TEXT NOT NULL DEFAULT '',
      district TEXT NOT NULL DEFAULT '',
      village TEXT NOT NULL DEFAULT '',
      venue_name TEXT NOT NULL DEFAULT '',
      venue_address TEXT NOT NULL DEFAULT '',
      event_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      category TEXT NOT NULL,
      activity_mode TEXT NOT NULL DEFAULT 'luring',
      platform_name TEXT,
      platform_link TEXT,
      pic_name TEXT NOT NULL,
      participant_count INTEGER NOT NULL DEFAULT 0,
      summary TEXT NOT NULL,
      outcomes TEXT NOT NULL,
      obstacles TEXT NOT NULL DEFAULT '',
      follow_up TEXT NOT NULL DEFAULT '',
      pdf_file_id TEXT,
      pdf_file_name TEXT,
      photo_file_ids_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'menunggu_pemeriksaan',
      review_note TEXT,
      reviewed_by TEXT,
      reviewed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_lkl_province ON lkl_reports(province_code);
    CREATE INDEX IF NOT EXISTS idx_lkl_status ON lkl_reports(status);

    CREATE TABLE IF NOT EXISTS coordinator_reports (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      report_type TEXT NOT NULL,
      province_code TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      coordinator_id TEXT NOT NULL,
      coordinator_name TEXT NOT NULL,
      period_label TEXT NOT NULL,
      personnel_condition TEXT NOT NULL,
      activities_summary TEXT NOT NULL,
      lkl_recap_count INTEGER NOT NULL DEFAULT 0,
      obstacles TEXT NOT NULL,
      coaching_needs TEXT NOT NULL,
      follow_up_plan TEXT NOT NULL,
      pdf_file_id TEXT,
      pdf_file_name TEXT,
      status TEXT NOT NULL DEFAULT 'dikirim',
      review_note TEXT,
      reviewed_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'sedang',
      status TEXT NOT NULL DEFAULT 'belum_dimulai',
      deadline TEXT NOT NULL,
      province_code TEXT,
      batch_id TEXT,
      assignee_id TEXT NOT NULL,
      assignee_name TEXT NOT NULL,
      creator_id TEXT NOT NULL,
      creator_name TEXT NOT NULL,
      checklist_json TEXT NOT NULL DEFAULT '[]',
      is_template INTEGER NOT NULL DEFAULT 0,
      recurrence TEXT NOT NULL DEFAULT 'tidak',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_comments (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      author_id TEXT NOT NULL,
      author_name TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      document_number TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      owner_name TEXT NOT NULL,
      issuer_name TEXT NOT NULL,
      issued_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'berlaku',
      version TEXT NOT NULL DEFAULT '1.0',
      access_level TEXT NOT NULL DEFAULT 'internal_semua',
      file_id TEXT,
      file_name TEXT,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      notes TEXT NOT NULL DEFAULT '',
      expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      scope TEXT NOT NULL DEFAULT 'nasional',
      province_code TEXT,
      batch_id TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      author_name TEXT NOT NULL,
      published_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'terbit'
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      start_at TEXT NOT NULL,
      end_at TEXT NOT NULL,
      province_code TEXT,
      batch_id TEXT,
      related_ref TEXT,
      location TEXT NOT NULL DEFAULT 'Nasional / Daring',
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      category TEXT NOT NULL,
      target_path TEXT NOT NULL DEFAULT '/dashboard',
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saved_views (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      module TEXT NOT NULL,
      name TEXT NOT NULL,
      filter_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS risk_assessments (
      id TEXT PRIMARY KEY,
      proposal_id TEXT,
      activity_title TEXT NOT NULL,
      province_code TEXT NOT NULL,
      participant_under_18 INTEGER NOT NULL DEFAULT 1,
      adult_chaperone_count INTEGER NOT NULL DEFAULT 2,
      environment_notes TEXT NOT NULL,
      transport_plan TEXT NOT NULL,
      emergency_plan TEXT NOT NULL,
      emergency_contact TEXT NOT NULL,
      risk_level TEXT NOT NULL DEFAULT 'sedang',
      status TEXT NOT NULL DEFAULT 'disetujui',
      submitted_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS consent_records (
      id TEXT PRIMARY KEY,
      personnel_id TEXT NOT NULL,
      personnel_name TEXT NOT NULL,
      activity_title TEXT NOT NULL,
      consent_participation INTEGER NOT NULL DEFAULT 1,
      consent_guardian INTEGER NOT NULL DEFAULT 1,
      consent_documentation INTEGER NOT NULL DEFAULT 1,
      consent_publication INTEGER NOT NULL DEFAULT 0,
      recorded_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS incidents (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      occurred_at TEXT NOT NULL,
      location TEXT NOT NULL,
      province_code TEXT NOT NULL,
      category TEXT NOT NULL,
      urgency TEXT NOT NULL,
      chronology TEXT NOT NULL,
      initial_action TEXT NOT NULL,
      escalated_to TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ditangani',
      reported_by_user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS whistleblowing_reports (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      reporter_mode TEXT NOT NULL DEFAULT 'rahasia',
      category TEXT NOT NULL,
      chronology TEXT NOT NULL,
      assigned_handler_role TEXT NOT NULL DEFAULT 'penanggung_jawab',
      conflict_rerouted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'baru',
      follow_up_note TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS evaluations (
      id TEXT PRIMARY KEY,
      personnel_id TEXT NOT NULL,
      personnel_name TEXT NOT NULL,
      role_code TEXT NOT NULL,
      province_code TEXT NOT NULL,
      batch_id TEXT NOT NULL,
      task_completion_score INTEGER NOT NULL,
      report_timeliness_score INTEGER NOT NULL,
      report_quality_score INTEGER NOT NULL,
      coordination_score INTEGER NOT NULL,
      total_score REAL NOT NULL,
      evaluator_name TEXT NOT NULL,
      coaching_recommendation TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'final',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS location_verifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      province_code TEXT NOT NULL,
      action_type TEXT NOT NULL,
      latitude REAL,
      longitude REAL,
      matched INTEGER NOT NULL,
      verification_mode TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS location_exceptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      province_code TEXT NOT NULL,
      reason TEXT NOT NULL,
      evidence_note TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'menunggu',
      decided_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stored_files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      module TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,
      is_archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backups (
      id TEXT PRIMARY KEY,
      backup_name TEXT NOT NULL,
      backup_type TEXT NOT NULL DEFAULT 'manual',
      size_bytes INTEGER NOT NULL,
      checksum_sha256 TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'berhasil',
      notes TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS automation_jobs (
      id TEXT PRIMARY KEY,
      job_key TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      schedule_label TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      last_run_at TEXT,
      last_status TEXT NOT NULL DEFAULT 'siap',
      last_message TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      action TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      outcome TEXT NOT NULL DEFAULT 'berhasil',
      context_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activity_timeline (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      province_code TEXT,
      batch_id TEXT,
      actor_name TEXT NOT NULL,
      related_path TEXT NOT NULL DEFAULT '/dashboard',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS system_errors (
      id TEXT PRIMARY KEY,
      reference_code TEXT NOT NULL UNIQUE,
      http_status INTEGER NOT NULL,
      route TEXT NOT NULL,
      error_message TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS regencies (
      code TEXT PRIMARY KEY,
      province_code TEXT NOT NULL,
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'kabupaten',
      status TEXT NOT NULL DEFAULT 'belum_terbentuk',
      coordinator_name TEXT,
      coaching_note TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_regencies_province ON regencies(province_code);

    CREATE TABLE IF NOT EXISTS districts (
      code TEXT PRIMARY KEY,
      regency_code TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_districts_regency ON districts(regency_code);

    CREATE TABLE IF NOT EXISTS villages (
      code TEXT PRIMARY KEY,
      district_code TEXT NOT NULL,
      name TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_villages_district ON villages(district_code);

    CREATE TABLE IF NOT EXISTS region_history (
      id TEXT PRIMARY KEY,
      region_type TEXT NOT NULL,
      region_code TEXT NOT NULL,
      action TEXT NOT NULL,
      summary TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_region_history_code ON region_history(region_code);

    CREATE TABLE IF NOT EXISTS cms_contents (
      key TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      updated_by TEXT,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS help_articles (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      role_target TEXT NOT NULL DEFAULT 'umum',
      title TEXT NOT NULL,
      summary TEXT NOT NULL,
      content TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 1,
      is_published INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS file_access_grants (
      id TEXT PRIMARY KEY,
      file_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      province_code TEXT,
      module TEXT NOT NULL DEFAULT 'umum',
      created_at TEXT NOT NULL,
      UNIQUE(file_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_file_grants_file ON file_access_grants(file_id);
    CREATE INDEX IF NOT EXISTS idx_file_grants_user ON file_access_grants(user_id);

    CREATE TABLE IF NOT EXISTS email_templates (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_campaigns (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      template_id TEXT,
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      audience_filter_json TEXT NOT NULL DEFAULT '{}',
      delivery_mode TEXT NOT NULL DEFAULT 'sandbox_outbox',
      status TEXT NOT NULL DEFAULT 'draft',
      total_recipients INTEGER NOT NULL DEFAULT 0,
      sent_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      scheduled_at TEXT,
      sent_at TEXT,
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS email_logs (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL,
      recipient_user_id TEXT,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT NOT NULL DEFAULT '',
      subject_rendered TEXT NOT NULL,
      body_rendered TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'terantre_outbox',
      delivery_mode TEXT NOT NULL DEFAULT 'sandbox_outbox',
      error_message TEXT,
      provider_message_id TEXT,
      sent_at TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_logs_campaign ON email_logs(campaign_id);
  `);

  // Safe idempotent column migrations for existing databases
  const addColumnIfMissing = (table: string, col: string, ddl: string) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
    if (!cols.some((c) => c.name === col)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${ddl};`);
    }
  };

  addColumnIfMissing('personnel', 'avatar_file_id', 'TEXT');
  addColumnIfMissing('personnel', 'assignment_province_code', 'TEXT');
  addColumnIfMissing('personnel', 'regency_code', 'TEXT');

  addColumnIfMissing('users', 'notification_prefs_json', "TEXT DEFAULT '{}'");

  addColumnIfMissing('provinces', 'logo_file_id', 'TEXT');
  addColumnIfMissing('provinces', 'description', 'TEXT');

  addColumnIfMissing('tasks', 'attachment_file_id', 'TEXT');
  addColumnIfMissing('tasks', 'attachment_file_name', 'TEXT');
  addColumnIfMissing('tasks', 'proposal_id', 'TEXT');
  addColumnIfMissing('tasks', 'lkl_id', 'TEXT');
  addColumnIfMissing('tasks', 'event_id', 'TEXT');
  addColumnIfMissing('tasks', 'category', "TEXT DEFAULT 'umum'");

  addColumnIfMissing('announcements', 'is_public', 'INTEGER NOT NULL DEFAULT 0');

  addColumnIfMissing('proposals', 'sla_due_at', 'TEXT');
  addColumnIfMissing('proposals', 'escalated_to', 'TEXT');
  addColumnIfMissing('proposals', 'escalated_at', 'TEXT');
  addColumnIfMissing('proposals', 'cancelled_reason', 'TEXT');

  addColumnIfMissing('calendar_events', 'proposal_id', 'TEXT');
  addColumnIfMissing('calendar_events', 'task_id', 'TEXT');

  addColumnIfMissing('evaluations', 'lkl_id', 'TEXT');

  addColumnIfMissing('coordinator_reports', 'reviewed_at', 'TEXT');
  addColumnIfMissing('coordinator_reports', 'version', 'INTEGER NOT NULL DEFAULT 1');

  addColumnIfMissing('documents', 'owner_user_id', 'TEXT');

  addColumnIfMissing('notifications', 'event_key', 'TEXT');
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_user_event_key ON notifications(user_id, event_key) WHERE event_key IS NOT NULL;'
  );

  // Migration 4: Personnel vs Account vs Invitation separation, Org Position History & CSV Import Batches
  db.exec(`
    CREATE TABLE IF NOT EXISTS org_position_history (
      id TEXT PRIMARY KEY,
      position_id TEXT NOT NULL,
      position_title TEXT NOT NULL,
      personnel_id TEXT,
      holder_name TEXT NOT NULL,
      bidang TEXT NOT NULL,
      province_code TEXT,
      sk_number TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      change_reason TEXT NOT NULL DEFAULT '',
      actor_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_org_pos_history_pos ON org_position_history(position_id);
    CREATE INDEX IF NOT EXISTS idx_org_pos_history_pers ON org_position_history(personnel_id);

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL DEFAULT 0,
      success_count INTEGER NOT NULL DEFAULT 0,
      skipped_count INTEGER NOT NULL DEFAULT 0,
      error_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'selesai',
      imported_by TEXT NOT NULL,
      imported_by_name TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      rolled_back_at TEXT
    );
  `);
  addColumnIfMissing('invitations', 'personnel_id', 'TEXT');
  addColumnIfMissing('invitations', 'status', "TEXT NOT NULL DEFAULT 'undangan_terkirim'");
  addColumnIfMissing('invitations', 'resend_count', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('invitations', 'last_sent_at', 'TEXT');
  addColumnIfMissing('invitations', 'opened_at', 'TEXT');
  addColumnIfMissing('invitations', 'cancelled_at', 'TEXT');
  addColumnIfMissing('invitations', 'cancelled_by', 'TEXT');
  db.exec("UPDATE invitations SET status = 'aktif' WHERE used_at IS NOT NULL AND status = 'undangan_terkirim';");

  addColumnIfMissing('personnel', 'import_batch_id', 'TEXT');
  addColumnIfMissing('personnel', 'nik_masked', 'TEXT');

  // Migration 5: Org Hierarchy & Flagship Programs
  db.exec(`
    CREATE TABLE IF NOT EXISTS flagship_programs (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      tagline TEXT NOT NULL,
      description TEXT NOT NULL,
      objectives TEXT NOT NULL,
      bidang TEXT NOT NULL,
      lead_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'aktif',
      target_provinces INTEGER NOT NULL DEFAULT 38,
      target_participants INTEGER NOT NULL DEFAULT 1000,
      period_label TEXT NOT NULL DEFAULT '2026',
      is_public INTEGER NOT NULL DEFAULT 1,
      updated_at TEXT NOT NULL
    );
  `);
  addColumnIfMissing('organization_positions', 'parent_id', 'TEXT');
  addColumnIfMissing('organization_positions', 'category', "TEXT NOT NULL DEFAULT 'Bidang'");
  addColumnIfMissing('organization_positions', 'sort_order', 'INTEGER NOT NULL DEFAULT 10');
  addColumnIfMissing('organization_positions', 'is_vacant', 'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('organization_positions', 'role_binding', 'TEXT');

  // Migration 6: Approval History, Task Dependencies & Program Linkage
  db.exec(`
    CREATE TABLE IF NOT EXISTS approval_history (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT NOT NULL,
      stage_label TEXT NOT NULL DEFAULT '',
      actor_user_id TEXT NOT NULL,
      actor_name TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      diff_json TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_approval_history_entity ON approval_history(entity_type, entity_id);
  `);
  addColumnIfMissing('proposals', 'program_id', 'TEXT');
  addColumnIfMissing('lkl_reports', 'program_id', 'TEXT');
  addColumnIfMissing('tasks', 'program_id', 'TEXT');
  addColumnIfMissing('tasks', 'depends_on_task_id', 'TEXT');
  addColumnIfMissing('evaluations', 'program_id', 'TEXT');
  addColumnIfMissing('evaluations', 'evaluator_type', "TEXT NOT NULL DEFAULT 'pengurus_nasional'");

  // Migration 7: Email HTML + Versioning + Delivery Channel
  db.exec(`
    CREATE TABLE IF NOT EXISTS email_template_history (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body_text TEXT NOT NULL,
      body_html TEXT,
      updated_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_email_tpl_history_tpl ON email_template_history(template_id);
  `);
  addColumnIfMissing('email_templates', 'body_html', 'TEXT');
  addColumnIfMissing('email_templates', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('email_campaigns', 'body_html', 'TEXT');
  addColumnIfMissing('email_logs', 'delivery_channel', "TEXT NOT NULL DEFAULT 'sandbox_outbox'");

  // Migration 8: Correspondence (Persuratan) & Document Lineage/Superseding
  db.exec(`
    CREATE TABLE IF NOT EXISTS correspondence (
      id TEXT PRIMARY KEY,
      reference_number TEXT NOT NULL UNIQUE,
      direction TEXT NOT NULL DEFAULT 'keluar',
      letter_type TEXT NOT NULL,
      subject TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      letter_date TEXT NOT NULL,
      received_date TEXT,
      province_code TEXT,
      program_id TEXT,
      urgency TEXT NOT NULL DEFAULT 'biasa',
      status TEXT NOT NULL DEFAULT 'baru',
      file_id TEXT,
      file_name TEXT,
      summary TEXT NOT NULL DEFAULT '',
      created_by TEXT NOT NULL,
      created_by_name TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_correspondence_dir ON correspondence(direction);

    CREATE TABLE IF NOT EXISTS correspondence_dispositions (
      id TEXT PRIMARY KEY,
      correspondence_id TEXT NOT NULL,
      from_user_id TEXT NOT NULL,
      from_user_name TEXT NOT NULL,
      to_user_id TEXT,
      to_user_name TEXT NOT NULL,
      instruction TEXT NOT NULL,
      due_date TEXT,
      status TEXT NOT NULL DEFAULT 'belum_dibaca',
      response_note TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_corr_disp_corr ON correspondence_dispositions(correspondence_id);
  `);
  addColumnIfMissing('documents', 'parent_document_id', 'TEXT');
  addColumnIfMissing('documents', 'replaced_by_id', 'TEXT');
  addColumnIfMissing('documents', 'program_id', 'TEXT');

  // Migration 9: Handover Snapshot Package & Location Reported vs Verified Separation
  addColumnIfMissing('handovers', 'package_json', 'TEXT');
  addColumnIfMissing('location_verifications', 'reported_location_text', 'TEXT');
  addColumnIfMissing('location_verifications', 'verified_location_proof', 'TEXT');

  // Migration 10: Maintenance Mode Default Settings
  const migNow = new Date().toISOString();
  db.prepare(
    "INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('maintenance_mode', 'false', ?)"
  ).run(migNow);
  db.prepare(
    "INSERT OR IGNORE INTO system_settings (key, value, updated_at) VALUES ('maintenance_message', 'Portal sedang menjalani pemeliharaan sistem terjadwal oleh Super Admin. Silakan coba kembali beberapa saat lagi.', ?)"
  ).run(migNow);

  // Enforce hard 24h ceiling on any pre-existing session_ttl_hours value
  const existingTtl = db
    .prepare("SELECT value FROM system_settings WHERE key = 'session_ttl_hours'")
    .get() as { value: string } | undefined;
  if (existingTtl) {
    const parsedTtl = Number(existingTtl.value);
    if (!Number.isFinite(parsedTtl) || parsedTtl > 24 || parsedTtl < 1) {
      const clamped = String(Math.max(1, Math.min(24, Number.isFinite(parsedTtl) ? Math.round(parsedTtl) : 24)));
      db.prepare("UPDATE system_settings SET value = ?, updated_at = ? WHERE key = 'session_ttl_hours'").run(
        clamped,
        migNow
      );
    }
  }

  // Migration 11: Global Error & Support Center (support_tickets)
  db.exec(`
    CREATE TABLE IF NOT EXISTS support_tickets (
      id TEXT PRIMARY KEY,
      ticket_number TEXT NOT NULL UNIQUE,
      user_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_role TEXT NOT NULL,
      province_code TEXT,
      page_path TEXT NOT NULL,
      module_name TEXT NOT NULL DEFAULT 'umum',
      category TEXT NOT NULL DEFAULT 'bug_fungsional',
      title TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      screenshot_file_id TEXT,
      screenshot_file_name TEXT,
      error_ref_code TEXT,
      priority TEXT NOT NULL DEFAULT 'sedang',
      status TEXT NOT NULL DEFAULT 'baru',
      assigned_to_id TEXT,
      assigned_to_name TEXT,
      admin_note TEXT NOT NULL DEFAULT '',
      resolution_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      resolved_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_support_tickets_user ON support_tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON support_tickets(status);
  `);

  // Migration 12: Idempotency Keys, Optimistic Concurrency Versions & Soft-Delete Recovery
  db.exec(`
    CREATE TABLE IF NOT EXISTS idempotency_keys (
      idem_key TEXT NOT NULL,
      user_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (idem_key, user_id, method, path)
    );
    CREATE INDEX IF NOT EXISTS idx_idem_created ON idempotency_keys(created_at);
  `);
  addColumnIfMissing('proposals', 'soft_deleted_at', 'TEXT');
  addColumnIfMissing('proposals', 'soft_deleted_by', 'TEXT');
  addColumnIfMissing('proposals', 'pre_delete_status', 'TEXT');
  addColumnIfMissing('lkl_reports', 'updated_at', 'TEXT');
  addColumnIfMissing('lkl_reports', 'soft_deleted_at', 'TEXT');
  addColumnIfMissing('tasks', 'version', 'INTEGER NOT NULL DEFAULT 1');
  addColumnIfMissing('tasks', 'updated_at', 'TEXT');
  addColumnIfMissing('tasks', 'soft_deleted_at', 'TEXT');

  // Migration 13: User Preferences & Accessibility Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS user_preferences (
      user_id TEXT PRIMARY KEY,
      start_page TEXT NOT NULL DEFAULT '/beranda',
      display_scale TEXT NOT NULL DEFAULT 'nyaman',
      favorite_paths_json TEXT NOT NULL DEFAULT '[]',
      notification_prefs_json TEXT NOT NULL DEFAULT '{"emailProposal":true,"emailTugas":true,"pengingatSesi":true}',
      tour_completed_roles_json TEXT NOT NULL DEFAULT '[]',
      updated_at TEXT NOT NULL
    );
  `);

  // Record schema migration versions cleanly (1..13)
  const migStmt = db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');
  migStmt.run(1, 'baseline_satu_dpbi_v4', migNow);
  migStmt.run(2, 'security_hardening_file_grants_and_24h_session_cap', migNow);
  migStmt.run(3, 'connected_workflow_linkage_and_email_center', migNow);
  migStmt.run(4, 'personnel_account_invitation_separation', migNow);
  migStmt.run(5, 'org_structure_and_programs', migNow);
  migStmt.run(6, 'approval_history_and_programs_sync', migNow);
  migStmt.run(7, 'email_18_templates_and_html', migNow);
  migStmt.run(8, 'correspondence_and_document_versioning', migNow);
  migStmt.run(9, 'handover_package_and_location_proof', migNow);
  migStmt.run(10, 'maintenance_and_versioning_settings', migNow);
  migStmt.run(11, 'support_tickets_and_error_center', migNow);
  migStmt.run(12, 'idempotency_optimistic_concurrency_and_soft_delete', migNow);
  migStmt.run(13, 'user_preferences_and_accessibility', migNow);
}

export function createWalSafeSqliteSnapshot(db: DatabaseSync, destFilePath: string): void {
  const escaped = destFilePath.replace(/'/g, "''");
  if (fs.existsSync(destFilePath)) {
    fs.unlinkSync(destFilePath);
  }
  db.exec(`VACUUM INTO '${escaped}';`);
}

export function cleanupSqliteSidecarFiles(dbPath: string): void {
  for (const suffix of ['-wal', '-shm']) {
    const sidecar = `${dbPath}${suffix}`;
    if (fs.existsSync(sidecar)) {
      fs.unlinkSync(sidecar);
    }
  }
}

export function nextReferenceNumber(
  db: DatabaseSync,
  category: 'PROP' | 'LKL' | 'LKW' | 'AKUN' | 'DOC' | 'TGS' | 'ADU' | 'INS' | 'PERS' | 'HND' | 'SURAT' | 'PROG' | 'TIKET',
  year: number = new Date().getFullYear()
): string {
  db.exec('SAVEPOINT next_ref_sp;');
  try {
    const existing = db
      .prepare('SELECT last_seq FROM reference_sequences WHERE category = ? AND year = ?')
      .get(category, year) as { last_seq: number } | undefined;
    const nextSeq = existing ? existing.last_seq + 1 : 1;
    if (existing) {
      db.prepare('UPDATE reference_sequences SET last_seq = ? WHERE category = ? AND year = ?').run(
        nextSeq,
        category,
        year
      );
    } else {
      db.prepare('INSERT INTO reference_sequences (category, year, last_seq) VALUES (?, ?, ?)').run(
        category,
        year,
        nextSeq
      );
    }
    db.exec('RELEASE SAVEPOINT next_ref_sp;');
    return `DPBI/${category}/${year}/${String(nextSeq).padStart(4, '0')}`;
  } catch (err) {
    db.exec('ROLLBACK TO SAVEPOINT next_ref_sp;');
    db.exec('RELEASE SAVEPOINT next_ref_sp;');
    throw err;
  }
}
