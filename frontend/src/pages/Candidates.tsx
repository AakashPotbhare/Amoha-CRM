import { useEffect, useMemo, useState } from "react";
import { Search, Pencil, Trash2, Loader2 } from "lucide-react";
import { api } from "@/lib/api.client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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

type CandidateRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  visa_status: string | null;
  visa_expire_date: string | null;
  current_location_zip: string | null;
  current_domain: string | null;
  years_experience: string | null;
  highest_qualification: string | null;
  linkedin_email: string | null;
  marketing_email: string | null;
  arrived_in_usa: string | null;
  veteran_status: string | null;
  security_clearance: string | null;
  race_ethnicity: string | null;
  nearest_metro_area: string | null;
  native_country: string | null;
  total_certifications: string | null;
  availability_for_calls: string | null;
  availability_to_start: string | null;
  open_for_relocation: string | null;
  salary_expectations: string | null;
  pipeline_stage: string | null;
  created_at: string | null;
  // edit-form extra fields
  marketing_name?: string | null;
  linkedin_url?: string | null;
  skype_id?: string | null;
  ead_start_date?: string | null;
  ead_end_date?: string | null;
  marketing_status?: string | null;
  ok_to_relocate?: boolean | null;
  currently_on_project?: boolean | null;
  project_end_date?: string | null;
  notes?: string | null;
};

interface EditForm {
  full_name: string;
  email: string;
  phone: string;
  marketing_name: string;
  linkedin_url: string;
  skype_id: string;
  visa_status: string;
  visa_expire_date: string;
  ead_start_date: string;
  ead_end_date: string;
  marketing_status: string;
  pipeline_stage: string;
  ok_to_relocate: boolean;
  currently_on_project: boolean;
  project_end_date: string;
  notes: string;
}

function toTitleCase(value: string | null) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

const COL_HEADER = "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap text-left";
const COL_CELL = "px-4 py-3 text-sm text-foreground align-top";

const VISA_STATUS_OPTIONS = [
  "H1B", "H4 EAD", "F1 OPT", "STEM OPT", "Day One CPT",
  "GC", "USC", "TN", "L2 EAD", "OPT",
];

const MARKETING_STATUS_OPTIONS = ["active", "inactive", "placed", "blacklisted"];

const PIPELINE_STAGE_OPTIONS = ["lead", "screening", "enrolled", "marketing", "placed", "inactive"];

function buildEditForm(c: CandidateRow): EditForm {
  return {
    full_name: c.full_name ?? "",
    email: c.email ?? "",
    phone: c.phone ?? "",
    marketing_name: c.marketing_name ?? "",
    linkedin_url: c.linkedin_url ?? "",
    skype_id: c.skype_id ?? "",
    visa_status: c.visa_status ?? "",
    visa_expire_date: c.visa_expire_date?.slice(0, 10) ?? "",
    ead_start_date: c.ead_start_date?.slice(0, 10) ?? "",
    ead_end_date: c.ead_end_date?.slice(0, 10) ?? "",
    marketing_status: c.marketing_status ?? "",
    pipeline_stage: c.pipeline_stage ?? "",
    ok_to_relocate: c.ok_to_relocate ?? false,
    currently_on_project: c.currently_on_project ?? false,
    project_end_date: c.project_end_date?.slice(0, 10) ?? "",
    notes: c.notes ?? "",
  };
}

