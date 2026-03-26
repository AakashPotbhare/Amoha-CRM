
-- Add new columns to employees table
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS designation text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS dob date,
  ADD COLUMN IF NOT EXISTS joining_date date DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS employment_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS reporting_tl_id uuid REFERENCES public.employees(id);

-- Function to auto-generate employee code (ARS + year + 4-digit seq)
CREATE OR REPLACE FUNCTION public.generate_employee_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_year text;
  v_seq int;
  v_code text;
BEGIN
  IF NEW.employee_code IS NULL OR NEW.employee_code = '' THEN
    v_year := to_char(COALESCE(NEW.joining_date, CURRENT_DATE), 'YYYY');
    SELECT COALESCE(MAX(
      CAST(RIGHT(employee_code, 4) AS integer)
    ), 0) + 1
    INTO v_seq
    FROM employees
    WHERE employee_code LIKE 'ARS' || v_year || '%'
      AND LENGTH(employee_code) = 11;
    
    v_code := 'ARS' || v_year || LPAD(v_seq::text, 4, '0');
    NEW.employee_code := v_code;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trigger_generate_employee_code
  BEFORE INSERT ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_employee_code();

-- Function to check probation (first 3 months)
CREATE OR REPLACE FUNCTION public.is_employee_in_probation(p_employee_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT joining_date + interval '3 months' > CURRENT_DATE
     FROM employees WHERE id = p_employee_id AND is_active = true),
    false
  );
$$;

-- RLS: Allow HR role to insert employees
CREATE POLICY "HR can insert employees"
  ON public.employees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('hr', 'director', 'ops_head')
    )
  );

-- Update the existing update policy to allow HR
DROP POLICY IF EXISTS "Employees can update own record" ON public.employees;
CREATE POLICY "Employees can update own or HR can update"
  ON public.employees FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('hr', 'director', 'ops_head')
    )
  );

-- Update leave balance function to respect probation
CREATE OR REPLACE FUNCTION public.get_or_create_leave_balance(p_employee_id uuid)
RETURNS leave_balances
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance leave_balances;
  v_year integer := EXTRACT(YEAR FROM CURRENT_DATE);
  v_month integer := EXTRACT(MONTH FROM CURRENT_DATE);
  v_joining_date date;
  v_probation_end date;
  v_credits integer;
BEGIN
  SELECT joining_date INTO v_joining_date FROM employees WHERE id = p_employee_id;
  v_probation_end := COALESCE(v_joining_date, '2020-01-01'::date) + interval '3 months';

  -- Calculate credits: 0 during probation, 1/month after
  IF CURRENT_DATE < v_probation_end THEN
    v_credits := 0;
  ELSE
    -- Credits = months since probation ended (in current year)
    v_credits := GREATEST(0, v_month - GREATEST(EXTRACT(MONTH FROM v_probation_end)::integer, 0));
    IF EXTRACT(YEAR FROM v_probation_end) < v_year THEN
      v_credits := v_month; -- full year of credits
    END IF;
  END IF;

  SELECT * INTO v_balance FROM leave_balances
    WHERE employee_id = p_employee_id AND year = v_year;

  IF NOT FOUND THEN
    INSERT INTO leave_balances (employee_id, year, month, paid_leave_credited)
    VALUES (p_employee_id, v_year, v_month, v_credits)
    RETURNING * INTO v_balance;
  ELSE
    IF v_balance.month < v_month THEN
      UPDATE leave_balances
        SET paid_leave_credited = v_credits,
            month = v_month,
            updated_at = now()
        WHERE id = v_balance.id
        RETURNING * INTO v_balance;
    END IF;
  END IF;

  RETURN v_balance;
END;
$$;
