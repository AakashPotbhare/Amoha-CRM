import { useState, useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2 } from "lucide-react";

type TaskType = "interview_support" | "assessment_support" | "ruc" | "mock_call" | "preparation_call" | "resume_building" | "resume_rebuilding";
type InterviewRound = "screening" | "phone_call" | "1st_round" | "2nd_round" | "3rd_round" | "final_round";

interface CandidateOption {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  technology: string | null;
}

interface TeamOption {
  id: string;
  name: string;
  department_id: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  employee_code: string;
  team_id: string;
  role: string;
  department_id: string;
}

interface DepartmentOption {
  id: string;
  name: string;
  slug: string;
}

const TASK_TYPE_LABELS: Record<TaskType, string> = {
  interview_support: "Interview Support",
  assessment_support: "Assessment Support",
  ruc: "RUC (Resume Understanding Session)",
  mock_call: "Mock Call",
  preparation_call: "Preparation Call",
  resume_building: "Resume Building",
  resume_rebuilding: "Resume Rebuilding",
};

const ROUND_LABELS: Record<InterviewRound, string> = {
  screening: "Screening Call",
  phone_call: "Phone Call",
  "1st_round": "1st Round",
  "2nd_round": "2nd Round",
  "3rd_round": "3rd Round",
  final_round: "Final Round",
};

