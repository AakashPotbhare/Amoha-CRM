import { useState } from "react";
import { Interview, InterviewStatus } from "@/types/marketing";
import { marketingInterviews, marketingCandidates } from "@/data/marketingData";
import { Plus, Search, Clock, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const statusConfig: Record<InterviewStatus, { label: string; icon: typeof Clock; className: string }> = {
  scheduled: { label: "Scheduled", icon: Clock, className: "bg-info/10 text-info" },
  completed: { label: "Completed", icon: CheckCircle2, className: "bg-success/10 text-success" },
  cancelled: { label: "Cancelled", icon: XCircle, className: "bg-destructive/10 text-destructive" },
  rescheduled: { label: "Rescheduled", icon: RotateCcw, className: "bg-warning/10 text-warning" },
  "no-show": { label: "No Show", icon: AlertTriangle, className: "bg-destructive/10 text-destructive" },
};

export default function InterviewTracker() {
  const [interviews, setInterviews] = useState<Interview[]>(marketingInterviews);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  const [form, setForm] = useState({
    candidateId: "",
    company: "",
    round: "1",
    date: "",
    time: "",
    jobDescription: "",
    notes: "",
  });

  const filtered = interviews.filter((i) => {
    const matchSearch =
      i.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      i.company.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || i.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleSubmit = () => {
    if (!form.candidateId || !form.company || !form.date || !form.time) {
      toast.error("Please fill all required fields");
      return;
    }

    const candidate = marketingCandidates.find((c) => c.id === form.candidateId);
    const newInterview: Interview = {
      id: `i${Date.now()}`,
      candidateId: form.candidateId,
      candidateName: candidate?.name ?? "",
      company: form.company,
      round: parseInt(form.round),
      date: form.date,
      time: form.time,
      jobDescription: form.jobDescription,
      status: "scheduled",
      loggedBy: "Current User",
      notes: form.notes,
    };

    setInterviews([newInterview, ...interviews]);
    setForm({ candidateId: "", company: "", round: "1", date: "", time: "", jobDescription: "", notes: "" });
    setDialogOpen(false);
    toast.success("Interview logged — email sent to Technical Team");
  };

  const updateStatus = (id: string, status: InterviewStatus) => {
    setInterviews(interviews.map((i) => (i.id === id ? { ...i, status } : i)));
    if (status === "no-show") {
      toast.warning("Candidate marked as no-show — compliance team notified, profile on hold");
    } else if (status === "cancelled") {
      toast.info("Interview cancelled — follow-up email sent to company");
    } else {
      toast.success(`Interview status updated to ${statusConfig[status].label}`);
    }
  };

  // Stats
  const scheduled = interviews.filter((i) => i.status === "scheduled").length;
  const completed = interviews.filter((i) => i.status === "completed").length;
  const thisWeek = interviews.filter((i) => i.status === "scheduled" || i.status === "completed").length;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Scheduled</p>
          <p className="text-2xl font-bold text-foreground mt-1">{scheduled}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-foreground mt-1">{completed}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">This Week</p>
          <p className="text-2xl font-bold text-foreground mt-1">{thisWeek}</p>
          <p className="text-xs text-muted-foreground">Target: 4/recruiter</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by candidate or company..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
            <Button><Plus className="w-4 h-4 mr-2" />Log Interview</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Log New Interview</DialogTitle></DialogHeader>
            <div className="space-y-4 mt-2">
              <div>
                <Label>Candidate *</Label>
                <Select value={form.candidateId} onValueChange={(v) => setForm({ ...form, candidateId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select candidate" /></SelectTrigger>
                  <SelectContent>
                    {marketingCandidates.filter((c) => c.status === "active").map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Company *</Label>
                <Input value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="e.g. Google" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Round</Label>
                  <Input type="number" min="1" value={form.round} onChange={(e) => setForm({ ...form, round: e.target.value })} />
                </div>
                <div>
                  <Label>Date *</Label>
                  <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </div>
                <div>
                  <Label>Time *</Label>
                  <Input type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Job Description</Label>
                <Textarea value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} placeholder="Paste job description..." rows={3} />
              </div>
              <div>
                <Label>Notes</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." />
              </div>
              <Button onClick={handleSubmit} className="w-full">Log Interview</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date / Time</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Candidate</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Round</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Logged By</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((i) => {
              const cfg = statusConfig[i.status];
              const Icon = cfg.icon;
              return (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-foreground">{i.date}</p>
                    <p className="text-xs text-muted-foreground">{i.time}</p>
                  </td>
                  <td className="px-5 py-3 text-sm font-medium text-foreground">{i.candidateName}</td>
                  <td className="px-5 py-3">
                    <p className="text-sm text-foreground">{i.company}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]">{i.jobDescription}</p>
                  </td>
                  <td className="px-5 py-3 text-sm text-foreground">Round {i.round}</td>
                  <td className="px-5 py-3">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", cfg.className)}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-sm text-muted-foreground">{i.loggedBy}</td>
                  <td className="px-5 py-3">
                    {i.status === "scheduled" && (
                      <Select onValueChange={(v) => updateStatus(i.id, v as InterviewStatus)}>
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue placeholder="Update" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                          <SelectItem value="rescheduled">Rescheduled</SelectItem>
                          <SelectItem value="no-show">No Show</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground text-sm">No interviews found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
