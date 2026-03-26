
-- Add 'hr' to app_role enum (separate transaction)
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'hr';
-- Add 'half_day' to leave_type enum
ALTER TYPE public.leave_type ADD VALUE IF NOT EXISTS 'half_day';
