
-- Add resume task types to the enum
ALTER TYPE public.support_task_type ADD VALUE IF NOT EXISTS 'resume_building';
ALTER TYPE public.support_task_type ADD VALUE IF NOT EXISTS 'resume_rebuilding';

-- Create task_comments table for cross-department visibility
CREATE TABLE public.task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_task_id uuid NOT NULL REFERENCES public.support_tasks(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read comments (cross-department visibility)
CREATE POLICY "Authenticated can read task comments"
  ON public.task_comments FOR SELECT TO authenticated
  USING (true);

-- Only the commenter can insert
CREATE POLICY "Authenticated can insert task comments"
  ON public.task_comments FOR INSERT TO authenticated
  WITH CHECK (employee_id = get_current_employee_id());

-- Enable realtime for comments
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;
