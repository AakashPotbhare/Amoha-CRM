DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'candidate_enrollments'
  ) THEN
    ALTER TABLE public.candidate_enrollments
      ALTER COLUMN candidate_id DROP NOT NULL;

    ALTER TABLE public.candidate_enrollments
      ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.employees(id),
      ADD COLUMN IF NOT EXISTS full_name TEXT,
      ADD COLUMN IF NOT EXISTS email TEXT,
      ADD COLUMN IF NOT EXISTS phone TEXT,
      ADD COLUMN IF NOT EXISTS gender TEXT,
      ADD COLUMN IF NOT EXISTS dob DATE,
      ADD COLUMN IF NOT EXISTS visa_status TEXT,
      ADD COLUMN IF NOT EXISTS visa_expire_date DATE,
      ADD COLUMN IF NOT EXISTS current_location_zip TEXT,
      ADD COLUMN IF NOT EXISTS current_domain TEXT,
      ADD COLUMN IF NOT EXISTS years_experience TEXT,
      ADD COLUMN IF NOT EXISTS linkedin_email TEXT,
      ADD COLUMN IF NOT EXISTS linkedin_passcode TEXT,
      ADD COLUMN IF NOT EXISTS ssn_last4 TEXT,
      ADD COLUMN IF NOT EXISTS marketing_email TEXT,
      ADD COLUMN IF NOT EXISTS marketing_email_password TEXT,
      ADD COLUMN IF NOT EXISTS highest_qualification TEXT,
      ADD COLUMN IF NOT EXISTS masters_field TEXT,
      ADD COLUMN IF NOT EXISTS masters_university TEXT,
      ADD COLUMN IF NOT EXISTS masters_start_date DATE,
      ADD COLUMN IF NOT EXISTS masters_end_date DATE,
      ADD COLUMN IF NOT EXISTS bachelors_field TEXT,
      ADD COLUMN IF NOT EXISTS bachelors_university TEXT,
      ADD COLUMN IF NOT EXISTS bachelors_start_date DATE,
      ADD COLUMN IF NOT EXISTS bachelors_end_date DATE,
      ADD COLUMN IF NOT EXISTS arrived_in_usa DATE,
      ADD COLUMN IF NOT EXISTS veteran_status TEXT,
      ADD COLUMN IF NOT EXISTS security_clearance TEXT,
      ADD COLUMN IF NOT EXISTS race_ethnicity TEXT,
      ADD COLUMN IF NOT EXISTS nearest_metro_area TEXT,
      ADD COLUMN IF NOT EXISTS native_country TEXT,
      ADD COLUMN IF NOT EXISTS total_certifications TEXT,
      ADD COLUMN IF NOT EXISTS availability_for_calls TEXT,
      ADD COLUMN IF NOT EXISTS availability_to_start TEXT,
      ADD COLUMN IF NOT EXISTS open_for_relocation TEXT,
      ADD COLUMN IF NOT EXISTS salary_expectations TEXT;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'candidate_enrollments'
        AND column_name = 'job_title'
        AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.candidate_enrollments
        ALTER COLUMN job_title DROP NOT NULL;
    END IF;
  ELSE
    CREATE TABLE public.candidate_enrollments (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      candidate_id UUID REFERENCES public.candidates(id) ON DELETE CASCADE,
      created_by UUID NOT NULL REFERENCES public.employees(id),
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
  END IF;
END $$;
