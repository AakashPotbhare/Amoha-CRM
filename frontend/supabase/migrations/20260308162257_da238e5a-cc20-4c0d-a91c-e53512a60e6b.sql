
-- Add new columns to support_tasks for Teams link, feedback, questions, and call completion status
ALTER TABLE public.support_tasks 
  ADD COLUMN IF NOT EXISTS teams_link text,
  ADD COLUMN IF NOT EXISTS link_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS call_status text DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS feedback text,
  ADD COLUMN IF NOT EXISTS questions_asked text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Create notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  support_task_id uuid REFERENCES public.support_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  body text,
  type text NOT NULL DEFAULT 'reminder',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (recipient_employee_id = get_current_employee_id());

-- Users can update (mark read) their own notifications
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (recipient_employee_id = get_current_employee_id());

-- System (authenticated) can insert notifications
CREATE POLICY "Authenticated can insert notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (true);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
