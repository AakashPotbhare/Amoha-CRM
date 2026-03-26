
-- Fix 1: Restrict candidate_enrollments SELECT to creator + HR/leadership
DROP POLICY IF EXISTS "Enrollments readable by authenticated" ON public.candidate_enrollments;
CREATE POLICY "Enrollments readable by creator and HR"
  ON public.candidate_enrollments FOR SELECT TO authenticated
  USING (
    created_by = get_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid()
        AND is_active = true
        AND role IN ('hr', 'director', 'ops_head')
    )
  );

-- Fix 2: Prevent employee role self-escalation
DROP POLICY IF EXISTS "Employees can update own or HR can update" ON public.employees;

-- Self-update: can only change non-privileged fields (role must stay the same)
CREATE POLICY "Employees can update own non-privileged fields"
  ON public.employees FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND role = (SELECT e.role FROM employees e WHERE e.user_id = auth.uid() AND e.is_active = true LIMIT 1)
  );

-- HR/director/ops_head can update any employee (including role changes)
CREATE POLICY "HR and leadership can update employees"
  ON public.employees FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM employees e
      WHERE e.user_id = auth.uid()
        AND e.is_active = true
        AND e.role IN ('hr', 'director', 'ops_head')
    )
  );
