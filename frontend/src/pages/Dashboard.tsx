import { useQuery } from "@tanstack/react-query";
import { getPipelineStats, getThisMonthEnrollments, getCandidates } from "@/services/candidates.service";
import { PageLoader } from "@/components/shared/LoadingState";
import { Users, TrendingUp, CheckCircle, UserPlus } from "lucide-react";
import { format } from "date-fns";

const PIPELINE_STAGES = [
  { key: "enrolled",        label: "Enrolled",       color: "bg-blue-500" },
  { key: "resume_building", label: "Resume Building", color: "bg-yellow-500" },
  { key: "marketing_active",label: "Marketing Active",color: "bg-purple-500" },
  { key: "interview_stage", label: "Interview Stage", color: "bg-orange-500" },
  { key: "placed",          label: "Placed",          color: "bg-green-500" },
  { key: "rejected",        label: "Rejected",        color: "bg-red-400" },
] as const;

export default function Dashboard() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: getPipelineStats,
  });

  const { data: thisMonth, isLoading: monthLoading } = useQuery({
    queryKey: ["enrollments-this-month"],
    queryFn: getThisMonthEnrollments,
  });

  const { data: recentData, isLoading: recentLoading } = useQuery({
    queryKey: ["recent-candidates"],
    queryFn: () => getCandidates({ page: 1, pageSize: 8 }),
  });

  if (statsLoading || monthLoading) return <PageLoader />;

  const kpis = [
    {
      label: "Total Candidates",
      value: stats?.total ?? 0,
      icon: Users,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Enrolled This Month",
      value: thisMonth ?? 0,
      icon: UserPlus,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      label: "Marketing Active",
      value: stats?.marketing_active ?? 0,
      icon: TrendingUp,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
    },
    {
      label: "Placed",
      value: stats?.placed ?? 0,
      icon: CheckCircle,
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Overview Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Live candidate pipeline across all departments
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-lg border border-border p-5 flex items-center gap-4">
            <div className={`flex items-center justify-center w-12 h-12 rounded-full ${kpi.bg}`}>
              <kpi.icon className={`w-6 h-6 ${kpi.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Funnel */}
      <div className="bg-card rounded-lg border border-border p-5">
        <h2 className="text-sm font-semibold text-card-foreground mb-5">Candidate Pipeline</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {PIPELINE_STAGES.map((stage) => {
            const count = stats?.[stage.key] ?? 0;
            const pct = stats?.total ? Math.round((count / stats.total) * 100) : 0;
            return (
              <div key={stage.key} className="bg-secondary rounded-lg p-4 text-center space-y-1">
                <div className={`h-1.5 rounded-full ${stage.color} mb-3`} style={{ width: `${pct}%`, minWidth: count > 0 ? "8px" : "0" }} />
                <p className="text-2xl font-bold text-foreground">{count}</p>
                <p className="text-xs font-medium text-foreground">{stage.label}</p>
                <p className="text-[10px] text-muted-foreground">{pct}%</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Candidates */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="text-sm font-semibold text-card-foreground">Recently Enrolled</h2>
          {recentLoading && <span className="text-xs text-muted-foreground">Loading...</span>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Candidate</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Technology</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Visa</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Pipeline Stage</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Enrolled</th>
              </tr>
            </thead>
            <tbody>
              {(recentData?.data ?? []).map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">{c.technology ?? "—"}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{c.visa_status?.toUpperCase() ?? "—"}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground capitalize">
                      {c.pipeline_stage?.replace("_", " ") ?? "enrolled"}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">
                    {c.created_at ? format(new Date(c.created_at), "MMM d, yyyy") : "—"}
                  </td>
                </tr>
              ))}
              {!recentLoading && (recentData?.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No candidates enrolled yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
