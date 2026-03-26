-- ============================================================
-- RecruitHUB — MySQL Schema
-- Run this once to set up the entire database
-- ============================================================

CREATE DATABASE IF NOT EXISTS recruithub CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE recruithub;

-- ─── Departments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS departments (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  slug        VARCHAR(50)  NOT NULL UNIQUE,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO departments (id, name, slug) VALUES
  (UUID(), 'Sales',      'sales'),
  (UUID(), 'Resume',     'resume'),
  (UUID(), 'Marketing',  'marketing'),
  (UUID(), 'Technical',  'technical'),
  (UUID(), 'Compliance', 'compliance');

-- ─── Teams ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS teams (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name          VARCHAR(100) NOT NULL,
  department_id CHAR(36)     NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE
);

-- ─── Employees ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id                CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  employee_code     VARCHAR(20)   NOT NULL UNIQUE,
  full_name         VARCHAR(200)  NOT NULL,
  email             VARCHAR(255)  NOT NULL UNIQUE,
  password_hash     VARCHAR(255)  NOT NULL,
  phone             VARCHAR(20)   NULL,
  dob               DATE          NULL,
  designation       VARCHAR(100)  NULL,
  department_id     CHAR(36)      NOT NULL,
  team_id           CHAR(36)      NOT NULL,
  role              ENUM(
    'director','ops_head','hr_head',
    'sales_head','technical_head','marketing_tl','resume_head','compliance_officer',
    'assistant_tl','sales_executive','lead_generator',
    'technical_executive','senior_recruiter','recruiter','resume_builder'
  ) NOT NULL DEFAULT 'recruiter',
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  joining_date      DATE          NULL,
  avatar_url        VARCHAR(500)  NULL,
  base_salary       DECIMAL(12,2) NULL,
  pf_percentage     DECIMAL(5,2)  NULL DEFAULT 12.00,
  professional_tax  DECIMAL(10,2) NULL DEFAULT 200.00,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (team_id)       REFERENCES teams(id)
);

