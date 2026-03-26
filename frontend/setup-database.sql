-- ============================================
-- RecruitHUB Complete Database Setup
-- Copy this entire script and paste in Supabase SQL Editor → Run
-- ============================================

-- 1. Create role enum
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('director', 'ops_head', 'hr_head', 'sales_manager', 'dept_head', 'team_lead', 'senior_recruiter', 'recruiter', 'resume_builder');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- 2. Create all tables
-- Departments
CREATE TABLE IF NOT EXISTS public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Teams
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employees
CREATE TABLE IF NOT EXISTS public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  dob DATE,
  designation TEXT,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  team_id UUID NOT NULL REFERENCES public.teams(id),
  role app_role NOT NULL DEFAULT 'recruiter',
  reports_to UUID REFERENCES public.employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  joining_date DATE,
  avatar_url TEXT,
  base_salary NUMERIC DEFAULT 0,
  pf_percentage NUMERIC DEFAULT 12,
  professional_tax NUMERIC DEFAULT 200,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Office Locations
CREATE TABLE IF NOT EXISTS public.office_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Shift Settings
CREATE TABLE IF NOT EXISTS public.shift_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  grace_period_minutes INTEGER NOT NULL DEFAULT 15,
  required_hours NUMERIC NOT NULL DEFAULT 8,
  max_late_per_month INTEGER NOT NULL DEFAULT 3,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIMESTAMPTZ DEFAULT now(),
  check_out_time TIMESTAMPTZ,
  check_in_location_id UUID REFERENCES public.office_locations(id),
  check_out_location_id UUID REFERENCES public.office_locations(id),
  check_in_lat DOUBLE PRECISION,
  check_in_lng DOUBLE PRECISION,
  check_out_lat DOUBLE PRECISION,
  check_out_lng DOUBLE PRECISION,
  is_wfh BOOLEAN NOT NULL DEFAULT false,
  is_late BOOLEAN NOT NULL DEFAULT false,
  attendance_status TEXT NOT NULL DEFAULT 'present',
  total_hours NUMERIC,
  shift_setting_id UUID REFERENCES public.shift_settings(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(employee_id, date)
);

-- Tasks
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  created_by_employee_id UUID REFERENCES public.employees(id),
  assigned_to_employee_id UUID REFERENCES public.employees(id),
  assigned_to_department_id UUID REFERENCES public.departments(id),
  assigned_to_team_id UUID REFERENCES public.teams(id),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Support Tasks
