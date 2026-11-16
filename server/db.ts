import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export const IS_DEMO_MODE =
  process.env.DEMO_MODE === 'true' ||
  (process.env.DEMO_MODE === undefined && process.env.NODE_ENV !== 'production');

const DATA_DIR = path.resolve(process.cwd(), 'data');
export const PRIVATE_STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'private');
export const BACKUP_STORAGE_DIR = path.resolve(process.cwd(), 'storage', 'backups');

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
  `);

  // Safe idempotent column migrations for existing databases
  const personnelCols = db.prepare('PRAGMA table_info(personnel)').all() as { name: string }[];
  if (!personnelCols.some((c) => c.name === 'avatar_file_id')) {
    db.exec('ALTER TABLE personnel ADD COLUMN avatar_file_id TEXT;');
  }
  if (!personnelCols.some((c) => c.name === 'assignment_province_code')) {
    db.exec('ALTER TABLE personnel ADD COLUMN assignment_province_code TEXT;');
  }
  if (!personnelCols.some((c) => c.name === 'regency_code')) {
    db.exec('ALTER TABLE personnel ADD COLUMN regency_code TEXT;');
  }

  const userCols = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!userCols.some((c) => c.name === 'notification_prefs_json')) {
    db.exec("ALTER TABLE users ADD COLUMN notification_prefs_json TEXT DEFAULT '{}';");
  }

  const provCols = db.prepare('PRAGMA table_info(provinces)').all() as { name: string }[];
  if (!provCols.some((c) => c.name === 'logo_file_id')) {
    db.exec('ALTER TABLE provinces ADD COLUMN logo_file_id TEXT;');
  }
  if (!provCols.some((c) => c.name === 'description')) {
    db.exec('ALTER TABLE provinces ADD COLUMN description TEXT;');
  }

  const taskCols = db.prepare('PRAGMA table_info(tasks)').all() as { name: string }[];
  if (!taskCols.some((c) => c.name === 'attachment_file_id')) {
    db.exec('ALTER TABLE tasks ADD COLUMN attachment_file_id TEXT;');
  }
  if (!taskCols.some((c) => c.name === 'attachment_file_name')) {
    db.exec('ALTER TABLE tasks ADD COLUMN attachment_file_name TEXT;');
  }

  const annCols = db.prepare('PRAGMA table_info(announcements)').all() as { name: string }[];
  if (!annCols.some((c) => c.name === 'is_public')) {
    db.exec('ALTER TABLE announcements ADD COLUMN is_public INTEGER NOT NULL DEFAULT 0;');
  }
}

export function nextReferenceNumber(
  db: DatabaseSync,
  category: 'PROP' | 'LKL' | 'LKW' | 'AKUN' | 'DOC' | 'TGS' | 'ADU' | 'INS' | 'PERS' | 'HND',
  year: number = new Date().getFullYear()
): string {
  db.exec('BEGIN IMMEDIATE;');
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
    db.exec('COMMIT;');
    return `DPBI/${category}/${year}/${String(nextSeq).padStart(4, '0')}`;
  } catch (err) {
    db.exec('ROLLBACK;');
    throw err;
  }
}
