import { z } from "zod";

export const leaveRequestSchema = z.object({
  leave_type: z.enum(["paid", "unpaid", "sick", "casual"], {
    required_error: "Select a leave type",
  }),
  from_date: z.string().min(1, "Start date is required"),
  to_date: z.string().min(1, "End date is required"),
  reason: z.string().min(10, "Please provide a reason (at least 10 characters)"),
}).refine(
  (data) => new Date(data.to_date) >= new Date(data.from_date),
  { message: "End date must be on or after start date", path: ["to_date"] }
).refine(
  (data) => new Date(data.from_date) >= new Date(new Date().toISOString().split("T")[0]),
  { message: "Leave cannot be in the past", path: ["from_date"] }
);

export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;
