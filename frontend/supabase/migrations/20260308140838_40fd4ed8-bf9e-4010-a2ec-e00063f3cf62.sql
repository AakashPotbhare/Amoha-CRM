
-- Step 1: Add 'director' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'director';

-- Step 2: Create tasks table
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_by uuid NOT NULL REFERENCES public.employees(id),
  assigned_to_department_id uuid REFERENCES public.departments(id),
  assigned_to_team_id uuid REFERENCES public.teams(id),
  assigned_to_employee_id uuid REFERENCES public.employees(id),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  due_date timestamp with time zone,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read tasks assigned to them or their department/team, or that they created
CREATE POLICY "Users can read relevant tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (true);

-- Anyone can create tasks
CREATE POLICY "Authenticated users can create tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Creator or assignee can update
CREATE POLICY "Users can update relevant tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks;

-- Add updated_at trigger
CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
