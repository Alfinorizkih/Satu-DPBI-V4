// server.ts
import "dotenv/config";
import fs5 from "node:fs";
import path5 from "node:path";
import express from "express";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";

// server/db.ts
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
var IS_DEMO_MODE = process.env.DEMO_MODE === "true" || process.env.DEMO_MODE === void 0 && process.env.NODE_ENV !== "production";
var DATA_DIR = path.resolve(process.cwd(), "data");
var PRIVATE_STORAGE_DIR = path.resolve(process.cwd(), "storage", "private");
var BACKUP_STORAGE_DIR = path.resolve(process.cwd(), "storage", "backups");
fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(PRIVATE_STORAGE_DIR, { recursive: true });
fs.mkdirSync(BACKUP_STORAGE_DIR, { recursive: true });
var DB_PATH = path.join(
  DATA_DIR,
  IS_DEMO_MODE ? "satu_dpbi_demo.db" : "satu_dpbi_prod.db"
);
var dbInstance = null;
function getDb() {
  if (!dbInstance) {
    dbInstance = new DatabaseSync(DB_PATH);
    dbInstance.exec("PRAGMA journal_mode = WAL;");
    dbInstance.exec("PRAGMA foreign_keys = ON;");
    initSchema(dbInstance);
  }
  return dbInstance;
}
function resetDbConnection() {
  if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
    }
    dbInstance = null;
  }
}
function initSchema(db) {
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
  `);
  const personnelCols = db.prepare("PRAGMA table_info(personnel)").all();
  if (!personnelCols.some((c) => c.name === "avatar_file_id")) {
    db.exec("ALTER TABLE personnel ADD COLUMN avatar_file_id TEXT;");
  }
  const userCols = db.prepare("PRAGMA table_info(users)").all();
  if (!userCols.some((c) => c.name === "notification_prefs_json")) {
    db.exec("ALTER TABLE users ADD COLUMN notification_prefs_json TEXT DEFAULT '{}';");
  }
}
function nextReferenceNumber(db, category, year = (/* @__PURE__ */ new Date()).getFullYear()) {
  db.exec("BEGIN IMMEDIATE;");
  try {
    const existing = db.prepare("SELECT last_seq FROM reference_sequences WHERE category = ? AND year = ?").get(category, year);
    const nextSeq = existing ? existing.last_seq + 1 : 1;
    if (existing) {
      db.prepare("UPDATE reference_sequences SET last_seq = ? WHERE category = ? AND year = ?").run(
        nextSeq,
        category,
        year
      );
    } else {
      db.prepare("INSERT INTO reference_sequences (category, year, last_seq) VALUES (?, ?, ?)").run(
        category,
        year,
        nextSeq
      );
    }
    db.exec("COMMIT;");
    return `DPBI/${category}/${year}/${String(nextSeq).padStart(4, "0")}`;
  } catch (err) {
    db.exec("ROLLBACK;");
    throw err;
  }
}

// server/seed.ts
import crypto2 from "node:crypto";
import fs2 from "node:fs";
import path2 from "node:path";

// src/lib/provinces.ts
var INDONESIA_PROVINCES = [
  {
    code: "11",
    name: "Aceh",
    island: "Sumatra",
    minLat: 2,
    maxLat: 6.1,
    minLng: 95,
    maxLng: 98.3,
    centerLat: 4.6951,
    centerLng: 96.7494,
    svgPath: "M32,46 L68,40 L86,58 L72,82 L44,72 Z",
    labelX: 58,
    labelY: 61
  },
  {
    code: "12",
    name: "Sumatera Utara",
    island: "Sumatra",
    minLat: 0.5,
    maxLat: 4.2,
    minLng: 97.5,
    maxLng: 100.5,
    centerLat: 2.1154,
    centerLng: 99.5451,
    svgPath: "M72,82 L86,58 L118,86 L108,118 L82,110 Z",
    labelX: 95,
    labelY: 92
  },
  {
    code: "13",
    name: "Sumatera Barat",
    island: "Sumatra",
    minLat: -3.5,
    maxLat: 0.9,
    minLng: 98.5,
    maxLng: 101.8,
    centerLat: -0.7399,
    centerLng: 100.8,
    svgPath: "M82,110 L108,118 L120,152 L96,158 L78,136 Z",
    labelX: 98,
    labelY: 136
  },
  {
    code: "14",
    name: "Riau",
    island: "Sumatra",
    minLat: -1.1,
    maxLat: 2.6,
    minLng: 100,
    maxLng: 103.8,
    centerLat: 0.2933,
    centerLng: 101.7068,
    svgPath: "M108,118 L142,108 L156,142 L120,152 Z",
    labelX: 131,
    labelY: 131
  },
  {
    code: "21",
    name: "Kepulauan Riau",
    island: "Sumatra",
    minLat: -0.9,
    maxLat: 4.8,
    minLng: 103.2,
    maxLng: 109.2,
    centerLat: 3.9456,
    centerLng: 108.1429,
    svgPath: "M164,104 L188,100 L194,124 L168,128 Z",
    labelX: 179,
    labelY: 114
  },
  {
    code: "15",
    name: "Jambi",
    island: "Sumatra",
    minLat: -2.8,
    maxLat: -0.7,
    minLng: 101.1,
    maxLng: 104.5,
    centerLat: -1.6101,
    centerLng: 103.6131,
    svgPath: "M120,152 L156,142 L166,174 L132,182 Z",
    labelX: 144,
    labelY: 163
  },
  {
    code: "17",
    name: "Bengkulu",
    island: "Sumatra",
    minLat: -5.4,
    maxLat: -2.2,
    minLng: 101,
    maxLng: 103.8,
    centerLat: -3.7928,
    centerLng: 102.2608,
    svgPath: "M96,158 L120,152 L132,182 L140,214 L118,214 Z",
    labelX: 118,
    labelY: 185
  },
  {
    code: "16",
    name: "Sumatera Selatan",
    island: "Sumatra",
    minLat: -4.9,
    maxLat: -1.6,
    minLng: 102,
    maxLng: 106.2,
    centerLat: -3.3194,
    centerLng: 103.9144,
    svgPath: "M132,182 L176,176 L186,210 L140,214 Z",
    labelX: 158,
    labelY: 196
  },
  {
    code: "19",
    name: "Kepulauan Bangka Belitung",
    island: "Sumatra",
    minLat: -3.4,
    maxLat: -1.4,
    minLng: 105.1,
    maxLng: 108.4,
    centerLat: -2.7411,
    centerLng: 106.4406,
    svgPath: "M186,162 L212,158 L216,184 L190,188 Z",
    labelX: 201,
    labelY: 173
  },
  {
    code: "18",
    name: "Lampung",
    island: "Sumatra",
    minLat: -6.1,
    maxLat: -3.7,
    minLng: 103.5,
    maxLng: 106,
    centerLat: -4.5586,
    centerLng: 105.4068,
    svgPath: "M140,214 L186,210 L192,248 L156,252 Z",
    labelX: 168,
    labelY: 231
  },
  {
    code: "36",
    name: "Banten",
    island: "Jawa",
    minLat: -7.1,
    maxLat: -5.8,
    minLng: 105.1,
    maxLng: 106.8,
    centerLat: -6.4058,
    centerLng: 106.064,
    svgPath: "M198,258 L226,256 L228,284 L196,284 Z",
    labelX: 212,
    labelY: 270
  },
  {
    code: "31",
    name: "DKI Jakarta",
    island: "Jawa",
    minLat: -6.4,
    maxLat: -5.9,
    minLng: 106.6,
    maxLng: 107,
    centerLat: -6.2088,
    centerLng: 106.8456,
    svgPath: "M226,254 L242,254 L242,268 L226,268 Z",
    labelX: 234,
    labelY: 261
  },
  {
    code: "32",
    name: "Jawa Barat",
    island: "Jawa",
    minLat: -7.9,
    maxLat: -5.9,
    minLng: 106.3,
    maxLng: 108.9,
    centerLat: -7.0909,
    centerLng: 107.6689,
    svgPath: "M228,268 L268,264 L274,296 L228,294 Z",
    labelX: 250,
    labelY: 280
  },
  {
    code: "33",
    name: "Jawa Tengah",
    island: "Jawa",
    minLat: -8.3,
    maxLat: -6.4,
    minLng: 108.5,
    maxLng: 111.7,
    centerLat: -7.151,
    centerLng: 110.1403,
    svgPath: "M268,264 L318,266 L316,298 L274,296 Z",
    labelX: 294,
    labelY: 281
  },
  {
    code: "34",
    name: "DI Yogyakarta",
    island: "Jawa",
    minLat: -8.2,
    maxLat: -7.5,
    minLng: 110,
    maxLng: 110.8,
    centerLat: -7.8754,
    centerLng: 110.4262,
    svgPath: "M286,298 L308,298 L308,312 L286,312 Z",
    labelX: 297,
    labelY: 305
  },
  {
    code: "35",
    name: "Jawa Timur",
    island: "Jawa",
    minLat: -8.8,
    maxLat: -6.7,
    minLng: 111,
    maxLng: 114.7,
    centerLat: -7.5361,
    centerLng: 112.2384,
    svgPath: "M318,266 L378,274 L376,308 L316,298 Z",
    labelX: 347,
    labelY: 286
  },
  {
    code: "51",
    name: "Bali",
    island: "Bali & Nusa Tenggara",
    minLat: -8.9,
    maxLat: -8,
    minLng: 114.4,
    maxLng: 115.7,
    centerLat: -8.4095,
    centerLng: 115.1889,
    svgPath: "M384,292 L412,292 L410,312 L382,312 Z",
    labelX: 397,
    labelY: 302
  },
  {
    code: "52",
    name: "Nusa Tenggara Barat",
    island: "Bali & Nusa Tenggara",
    minLat: -9.1,
    maxLat: -8.1,
    minLng: 115.8,
    maxLng: 119.2,
    centerLat: -8.6529,
    centerLng: 117.3616,
    svgPath: "M418,292 L464,294 L462,316 L416,314 Z",
    labelX: 440,
    labelY: 304
  },
  {
    code: "53",
    name: "Nusa Tenggara Timur",
    island: "Bali & Nusa Tenggara",
    minLat: -11.1,
    maxLat: -8,
    minLng: 118.9,
    maxLng: 125.2,
    centerLat: -8.6574,
    centerLng: 121.0794,
    svgPath: "M470,296 L562,298 L556,334 L468,324 Z",
    labelX: 515,
    labelY: 313
  },
  {
    code: "61",
    name: "Kalimantan Barat",
    island: "Kalimantan",
    minLat: -3.1,
    maxLat: 2.1,
    minLng: 108.6,
    maxLng: 114.2,
    centerLat: -0.2788,
    centerLng: 111.4753,
    svgPath: "M252,118 L310,116 L312,184 L256,184 Z",
    labelX: 282,
    labelY: 150
  },
  {
    code: "62",
    name: "Kalimantan Tengah",
    island: "Kalimantan",
    minLat: -3.6,
    maxLat: 0.8,
    minLng: 110.7,
    maxLng: 115.9,
    centerLat: -1.6815,
    centerLng: 113.3824,
    svgPath: "M312,148 L364,148 L364,206 L306,204 Z",
    labelX: 336,
    labelY: 176
  },
  {
    code: "63",
    name: "Kalimantan Selatan",
    island: "Kalimantan",
    minLat: -4.2,
    maxLat: -1.3,
    minLng: 114.3,
    maxLng: 116.6,
    centerLat: -3.0926,
    centerLng: 115.2838,
    svgPath: "M364,174 L394,176 L392,216 L362,212 Z",
    labelX: 378,
    labelY: 194
  },
  {
    code: "64",
    name: "Kalimantan Timur",
    island: "Kalimantan",
    minLat: -2.4,
    maxLat: 2.6,
    minLng: 113.8,
    maxLng: 119,
    centerLat: 0.5387,
    centerLng: 116.4194,
    svgPath: "M356,102 L412,102 L408,174 L364,174 L356,148 Z",
    labelX: 384,
    labelY: 136
  },
  {
    code: "65",
    name: "Kalimantan Utara",
    island: "Kalimantan",
    minLat: 1.1,
    maxLat: 4.4,
    minLng: 114.5,
    maxLng: 117.9,
    centerLat: 3.0731,
    centerLng: 116.0414,
    svgPath: "M356,66 L408,68 L412,102 L356,102 Z",
    labelX: 383,
    labelY: 84
  },
  {
    code: "71",
    name: "Sulawesi Utara",
    island: "Sulawesi",
    minLat: 0.3,
    maxLat: 4.8,
    minLng: 123.1,
    maxLng: 127.2,
    centerLat: 0.6247,
    centerLng: 123.975,
    svgPath: "M518,108 L572,102 L572,126 L518,132 Z",
    labelX: 545,
    labelY: 117
  },
  {
    code: "75",
    name: "Gorontalo",
    island: "Sulawesi",
    minLat: 0.3,
    maxLat: 1.1,
    minLng: 121.1,
    maxLng: 123.6,
    centerLat: 0.6999,
    centerLng: 122.4467,
    svgPath: "M482,116 L518,108 L518,132 L482,136 Z",
    labelX: 500,
    labelY: 123
  },
  {
    code: "72",
    name: "Sulawesi Tengah",
    island: "Sulawesi",
    minLat: -3.6,
    maxLat: 1.4,
    minLng: 119.4,
    maxLng: 124.2,
    centerLat: -1.43,
    centerLng: 121.4456,
    svgPath: "M460,136 L514,136 L512,178 L460,174 Z",
    labelX: 486,
    labelY: 156
  },
  {
    code: "76",
    name: "Sulawesi Barat",
    island: "Sulawesi",
    minLat: -3.6,
    maxLat: -0.9,
    minLng: 118.7,
    maxLng: 119.9,
    centerLat: -2.8441,
    centerLng: 119.2321,
    svgPath: "M442,164 L464,164 L464,202 L442,202 Z",
    labelX: 453,
    labelY: 183
  },
  {
    code: "73",
    name: "Sulawesi Selatan",
    island: "Sulawesi",
    minLat: -7.5,
    maxLat: -1.9,
    minLng: 118.7,
    maxLng: 121.8,
    centerLat: -3.6688,
    centerLng: 119.9741,
    svgPath: "M454,196 L486,196 L486,252 L454,248 Z",
    labelX: 470,
    labelY: 223
  },
  {
    code: "74",
    name: "Sulawesi Tenggara",
    island: "Sulawesi",
    minLat: -5.8,
    maxLat: -2.8,
    minLng: 120.9,
    maxLng: 124.6,
    centerLat: -4.1449,
    centerLng: 122.1746,
    svgPath: "M486,184 L526,184 L524,240 L486,236 Z",
    labelX: 506,
    labelY: 211
  },
  {
    code: "82",
    name: "Maluku Utara",
    island: "Maluku",
    minLat: -2.4,
    maxLat: 2.6,
    minLng: 124.3,
    maxLng: 129.6,
    centerLat: 1.571,
    centerLng: 127.8088,
    svgPath: "M606,116 L650,116 L646,166 L604,164 Z",
    labelX: 626,
    labelY: 140
  },
  {
    code: "81",
    name: "Maluku",
    island: "Maluku",
    minLat: -8.4,
    maxLat: -2.7,
    minLng: 125.7,
    maxLng: 134.9,
    centerLat: -3.2385,
    centerLng: 130.1453,
    svgPath: "M604,186 L670,186 L666,240 L602,238 Z",
    labelX: 635,
    labelY: 212
  },
  {
    code: "96",
    name: "Papua Barat Daya",
    island: "Papua",
    minLat: -2.2,
    maxLat: 0.6,
    minLng: 129.6,
    maxLng: 133.2,
    centerLat: -0.95,
    centerLng: 131.5,
    svgPath: "M700,144 L744,142 L742,174 L698,176 Z",
    labelX: 721,
    labelY: 159
  },
  {
    code: "92",
    name: "Papua Barat",
    island: "Papua",
    minLat: -4.4,
    maxLat: -1.1,
    minLng: 132,
    maxLng: 135.2,
    centerLat: -1.3361,
    centerLng: 133.1747,
    svgPath: "M744,148 L788,152 L784,192 L742,188 Z",
    labelX: 765,
    labelY: 170
  },
  {
    code: "94",
    name: "Papua Tengah",
    island: "Papua",
    minLat: -5.3,
    maxLat: -2.3,
    minLng: 134.8,
    maxLng: 138.2,
    centerLat: -3.65,
    centerLng: 136.5,
    svgPath: "M788,184 L842,184 L838,226 L784,224 Z",
    labelX: 813,
    labelY: 205
  },
  {
    code: "91",
    name: "Papua",
    island: "Papua",
    minLat: -3.9,
    maxLat: -1,
    minLng: 135.4,
    maxLng: 141,
    centerLat: -2.5337,
    centerLng: 140.7181,
    svgPath: "M814,142 L912,146 L908,186 L812,184 Z",
    labelX: 861,
    labelY: 164
  },
  {
    code: "95",
    name: "Papua Pegunungan",
    island: "Papua",
    minLat: -5.2,
    maxLat: -3.2,
    minLng: 138,
    maxLng: 141,
    centerLat: -4.08,
    centerLng: 139.2,
    svgPath: "M842,186 L910,186 L908,232 L840,228 Z",
    labelX: 875,
    labelY: 208
  },
  {
    code: "93",
    name: "Papua Selatan",
    island: "Papua",
    minLat: -9.1,
    maxLat: -4.9,
    minLng: 137.4,
    maxLng: 141,
    centerLat: -7.5,
    centerLng: 139.7,
    svgPath: "M832,230 L908,232 L904,296 L830,282 Z",
    labelX: 868,
    labelY: 260
  }
];
var PROVINCE_BY_CODE = new Map(INDONESIA_PROVINCES.map((p) => [p.code, p]));

// server/security.ts
import crypto from "node:crypto";

// src/lib/rbac.ts
var ROLE_LABELS = {
  super_admin: "Super Admin",
  wakil_super_admin: "Wakil Super Admin",
  penanggung_jawab: "Penanggung Jawab Organisasi",
  pengurus_nasional: "Pengurus Nasional",
  sekretariat_nasional: "Sekretariat Nasional",
  koordinator_wilayah: "Koordinator Wilayah",
  duta: "Duta",
  alumni: "Alumni"
};
var ALL_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "reject",
  "review",
  "download",
  "export",
  "assign",
  "manage",
  "publish",
  "archive",
  "restore",
  "configure"
];
var BASE_ROLE_PERMISSIONS = {
  super_admin: {
    dashboard: ALL_ACTIONS,
    command_center: ALL_ACTIONS,
    organisasi: ALL_ACTIONS,
    personalia: ALL_ACTIONS,
    wilayah: ALL_ACTIONS,
    angkatan: ALL_ACTIONS,
    proposal: ALL_ACTIONS,
    lkl: ALL_ACTIONS,
    laporan_koordinator: ALL_ACTIONS,
    tugas: ALL_ACTIONS,
    dokumen: ALL_ACTIONS,
    pengumuman: ALL_ACTIONS,
    kalender: ALL_ACTIONS,
    perlindungan: ALL_ACTIONS,
    evaluasi: ALL_ACTIONS,
    arsip: ALL_ACTIONS,
    sistem: ALL_ACTIONS,
    pengaturan: ALL_ACTIONS
  },
  wakil_super_admin: {
    dashboard: ["view", "export"],
    command_center: ["view", "review", "export"],
    organisasi: ["view", "review", "assign"],
    personalia: ["view", "review", "export"],
    wilayah: ["view", "review", "export"],
    angkatan: ["view", "review"],
    proposal: ["view", "review", "approve", "reject"],
    lkl: ["view", "review"],
    laporan_koordinator: ["view", "review"],
    tugas: ["view", "create", "edit", "assign"],
    dokumen: ["view", "download", "publish"],
    pengumuman: ["view", "create", "publish"],
    kalender: ["view", "create", "edit"],
    perlindungan: ["view", "review"],
    evaluasi: ["view", "review", "export"],
    arsip: ["view", "download"],
    pengaturan: ["view"]
  },
  penanggung_jawab: {
    dashboard: ["view", "export"],
    command_center: ["view"],
    organisasi: ["view"],
    personalia: ["view"],
    wilayah: ["view"],
    angkatan: ["view"],
    proposal: ["view", "review"],
    lkl: ["view", "review"],
    laporan_koordinator: ["view", "review"],
    tugas: ["view"],
    dokumen: ["view", "download"],
    pengumuman: ["view"],
    kalender: ["view"],
    perlindungan: ["view", "review", "manage"],
    evaluasi: ["view", "review", "export"],
    arsip: ["view", "download"],
    pengaturan: ["view"]
  },
  pengurus_nasional: {
    dashboard: ["view", "export"],
    command_center: ["view"],
    organisasi: ["view"],
    personalia: ["view"],
    wilayah: ["view"],
    angkatan: ["view", "create", "edit"],
    proposal: ["view", "review", "approve", "reject"],
    lkl: ["view", "review"],
    laporan_koordinator: ["view", "review"],
    tugas: ["view", "create", "edit", "assign"],
    dokumen: ["view", "create", "download", "publish"],
    pengumuman: ["view", "create", "publish"],
    kalender: ["view", "create", "edit"],
    perlindungan: ["view", "review"],
    evaluasi: ["view", "create", "review"],
    arsip: ["view", "download"],
    pengaturan: ["view"]
  },
  sekretariat_nasional: {
    dashboard: ["view", "export"],
    organisasi: ["view", "create", "edit"],
    personalia: ["view", "create", "edit", "review", "export"],
    wilayah: ["view", "edit"],
    angkatan: ["view", "create", "edit"],
    proposal: ["view", "review"],
    lkl: ["view"],
    laporan_koordinator: ["view", "review"],
    tugas: ["view", "create", "edit", "assign"],
    dokumen: ["view", "create", "edit", "download", "publish", "archive"],
    pengumuman: ["view", "create", "publish"],
    kalender: ["view", "create", "edit"],
    perlindungan: ["view", "create"],
    evaluasi: ["view"],
    arsip: ["view", "create", "download", "archive"],
    pengaturan: ["view"]
  },
  koordinator_wilayah: {
    dashboard: ["view"],
    personalia: ["view", "create", "edit", "review"],
    wilayah: ["view", "edit"],
    angkatan: ["view"],
    proposal: ["view", "create", "edit", "review"],
    lkl: ["view", "review", "approve", "reject"],
    laporan_koordinator: ["view", "create", "edit"],
    tugas: ["view", "create", "edit", "assign"],
    dokumen: ["view", "download"],
    pengumuman: ["view", "create"],
    kalender: ["view", "create", "edit"],
    perlindungan: ["view", "create"],
    evaluasi: ["view", "create"],
    arsip: ["view", "download"],
    pengaturan: ["view"]
  },
  duta: {
    dashboard: ["view"],
    personalia: ["view", "edit"],
    angkatan: ["view"],
    proposal: ["view", "create", "edit"],
    lkl: ["view", "create", "edit"],
    tugas: ["view", "edit"],
    dokumen: ["view", "download"],
    pengumuman: ["view"],
    kalender: ["view"],
    perlindungan: ["view", "create"],
    evaluasi: ["view"],
    arsip: ["view", "download"],
    pengaturan: ["view"]
  },
  alumni: {
    dashboard: ["view"],
    dokumen: ["view", "download"],
    arsip: ["view", "download", "export"],
    pengaturan: ["view"]
  }
};
function resolveEffectivePermissions(role, delegations = [], nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const base = BASE_ROLE_PERMISSIONS[role] ?? {};
  const result = {};
  const modules = [
    "dashboard",
    "command_center",
    "organisasi",
    "personalia",
    "wilayah",
    "angkatan",
    "proposal",
    "lkl",
    "laporan_koordinator",
    "tugas",
    "dokumen",
    "pengumuman",
    "kalender",
    "perlindungan",
    "evaluasi",
    "arsip",
    "sistem",
    "pengaturan"
  ];
  for (const mod of modules) {
    result[mod] = [...base[mod] ?? []];
  }
  const nowMs = Date.parse(nowIso);
  for (const del of delegations) {
    if (del.status !== "aktif") continue;
    const startMs = Date.parse(del.startsAt);
    const endMs = Date.parse(del.endsAt);
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
    if (nowMs < startMs || nowMs > endMs) continue;
    if (!result[del.module].includes(del.action)) {
      result[del.module].push(del.action);
    }
  }
  return result;
}
function hasPermission(permissions, module, action) {
  const list = permissions[module];
  if (!list) return false;
  return list.includes(action);
}
function resolveProposalApprover(input) {
  if (input.riskLevel === "tinggi" || input.externalPermitNeeded) {
    return {
      approverRole: "pengurus_nasional",
      stageLabel: "Persetujuan Pengurus Nasional (Bidang & Kepatuhan Risiko)"
    };
  }
  if (input.usesDpbiIdentity || input.category.toLowerCase().includes("nasional")) {
    return {
      approverRole: "pengurus_nasional",
      stageLabel: "Persetujuan Pengurus Nasional Sesuai Bidang"
    };
  }
  return {
    approverRole: "koordinator_wilayah",
    stageLabel: "Pemeriksaan & Persetujuan Koordinator Wilayah"
  };
}
function calculateAlumniWindow(termEndsAtIso, nowIso = (/* @__PURE__ */ new Date()).toISOString()) {
  const endMs = Date.parse(termEndsAtIso);
  const windowDays = 30;
  const expiresMs = endMs + windowDays * 24 * 60 * 60 * 1e3;
  const nowMs = Date.parse(nowIso);
  const diffDays = Math.ceil((expiresMs - nowMs) / (24 * 60 * 60 * 1e3));
  if (nowMs > expiresMs) {
    return {
      inWindow: false,
      expired: true,
      daysRemaining: 0,
      expiresAtIso: new Date(expiresMs).toISOString(),
      reminderStage: "berakhir"
    };
  }
  let reminderStage = "none";
  if (diffDays <= 1) reminderStage = "hari_terakhir";
  else if (diffDays <= 3) reminderStage = "h_minus_3";
  else if (diffDays <= 7) reminderStage = "h_minus_7";
  return {
    inWindow: nowMs >= endMs && nowMs <= expiresMs,
    expired: false,
    daysRemaining: Math.max(0, diffDays),
    expiresAtIso: new Date(expiresMs).toISOString(),
    reminderStage
  };
}
function verifyCoordinateInProvince(lat, lng, provinceCode) {
  const prov = PROVINCE_BY_CODE.get(provinceCode);
  if (!prov) {
    return {
      matched: false,
      provinceName: "Wilayah Tidak Dikenal",
      distanceKmFromCenter: 9999,
      reason: "Kode provinsi tidak terdaftar pada data referensi 38 provinsi."
    };
  }
  const tol = 0.25;
  const inBox = lat >= prov.minLat - tol && lat <= prov.maxLat + tol && lng >= prov.minLng - tol && lng <= prov.maxLng + tol;
  const dLat = (lat - prov.centerLat) * 111;
  const dLng = (lng - prov.centerLng) * 111 * Math.cos(prov.centerLat * Math.PI / 180);
  const distanceKmFromCenter = Math.round(Math.sqrt(dLat * dLat + dLng * dLng));
  return {
    matched: inBox,
    provinceName: prov.name,
    distanceKmFromCenter,
    reason: inBox ? `Koordinat terkonfirmasi berada dalam cakupan wilayah ${prov.name}.` : `Koordinat berada di luar batas referensi ${prov.name} (jarak ~${distanceKmFromCenter} km dari titik tengah provinsi).`
  };
}
function calculateProfileCompleteness(p) {
  const checks = [
    ["Nama Lengkap", Boolean(p.fullName?.trim())],
    ["Tempat & Tanggal Lahir", Boolean(p.birthPlace?.trim() && p.birthDate?.trim())],
    ["Email & Nomor Telepon", Boolean(p.email?.trim() && p.phone?.trim())],
    ["Alamat Domisili Lengkap", Boolean(p.provinceCode && p.regency && p.fullAddress)],
    ["Identitas Sekolah & Jenjang", Boolean(p.schoolName && p.educationLevel && p.gradeClass)],
    ["Kontak Orang Tua/Wali", Boolean(p.guardianName && p.guardianPhone)],
    ["Pas Foto Resmi", Boolean(p.docsChecklist?.pasFoto)],
    ["Kartu Pelajar / Bukti Status", Boolean(p.docsChecklist?.kartuPelajar)],
    ["Surat Rekomendasi Sekolah", Boolean(p.docsChecklist?.suratSekolah)],
    ["Surat Izin Orang Tua/Wali", Boolean(p.docsChecklist?.izinWali)]
  ];
  const missingFields = checks.filter(([, ok]) => !ok).map(([label]) => label);
  const completed = checks.length - missingFields.length;
  return {
    score: Math.round(completed / checks.length * 100),
    missingFields
  };
}

// server/security.ts
var SESSION_COOKIE_NAME = IS_DEMO_MODE ? "satu_dpbi_demo_sid" : "satu_dpbi_sid";
var LOGIN_ATTEMPTS = /* @__PURE__ */ new Map();
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}
function verifyPassword(password, storedHash) {
  const [salt, key] = storedHash.split(":");
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const storedBuf = Buffer.from(key, "hex");
  if (derived.length !== storedBuf.length) return false;
  return crypto.timingSafeEqual(derived, storedBuf);
}
function sha256(input) {
  return crypto.createHash("sha256").update(input).digest("hex");
}
function checkLoginThrottle(key) {
  const rec = LOGIN_ATTEMPTS.get(key);
  if (!rec) return { allowed: true, retryAfterSec: 0 };
  const now = Date.now();
  if (rec.lockedUntil > now) {
    return { allowed: false, retryAfterSec: Math.ceil((rec.lockedUntil - now) / 1e3) };
  }
  if (now - rec.lockedUntil > 5 * 60 * 1e3) {
    LOGIN_ATTEMPTS.delete(key);
  }
  return { allowed: true, retryAfterSec: 0 };
}
function recordLoginFailure(key) {
  const rec = LOGIN_ATTEMPTS.get(key) ?? { count: 0, lockedUntil: 0 };
  rec.count += 1;
  if (rec.count >= 5) {
    rec.lockedUntil = Date.now() + Math.min(15 * 60 * 1e3, rec.count * 30 * 1e3);
  }
  LOGIN_ATTEMPTS.set(key, rec);
}
function clearLoginFailures(key) {
  LOGIN_ATTEMPTS.delete(key);
}
function getSessionPolicy(db) {
  const rows = db.prepare("SELECT key, value FROM system_settings WHERE key IN ('session_ttl_hours', 'idle_timeout_minutes')").all();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const ttlHours = Math.max(1, Math.min(168, Number(map.get("session_ttl_hours") ?? 24) || 24));
  const idleMinutes = Math.max(5, Math.min(480, Number(map.get("idle_timeout_minutes") ?? 45) || 45));
  return { ttlHours, idleMinutes };
}
function createSession(db, userId, deviceLabel, ipAddress) {
  const { ttlHours } = getSessionPolicy(db);
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const sessionId = crypto.randomUUID();
  const now = /* @__PURE__ */ new Date();
  const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1e3).toISOString();
  db.prepare(
    `INSERT INTO sessions (id, user_id, token_hash, device_label, ip_address, expires_at, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(sessionId, userId, tokenHash, deviceLabel, ipAddress, expiresAt, now.toISOString(), now.toISOString());
  return { rawToken, sessionId, expiresAt };
}
function rotateSession(db, oldSessionId, userId, deviceLabel, ipAddress) {
  if (oldSessionId) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(oldSessionId);
  }
  return createSession(db, userId, deviceLabel, ipAddress);
}
function setSessionCookie(res, rawToken, maxAgeMs = 24 * 60 * 60 * 1e3) {
  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIE !== "true",
    path: "/",
    maxAge: maxAgeMs
  });
}
function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: "/" });
}
function getSessionTokenFromReq(req) {
  const fromCookie = req.cookies?.[SESSION_COOKIE_NAME];
  if (typeof fromCookie === "string" && fromCookie.length >= 32) {
    return fromCookie;
  }
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7).trim();
  }
  return null;
}
function hydrateAuthUser(db, userRow) {
  const role = userRow.role;
  const userId = String(userRow.id);
  const delegationsRows = db.prepare(
    `SELECT id, delegate_user_id, delegate_name, grantor_user_id, grantor_name,
              module, action, province_code, starts_at, ends_at, reason, status
       FROM delegations
       WHERE delegate_user_id = ? AND status = 'aktif'`
  ).all(userId);
  const activeDelegations = delegationsRows.map((d) => ({
    id: String(d.id),
    delegateUserId: String(d.delegate_user_id),
    delegateName: String(d.delegate_name),
    grantorUserId: String(d.grantor_user_id),
    grantorName: String(d.grantor_name),
    module: d.module,
    action: d.action,
    provinceCode: d.province_code ? String(d.province_code) : null,
    startsAt: String(d.starts_at),
    endsAt: String(d.ends_at),
    reason: String(d.reason),
    status: d.status
  }));
  const provCode = userRow.province_code ? String(userRow.province_code) : null;
  const provName = provCode ? PROVINCE_BY_CODE.get(provCode)?.name ?? provCode : null;
  return {
    id: userId,
    email: String(userRow.email),
    fullName: String(userRow.full_name),
    role,
    roleLabel: ROLE_LABELS[role] ?? role,
    bidang: userRow.bidang ? String(userRow.bidang) : null,
    provinceCode: provCode,
    provinceName: provName,
    batchId: userRow.batch_id ? String(userRow.batch_id) : null,
    personnelId: userRow.personnel_id ? String(userRow.personnel_id) : null,
    accountStatus: userRow.account_status,
    alumniAccessExpiresAt: userRow.alumni_access_expires_at ? String(userRow.alumni_access_expires_at) : null,
    permissions: resolveEffectivePermissions(role, activeDelegations),
    activeDelegations
  };
}
function resolveOptionalAuth(req, res) {
  const token = getSessionTokenFromReq(req);
  if (!token) return null;
  const db = getDb();
  const tokenHash = sha256(token);
  const row = db.prepare(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
  ).get(tokenHash);
  if (!row) {
    clearSessionCookie(res);
    return { user: null, expiredReason: "expired" };
  }
  const { idleMinutes } = getSessionPolicy(db);
  const nowMs = Date.now();
  const expiresAtStr = String(row.expires_at);
  const lastSeenMs = Date.parse(String(row.last_seen_at || row.created_at));
  if (Date.parse(expiresAtStr) < nowMs) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(String(row.session_id));
    clearSessionCookie(res);
    return { user: null, expiredReason: "expired" };
  }
  if (Number.isFinite(lastSeenMs) && nowMs - lastSeenMs > idleMinutes * 60 * 1e3) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(String(row.session_id));
    clearSessionCookie(res);
    return { user: null, expiredReason: "idle" };
  }
  if (row.account_status === "menunggu_persetujuan") {
    return { user: null, expiredReason: "pending" };
  }
  if (row.account_status === "nonaktif" || row.account_status === "terkunci") {
    clearSessionCookie(res);
    return { user: null, expiredReason: "inactive" };
  }
  if (row.role === "alumni" && row.alumni_access_expires_at) {
    if (Date.parse(String(row.alumni_access_expires_at)) < nowMs) {
      return { user: null, expiredReason: "inactive" };
    }
  }
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(
    (/* @__PURE__ */ new Date()).toISOString(),
    String(row.session_id)
  );
  return {
    sessionId: String(row.session_id),
    expiresAt: expiresAtStr,
    idleMinutes,
    user: hydrateAuthUser(db, row)
  };
}
function requireAuth(req, res, next) {
  const token = getSessionTokenFromReq(req);
  if (!token) {
    res.status(401).json({ error: "Sesi tidak ditemukan. Silakan masuk terlebih dahulu.", code: 401 });
    return;
  }
  const db = getDb();
  const tokenHash = sha256(token);
  const row = db.prepare(
    `SELECT s.id AS session_id, s.expires_at, s.last_seen_at, u.*
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = ?`
  ).get(tokenHash);
  if (!row) {
    clearSessionCookie(res);
    res.status(419).json({ error: "Sesi Anda tidak valid atau telah dicabut. Silakan masuk kembali.", code: 419 });
    return;
  }
  const { idleMinutes } = getSessionPolicy(db);
  const nowMs = Date.now();
  const lastSeenMs = Date.parse(String(row.last_seen_at || row.created_at));
  if (Date.parse(String(row.expires_at)) < nowMs) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(String(row.session_id));
    clearSessionCookie(res);
    res.status(419).json({ error: "Sesi Anda telah kedaluwarsa. Silakan masuk kembali.", code: 419 });
    return;
  }
  if (Number.isFinite(lastSeenMs) && nowMs - lastSeenMs > idleMinutes * 60 * 1e3) {
    db.prepare("DELETE FROM sessions WHERE id = ?").run(String(row.session_id));
    clearSessionCookie(res);
    res.status(419).json({ error: "Sesi diakhiri otomatis karena tidak ada aktivitas sesuai kebijakan keamanan.", code: 419 });
    return;
  }
  if (row.account_status === "menunggu_persetujuan") {
    res.status(403).json({ error: "Akun Anda masih menunggu persetujuan Sekretariat Nasional.", code: 403, accountStatus: "menunggu_persetujuan" });
    return;
  }
  if (row.account_status === "nonaktif" || row.account_status === "terkunci") {
    clearSessionCookie(res);
    res.status(403).json({ error: "Akun dinonaktifkan atau terkunci oleh administrator.", code: 403 });
    return;
  }
  if (row.role === "alumni" && row.alumni_access_expires_at) {
    if (Date.parse(String(row.alumni_access_expires_at)) < nowMs) {
      res.status(403).json({
        error: "Masa akses arsip Alumni 30 hari telah berakhir. Hubungi Sekretariat Nasional untuk perpanjangan resmi.",
        code: 403
      });
      return;
    }
  }
  db.prepare("UPDATE sessions SET last_seen_at = ? WHERE id = ?").run(
    (/* @__PURE__ */ new Date()).toISOString(),
    String(row.session_id)
  );
  req.sessionId = String(row.session_id);
  req.authUser = hydrateAuthUser(db, row);
  next();
}
function requireSafeOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    next();
    return;
  }
  const xRequestedWith = req.headers["x-requested-with"];
  if (xRequestedWith === "SATU-DPBI") {
    next();
    return;
  }
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const host = req.headers.host;
  if (origin && host) {
    try {
      if (new URL(origin).host === host) {
        next();
        return;
      }
      res.status(403).json({ error: "Permintaan lintas origin (CSRF) ditolak.", code: 403 });
      return;
    } catch {
      res.status(400).json({ error: "Header Origin tidak valid.", code: 400 });
      return;
    }
  }
  if (referer && host) {
    try {
      if (new URL(referer).host === host) {
        next();
        return;
      }
      res.status(403).json({ error: "Referer tidak sesuai origin aplikasi.", code: 403 });
      return;
    } catch {
      res.status(400).json({ error: "Header Referer tidak valid.", code: 400 });
      return;
    }
  }
  next();
}
function requirePermission(module, action) {
  return (req, res, next) => {
    const user = req.authUser;
    if (!user) {
      res.status(401).json({ error: "Autentikasi diperlukan.", code: 401 });
      return;
    }
    if (!hasPermission(user.permissions, module, action)) {
      res.status(403).json({
        error: `Akses ditolak: Anda tidak memiliki izin '${action}' pada modul '${module}'.`,
        code: 403
      });
      return;
    }
    next();
  };
}
function inspectFileMagicBytes(buffer, declaredMime, originalName) {
  if (buffer.length < 4) {
    return { valid: false, detectedMime: "application/octet-stream", reason: "Berkas terlalu kecil atau rusak." };
  }
  const ext = originalName.split(".").pop()?.toLowerCase() ?? "";
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    if (ext !== "pdf") {
      return { valid: false, detectedMime: "application/pdf", reason: "Ekstensi berkas tidak cocok dengan isi PDF." };
    }
    return { valid: true, detectedMime: "application/pdf" };
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    if (!["jpg", "jpeg"].includes(ext)) {
      return { valid: false, detectedMime: "image/jpeg", reason: "Ekstensi tidak cocok dengan berkas JPEG." };
    }
    return { valid: true, detectedMime: "image/jpeg" };
  }
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
    if (ext !== "png") {
      return { valid: false, detectedMime: "image/png", reason: "Ekstensi tidak cocok dengan berkas PNG." };
    }
    return { valid: true, detectedMime: "image/png" };
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    if (ext !== "webp") {
      return { valid: false, detectedMime: "image/webp", reason: "Ekstensi tidak cocok dengan berkas WebP." };
    }
    return { valid: true, detectedMime: "image/webp" };
  }
  if (ext === "csv" && (declaredMime === "text/csv" || declaredMime === "application/vnd.ms-excel" || declaredMime === "text/plain")) {
    return { valid: true, detectedMime: "text/csv" };
  }
  return {
    valid: false,
    detectedMime: "unknown",
    reason: "Format berkas ditolak. Hanya PDF, JPG, JPEG, PNG, WebP, atau CSV yang lolos validasi signature MIME."
  };
}
function writeAuditLog(db, actor, action, targetType, targetId, outcome = "berhasil", contextNote = "") {
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, target_type, target_id, outcome, context_note, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    actor.id,
    actor.fullName,
    actor.role,
    action,
    targetType,
    targetId,
    outcome,
    contextNote,
    (/* @__PURE__ */ new Date()).toISOString()
  );
}
function writeActivityTimeline(db, category, title, description, actorName, provinceCode = null, batchId = null, relatedPath = "/dashboard") {
  db.prepare(
    `INSERT INTO activity_timeline (id, category, title, description, province_code, batch_id, actor_name, related_path, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    crypto.randomUUID(),
    category,
    title,
    description,
    provinceCode,
    batchId,
    actorName,
    relatedPath,
    (/* @__PURE__ */ new Date()).toISOString()
  );
}
function recordSystemError(db, httpStatus, route, err) {
  const ref = `ERR-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10).replace(/-/g, "")}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
  try {
    const msg = err instanceof Error ? err.message : String(err || "Unknown internal error");
    db.prepare(
      `INSERT INTO system_errors (id, reference_code, http_status, route, error_message, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(crypto.randomUUID(), ref, httpStatus, route.slice(0, 160), msg.slice(0, 500), (/* @__PURE__ */ new Date()).toISOString());
  } catch {
  }
  return ref;
}

// server/seed.ts
function createMinimalPdfBuffer(title, refNo, bodyLine) {
  const safeText = (t) => t.replace(/[()\\]/g, "");
  const content = `BT /F1 14 Tf 50 750 Td (${safeText(title)}) Tj 0 -24 Td /F1 10 Tf (Nomor Referensi: ${safeText(refNo)}) Tj 0 -18 Td (${safeText(bodyLine)}) Tj 0 -18 Td (Dokumen Resmi SATU DPBI - Sistem Administrasi Terpadu Utama) Tj ET`;
  const pdf = `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj
4 0 obj << /Length ${content.length} >> stream
${content}
endstream endobj
5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000450 00000 n 
trailer << /Size 6 /Root 1 0 R >>
startxref
520
%%EOF`;
  return Buffer.from(pdf, "utf8");
}
function saveSeedPdf(db, title, refNo, bodyLine, module, uploadedBy) {
  const buf = createMinimalPdfBuffer(title, refNo, bodyLine);
  const fileId = crypto2.randomUUID();
  const storedName = `${fileId}.pdf`;
  const fileName = `${refNo.replace(/\//g, "_")}.pdf`;
  fs2.writeFileSync(path2.join(PRIVATE_STORAGE_DIR, storedName), buf);
  db.prepare(
    `INSERT INTO stored_files (id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, module, uploaded_by, is_archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
  ).run(
    fileId,
    fileName,
    storedName,
    "application/pdf",
    buf.length,
    sha256(buf),
    module,
    uploadedBy,
    (/* @__PURE__ */ new Date()).toISOString()
  );
  return { fileId, fileName, sizeBytes: buf.length };
}
function ensureSeeded(db) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const provCount = db.prepare("SELECT COUNT(*) AS c FROM provinces").get().c;
  if (provCount === 0) {
    const stmt = db.prepare(
      `INSERT INTO provinces (code, name, island, status, coordinator_id, coordinator_name, coaching_note, min_lat, max_lat, min_lng, max_lng, center_lat, center_lng)
       VALUES (?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?)`
    );
    for (const p of INDONESIA_PROVINCES) {
      stmt.run(p.code, p.name, p.island, "belum_terbentuk", p.minLat, p.maxLat, p.minLng, p.maxLng, p.centerLat, p.centerLng);
    }
  }
  const settingsCount = db.prepare("SELECT COUNT(*) AS c FROM system_settings").get().c;
  if (settingsCount === 0) {
    const settings = [
      ["public_stats_approved", "true"],
      ["default_batch_duration_months", "4"],
      ["monthly_report_deadline_day", "5"],
      ["final_report_deadline_hours", "168"],
      ["alumni_access_window_days", "30"],
      ["storage_quota_mb", process.env.STORAGE_QUOTA_MB || "10240"],
      ["max_pdf_upload_mb", "15"],
      ["max_photo_upload_mb", "5"],
      ["kemendikdasmen_status", "nonaktif"],
      ["safeguarding_min_chaperones_u18", "2"],
      ["eval_weight_task", "30"],
      ["eval_weight_timeliness", "25"],
      ["eval_weight_quality", "25"],
      ["eval_weight_coordination", "20"]
    ];
    const sStmt = db.prepare("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?)");
    for (const [k, v] of settings) {
      sStmt.run(k, v, now);
    }
  }
  const matrixCount = db.prepare("SELECT COUNT(*) AS c FROM approval_matrix_rules").get().c;
  if (matrixCount === 0) {
    const rules = [
      ["amr-1", "Kebudayaan", "Festival / Pameran Budaya", "tinggi", 1, 1, "pengurus_nasional", "Melibatkan peserta luas & izin eksternal; diputuskan Pengurus Nasional Bidang Kebudayaan."],
      ["amr-2", "Pendidikan", "Lokakarya / Literasi Pelajar", "sedang", 1, 0, "pengurus_nasional", "Menggunakan identitas resmi DPBI tingkat wilayah/nasional; ditinjau Pengurus Nasional Bidang Pendidikan."],
      ["amr-3", "Program dan Operasional", "Diskusi / Aksi Sekolah Lokal", "rendah", 0, 0, "koordinator_wilayah", "Kegiatan berisiko rendah tingkat sekolah/kota; disetujui oleh Koordinator Wilayah setempat."],
      ["amr-4", "Hubungan dan Kemitraan", "Kemitraan Eksternal / Lintas Lembaga", "tinggi", 1, 1, "pengurus_nasional", "Wajib verifikasi Pengurus Nasional Bidang Kemitraan dan Penilaian Risiko."]
    ];
    const mStmt = db.prepare(
      `INSERT INTO approval_matrix_rules (id, bidang, category, risk_level, uses_dpbi_identity, external_permit_needed, approver_role, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const r of rules) {
      mStmt.run(...r);
    }
  }
  const autoCount = db.prepare("SELECT COUNT(*) AS c FROM automation_jobs").get().c;
  if (autoCount === 0) {
    const jobs = [
      ["job-1", "penomoran_otomatis", "Penomoran Referensi Atomik DPBI", "Real-time saat pembuatan objek", 1, now, "berhasil", "Sequence terjamin unik per tahun."],
      ["job-2", "pengingat_laporan_bulanan", "Pengingat Laporan Bulanan Koordinator", "Setiap tanggal 1 & 4 pukul 08:00 WIB", 1, now, "berhasil", "Notifikasi pengingat tanggal 5 aktif."],
      ["job-3", "pengingat_alumni_30_hari", "Pengingat Batas Akses Alumni (H-7, H-3, H-1)", "Harian pukul 07:00 WIB", 1, now, "berhasil", "Memantau jendela arsip 30 hari alumni."],
      ["job-4", "pengingat_tenggat_tugas", "Eskalasi Tugas & Proposal Mendekati Tenggat", "Setiap 6 jam", 1, now, "berhasil", "Idempotency key aktif untuk cegah duplikasi."],
      ["job-5", "pemeriksaan_kapasitas_storage", "Pemantauan Kapasitas Storage (70% / 85% / 95%)", "Setiap jam", 1, now, "berhasil", "Ambang batas terpantau normal."]
    ];
    const jStmt = db.prepare(
      `INSERT INTO automation_jobs (id, job_key, name, schedule_label, enabled, last_run_at, last_status, last_message)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const j of jobs) jStmt.run(...j);
  }
  if (!IS_DEMO_MODE) return;
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
  if (userCount > 0) return;
  const demoPassHash = hashPassword("Simulasi2026!");
  db.prepare(
    `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("batch-1", 1, "Angkatan I \u2014 Perintis Nusantara", "2025-11-01", "2025-12-01", "2025-12-15", "2026-01-01", "2026-04-30", 4, "diarsipkan", now);
  db.prepare(
    `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("batch-2", 2, "Angkatan II \u2014 Gelora Budaya", "2026-03-01", "2026-04-05", "2026-04-20", "2026-05-01", "2026-08-31", 4, "selesai", now);
  db.prepare(
    `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run("batch-3", 3, "Angkatan III \u2014 Karya Pelajar Berbudaya", "2026-08-01", "2026-09-01", "2026-09-12", "2026-09-15", "2027-01-15", 4, "aktif", now);
  const seqStmt = db.prepare("INSERT INTO reference_sequences (category, year, last_seq) VALUES (?, 2026, ?)");
  seqStmt.run("PERS", 10);
  seqStmt.run("PROP", 4);
  seqStmt.run("LKL", 4);
  seqStmt.run("LKW", 3);
  seqStmt.run("TGS", 5);
  seqStmt.run("DOC", 6);
  seqStmt.run("AKUN", 2);
  seqStmt.run("INS", 1);
  seqStmt.run("ADU", 1);
  seqStmt.run("HND", 1);
  const demoUsers = [
    {
      id: "usr-super",
      email: "superadmin@simulasi.dpbi.or.id",
      fullName: "Raden Bagus Prasetyo (Simulasi)",
      role: "super_admin",
      bidang: "Tata Kelola Nasional",
      provinceCode: "31",
      batchId: "batch-3",
      personnelId: "pers-1",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-wakil",
      email: "wakil@simulasi.dpbi.or.id",
      fullName: "Ayu Lestari Kusuma (Simulasi)",
      role: "wakil_super_admin",
      bidang: "Koordinasi Wilayah & Sistem",
      provinceCode: "31",
      batchId: "batch-3",
      personnelId: "pers-2",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-pj",
      email: "pengawas@simulasi.dpbi.or.id",
      fullName: "Dr. Hendra Wijaya (Simulasi)",
      role: "penanggung_jawab",
      bidang: "Pengawasan & Perlindungan",
      provinceCode: "31",
      batchId: "batch-3",
      personnelId: "pers-3",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-pengurus",
      email: "pengurus.budaya@simulasi.dpbi.or.id",
      fullName: "Niken Larasati (Simulasi)",
      role: "pengurus_nasional",
      bidang: "Kebudayaan",
      provinceCode: "34",
      batchId: "batch-3",
      personnelId: "pers-4",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-sekretariat",
      email: "sekretariat@simulasi.dpbi.or.id",
      fullName: "Fajar Ramadhan (Simulasi)",
      role: "sekretariat_nasional",
      bidang: "Administrasi dan Pengembangan Organisasi",
      provinceCode: "31",
      batchId: "batch-3",
      personnelId: "pers-5",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-korwil-jabar",
      email: "korwil.jabar@simulasi.dpbi.or.id",
      fullName: "Siti Nurhaliza Putri (Simulasi)",
      role: "koordinator_wilayah",
      bidang: "Program dan Operasional",
      provinceCode: "32",
      batchId: "batch-3",
      personnelId: "pers-6",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-korwil-bali",
      email: "korwil.bali@simulasi.dpbi.or.id",
      fullName: "I Made Arya Putra (Simulasi)",
      role: "koordinator_wilayah",
      bidang: "Kebudayaan",
      provinceCode: "51",
      batchId: "batch-3",
      personnelId: "pers-7",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-duta-jabar",
      email: "duta.jabar@simulasi.dpbi.or.id",
      fullName: "Raka Pratama (Simulasi)",
      role: "duta",
      bidang: "Kebudayaan",
      provinceCode: "32",
      batchId: "batch-3",
      personnelId: "pers-8",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-duta-jateng",
      email: "duta.jateng@simulasi.dpbi.or.id",
      fullName: "Sekar Arum Sari (Simulasi)",
      role: "duta",
      bidang: "Pendidikan",
      provinceCode: "33",
      batchId: "batch-3",
      personnelId: "pers-9",
      status: "aktif",
      alumniExp: null
    },
    {
      id: "usr-alumni",
      email: "alumni.b2@simulasi.dpbi.or.id",
      fullName: "Bima Sakti Nugroho (Simulasi)",
      role: "alumni",
      bidang: "Kebudayaan",
      provinceCode: "35",
      batchId: "batch-2",
      personnelId: "pers-10",
      status: "alumni_terbatas",
      alumniExp: new Date(Date.now() + 18 * 24 * 60 * 60 * 1e3).toISOString()
    }
  ];
  const uStmt = db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, bidang, province_code, batch_id, personnel_id, account_status, alumni_access_expires_at, is_demo, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  );
  for (const u of demoUsers) {
    uStmt.run(u.id, u.email, demoPassHash, u.fullName, u.role, u.bidang, u.provinceCode, u.batchId, u.personnelId, u.status, u.alumniExp, now);
  }
  const persList = [
    {
      id: "pers-1",
      memberNo: "DPBI-2026-0001",
      ref: "DPBI/PERS/2026/0001",
      userId: "usr-super",
      name: "Raden Bagus Prasetyo (Simulasi)",
      nick: "Bagus",
      bp: "Jakarta",
      bd: "2001-05-14",
      gender: "Laki-laki",
      email: "superadmin@simulasi.dpbi.or.id",
      phone: "081100000001",
      prov: "31",
      reg: "Jakarta Selatan",
      dist: "Kebayoran Baru",
      vil: "Senayan",
      addr: "Jl. Hang Tuah Raya No. 12",
      school: "Sekretariat Pusat DPBI",
      lvl: "Pengelola",
      cls: "Pusat",
      major: "Tata Kelola",
      npsn: "20100001",
      nisn: "-",
      batch: "batch-3",
      pos: "Super Admin Sistem",
      bidang: "Tata Kelola Nasional",
      role: "super_admin",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "Keluarga Prasetyo",
      gRel: "Orang Tua",
      gPhone: "081100009001",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-2",
      memberNo: "DPBI-2026-0002",
      ref: "DPBI/PERS/2026/0002",
      userId: "usr-wakil",
      name: "Ayu Lestari Kusuma (Simulasi)",
      nick: "Ayu",
      bp: "Surabaya",
      bd: "2002-08-22",
      gender: "Perempuan",
      email: "wakil@simulasi.dpbi.or.id",
      phone: "081100000002",
      prov: "31",
      reg: "Jakarta Pusat",
      dist: "Menteng",
      vil: "Cikini",
      addr: "Jl. Cikini Raya No. 48",
      school: "Sekretariat Pusat DPBI",
      lvl: "Pengelola",
      cls: "Pusat",
      major: "Koordinasi",
      npsn: "20100002",
      nisn: "-",
      batch: "batch-3",
      pos: "Wakil Super Admin",
      bidang: "Koordinasi Wilayah & Sistem",
      role: "wakil_super_admin",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "Kusuma Wijaya",
      gRel: "Orang Tua",
      gPhone: "081100009002",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-3",
      memberNo: "DPBI-2026-0003",
      ref: "DPBI/PERS/2026/0003",
      userId: "usr-pj",
      name: "Dr. Hendra Wijaya (Simulasi)",
      nick: "Hendra",
      bp: "Semarang",
      bd: "1984-03-10",
      gender: "Laki-laki",
      email: "pengawas@simulasi.dpbi.or.id",
      phone: "081100000003",
      prov: "31",
      reg: "Jakarta Timur",
      dist: "Rawamangun",
      vil: "Jati",
      addr: "Jl. Pemuda No. 88",
      school: "Dewan Pembina Yayasan",
      lvl: "Pembina",
      cls: "Pusat",
      major: "Pengawasan",
      npsn: "-",
      nisn: "-",
      batch: "batch-3",
      pos: "Penanggung Jawab Organisasi",
      bidang: "Pengawasan & Perlindungan",
      role: "penanggung_jawab",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "-",
      gRel: "-",
      gPhone: "-",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-4",
      memberNo: "DPBI-2026-0004",
      ref: "DPBI/PERS/2026/0004",
      userId: "usr-pengurus",
      name: "Niken Larasati (Simulasi)",
      nick: "Niken",
      bp: "Yogyakarta",
      bd: "2003-11-04",
      gender: "Perempuan",
      email: "pengurus.budaya@simulasi.dpbi.or.id",
      phone: "081100000004",
      prov: "34",
      reg: "Kota Yogyakarta",
      dist: "Gondokusuman",
      vil: "Terban",
      addr: "Jl. Suroto No. 19",
      school: "Pengurus Nasional DPBI",
      lvl: "Pengurus",
      cls: "Nasional",
      major: "Kebudayaan",
      npsn: "-",
      nisn: "-",
      batch: "batch-3",
      pos: "Ketua Bidang Kebudayaan",
      bidang: "Kebudayaan",
      role: "pengurus_nasional",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "Sri Wahyuni",
      gRel: "Ibu",
      gPhone: "081100009004",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-5",
      memberNo: "DPBI-2026-0005",
      ref: "DPBI/PERS/2026/0005",
      userId: "usr-sekretariat",
      name: "Fajar Ramadhan (Simulasi)",
      nick: "Fajar",
      bp: "Bekasi",
      bd: "2004-01-20",
      gender: "Laki-laki",
      email: "sekretariat@simulasi.dpbi.or.id",
      phone: "081100000005",
      prov: "31",
      reg: "Jakarta Selatan",
      dist: "Tebet",
      vil: "Tebet Barat",
      addr: "Jl. Tebet Barat Dalam No. 25",
      school: "Sekretariat Nasional DPBI",
      lvl: "Sekretariat",
      cls: "Nasional",
      major: "Administrasi",
      npsn: "-",
      nisn: "-",
      batch: "batch-3",
      pos: "Kepala Sekretariat Nasional",
      bidang: "Administrasi dan Pengembangan Organisasi",
      role: "sekretariat_nasional",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "Hendra Ramadhan",
      gRel: "Ayah",
      gPhone: "081100009005",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-6",
      memberNo: "DPBI-2026-0006",
      ref: "DPBI/PERS/2026/0006",
      userId: "usr-korwil-jabar",
      name: "Siti Nurhaliza Putri (Simulasi)",
      nick: "Siti",
      bp: "Bandung",
      bd: "2006-07-17",
      gender: "Perempuan",
      email: "korwil.jabar@simulasi.dpbi.or.id",
      phone: "081222000006",
      prov: "32",
      reg: "Kota Bandung",
      dist: "Coblong",
      vil: "Dago",
      addr: "Jl. Ir. H. Juanda No. 114",
      school: "SMAN 3 Bandung",
      lvl: "SMA/SMK/MA",
      cls: "XII",
      major: "IPS",
      npsn: "20219256",
      nisn: "0061234506",
      batch: "batch-3",
      pos: "Koordinator Wilayah Jawa Barat",
      bidang: "Program dan Operasional",
      role: "koordinator_wilayah",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "Dedi Mulyono",
      gRel: "Ayah",
      gPhone: "081222009006",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-7",
      memberNo: "DPBI-2026-0007",
      ref: "DPBI/PERS/2026/0007",
      userId: "usr-korwil-bali",
      name: "I Made Arya Putra (Simulasi)",
      nick: "Arya",
      bp: "Denpasar",
      bd: "2006-09-02",
      gender: "Laki-laki",
      email: "korwil.bali@simulasi.dpbi.or.id",
      phone: "081236000007",
      prov: "51",
      reg: "Kota Denpasar",
      dist: "Denpasar Timur",
      vil: "Sumerta",
      addr: "Jl. Hayam Wuruk No. 72",
      school: "SMAN 1 Denpasar",
      lvl: "SMA/SMK/MA",
      cls: "XII",
      major: "IPA",
      npsn: "50103127",
      nisn: "0061234507",
      batch: "batch-3",
      pos: "Koordinator Wilayah Bali",
      bidang: "Kebudayaan",
      role: "koordinator_wilayah",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "I Nyoman Putra",
      gRel: "Ayah",
      gPhone: "081236009007",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-8",
      memberNo: "DPBI-2026-0008",
      ref: "DPBI/PERS/2026/0008",
      userId: "usr-duta-jabar",
      name: "Raka Pratama (Simulasi)",
      nick: "Raka",
      bp: "Bogor",
      bd: "2009-02-11",
      gender: "Laki-laki",
      email: "duta.jabar@simulasi.dpbi.or.id",
      phone: "081311000008",
      prov: "32",
      reg: "Kota Bogor",
      dist: "Bogor Tengah",
      vil: "Paledang",
      addr: "Jl. Kapten Muslihat No. 31",
      school: "SMAN 1 Bogor",
      lvl: "SMA/SMK/MA",
      cls: "XI",
      major: "Bahasa & Budaya",
      npsn: "20220331",
      nisn: "0091234508",
      batch: "batch-3",
      pos: "Duta Pelajar Berbudaya Jawa Barat",
      bidang: "Kebudayaan",
      role: "duta",
      pStatus: "aktif",
      vStatus: "terverifikasi",
      guardian: "Ratna Dewi",
      gRel: "Ibu",
      gPhone: "081311009008",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    },
    {
      id: "pers-9",
      memberNo: "DPBI-2026-0009",
      ref: "DPBI/PERS/2026/0009",
      userId: "usr-duta-jateng",
      name: "Sekar Arum Sari (Simulasi)",
      nick: "Sekar",
      bp: "Surakarta",
      bd: "2009-06-28",
      gender: "Perempuan",
      email: "duta.jateng@simulasi.dpbi.or.id",
      phone: "081326000009",
      prov: "33",
      reg: "Kota Surakarta",
      dist: "Laweyan",
      vil: "Sriwedari",
      addr: "Jl. Slamet Riyadi No. 210",
      school: "SMAN 1 Surakarta",
      lvl: "SMA/SMK/MA",
      cls: "XI",
      major: "IPA",
      npsn: "20327966",
      nisn: "0091234509",
      batch: "batch-3",
      pos: "Duta Pelajar Berbudaya Jawa Tengah",
      bidang: "Pendidikan",
      role: "duta",
      pStatus: "aktif",
      vStatus: "menunggu_verifikasi",
      guardian: "Bambang Sutrisno",
      gRel: "Ayah",
      gPhone: "081326009009",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: false, suratKesediaan: true }
    },
    {
      id: "pers-10",
      memberNo: "DPBI-2026-0010",
      ref: "DPBI/PERS/2026/0010",
      userId: "usr-alumni",
      name: "Bima Sakti Nugroho (Simulasi)",
      nick: "Bima",
      bp: "Malang",
      bd: "2008-04-05",
      gender: "Laki-laki",
      email: "alumni.b2@simulasi.dpbi.or.id",
      phone: "081334000010",
      prov: "35",
      reg: "Kota Malang",
      dist: "Klojen",
      vil: "Oro-oro Dowo",
      addr: "Jl. Ijen No. 44",
      school: "SMAN 3 Malang",
      lvl: "SMA/SMK/MA",
      cls: "XII",
      major: "IPS",
      npsn: "20533660",
      nisn: "0081234510",
      batch: "batch-2",
      pos: "Alumni Duta Angkatan II",
      bidang: "Kebudayaan",
      role: "alumni",
      pStatus: "alumni",
      vStatus: "terverifikasi",
      guardian: "Agus Nugroho",
      gRel: "Ayah",
      gPhone: "081334009010",
      docs: { pasFoto: true, kartuPelajar: true, suratSekolah: true, izinWali: true, suratKesediaan: true }
    }
  ];
  const pStmt = db.prepare(
    `INSERT INTO personnel (
      id, member_number, reference_number, user_id, full_name, nickname, birth_place, birth_date, gender,
      email, phone, province_code, regency, district, village, postal_code, full_address,
      school_name, education_level, grade_class, major, npsn, nisn, entry_year, expected_grad_year,
      school_address, school_regency, school_province, batch_id, position_title, bidang, role_code,
      appointed_at, term_starts_at, term_ends_at, personnel_status, verification_status, verification_note,
      cultural_interests, activity_interests, org_experience, skills, guardian_name, guardian_relation, guardian_phone,
      docs_checklist_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '10000', ?, ?, ?, ?, ?, ?, ?, 2024, 2027, ?, ?, ?, ?, ?, ?, ?, '2026-09-15', '2026-09-15', '2027-01-15', ?, ?, NULL, 'Tari Tradisional, Sastra Daerah', 'Edukasi Pelajar, Pelestarian Bahasa Daerah', 'OSIS & Forum Pelajar', 'Public Speaking, Dokumentasi', ?, ?, ?, ?, ?, ?)`
  );
  for (const p of persList) {
    pStmt.run(
      p.id,
      p.memberNo,
      p.ref,
      p.userId,
      p.name,
      p.nick,
      p.bp,
      p.bd,
      p.gender,
      p.email,
      p.phone,
      p.prov,
      p.reg,
      p.dist,
      p.vil,
      p.addr,
      p.school,
      p.lvl,
      p.cls,
      p.major,
      p.npsn,
      p.nisn,
      `${p.addr} (Kampus Sekolah)`,
      p.reg,
      p.prov,
      p.batch,
      p.pos,
      p.bidang,
      p.role,
      p.pStatus,
      p.vStatus,
      p.guardian,
      p.gRel,
      p.gPhone,
      JSON.stringify(p.docs),
      now,
      now
    );
  }
  const activeProvinces = [
    ["31", "aktif", "usr-sekretariat", "Fajar Ramadhan (Simulasi)", "Pusat koordinasi nasional & perwakilan DKI Jakarta berjalan optimal."],
    ["32", "aktif", "usr-korwil-jabar", "Siti Nurhaliza Putri (Simulasi)", "Program Gelora Aksara Sunda aktif di 8 sekolah."],
    ["33", "aktif", null, "Ratri Puspita (Simulasi)", "Pendampingan verifikasi berkas Duta Angkatan III."],
    ["34", "aktif", "usr-pengurus", "Niken Larasati (Simulasi)", "Aktif dalam program literasi budaya Yogyakarta."],
    ["35", "aktif", null, "Bagas Adi Wijaya (Simulasi)", "Menunggu pengumpulan laporan bulanan wilayah."],
    ["51", "aktif", "usr-korwil-bali", "I Made Arya Putra (Simulasi)", "Festival Aksara Bali siap dilaksanakan."],
    ["12", "aktif", null, "M. Rizky Siregar (Simulasi)", "Koordinasi aktif lintas sekolah Medan & Deli Serdang."],
    ["13", "aktif", null, "Aulia Putri Minang (Simulasi)", "Program edukasi adat Minangkabau berjalan."],
    ["73", "aktif", null, "Andi Fikri (Simulasi)", "Kegiatan literasi maritim pelajar aktif."],
    ["64", "aktif", null, "Rizka Amelia (Simulasi)", "Pembinaan Duta Kalimantan Timur berjalan baik."],
    ["11", "dalam_pengembangan", null, "Cut Nabila (Simulasi)", "Tahap konsolidasi tim wilayah Aceh."],
    ["14", "dalam_pengembangan", null, "Hafiz Alamsyah (Simulasi)", "Menunggu kelengkapan 2 surat rekomendasi sekolah."],
    ["36", "dalam_pengembangan", null, "Dewi Anggraini (Simulasi)", "Penjadwalan pembekalan wilayah Banten."],
    ["52", "dalam_pengembangan", null, "Lalu Ahmad (Simulasi)", "Persiapan forum budaya pelajar NTB."],
    ["61", "dalam_pengembangan", null, "Stefanus Yoga (Simulasi)", "Konsolidasi awal Kalimantan Barat."],
    ["71", "dalam_pengembangan", null, "Gabriel Tumbel (Simulasi)", "Penjajakan kemitraan sekolah di Manado."],
    ["18", "dalam_pembinaan", null, null, "Membutuhkan pendampingan Koordinator baru pasca transisi."],
    ["63", "dalam_pembinaan", null, null, "Perlu tindak lanjut laporan bulanan wilayah."],
    ["81", "dalam_pembinaan", null, null, "Pembinaan aktif oleh Pengurus Nasional Bidang Program."],
    ["91", "dalam_pembinaan", null, null, "Pembinaan awal kepengurusan wilayah Papua."]
  ];
  const updProv = db.prepare(
    "UPDATE provinces SET status = ?, coordinator_id = ?, coordinator_name = ?, coaching_note = ? WHERE code = ?"
  );
  for (const [code, status, cid, cname, note] of activeProvinces) {
    updProv.run(status, cid, cname, note, code);
  }
  const posStmt = db.prepare(
    `INSERT INTO organization_positions (id, title, bidang, level, holder_personnel_id, holder_name, sk_number, term_starts_at, term_ends_at, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, '2026-09-15', '2027-01-15', 'aktif', ?)`
  );
  posStmt.run("pos-1", "Penanggung Jawab Organisasi", "Pengawasan & Perlindungan", "Nasional", "pers-3", "Dr. Hendra Wijaya (Simulasi)", "DPBI/DOC/2026/0001", now);
  posStmt.run("pos-2", "Ketua Bidang Kebudayaan", "Kebudayaan", "Nasional", "pers-4", "Niken Larasati (Simulasi)", "DPBI/DOC/2026/0002", now);
  posStmt.run("pos-3", "Kepala Sekretariat Nasional", "Administrasi dan Pengembangan Organisasi", "Nasional", "pers-5", "Fajar Ramadhan (Simulasi)", "DPBI/DOC/2026/0003", now);
  db.prepare(
    `INSERT INTO delegations (id, delegate_user_id, delegate_name, grantor_user_id, grantor_name, module, action, province_code, starts_at, ends_at, reason, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 'aktif', ?)`
  ).run(
    "del-demo-1",
    "usr-wakil",
    "Ayu Lestari Kusuma (Simulasi)",
    "usr-super",
    "Raden Bagus Prasetyo (Simulasi)",
    "wilayah",
    "manage",
    "2026-10-01T00:00:00Z",
    "2027-02-01T23:59:59Z",
    "Delegasi pengelolaan operasional 38 wilayah periode Angkatan III",
    now
  );
  db.prepare(
    `INSERT INTO handovers (id, reference_number, province_code, outgoing_coordinator_id, outgoing_coordinator_name, incoming_coordinator_id, incoming_coordinator_name, active_tasks_count, open_proposals_count, notes, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 3, 2, ?, 'menunggu_persetujuan', ?)`
  ).run(
    "hnd-1",
    "DPBI/HND/2026/0001",
    "35",
    "pers-10",
    "Bagas Adi Wijaya (Simulasi)",
    null,
    "Calon Koordinator Jawa Timur (Simulasi)",
    "Serah terima dokumen wilayah, daftar Duta aktif Jawa Timur, serta agenda kegiatan bulan berjalan.",
    now
  );
  db.prepare(
    `INSERT INTO account_requests (id, reference_number, full_name, email, phone, province_code, batch_id, school_name, requested_by_user_id, requested_by_name, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?)`
  ).run(
    "req-1",
    "DPBI/AKUN/2026/0001",
    "Tariq Alfarizi (Simulasi)",
    "tariq.simulasi@dpbi.or.id",
    "081299887766",
    "32",
    "batch-3",
    "SMAN 5 Bandung",
    "usr-korwil-jabar",
    "Siti Nurhaliza Putri (Simulasi)",
    now
  );
  db.prepare(
    `INSERT INTO account_requests (id, reference_number, full_name, email, phone, province_code, batch_id, school_name, requested_by_user_id, requested_by_name, status, decision_note, decided_by, decided_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'disetujui', 'Berkas lengkap dan sesuai kuota wilayah Bali.', 'Fajar Ramadhan (Simulasi)', ?, ?)`
  ).run(
    "req-2",
    "DPBI/AKUN/2026/0002",
    "Ni Putu Ayu Lestari (Simulasi)",
    "putu.simulasi@dpbi.or.id",
    "081236778899",
    "51",
    "batch-3",
    "SMAN 4 Denpasar",
    "usr-korwil-bali",
    "I Made Arya Putra (Simulasi)",
    now,
    now
  );
  const propPdf1 = saveSeedPdf(db, "Proposal Pekan Literasi Aksara Sunda Pelajar", "DPBI/PROP/2026/0001", "Lokasi: Aula SMAN 1 Bogor - Bidang Kebudayaan", "proposal", "usr-duta-jabar");
  const propPdf2 = saveSeedPdf(db, "Proposal Simposium Bahasa Daerah Nusantara", "DPBI/PROP/2026/0002", "Lokasi: Daring Nasional - Bidang Pendidikan", "proposal", "usr-duta-jateng");
  const propPdf3 = saveSeedPdf(db, "Proposal Pameran Tenun & Sastra Bali", "DPBI/PROP/2026/0003", "Lokasi: Taman Budaya Denpasar - Bidang Kebudayaan", "proposal", "usr-korwil-bali");
  const propStmt = db.prepare(
    `INSERT INTO proposals (
      id, reference_number, version, title, applicant_personnel_id, applicant_name, province_code, batch_id,
      bidang, category, risk_level, uses_dpbi_identity, external_permit_needed, assigned_approver_role,
      objective, target_audience, event_date, event_time, location, pic_name, estimated_participants,
      activity_mode, pdf_file_id, pdf_file_name, status, decision_note, decided_by, decided_at, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  propStmt.run(
    "prop-1",
    "DPBI/PROP/2026/0001",
    1,
    "Pekan Literasi Aksara Sunda Pelajar Jawa Barat",
    "pers-8",
    "Raka Pratama (Simulasi)",
    "32",
    "batch-3",
    "Kebudayaan",
    "Lokakarya / Literasi Pelajar",
    "sedang",
    1,
    0,
    "pengurus_nasional",
    "Mengenalkan aksara Sunda dan manuskrip lokal kepada 80 pelajar SMA di Kota Bogor.",
    "Pelajar SMA/SMK Kota Bogor",
    "2026-11-28",
    "09:00 - 14:00 WIB",
    "Aula SMAN 1 Bogor",
    "Raka Pratama (Simulasi)",
    80,
    "luring",
    propPdf1.fileId,
    propPdf1.fileName,
    "disetujui",
    "Disetujui sesuai program kerja Bidang Kebudayaan. Pastikan 2 pendamping dewasa hadir.",
    "Niken Larasati (Simulasi)",
    now,
    now,
    now
  );
  propStmt.run(
    "prop-2",
    "DPBI/PROP/2026/0002",
    1,
    "Simposium Daring Bahasa Daerah Nusantara",
    "pers-9",
    "Sekar Arum Sari (Simulasi)",
    "33",
    "batch-3",
    "Pendidikan",
    "Seminar Daring",
    "rendah",
    1,
    0,
    "pengurus_nasional",
    "Diskusi interaktif pelestarian bahasa ibu di sekolah menengah.",
    "Pelajar lintas provinsi",
    "2026-12-06",
    "13:00 - 15:30 WIB",
    "Platform Konferensi Video Daring",
    "Sekar Arum Sari (Simulasi)",
    150,
    "daring",
    propPdf2.fileId,
    propPdf2.fileName,
    "menunggu_persetujuan_nasional",
    null,
    null,
    null,
    now,
    now
  );
  propStmt.run(
    "prop-3",
    "DPBI/PROP/2026/0003",
    2,
    "Festival Tenun & Sastra Pelajar Bali",
    "pers-7",
    "I Made Arya Putra (Simulasi)",
    "51",
    "batch-3",
    "Kebudayaan",
    "Festival / Pameran Budaya",
    "tinggi",
    1,
    1,
    "pengurus_nasional",
    "Pameran karya kriya tenun pelajar dan pembacaan puisi Bali.",
    "Pelajar & Masyarakat Umum",
    "2026-12-14",
    "08:30 - 16:00 WITA",
    "Taman Budaya Art Center Denpasar",
    "I Made Arya Putra (Simulasi)",
    200,
    "luring",
    propPdf3.fileId,
    propPdf3.fileName,
    "perlu_revisi",
    "Mohon lengkapi lampiran surat izin penggunaan gedung dan daftar 3 pendamping dewasa.",
    "Niken Larasati (Simulasi)",
    now,
    now,
    now
  );
  db.prepare(
    `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
     VALUES (?, ?, 1, ?, ?, 'Pengajuan awal dokumen proposal PDF', 'Raka Pratama (Simulasi)', ?)`
  ).run("pv-1", "prop-1", propPdf1.fileId, propPdf1.fileName, now);
  db.prepare(
    `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
     VALUES (?, ?, 1, ?, ?, 'Dokumen awal sebelum revisi', 'I Made Arya Putra (Simulasi)', ?)`
  ).run("pv-2", "prop-3", propPdf3.fileId, propPdf3.fileName, now);
  db.prepare(
    `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
     VALUES (?, ?, 2, ?, ?, 'Pembaruan estimasi peserta dan rincian keamanan', 'I Made Arya Putra (Simulasi)', ?)`
  ).run("pv-3", "prop-3", propPdf3.fileId, propPdf3.fileName, now);
  const lklPdf1 = saveSeedPdf(db, "LKL Klinik Aksara Sunda Tahap 1", "DPBI/LKL/2026/0001", "Jumlah Peserta: 64 Pelajar - Lokasi: Kota Bogor", "lkl", "usr-duta-jabar");
  const lklPdf2 = saveSeedPdf(db, "LKL Webinar Budaya Tutur Jawa Tengah", "DPBI/LKL/2026/0002", "Kegiatan Daring - Jumlah Peserta: 112 Pelajar", "lkl", "usr-duta-jateng");
  const lklStmt = db.prepare(
    `INSERT INTO lkl_reports (
      id, reference_number, version, activity_name, proposal_id, proposal_ref, submitter_personnel_id, submitter_name,
      province_code, regency, district, village, venue_name, venue_address, event_date, start_time, end_time,
      category, activity_mode, platform_name, platform_link, pic_name, participant_count, summary, outcomes,
      obstacles, follow_up, pdf_file_id, pdf_file_name, photo_file_ids_json, status, review_note, reviewed_by, reviewed_at, created_at
    ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, ?)`
  );
  lklStmt.run(
    "lkl-1",
    "DPBI/LKL/2026/0001",
    "Klinik Aksara Sunda Tahap 1 \u2014 SMAN 1 Bogor",
    "prop-1",
    "DPBI/PROP/2026/0001",
    "pers-8",
    "Raka Pratama (Simulasi)",
    "32",
    "Kota Bogor",
    "Bogor Tengah",
    "Paledang",
    "Aula SMAN 1 Bogor",
    "Jl. Ir. H. Juanda No. 16, Bogor",
    "2026-11-10",
    "09:00",
    "12:30",
    "Lokakarya Budaya",
    "luring",
    null,
    null,
    "Raka Pratama (Simulasi)",
    64,
    "Pelatihan menulis dan membaca aksara Sunda bersama komunitas literasi sekolah dengan pendampingan 2 guru pembina.",
    "85% peserta mampu menyalin 1 paragraf aksara Sunda dan terbentuk kelompok belajar aksara di sekolah.",
    "Keterbatasan proyektor di ruang kedua teratasi dengan pembagian lembar kerja cetak.",
    "Lanjutan sesi praktik digitalisasi font aksara pada pekan berikutnya.",
    lklPdf1.fileId,
    lklPdf1.fileName,
    "diterima",
    "Dokumentasi lengkap dan sesuai SOP kegiatan luring.",
    "Siti Nurhaliza Putri (Simulasi)",
    now,
    now
  );
  lklStmt.run(
    "lkl-2",
    "DPBI/LKL/2026/0002",
    "Webinar Budaya Tutur Pelajar Jawa Tengah",
    null,
    null,
    "pers-9",
    "Sekar Arum Sari (Simulasi)",
    "33",
    "",
    "",
    "",
    "",
    "",
    "2026-11-12",
    "15:30",
    "17:00",
    "Edukasi Daring",
    "daring",
    "Zoom Meeting Resmi DPBI",
    "https://meeting.dpbi.or.id/tutur-jateng",
    "Sekar Arum Sari (Simulasi)",
    112,
    "Sesi bincang daring mengenai pelestarian tembang dan cerita rakyat Jawa Tengah di kalangan siswa SMA.",
    "112 peserta dari 14 kabupaten/kota di Jawa Tengah hadir aktif dan mengumpulkan 28 karya ringkas cerita rakyat.",
    "Sebagian peserta mengalami kendala jaringan ringan di awal sesi.",
    "Kompilasi naskah cerita rakyat akan diterbitkan di repositori materi pembekalan.",
    lklPdf2.fileId,
    lklPdf2.fileName,
    "menunggu_pemeriksaan",
    null,
    null,
    null,
    now
  );
  const lkwPdf1 = saveSeedPdf(db, "Laporan Bulanan Koordinator Jawa Barat Oktober 2026", "DPBI/LKW/2026/0001", "Provinsi Jawa Barat - Status Operasional Aktif", "laporan_koordinator", "usr-korwil-jabar");
  db.prepare(
    `INSERT INTO coordinator_reports (id, reference_number, report_type, province_code, batch_id, coordinator_id, coordinator_name, period_label, personnel_condition, activities_summary, lkl_recap_count, obstacles, coaching_needs, follow_up_plan, pdf_file_id, pdf_file_name, status, created_at)
     VALUES (?, ?, 'bulanan', '32', 'batch-3', 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', 'Oktober 2026', ?, ?, 4, ?, ?, ?, ?, ?, 'diterima', ?)`
  ).run(
    "lkw-1",
    "DPBI/LKW/2026/0001",
    "Seluruh 12 Duta Jawa Barat aktif dan sehat; 1 calon Duta sedang proses verifikasi akun.",
    "Terlaksana 4 kegiatan literasi budaya tingkat kota/kabupaten dengan total 260 peserta pelajar.",
    "Penyelarasan jadwal kegiatan dengan ujian tengah semester di beberapa sekolah.",
    "Dukungan template surat izin sekolah untuk kegiatan bulan November.",
    "Pemantauan LKL Pekan Literasi Aksara Sunda dan verifikasi profil berkas.",
    lkwPdf1.fileId,
    lkwPdf1.fileName,
    now
  );
  const tStmt = db.prepare(
    `INSERT INTO tasks (id, reference_number, title, description, priority, status, deadline, province_code, batch_id, assignee_id, assignee_name, creator_id, creator_name, checklist_json, is_template, recurrence, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'batch-3', ?, ?, 'usr-sekretariat', 'Fajar Ramadhan (Simulasi)', ?, 0, ?, ?)`
  );
  tStmt.run("tgs-1", "DPBI/TGS/2026/0001", "Verifikasi Surat Izin Wali Duta Jawa Tengah", "Periksa dan lengkapi unggahan surat izin orang tua/wali pada profil Sekar Arum Sari.", "tinggi", "perlu_perhatian", "2026-11-20", "33", "usr-duta-jateng", "Sekar Arum Sari (Simulasi)", JSON.stringify([{ id: "c1", text: "Unduh format surat izin wali", done: true }, { id: "c2", text: "Unggah PDF bertanda tangan", done: false }]), "tidak", now);
  tStmt.run("tgs-2", "DPBI/TGS/2026/0002", "Kirim Laporan Bulanan Wilayah November 2026", "Susun rekapitulasi kegiatan, kondisi personel, dan LKL sebelum tanggal 5 bulan berikutnya.", "tinggi", "dikerjakan", "2026-12-05", "32", "usr-korwil-jabar", "Siti Nurhaliza Putri (Simulasi)", JSON.stringify([{ id: "c1", text: "Rekap LKL bulan berjalan", done: true }, { id: "c2", text: "Unggah PDF resmi laporan", done: false }]), "bulanan", now);
  tStmt.run("tgs-3", "DPBI/TGS/2026/0003", "Tinjau Revisi Proposal Festival Tenun Bali", "Pastikan lampiran izin lokasi dan daftar 3 pendamping dewasa telah diperbarui.", "sedang", "menunggu", "2026-11-25", "51", "usr-pengurus", "Niken Larasati (Simulasi)", JSON.stringify([{ id: "c1", text: "Periksa aspek safeguarding U18", done: true }]), "tidak", now);
  tStmt.run("tgs-4", "DPBI/TGS/2026/0004", "Finalisasi LKL Pekan Literasi Aksara Sunda", "Lampirkan foto dokumentasi dan daftar hadir kegiatan luring di SMAN 1 Bogor.", "sedang", "selesai", "2026-11-15", "32", "usr-duta-jabar", "Raka Pratama (Simulasi)", JSON.stringify([{ id: "c1", text: "Unggah PDF LKL", done: true }, { id: "c2", text: "Unggah foto dokumentasi", done: true }]), "tidak", now);
  const sopPdf = saveSeedPdf(db, "SOP Perlindungan Peserta Pelajar & Standar Pendampingan", "DPBI/DOC/2026/0001", "Standar Operasional Prosedur Perlindungan Anak dan Keselamatan Kegiatan DPBI v2.1", "dokumen", "usr-pj");
  const skPdf = saveSeedPdf(db, "SK Penetapan Duta & Koordinator Angkatan III", "DPBI/DOC/2026/0002", "Surat Keputusan Penetapan Personel Angkatan III Masa Tugas 4 Bulan", "dokumen", "usr-sekretariat");
  const modPdf = saveSeedPdf(db, "Modul Pembekalan Kepemimpinan Budaya Pelajar", "DPBI/DOC/2026/0003", "Materi Wajib Pembekalan Duta Angkatan III - Sekretariat Nasional", "dokumen", "usr-pengurus");
  const dStmt = db.prepare(
    `INSERT INTO documents (id, document_number, title, category, owner_name, issuer_name, issued_date, status, version, access_level, file_id, file_name, file_size_bytes, notes, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'berlaku', ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  dStmt.run("doc-1", "DPBI/DOC/2026/0001", "SOP Perlindungan Peserta Pelajar & Keselamatan Kegiatan", "SOP", "Bidang Pengawasan & Perlindungan", "Penanggung Jawab Organisasi", "2026-09-01", "2.1", "internal_semua", sopPdf.fileId, sopPdf.fileName, sopPdf.sizeBytes, "Kebijakan internal minimal 2 pendamping dewasa untuk kegiatan luring peserta di bawah 18 tahun.", null, now);
  dStmt.run("doc-2", "DPBI/DOC/2026/0002", "SK Penetapan Pengurus, Koordinator, dan Duta Angkatan III", "SK", "Sekretariat Nasional", "Ketua Yayasan & Super Admin", "2026-09-15", "1.0", "internal_semua", skPdf.fileId, skPdf.fileName, skPdf.sizeBytes, "Berlaku selama masa tugas 4 bulan hingga 15 Januari 2027.", "2027-01-15", now);
  dStmt.run("doc-3", "DPBI/DOC/2026/0003", "Modul Pembekalan: Tata Kelola & Pelaporan LKL Berbasis Bukti", "Materi Pembekalan", "Bidang Kebudayaan", "Pengurus Nasional", "2026-09-10", "1.2", "internal_semua", modPdf.fileId, modPdf.fileName, modPdf.sizeBytes, "Panduan penyusunan proposal PDF dan LKL lapangan.", null, now);
  const annStmt = db.prepare(
    `INSERT INTO announcements (id, title, body, scope, province_code, batch_id, priority, author_name, published_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'terbit')`
  );
  annStmt.run("ann-1", "Batas Waktu Pengiriman Laporan Bulanan Wilayah", "Kepada seluruh Koordinator Wilayah Angkatan III, mohon mengirimkan Laporan Bulanan beserta rekap LKL paling lambat tanggal 5 setiap bulan pukul 23:59 WIB.", "nasional", null, "batch-3", "penting", "Fajar Ramadhan (Simulasi)", now);
  annStmt.run("ann-2", "Pembaruan Kebijakan Persetujuan Terpisah Publikasi Kegiatan", "Mulai Angkatan III, persetujuan dokumentasi dan publikasi foto/video peserta di bawah 18 tahun wajib dicatat terpisah dari persetujuan keikutsertaan.", "nasional", null, "batch-3", "normal", "Dr. Hendra Wijaya (Simulasi)", now);
  const calStmt = db.prepare(
    `INSERT INTO calendar_events (id, title, category, start_at, end_at, province_code, batch_id, related_ref, location, description)
     VALUES (?, ?, ?, ?, ?, ?, 'batch-3', ?, ?, ?)`
  );
  calStmt.run("cal-1", "Rapat Koordinasi Nasional Tengah Periode Angkatan III", "Rapat Nasional", "2026-11-22T19:00:00+07:00", "2026-11-22T21:00:00+07:00", null, "DPBI/DOC/2026/0002", "Daring Nasional", "Evaluasi capaian 38 provinsi dan kesiapan program bulan Desember.");
  calStmt.run("cal-2", "Pekan Literasi Aksara Sunda Pelajar Jawa Barat", "Kegiatan Wilayah", "2026-11-28T09:00:00+07:00", "2026-11-28T14:00:00+07:00", "32", "DPBI/PROP/2026/0001", "Aula SMAN 1 Bogor", "Kegiatan luring disetujui dengan 2 pendamping dewasa.");
  calStmt.run("cal-3", "Tenggat Laporan Bulanan Koordinator Wilayah", "Tenggat Laporan", "2026-12-05T23:59:00+07:00", "2026-12-05T23:59:00+07:00", null, "DPBI/TGS/2026/0002", "Portal SATU DPBI", "Batas pengumpulan rutin laporan bulanan koordinator.");
  calStmt.run("cal-4", "Penutupan Masa Tugas Angkatan III (4 Bulan)", "Penutupan Batch", "2027-01-15T17:00:00+07:00", "2027-01-15T17:00:00+07:00", null, null, "Nasional", "Peralihan status ke Alumni dengan jendela akses arsip 30 hari.");
  db.prepare(
    `INSERT INTO risk_assessments (id, proposal_id, activity_title, province_code, participant_under_18, adult_chaperone_count, environment_notes, transport_plan, emergency_plan, emergency_contact, risk_level, status, submitted_by, created_at)
     VALUES (?, 'prop-1', 'Pekan Literasi Aksara Sunda Pelajar Jawa Barat', '32', 1, 2, ?, ?, ?, ?, 'sedang', 'disetujui', 'Raka Pratama (Simulasi)', ?)`
  ).run(
    "rsk-1",
    "Ruang aula sekolah tertutup dengan ventilasi baik dan akses P3K.",
    "Peserta diantar langsung oleh orang tua/wali atau guru pendamping sekolah.",
    "Titik kumpul halaman utama sekolah, koordinasi UKS dan Puskesmas Bogor Tengah.",
    "Pembina OSIS SMAN 1 Bogor (0812-0000-1122)",
    now
  );
  db.prepare(
    `INSERT INTO consent_records (id, personnel_id, personnel_name, activity_title, consent_participation, consent_guardian, consent_documentation, consent_publication, recorded_at)
     VALUES (?, 'pers-8', 'Raka Pratama (Simulasi)', 'Pekan Literasi Aksara Sunda Pelajar', 1, 1, 1, 1, ?)`
  ).run("cns-1", now);
  db.prepare(
    `INSERT INTO consent_records (id, personnel_id, personnel_name, activity_title, consent_participation, consent_guardian, consent_documentation, consent_publication, recorded_at)
     VALUES (?, 'pers-9', 'Sekar Arum Sari (Simulasi)', 'Simposium Daring Bahasa Daerah Nusantara', 1, 1, 1, 0, ?)`
  ).run("cns-2", now);
  db.prepare(
    `INSERT INTO incidents (id, reference_number, occurred_at, location, province_code, category, urgency, chronology, initial_action, escalated_to, status, reported_by_user_id, created_at)
     VALUES (?, 'DPBI/INS/2026/0001', '2026-11-10T11:15:00+07:00', 'Aula SMAN 1 Bogor', '32', 'Kesehatan Ringan Peserta', 'rendah', ?, ?, 'Penanggung Jawab Organisasi', 'selesai', 'usr-korwil-jabar', ?)`
  ).run(
    "inc-1",
    "Salah satu peserta mengalami kelelahan ringan saat sesi siang dan langsung diarahkan beristirahat di ruang UKS didampingi pembina.",
    "Pemberian air minum, istirahat di UKS 20 menit, dan pemberitahuan kepada orang tua.",
    now
  );
  db.prepare(
    `INSERT INTO whistleblowing_reports (id, reference_number, reporter_mode, category, chronology, assigned_handler_role, conflict_rerouted, status, follow_up_note, created_at)
     VALUES (?, 'DPBI/ADU/2026/0001', 'rahasia', 'Tata Kelola Administrasi', ?, 'penanggung_jawab', 0, 'ditinjau', 'Sedang dilakukan klarifikasi tertutup oleh Penanggung Jawab Organisasi.', ?)`
  ).run(
    "adu-1",
    "Laporan simulasi terkait keterlambatan penerbitan surat rekomendasi wilayah oleh salah satu tim administrasi lokal.",
    now
  );
  db.prepare(
    `INSERT INTO evaluations (id, personnel_id, personnel_name, role_code, province_code, batch_id, task_completion_score, report_timeliness_score, report_quality_score, coordination_score, total_score, evaluator_name, coaching_recommendation, status, created_at)
     VALUES (?, 'pers-6', 'Siti Nurhaliza Putri (Simulasi)', 'koordinator_wilayah', '32', 'batch-3', 92, 95, 90, 94, 92.6, 'Niken Larasati (Simulasi)', 'Kinerja sangat baik. Pertahankan ketepatan waktu laporan dan dampingi Duta baru.', 'final', ?)`
  ).run("ev-1", now);
  db.prepare(
    `INSERT INTO evaluations (id, personnel_id, personnel_name, role_code, province_code, batch_id, task_completion_score, report_timeliness_score, report_quality_score, coordination_score, total_score, evaluator_name, coaching_recommendation, status, created_at)
     VALUES (?, 'pers-8', 'Raka Pratama (Simulasi)', 'duta', '32', 'batch-3', 90, 88, 92, 89, 89.8, 'Siti Nurhaliza Putri (Simulasi)', 'Dokumentasi LKL sangat rapi. Tingkatkan koordinasi lintas sekolah pada bulan Desember.', 'final', ?)`
  ).run("ev-2", now);
  db.prepare(
    `INSERT INTO location_verifications (id, user_id, user_name, province_code, action_type, latitude, longitude, matched, verification_mode, reason, created_at)
     VALUES (?, 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', '32', 'review_lkl', -6.9175, 107.6191, 1, 'gps_browser', 'Koordinat terkonfirmasi berada dalam cakupan wilayah Jawa Barat.', ?)`
  ).run("loc-1", now);
  const nStmt = db.prepare(
    `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, ?)`
  );
  nStmt.run("not-1", "usr-super", "1 Permintaan Akun Duta Menunggu Persetujuan", "DPBI/AKUN/2026/0001 diajukan oleh Koordinator Jawa Barat.", "akun", "/personalia", now);
  nStmt.run("not-2", "usr-pengurus", "Proposal Menunggu Keputusan Nasional", "DPBI/PROP/2026/0002 (Simposium Daring Bahasa Daerah) siap ditinjau.", "proposal", "/proposal", now);
  nStmt.run("not-3", "usr-duta-jabar", "Proposal Disetujui", "Proposal DPBI/PROP/2026/0001 telah disetujui oleh Pengurus Nasional.", "proposal", "/proposal", now);
  nStmt.run("not-4", "usr-alumni", "Pengingat Masa Akses Arsip Alumni 30 Hari", "Anda memiliki sisa 18 hari untuk mengekspor sertifikat dan arsip pribadi.", "alumni", "/arsip", now);
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, target_type, target_id, outcome, context_note, created_at)
     VALUES (?, 'usr-pengurus', 'Niken Larasati (Simulasi)', 'pengurus_nasional', 'APPROVE_PROPOSAL', 'proposal', 'DPBI/PROP/2026/0001', 'berhasil', 'Persetujuan bidang kebudayaan dengan syarat 2 pendamping dewasa.', ?)`
  ).run("aud-1", now);
  db.prepare(
    `INSERT INTO audit_logs (id, actor_user_id, actor_name, actor_role, action, target_type, target_id, outcome, context_note, created_at)
     VALUES (?, 'usr-korwil-jabar', 'Siti Nurhaliza Putri (Simulasi)', 'koordinator_wilayah', 'VERIFY_LKL', 'lkl', 'DPBI/LKL/2026/0001', 'berhasil', 'LKL luring diverifikasi dengan konfirmasi lokasi wilayah Jawa Barat.', ?)`
  ).run("aud-2", now);
  const tlStmt = db.prepare(
    `INSERT INTO activity_timeline (id, category, title, description, province_code, batch_id, actor_name, related_path, created_at)
     VALUES (?, ?, ?, ?, ?, 'batch-3', ?, ?, ?)`
  );
  tlStmt.run("tl-1", "Proposal", "Proposal DPBI/PROP/2026/0001 Disetujui", "Pekan Literasi Aksara Sunda Pelajar Jawa Barat memperoleh persetujuan nasional.", "32", "Niken Larasati (Simulasi)", "/proposal", now);
  tlStmt.run("tl-2", "LKL", "LKL DPBI/LKL/2026/0001 Diterima", "Klinik Aksara Sunda Tahap 1 di SMAN 1 Bogor diterima dengan 64 peserta pelajar.", "32", "Siti Nurhaliza Putri (Simulasi)", "/laporan-kegiatan", now);
  tlStmt.run("tl-3", "Dokumen", "SOP Perlindungan Peserta v2.1 Diterbitkan", "Pembaruan standar pendampingan peserta di bawah 18 tahun berlaku nasional.", null, "Dr. Hendra Wijaya (Simulasi)", "/dokumen", now);
}

// server/routes.ts
import crypto3 from "node:crypto";
import fs3 from "node:fs";
import path3 from "node:path";
import multer from "multer";
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});
function maskPersonnelRow(row, viewer) {
  const isOwner = viewer?.personnelId === row.id;
  const canSeeSensitive = isOwner || ["super_admin", "wakil_super_admin", "sekretariat_nasional", "penanggung_jawab"].includes(
    viewer?.role ?? ""
  ) || viewer?.role === "koordinator_wilayah" && viewer.provinceCode === row.province_code;
  const docsChecklist = JSON.parse(String(row.docs_checklist_json || "{}"));
  const comp = calculateProfileCompleteness({
    fullName: String(row.full_name || ""),
    birthPlace: String(row.birth_place || ""),
    birthDate: String(row.birth_date || ""),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    provinceCode: String(row.province_code || ""),
    regency: String(row.regency || ""),
    fullAddress: String(row.full_address || ""),
    schoolName: String(row.school_name || ""),
    educationLevel: String(row.education_level || ""),
    gradeClass: String(row.grade_class || ""),
    guardianName: String(row.guardian_name || ""),
    guardianPhone: String(row.guardian_phone || ""),
    docsChecklist
  });
  return {
    id: String(row.id),
    memberNumber: String(row.member_number),
    referenceNumber: String(row.reference_number),
    userId: row.user_id ? String(row.user_id) : null,
    fullName: String(row.full_name),
    nickname: String(row.nickname || ""),
    birthPlace: canSeeSensitive ? String(row.birth_place || "") : "Terlindungi",
    birthDate: canSeeSensitive ? String(row.birth_date || "") : "Terlindungi",
    gender: String(row.gender || ""),
    email: String(row.email),
    phone: canSeeSensitive ? String(row.phone || "") : "Terlindungi",
    provinceCode: String(row.province_code),
    provinceName: PROVINCE_BY_CODE.get(String(row.province_code))?.name ?? String(row.province_code),
    regency: String(row.regency || ""),
    district: canSeeSensitive ? String(row.district || "") : "",
    village: canSeeSensitive ? String(row.village || "") : "",
    postalCode: canSeeSensitive ? String(row.postal_code || "") : "",
    fullAddress: canSeeSensitive ? String(row.full_address || "") : "Akses alamat dibatasi",
    schoolName: String(row.school_name || ""),
    educationLevel: String(row.education_level || ""),
    gradeClass: String(row.grade_class || ""),
    major: String(row.major || ""),
    npsn: String(row.npsn || ""),
    nisn: canSeeSensitive ? String(row.nisn || "") : "********",
    entryYear: Number(row.entry_year || 2024),
    expectedGradYear: Number(row.expected_grad_year || 2027),
    schoolAddress: String(row.school_address || ""),
    schoolRegency: String(row.school_regency || ""),
    schoolProvince: String(row.school_province || ""),
    batchId: String(row.batch_id),
    batchName: String(row.batch_name || row.batch_id),
    positionTitle: String(row.position_title || ""),
    bidang: String(row.bidang || ""),
    roleCode: row.role_code,
    appointedAt: String(row.appointed_at || ""),
    termStartsAt: String(row.term_starts_at || ""),
    termEndsAt: String(row.term_ends_at || ""),
    personnelStatus: String(row.personnel_status),
    verificationStatus: String(row.verification_status),
    verificationNote: row.verification_note ? String(row.verification_note) : null,
    culturalInterests: String(row.cultural_interests || ""),
    activityInterests: String(row.activity_interests || ""),
    orgExperience: String(row.org_experience || ""),
    skills: String(row.skills || ""),
    guardianName: canSeeSensitive ? String(row.guardian_name || "") : "Terlindungi",
    guardianRelation: canSeeSensitive ? String(row.guardian_relation || "") : "-",
    guardianPhone: canSeeSensitive ? String(row.guardian_phone || "") : "Terlindungi",
    docsChecklist,
    avatarFileId: row.avatar_file_id ? String(row.avatar_file_id) : null,
    completenessScore: comp.score,
    missingFields: comp.missingFields,
    restrictedFieldsMasked: !canSeeSensitive
  };
}
function registerCoreRoutes(app) {
  app.get("/api/public/overview", (_req, res) => {
    const db = getDb();
    const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    const statsApprovedRow = db.prepare("SELECT value FROM system_settings WHERE key = 'public_stats_approved'").get();
    const statsApproved = statsApprovedRow?.value === "true";
    let publicStats = null;
    if (statsApproved) {
      const activeProvinces = db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'aktif'").get().c;
      const activePersonnel = db.prepare("SELECT COUNT(*) AS c FROM personnel WHERE personnel_status = 'aktif'").get().c;
      const approvedActivities = db.prepare("SELECT COUNT(*) AS c FROM lkl_reports WHERE status = 'diterima'").get().c;
      const activeBatches = db.prepare("SELECT COUNT(*) AS c FROM batches WHERE status = 'aktif'").get().c;
      publicStats = {
        activeProvinces,
        totalProvinces: 38,
        activePersonnel,
        approvedActivities,
        activeBatches
      };
    }
    const demoAccounts = IS_DEMO_MODE ? db.prepare(
      "SELECT id, email, full_name, role, bidang, province_code FROM users WHERE is_demo = 1 ORDER BY created_at ASC"
    ).all().map((u) => ({
      id: String(u.id),
      email: String(u.email),
      fullName: String(u.full_name),
      role: String(u.role),
      roleLabel: ROLE_LABELS[u.role] ?? String(u.role),
      provinceName: u.province_code ? PROVINCE_BY_CODE.get(String(u.province_code))?.name ?? null : null
    })) : [];
    res.json({
      isDemoMode: IS_DEMO_MODE,
      bootstrapRequired: !IS_DEMO_MODE && userCount === 0,
      statsApproved,
      publicStats,
      demoAccounts
    });
  });
  app.post("/api/auth/bootstrap", (req, res) => {
    const db = getDb();
    const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get().c;
    if (userCount > 0) {
      res.status(403).json({
        error: "Bootstrap awal telah dinonaktifkan karena Super Admin sudah terdaftar."
      });
      return;
    }
    const { fullName, email, password } = req.body ?? {};
    if (!fullName || !email || !password || String(password).length < 10) {
      res.status(422).json({
        error: "Nama lengkap, email resmi, dan password minimal 10 karakter wajib diisi."
      });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = crypto3.randomUUID();
    const persId = crypto3.randomUUID();
    const refNo = nextReferenceNumber(db, "PERS");
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(
        `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
         VALUES ('batch-init', 1, 'Angkatan I \u2014 Periode Awal', ?, ?, ?, ?, ?, 4, 'aktif', ?)`
      ).run(now.slice(0, 10), now.slice(0, 10), now.slice(0, 10), now.slice(0, 10), "2027-03-15", now);
      db.prepare(
        `INSERT INTO personnel (id, member_number, reference_number, user_id, full_name, email, province_code, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
         VALUES (?, 'DPBI-2026-0001', ?, ?, ?, ?, '31', 'batch-init', 'Super Admin Sistem', 'Tata Kelola Nasional', 'super_admin', 'aktif', 'terverifikasi', '{}', ?, ?)`
      ).run(persId, refNo, userId, String(fullName).trim(), String(email).trim().toLowerCase(), now, now);
      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, bidang, province_code, batch_id, personnel_id, account_status, is_demo, created_at)
         VALUES (?, ?, ?, ?, 'super_admin', 'Tata Kelola Nasional', '31', 'batch-init', ?, 'aktif', 0, ?)`
      ).run(userId, String(email).trim().toLowerCase(), hashPassword(String(password)), String(fullName).trim(), persId, now);
      writeAuditLog(db, { id: userId, fullName: String(fullName), role: "super_admin" }, "BOOTSTRAP_SUPER_ADMIN", "user", userId, "berhasil", "Pendaftaran satu kali Super Admin pertama.");
      db.exec("COMMIT;");
    } catch (err) {
      db.exec("ROLLBACK;");
      res.status(500).json({ error: "Gagal membuat akun Super Admin awal." });
      return;
    }
    const { rawToken } = createSession(db, userId, req.headers["user-agent"]?.slice(0, 80) || "Browser", req.ip || "127.0.0.1");
    setSessionCookie(res, rawToken);
    res.status(201).json({ ok: true, message: "Super Admin berhasil diinisialisasi. Endpoint bootstrap kini dikunci." });
  });
  app.post("/api/auth/login", (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    if (!email || !password) {
      res.status(422).json({ error: "Email dan kata sandi wajib diisi." });
      return;
    }
    const throttleKey = `${req.ip}:${email}`;
    const throttle = checkLoginThrottle(throttleKey);
    if (!throttle.allowed) {
      res.status(429).json({
        error: `Terlalu banyak percobaan masuk gagal. Silakan coba lagi dalam ${throttle.retryAfterSec} detik.`,
        code: 429
      });
      return;
    }
    const db = getDb();
    const userRow = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
    if (!userRow || !verifyPassword(password, String(userRow.password_hash))) {
      recordLoginFailure(throttleKey);
      res.status(401).json({ error: "Email atau kata sandi tidak sesuai.", code: 401 });
      return;
    }
    if (userRow.account_status === "menunggu_persetujuan") {
      res.status(403).json({
        error: "Akun Anda sedang menunggu persetujuan Sekretariat Nasional.",
        code: 403,
        accountStatus: "menunggu_persetujuan"
      });
      return;
    }
    if (userRow.account_status === "nonaktif" || userRow.account_status === "terkunci") {
      res.status(403).json({ error: "Akun ini sedang dinonaktifkan atau terkunci.", code: 403 });
      return;
    }
    if (userRow.role === "alumni" && userRow.alumni_access_expires_at) {
      if (Date.parse(String(userRow.alumni_access_expires_at)) < Date.now()) {
        res.status(403).json({
          error: "Masa akses arsip Alumni 30 hari telah berakhir. Hubungi Sekretariat Nasional.",
          code: 403
        });
        return;
      }
    }
    clearLoginFailures(throttleKey);
    const userId = String(userRow.id);
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), userId);
    const { rawToken } = createSession(
      db,
      userId,
      String(req.headers["user-agent"] || "Web Browser").slice(0, 80),
      req.ip || "127.0.0.1"
    );
    setSessionCookie(res, rawToken);
    writeAuditLog(
      db,
      { id: userId, fullName: String(userRow.full_name), role: String(userRow.role) },
      "LOGIN",
      "session",
      userId,
      "berhasil",
      IS_DEMO_MODE ? "Login lingkungan simulasi" : "Login portal internal"
    );
    res.json({ ok: true });
  });
  app.post("/api/auth/demo-switch", (req, res) => {
    if (!IS_DEMO_MODE) {
      res.status(403).json({ error: "Mode Demo dinonaktifkan pada lingkungan produksi." });
      return;
    }
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const db = getDb();
    const userRow = db.prepare("SELECT * FROM users WHERE email = ? AND is_demo = 1").get(email);
    if (!userRow) {
      res.status(404).json({ error: "Akun simulasi tidak ditemukan." });
      return;
    }
    const userId = String(userRow.id);
    db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run((/* @__PURE__ */ new Date()).toISOString(), userId);
    const { rawToken } = createSession(db, userId, "Demo Role Switcher", req.ip || "127.0.0.1");
    setSessionCookie(res, rawToken);
    writeAuditLog(
      db,
      { id: userId, fullName: String(userRow.full_name), role: String(userRow.role) },
      "DEMO_SWITCH",
      "session",
      userId,
      "berhasil",
      "Berpindah peran simulasi demo"
    );
    res.json({ ok: true });
  });
  app.post("/api/auth/logout", requireAuth, (req, res) => {
    const db = getDb();
    if (req.sessionId) {
      db.prepare("DELETE FROM sessions WHERE id = ?").run(req.sessionId);
    }
    if (req.authUser) {
      writeAuditLog(db, req.authUser, "LOGOUT", "session", req.authUser.id);
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  app.get("/api/auth/session", (req, res) => {
    const resolved = resolveOptionalAuth(req, res);
    if (!resolved) {
      res.json({ authenticated: false, user: null, isDemoMode: IS_DEMO_MODE, expiredReason: null });
      return;
    }
    if ("expiredReason" in resolved && resolved.user === null) {
      res.json({
        authenticated: false,
        user: null,
        isDemoMode: IS_DEMO_MODE,
        expiredReason: resolved.expiredReason
      });
      return;
    }
    res.json({
      authenticated: true,
      user: resolved.user,
      isDemoMode: IS_DEMO_MODE,
      sessionExpiresAt: resolved.expiresAt,
      idleMinutes: resolved.idleMinutes,
      expiredReason: null
    });
  });
  app.get("/api/auth/me", requireAuth, (req, res) => {
    res.json({ user: req.authUser, isDemoMode: IS_DEMO_MODE });
  });
  app.get("/api/auth/sessions", requireAuth, (req, res) => {
    const db = getDb();
    const rows = db.prepare("SELECT id, device_label, ip_address, expires_at, created_at, last_seen_at FROM sessions WHERE user_id = ? ORDER BY last_seen_at DESC").all(req.authUser.id);
    res.json({
      sessions: rows.map((r) => ({
        id: String(r.id),
        deviceLabel: String(r.device_label),
        ipAddress: String(r.ip_address),
        expiresAt: String(r.expires_at),
        createdAt: String(r.created_at),
        lastSeenAt: String(r.last_seen_at),
        isCurrent: String(r.id) === req.sessionId
      }))
    });
  });
  app.delete("/api/auth/sessions/:id", requireAuth, (req, res) => {
    const db = getDb();
    const targetId = String(req.params.id);
    const owned = db.prepare("SELECT id FROM sessions WHERE id = ? AND user_id = ?").get(targetId, req.authUser.id);
    if (!owned) {
      res.status(404).json({ error: "Sesi perangkat tidak ditemukan." });
      return;
    }
    db.prepare("DELETE FROM sessions WHERE id = ?").run(targetId);
    writeAuditLog(db, req.authUser, "REVOKE_SINGLE_SESSION", "session", targetId);
    if (targetId === req.sessionId) {
      clearSessionCookie(res);
    }
    res.json({ ok: true, revokedCurrent: targetId === req.sessionId });
  });
  app.post("/api/auth/sessions/revoke-all", requireAuth, (req, res) => {
    const db = getDb();
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(req.authUser.id);
    writeAuditLog(db, req.authUser, "REVOKE_ALL_SESSIONS", "user", req.authUser.id);
    clearSessionCookie(res);
    res.json({ ok: true });
  });
  app.post("/api/auth/change-password", requireAuth, (req, res) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (!currentPassword || !newPassword || String(newPassword).length < 8) {
      res.status(422).json({ error: "Kata sandi saat ini dan kata sandi baru (minimal 8 karakter) wajib diisi." });
      return;
    }
    const db = getDb();
    const userRow = db.prepare("SELECT * FROM users WHERE id = ?").get(req.authUser.id);
    if (!userRow || !verifyPassword(String(currentPassword), String(userRow.password_hash))) {
      res.status(401).json({ error: "Kata sandi saat ini tidak sesuai." });
      return;
    }
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(String(newPassword)), req.authUser.id);
    db.prepare("DELETE FROM sessions WHERE user_id = ? AND id != ?").run(req.authUser.id, req.sessionId || "");
    const rotated = rotateSession(
      db,
      req.sessionId,
      req.authUser.id,
      String(req.headers["user-agent"] || "Web Browser").slice(0, 80),
      req.ip || "127.0.0.1"
    );
    setSessionCookie(res, rotated.rawToken);
    writeAuditLog(db, req.authUser, "CHANGE_PASSWORD_ROTATE_SESSION", "user", req.authUser.id);
    res.json({ ok: true, message: "Kata sandi diperbarui dan ID sesi dirotasi dengan aman." });
  });
  app.patch("/api/auth/profile", requireAuth, (req, res) => {
    const { fullName, notificationPrefs } = req.body ?? {};
    const db = getDb();
    const user = req.authUser;
    if (fullName && String(fullName).trim().length >= 3) {
      db.prepare("UPDATE users SET full_name = ? WHERE id = ?").run(String(fullName).trim(), user.id);
      if (user.personnelId) {
        db.prepare("UPDATE personnel SET full_name = ?, updated_at = ? WHERE id = ?").run(
          String(fullName).trim(),
          (/* @__PURE__ */ new Date()).toISOString(),
          user.personnelId
        );
      }
    }
    if (notificationPrefs && typeof notificationPrefs === "object") {
      db.prepare("UPDATE users SET notification_prefs_json = ? WHERE id = ?").run(
        JSON.stringify(notificationPrefs),
        user.id
      );
    }
    writeAuditLog(db, user, "UPDATE_SELF_PROFILE", "user", user.id);
    res.json({ ok: true });
  });
  app.get("/api/auth/login-history", requireAuth, (req, res) => {
    const db = getDb();
    const logs = db.prepare(
      `SELECT id, action, outcome, context_note, created_at
         FROM audit_logs
         WHERE actor_user_id = ? AND action IN ('LOGIN', 'DEMO_SWITCH', 'LOGOUT', 'REVOKE_ALL_SESSIONS', 'CHANGE_PASSWORD_ROTATE_SESSION')
         ORDER BY created_at DESC LIMIT 20`
    ).all(req.authUser.id);
    res.json({ logs });
  });
  app.post("/api/auth/request-reset", (req, res) => {
    const email = String(req.body?.email ?? "").trim().toLowerCase();
    if (!email) {
      res.status(422).json({ error: "Masukkan email akun yang terdaftar." });
      return;
    }
    const db = getDb();
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
    if (user) {
      const rawToken = crypto3.randomBytes(24).toString("hex");
      const tokenHash = sha256(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3).toISOString();
      db.prepare(
        "INSERT INTO password_resets (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)"
      ).run(crypto3.randomUUID(), user.id, tokenHash, expiresAt, (/* @__PURE__ */ new Date()).toISOString());
      res.json({
        ok: true,
        message: "Jika email terdaftar, instruksi reset password telah diproses.",
        ...IS_DEMO_MODE ? { demoResetToken: rawToken } : {}
      });
      return;
    }
    res.json({ ok: true, message: "Jika email terdaftar, instruksi reset password telah diproses." });
  });
  app.post("/api/auth/complete-reset", (req, res) => {
    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword || String(newPassword).length < 8) {
      res.status(422).json({ error: "Token valid dan password baru minimal 8 karakter diperlukan." });
      return;
    }
    const db = getDb();
    const row = db.prepare("SELECT * FROM password_resets WHERE token_hash = ? AND used_at IS NULL").get(sha256(String(token)));
    if (!row || Date.parse(String(row.expires_at)) < Date.now()) {
      res.status(400).json({ error: "Token reset password tidak valid atau sudah kedaluwarsa." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(String(newPassword)), String(row.user_id));
    db.prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(now, String(row.id));
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(String(row.user_id));
    res.json({ ok: true, message: "Kata sandi berhasil diperbarui." });
  });
  app.post("/api/auth/accept-invitation", (req, res) => {
    const { token, password } = req.body ?? {};
    if (!token || !password || String(password).length < 8) {
      res.status(422).json({ error: "Token undangan dan kata sandi minimal 8 karakter wajib diisi." });
      return;
    }
    const db = getDb();
    const inv = db.prepare("SELECT * FROM invitations WHERE token_hash = ? AND used_at IS NULL").get(sha256(String(token)));
    if (!inv || Date.parse(String(inv.expires_at)) < Date.now()) {
      res.status(400).json({ error: "Undangan tidak valid atau telah kedaluwarsa." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = crypto3.randomUUID();
    const persId = crypto3.randomUUID();
    const refNo = nextReferenceNumber(db, "PERS");
    const memberNo = `DPBI-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Math.floor(1e3 + Math.random() * 8999))}`;
    db.exec("BEGIN IMMEDIATE;");
    try {
      db.prepare(
        `INSERT INTO personnel (id, member_number, reference_number, user_id, full_name, email, province_code, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Duta Pelajar Berbudaya', 'Kebudayaan', ?, 'aktif', 'belum_lengkap', '{}', ?, ?)`
      ).run(persId, memberNo, refNo, userId, String(inv.full_name), String(inv.email), String(inv.province_code || "31"), String(inv.batch_id || "batch-3"), String(inv.role), now, now);
      db.prepare(
        `INSERT INTO users (id, email, password_hash, full_name, role, province_code, batch_id, personnel_id, account_status, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?, ?)`
      ).run(userId, String(inv.email), hashPassword(String(password)), String(inv.full_name), String(inv.role), String(inv.province_code || "31"), String(inv.batch_id || "batch-3"), persId, IS_DEMO_MODE ? 1 : 0, now);
      db.prepare("UPDATE invitations SET used_at = ? WHERE id = ?").run(now, String(inv.id));
      db.exec("COMMIT;");
    } catch {
      db.exec("ROLLBACK;");
      res.status(500).json({ error: "Gagal mengaktifkan akun undangan." });
      return;
    }
    res.json({ ok: true, message: "Akun berhasil diaktifkan. Silakan masuk menggunakan email dan password Anda." });
  });
  app.post("/api/files/upload", requireAuth, upload.single("file"), (req, res) => {
    const file = req.file;
    if (!file) {
      res.status(422).json({ error: "Tidak ada berkas yang diunggah." });
      return;
    }
    const check = inspectFileMagicBytes(file.buffer, file.mimetype, file.originalname);
    if (!check.valid) {
      res.status(422).json({ error: check.reason || "Berkas gagal validasi keamanan." });
      return;
    }
    const db = getDb();
    const checksum = sha256(file.buffer);
    const moduleName = String(req.body?.module || "umum");
    const existing = db.prepare("SELECT id, original_name, mime_type, size_bytes FROM stored_files WHERE checksum_sha256 = ?").get(checksum);
    if (existing) {
      res.json({
        fileId: String(existing.id),
        fileName: file.originalname,
        mimeType: String(existing.mime_type),
        sizeBytes: Number(existing.size_bytes),
        deduplicated: true
      });
      return;
    }
    const fileId = crypto3.randomUUID();
    const ext = path3.extname(file.originalname).toLowerCase().replace(/[^a-z0-9.]/g, "") || ".bin";
    const storedName = `${fileId}${ext}`;
    fs3.writeFileSync(path3.join(PRIVATE_STORAGE_DIR, storedName), file.buffer);
    db.prepare(
      `INSERT INTO stored_files (id, original_name, stored_name, mime_type, size_bytes, checksum_sha256, module, uploaded_by, is_archived, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`
    ).run(
      fileId,
      file.originalname,
      storedName,
      check.detectedMime,
      file.size,
      checksum,
      moduleName,
      req.authUser.id,
      (/* @__PURE__ */ new Date()).toISOString()
    );
    writeAuditLog(db, req.authUser, "UPLOAD_FILE", "file", fileId, "berhasil", `${file.originalname} (${check.detectedMime})`);
    res.status(201).json({
      fileId,
      fileName: file.originalname,
      mimeType: check.detectedMime,
      sizeBytes: file.size,
      deduplicated: false
    });
  });
  const serveStoredFile = (req, res, forceDownload) => {
    const db = getDb();
    const fileId = String(req.params.id).replace(/[^a-zA-Z0-9-]/g, "");
    const row = db.prepare("SELECT * FROM stored_files WHERE id = ?").get(fileId);
    if (!row) {
      res.status(404).json({ error: "Berkas tidak ditemukan." });
      return;
    }
    const safeStored = path3.basename(String(row.stored_name));
    const fullPath = path3.join(PRIVATE_STORAGE_DIR, safeStored);
    if (!fullPath.startsWith(PRIVATE_STORAGE_DIR) || !fs3.existsSync(fullPath)) {
      res.status(404).json({ error: "Berkas fisik tidak ditemukan di penyimpanan privat." });
      return;
    }
    writeAuditLog(db, req.authUser, forceDownload ? "DOWNLOAD_FILE" : "PREVIEW_FILE", "file", fileId, "berhasil", String(row.original_name));
    res.setHeader("Content-Type", String(row.mime_type));
    res.setHeader(
      "Content-Disposition",
      `${forceDownload ? "attachment" : "inline"}; filename="${encodeURIComponent(String(row.original_name))}"`
    );
    res.sendFile(fullPath);
  };
  app.get("/api/files/:id/preview", requireAuth, (req, res) => {
    serveStoredFile(req, res, false);
  });
  app.get("/api/files/:id", requireAuth, (req, res) => {
    serveStoredFile(req, res, req.query.download === "1");
  });
  app.get("/api/dashboard", requireAuth, (req, res) => {
    const db = getDb();
    const user = req.authUser;
    const isNational = ["super_admin", "wakil_super_admin", "penanggung_jawab", "pengurus_nasional", "sekretariat_nasional"].includes(user.role);
    const isKorwil = user.role === "koordinator_wilayah";
    const provFilter = isKorwil && user.provinceCode ? `WHERE province_code = '${user.provinceCode.replace(/[^0-9]/g, "")}'` : "";
    const personnelFilter = user.role === "duta" || user.role === "alumni" ? `WHERE id = '${(user.personnelId || "").replace(/[^a-zA-Z0-9-]/g, "")}'` : provFilter;
    const totalPersonnel = db.prepare(`SELECT COUNT(*) AS c FROM personnel ${personnelFilter}`).get().c;
    const activeDuta = db.prepare(`SELECT COUNT(*) AS c FROM personnel ${personnelFilter ? personnelFilter + " AND role_code = 'duta' AND personnel_status = 'aktif'" : "WHERE role_code = 'duta' AND personnel_status = 'aktif'"}`).get().c;
    const activeProvinces = db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'aktif'").get().c;
    const pendingProposals = db.prepare(
      `SELECT COUNT(*) AS c FROM proposals ${user.role === "duta" ? `WHERE applicant_personnel_id = '${user.personnelId || ""}' AND status IN ('diajukan', 'menunggu_persetujuan_nasional', 'perlu_revisi')` : isKorwil && user.provinceCode ? `WHERE province_code = '${user.provinceCode}' AND status IN ('diajukan', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')` : "WHERE status IN ('diajukan', 'pemeriksaan_administrasi', 'pemeriksaan_wilayah', 'menunggu_persetujuan_nasional', 'perlu_revisi')"}`
    ).get().c;
    const pendingLkl = db.prepare(
      `SELECT COUNT(*) AS c FROM lkl_reports ${user.role === "duta" ? `WHERE submitter_personnel_id = '${user.personnelId || ""}' AND status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')` : isKorwil && user.provinceCode ? `WHERE province_code = '${user.provinceCode}' AND status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')` : "WHERE status IN ('diajukan', 'menunggu_pemeriksaan', 'perlu_revisi')"}`
    ).get().c;
    const overdueTasks = db.prepare(
      `SELECT COUNT(*) AS c FROM tasks WHERE status NOT IN ('selesai', 'dibatalkan') AND deadline < ? ${user.role === "duta" ? `AND assignee_id = '${user.id}'` : isKorwil && user.provinceCode ? `AND province_code = '${user.provinceCode}'` : ""}`
    ).get((/* @__PURE__ */ new Date()).toISOString().slice(0, 10)).c;
    const unreadNotifications = db.prepare("SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0").get(user.id).c;
    const totalStorageBytes = db.prepare("SELECT COALESCE(SUM(size_bytes), 0) AS s FROM stored_files").get().s;
    const attentionItems = [];
    if (isNational || isKorwil) {
      if (pendingProposals > 0) {
        attentionItems.push({
          id: "att-prop",
          level: "perhatian",
          title: `${pendingProposals} Proposal Menunggu Tindak Lanjut`,
          detail: "Terdapat pengajuan proposal kegiatan yang memerlukan peninjauan atau revisi.",
          path: "/proposal"
        });
      }
      if (pendingLkl > 0) {
        attentionItems.push({
          id: "att-lkl",
          level: "perhatian",
          title: `${pendingLkl} LKL Menunggu Pemeriksaan`,
          detail: "Laporan Kegiatan Lapangan perlu diverifikasi oleh Koordinator Wilayah.",
          path: "/laporan-kegiatan"
        });
      }
    }
    if (user.role === "super_admin" || user.role === "sekretariat_nasional") {
      const pendingAccReq = db.prepare("SELECT COUNT(*) AS c FROM account_requests WHERE status = 'menunggu'").get().c;
      if (pendingAccReq > 0) {
        attentionItems.push({
          id: "att-acc",
          level: "info",
          title: `${pendingAccReq} Permintaan Akun Duta Baru`,
          detail: "Diajukan oleh Koordinator Wilayah untuk verifikasi Sekretariat/Admin.",
          path: "/personalia"
        });
      }
      const coachingProv = db.prepare("SELECT COUNT(*) AS c FROM provinces WHERE status = 'dalam_pembinaan'").get().c;
      if (coachingProv > 0) {
        attentionItems.push({
          id: "att-prov",
          level: "perhatian",
          title: `${coachingProv} Provinsi dalam Status Pembinaan`,
          detail: "Perlu pendampingan koordinasi wilayah dan penetapan koordinator aktif.",
          path: "/wilayah"
        });
      }
    }
    if (overdueTasks > 0) {
      attentionItems.push({
        id: "att-task",
        level: "kritis",
        title: `${overdueTasks} Tugas Melewati Tenggat`,
        detail: "Segera selesaikan atau eskalasikan tugas operasional terkait.",
        path: "/tugas"
      });
    }
    if (user.role === "penanggung_jawab" || user.role === "super_admin") {
      const newAduan = db.prepare("SELECT COUNT(*) AS c FROM whistleblowing_reports WHERE status IN ('baru', 'ditinjau')").get().c;
      if (newAduan > 0) {
        attentionItems.push({
          id: "att-adu",
          level: "kritis",
          title: `${newAduan} Laporan Pengaduan Membutuhkan Tindak Lanjut Berwenang`,
          detail: "Akses terbatas hanya untuk Penanggung Jawab dan pihak berwenang.",
          path: "/perlindungan"
        });
      }
    }
    if (user.role === "alumni" && user.alumniAccessExpiresAt) {
      const win = calculateAlumniWindow(
        new Date(Date.parse(user.alumniAccessExpiresAt) - 30 * 24 * 60 * 60 * 1e3).toISOString()
      );
      attentionItems.push({
        id: "att-alumni",
        level: win.daysRemaining <= 7 ? "kritis" : "info",
        title: `Masa Akses Arsip Alumni Tersisa ${win.daysRemaining} Hari`,
        detail: "Unduh sertifikat dan ekspor riwayat kegiatan pribadi sebelum masa akses 30 hari berakhir.",
        path: "/arsip"
      });
    }
    const personnelPerBatch = db.prepare(
      `SELECT b.name AS batchName, COUNT(p.id) AS total
           FROM batches b
           LEFT JOIN personnel p ON p.batch_id = b.id
           GROUP BY b.id
           ORDER BY b.batch_number ASC`
    ).all().map((r) => ({ name: r.batchName.split("\u2014")[0].trim(), jumlah: r.total }));
    const provinceStatusChart = db.prepare(
      `SELECT status, COUNT(*) AS total FROM provinces GROUP BY status`
    ).all().map((r) => ({ status: r.status.replace(/_/g, " "), total: r.total }));
    const topProvinceActivities = db.prepare(
      `SELECT pr.name AS provinceName,
                  (SELECT COUNT(*) FROM proposals p WHERE p.province_code = pr.code) AS proposalCount,
                  (SELECT COUNT(*) FROM lkl_reports l WHERE l.province_code = pr.code) AS lklCount
           FROM provinces pr
           WHERE pr.status IN ('aktif', 'dalam_pengembangan')
           ORDER BY (proposalCount + lklCount) DESC, pr.name ASC
           LIMIT 8`
    ).all();
    const recentActivities = db.prepare(
      `SELECT id, category, title, description, province_code, actor_name, related_path, created_at
           FROM activity_timeline
           ${isKorwil && user.provinceCode ? `WHERE province_code IS NULL OR province_code = '${user.provinceCode}'` : ""}
           ORDER BY created_at DESC
           LIMIT 8`
    ).all().map((a) => ({
      id: String(a.id),
      category: String(a.category),
      title: String(a.title),
      description: String(a.description),
      provinceName: a.province_code ? PROVINCE_BY_CODE.get(String(a.province_code))?.name ?? null : null,
      actorName: String(a.actor_name),
      relatedPath: String(a.related_path),
      createdAt: String(a.created_at)
    }));
    const upcomingEvents = db.prepare("SELECT id, title, category, start_at, location FROM calendar_events ORDER BY start_at ASC LIMIT 5").all().map((e) => ({
      id: String(e.id),
      title: String(e.title),
      category: String(e.category),
      startAt: String(e.start_at),
      location: String(e.location)
    }));
    res.json({
      summary: {
        totalPersonnel,
        activeDuta,
        activeProvinces,
        totalProvinces: 38,
        pendingProposals,
        pendingLkl,
        overdueTasks,
        unreadNotifications,
        totalStorageBytes
      },
      attentionItems,
      charts: {
        personnelPerBatch,
        provinceStatusChart,
        topProvinceActivities
      },
      recentActivities,
      upcomingEvents
    });
  });
  app.get("/api/search", requireAuth, (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (!q) {
      res.json({ results: [] });
      return;
    }
    const db = getDb();
    const user = req.authUser;
    const like = `%${q}%`;
    const results = [];
    const provs = db.prepare("SELECT code, name, status FROM provinces WHERE LOWER(name) LIKE ? LIMIT 5").all(like);
    for (const p of provs) {
      results.push({ type: "Wilayah", title: String(p.name), subtitle: `Kode ${p.code} \xB7 Status ${String(p.status).replace(/_/g, " ")}`, path: "/wilayah" });
    }
    if (hasPermission(user.permissions, "personalia", "view")) {
      let sql = "SELECT id, full_name, member_number, province_code FROM personnel WHERE (LOWER(full_name) LIKE ? OR LOWER(member_number) LIKE ?)";
      if (user.role === "duta" || user.role === "alumni") {
        sql += ` AND id = '${user.personnelId || ""}'`;
      } else if (user.role === "koordinator_wilayah" && user.provinceCode) {
        sql += ` AND province_code = '${user.provinceCode}'`;
      }
      sql += " LIMIT 5";
      const pers = db.prepare(sql).all(like, like);
      for (const p of pers) {
        results.push({ type: "Personalia", title: String(p.full_name), subtitle: `${p.member_number} \xB7 ${PROVINCE_BY_CODE.get(String(p.province_code))?.name ?? ""}`, path: "/personalia" });
      }
    }
    if (hasPermission(user.permissions, "proposal", "view")) {
      const props = db.prepare("SELECT reference_number, title, status FROM proposals WHERE (LOWER(title) LIKE ? OR LOWER(reference_number) LIKE ?) LIMIT 5").all(like, like);
      for (const pr of props) {
        results.push({ type: "Proposal", title: String(pr.title), subtitle: `${pr.reference_number} \xB7 ${String(pr.status).replace(/_/g, " ")}`, path: "/proposal" });
      }
    }
    if (hasPermission(user.permissions, "lkl", "view")) {
      const lmls = db.prepare("SELECT reference_number, activity_name, status FROM lkl_reports WHERE (LOWER(activity_name) LIKE ? OR LOWER(reference_number) LIKE ?) LIMIT 5").all(like, like);
      for (const l of lmls) {
        results.push({ type: "LKL", title: String(l.activity_name), subtitle: `${l.reference_number} \xB7 ${String(l.status).replace(/_/g, " ")}`, path: "/laporan-kegiatan" });
      }
    }
    if (hasPermission(user.permissions, "dokumen", "view")) {
      const docs = db.prepare("SELECT document_number, title, category FROM documents WHERE (LOWER(title) LIKE ? OR LOWER(document_number) LIKE ?) LIMIT 5").all(like, like);
      for (const d of docs) {
        results.push({ type: "Dokumen", title: String(d.title), subtitle: `${d.document_number} \xB7 ${d.category}`, path: "/dokumen" });
      }
    }
    res.json({ results });
  });
  app.get("/api/provinces", requireAuth, (_req, res) => {
    const db = getDb();
    const rows = db.prepare(
      `SELECT pr.*,
          (SELECT COUNT(*) FROM personnel p WHERE p.province_code = pr.code AND p.role_code = 'duta' AND p.personnel_status = 'aktif') AS active_duta_count,
          (SELECT COUNT(*) FROM personnel p WHERE p.province_code = pr.code AND p.personnel_status = 'alumni') AS alumni_count,
          (SELECT COUNT(*) FROM proposals prop WHERE prop.province_code = pr.code) AS proposal_count,
          (SELECT COUNT(*) FROM lkl_reports l WHERE l.province_code = pr.code) AS lkl_count
         FROM provinces pr
         ORDER BY pr.code ASC`
    ).all();
    res.json({
      provinces: rows.map((r) => ({
        code: String(r.code),
        name: String(r.name),
        island: String(r.island),
        status: String(r.status),
        coordinatorId: r.coordinator_id ? String(r.coordinator_id) : null,
        coordinatorName: r.coordinator_name ? String(r.coordinator_name) : null,
        activeDutaCount: Number(r.active_duta_count),
        alumniCount: Number(r.alumni_count),
        proposalCount: Number(r.proposal_count),
        lklCount: Number(r.lkl_count),
        monthlyReportSubmitted: Number(r.lkl_count) > 0,
        finalReportSubmitted: false,
        coachingNote: r.coaching_note ? String(r.coaching_note) : null,
        minLat: Number(r.min_lat),
        maxLat: Number(r.max_lat),
        minLng: Number(r.min_lng),
        maxLng: Number(r.max_lng),
        centerLat: Number(r.center_lat),
        centerLng: Number(r.center_lng)
      }))
    });
  });
  app.patch("/api/provinces/:code", requireAuth, requirePermission("wilayah", "edit"), (req, res) => {
    const code = String(req.params.code);
    const user = req.authUser;
    if (user.role === "koordinator_wilayah" && user.provinceCode !== code) {
      res.status(403).json({ error: "Koordinator Wilayah hanya dapat memperbarui provinsi penugasannya." });
      return;
    }
    const { status, coordinatorName, coachingNote } = req.body ?? {};
    const db = getDb();
    db.prepare("UPDATE provinces SET status = COALESCE(?, status), coordinator_name = COALESCE(?, coordinator_name), coaching_note = COALESCE(?, coaching_note) WHERE code = ?").run(
      status ?? null,
      coordinatorName ?? null,
      coachingNote ?? null,
      code
    );
    writeAuditLog(db, user, "UPDATE_PROVINCE", "province", code, "berhasil", `Pembaruan status wilayah ${code}`);
    res.json({ ok: true });
  });
  app.get("/api/handovers", requireAuth, requirePermission("wilayah", "view"), (_req, res) => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM handovers ORDER BY created_at DESC").all();
    res.json({
      handovers: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        outgoingCoordinatorName: String(r.outgoing_coordinator_name),
        incomingCoordinatorName: String(r.incoming_coordinator_name),
        activeTasksCount: Number(r.active_tasks_count),
        openProposalsCount: Number(r.open_proposals_count),
        notes: String(r.notes),
        status: String(r.status),
        approvedBy: r.approved_by ? String(r.approved_by) : null,
        createdAt: String(r.created_at)
      }))
    });
  });
  app.post("/api/handovers", requireAuth, requirePermission("wilayah", "edit"), (req, res) => {
    const { provinceCode, outgoingCoordinatorName, incomingCoordinatorName, notes } = req.body ?? {};
    if (!provinceCode || !outgoingCoordinatorName || !incomingCoordinatorName) {
      res.status(422).json({ error: "Provinsi, Koordinator lama, dan calon pengganti wajib diisi." });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, "HND");
    const id = crypto3.randomUUID();
    const taskCnt = db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE province_code = ? AND status != 'selesai'").get(provinceCode).c;
    const propCnt = db.prepare("SELECT COUNT(*) AS c FROM proposals WHERE province_code = ? AND status NOT IN ('disetujui', 'ditolak', 'diarsipkan')").get(provinceCode).c;
    db.prepare(
      `INSERT INTO handovers (id, reference_number, province_code, outgoing_coordinator_name, incoming_coordinator_name, active_tasks_count, open_proposals_count, notes, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_persetujuan', ?)`
    ).run(id, refNo, provinceCode, outgoingCoordinatorName, incomingCoordinatorName, taskCnt, propCnt, String(notes || ""), (/* @__PURE__ */ new Date()).toISOString());
    writeAuditLog(db, req.authUser, "CREATE_HANDOVER", "handover", refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });
  app.post("/api/handovers/:id/approve", requireAuth, requirePermission("organisasi", "assign"), (req, res) => {
    const db = getDb();
    const h = db.prepare("SELECT * FROM handovers WHERE id = ?").get(String(req.params.id));
    if (!h) {
      res.status(404).json({ error: "Data serah terima tidak ditemukan." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE handovers SET status = 'disetujui', approved_by = ?, approved_at = ? WHERE id = ?").run(req.authUser.fullName, now, String(h.id));
    db.prepare("UPDATE provinces SET coordinator_name = ? WHERE code = ?").run(String(h.incoming_coordinator_name), String(h.province_code));
    writeAuditLog(db, req.authUser, "APPROVE_HANDOVER", "handover", String(h.reference_number), "berhasil", `Serah terima ke ${h.incoming_coordinator_name}`);
    writeActivityTimeline(db, "Organisasi", `Serah Terima Koordinator ${PROVINCE_BY_CODE.get(String(h.province_code))?.name}`, `Berita acara ${h.reference_number} disahkan.`, req.authUser.fullName, String(h.province_code), null, "/wilayah");
    res.json({ ok: true });
  });
  app.get("/api/location/logs", requireAuth, (req, res) => {
    const db = getDb();
    const isNational = ["super_admin", "wakil_super_admin", "penanggung_jawab", "sekretariat_nasional"].includes(req.authUser.role);
    const logs = db.prepare(
      `SELECT * FROM location_verifications ${isNational ? "" : "WHERE user_id = ?"} ORDER BY created_at DESC LIMIT 20`
    ).all(...isNational ? [] : [req.authUser.id]);
    const exceptions = db.prepare(
      `SELECT * FROM location_exceptions ${isNational ? "" : "WHERE user_id = ?"} ORDER BY created_at DESC LIMIT 20`
    ).all(...isNational ? [] : [req.authUser.id]);
    res.json({ logs, exceptions });
  });
  app.post("/api/location/verify", requireAuth, (req, res) => {
    const { latitude, longitude, provinceCode, actionType, mode } = req.body ?? {};
    const targetProvince = String(provinceCode || req.authUser.provinceCode || "31");
    const db = getDb();
    let matched = false;
    let reason = "";
    if (mode === "manual_daring") {
      matched = true;
      reason = "Verifikasi manual / kegiatan daring tercatat tanpa GPS fisik.";
    } else if (typeof latitude === "number" && typeof longitude === "number") {
      const check = verifyCoordinateInProvince(latitude, longitude, targetProvince);
      matched = check.matched;
      reason = check.reason;
    } else {
      matched = false;
      reason = "Koordinat lokasi browser tidak tersedia atau izin lokasi ditolak.";
    }
    const id = crypto3.randomUUID();
    db.prepare(
      `INSERT INTO location_verifications (id, user_id, user_name, province_code, action_type, latitude, longitude, matched, verification_mode, reason, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, req.authUser.id, req.authUser.fullName, targetProvince, String(actionType || "aksi_wilayah"), latitude ?? null, longitude ?? null, matched ? 1 : 0, String(mode || "gps_browser"), reason, (/* @__PURE__ */ new Date()).toISOString());
    res.json({ id, matched, reason, provinceName: PROVINCE_BY_CODE.get(targetProvince)?.name ?? targetProvince });
  });
  app.post("/api/location/exceptions", requireAuth, (req, res) => {
    const { provinceCode, reason, evidenceNote, validUntil } = req.body ?? {};
    if (!reason || !validUntil) {
      res.status(422).json({ error: "Alasan dan masa berlaku pengecualian wajib diisi." });
      return;
    }
    const db = getDb();
    const id = crypto3.randomUUID();
    db.prepare(
      `INSERT INTO location_exceptions (id, user_id, user_name, province_code, reason, evidence_note, valid_until, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'menunggu', ?)`
    ).run(id, req.authUser.id, req.authUser.fullName, String(provinceCode || req.authUser.provinceCode || "31"), String(reason), String(evidenceNote || ""), String(validUntil), (/* @__PURE__ */ new Date()).toISOString());
    writeAuditLog(db, req.authUser, "REQUEST_LOCATION_EXCEPTION", "location_exception", id);
    res.status(201).json({ ok: true, id });
  });
  app.post("/api/location/exceptions/:id/decide", requireAuth, requirePermission("wilayah", "manage"), (req, res) => {
    const { decision } = req.body ?? {};
    const status = decision === "disetujui" ? "disetujui" : "ditolak";
    const db = getDb();
    db.prepare("UPDATE location_exceptions SET status = ?, decided_by = ? WHERE id = ?").run(status, req.authUser.fullName, String(req.params.id));
    writeAuditLog(db, req.authUser, "DECIDE_LOCATION_EXCEPTION", "location_exception", String(req.params.id), "berhasil", status);
    res.json({ ok: true });
  });
  app.get("/api/personnel", requireAuth, requirePermission("personalia", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    let sql = `SELECT p.*, b.name AS batch_name FROM personnel p LEFT JOIN batches b ON b.id = p.batch_id WHERE 1=1`;
    const params = [];
    if (user.role === "duta" || user.role === "alumni") {
      sql += " AND p.id = ?";
      params.push(user.personnelId || "__none__");
    } else if (user.role === "koordinator_wilayah" && user.provinceCode) {
      sql += " AND p.province_code = ?";
      params.push(user.provinceCode);
    }
    if (req.query.provinceCode) {
      sql += " AND p.province_code = ?";
      params.push(String(req.query.provinceCode));
    }
    if (req.query.batchId) {
      sql += " AND p.batch_id = ?";
      params.push(String(req.query.batchId));
    }
    if (req.query.status) {
      sql += " AND p.verification_status = ?";
      params.push(String(req.query.status));
    }
    sql += " ORDER BY p.created_at DESC";
    const rows = db.prepare(sql).all(...params);
    res.json({ personnel: rows.map((r) => maskPersonnelRow(r, user)) });
  });
  app.post("/api/personnel", requireAuth, requirePermission("personalia", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.fullName || !b.email || !b.provinceCode) {
      res.status(422).json({ error: "Nama lengkap, email, dan provinsi wajib diisi." });
      return;
    }
    const user = req.authUser;
    if (user.role === "koordinator_wilayah" && user.provinceCode !== b.provinceCode) {
      res.status(403).json({ error: "Koordinator hanya dapat menambahkan personel di provinsinya sendiri." });
      return;
    }
    const db = getDb();
    const id = crypto3.randomUUID();
    const refNo = nextReferenceNumber(db, "PERS");
    const memberNo = `DPBI-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Math.floor(1e3 + Math.random() * 8999))}`;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(
      `INSERT INTO personnel (
        id, member_number, reference_number, full_name, nickname, birth_place, birth_date, gender,
        email, phone, province_code, regency, district, village, postal_code, full_address,
        school_name, education_level, grade_class, major, npsn, nisn,
        batch_id, position_title, bidang, role_code, personnel_status, verification_status,
        guardian_name, guardian_relation, guardian_phone, docs_checklist_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', 'menunggu_verifikasi', ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      memberNo,
      refNo,
      String(b.fullName),
      String(b.nickname || ""),
      String(b.birthPlace || ""),
      String(b.birthDate || ""),
      String(b.gender || ""),
      String(b.email).toLowerCase(),
      String(b.phone || ""),
      String(b.provinceCode),
      String(b.regency || ""),
      String(b.district || ""),
      String(b.village || ""),
      String(b.postalCode || ""),
      String(b.fullAddress || ""),
      String(b.schoolName || ""),
      String(b.educationLevel || "SMA/SMK/MA"),
      String(b.gradeClass || ""),
      String(b.major || ""),
      String(b.npsn || ""),
      String(b.nisn || ""),
      String(b.batchId || "batch-3"),
      String(b.positionTitle || "Duta Pelajar Berbudaya"),
      String(b.bidang || "Kebudayaan"),
      String(b.roleCode || "duta"),
      String(b.guardianName || ""),
      String(b.guardianRelation || ""),
      String(b.guardianPhone || ""),
      JSON.stringify(b.docsChecklist || { pasFoto: false, kartuPelajar: false, suratSekolah: false, izinWali: false, suratKesediaan: false }),
      now,
      now
    );
    writeAuditLog(db, user, "CREATE_PERSONNEL", "personnel", refNo);
    writeActivityTimeline(db, "Personalia", `Personel Baru ${b.fullName}`, `${refNo} didaftarkan di ${PROVINCE_BY_CODE.get(String(b.provinceCode))?.name}.`, user.fullName, String(b.provinceCode), String(b.batchId || "batch-3"), "/personalia");
    res.status(201).json({ ok: true, id, referenceNumber: refNo, memberNumber: memberNo });
  });
  app.get("/api/personnel/:id/history", requireAuth, requirePermission("personalia", "view"), (req, res) => {
    const db = getDb();
    const id = String(req.params.id);
    const user = req.authUser;
    const person = db.prepare("SELECT id, province_code FROM personnel WHERE id = ?").get(id);
    if (!person) {
      res.status(404).json({ error: "Personel tidak ditemukan." });
      return;
    }
    if ((user.role === "duta" || user.role === "alumni") && user.personnelId !== id) {
      res.status(403).json({ error: "Akses riwayat personel lain dibatasi." });
      return;
    }
    if (user.role === "koordinator_wilayah" && user.provinceCode !== person.province_code) {
      res.status(403).json({ error: "Personel berada di luar wilayah Anda." });
      return;
    }
    const proposals = db.prepare("SELECT id, reference_number, title, status, event_date FROM proposals WHERE applicant_personnel_id = ? ORDER BY created_at DESC LIMIT 10").all(id);
    const lkl = db.prepare("SELECT id, reference_number, activity_name, status, event_date, participant_count FROM lkl_reports WHERE submitter_personnel_id = ? ORDER BY created_at DESC LIMIT 10").all(id);
    const evaluations = db.prepare("SELECT id, total_score, coaching_recommendation, evaluator_name, created_at FROM evaluations WHERE personnel_id = ? ORDER BY created_at DESC LIMIT 10").all(id);
    res.json({ proposals, lkl, evaluations });
  });
  app.patch("/api/personnel/:id", requireAuth, requirePermission("personalia", "edit"), (req, res) => {
    const db = getDb();
    const id = String(req.params.id);
    const existing = db.prepare("SELECT * FROM personnel WHERE id = ?").get(id);
    if (!existing) {
      res.status(404).json({ error: "Personel tidak ditemukan." });
      return;
    }
    const user = req.authUser;
    if (user.role === "duta" && user.personnelId !== id) {
      res.status(403).json({ error: "Duta hanya dapat mengubah profil pribadinya sendiri." });
      return;
    }
    if (user.role === "koordinator_wilayah" && user.provinceCode !== existing.province_code) {
      res.status(403).json({ error: "Koordinator hanya dapat mengelola personel di wilayahnya." });
      return;
    }
    const b = req.body ?? {};
    db.prepare(
      `UPDATE personnel SET
        full_name = COALESCE(?, full_name),
        nickname = COALESCE(?, nickname),
        birth_place = COALESCE(?, birth_place),
        birth_date = COALESCE(?, birth_date),
        gender = COALESCE(?, gender),
        phone = COALESCE(?, phone),
        regency = COALESCE(?, regency),
        district = COALESCE(?, district),
        village = COALESCE(?, village),
        postal_code = COALESCE(?, postal_code),
        full_address = COALESCE(?, full_address),
        school_name = COALESCE(?, school_name),
        education_level = COALESCE(?, education_level),
        grade_class = COALESCE(?, grade_class),
        major = COALESCE(?, major),
        npsn = COALESCE(?, npsn),
        nisn = COALESCE(?, nisn),
        guardian_name = COALESCE(?, guardian_name),
        guardian_relation = COALESCE(?, guardian_relation),
        guardian_phone = COALESCE(?, guardian_phone),
        cultural_interests = COALESCE(?, cultural_interests),
        activity_interests = COALESCE(?, activity_interests),
        org_experience = COALESCE(?, org_experience),
        skills = COALESCE(?, skills),
        avatar_file_id = COALESCE(?, avatar_file_id),
        docs_checklist_json = COALESCE(?, docs_checklist_json),
        updated_at = ?
       WHERE id = ?`
    ).run(
      b.fullName ?? null,
      b.nickname ?? null,
      b.birthPlace ?? null,
      b.birthDate ?? null,
      b.gender ?? null,
      b.phone ?? null,
      b.regency ?? null,
      b.district ?? null,
      b.village ?? null,
      b.postalCode ?? null,
      b.fullAddress ?? null,
      b.schoolName ?? null,
      b.educationLevel ?? null,
      b.gradeClass ?? null,
      b.major ?? null,
      b.npsn ?? null,
      b.nisn ?? null,
      b.guardianName ?? null,
      b.guardianRelation ?? null,
      b.guardianPhone ?? null,
      b.culturalInterests ?? null,
      b.activityInterests ?? null,
      b.orgExperience ?? null,
      b.skills ?? null,
      b.avatarFileId ?? null,
      b.docsChecklist ? JSON.stringify(b.docsChecklist) : null,
      (/* @__PURE__ */ new Date()).toISOString(),
      id
    );
    writeAuditLog(db, user, "UPDATE_PERSONNEL", "personnel", String(existing.reference_number));
    res.json({ ok: true });
  });
  app.post("/api/personnel/:id/verify", requireAuth, requirePermission("personalia", "review"), (req, res) => {
    const { status, note } = req.body ?? {};
    const validStatuses = ["terverifikasi", "perlu_perbaikan", "tidak_valid", "menunggu_verifikasi"];
    if (!validStatuses.includes(String(status))) {
      res.status(422).json({ error: "Status verifikasi tidak valid." });
      return;
    }
    const db = getDb();
    const existing = db.prepare("SELECT * FROM personnel WHERE id = ?").get(String(req.params.id));
    if (!existing) {
      res.status(404).json({ error: "Personel tidak ditemukan." });
      return;
    }
    if (status === "terverifikasi") {
      const docs = JSON.parse(String(existing.docs_checklist_json || "{}"));
      if (!docs.pasFoto || !docs.kartuPelajar) {
        res.status(422).json({ error: "Tidak dapat memverifikasi sebelum dokumen wajib (Pas Foto & Kartu Pelajar) dicentang/diperiksa." });
        return;
      }
    }
    db.prepare("UPDATE personnel SET verification_status = ?, verification_note = ?, updated_at = ? WHERE id = ?").run(
      String(status),
      String(note || ""),
      (/* @__PURE__ */ new Date()).toISOString(),
      String(existing.id)
    );
    writeAuditLog(db, req.authUser, "VERIFY_PERSONNEL", "personnel", String(existing.reference_number), "berhasil", `${status}: ${note || ""}`);
    res.json({ ok: true });
  });
  app.post("/api/personnel/import", requireAuth, requirePermission("personalia", "create"), (req, res) => {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (rows.length === 0) {
      res.status(422).json({ error: "Tidak ada baris data yang dikirim untuk diimpor." });
      return;
    }
    const db = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    let inserted = 0;
    const skipped = [];
    db.exec("BEGIN IMMEDIATE;");
    try {
      for (const r of rows) {
        const email = String(r.email || "").trim().toLowerCase();
        const fullName = String(r.fullName || "").trim();
        const prov = String(r.provinceCode || "31").trim();
        if (!email || !fullName) {
          skipped.push({ email: email || "(kosong)", reason: "Nama atau email kosong" });
          continue;
        }
        const dup = db.prepare("SELECT id FROM personnel WHERE LOWER(email) = ?").get(email);
        if (dup) {
          skipped.push({ email, reason: "Email duplikat sudah ada di database" });
          continue;
        }
        const refNo = nextReferenceNumber(db, "PERS");
        const memberNo = `DPBI-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Math.floor(1e3 + Math.random() * 8999))}`;
        db.prepare(
          `INSERT INTO personnel (id, member_number, reference_number, full_name, email, province_code, school_name, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Duta Pelajar Berbudaya', 'Kebudayaan', 'duta', 'aktif', 'menunggu_verifikasi', '{}', ?, ?)`
        ).run(crypto3.randomUUID(), memberNo, refNo, fullName, email, prov, String(r.schoolName || ""), String(r.batchId || "batch-3"), now, now);
        inserted += 1;
      }
      db.exec("COMMIT;");
    } catch {
      db.exec("ROLLBACK;");
      res.status(500).json({ error: "Gagal memproses impor massal dalam transaksi database." });
      return;
    }
    writeAuditLog(db, req.authUser, "BULK_IMPORT_PERSONNEL", "personnel", `imported:${inserted}`, "berhasil", `Dilewati: ${skipped.length}`);
    res.json({ ok: true, inserted, skipped });
  });
  app.get("/api/account-requests", requireAuth, requirePermission("personalia", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    const rows = db.prepare(
      `SELECT * FROM account_requests ${user.role === "koordinator_wilayah" && user.provinceCode ? "WHERE province_code = ?" : ""} ORDER BY created_at DESC`
    ).all(...user.role === "koordinator_wilayah" && user.provinceCode ? [user.provinceCode] : []);
    res.json({
      requests: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        fullName: String(r.full_name),
        email: String(r.email),
        phone: String(r.phone),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        batchId: String(r.batch_id),
        schoolName: String(r.school_name),
        requestedByName: String(r.requested_by_name),
        status: String(r.status),
        decisionNote: r.decision_note ? String(r.decision_note) : null,
        decidedBy: r.decided_by ? String(r.decided_by) : null,
        createdAt: String(r.created_at)
      }))
    });
  });
  app.post("/api/account-requests", requireAuth, requirePermission("personalia", "create"), (req, res) => {
    const { fullName, email, phone, provinceCode, batchId, schoolName } = req.body ?? {};
    if (!fullName || !email || !provinceCode || !schoolName) {
      res.status(422).json({ error: "Nama calon Duta, email, provinsi, dan nama sekolah wajib diisi." });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, "AKUN");
    const id = crypto3.randomUUID();
    db.prepare(
      `INSERT INTO account_requests (id, reference_number, full_name, email, phone, province_code, batch_id, school_name, requested_by_user_id, requested_by_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', ?)`
    ).run(id, refNo, String(fullName), String(email).toLowerCase(), String(phone || ""), String(provinceCode), String(batchId || "batch-3"), String(schoolName), req.authUser.id, req.authUser.fullName, (/* @__PURE__ */ new Date()).toISOString());
    writeAuditLog(db, req.authUser, "CREATE_ACCOUNT_REQUEST", "account_request", refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });
  app.post("/api/account-requests/:id/decide", requireAuth, requirePermission("personalia", "review"), (req, res) => {
    if (!["super_admin", "wakil_super_admin", "sekretariat_nasional"].includes(req.authUser.role)) {
      res.status(403).json({ error: "Persetujuan permintaan akun Duta hanya dapat dilakukan pihak Nasional." });
      return;
    }
    const { decision, note } = req.body ?? {};
    if (!["disetujui", "ditolak"].includes(String(decision))) {
      res.status(422).json({ error: "Keputusan harus disetujui atau ditolak." });
      return;
    }
    const db = getDb();
    const reqRow = db.prepare("SELECT * FROM account_requests WHERE id = ?").get(String(req.params.id));
    if (!reqRow) {
      res.status(404).json({ error: "Permintaan akun tidak ditemukan." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE account_requests SET status = ?, decision_note = ?, decided_by = ?, decided_at = ? WHERE id = ?").run(
      String(decision),
      String(note || ""),
      req.authUser.fullName,
      now,
      String(reqRow.id)
    );
    let inviteToken = null;
    if (decision === "disetujui") {
      inviteToken = crypto3.randomBytes(20).toString("hex");
      const exp = new Date(Date.now() + 72 * 60 * 60 * 1e3).toISOString();
      db.prepare(
        `INSERT INTO invitations (id, email, full_name, role, province_code, batch_id, token_hash, expires_at, created_by, created_at)
         VALUES (?, ?, ?, 'duta', ?, ?, ?, ?, ?, ?)`
      ).run(crypto3.randomUUID(), String(reqRow.email), String(reqRow.full_name), String(reqRow.province_code), String(reqRow.batch_id), sha256(inviteToken), exp, req.authUser.id, now);
    }
    writeAuditLog(db, req.authUser, "DECIDE_ACCOUNT_REQUEST", "account_request", String(reqRow.reference_number), "berhasil", String(decision));
    res.json({ ok: true, inviteToken });
  });
  app.get("/api/organization", requireAuth, requirePermission("organisasi", "view"), (_req, res) => {
    const db = getDb();
    const positions = db.prepare("SELECT * FROM organization_positions ORDER BY level, title").all();
    const delegations = db.prepare("SELECT * FROM delegations ORDER BY created_at DESC").all();
    res.json({ positions, delegations });
  });
  app.post("/api/organization/positions", requireAuth, requirePermission("organisasi", "edit"), (req, res) => {
    const { title, bidang, level, holderName, skNumber, termStartsAt, termEndsAt } = req.body ?? {};
    if (!title || !bidang) {
      res.status(422).json({ error: "Nama jabatan dan bidang wajib diisi." });
      return;
    }
    const db = getDb();
    const id = crypto3.randomUUID();
    db.prepare(
      `INSERT INTO organization_positions (id, title, bidang, level, holder_name, sk_number, term_starts_at, term_ends_at, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?)`
    ).run(id, String(title), String(bidang), String(level || "Nasional"), String(holderName || ""), String(skNumber || ""), String(termStartsAt || ""), String(termEndsAt || ""), (/* @__PURE__ */ new Date()).toISOString());
    writeAuditLog(db, req.authUser, "CREATE_ORG_POSITION", "organization_position", id);
    res.status(201).json({ ok: true, id });
  });
  app.post("/api/organization/delegations", requireAuth, requirePermission("organisasi", "assign"), (req, res) => {
    const { delegateUserId, module, action, provinceCode, startsAt, endsAt, reason } = req.body ?? {};
    if (!delegateUserId || !module || !action || !startsAt || !endsAt || !reason) {
      res.status(422).json({ error: "Semua data delegasi dan alasan wajib diisi." });
      return;
    }
    const db = getDb();
    const targetUser = db.prepare("SELECT id, full_name FROM users WHERE id = ?").get(String(delegateUserId));
    if (!targetUser) {
      res.status(404).json({ error: "Pengguna penerima delegasi tidak ditemukan." });
      return;
    }
    const id = crypto3.randomUUID();
    db.prepare(
      `INSERT INTO delegations (id, delegate_user_id, delegate_name, grantor_user_id, grantor_name, module, action, province_code, starts_at, ends_at, reason, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'aktif', ?)`
    ).run(id, targetUser.id, targetUser.full_name, req.authUser.id, req.authUser.fullName, String(module), String(action), provinceCode ? String(provinceCode) : null, String(startsAt), String(endsAt), String(reason), (/* @__PURE__ */ new Date()).toISOString());
    writeAuditLog(db, req.authUser, "CREATE_DELEGATION", "delegation", id, "berhasil", `${targetUser.full_name} -> ${module}:${action}`);
    res.status(201).json({ ok: true, id });
  });
  app.post("/api/organization/delegations/:id/revoke", requireAuth, requirePermission("organisasi", "assign"), (req, res) => {
    const db = getDb();
    db.prepare("UPDATE delegations SET status = 'dicabut' WHERE id = ?").run(String(req.params.id));
    writeAuditLog(db, req.authUser, "REVOKE_DELEGATION", "delegation", String(req.params.id));
    res.json({ ok: true });
  });
  app.get("/api/batches", requireAuth, requirePermission("angkatan", "view"), (_req, res) => {
    const db = getDb();
    const rows = db.prepare(
      `SELECT b.*,
          (SELECT COUNT(*) FROM personnel p WHERE p.batch_id = b.id) AS personnel_count,
          (SELECT COUNT(*) FROM proposals pr WHERE pr.batch_id = b.id) AS proposal_count,
          (SELECT COUNT(*) FROM lkl_reports l JOIN proposals pr ON pr.id = l.proposal_id WHERE pr.batch_id = b.id) AS lkl_count
         FROM batches b
         ORDER BY b.batch_number DESC`
    ).all();
    res.json({
      batches: rows.map((b) => ({
        id: String(b.id),
        batchNumber: Number(b.batch_number),
        name: String(b.name),
        openedAt: String(b.opened_at),
        closedAt: String(b.closed_at),
        briefingAt: String(b.briefing_at),
        termStartsAt: String(b.term_starts_at),
        termEndsAt: String(b.term_ends_at),
        durationMonths: Number(b.duration_months),
        status: String(b.status),
        activePersonnelCount: Number(b.personnel_count),
        proposalCount: Number(b.proposal_count),
        lklCount: Number(b.lkl_count)
      }))
    });
  });
  app.post("/api/batches", requireAuth, requirePermission("angkatan", "create"), (req, res) => {
    const { batchNumber, name, openedAt, closedAt, briefingAt, termStartsAt, termEndsAt, durationMonths, status } = req.body ?? {};
    if (!batchNumber || !name || !termStartsAt || !termEndsAt) {
      res.status(422).json({ error: "Nomor angkatan, nama batch, dan tanggal masa tugas wajib diisi." });
      return;
    }
    const db = getDb();
    const id = `batch-${batchNumber}-${Date.now()}`;
    db.prepare(
      `INSERT INTO batches (id, batch_number, name, opened_at, closed_at, briefing_at, term_starts_at, term_ends_at, duration_months, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      Number(batchNumber),
      String(name),
      String(openedAt || termStartsAt),
      String(closedAt || termStartsAt),
      String(briefingAt || termStartsAt),
      String(termStartsAt),
      String(termEndsAt),
      Number(durationMonths || 4),
      String(status || "perencanaan"),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    writeAuditLog(db, req.authUser, "CREATE_BATCH", "batch", id);
    res.status(201).json({ ok: true, id });
  });
  app.patch("/api/batches/:id", requireAuth, requirePermission("angkatan", "edit"), (req, res) => {
    const { status, durationMonths } = req.body ?? {};
    const db = getDb();
    db.prepare("UPDATE batches SET status = COALESCE(?, status), duration_months = COALESCE(?, duration_months) WHERE id = ?").run(
      status ?? null,
      durationMonths ? Number(durationMonths) : null,
      String(req.params.id)
    );
    writeAuditLog(db, req.authUser, "UPDATE_BATCH", "batch", String(req.params.id), "berhasil", `Status: ${status}`);
    res.json({ ok: true });
  });
  app.get("/api/proposals", requireAuth, requirePermission("proposal", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    let sql = `SELECT p.*, b.name AS batch_name FROM proposals p LEFT JOIN batches b ON b.id = p.batch_id WHERE 1=1`;
    const params = [];
    if (user.role === "duta") {
      sql += " AND p.applicant_personnel_id = ?";
      params.push(user.personnelId || "__none__");
    } else if (user.role === "koordinator_wilayah" && user.provinceCode) {
      sql += " AND p.province_code = ?";
      params.push(user.provinceCode);
    }
    if (req.query.status) {
      sql += " AND p.status = ?";
      params.push(String(req.query.status));
    }
    sql += " ORDER BY p.created_at DESC";
    const rows = db.prepare(sql).all(...params);
    const matrixRules = db.prepare("SELECT * FROM approval_matrix_rules").all();
    res.json({
      proposals: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        version: Number(r.version),
        title: String(r.title),
        applicantPersonnelId: String(r.applicant_personnel_id),
        applicantName: String(r.applicant_name),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        batchId: String(r.batch_id),
        batchName: String(r.batch_name || r.batch_id),
        bidang: String(r.bidang),
        category: String(r.category),
        riskLevel: String(r.risk_level),
        usesDpbiIdentity: Boolean(r.uses_dpbi_identity),
        externalPermitNeeded: Boolean(r.external_permit_needed),
        assignedApproverRole: String(r.assigned_approver_role),
        objective: String(r.objective),
        targetAudience: String(r.target_audience),
        eventDate: String(r.event_date),
        eventTime: String(r.event_time),
        location: String(r.location),
        picName: String(r.pic_name),
        estimatedParticipants: Number(r.estimated_participants),
        activityMode: String(r.activity_mode),
        pdfFileId: r.pdf_file_id ? String(r.pdf_file_id) : null,
        pdfFileName: r.pdf_file_name ? String(r.pdf_file_name) : null,
        status: String(r.status),
        decisionNote: r.decision_note ? String(r.decision_note) : null,
        decidedBy: r.decided_by ? String(r.decided_by) : null,
        decidedAt: r.decided_at ? String(r.decided_at) : null,
        createdAt: String(r.created_at),
        updatedAt: String(r.updated_at)
      })),
      matrixRules
    });
  });
  app.get("/api/proposals/:id/versions", requireAuth, requirePermission("proposal", "view"), (req, res) => {
    const db = getDb();
    const versions = db.prepare("SELECT * FROM proposal_versions WHERE proposal_id = ? ORDER BY version DESC").all(String(req.params.id));
    res.json({ versions });
  });
  app.post("/api/proposals", requireAuth, requirePermission("proposal", "create"), (req, res) => {
    const b = req.body ?? {};
    const isDraft = Boolean(b.saveAsDraft);
    if (!String(b.title || "").trim()) {
      res.status(422).json({ error: "Judul kegiatan wajib diisi untuk menyimpan proposal." });
      return;
    }
    if (!isDraft && (!b.bidang || !b.category || !b.eventDate || !String(b.location || "").trim())) {
      res.status(422).json({ error: "Judul, bidang, kategori, tanggal, dan lokasi kegiatan wajib diisi sebelum diajukan." });
      return;
    }
    const db = getDb();
    const user = req.authUser;
    const refNo = nextReferenceNumber(db, "PROP");
    const id = crypto3.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const provCode = String(b.provinceCode || user.provinceCode || "31");
    const riskLevel = ["rendah", "sedang", "tinggi"].includes(b.riskLevel) ? b.riskLevel : "rendah";
    const usesDpbiIdentity = b.usesDpbiIdentity !== false;
    const externalPermitNeeded = Boolean(b.externalPermitNeeded);
    const route = resolveProposalApprover({ category: String(b.category || "Lokakarya / Literasi Pelajar"), riskLevel, usesDpbiIdentity, externalPermitNeeded });
    const initialStatus = isDraft ? "draft" : route.approverRole === "pengurus_nasional" ? "menunggu_persetujuan_nasional" : "diajukan";
    db.prepare(
      `INSERT INTO proposals (
        id, reference_number, version, title, applicant_personnel_id, applicant_name, province_code, batch_id,
        bidang, category, risk_level, uses_dpbi_identity, external_permit_needed, assigned_approver_role,
        objective, target_audience, event_date, event_time, location, pic_name, estimated_participants,
        activity_mode, pdf_file_id, pdf_file_name, status, created_at, updated_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      refNo,
      String(b.title).trim(),
      user.personnelId || user.id,
      user.fullName,
      provCode,
      String(b.batchId || user.batchId || "batch-3"),
      String(b.bidang || "Kebudayaan"),
      String(b.category || "Lokakarya / Literasi Pelajar"),
      riskLevel,
      usesDpbiIdentity ? 1 : 0,
      externalPermitNeeded ? 1 : 0,
      route.approverRole,
      String(b.objective || ""),
      String(b.targetAudience || "Pelajar"),
      String(b.eventDate || "2026-12-10"),
      String(b.eventTime || "09:00 WIB"),
      String(b.location || ""),
      String(b.picName || user.fullName),
      Number(b.estimatedParticipants || 30),
      String(b.activityMode || "luring"),
      b.pdfFileId ? String(b.pdfFileId) : null,
      b.pdfFileName ? String(b.pdfFileName) : null,
      initialStatus,
      now,
      now
    );
    if (b.pdfFileId) {
      db.prepare(
        `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?)`
      ).run(crypto3.randomUUID(), id, String(b.pdfFileId), String(b.pdfFileName || "proposal.pdf"), isDraft ? "Simpan draft dokumen proposal" : "Pengajuan awal dokumen proposal PDF", user.fullName, now);
    }
    writeAuditLog(db, user, isDraft ? "SAVE_PROPOSAL_DRAFT" : "SUBMIT_PROPOSAL", "proposal", refNo);
    if (!isDraft) {
      writeActivityTimeline(db, "Proposal", `Proposal Baru ${refNo}`, `${b.title} diajukan oleh ${user.fullName}.`, user.fullName, provCode, String(b.batchId || "batch-3"), "/proposal");
    }
    res.status(201).json({ ok: true, id, referenceNumber: refNo, status: initialStatus, assignedApproverRole: route.approverRole });
  });
  app.patch("/api/proposals/:id", requireAuth, requirePermission("proposal", "edit"), (req, res) => {
    const db = getDb();
    const id = String(req.params.id);
    const prop = db.prepare("SELECT * FROM proposals WHERE id = ?").get(id);
    if (!prop) {
      res.status(404).json({ error: "Proposal tidak ditemukan." });
      return;
    }
    const user = req.authUser;
    if (user.role === "duta" && prop.applicant_personnel_id !== user.personnelId && prop.applicant_personnel_id !== user.id) {
      res.status(403).json({ error: "Anda hanya dapat mengubah draft proposal milik sendiri." });
      return;
    }
    const b = req.body ?? {};
    const submitNow = Boolean(b.submitNow);
    const mergedTitle = String(b.title !== void 0 ? b.title : prop.title || "").trim();
    const mergedObjective = String(b.objective !== void 0 ? b.objective : prop.objective || "").trim();
    const mergedLocation = String(b.location !== void 0 ? b.location : prop.location || "").trim();
    if (submitNow && (!mergedTitle || !mergedObjective || !mergedLocation)) {
      res.status(422).json({ error: "Judul, tujuan, dan lokasi kegiatan wajib diisi sebelum draft diajukan." });
      return;
    }
    const riskLevel = ["rendah", "sedang", "tinggi"].includes(b.riskLevel) ? b.riskLevel : prop.risk_level;
    const usesDpbiIdentity = b.usesDpbiIdentity !== void 0 ? Boolean(b.usesDpbiIdentity) : Boolean(prop.uses_dpbi_identity);
    const externalPermitNeeded = b.externalPermitNeeded !== void 0 ? Boolean(b.externalPermitNeeded) : Boolean(prop.external_permit_needed);
    const route = resolveProposalApprover({
      category: String(b.category || prop.category),
      riskLevel,
      usesDpbiIdentity,
      externalPermitNeeded
    });
    const nextStatus = submitNow ? route.approverRole === "pengurus_nasional" ? "menunggu_persetujuan_nasional" : "diajukan" : String(prop.status);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(
      `UPDATE proposals SET
        title = COALESCE(?, title),
        bidang = COALESCE(?, bidang),
        category = COALESCE(?, category),
        risk_level = ?,
        uses_dpbi_identity = ?,
        external_permit_needed = ?,
        assigned_approver_role = ?,
        objective = COALESCE(?, objective),
        event_date = COALESCE(?, event_date),
        location = COALESCE(?, location),
        estimated_participants = COALESCE(?, estimated_participants),
        activity_mode = COALESCE(?, activity_mode),
        pdf_file_id = COALESCE(?, pdf_file_id),
        pdf_file_name = COALESCE(?, pdf_file_name),
        status = ?,
        updated_at = ?
       WHERE id = ?`
    ).run(
      b.title ?? null,
      b.bidang ?? null,
      b.category ?? null,
      riskLevel,
      usesDpbiIdentity ? 1 : 0,
      externalPermitNeeded ? 1 : 0,
      route.approverRole,
      b.objective ?? null,
      b.eventDate ?? null,
      b.location ?? null,
      b.estimatedParticipants ? Number(b.estimatedParticipants) : null,
      b.activityMode ?? null,
      b.pdfFileId ?? null,
      b.pdfFileName ?? null,
      nextStatus,
      now,
      id
    );
    writeAuditLog(db, user, submitNow ? "SUBMIT_PROPOSAL_FROM_DRAFT" : "UPDATE_PROPOSAL_DRAFT", "proposal", String(prop.reference_number));
    res.json({ ok: true, status: nextStatus, assignedApproverRole: route.approverRole });
  });
  app.post("/api/proposals/:id/decide", requireAuth, requirePermission("proposal", "review"), (req, res) => {
    const { decision, note } = req.body ?? {};
    const valid = ["disetujui", "perlu_revisi", "ditolak"];
    if (!valid.includes(String(decision))) {
      res.status(422).json({ error: "Keputusan harus disetujui, perlu_revisi, atau ditolak." });
      return;
    }
    if ((decision === "perlu_revisi" || decision === "ditolak") && !String(note || "").trim()) {
      res.status(422).json({ error: "Alasan atau catatan wajib diisi untuk revisi atau penolakan." });
      return;
    }
    const db = getDb();
    const prop = db.prepare("SELECT * FROM proposals WHERE id = ?").get(String(req.params.id));
    if (!prop) {
      res.status(404).json({ error: "Proposal tidak ditemukan." });
      return;
    }
    const user = req.authUser;
    if (decision === "disetujui" && !hasPermission(user.permissions, "proposal", "approve")) {
      if (!(user.role === "koordinator_wilayah" && prop.assigned_approver_role === "koordinator_wilayah" && user.provinceCode === prop.province_code)) {
        res.status(403).json({ error: "Proposal ini memerlukan persetujuan Pengurus Nasional sesuai Approval Matrix." });
        return;
      }
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE proposals SET status = ?, decision_note = ?, decided_by = ?, decided_at = ?, updated_at = ? WHERE id = ?").run(
      String(decision),
      String(note || ""),
      user.fullName,
      now,
      now,
      String(prop.id)
    );
    const applicantUser = db.prepare("SELECT id FROM users WHERE personnel_id = ?").get(String(prop.applicant_personnel_id));
    if (applicantUser) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
         VALUES (?, ?, ?, ?, 'proposal', '/proposal', 0, ?)`
      ).run(crypto3.randomUUID(), applicantUser.id, `Status Proposal ${prop.reference_number}: ${decision.replace(/_/g, " ")}`, String(note || prop.title), now);
    }
    writeAuditLog(db, user, `DECIDE_PROPOSAL_${String(decision).toUpperCase()}`, "proposal", String(prop.reference_number), "berhasil", String(note || ""));
    writeActivityTimeline(db, "Proposal", `Proposal ${prop.reference_number} ${decision.replace(/_/g, " ")}`, `${prop.title} ditindaklanjuti oleh ${user.fullName}.`, user.fullName, String(prop.province_code), String(prop.batch_id), "/proposal");
    res.json({ ok: true });
  });
  app.post("/api/proposals/:id/revise", requireAuth, requirePermission("proposal", "edit"), (req, res) => {
    const { pdfFileId, pdfFileName, changeNote } = req.body ?? {};
    const db = getDb();
    const prop = db.prepare("SELECT * FROM proposals WHERE id = ?").get(String(req.params.id));
    if (!prop) {
      res.status(404).json({ error: "Proposal tidak ditemukan." });
      return;
    }
    const nextVersion = Number(prop.version) + 1;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const nextStatus = prop.assigned_approver_role === "pengurus_nasional" ? "menunggu_persetujuan_nasional" : "diajukan";
    db.prepare("UPDATE proposals SET version = ?, pdf_file_id = COALESCE(?, pdf_file_id), pdf_file_name = COALESCE(?, pdf_file_name), status = ?, updated_at = ? WHERE id = ?").run(
      nextVersion,
      pdfFileId ?? null,
      pdfFileName ?? null,
      nextStatus,
      now,
      String(prop.id)
    );
    db.prepare(
      `INSERT INTO proposal_versions (id, proposal_id, version, pdf_file_id, pdf_file_name, change_note, uploaded_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(crypto3.randomUUID(), String(prop.id), nextVersion, pdfFileId ?? prop.pdf_file_id, pdfFileName ?? prop.pdf_file_name, String(changeNote || `Revisi versi ${nextVersion}`), req.authUser.fullName, now);
    writeAuditLog(db, req.authUser, "REVISE_PROPOSAL", "proposal", String(prop.reference_number), "berhasil", `Versi ${nextVersion}`);
    res.json({ ok: true, version: nextVersion });
  });
  app.get("/api/lkl", requireAuth, requirePermission("lkl", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    let sql = "SELECT * FROM lkl_reports WHERE 1=1";
    const params = [];
    if (user.role === "duta") {
      sql += " AND submitter_personnel_id = ?";
      params.push(user.personnelId || "__none__");
    } else if (user.role === "koordinator_wilayah" && user.provinceCode) {
      sql += " AND province_code = ?";
      params.push(user.provinceCode);
    }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all(...params);
    res.json({
      reports: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        version: Number(r.version),
        activityName: String(r.activity_name),
        proposalId: r.proposal_id ? String(r.proposal_id) : null,
        proposalRef: r.proposal_ref ? String(r.proposal_ref) : null,
        submitterPersonnelId: String(r.submitter_personnel_id),
        submitterName: String(r.submitter_name),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        regency: String(r.regency || ""),
        district: String(r.district || ""),
        village: String(r.village || ""),
        venueName: String(r.venue_name || ""),
        venueAddress: String(r.venue_address || ""),
        eventDate: String(r.event_date),
        startTime: String(r.start_time),
        endTime: String(r.end_time),
        category: String(r.category),
        activityMode: String(r.activity_mode),
        platformName: r.platform_name ? String(r.platform_name) : null,
        platformLink: r.platform_link ? String(r.platform_link) : null,
        picName: String(r.pic_name),
        participantCount: Number(r.participant_count),
        summary: String(r.summary),
        outcomes: String(r.outcomes),
        obstacles: String(r.obstacles || ""),
        followUp: String(r.follow_up || ""),
        pdfFileId: r.pdf_file_id ? String(r.pdf_file_id) : null,
        pdfFileName: r.pdf_file_name ? String(r.pdf_file_name) : null,
        photoFileIds: JSON.parse(String(r.photo_file_ids_json || "[]")),
        status: String(r.status),
        reviewNote: r.review_note ? String(r.review_note) : null,
        reviewedBy: r.reviewed_by ? String(r.reviewed_by) : null,
        reviewedAt: r.reviewed_at ? String(r.reviewed_at) : null,
        createdAt: String(r.created_at)
      }))
    });
  });
  app.post("/api/lkl", requireAuth, requirePermission("lkl", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.activityName || !b.eventDate || !b.summary) {
      res.status(422).json({ error: "Nama kegiatan, tanggal pelaksanaan, dan ringkasan kegiatan wajib diisi." });
      return;
    }
    const db = getDb();
    const user = req.authUser;
    const refNo = nextReferenceNumber(db, "LKL");
    const id = crypto3.randomUUID();
    const provCode = String(b.provinceCode || user.provinceCode || "31");
    const mode = b.activityMode === "daring" ? "daring" : "luring";
    let proposalRef = null;
    if (b.proposalId) {
      const p = db.prepare("SELECT reference_number FROM proposals WHERE id = ?").get(String(b.proposalId));
      if (p) proposalRef = p.reference_number;
    }
    db.prepare(
      `INSERT INTO lkl_reports (
        id, reference_number, version, activity_name, proposal_id, proposal_ref, submitter_personnel_id, submitter_name,
        province_code, regency, district, village, venue_name, venue_address, event_date, start_time, end_time,
        category, activity_mode, platform_name, platform_link, pic_name, participant_count, summary, outcomes,
        obstacles, follow_up, pdf_file_id, pdf_file_name, photo_file_ids_json, status, created_at
      ) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu_pemeriksaan', ?)`
    ).run(
      id,
      refNo,
      String(b.activityName),
      b.proposalId ? String(b.proposalId) : null,
      proposalRef,
      user.personnelId || user.id,
      user.fullName,
      provCode,
      mode === "luring" ? String(b.regency || "") : "",
      mode === "luring" ? String(b.district || "") : "",
      mode === "luring" ? String(b.village || "") : "",
      mode === "luring" ? String(b.venueName || "") : "",
      mode === "luring" ? String(b.venueAddress || "") : "",
      String(b.eventDate),
      String(b.startTime || "09:00"),
      String(b.endTime || "12:00"),
      String(b.category || "Kegiatan Budaya"),
      mode,
      mode === "daring" ? String(b.platformName || "Platform Konferensi Video") : null,
      mode === "daring" ? String(b.platformLink || "") : null,
      String(b.picName || user.fullName),
      Number(b.participantCount || 0),
      String(b.summary),
      String(b.outcomes || ""),
      String(b.obstacles || ""),
      String(b.followUp || ""),
      b.pdfFileId ? String(b.pdfFileId) : null,
      b.pdfFileName ? String(b.pdfFileName) : null,
      JSON.stringify(Array.isArray(b.photoFileIds) ? b.photoFileIds : []),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    writeAuditLog(db, user, "SUBMIT_LKL", "lkl", refNo);
    writeActivityTimeline(db, "LKL", `LKL ${refNo} Dikirim`, `${b.activityName} (${mode}) dikirim oleh ${user.fullName}.`, user.fullName, provCode, user.batchId, "/laporan-kegiatan");
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });
  app.post("/api/lkl/:id/review", requireAuth, requirePermission("lkl", "review"), (req, res) => {
    const { decision, note } = req.body ?? {};
    if (!["diterima", "perlu_revisi", "ditolak"].includes(String(decision))) {
      res.status(422).json({ error: "Keputusan harus diterima, perlu_revisi, atau ditolak." });
      return;
    }
    const db = getDb();
    const lkl = db.prepare("SELECT * FROM lkl_reports WHERE id = ?").get(String(req.params.id));
    if (!lkl) {
      res.status(404).json({ error: "LKL tidak ditemukan." });
      return;
    }
    const user = req.authUser;
    if (user.role === "koordinator_wilayah" && user.provinceCode !== lkl.province_code) {
      res.status(403).json({ error: "Koordinator hanya dapat memeriksa LKL di provinsinya." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare("UPDATE lkl_reports SET status = ?, review_note = ?, reviewed_by = ?, reviewed_at = ? WHERE id = ?").run(
      String(decision),
      String(note || ""),
      user.fullName,
      now,
      String(lkl.id)
    );
    const submitterUser = db.prepare("SELECT id FROM users WHERE personnel_id = ?").get(String(lkl.submitter_personnel_id));
    if (submitterUser) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
         VALUES (?, ?, ?, ?, 'lkl', '/laporan-kegiatan', 0, ?)`
      ).run(crypto3.randomUUID(), submitterUser.id, `Pemeriksaan LKL ${lkl.reference_number}: ${decision.replace(/_/g, " ")}`, String(note || lkl.activity_name), now);
    }
    writeAuditLog(db, user, `REVIEW_LKL_${String(decision).toUpperCase()}`, "lkl", String(lkl.reference_number), "berhasil", String(note || ""));
    writeActivityTimeline(db, "LKL", `LKL ${lkl.reference_number} ${decision.replace(/_/g, " ")}`, `${lkl.activity_name} diperiksa oleh ${user.fullName}.`, user.fullName, String(lkl.province_code), null, "/laporan-kegiatan");
    res.json({ ok: true });
  });
  app.get("/api/coordinator-reports", requireAuth, requirePermission("laporan_koordinator", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    const rows = db.prepare(
      `SELECT * FROM coordinator_reports ${user.role === "koordinator_wilayah" && user.provinceCode ? "WHERE province_code = ?" : ""} ORDER BY created_at DESC`
    ).all(...user.role === "koordinator_wilayah" && user.provinceCode ? [user.provinceCode] : []);
    res.json({
      reports: rows.map((r) => ({
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        reportType: String(r.report_type),
        provinceCode: String(r.province_code),
        provinceName: PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? String(r.province_code),
        batchId: String(r.batch_id),
        coordinatorName: String(r.coordinator_name),
        periodLabel: String(r.period_label),
        personnelCondition: String(r.personnel_condition),
        activitiesSummary: String(r.activities_summary),
        lklRecapCount: Number(r.lkl_recap_count),
        obstacles: String(r.obstacles),
        coachingNeeds: String(r.coaching_needs),
        followUpPlan: String(r.follow_up_plan),
        pdfFileId: r.pdf_file_id ? String(r.pdf_file_id) : null,
        pdfFileName: r.pdf_file_name ? String(r.pdf_file_name) : null,
        status: String(r.status),
        reviewNote: r.review_note ? String(r.review_note) : null,
        createdAt: String(r.created_at)
      }))
    });
  });
  app.post("/api/coordinator-reports", requireAuth, requirePermission("laporan_koordinator", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.periodLabel || !b.personnelCondition || !b.activitiesSummary) {
      res.status(422).json({ error: "Periode laporan, kondisi personel, dan ringkasan kegiatan wajib diisi." });
      return;
    }
    const db = getDb();
    const user = req.authUser;
    const provCode = String(b.provinceCode || user.provinceCode || "31");
    const refNo = nextReferenceNumber(db, "LKW");
    const id = crypto3.randomUUID();
    const lklCnt = db.prepare("SELECT COUNT(*) AS c FROM lkl_reports WHERE province_code = ? AND status = 'diterima'").get(provCode).c;
    db.prepare(
      `INSERT INTO coordinator_reports (id, reference_number, report_type, province_code, batch_id, coordinator_id, coordinator_name, period_label, personnel_condition, activities_summary, lkl_recap_count, obstacles, coaching_needs, follow_up_plan, pdf_file_id, pdf_file_name, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'dikirim', ?)`
    ).run(
      id,
      refNo,
      b.reportType === "akhir" ? "akhir" : "bulanan",
      provCode,
      String(b.batchId || user.batchId || "batch-3"),
      user.id,
      user.fullName,
      String(b.periodLabel),
      String(b.personnelCondition),
      String(b.activitiesSummary),
      lklCnt,
      String(b.obstacles || ""),
      String(b.coachingNeeds || ""),
      String(b.followUpPlan || ""),
      b.pdfFileId ? String(b.pdfFileId) : null,
      b.pdfFileName ? String(b.pdfFileName) : null,
      (/* @__PURE__ */ new Date()).toISOString()
    );
    writeAuditLog(db, user, "SUBMIT_COORDINATOR_REPORT", "coordinator_report", refNo);
    writeActivityTimeline(db, "Laporan Wilayah", `Laporan ${b.reportType === "akhir" ? "Akhir" : "Bulanan"} ${PROVINCE_BY_CODE.get(provCode)?.name}`, `${refNo} (${b.periodLabel}) dikirim oleh ${user.fullName}.`, user.fullName, provCode, String(b.batchId || "batch-3"), "/laporan-koordinator");
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });
  app.post("/api/coordinator-reports/:id/review", requireAuth, requirePermission("laporan_koordinator", "review"), (req, res) => {
    const { decision, note } = req.body ?? {};
    if (!["diterima", "perlu_revisi"].includes(String(decision))) {
      res.status(422).json({ error: "Keputusan harus diterima atau perlu_revisi." });
      return;
    }
    const db = getDb();
    const r = db.prepare("SELECT * FROM coordinator_reports WHERE id = ?").get(String(req.params.id));
    if (!r) {
      res.status(404).json({ error: "Laporan koordinator tidak ditemukan." });
      return;
    }
    db.prepare("UPDATE coordinator_reports SET status = ?, review_note = ?, reviewed_by = ? WHERE id = ?").run(
      String(decision),
      String(note || ""),
      req.authUser.fullName,
      String(r.id)
    );
    writeAuditLog(db, req.authUser, "REVIEW_COORDINATOR_REPORT", "coordinator_report", String(r.reference_number), "berhasil", String(decision));
    res.json({ ok: true });
  });
}

// server/routes_modules.ts
import crypto4 from "node:crypto";
import fs4 from "node:fs";
import path4 from "node:path";
import JSZip from "jszip";
import { jsPDF } from "jspdf";
function registerModuleRoutes(app) {
  app.get("/api/tasks", requireAuth, requirePermission("tugas", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    let sql = "SELECT * FROM tasks WHERE 1=1";
    const params = [];
    if (user.role === "duta") {
      sql += " AND assignee_id = ?";
      params.push(user.id);
    } else if (user.role === "koordinator_wilayah" && user.provinceCode) {
      sql += " AND (province_code = ? OR assignee_id = ?)";
      params.push(user.provinceCode, user.id);
    }
    sql += " ORDER BY deadline ASC";
    const rows = db.prepare(sql).all(...params);
    const tasks = rows.map((r) => {
      const commentCount = db.prepare("SELECT COUNT(*) AS c FROM task_comments WHERE task_id = ?").get(String(r.id)).c;
      return {
        id: String(r.id),
        referenceNumber: String(r.reference_number),
        title: String(r.title),
        description: String(r.description),
        priority: String(r.priority),
        status: String(r.status),
        deadline: String(r.deadline),
        provinceCode: r.province_code ? String(r.province_code) : null,
        provinceName: r.province_code ? PROVINCE_BY_CODE.get(String(r.province_code))?.name ?? null : null,
        batchId: r.batch_id ? String(r.batch_id) : null,
        assigneeId: String(r.assignee_id),
        assigneeName: String(r.assignee_name),
        creatorName: String(r.creator_name),
        checklist: JSON.parse(String(r.checklist_json || "[]")),
        isTemplate: Boolean(r.is_template),
        recurrence: String(r.recurrence),
        commentCount,
        createdAt: String(r.created_at)
      };
    });
    res.json({ tasks });
  });
  app.post("/api/tasks", requireAuth, requirePermission("tugas", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.title || !b.deadline) {
      res.status(422).json({ error: "Judul tugas dan tenggat waktu wajib diisi." });
      return;
    }
    const db = getDb();
    const user = req.authUser;
    const refNo = nextReferenceNumber(db, "TGS");
    const id = crypto4.randomUUID();
    const assigneeId = String(b.assigneeId || user.id);
    const assigneeRow = db.prepare("SELECT full_name FROM users WHERE id = ?").get(assigneeId);
    db.prepare(
      `INSERT INTO tasks (id, reference_number, title, description, priority, status, deadline, province_code, batch_id, assignee_id, assignee_name, creator_id, creator_name, checklist_json, is_template, recurrence, created_at)
       VALUES (?, ?, ?, ?, ?, 'belum_dimulai', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      refNo,
      String(b.title),
      String(b.description || ""),
      String(b.priority || "sedang"),
      String(b.deadline),
      b.provinceCode ? String(b.provinceCode) : user.provinceCode,
      String(b.batchId || "batch-3"),
      assigneeId,
      assigneeRow?.full_name || user.fullName,
      user.id,
      user.fullName,
      JSON.stringify(Array.isArray(b.checklist) ? b.checklist : []),
      b.isTemplate ? 1 : 0,
      String(b.recurrence || "tidak"),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    if (assigneeId !== user.id) {
      db.prepare(
        `INSERT INTO notifications (id, user_id, title, message, category, target_path, is_read, created_at)
         VALUES (?, ?, ?, ?, 'tugas', '/tugas', 0, ?)`
      ).run(crypto4.randomUUID(), assigneeId, `Tugas Baru ${refNo}`, String(b.title), (/* @__PURE__ */ new Date()).toISOString());
    }
    writeAuditLog(db, user, "CREATE_TASK", "task", refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });
  app.post("/api/tasks/bulk-assign", requireAuth, requirePermission("tugas", "assign"), (req, res) => {
    const { title, description, deadline, provinceCode, priority } = req.body ?? {};
    if (!title || !deadline || !provinceCode) {
      res.status(422).json({ error: "Judul tugas, tenggat, dan provinsi target wajib diisi." });
      return;
    }
    const db = getDb();
    const targets = db.prepare("SELECT id, full_name FROM users WHERE province_code = ? AND account_status = 'aktif'").all(String(provinceCode));
    let created = 0;
    const now = (/* @__PURE__ */ new Date()).toISOString();
    for (const t of targets) {
      const refNo = nextReferenceNumber(db, "TGS");
      db.prepare(
        `INSERT INTO tasks (id, reference_number, title, description, priority, status, deadline, province_code, batch_id, assignee_id, assignee_name, creator_id, creator_name, checklist_json, is_template, recurrence, created_at)
         VALUES (?, ?, ?, ?, ?, 'belum_dimulai', ?, ?, 'batch-3', ?, ?, ?, ?, '[]', 0, 'tidak', ?)`
      ).run(crypto4.randomUUID(), refNo, String(title), String(description || ""), String(priority || "sedang"), String(deadline), String(provinceCode), t.id, t.full_name, req.authUser.id, req.authUser.fullName, now);
      created += 1;
    }
    writeAuditLog(db, req.authUser, "BULK_ASSIGN_TASK", "task", `prov:${provinceCode}`, "berhasil", `${created} penerima`);
    res.json({ ok: true, assignedCount: created });
  });
  app.patch("/api/tasks/:id", requireAuth, requirePermission("tugas", "edit"), (req, res) => {
    const { status, checklist } = req.body ?? {};
    const db = getDb();
    db.prepare("UPDATE tasks SET status = COALESCE(?, status), checklist_json = COALESCE(?, checklist_json) WHERE id = ?").run(
      status ?? null,
      checklist ? JSON.stringify(checklist) : null,
      String(req.params.id)
    );
    res.json({ ok: true });
  });
  app.get("/api/tasks/:id/comments", requireAuth, requirePermission("tugas", "view"), (req, res) => {
    const db = getDb();
    const comments = db.prepare("SELECT * FROM task_comments WHERE task_id = ? ORDER BY created_at ASC").all(String(req.params.id));
    res.json({ comments });
  });
  app.post("/api/tasks/:id/comments", requireAuth, requirePermission("tugas", "view"), (req, res) => {
    const body = String(req.body?.body || "").trim();
    if (!body) {
      res.status(422).json({ error: "Isi komentar tidak boleh kosong." });
      return;
    }
    const db = getDb();
    db.prepare("INSERT INTO task_comments (id, task_id, author_id, author_name, body, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      crypto4.randomUUID(),
      String(req.params.id),
      req.authUser.id,
      req.authUser.fullName,
      body,
      (/* @__PURE__ */ new Date()).toISOString()
    );
    res.status(201).json({ ok: true });
  });
  app.get("/api/documents", requireAuth, requirePermission("dokumen", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    let sql = "SELECT * FROM documents WHERE 1=1";
    if (user.role === "duta" || user.role === "alumni") {
      sql += " AND access_level IN ('internal_semua')";
    } else if (user.role === "koordinator_wilayah") {
      sql += " AND access_level IN ('internal_semua', 'koordinator_ke_atas')";
    }
    sql += " ORDER BY created_at DESC";
    const rows = db.prepare(sql).all();
    res.json({
      documents: rows.map((d) => ({
        id: String(d.id),
        documentNumber: String(d.document_number),
        title: String(d.title),
        category: String(d.category),
        ownerName: String(d.owner_name),
        issuerName: String(d.issuer_name),
        issuedDate: String(d.issued_date),
        status: String(d.status),
        version: String(d.version),
        accessLevel: String(d.access_level),
        fileId: d.file_id ? String(d.file_id) : null,
        fileName: d.file_name ? String(d.file_name) : null,
        fileSizeBytes: Number(d.file_size_bytes || 0),
        notes: String(d.notes || ""),
        expiresAt: d.expires_at ? String(d.expires_at) : null
      }))
    });
  });
  app.post("/api/documents", requireAuth, requirePermission("dokumen", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.title || !b.category) {
      res.status(422).json({ error: "Judul dan kategori dokumen wajib diisi." });
      return;
    }
    const db = getDb();
    const docNo = nextReferenceNumber(db, "DOC");
    const id = crypto4.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(
      `INSERT INTO documents (id, document_number, title, category, owner_name, issuer_name, issued_date, status, version, access_level, file_id, file_name, file_size_bytes, notes, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'berlaku', ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      docNo,
      String(b.title),
      String(b.category),
      String(b.ownerName || req.authUser.fullName),
      req.authUser.fullName,
      String(b.issuedDate || now.slice(0, 10)),
      String(b.version || "1.0"),
      String(b.accessLevel || "internal_semua"),
      b.fileId ? String(b.fileId) : null,
      b.fileName ? String(b.fileName) : null,
      Number(b.fileSizeBytes || 0),
      String(b.notes || ""),
      b.expiresAt ? String(b.expiresAt) : null,
      now
    );
    writeAuditLog(db, req.authUser, "PUBLISH_DOCUMENT", "document", docNo);
    writeActivityTimeline(db, "Dokumen", `Dokumen ${docNo} Diterbitkan`, `${b.title} (${b.category}) diterbitkan.`, req.authUser.fullName, null, null, "/dokumen");
    res.status(201).json({ ok: true, id, documentNumber: docNo });
  });
  app.post("/api/documents/bulk-generate", requireAuth, requirePermission("dokumen", "publish"), async (req, res) => {
    const { personnelIds, templateTitle, templateBody, category } = req.body ?? {};
    const ids = Array.isArray(personnelIds) ? personnelIds : [];
    if (ids.length === 0 || !templateTitle || !templateBody) {
      res.status(422).json({ error: "Pilih minimal satu personel serta judul dan isi template dokumen." });
      return;
    }
    const db = getDb();
    const zip = new JSZip();
    const now = /* @__PURE__ */ new Date();
    const dateStr = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(now);
    for (const pid of ids) {
      const p = db.prepare("SELECT p.*, b.name AS batch_name FROM personnel p LEFT JOIN batches b ON b.id = p.batch_id WHERE p.id = ?").get(String(pid));
      if (!p) continue;
      const docNo = nextReferenceNumber(db, "DOC");
      const provName = PROVINCE_BY_CODE.get(String(p.province_code))?.name ?? String(p.province_code);
      const rendered = String(templateBody).replace(/\{\{nama\}\}/g, String(p.full_name)).replace(/\{\{provinsi\}\}/g, provName).replace(/\{\{angkatan\}\}/g, String(p.batch_name || p.batch_id)).replace(/\{\{jabatan\}\}/g, String(p.position_title)).replace(/\{\{nomor_surat\}\}/g, docNo).replace(/\{\{tanggal\}\}/g, dateStr);
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      doc.setFontSize(16);
      doc.text("DUTA PELAJAR BERBUDAYA INDONESIA (DPBI)", 50, 60);
      doc.setFontSize(12);
      doc.text(String(templateTitle), 50, 88);
      doc.setFontSize(10);
      doc.text(`Nomor Dokumen: ${docNo}`, 50, 110);
      doc.text(`Tanggal Terbit: ${dateStr}`, 50, 126);
      doc.line(50, 140, 545, 140);
      const lines = doc.splitTextToSize(rendered, 490);
      doc.text(lines, 50, 168);
      const pdfBytes = Buffer.from(doc.output("arraybuffer"));
      const safeName = String(p.full_name).replace(/[^a-zA-Z0-9]/g, "_");
      zip.file(`${docNo.replace(/\//g, "_")}_${safeName}.pdf`, pdfBytes);
      db.prepare(
        `INSERT INTO documents (id, document_number, title, category, owner_name, issuer_name, issued_date, status, version, access_level, file_size_bytes, notes, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'berlaku', '1.0', 'internal_semua', ?, ?, ?)`
      ).run(
        crypto4.randomUUID(),
        docNo,
        `${templateTitle} \u2014 ${p.full_name}`,
        String(category || "Sertifikat"),
        String(p.full_name),
        req.authUser.fullName,
        now.toISOString().slice(0, 10),
        pdfBytes.length,
        `Diterbitkan massal melalui Bulk Document Generator`,
        now.toISOString()
      );
    }
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    writeAuditLog(db, req.authUser, "BULK_GENERATE_DOCUMENTS", "document", `count:${ids.length}`);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="SATU_DPBI_Dokumen_Massal.zip"');
    res.send(zipBuf);
  });
  app.get("/api/announcements", requireAuth, (_req, res) => {
    const db = getDb();
    const announcements = db.prepare("SELECT * FROM announcements ORDER BY published_at DESC").all();
    res.json({ announcements });
  });
  app.post("/api/announcements", requireAuth, requirePermission("pengumuman", "create"), (req, res) => {
    const { title, body, scope, provinceCode, priority } = req.body ?? {};
    if (!title || !body) {
      res.status(422).json({ error: "Judul dan isi pengumuman wajib diisi." });
      return;
    }
    const db = getDb();
    const id = crypto4.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db.prepare(
      `INSERT INTO announcements (id, title, body, scope, province_code, batch_id, priority, author_name, published_at, status)
       VALUES (?, ?, ?, ?, ?, 'batch-3', ?, ?, ?, 'terbit')`
    ).run(id, String(title), String(body), String(scope || "nasional"), provinceCode ? String(provinceCode) : null, String(priority || "normal"), req.authUser.fullName, now);
    writeActivityTimeline(db, "Pengumuman", String(title), String(body).slice(0, 140), req.authUser.fullName, provinceCode ? String(provinceCode) : null, null, "/pengumuman");
    res.status(201).json({ ok: true, id });
  });
  app.get("/api/calendar", requireAuth, (_req, res) => {
    const db = getDb();
    const events = db.prepare("SELECT * FROM calendar_events ORDER BY start_at ASC").all();
    res.json({ events });
  });
  app.post("/api/calendar", requireAuth, requirePermission("kalender", "create"), (req, res) => {
    const { title, category, startAt, endAt, location, description, provinceCode } = req.body ?? {};
    if (!title || !startAt) {
      res.status(422).json({ error: "Judul agenda dan waktu mulai wajib diisi." });
      return;
    }
    const db = getDb();
    const id = crypto4.randomUUID();
    db.prepare(
      `INSERT INTO calendar_events (id, title, category, start_at, end_at, province_code, batch_id, location, description)
       VALUES (?, ?, ?, ?, ?, ?, 'batch-3', ?, ?)`
    ).run(id, String(title), String(category || "Agenda Organisasi"), String(startAt), String(endAt || startAt), provinceCode ? String(provinceCode) : null, String(location || "Daring / Nasional"), String(description || ""));
    res.status(201).json({ ok: true, id });
  });
  app.get("/api/notifications", requireAuth, (req, res) => {
    const db = getDb();
    const rows = db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50").all(req.authUser.id);
    res.json({
      notifications: rows.map((n) => ({
        id: String(n.id),
        userId: String(n.user_id),
        title: String(n.title),
        message: String(n.message),
        category: String(n.category),
        targetPath: String(n.target_path),
        isRead: Boolean(n.is_read),
        createdAt: String(n.created_at)
      }))
    });
  });
  app.post("/api/notifications/:id/read", requireAuth, (req, res) => {
    const db = getDb();
    db.prepare("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?").run(String(req.params.id), req.authUser.id);
    res.json({ ok: true });
  });
  app.post("/api/notifications/read-all", requireAuth, (req, res) => {
    const db = getDb();
    db.prepare("UPDATE notifications SET is_read = 1 WHERE user_id = ?").run(req.authUser.id);
    res.json({ ok: true });
  });
  app.get("/api/saved-views", requireAuth, (req, res) => {
    const db = getDb();
    const views = db.prepare("SELECT * FROM saved_views WHERE user_id = ? ORDER BY created_at DESC").all(req.authUser.id);
    res.json({ views });
  });
  app.post("/api/saved-views", requireAuth, (req, res) => {
    const { module, name, filter } = req.body ?? {};
    if (!module || !name) {
      res.status(422).json({ error: "Nama tampilan tersimpan wajib diisi." });
      return;
    }
    const db = getDb();
    const id = crypto4.randomUUID();
    db.prepare("INSERT INTO saved_views (id, user_id, module, name, filter_json, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      id,
      req.authUser.id,
      String(module),
      String(name),
      JSON.stringify(filter || {}),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    res.status(201).json({ ok: true, id });
  });
  app.get("/api/safeguarding", requireAuth, requirePermission("perlindungan", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    const risks = db.prepare("SELECT * FROM risk_assessments ORDER BY created_at DESC").all();
    const consents = db.prepare(`SELECT * FROM consent_records ${user.role === "duta" ? "WHERE personnel_id = ?" : ""} ORDER BY recorded_at DESC`).all(...user.role === "duta" ? [user.personnelId || ""] : []);
    const isAuthorizedSafety = ["super_admin", "penanggung_jawab", "wakil_super_admin"].includes(user.role);
    const incidents = isAuthorizedSafety ? db.prepare("SELECT * FROM incidents ORDER BY created_at DESC").all() : db.prepare("SELECT * FROM incidents WHERE reported_by_user_id = ? ORDER BY created_at DESC").all(user.id);
    const whistleblowing = isAuthorizedSafety ? db.prepare("SELECT * FROM whistleblowing_reports ORDER BY created_at DESC").all() : [];
    res.json({ risks, consents, incidents, whistleblowing, isAuthorizedSafety });
  });
  app.post("/api/safeguarding/risks", requireAuth, requirePermission("perlindungan", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.activityTitle || !b.emergencyPlan || !b.emergencyContact) {
      res.status(422).json({ error: "Nama kegiatan, rencana darurat, dan kontak darurat wajib diisi." });
      return;
    }
    const db = getDb();
    const id = crypto4.randomUUID();
    const chaperones = Number(b.adultChaperoneCount || 0);
    const u18 = b.participantUnder18 !== false;
    const status = u18 && chaperones < 2 ? "perlu_peninjauan" : "disetujui";
    db.prepare(
      `INSERT INTO risk_assessments (id, proposal_id, activity_title, province_code, participant_under_18, adult_chaperone_count, environment_notes, transport_plan, emergency_plan, emergency_contact, risk_level, status, submitted_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      b.proposalId ? String(b.proposalId) : null,
      String(b.activityTitle),
      String(b.provinceCode || req.authUser.provinceCode || "31"),
      u18 ? 1 : 0,
      chaperones,
      String(b.environmentNotes || ""),
      String(b.transportPlan || ""),
      String(b.emergencyPlan),
      String(b.emergencyContact),
      String(b.riskLevel || "sedang"),
      status,
      req.authUser.fullName,
      (/* @__PURE__ */ new Date()).toISOString()
    );
    res.status(201).json({ ok: true, id, status });
  });
  app.post("/api/safeguarding/consents", requireAuth, requirePermission("perlindungan", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.activityTitle) {
      res.status(422).json({ error: "Nama kegiatan wajib diisi." });
      return;
    }
    const db = getDb();
    const id = crypto4.randomUUID();
    db.prepare(
      `INSERT INTO consent_records (id, personnel_id, personnel_name, activity_title, consent_participation, consent_guardian, consent_documentation, consent_publication, recorded_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.authUser.personnelId || req.authUser.id,
      String(b.personnelName || req.authUser.fullName),
      String(b.activityTitle),
      b.consentParticipation ? 1 : 0,
      b.consentGuardian ? 1 : 0,
      b.consentDocumentation ? 1 : 0,
      b.consentPublication ? 1 : 0,
      (/* @__PURE__ */ new Date()).toISOString()
    );
    res.status(201).json({ ok: true, id });
  });
  app.post("/api/safeguarding/incidents", requireAuth, requirePermission("perlindungan", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.location || !b.category || !b.chronology) {
      res.status(422).json({ error: "Lokasi, kategori, dan kronologi faktual insiden wajib diisi." });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, "INS");
    const id = crypto4.randomUUID();
    db.prepare(
      `INSERT INTO incidents (id, reference_number, occurred_at, location, province_code, category, urgency, chronology, initial_action, escalated_to, status, reported_by_user_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Penanggung Jawab Organisasi', 'ditangani', ?, ?)`
    ).run(
      id,
      refNo,
      String(b.occurredAt || (/* @__PURE__ */ new Date()).toISOString()),
      String(b.location),
      String(b.provinceCode || req.authUser.provinceCode || "31"),
      String(b.category),
      String(b.urgency || "sedang"),
      String(b.chronology),
      String(b.initialAction || ""),
      req.authUser.id,
      (/* @__PURE__ */ new Date()).toISOString()
    );
    writeAuditLog(db, req.authUser, "REPORT_INCIDENT", "incident", refNo);
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });
  app.post("/api/safeguarding/whistleblowing", requireAuth, (req, res) => {
    const b = req.body ?? {};
    if (!b.category || !b.chronology) {
      res.status(422).json({ error: "Kategori dan kronologi pengaduan wajib diisi." });
      return;
    }
    const db = getDb();
    const refNo = nextReferenceNumber(db, "ADU");
    const id = crypto4.randomUUID();
    const conflictRerouted = Boolean(b.conflictWithPrimaryHandler);
    const handlerRole = conflictRerouted ? "super_admin" : "penanggung_jawab";
    db.prepare(
      `INSERT INTO whistleblowing_reports (id, reference_number, reporter_mode, category, chronology, assigned_handler_role, conflict_rerouted, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'baru', ?)`
    ).run(id, refNo, String(b.reporterMode || "rahasia"), String(b.category), String(b.chronology), handlerRole, conflictRerouted ? 1 : 0, (/* @__PURE__ */ new Date()).toISOString());
    writeAuditLog(db, req.authUser, "SUBMIT_WHISTLEBLOWING", "whistleblowing", refNo, "berhasil", conflictRerouted ? "Dialihkan karena konflik kepentingan" : "Penanggung Jawab");
    res.status(201).json({ ok: true, id, referenceNumber: refNo });
  });
  app.get("/api/evaluations", requireAuth, requirePermission("evaluasi", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    let sql = "SELECT * FROM evaluations WHERE 1=1";
    const params = [];
    if (user.role === "duta") {
      sql += " AND personnel_id = ?";
      params.push(user.personnelId || "__none__");
    } else if (user.role === "koordinator_wilayah" && user.provinceCode) {
      sql += " AND province_code = ?";
      params.push(user.provinceCode);
    }
    sql += " ORDER BY created_at DESC";
    const evaluations = db.prepare(sql).all(...params);
    res.json({ evaluations });
  });
  app.post("/api/evaluations", requireAuth, requirePermission("evaluasi", "create"), (req, res) => {
    const b = req.body ?? {};
    if (!b.personnelId || !b.coachingRecommendation) {
      res.status(422).json({ error: "Personel dan catatan rekomendasi pembinaan wajib diisi." });
      return;
    }
    const db = getDb();
    const pers = db.prepare("SELECT full_name, role_code, province_code, batch_id FROM personnel WHERE id = ?").get(String(b.personnelId));
    if (!pers) {
      res.status(404).json({ error: "Personel tidak ditemukan." });
      return;
    }
    const t = Number(b.taskCompletionScore || 85);
    const tl = Number(b.reportTimelinessScore || 85);
    const q = Number(b.reportQualityScore || 85);
    const c = Number(b.coordinationScore || 85);
    const total = Math.round((t * 0.3 + tl * 0.25 + q * 0.25 + c * 0.2) * 10) / 10;
    const id = crypto4.randomUUID();
    db.prepare(
      `INSERT INTO evaluations (id, personnel_id, personnel_name, role_code, province_code, batch_id, task_completion_score, report_timeliness_score, report_quality_score, coordination_score, total_score, evaluator_name, coaching_recommendation, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'final', ?)`
    ).run(
      id,
      String(b.personnelId),
      String(pers.full_name),
      String(pers.role_code),
      String(pers.province_code),
      String(pers.batch_id),
      t,
      tl,
      q,
      c,
      total,
      req.authUser.fullName,
      String(b.coachingRecommendation),
      (/* @__PURE__ */ new Date()).toISOString()
    );
    writeAuditLog(db, req.authUser, "CREATE_EVALUATION", "evaluation", String(b.personnelId));
    res.status(201).json({ ok: true, id, totalScore: total });
  });
  app.get("/api/archive", requireAuth, requirePermission("arsip", "view"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    const archivedBatches = db.prepare("SELECT * FROM batches WHERE status IN ('selesai', 'diarsipkan') ORDER BY batch_number DESC").all();
    const personalDocs = db.prepare(`SELECT * FROM documents WHERE access_level = 'internal_semua' OR owner_name = ? ORDER BY issued_date DESC`).all(user.fullName);
    const personalLkl = db.prepare(`SELECT reference_number, activity_name, event_date, participant_count, status FROM lkl_reports ${user.personnelId ? "WHERE submitter_personnel_id = ?" : "LIMIT 10"}`).all(...user.personnelId ? [user.personnelId] : []);
    let alumniWindow = null;
    if (user.alumniAccessExpiresAt) {
      const termEnd = new Date(Date.parse(user.alumniAccessExpiresAt) - 30 * 24 * 60 * 60 * 1e3).toISOString();
      alumniWindow = calculateAlumniWindow(termEnd);
    }
    const alumniUsers = ["super_admin", "sekretariat_nasional"].includes(user.role) ? db.prepare("SELECT id, full_name, email, alumni_access_expires_at FROM users WHERE role = 'alumni'").all() : [];
    res.json({ archivedBatches, personalDocs, personalLkl, alumniWindow, alumniUsers });
  });
  app.get("/api/archive/export-personal", requireAuth, requirePermission("arsip", "download"), (req, res) => {
    const db = getDb();
    const user = req.authUser;
    const profile = user.personnelId ? db.prepare("SELECT * FROM personnel WHERE id = ?").get(user.personnelId) : null;
    const lkl = user.personnelId ? db.prepare("SELECT reference_number, activity_name, event_date, participant_count, status FROM lkl_reports WHERE submitter_personnel_id = ?").all(user.personnelId) : [];
    const proposals = user.personnelId ? db.prepare("SELECT reference_number, title, event_date, status FROM proposals WHERE applicant_personnel_id = ?").all(user.personnelId) : [];
    writeAuditLog(db, user, "EXPORT_PERSONAL_ARCHIVE", "user", user.id);
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="Arsip_Pribadi_${user.id.slice(0, 8)}.json"`);
    res.send(JSON.stringify({ exportedAt: (/* @__PURE__ */ new Date()).toISOString(), user: { fullName: user.fullName, email: user.email, role: user.roleLabel }, profile, proposals, lkl }, null, 2));
  });
  app.post("/api/archive/alumni/:userId/extend", requireAuth, requirePermission("arsip", "manage"), (req, res) => {
    const { days, reason } = req.body ?? {};
    if (!reason) {
      res.status(422).json({ error: "Alasan perpanjangan akses Alumni wajib dicatat." });
      return;
    }
    const db = getDb();
    const target = db.prepare("SELECT id, alumni_access_expires_at FROM users WHERE id = ? AND role = 'alumni'").get(String(req.params.userId));
    if (!target) {
      res.status(404).json({ error: "Akun Alumni tidak ditemukan." });
      return;
    }
    const baseMs = target.alumni_access_expires_at ? Math.max(Date.now(), Date.parse(target.alumni_access_expires_at)) : Date.now();
    const nextExp = new Date(baseMs + Number(days || 30) * 24 * 60 * 60 * 1e3).toISOString();
    db.prepare("UPDATE users SET alumni_access_expires_at = ? WHERE id = ?").run(nextExp, target.id);
    writeAuditLog(db, req.authUser, "EXTEND_ALUMNI_ACCESS", "user", target.id, "berhasil", `+${days || 30} hari: ${reason}`);
    res.json({ ok: true, newExpiresAt: nextExp });
  });
  app.get("/api/system/overview", requireAuth, requirePermission("sistem", "view"), (_req, res) => {
    const db = getDb();
    const files = db.prepare("SELECT * FROM stored_files ORDER BY created_at DESC").all();
    const totalUsedBytes = files.reduce((acc, f) => acc + Number(f.size_bytes || 0), 0);
    const dbSizeBytes = fs4.existsSync(DB_PATH) ? fs4.statSync(DB_PATH).size : 0;
    const quotaMbRow = db.prepare("SELECT value FROM system_settings WHERE key = 'storage_quota_mb'").get();
    const quotaBytes = Number(quotaMbRow?.value || 10240) * 1024 * 1024;
    const byModule = {};
    for (const f of files) {
      const mod = String(f.module || "umum");
      byModule[mod] = (byModule[mod] || 0) + Number(f.size_bytes || 0);
    }
    const backups = db.prepare("SELECT * FROM backups ORDER BY created_at DESC").all();
    const automationJobs = db.prepare("SELECT * FROM automation_jobs ORDER BY id ASC").all();
    const auditLogs = db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 50").all();
    const timeline = db.prepare("SELECT * FROM activity_timeline ORDER BY created_at DESC LIMIT 50").all();
    const settings = db.prepare("SELECT * FROM system_settings").all();
    const findings = [];
    const incompleteProfiles = db.prepare("SELECT id, full_name FROM personnel WHERE verification_status != 'terverifikasi'").all();
    for (const ip of incompleteProfiles) {
      findings.push({
        id: `dq-prof-${ip.id}`,
        severity: "sedang",
        type: "Profil Belum Terverifikasi",
        detail: `${ip.full_name} belum menyelesaikan verifikasi berkas identitas.`,
        actionPath: "/personalia"
      });
    }
    const coachingProvs = db.prepare("SELECT code, name FROM provinces WHERE status = 'dalam_pembinaan' AND coordinator_name IS NULL").all();
    for (const cp of coachingProvs) {
      findings.push({
        id: `dq-prov-${cp.code}`,
        severity: "tinggi",
        type: "Wilayah Dalam Pembinaan Tanpa Koordinator",
        detail: `Provinsi ${cp.name} memerlukan penetapan Koordinator Wilayah.`,
        actionPath: "/wilayah"
      });
    }
    const kemendikdasmenStatus = db.prepare("SELECT value FROM system_settings WHERE key = 'kemendikdasmen_status'").get()?.value || "nonaktif";
    res.json({
      storage: {
        quotaBytes,
        usedFilesBytes: totalUsedBytes,
        dbSizeBytes,
        usedTotalBytes: totalUsedBytes + dbSizeBytes,
        percentUsed: Math.round((totalUsedBytes + dbSizeBytes) / quotaBytes * 1e4) / 100,
        fileCount: files.length,
        byModule,
        largestFiles: files.slice(0, 6)
      },
      backups,
      automationJobs,
      findings,
      health: {
        database: "sehat",
        storage: totalUsedBytes + dbSizeBytes < quotaBytes * 0.85 ? "sehat" : "peringatan",
        authSessionEngine: "sehat",
        demoMode: IS_DEMO_MODE,
        kemendikdasmenIntegration: kemendikdasmenStatus,
        uptimeSeconds: Math.round(process.uptime())
      },
      auditLogs,
      timeline,
      settings
    });
  });
  app.post("/api/system/backup", requireAuth, requirePermission("sistem", "manage"), async (req, res) => {
    const db = getDb();
    const now = /* @__PURE__ */ new Date();
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    const backupName = `satu_dpbi_backup_${stamp}.zip`;
    const zip = new JSZip();
    if (fs4.existsSync(DB_PATH)) {
      zip.file("database.sqlite", fs4.readFileSync(DB_PATH));
    }
    const filesFolder = zip.folder("private_files");
    if (filesFolder && fs4.existsSync(PRIVATE_STORAGE_DIR)) {
      for (const fn of fs4.readdirSync(PRIVATE_STORAGE_DIR)) {
        const fp = path4.join(PRIVATE_STORAGE_DIR, fn);
        if (fs4.statSync(fp).isFile()) {
          filesFolder.file(fn, fs4.readFileSync(fp));
        }
      }
    }
    zip.file("manifest.json", JSON.stringify({ createdAt: now.toISOString(), isDemoMode: IS_DEMO_MODE, createdBy: req.authUser.fullName }, null, 2));
    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    const outPath = path4.join(BACKUP_STORAGE_DIR, backupName);
    fs4.writeFileSync(outPath, zipBuf);
    const checksum = sha256(zipBuf);
    const id = crypto4.randomUUID();
    db.prepare(
      `INSERT INTO backups (id, backup_name, backup_type, size_bytes, checksum_sha256, status, notes, created_by, created_at)
       VALUES (?, ?, 'manual', ?, ?, 'berhasil', 'Backup database & berkas privat tervalidasi SHA-256.', ?, ?)`
    ).run(id, backupName, zipBuf.length, checksum, req.authUser.fullName, now.toISOString());
    writeAuditLog(db, req.authUser, "CREATE_BACKUP", "backup", backupName);
    res.status(201).json({ ok: true, id, backupName, sizeBytes: zipBuf.length, checksum });
  });
  app.get("/api/system/backup/:id/download", requireAuth, requirePermission("sistem", "manage"), (req, res) => {
    const db = getDb();
    const b = db.prepare("SELECT * FROM backups WHERE id = ?").get(String(req.params.id));
    if (!b) {
      res.status(404).json({ error: "Arsip backup tidak ditemukan." });
      return;
    }
    const filePath = path4.join(BACKUP_STORAGE_DIR, path4.basename(String(b.backup_name)));
    if (!fs4.existsSync(filePath)) {
      res.status(404).json({ error: "Berkas backup fisik tidak tersedia." });
      return;
    }
    writeAuditLog(db, req.authUser, "DOWNLOAD_BACKUP", "backup", String(b.backup_name));
    res.download(filePath, String(b.backup_name));
  });
  app.post("/api/system/backup/:id/validate", requireAuth, requirePermission("sistem", "restore"), (req, res) => {
    const db = getDb();
    const b = db.prepare("SELECT * FROM backups WHERE id = ?").get(String(req.params.id));
    if (!b) {
      res.status(404).json({ error: "Backup tidak ditemukan." });
      return;
    }
    const filePath = path4.join(BACKUP_STORAGE_DIR, path4.basename(String(b.backup_name)));
    if (!fs4.existsSync(filePath)) {
      res.status(404).json({ error: "Berkas fisik backup hilang." });
      return;
    }
    const actualChecksum = sha256(fs4.readFileSync(filePath));
    const valid = actualChecksum === String(b.checksum_sha256);
    writeAuditLog(db, req.authUser, "VALIDATE_BACKUP", "backup", String(b.backup_name), valid ? "berhasil" : "gagal");
    res.json({ ok: true, valid, actualChecksum, expectedChecksum: String(b.checksum_sha256) });
  });
  app.post("/api/system/backup/:id/restore", requireAuth, requirePermission("sistem", "restore"), async (req, res) => {
    const { confirmed } = req.body ?? {};
    if (confirmed !== true) {
      res.status(422).json({ error: "Konfirmasi eksplisit wajib dicentang sebelum menjalankan pemulihan (restore)." });
      return;
    }
    const db = getDb();
    const b = db.prepare("SELECT * FROM backups WHERE id = ?").get(String(req.params.id));
    if (!b) {
      res.status(404).json({ error: "Backup tidak ditemukan." });
      return;
    }
    const filePath = path4.join(BACKUP_STORAGE_DIR, path4.basename(String(b.backup_name)));
    if (!fs4.existsSync(filePath)) {
      res.status(404).json({ error: "Berkas backup tidak ditemukan." });
      return;
    }
    const buf = fs4.readFileSync(filePath);
    if (sha256(buf) !== String(b.checksum_sha256)) {
      res.status(422).json({ error: "Validasi integritas SHA-256 gagal. Pemulihan dibatalkan." });
      return;
    }
    const zip = await JSZip.loadAsync(buf);
    const dbEntry = zip.file("database.sqlite");
    if (!dbEntry) {
      res.status(422).json({ error: "Berkas database.sqlite tidak ada di dalam arsip backup." });
      return;
    }
    const restoredDbBuf = await dbEntry.async("nodebuffer");
    const actor = req.authUser;
    resetDbConnection();
    fs4.writeFileSync(DB_PATH, restoredDbBuf);
    const freshDb = getDb();
    writeAuditLog(freshDb, actor, "RESTORE_BACKUP", "backup", String(b.backup_name), "berhasil", "Database dipulihkan setelah validasi SHA-256.");
    res.json({ ok: true, message: "Pemulihan database berhasil dijalankan dan diverifikasi." });
  });
  app.post("/api/system/automation/:id/toggle", requireAuth, requirePermission("sistem", "configure"), (req, res) => {
    const db = getDb();
    const job = db.prepare("SELECT * FROM automation_jobs WHERE id = ?").get(String(req.params.id));
    if (!job) {
      res.status(404).json({ error: "Job otomatisasi tidak ditemukan." });
      return;
    }
    const nextEnabled = job.enabled ? 0 : 1;
    db.prepare("UPDATE automation_jobs SET enabled = ? WHERE id = ?").run(nextEnabled, String(job.id));
    writeAuditLog(db, req.authUser, "TOGGLE_AUTOMATION", "automation_job", String(job.job_key), "berhasil", nextEnabled ? "diaktifkan" : "dinonaktifkan");
    res.json({ ok: true, enabled: Boolean(nextEnabled) });
  });
  app.post("/api/system/automation/:id/run", requireAuth, requirePermission("sistem", "manage"), (req, res) => {
    const db = getDb();
    const job = db.prepare("SELECT * FROM automation_jobs WHERE id = ?").get(String(req.params.id));
    if (!job) {
      res.status(404).json({ error: "Job otomatisasi tidak ditemukan." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const msg = `Eksekusi manual aman dijalankan pada ${now} oleh ${req.authUser.fullName}.`;
    db.prepare("UPDATE automation_jobs SET last_run_at = ?, last_status = 'berhasil', last_message = ? WHERE id = ?").run(now, msg, String(job.id));
    writeAuditLog(db, req.authUser, "RUN_AUTOMATION", "automation_job", String(job.job_key));
    res.json({ ok: true, message: msg });
  });
  app.get("/api/timeline", requireAuth, (_req, res) => {
    const db = getDb();
    const timeline = db.prepare("SELECT * FROM activity_timeline ORDER BY created_at DESC LIMIT 30").all();
    res.json({ timeline });
  });
  app.get("/api/settings/users", requireAuth, requirePermission("pengaturan", "manage"), (_req, res) => {
    const db = getDb();
    const users = db.prepare("SELECT id, email, full_name, role, bidang, province_code, account_status, last_login_at, created_at FROM users ORDER BY created_at DESC").all();
    res.json({
      users: users.map((u) => ({
        id: String(u.id),
        email: String(u.email),
        fullName: String(u.full_name),
        role: String(u.role),
        roleLabel: ROLE_LABELS[u.role] ?? String(u.role),
        bidang: u.bidang ? String(u.bidang) : null,
        provinceCode: u.province_code ? String(u.province_code) : null,
        provinceName: u.province_code ? PROVINCE_BY_CODE.get(String(u.province_code))?.name ?? null : null,
        accountStatus: String(u.account_status),
        lastLoginAt: u.last_login_at ? String(u.last_login_at) : null
      }))
    });
  });
  app.post("/api/settings/users", requireAuth, requirePermission("pengaturan", "manage"), (req, res) => {
    const { fullName, email, password, role, provinceCode, bidang } = req.body ?? {};
    if (!fullName || !email || !password || !role) {
      res.status(422).json({ error: "Nama, email, kata sandi, dan role wajib diisi." });
      return;
    }
    const db = getDb();
    const cleanEmail = String(email).trim().toLowerCase();
    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(cleanEmail);
    if (exists) {
      res.status(422).json({ error: "Email sudah terdaftar." });
      return;
    }
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const userId = crypto4.randomUUID();
    const persId = crypto4.randomUUID();
    const refNo = nextReferenceNumber(db, "PERS");
    const memberNo = `DPBI-${(/* @__PURE__ */ new Date()).getFullYear()}-${String(Math.floor(1e3 + Math.random() * 8999))}`;
    db.prepare(
      `INSERT INTO personnel (id, member_number, reference_number, user_id, full_name, email, province_code, batch_id, position_title, bidang, role_code, personnel_status, verification_status, docs_checklist_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'batch-3', ?, ?, ?, 'aktif', 'terverifikasi', '{}', ?, ?)`
    ).run(persId, memberNo, refNo, userId, String(fullName), cleanEmail, String(provinceCode || "31"), ROLE_LABELS[role] ?? String(role), String(bidang || "Umum"), String(role), now, now);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, full_name, role, bidang, province_code, batch_id, personnel_id, account_status, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'batch-3', ?, 'aktif', ?, ?)`
    ).run(userId, cleanEmail, hashPassword(String(password)), String(fullName), String(role), String(bidang || "Umum"), String(provinceCode || "31"), persId, IS_DEMO_MODE ? 1 : 0, now);
    writeAuditLog(db, req.authUser, "CREATE_USER_DIRECT", "user", cleanEmail, "berhasil", `Role: ${role}`);
    res.status(201).json({ ok: true, id: userId });
  });
  app.patch("/api/settings/users/:id/status", requireAuth, requirePermission("pengaturan", "manage"), (req, res) => {
    const { accountStatus, role } = req.body ?? {};
    const db = getDb();
    const targetId = String(req.params.id);
    db.prepare("UPDATE users SET account_status = COALESCE(?, account_status), role = COALESCE(?, role) WHERE id = ?").run(
      accountStatus ?? null,
      role ?? null,
      targetId
    );
    if (accountStatus || role) {
      db.prepare("DELETE FROM sessions WHERE user_id = ?").run(targetId);
    }
    writeAuditLog(db, req.authUser, "UPDATE_USER_ACCOUNT", "user", targetId, "berhasil", `${accountStatus || ""} ${role || ""}`);
    res.json({ ok: true });
  });
  app.get("/api/settings/config", requireAuth, (_req, res) => {
    const db = getDb();
    const rows = db.prepare("SELECT key, value FROM system_settings").all();
    const settings = {};
    for (const r of rows) settings[r.key] = r.value;
    const seqs = db.prepare("SELECT category, year, last_seq FROM reference_sequences ORDER BY year DESC, category ASC").all();
    res.json({ settings, sequences: seqs });
  });
  app.patch("/api/system/settings", requireAuth, requirePermission("sistem", "configure"), (req, res) => {
    const updates = req.body?.settings;
    if (!updates || typeof updates !== "object") {
      res.status(422).json({ error: "Format pengaturan tidak valid." });
      return;
    }
    const db = getDb();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const stmt = db.prepare("INSERT INTO system_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at");
    for (const [k, v] of Object.entries(updates)) {
      if (k === "kemendikdasmen_integration_status") continue;
      stmt.run(String(k), String(v), now);
    }
    writeAuditLog(db, req.authUser, "UPDATE_SYSTEM_SETTINGS", "system_settings", Object.keys(updates).join(","));
    res.json({ ok: true });
  });
  app.get("/api/export/bundle", requireAuth, requirePermission("arsip", "export"), (req, res) => {
    const scope = String(req.query.scope || "proposals");
    const db = getDb();
    const user = req.authUser;
    let csv = "";
    if (scope === "personnel") {
      const rows = db.prepare("SELECT member_number, reference_number, full_name, province_code, school_name, role_code, verification_status FROM personnel ORDER BY created_at DESC").all();
      csv = "Nomor Anggota,Nomor Referensi,Nama Lengkap,Kode Provinsi,Sekolah,Peran,Verifikasi\n" + rows.map((r) => `"${r.member_number}","${r.reference_number}","${r.full_name}","${r.province_code}","${r.school_name}","${r.role_code}","${r.verification_status}"`).join("\n");
    } else if (scope === "lkl") {
      const rows = db.prepare("SELECT reference_number, activity_name, submitter_name, province_code, event_date, participant_count, status FROM lkl_reports ORDER BY created_at DESC").all();
      csv = "Nomor LKL,Kegiatan,Pelapor,Kode Provinsi,Tanggal,Peserta,Status\n" + rows.map((r) => `"${r.reference_number}","${r.activity_name}","${r.submitter_name}","${r.province_code}","${r.event_date}",${r.participant_count},"${r.status}"`).join("\n");
    } else {
      const rows = db.prepare("SELECT reference_number, title, applicant_name, province_code, event_date, status FROM proposals ORDER BY created_at DESC").all();
      csv = "Nomor Proposal,Judul,Pengaju,Kode Provinsi,Tanggal,Status\n" + rows.map((r) => `"${r.reference_number}","${r.title}","${r.applicant_name}","${r.province_code}","${r.event_date}","${r.status}"`).join("\n");
    }
    writeAuditLog(db, user, "EXPORT_DATA_CENTER", "export", scope, "berhasil", `Ekspor CSV ${scope}`);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="SATU_DPBI_${scope}_${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  });
}

// server.ts
async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3e3);
  const db = getDb();
  ensureSeeded(db);
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-XSS-Protection", "0");
    next();
  });
  app.use(express.json({ limit: "10mb" }));
  app.use(cookieParser());
  app.use("/assets", express.static(path5.resolve(process.cwd(), "public", "assets")));
  app.use("/api", requireSafeOrigin);
  registerCoreRoutes(app);
  registerModuleRoutes(app);
  app.use("/api", (_req, res) => {
    res.status(404).json({ error: "Endpoint API tidak ditemukan.", code: 404 });
  });
  app.use("/api", (err, req, res, _next) => {
    const refId = recordSystemError(db, 500, req.originalUrl, err);
    res.status(500).json({
      error: "Terjadi kesalahan internal pada layanan. Hubungi pengelola dengan menyertakan kode referensi.",
      code: 500,
      referenceId: refId
    });
  });
  if (process.env.NODE_ENV === "production") {
    const distDir = path5.resolve(process.cwd(), "dist");
    app.use(express.static(distDir));
    app.get("*", (_req, res) => {
      res.sendFile(path5.join(distDir, "index.html"));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
    app.get("*", async (req, res, next) => {
      try {
        const htmlPath = path5.resolve(process.cwd(), "index.html");
        let html = fs5.readFileSync(htmlPath, "utf8");
        html = await vite.transformIndexHtml(req.originalUrl, html);
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      } catch (err) {
        next(err);
      }
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `[SATU DPBI] Server berjalan pada port ${PORT} | Mode: ${IS_DEMO_MODE ? "DEMO_SIMULASI" : "PRODUKSI"}`
    );
  });
}
startServer().catch((err) => {
  console.error("[SATU DPBI] Gagal memulai server:", err);
  process.exit(1);
});
