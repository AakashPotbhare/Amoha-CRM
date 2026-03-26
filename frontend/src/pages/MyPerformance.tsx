import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import {
  Loader2, TrendingUp, CheckCircle, Clock, XCircle, Star,
  BarChart3, Target, Zap,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

// ─── Types ─────────────────────────────────────────────────────────────────────
interface PerformanceData {
  employee: {
    id: string; full_name: string; designation: string | null;
    avatar_url: string | null; employee_code: string;
  };
  period: { from: string; to: string };
  summary: {
    total: number; completed: number; completion_rate: number;
    no_show: number; no_show_rate: number; avg_feedback_words: number;
  };
  by_type: Record<string, number>;
  weekly_trend: { week: string; total: number; completed: number }[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  interview_support:  "Interview",
  assessment_support: "Assessment",
  ruc:                "RUC",
  mock_call:          "Mock Call",
  preparation_call:   "Prep Call",
  resume_building:    "Resume",
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(210 100% 50%)",
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(var(--destructive))",
  "hsl(260 70% 60%)",
];

const PERIOD_OPTIONS = [
  { value: "month",   label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "week",    label: "Last 7 Days" },
  { value: "year",    label: "This Year" },
];

function StatCard({
  label, value, icon: Icon, color, sub,
}: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border p-5 card-elevated">
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-foreground">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
    </div>
  );
}

export default function MyPerformance() {
  const { employee } = useAuth();
  const [period, setPeriod] = useState<string>("month");
  const [data, setData] = useState<PerformanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employee) return;
    setLoading(true);
    setError(null);

    api.get<PerformanceData>(`/api/analytics/employee/${employee.id}/performance?period=${period}`)
      .then(res => {
        if (res.success && res.data) setData(res.data);
        else setError("Could not load performance data.");
      })
      .catch(() => setError("Could not load performance data."))
      .finally(() => setLoading(false));
  }, [employee, period]);

  // Pie chart data from by_type
  const pieData = useMemo(() => {
    if (!data?.by_type) return [];
    return Object.entries(data.by_type).map(([key, count]) => ({
      name:  TYPE_LABELS[key] || key,
      value: count,
    }));
  }, [data]);

  // Bar chart — weekly trend, last 12 weeks
  const barData = useMemo(() => {
    if (!data?.weekly_trend) return [];
    return data.weekly_trend.slice(-12).map(w => ({
      week:      w.week,
      Total:     w.total,
      Completed: w.completed,
    }));
  }, [data]);

  if (!employee) return null;

  return (
    <div className="space-y-6 p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            My Performance
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Your personal task completion metrics
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
          {PERIOD_OPTIONS.map(opt => (
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

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      )}

      {error && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <XCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p>{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          {/* Period banner */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/40 rounded-lg px-4 py-2">
            <Clock className="w-3.5 h-3.5" />
            <span>
              {new Date(data.period.from).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              {" "}—{" "}
              {new Date(data.period.to).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
            </span>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Tasks"
              value={data.summary.total}
              icon={Target}
              color="bg-primary/10 text-primary"
              sub="Assigned to you"
            />
            <StatCard
              label="Completed"
              value={data.summary.completed}
              icon={CheckCircle}
              color="bg-success/10 text-success"
              sub={`${data.summary.completion_rate}% rate`}
            />
            <StatCard
              label="No Shows"
              value={data.summary.no_show}
              icon={XCircle}
              color="bg-destructive/10 text-destructive"
              sub={`${data.summary.no_show_rate}% rate`}
            />
            <StatCard
              label="Avg Feedback"
              value={`${data.summary.avg_feedback_words}w`}
              icon={Star}
              color="bg-warning/10 text-warning"
              sub="Words per feedback"
            />
          </div>

          {/* Completion Rate Progress */}
          <div className="bg-card rounded-xl border border-border p-5 card-elevated">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                Completion Rate
              </h3>
              <span className="text-2xl font-bold text-primary">{data.summary.completion_rate}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-3">
              <div
                className="bg-primary h-3 rounded-full transition-all duration-700"
                style={{ width: `${data.summary.completion_rate}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>0%</span>
              <span className={data.summary.completion_rate >= 80 ? "text-success font-medium" : "text-warning font-medium"}>
                {data.summary.completion_rate >= 80 ? "Excellent!" : data.summary.completion_rate >= 60 ? "Good" : "Needs improvement"}
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart: by type */}
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
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "hsl(var(--foreground))",
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

            {/* By-type table */}
            <div className="bg-card rounded-xl border border-border p-5 card-elevated">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-success" />
                Breakdown by Type
              </h3>
              {Object.keys(data.by_type).length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">No tasks in this period.</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.by_type)
                    .sort(([, a], [, b]) => b - a)
                    .map(([key, count]) => (
                      <div key={key} className="flex items-center justify-between">
                        <span className="text-sm text-foreground">
                          {TYPE_LABELS[key] || key}
                        </span>
                        <div className="flex items-center gap-3">
                          <div className="w-28 bg-secondary rounded-full h-1.5">
                            <div
                              className="bg-primary h-1.5 rounded-full"
                              style={{ width: `${Math.round((count / data.summary.total) * 100)}%` }}
                            />
                          </div>
                          <span className="text-sm font-semibold text-foreground w-6 text-right">{count}</span>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {Math.round((count / data.summary.total) * 100)}%
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* Weekly trend bar chart */}
          {barData.length > 0 && (
            <div className="bg-card rounded-xl border border-border p-5 card-elevated">
              <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Weekly Trend
              </h3>
              <div className="h-60">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <XAxis
                      dataKey="week"
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={{ stroke: "hsl(var(--border))" }}
                      tickLine={false}
                      tickFormatter={(w) => `W${String(w).slice(-2)}`}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend
                      iconSize={8}
                      formatter={(value) => (
                        <span style={{ fontSize: "11px", color: "hsl(var(--foreground))" }}>{value}</span>
                      )}
                    />
                    <Bar dataKey="Total"     fill="hsl(var(--secondary))" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Completed" fill="hsl(var(--primary))"   radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Empty state for trend */}
          {barData.length === 0 && data.summary.total === 0 && (
            <div className="bg-card rounded-xl border border-border p-12 text-center card-elevated">
              <Target className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground">No tasks in this period</p>
              <p className="text-xs text-muted-foreground mt-1">
                Tasks assigned to you will appear here once they're scheduled.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
