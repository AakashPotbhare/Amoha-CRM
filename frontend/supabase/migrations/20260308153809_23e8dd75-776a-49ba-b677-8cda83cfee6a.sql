
-- Create candidates table
CREATE TABLE public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  gender TEXT,
  technology TEXT,
  assigned_to_employee_id UUID REFERENCES public.employees(id),
  assigned_to_team_id UUID REFERENCES public.teams(id),
  created_by UUID NOT NULL REFERENCES public.employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create support task types enum
CREATE TYPE public.support_task_type AS ENUM (
  'interview_support',
  'assessment_support',
  'ruc',
  'mock_call',
  'preparation_call'
);

-- Create interview round enum
CREATE TYPE public.interview_round AS ENUM (
  'screening',
  'phone_call',
  '1st_round',
  '2nd_round',
  '3rd_round',
  'final_round'
);

-- Create support_tasks table
CREATE TABLE public.support_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_type public.support_task_type NOT NULL,
  candidate_id UUID NOT NULL REFERENCES public.candidates(id),
  company_name TEXT,
  interview_round public.interview_round,
  scheduled_date DATE,
  start_time TIME,
  end_time TIME,
  deadline_date DATE,
  job_description TEXT,
  assigned_to_department_id UUID REFERENCES public.departments(id),
  assigned_to_team_id UUID REFERENCES public.teams(id),
  assigned_to_employee_id UUID REFERENCES public.employees(id),
  support_person_id UUID REFERENCES public.employees(id),
  willing_for_support BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'medium',
  created_by UUID NOT NULL REFERENCES public.employees(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tasks ENABLE ROW LEVEL SECURITY;

-- Create security definer function for employee lookup
CREATE OR REPLACE FUNCTION public.get_current_employee_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT department_id FROM public.employees WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
$$;

-- RLS for candidates: authenticated can read all, insert if created_by matches
CREATE POLICY "Candidates readable by authenticated"
ON public.candidates FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert candidates"
ON public.candidates FOR INSERT TO authenticated
WITH CHECK (created_by = get_current_employee_id());

CREATE POLICY "Creator or assigned can update candidates"
ON public.candidates FOR UPDATE TO authenticated
USING (created_by = get_current_employee_id() OR assigned_to_employee_id = get_current_employee_id());

-- RLS for support_tasks: authenticated can read all, insert if created_by matches
CREATE POLICY "Support tasks readable by authenticated"
ON public.support_tasks FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert support tasks"
ON public.support_tasks FOR INSERT TO authenticated
WITH CHECK (created_by = get_current_employee_id());

CREATE POLICY "Creator or assigned can update support tasks"
ON public.support_tasks FOR UPDATE TO authenticated
USING (created_by = get_current_employee_id() OR assigned_to_employee_id = get_current_employee_id() OR support_person_id = get_current_employee_id());

-- Updated_at triggers
CREATE TRIGGER update_candidates_updated_at
  BEFORE UPDATE ON public.candidates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_support_tasks_updated_at
  BEFORE UPDATE ON public.support_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
