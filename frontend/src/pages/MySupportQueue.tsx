import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Loader2,
  ExternalLink,
  CheckCircle,
  XCircle,
  Clock,
  Link2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Upload,
  PlayCircle,
  FileText,
} from "lucide-react";
import { format } from "date-fns";

interface QueueTask {
  id: string;
  task_type: string;
  candidate_name: string;
  candidate_enrollment_id: string | null;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_technology: string | null;
  company_name: string | null;
  interview_round: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  deadline_date: string | null;
  notes: string | null;
  status: string;
  priority: string;
  call_status: string;
  teams_link: string | null;
  link_sent_at: string | null;
  feedback: string | null;
  questions_asked: string | null;
  created_by_name: string | null;
  created_by_id: string;
  created_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  interview_support:  "Interview Support",
  assessment_support: "Assessment Support",
  ruc:                "RUC",
  mock_call:          "Mock Call",
  preparation_call:   "Prep Call",
  resume_building:    "Resume Building",
  resume_rebuilding:  "Resume Rebuilding",
};

const ROUND_LABELS: Record<string, string> = {
  screening:   "Screening",
  phone_call:  "Phone Call",
  "1st_round": "1st Round",
  "2nd_round": "2nd Round",
  "3rd_round": "3rd Round",
  final_round: "Final Round",
};

const CALL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground",         icon: Clock },
  link_sent:   { label: "Link Sent",   color: "bg-info/10 text-info",                   icon: Link2 },
  completed:   { label: "Completed",   color: "bg-success/10 text-success",             icon: CheckCircle },
  no_show:     { label: "No Show",     color: "bg-destructive/10 text-destructive",     icon: XCircle },
  cancelled:   { label: "Cancelled",   color: "bg-destructive/10 text-destructive",     icon: XCircle },
};

const TASK_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending:     { label: "Pending",     color: "bg-muted text-muted-foreground",         icon: Clock },
  in_progress: { label: "In Progress", color: "bg-blue-100 text-blue-700",             icon: PlayCircle },
  completed:   { label: "Completed",   color: "bg-success/10 text-success",             icon: CheckCircle },
  cancelled:   { label: "Cancelled",   color: "bg-destructive/10 text-destructive",     icon: XCircle },
};

const RESUME_TASK_TYPES = new Set(["resume_building", "resume_rebuilding"]);

