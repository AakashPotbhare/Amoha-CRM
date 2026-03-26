import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api.client";
import {
  Loader2, Trophy, TrendingUp, Users, BarChart3,
  Target, XCircle, CheckCircle, Clock,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────
interface DeptSummaryData {
  department: { id: string; name: string; slug: string };
  period: { from: string; to: string };
  summary: {
    total: number;
    completed: number;
    completion_rate: number;
    employee_count: number;
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

// ─── Constants ───────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  interview_support:  "Interview",
  assessment_support: "Assessment",
  ruc:                "RUC",
  mock_call:          "Mock Call",
  preparation_call:   "Prep Call",
  resume_building:    "Resume",
  resume_rebuilding:  "Rebuild",
};

const ROUND_LABELS: Record<string, string> = {
  screening:   "Screening",
  phone_call:  "Phone Call",
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
  { value: "month",   label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "week",    label: "Last 7 Days" },
  { value: "year",    label: "This Year" },
];

interface Props {
  departmentSlug: string;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function TeamPerformancePanel({ departmentSlug }: Props) {
  const [period, setPeriod]       = useState("month");
  const [deptData, setDeptData]   = useState<DeptSummaryData | null>(null);
  const [statsData, setStatsData] = useState<SupportStatsData | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      api.get<DeptSummaryData>(
        `/api/analytics/departments/${departmentSlug}/summary?period=${period}`
      ),
      api.get<SupportStatsData>(
        `/api/analytics/support-tasks?period=${period}`
      ),
    ])
      .then(([deptRes, statsRes]) => {
        if (deptRes.success && deptRes.data)   setDeptData(deptRes.data);
        if (statsRes.success && statsRes.data) setStatsData(statsRes.data);
      })
      .catch(() => setError("Could not load performance data."))
      .finally(() => setLoading(false));
  }, [departmentSlug, period]);

  // Pie chart: by_type
  const pieData = useMemo(() => {
    if (!statsData?.by_type) return [];
    return Object.entries(statsData.by_type).map(([key, count]) => ({
      name:  TYPE_LABELS[key] || key,
      value: count,
    }));
  }, [statsData]);

  // Bar chart: by_round
  const roundData = useMemo(() => {
    if (!statsData?.by_round) return [];
    const order = ["screening", "phone_call", "1st_round", "2nd_round", "3rd_round", "final_round"];
    return order
      .filter((k) => statsData.by_round[k] != null)
      .map((k) => ({ round: ROUND_LABELS[k] || k, count: statsData.by_round[k] }));
  }, [statsData]);

  // Team table: sorted by completed desc
  const sortedEmployees = useMemo(() => {
    if (!deptData?.employees) return [];
    return [...deptData.employees].sort((a, b) => b.completed - a.completed);
  }, [deptData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <XCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p>{error}</p>
      </div>
    );
  }

  const summary = deptData?.summary;
  const noShow  = statsData?.summary.no_show ?? 0;

  return (
    <div className="space-y-6">
      {/* Header + Period selector */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Team Performance — {deptData?.department.name ?? "Technical"}
          </h2>
          {deptData && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(deptData.period.from).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              {" — "}
              {new Date(deptData.period.to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1 self-start sm:self-auto">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                period === opt.value
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Tasks",   value: summary?.total ?? 0,           icon: Target,       color: "bg-primary/10 text-primary" },
          { label: "Completed",     value: summary?.completed ?? 0,       icon: CheckCircle,  color: "bg-success/10 text-success" },
          { label: "No Shows",      value: noShow,                         icon: XCircle,      color: "bg-destructive/10 text-destructive" },
          { label: "Completion",    value: `${summary?.completion_rate ?? 0}%`, icon: TrendingUp, color: "bg-info/10 text-info" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card rounded-xl border border-border p-4 card-elevated">
            <div className="flex items-start justify-between mb-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donut: tasks by type */}
        {pieData.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5 card-elevated">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Tasks by Type
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background:   "hsl(var(--card))",
                      border:       "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize:     "12px",
                      color:        "hsl(var(--foreground))",
                    }}
                  />
                  <Legend
                    iconSize={8}
                    iconType="circle"
                    formatter={(value) => (
                      <span style={{ fontSize: "11px", color: "hsl(var(--foreground))" }}>{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Bar: Interview rounds */}
        {roundData.length > 0 && (
          <div className="bg-card rounded-xl border border-border p-5 card-elevated">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Interview Rounds Breakdown
            </h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={roundData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                  <XAxis
                    dataKey="round"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={{ stroke: "hsl(var(--border))" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip
                    contentStyle={{
                      background:   "hsl(var(--card))",
                      border:       "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize:     "12px",
                      color:        "hsl(var(--foreground))",
                    }}
                  />
                  <Bar dataKey="count" name="Tasks" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* Team Performance Table */}
      {sortedEmployees.length > 0 && (
        <div className="bg-card rounded-xl border border-border p-5 card-elevated">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-warning" />
            Individual Performance
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">#</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Employee</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase text-center">Total</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase text-center">Done</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase text-center">No Show</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Rate</th>
                  <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Top Type</th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployees.map((emp, i) => {
                  const topType = Object.entries(emp.by_type).sort(([, a], [, b]) => b - a)[0];
                  return (
                    <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-secondary/30 transition-colors">
                      <td className="px-3 py-3">
                        {i === 0 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning/10 text-warning text-xs font-bold">1</span>
                        ) : i === 1 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs font-bold">2</span>
                        ) : i === 2 ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold">3</span>
                        ) : (
                          <span className="text-xs text-muted-foreground pl-2">{i + 1}</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">{emp.full_name.charAt(0)}</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{emp.full_name}</p>
                            <p className="text-[10px] text-muted-foreground">{emp.team_name ?? emp.employee_code}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-center text-foreground">{emp.total}</td>
                      <td className="px-3 py-3 text-sm text-center font-medium text-success">{emp.completed}</td>
                      <td className="px-3 py-3 text-sm text-center text-destructive">{emp.no_show}</td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-20 bg-secondary rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all"
                              style={{ width: `${emp.completion_rate}%` }}
                            />
                          </div>
                          <span className={`text-xs font-semibold ${
                            emp.completion_rate >= 80 ? "text-success" :
                            emp.completion_rate >= 60 ? "text-warning" : "text-destructive"
                          }`}>
                            {emp.completion_rate}%
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">
                        {topType ? (
                          <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {TYPE_LABELS[topType[0]] || topType[0]} ({topType[1]})
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && deptData && sortedEmployees.length === 0 && (
        <div className="bg-card rounded-xl border border-border p-12 text-center card-elevated">
          <Users className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground">No performance data</p>
          <p className="text-xs text-muted-foreground mt-1">
            No support tasks have been assigned to this team in the selected period.
          </p>
        </div>
      )}

      {/* No-show highlight (if any) */}
      {noShow > 0 && (
        <div className="flex items-center gap-3 bg-destructive/5 border border-destructive/20 rounded-lg px-4 py-3">
          <XCircle className="w-4 h-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">
            <span className="font-semibold">{noShow} no-show{noShow > 1 ? "s" : ""}</span> recorded this period.
            Check candidate availability before scheduling future interviews.
          </p>
        </div>
      )}
    </div>
  );
}