export default function CreateSupportTask() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // Form state — pre-select resume_building if ?type=resume
  const initialType = searchParams.get("type") === "resume" ? "resume_building" : "interview_support";
  const [taskType, setTaskType] = useState<TaskType>(initialType);
  const [candidateId, setCandidateId] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [interviewRound, setInterviewRound] = useState<InterviewRound | "">("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [deadlineDate, setDeadlineDate] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedTeam, setSelectedTeam] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [willingForSupport, setWillingForSupport] = useState(true);
  const [notes, setNotes] = useState("");
  const [priority, setPriority] = useState("medium");
  const [preferredHandlerId, setPreferredHandlerId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Data state
  const [candidates, setCandidates] = useState<CandidateOption[]>([]);
  const [departments, setDepartments] = useState<DepartmentOption[]>([]);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [detectedRound, setDetectedRound] = useState<string | null>(null);

  // Fetch reference data
  useEffect(() => {
    Promise.all([
      api.get<CandidateOption[]>("/api/candidates?is_active=true"),
      api.get<DepartmentOption[]>("/api/departments"),
      api.get<TeamOption[]>("/api/teams"),
      api.get<EmployeeOption[]>("/api/employees?is_active=true"),
    ]).then(([candRes, deptRes, teamRes, empRes]) => {
      if (candRes.success && candRes.data) setCandidates(candRes.data);
      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
      if (teamRes.success && teamRes.data) setTeams(teamRes.data);
      if (empRes.success && empRes.data) setEmployees(empRes.data);
    }).catch(() => {});
  }, []);

  // Selected candidate details
  const selectedCandidate = useMemo(
    () => candidates.find((c) => c.id === candidateId) ?? null,
    [candidates, candidateId]
  );

  // Auto-set department when task type changes (only resume_building auto-selects resume dept)
  useEffect(() => {
    let slug = "";
    if (taskType === "resume_building") slug = "resume";
    else if (taskType !== "resume_rebuilding") slug = "technical";

    if (slug) {
      const dept = departments.find((d) => d.slug === slug);
      if (dept) {
        setSelectedDept(dept.id);
        const deptTeam = teams.find((t) => t.department_id === dept.id);
        if (deptTeam) setSelectedTeam(deptTeam.id);
        else setSelectedTeam("");
        setSelectedEmployee("");
      }
    } else {
      // resume_rebuilding: don't auto-select any department
      setSelectedDept("");
      setSelectedTeam("");
      setSelectedEmployee("");
    }
  }, [taskType, departments, teams]);

  // Auto-detect round when candidate + company changes
  useEffect(() => {
    if (!candidateId || !companyName.trim()) {
      setDetectedRound(null);
      return;
    }
    api.get<{ interview_round: string }[]>(
      `/api/support-tasks?candidate_id=${candidateId}&company_name=${encodeURIComponent(companyName.trim())}&task_type=interview_support&limit=1&sort=created_at_desc`
    ).then((res) => {
      if (res.success && res.data && res.data.length > 0 && res.data[0].interview_round) {
        const prev = res.data[0].interview_round as InterviewRound;
        const rounds: InterviewRound[] = ["screening", "phone_call", "1st_round", "2nd_round", "3rd_round", "final_round"];
        const idx = rounds.indexOf(prev);
        const next = idx < rounds.length - 1 ? rounds[idx + 1] : prev;
        setDetectedRound(next);
        setInterviewRound(next);
      } else {
        setDetectedRound(null);
      }
    }).catch(() => {
      setDetectedRound(null);
    });
  }, [candidateId, companyName]);

  // Filter teams/employees
  const filteredTeams = selectedDept ? teams.filter((t) => t.department_id === selectedDept) : teams;
  const filteredEmployees = selectedTeam
    ? employees.filter((e) => e.team_id === selectedTeam)
    : selectedDept
    ? employees.filter((e) => teams.some((t) => t.department_id === selectedDept && t.id === e.team_id))
    : employees;

  // Which fields to show based on task type
  const isResumeTask = taskType === "resume_building" || taskType === "resume_rebuilding";
  const showJD = taskType === "interview_support";
  const showTime = taskType === "interview_support" || taskType === "assessment_support" || taskType === "preparation_call";
  const showScheduledDate = taskType !== "assessment_support";
  const showDeadline = taskType === "assessment_support" || isResumeTask;
  const showRound = taskType === "interview_support";
  const showCompany = taskType === "interview_support" || taskType === "assessment_support";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee || !candidateId) return;

    setSubmitting(true);

    const candidateName = selectedCandidate?.full_name || "Unknown";
    const autoTitle = `${TASK_TYPE_LABELS[taskType]} — ${candidateName}${showCompany && companyName.trim() ? ` @ ${companyName.trim()}` : ""}`;

    const payload: Record<string, unknown> = {
      title: autoTitle,
      task_type: taskType,
      candidate_id: candidateId,
      company_name: showCompany ? companyName.trim() || null : null,
      interview_round: showRound && interviewRound ? interviewRound : null,
      scheduled_date: showScheduledDate && scheduledDate ? scheduledDate : null,
      start_time: showTime && startTime ? startTime : null,
      end_time: showTime && endTime ? endTime : null,
      deadline_date: showDeadline && deadlineDate ? deadlineDate : null,
      job_description: showJD ? jobDescription.trim() || null : null,
      assigned_to_department_id: selectedDept || null,
      assigned_to_team_id: selectedTeam || null,
      assigned_to_employee_id: willingForSupport ? (selectedEmployee || null) : null,
      willing_for_support: willingForSupport,
      preferred_handler_id: preferredHandlerId || null,
      notes: notes.trim() || null,
      status: "pending",
      priority,
      created_by: employee.id,
    };

    try {
      await api.post("/api/support-tasks", payload);
    } catch (err: any) {
      setSubmitting(false);
      toast({ title: "Error", description: err.message || "Failed to create task", variant: "destructive" });
      return;
    }

    setSubmitting(false);
    toast({ title: "Task created", description: `${TASK_TYPE_LABELS[taskType]} task created successfully` });
    navigate("/tasks/inbox");
  };

  const selectClass = "w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  return (
    <div className="p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Create Support Task</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Schedule interviews, assessments, RUC, mock calls & preparation calls
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-6 space-y-5 card-elevated">
        {/* Task Type */}
        <div className="space-y-2">
          <Label htmlFor="taskType">Task Type *</Label>
          <select id="taskType" value={taskType} onChange={(e) => setTaskType(e.target.value as TaskType)} className={selectClass}>
            {Object.entries(TASK_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>

        {/* Candidate Selection */}
        <div className="space-y-2">
          <Label htmlFor="candidate">Candidate *</Label>
          <select
            id="candidate"
            value={candidateId}
            onChange={(e) => setCandidateId(e.target.value)}
            className={selectClass}
            required
          >
            <option value="">Select a candidate</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>{c.full_name}</option>
            ))}
          </select>
        </div>

        {/* Auto-fetched candidate details */}
        {selectedCandidate && (
          <div className="bg-secondary/50 rounded-lg p-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground block text-xs">Email</span>
              <span className="text-foreground">{selectedCandidate.email || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Phone</span>
              <span className="text-foreground">{selectedCandidate.phone || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Gender</span>
              <span className="text-foreground">{selectedCandidate.gender || "—"}</span>
            </div>
            <div>
              <span className="text-muted-foreground block text-xs">Technology</span>
              <span className="text-foreground">{selectedCandidate.technology || "—"}</span>
            </div>
          </div>
        )}

        {/* Company Name */}
        {showCompany && (
          <div className="space-y-2">
            <Label htmlFor="company">Company Name</Label>
            <Input
              id="company"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Enter company name"
            />
            {detectedRound && (
              <p className="text-xs text-muted-foreground">
                Auto-detected: This appears to be a <span className="font-medium text-primary">{ROUND_LABELS[detectedRound as InterviewRound]}</span> based on previous records. You can still change it below.
              </p>
            )}
          </div>
        )}

        {/* Interview Round */}
        {showRound && (
          <div className="space-y-2">
            <Label htmlFor="round">Interview Round</Label>
            <select id="round" value={interviewRound} onChange={(e) => setInterviewRound(e.target.value as InterviewRound)} className={selectClass}>
              <option value="">Select round</option>
              {Object.entries(ROUND_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date & Time */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {showScheduledDate && (
            <div className="space-y-2">
              <Label htmlFor="schedDate">Scheduled Date</Label>
              <Input id="schedDate" type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
            </div>
          )}
          {showTime && (
            <>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input id="startTime" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input id="endTime" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
              </div>
            </>
          )}
          {showDeadline && (
            <div className="space-y-2">
              <Label htmlFor="deadline">Deadline</Label>
              <Input id="deadline" type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} />
            </div>
          )}
        </div>

        {/* JD */}
        {showJD && (
          <div className="space-y-2">
            <Label htmlFor="jd">Job Description</Label>
            <Textarea id="jd" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste the job description here..." rows={4} />
          </div>
        )}

        {/* Priority */}
        <div className="space-y-2">
          <Label htmlFor="priority">Priority</Label>
          <select id="priority" value={priority} onChange={(e) => setPriority(e.target.value)} className={selectClass}>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Willing for support — only for non-resume tasks */}
        {!isResumeTask && (
          <>
            <div className="flex items-center gap-3 py-2">
              <Switch id="willing" checked={willingForSupport} onCheckedChange={setWillingForSupport} />
              <Label htmlFor="willing" className="cursor-pointer">
                Candidate is willing for technical support
              </Label>
            </div>
            {!willingForSupport && (
              <p className="text-xs text-muted-foreground -mt-3">
                This task will be recorded under your name and won't be sent to the Technical team.
              </p>
            )}

            {/* Assignment Section — only if willing */}
            {willingForSupport && (
              <div className="border-t border-border pt-5 space-y-4">
                <p className="text-sm font-medium text-foreground">
                  Assign to {departments.find((d) => d.id === selectedDept)?.name ?? "Team"}
                </p>

                <div className="space-y-2">
                  <Label htmlFor="dept">Department</Label>
                  <select
                    id="dept"
                    value={selectedDept}
                    onChange={(e) => { setSelectedDept(e.target.value); setSelectedTeam(""); setSelectedEmployee(""); }}
                    className={selectClass}
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="team">Team</Label>
                  <select
                    id="team"
                    value={selectedTeam}
                    onChange={(e) => { setSelectedTeam(e.target.value); setSelectedEmployee(""); }}
                    className={selectClass}
                  >
                    <option value="">Select Team</option>
                    {filteredTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="assignee">Assigned To (Team Lead)</Label>
                  <select id="assignee" value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)} className={selectClass}>
                    <option value="">Select person</option>
                    {filteredEmployees.map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                    ))}
                  </select>
                  <p className="text-xs text-muted-foreground">
                    The Team Lead can later assign a specific support person from their dashboard.
                  </p>
                </div>
              </div>
            )}
          </>
        )}

        {/* Preferred Handler */}
        <div className="border-t border-border pt-5 space-y-2">
          <Label htmlFor="preferred">Preferred Handler (optional)</Label>
          <select
            id="preferred"
            value={preferredHandlerId}
            onChange={(e) => setPreferredHandlerId(e.target.value)}
            className={selectClass}
          >
            <option value="">No preference</option>
            {(isResumeTask
              ? employees.filter((e) => {
                  const resumeDept = departments.find((d) => d.slug === "resume");
                  return resumeDept && e.department_id === resumeDept.id;
                })
              : filteredEmployees
            ).map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Request a specific person to handle this task. They'll see it as "preferred" in the queue but others can also pick it up.
          </p>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes for assigned person</Label>
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add any notes or special instructions..." rows={3} />
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting || !candidateId}>
            {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Creating...</> : "Create Task"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate("/tasks/create")}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
