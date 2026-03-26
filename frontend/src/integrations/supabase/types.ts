export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      attendance_records: {
        Row: {
          attendance_status: string
          check_in_lat: number | null
          check_in_lng: number | null
          check_in_location_id: string | null
          check_in_time: string
          check_out_lat: number | null
          check_out_lng: number | null
          check_out_location_id: string | null
          check_out_time: string | null
          created_at: string
          date: string
          employee_id: string
          id: string
          is_late: boolean
          is_wfh: boolean
          shift_setting_id: string | null
          total_hours: number | null
          updated_at: string
        }
        Insert: {
          attendance_status?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_location_id?: string | null
          check_in_time?: string
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_location_id?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          employee_id: string
          id?: string
          is_late?: boolean
          is_wfh?: boolean
          shift_setting_id?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Update: {
          attendance_status?: string
          check_in_lat?: number | null
          check_in_lng?: number | null
          check_in_location_id?: string | null
          check_in_time?: string
          check_out_lat?: number | null
          check_out_lng?: number | null
          check_out_location_id?: string | null
          check_out_time?: string | null
          created_at?: string
          date?: string
          employee_id?: string
          id?: string
          is_late?: boolean
          is_wfh?: boolean
          shift_setting_id?: string | null
          total_hours?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_records_check_in_location_id_fkey"
            columns: ["check_in_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_check_out_location_id_fkey"
            columns: ["check_out_location_id"]
            isOneToOne: false
            referencedRelation: "office_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_records_shift_setting_id_fkey"
            columns: ["shift_setting_id"]
            isOneToOne: false
            referencedRelation: "shift_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_enrollments: {
        Row: {
          arrived_in_usa: string
          availability_for_calls: string
          availability_to_start: string
          bachelors_end_date: string
          bachelors_field: string
          bachelors_start_date: string
          bachelors_university: string
          candidate_id: string | null
          created_at: string
          created_by: string
          current_domain: string
          current_location_zip: string
          dob: string
          email: string
          full_name: string
          gender: string
          highest_qualification: string
          id: string
          linkedin_email: string
          linkedin_passcode: string
          marketing_email: string
          marketing_email_password: string | null
          masters_end_date: string | null
          masters_field: string | null
          masters_start_date: string | null
          masters_university: string | null
          native_country: string
          nearest_metro_area: string
          notes: string | null
          open_for_relocation: string
          phone: string
          race_ethnicity: string
          salary_expectations: string
          security_clearance: string
          ssn_last4: string
          total_certifications: string
          updated_at: string
          veteran_status: string
          visa_expire_date: string
          visa_status: string
          years_experience: string
        }
        Insert: {
          arrived_in_usa: string
          availability_for_calls: string
          availability_to_start: string
          bachelors_end_date: string
          bachelors_field: string
          bachelors_start_date: string
          bachelors_university: string
          candidate_id?: string | null
          created_at?: string
          created_by: string
          current_domain: string
          current_location_zip: string
          dob: string
          email: string
          full_name: string
          gender: string
          highest_qualification: string
          id?: string
          linkedin_email: string
          linkedin_passcode: string
          marketing_email: string
          marketing_email_password?: string | null
          masters_end_date?: string | null
          masters_field?: string | null
          masters_start_date?: string | null
          masters_university?: string | null
          native_country: string
          nearest_metro_area: string
          notes?: string | null
          open_for_relocation: string
          phone: string
          race_ethnicity: string
          salary_expectations: string
          security_clearance: string
          ssn_last4: string
          total_certifications: string
          updated_at?: string
          veteran_status: string
          visa_expire_date: string
          visa_status: string
          years_experience: string
        }
        Update: {
          arrived_in_usa?: string
          availability_for_calls?: string
          availability_to_start?: string
          bachelors_end_date?: string
          bachelors_field?: string
          bachelors_start_date?: string
          bachelors_university?: string
          candidate_id?: string | null
          created_at?: string
          created_by?: string
          current_domain?: string
          current_location_zip?: string
          dob?: string
          email?: string
          full_name?: string
          gender?: string
          highest_qualification?: string
          id?: string
          linkedin_email?: string
          linkedin_passcode?: string
          marketing_email?: string
          marketing_email_password?: string | null
          masters_end_date?: string | null
          masters_field?: string | null
          masters_start_date?: string | null
          masters_university?: string | null
          native_country?: string
          nearest_metro_area?: string
          notes?: string | null
          open_for_relocation?: string
          phone?: string
          race_ethnicity?: string
          salary_expectations?: string
          security_clearance?: string
          ssn_last4?: string
          total_certifications?: string
          updated_at?: string
          veteran_status?: string
          visa_expire_date?: string
          visa_status?: string
          years_experience?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_enrollments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_enrollments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          assigned_to_employee_id: string | null
          assigned_to_team_id: string | null
          created_at: string
          created_by: string
          email: string | null
          full_name: string
          gender: string | null
          id: string
          is_active: boolean
          phone: string | null
          technology: string | null
          updated_at: string
        }
        Insert: {
          assigned_to_employee_id?: string | null
          assigned_to_team_id?: string | null
          created_at?: string
          created_by: string
          email?: string | null
          full_name: string
          gender?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          technology?: string | null
          updated_at?: string
        }
        Update: {
          assigned_to_employee_id?: string | null
          assigned_to_team_id?: string | null
          created_at?: string
          created_by?: string
          email?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          technology?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidates_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_assigned_to_team_id_fkey"
            columns: ["assigned_to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_one: string
          participant_two: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one: string
          participant_two: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_one?: string
          participant_two?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_participant_one_fkey"
            columns: ["participant_one"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_conversations_participant_two_fkey"
            columns: ["participant_two"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          file_name: string | null
          file_url: string | null
          id: string
          is_read: boolean
          sender_id: string
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          file_name?: string | null
          file_url?: string | null
          id?: string
          is_read?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      employee_documents: {
        Row: {
          document_type: string
          employee_id: string
          file_name: string
          file_url: string
          id: string
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          document_type: string
          employee_id: string
          file_name: string
          file_url: string
          id?: string
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          document_type?: string
          employee_id?: string
          file_name?: string
          file_url?: string
          id?: string
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employee_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          avatar_url: string | null
          base_salary: number | null
          created_at: string
          current_address: string | null
          department_id: string
          designation: string | null
          dob: string | null
          email: string
          email_verified: boolean
          employee_code: string
          employment_status: string
          full_name: string
          id: string
          is_active: boolean
          joining_date: string | null
          permanent_address: string | null
          pf_percentage: number | null
          phone: string | null
          phone_verified: boolean
          professional_tax: number | null
          reporting_tl_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          team_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string
          current_address?: string | null
          department_id: string
          designation?: string | null
          dob?: string | null
          email: string
          email_verified?: boolean
          employee_code: string
          employment_status?: string
          full_name: string
          id?: string
          is_active?: boolean
          joining_date?: string | null
          permanent_address?: string | null
          pf_percentage?: number | null
          phone?: string | null
          phone_verified?: boolean
          professional_tax?: number | null
          reporting_tl_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          base_salary?: number | null
          created_at?: string
          current_address?: string | null
          department_id?: string
          designation?: string | null
          dob?: string | null
          email?: string
          email_verified?: boolean
          employee_code?: string
          employment_status?: string
          full_name?: string
          id?: string
          is_active?: boolean
          joining_date?: string | null
          permanent_address?: string | null
          pf_percentage?: number | null
          phone?: string | null
          phone_verified?: boolean
          professional_tax?: number | null
          reporting_tl_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          team_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_reporting_tl_id_fkey"
            columns: ["reporting_tl_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_balances: {
        Row: {
          created_at: string
          employee_id: string
          id: string
          month: number
          paid_leave_credited: number
          paid_leave_used: number
          unpaid_leave_used: number
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          employee_id: string
          id?: string
          month?: number
          paid_leave_credited?: number
          paid_leave_used?: number
          unpaid_leave_used?: number
          updated_at?: string
          year?: number
        }
        Update: {
          created_at?: string
          employee_id?: string
          id?: string
          month?: number
          paid_leave_credited?: number
          paid_leave_used?: number
          unpaid_leave_used?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_balances_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_by_manager: string | null
          approved_by_manager_at: string | null
          approved_by_tl: string | null
          approved_by_tl_at: string | null
          created_at: string
          employee_id: string
          end_date: string
          id: string
          leave_type: Database["public"]["Enums"]["leave_type"]
          reason: string | null
          rejected_by: string | null
          rejection_reason: string | null
          start_date: string
          status: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at: string
        }
        Insert: {
          approved_by_manager?: string | null
          approved_by_manager_at?: string | null
          approved_by_tl?: string | null
          approved_by_tl_at?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days: number
          updated_at?: string
        }
        Update: {
          approved_by_manager?: string | null
          approved_by_manager_at?: string | null
          approved_by_tl?: string | null
          approved_by_tl_at?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          id?: string
          leave_type?: Database["public"]["Enums"]["leave_type"]
          reason?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["leave_status"]
          total_days?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_approved_by_manager_fkey"
            columns: ["approved_by_manager"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_approved_by_tl_fkey"
            columns: ["approved_by_tl"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notice_board: {
        Row: {
          body: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          notice_type: string
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notice_type?: string
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          notice_type?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notice_board_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          is_read: boolean
          recipient_employee_id: string
          support_task_id: string | null
          title: string
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_employee_id: string
          support_task_id?: string | null
          title: string
          type?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          recipient_employee_id?: string
          support_task_id?: string | null
          title?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_recipient_employee_id_fkey"
            columns: ["recipient_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_support_task_id_fkey"
            columns: ["support_task_id"]
            isOneToOne: false
            referencedRelation: "support_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      office_locations: {
        Row: {
          address: string
          created_at: string
          id: string
          is_active: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters: number
        }
        Insert: {
          address: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude: number
          longitude: number
          name: string
          radius_meters?: number
        }
        Update: {
          address?: string
          created_at?: string
          id?: string
          is_active?: boolean
          latitude?: number
          longitude?: number
          name?: string
          radius_meters?: number
        }
        Relationships: []
      }
      salary_history: {
        Row: {
          changed_by: string
          created_at: string
          effective_date: string
          employee_id: string
          id: string
          new_pf_percentage: number | null
          new_professional_tax: number | null
          new_salary: number
          previous_pf_percentage: number | null
          previous_professional_tax: number | null
          previous_salary: number
          reason: string | null
        }
        Insert: {
          changed_by: string
          created_at?: string
          effective_date?: string
          employee_id: string
          id?: string
          new_pf_percentage?: number | null
          new_professional_tax?: number | null
          new_salary?: number
          previous_pf_percentage?: number | null
          previous_professional_tax?: number | null
          previous_salary?: number
          reason?: string | null
        }
        Update: {
          changed_by?: string
          created_at?: string
          effective_date?: string
          employee_id?: string
          id?: string
          new_pf_percentage?: number | null
          new_professional_tax?: number | null
          new_salary?: number
          previous_pf_percentage?: number | null
          previous_professional_tax?: number | null
          previous_salary?: number
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "salary_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "salary_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      shift_settings: {
        Row: {
          created_at: string
          created_by: string | null
          end_time: string
          grace_period_minutes: number
          id: string
          is_active: boolean
          max_late_per_month: number
          name: string
          required_hours: number
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          max_late_per_month?: number
          name?: string
          required_hours?: number
          start_time?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          end_time?: string
          grace_period_minutes?: number
          id?: string
          is_active?: boolean
          max_late_per_month?: number
          name?: string
          required_hours?: number
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shift_settings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tasks: {
        Row: {
          assigned_to_department_id: string | null
          assigned_to_employee_id: string | null
          assigned_to_team_id: string | null
          call_status: string | null
          candidate_id: string
          company_name: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          deadline_date: string | null
          end_time: string | null
          feedback: string | null
          id: string
          interview_round: Database["public"]["Enums"]["interview_round"] | null
          job_description: string | null
          link_sent_at: string | null
          notes: string | null
          preferred_handler_id: string | null
          priority: string
          questions_asked: string | null
          scheduled_date: string | null
          start_time: string | null
          status: string
          support_person_id: string | null
          task_type: Database["public"]["Enums"]["support_task_type"]
          teams_link: string | null
          updated_at: string
          willing_for_support: boolean
        }
        Insert: {
          assigned_to_department_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_team_id?: string | null
          call_status?: string | null
          candidate_id: string
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          deadline_date?: string | null
          end_time?: string | null
          feedback?: string | null
          id?: string
          interview_round?:
            | Database["public"]["Enums"]["interview_round"]
            | null
          job_description?: string | null
          link_sent_at?: string | null
          notes?: string | null
          preferred_handler_id?: string | null
          priority?: string
          questions_asked?: string | null
          scheduled_date?: string | null
          start_time?: string | null
          status?: string
          support_person_id?: string | null
          task_type: Database["public"]["Enums"]["support_task_type"]
          teams_link?: string | null
          updated_at?: string
          willing_for_support?: boolean
        }
        Update: {
          assigned_to_department_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_team_id?: string | null
          call_status?: string | null
          candidate_id?: string
          company_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          deadline_date?: string | null
          end_time?: string | null
          feedback?: string | null
          id?: string
          interview_round?:
            | Database["public"]["Enums"]["interview_round"]
            | null
          job_description?: string | null
          link_sent_at?: string | null
          notes?: string | null
          preferred_handler_id?: string | null
          priority?: string
          questions_asked?: string | null
          scheduled_date?: string | null
          start_time?: string | null
          status?: string
          support_person_id?: string | null
          task_type?: Database["public"]["Enums"]["support_task_type"]
          teams_link?: string | null
          updated_at?: string
          willing_for_support?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "support_tasks_assigned_to_department_id_fkey"
            columns: ["assigned_to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tasks_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tasks_assigned_to_team_id_fkey"
            columns: ["assigned_to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tasks_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tasks_preferred_handler_id_fkey"
            columns: ["preferred_handler_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_tasks_support_person_id_fkey"
            columns: ["support_person_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          employee_id: string
          id: string
          support_task_id: string
        }
        Insert: {
          content: string
          created_at?: string
          employee_id: string
          id?: string
          support_task_id: string
        }
        Update: {
          content?: string
          created_at?: string
          employee_id?: string
          id?: string
          support_task_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_support_task_id_fkey"
            columns: ["support_task_id"]
            isOneToOne: false
            referencedRelation: "support_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to_department_id: string | null
          assigned_to_employee_id: string | null
          assigned_to_team_id: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          description: string | null
          due_date: string | null
          id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assigned_to_department_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_team_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assigned_to_department_id?: string | null
          assigned_to_employee_id?: string | null
          assigned_to_team_id?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_department_id_fkey"
            columns: ["assigned_to_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_employee_id_fkey"
            columns: ["assigned_to_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_assigned_to_team_id_fkey"
            columns: ["assigned_to_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_current_employee_department_id: { Args: never; Returns: string }
      get_current_employee_id: { Args: never; Returns: string }
      get_email_by_employee_code: { Args: { p_code: string }; Returns: string }
      get_or_create_leave_balance: {
        Args: { p_employee_id: string }
        Returns: {
          created_at: string
          employee_id: string
          id: string
          month: number
          paid_leave_credited: number
          paid_leave_used: number
          unpaid_leave_used: number
          updated_at: string
          year: number
        }
        SetofOptions: {
          from: "*"
          to: "leave_balances"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      is_employee_in_probation: {
        Args: { p_employee_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "director"
        | "ops_head"
        | "hr_head"
        | "sales_manager"
        | "dept_head"
        | "team_lead"
        | "senior_recruiter"
        | "recruiter"
        | "resume_builder"
      interview_round:
        | "screening"
        | "phone_call"
        | "1st_round"
        | "2nd_round"
        | "3rd_round"
        | "final_round"
      leave_status: "pending" | "approved_by_tl" | "approved" | "rejected"
      leave_type: "paid" | "unpaid" | "half_day"
      support_task_type:
        | "interview_support"
        | "assessment_support"
        | "ruc"
        | "mock_call"
        | "preparation_call"
        | "resume_building"
        | "resume_rebuilding"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "director",
        "ops_head",
        "hr_head",
        "sales_manager",
        "dept_head",
        "team_lead",
        "senior_recruiter",
        "recruiter",
        "resume_builder",
      ],
      interview_round: [
        "screening",
        "phone_call",
        "1st_round",
        "2nd_round",
        "3rd_round",
        "final_round",
      ],
      leave_status: ["pending", "approved_by_tl", "approved", "rejected"],
      leave_type: ["paid", "unpaid", "half_day"],
      support_task_type: [
        "interview_support",
        "assessment_support",
        "ruc",
        "mock_call",
        "preparation_call",
        "resume_building",
        "resume_rebuilding",
      ],
    },
  },
} as const
