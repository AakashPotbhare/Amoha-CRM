import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Loader2, Users, UserCheck, Briefcase, ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { api } from "@/lib/api.client";
import { useAuth } from "@/contexts/AuthContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CandidateResult {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  current_domain: string | null;
  visa_status: string | null;
  pipeline_stage: string | null;
}

interface EmployeeResult {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  role: string;
  designation: string | null;
  department_id: string | null;
}

interface SearchData {
  candidates: CandidateResult[];
  employees: EmployeeResult[];
  total: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const PIPELINE_STAGE_COLORS: Record<string, string> = {
  enrolled:         "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  resume_building:  "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  marketing_active: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  interview_stage:  "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  placed:           "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  rejected:         "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

function stageLabel(stage: string | null): string {
  if (!stage) return "—";
  return stage
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function roleLabel(role: string): string {
  return role
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

// ── Flat result list for keyboard navigation ──────────────────────────────────

type FlatResult =
  | { kind: "candidate"; item: CandidateResult }
  | { kind: "employee"; item: EmployeeResult };

function buildFlat(data: SearchData | null): FlatResult[] {
  if (!data) return [];
  const out: FlatResult[] = [];
  for (const c of data.candidates) out.push({ kind: "candidate", item: c });
  for (const e of data.employees) out.push({ kind: "employee", item: e });
  return out;
}

// ── Component ─────────────────────────────────────────────────────────────────

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const { employee } = useAuth();

  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setData(null);
      setError(null);
      setActiveIndex(-1);
    } else {
      // Auto-focus the input when dialog opens
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setData(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SearchData>(
        `/api/search?q=${encodeURIComponent(q.trim())}&type=all&limit=8`,
      );
      setData(res.data);
      setActiveIndex(-1);
    } catch (err: any) {
      setError(err.message || "Search failed.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  }

  // Navigate to result
  const flat = buildFlat(data);

  const canViewHR = employee &&
    ["director", "ops_head", "hr_head"].includes(employee.role);

  function selectResult(result: FlatResult) {
    onOpenChange(false);
    if (result.kind === "candidate") {
      navigate(`/candidates/${result.item.id}`);
    } else {
      // Navigate to team directory or the user's own profile
      if (canViewHR) {
        navigate("/hr");
      } else if (employee && result.item.id === employee.id) {
        navigate("/profile");
      } else {
        navigate("/hr");
      }
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (flat.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < flat.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : flat.length - 1));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && flat[activeIndex]) {
        selectResult(flat[activeIndex]);
      }
    }
  }

  const hasCandidates = (data?.candidates.length ?? 0) > 0;
  const hasEmployees  = (data?.employees.length ?? 0) > 0;
  const hasResults    = hasCandidates || hasEmployees;
  const showEmpty     = query.trim().length >= 2 && !loading && !hasResults && !error;

  // Flat index tracker for active highlight
  let flatCursor = 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-xl w-full rounded-2xl p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
      >
        {/* Search input row */}
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          {loading ? (
            <Loader2 className="w-5 h-5 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search candidates, employees…"
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground bg-muted rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results area */}
        <div className="max-h-[420px] overflow-y-auto">
          {/* Error state */}
          {error && (
            <p className="px-4 py-6 text-sm text-center text-destructive">{error}</p>
          )}

          {/* Empty state */}
          {showEmpty && (
            <p className="px-4 py-8 text-sm text-center text-muted-foreground">
              No results for <span className="font-medium text-foreground">"{query.trim()}"</span>
            </p>
          )}

          {/* Idle state — no query yet */}
          {!loading && query.trim().length < 2 && !error && (
            <div className="px-4 py-4">
              <p className="text-xs text-muted-foreground mb-3 font-medium uppercase tracking-wider">
                You can search for
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <UserCheck className="w-4 h-4 mt-0.5 text-blue-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Candidates</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      Name, email, phone, domain, visa type
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <Users className="w-4 h-4 mt-0.5 text-purple-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Employees</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      Name, employee code, designation
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <Briefcase className="w-4 h-4 mt-0.5 text-green-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Pipeline stages</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      enrolled, placed, rejected, interview…
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5">
                  <ClipboardList className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Marketing name</p>
                    <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">
                      Candidate marketing alias or brand
                    </p>
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3 text-center">
                Type at least 2 characters to start searching
              </p>
            </div>
          )}

          {/* Candidate results */}
          {hasCandidates && (
            <section>
              <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                Candidates ({data!.candidates.length})
              </p>
              {data!.candidates.map((c) => {
                const idx = flatCursor++;
                const isActive = idx === activeIndex;
                const stageColor =
                  PIPELINE_STAGE_COLORS[c.pipeline_stage ?? ""] ??
                  "bg-muted text-muted-foreground";
                return (
                  <button
                    key={c.id}
                    onClick={() => selectResult({ kind: "candidate", item: c })}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    {/* Avatar */}
                    <span className="w-8 h-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0">
                      {initials(c.full_name)}
                    </span>

                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{c.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[c.visa_status, c.current_domain].filter(Boolean).join(" · ") || c.email}
                      </p>
                    </div>

                    {/* Pipeline stage badge */}
                    {c.pipeline_stage && (
                      <span
                        className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${stageColor}`}
                      >
                        {stageLabel(c.pipeline_stage)}
                      </span>
                    )}
                  </button>
                );
              })}
            </section>
          )}

          {/* Employee results */}
          {hasEmployees && (
            <section>
              <p className="px-4 pt-3 pb-1 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground/70">
                Employees ({data!.employees.length})
              </p>
              {data!.employees.map((e) => {
                const idx = flatCursor++;
                const isActive = idx === activeIndex;
                return (
                  <button
                    key={e.id}
                    onClick={() => selectResult({ kind: "employee", item: e })}
                    onMouseEnter={() => setActiveIndex(idx)}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      isActive ? "bg-accent" : "hover:bg-accent/50"
                    }`}
                  >
                    {/* Avatar */}
                    <span className="w-8 h-8 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold flex items-center justify-center shrink-0">
                      {initials(e.full_name)}
                    </span>

                    {/* Name + employee code */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {e.employee_code}
                        {e.designation ? ` · ${e.designation}` : ""}
                      </p>
                    </div>

                    {/* Role badge */}
                    <span className="shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap bg-muted text-muted-foreground">
                      {roleLabel(e.role)}
                    </span>
                  </button>
                );
              })}
            </section>
          )}

          {/* Bottom padding */}
          {hasResults && <div className="h-2" />}
        </div>

        {/* Footer hint */}
        <div className="border-t px-4 py-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">↑</kbd>
            <kbd className="ml-0.5 px-1 py-0.5 bg-muted rounded border border-border font-mono">↓</kbd>
            {" "}navigate
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">↵</kbd>
            {" "}select
          </span>
          <span>
            <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">ESC</kbd>
            {" "}close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
