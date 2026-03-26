
-- Leave type enum
CREATE TYPE public.leave_type AS ENUM ('paid', 'unpaid');
-- Leave request status
CREATE TYPE public.leave_status AS ENUM ('pending', 'approved_by_tl', 'approved', 'rejected');

-- Leave balances per employee per year
CREATE TABLE public.leave_balances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  year integer NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  month integer NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
  paid_leave_credited numeric(4,1) NOT NULL DEFAULT 0,
  paid_leave_used numeric(4,1) NOT NULL DEFAULT 0,
  unpaid_leave_used numeric(4,1) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, year)
);

ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees read own leave balance"
  ON public.leave_balances FOR SELECT TO authenticated
  USING (
    employee_id = get_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('director', 'ops_head', 'team_lead')
    )
  );

CREATE POLICY "System can insert leave balances"
  ON public.leave_balances FOR INSERT TO authenticated
  WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "System can update leave balances"
  ON public.leave_balances FOR UPDATE TO authenticated
  USING (
    employee_id = get_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('director', 'ops_head', 'team_lead')
    )
  );

-- Leave requests
CREATE TABLE public.leave_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  leave_type leave_type NOT NULL DEFAULT 'paid',
  start_date date NOT NULL,
  end_date date NOT NULL,
  total_days numeric(4,1) NOT NULL,
  reason text,
  status leave_status NOT NULL DEFAULT 'pending',
  approved_by_tl uuid REFERENCES public.employees(id),
  approved_by_tl_at timestamptz,
  approved_by_manager uuid REFERENCES public.employees(id),
  approved_by_manager_at timestamptz,
  rejected_by uuid REFERENCES public.employees(id),
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Employees read own leave requests"
  ON public.leave_requests FOR SELECT TO authenticated
  USING (
    employee_id = get_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('director', 'ops_head', 'team_lead')
    )
  );

CREATE POLICY "Employees can create leave requests"
  ON public.leave_requests FOR INSERT TO authenticated
  WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Approvers can update leave requests"
  ON public.leave_requests FOR UPDATE TO authenticated
  USING (
    employee_id = get_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.employees
      WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('director', 'ops_head', 'team_lead')
    )
  );

-- Function to get/create leave balance for current year
CREATE OR REPLACE FUNCTION public.get_or_create_leave_balance(p_employee_id uuid)
RETURNS public.leave_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance leave_balances;
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  v_month integer := EXTRACT(MONTH FROM CURRENT_DATE);
BEGIN
  SELECT * INTO v_balance FROM leave_balances
    WHERE employee_id = p_employee_id AND year = v_year;

  IF NOT FOUND THEN
    INSERT INTO leave_balances (employee_id, year, month, paid_leave_credited)
    VALUES (p_employee_id, v_year, v_month, v_month)
    RETURNING * INTO v_balance;
  ELSE
    -- Update credits if month changed (1 paid leave per month)
    IF v_balance.month < v_month THEN
      UPDATE leave_balances
        SET paid_leave_credited = v_month,
            month = v_month,
            updated_at = now()
        WHERE id = v_balance.id
        RETURNING * INTO v_balance;
    END IF;
  END IF;

  RETURN v_balance;
END;
$$;
