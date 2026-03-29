import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import {
  Loader2, Calendar, Headphones, CheckCircle, Clock,
  BarChart3, TrendingUp, DollarSign, Users, Search,
  History, Building2, Mic, XCircle, ChevronRight,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import TeamPerformancePanel from "@/components/TeamPerformancePanel";

// ─── Types ───────────────────────────────────────────────────────────────────
interface SupportTaskRow {
  id: string;
  task_type: string;
  candidate_name: string;
  company_name: string | null;
  interview_round: string | null;
  scheduled_date: string | null;
  start_time: string | null;
  end_time: string | null;
  status: string;
  priority: string;
  assigned_team_id: string | null;
  assigned_team_name: string | null;
  support_person_name: string | null;
  created_at: string;
  call_status: string | null;
  feedback: string | null;
}

interface POTeamRow {
  team_name: string | null;
  team_id: string | null;
  total_pos: number;
  total_package: string;
  total_due: string;
  total_upfront: string;
  completed: number;
}

interface POTotals {
  total_pos: number;
  total_package: string;
  total_due: string;
  total_upfront: string;
  completed: number;
}

interface CandidateRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  pipeline_stage: string;
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
  assignee_name: string | null;
}

interface CandidateHistory {
  enrollment: { id: string; full_name: string; pipeline_stage: string; current_domain: string | null };
  history: HistoryTask[];
}

// ─── Constants ───────────────────────────────────────────────────────────────
const TYPE_LABELS: Record<string, string> = {
  interview_support:  "Interview",
  assessment_support: "Assessment",
  ruc:                "RUC",
  mock_call:          "Mock Call",
  preparation_call:   "Prep Call",
};

