import { useState } from "react";
import { marketingCandidates, marketingTLs, marketingRecruiters } from "@/data/marketingData";
import { MarketingCandidate, CandidateMarketingStatus } from "@/types/marketing";
import { Plus, Search, Mail, FileText, CheckCircle2, Clock, Pause, Award } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<CandidateMarketingStatus, { label: string; icon: typeof Clock; className: string }> = {
  allocated: { label: "Allocated", icon: Clock, className: "bg-info/10 text-info" },
  "cold-called": { label: "Cold Called", icon: Mail, className: "bg-warning/10 text-warning" },
  "form-sent": { label: "Form Sent", icon: FileText, className: "bg-primary/10 text-primary" },
  active: { label: "Active", icon: CheckCircle2, className: "bg-success/10 text-success" },
  "on-hold": { label: "On Hold", icon: Pause, className: "bg-destructive/10 text-destructive" },
  placed: { label: "Placed", icon: Award, className: "bg-accent text-accent-foreground" },
};

export default function CandidateAllocation() {
  const [candidates, setCandidates] = useState<MarketingCandidate[]>(marketingCandidates);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    tlAssigned: "",
    pocAssigned: "",
    notes: "",
  });

  const filtered = candidates.filter((c) => {
    const matchSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      c.tlAssigned.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.tlAssigned || !form.pocAssigned) {
      toast.error("Please fill all required fields");
      return;
    }

    const newCandidate: MarketingCandidate = {
      id: `mc${Date.now()}`,
      name: form.name,
      email: form.email,
      phone: form.phone,
      tlAssigned: marketingTLs.find((t) => t.id === form.tlAssigned)?.name ?? "",
      pocAssigned: marketingRecruiters.find((r) => r.id === form.pocAssigned)?.name ?? "",
      status: "allocated",
      welcomeEmailSent: false,
      formSent: false,
      formReceived: false,
      allocatedDate: new Date().toISOString().split("T")[0],
      notes: form.notes,
    };

    setCandidates([newCandidate, ...candidates]);
    setForm({ name: "", email: "", phone: "", tlAssigned: "", pocAssigned: "", notes: "" });
    setDialogOpen(false);
    toast.success("Candidate allocated successfully");
  };

  const markAction = (id: string, action: "welcomeEmailSent" | "formSent" | "formReceived") => {
    setCandidates(candidates.map((c) => {
      if (c.id !== id) return c;
      const updated = { ...c, [action]: true };
      // Auto-advance status
      if (action === "welcomeEmailSent" && c.status === "allocated") {
        updated.status = "cold-called";
      } else if (action === "formSent" && (c.status === "allocated" || c.status === "cold-called")) {
        updated.status = "form-sent";
      } else if (action === "formReceived" && c.status === "form-sent") {
        updated.status = "active";
      }
      return updated;
    }));
    const labels = { welcomeEmailSent: "Welcome email marked as sent", formSent: "Candidate info form sent", formReceived: "Form received — candidate now active" };
    toast.success(labels[action]);
  };

  const filteredRecruiters = form.tlAssigned
    ? marketingRecruiters.filter((r) => r.tlId === form.tlAssigned)
    : marketingRecruiters;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search candidates, TL..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {Object.entries(statusConfig).map(([key, val]) => (
              <SelectItem key={key} value={key}>{val.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Allocate Candidate</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Allocate New Candidate</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Candidate Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Full name" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Email *</Label>
                  <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 555-0000" />
                </div>
              </div>
              <div>
                <Label>Assign TL *</Label>
                <Select value={form.tlAssigned} onValueChange={(v) => setForm({ ...form, tlAssigned: v, pocAssigned: "" })}>
                  <SelectTrigger><SelectValue placeholder="Select Team Lead" /></SelectTrigger>
                  <SelectContent>
                    {marketingTLs.map((tl) => (
                      <SelectItem key={tl.id} value={tl.id}>{tl.name} ({tl.candidateCount} candidates)</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Assign POC (Sr. Recruiter) *</Label>
                <Select value={form.pocAssigned} onValueChange={(v) => setForm({ ...form, pocAssigned: v })}>
                  <SelectTrigger><SelectValue placeholder="Select POC" /></SelectTrigger>
                  <SelectContent>
                    {filteredRecruiters.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Background, tech stack, etc." />
              </div>
              <Button onClick={handleSubmit} className="w-full">Allocate Candidate</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Candidate</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">TL</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">POC</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Workflow</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Allocated</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const cfg = statusConfig[c.status];
              const Icon = cfg.icon;
              return (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.email}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">{c.tlAssigned}</td>
                  <td className="px-5 py-3 text-sm text-foreground">{c.pocAssigned}</td>
                  <td className="px-5 py-3">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.className)}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => !c.welcomeEmailSent && markAction(c.id, "welcomeEmailSent")}
                        className={cn("p-1.5 rounded-md text-xs transition-colors", c.welcomeEmailSent ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground hover:bg-secondary/80")}
                        title="Welcome Email"
                      >
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => !c.formSent && markAction(c.id, "formSent")}
                        className={cn("p-1.5 rounded-md text-xs transition-colors", c.formSent ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground hover:bg-secondary/80")}
                        title="Form Sent"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => !c.formReceived && c.formSent && markAction(c.id, "formReceived")}
                        className={cn("p-1.5 rounded-md text-xs transition-colors", c.formReceived ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground hover:bg-secondary/80")}
                        title="Form Received"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{c.allocatedDate}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
