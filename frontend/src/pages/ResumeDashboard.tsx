import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Loader2, FileText, CheckCircle, Clock, Users, AlertCircle, MessageSquare, Send, Paperclip } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TeamPerformancePanel from "@/components/TeamPerformancePanel";

interface ResumeTask {
  id: string;
  task_type: string;
  status: string;
  priority: string;
  candidate_name: string;
  candidate_technology: string | null;
  created_by_name: string;
  created_by_department: string;
  assigned_employee_name: string | null;
  support_person_name: string | null;
  preferred_handler_name: string | null;
  scheduled_date: string | null;
  deadline_date: string | null;
  notes: string | null;
  created_at: string;
  company_name: string | null;
}

interface TaskComment {
  id: string;
  content: string;
  created_at: string;
  employee_name: string;
  employee_designation: string | null;
}

const STATUS_OPTIONS = [
  { value: "pending", label: "Queued", color: "bg-warning/10 text-warning border-warning/20" },
  { value: "in_progress", label: "In Progress", color: "bg-info/10 text-info border-info/20" },
  { value: "not_reached", label: "Not Reached", color: "bg-destructive/10 text-destructive border-destructive/20" },
  { value: "completed", label: "Completed", color: "bg-success/10 text-success border-success/20" },
];

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-destructive/10 text-destructive",
  high: "bg-warning/10 text-warning",
  medium: "bg-muted text-muted-foreground",
  low: "bg-secondary text-secondary-foreground",
};

