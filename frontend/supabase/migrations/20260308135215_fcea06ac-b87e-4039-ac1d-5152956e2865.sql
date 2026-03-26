
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('ops_head', 'team_lead', 'senior_recruiter', 'recruiter');

-- Create departments table
CREATE TABLE public.departments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create teams table
CREATE TABLE public.teams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create employees table (profiles linked to auth.users)
CREATE TABLE public.employees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  employee_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  department_id UUID NOT NULL REFERENCES public.departments(id),
  team_id UUID NOT NULL REFERENCES public.teams(id),
  role app_role NOT NULL DEFAULT 'recruiter',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- Departments: readable by all authenticated users
CREATE POLICY "Departments readable by authenticated" ON public.departments
  FOR SELECT TO authenticated USING (true);

-- Teams: readable by all authenticated users
CREATE POLICY "Teams readable by authenticated" ON public.teams
  FOR SELECT TO authenticated USING (true);

-- Employees: users can read all employees (for team views), but only update their own
CREATE POLICY "Employees readable by authenticated" ON public.employees
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Employees can update own record" ON public.employees
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

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

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed departments
INSERT INTO public.departments (name, slug) VALUES
  ('Marketing', 'marketing'),
  ('Sales', 'sales'),
  ('Resume', 'resume'),
  ('Technical', 'technical'),
  ('Compliance', 'compliance');

-- Seed teams (Marketing has 4 teams, others have 1)
INSERT INTO public.teams (name, department_id)
SELECT 'Marketing Team ' || t.n, d.id
FROM public.departments d
CROSS JOIN (VALUES (1),(2),(3),(4)) AS t(n)
WHERE d.slug = 'marketing';

INSERT INTO public.teams (name, department_id)
SELECT d.name || ' Team', d.id
FROM public.departments d
WHERE d.slug != 'marketing';
