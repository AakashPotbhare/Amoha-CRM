import { useState } from "react";
import { Application, JOB_PORTALS, ApplicationType, JobPortal } from "@/types/marketing";
import { marketingApplications, marketingCandidates, marketingRecruiters } from "@/data/marketingData";
import { Plus, Search, ExternalLink, Filter } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function ApplicationTracker() {
  const [applications, setApplications] = useState<Application[]>(marketingApplications);
  const [search, setSearch] = useState("");
  const [portalFilter, setPortalFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);

  // New application form state
  const [form, setForm] = useState({
    candidateId: "",
    company: "",
    jobTitle: "",
    portal: "" as JobPortal | "",
    type: "" as ApplicationType | "",
    linkUrl: "",
  });

  const filtered = applications.filter((a) => {
    const matchSearch =
      a.candidateName.toLowerCase().includes(search.toLowerCase()) ||
      a.company.toLowerCase().includes(search.toLowerCase()) ||
      a.jobTitle.toLowerCase().includes(search.toLowerCase());
    const matchPortal = portalFilter === "all" || a.portal === portalFilter;
    const matchType = typeFilter === "all" || a.type === typeFilter;
    return matchSearch && matchPortal && matchType;
  });

  // Duplicate check
  const isDuplicate = (candidateId: string, company: string, jobTitle: string) => {
    return applications.some(
      (a) =>
        a.candidateId === candidateId &&
        a.company.toLowerCase() === company.toLowerCase() &&
        a.jobTitle.toLowerCase() === jobTitle.toLowerCase()
    );
  };

  const handleSubmit = () => {
    if (!form.candidateId || !form.company || !form.jobTitle || !form.portal || !form.type) {
      toast.error("Please fill all required fields");
      return;
    }

    if (isDuplicate(form.candidateId, form.company, form.jobTitle)) {
      toast.error("Duplicate application! This candidate already has an application for this role at this company.");
      return;
    }

    const candidate = marketingCandidates.find((c) => c.id === form.candidateId);
    const newApp: Application = {
      id: `a${Date.now()}`,
      candidateId: form.candidateId,
      candidateName: candidate?.name ?? "",
      company: form.company,
      jobTitle: form.jobTitle,
      portal: form.portal as JobPortal,
      type: form.type as ApplicationType,
      date: new Date().toISOString().split("T")[0],
      appliedBy: "Current User",
      linkUrl: form.linkUrl,
    };

    setApplications([newApp, ...applications]);
    setForm({ candidateId: "", company: "", jobTitle: "", portal: "", type: "", linkUrl: "" });
    setDialogOpen(false);
    toast.success("Application logged successfully");
  };

  // Stats
  const todayStr = new Date().toISOString().split("T")[0];
  const todayApps = applications.filter((a) => a.date === todayStr);
  const longToday = todayApps.filter((a) => a.type === "long").length;
  const shortToday = todayApps.filter((a) => a.type === "short").length;

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Today's Applications</p>
          <p className="text-2xl font-bold text-foreground mt-1">{todayApps.length}</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Long Applications</p>
          <p className="text-2xl font-bold text-foreground mt-1">{longToday}</p>
          <p className="text-xs text-muted-foreground">Target: 50/recruiter</p>
        </div>
        <div className="bg-card rounded-lg border border-border p-4">
          <p className="text-xs font-medium text-muted-foreground">Short Applications</p>
          <p className="text-2xl font-bold text-foreground mt-1">{shortToday}</p>
          <p className="text-xs text-muted-foreground">Target: 50/recruiter</p>
        </div>
      </div>

      {/* Filters + Add */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by candidate, company, or job title..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={portalFilter} onValueChange={setPortalFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Portal" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Portals</SelectItem>
            {JOB_PORTALS.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="long">Long</SelectItem>
            <SelectItem value="short">Short</SelectItem>
          </SelectContent>
        </Select>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 mr-2" />Log Application</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Log New Application</DialogTitle>
            </DialogHeader>
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
              <div>
                <Label>Job Title *</Label>
                <Input value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} placeholder="e.g. Senior React Developer" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Portal *</Label>
                  <Select value={form.portal} onValueChange={(v) => setForm({ ...form, portal: v as JobPortal })}>
                    <SelectTrigger><SelectValue placeholder="Select portal" /></SelectTrigger>
                    <SelectContent>
                      {JOB_PORTALS.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Type *</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as ApplicationType })}>
                    <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="long">Long</SelectItem>
                      <SelectItem value="short">Short</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Application Link</Label>
                <Input value={form.linkUrl} onChange={(e) => setForm({ ...form, linkUrl: e.target.value })} placeholder="https://..." />
              </div>
              <Button onClick={handleSubmit} className="w-full">Submit Application</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Candidate</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Company</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Job Title</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Portal</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Applied By</th>
              <th className="px-5 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Link</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                <td className="px-5 py-3 text-sm text-foreground">{a.date}</td>
                <td className="px-5 py-3 text-sm font-medium text-foreground">{a.candidateName}</td>
                <td className="px-5 py-3 text-sm text-foreground">{a.company}</td>
                <td className="px-5 py-3 text-sm text-foreground">{a.jobTitle}</td>
                <td className="px-5 py-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">
                    {a.portal}
                  </span>
                </td>
                <td className="px-5 py-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.type === "long" ? "bg-primary/10 text-primary" : "bg-accent text-accent-foreground"}`}>
                    {a.type === "long" ? "Long" : "Short"}
                  </span>
                </td>
                <td className="px-5 py-3 text-sm text-muted-foreground">{a.appliedBy}</td>
                <td className="px-5 py-3">
                  {a.linkUrl && (
                    <a href={a.linkUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground text-sm">No applications found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
