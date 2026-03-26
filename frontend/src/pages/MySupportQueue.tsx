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
  RotateCcw,
  UserCheck,
  Edit3,
} from "lucide-react";
import { format } from "date-fns";

interface QueueTask {
  id: string;
  task_type: string;
  candidate_name: string;
  candidate_email: string | null;
  candidate_phone: string | null;
  candidate_technology: string | null;
  company_name: string | null;
  interview_round: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  deadline_date: string | null;
  job_description: string | null;
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
  interview_support: "Interview Support",
  assessment_support: "Assessment Support",
  ruc: "RUC",
  mock_call: "Mock Call",
  preparation_call: "Prep Call",
};

const ROUND_LABELS: Record<string, string> = {
  screening: "Screening",
  phone_call: "Phone Call",
  "1st_round": "1st Round",
  "2nd_round": "2nd Round",
  "3rd_round": "3rd Round",
  final_round: "Final Round",
};

const CALL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  not_started: { label: "Not Started", color: "bg-muted text-muted-foreground", icon: Clock },
  link_sent: { label: "Link Sent", color: "bg-info/10 text-info", icon: Link2 },
  completed: { label: "Completed", color: "bg-success/10 text-success", icon: CheckCircle },
  no_show: { label: "No Show", color: "bg-destructive/10 text-destructive", icon: XCircle },
  cancelled: { label: "Cancelled", color: "bg-destructive/10 text-destructive", icon: XCircle },
};

