import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import {
  Loader2, User, Shield, GraduationCap, Globe, Briefcase,
  CreditCard, Gift, DollarSign, Users,
} from "lucide-react";
import { api } from "@/lib/api.client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

import { Button }   from "@/components/ui/button";
import { Input }    from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label }    from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";

// ─── Visa types that require EAD / CPT date fields ────────────────────────────
const VISA_WITH_EAD = ["F1 OPT", "STEM OPT"];
const VISA_WITH_CPT = ["Day One CPT"];

// ─── Plan options (easily extensible) ────────────────────────────────────────
const PLAN_OPTIONS = [
  { value: "basic",    label: "Basic" },
  { value: "standard", label: "Standard" },
];

// ─── Payment portal options ───────────────────────────────────────────────────
const PAYMENT_PORTALS = [
  { value: "stripe",           label: "Stripe" },
  { value: "zelle",            label: "Zelle" },
  { value: "account_transfer", label: "Account Transfer" },
];

// ─── Zod Schema ───────────────────────────────────────────────────────────────
const enrollmentSchema = z.object({
  // Personal
  full_name:   z.string().trim().min(1, "Full name is required").max(200),
  email:       z.string().trim().email("Invalid email").max(255),
  phone:       z.string().trim().min(1, "Phone number is required").max(20),
  gender:      z.string().min(1, "Gender is required"),
  dob:         z.date({ required_error: "Date of birth is required" }),

  // Visa
  visa_status:      z.string().min(1, "Visa status is required"),
  visa_expire_date: z.date({ required_error: "Visa expiry date is required" }),
  ead_start_date:   z.date().optional(),
  ead_end_date:     z.date().optional(),

  // Location & Professional
  current_location_zip: z.string().trim().min(1, "Location with zip is required").max(500),
  current_domain:       z.string().trim().min(1, "Current domain is required").max(200),
  years_experience:     z.string().trim().min(1, "Experience is required").max(100),

  // Education
  highest_qualification: z.string().min(1, "Qualification is required"),
  masters_field:         z.string().max(200).optional(),
  masters_university:    z.string().max(200).optional(),
  masters_start_date:    z.date().optional(),
  masters_end_date:      z.date().optional(),
  bachelors_field:       z.string().trim().min(1, "Bachelor's field is required").max(200),
  bachelors_university:  z.string().trim().min(1, "Bachelor's university is required").max(200),
  bachelors_start_date:  z.date({ required_error: "Start date is required" }),
  bachelors_end_date:    z.date({ required_error: "End date is required" }),

  // General questions
  arrived_in_usa:        z.date({ required_error: "Date is required" }),
  veteran_status:        z.string().trim().min(1, "Required").max(200),
  security_clearance:    z.string().trim().min(1, "Required").max(200),
  race_ethnicity:        z.string().trim().min(1, "Required").max(200),
  nearest_metro_area:    z.string().trim().min(1, "Required").max(200),
  native_country:        z.string().trim().min(1, "Required").max(200),
  total_certifications:  z.string().trim().min(1, "Required").max(200),
  availability_for_calls:z.string().trim().min(1, "Required").max(200),
  availability_to_start: z.string().trim().min(1, "Required").max(200),
  open_for_relocation:   z.string().min(1, "Required"),
  salary_expectations:   z.string().trim().min(1, "Required").max(500),

  // Plan & Payment
  plan_type:               z.string().optional(),
  plan_price:              z.string().optional(),
  discount_amount:         z.string().optional(),
  installment_1_amount:    z.string().optional(),
  installment_1_paid_date: z.date().optional(),
  installment_2_amount:    z.string().optional(),
  installment_2_paid_date: z.date().optional(),
  next_payment_date:       z.date().optional(),
  next_payment_amount:     z.string().optional(),

  // Referral & Sales
  referred_by_name:       z.string().max(200).optional(),
  referral_bonus_amount:  z.string().optional(),
  salesperson_employee_id:z.string().min(1, "Salesperson is required"),
  lead_person_name:       z.string().max(200).optional(),

  // Payment portals (array of strings)
  payment_methods: z.array(z.string()).optional(),

  // Notes
  notes: z.string().max(2000).optional(),
});

type EnrollmentForm = z.infer<typeof enrollmentSchema>;

// ─── Months helper ────────────────────────────────────────────────────────────
const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

