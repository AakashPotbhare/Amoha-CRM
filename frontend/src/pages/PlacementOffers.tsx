import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  PlusCircle, Eye, IndianRupee, Calendar, Building2,
  CheckCircle2, Clock, XCircle, AlertCircle, Loader2, Trash2,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PlacementOffer {
  id: string;
  candidate_name: string;
  technology: string;
  offer_position: string;
  employer_name: string;
  job_location: string | null;
  employment_type: string;
  offer_date: string;
  joining_date: string | null;
  annual_package: number;
  upfront_paid: number;
  commission_rate: number | null;
  commission_amount: number;
  final_amount_due: number;
  installment_1_amount: number | null;
  installment_1_condition: string | null;
  installment_1_paid_at: string | null;
  installment_2_amount: number | null;
  installment_2_condition: string | null;
  installment_2_paid_at: string | null;
  installment_3_amount: number | null;
  installment_3_condition: string | null;
  installment_3_paid_at: string | null;
  poc_recruiter_name: string | null;
  application_recruiter_name: string | null;
  technical_support_name: string | null;
  created_by_name: string;
  team_name: string | null;
  status: string;
  payment_link_sent: boolean;
  notes: string | null;
  created_at: string;
}

interface Stats {
  totals: {
    total_pos: number;
    total_package: number;
    total_due: number;
    total_upfront: number;
    completed: number;
  };
  by_team: { team_name: string; total_pos: number; total_package: number; total_due: number }[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft:      { label: "Draft",      className: "bg-muted text-muted-foreground",            icon: Clock },
  submitted:  { label: "Submitted",  className: "bg-blue-100 text-blue-700",                 icon: AlertCircle },
  processing: { label: "Processing", className: "bg-yellow-100 text-yellow-700",             icon: Clock },
  completed:  { label: "Completed",  className: "bg-green-100 text-green-700",               icon: CheckCircle2 },
  cancelled:  { label: "Cancelled",  className: "bg-red-100 text-red-700",                   icon: XCircle },
};

function fmt(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
}

function fmtDate(s: string | null | undefined) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export default function PlacementOffers() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [offers, setOffers]       = useState<PlacementOffer[]>([]);
  const [stats, setStats]         = useState<Stats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [selected, setSelected]   = useState<PlacementOffer | null>(null);
  const [statusFilter, setStatus] = useState("");
  const [search, setSearch]       = useState("");
  const [period, setPeriod]       = useState("month");
  const [updating, setUpdating]   = useState(false);
  const [deletingOfferId, setDeletingOfferId] = useState<string | null>(null);
  const [deletingOffer, setDeletingOffer]     = useState(false);

