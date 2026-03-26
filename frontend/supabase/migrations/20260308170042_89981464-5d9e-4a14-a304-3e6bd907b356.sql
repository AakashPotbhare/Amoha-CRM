
-- Office locations table
CREATE TABLE public.office_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  radius_meters integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.office_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Office locations readable by authenticated"
  ON public.office_locations FOR SELECT TO authenticated
  USING (true);

-- Shift settings table (admin-configurable)
CREATE TABLE public.shift_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT 'Default Shift',
  start_time time NOT NULL DEFAULT '19:30',
  end_time time NOT NULL DEFAULT '04:30',
  grace_period_minutes integer NOT NULL DEFAULT 15,
  required_hours numeric(4,2) NOT NULL DEFAULT 7.0,
  max_late_per_month integer NOT NULL DEFAULT 3,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shift settings readable by authenticated"
  ON public.shift_settings FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Directors and ops_head can insert shift settings"
  ON public.shift_settings FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.employees 
      WHERE user_id = auth.uid() AND is_active = true 
      AND role IN ('director', 'ops_head')
    )
  );

CREATE POLICY "Directors and ops_head can update shift settings"
  ON public.shift_settings FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.employees 
      WHERE user_id = auth.uid() AND is_active = true 
      AND role IN ('director', 'ops_head')
    )
  );

-- Attendance records table
CREATE TABLE public.attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id uuid NOT NULL REFERENCES public.employees(id),
  check_in_time timestamptz NOT NULL DEFAULT now(),
  check_out_time timestamptz,
  check_in_location_id uuid REFERENCES public.office_locations(id),
  check_out_location_id uuid REFERENCES public.office_locations(id),
  check_in_lat double precision,
  check_in_lng double precision,
  check_out_lat double precision,
  check_out_lng double precision,
  is_wfh boolean NOT NULL DEFAULT false,
  is_late boolean NOT NULL DEFAULT false,
  attendance_status text NOT NULL DEFAULT 'present',
  total_hours numeric(5,2),
  date date NOT NULL DEFAULT CURRENT_DATE,
  shift_setting_id uuid REFERENCES public.shift_settings(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Unique constraint: one record per employee per date
CREATE UNIQUE INDEX attendance_records_employee_date_idx ON public.attendance_records(employee_id, date);

CREATE POLICY "Employees can read own attendance"
  ON public.attendance_records FOR SELECT TO authenticated
  USING (
    employee_id = get_current_employee_id()
    OR EXISTS (
      SELECT 1 FROM public.employees e
      WHERE e.user_id = auth.uid() AND e.is_active = true
      AND e.role IN ('director', 'ops_head', 'team_lead')
    )
  );

CREATE POLICY "Employees can insert own attendance"
  ON public.attendance_records FOR INSERT TO authenticated
  WITH CHECK (employee_id = get_current_employee_id());

CREATE POLICY "Employees can update own attendance"
  ON public.attendance_records FOR UPDATE TO authenticated
  USING (employee_id = get_current_employee_id());

-- Insert the two office locations
INSERT INTO public.office_locations (name, address, latitude, longitude, radius_meters)
VALUES 
  ('Head Office - Zodiac Plaza', '407, Zodiac Plaza, Off C.G Road, HL College Road, Ahmedabad, Gujarat 380009', 23.0350, 72.5610, 100),
  ('GCP Business Centre', 'GCP Business Centre, Vijay Cross Rd, Navrangpura, Ahmedabad, Gujarat 380009', 23.0369, 72.5557, 100);

-- Insert default shift setting
INSERT INTO public.shift_settings (name, start_time, end_time, grace_period_minutes, required_hours, max_late_per_month)
VALUES ('Default Evening Shift', '19:30', '04:30', 15, 7.0, 3);