// ─── Reusable Day/Month/Year picker ──────────────────────────────────────────
function DatePickerField({
  field,
  disabled,
}: {
  field: any;
  disabled?: (date: Date) => boolean;
}) {
  const value: Date | undefined = field.value;
  const currentYear = new Date().getFullYear();

  const [day,   setDay]   = useState<string>(value ? String(value.getDate())       : "");
  const [month, setMonth] = useState<string>(value ? String(value.getMonth())      : "");
  const [year,  setYear]  = useState<string>(value ? String(value.getFullYear())   : "");

  useEffect(() => {
    if (!value) { setDay(""); setMonth(""); setYear(""); return; }
    setDay(String(value.getDate()));
    setMonth(String(value.getMonth()));
    setYear(String(value.getFullYear()));
  }, [value]);

  const daysInMonth = (m: number | string, y: number | string) =>
    m !== "" && y !== "" ? new Date(Number(y), Number(m) + 1, 0).getDate() : 31;

  function commitDate(nd: string, nm: string, ny: string) {
    if (!nd || !nm || !ny) return;
    const maxDay = daysInMonth(nm, ny);
    const nd2    = String(Math.min(Number(nd), maxDay));
    const date   = new Date(Number(ny), Number(nm), Number(nd2));
    if (
      date.getFullYear() !== Number(ny) ||
      date.getMonth()    !== Number(nm) ||
      date.getDate()     !== Number(nd2)
    ) return;
    if (disabled?.(date)) return;
    if (nd2 !== nd) setDay(nd2);
    field.onChange(date);
  }

  return (
    <FormControl>
      <div className="flex gap-2">
        <Select value={day}   onValueChange={v => { setDay(v);   commitDate(v, month, year);  }}>
          <SelectTrigger className="w-[80px]"><SelectValue placeholder="Day" /></SelectTrigger>
          <SelectContent>
            {Array.from({ length: daysInMonth(month, year) }, (_, i) => i + 1).map(d => (
              <SelectItem key={d} value={String(d)}>{d}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={month} onValueChange={v => { setMonth(v); commitDate(day, v, year);   }}>
          <SelectTrigger className="flex-1"><SelectValue placeholder="Month" /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => (
              <SelectItem key={i} value={String(i)}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year}  onValueChange={v => { setYear(v);  commitDate(day, month, v);  }}>
          <SelectTrigger className="w-[100px]"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            {Array.from(
              { length: currentYear + 11 - 1950 },
              (_, i) => currentYear + 10 - i,
            ).map(y => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </FormControl>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CandidateEnrollment() {
  const navigate    = useNavigate();
  const { employee }= useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [employees,  setEmployees]  = useState<{ id: string; full_name: string; role: string }[]>([]);

  // Fetch employees for salesperson dropdown
  useEffect(() => {
    api.get<any[]>('/api/employees?is_active=1&limit=200')
      .then(r => setEmployees(r.data ?? []))
      .catch(() => {});
  }, []);

  const form = useForm<EnrollmentForm>({
    resolver: zodResolver(enrollmentSchema),
    defaultValues: {
      full_name: "", email: "", phone: "", gender: "",
      visa_status: "",
      current_location_zip: "", current_domain: "", years_experience: "",
      highest_qualification: "", masters_field: "", masters_university: "",
      bachelors_field: "", bachelors_university: "",
      veteran_status: "", security_clearance: "", race_ethnicity: "",
      nearest_metro_area: "", native_country: "", total_certifications: "",
      availability_for_calls: "", availability_to_start: "",
      open_for_relocation: "", salary_expectations: "",
      plan_type: "", plan_price: "", discount_amount: "",
      installment_1_amount: "", installment_2_amount: "",
      next_payment_amount: "",
      referred_by_name: "", referral_bonus_amount: "",
      salesperson_employee_id: "", lead_person_name: "",
      payment_methods: [],
      notes: "",
    },
  });

  const visaStatus    = form.watch("visa_status");
  const qualification = form.watch("highest_qualification");
  const showMasters   = qualification === "masters_or_phd";
  const showEAD       = VISA_WITH_EAD.includes(visaStatus);
  const showCPT       = VISA_WITH_CPT.includes(visaStatus);
  const showVisaDates = showEAD || showCPT;

  const paymentMethods = form.watch("payment_methods") ?? [];

  function togglePaymentMethod(value: string) {
    const current = form.getValues("payment_methods") ?? [];
    const updated  = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    form.setValue("payment_methods", updated);
  }

  async function onSubmit(data: EnrollmentForm) {
    if (!employee) return;
    setSubmitting(true);
    try {
      await api.post('/api/candidates', {
        full_name:             data.full_name,
        email:                 data.email,
        phone:                 data.phone,
        gender:                data.gender,
        date_of_birth:         format(data.dob, "yyyy-MM-dd"),
        visa_type:             data.visa_status,
        visa_expiry:           format(data.visa_expire_date, "yyyy-MM-dd"),
        ead_start_date:        data.ead_start_date ? format(data.ead_start_date, "yyyy-MM-dd") : null,
        ead_end_date:          data.ead_end_date   ? format(data.ead_end_date,   "yyyy-MM-dd") : null,
        current_location:      data.current_location_zip,
        profession:            data.current_domain,
        experience_years:      data.years_experience,
        nearest_metro_area:    data.nearest_metro_area,
        native_country:        data.native_country,
        open_for_relocation:   data.open_for_relocation,
        veteran_status:        data.veteran_status,
        security_clearance:    data.security_clearance,
        race_ethnicity:        data.race_ethnicity,
        total_certifications:  data.total_certifications,
        highest_qualification: data.highest_qualification,
        bachelors_field:       data.bachelors_field,
        bachelors_university:  data.bachelors_university,
        bachelors_start_date:  format(data.bachelors_start_date, "yyyy-MM-dd"),
        bachelors_end_date:    format(data.bachelors_end_date,   "yyyy-MM-dd"),
        masters_field:         data.masters_field        || null,
        masters_university:    data.masters_university   || null,
        masters_start_date:    data.masters_start_date   ? format(data.masters_start_date, "yyyy-MM-dd") : null,
        masters_end_date:      data.masters_end_date     ? format(data.masters_end_date,   "yyyy-MM-dd") : null,
        availability_for_calls:data.availability_for_calls,
        availability_to_start: data.availability_to_start,
        arrived_in_usa:        format(data.arrived_in_usa, "yyyy-MM-dd"),
        salary_expectations:   data.salary_expectations,
        // Plan & Payment
        plan_type:               data.plan_type            || null,
        plan_price:              data.plan_price            ? parseFloat(data.plan_price)           : null,
        discount_amount:         data.discount_amount       ? parseFloat(data.discount_amount)      : null,
        installment_1_amount:    data.installment_1_amount  ? parseFloat(data.installment_1_amount) : null,
        installment_1_paid_date: data.installment_1_paid_date ? format(data.installment_1_paid_date, "yyyy-MM-dd") : null,
        installment_2_amount:    data.installment_2_amount  ? parseFloat(data.installment_2_amount) : null,
        installment_2_paid_date: data.installment_2_paid_date ? format(data.installment_2_paid_date, "yyyy-MM-dd") : null,
        next_payment_date:       data.next_payment_date     ? format(data.next_payment_date, "yyyy-MM-dd") : null,
        next_payment_amount:     data.next_payment_amount   ? parseFloat(data.next_payment_amount) : null,
        // Referral & Sales
        referred_by_name:        data.referred_by_name       || null,
        referral_bonus_amount:   data.referral_bonus_amount  ? parseFloat(data.referral_bonus_amount) : null,
        salesperson_employee_id: data.salesperson_employee_id,
        lead_person_name:        data.lead_person_name        || null,
        // Payment portals
        payment_methods:         data.payment_methods?.length ? data.payment_methods : null,
        notes:                   data.notes || null,
      });

      toast({ title: "Candidate enrolled", description: `${data.full_name} has been added to the pipeline.` });
      navigate("/candidates");
    } catch (err: any) {
      toast({ title: "Enrollment failed", description: err?.message ?? "Something went wrong.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }

  const sectionClass = "border border-border rounded-xl p-6 space-y-5 bg-card";

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-foreground">Candidate Enrollment</h1>
        <p className="text-muted-foreground">Fill in all details for the new candidate joining the company.</p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* ── Section 1: Personal Information ── */}
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
              <User className="w-5 h-5" /> Personal Information
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField control={form.control} name="full_name" render={({ field }) => (
                <FormItem><FormLabel>Full Name (As per ID) *</FormLabel>
                  <FormControl><Input placeholder="John Doe" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem><FormLabel>Contact Email *</FormLabel>
                  <FormControl><Input type="email" placeholder="john@example.com" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem><FormLabel>Contact Number *</FormLabel>
                  <FormControl><Input placeholder="+1 234 567 8900" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="gender" render={({ field }) => (
                <FormItem><FormLabel>Gender *</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                      <div className="flex items-center gap-2"><RadioGroupItem value="male"   id="g-m" /><Label htmlFor="g-m">Male</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="female" id="g-f" /><Label htmlFor="g-f">Female</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="other"  id="g-o" /><Label htmlFor="g-o">Other</Label></div>
                    </RadioGroup>
                  </FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="dob" render={({ field }) => (
                <FormItem><FormLabel>Date of Birth *</FormLabel>
                  <DatePickerField field={field} disabled={d => d > new Date()} />
                <FormMessage /></FormItem>
              )} />
            </div>
          </div>

          {/* ── Section 2: Visa & Location ── */}
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
              <Shield className="w-5 h-5" /> Visa & Location
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField control={form.control} name="visa_status" render={({ field }) => (
                <FormItem><FormLabel>Visa Status *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select visa status" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="F1 OPT">F1 OPT</SelectItem>
                      <SelectItem value="STEM OPT">STEM OPT</SelectItem>
                      <SelectItem value="Day One CPT">Day One CPT</SelectItem>
                      <SelectItem value="H1B">H1B</SelectItem>
                      <SelectItem value="H4 EAD">H4 EAD</SelectItem>
                      <SelectItem value="L1">L1</SelectItem>
                      <SelectItem value="L2 EAD">L2 EAD</SelectItem>
                      <SelectItem value="GC">GC</SelectItem>
                      <SelectItem value="GC EAD">GC EAD</SelectItem>
                      <SelectItem value="US Citizen">US Citizen</SelectItem>
                      <SelectItem value="TN Visa">TN Visa</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="visa_expire_date" render={({ field }) => (
                <FormItem><FormLabel>Visa Expire Date *</FormLabel>
                  <DatePickerField field={field} />
                <FormMessage /></FormItem>
              )} />

              {/* EAD dates — shown for F1 OPT and STEM OPT */}
              {showEAD && (
                <>
                  <FormField control={form.control} name="ead_start_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>EAD Start Date *</FormLabel>
                      <DatePickerField field={field} />
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="ead_end_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>EAD End Date *</FormLabel>
                      <DatePickerField field={field} />
                    <FormMessage /></FormItem>
                  )} />
                </>
              )}

              {/* CPT dates — shown for Day One CPT */}
              {showCPT && (
                <>
                  <FormField control={form.control} name="ead_start_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPT Start Date *</FormLabel>
                      <DatePickerField field={field} />
                    <FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="ead_end_date" render={({ field }) => (
                    <FormItem>
                      <FormLabel>CPT End Date *</FormLabel>
                      <DatePickerField field={field} />
                    <FormMessage /></FormItem>
                  )} />
                </>
              )}

              <FormField control={form.control} name="current_location_zip" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Full Current Location with Zip Code *</FormLabel>
                  <FormControl><Input placeholder="123 Main St, Dallas TX 75001" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="current_domain" render={({ field }) => (
                <FormItem><FormLabel>Current Domain *</FormLabel>
                  <FormControl><Input placeholder="e.g. Data Engineering" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="years_experience" render={({ field }) => (
                <FormItem><FormLabel>Genuine Years of Experience *</FormLabel>
                  <FormControl><Input placeholder="e.g. 5 years" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
            </div>
          </div>

          {/* ── Section 3: Education ── */}
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
              <GraduationCap className="w-5 h-5" /> Education Background
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField control={form.control} name="highest_qualification" render={({ field }) => (
                <FormItem><FormLabel>Highest Qualification *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="masters_or_phd">Masters or PhD</SelectItem>
                      <SelectItem value="bachelors">Bachelor's</SelectItem>
                      <SelectItem value="high_school">High School</SelectItem>
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
            </div>

            {showMasters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border mt-4">
                <p className="md:col-span-2 text-sm font-medium text-foreground">Master's / PhD Details</p>
                <FormField control={form.control} name="masters_field" render={({ field }) => (
                  <FormItem><FormLabel>Master's Degree Field *</FormLabel>
                    <FormControl><Input placeholder="Computer Science" {...field} /></FormControl>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="masters_university" render={({ field }) => (
                  <FormItem><FormLabel>University Name (Master's) *</FormLabel>
                    <FormControl><Input placeholder="MIT" {...field} /></FormControl>
                  <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="masters_start_date" render={({ field }) => (
                  <FormItem><FormLabel>Master's Start Date *</FormLabel>
                    <DatePickerField field={field} />
                  <FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="masters_end_date" render={({ field }) => (
                  <FormItem><FormLabel>Master's End Date *</FormLabel>
                    <DatePickerField field={field} />
                  <FormMessage /></FormItem>
                )} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-4 border-t border-border mt-4">
              <p className="md:col-span-2 text-sm font-medium text-foreground">Bachelor's Details</p>
              <FormField control={form.control} name="bachelors_field" render={({ field }) => (
                <FormItem><FormLabel>Bachelor's Degree Field *</FormLabel>
                  <FormControl><Input placeholder="Information Technology" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bachelors_university" render={({ field }) => (
                <FormItem><FormLabel>University Name (Bachelor's) *</FormLabel>
                  <FormControl><Input placeholder="State University" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bachelors_start_date" render={({ field }) => (
                <FormItem><FormLabel>Bachelor's Start Date *</FormLabel>
                  <DatePickerField field={field} />
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="bachelors_end_date" render={({ field }) => (
                <FormItem><FormLabel>Bachelor's End Date *</FormLabel>
                  <DatePickerField field={field} />
                <FormMessage /></FormItem>
              )} />
            </div>
          </div>

          {/* ── Section 4: General Questions ── */}
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
              <Globe className="w-5 h-5" /> General Questions
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField control={form.control} name="arrived_in_usa" render={({ field }) => (
                <FormItem><FormLabel>When arrived in USA? *</FormLabel>
                  <DatePickerField field={field} disabled={d => d > new Date()} />
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="veteran_status" render={({ field }) => (
                <FormItem><FormLabel>Veteran Status? *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="security_clearance" render={({ field }) => (
                <FormItem><FormLabel>Active Security Clearance? *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="race_ethnicity" render={({ field }) => (
                <FormItem><FormLabel>Race / Ethnicity *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {["Asian","Black or African American","Hispanic or Latino","White",
                        "Native American","Pacific Islander","Two or More Races","Prefer not to say"].map(v => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="nearest_metro_area" render={({ field }) => (
                <FormItem><FormLabel>Nearest Metropolitan Area *</FormLabel>
                  <FormControl><Input placeholder="Dallas-Fort Worth" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="native_country" render={({ field }) => (
                <FormItem><FormLabel>Native Country *</FormLabel>
                  <FormControl><Input placeholder="India" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="total_certifications" render={({ field }) => (
                <FormItem><FormLabel>Total Certifications *</FormLabel>
                  <FormControl><Input placeholder="3 (send copies via mail)" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="availability_for_calls" render={({ field }) => (
                <FormItem><FormLabel>Availability for Recruiter Calls *</FormLabel>
                  <FormControl><Input placeholder="Mon-Fri 9am-5pm EST" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="availability_to_start" render={({ field }) => (
                <FormItem><FormLabel>Availability to Start Work *</FormLabel>
                  <FormControl><Input placeholder="Immediately / 2 weeks" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="open_for_relocation" render={({ field }) => (
                <FormItem><FormLabel>Open for Relocation? *</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="flex gap-4 pt-2">
                      <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="rel-y" /><Label htmlFor="rel-y">Yes</Label></div>
                      <div className="flex items-center gap-2"><RadioGroupItem value="no"  id="rel-n" /><Label htmlFor="rel-n">No</Label></div>
                    </RadioGroup>
                  </FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="salary_expectations" render={({ field }) => (
                <FormItem className="md:col-span-2"><FormLabel>Salary Expectations (Is it negotiable?) *</FormLabel>
                  <FormControl><Input placeholder="$120k/year, negotiable" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
            </div>
          </div>

          {/* ── Section 5: Plan & Payment ── */}
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
              <DollarSign className="w-5 h-5" /> Plan &amp; Payment
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Select the plan this candidate is enrolled in and record payment details.
              Salesperson will be notified 1 day before &amp; on the day of the next payment.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Plan */}
              <FormField control={form.control} name="plan_type" render={({ field }) => (
                <FormItem><FormLabel>Enrolled Plan</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {PLAN_OPTIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="plan_price" render={({ field }) => (
                <FormItem><FormLabel>Plan Pitched Price ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="2500.00" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="discount_amount" render={({ field }) => (
                <FormItem><FormLabel>Discount Given ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="0.00" {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground">Leave 0 if no discount applied.</p>
                <FormMessage /></FormItem>
              )} />

              {/* Divider */}
              <div className="md:col-span-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Instalment Payments</p>
              </div>

              {/* Instalment 1 */}
              <FormField control={form.control} name="installment_1_amount" render={({ field }) => (
                <FormItem><FormLabel>1st Instalment Amount ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="1250.00" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="installment_1_paid_date" render={({ field }) => (
                <FormItem><FormLabel>1st Instalment Paid Date</FormLabel>
                  <DatePickerField field={field} />
                <FormMessage /></FormItem>
              )} />

              {/* Instalment 2 */}
              <FormField control={form.control} name="installment_2_amount" render={({ field }) => (
                <FormItem><FormLabel>2nd Instalment Amount ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="1250.00" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="installment_2_paid_date" render={({ field }) => (
                <FormItem><FormLabel>2nd Instalment Paid Date</FormLabel>
                  <DatePickerField field={field} />
                <FormMessage /></FormItem>
              )} />

              {/* Next payment reminder */}
              <div className="md:col-span-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Next Payment Reminder</p>
              </div>
              <FormField control={form.control} name="next_payment_date" render={({ field }) => (
                <FormItem><FormLabel>Next Payment Due Date</FormLabel>
                  <DatePickerField field={field} />
                  <p className="text-xs text-muted-foreground">Salesperson will be notified on this date &amp; 1 day prior.</p>
                <FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="next_payment_amount" render={({ field }) => (
                <FormItem><FormLabel>Next Payment Amount ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="1250.00" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />
            </div>
          </div>

          {/* ── Section 6: Payment Portal ── */}
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
              <CreditCard className="w-5 h-5" /> Payment Portal
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Select all payment methods used by this candidate. Multiple selections allowed.
            </p>
            <div className="flex flex-wrap gap-6">
              {PAYMENT_PORTALS.map(portal => (
                <label
                  key={portal.value}
                  className="flex items-center gap-3 cursor-pointer group"
                >
                  <Checkbox
                    id={`portal-${portal.value}`}
                    checked={paymentMethods.includes(portal.value)}
                    onCheckedChange={() => togglePaymentMethod(portal.value)}
                    className="w-5 h-5"
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">
                    {portal.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Section 7: Referral & Sales Info ── */}
          <div className={sectionClass}>
            <div className="flex items-center gap-2 text-primary font-semibold text-lg mb-2">
              <Gift className="w-5 h-5" /> Referral &amp; Sales Info
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

              {/* Salesperson */}
              <FormField control={form.control} name="salesperson_employee_id" render={({ field }) => (
                <FormItem><FormLabel>Salesperson (Deal Converter) *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <FormControl><SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {employees
                        .filter(e => ["sales_executive","lead_generator","director","ops_head"].includes(e.role))
                        .map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                        ))
                      }
                      {/* Fallback: show all if filtered list is empty */}
                      {employees.filter(e => ["sales_executive","lead_generator","director","ops_head"].includes(e.role)).length === 0 &&
                        employees.map(e => (
                          <SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>
                        ))
                      }
                    </SelectContent>
                  </Select>
                <FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="lead_person_name" render={({ field }) => (
                <FormItem><FormLabel>Lead Person Name <span className="text-muted-foreground text-xs">(optional)</span></FormLabel>
                  <FormControl><Input placeholder="Name of the person who brought the lead" {...field} /></FormControl>
                <FormMessage /></FormItem>
              )} />

              {/* Referral */}
              <div className="md:col-span-2 border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-3">Referral Bonus</p>
              </div>

              <FormField control={form.control} name="referred_by_name" render={({ field }) => (
                <FormItem><FormLabel>Referred By <span className="text-muted-foreground text-xs">(prior candidate name)</span></FormLabel>
                  <FormControl><Input placeholder="Jane Smith" {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground">The existing candidate who referred this person.</p>
                <FormMessage /></FormItem>
              )} />

              <FormField control={form.control} name="referral_bonus_amount" render={({ field }) => (
                <FormItem><FormLabel>Referral Bonus Amount ($)</FormLabel>
                  <FormControl><Input type="number" step="0.01" placeholder="50.00" {...field} /></FormControl>
                  <p className="text-xs text-muted-foreground">Bonus owed to the referring candidate (typically $50–$100).</p>
                <FormMessage /></FormItem>
              )} />
            </div>
          </div>

          {/* ── Notes ── */}
          <div className={sectionClass}>
            <FormField control={form.control} name="notes" render={({ field }) => (
              <FormItem><FormLabel>Additional Notes</FormLabel>
                <FormControl><Textarea placeholder="Any additional information..." rows={4} {...field} /></FormControl>
              <FormMessage /></FormItem>
            )} />
          </div>

          <div className="flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Enroll Candidate
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
