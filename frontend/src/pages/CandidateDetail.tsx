import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import {
  ArrowLeft, Pencil, Save, X, Trash2, Loader2, ShieldCheck,
  User, GraduationCap, CreditCard, Megaphone, Clock, ExternalLink,
  Phone, Mail, MapPin, Globe, Briefcase,
} from "lucide-react";
import { api } from "@/lib/api.client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ─── Types ────────────────────────────────────────────────────────────────────

type Candidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  dob: string | null;

  // Visa
  visa_status: string | null;
  visa_expire_date: string | null;
  ead_start_date: string | null;
  ead_end_date: string | null;

  // Location & Professional
  current_location_zip: string | null;
  nearest_metro_area: string | null;
  open_for_relocation: string | null;
  native_country: string | null;
  current_domain: string | null;
  years_experience: string | null;
  arrived_in_usa: string | null;

  // General
  veteran_status: string | null;
  security_clearance: string | null;
  race_ethnicity: string | null;
  total_certifications: string | null;
  availability_for_calls: string | null;
  availability_to_start: string | null;
  salary_expectations: string | null;
  notes: string | null;

  // Education
  highest_qualification: string | null;
  bachelors_field: string | null;
  bachelors_university: string | null;
  bachelors_start_date: string | null;
  bachelors_end_date: string | null;
  masters_field: string | null;
  masters_university: string | null;
  masters_start_date: string | null;
  masters_end_date: string | null;

  // Plan & Payment
  plan_type: string | null;
  plan_price: string | null;
  discount_amount: string | null;
  installment_1_amount: string | null;
  installment_1_paid_date: string | null;
  installment_2_amount: string | null;
  installment_2_paid_date: string | null;
  next_payment_date: string | null;
  next_payment_amount: string | null;
  payment_methods: string | null;

  // Referral & Sales
  referred_by_name: string | null;
  referral_bonus_amount: string | null;
  salesperson_employee_id: string | null;
  salesperson_name: string | null;
  lead_person_name: string | null;
  enrolled_by_name: string | null;

  // Marketing credentials (role-gated)
  linkedin_email?: string | null;
  linkedin_passcode?: string | null;
  marketing_email?: string | null;
  marketing_email_password?: string | null;
  ssn_last4?: string | null;

  // Marketing status
  marketing_status: string | null;
  marketing_name: string | null;
  marketing_linkedin_url: string | null;
  visa_portal_username: string | null;

  // Pipeline
  pipeline_stage: string | null;

  // Counts
  interview_count: number;
  completed_interview_count: number;
  resume_update_count: number;
  current_resume_url: string | null;
  current_resume_name: string | null;

  // Timestamps
  enrolled_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SupportTask = {
  id: string;
  task_type: string;
  status: string;
  company_name: string | null;
  interview_round: string | null;
  scheduled_at: string | null;
  assignee_name: string | null;
  feedback: string | null;
};

