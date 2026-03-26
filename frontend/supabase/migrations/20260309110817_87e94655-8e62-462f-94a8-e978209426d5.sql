
-- Add verification and address fields to employees
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS phone_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_address text,
  ADD COLUMN IF NOT EXISTS permanent_address text;

-- Create employee_documents table
CREATE TABLE public.employee_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  document_type text NOT NULL, -- 'aadhar', 'pan', 'passport_photo', 'address_proof'
  file_name text NOT NULL,
  file_url text NOT NULL,
  uploaded_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.employee_documents ENABLE ROW LEVEL SECURITY;

-- Only employee themselves or HR/director/ops_head can view documents
CREATE POLICY "Employee or HR can read documents"
  ON public.employee_documents FOR SELECT TO authenticated
  USING (
    employee_id = get_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM employees
      WHERE user_id = auth.uid() AND is_active = true
        AND role IN ('hr', 'director', 'ops_head')
    )
  );

-- Employee can upload their own documents
CREATE POLICY "Employee can insert own documents"
  ON public.employee_documents FOR INSERT TO authenticated
  WITH CHECK (employee_id = get_current_employee_id());

-- Employee can update their own documents
CREATE POLICY "Employee can update own documents"
  ON public.employee_documents FOR UPDATE TO authenticated
  USING (employee_id = get_current_employee_id());

-- Employee can delete their own documents
CREATE POLICY "Employee can delete own documents"
  ON public.employee_documents FOR DELETE TO authenticated
  USING (employee_id = get_current_employee_id());

-- Create private storage bucket for employee documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-documents', 'employee-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: employee can manage own folder, HR can read all
CREATE POLICY "Employees can upload own documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = (get_current_employee_id())::text
  );

CREATE POLICY "Employees can read own documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (
      (storage.foldername(name))[1] = (get_current_employee_id())::text
      OR EXISTS (
        SELECT 1 FROM employees
        WHERE user_id = auth.uid() AND is_active = true
          AND role IN ('hr', 'director', 'ops_head')
      )
    )
  );

CREATE POLICY "Employees can update own documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = (get_current_employee_id())::text
  );

CREATE POLICY "Employees can delete own documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'employee-documents'
    AND (storage.foldername(name))[1] = (get_current_employee_id())::text
  );

-- Trigger for updated_at
CREATE TRIGGER update_employee_documents_updated_at
  BEFORE UPDATE ON public.employee_documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
