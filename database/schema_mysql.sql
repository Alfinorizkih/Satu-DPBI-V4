-- ============================================================================
-- SATU DPBI — Skema Basis Data Relasional MySQL / MariaDB (cPanel Ready)
-- Sistem Administrasi Terpadu Utama Duta Pelajar Berbudaya Indonesia
-- Engine: InnoDB | Charset: utf8mb4_unicode_ci
-- ============================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `role` VARCHAR(48) NOT NULL,
  `bidang` VARCHAR(120) NULL,
  `province_code` VARCHAR(16) NULL,
  `batch_id` VARCHAR(64) NULL,
  `personnel_id` VARCHAR(64) NULL,
  `account_status` VARCHAR(32) NOT NULL DEFAULT 'aktif',
  `alumni_access_expires_at` VARCHAR(40) NULL,
  `is_demo` TINYINT(1) NOT NULL DEFAULT 0,
  `last_login_at` VARCHAR(40) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_province` (`province_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `token_hash` VARCHAR(128) NOT NULL,
  `device_label` VARCHAR(191) NOT NULL,
  `ip_address` VARCHAR(64) NOT NULL,
  `expires_at` VARCHAR(40) NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `last_seen_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sessions_token_hash` (`token_hash`),
  KEY `idx_sessions_user` (`user_id`),
  CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `invitations` (
  `id` VARCHAR(64) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `role` VARCHAR(48) NOT NULL,
  `province_code` VARCHAR(16) NULL,
  `batch_id` VARCHAR(64) NULL,
  `token_hash` VARCHAR(128) NOT NULL,
  `expires_at` VARCHAR(40) NOT NULL,
  `used_at` VARCHAR(40) NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_invitations_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `password_resets` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `token_hash` VARCHAR(128) NOT NULL,
  `expires_at` VARCHAR(40) NOT NULL,
  `used_at` VARCHAR(40) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_password_resets_token` (`token_hash`),
  CONSTRAINT `fk_password_resets_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `reference_sequences` (
  `category` VARCHAR(16) NOT NULL,
  `year` INT NOT NULL,
  `last_seq` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`category`, `year`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `provinces` (
  `code` VARCHAR(16) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `island` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'belum_terbentuk',
  `coordinator_id` VARCHAR(64) NULL,
  `coordinator_name` VARCHAR(191) NULL,
  `coaching_note` TEXT NULL,
  `min_lat` DOUBLE NOT NULL,
  `max_lat` DOUBLE NOT NULL,
  `min_lng` DOUBLE NOT NULL,
  `max_lng` DOUBLE NOT NULL,
  `center_lat` DOUBLE NOT NULL,
  `center_lng` DOUBLE NOT NULL,
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `batches` (
  `id` VARCHAR(64) NOT NULL,
  `batch_number` INT NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `opened_at` VARCHAR(40) NOT NULL,
  `closed_at` VARCHAR(40) NOT NULL,
  `briefing_at` VARCHAR(40) NOT NULL,
  `term_starts_at` VARCHAR(40) NOT NULL,
  `term_ends_at` VARCHAR(40) NOT NULL,
  `duration_months` INT NOT NULL DEFAULT 4,
  `status` VARCHAR(32) NOT NULL DEFAULT 'perencanaan',
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_batches_number` (`batch_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `personnel` (
  `id` VARCHAR(64) NOT NULL,
  `member_number` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `nickname` VARCHAR(120) NOT NULL DEFAULT '',
  `birth_place` VARCHAR(120) NOT NULL DEFAULT '',
  `birth_date` VARCHAR(32) NOT NULL DEFAULT '',
  `gender` VARCHAR(32) NOT NULL DEFAULT '',
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(48) NOT NULL DEFAULT '',
  `alt_contact` VARCHAR(120) NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `regency` VARCHAR(120) NOT NULL DEFAULT '',
  `district` VARCHAR(120) NOT NULL DEFAULT '',
  `village` VARCHAR(120) NOT NULL DEFAULT '',
  `postal_code` VARCHAR(16) NOT NULL DEFAULT '',
  `full_address` TEXT NOT NULL,
  `school_name` VARCHAR(191) NOT NULL DEFAULT '',
  `education_level` VARCHAR(64) NOT NULL DEFAULT 'SMA/SMK/MA',
  `grade_class` VARCHAR(32) NOT NULL DEFAULT '',
  `major` VARCHAR(120) NOT NULL DEFAULT '',
  `npsn` VARCHAR(32) NOT NULL DEFAULT '',
  `nisn` VARCHAR(32) NOT NULL DEFAULT '',
  `entry_year` INT NOT NULL DEFAULT 2024,
  `expected_grad_year` INT NOT NULL DEFAULT 2027,
  `school_address` TEXT NOT NULL,
  `school_regency` VARCHAR(120) NOT NULL DEFAULT '',
  `school_province` VARCHAR(120) NOT NULL DEFAULT '',
  `batch_id` VARCHAR(64) NOT NULL,
  `position_title` VARCHAR(120) NOT NULL DEFAULT 'Duta Pelajar Berbudaya',
  `bidang` VARCHAR(120) NOT NULL DEFAULT 'Kebudayaan',
  `role_code` VARCHAR(48) NOT NULL DEFAULT 'duta',
  `appointed_at` VARCHAR(32) NOT NULL DEFAULT '',
  `term_starts_at` VARCHAR(32) NOT NULL DEFAULT '',
  `term_ends_at` VARCHAR(32) NOT NULL DEFAULT '',
  `personnel_status` VARCHAR(32) NOT NULL DEFAULT 'aktif',
  `verification_status` VARCHAR(32) NOT NULL DEFAULT 'menunggu_verifikasi',
  `verification_note` TEXT NULL,
  `cultural_interests` TEXT NOT NULL,
  `activity_interests` TEXT NOT NULL,
  `org_experience` TEXT NOT NULL,
  `skills` TEXT NOT NULL,
  `guardian_name` VARCHAR(191) NOT NULL DEFAULT '',
  `guardian_relation` VARCHAR(64) NOT NULL DEFAULT '',
  `guardian_phone` VARCHAR(48) NOT NULL DEFAULT '',
  `docs_checklist_json` LONGTEXT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_personnel_member_number` (`member_number`),
  UNIQUE KEY `uq_personnel_ref` (`reference_number`),
  KEY `idx_personnel_province` (`province_code`),
  KEY `idx_personnel_batch` (`batch_id`),
  KEY `idx_personnel_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `account_requests` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `full_name` VARCHAR(191) NOT NULL,
  `email` VARCHAR(191) NOT NULL,
  `phone` VARCHAR(48) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `batch_id` VARCHAR(64) NOT NULL,
  `school_name` VARCHAR(191) NOT NULL,
  `supporting_file_id` VARCHAR(64) NULL,
  `supporting_file_name` VARCHAR(191) NULL,
  `requested_by_user_id` VARCHAR(64) NOT NULL,
  `requested_by_name` VARCHAR(191) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'menunggu',
  `decision_note` TEXT NULL,
  `decided_by` VARCHAR(191) NULL,
  `decided_at` VARCHAR(40) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_account_requests_ref` (`reference_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `organization_positions` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `bidang` VARCHAR(120) NOT NULL,
  `level` VARCHAR(64) NOT NULL,
  `holder_personnel_id` VARCHAR(64) NULL,
  `holder_name` VARCHAR(191) NULL,
  `sk_number` VARCHAR(120) NULL,
  `term_starts_at` VARCHAR(32) NULL,
  `term_ends_at` VARCHAR(32) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `delegations` (
  `id` VARCHAR(64) NOT NULL,
  `delegate_user_id` VARCHAR(64) NOT NULL,
  `delegate_name` VARCHAR(191) NOT NULL,
  `grantor_user_id` VARCHAR(64) NOT NULL,
  `grantor_name` VARCHAR(191) NOT NULL,
  `module` VARCHAR(64) NOT NULL,
  `action` VARCHAR(64) NOT NULL,
  `province_code` VARCHAR(16) NULL,
  `starts_at` VARCHAR(40) NOT NULL,
  `ends_at` VARCHAR(40) NOT NULL,
  `reason` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'aktif',
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_delegations_delegate` (`delegate_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `handovers` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `outgoing_coordinator_id` VARCHAR(64) NULL,
  `outgoing_coordinator_name` VARCHAR(191) NOT NULL,
  `incoming_coordinator_id` VARCHAR(64) NULL,
  `incoming_coordinator_name` VARCHAR(191) NOT NULL,
  `active_tasks_count` INT NOT NULL DEFAULT 0,
  `open_proposals_count` INT NOT NULL DEFAULT 0,
  `notes` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'menunggu_persetujuan',
  `approved_by` VARCHAR(191) NULL,
  `approved_at` VARCHAR(40) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_handovers_ref` (`reference_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `approval_matrix_rules` (
  `id` VARCHAR(64) NOT NULL,
  `bidang` VARCHAR(120) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `risk_level` VARCHAR(32) NOT NULL,
  `uses_dpbi_identity` TINYINT(1) NOT NULL DEFAULT 0,
  `external_permit_needed` TINYINT(1) NOT NULL DEFAULT 0,
  `approver_role` VARCHAR(48) NOT NULL,
  `notes` TEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proposals` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `title` VARCHAR(255) NOT NULL,
  `applicant_personnel_id` VARCHAR(64) NOT NULL,
  `applicant_name` VARCHAR(191) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `batch_id` VARCHAR(64) NOT NULL,
  `bidang` VARCHAR(120) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `risk_level` VARCHAR(32) NOT NULL DEFAULT 'rendah',
  `uses_dpbi_identity` TINYINT(1) NOT NULL DEFAULT 1,
  `external_permit_needed` TINYINT(1) NOT NULL DEFAULT 0,
  `assigned_approver_role` VARCHAR(48) NOT NULL,
  `objective` TEXT NOT NULL,
  `target_audience` VARCHAR(191) NOT NULL,
  `event_date` VARCHAR(32) NOT NULL,
  `event_time` VARCHAR(32) NOT NULL,
  `location` VARCHAR(255) NOT NULL,
  `pic_name` VARCHAR(191) NOT NULL,
  `estimated_participants` INT NOT NULL DEFAULT 30,
  `activity_mode` VARCHAR(24) NOT NULL DEFAULT 'luring',
  `pdf_file_id` VARCHAR(64) NULL,
  `pdf_file_name` VARCHAR(191) NULL,
  `status` VARCHAR(48) NOT NULL DEFAULT 'diajukan',
  `decision_note` TEXT NULL,
  `decided_by` VARCHAR(191) NULL,
  `decided_at` VARCHAR(40) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_proposals_ref` (`reference_number`),
  KEY `idx_proposals_province` (`province_code`),
  KEY `idx_proposals_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `proposal_versions` (
  `id` VARCHAR(64) NOT NULL,
  `proposal_id` VARCHAR(64) NOT NULL,
  `version` INT NOT NULL,
  `pdf_file_id` VARCHAR(64) NULL,
  `pdf_file_name` VARCHAR(191) NULL,
  `change_note` TEXT NOT NULL,
  `uploaded_by` VARCHAR(191) NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_proposal_versions_prop` (`proposal_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `lkl_reports` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `version` INT NOT NULL DEFAULT 1,
  `activity_name` VARCHAR(255) NOT NULL,
  `proposal_id` VARCHAR(64) NULL,
  `proposal_ref` VARCHAR(64) NULL,
  `submitter_personnel_id` VARCHAR(64) NOT NULL,
  `submitter_name` VARCHAR(191) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `regency` VARCHAR(120) NOT NULL DEFAULT '',
  `district` VARCHAR(120) NOT NULL DEFAULT '',
  `village` VARCHAR(120) NOT NULL DEFAULT '',
  `venue_name` VARCHAR(191) NOT NULL DEFAULT '',
  `venue_address` TEXT NOT NULL,
  `event_date` VARCHAR(32) NOT NULL,
  `start_time` VARCHAR(16) NOT NULL,
  `end_time` VARCHAR(16) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `activity_mode` VARCHAR(24) NOT NULL DEFAULT 'luring',
  `platform_name` VARCHAR(120) NULL,
  `platform_link` VARCHAR(255) NULL,
  `pic_name` VARCHAR(191) NOT NULL,
  `participant_count` INT NOT NULL DEFAULT 0,
  `summary` TEXT NOT NULL,
  `outcomes` TEXT NOT NULL,
  `obstacles` TEXT NOT NULL,
  `follow_up` TEXT NOT NULL,
  `pdf_file_id` VARCHAR(64) NULL,
  `pdf_file_name` VARCHAR(191) NULL,
  `photo_file_ids_json` LONGTEXT NOT NULL,
  `status` VARCHAR(48) NOT NULL DEFAULT 'menunggu_pemeriksaan',
  `review_note` TEXT NULL,
  `reviewed_by` VARCHAR(191) NULL,
  `reviewed_at` VARCHAR(40) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_lkl_ref` (`reference_number`),
  KEY `idx_lkl_province` (`province_code`),
  KEY `idx_lkl_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `coordinator_reports` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `report_type` VARCHAR(32) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `batch_id` VARCHAR(64) NOT NULL,
  `coordinator_id` VARCHAR(64) NOT NULL,
  `coordinator_name` VARCHAR(191) NOT NULL,
  `period_label` VARCHAR(120) NOT NULL,
  `personnel_condition` TEXT NOT NULL,
  `activities_summary` TEXT NOT NULL,
  `lkl_recap_count` INT NOT NULL DEFAULT 0,
  `obstacles` TEXT NOT NULL,
  `coaching_needs` TEXT NOT NULL,
  `follow_up_plan` TEXT NOT NULL,
  `pdf_file_id` VARCHAR(64) NULL,
  `pdf_file_name` VARCHAR(191) NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'dikirim',
  `review_note` TEXT NULL,
  `reviewed_by` VARCHAR(191) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coord_reports_ref` (`reference_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `priority` VARCHAR(24) NOT NULL DEFAULT 'sedang',
  `status` VARCHAR(32) NOT NULL DEFAULT 'belum_dimulai',
  `deadline` VARCHAR(40) NOT NULL,
  `province_code` VARCHAR(16) NULL,
  `batch_id` VARCHAR(64) NULL,
  `assignee_id` VARCHAR(64) NOT NULL,
  `assignee_name` VARCHAR(191) NOT NULL,
  `creator_id` VARCHAR(64) NOT NULL,
  `creator_name` VARCHAR(191) NOT NULL,
  `checklist_json` LONGTEXT NOT NULL,
  `is_template` TINYINT(1) NOT NULL DEFAULT 0,
  `recurrence` VARCHAR(32) NOT NULL DEFAULT 'tidak',
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tasks_ref` (`reference_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `task_comments` (
  `id` VARCHAR(64) NOT NULL,
  `task_id` VARCHAR(64) NOT NULL,
  `author_id` VARCHAR(64) NOT NULL,
  `author_name` VARCHAR(191) NOT NULL,
  `body` TEXT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_task_comments_task` (`task_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `documents` (
  `id` VARCHAR(64) NOT NULL,
  `document_number` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `owner_name` VARCHAR(191) NOT NULL,
  `issuer_name` VARCHAR(191) NOT NULL,
  `issued_date` VARCHAR(32) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'berlaku',
  `version` VARCHAR(24) NOT NULL DEFAULT '1.0',
  `access_level` VARCHAR(48) NOT NULL DEFAULT 'internal_semua',
  `file_id` VARCHAR(64) NULL,
  `file_name` VARCHAR(191) NULL,
  `file_size_bytes` BIGINT NOT NULL DEFAULT 0,
  `notes` TEXT NOT NULL,
  `expires_at` VARCHAR(32) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_documents_number` (`document_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `announcements` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `body` TEXT NOT NULL,
  `scope` VARCHAR(32) NOT NULL DEFAULT 'nasional',
  `province_code` VARCHAR(16) NULL,
  `batch_id` VARCHAR(64) NULL,
  `priority` VARCHAR(24) NOT NULL DEFAULT 'normal',
  `author_name` VARCHAR(191) NOT NULL,
  `published_at` VARCHAR(40) NOT NULL,
  `status` VARCHAR(24) NOT NULL DEFAULT 'terbit',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `calendar_events` (
  `id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(255) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `start_at` VARCHAR(40) NOT NULL,
  `end_at` VARCHAR(40) NOT NULL,
  `province_code` VARCHAR(16) NULL,
  `batch_id` VARCHAR(64) NULL,
  `related_ref` VARCHAR(64) NULL,
  `location` VARCHAR(191) NOT NULL DEFAULT 'Nasional / Daring',
  `description` TEXT NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `message` TEXT NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `target_path` VARCHAR(120) NOT NULL DEFAULT '/dashboard',
  `is_read` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_notifications_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `saved_views` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `module` VARCHAR(64) NOT NULL,
  `name` VARCHAR(120) NOT NULL,
  `filter_json` LONGTEXT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `risk_assessments` (
  `id` VARCHAR(64) NOT NULL,
  `proposal_id` VARCHAR(64) NULL,
  `activity_title` VARCHAR(255) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `participant_under_18` TINYINT(1) NOT NULL DEFAULT 1,
  `adult_chaperone_count` INT NOT NULL DEFAULT 2,
  `environment_notes` TEXT NOT NULL,
  `transport_plan` TEXT NOT NULL,
  `emergency_plan` TEXT NOT NULL,
  `emergency_contact` VARCHAR(191) NOT NULL,
  `risk_level` VARCHAR(32) NOT NULL DEFAULT 'sedang',
  `status` VARCHAR(32) NOT NULL DEFAULT 'disetujui',
  `submitted_by` VARCHAR(191) NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `consent_records` (
  `id` VARCHAR(64) NOT NULL,
  `personnel_id` VARCHAR(64) NOT NULL,
  `personnel_name` VARCHAR(191) NOT NULL,
  `activity_title` VARCHAR(255) NOT NULL,
  `consent_participation` TINYINT(1) NOT NULL DEFAULT 1,
  `consent_guardian` TINYINT(1) NOT NULL DEFAULT 1,
  `consent_documentation` TINYINT(1) NOT NULL DEFAULT 1,
  `consent_publication` TINYINT(1) NOT NULL DEFAULT 0,
  `recorded_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `incidents` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `occurred_at` VARCHAR(40) NOT NULL,
  `location` VARCHAR(191) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `category` VARCHAR(120) NOT NULL,
  `urgency` VARCHAR(32) NOT NULL,
  `chronology` TEXT NOT NULL,
  `initial_action` TEXT NOT NULL,
  `escalated_to` VARCHAR(191) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'ditangani',
  `reported_by_user_id` VARCHAR(64) NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_incidents_ref` (`reference_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `whistleblowing_reports` (
  `id` VARCHAR(64) NOT NULL,
  `reference_number` VARCHAR(64) NOT NULL,
  `reporter_mode` VARCHAR(32) NOT NULL DEFAULT 'rahasia',
  `category` VARCHAR(120) NOT NULL,
  `chronology` TEXT NOT NULL,
  `assigned_handler_role` VARCHAR(48) NOT NULL DEFAULT 'penanggung_jawab',
  `conflict_rerouted` TINYINT(1) NOT NULL DEFAULT 0,
  `status` VARCHAR(32) NOT NULL DEFAULT 'baru',
  `follow_up_note` TEXT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_whistleblowing_ref` (`reference_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `evaluations` (
  `id` VARCHAR(64) NOT NULL,
  `personnel_id` VARCHAR(64) NOT NULL,
  `personnel_name` VARCHAR(191) NOT NULL,
  `role_code` VARCHAR(48) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `batch_id` VARCHAR(64) NOT NULL,
  `task_completion_score` INT NOT NULL,
  `report_timeliness_score` INT NOT NULL,
  `report_quality_score` INT NOT NULL,
  `coordination_score` INT NOT NULL,
  `total_score` DOUBLE NOT NULL,
  `evaluator_name` VARCHAR(191) NOT NULL,
  `coaching_recommendation` TEXT NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'final',
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `location_verifications` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `action_type` VARCHAR(64) NOT NULL,
  `latitude` DOUBLE NULL,
  `longitude` DOUBLE NULL,
  `matched` TINYINT(1) NOT NULL,
  `verification_mode` VARCHAR(32) NOT NULL,
  `reason` TEXT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `location_exceptions` (
  `id` VARCHAR(64) NOT NULL,
  `user_id` VARCHAR(64) NOT NULL,
  `user_name` VARCHAR(191) NOT NULL,
  `province_code` VARCHAR(16) NOT NULL,
  `reason` TEXT NOT NULL,
  `evidence_note` TEXT NOT NULL,
  `valid_until` VARCHAR(40) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'menunggu',
  `decided_by` VARCHAR(191) NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `stored_files` (
  `id` VARCHAR(64) NOT NULL,
  `original_name` VARCHAR(255) NOT NULL,
  `stored_name` VARCHAR(255) NOT NULL,
  `mime_type` VARCHAR(120) NOT NULL,
  `size_bytes` BIGINT NOT NULL,
  `checksum_sha256` VARCHAR(64) NOT NULL,
  `module` VARCHAR(64) NOT NULL,
  `uploaded_by` VARCHAR(191) NOT NULL,
  `is_archived` TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `backups` (
  `id` VARCHAR(64) NOT NULL,
  `backup_name` VARCHAR(191) NOT NULL,
  `backup_type` VARCHAR(32) NOT NULL DEFAULT 'manual',
  `size_bytes` BIGINT NOT NULL,
  `checksum_sha256` VARCHAR(64) NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'berhasil',
  `notes` TEXT NOT NULL,
  `created_by` VARCHAR(191) NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `automation_jobs` (
  `id` VARCHAR(64) NOT NULL,
  `job_key` VARCHAR(64) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `schedule_label` VARCHAR(120) NOT NULL,
  `enabled` TINYINT(1) NOT NULL DEFAULT 1,
  `last_run_at` VARCHAR(40) NULL,
  `last_status` VARCHAR(32) NOT NULL DEFAULT 'siap',
  `last_message` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_automation_jobs_key` (`job_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` VARCHAR(64) NOT NULL,
  `actor_user_id` VARCHAR(64) NOT NULL,
  `actor_name` VARCHAR(191) NOT NULL,
  `actor_role` VARCHAR(48) NOT NULL,
  `action` VARCHAR(120) NOT NULL,
  `target_type` VARCHAR(64) NOT NULL,
  `target_id` VARCHAR(120) NOT NULL,
  `outcome` VARCHAR(32) NOT NULL DEFAULT 'berhasil',
  `context_note` TEXT NOT NULL,
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_created` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `activity_timeline` (
  `id` VARCHAR(64) NOT NULL,
  `category` VARCHAR(64) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `description` TEXT NOT NULL,
  `province_code` VARCHAR(16) NULL,
  `batch_id` VARCHAR(64) NULL,
  `actor_name` VARCHAR(191) NOT NULL,
  `related_path` VARCHAR(120) NOT NULL DEFAULT '/dashboard',
  `created_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `system_settings` (
  `key` VARCHAR(120) NOT NULL,
  `value` LONGTEXT NOT NULL,
  `updated_at` VARCHAR(40) NOT NULL,
  PRIMARY KEY (`key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
