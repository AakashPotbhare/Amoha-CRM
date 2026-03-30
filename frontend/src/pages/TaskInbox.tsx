import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  created_by_employee_id: string;
  assigned_to_employee_id: string | null;
  assigned_to_name?: string | null;
  created_by_name?: string | null;
  assigned_department_name?: string | null;
  assigned_team_name?: string | null;
  is_edited?: boolean;
  latest_change_request_status?: string | null;
  latest_change_request_action?: string | null;
}

interface ChangeRequestRow {
  id: string;
  task_id: string;
  task_title: string;
  action: "update" | "delete";
  status: "pending" | "approved" | "rejected";
  requested_by_name?: string | null;
  approver_name?: string | null;
  requested_changes?: Record<string, unknown> | null;
  reason?: string | null;
  review_note?: string | null;
  created_at: string;
}

interface EmployeeOption {
  id: string;
  full_name: string;
  department_id: string;
  team_id: string;
}

const priorityColors: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-info/10 text-info",
  high: "bg-warning/10 text-warning",
  urgent: "bg-destructive/10 text-destructive",
};

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  in_progress: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
};

const MANAGER_ROLES = ["ops_head", "hr_head", "sales_head", "technical_head", "marketing_tl", "resume_head", "assistant_tl"];

export default function TaskInbox() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const [assignedTasks, setAssignedTasks] = useState<TaskRow[]>([]);
  const [createdTasks, setCreatedTasks] = useState<TaskRow[]>([]);
  const [myRequests, setMyRequests] = useState<ChangeRequestRow[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ChangeRequestRow[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [savingTaskId, setSavingTaskId] = useState<string | null>(null);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    due_date: "",
    priority: "medium",
    assigned_to_employee_id: "",
  });

  const isManager = !!employee && MANAGER_ROLES.includes(employee.role);
  const defaultTab = searchParams.get("tab") === "created" ? "created" : "assigned";

  const fetchAll = async () => {
    if (!employee) return;
    setLoading(true);
    try {
      const requests: Promise<any>[] = [
        api.get<TaskRow[]>(`/api/tasks?assigned_to=${employee.id}&limit=100`),
        api.get<TaskRow[]>(`/api/tasks?created_by=${employee.id}&limit=100`),
        api.get<ChangeRequestRow[]>("/api/tasks/change-requests/mine"),
        api.get<EmployeeOption[]>("/api/employees?is_active=true"),
      ];

      if (isManager) {
        requests.push(api.get<ChangeRequestRow[]>("/api/tasks/change-requests/pending"));
      }

      const [assignedRes, createdRes, myRequestsRes, employeesRes, pendingRes] = await Promise.all(requests);
      setAssignedTasks(assignedRes.data ?? []);
      setCreatedTasks(createdRes.data ?? []);
      setMyRequests(myRequestsRes.data ?? []);
      setEmployees(employeesRes.data ?? []);
      setPendingApprovals(isManager ? pendingRes?.data ?? [] : []);
    } catch (err: any) {
      toast({ title: "Failed to load tasks", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!employee) return;
    void fetchAll();
  }, [employee]);

  const myLatestRequests = useMemo(() => {
    const map = new Map<string, ChangeRequestRow>();
    for (const request of myRequests) {
      if (!map.has(request.task_id)) {
        map.set(request.task_id, request);
      }
    }
    return map;
  }, [myRequests]);

  const assignableEmployees = useMemo(() => {
    if (!employee) return [];
    return employees.filter((member) => member.id !== employee.id);
  }, [employee, employees]);

  const startEdit = (task: TaskRow) => {
    setEditingTaskId(task.id);
    setEditForm({
      title: task.title,
      description: task.description ?? "",
      due_date: task.due_date ? task.due_date.slice(0, 10) : "",
      priority: task.priority,
      assigned_to_employee_id: task.assigned_to_employee_id ?? "",
    });
  };

  const submitChangeRequest = async (task: TaskRow, action: "update" | "delete") => {
    setSavingTaskId(task.id);
    try {
      await api.post(`/api/tasks/${task.id}/change-requests`, {
        action,
        changes: action === "update" ? {
          title: editForm.title.trim(),
          description: editForm.description.trim() || null,
          due_date: editForm.due_date || null,
          priority: editForm.priority,
          assigned_to_employee_id: editForm.assigned_to_employee_id || null,
        } : null,
      });
      setEditingTaskId(null);
      await fetchAll();
      toast({
        title: action === "delete" ? "Delete request sent" : "Update request sent",
        description: "Your reporting manager has been notified for approval.",
      });
    } catch (err: any) {
      toast({ title: "Request failed", description: err.message, variant: "destructive" });
    } finally {
      setSavingTaskId(null);
    }
  };

  const reviewRequest = async (requestId: string, status: "approved" | "rejected") => {
    setReviewingRequestId(requestId);
    try {
      await api.patch(`/api/tasks/change-requests/${requestId}/review`, { status });
      await fetchAll();
      toast({ title: `Request ${status}` });
    } catch (err: any) {
      toast({ title: "Review failed", description: err.message, variant: "destructive" });
    } finally {
      setReviewingRequestId(null);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}/status`, { status: newStatus });
      setAssignedTasks((current) => current.map((task) => (
        task.id === taskId ? { ...task, status: newStatus } : task
      )));
    } catch (err: any) {
      toast({ title: "Status update failed", description: err.message, variant: "destructive" });
    }
  };

  const renderTaskBadges = (task: TaskRow) => (
    <div className="flex flex-wrap items-center gap-2 mt-3">
      <Badge variant="outline" className={`text-xs ${priorityColors[task.priority] || ""}`}>{task.priority}</Badge>
      <Badge variant="outline" className={`text-xs ${statusColors[task.status] || ""}`}>{task.status.replace("_", " ")}</Badge>
      {task.is_edited && <Badge variant="secondary" className="text-xs">Updated</Badge>}
      {task.assigned_department_name && <Badge variant="secondary" className="text-xs">{task.assigned_department_name}</Badge>}
      {task.assigned_team_name && <Badge variant="secondary" className="text-xs">{task.assigned_team_name}</Badge>}
      {task.due_date && <span className="text-xs text-muted-foreground">Due: {format(new Date(task.due_date), "MMM d, yyyy")}</span>}
    </div>
  );

  if (loading) {
    return (
      <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((row) => <div key={row} className="h-28 rounded-lg bg-muted" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-foreground">Task Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track assigned work, confirm what you created, and manage edit/delete approvals.
        </p>
      </div>

      <Tabs defaultValue={defaultTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="assigned">Assigned To Me</TabsTrigger>
          <TabsTrigger value="created">Created By Me</TabsTrigger>
          {isManager && <TabsTrigger value="approvals">Approvals</TabsTrigger>}
        </TabsList>

        <TabsContent value="assigned" className="space-y-3">
          {assignedTasks.length === 0 && <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">No assigned tasks found.</div>}
          {assignedTasks.map((task) => (
            <div key={task.id} className="rounded-lg border border-border bg-card p-4 card-elevated">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground">{task.title}</h3>
                  {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                  {renderTaskBadges(task)}
                </div>
                <select
                  value={task.status}
                  onChange={(e) => void updateTaskStatus(task.id, e.target.value)}
                  className="rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground"
                >
                  <option value="pending">Pending</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="created" className="space-y-3">
          {createdTasks.length === 0 && <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">You have not created any tasks yet.</div>}
          {createdTasks.map((task) => {
            const latestRequest = myLatestRequests.get(task.id);
            const isEditing = editingTaskId === task.id;

            return (
              <div key={task.id} className="rounded-lg border border-border bg-card p-4 card-elevated space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-foreground">{task.title}</h3>
                    {task.description && <p className="text-sm text-muted-foreground mt-1">{task.description}</p>}
                    {renderTaskBadges(task)}
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      {task.assigned_to_name && <span>Assigned: {task.assigned_to_name}</span>}
                      {latestRequest && (
                        <span>
                          Latest request: {latestRequest.action} {latestRequest.status}
                          {latestRequest.approver_name ? ` by ${latestRequest.approver_name}` : ""}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(task)} disabled={savingTaskId === task.id}>
                      Request Update
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => void submitChangeRequest(task, "delete")} disabled={savingTaskId === task.id}>
                      Request Delete
                    </Button>
                  </div>
                </div>

                {isEditing && (
                  <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
                    <Input value={editForm.title} onChange={(e) => setEditForm((current) => ({ ...current, title: e.target.value }))} placeholder="Task title" />
                    <Textarea value={editForm.description} onChange={(e) => setEditForm((current) => ({ ...current, description: e.target.value }))} placeholder="Task description" rows={3} />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Input type="date" value={editForm.due_date} onChange={(e) => setEditForm((current) => ({ ...current, due_date: e.target.value }))} />
                      <select value={editForm.priority} onChange={(e) => setEditForm((current) => ({ ...current, priority: e.target.value }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                      <select value={editForm.assigned_to_employee_id} onChange={(e) => setEditForm((current) => ({ ...current, assigned_to_employee_id: e.target.value }))} className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground">
                        <option value="">Unassigned</option>
                        {assignableEmployees.map((member) => (
                          <option key={member.id} value={member.id}>{member.full_name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setEditingTaskId(null)}>Cancel</Button>
                      <Button size="sm" onClick={() => void submitChangeRequest(task, "update")} disabled={savingTaskId === task.id || !editForm.title.trim()}>
                        {savingTaskId === task.id ? "Sending..." : "Send For Approval"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </TabsContent>

        {isManager && (
          <TabsContent value="approvals" className="space-y-3">
            {pendingApprovals.length === 0 && <div className="rounded-lg border border-border bg-card p-8 text-center text-muted-foreground">No task approval requests are waiting for you.</div>}
            {pendingApprovals.map((request) => (
              <div key={request.id} className="rounded-lg border border-border bg-card p-4 card-elevated space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground">{request.task_title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {request.requested_by_name} requested to {request.action} this task on {format(new Date(request.created_at), "MMM d, yyyy h:mm a")}
                    </p>
                    {request.reason && <p className="text-sm text-muted-foreground mt-1">{request.reason}</p>}
                  </div>
                  <Badge variant="outline" className="text-xs">{request.action}</Badge>
                </div>

                {request.action === "update" && request.requested_changes && (
                  <div className="rounded-md border border-border bg-secondary/20 p-3 text-sm text-muted-foreground space-y-1">
                    {Object.entries(request.requested_changes).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium text-foreground">{key.replace(/_/g, " ")}:</span> {String(value ?? "-")}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => void reviewRequest(request.id, "rejected")} disabled={reviewingRequestId === request.id}>
                    Reject
                  </Button>
                  <Button size="sm" onClick={() => void reviewRequest(request.id, "approved")} disabled={reviewingRequestId === request.id}>
                    {reviewingRequestId === request.id ? "Updating..." : "Approve"}
                  </Button>
                </div>
              </div>
            ))}
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