export default function MySupportQueue() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [teamsLinkInputs, setTeamsLinkInputs] = useState<Record<string, string>>({});
  const [feedbackInputs, setFeedbackInputs] = useState<Record<string, string>>({});
  const [questionsInputs, setQuestionsInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<{ id: string; full_name: string }[]>([]);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reopeningId, setReopeningId] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = async () => {
    if (!employee) return;
    try {
      const res = await api.get<any[]>(`/api/support-tasks?assigned_to=${employee.id}`);
      if (res.success && res.data) {
        setTasks(res.data.map((t: any) => ({
          id: t.id,
          task_type: t.task_type,
          candidate_name: t.candidate_name ?? t.candidates?.full_name ?? "Unknown",
          candidate_email: t.candidate_email ?? t.candidates?.email ?? null,
          candidate_phone: t.candidate_phone ?? t.candidates?.phone ?? null,
          candidate_technology: t.candidate_technology ?? null,
          company_name: t.company_name,
          interview_round: t.interview_round,
          scheduled_date: t.scheduled_date,
          start_time: t.start_time,
          end_time: t.end_time,
          deadline_date: t.deadline_date,
          job_description: t.job_description,
          notes: t.notes,
          status: t.status,
          priority: t.priority,
          call_status: t.call_status || "not_started",
          teams_link: t.teams_link,
          link_sent_at: t.link_sent_at,
          feedback: t.feedback,
          questions_asked: t.questions_asked,
          created_by_name: t.created_by_name ?? t.creator?.full_name ?? null,
          created_by_id: t.created_by,
          created_at: t.created_at,
        })));

        const links: Record<string, string> = {};
        const fbs: Record<string, string> = {};
        const qs: Record<string, string> = {};
        res.data.forEach((t: any) => {
          links[t.id] = t.teams_link || "";
          fbs[t.id] = t.feedback || "";
          qs[t.id] = t.questions_asked || "";
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

    // Fetch dept employees for reassign dropdown
    api.get<any[]>(`/api/employees?department_id=${employee.department_id}&is_active=true`)
      .then((res) => {
        if (res.success && res.data) {
          setDeptEmployees(res.data.filter((e: any) => e.id !== employee.id));
        }
      })
      .catch(() => {});

    fetchTasks();
  }, [employee]);

  const handleReassign = async (taskId: string, newEmployeeId: string) => {
    if (!newEmployeeId) return;
    setReassigningId(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}/reassign`, {
        assigned_to_employee_id: newEmployeeId,
      });
      const newPerson = deptEmployees.find((e) => e.id === newEmployeeId);
      toast({ title: "Reassigned", description: `Task assigned to ${newPerson?.full_name || "team member"}` });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setReassigningId(null);
  };

  const handleReopenTask = async (taskId: string) => {
    setReopeningId(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}`, {
        status: "pending",
        call_status: "not_started",
        completed_at: null,
      });
      toast({ title: "Task Reopened", description: "Task moved back to your active queue." });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
    setReopeningId(null);
  };

  const handleRequestEdit = async (_task: QueueTask) => {
    if (!employee) return;
    try {
      // Notifications not yet implemented — inform user directly
      toast({ title: "Request Noted", description: "Please contact your TL directly to request an edit." });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSendTeamsLink = async (taskId: string) => {
    const link = teamsLinkInputs[taskId]?.trim();
    if (!link) {
      toast({ title: "Error", description: "Please enter a Teams link", variant: "destructive" });
      return;
    }
    setSaving(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}`, {
        teams_link: link,
        link_sent_at: new Date().toISOString(),
        call_status: "link_sent",
        status: "in_progress",
      });
      toast({ title: "Link Sent", description: "Teams link saved." });
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


  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const activeTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Support Queue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tasks assigned to you — add Teams links and submit post-call feedback
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
          activeTasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            const cs = CALL_STATUS_CONFIG[task.call_status] || CALL_STATUS_CONFIG.not_started;

            return (
              <div key={task.id} className="bg-card rounded-lg border border-border overflow-hidden">
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
                      <Badge variant="outline" className={`${cs.color} border-0 text-xs`}>
                        <cs.icon className="w-3 h-3 mr-1" />
                        {cs.label}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1">{task.candidate_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.company_name && `${task.company_name} · `}
                      {task.interview_round && `${ROUND_LABELS[task.interview_round] || task.interview_round} · `}
                      {task.scheduled_date && format(new Date(task.scheduled_date + "T00:00:00"), "MMM d, yyyy")}
                      {task.start_time && ` at ${task.start_time.slice(0, 5)}`}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    From: {task.created_by_name || "—"}
                  </span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-border pt-4 space-y-4">
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
                        <span className="text-xs text-muted-foreground block">Scheduled</span>
                        <span className="text-foreground">
                          {task.scheduled_date ? format(new Date(task.scheduled_date + "T00:00:00"), "MMM d, yyyy") : "—"}
                          {task.start_time && ` ${task.start_time.slice(0, 5)}`}
                          {task.end_time && ` - ${task.end_time.slice(0, 5)}`}
                        </span>
                      </div>
                    </div>

                    {task.job_description && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Job Description</span>
                        <p className="text-sm text-foreground bg-secondary/50 rounded-md p-3 whitespace-pre-wrap">{task.job_description}</p>
                      </div>
                    )}

                    {task.notes && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Notes</span>
                        <p className="text-sm text-foreground bg-secondary/50 rounded-md p-3">{task.notes}</p>
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

                    {/* Teams Link Section */}
                    <div className="border-t border-border pt-4">
                      <label className="text-xs font-medium text-muted-foreground block mb-2">
                        <Link2 className="w-3 h-3 inline mr-1" />
                        Microsoft Teams Link
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          placeholder="Paste Teams meeting link here..."
                          value={teamsLinkInputs[task.id] || ""}
                          onChange={(e) => setTeamsLinkInputs((p) => ({ ...p, [task.id]: e.target.value }))}
                          className="flex-1 border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          disabled={task.call_status === "completed"}
                        />
                        {task.call_status === "not_started" || task.call_status === "link_sent" ? (
                          <Button
                            size="sm"
                            onClick={() => handleSendTeamsLink(task.id)}
                            disabled={saving === task.id}
                          >
                            {saving === task.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Link"}
                          </Button>
                        ) : null}
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
                          <div className="flex gap-2 pt-2">
                            <Button
                              onClick={() => handleSubmitFeedback(task.id, "completed")}
                              disabled={saving === task.id}
                              className="bg-success hover:bg-success/90 text-success-foreground"
                            >
                              {saving === task.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                              Call Completed
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleSubmitFeedback(task.id, "no_show")}
                              disabled={saving === task.id}
                            >
                              <XCircle className="w-4 h-4 mr-1" />
                              No Show
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => handleSubmitFeedback(task.id, "cancelled")}
                              disabled={saving === task.id}
                            >
                              Cancelled
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Completed Tasks */}
      {completedTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Completed ({completedTasks.length})
          </h2>
          {completedTasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            return (
              <div key={task.id} className="bg-card rounded-lg border border-border overflow-hidden opacity-80">
                <button
                  type="button"
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  className="w-full px-5 py-3 flex items-center gap-4 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium text-foreground">{task.candidate_name}</span>
                      <Badge variant="outline" className="bg-primary/10 text-primary border-0 text-xs">
                        {TYPE_LABELS[task.task_type] || task.task_type}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground ml-6">
                      {task.company_name} · {task.call_status === "completed" ? "Completed" : task.call_status === "no_show" ? "No Show" : "Cancelled"}
                    </p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>
                {isExpanded && (
                  <div className="px-5 pb-4 border-t border-border pt-3 space-y-3">
                    {task.feedback && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Feedback</span>
                        <p className="text-sm text-foreground bg-secondary/50 rounded-md p-3">{task.feedback}</p>
                      </div>
                    )}
                    {task.questions_asked && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Questions Asked</span>
                        <p className="text-sm text-foreground bg-secondary/50 rounded-md p-3 whitespace-pre-wrap">{task.questions_asked}</p>
                      </div>
                    )}
                    {task.teams_link && (
                      <p className="text-xs text-muted-foreground">Teams Link: {task.teams_link}</p>
                    )}
                    {employee?.role === "team_lead" || employee?.role === "director" || employee?.role === "ops_head" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReopenTask(task.id)}
                        disabled={reopeningId === task.id}
                        className="border-info text-info hover:bg-info/10"
                      >
                        {reopeningId === task.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                        Reopen & Edit
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRequestEdit(task)}
                        className="border-warning text-warning hover:bg-warning/10"
                      >
                        <Edit3 className="w-4 h-4 mr-1" />
                        Request Edit
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
