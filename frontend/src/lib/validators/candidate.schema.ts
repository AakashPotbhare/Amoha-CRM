import { z } from "zod";

export const candidateEnrollmentSchema = z.object({
  // Personal
  full_name: z.string().min(2, "Full name is required"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Phone number is required"),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional(),
  ssn_last4: z.string().length(4, "Enter last 4 digits").optional().or(z.literal("")),

  // LinkedIn
  linkedin_url: z.string().url("Enter a valid LinkedIn URL").optional().or(z.literal("")),
  linkedin_email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  linkedin_password: z.string().optional(),

  // Visa
  visa_status: z.enum(["h1b","opt","cpt","h4_ead","l2_ead","gc","gc_ead","citizen","other"]).optional(),
  visa_expiry: z.string().optional(),
  visa_type: z.string().optional(),

  // Education
  highest_qualification: z.string().optional(),
  bachelors_university: z.string().optional(),
  bachelors_gpa: z.string().optional(),
  bachelors_year: z.string().optional(),
  bachelors_country: z.string().optional(),
  masters_university: z.string().optional(),
  masters_gpa: z.string().optional(),
  masters_year: z.string().optional(),
  masters_country: z.string().optional(),

  // Professional
  technology: z.string().min(1, "Technology/domain is required"),
  years_experience: z.coerce.number().min(0).optional(),
  security_clearance: z.string().optional(),
  is_veteran: z.boolean().optional(),

  // Location
  current_city: z.string().optional(),
  current_state: z.string().optional(),
  current_zip: z.string().optional(),
  willing_to_relocate: z.boolean().optional(),
  preferred_locations: z.string().optional(),

  // Availability
  available_from: z.string().optional(),
  work_hours_preference: z.string().optional(),
  work_authorization: z.string().optional(),

  // Salary
  expected_rate: z.coerce.number().min(0).optional(),
  pay_type: z.enum(["w2","c2c","1099"]).optional(),
});

export type CandidateEnrollmentFormData = z.infer<typeof candidateEnrollmentSchema>;