CREATE TABLE IF NOT EXISTS public.support_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  category TEXT,
  created_by_employee_id UUID REFERENCES public.employees(id),
  assigned_to_employee_id UUID REFERENCES public.employees(id),
  department_id UUID REFERENCES public.departments(id),
  team_id UUID REFERENCES public.teams(id),
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Task Comments
CREATE TABLE IF NOT EXISTS public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  support_task_id UUID REFERENCES public.support_tasks(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES public.employees(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidates
CREATE TABLE IF NOT EXISTS public.candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  resume_url TEXT,
  source TEXT,
  notes TEXT,
  created_by_employee_id UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Candidate Enrollments
CREATE TABLE IF NOT EXISTS public.candidate_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.employees(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT NOT NULL,
  dob DATE NOT NULL,
  visa_status TEXT NOT NULL,
  visa_expire_date DATE NOT NULL,
  current_location_zip TEXT NOT NULL,
  current_domain TEXT NOT NULL,
  years_experience TEXT NOT NULL,
  linkedin_email TEXT NOT NULL,
  linkedin_passcode TEXT NOT NULL,
  ssn_last4 TEXT NOT NULL,
  marketing_email TEXT NOT NULL,
  marketing_email_password TEXT,
  highest_qualification TEXT NOT NULL,
  masters_field TEXT,
  masters_university TEXT,
  masters_start_date DATE,
  masters_end_date DATE,
  bachelors_field TEXT NOT NULL,
  bachelors_university TEXT NOT NULL,
  bachelors_start_date DATE NOT NULL,
  bachelors_end_date DATE NOT NULL,
  arrived_in_usa DATE NOT NULL,
  veteran_status TEXT NOT NULL,
  security_clearance TEXT NOT NULL,
  race_ethnicity TEXT NOT NULL,
  nearest_metro_area TEXT NOT NULL,
  native_country TEXT NOT NULL,
  total_certifications TEXT NOT NULL,
  availability_for_calls TEXT NOT NULL,
  availability_to_start TEXT NOT NULL,
  open_for_relocation TEXT NOT NULL,
  salary_expectations TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave Requests
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL DEFAULT 'casual',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES public.employees(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leave Balances
CREATE TABLE IF NOT EXISTS public.leave_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type TEXT NOT NULL,
  total_days NUMERIC NOT NULL DEFAULT 0,
  used_days NUMERIC NOT NULL DEFAULT 0,
  year INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  UNIQUE(employee_id, leave_type, year)
);

-- Chat Conversations
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT,
  is_group BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.employees(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info',
  is_read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Notice Board
CREATE TABLE IF NOT EXISTS public.notice_board (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'normal',
  posted_by UUID REFERENCES public.employees(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Salary History
CREATE TABLE IF NOT EXISTS public.salary_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  effective_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Attendance Breaks
CREATE TABLE IF NOT EXISTS public.attendance_breaks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_record_id UUID NOT NULL REFERENCES public.attendance_records(id) ON DELETE CASCADE,
  break_number INTEGER NOT NULL,
  break_type TEXT NOT NULL DEFAULT 'short', -- 'short' (15 min) or 'long' (45 min)
  break_out_time TIMESTAMPTZ NOT NULL DEFAULT now(),
  break_in_time TIMESTAMPTZ,
  duration_minutes NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Employee Documents
CREATE TABLE IF NOT EXISTS public.employee_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  document_url TEXT NOT NULL,
  verified BOOLEAN NOT NULL DEFAULT false,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================
-- 3. Enable RLS on all tables
-- ============================================
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_board ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.salary_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. RLS Policies — All authenticated users can read, restricted writes
-- ============================================

-- Departments, Teams, Office Locations, Shift Settings — readable by all authenticated
CREATE POLICY "departments_read" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "teams_read" ON public.teams FOR SELECT TO authenticated USING (true);
CREATE POLICY "office_locations_read" ON public.office_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "shift_settings_read" ON public.shift_settings FOR SELECT TO authenticated USING (true);

-- Employees — read all, update own
CREATE POLICY "employees_read" ON public.employees FOR SELECT TO authenticated USING (true);
CREATE POLICY "employees_update_own" ON public.employees FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Attendance — read all (for reports), insert/update own
CREATE POLICY "attendance_read" ON public.attendance_records FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_insert" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "attendance_update" ON public.attendance_records FOR UPDATE TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Tasks — read all, insert by anyone, update assigned or creator
CREATE POLICY "tasks_read" ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE TO authenticated USING (true);

-- Support Tasks — same as tasks
CREATE POLICY "support_tasks_read" ON public.support_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "support_tasks_insert" ON public.support_tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "support_tasks_update" ON public.support_tasks FOR UPDATE TO authenticated USING (true);

-- Task Comments
CREATE POLICY "task_comments_read" ON public.task_comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "task_comments_insert" ON public.task_comments FOR INSERT TO authenticated WITH CHECK (true);

-- Candidates & Enrollments
CREATE POLICY "candidates_read" ON public.candidates FOR SELECT TO authenticated USING (true);
CREATE POLICY "candidates_insert" ON public.candidates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "candidates_update" ON public.candidates FOR UPDATE TO authenticated USING (true);
CREATE POLICY "enrollments_read" ON public.candidate_enrollments FOR SELECT TO authenticated USING (true);
CREATE POLICY "enrollments_insert" ON public.candidate_enrollments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "enrollments_update" ON public.candidate_enrollments FOR UPDATE TO authenticated USING (true);

-- Leave
CREATE POLICY "leave_requests_read" ON public.leave_requests FOR SELECT TO authenticated USING (true);
CREATE POLICY "leave_requests_insert" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "leave_requests_update" ON public.leave_requests FOR UPDATE TO authenticated USING (true);
CREATE POLICY "leave_balances_read" ON public.leave_balances FOR SELECT TO authenticated USING (true);

-- Chat
CREATE POLICY "chat_conv_read" ON public.chat_conversations FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_conv_insert" ON public.chat_conversations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "chat_msg_read" ON public.chat_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "chat_msg_insert" ON public.chat_messages FOR INSERT TO authenticated WITH CHECK (true);

-- Notifications — own only
CREATE POLICY "notifications_read" ON public.notifications FOR SELECT TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Notice Board
CREATE POLICY "notice_board_read" ON public.notice_board FOR SELECT TO authenticated USING (true);
CREATE POLICY "notice_board_insert" ON public.notice_board FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "notice_board_update" ON public.notice_board FOR UPDATE TO authenticated USING (true);

-- Salary History — own only
CREATE POLICY "salary_read" ON public.salary_history FOR SELECT TO authenticated USING (
  employee_id IN (SELECT id FROM public.employees WHERE user_id = auth.uid())
);

-- Attendance Breaks
CREATE POLICY "breaks_read" ON public.attendance_breaks FOR SELECT TO authenticated USING (true);
CREATE POLICY "breaks_insert" ON public.attendance_breaks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "breaks_update" ON public.attendance_breaks FOR UPDATE TO authenticated USING (true);

-- Employee Documents
CREATE POLICY "docs_read" ON public.employee_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "docs_insert" ON public.employee_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "docs_update" ON public.employee_documents FOR UPDATE TO authenticated USING (true);

-- ============================================
-- 5. Helper Functions
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Apply to all tables with updated_at
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['employees','tasks','support_tasks','candidates','candidate_enrollments','leave_requests'])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', tbl, tbl);
  END LOOP;
END $$;

-- Function to look up email by employee code (for login)
CREATE OR REPLACE FUNCTION public.get_email_by_employee_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.employees WHERE employee_code = p_code AND is_active = true LIMIT 1;
$$;

-- ============================================
-- 6. Seed Data — Departments & Teams
-- ============================================

INSERT INTO public.departments (name, slug) VALUES
  ('Marketing', 'marketing'),
  ('Sales', 'sales'),
  ('Resume', 'resume'),
  ('Technical', 'technical'),
  ('Compliance', 'compliance')
ON CONFLICT (slug) DO NOTHING;

-- Marketing has 4 teams (named after team leaders)
INSERT INTO public.teams (name, department_id)
SELECT t.team_name, d.id
FROM public.departments d
CROSS JOIN (VALUES
  ('Team Aditya'),
  ('Team Bhavitya'),
  ('Team Yash'),
  ('Team Aman')
) AS t(team_name)
WHERE d.slug = 'marketing'
AND NOT EXISTS (SELECT 1 FROM public.teams WHERE department_id = d.id);

-- Other departments get 1 team each
INSERT INTO public.teams (name, department_id)
SELECT d.name || ' Team', d.id
FROM public.departments d
WHERE d.slug != 'marketing'
AND NOT EXISTS (SELECT 1 FROM public.teams WHERE department_id = d.id);

-- ============================================
-- 7. Seed Data — Office Locations (Ahmedabad, India)
-- ============================================

INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters) VALUES
  ('Head Office - Amoha', 'Amoha Recruitment Services LLC, Ahmedabad, Gujarat', 23.03272, 72.55490, 300),
  ('Branch Office', 'GCP Business Centre, Ahmedabad, Gujarat', 23.0450857, 72.5512129, 300),
  ('Test Location (Ambawadi Circle)', 'Ambawadi Circle, Ahmedabad, Gujarat', 23.0241504, 72.5507243, 500)
ON CONFLICT DO NOTHING;

-- ============================================
-- 8. Seed Data — Shift Settings
-- ============================================

INSERT INTO public.shift_settings (name, start_time, end_time, grace_period_minutes, required_hours, max_late_per_month) VALUES
  ('General Shift', '09:30', '18:30', 15, 8, 3)
ON CONFLICT DO NOTHING;

-- ============================================
-- 9. Seed Data — Core Leadership Employees (no auth.users yet)
--    user_id will be linked after auth accounts are created
-- ============================================

-- Directors
INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'DIR001', 'Aashish Dabhi', 'aashish@amoha.in', 'Director', d.id, t.id, 'director'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id WHERE d.slug = 'technical' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'DIR002', 'Karan Sharma', 'karan@amoha.in', 'Director', d.id, t.id, 'director'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id WHERE d.slug = 'technical' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'DIR003', 'Manthan Sharma', 'manthan@amoha.in', 'Director', d.id, t.id, 'director'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id WHERE d.slug = 'technical' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

-- Operations Head
INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'OPS001', 'Tripesh Koneru', 'tripesh@amoha.in', 'Operations Head', d.id, t.id, 'ops_head'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id WHERE d.slug = 'compliance' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

-- HR Head
INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'HR001', 'Balkishan Tiwari', 'balkishan@amoha.in', 'HR Head', d.id, t.id, 'hr_head'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id WHERE d.slug = 'compliance' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

-- Sales Manager
INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'SAL001', 'Vishesh Shah', 'vishesh@amoha.in', 'Sales Manager', d.id, t.id, 'sales_manager'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id WHERE d.slug = 'sales' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

-- Resume Department Leader
INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'RES001', 'Yogesh Lokam', 'yogesh@amoha.in', 'Resume Department Leader', d.id, t.id, 'dept_head'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id WHERE d.slug = 'resume' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

-- Marketing Team Leaders
INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'MKT001', 'Aditya Singh Tomar', 'aditya@amoha.in', 'Marketing Team Leader', d.id, t.id, 'team_lead'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id AND t.name = 'Team Aditya' WHERE d.slug = 'marketing' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'MKT002', 'Bhavitya Naithani', 'bhavitya@amoha.in', 'Marketing Team Leader', d.id, t.id, 'team_lead'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id AND t.name = 'Team Bhavitya' WHERE d.slug = 'marketing' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'MKT003', 'Yash Mistri', 'yash@amoha.in', 'Marketing Team Leader', d.id, t.id, 'team_lead'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id AND t.name = 'Team Yash' WHERE d.slug = 'marketing' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

INSERT INTO public.employees (employee_code, full_name, email, designation, department_id, team_id, role)
SELECT 'MKT004', 'Aman Pandey', 'aman@amoha.in', 'Marketing Team Leader', d.id, t.id, 'team_lead'
FROM public.departments d JOIN public.teams t ON t.department_id = d.id AND t.name = 'Team Aman' WHERE d.slug = 'marketing' LIMIT 1
ON CONFLICT (employee_code) DO NOTHING;

-- ============================================
-- DONE! Now run the Node.js script to create auth users + employees
-- ============================================
