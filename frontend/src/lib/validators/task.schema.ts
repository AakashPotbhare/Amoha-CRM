import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  due_date: z.string().optional(),
  assigned_to_employee_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to_team_id: z.string().uuid().optional().or(z.literal("")),
  assigned_to_department_id: z.string().uuid().optional().or(z.literal("")),
}).refine(
  (data) =>
    !!data.assigned_to_employee_id ||
    !!data.assigned_to_team_id ||
    !!data.assigned_to_department_id,
  { message: "Assign the task to at least one person, team, or department", path: ["assigned_to_employee_id"] }
);

export const createSupportTaskSchema = z.object({
  task_type: z.enum([
    "interview_support",
    "assessment_support",
    "ruc",
    "mock_call",
    "preparation_call",
    "resume_building",
    "resume_rebuilding",
  ]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  candidate_enrollment_id: z.string().uuid("Select a candidate").optional().or(z.literal("")),
  candidate_name: z.string().min(1, "Candidate name is required"),
  company_name: z.string().optional(),
  interview_round: z.string().optional(),
  scheduled_at: z.string().optional(),
  due_date: z.string().optional(),
  assigned_to_employee_id: z.string().uuid("Select an assignee").optional().or(z.literal("")),
  department_id: z.string().uuid("Department is required"),
  team_id: z.string().uuid().optional().or(z.literal("")),
});

export type CreateTaskFormData = z.infer<typeof createTaskSchema>;
export type CreateSupportTaskFormData = z.infer<typeof createSupportTaskSchema>;
