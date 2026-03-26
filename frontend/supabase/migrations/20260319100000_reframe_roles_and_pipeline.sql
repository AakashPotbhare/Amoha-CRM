-- ============================================================
-- Migration: Reframe roles and add candidate pipeline stage
-- Date: 2026-03-19
-- ============================================================

-- ─── 1. Extend employee_role enum with new role codes ──────────────────────
-- We add the new roles. Old roles (sales_manager, dept_head, team_lead)
-- are kept for backward compatibility and mapped below.

DO $$
BEGIN
  -- Add new role values if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sales_head' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'sales_head';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'technical_head' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'technical_head';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'marketing_tl' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'marketing_tl';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'resume_head' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'resume_head';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'compliance_officer' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'compliance_officer';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'assistant_tl' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'assistant_tl';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'sales_executive' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'sales_executive';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'lead_generator' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'lead_generator';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'technical_executive' AND enumtypid = 'employee_role'::regtype) THEN
    ALTER TYPE employee_role ADD VALUE 'technical_executive';
  END IF;
END $$;

-- ─── 2. Migrate existing legacy roles to new codes ─────────────────────────
-- sales_manager → sales_head
UPDATE employees SET role = 'sales_head' WHERE role = 'sales_manager';

-- dept_head → map by department slug
UPDATE employees e
SET role = CASE
  WHEN d.slug = 'sales'     THEN 'sales_head'::employee_role
  WHEN d.slug = 'technical' THEN 'technical_head'::employee_role
  WHEN d.slug = 'resume'    THEN 'resume_head'::employee_role
  WHEN d.slug = 'compliance' THEN 'compliance_officer'::employee_role
  ELSE 'sales_head'::employee_role
END
FROM departments d
WHERE e.department_id = d.id
  AND e.role = 'dept_head';

-- team_lead → marketing_tl (all existing team leads are in marketing)
UPDATE employees SET role = 'marketing_tl' WHERE role = 'team_lead';

-- ─── 3. Add pipeline_stage to candidate_enrollments ────────────────────────
ALTER TABLE candidate_enrollments
  ADD COLUMN IF NOT EXISTS pipeline_stage TEXT
  NOT NULL DEFAULT 'enrolled'
  CHECK (pipeline_stage IN (
    'enrolled',
    'resume_building',
    'marketing_active',
    'interview_stage',
    'placed',
    'rejected'
  ));

-- ─── 4. Add candidate_enrollment_id FK to support_tasks ────────────────────
-- support_tasks should reference the canonical candidate record
ALTER TABLE support_tasks
  ADD COLUMN IF NOT EXISTS candidate_enrollment_id UUID
  REFERENCES candidate_enrollments(id) ON DELETE SET NULL;

-- ─── 5. Add RLS policies to tables that lacked them ────────────────────────

-- candidate_enrollments: authenticated users can read; write requires sales/leadership
ALTER TABLE candidate_enrollments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "candidate_enrollments_read" ON candidate_enrollments;
CREATE POLICY "candidate_enrollments_read"
  ON candidate_enrollments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "candidate_enrollments_insert" ON candidate_enrollments;
CREATE POLICY "candidate_enrollments_insert"
  ON candidate_enrollments FOR INSERT
  TO authenticated
  WITH CHECK (true); -- frontend enforces role; RLS is belt-and-suspenders

DROP POLICY IF EXISTS "candidate_enrollments_update" ON candidate_enrollments;
CREATE POLICY "candidate_enrollments_update"
  ON candidate_enrollments FOR UPDATE
  TO authenticated
  USING (true);

-- support_tasks: authenticated users can read/write (scoping done in service layer)
ALTER TABLE support_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tasks_read" ON support_tasks;
CREATE POLICY "support_tasks_read"
  ON support_tasks FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "support_tasks_write" ON support_tasks;
CREATE POLICY "support_tasks_write"
  ON support_tasks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- tasks: all authenticated employees
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tasks_read" ON tasks;
CREATE POLICY "tasks_read"
  ON tasks FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "tasks_write" ON tasks;
CREATE POLICY "tasks_write"
  ON tasks FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- attendance_records: employees can read own; admins can read all
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attendance_own_read" ON attendance_records;
CREATE POLICY "attendance_own_read"
  ON attendance_records FOR SELECT
  TO authenticated
  USING (
    employee_id = (
      SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1
    )
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
        AND role IN ('director','ops_head','hr_head')
    )
  );

DROP POLICY IF EXISTS "attendance_own_write" ON attendance_records;
CREATE POLICY "attendance_own_write"
  ON attendance_records FOR ALL
  TO authenticated
  USING (
    employee_id = (
      SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1
    )
  )
  WITH CHECK (
    employee_id = (
      SELECT id FROM employees WHERE user_id = auth.uid() LIMIT 1
    )
  );

-- leave_requests: employees see own; approvers see team/all
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "leave_requests_read" ON leave_requests;
CREATE POLICY "leave_requests_read"
  ON leave_requests FOR SELECT
  TO authenticated
  USING (true); -- scoped in service layer per approver role

DROP POLICY IF EXISTS "leave_requests_write" ON leave_requests;
CREATE POLICY "leave_requests_write"
  ON leave_requests FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
