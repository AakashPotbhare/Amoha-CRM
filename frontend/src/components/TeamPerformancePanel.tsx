import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api.client";
import { Loader2, Trophy, TrendingUp, Users, BarChart3, Target, XCircle, CheckCircle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

interface DeptSummaryData {
  department: { id: string; name: string; slug: string };
  period: { from: string; to: string };
  summary: {
    total: number;
    completed: number;
    completion_rate: number;
    employee_count: number;
    total_revenue?: number;
    total_enrollments?: number;
  };
  employees: {
    id: string;
    full_name: string;
    designation: string | null;
    employee_code: string;
    team_name: string | null;
    total: number;
    completed: number;
    no_show: number;
    completion_rate: number;
    by_type: Record<string, number>;
    revenue?: number;
    active?: number;
    placed?: number;
  }[];
}

interface SupportStatsData {
  summary: {
    total: number;
    completed: number;
    no_show: number;
    completion_rate: number;
  };
  by_type: Record<string, number>;
  by_round: Record<string, number>;
  trend: { date: string; total: number; completed: number }[];
}

const TYPE_LABELS: Record<string, string> = {
  interview_support: "Interview",
  assessment_support: "Assessment",
  ruc: "RUC",
  mock_call: "Mock Call",
  preparation_call: "Prep Call",
  resume_building: "Resume",
  resume_rebuilding: "Rebuild",
};

const ROUND_LABELS: Record<string, string> = {
  screening: "Screening",
  phone_call: "Phone Call",
  "1st_round": "1st Round",
  "2nd_round": "2nd Round",
  "3rd_round": "3rd Round",
  final_round: "Final Round",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210 100% 50%)",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(var(--destructive))",
  "hsl(260 70% 60%)",
  "hsl(180 60% 45%)",
];

const PERIOD_OPTIONS = [
  { value: "month", label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "week", label: "Last 7 Days" },
  { value: "year", label: "This Year" },
];

interface Props {
  departmentSlug: string;
}

