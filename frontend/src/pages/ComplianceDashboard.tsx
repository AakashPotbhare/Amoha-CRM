import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Loader2, ShieldCheck, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TeamPerformancePanel from "@/components/TeamPerformancePanel";

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  created_at: string;
  assigned_employee_name: string | null;
  created_by_name: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  in_progress: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
};

export default function ComplianceDashboard() {
  const { employee } = useAuth();
  const [tasks, setTasks] = useState<TaskRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (!employee) return;
    api.get<any[]>('/api/tasks?limit=200')
      .then((res) => {
        setTasks(
          (res.data ?? []).map((t: any) => ({
            id: t.id,
            title: t.title,
            description: t.description ?? null,
            status: t.status,
            priority: t.priority,
            due_date: t.due_date ?? null,
            created_at: t.created_at,
            assigned_employee_name: t.assigned_to_name ?? null,
            created_by_name: t.created_by_name ?? null,
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [employee]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return tasks;
    return tasks.filter((t) => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const pendingCount = tasks.filter((t) => t.status === "pending").length;
  const overdueCount = tasks.filter((t) => t.status !== "completed" && t.due_date && new Date(t.due_date) < new Date()).length;
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
        <h1 className="text-2xl font-bold text-foreground">Compliance Department</h1>
        <p className="text-sm text-muted-foreground mt-1">Monitor compliance tasks and deadlines</p>
      </div>
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="performance">Team Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-muted-foreground">Total Tasks</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{tasks.length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-warning" />
            <span className="text-xs font-medium text-muted-foreground">Pending</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-xs font-medium text-muted-foreground">Overdue</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{overdueCount}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-success" />
            <span className="text-xs font-medium text-muted-foreground">Completed</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{completedCount}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={selectClass}>
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div className="bg-card rounded-lg border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-card-foreground">Compliance Tasks ({filtered.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Task</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Priority</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Assigned To</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Due</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 25).map((t) => (
                <tr key={t.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground truncate max-w-[300px]">{t.description}</p>}
                  </td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      t.priority === "urgent" ? "bg-destructive/10 text-destructive" :
                      t.priority === "high" ? "bg-warning/10 text-warning" :
                      "bg-muted text-muted-foreground"
                    }`}>{t.priority}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{t.assigned_employee_name || "Unassigned"}</td>
                  <td className="px-5 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] || ""}`}>{t.status}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {t.due_date ? format(new Date(t.due_date), "MMM d, yyyy") : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No tasks found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
        </TabsContent>

        <TabsContent value="performance">
          <TeamPerformancePanel departmentSlug="compliance" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
