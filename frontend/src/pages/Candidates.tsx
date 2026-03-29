import { useEffect, useMemo, useState } from "react";
import { Eye, FileText, Loader2, RefreshCcw, Search, Trash2, UploadCloud, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api.client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Candidate = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  current_domain: string | null;
  years_experience: string | null;
  current_location_zip: string | null;
  visa_status: string | null;
  visa_expire_date: string | null;
  highest_qualification: string | null;
  availability_for_calls: string | null;
  availability_to_start: string | null;
  open_for_relocation: string | null;
  linkedin_email?: string | null;
  linkedin_passcode?: string | null;
  marketing_email?: string | null;
  marketing_email_password?: string | null;
  ssn_last4?: string | null;
  salary_expectations: string | null;
  notes?: string | null;
  pipeline_stage: string | null;
  created_at: string | null;
  updated_at?: string | null;
  interview_count: number;
  completed_interview_count: number;
  resume_update_count: number;
  current_resume_url?: string | null;
  current_resume_name?: string | null;
};

type ResumeVersion = {
  id: string;
  file_url: string;
  file_name: string;
  notes: string | null;
  is_current: boolean;
  created_at: string;
  uploaded_by_name?: string | null;
};

type HistoryItem = {
  id: string;
  task_type: string;
  company_name: string | null;
  interview_round: string | null;
  scheduled_at: string | null;
  status: string;
  feedback: string | null;
  assignee_name: string | null;
};

type ProfileForm = {
  full_name: string;
  email: string;
  phone: string;
  current_domain: string;
  years_experience: string;
  current_location_zip: string;
  visa_status: string;
  visa_expire_date: string;
  highest_qualification: string;
  availability_for_calls: string;
  availability_to_start: string;
  open_for_relocation: string;
  salary_expectations: string;
  pipeline_stage: string;
  notes: string;
};

type CredentialForm = {
  linkedin_email: string;
  linkedin_passcode: string;
  marketing_email: string;
  marketing_email_password: string;
  ssn_last4: string;
};

const STAGES = ["enrolled", "resume_building", "marketing_active", "interview_stage", "placed", "rejected"] as const;
const TITLES: Record<string, string> = {
  enrolled: "Enrolled",
  resume_building: "Resume Build",
  marketing_active: "Marketing",
  interview_stage: "Interviews",
  placed: "Placed",
  rejected: "Rejected",
};

const PROFILE_EDIT_ROLES = ["director", "hr_head", "sales_head", "assistant_tl", "sales_executive"];
const CREDENTIAL_EDIT_ROLES = ["director", "hr_head", "marketing_tl", "recruiter", "senior_recruiter"];
const RESUME_EDIT_ROLES = ["director", "hr_head", "marketing_tl", "recruiter", "senior_recruiter", "resume_head", "resume_builder"];
const CREDENTIAL_VIEW_ROLES = CREDENTIAL_EDIT_ROLES;

const nice = (value: string | null | undefined) => {
  if (!value) return "-";
  return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
};

const fmt = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
};

const profileFormOf = (candidate: Candidate): ProfileForm => ({
  full_name: candidate.full_name ?? "",
  email: candidate.email ?? "",
  phone: candidate.phone ?? "",
  current_domain: candidate.current_domain ?? "",
  years_experience: candidate.years_experience ?? "",
  current_location_zip: candidate.current_location_zip ?? "",
  visa_status: candidate.visa_status ?? "",
  visa_expire_date: candidate.visa_expire_date?.slice(0, 10) ?? "",
  highest_qualification: candidate.highest_qualification ?? "",
  availability_for_calls: candidate.availability_for_calls ?? "",
  availability_to_start: candidate.availability_to_start ?? "",
  open_for_relocation: candidate.open_for_relocation ?? "",
  salary_expectations: candidate.salary_expectations ?? "",
  pipeline_stage: candidate.pipeline_stage ?? "enrolled",
  notes: candidate.notes ?? "",
});

