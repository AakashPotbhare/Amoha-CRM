import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  created_by_employee?: { full_name: string; employee_code: string } | null;
  assigned_department?: { name: string } | null;
  assigned_team?: { name: string } | null;
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

export default function TaskInbox() {
  const { employee } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchTasks = async () => {
    if (!employee) return;
    try {
      const res = await api.get<Task[]>(`/api/tasks?assigned_to=${employee.id}`);
      if (res.success && res.data) {
        setTasks(res.data);
      }
    } catch (err: any) {
      console.error("fetchTasks error:", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (!employee) return;
    fetchTasks();

    // Poll every 30 seconds instead of realtime subscription
    pollRef.current = setInterval(() => {
      fetchTasks();
    }, 30000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [employee]);

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      await api.patch(`/api/tasks/${taskId}/status`, {
        status: newStatus,
        ...(newStatus === "completed" ? { completed_at: new Date().toISOString() } : {}),
      });
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err: any) {
      console.error("handleStatusUpdate error:", err);
    }
  };

  if (loading) {
    return (
      <div className="p-6 lg:p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Task Inbox</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tasks assigned to you, your team, or your department
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <p className="text-muted-foreground">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-card border border-border rounded-lg p-5 card-elevated"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Badge variant="outline" className={priorityColors[task.priority]}>
                      {task.priority}
                    </Badge>
                    <Badge variant="outline" className={statusColors[task.status]}>
                      {task.status.replace("_", " ")}
                    </Badge>
                    {task.assigned_department && (
                      <Badge variant="secondary">
                        {task.assigned_department.name}
                      </Badge>
                    )}
                    {task.created_by_employee && (
                      <span className="text-xs text-muted-foreground">
                        From: {task.created_by_employee.full_name}
                      </span>
                    )}
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground">
                        Due: {format(new Date(task.due_date), "MMM d, yyyy")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0">
                  <select
                    value={task.status}
                    onChange={(e) => handleStatusUpdate(task.id, e.target.value)}
                    className="text-xs border border-input rounded-md px-2 py-1 bg-background text-foreground"
                  >
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
