
-- 1. Add resume_builder to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'resume_builder';

-- 2. Add preferred_handler_id column to support_tasks
ALTER TABLE public.support_tasks 
ADD COLUMN IF NOT EXISTS preferred_handler_id uuid REFERENCES public.employees(id);

-- 3. Update support_tasks RLS for preferred handler to also update
DROP POLICY IF EXISTS "Creator or assigned can update support tasks" ON public.support_tasks;
CREATE POLICY "Creator or assigned can update support tasks"
ON public.support_tasks FOR UPDATE TO authenticated
USING (
  created_by = get_current_employee_id()
  OR assigned_to_employee_id = get_current_employee_id()
  OR support_person_id = get_current_employee_id()
  OR preferred_handler_id = get_current_employee_id()
);
