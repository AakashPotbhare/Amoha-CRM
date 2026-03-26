
CREATE TABLE public.salary_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  previous_salary numeric NOT NULL DEFAULT 0,
  new_salary numeric NOT NULL DEFAULT 0,
  previous_pf_percentage numeric,
  new_pf_percentage numeric,
  previous_professional_tax numeric,
  new_professional_tax numeric,
  effective_date date NOT NULL DEFAULT CURRENT_DATE,
  reason text,
  changed_by uuid NOT NULL REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HR can read salary history" ON public.salary_history
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('hr', 'director', 'ops_head')
  ));

CREATE POLICY "HR can insert salary history" ON public.salary_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('hr', 'director', 'ops_head')
  ));
