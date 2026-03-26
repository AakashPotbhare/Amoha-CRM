DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'support_task_type'
  ) THEN
    CREATE TYPE public.support_task_type AS ENUM (
      'interview_support',
      'assessment_support',
      'ruc',
      'mock_call',
      'preparation_call',
      'resume_building',
      'resume_rebuilding'
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'interview_round'
  ) THEN
    CREATE TYPE public.interview_round AS ENUM (
      'screening',
      'phone_call',
      '1st_round',
      '2nd_round',
      '3rd_round',
      'final_round'
    );
  END IF;
END $$;

ALTER TABLE public.candidates
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS technology TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_employee_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_to_team_id UUID,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

UPDATE public.candidates
SET
  created_by = COALESCE(created_by, created_by_employee_id),
  technology = COALESCE(technology, source)
WHERE
  created_by IS NULL
  OR technology IS NULL;

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

UPDATE public.tasks
SET created_by = COALESCE(created_by, created_by_employee_id)
WHERE created_by IS NULL;

ALTER TABLE public.support_tasks
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS candidate_id UUID,
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS interview_round public.interview_round,
  ADD COLUMN IF NOT EXISTS scheduled_date DATE,
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time TIME,
  ADD COLUMN IF NOT EXISTS deadline_date DATE,
  ADD COLUMN IF NOT EXISTS job_description TEXT,
  ADD COLUMN IF NOT EXISTS assigned_to_department_id UUID,
  ADD COLUMN IF NOT EXISTS assigned_to_team_id UUID,
  ADD COLUMN IF NOT EXISTS support_person_id UUID,
  ADD COLUMN IF NOT EXISTS preferred_handler_id UUID,
  ADD COLUMN IF NOT EXISTS willing_for_support BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS call_status TEXT,
  ADD COLUMN IF NOT EXISTS feedback TEXT,
  ADD COLUMN IF NOT EXISTS questions_asked TEXT,
  ADD COLUMN IF NOT EXISTS link_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS teams_link TEXT,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'support_tasks'
      AND column_name = 'task_type'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD COLUMN task_type public.support_task_type;
  END IF;
END $$;

UPDATE public.support_tasks
SET
  created_by = COALESCE(created_by, created_by_employee_id),
  assigned_to_department_id = COALESCE(assigned_to_department_id, department_id),
  assigned_to_team_id = COALESCE(assigned_to_team_id, team_id)
WHERE
  created_by IS NULL
  OR assigned_to_department_id IS NULL
  OR assigned_to_team_id IS NULL;

UPDATE public.support_tasks
SET task_type = CASE
  WHEN task_type IS NOT NULL THEN task_type
  WHEN category IN ('interview_support', 'assessment_support', 'ruc', 'mock_call', 'preparation_call', 'resume_building', 'resume_rebuilding') THEN category::public.support_task_type
  ELSE 'interview_support'::public.support_task_type
END
WHERE task_type IS NULL;

ALTER TABLE public.candidate_enrollments
  ADD COLUMN IF NOT EXISTS candidate_id UUID,
  ADD COLUMN IF NOT EXISTS created_by UUID,
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS gender TEXT,
  ADD COLUMN IF NOT EXISTS dob DATE,
  ADD COLUMN IF NOT EXISTS visa_status TEXT,
  ADD COLUMN IF NOT EXISTS visa_expire_date DATE,
  ADD COLUMN IF NOT EXISTS current_location_zip TEXT,
  ADD COLUMN IF NOT EXISTS current_domain TEXT,
  ADD COLUMN IF NOT EXISTS years_experience TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_email TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_passcode TEXT,
  ADD COLUMN IF NOT EXISTS ssn_last4 TEXT,
  ADD COLUMN IF NOT EXISTS marketing_email TEXT,
  ADD COLUMN IF NOT EXISTS marketing_email_password TEXT,
  ADD COLUMN IF NOT EXISTS highest_qualification TEXT,
  ADD COLUMN IF NOT EXISTS masters_field TEXT,
  ADD COLUMN IF NOT EXISTS masters_university TEXT,
  ADD COLUMN IF NOT EXISTS masters_start_date DATE,
  ADD COLUMN IF NOT EXISTS masters_end_date DATE,
  ADD COLUMN IF NOT EXISTS bachelors_field TEXT,
  ADD COLUMN IF NOT EXISTS bachelors_university TEXT,
  ADD COLUMN IF NOT EXISTS bachelors_start_date DATE,
  ADD COLUMN IF NOT EXISTS bachelors_end_date DATE,
  ADD COLUMN IF NOT EXISTS arrived_in_usa DATE,
  ADD COLUMN IF NOT EXISTS veteran_status TEXT,
  ADD COLUMN IF NOT EXISTS security_clearance TEXT,
  ADD COLUMN IF NOT EXISTS race_ethnicity TEXT,
  ADD COLUMN IF NOT EXISTS nearest_metro_area TEXT,
  ADD COLUMN IF NOT EXISTS native_country TEXT,
  ADD COLUMN IF NOT EXISTS total_certifications TEXT,
  ADD COLUMN IF NOT EXISTS availability_for_calls TEXT,
  ADD COLUMN IF NOT EXISTS availability_to_start TEXT,
  ADD COLUMN IF NOT EXISTS open_for_relocation TEXT,
  ADD COLUMN IF NOT EXISTS salary_expectations TEXT;

