import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "@/lib/api.client";
import StatusBadge from "@/components/StatusBadge";
import { Users, UserCheck, Activity, TrendingUp, Loader2 } from "lucide-react";

interface DeptCandidate {
  id: string;
  name: string;
  email: string | null;
  position: string | null;
  company: string | null;
  status: string;
  assignedTo: string | null;
  notes: string | null;
}

interface DeptSummary {
  candidates: number;
  placed: number;
  active: number;
  performance: number;
}

export default function DepartmentPage() {
  const { dept } = useParams<{ dept: string }>();
  const slug = dept ?? "";

  const [candidates, setCandidates]   = useState<DeptCandidate[]>([]);
  const [summary, setSummary]         = useState<DeptSummary | null>(null);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let isMounted = true;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [candidatesRes, summaryRes] = await Promise.allSettled([
          api.get<any>(`/api/candidates?limit=200`),
          api.get<any>(`/api/analytics/departments/${slug}/summary`),
        ]);

        if (!isMounted) return;

        // Candidates
        if (candidatesRes.status === "fulfilled" && candidatesRes.value.success) {
          const raw: any[] = candidatesRes.value.data || [];
          // Filter by department slug if the candidate has a dept_slug or department field
          const filtered = raw.filter((c: any) => {
            const cDept: string = (c.dept_slug ?? c.department ?? "").toLowerCase();
            return cDept === slug.toLowerCase();
          });
          setCandidates(
            filtered.map((c: any) => ({
              id: c.id,
              name: c.full_name ?? c.name ?? "",
              email: c.email ?? null,
              position: c.current_domain ?? c.position ?? null,
              company: c.employer_name ?? c.company ?? null,
              status: c.pipeline_stage ?? c.status ?? "enrolled",
              assignedTo: c.assigned_to ?? c.assignedTo ?? null,
              notes: c.notes ?? null,
            })),
          );
        }

        // Department summary
        if (summaryRes.status === "fulfilled" && summaryRes.value.success) {
          const d = summaryRes.value.data ?? {};
          setSummary({
            candidates: d.candidates ?? d.total_candidates ?? 0,
            placed: d.placed ?? d.total_placed ?? 0,
            active: d.active ?? d.total_active ?? 0,
            performance: d.performance ?? d.performance_pct ?? 0,
          });
        } else {
          // Fall back to deriving summary from the candidates list
          setSummary(null);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || "Failed to load department data");
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();
    return () => { isMounted = false; };
  }, [slug]);

  // If the analytics endpoint fails/returns nothing, derive stats from the fetched candidates
  const derivedSummary: DeptSummary = summary ?? {
    candidates: candidates.length,
    placed: candidates.filter((c) => c.status === "placed").length,
    active: candidates.filter((c) => !["placed", "inactive"].includes(c.status)).length,
    performance: 0,
  };

  const deptName = slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "";

  const metrics = [
    { icon: Users,      label: "Total Candidates", value: derivedSummary.candidates },
    { icon: UserCheck,  label: "Placed",            value: derivedSummary.placed },
    { icon: Activity,   label: "Active",            value: derivedSummary.active },
    { icon: TrendingUp, label: "Performance",       value: `${derivedSummary.performance}%` },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">{deptName} Department</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Track candidates and performance for the {deptName} team
          </p>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-border">
              <h2 className="text-sm font-semibold text-card-foreground">
                {deptName} Candidates ({candidates.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
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
                      <p className="text-sm text-foreground">{c.position || "—"}</p>
                      <p className="text-xs text-muted-foreground">{c.company}</p>
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-5 py-3 text-sm text-foreground">{c.assignedTo || "—"}</td>
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
        </>
      )}
    </div>
  );
}
