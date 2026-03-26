import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import {
  Loader2, Users, UserPlus, TrendingUp, Calendar,
  X, ChevronRight, Building2, Mic, CheckCircle, XCircle, Clock,
  History,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TeamPerformancePanel from "@/components/TeamPerformancePanel";

// ─── Types ───────────────────────────────────────────────────────────────────
interface CandidateRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  profession: string | null;
  pipeline_stage: string;
  created_at: string;
  enrolled_by_name: string | null;
}

interface HistoryTask {
  id: string;
  task_type: string;
  company_name: string | null;
  interview_round: string | null;
  scheduled_at: string | null;
  status: string;
  call_status: string | null;
  feedback: string | null;
  questions_asked: string | null;
  assignee_name: string | null;
  assignee_designation: string | null;
}

interface CandidateHistory {
  enrollment: {
    id: string;
    full_name: string;
    pipeline_stage: string;
    current_domain: string | null;
    created_at: string;
  };
  history: HistoryTask[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  interview_support:  "Interview",
  assessment_support: "Assessment",
  ruc:                "RUC",
  mock_call:          "Mock Call",
  preparation_call:   "Prep Call",
  resume_building:    "Resume",
};

const ROUND_LABELS: Record<string, string> = {
  screening:   "Screening",
  phone_call:  "Phone Call",
  "1st_round": "1st Round",
  "2nd_round": "2nd Round",
  "3rd_round": "3rd Round",
  final_round: "Final Round",
};

const STAGE_COLORS: Record<string, string> = {
  enrolled:         "bg-primary/10 text-primary",
  resume_building:  "bg-info/10 text-info",
  marketing_active: "bg-warning/10 text-warning",
  interview_stage:  "bg-purple-500/10 text-purple-500",
  placed:           "bg-success/10 text-success",
  rejected:         "bg-destructive/10 text-destructive",
};

const CALL_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  not_started: { label: "Not Started",  color: "bg-muted text-muted-foreground" },
  scheduled:   { label: "Scheduled",    color: "bg-info/10 text-info" },
  link_sent:   { label: "Link Sent",    color: "bg-warning/10 text-warning" },
  done:        { label: "Done",         color: "bg-primary/10 text-primary" },
  no_show:     { label: "No Show",      color: "bg-destructive/10 text-destructive" },
  rescheduled: { label: "Rescheduled",  color: "bg-orange-500/10 text-orange-500" },
  completed:   { label: "Completed",    color: "bg-success/10 text-success" },
};

