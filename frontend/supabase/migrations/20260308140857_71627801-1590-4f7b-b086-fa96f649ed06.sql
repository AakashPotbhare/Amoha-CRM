
-- Drop overly permissive policies
DROP POLICY "Authenticated users can create tasks" ON public.tasks;
DROP POLICY "Users can update relevant tasks" ON public.tasks;

-- Create a helper function to get employee_id for the current user
CREATE OR REPLACE FUNCTION public.get_current_employee_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.employees WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- Insert: created_by must be the current user's employee record
CREATE POLICY "Authenticated users can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (created_by = public.get_current_employee_id());

-- Update: only creator or assignee can update
CREATE POLICY "Users can update relevant tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (
    created_by = public.get_current_employee_id()
    OR assigned_to_employee_id = public.get_current_employee_id()
  );