const credentialFormOf = (candidate: Candidate): CredentialForm => ({
  linkedin_email: candidate.linkedin_email ?? "",
  linkedin_passcode: candidate.linkedin_passcode ?? "",
  marketing_email: candidate.marketing_email ?? "",
  marketing_email_password: candidate.marketing_email_password ?? "",
  ssn_last4: candidate.ssn_last4 ?? "",
});

export default function Candidates() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const role = employee?.role ?? "";
  const canDelete = role === "director" || role === "hr_head";
  const canEditProfile = PROFILE_EDIT_ROLES.includes(role);
  const canEditCredentials = CREDENTIAL_EDIT_ROLES.includes(role);
  const canViewCredentials = CREDENTIAL_VIEW_ROLES.includes(role);
  const canManageResumes = RESUME_EDIT_ROLES.includes(role);

  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [stats, setStats] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Candidate | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [resumes, setResumes] = useState<ResumeVersion[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm | null>(null);
  const [credentialForm, setCredentialForm] = useState<CredentialForm | null>(null);
  const [resumeNote, setResumeNote] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadBoard() {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        api.get<Candidate[]>("/api/candidates?limit=500"),
        api.get<Record<string, number>>("/api/candidates/pipeline-stats"),
      ]);
      setCandidates(listRes.data ?? []);
      setStats(statsRes.data ?? {});
    } catch (err: any) {
      toast({ title: "Failed to load candidates", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function openCandidate(id: string) {
    setDetailLoading(true);
    try {
      const [candidateRes, historyRes, resumesRes] = await Promise.all([
        api.get<Candidate>(`/api/candidates/${id}`),
        api.get<{ history: HistoryItem[] }>(`/api/analytics/candidate/${id}/history`),
        api.get<ResumeVersion[]>(`/api/candidates/${id}/resumes`),
      ]);
      const candidate = candidateRes.data ?? null;
      setSelected(candidate);
      setProfileForm(candidate ? profileFormOf(candidate) : null);
      setCredentialForm(candidate ? credentialFormOf(candidate) : null);
      setHistory(historyRes.data?.history ?? []);
      setResumes(resumesRes.data ?? []);
    } catch (err: any) {
      toast({ title: "Failed to load candidate", description: err.message, variant: "destructive" });
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    void loadBoard();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return candidates;
    return candidates.filter((candidate) =>
      [
        candidate.full_name,
        candidate.email,
        candidate.phone,
        candidate.current_domain,
        candidate.current_location_zip,
        candidate.current_resume_name,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
  }, [candidates, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Candidate[]> = Object.fromEntries(STAGES.map((stage) => [stage, []]));
    filtered.forEach((candidate) => {
      const stage = candidate.pipeline_stage || "enrolled";
      if (!map[stage]) map[stage] = [];
      map[stage].push(candidate);
    });
    return map;
  }, [filtered]);

  async function saveProfile() {
    if (!selected || !profileForm) return;
    setSavingProfile(true);
    try {
      await api.patch(`/api/candidates/${selected.id}`, profileForm);
      await Promise.all([openCandidate(selected.id), loadBoard()]);
      toast({ title: "Candidate profile updated" });
    } catch (err: any) {
      toast({ title: "Profile update failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveCredentials() {
    if (!selected || !credentialForm) return;
    setSavingCredentials(true);
    try {
      await api.patch(`/api/candidates/${selected.id}/credentials`, credentialForm);
      await openCandidate(selected.id);
      toast({ title: "Candidate credentials updated" });
    } catch (err: any) {
      toast({ title: "Credential update failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingCredentials(false);
    }
  }

  async function uploadResume(file: File) {
    if (!selected) return;
    setUploading(true);
    try {
      const token = localStorage.getItem("recruithub_token");
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("notes", resumeNote);

      const response = await fetch(`${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/candidates/${selected.id}/resumes`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });

      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Upload failed");

      setResumeNote("");
      await Promise.all([openCandidate(selected.id), loadBoard()]);
      toast({ title: "Resume updated" });
    } catch (err: any) {
      toast({ title: "Resume upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function deleteCandidate() {
    if (!deletingId) return;
    try {
      await api.delete(`/api/candidates/${deletingId}`);
      if (selected?.id === deletingId) {
        setSelected(null);
      }
      setDeletingId(null);
      await loadBoard();
      toast({ title: "Candidate deleted" });
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  }

  return (
    <div className="space-y-6 p-3 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Candidate Pipeline</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Status board with role-based candidate details, marketing credentials, and resume history.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
          <Card><CardContent className="pt-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Candidates</p><p className="mt-1 text-2xl font-semibold">{candidates.length}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Resume Updates</p><p className="mt-1 text-2xl font-semibold">{candidates.reduce((sum, candidate) => sum + candidate.resume_update_count, 0)}</p></CardContent></Card>
          <Card><CardContent className="pt-4"><p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Interviews</p><p className="mt-1 text-2xl font-semibold">{candidates.reduce((sum, candidate) => sum + candidate.interview_count, 0)}</p></CardContent></Card>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:flex-wrap">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-10" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, domain, location, or resume..." />
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {STAGES.map((stage) => (
              <span key={stage} className="rounded-full border border-border px-3 py-1.5">
                {TITLES[stage]}: <span className="font-semibold text-foreground">{stats[stage] ?? 0}</span>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto pb-4">
        <div className="grid min-w-[900px] grid-cols-6 gap-4">
          {STAGES.map((stage) => (
            <section key={stage} className="rounded-3xl border border-border/60 bg-card">
              <div className="px-4 pt-4">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-foreground/80">{TITLES[stage]}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{grouped[stage]?.length ?? 0} cards</p>
              </div>
              <div className="space-y-3 p-4">
                {loading ? (
                  <Card><CardContent className="py-8 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading</CardContent></Card>
                ) : grouped[stage]?.length ? (
                  grouped[stage].map((candidate) => (
                    <Card key={candidate.id} className="bg-background/90">
                      <CardContent className="space-y-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold leading-tight">{candidate.full_name}</p>
                            <p className="mt-1 truncate text-xs text-muted-foreground">{candidate.current_domain || "Domain not added"}</p>
                          </div>
                          <Badge variant="outline">{candidate.completed_interview_count}/{candidate.interview_count}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-2xl border px-3 py-2">
                            <p className="text-muted-foreground">Visa</p>
                            <p className="mt-1 font-medium">{candidate.visa_status || "-"}</p>
                          </div>
                          <div className="rounded-2xl border px-3 py-2">
                            <p className="text-muted-foreground">Resume</p>
                            <p className="mt-1 font-medium">{candidate.resume_update_count} updates</p>
                          </div>
                        </div>

                        <div className="rounded-2xl border px-3 py-2">
                          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Current Resume</p>
                          <p className="mt-1 truncate text-sm font-medium">{candidate.current_resume_name || "No resume uploaded"}</p>
                        </div>

                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{fmt(candidate.updated_at || candidate.created_at)}</span>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => void openCandidate(candidate.id)}>
                              <Eye className="mr-1 h-3.5 w-3.5" /><span className="hidden sm:inline">Open</span>
                            </Button>
                            {canDelete && <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive" onClick={() => setDeletingId(candidate.id)}><Trash2 className="h-3.5 w-3.5" /></Button>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No candidates here</CardContent></Card>
                )}
              </div>
            </section>
          ))}
        </div>
      </div>

      <Sheet open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-3xl p-3 sm:p-6">
          <SheetHeader>
            <SheetTitle>{selected?.full_name || "Candidate Details"}</SheetTitle>
          </SheetHeader>

          {detailLoading || !selected || !profileForm || !credentialForm ? (
            <div className="py-16 text-center text-muted-foreground"><Loader2 className="mr-2 inline h-5 w-5 animate-spin" />Loading details...</div>
          ) : (
            <div className="mt-6 space-y-5 pb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  ["Stage", nice(selected.pipeline_stage)],
                  ["Interviews", `${selected.completed_interview_count}/${selected.interview_count}`],
                  ["Resume Updates", String(selected.resume_update_count)],
                  ["Current Resume", selected.current_resume_name || "None"],
                ].map(([label, value]) => (
                  <Card key={label}><CardContent className="pt-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate font-semibold">{value}</p></CardContent></Card>
                ))}
              </div>

              <Card>
                <CardHeader><CardTitle className="text-sm">Candidate Contact Card</CardTitle></CardHeader>
                <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                  <p><span className="text-muted-foreground">Email:</span> {selected.email || "-"}</p>
                  <p><span className="text-muted-foreground">Phone:</span> {selected.phone || "-"}</p>
                  <p><span className="text-muted-foreground">Domain:</span> {selected.current_domain || "-"}</p>
                  <p><span className="text-muted-foreground">Experience:</span> {selected.years_experience || "-"}</p>
                  <p><span className="text-muted-foreground">Location:</span> {selected.current_location_zip || "-"}</p>
                  <p><span className="text-muted-foreground">Qualification:</span> {nice(selected.highest_qualification)}</p>
                  <p><span className="text-muted-foreground">Visa:</span> {selected.visa_status || "-"}</p>
                  <p><span className="text-muted-foreground">Visa Expiry:</span> {fmt(selected.visa_expire_date)}</p>
                  <p><span className="text-muted-foreground">Call Availability:</span> {selected.availability_for_calls || "-"}</p>
                  <p><span className="text-muted-foreground">Start Availability:</span> {selected.availability_to_start || "-"}</p>
                  <p><span className="text-muted-foreground">Relocation:</span> {selected.open_for_relocation || "-"}</p>
                  <p><span className="text-muted-foreground">Salary:</span> {selected.salary_expectations || "-"}</p>
                </CardContent>
              </Card>

              {canViewCredentials && (
                <Card>
                  <CardHeader><CardTitle className="flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4 text-primary" />Marketing Credentials</CardTitle></CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                    <p><span className="text-muted-foreground">LinkedIn Email:</span> {selected.linkedin_email || "-"}</p>
                    <p><span className="text-muted-foreground">LinkedIn Passcode:</span> {selected.linkedin_passcode || "-"}</p>
                    <p><span className="text-muted-foreground">Marketing Email:</span> {selected.marketing_email || "-"}</p>
                    <p><span className="text-muted-foreground">Marketing Password:</span> {selected.marketing_email_password || "-"}</p>
                    <p><span className="text-muted-foreground">SSN Last 4:</span> {selected.ssn_last4 || "-"}</p>
                  </CardContent>
                </Card>
              )}

              {canEditProfile && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Sales Profile Update</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {(["full_name", "email", "phone", "current_domain", "years_experience", "current_location_zip", "visa_status", "highest_qualification", "availability_for_calls", "availability_to_start", "open_for_relocation", "salary_expectations"] as const).map((key) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{nice(key)}</Label>
                        <Input value={profileForm[key]} onChange={(e) => setProfileForm({ ...profileForm, [key]: e.target.value })} />
                      </div>
                    ))}
                    <div className="space-y-1.5">
                      <Label>Visa Expiry</Label>
                      <Input type="date" value={profileForm.visa_expire_date} onChange={(e) => setProfileForm({ ...profileForm, visa_expire_date: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Pipeline Stage</Label>
                      <select value={profileForm.pipeline_stage} onChange={(e) => setProfileForm({ ...profileForm, pipeline_stage: e.target.value })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                        {STAGES.map((stage) => <option key={stage} value={stage}>{TITLES[stage]}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Notes</Label>
                      <Textarea rows={4} value={profileForm.notes} onChange={(e) => setProfileForm({ ...profileForm, notes: e.target.value })} />
                    </div>
                    <div className="col-span-full flex flex-col sm:flex-row gap-2 justify-end">
                      <Button onClick={() => void saveProfile()} disabled={savingProfile} className="w-full sm:w-auto">
                        {savingProfile ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Candidate Profile"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {canEditCredentials && (
                <Card>
                  <CardHeader><CardTitle className="text-sm">Marketing Credential Update</CardTitle></CardHeader>
                  <CardContent className="grid gap-4 sm:grid-cols-2">
                    {(["linkedin_email", "linkedin_passcode", "marketing_email", "marketing_email_password", "ssn_last4"] as const).map((key) => (
                      <div key={key} className="space-y-1.5">
                        <Label>{nice(key)}</Label>
                        <Input value={credentialForm[key]} onChange={(e) => setCredentialForm({ ...credentialForm, [key]: e.target.value })} />
                      </div>
                    ))}
                    <div className="col-span-full flex flex-col sm:flex-row gap-2 justify-end">
                      <Button onClick={() => void saveCredentials()} disabled={savingCredentials} className="w-full sm:w-auto">
                        {savingCredentials ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Credentials"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader><CardTitle className="text-sm">Resume Workflow</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {canManageResumes ? (
                    <>
                      <Textarea value={resumeNote} onChange={(e) => setResumeNote(e.target.value)} placeholder="Add a note for this resume update..." rows={3} />
                      <div className="flex flex-wrap items-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/40">
                          <UploadCloud className="h-4 w-4" />
                          Upload Resume
                          <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadResume(file); e.currentTarget.value = ""; }} />
                        </label>
                        {uploading && <span className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Uploading...</span>}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Resume history is visible here. Resume uploads are limited to marketing, resume, HR, and director roles.</p>
                  )}
                  {selected.current_resume_url && <Button variant="outline" onClick={() => window.open(selected.current_resume_url || "", "_blank")}><FileText className="mr-2 h-4 w-4" />Open Current Resume</Button>}
                  <div className="space-y-3">
                    {resumes.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No resume versions uploaded yet.</p>
                    ) : (
                      resumes.map((resume) => (
                        <div key={resume.id} className="rounded-2xl border p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <button onClick={() => window.open(resume.file_url, "_blank")} className="truncate text-left font-medium text-primary hover:underline">{resume.file_name}</button>
                              <p className="mt-1 text-xs text-muted-foreground">Uploaded by {resume.uploaded_by_name || "Unknown"} on {fmt(resume.created_at)}</p>
                              {resume.notes && <p className="mt-2 text-sm text-muted-foreground">{resume.notes}</p>}
                            </div>
                            {resume.is_current && <Badge>Current</Badge>}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader><CardTitle className="text-sm">Interview & Workflow Timeline</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                  {history.length === 0 ? <p className="text-sm text-muted-foreground">No timeline items recorded yet.</p> : history.map((item) => (
                    <div key={item.id} className="rounded-2xl border p-3">
                      <div className="mb-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{nice(item.task_type)}</Badge>
                        {item.interview_round && <Badge variant="secondary">{item.interview_round}</Badge>}
                        <Badge variant={item.status === "completed" ? "default" : "secondary"}>{nice(item.status)}</Badge>
                      </div>
                      <p className="text-sm font-medium">{item.company_name || "Internal workflow item"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{fmt(item.scheduled_at)} | {item.assignee_name || "Unassigned"}</p>
                      {item.feedback && <p className="mt-2 text-sm text-muted-foreground">{item.feedback}</p>}
                    </div>
                  ))}
                </CardContent>
              </Card>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => selected && void openCandidate(selected.id)}>
                  <RefreshCcw className="mr-2 h-4 w-4" />Refresh
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => { if (!open) setDeletingId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Candidate</AlertDialogTitle>
            <AlertDialogDescription>This removes the candidate and all uploaded resume versions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void deleteCandidate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