-- ─── Candidate Enrollments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS candidate_enrollments (
  id                        CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  pipeline_stage            ENUM('enrolled','resume_building','marketing_active','interview_stage','placed','rejected')
                            NOT NULL DEFAULT 'enrolled',
  enrolled_by_employee_id   CHAR(36)      NULL,

  -- Personal
  full_name                 VARCHAR(200)  NOT NULL,
  email                     VARCHAR(255)  NULL,
  phone                     VARCHAR(30)   NOT NULL,
  gender                    VARCHAR(20)   NULL,
  dob                       DATE          NULL,

  -- Visa
  visa_status               VARCHAR(50)   NULL,
  visa_expire_date          DATE          NULL,

  -- Location
  current_location_zip      VARCHAR(500)  NULL,
  nearest_metro_area        VARCHAR(200)  NULL,
  open_for_relocation       VARCHAR(10)   NULL,
  native_country            VARCHAR(100)  NULL,

  -- Professional
  current_domain            VARCHAR(200)  NULL,
  years_experience          VARCHAR(50)   NULL,
  veteran_status            VARCHAR(50)   NULL,
  security_clearance        VARCHAR(50)   NULL,
  race_ethnicity            VARCHAR(100)  NULL,
  total_certifications      VARCHAR(200)  NULL,

  -- Education
  highest_qualification     VARCHAR(50)   NULL,
  bachelors_field           VARCHAR(200)  NULL,
  bachelors_university      VARCHAR(200)  NULL,
  bachelors_start_date      DATE          NULL,
  bachelors_end_date        DATE          NULL,
  masters_field             VARCHAR(200)  NULL,
  masters_university        VARCHAR(200)  NULL,
  masters_start_date        DATE          NULL,
  masters_end_date          DATE          NULL,

  -- LinkedIn & Marketing
  linkedin_email            VARCHAR(255)  NULL,
  linkedin_passcode         VARCHAR(200)  NULL,
  ssn_last4                 VARCHAR(4)    NULL,
  marketing_email           VARCHAR(255)  NULL,
  marketing_email_password  VARCHAR(200)  NULL,

  -- Availability
  availability_for_calls    VARCHAR(200)  NULL,
  availability_to_start     VARCHAR(200)  NULL,
  arrived_in_usa            DATE          NULL,
  salary_expectations       VARCHAR(500)  NULL,

  -- Notes
  notes                     TEXT          NULL,

  created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (enrolled_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);

-- ─── Support Tasks ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS support_tasks (
  id                        CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  task_type                 ENUM('interview_support','assessment_support','ruc','mock_call',
                            'preparation_call','resume_building','resume_rebuilding') NOT NULL,
  status                    ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  priority                  ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  call_status               ENUM('not_started','link_sent','completed') NOT NULL DEFAULT 'not_started',

  candidate_enrollment_id   CHAR(36)     NULL,
  candidate_name            VARCHAR(200) NULL,
  company_name              VARCHAR(200) NULL,
  interview_round           VARCHAR(100) NULL,
  teams_link                VARCHAR(500) NULL,
  feedback                  TEXT         NULL,
  questions_asked           TEXT         NULL,
  scheduled_at              DATETIME     NULL,
  due_date                  DATE         NULL,

  assigned_to_employee_id   CHAR(36)     NULL,
  department_id             CHAR(36)     NULL,
  team_id                   CHAR(36)     NULL,
  created_by_employee_id    CHAR(36)     NOT NULL,

  created_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  FOREIGN KEY (candidate_enrollment_id) REFERENCES candidate_enrollments(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (department_id)           REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (team_id)                 REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_employee_id)  REFERENCES employees(id)
);

-- ─── General Tasks ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tasks (
  id                          CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  title                       VARCHAR(300) NOT NULL,
  description                 TEXT         NULL,
  priority                    ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  status                      ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  due_date                    DATE         NULL,
  assigned_to_employee_id     CHAR(36)     NULL,
  assigned_to_team_id         CHAR(36)     NULL,
  assigned_to_department_id   CHAR(36)     NULL,
  created_by_employee_id      CHAR(36)     NOT NULL,
  created_at                  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (assigned_to_employee_id)   REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_team_id)       REFERENCES teams(id) ON DELETE SET NULL,
  FOREIGN KEY (assigned_to_department_id) REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_employee_id)    REFERENCES employees(id)
);

-- ─── Task Comments ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS task_comments (
  id               CHAR(36)  NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  task_id          CHAR(36)  NULL,
  support_task_id  CHAR(36)  NULL,
  employee_id      CHAR(36)  NOT NULL,
  content          TEXT      NOT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id)         REFERENCES tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (support_task_id) REFERENCES support_tasks(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id)     REFERENCES employees(id)
);