export default function ResumeDashboard() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<ResumeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, TaskComment[]>>({});
  const [newComment, setNewComment] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const res = await api.get<ResumeTask[]>(
      '/api/support-tasks?type=resume_building&limit=100'
    );
    setTasks(
      (res.data ?? []).map((t: any) => ({
        id: t.id,
        task_type: t.task_type,
        status: t.status,
        priority: t.priority ?? 'medium',
        candidate_name: t.candidate_name ?? 'Unknown',
        candidate_technology: null,
        created_by_name: t.created_by_name ?? 'Unknown',
        created_by_department: t.department_name ?? '',
        assigned_employee_name: t.assigned_to_name ?? null,
        support_person_name: t.assigned_to_name ?? null,
        preferred_handler_name: null,
        scheduled_date: t.scheduled_at ?? null,
        deadline_date: null,
        notes: t.notes ?? null,
        created_at: t.created_at,
        company_name: null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!employee) return;
    fetchTasks();
  }, [employee, fetchTasks]);

  const fetchComments = async (taskId: string) => {
    const res = await api.get<any>(`/api/support-tasks/${taskId}`);
    const taskData = res.data;
    if (taskData?.comments) {
      setComments((prev) => ({
        ...prev,
        [taskId]: taskData.comments.map((c: any) => ({
          id: c.id,
          content: c.content,
          created_at: c.created_at,
          employee_name: c.author_name ?? 'Unknown',
          employee_designation: null,
        })),
      }));
    }
  };

  const toggleExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      if (!comments[taskId]) fetchComments(taskId);
    }
  };

  const addComment = async (taskId: string) => {
    if (!employee || !newComment.trim()) return;
    setSubmittingComment(true);
    try {
      await api.post(`/api/support-tasks/${taskId}/comments`, { content: newComment.trim() });
      setNewComment("");
      fetchComments(taskId);
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingStatus(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}/status`, { status: newStatus });
      fetchTasks();
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err?.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const queuedCount = tasks.filter((t) => t.status === "pending").length;
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;
  const notReachedCount = tasks.filter((t) => t.status === "not_reached").length;
  const completedCount = tasks.filter((t) => t.status === "completed").length;

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
        <h1 className="text-2xl font-bold text-foreground">Resume Department</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage resume building & rebuilding requests from Sales and Marketing
        </p>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-4 card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-xs font-medium text-muted-foreground">In Queue</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{queuedCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-info" />
            <span className="text-xs font-medium text-muted-foreground">In Progress</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{inProgressCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-medium text-muted-foreground">Not Reached</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{notReachedCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4 card-elevated">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{completedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 items-center">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All Statuses ({tasks.length})</option>
          <option value="pending">Queued ({queuedCount})</option>
          <option value="in_progress">In Progress ({inProgressCount})</option>
          <option value="not_reached">Not Reached ({notReachedCount})</option>
          <option value="completed">Completed ({completedCount})</option>
        </select>
      </div>

      {/* Task Queue */}
      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-card rounded-lg border border-border p-8 text-center text-muted-foreground">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No resume tasks found</p>
          </div>
        )}

        {filtered.map((task) => {
          const isExpanded = expandedTask === task.id;
          const taskComments = comments[task.id] || [];
          const statusInfo = STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];

          return (
            <div key={task.id} className="bg-card rounded-lg border border-border overflow-hidden card-elevated">
              {/* Task row */}
              <div
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 cursor-pointer hover:bg-secondary/30 transition-colors"
                onClick={() => toggleExpand(task.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm text-foreground">{task.candidate_name}</span>
                    {task.candidate_technology && (
                      <Badge variant="outline" className="text-xs">{task.candidate_technology}</Badge>
                    )}
                    <Badge variant="outline" className="text-xs capitalize">
                      {task.task_type.replace("_", " ")}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    From <span className="font-medium">{task.created_by_name}</span>
                    {task.created_by_department && ` (${task.created_by_department})`}
                    {" · "}
                    {format(new Date(task.created_at), "MMM d, h:mm a")}
                    {task.company_name && ` · ${task.company_name}`}
                    {task.support_person_name && (
                      <> · <span className="text-primary font-medium">Working: {task.support_person_name}</span></>
                    )}
                  </p>
                  {task.preferred_handler_name && (
                    <Badge variant="outline" className="text-[10px] mt-1 border-primary/40 text-primary">
                      ⭐ Preferred: {task.preferred_handler_name}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${PRIORITY_COLORS[task.priority] || ""}`}>
                    {task.priority}
                  </span>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                  {taskComments.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <MessageSquare className="w-3 h-3" /> {taskComments.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Expanded section */}
              {isExpanded && (
                <div className="border-t border-border">
                  {/* Task details */}
                  <div className="p-4 bg-secondary/20 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <span className="text-xs text-muted-foreground block">Assigned To</span>
                      <span className="text-foreground">{task.assigned_employee_name || "Unassigned"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Working On It</span>
                      <span className="text-foreground">{task.support_person_name || "Not picked up"}</span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Scheduled</span>
                      <span className="text-foreground">
                        {task.scheduled_date ? format(new Date(task.scheduled_date), "MMM d, yyyy") : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Deadline</span>
                      <span className="text-foreground">
                        {task.deadline_date ? format(new Date(task.deadline_date), "MMM d, yyyy") : "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground block">Update Status</span>
                      <select
                        value={task.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value)}
                        disabled={updatingStatus === task.id}
                        className="border border-input rounded px-2 py-1 text-xs bg-background text-foreground"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {task.notes && (
                    <div className="px-4 py-2 bg-secondary/10 text-sm text-muted-foreground border-t border-border">
                      <span className="font-medium text-foreground text-xs">Notes: </span>{task.notes}
                    </div>
                  )}

                  {/* Comments section */}
                  <div className="p-4 space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      Activity & Comments ({taskComments.length})
                    </h4>

                    {taskComments.length === 0 && (
                      <p className="text-xs text-muted-foreground">No comments yet. Add updates visible to all departments.</p>
                    )}

                    <div className="space-y-2 max-h-60 overflow-y-auto">
                      {taskComments.map((c) => (
                        <div key={c.id} className="flex gap-2">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-[10px] font-bold text-primary">
                              {c.employee_name.charAt(0)}
                            </span>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-baseline gap-2">
                              <span className="text-xs font-medium text-foreground">{c.employee_name}</span>
                              {c.employee_designation && (
                                <span className="text-[10px] text-muted-foreground">{c.employee_designation}</span>
                              )}
                              <span className="text-[10px] text-muted-foreground">
                                {format(new Date(c.created_at), "MMM d, h:mm a")}
                              </span>
                            </div>
                            <p className="text-sm text-foreground mt-0.5">{c.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add comment */}
                    <div className="flex gap-2 pt-2 border-t border-border" onClick={(e) => e.stopPropagation()}>
                      <Textarea
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Add a comment visible to all departments..."
                        className="min-h-[36px] text-sm resize-none"
                        rows={1}
                        maxLength={2000}
                      />
                      <Button
                        size="sm"
                        onClick={() => addComment(task.id)}
                        disabled={submittingComment || !newComment.trim()}
                        className="flex-shrink-0"
                      >
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
        </TabsContent>

        <TabsContent value="performance">
          <TeamPerformancePanel departmentSlug="resume" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