ALTER TABLE public.leave_requests
  ADD COLUMN IF NOT EXISTS total_days NUMERIC(4,1),
  ADD COLUMN IF NOT EXISTS approved_by_tl UUID,
  ADD COLUMN IF NOT EXISTS approved_by_tl_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by_manager UUID,
  ADD COLUMN IF NOT EXISTS approved_by_manager_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by UUID,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

UPDATE public.leave_requests
SET
  total_days = COALESCE(total_days, ((end_date - start_date) + 1)),
  approved_by_manager = COALESCE(approved_by_manager, approved_by)
WHERE
  total_days IS NULL
  OR approved_by_manager IS NULL;

ALTER TABLE public.leave_balances
  ADD COLUMN IF NOT EXISTS month INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
  ADD COLUMN IF NOT EXISTS paid_leave_credited NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS paid_leave_used NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unpaid_leave_used NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.leave_balances
SET
  paid_leave_credited = CASE
    WHEN leave_type <> 'unpaid' THEN COALESCE(NULLIF(paid_leave_credited, 0), total_days, 0)
    ELSE paid_leave_credited
  END,
  paid_leave_used = CASE
    WHEN leave_type <> 'unpaid' THEN COALESCE(NULLIF(paid_leave_used, 0), used_days, 0)
    ELSE paid_leave_used
  END,
  unpaid_leave_used = CASE
    WHEN leave_type = 'unpaid' THEN COALESCE(NULLIF(unpaid_leave_used, 0), used_days, 0)
    ELSE unpaid_leave_used
  END
WHERE
  paid_leave_credited = 0
  OR paid_leave_used = 0
  OR unpaid_leave_used = 0;

CREATE OR REPLACE FUNCTION public.get_or_create_leave_balance(p_employee_id uuid)
RETURNS public.leave_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance public.leave_balances;
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  v_month integer := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
  SELECT *
  INTO v_balance
  FROM public.leave_balances
  WHERE employee_id = p_employee_id
    AND year = v_year
  ORDER BY created_at ASC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO public.leave_balances (
      employee_id,
      year,
      month,
      paid_leave_credited,
      paid_leave_used,
      unpaid_leave_used
    )
    VALUES (p_employee_id, v_year, v_month, v_month, 0, 0)
    RETURNING * INTO v_balance;
  ELSE
    UPDATE public.leave_balances
    SET
      month = GREATEST(COALESCE(month, 0), v_month),
      paid_leave_credited = GREATEST(COALESCE(paid_leave_credited, 0), v_month),
      updated_at = now()
    WHERE id = v_balance.id
    RETURNING * INTO v_balance;
  END IF;

  RETURN v_balance;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_created_by_fkey'
  ) THEN
    ALTER TABLE public.candidates
      ADD CONSTRAINT candidates_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_assigned_to_employee_id_fkey'
  ) THEN
    ALTER TABLE public.candidates
      ADD CONSTRAINT candidates_assigned_to_employee_id_fkey
      FOREIGN KEY (assigned_to_employee_id) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidates_assigned_to_team_id_fkey'
  ) THEN
    ALTER TABLE public.candidates
      ADD CONSTRAINT candidates_assigned_to_team_id_fkey
      FOREIGN KEY (assigned_to_team_id) REFERENCES public.teams(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_created_by_fkey'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tasks_created_by_fkey'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD CONSTRAINT support_tasks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tasks_candidate_id_fkey'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD CONSTRAINT support_tasks_candidate_id_fkey
      FOREIGN KEY (candidate_id) REFERENCES public.candidates(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tasks_assigned_to_department_id_fkey'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD CONSTRAINT support_tasks_assigned_to_department_id_fkey
      FOREIGN KEY (assigned_to_department_id) REFERENCES public.departments(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tasks_assigned_to_team_id_fkey'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD CONSTRAINT support_tasks_assigned_to_team_id_fkey
      FOREIGN KEY (assigned_to_team_id) REFERENCES public.teams(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tasks_assigned_to_employee_id_fkey'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD CONSTRAINT support_tasks_assigned_to_employee_id_fkey
      FOREIGN KEY (assigned_to_employee_id) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tasks_support_person_id_fkey'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD CONSTRAINT support_tasks_support_person_id_fkey
      FOREIGN KEY (support_person_id) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'support_tasks_preferred_handler_id_fkey'
  ) THEN
    ALTER TABLE public.support_tasks
      ADD CONSTRAINT support_tasks_preferred_handler_id_fkey
      FOREIGN KEY (preferred_handler_id) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_enrollments_created_by_fkey'
  ) THEN
    ALTER TABLE public.candidate_enrollments
      ADD CONSTRAINT candidate_enrollments_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'candidate_enrollments_candidate_id_fkey'
  ) THEN
    ALTER TABLE public.candidate_enrollments
      ADD CONSTRAINT candidate_enrollments_candidate_id_fkey
      FOREIGN KEY (candidate_id) REFERENCES public.candidates(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_approved_by_tl_fkey'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_approved_by_tl_fkey
      FOREIGN KEY (approved_by_tl) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_approved_by_manager_fkey'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_approved_by_manager_fkey
      FOREIGN KEY (approved_by_manager) REFERENCES public.employees(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leave_requests_rejected_by_fkey'
  ) THEN
    ALTER TABLE public.leave_requests
      ADD CONSTRAINT leave_requests_rejected_by_fkey
      FOREIGN KEY (rejected_by) REFERENCES public.employees(id);
  END IF;
END $$;