-- ─── Shift Settings ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS shift_settings (
  id                    CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name                  VARCHAR(100) NOT NULL,
  start_time            TIME         NOT NULL,
  end_time              TIME         NOT NULL,
  grace_period_minutes  INT          NOT NULL DEFAULT 15,
  required_hours        DECIMAL(4,2) NOT NULL DEFAULT 8.00,
  max_late_per_month    INT          NOT NULL DEFAULT 3,
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO shift_settings (name, start_time, end_time, grace_period_minutes, required_hours, max_late_per_month)
VALUES ('Standard Shift', '09:00:00', '18:00:00', 15, 8.00, 3);

-- ─── Office Locations ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS office_locations (
  id             CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  name           VARCHAR(100)  NOT NULL,
  address        VARCHAR(500)  NULL,
  latitude       DECIMAL(10,8) NOT NULL,
  longitude      DECIMAL(11,8) NOT NULL,
  radius_meters  INT           NOT NULL DEFAULT 200,
  is_active      BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ─── Attendance Records ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_records (
  id                      CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  employee_id             CHAR(36)      NOT NULL,
  date                    DATE          NOT NULL,
  check_in_time           DATETIME      NOT NULL,
  check_out_time          DATETIME      NULL,
  check_in_lat            DECIMAL(10,8) NULL,
  check_in_lng            DECIMAL(11,8) NULL,
  check_out_lat           DECIMAL(10,8) NULL,
  check_out_lng           DECIMAL(11,8) NULL,
  check_in_location_id    CHAR(36)      NULL,
  check_out_location_id   CHAR(36)      NULL,
  is_wfh                  BOOLEAN       NOT NULL DEFAULT FALSE,
  is_late                 BOOLEAN       NOT NULL DEFAULT FALSE,
  attendance_status       ENUM('present','late','wfh','half_day','absent','holiday') NOT NULL DEFAULT 'present',
  total_hours             DECIMAL(5,2)  NULL,
  shift_setting_id        CHAR(36)      NULL,
  created_at              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_employee_date (employee_id, date),
  FOREIGN KEY (employee_id)           REFERENCES employees(id),
  FOREIGN KEY (check_in_location_id)  REFERENCES office_locations(id) ON DELETE SET NULL,
  FOREIGN KEY (check_out_location_id) REFERENCES office_locations(id) ON DELETE SET NULL,
  FOREIGN KEY (shift_setting_id)      REFERENCES shift_settings(id) ON DELETE SET NULL
);

-- ─── Attendance Breaks ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS attendance_breaks (
  id                    CHAR(36)    NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  attendance_record_id  CHAR(36)    NOT NULL,
  break_number          INT         NOT NULL,
  break_type            ENUM('short_break','lunch') NOT NULL,
  break_start           DATETIME    NOT NULL,
  break_end             DATETIME    NULL,
  duration_minutes      INT         NULL,
  FOREIGN KEY (attendance_record_id) REFERENCES attendance_records(id) ON DELETE CASCADE
);

-- ─── Leave Requests ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leave_requests (
  id                    CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  employee_id           CHAR(36)     NOT NULL,
  department_id         CHAR(36)     NULL,
  leave_type            ENUM('paid','unpaid','sick','casual') NOT NULL,
  from_date             DATE         NOT NULL,
  to_date               DATE         NOT NULL,
  total_days            INT          NOT NULL DEFAULT 1,
  reason                TEXT         NULL,
  status                ENUM('pending','tl_approved','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  approved_by_tl        CHAR(36)     NULL,
  tl_approved_at        DATETIME     NULL,
  approved_by_manager   CHAR(36)     NULL,
  manager_approved_at   DATETIME     NULL,
  rejection_reason      TEXT         NULL,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id)         REFERENCES employees(id),
  FOREIGN KEY (department_id)       REFERENCES departments(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_tl)      REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (approved_by_manager) REFERENCES employees(id) ON DELETE SET NULL
);

-- ─── Leave Balance ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leave_balance (
  id                    CHAR(36) NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  employee_id           CHAR(36) NOT NULL,
  year                  INT      NOT NULL,
  paid_leave_credited   INT      NOT NULL DEFAULT 0,
  paid_leave_used       INT      NOT NULL DEFAULT 0,
  unpaid_leave_used     INT      NOT NULL DEFAULT 0,
  UNIQUE KEY uq_emp_year (employee_id, year),
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ─── Salary History ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS salary_history (
  id                        CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  employee_id               CHAR(36)      NOT NULL,
  previous_salary           DECIMAL(12,2) NOT NULL,
  new_salary                DECIMAL(12,2) NOT NULL,
  effective_date            DATE          NOT NULL,
  reason                    TEXT          NULL,
  changed_by_employee_id    CHAR(36)      NULL,
  created_at                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id)             REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by_employee_id)  REFERENCES employees(id) ON DELETE SET NULL
);

-- ─── Employee Documents ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employee_documents (
  id            CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  employee_id   CHAR(36)     NOT NULL,
  document_type VARCHAR(50)  NOT NULL,
  file_name     VARCHAR(300) NOT NULL,
  file_url      VARCHAR(500) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
);

-- ─── Notifications ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
  id                    CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  recipient_employee_id CHAR(36)     NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  body                  TEXT         NULL,
  type                  ENUM('info','success','warning','error') NOT NULL DEFAULT 'info',
  entity_type           VARCHAR(50)  NULL,
  entity_id             CHAR(36)     NULL,
  is_read               BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (recipient_employee_id) REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_notif_recipient (recipient_employee_id, is_read, created_at)
);

