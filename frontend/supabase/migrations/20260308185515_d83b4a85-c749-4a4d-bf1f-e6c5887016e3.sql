
-- Notice board table
CREATE TABLE public.notice_board (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  notice_type text NOT NULL DEFAULT 'general',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.employees(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);

ALTER TABLE public.notice_board ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active notices" ON public.notice_board
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "HR can insert notices" ON public.notice_board
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('hr', 'director', 'ops_head')
  ));

CREATE POLICY "HR can update notices" ON public.notice_board
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('hr', 'director', 'ops_head')
  ));

CREATE POLICY "HR can delete notices" ON public.notice_board
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM employees WHERE user_id = auth.uid() AND is_active = true
      AND role IN ('hr', 'director', 'ops_head')
  ));

-- Add avatar_url to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS avatar_url text;

-- Storage bucket for avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage policies for avatars
CREATE POLICY "Authenticated users can upload avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');

CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');
