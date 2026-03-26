
-- Add salary & deduction fields to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS base_salary numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pf_percentage numeric DEFAULT 12,
  ADD COLUMN IF NOT EXISTS professional_tax numeric DEFAULT 200;

-- Create a function to notify on leave request changes
CREATE OR REPLACE FUNCTION public.notify_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_employee employees%ROWTYPE;
  v_tl_id uuid;
  v_ops_heads uuid[];
  v_hr_ids uuid[];
  v_title text;
  v_body text;
  v_rid uuid;
BEGIN
  SELECT * INTO v_employee FROM employees WHERE id = NEW.employee_id;
  v_tl_id := v_employee.reporting_tl_id;

  -- Get ops_head and director ids
  SELECT array_agg(id) INTO v_ops_heads FROM employees 
    WHERE role IN ('ops_head', 'director') AND is_active = true;

  -- Get HR ids
  SELECT array_agg(id) INTO v_hr_ids FROM employees 
    WHERE role = 'hr' AND is_active = true;

  IF TG_OP = 'INSERT' THEN
    v_title := 'New Leave Request';
    v_body := v_employee.full_name || ' has applied for ' || NEW.leave_type || ' leave (' || NEW.total_days || ' days) from ' || NEW.start_date || ' to ' || NEW.end_date;
  ELSIF NEW.status = 'approved' AND OLD.status != 'approved' THEN
    v_title := 'Leave Approved';
    v_body := v_employee.full_name || '''s ' || NEW.leave_type || ' leave (' || NEW.total_days || ' days) has been approved';
  ELSIF NEW.status = 'rejected' AND OLD.status != 'rejected' THEN
    v_title := 'Leave Rejected';
    v_body := v_employee.full_name || '''s leave request has been rejected';
  ELSIF NEW.status = 'approved_by_tl' AND OLD.status != 'approved_by_tl' THEN
    v_title := 'Leave Approved by TL';
    v_body := v_employee.full_name || '''s leave awaits Ops Head approval (' || NEW.total_days || ' days)';
  ELSE
    RETURN NEW;
  END IF;

  -- Notify TL
  IF v_tl_id IS NOT NULL AND v_tl_id != NEW.employee_id THEN
    INSERT INTO notifications (recipient_employee_id, title, body, type)
    VALUES (v_tl_id, v_title, v_body, 'leave');
  END IF;

  -- Notify ops heads / directors
  IF v_ops_heads IS NOT NULL THEN
    FOREACH v_rid IN ARRAY v_ops_heads LOOP
      IF v_rid != NEW.employee_id THEN
        INSERT INTO notifications (recipient_employee_id, title, body, type)
        VALUES (v_rid, v_title, v_body, 'leave');
      END IF;
    END LOOP;
  END IF;

  -- Notify HR
  IF v_hr_ids IS NOT NULL THEN
    FOREACH v_rid IN ARRAY v_hr_ids LOOP
      IF v_rid != NEW.employee_id THEN
        INSERT INTO notifications (recipient_employee_id, title, body, type)
        VALUES (v_rid, v_title, v_body, 'leave');
      END IF;
    END LOOP;
  END IF;

  -- Notify employee on approval/rejection
  IF TG_OP = 'UPDATE' AND (NEW.status = 'approved' OR NEW.status = 'rejected' OR NEW.status = 'approved_by_tl') THEN
    INSERT INTO notifications (recipient_employee_id, title, body, type)
    VALUES (NEW.employee_id, v_title, v_body, 'leave');
  END IF;

  RETURN NEW;
END;
$$;

-- Create triggers for leave notifications
DROP TRIGGER IF EXISTS trigger_leave_notification_insert ON leave_requests;
CREATE TRIGGER trigger_leave_notification_insert
  AFTER INSERT ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION notify_leave_request();

DROP TRIGGER IF EXISTS trigger_leave_notification_update ON leave_requests;
CREATE TRIGGER trigger_leave_notification_update
  AFTER UPDATE ON leave_requests
  FOR EACH ROW EXECUTE FUNCTION notify_leave_request();