// ─── Candidate History Modal ──────────────────────────────────────────────────
function CandidateHistoryModal({
  candidateId,
  onClose,
}: {
  candidateId: string;
  onClose: () => void;
}) {
  const [data, setData]       = useState<CandidateHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    api.get<CandidateHistory>(`/api/analytics/candidate/${candidateId}/history`)
      .then((res) => {
        if (res.success && res.data) setData(res.data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [candidateId]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl flex flex-col bg-background border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              {data?.enrollment.full_name ?? "Candidate"} — Interview History
            </h2>
            {data && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Stage:&nbsp;
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAGE_COLORS[data.enrollment.pipeline_stage] ?? "bg-muted text-muted-foreground"}`}>
                  {data.enrollment.pipeline_stage.replace(/_/g, " ")}
                </span>
                {data.enrollment.current_domain && (
                  <>&nbsp;· {data.enrollment.current_domain}</>
                )}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-secondary transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          )}

          {error && !loading && (
            <div className="text-center py-16 text-muted-foreground">
              <XCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">Could not load interview history.</p>
            </div>
          )}

          {data && !loading && (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Total Tasks",  value: data.history.length,                                            color: "text-foreground" },
                  { label: "Completed",    value: data.history.filter(h => h.status === "completed").length,      color: "text-success" },
                  { label: "No Shows",     value: data.history.filter(h => h.call_status === "no_show").length,   color: "text-destructive" },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-card rounded-lg border border-border p-3 text-center">
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Timeline */}
              {data.history.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Mic className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No interview tasks recorded yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Timeline ({data.history.length} task{data.history.length !== 1 ? "s" : ""})
                  </p>
                  {data.history.map((task, idx) => {
                    const cs = CALL_STATUS_CONFIG[task.call_status ?? ""] ?? {
                      label: task.call_status ?? "—",
                      color: "bg-muted text-muted-foreground",
                    };
                    return (
                      <div key={task.id} className="bg-card rounded-lg border border-border p-4 space-y-2">
                        {/* Row 1 */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-muted-foreground">#{idx + 1}</span>
                            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded font-medium">
                              {TYPE_LABELS[task.task_type] || task.task_type}
                            </span>
                            {task.interview_round && (
                              <span className="bg-secondary text-foreground text-xs px-2 py-0.5 rounded">
                                {ROUND_LABELS[task.interview_round] || task.interview_round}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-0.5 rounded font-medium ${cs.color}`}>
                              {cs.label}
                            </span>
                          </div>
                          {task.scheduled_at && (
                            <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {format(new Date(task.scheduled_at), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>

                        {/* Row 2: Company + Assignee */}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {task.company_name && (
                            <span className="flex items-center gap-1">
                              <Building2 className="w-3 h-3" />
                              {task.company_name}
                            </span>
                          )}
                          {task.assignee_name && (
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {task.assignee_name}
                              {task.assignee_designation && ` (${task.assignee_designation})`}
                            </span>
                          )}
                        </div>

                        {/* Feedback */}
                        {task.feedback && (
                          <div className="bg-secondary/50 rounded p-2.5">
                            <p className="text-[10px] text-muted-foreground font-medium uppercase mb-1">Feedback</p>
                            <p className="text-xs text-foreground line-clamp-3">{task.feedback}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SalesDashboard() {
  const navigate = useNavigate();
  const { employee } = useAuth();
  const [candidates, setCandidates]           = useState<CandidateRow[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [selectedCandidateId, setSelected]    = useState<string | null>(null);
  const [stageFilter, setStageFilter]         = useState("all");
  const [search, setSearch]                   = useState("");

  useEffect(() => {
    if (!employee) return;
    api.get<CandidateRow[]>('/api/candidates?limit=200')
      .then((res) => {
        setCandidates(res.data ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [employee]);

  const filtered = useMemo(() => {
    return candidates.filter((c) => {
      if (stageFilter !== "all" && c.pipeline_stage !== stageFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.full_name.toLowerCase().includes(q) ||
          (c.email ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").includes(q)
        );
      }
      return true;
    });
  }, [candidates, stageFilter, search]);

  const totalCandidates = candidates.length;
  const activeCandidates = candidates.filter(
    (c) => c.pipeline_stage !== "placed" && c.pipeline_stage !== "rejected"
  ).length;
  const thisMonthCount = candidates.filter((c) => {
    const d = new Date(c.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const selectClass = "border border-input rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage candidates and enrollments</p>
          </div>
          <Button onClick={() => navigate("/candidates/enroll")}>
            <UserPlus className="w-4 h-4 mr-2" /> Enroll Candidate
          </Button>
        </div>

        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Team Performance</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-muted-foreground">Total Candidates</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{totalCandidates}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-success" />
                  <span className="text-xs font-medium text-muted-foreground">Active</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{activeCandidates}</p>
              </div>
              <div className="bg-card rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-info" />
                  <span className="text-xs font-medium text-muted-foreground">This Month</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{thisMonthCount}</p>
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
              <input
                type="text"
                placeholder="Search name, email, phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border border-input rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring w-64"
              />
              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className={selectClass}
              >
                <option value="all">All Stages</option>
                <option value="enrolled">Enrolled</option>
                <option value="resume_building">Resume Building</option>
                <option value="marketing_active">Marketing Active</option>
                <option value="interview_stage">Interview Stage</option>
                <option value="placed">Placed</option>
                <option value="rejected">Rejected</option>
              </select>
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {totalCandidates}
              </span>
            </div>

            {/* Candidates Table */}
            <div className="bg-card rounded-lg border border-border">
              <div className="p-4 border-b border-border">
                <h2 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  Candidates — click a row for interview history
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Candidate</th>
                      <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Domain</th>
                      <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Enrolled By</th>
                      <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Stage</th>
                      <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase">Added</th>
                      <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => (
                      <tr
                        key={c.id}
                        onClick={() => setSelected(c.id)}
                        className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors cursor-pointer"
                      >
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                          <p className="text-xs text-muted-foreground">{c.email || c.phone || "—"}</p>
                        </td>
                        <td className="px-5 py-3 text-sm text-foreground">{c.profession || "—"}</td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">{c.enrolled_by_name || "—"}</td>
                        <td className="px-5 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STAGE_COLORS[c.pipeline_stage] ?? "bg-muted text-muted-foreground"}`}>
                            {c.pipeline_stage.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-sm text-muted-foreground">
                          {format(new Date(c.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="px-5 py-3">
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground text-sm">
                          No candidates match the current filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="performance">
            <TeamPerformancePanel departmentSlug="sales" />
          </TabsContent>
        </Tabs>
      </div>

      {/* Candidate history slide-over */}
      {selectedCandidateId && (
        <CandidateHistoryModal
          candidateId={selectedCandidateId}
          onClose={() => setSelected(null)}
        />
      )}
    </>
  );
}
