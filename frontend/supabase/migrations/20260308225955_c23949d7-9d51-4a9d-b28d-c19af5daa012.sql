
CREATE OR REPLACE FUNCTION public.notify_resume_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_creator employees%ROWTYPE;
  v_candidate_name text;
  v_resume_emp record;
  v_title text;
  v_body text;
  v_task_label text;
BEGIN
  -- Only fire for resume tasks
  IF NEW.task_type NOT IN ('resume_building', 'resume_rebuilding') THEN
    RETURN NEW;
  END IF;

  -- Get creator info
  SELECT * INTO v_creator FROM employees WHERE id = NEW.created_by;

  -- Get candidate name
  SELECT full_name INTO v_candidate_name FROM candidates WHERE id = NEW.candidate_id;

  -- Build label
  IF NEW.task_type = 'resume_building' THEN
    v_task_label := 'Resume Building';
  ELSE
    v_task_label := 'Resume Rebuilding';
  END IF;

  v_title := 'New ' || v_task_label || ' Request';
  v_body := COALESCE(v_creator.full_name, 'Someone') || ' requested ' || v_task_label || ' for ' || COALESCE(v_candidate_name, 'a candidate');

  -- Notify preferred handler if set
  IF NEW.preferred_handler_id IS NOT NULL THEN
    INSERT INTO notifications (recipient_employee_id, title, body, type, support_task_id)
    VALUES (NEW.preferred_handler_id, v_title || ' (Preferred)', v_body, 'task', NEW.id);
  END IF;

  -- Notify assigned employee if set and different from preferred
  IF NEW.assigned_to_employee_id IS NOT NULL AND NEW.assigned_to_employee_id IS DISTINCT FROM NEW.preferred_handler_id THEN
    INSERT INTO notifications (recipient_employee_id, title, body, type, support_task_id)
    VALUES (NEW.assigned_to_employee_id, v_title, v_body, 'task', NEW.id);
  END IF;

  -- Notify all resume department team leads and resume_builders (who aren't already notified)
  FOR v_resume_emp IN
    SELECT e.id FROM employees e
    JOIN departments d ON e.department_id = d.id
    WHERE d.slug = 'resume'
      AND e.is_active = true
      AND (e.role IN ('team_lead', 'ops_head', 'director', 'resume_builder'))
      AND e.id IS DISTINCT FROM NEW.assigned_to_employee_id
      AND e.id IS DISTINCT FROM NEW.preferred_handler_id
      AND e.id IS DISTINCT FROM NEW.created_by
  LOOP
    INSERT INTO notifications (recipient_employee_id, title, body, type, support_task_id)
    VALUES (v_resume_emp.id, v_title, v_body, 'task', NEW.id);
  END LOOP;

  RETURN NEW;
END;
$$;

-- Attach trigger to support_tasks
DROP TRIGGER IF EXISTS trg_notify_resume_task ON public.support_tasks;
CREATE TRIGGER trg_notify_resume_task
AFTER INSERT ON public.support_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_resume_task();