export default function TeamPerformancePanel({ departmentSlug }: Props) {
  const [period, setPeriod] = useState("month");
  const [deptData, setDeptData] = useState<DeptSummaryData | null>(null);
  const [statsData, setStatsData] = useState<SupportStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSales = departmentSlug === "sales";
  const formatCurrency = (value: number | null | undefined) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(value || 0));

  useEffect(() => {
    setLoading(true);
    setError(null);

    const requests = [
      api.get<DeptSummaryData>(`/api/analytics/departments/${departmentSlug}/summary?period=${period}`),
    ];

    if (!isSales) {
      requests.push(api.get<SupportStatsData>(`/api/analytics/support-tasks?period=${period}`) as any);
    }

    Promise.all(requests)
      .then(([deptRes, statsRes]) => {
        if (deptRes.success && deptRes.data) setDeptData(deptRes.data);
        if (!isSales && statsRes?.success && statsRes.data) setStatsData(statsRes.data);
        if (isSales) setStatsData(null);
      })
      .catch(() => setError("Could not load performance data."))
      .finally(() => setLoading(false));
  }, [departmentSlug, period, isSales]);

  const pieData = useMemo(() => {
    if (isSales || !statsData?.by_type) return [];
    return Object.entries(statsData.by_type).map(([key, count]) => ({ name: TYPE_LABELS[key] || key, value: count }));
  }, [statsData, isSales]);

  const roundData = useMemo(() => {
    if (isSales || !statsData?.by_round) return [];
    const order = ["screening", "phone_call", "1st_round", "2nd_round", "3rd_round", "final_round"];
    return order.filter((key) => statsData.by_round[key] != null).map((key) => ({ round: ROUND_LABELS[key] || key, count: statsData.by_round[key] }));
  }, [statsData, isSales]);

  const sortedEmployees = useMemo(() => {
    if (!deptData?.employees) return [];
    if (isSales) return [...deptData.employees].sort((a, b) => Number(b.revenue || 0) - Number(a.revenue || 0));
    return [...deptData.employees].sort((a, b) => b.completed - a.completed);
  }, [deptData, isSales]);

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (error) {
    return <div className="py-16 text-center text-muted-foreground"><XCircle className="mx-auto mb-2 h-8 w-8 opacity-40" /><p>{error}</p></div>;
  }

  const summary = deptData?.summary;
  const noShow = statsData?.summary.no_show ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Team Performance - {deptData?.department.name ?? "Department"}
          </h2>
          {deptData && (
            <p className="mt-0.5 text-xs text-muted-foreground">
              {new Date(deptData.period.from).toLocaleDateString("en-US", { day: "numeric", month: "short" })}
              {" - "}
              {new Date(deptData.period.to).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 self-start rounded-lg bg-secondary/50 p-1 sm:self-auto">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                period === opt.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(isSales
          ? [
              { label: "Revenue", value: formatCurrency(summary?.total_revenue ?? summary?.total ?? 0), icon: Target, color: "bg-primary/10 text-primary" },
              { label: "Enrollments", value: summary?.total_enrollments ?? 0, icon: Users, color: "bg-success/10 text-success" },
              { label: "Placed", value: summary?.completed ?? 0, icon: CheckCircle, color: "bg-warning/10 text-warning" },
              { label: "Placement Rate", value: `${summary?.completion_rate ?? 0}%`, icon: TrendingUp, color: "bg-info/10 text-info" },
            ]
          : [
              { label: "Total Tasks", value: summary?.total ?? 0, icon: Target, color: "bg-primary/10 text-primary" },
              { label: "Completed", value: summary?.completed ?? 0, icon: CheckCircle, color: "bg-success/10 text-success" },
              { label: "No Shows", value: noShow, icon: XCircle, color: "bg-destructive/10 text-destructive" },
              { label: "Completion", value: `${summary?.completion_rate ?? 0}%`, icon: TrendingUp, color: "bg-info/10 text-info" },
            ]
        ).map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card-elevated rounded-xl border border-border bg-card p-4">
            <div className="mb-2 flex items-start justify-between">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
              <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}>
                <Icon className="h-3.5 w-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {!isSales && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {pieData.length > 0 && (
            <div className="card-elevated rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                Tasks by Type
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--foreground))" }} />
                    <Legend iconSize={8} iconType="circle" formatter={(value) => <span style={{ fontSize: "11px", color: "hsl(var(--foreground))" }}>{value}</span>} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {roundData.length > 0 && (
            <div className="card-elevated rounded-xl border border-border bg-card p-5">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <BarChart3 className="h-4 w-4 text-primary" />
                Interview Rounds Breakdown
              </h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={roundData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="round" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px", color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="count" name="Tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

      {sortedEmployees.length > 0 && (
        <div className="card-elevated rounded-xl border border-border bg-card p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Trophy className="h-4 w-4 text-warning" />
            {isSales ? "Individual Revenue Performance" : "Individual Performance"}
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">#</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">Employee</th>
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase text-muted-foreground">Total</th>
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase text-muted-foreground">{isSales ? "Revenue" : "Done"}</th>
                  <th className="px-3 py-2 text-center text-xs font-medium uppercase text-muted-foreground">{isSales ? "Active" : "No Show"}</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">{isSales ? "Placed" : "Rate"}</th>
                  <th className="px-3 py-2 text-xs font-medium uppercase text-muted-foreground">{isSales ? "Focus" : "Top Type"}</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map((emp, i) => {
                  const topType = Object.entries(emp.by_type).sort(([, a], [, b]) => b - a)[0];
                  return (
                    <tr key={emp.id} className="border-b border-border last:border-0 transition-colors hover:bg-secondary/30">
                      <td className="px-3 py-3">
                        {i === 0 ? <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-warning/10 text-xs font-bold text-warning">1</span>
                          : i === 1 ? <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">2</span>
                          : i === 2 ? <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-500">3</span>
                          : <span className="pl-2 text-xs text-muted-foreground">{i + 1}</span>}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <span className="text-xs font-bold text-primary">{emp.full_name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{emp.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{emp.team_name ?? emp.employee_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center text-sm text-foreground">{emp.total}</td>
                      <td className="px-3 py-3 text-center text-sm font-medium text-success">{isSales ? formatCurrency(emp.revenue) : emp.completed}</td>
                      <td className="px-3 py-3 text-center text-sm text-destructive">{isSales ? (emp.active ?? 0) : emp.no_show}</td>
                      <td className="px-3 py-3">
                        {isSales ? (
                          <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-medium text-foreground">{emp.placed ?? 0}</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-secondary">
                              <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${emp.completion_rate}%` }} />
                            </div>
                            <span className={`text-xs font-semibold ${emp.completion_rate >= 80 ? "text-success" : emp.completion_rate >= 60 ? "text-warning" : "text-destructive"}`}>{emp.completion_rate}%</span>
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {isSales ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{emp.total} enrollments</span>
                        ) : topType ? (
                          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">{TYPE_LABELS[topType[0]] || topType[0]} ({topType[1]})</span>
                        ) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && deptData && sortedEmployees.length === 0 && (
        <div className="card-elevated rounded-xl border border-border bg-card p-12 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground">No performance data</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isSales ? "No sales enrollments were recorded in the selected period." : "No support tasks have been assigned to this team in the selected period."}
          </p>
        </div>
      )}

      {!isSales && noShow > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3">
          <XCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-xs text-destructive">
            <span className="font-semibold">{noShow} no-show{noShow > 1 ? "s" : ""}</span> recorded this period.
            Check candidate availability before scheduling future interviews.
          </p>
        </div>
      )}
    </div>
  );
}