-- ─── Placement Offers ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS placement_offers (
  id                                CHAR(36)      NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  candidate_enrollment_id           CHAR(36)      NULL,
  candidate_name                    VARCHAR(200)  NOT NULL,
  technology                        VARCHAR(100)  NOT NULL,
  offer_position                    VARCHAR(200)  NOT NULL,
  employer_name                     VARCHAR(200)  NOT NULL,
  job_location                      VARCHAR(300)  NULL,
  employment_type                   ENUM('full_time','contract','part_time','c2c') NOT NULL DEFAULT 'full_time',
  offer_date                        DATE          NOT NULL,
  joining_date                      DATE          NULL,
  annual_package                    DECIMAL(12,2) NOT NULL,
  upfront_paid                      DECIMAL(12,2) NOT NULL DEFAULT 0,
  commission_rate                   DECIMAL(5,2)  NULL,
  commission_amount                 DECIMAL(12,2) NOT NULL,
  final_amount_due                  DECIMAL(12,2) NOT NULL,
  installment_1_amount              DECIMAL(12,2) NULL,
  installment_1_condition           VARCHAR(300)  NULL,
  installment_1_paid_at             DATE          NULL,
  installment_2_amount              DECIMAL(12,2) NULL,
  installment_2_condition           VARCHAR(300)  NULL,
  installment_2_paid_at             DATE          NULL,
  installment_3_amount              DECIMAL(12,2) NULL,
  installment_3_condition           VARCHAR(300)  NULL,
  installment_3_paid_at             DATE          NULL,
  poc_recruiter_employee_id         CHAR(36)      NULL,
  application_recruiter_employee_id CHAR(36)      NULL,
  technical_support_employee_id     CHAR(36)      NULL,
  created_by_employee_id            CHAR(36)      NOT NULL,
  team_id                           CHAR(36)      NULL,
  status                            ENUM('draft','submitted','processing','completed','cancelled') NOT NULL DEFAULT 'submitted',
  payment_link_sent                 BOOLEAN       NOT NULL DEFAULT FALSE,
  notes                             TEXT          NULL,
  created_at                        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidate_enrollment_id)           REFERENCES candidate_enrollments(id) ON DELETE SET NULL,
  FOREIGN KEY (poc_recruiter_employee_id)         REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (application_recruiter_employee_id) REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (technical_support_employee_id)     REFERENCES employees(id) ON DELETE SET NULL,
  FOREIGN KEY (created_by_employee_id)            REFERENCES employees(id),
  FOREIGN KEY (team_id)                           REFERENCES teams(id) ON DELETE SET NULL
);

-- ─── Audit Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id          CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  employee_id CHAR(36)     NOT NULL,
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   CHAR(36)     NULL,
  old_value   JSON         NULL,
  new_value   JSON         NULL,
  ip_address  VARCHAR(45)  NULL,
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id),
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_employee (employee_id, created_at)
);

-- ─── Chat ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_conversations (
  id                CHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  participant_one   CHAR(36)   NOT NULL,
  participant_two   CHAR(36)   NOT NULL,
  last_message_at   TIMESTAMP  NULL,
  created_at        TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_convo (participant_one, participant_two),
  FOREIGN KEY (participant_one) REFERENCES employees(id) ON DELETE CASCADE,
  FOREIGN KEY (participant_two) REFERENCES employees(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id                CHAR(36)   NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  conversation_id   CHAR(36)   NOT NULL,
  sender_id         CHAR(36)   NOT NULL,
  content           TEXT       NULL,
  file_url          VARCHAR(500) NULL,
  file_name         VARCHAR(255) NULL,
  is_read           BOOLEAN    NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id)       REFERENCES employees(id) ON DELETE CASCADE,
  INDEX idx_chat_convo (conversation_id, created_at)
);

-- ─── HR Notices ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS hr_notices (
  id                        CHAR(36)     NOT NULL DEFAULT (UUID()) PRIMARY KEY,
  title                     VARCHAR(300) NOT NULL,
  content                   TEXT         NOT NULL,
  created_by_employee_id    CHAR(36)     NULL,
  is_active                 BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by_employee_id) REFERENCES employees(id) ON DELETE SET NULL
);
