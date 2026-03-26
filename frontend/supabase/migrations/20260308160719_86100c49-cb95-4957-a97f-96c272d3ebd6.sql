
CREATE TABLE public.candidate_enrollments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_id uuid REFERENCES public.candidates(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.employees(id),
  
  -- Personal Info
  full_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  gender text NOT NULL,
  dob date NOT NULL,
  
  -- Visa
  visa_status text NOT NULL,
  visa_expire_date date NOT NULL,
  
  -- Location
  current_location_zip text NOT NULL,
  current_domain text NOT NULL,
  years_experience text NOT NULL,
  
  -- LinkedIn
  linkedin_email text NOT NULL,
  linkedin_passcode text NOT NULL,
  
  -- SSN
  ssn_last4 text NOT NULL,
  
  -- Marketing Email
  marketing_email text NOT NULL,
  marketing_email_password text,
  
  -- Education
  highest_qualification text NOT NULL,
  masters_field text,
  masters_university text,
  masters_start_date date,
  masters_end_date date,
  bachelors_field text NOT NULL,
  bachelors_university text NOT NULL,
  bachelors_start_date date NOT NULL,
  bachelors_end_date date NOT NULL,
  
  -- General Questions
  arrived_in_usa date NOT NULL,
  veteran_status text NOT NULL,
  security_clearance text NOT NULL,
  race_ethnicity text NOT NULL,
  nearest_metro_area text NOT NULL,
  native_country text NOT NULL,
  total_certifications text NOT NULL,
  availability_for_calls text NOT NULL,
  availability_to_start text NOT NULL,
  open_for_relocation text NOT NULL,
  salary_expectations text NOT NULL,
  
  -- Notes
  notes text,
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.candidate_enrollments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can insert enrollments"
  ON public.candidate_enrollments FOR INSERT TO authenticated
  WITH CHECK (created_by = get_current_employee_id());

CREATE POLICY "Enrollments readable by authenticated"
  ON public.candidate_enrollments FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Creator can update enrollments"
  ON public.candidate_enrollments FOR UPDATE TO authenticated
  USING (created_by = get_current_employee_id());

CREATE TRIGGER update_candidate_enrollments_updated_at
  BEFORE UPDATE ON public.candidate_enrollments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
