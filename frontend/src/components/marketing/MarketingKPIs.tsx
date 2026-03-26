import { marketingRecruiters, marketingTLs, marketingApplications, marketingInterviews } from "@/data/marketingData";
import { TrendingUp, Users, FileText, Calendar, Target, Award } from "lucide-react";

export default function MarketingKPIs() {
  const totalAppsToday = marketingRecruiters.reduce((sum, r) => sum + r.applicationsToday, 0);
  const totalInterviewsWeek = marketingRecruiters.reduce((sum, r) => sum + r.interviewsThisWeek, 0);
  const avgAppsPerRecruiter = Math.round(totalAppsToday / marketingRecruiters.length);

  const kpis = [
    { icon: FileText, label: "Total Apps Today", value: totalAppsToday, target: `${marketingRecruiters.length * 100} target`, color: "text-primary" },
    { icon: Target, label: "Avg Apps/Recruiter", value: avgAppsPerRecruiter, target: "100 target (50L+50S)", color: "text-info" },
    { icon: Calendar, label: "Interviews This Week", value: totalInterviewsWeek, target: `${marketingRecruiters.length * 4} target`, color: "text-success" },
    { icon: Award, label: "POs This Month", value: 7, target: `${marketingTLs.length * 3} target`, color: "text-warning" },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-card rounded-lg border border-border p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
              <span className="text-xs font-medium text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.target}</p>
          </div>
        ))}
      </div>

      {/* Recruiter Performance */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-card-foreground">Recruiter Performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Recruiter</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Team Lead</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Apps Today</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Progress</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Interviews/Week</th>
                <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody>
              {marketingRecruiters.map((r) => {
                const tl = marketingTLs.find((t) => t.id === r.tlId);
                const progress = Math.min((r.applicationsToday / 100) * 100, 100);
                const onTarget = r.applicationsToday >= 100;
                return (
                  <tr key={r.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{r.name}</td>
                    <td className="px-5 py-3 text-sm text-muted-foreground">{tl?.name}</td>
                    <td className="px-5 py-3 text-sm font-medium text-foreground">{r.applicationsToday}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-24 bg-secondary rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${onTarget ? "bg-success" : "bg-warning"}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">{Math.round(progress)}%</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-sm text-foreground">{r.interviewsThisWeek}/4</td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${onTarget ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                        {onTarget ? "On Target" : "Below Target"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* TL Summary */}
      <div className="bg-card rounded-lg border border-border">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-card-foreground">Team Lead Summary</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-5">
          {marketingTLs.map((tl) => {
            const recruiterCount = marketingRecruiters.filter((r) => r.tlId === tl.id).length;
            const tlApps = marketingRecruiters.filter((r) => r.tlId === tl.id).reduce((s, r) => s + r.applicationsToday, 0);
            return (
              <div key={tl.id} className="p-4 bg-secondary rounded-lg">
                <p className="text-sm font-semibold text-foreground">{tl.name}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-xs text-muted-foreground">{tl.candidateCount} candidates · {recruiterCount} recruiters</p>
                  <p className="text-xs text-muted-foreground">{tlApps} apps today from team</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