export default function Candidates() {
  const { employee } = useAuth();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit state
  const [editingCandidate, setEditingCandidate] = useState<CandidateRow | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingCandidateId, setDeletingCandidateId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const canDelete = employee?.role === "director" || employee?.role === "hr_head";

  async function loadCandidates() {
    setLoading(true);
    setError(null);

    const res = await api.get<CandidateRow[]>("/api/candidates");

    if (!res.success) {
      setError(res.error || "Failed to load candidates");
    } else {
      setCandidates(
        (res.data || []).map((c: any) => ({
          id: c.id,
          full_name: c.full_name,
          email: c.email ?? null,
          phone: c.phone ?? null,
          gender: c.gender ?? null,
          dob: c.dob ?? null,
          visa_status: c.visa_status ?? null,
          visa_expire_date: c.visa_expire_date ?? null,
          current_location_zip: c.current_location_zip ?? null,
          current_domain: c.current_domain ?? null,
          years_experience: c.years_experience ?? null,
          highest_qualification: c.highest_qualification ?? null,
          linkedin_email: c.linkedin_email ?? null,
          marketing_email: c.marketing_email ?? null,
          arrived_in_usa: c.arrived_in_usa ?? null,
          veteran_status: c.veteran_status ?? null,
          security_clearance: c.security_clearance ?? null,
          race_ethnicity: c.race_ethnicity ?? null,
          nearest_metro_area: c.nearest_metro_area ?? null,
          native_country: c.native_country ?? null,
          total_certifications: c.total_certifications ?? null,
          availability_for_calls: c.availability_for_calls ?? null,
          availability_to_start: c.availability_to_start ?? null,
          open_for_relocation: c.open_for_relocation ?? null,
          salary_expectations: c.salary_expectations ?? null,
          pipeline_stage: c.pipeline_stage ?? null,
          created_at: c.created_at ?? null,
          marketing_name: c.marketing_name ?? null,
          linkedin_url: c.linkedin_url ?? null,
          skype_id: c.skype_id ?? null,
          ead_start_date: c.ead_start_date ?? null,
          ead_end_date: c.ead_end_date ?? null,
          marketing_status: c.marketing_status ?? null,
          ok_to_relocate: c.ok_to_relocate ?? null,
          currently_on_project: c.currently_on_project ?? null,
          project_end_date: c.project_end_date ?? null,
          notes: c.notes ?? null,
        })),
      );
    }

    setLoading(false);
  }

  useEffect(() => {
    let isMounted = true;

    async function init() {
      setLoading(true);
      setError(null);
      const res = await api.get<CandidateRow[]>("/api/candidates");
      if (!isMounted) return;
      if (!res.success) {
        setError(res.error || "Failed to load candidates");
      } else {
        setCandidates(
          (res.data || []).map((c: any) => ({
            id: c.id,
            full_name: c.full_name,
            email: c.email ?? null,
            phone: c.phone ?? null,
            gender: c.gender ?? null,
            dob: c.dob ?? null,
            visa_status: c.visa_status ?? null,
            visa_expire_date: c.visa_expire_date ?? null,
            current_location_zip: c.current_location_zip ?? null,
            current_domain: c.current_domain ?? null,
            years_experience: c.years_experience ?? null,
            highest_qualification: c.highest_qualification ?? null,
            linkedin_email: c.linkedin_email ?? null,
            marketing_email: c.marketing_email ?? null,
            arrived_in_usa: c.arrived_in_usa ?? null,
            veteran_status: c.veteran_status ?? null,
            security_clearance: c.security_clearance ?? null,
            race_ethnicity: c.race_ethnicity ?? null,
            nearest_metro_area: c.nearest_metro_area ?? null,
            native_country: c.native_country ?? null,
            total_certifications: c.total_certifications ?? null,
            availability_for_calls: c.availability_for_calls ?? null,
            availability_to_start: c.availability_to_start ?? null,
            open_for_relocation: c.open_for_relocation ?? null,
            salary_expectations: c.salary_expectations ?? null,
            pipeline_stage: c.pipeline_stage ?? null,
            created_at: c.created_at ?? null,
            marketing_name: c.marketing_name ?? null,
            linkedin_url: c.linkedin_url ?? null,
            skype_id: c.skype_id ?? null,
            ead_start_date: c.ead_start_date ?? null,
            ead_end_date: c.ead_end_date ?? null,
            marketing_status: c.marketing_status ?? null,
            ok_to_relocate: c.ok_to_relocate ?? null,
            currently_on_project: c.currently_on_project ?? null,
            project_end_date: c.project_end_date ?? null,
            notes: c.notes ?? null,
          })),
        );
      }
      setLoading(false);
    }

    init();
    return () => { isMounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter((c) =>
      [
        c.full_name, c.email, c.phone, c.gender, c.visa_status,
        c.current_location_zip, c.current_domain, c.highest_qualification,
        c.years_experience, c.native_country, c.nearest_metro_area,
        c.salary_expectations, c.linkedin_email, c.marketing_email,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [candidates, search]);

  function openEdit(c: CandidateRow) {
    setEditingCandidate(c);
    setEditForm(buildEditForm(c));
  }

  function closeEdit() {
    setEditingCandidate(null);
    setEditForm(null);
  }

  function setField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setEditForm((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  async function handleSave() {
    if (!editingCandidate || !editForm) return;
    setSaving(true);
    try {
      await api.patch(`/api/candidates/${editingCandidate.id}`, editForm);
      toast({ title: "Candidate updated", description: `${editForm.full_name} has been saved.` });
      closeEdit();
      await loadCandidates();
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deletingCandidateId) return;
    setDeleting(true);
    try {
      await api.delete(`/api/candidates/${deletingCandidateId}`);
      toast({ title: "Candidate deleted" });
      setDeletingCandidateId(null);
      await loadCandidates();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  const colSpanTotal = 27; // 26 data cols + 1 actions col

  return (
    <div className="p-6 lg:p-8 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All enrolled candidates with their complete enrollment details.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full" style={{ minWidth: "2500px" }}>
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              {/* Personal Information */}
              <th className={COL_HEADER}>Pipeline Stage</th>
              <th className={COL_HEADER}>Full Name (As per ID)</th>
              <th className={COL_HEADER}>Contact Email</th>
              <th className={COL_HEADER}>Contact Number</th>
              <th className={COL_HEADER}>Gender</th>
              <th className={COL_HEADER}>Date of Birth</th>
              {/* Visa & Location */}
              <th className={COL_HEADER}>Visa Status</th>
              <th className={COL_HEADER}>Visa Expire Date</th>
              <th className={COL_HEADER}>Current Location (Zip)</th>
              <th className={COL_HEADER}>Current Domain</th>
              <th className={COL_HEADER}>Genuine Years of Experience</th>
              {/* Education */}
              <th className={COL_HEADER}>Highest Qualification</th>
              {/* LinkedIn & Marketing */}
              <th className={COL_HEADER}>LinkedIn Login Email</th>
              <th className={COL_HEADER}>Marketing Email ID</th>
              {/* General Questions */}
              <th className={COL_HEADER}>Arrived in USA</th>
              <th className={COL_HEADER}>Veteran Status</th>
              <th className={COL_HEADER}>Security Clearance</th>
              <th className={COL_HEADER}>Race / Ethnicity</th>
              <th className={COL_HEADER}>Nearest Metropolitan Area</th>
              <th className={COL_HEADER}>Native Country</th>
              <th className={COL_HEADER}>Total Certifications</th>
              <th className={COL_HEADER}>Availability for Recruiter Calls</th>
              <th className={COL_HEADER}>Availability to Start Work</th>
              <th className={COL_HEADER}>Open for Relocation</th>
              <th className={COL_HEADER}>Salary Expectations</th>
              <th className={COL_HEADER}>Enrolled On</th>
              <th className={COL_HEADER}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colSpanTotal} className="px-5 py-10 text-center text-muted-foreground text-sm">
                  Loading candidates...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={colSpanTotal} className="px-5 py-10 text-center text-destructive text-sm">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={colSpanTotal} className="px-5 py-10 text-center text-muted-foreground text-sm">
                  No candidates found.
                </td>
              </tr>
            )}
            {!loading && !error && filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                {/* Pipeline Stage */}
                <td className={COL_CELL}>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground capitalize">
                    {c.pipeline_stage?.replace(/_/g, " ") ?? "enrolled"}
                  </span>
                </td>
                {/* Full Name */}
                <td className={COL_CELL}>
                  <p className="font-medium text-foreground">{c.full_name}</p>
                </td>
                {/* Contact Email */}
                <td className={COL_CELL}>{c.email || "-"}</td>
                {/* Contact Number */}
                <td className={COL_CELL}>{c.phone || "-"}</td>
                {/* Gender */}
                <td className={COL_CELL}>{toTitleCase(c.gender)}</td>
                {/* Date of Birth */}
                <td className={COL_CELL}>{formatDate(c.dob)}</td>
                {/* Visa Status */}
                <td className={COL_CELL}>{c.visa_status || "-"}</td>
                {/* Visa Expire Date */}
                <td className={COL_CELL}>{formatDate(c.visa_expire_date)}</td>
                {/* Current Location */}
                <td className={COL_CELL} style={{ maxWidth: "200px" }}>{c.current_location_zip || "-"}</td>
                {/* Current Domain */}
                <td className={COL_CELL}>{c.current_domain || "-"}</td>
                {/* Years of Experience */}
                <td className={COL_CELL}>{c.years_experience || "-"}</td>
                {/* Highest Qualification */}
                <td className={COL_CELL}>{toTitleCase(c.highest_qualification)}</td>
                {/* LinkedIn Login Email */}
                <td className={COL_CELL}>{c.linkedin_email || "-"}</td>
                {/* Marketing Email ID */}
                <td className={COL_CELL}>{c.marketing_email || "-"}</td>
                {/* Arrived in USA */}
                <td className={COL_CELL}>{formatDate(c.arrived_in_usa)}</td>
                {/* Veteran Status */}
                <td className={COL_CELL}>{toTitleCase(c.veteran_status)}</td>
                {/* Security Clearance */}
                <td className={COL_CELL}>{toTitleCase(c.security_clearance)}</td>
                {/* Race / Ethnicity */}
                <td className={COL_CELL}>{c.race_ethnicity || "-"}</td>
                {/* Nearest Metropolitan Area */}
                <td className={COL_CELL}>{c.nearest_metro_area || "-"}</td>
                {/* Native Country */}
                <td className={COL_CELL}>{c.native_country || "-"}</td>
                {/* Total Certifications */}
                <td className={COL_CELL}>{c.total_certifications || "-"}</td>
                {/* Availability for Recruiter Calls */}
                <td className={COL_CELL}>{c.availability_for_calls || "-"}</td>
                {/* Availability to Start Work */}
                <td className={COL_CELL}>{c.availability_to_start || "-"}</td>
                {/* Open for Relocation */}
                <td className={COL_CELL}>{toTitleCase(c.open_for_relocation)}</td>
                {/* Salary Expectations */}
                <td className={COL_CELL}>{c.salary_expectations || "-"}</td>
                {/* Enrolled On */}
                <td className={COL_CELL}>{formatDate(c.created_at)}</td>
                {/* Actions */}
                <td className={COL_CELL}>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(c)}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit candidate"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    {canDelete && (
                      <button
                        onClick={() => setDeletingCandidateId(c.id)}
                        className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        title="Delete candidate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ─── Edit Slide-In Sheet ─────────────────────────────────────────────── */}
      <Sheet open={!!editingCandidate} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Candidate</SheetTitle>
          </SheetHeader>

          {editForm && (
            <div className="mt-6 space-y-5 pb-6">
              {/* Personal */}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Personal</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ef-full_name">Full Name</Label>
                  <Input
                    id="ef-full_name"
                    value={editForm.full_name}
                    onChange={(e) => setField("full_name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-email">Email</Label>
                  <Input
                    id="ef-email"
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setField("email", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-phone">Phone</Label>
                  <Input
                    id="ef-phone"
                    value={editForm.phone}
                    onChange={(e) => setField("phone", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-marketing_name">Marketing Name</Label>
                  <Input
                    id="ef-marketing_name"
                    value={editForm.marketing_name}
                    onChange={(e) => setField("marketing_name", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-linkedin_url">LinkedIn URL</Label>
                  <Input
                    id="ef-linkedin_url"
                    value={editForm.linkedin_url}
                    onChange={(e) => setField("linkedin_url", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-skype_id">Skype ID</Label>
                  <Input
                    id="ef-skype_id"
                    value={editForm.skype_id}
                    onChange={(e) => setField("skype_id", e.target.value)}
                  />
                </div>
              </div>

              {/* Visa */}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Visa</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ef-visa_status">Visa Status</Label>
                  <select
                    id="ef-visa_status"
                    value={editForm.visa_status}
                    onChange={(e) => setField("visa_status", e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  >
                    <option value="">— Select —</option>
                    {VISA_STATUS_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-visa_expire_date">Visa Expire Date</Label>
                  <Input
                    id="ef-visa_expire_date"
                    type="date"
                    value={editForm.visa_expire_date}
                    onChange={(e) => setField("visa_expire_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-ead_start_date">EAD Start Date</Label>
                  <Input
                    id="ef-ead_start_date"
                    type="date"
                    value={editForm.ead_start_date}
                    onChange={(e) => setField("ead_start_date", e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-ead_end_date">EAD End Date</Label>
                  <Input
                    id="ef-ead_end_date"
                    type="date"
                    value={editForm.ead_end_date}
                    onChange={(e) => setField("ead_end_date", e.target.value)}
                  />
                </div>
              </div>

              {/* Status */}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Status</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ef-marketing_status">Marketing Status</Label>
                  <select
                    id="ef-marketing_status"
                    value={editForm.marketing_status}
                    onChange={(e) => setField("marketing_status", e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  >
                    <option value="">— Select —</option>
                    {MARKETING_STATUS_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ef-pipeline_stage">Pipeline Stage</Label>
                  <select
                    id="ef-pipeline_stage"
                    value={editForm.pipeline_stage}
                    onChange={(e) => setField("pipeline_stage", e.target.value)}
                    className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground"
                  >
                    <option value="">— Select —</option>
                    {PIPELINE_STAGE_OPTIONS.map((v) => (
                      <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Project */}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Project</p>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.ok_to_relocate}
                    onChange={(e) => setField("ok_to_relocate", e.target.checked)}
                    className="w-4 h-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm text-foreground">OK to Relocate</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.currently_on_project}
                    onChange={(e) => setField("currently_on_project", e.target.checked)}
                    className="w-4 h-4 rounded border-input accent-primary"
                  />
                  <span className="text-sm text-foreground">Currently on Project</span>
                </label>
                {editForm.currently_on_project && (
                  <div className="space-y-1.5">
                    <Label htmlFor="ef-project_end_date">Project End Date</Label>
                    <Input
                      id="ef-project_end_date"
                      type="date"
                      value={editForm.project_end_date}
                      onChange={(e) => setField("project_end_date", e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Notes */}
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-2">Notes</p>
              <textarea
                value={editForm.notes}
                onChange={(e) => setField("notes", e.target.value)}
                rows={4}
                className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Add notes..."
              />
            </div>
          )}

          <SheetFooter className="pt-4 border-t border-border gap-2">
            <Button variant="outline" onClick={closeEdit} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : "Save Changes"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ─── Delete Confirmation Dialog ─────────────────────────────────────── */}
      <AlertDialog
        open={!!deletingCandidateId}
        onOpenChange={(open) => { if (!open) setDeletingCandidateId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this candidate? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting…</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