  const leadership = ["director", "ops_head", "hr_head"];
  const tlRoles    = ["marketing_tl", "sales_head", "technical_head", "resume_head", "compliance_officer"];
  const canCreate  = employee && [...leadership, ...tlRoles.filter(r => r !== "compliance_officer")].includes(employee.role);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [offersRes, statsRes] = await Promise.all([
        api.get<PlacementOffer[]>(`/api/placement-orders?limit=100${statusFilter ? `&status=${statusFilter}` : ""}`),
        api.get<Stats>(`/api/placement-orders/stats?period=${period}`),
      ]);
      if (offersRes.success && offersRes.data) setOffers(offersRes.data);
      if (statsRes.success && statsRes.data)  setStats(statsRes.data);
    } catch (err: any) {
      toast({ title: "Error loading offers", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [statusFilter, period]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      await api.patch(`/api/placement-orders/${id}`, { status });
      toast({ title: "Status updated" });
      setSelected(prev => prev ? { ...prev, status } : null);
      setOffers(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const markInstallmentPaid = async (id: string, n: 1 | 2 | 3) => {
    setUpdating(true);
    const today = new Date().toISOString().slice(0, 10);
    const field = `installment_${n}_paid_at` as keyof PlacementOffer;
    try {
      const updated = await api.patch<PlacementOffer>(`/api/placement-orders/${id}`, { [field]: today });
      if (updated.success && updated.data) {
        setSelected(updated.data);
        setOffers(prev => prev.map(o => o.id === id ? updated.data! : o));
      }
      toast({ title: `Installment ${n} marked as received` });
    } catch (err: any) {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    } finally {
      setUpdating(false);
    }
  };

  const deleteOffer = async () => {
    if (!deletingOfferId) return;
    setDeletingOffer(true);
    try {
      await api.delete(`/api/placement-orders/${deletingOfferId}`);
      toast({ title: "Placement offer deleted" });
      setDeletingOfferId(null);
      setSelected(null);
      fetchAll();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setDeletingOffer(false);
    }
  };

  const filtered = offers.filter(o =>
    !search ||
    o.candidate_name.toLowerCase().includes(search.toLowerCase()) ||
    o.employer_name.toLowerCase().includes(search.toLowerCase()) ||
    o.technology.toLowerCase().includes(search.toLowerCase())
  );

  const totals = stats?.totals;

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Placement Offers</h1>
          <p className="text-sm text-muted-foreground mt-1">Track all candidate placements and installment payments</p>
        </div>
        {canCreate && (
          <Button onClick={() => navigate("/placement-orders/create")} className="gap-2">
            <PlusCircle className="w-4 h-4" /> New Placement Offer
          </Button>
        )}
      </div>

      {/* Stats summary */}
      {totals && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total POs",      value: totals.total_pos,      currency: false },
            { label: "Total Package",  value: totals.total_package,  currency: true },
            { label: "Total Due",      value: totals.total_due,      currency: true },
            { label: "Completed",      value: totals.completed,      currency: false },
          ].map(card => (
            <div key={card.label} className="bg-card border border-border rounded-lg p-4 card-elevated">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className="text-xl font-bold text-foreground mt-1">
                {card.currency ? fmt(card.value) : card.value ?? 0}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search candidate, employer, technology..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="sm:max-w-xs"
        />
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground"
        >
          <option value="">All Statuses</option>
          {Object.entries(STATUS_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="quarter">This Quarter</option>
          <option value="all">All Time</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <IndianRupee className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No placement offers found</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border">
                <tr>
                  {["Candidate", "Technology", "Employer", "Offer Date", "Package", "Final Due", "Status", ""].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(o => {
                  const sc = STATUS_CONFIG[o.status] ?? STATUS_CONFIG.submitted;
                  const Icon = sc.icon;
                  return (
                    <tr key={o.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{o.candidate_name}</p>
                        <p className="text-xs text-muted-foreground">{o.offer_position}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{o.technology}</td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{o.employer_name}</p>
                        {o.job_location && <p className="text-xs text-muted-foreground">{o.job_location}</p>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmtDate(o.offer_date)}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{fmt(o.annual_package)}</td>
                      <td className="px-4 py-3 font-medium text-foreground">{fmt(o.final_amount_due)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${sc.className}`}>
                          <Icon className="w-3 h-3" />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelected(o)}
                          className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingOfferId}
        onOpenChange={(open) => { if (!open) setDeletingOfferId(null); }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Placement Offer</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this placement offer? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingOffer}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteOffer}
              disabled={deletingOffer}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingOffer ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting…</> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setSelected(null)}>
          <div
            className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="sticky top-0 bg-background border-b border-border px-6 py-4 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-foreground">{selected.candidate_name}</h2>
                <p className="text-sm text-muted-foreground">{selected.offer_position} · {selected.employer_name}</p>
              </div>
              <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground text-xl font-bold leading-none ml-4">×</button>
            </div>

            <div className="p-6 space-y-6">
              {/* Key details grid */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Technology",       value: selected.technology },
                  { label: "Employment Type",  value: selected.employment_type.replace(/_/g, " ").toUpperCase() },
                  { label: "Offer Date",       value: fmtDate(selected.offer_date) },
                  { label: "Joining Date",     value: fmtDate(selected.joining_date) },
                  { label: "Location",         value: selected.job_location || "—" },
                  { label: "Team",             value: selected.team_name || "—" },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="text-sm font-medium text-foreground mt-0.5">{f.value}</p>
                  </div>
                ))}
              </div>

              {/* Financial */}
              <div className="bg-muted/30 rounded-lg p-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Financials</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "Annual Package",    value: fmt(selected.annual_package) },
                    { label: "Commission Rate",   value: selected.commission_rate ? `${selected.commission_rate}%` : "—" },
                    { label: "Commission Amount", value: fmt(selected.commission_amount) },
                    { label: "Upfront Paid",      value: fmt(selected.upfront_paid) },
                    { label: "Final Amount Due",  value: fmt(selected.final_amount_due) },
                  ].map(f => (
                    <div key={f.label}>
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className="text-sm font-semibold text-foreground">{f.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Installments */}
              {(selected.installment_1_amount || selected.installment_2_amount || selected.installment_3_amount) && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Installment Tracker</p>
                  {([1, 2, 3] as (1 | 2 | 3)[]).map(n => {
                    const amt   = selected[`installment_${n}_amount`  as keyof PlacementOffer] as number | null;
                    const cond  = selected[`installment_${n}_condition` as keyof PlacementOffer] as string | null;
                    const paidAt = selected[`installment_${n}_paid_at` as keyof PlacementOffer] as string | null;
                    if (!amt) return null;
                    return (
                      <div key={n} className={`rounded-lg border p-3 flex items-center justify-between gap-4 ${paidAt ? "border-green-200 bg-green-50/50 dark:bg-green-950/20" : "border-border"}`}>
                        <div>
                          <p className="text-sm font-medium text-foreground">Installment {n} — {fmt(amt)}</p>
                          {cond && <p className="text-xs text-muted-foreground mt-0.5">{cond}</p>}
                          {paidAt && <p className="text-xs text-green-600 mt-0.5">Received on {fmtDate(paidAt)}</p>}
                        </div>
                        {!paidAt && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={updating}
                            onClick={() => markInstallmentPaid(selected.id, n)}
                          >
                            {updating ? <Loader2 className="w-3 h-3 animate-spin" /> : "Mark Received"}
                          </Button>
                        )}
                        {paidAt && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* People */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">People</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: "POC Recruiter",         value: selected.poc_recruiter_name },
                    { label: "Application Recruiter",  value: selected.application_recruiter_name },
                    { label: "Technical Support",      value: selected.technical_support_name },
                    { label: "Created By",             value: selected.created_by_name },
                  ].map(f => f.value ? (
                    <div key={f.label}>
                      <p className="text-xs text-muted-foreground">{f.label}</p>
                      <p className="text-sm font-medium text-foreground">{f.value}</p>
                    </div>
                  ) : null)}
                </div>
              </div>

              {/* Notes */}
              {selected.notes && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm text-foreground bg-muted/30 rounded p-3">{selected.notes}</p>
                </div>
              )}

              {/* Status update */}
              <div className="border-t border-border pt-4 flex flex-wrap gap-2 items-center">
                <span className="text-sm text-muted-foreground">Update status:</span>
                {Object.entries(STATUS_CONFIG).map(([v, c]) => (
                  <button
                    key={v}
                    disabled={updating || selected.status === v}
                    onClick={() => updateStatus(selected.id, v)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-opacity ${c.className} ${selected.status === v ? "ring-2 ring-offset-1 ring-current" : "opacity-70 hover:opacity-100"} disabled:cursor-not-allowed`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Delete — directors only */}
              {employee?.role === "director" && (
                <div className="border-t border-border pt-4">
                  <Button
                    variant="destructive"
                    size="sm"
                    className="gap-2"
                    onClick={() => setDeletingOfferId(selected.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Placement Offer
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
