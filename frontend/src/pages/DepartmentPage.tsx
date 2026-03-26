import { useParams } from "react-router-dom";
import { mockCandidates, mockDepartmentStats } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Department } from "@/types/recruitment";
import { Users, UserCheck, Activity, TrendingUp } from "lucide-react";

export default function DepartmentPage() {
  const { dept } = useParams<{ dept: string }>();
  const department = dept as Department;

  const candidates = mockCandidates.filter((c) => c.department === department);
  const stats = mockDepartmentStats.find(
    (d) => d.department.toLowerCase() === department
  );

  const deptName = department?.charAt(0).toUpperCase() + department?.slice(1);

  const metrics = [
    { icon: Users, label: "Total Candidates", value: stats?.candidates ?? 0 },
    { icon: UserCheck, label: "Placed", value: stats?.placed ?? 0 },
    { icon: Activity, label: "Active", value: stats?.active ?? 0 },
    { icon: TrendingUp, label: "Performance", value: `${stats?.performance ?? 0}%` },
  ];

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">{deptName} Department</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Track candidates and performance for the {deptName} team
        </p>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="bg-card rounded-lg border border-border p-4 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <m.icon className="w-4 h-4 text-primary" />
              <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{m.value}</p>
          </div>
        ))}
      </div>

      {/* Candidates table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <div className="p-5 border-b border-border">
          <h2 className="text-sm font-semibold text-card-foreground">
            {deptName} Candidates ({candidates.length})
          </h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Candidate</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Position</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned To</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                <td className="px-5 py-3">
                  <p className="text-sm font-medium text-foreground">{c.name}</p>
                  <p className="text-xs text-muted-foreground">{c.email}</p>
                </td>
                <td className="px-5 py-3">
                  <p className="text-sm text-foreground">{c.position}</p>
                  <p className="text-xs text-muted-foreground">{c.company}</p>
                </td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3 text-sm text-foreground">{c.assignedTo}</td>
                <td className="px-5 py-3 text-sm text-muted-foreground max-w-[200px] truncate">{c.notes}</td>
              </tr>
            ))}
            {candidates.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-muted-foreground text-sm">
                  No candidates in this department yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