const ROUND_LABELS: Record<string, string> = {
  screening:   "Screening",
  phone_call:  "Phone Call",
  "1st_round": "1st Round",
  "2nd_round": "2nd Round",
  "3rd_round": "3rd Round",
  final_round: "Final Round",
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

const PERIOD_OPTIONS = [
  { value: "month",   label: "This Month" },
  { value: "quarter", label: "This Quarter" },
  { value: "week",    label: "Last 7 Days" },
  { value: "year",    label: "This Year" },
];

function fmt(v: string | number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(v || 0));
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MarketingDepartment() {
  const { employee } = useAuth();

  // Overview state
  const [allTasks, setAllTasks]               = useState<SupportTaskRow[]>([]);
  const [teams, setTeams]                     = useState<{ id: string; name: string }[]>([]);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState("");
  const [dateRange, setDateRange]             = useState<"today" | "week" | "month">("today");

  // PO Board state
  const [poPeriod, setPOPeriod]   = useState("month");
  const [poTeams, setPOTeams]     = useState<POTeamRow[]>([]);
  const [poTotals, setPOTotals]   = useState<POTotals | null>(null);
  const [loadingPO, setLoadingPO] = useState(false);

  // Candidate History state
  const [candidates, setCandidates]         = useState<CandidateRow[]>([]);
  const [histSearch, setHistSearch]         = useState("");
  const [selectedCandidate, setSelected]    = useState<CandidateRow | null>(null);
  const [history, setHistory]               = useState<CandidateHistory | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // ── Load Overview data ────────────────────────────────────────────────────
  useEffect(() => {
    if (!employee) return;
    Promise.all([
      api.get<any[]>('/api/support-tasks?limit=500'),
      api.get<{ id: string; name: string }[]>('/api/employees/teams'),
      api.get<CandidateRow[]>('/api/candidates?limit=500'),
    ]).then(([tasksRes, teamsRes, candRes]) => {
      setTeams(teamsRes.data ?? []);
      setCandidates(candRes.data ?? []);
      setAllTasks(
        (tasksRes.data ?? []).map((t: any) => ({
          id:                   t.id,
          task_type:            t.task_type,
          candidate_name:       t.candidate_name ?? "Unknown",
          company_name:         t.company_name ?? null,
          interview_round:      t.interview_round ?? null,
          scheduled_date:       t.scheduled_at ? t.scheduled_at.slice(0, 10) : null,
          start_time:           null,
          end_time:             null,
          status:               t.status,
          priority:             t.priority ?? "medium",
          assigned_team_id:     t.team_id ?? null,
          assigned_team_name:   t.department_name ?? null,
          support_person_name:  t.assigned_to_name ?? null,
          created_at:           t.created_at,
          call_status:          t.call_status ?? null,
          feedback:             t.feedback ?? null,
        }))
      );
      setLoadingOverview(false);
    }).catch(() => setLoadingOverview(false));
  }, [employee]);

  // ── Load PO Board data ────────────────────────────────────────────────────
  useEffect(() => {
    setLoadingPO(true);
    api.get<{ totals: POTotals; by_team: POTeamRow[] }>(
      `/api/analytics/placement-orders?period=${poPeriod}`
    ).then((res) => {
      if (res.success && res.data) {
        setPOTotals(res.data.totals);
        setPOTeams(res.data.by_team);
      }
    }).finally(() => setLoadingPO(false));
  }, [poPeriod]);

  // ── Load candidate history on selection ──────────────────────────────────
  useEffect(() => {
    if (!selectedCandidate) { setHistory(null); return; }
    setLoadingHistory(true);
    api.get<CandidateHistory>(`/api/analytics/candidate/${selectedCandidate.id}/history`)
      .then((res) => { if (res.success && res.data) setHistory(res.data); })
      .finally(() => setLoadingHistory(false));
  }, [selectedCandidate]);

  // ── Overview computed ─────────────────────────────────────────────────────
  const dateFilteredTasks = useMemo(() => {
    const now        = new Date();
    const todayStr   = format(now, "yyyy-MM-dd");
    const weekStart  = format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const weekEnd    = format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
    const monthEnd   = format(endOfMonth(now), "yyyy-MM-dd");
    return allTasks.filter((t) => {
      const d = t.scheduled_date;
      if (!d) return true;
      if (dateRange === "today") return d === todayStr;
      if (dateRange === "week")  return d >= weekStart && d <= weekEnd;
      return d >= monthStart && d <= monthEnd;
    });
  }, [allTasks, dateRange]);

  const filteredTasks = useMemo(() => {
    if (!selectedTeamFilter) return dateFilteredTasks;
    return dateFilteredTasks.filter((t) => t.assigned_team_id === selectedTeamFilter);
  }, [dateFilteredTasks, selectedTeamFilter]);

  const interviewCount = filteredTasks.filter((t) => t.task_type === "interview_support").length;
  const pendingCount   = filteredTasks.filter((t) => t.status === "pending").length;
  const completedCount = filteredTasks.filter((t) => t.status === "completed").length;

  const teamStats = useMemo(() => {
    const map = new Map<string, { teamId: string; teamName: string; total: number; interviews: number; completed: number; pending: number }>();
    dateFilteredTasks.forEach((t) => {
      const key  = t.assigned_team_id || "unassigned";
      const name = t.assigned_team_name || "Unassigned";
      if (!map.has(key)) map.set(key, { teamId: key, teamName: name, total: 0, interviews: 0, completed: 0, pending: 0 });
      const s = map.get(key)!;
      s.total++;
      if (t.task_type === "interview_support") s.interviews++;
      if (t.status === "completed") s.completed++;
      if (t.status === "pending")   s.pending++;
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [dateFilteredTasks]);

  const todayStr   = format(new Date(), "yyyy-MM-dd");
  const todayTasks = useMemo(() => {
    let tasks = allTasks.filter((t) => t.scheduled_date === todayStr);
    if (selectedTeamFilter) tasks = tasks.filter((t) => t.assigned_team_id === selectedTeamFilter);
    return tasks;
  }, [allTasks, todayStr, selectedTeamFilter]);

  // ── Candidate history search ──────────────────────────────────────────────
  const filteredCandidates = useMemo(() => {
    if (!histSearch.trim()) return [];
    const q = histSearch.toLowerCase();
    return candidates.filter((c) =>
      c.full_name.toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q)
    ).slice(0, 8);
  }, [candidates, histSearch]);

  const selectClass = "border border-input rounded-md px-3 py-1.5 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring";

  if (loadingOverview) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-3 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Marketing Department</h1>
          <p className="text-sm text-muted-foreground">
            Track interviews, placement offers, and candidate history
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex w-max min-w-full">
            <TabsTrigger className="whitespace-nowrap" value="overview">Overview</TabsTrigger>
            <TabsTrigger className="whitespace-nowrap" value="po-board">PO Board</TabsTrigger>
            <TabsTrigger className="whitespace-nowrap" value="candidate-history">Candidate History</TabsTrigger>
            <TabsTrigger className="whitespace-nowrap" value="performance">Team Performance</TabsTrigger>
          </TabsList>
        </div>

        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════════ */}
        <TabsContent value="overview" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
            <div className="flex rounded-lg border border-border overflow-hidden">
              {(["today", "week", "month"] as const).map((r) => (
                <button
                  key={r}
                  onClick={() => setDateRange(r)}
                  className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                    dateRange === r
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  {r === "today" ? "Today" : r === "week" ? "This Week" : "This Month"}
                </button>
              ))}
            </div>
            <select value={selectedTeamFilter} onChange={(e) => setSelectedTeamFilter(e.target.value)} className={selectClass}>
              <option value="">All Teams</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
            {[
              { label: "Interviews",   value: interviewCount,       icon: Headphones,   color: "text-primary" },
              { label: "Total Tasks",  value: filteredTasks.length, icon: Calendar,     color: "text-info" },
              { label: "Pending",      value: pendingCount,          icon: Clock,        color: "text-warning" },
              { label: "Completed",    value: completedCount,        icon: CheckCircle,  color: "text-success" },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-card rounded-lg border border-border p-3 md:p-6">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className={`w-4 h-4 ${color}`} />
                  <span className="text-xs font-medium text-muted-foreground">{label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
              </div>
            ))}
          </div>

          {/* Team-wise Performance */}
          {teamStats.length > 0 && (
            <div className="bg-card rounded-lg border border-border p-5 space-y-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-card-foreground">Team-wise Performance</h2>
              </div>
              <div className="grid gap-3">
                {teamStats.map((ts) => {
                  const rate = ts.total > 0 ? Math.round((ts.completed / ts.total) * 100) : 0;
                  return (
                    <div key={ts.teamId} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{ts.teamName}</p>
                        <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                          <span>{ts.total} tasks</span>
                          <span>{ts.interviews} interviews</span>
                          <span className="text-success">{ts.completed} done</span>
                          <span className="text-warning">{ts.pending} pending</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-success" />
                          <span className="text-sm font-semibold text-foreground">{rate}%</span>
                        </div>
                        <span className="text-xs text-muted-foreground">completion</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Today's Schedule */}
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-semibold text-card-foreground">Today's Schedule</h2>
              </div>
              <span className="text-xs text-muted-foreground">{format(new Date(), "EEEE, MMM d, yyyy")}</span>
            </div>
            {todayTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No tasks scheduled for today</p>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[640px]">
                  <thead>
                    <tr className="border-b border-border text-left">
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Type</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Candidate</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Company</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Round</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Support</th>
                      <th className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayTasks.map((task) => {
                      const cs = CALL_STATUS_CONFIG[task.call_status ?? ""] ?? { label: task.call_status ?? "—", color: "bg-muted text-muted-foreground" };
                      return (
                        <tr key={task.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                              {TYPE_LABELS[task.task_type] || task.task_type}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-sm font-medium text-foreground">{task.candidate_name}</td>
                          <td className="px-3 py-2 text-sm text-foreground">{task.company_name || "—"}</td>
                          <td className="px-3 py-2 text-sm text-foreground">
                            {task.interview_round ? ROUND_LABELS[task.interview_round] || task.interview_round : "—"}
                          </td>
                          <td className="px-3 py-2 text-sm text-muted-foreground">{task.support_person_name || "—"}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cs.color}`}>
                              {cs.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ══ PO BOARD TAB ══════════════════════════════════════════════════ */}
        <TabsContent value="po-board" className="space-y-6">
          {/* Period selector */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between flex-wrap gap-3">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-primary" />
              Placement Offer Board
            </h2>
            <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setPOPeriod(opt.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    poPeriod === opt.value
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {loadingPO ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Org-wide totals */}
              {poTotals && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
                  {[
                    { label: "Total Offers",   value: poTotals.total_pos,                           color: "bg-primary/10 text-primary",     icon: DollarSign },
                    { label: "Total Package",  value: fmt(poTotals.total_package),                   color: "bg-success/10 text-success",     icon: TrendingUp },
                    { label: "Amount Due",     value: fmt(poTotals.total_due),                       color: "bg-warning/10 text-warning",     icon: Clock },
                    { label: "Completed",      value: Number(poTotals.completed),                    color: "bg-info/10 text-info",           icon: CheckCircle },
                  ].map(({ label, value, color, icon: Icon }) => (
                    <div key={label} className="bg-card rounded-xl border border-border p-3 md:p-6 card-elevated">
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
              )}

              {/* By-team cards */}
              {poTeams.length === 0 ? (
                <div className="bg-card rounded-xl border border-border p-12 text-center">
                  <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30 text-muted-foreground" />
                  <p className="text-sm font-medium text-foreground">No placement offers in this period</p>
                  <p className="text-xs text-muted-foreground mt-1">Offers created will appear here grouped by team.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
                  {poTeams.map((t) => (
                    <div key={t.team_id ?? "none"} className="bg-card rounded-xl border border-border p-5 card-elevated space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Users className="w-4 h-4 text-primary" />
                          {t.team_name ?? "No Team"}
                        </h3>
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded font-medium">
                          {t.total_pos} PO{t.total_pos !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-secondary/50 rounded-lg p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase">Package</p>
                          <p className="text-sm font-bold text-foreground">{fmt(t.total_package)}</p>
                        </div>
                        <div className="bg-secondary/50 rounded-lg p-2.5">
                          <p className="text-[10px] text-muted-foreground uppercase">Due</p>
                          <p className="text-sm font-bold text-warning">{fmt(t.total_due)}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border pt-2">
                        <span>Upfront received: {fmt(t.total_upfront)}</span>
                        <span className="text-success font-medium">{Number(t.completed)} closed</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* ══ CANDIDATE HISTORY TAB ════════════════════════════════════════ */}
        <TabsContent value="candidate-history" className="space-y-5">
          <div>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-1">
              <History className="w-4 h-4 text-primary" />
              Candidate Interview History
            </h2>
            <p className="text-xs text-muted-foreground">
              Search a candidate to view their full interview timeline — all companies, all rounds, all support tasks.
            </p>
          </div>

          {/* Search box */}
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name, email, or phone…"
              value={histSearch}
              onChange={(e) => { setHistSearch(e.target.value); setSelected(null); }}
              className="w-full pl-9 pr-4 py-2 border border-input rounded-lg text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Dropdown results */}
          {filteredCandidates.length > 0 && !selectedCandidate && (
            <div className="border border-border rounded-lg overflow-hidden max-w-md">
              {filteredCandidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setHistSearch(c.full_name); }}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/50 transition-colors border-b border-border last:border-0 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{c.full_name}</p>
                    <p className="text-xs text-muted-foreground">{c.email || c.phone || "—"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground capitalize">
                      {c.pipeline_stage.replace(/_/g, " ")}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* History display */}
          {selectedCandidate && (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{history?.enrollment.full_name}</h3>
                  {history && (
                    <p className="text-xs text-muted-foreground">
                      Stage: <span className="capitalize">{history.enrollment.pipeline_stage.replace(/_/g, " ")}</span>
                      {history.enrollment.current_domain && ` · ${history.enrollment.current_domain}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setSelected(null); setHistSearch(""); setHistory(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground underline"
                >
                  Clear
                </button>
              </div>

              {loadingHistory && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              )}

              {history && !loadingHistory && (
                <>
                  {/* Summary row */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full max-w-md">
                    {[
                      { label: "Total Tasks",  value: history.history.length,                                             color: "text-foreground" },
                      { label: "Completed",    value: history.history.filter(h => h.status === "completed").length,       color: "text-success" },
                      { label: "No Shows",     value: history.history.filter(h => h.call_status === "no_show").length,    color: "text-destructive" },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-card border border-border rounded-lg p-3 text-center">
                        <p className={`text-xl font-bold ${color}`}>{value}</p>
                        <p className="text-[10px] text-muted-foreground">{label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Task timeline */}
                  {history.history.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-card rounded-xl border border-border">
                      <Mic className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No interview tasks recorded for this candidate.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Timeline · {history.history.length} task{history.history.length !== 1 ? "s" : ""}
                      </p>
                      {history.history.map((task, idx) => {
                        const cs = CALL_STATUS_CONFIG[task.call_status ?? ""] ?? {
                          label: task.call_status ?? "—",
                          color: "bg-muted text-muted-foreground",
                        };
                        return (
                          <div key={task.id} className="bg-card rounded-lg border border-border p-4 space-y-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground font-medium">#{idx + 1}</span>
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
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {format(new Date(task.scheduled_at), "MMM d, yyyy")}
                                </span>
                              )}
                            </div>
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
                                </span>
                              )}
                            </div>
                            {task.feedback && (
                              <div className="bg-secondary/50 rounded p-2.5">
                                <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Feedback</p>
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

              {/* Empty search hint */}
              {!loadingHistory && !history && (
                <div className="text-center py-10 text-muted-foreground">
                  <XCircle className="w-7 h-7 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Could not load history.</p>
                </div>
              )}
            </div>
          )}

          {/* No search yet */}
          {!selectedCandidate && !histSearch && (
            <div className="text-center py-16 text-muted-foreground">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-foreground">Search for a candidate above</p>
              <p className="text-xs mt-1">Type at least 2 characters to see matching candidates.</p>
            </div>
          )}
        </TabsContent>

        {/* ══ TEAM PERFORMANCE TAB ══════════════════════════════════════════ */}
        <TabsContent value="performance">
          <TeamPerformancePanel departmentSlug="marketing" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
