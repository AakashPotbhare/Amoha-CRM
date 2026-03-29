// ─── Role & Org Types ────────────────────────────────────────────────────────

export type EmployeeRole =
  | 'director'
  | 'ops_head'
  | 'hr_head'
  | 'sales_head'
  | 'technical_head'
  | 'marketing_tl'
  | 'resume_head'
  | 'compliance_officer'
  | 'assistant_tl'
  | 'sales_executive'
  | 'lead_generator'
  | 'technical_executive'
  | 'senior_recruiter'
  | 'recruiter'
  | 'resume_builder';

export type DepartmentSlug = 'sales' | 'resume' | 'marketing' | 'technical' | 'compliance';

// ─── Candidate Pipeline ──────────────────────────────────────────────────────

export type CandidatePipelineStage =
  | 'enrolled'
  | 'resume_building'
  | 'marketing_active'
  | 'interview_stage'
  | 'placed'
  | 'rejected';

export type CandidateVisaStatus =
  | 'h1b'
  | 'opt'
  | 'cpt'
  | 'h4_ead'
  | 'l2_ead'
  | 'gc'
  | 'gc_ead'
  | 'citizen'
  | 'other';

export type PayType = 'w2' | 'c2c' | '1099';

export interface CandidateEnrollment {
  id: string;
  pipeline_stage: CandidatePipelineStage;
  // Personal
  full_name: string;
  email: string;
  phone: string;
  dob?: string;
  gender?: string;
  // Visa
  visa_status?: CandidateVisaStatus;
  visa_expiry?: string;
  visa_type?: string;
  // Education
  highest_qualification?: string;
  // Professional
  technology?: string;
  years_experience?: number;
  // Location
  current_city?: string;
  current_state?: string;
  // Salary
  expected_rate?: number;
  pay_type?: PayType;
  // Meta
  enrolled_by_employee_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineStats {
  enrolled: number;
  resume_building: number;
  marketing_active: number;
  interview_stage: number;
  placed: number;
  rejected: number;
  total: number;
}

// ─── Support Tasks ───────────────────────────────────────────────────────────

export type SupportTaskType =
  | 'interview_support'
  | 'assessment_support'
  | 'ruc'
  | 'mock_call'
  | 'preparation_call'
  | 'resume_building'
  | 'resume_rebuilding';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type CallStatus = 'not_started' | 'link_sent' | 'completed';

export interface SupportTask {
  id: string;
  task_type: SupportTaskType;
  status: TaskStatus;
  priority: TaskPriority;
  call_status: CallStatus;
  candidate_enrollment_id?: string;
  candidate_name?: string;
  company_name?: string;
  interview_round?: string;
  teams_link?: string;
  feedback?: string;
  questions_asked?: string;
  scheduled_at?: string;
  due_date?: string;
  assigned_to_employee_id?: string;
  department_id?: string;
  team_id?: string;
  created_by_employee_id: string;
  created_at: string;
  updated_at: string;
}

export interface TaskComment {
  id: string;
  task_id?: string;
  support_task_id?: string;
  employee_id: string;
  content: string;
  created_at: string;
}

// ─── General Tasks ───────────────────────────────────────────────────────────

export interface GeneralTask {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  status: TaskStatus;
  due_date?: string;
  assigned_to_employee_id?: string;
  assigned_to_team_id?: string;
  assigned_to_department_id?: string;
  created_by_employee_id: string;
  created_at: string;
  updated_at: string;
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export type AttendanceStatus =
  | 'present'
  | 'late'
  | 'wfh'
  | 'half_day'
  | 'absent'
  | 'holiday';

export interface AttendanceRecord {
  id: string;
  employee_id: string;
  date: string;
  check_in_time: string;
  check_out_time?: string;
  check_in_lat?: number;
  check_in_lng?: number;
  check_out_lat?: number;
  check_out_lng?: number;
  is_wfh: boolean;
  is_late: boolean;
  attendance_status: AttendanceStatus;
  total_hours?: number;
  shift_setting_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceBreak {
  id: string;
  attendance_record_id: string;
  break_number: number;
  break_type: 'short_break' | 'lunch';
  break_start: string;
  break_end?: string;
  duration_minutes?: number;
}

// ─── Leave Management ────────────────────────────────────────────────────────

export type LeaveType = 'paid' | 'unpaid' | 'sick' | 'casual';
export type LeaveStatus = 'pending' | 'tl_approved' | 'approved' | 'rejected' | 'cancelled';

export interface LeaveRequest {
  id: string;
  employee_id: string;
  leave_type: LeaveType;
  from_date: string;
  to_date: string;
  reason: string;
  status: LeaveStatus;
  approved_by_tl?: string;
  approved_by_manager?: string;
  tl_approved_at?: string;
  manager_approved_at?: string;
  rejection_reason?: string;
  created_at: string;
}

export interface LeaveBalance {
  id: string;
  employee_id: string;
  year: number;
  paid_leave_credited: number;
  paid_leave_used: number;
  unpaid_leave_used: number;
}

// ─── Employee / HR ───────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  user_id?: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone?: string;
  dob?: string;
  designation?: string;
  department_id: string;
  team_id: string;
  role: EmployeeRole;
  is_active: boolean;
  joining_date?: string;
  avatar_url?: string;
  base_salary?: number;
  pf_percentage?: number;
  professional_tax?: number;
  departments?: { name: string; slug: string };
  teams?: { name: string };
}

export interface SalaryHistory {
  id: string;
  employee_id: string;
  previous_salary: number;
  new_salary: number;
  effective_date: string;
  reason?: string;
  changed_by_employee_id?: string;
  created_at: string;
}

export interface HRNotice {
  id: string;
  title: string;
  content: string;
  created_by_employee_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Shift & Location ────────────────────────────────────────────────────────

export interface ShiftSetting {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  required_hours: number;
  max_late_per_month: number;
  is_active: boolean;
}

export interface OfficeLocation {
  id: string;
  name: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}
