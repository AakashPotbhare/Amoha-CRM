import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Loader2, FileText, CheckCircle, Clock, Users, AlertCircle, MessageSquare, Send, UploadCloud } from "lucide-react";
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
  candidate_enrollment_id: string | null;
}

interface TaskComment {
  id: string;
  content: string;
  created_at: string;
  employee_name: string;
  employee_designation: string | null;
}

interface ResumeVersion {
  id: string;
  file_url: string;
  file_name: string;
  notes: string | null;
  is_current: boolean;
  created_at: string;
  uploaded_by_name?: string | null;
}

interface EmployeeOption {
  id: string;
  full_name: string;
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
  const [resumeLogs, setResumeLogs] = useState<Record<string, ResumeVersion[]>>({});
  const [resumeNotes, setResumeNotes] = useState<Record<string, string>>({});
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [loadingResumeLogsFor, setLoadingResumeLogsFor] = useState<string | null>(null);
  const [uploadingResumeFor, setUploadingResumeFor] = useState<string | null>(null);
  const [deptEmployees, setDeptEmployees] = useState<EmployeeOption[]>([]);
  const [assigningTaskId, setAssigningTaskId] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    const response = await api.get<ResumeTask[]>("/api/support-tasks?limit=100");
    setTasks(
      (response.data ?? [])
        .filter((task: any) => ["resume_building", "resume_rebuilding"].includes(task.task_type))
        .map((task: any) => ({
        id: task.id,
        task_type: task.task_type,
        status: task.status,
        priority: task.priority ?? "medium",
        candidate_name: task.candidate_name ?? "Unknown",
        candidate_technology: null,
        created_by_name: task.created_by_name ?? "Unknown",
        created_by_department: task.department_name ?? "",
        assigned_employee_name: task.assigned_to_name ?? null,
        support_person_name: task.assigned_to_name ?? null,
        preferred_handler_name: null,
        scheduled_date: task.scheduled_at ?? null,
        deadline_date: null,
        notes: task.notes ?? null,
        created_at: task.created_at,
        company_name: null,
        candidate_enrollment_id: task.candidate_enrollment_id ?? null,
      }))
    );
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!employee) return;
    void fetchTasks();
  }, [employee, fetchTasks]);

  useEffect(() => {
    if (!employee || employee.role !== "resume_head") return;

    api.get<EmployeeOption[]>(`/api/employees?department_id=${employee.department_id}&is_active=true`)
      .then((response) => {
        setDeptEmployees((response.data ?? []).filter((member) => member.id !== employee.id));
      })
      .catch(() => {});
  }, [employee]);

  const fetchComments = async (taskId: string) => {
    const response = await api.get<any>(`/api/support-tasks/${taskId}`);
    const taskData = response.data;
    if (taskData?.comments) {
      setComments((current) => ({
        ...current,
        [taskId]: taskData.comments.map((comment: any) => ({
          id: comment.id,
          content: comment.content,
          created_at: comment.created_at,
          employee_name: comment.author_name ?? "Unknown",
          employee_designation: null,
        })),
      }));
    }
  };

  const fetchResumeLogs = async (task: ResumeTask) => {
    if (!task.candidate_enrollment_id) return;
    setLoadingResumeLogsFor(task.id);
    try {
      const response = await api.get<ResumeVersion[]>(`/api/candidates/${task.candidate_enrollment_id}/resumes`);
      setResumeLogs((current) => ({ ...current, [task.id]: response.data ?? [] }));
    } catch (err: any) {
      toast({ title: "Failed to load resume history", description: err.message, variant: "destructive" });
    } finally {
      setLoadingResumeLogsFor(null);
    }
  };

  const toggleExpand = (task: ResumeTask) => {
    if (expandedTask === task.id) {
      setExpandedTask(null);
      return;
    }
    setExpandedTask(task.id);
    if (!comments[task.id]) void fetchComments(task.id);
    if (!resumeLogs[task.id] && task.candidate_enrollment_id) void fetchResumeLogs(task);
  };

  const addComment = async (taskId: string) => {
    const content = commentDrafts[taskId]?.trim();
    if (!employee || !content) return;
    setSubmittingComment(true);
    try {
      await api.post(`/api/support-tasks/${taskId}/comments`, { content });
      setCommentDrafts((current) => ({ ...current, [taskId]: "" }));
      await fetchComments(taskId);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingComment(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    setUpdatingStatus(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}/status`, { status: newStatus });
      await fetchTasks();
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUpdatingStatus(null);
    }
  };

  const uploadResume = async (task: ResumeTask, file: File) => {
    if (!task.candidate_enrollment_id) return;
    setUploadingResumeFor(task.id);
    try {
      const token = localStorage.getItem("recruithub_token");
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("notes", resumeNotes[task.id] ?? "");
      formData.append("support_task_id", task.id);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:4000"}/api/candidates/${task.candidate_enrollment_id}/resumes`,
        { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {}, body: formData }
      );
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.error || "Upload failed");

      setResumeNotes((current) => ({ ...current, [task.id]: "" }));
      await Promise.all([fetchResumeLogs(task), fetchComments(task.id), fetchTasks()]);
      toast({ title: "Resume uploaded", description: "The latest resume version is linked and the task has been completed." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingResumeFor(null);
    }
  };

  const assignTask = async (taskId: string, assigneeId: string) => {
    if (!assigneeId) return;
    setAssigningTaskId(taskId);
    try {
      await api.patch(`/api/support-tasks/${taskId}/reassign`, { assigned_to_employee_id: assigneeId });
      await fetchTasks();
      toast({ title: "Task assigned", description: "The task is now visible in that team member's queue." });
    } catch (err: any) {
      toast({ title: "Assignment failed", description: err.message, variant: "destructive" });
    } finally {
      setAssigningTaskId(null);
    }
  };

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((task) => task.status === statusFilter);
  }, [tasks, statusFilter]);

  const queuedCount = tasks.filter((task) => task.status === "pending").length;
  const inProgressCount = tasks.filter((task) => task.status === "in_progress").length;
  const notReachedCount = tasks.filter((task) => task.status === "not_reached").length;
  const completedCount = tasks.filter((task) => task.status === "completed").length;
  const selectClass = "rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (loading) {
    return <div className="flex min-h-[400px] items-center justify-center p-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resume Department</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage resume building requests and keep every candidate resume version visible in the workflow.</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <div className="card-elevated rounded-lg border border-border bg-card p-4"><div className="mb-2 flex items-center gap-2"><Clock className="h-4 w-4 text-warning" /><span className="text-xs font-medium text-muted-foreground">In Queue</span></div><p className="text-2xl font-bold text-foreground">{queuedCount}</p></div>
            <div className="card-elevated rounded-lg border border-border bg-card p-4"><div className="mb-2 flex items-center gap-2"><Users className="h-4 w-4 text-info" /><span className="text-xs font-medium text-muted-foreground">In Progress</span></div><p className="text-2xl font-bold text-foreground">{inProgressCount}</p></div>
            <div className="card-elevated rounded-lg border border-border bg-card p-4"><div className="mb-2 flex items-center gap-2"><AlertCircle className="h-4 w-4 text-destructive" /><span className="text-xs font-medium text-muted-foreground">Not Reached</span></div><p className="text-2xl font-bold text-foreground">{notReachedCount}</p></div>
            <div className="card-elevated rounded-lg border border-border bg-card p-4"><div className="mb-2 flex items-center gap-2"><CheckCircle className="h-4 w-4 text-success" /><span className="text-xs font-medium text-muted-foreground">Completed</span></div><p className="text-2xl font-bold text-foreground">{completedCount}</p></div>
          </div>

          <div className="flex items-center gap-3">
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
              <option value="all">All Statuses ({tasks.length})</option>
              <option value="pending">Queued ({queuedCount})</option>
              <option value="in_progress">In Progress ({inProgressCount})</option>
              <option value="not_reached">Not Reached ({notReachedCount})</option>
              <option value="completed">Completed ({completedCount})</option>
            </select>
          </div>

          <div className="space-y-3">
            {filtered.length === 0 && (
              <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">
                <FileText className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No resume tasks found</p>
              </div>
            )}

            {filtered.map((task) => {
              const isExpanded = expandedTask === task.id;
              const taskComments = comments[task.id] || [];
              const taskResumeLogs = resumeLogs[task.id] || [];
              const statusInfo = STATUS_OPTIONS.find((status) => status.value === task.status) || STATUS_OPTIONS[0];

              return (
                <div key={task.id} className="card-elevated overflow-hidden rounded-lg border border-border bg-card">
                  <div className="cursor-pointer p-4 transition-colors hover:bg-secondary/30" onClick={() => toggleExpand(task)}>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{task.candidate_name}</span>
                          <Badge variant="outline" className="text-xs capitalize">{task.task_type.replace("_", " ")}</Badge>
                          {task.candidate_enrollment_id && <Badge variant="secondary" className="text-xs">{taskResumeLogs.length} resume logs</Badge>}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          From <span className="font-medium">{task.created_by_name}</span>
                          {task.created_by_department && ` (${task.created_by_department})`}
                          {" | "}
                          {format(new Date(task.created_at), "MMM d, h:mm a")}
                          {task.support_person_name && <> | <span className="font-medium text-primary">Working: {task.support_person_name}</span></>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_COLORS[task.priority] || ""}`}>{task.priority}</span>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
                        {taskComments.length > 0 && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MessageSquare className="h-3 w-3" />{taskComments.length}</span>}
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border">
                      <div className="grid grid-cols-2 gap-3 bg-secondary/20 p-4 text-sm sm:grid-cols-4">
                        <div><span className="block text-xs text-muted-foreground">Assigned To</span><span className="text-foreground">{task.assigned_employee_name || "Unassigned"}</span></div>
                        <div><span className="block text-xs text-muted-foreground">Working On It</span><span className="text-foreground">{task.support_person_name || "Not picked up"}</span></div>
                        <div><span className="block text-xs text-muted-foreground">Scheduled</span><span className="text-foreground">{task.scheduled_date ? format(new Date(task.scheduled_date), "MMM d, yyyy") : "-"}</span></div>
                        <div>
                          <span className="block text-xs text-muted-foreground">Update Status</span>
                          <select value={task.status} onClick={(e) => e.stopPropagation()} onChange={(e) => void updateTaskStatus(task.id, e.target.value)} disabled={updatingStatus === task.id} className="rounded border border-input bg-background px-2 py-1 text-xs text-foreground">
                            {STATUS_OPTIONS.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
                          </select>
                        </div>
                      </div>

                      {employee?.role === "resume_head" && deptEmployees.length > 0 && (
                        <div className="flex flex-wrap items-center gap-3 border-t border-border bg-secondary/10 px-4 py-3 text-sm">
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Assign To Team Member</span>
                          <select
                            defaultValue=""
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => {
                              const assigneeId = e.target.value;
                              if (!assigneeId) return;
                              void assignTask(task.id, assigneeId);
                              e.currentTarget.value = "";
                            }}
                            disabled={assigningTaskId === task.id}
                            className="rounded border border-input bg-background px-3 py-1.5 text-xs text-foreground"
                          >
                            <option value="">Choose team member</option>
                            {deptEmployees.map((member) => (
                              <option key={member.id} value={member.id}>{member.full_name}</option>
                            ))}
                          </select>
                          {assigningTaskId === task.id && <span className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Assigning...</span>}
                        </div>
                      )}

                      {task.notes && <div className="border-t border-border bg-secondary/10 px-4 py-2 text-sm text-muted-foreground"><span className="text-xs font-medium text-foreground">Notes: </span>{task.notes}</div>}

                      {task.candidate_enrollment_id && (
                        <div className="space-y-3 border-t border-border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Resume Versions</h4>
                            {loadingResumeLogsFor === task.id && <span className="text-xs text-muted-foreground"><Loader2 className="mr-1 inline h-3 w-3 animate-spin" />Loading logs</span>}
                          </div>
                          <Textarea value={resumeNotes[task.id] ?? ""} onChange={(e) => setResumeNotes((current) => ({ ...current, [task.id]: e.target.value }))} placeholder="Add a note for the new resume version..." rows={2} />
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-4 py-2 text-sm hover:bg-muted/40">
                              <UploadCloud className="h-4 w-4" />
                              Upload Latest Resume
                              <input type="file" className="hidden" accept=".pdf,.doc,.docx" onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadResume(task, file); e.currentTarget.value = ""; }} />
                            </label>
                            {uploadingResumeFor === task.id && <span className="text-sm text-muted-foreground"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Uploading...</span>}
                          </div>
                          <div className="space-y-2">
                            {taskResumeLogs.length === 0 ? (
                              <p className="text-sm text-muted-foreground">No resume versions uploaded for this candidate yet.</p>
                            ) : (
                              taskResumeLogs.map((resume) => (
                                <div key={resume.id} className="rounded-lg border border-border p-3">
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <button onClick={() => window.open(resume.file_url, "_blank")} className="truncate text-left text-sm font-medium text-primary hover:underline">
                                        {resume.file_name}
                                      </button>
                                      <p className="mt-1 text-xs text-muted-foreground">
                                        {format(new Date(resume.created_at), "MMM d, yyyy h:mm a")} | {resume.uploaded_by_name || "Unknown"}
                                      </p>
                                      {resume.notes && <p className="mt-2 text-sm text-muted-foreground">{resume.notes}</p>}
                                    </div>
                                    {resume.is_current && <Badge>Current</Badge>}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 border-t border-border p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Activity & Comments ({taskComments.length})</h4>
                        {taskComments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Add updates visible to all departments.</p>}
                        <div className="max-h-60 space-y-2 overflow-y-auto">
                          {taskComments.map((comment) => (
                            <div key={comment.id} className="flex gap-2">
                              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10"><span className="text-[10px] font-bold text-primary">{comment.employee_name.charAt(0)}</span></div>
                              <div className="flex-1">
                                <div className="flex items-baseline gap-2">
                                  <span className="text-xs font-medium text-foreground">{comment.employee_name}</span>
                                  <span className="text-[10px] text-muted-foreground">{format(new Date(comment.created_at), "MMM d, h:mm a")}</span>
                                </div>
                                <p className="mt-0.5 text-sm text-foreground">{comment.content}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
                          <Textarea value={commentDrafts[task.id] ?? ""} onChange={(e) => setCommentDrafts((current) => ({ ...current, [task.id]: e.target.value }))} placeholder="Add a comment visible to all departments..." className="min-h-[36px] resize-none text-sm" rows={1} maxLength={2000} />
                          <Button size="sm" onClick={() => void addComment(task.id)} disabled={submittingComment || !(commentDrafts[task.id] ?? "").trim()} className="flex-shrink-0">
                            <Send className="h-3.5 w-3.5" />
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
