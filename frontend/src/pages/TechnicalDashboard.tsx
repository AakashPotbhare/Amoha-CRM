import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Headphones, CheckCircle, Clock, ChevronDown, ChevronUp, RotateCcw, MessageSquare, KeyRound, Search, Eye, EyeOff, Save } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TeamPerformancePanel from "@/components/TeamPerformancePanel";

interface SupportTask {
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
  willing_for_support: boolean;
  support_person_id: string | null;
  support_person_name: string | null;
  created_by_name: string | null;
  assigned_team_name: string | null;
  created_at: string;
  call_status: string | null;
  teams_link: string | null;
  feedback: string | null;
  questions_asked: string | null;
}

interface TeamMember {
  id: string;
  full_name: string;
  employee_code: string;
}

// Safely parse a date/datetime string without timezone shift
const safeDate = (d: string | null | undefined): Date | null => {
  if (!d) return null;
  // Take first 10 chars (YYYY-MM-DD) and force local midnight to avoid tz shift
  return new Date(d.slice(0, 10) + "T00:00:00");
};

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

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  in_progress: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

export default function TechnicalDashboard() {
  const { employee } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<SupportTask[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Leadership roles view all tasks; technical staff see their dept only
  const LEADERSHIP = ['director', 'ops_head', 'hr_head'];
  const TECH_HEADS  = ['technical_head'];

  const fetchTasks = async () => {
    if (!employee) return;
    try {
      // For leadership accessing Technical Dashboard, fetch all technical tasks.
      // For technical head/exec, the backend already scopes to their dept.
      const deptParam = LEADERSHIP.includes(employee.role)
        ? '' // backend scoping handles it for dept heads; for leadership fetch all
        : `&department_id=${employee.department_id}`;
      const res = await api.get<any[]>(`/api/support-tasks?limit=200${deptParam}`);
      setTasks(
        (res.data ?? []).filter((t: any) => {
          // For leadership, only show tasks from Technical department (this is the Technical Dashboard)
          if (LEADERSHIP.includes(employee.role)) {
            return t.department_name === 'Technical';
          }
          return true;
        }).map((t: any) => ({
          id: t.id,
          task_type: t.task_type,
          candidate_name: t.candidate_name ?? 'Unknown',
          candidate_email: null,
          candidate_phone: null,
          candidate_technology: t.candidate_technology ?? null,
          company_name: t.company_name ?? null,
          interview_round: t.interview_round ?? null,
          scheduled_date: t.scheduled_at ?? null,
          start_time: null,
          end_time: null,
          deadline_date: t.due_date ?? null,
          job_description: null,
          notes: t.notes ?? null,
          status: t.status,
          priority: t.priority ?? 'medium',
          willing_for_support: true,
          support_person_id: t.assigned_to_employee_id ?? null,
          support_person_name: t.assigned_to_name ?? null,
          created_by_name: t.created_by_name ?? null,
          assigned_team_name: t.department_name ?? null,
          created_at: t.created_at,
          call_status: t.call_status ?? null,
          teams_link: null,
          feedback: null,
          questions_asked: null,
        }))
      );
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  useEffect(() => {
    if (!employee) return;
    // For team members (tech head/exec), load their team members for assignment dropdown
    const teamId = LEADERSHIP.includes(employee.role) ? null : employee.team_id;
    if (teamId) {
      api.get<TeamMember[]>(`/api/employees?team_id=${teamId}&is_active=1`)
        .then((res) => setTeamMembers(res.data ?? []));
    }
    fetchTasks().then(() => setLoading(false));
  }, [employee]);

  const handleAssignSupport = async (taskId: string, supportPersonId: string) => {
    setAssigningId(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}/reassign`, { assigned_to_employee_id: supportPersonId });
      await api.patch(`/api/support-tasks/${taskId}/status`, { status: 'in_progress' });
      toast({ title: "Assigned", description: "Support person assigned." });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setAssigningId(null);
    }
  };

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/api/support-tasks/${taskId}/status`, { status: newStatus });
      toast({ title: "Updated", description: `Status changed to ${newStatus}` });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    }
  };

  const handleReassign = async (task: SupportTask) => {
    setAssigningId(task.id);
    try {
      await api.patch(`/api/support-tasks/${task.id}/status`, { status: 'pending' });
      toast({ title: "Reassigned", description: "Task has been reopened." });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setAssigningId(null);
    }
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      if (typeFilter !== "all" && t.task_type !== typeFilter) return false;
      return true;
    });
  }, [tasks, statusFilter, typeFilter]);

  // Stats
  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const unassignedCount = tasks.filter((t) => !t.support_person_id).length;

  const selectClass = "border border-input rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Technical Support Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View assigned support tasks and assign team members
        </p>
      </div>
      <Tabs defaultValue="kanban" className="space-y-4">
        <TabsList>
          <TabsTrigger value="kanban">Support Tasks</TabsTrigger>
          <TabsTrigger value="overview">All Tasks</TabsTrigger>
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
          <TabsTrigger value="credentials">
            <KeyRound className="w-4 h-4 mr-1.5" /> Candidate Credentials
          </TabsTrigger>
        </TabsList>

        {/* ── Kanban: 3-column status overview ── */}
        <TabsContent value="kanban" className="space-y-4">
          {/* KPI row */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Not Started", count: tasks.filter(t => !t.call_status || ["not_started","scheduled"].includes(t.call_status)).length, color: "text-warning", icon: Clock },
              { label: "Call Done", count: tasks.filter(t => ["link_sent","done","rescheduled"].includes(t.call_status || "")).length, color: "text-info", icon: MessageSquare },
              { label: "Closed", count: tasks.filter(t => ["completed","no_show"].includes(t.call_status || "") || t.status === "completed").length, color: "text-success", icon: CheckCircle },
            ].map(({ label, count, color, icon: Icon }) => (
              <div key={label} className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
                <Icon className={`w-5 h-5 ${color}`} />
                <div>
                  <p className={`text-2xl font-bold ${color}`}>{count}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Column 1: Link Pending */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-warning flex items-center gap-1.5">
                <Clock className="w-4 h-4" /> Not Started / Scheduled
              </h3>
              {tasks.filter(t => !t.call_status || ["not_started","scheduled"].includes(t.call_status)).length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-4 text-center text-xs text-muted-foreground">All tasks in progress</div>
              ) : tasks.filter(t => !t.call_status || ["not_started","scheduled"].includes(t.call_status)).map(task => (
                <div key={task.id} className="bg-card rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{task.company_name || "—"} {task.interview_round ? `· ${ROUND_LABELS[task.interview_round] || task.interview_round}` : ""}</p>
                    </div>
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded shrink-0">{TYPE_LABELS[task.task_type] || task.task_type}</span>
                  </div>
                  {task.scheduled_date && <p className="text-xs text-muted-foreground">📅 {format(safeDate(task.scheduled_date)!, "MMM d")} {task.start_time ? `at ${task.start_time.slice(0,5)}` : ""}</p>}
                  <p className="text-xs text-muted-foreground">👤 {task.support_person_name || <span className="text-warning">Unassigned</span>}</p>
                  <select
                    defaultValue=""
                    onChange={(e) => { if (e.target.value) handleAssignSupport(task.id, e.target.value); }}
                    disabled={assigningId === task.id}
                    className="w-full border border-input rounded-md px-2 py-1.5 text-xs bg-background text-foreground focus:outline-none"
                  >
                    <option value="">Reassign...</option>
                    {teamMembers.map((m) => <option key={m.id} value={m.id}>{m.full_name}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Column 2: Feedback Pending */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-info flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4" /> Feedback Pending
              </h3>
              {tasks.filter(t => ["link_sent","done","rescheduled"].includes(t.call_status || "")).length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-4 text-center text-xs text-muted-foreground">No feedback pending</div>
              ) : tasks.filter(t => ["link_sent","done","rescheduled"].includes(t.call_status || "")).map(task => (
                <div key={task.id} className="bg-card rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{task.company_name || "—"}</p>
                    </div>
                    <span className="text-xs bg-info/10 text-info px-2 py-0.5 rounded shrink-0">
                      {task.call_status === "link_sent" ? "Link Sent" : task.call_status === "done" ? "Call Done" : "Rescheduled"}
                    </span>
                  </div>
                  {task.scheduled_date && <p className="text-xs text-muted-foreground">📅 {format(safeDate(task.scheduled_date)!, "MMM d")} {task.start_time ? `at ${task.start_time.slice(0,5)}` : ""}</p>}
                  <p className="text-xs text-muted-foreground">👤 {task.support_person_name || "Unassigned"}</p>
                  {task.teams_link && <a href={task.teams_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Teams Link ↗</a>}
                </div>
              ))}
            </div>

            {/* Column 3: Completed */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-success flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4" /> Completed
              </h3>
              {tasks.filter(t => ["completed","no_show"].includes(t.call_status || "") || t.status === "completed").length === 0 ? (
                <div className="bg-card rounded-lg border border-border p-4 text-center text-xs text-muted-foreground">No completed tasks</div>
              ) : tasks.filter(t => ["completed","no_show"].includes(t.call_status || "") || t.status === "completed").map(task => (
                <div key={task.id} className="bg-card rounded-lg border border-border p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{task.candidate_name}</p>
                      <p className="text-xs text-muted-foreground">{task.company_name || "—"}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${task.call_status === "no_show" ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success"}`}>
                      {task.call_status === "no_show" ? "No Show" : "Done"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">👤 {task.support_person_name || "—"}</p>
                  {task.feedback && <p className="text-xs text-muted-foreground line-clamp-2 italic">"{task.feedback}"</p>}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full text-xs border-info text-info hover:bg-info/10"
                    onClick={() => handleReassign(task)}
                    disabled={assigningId === task.id}
                  >
                    {assigningId === task.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <RotateCcw className="w-3 h-3 mr-1" />}
                    Approve Edit / Reopen
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="overview" className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-xs font-medium text-muted-foreground">Pending</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Headphones className="w-4 h-4 text-info" />
            <span className="text-xs font-medium text-muted-foreground">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{completedCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-destructive" />
            <span className="text-xs font-medium text-muted-foreground">Unassigned</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{unassignedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className={selectClass}>
          <option value="all">All Types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 text-center">
            <p className="text-muted-foreground">No support tasks found matching your filters.</p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const isExpanded = expandedTask === task.id;
            return (
              <div key={task.id} className="bg-card rounded-lg border border-border overflow-hidden">
                {/* Header row */}
                <button
                  type="button"
                  onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                  className="w-full px-5 py-4 flex items-center gap-4 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                        {TYPE_LABELS[task.task_type] || task.task_type}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[task.status] || ""}`}>
                        {task.status}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[task.priority] || ""}`}>
                        {task.priority}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1">{task.candidate_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.company_name && `${task.company_name} · `}
                      {task.interview_round && `${ROUND_LABELS[task.interview_round] || task.interview_round} · `}
                      {task.scheduled_date && format(safeDate(task.scheduled_date)!, "MMM d, yyyy")}
                      {task.start_time && ` at ${task.start_time.slice(0, 5)}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {task.support_person_name ? (
                      <p className="text-xs text-success font-medium">Assigned: {task.support_person_name}</p>
                    ) : (
                      <p className="text-xs text-warning font-medium">Unassigned</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">By: {task.created_by_name || "—"}</p>
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />}
                </button>

                {/* Expanded details */}
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
                        <span className="text-xs text-muted-foreground block">Team</span>
                        <span className="text-foreground">{task.assigned_team_name || "—"}</span>
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                      {task.scheduled_date && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Scheduled</span>
                          <span className="text-foreground">{format(safeDate(task.scheduled_date)!, "MMM d, yyyy")}</span>
                        </div>
                      )}
                      {task.start_time && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Time</span>
                          <span className="text-foreground">{task.start_time.slice(0, 5)} - {task.end_time?.slice(0, 5) || "—"}</span>
                        </div>
                      )}
                      {task.deadline_date && (
                        <div>
                          <span className="text-xs text-muted-foreground block">Deadline</span>
                          <span className="text-foreground">{format(safeDate(task.deadline_date)!, "MMM d, yyyy")}</span>
                        </div>
                      )}
                    </div>

                    {/* JD */}
                    {task.job_description && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Job Description</span>
                        <p className="text-sm text-foreground bg-secondary/50 rounded-md p-3 whitespace-pre-wrap">{task.job_description}</p>
                      </div>
                    )}

                    {/* Notes */}
                    {task.notes && (
                      <div>
                        <span className="text-xs text-muted-foreground block mb-1">Notes</span>
                        <p className="text-sm text-foreground bg-secondary/50 rounded-md p-3">{task.notes}</p>
                      </div>
                    )}

                    {/* Call Status & Feedback from support person */}
                    {(task.call_status && task.call_status !== "not_started") && (
                      <div className="border-t border-border pt-3 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-muted-foreground">Call Status:</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            task.call_status === "completed" ? "bg-success/10 text-success" :
                            task.call_status === "link_sent" ? "bg-info/10 text-info" :
                            task.call_status === "no_show" ? "bg-destructive/10 text-destructive" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {task.call_status.replace("_", " ")}
                          </span>
                          {task.teams_link && (
                            <a href={task.teams_link} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline ml-2">
                              Teams Link ↗
                            </a>
                          )}
                        </div>
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
                      </div>
                    )}
                    {/* Assign support person + status control */}
                    <div className="flex flex-wrap items-end gap-4 pt-2 border-t border-border">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Assign Support Person</label>
                        <select
                          value={task.support_person_id || ""}
                          onChange={(e) => {
                            if (e.target.value) handleAssignSupport(task.id, e.target.value);
                          }}
                          disabled={assigningId === task.id}
                          className={selectClass}
                        >
                          <option value="">Select team member</option>
                          {teamMembers.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.full_name} ({m.employee_code})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Status</label>
                        <select
                          value={task.status}
                          onChange={(e) => handleStatusChange(task.id, e.target.value)}
                          className={selectClass}
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In Progress</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>

                      {(task.status === "completed" || task.call_status === "cancelled" || task.call_status === "no_show") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReassign(task)}
                          disabled={assigningId === task.id}
                          className="border-warning text-warning hover:bg-warning/10"
                        >
                          {assigningId === task.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <RotateCcw className="w-4 h-4 mr-1" />}
                          Reassign
                        </Button>
                      )}

                      {assigningId === task.id && (
                        <Loader2 className="w-4 h-4 animate-spin text-primary" />
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
        </TabsContent>

        <TabsContent value="performance">
          <TeamPerformancePanel departmentSlug="technical" />
        </TabsContent>

        {/* ── Candidate Credentials — filled by TL / Marketing ── */}
        <TabsContent value="credentials">
          <CandidateCredentialsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Candidate Credentials Panel ─────────────────────────────────────────────
interface CandidateRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string;
  visa_status: string | null;
  linkedin_email: string | null;
  linkedin_passcode: string | null;
  ssn_last4: string | null;
  marketing_email: string | null;
  marketing_email_password: string | null;
}

interface CredentialForm {
  linkedin_email: string;
  linkedin_passcode: string;
  ssn_last4: string;
  marketing_email: string;
  marketing_email_password: string;
}

function CandidateCredentialsPanel() {
  const { toast } = useToast();
  const [candidates, setCandidates]         = useState<CandidateRow[]>([]);
  const [loading,    setLoading]            = useState(true);
  const [search,     setSearch]             = useState("");
  const [editing,    setEditing]            = useState<string | null>(null);
  const [saving,     setSaving]             = useState<string | null>(null);
  const [showPass,   setShowPass]           = useState<Record<string, boolean>>({});
  const [formValues, setFormValues]         = useState<Record<string, CredentialForm>>({});

  async function loadCandidates() {
    try {
      const res = await api.get<any[]>("/api/candidates?limit=200");
      setCandidates(res.data ?? []);
    } catch { /* silently ignored */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadCandidates(); }, []);

  function startEdit(c: CandidateRow) {
    setEditing(c.id);
    setFormValues(prev => ({
      ...prev,
      [c.id]: {
        linkedin_email:           c.linkedin_email           ?? "",
        linkedin_passcode:        c.linkedin_passcode        ?? "",
        ssn_last4:                c.ssn_last4                ?? "",
        marketing_email:          c.marketing_email          ?? "",
        marketing_email_password: c.marketing_email_password ?? "",
      },
    }));
  }

  async function saveCredentials(candidateId: string) {
    setSaving(candidateId);
    try {
      await api.patch(`/api/candidates/${candidateId}/credentials`, formValues[candidateId]);
      toast({ title: "Credentials saved", description: "Candidate credentials updated successfully." });
      setEditing(null);
      loadCandidates();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  }

  function updateField(candidateId: string, field: keyof CredentialForm, value: string) {
    setFormValues(prev => ({
      ...prev,
      [candidateId]: { ...prev[candidateId], [field]: value },
    }));
  }

  function toggleShow(key: string) {
    setShowPass(prev => ({ ...prev, [key]: !prev[key] }));
  }

  const filtered = candidates.filter(c =>
    !search ||
    c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Candidate Credentials</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Marketing / TL fills LinkedIn &amp; marketing access details here. Not visible on the enrollment form.
          </p>
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search candidates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-12 bg-card rounded-xl border border-border">
            No candidates found.
          </div>
        )}

        {filtered.map(c => {
          const isEditing = editing === c.id;
          const vals      = formValues[c.id];
          const hasCredsSet = c.linkedin_email || c.marketing_email;

          return (
            <div key={c.id} className="bg-card border border-border rounded-xl p-4 space-y-3">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-foreground">{c.full_name}</p>
                  <p className="text-xs text-muted-foreground">{c.email ?? c.phone} · {c.visa_status ?? "—"}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {hasCredsSet && !isEditing && (
                    <span className="text-xs bg-success/10 text-success px-2 py-0.5 rounded-full">Credentials Set</span>
                  )}
                  {!isEditing ? (
                    <Button size="sm" variant="outline" onClick={() => startEdit(c)}>
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                      {hasCredsSet ? "Edit" : "Add"} Credentials
                    </Button>
                  ) : (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => saveCredentials(c.id)} disabled={saving === c.id}>
                        {saving === c.id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                        Save
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {/* Credential fields — shown when editing */}
              {isEditing && vals && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-border">
                  {/* LinkedIn Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">LinkedIn Login Email</label>
                    <Input
                      type="email"
                      placeholder="linkedin@email.com"
                      value={vals.linkedin_email}
                      onChange={e => updateField(c.id, "linkedin_email", e.target.value)}
                    />
                  </div>

                  {/* LinkedIn Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">LinkedIn Password</label>
                    <div className="relative">
                      <Input
                        type={showPass[`${c.id}-li`] ? "text" : "password"}
                        placeholder="••••••"
                        value={vals.linkedin_passcode}
                        onChange={e => updateField(c.id, "linkedin_passcode", e.target.value)}
                        className="pr-9"
                      />
                      <button type="button" onClick={() => toggleShow(`${c.id}-li`)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPass[`${c.id}-li`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* SSN Last 4 */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Last 4 Digits of SSN</label>
                    <Input
                      maxLength={4}
                      placeholder="1234"
                      value={vals.ssn_last4}
                      onChange={e => updateField(c.id, "ssn_last4", e.target.value.replace(/\D/g, ""))}
                    />
                  </div>

                  <div /> {/* spacer */}

                  {/* Marketing Email */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Marketing Email ID</label>
                    <Input
                      type="email"
                      placeholder="marketing@email.com"
                      value={vals.marketing_email}
                      onChange={e => updateField(c.id, "marketing_email", e.target.value)}
                    />
                  </div>

                  {/* Marketing Password */}
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Marketing Email Password</label>
                    <div className="relative">
                      <Input
                        type={showPass[`${c.id}-mk`] ? "text" : "password"}
                        placeholder="••••••"
                        value={vals.marketing_email_password}
                        onChange={e => updateField(c.id, "marketing_email_password", e.target.value)}
                        className="pr-9"
                      />
                      <button type="button" onClick={() => toggleShow(`${c.id}-mk`)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                        {showPass[`${c.id}-mk`] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Read-only preview when creds set & not editing */}
              {!isEditing && hasCredsSet && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-border">
                  {c.linkedin_email && (
                    <div>
                      <p className="text-xs text-muted-foreground">LinkedIn</p>
                      <p className="text-xs font-medium text-foreground truncate">{c.linkedin_email}</p>
                    </div>
                  )}
                  {c.marketing_email && (
                    <div>
                      <p className="text-xs text-muted-foreground">Marketing Email</p>
                      <p className="text-xs font-medium text-foreground truncate">{c.marketing_email}</p>
                    </div>
                  )}
                  {c.ssn_last4 && (
                    <div>
                      <p className="text-xs text-muted-foreground">SSN Last 4</p>
                      <p className="text-xs font-medium text-foreground">••••{c.ssn_last4}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