type PlacementOrder = {
  id: string;
  company_name: string | null;
  status: string | null;
  offer_date: string | null;
  start_date: string | null;
  bill_rate: string | null;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STAGES = [
  "enrolled",
  "resume_building",
  "marketing_active",
  "interview_stage",
  "placed",
  "rejected",
] as const;

const STAGE_LABELS: Record<string, string> = {
  enrolled: "Enrolled",
  resume_building: "Resume Build",
  marketing_active: "Marketing",
  interview_stage: "Interviews",
  placed: "Placed",
  rejected: "Rejected",
};

const STAGE_COLORS: Record<string, string> = {
  enrolled: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  resume_building: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  marketing_active: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  interview_stage: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  placed: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300",
};

const MARKETING_STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  inactive: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  paused: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  placed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

const PROFILE_EDIT_ROLES = ["director", "hr_head", "sales_head", "assistant_tl", "sales_executive"];
const CREDENTIAL_VIEW_ROLES = ["director", "hr_head", "marketing_tl", "recruiter", "senior_recruiter"];
const DELETE_ROLES = ["director", "hr_head"];

const VISA_WITH_EAD = ["F1 OPT", "STEM OPT"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function nice(value: string | null | undefined): string {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function fmt(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function parsePaymentMethods(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return typeof raw === "string" ? [raw] : [];
  }
}

// ─── Skeleton loader ──────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6 p-3 md:p-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-32" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-12 w-2/3" />
        <Skeleton className="h-6 w-1/3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
      </div>
    </div>
  );
}

// ─── Read-only field row ───────────────────────────────────────────────────────

function FieldRow({
  label,
  value,
  editing,
  editNode,
}: {
  label: string;
  value: React.ReactNode;
  editing?: boolean;
  editNode?: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">{label}</p>
      {editing && editNode ? editNode : <p className="text-sm font-medium text-foreground">{value || "-"}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CandidateDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { employee } = useAuth();
  const { toast } = useToast();

  const role = employee?.role ?? "";
  const canEditProfile = PROFILE_EDIT_ROLES.includes(role);
  const canViewCredentials = CREDENTIAL_VIEW_ROLES.includes(role);
  const canDelete = DELETE_ROLES.includes(role);

  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [supportTasks, setSupportTasks] = useState<SupportTask[]>([]);
  const [placements, setPlacements] = useState<PlacementOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Partial<Candidate>>({});
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    if (!id) return;
    setLoading(true);
    setNotFound(false);
    try {
      const [candidateRes, tasksRes, placementsRes] = await Promise.allSettled([
        api.get<Candidate>(`/api/candidates/${id}`),
        api.get<SupportTask[]>(`/api/support-tasks?candidate_id=${id}&limit=100`),
        api.get<PlacementOrder[]>(`/api/placement-orders?candidate_id=${id}&limit=50`),
      ]);

      if (candidateRes.status === "fulfilled") {
        const c = candidateRes.value.data;
        setCandidate(c);
        setForm(c ?? {});
      } else {
        const errMsg = (candidateRes.reason as Error)?.message ?? "";
        if (errMsg.toLowerCase().includes("not found") || errMsg.includes("404")) {
          setNotFound(true);
        } else {
          toast({ title: "Failed to load candidate", description: errMsg, variant: "destructive" });
        }
      }

      if (tasksRes.status === "fulfilled") {
        const data = tasksRes.value.data;
        setSupportTasks(Array.isArray(data) ? data : []);
      }

      if (placementsRes.status === "fulfilled") {
        const data = placementsRes.value.data;
        setPlacements(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  function startEdit() {
    if (candidate) setForm({ ...candidate });
    setEditing(true);
  }

  function cancelEdit() {
    if (candidate) setForm({ ...candidate });
    setEditing(false);
  }

  async function saveChanges() {
    if (!candidate || !id) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {};
      const editableKeys: (keyof Candidate)[] = [
        "full_name", "email", "phone", "gender", "dob",
        "visa_status", "visa_expire_date", "ead_start_date", "ead_end_date",
        "current_location_zip", "nearest_metro_area", "open_for_relocation", "native_country",
        "current_domain", "years_experience", "arrived_in_usa",
        "veteran_status", "security_clearance", "race_ethnicity", "total_certifications",
        "highest_qualification",
        "bachelors_field", "bachelors_university", "bachelors_start_date", "bachelors_end_date",
        "masters_field", "masters_university", "masters_start_date", "masters_end_date",
        "availability_for_calls", "availability_to_start", "salary_expectations", "notes",
        "plan_type", "plan_price", "discount_amount",
        "installment_1_amount", "installment_1_paid_date",
        "installment_2_amount", "installment_2_paid_date",
        "next_payment_date", "next_payment_amount",
        "referred_by_name", "referral_bonus_amount",
        "salesperson_employee_id", "lead_person_name",
        "pipeline_stage",
      ];
      for (const key of editableKeys) {
        if (form[key] !== candidate[key]) {
          payload[key] = form[key] ?? null;
        }
      }
      if (Object.keys(payload).length === 0) {
        toast({ title: "No changes to save" });
        setEditing(false);
        return;
      }
      const res = await api.patch<Candidate>(`/api/candidates/${id}`, payload);
      setCandidate(res.data);
      setForm(res.data ?? {});
      setEditing(false);
      toast({ title: "Candidate updated successfully" });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    setDeleting(true);
    try {
      await api.delete(`/api/candidates/${id}`);
      toast({ title: "Candidate deleted" });
      navigate("/candidates");
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  function setField(key: keyof Candidate, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ─── Loading / error states ────────────────────────────────────────────────

  if (loading) return <DetailSkeleton />;

  if (notFound || !candidate) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="rounded-full bg-muted p-4">
          <User className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold">Candidate Not Found</h2>
        <p className="text-sm text-muted-foreground">
          The candidate you are looking for does not exist or may have been removed.
        </p>
        <Button asChild variant="outline">
          <Link to="/candidates">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Candidates
          </Link>
        </Button>
      </div>
    );
  }

  const stageBadgeClass = STAGE_COLORS[candidate.pipeline_stage ?? "enrolled"] ?? "bg-gray-100 text-gray-700";
  const marketingBadgeClass = MARKETING_STATUS_COLORS[candidate.marketing_status ?? "inactive"] ?? "bg-gray-100 text-gray-700";
  const paymentMethods = parsePaymentMethods(candidate.payment_methods);
  const showEadFields = VISA_WITH_EAD.includes(candidate.visa_status ?? "");

  return (
    <div className="space-y-6 p-3 md:p-6 max-w-5xl mx-auto">
      {/* Back link */}
      <Link
        to="/candidates"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Candidates
      </Link>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-border/60 bg-card p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* Name + badges */}
          <div className="space-y-2 min-w-0">
            <h1 className="text-2xl md:text-3xl font-bold leading-tight text-foreground">
              {editing ? (
                <Input
                  value={form.full_name ?? ""}
                  onChange={(e) => setField("full_name", e.target.value)}
                  className="text-2xl font-bold h-auto py-1"
                />
              ) : (
                candidate.full_name
              )}
            </h1>
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${stageBadgeClass}`}>
                {STAGE_LABELS[candidate.pipeline_stage ?? "enrolled"] ?? nice(candidate.pipeline_stage)}
              </span>
              {candidate.marketing_status && (
                <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${marketingBadgeClass}`}>
                  Marketing: {nice(candidate.marketing_status)}
                </span>
              )}
            </div>
          </div>

          {/* Edit / Save / Cancel buttons */}
          <div className="flex shrink-0 items-center gap-2">
            {editing ? (
              <>
                <Button size="sm" onClick={() => void saveChanges()} disabled={saving}>
                  {saving ? (
                    <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Saving...</>
                  ) : (
                    <><Save className="mr-1.5 h-3.5 w-3.5" />Save Changes</>
                  )}
                </Button>
                <Button size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="mr-1.5 h-3.5 w-3.5" />Cancel
                </Button>
              </>
            ) : canEditProfile ? (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" />Edit
              </Button>
            ) : null}
          </div>
        </div>

        {/* Quick-info strip */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{candidate.current_location_zip || "Location not set"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Briefcase className="h-4 w-4 shrink-0" />
            <span className="truncate">{candidate.current_domain || "Domain not set"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{candidate.email || "-"}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Phone className="h-4 w-4 shrink-0" />
            <span className="truncate">{candidate.phone || "-"}</span>
          </div>
        </div>

        {/* LinkedIn / Skype */}
        {candidate.marketing_linkedin_url && (
          <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
            <Globe className="h-4 w-4 shrink-0" />
            <a
              href={candidate.marketing_linkedin_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline flex items-center gap-1 truncate"
            >
              LinkedIn Profile <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>

      {/* ── Stats row ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Interviews", `${candidate.completed_interview_count}/${candidate.interview_count}`],
          ["Resume Updates", String(candidate.resume_update_count)],
          ["Visa Status", candidate.visa_status || "-"],
          ["Experience", candidate.years_experience ? `${candidate.years_experience} yrs` : "-"],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className="text-xs text-muted-foreground uppercase tracking-[0.15em]">{label}</p>
              <p className="mt-1 font-semibold text-foreground truncate">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <Tabs defaultValue="personal" className="w-full">
        <TabsList className="flex h-auto flex-wrap gap-1 p-1">
          <TabsTrigger value="personal" className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5" />Personal
          </TabsTrigger>
          <TabsTrigger value="education" className="flex items-center gap-1.5">
            <GraduationCap className="h-3.5 w-3.5" />Education
          </TabsTrigger>
          <TabsTrigger value="payment" className="flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" />Enrollment & Payment
          </TabsTrigger>
          {canViewCredentials && (
            <TabsTrigger value="marketing" className="flex items-center gap-1.5">
              <Megaphone className="h-3.5 w-3.5" />Marketing Access
            </TabsTrigger>
          )}
          <TabsTrigger value="timeline" className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />Timeline
          </TabsTrigger>
        </TabsList>

        {/* ── Personal Info ──────────────────────────────────────────────── */}
        <TabsContent value="personal" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <User className="h-4 w-4" /> Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Date of Birth" value={fmt(candidate.dob)} editing={editing}
                editNode={<Input type="date" value={form.dob?.slice(0, 10) ?? ""} onChange={(e) => setField("dob", e.target.value)} />}
              />
              <FieldRow label="Gender" value={nice(candidate.gender)} editing={editing}
                editNode={
                  <Select value={form.gender ?? ""} onValueChange={(v) => setField("gender", v)}>
                    <SelectTrigger><SelectValue placeholder="Select gender" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="male">Male</SelectItem>
                      <SelectItem value="female">Female</SelectItem>
                      <SelectItem value="non_binary">Non-binary</SelectItem>
                      <SelectItem value="prefer_not_to_say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <FieldRow label="Location (City / ZIP)" value={candidate.current_location_zip} editing={editing}
                editNode={<Input value={form.current_location_zip ?? ""} onChange={(e) => setField("current_location_zip", e.target.value)} />}
              />
              <FieldRow label="Nearest Metro Area" value={candidate.nearest_metro_area} editing={editing}
                editNode={<Input value={form.nearest_metro_area ?? ""} onChange={(e) => setField("nearest_metro_area", e.target.value)} />}
              />
              <FieldRow label="Native Country" value={candidate.native_country} editing={editing}
                editNode={<Input value={form.native_country ?? ""} onChange={(e) => setField("native_country", e.target.value)} />}
              />
              <FieldRow label="Open to Relocate" value={nice(candidate.open_for_relocation)} editing={editing}
                editNode={
                  <Select value={form.open_for_relocation ?? ""} onValueChange={(v) => setField("open_for_relocation", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Yes</SelectItem>
                      <SelectItem value="no">No</SelectItem>
                      <SelectItem value="maybe">Maybe</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <FieldRow label="Arrived in USA" value={fmt(candidate.arrived_in_usa)} editing={editing}
                editNode={<Input type="date" value={form.arrived_in_usa?.slice(0, 10) ?? ""} onChange={(e) => setField("arrived_in_usa", e.target.value)} />}
              />
              <FieldRow label="Race / Ethnicity" value={candidate.race_ethnicity} editing={editing}
                editNode={<Input value={form.race_ethnicity ?? ""} onChange={(e) => setField("race_ethnicity", e.target.value)} />}
              />
              <FieldRow label="Veteran Status" value={candidate.veteran_status} editing={editing}
                editNode={<Input value={form.veteran_status ?? ""} onChange={(e) => setField("veteran_status", e.target.value)} />}
              />
              <FieldRow label="Security Clearance" value={candidate.security_clearance} editing={editing}
                editNode={<Input value={form.security_clearance ?? ""} onChange={(e) => setField("security_clearance", e.target.value)} />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="h-4 w-4" /> Professional
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Current Domain" value={candidate.current_domain} editing={editing}
                editNode={<Input value={form.current_domain ?? ""} onChange={(e) => setField("current_domain", e.target.value)} />}
              />
              <FieldRow label="Years of US IT Experience" value={candidate.years_experience} editing={editing}
                editNode={<Input value={form.years_experience ?? ""} onChange={(e) => setField("years_experience", e.target.value)} />}
              />
              <FieldRow label="Total Certifications" value={candidate.total_certifications} editing={editing}
                editNode={<Input value={form.total_certifications ?? ""} onChange={(e) => setField("total_certifications", e.target.value)} />}
              />
              <FieldRow label="Availability for Calls" value={candidate.availability_for_calls} editing={editing}
                editNode={<Input value={form.availability_for_calls ?? ""} onChange={(e) => setField("availability_for_calls", e.target.value)} />}
              />
              <FieldRow label="Availability to Start" value={candidate.availability_to_start} editing={editing}
                editNode={<Input value={form.availability_to_start ?? ""} onChange={(e) => setField("availability_to_start", e.target.value)} />}
              />
              <FieldRow label="Salary Expectations" value={candidate.salary_expectations} editing={editing}
                editNode={<Input value={form.salary_expectations ?? ""} onChange={(e) => setField("salary_expectations", e.target.value)} />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" /> Visa Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Visa Status" value={candidate.visa_status} editing={editing}
                editNode={<Input value={form.visa_status ?? ""} onChange={(e) => setField("visa_status", e.target.value)} />}
              />
              <FieldRow label="Visa Expiry Date" value={fmt(candidate.visa_expire_date)} editing={editing}
                editNode={<Input type="date" value={form.visa_expire_date?.slice(0, 10) ?? ""} onChange={(e) => setField("visa_expire_date", e.target.value)} />}
              />
              {(showEadFields || (editing && VISA_WITH_EAD.includes(form.visa_status ?? ""))) && (
                <>
                  <FieldRow label="EAD Start Date" value={fmt(candidate.ead_start_date)} editing={editing}
                    editNode={<Input type="date" value={form.ead_start_date?.slice(0, 10) ?? ""} onChange={(e) => setField("ead_start_date", e.target.value)} />}
                  />
                  <FieldRow label="EAD End Date" value={fmt(candidate.ead_end_date)} editing={editing}
                    editNode={<Input type="date" value={form.ead_end_date?.slice(0, 10) ?? ""} onChange={(e) => setField("ead_end_date", e.target.value)} />}
                  />
                </>
              )}
            </CardContent>
          </Card>

          {editing && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Pipeline Stage</CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={form.pipeline_stage ?? "enrolled"} onValueChange={(v) => setField("pipeline_stage", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              {editing ? (
                <Textarea
                  rows={4}
                  value={form.notes ?? ""}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Add notes about this candidate..."
                />
              ) : (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {candidate.notes || <span className="text-muted-foreground">No notes recorded.</span>}
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Education ─────────────────────────────────────────────────── */}
        <TabsContent value="education" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <GraduationCap className="h-4 w-4" /> Bachelor&apos;s Degree
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Field / Degree" value={candidate.bachelors_field} editing={editing}
                editNode={<Input value={form.bachelors_field ?? ""} onChange={(e) => setField("bachelors_field", e.target.value)} />}
              />
              <FieldRow label="University / Institution" value={candidate.bachelors_university} editing={editing}
                editNode={<Input value={form.bachelors_university ?? ""} onChange={(e) => setField("bachelors_university", e.target.value)} />}
              />
              <FieldRow label="Start Year" value={fmt(candidate.bachelors_start_date)} editing={editing}
                editNode={<Input type="date" value={form.bachelors_start_date?.slice(0, 10) ?? ""} onChange={(e) => setField("bachelors_start_date", e.target.value)} />}
              />
              <FieldRow label="End Year" value={fmt(candidate.bachelors_end_date)} editing={editing}
                editNode={<Input type="date" value={form.bachelors_end_date?.slice(0, 10) ?? ""} onChange={(e) => setField("bachelors_end_date", e.target.value)} />}
              />
            </CardContent>
          </Card>

          {(candidate.masters_field || candidate.masters_university || editing) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <GraduationCap className="h-4 w-4" /> Master&apos;s Degree
                  {!candidate.masters_field && !candidate.masters_university && (
                    <Badge variant="secondary" className="ml-auto text-xs">Optional</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="Field / Degree" value={candidate.masters_field} editing={editing}
                  editNode={<Input value={form.masters_field ?? ""} onChange={(e) => setField("masters_field", e.target.value)} placeholder="Leave blank if not applicable" />}
                />
                <FieldRow label="University / Institution" value={candidate.masters_university} editing={editing}
                  editNode={<Input value={form.masters_university ?? ""} onChange={(e) => setField("masters_university", e.target.value)} />}
                />
                <FieldRow label="Start Year" value={fmt(candidate.masters_start_date)} editing={editing}
                  editNode={<Input type="date" value={form.masters_start_date?.slice(0, 10) ?? ""} onChange={(e) => setField("masters_start_date", e.target.value)} />}
                />
                <FieldRow label="End Year" value={fmt(candidate.masters_end_date)} editing={editing}
                  editNode={<Input type="date" value={form.masters_end_date?.slice(0, 10) ?? ""} onChange={(e) => setField("masters_end_date", e.target.value)} />}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Qualification Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <FieldRow label="Highest Qualification" value={nice(candidate.highest_qualification)} editing={editing}
                editNode={
                  <Select value={form.highest_qualification ?? ""} onValueChange={(v) => setField("highest_qualification", v)}>
                    <SelectTrigger><SelectValue placeholder="Select qualification" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bachelors">Bachelor&apos;s</SelectItem>
                      <SelectItem value="masters">Master&apos;s</SelectItem>
                      <SelectItem value="phd">PhD</SelectItem>
                      <SelectItem value="associate">Associate</SelectItem>
                      <SelectItem value="diploma">Diploma</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Enrollment & Payment ───────────────────────────────────────── */}
        <TabsContent value="payment" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <CreditCard className="h-4 w-4" /> Plan Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Plan Type" value={nice(candidate.plan_type)} editing={editing}
                editNode={
                  <Select value={form.plan_type ?? ""} onValueChange={(v) => setField("plan_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select plan" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                    </SelectContent>
                  </Select>
                }
              />
              <FieldRow label="Plan Price" value={candidate.plan_price ? `$${candidate.plan_price}` : "-"} editing={editing}
                editNode={<Input value={form.plan_price ?? ""} onChange={(e) => setField("plan_price", e.target.value)} placeholder="e.g. 4999" />}
              />
              <FieldRow label="Discount Amount" value={candidate.discount_amount ? `$${candidate.discount_amount}` : "-"} editing={editing}
                editNode={<Input value={form.discount_amount ?? ""} onChange={(e) => setField("discount_amount", e.target.value)} />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Installments</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Installment 1 Amount" value={candidate.installment_1_amount ? `$${candidate.installment_1_amount}` : "-"} editing={editing}
                editNode={<Input value={form.installment_1_amount ?? ""} onChange={(e) => setField("installment_1_amount", e.target.value)} />}
              />
              <FieldRow label="Installment 1 Paid Date" value={fmt(candidate.installment_1_paid_date)} editing={editing}
                editNode={<Input type="date" value={form.installment_1_paid_date?.slice(0, 10) ?? ""} onChange={(e) => setField("installment_1_paid_date", e.target.value)} />}
              />
              <FieldRow label="Installment 2 Amount" value={candidate.installment_2_amount ? `$${candidate.installment_2_amount}` : "-"} editing={editing}
                editNode={<Input value={form.installment_2_amount ?? ""} onChange={(e) => setField("installment_2_amount", e.target.value)} />}
              />
              <FieldRow label="Installment 2 Paid Date" value={fmt(candidate.installment_2_paid_date)} editing={editing}
                editNode={<Input type="date" value={form.installment_2_paid_date?.slice(0, 10) ?? ""} onChange={(e) => setField("installment_2_paid_date", e.target.value)} />}
              />
              <FieldRow label="Next Payment Date" value={fmt(candidate.next_payment_date)} editing={editing}
                editNode={<Input type="date" value={form.next_payment_date?.slice(0, 10) ?? ""} onChange={(e) => setField("next_payment_date", e.target.value)} />}
              />
              <FieldRow label="Next Payment Amount" value={candidate.next_payment_amount ? `$${candidate.next_payment_amount}` : "-"} editing={editing}
                editNode={<Input value={form.next_payment_amount ?? ""} onChange={(e) => setField("next_payment_amount", e.target.value)} />}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Payment Methods</CardTitle>
            </CardHeader>
            <CardContent>
              {paymentMethods.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((method) => (
                    <Badge key={method} variant="outline" className="capitalize">
                      {method.replace(/_/g, " ")}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No payment methods recorded.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sales & Referral</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Salesperson" value={candidate.salesperson_name} />
              <FieldRow label="Lead Person" value={candidate.lead_person_name} editing={editing}
                editNode={<Input value={form.lead_person_name ?? ""} onChange={(e) => setField("lead_person_name", e.target.value)} />}
              />
              <FieldRow label="Referred By" value={candidate.referred_by_name} editing={editing}
                editNode={<Input value={form.referred_by_name ?? ""} onChange={(e) => setField("referred_by_name", e.target.value)} />}
              />
              <FieldRow label="Referral Bonus" value={candidate.referral_bonus_amount ? `$${candidate.referral_bonus_amount}` : "-"} editing={editing}
                editNode={<Input value={form.referral_bonus_amount ?? ""} onChange={(e) => setField("referral_bonus_amount", e.target.value)} />}
              />
              <FieldRow label="Enrolled By" value={candidate.enrolled_by_name} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Marketing Access ──────────────────────────────────────────── */}
        {canViewCredentials && (
          <TabsContent value="marketing" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" /> Marketing Identity
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="Marketing Name" value={candidate.marketing_name} />
                <FieldRow label="Marketing Status" value={
                  candidate.marketing_status ? (
                    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${marketingBadgeClass}`}>
                      {nice(candidate.marketing_status)}
                    </span>
                  ) : "-"
                } />
                {candidate.marketing_linkedin_url && (
                  <div className="space-y-1 md:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground">LinkedIn URL</p>
                    <a
                      href={candidate.marketing_linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-primary hover:underline flex items-center gap-1"
                    >
                      {candidate.marketing_linkedin_url}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-amber-500" /> Credentials (Restricted)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FieldRow label="LinkedIn Email" value={candidate.linkedin_email} />
                <FieldRow label="LinkedIn Passcode" value={
                  candidate.linkedin_passcode
                    ? <span className="font-mono tracking-widest">{"•".repeat(8)}</span>
                    : "-"
                } />
                <FieldRow label="Marketing Email" value={candidate.marketing_email} />
                <FieldRow label="Marketing Email Password" value={
                  candidate.marketing_email_password
                    ? <span className="font-mono tracking-widest">{"•".repeat(8)}</span>
                    : "-"
                } />
                {candidate.visa_portal_username && (
                  <FieldRow label="Visa Portal Username" value={
                    <span className="font-mono">{candidate.visa_portal_username}</span>
                  } />
                )}
                <FieldRow label="SSN Last 4" value={
                  candidate.ssn_last4
                    ? <span className="font-mono">***-**-{candidate.ssn_last4}</span>
                    : "-"
                } />
              </CardContent>
            </Card>
          </TabsContent>
        )}

        {/* ── Timeline / Activity ───────────────────────────────────────── */}
        <TabsContent value="timeline" className="mt-4 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4" /> Enrollment Details
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FieldRow label="Enrolled At" value={fmt(candidate.enrolled_at ?? candidate.created_at)} />
              <FieldRow label="Last Updated" value={fmt(candidate.updated_at)} />
              <FieldRow label="Current Stage" value={
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stageBadgeClass}`}>
                  {STAGE_LABELS[candidate.pipeline_stage ?? "enrolled"] ?? nice(candidate.pipeline_stage)}
                </span>
              } />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Support Tasks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {supportTasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No support tasks linked to this candidate.</p>
              ) : (
                supportTasks.map((task) => (
                  <div key={task.id} className="rounded-2xl border p-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{nice(task.task_type)}</Badge>
                      {task.interview_round && <Badge variant="secondary">{task.interview_round}</Badge>}
                      <Badge variant={task.status === "completed" ? "default" : "secondary"}>
                        {nice(task.status)}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{task.company_name || "Internal task"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmt(task.scheduled_at)} {task.assignee_name ? `· ${task.assignee_name}` : ""}
                    </p>
                    {task.feedback && <p className="text-sm text-muted-foreground">{task.feedback}</p>}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Placement Offers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {placements.length === 0 ? (
                <p className="text-sm text-muted-foreground">No placement offers linked to this candidate.</p>
              ) : (
                placements.map((p) => (
                  <div key={p.id} className="rounded-2xl border p-3 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm">{p.company_name || "Unknown Company"}</p>
                      {p.status && (
                        <Badge variant={p.status === "accepted" ? "default" : "secondary"}>
                          {nice(p.status)}
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 text-xs text-muted-foreground">
                      {p.offer_date && <span>Offer: {fmt(p.offer_date)}</span>}
                      {p.start_date && <span>Start: {fmt(p.start_date)}</span>}
                      {p.bill_rate && <span>Bill Rate: ${p.bill_rate}/hr</span>}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Delete section ─────────────────────────────────────────────────── */}
      {canDelete && (
        <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-4 md:p-6">
          <h3 className="text-sm font-semibold text-destructive">Danger Zone</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently remove this candidate and all associated records. This action cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-3"
            onClick={() => setShowDeleteDialog(true)}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Delete Candidate
          </Button>
        </div>
      )}

      {/* ── Delete confirmation dialog ─────────────────────────────────────── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <strong>{candidate.full_name}</strong> and all associated records
              including resume versions, support tasks, and payment history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : "Yes, Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