export default function MySupportQueue() {
  const { employee } = useAuth();
  const { toast }    = useToast();

  const [tasks,        setTasks]        = useState<QueueTask[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Call-task state
  const [teamsLinkInputs, setTeamsLinkInputs] = useState<Record<string, string>>({});
  const [feedbackInputs,  setFeedbackInputs]  = useState<Record<string, string>>({});
  const [questionsInputs, setQuestionsInputs] = useState<Record<string, string>>({});

  // Resume-task state
  const [resumeFiles,   setResumeFiles]   = useState<Record<string, File | null>>({});
  const [resumeNotes,   setResumeNotes]   = useState<Record<string, string>>({});
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const [saving,       setSaving]       = useState<string | null>(null);
  const [accepting,    setAccepting]    = useState<string | null>(null);
  const [commenting,   setCommenting]   = useState<string | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const fetchTasks = async () => {
    if (!employee) return;
    try {
      const res = await api.get<any[]>(`/api/support-tasks?assigned_to=${employee.id}`);
      if (res.success && res.data) {
        setTasks(res.data.map((t: any) => ({
          id:                      t.id,
          task_type:               t.task_type,
          candidate_name:          t.candidate_name ?? "Unknown",
          candidate_enrollment_id: t.candidate_enrollment_id ?? null,
          candidate_email:         t.candidate_email ?? null,
          candidate_phone:         t.candidate_phone ?? null,
          candidate_technology:    t.candidate_technology ?? null,
          company_name:            t.company_name,
          interview_round:         t.interview_round,
          scheduled_date:          t.scheduled_date,
          start_time:              t.start_time,
          end_time:                t.end_time,
          deadline_date:           t.deadline_date,
          notes:                   t.notes,
          status:                  t.status,
          priority:                t.priority,
          call_status:             t.call_status || "not_started",
          teams_link:              t.teams_link,
          link_sent_at:            t.link_sent_at,
          feedback:                t.feedback,
          questions_asked:         t.questions_asked,
          created_by_name:         t.created_by_name ?? null,
          created_by_id:           t.created_by,
          created_at:              t.created_at,
        })));

        const links: Record<string, string> = {};
        const fbs:   Record<string, string> = {};
        const qs:    Record<string, string> = {};
        res.data.forEach((t: any) => {
          links[t.id] = t.teams_link  || "";
          fbs[t.id]   = t.feedback    || "";
          qs[t.id]    = t.questions_asked || "";
        });
        setTeamsLinkInputs(links);
        setFeedbackInputs(fbs);
        setQuestionsInputs(qs);
      }
    } catch (err: any) {
      console.error("fetchTasks error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!employee) return;
    api.get<any[]>(`/api/employees?department_id=${employee.department_id}&is_active=true`)
      .then((res) => {
        if (res.success && res.data)
          setDeptEmployees(res.data.filter((e: any) => e.id !== employee.id));
      })
      .catch(() => {});
    fetchTasks();
  }, [employee]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleReassign = async (taskId: string, newEmployeeId: string) => {
    if (!newEmployeeId) return;
    setReassigningId(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}/reassign`, { assigned_to_employee_id: newEmployeeId });
      const name = deptEmployees.find((e) => e.id === newEmployeeId)?.full_name;
      toast({ title: "Reassigned", description: `Task assigned to ${name || "team member"}` });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setReassigningId(null);
  };

  const handleAcceptTask = async (taskId: string) => {
    setAccepting(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}`, { status: "in_progress" });
      toast({ title: "Task Started", description: "Status updated to In Progress." });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setAccepting(null);
  };

  const handleAddComment = async (taskId: string) => {
    const content = commentInputs[taskId]?.trim();
    if (!content) return;
    setCommenting(taskId);
    try {
      await api.post(`/api/support-tasks/${taskId}/comments`, { content });
      setCommentInputs((p) => ({ ...p, [taskId]: "" }));
      toast({ title: "Comment added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setCommenting(null);
  };

  const handleFinishResumeTask = async (task: QueueTask) => {
    const file = resumeFiles[task.id];
    if (!file) {
      toast({ title: "Upload required", description: "Please select the updated resume file first.", variant: "destructive" });
      return;
    }
    if (!task.candidate_enrollment_id) {
      toast({ title: "Error", description: "No candidate linked to this task.", variant: "destructive" });
      return;
    }
    setSaving(task.id);
    try {
      const form = new FormData();
      form.append("resume", file);
      form.append("support_task_id", task.id);
      const notes = resumeNotes[task.id]?.trim();
      if (notes) form.append("notes", notes);

      // Use raw fetch — api.post doesn't support FormData
      const token = localStorage.getItem("recruithub_token");
      const BASE   = import.meta.env.VITE_API_URL || "http://localhost:4000";
      const resp   = await fetch(`${BASE}/api/candidates/${task.candidate_enrollment_id}/resumes`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      });
      const json = await resp.json();
      if (!resp.ok || !json.success) throw new Error(json.error || "Upload failed");

      toast({ title: "Resume uploaded", description: "Task marked as completed." });
      setResumeFiles((p) => ({ ...p, [task.id]: null }));
      setResumeNotes((p) => ({ ...p, [task.id]: "" }));
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(null);
  };

  // ── Call-task handlers ───────────────────────────────────────────────────────

  const handleSendTeamsLink = async (taskId: string) => {
    const link = teamsLinkInputs[taskId]?.trim();
    if (!link) {
      toast({ title: "Error", description: "Please enter a Teams link", variant: "destructive" });
      return;
    }
    setSaving(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}`, {
        teams_link: link, link_sent_at: new Date().toISOString(),
        call_status: "link_sent", status: "in_progress",
      });
      toast({ title: "Link Sent" });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(null);
  };

  const handleSubmitFeedback = async (taskId: string, callStatus: string) => {
    setSaving(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}`, {
        call_status: callStatus,
        feedback: feedbackInputs[taskId] || null,
        questions_asked: questionsInputs[taskId] || null,
        status: "completed",
        completed_at: new Date().toISOString(),
      });
      toast({ title: "Updated", description: "Feedback submitted successfully" });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setSaving(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== "completed");

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">My Support Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tasks assigned to you — accept, work on them, and mark them complete
        </p>
      </div>

      {/* Active Tasks */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Active ({activeTasks.length})
        </h2>
        {activeTasks.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center">
            <p className="text-muted-foreground">No active tasks in your queue</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeTasks.map((task) => {
              const isResumeTask = RESUME_TASK_TYPES.has(task.task_type);
              const isExpanded   = expandedTask === task.id;

              // Badge config
              const statusCfg = isResumeTask
                ? (TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.pending)
                : (CALL_STATUS_CONFIG[task.call_status] || CALL_STATUS_CONFIG.not_started);

              return (
                <div key={task.id} className="bg-card rounded-lg border border-border overflow-hidden">
                  {/* Header */}
                  <button
                    type="button"
                    onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                    className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="bg-primary/10 text-primary border-0 text-xs">
                          {TYPE_LABELS[task.task_type] || task.task_type}
                        </Badge>
                        <Badge variant="outline" className={`${statusCfg.color} border-0 text-xs`}>
                          <statusCfg.icon className="w-3 h-3 mr-1" />
                          {statusCfg.label}
                        </Badge>
                      </div>
                      <p className="text-sm font-medium text-foreground mt-1">{task.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {task.company_name && `${task.company_name} · `}
                        {task.interview_round && `${ROUND_LABELS[task.interview_round] || task.interview_round} · `}
                        {task.scheduled_date && format(new Date(task.scheduled_date + "T00:00:00"), "MMM d, yyyy")}
                        {task.start_time && ` at ${task.start_time.slice(0, 5)}`}
                        {isResumeTask && task.deadline_date && `Due: ${format(new Date(task.deadline_date + "T00:00:00"), "MMM d, yyyy")}`}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      From: {task.created_by_name || "—"}
                    </span>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {/* Expanded body */}
                  {isExpanded && (
                    <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
                      {/* Candidate details */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                        <div>
                          <span className="text-xs text-muted-foreground block">Email</span>
                          <span className="text-foreground">{task.candidate_email || "—"}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Phone</span>
                          <span className="text-foreground">{task.candidate_phone || "—"}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">Technology</span>
                          <span className="text-foreground">{task.candidate_technology || "—"}</span>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground block">
                            {isResumeTask ? "Deadline" : "Scheduled"}
                          </span>
                          <span className="text-foreground">
                            {isResumeTask
                              ? (task.deadline_date ? format(new Date(task.deadline_date + "T00:00:00"), "MMM d, yyyy") : "—")
                              : (task.scheduled_date ? `${format(new Date(task.scheduled_date + "T00:00:00"), "MMM d")}${task.start_time ? ` ${task.start_time.slice(0, 5)}` : ""}` : "—")
                            }
                          </span>
                        </div>
                      </div>

                      {/* Notes from creator */}
                      {task.notes && (
                        <div className="bg-secondary/50 rounded-md p-3">
                          <span className="text-xs text-muted-foreground block mb-1">Notes from requester</span>
                          <p className="text-sm text-foreground">{task.notes}</p>
                        </div>
                      )}

                      {/* Reassign */}
                      {deptEmployees.length > 0 && (
                        <div className="border-t border-border pt-4">
                          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                            <UserCheck className="w-3 h-3" /> Reassign to Team Member
                          </label>
                          <div className="flex gap-2">
                            <select
                              defaultValue=""
                              disabled={reassigningId === task.id}
                              onChange={(e) => { if (e.target.value) handleReassign(task.id, e.target.value); }}
                              className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                            >
                              <option value="">Select person to reassign...</option>
                              {deptEmployees.map((e) => (
                                <option key={e.id} value={e.id}>{e.full_name}</option>
                              ))}
                            </select>
                            {reassigningId === task.id && <Loader2 className="w-4 h-4 animate-spin self-center text-primary" />}
                          </div>
                        </div>
                      )}

                      {/* ── RESUME TASK FLOW ── */}
                      {isResumeTask ? (
                        <div className="border-t border-border pt-4 space-y-4">

                          {/* Accept task if still pending */}
                          {task.status === "pending" && (
                            <Button
                              onClick={() => handleAcceptTask(task.id)}
                              disabled={accepting === task.id}
                              className="w-full sm:w-auto"
                            >
                              {accepting === task.id
                                ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                : <PlayCircle className="w-4 h-4 mr-2" />}
                              Accept & Start Working
                            </Button>
                          )}

                          {/* Add Comment */}
                          <div>
                            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1 mb-2">
                              <MessageSquare className="w-3 h-3" /> Add Comment
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Add a note or update..."
                                value={commentInputs[task.id] || ""}
                                onChange={(e) => setCommentInputs((p) => ({ ...p, [task.id]: e.target.value }))}
                                onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(task.id); }}
                                className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddComment(task.id)}
                                disabled={commenting === task.id || !commentInputs[task.id]?.trim()}
                              >
                                {commenting === task.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Post"}
                              </Button>
                            </div>
                          </div>

                          {/* Upload resume & finish */}
                          <div className="border border-dashed border-border rounded-lg p-4 space-y-3 bg-secondary/30">
                            <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <FileText className="w-3 h-3" /> Upload Updated Resume to Finish Task
                            </p>

                            <div
                              className="cursor-pointer"
                              onClick={() => fileInputRefs.current[task.id]?.click()}
                            >
                              <div className="flex items-center gap-3 border border-input rounded-md px-3 py-2 bg-background hover:bg-secondary/50 transition-colors">
                                <Upload className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className={`text-sm truncate ${resumeFiles[task.id] ? "text-foreground" : "text-muted-foreground"}`}>
                                  {resumeFiles[task.id]?.name || "Click to select resume file (PDF/DOC)"}
                                </span>
                              </div>
                              <input
                                ref={(el) => { fileInputRefs.current[task.id] = el; }}
                                type="file"
                                accept=".pdf,.doc,.docx"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0] || null;
                                  setResumeFiles((p) => ({ ...p, [task.id]: file }));
                                }}
                              />
                            </div>

                            <Textarea
                              placeholder="Optional: notes about changes made..."
                              value={resumeNotes[task.id] || ""}
                              onChange={(e) => setResumeNotes((p) => ({ ...p, [task.id]: e.target.value }))}
                              rows={2}
                            />

                            <Button
                              onClick={() => handleFinishResumeTask(task)}
                              disabled={saving === task.id || !resumeFiles[task.id]}
                              className="w-full bg-success hover:bg-success/90 text-success-foreground"
                            >
                              {saving === task.id
                                ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Uploading...</>
                                : <><CheckCircle className="w-4 h-4 mr-2" /> Finish Task &amp; Upload Resume</>}
                            </Button>
                          </div>
                        </div>
                      ) : (
                        /* ── CALL TASK FLOW ── */
                        <>
                          {/* Teams Link */}
                          <div className="border-t border-border pt-4">
                            <label className="text-xs font-medium text-muted-foreground block mb-2">
                              <Link2 className="w-3 h-3 inline mr-1" />
                              Microsoft Teams Link
                            </label>
                            <div className="flex flex-col gap-2 sm:flex-row">
                              <input
                                type="url"
                                placeholder="Paste Teams meeting link here..."
                                value={teamsLinkInputs[task.id] || ""}
                                onChange={(e) => setTeamsLinkInputs((p) => ({ ...p, [task.id]: e.target.value }))}
                                className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                disabled={task.call_status === "completed"}
                              />
                              {(task.call_status === "not_started" || task.call_status === "link_sent") && (
                                <Button
                                  size="sm"
                                  onClick={() => handleSendTeamsLink(task.id)}
                                  disabled={saving === task.id}
                                  className="w-full sm:w-auto"
                                >
                                  {saving === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Link"}
                                </Button>
                              )}
                            </div>
                            {task.link_sent_at && (
                              <p className="text-xs text-success mt-1">
                                Link sent {format(new Date(task.link_sent_at), "MMM d, yyyy 'at' h:mm a")}
                              </p>
                            )}
                            {task.teams_link && (
                              <a
                                href={task.teams_link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
                              >
                                <ExternalLink className="w-3 h-3" /> Open Meeting
                              </a>
                            )}
                          </div>

                          {/* Post-Call Feedback */}
                          {(task.call_status === "link_sent" || task.call_status === "completed") && (
                            <div className="border-t border-border pt-4 space-y-3">
                              <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                                <MessageSquare className="w-3 h-3" /> Post-Call Feedback
                              </h4>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Feedback / Interview Details</label>
                                <Textarea
                                  placeholder="Describe how the interview/assessment went..."
                                  value={feedbackInputs[task.id] || ""}
                                  onChange={(e) => setFeedbackInputs((p) => ({ ...p, [task.id]: e.target.value }))}
                                  rows={3}
                                  disabled={task.call_status === "completed"}
                                />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground block mb-1">Questions Asked</label>
                                <Textarea
                                  placeholder="List the questions asked during the interview..."
                                  value={questionsInputs[task.id] || ""}
                                  onChange={(e) => setQuestionsInputs((p) => ({ ...p, [task.id]: e.target.value }))}
                                  rows={3}
                                  disabled={task.call_status === "completed"}
                                />
                              </div>
                              {task.call_status !== "completed" && (
                                <div className="flex flex-wrap gap-2 pt-2">
                                  <Button
                                    onClick={() => handleSubmitFeedback(task.id, "completed")}
                                    disabled={saving === task.id}
                                    className="bg-success hover:bg-success/90 text-success-foreground w-full sm:w-auto"
                                  >
                                    {saving === task.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                    Call Completed
                                  </Button>
                                  <Button variant="outline" onClick={() => handleSubmitFeedback(task.id, "no_show")} disabled={saving === task.id} className="w-full sm:w-auto">
                                    <XCircle className="w-4 h-4 mr-1" /> No Show
                                  </Button>
                                  <Button variant="outline" onClick={() => handleSubmitFeedback(task.id, "cancelled")} disabled={saving === task.id} className="w-full sm:w-auto">
                                    Cancelled
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
}
