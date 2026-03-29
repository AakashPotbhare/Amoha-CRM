import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, Trash2 } from "lucide-react";

interface Candidate { id: string; full_name: string; technology: string; }
interface Employee  { id: string; full_name: string; employee_code: string; department_id: string; }

interface Installment {
  amount: string;
  condition: string;
}

export default function CreatePlacementOffer() {
  const { employee } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Candidates & employees for autocomplete
  const [candidates,  setCandidates]  = useState<Candidate[]>([]);
  const [employees,   setEmployees]   = useState<Employee[]>([]);
  const [loading,     setLoading]     = useState(false);

  // Candidate search/selection
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateId,     setCandidateId]     = useState("");

  // Core fields
  const [candidateName,  setCandidateName]  = useState("");
  const [technology,     setTechnology]     = useState("");
  const [offerPosition,  setOfferPosition]  = useState("");
  const [employerName,   setEmployerName]   = useState("");
  const [jobLocation,    setJobLocation]    = useState("");
  const [employmentType, setEmploymentType] = useState("full_time");
  const [offerDate,      setOfferDate]      = useState(new Date().toISOString().slice(0, 10));
  const [joiningDate,    setJoiningDate]    = useState("");
  const [notes,          setNotes]          = useState("");

  // Financial
  const [annualPackage,  setAnnualPackage]  = useState("");
  const [upfrontPaid,    setUpfrontPaid]    = useState("0");
  const [commissionRate, setCommissionRate] = useState("");
  const [commissionAmt,  setCommissionAmt]  = useState("");
  const [finalAmtDue,    setFinalAmtDue]    = useState("");

  // People
  const [pocRecruiter,    setPocRecruiter]    = useState("");
  const [appRecruiter,    setAppRecruiter]    = useState("");
  const [techSupport,     setTechSupport]     = useState("");

  // Installments (1-3)
  const [installments, setInstallments] = useState<Installment[]>([{ amount: "", condition: "" }]);

  useEffect(() => {
    Promise.all([
      api.get<Candidate[]>("/api/candidates?is_enrolled=true&limit=500"),
      api.get<Employee[]>("/api/employees?is_active=true"),
    ]).then(([cRes, eRes]) => {
      if (cRes.success && cRes.data) setCandidates(cRes.data);
      if (eRes.success && eRes.data) setEmployees(eRes.data);
    }).catch(() => {});
  }, []);

  // Auto-compute commission and final amount
  useEffect(() => {
    const pkg  = parseFloat(annualPackage) || 0;
    const rate = parseFloat(commissionRate) || 0;
    if (pkg && rate) {
      const comm = (pkg * rate / 100).toFixed(2);
      setCommissionAmt(comm);
      const upfront = parseFloat(upfrontPaid) || 0;
      setFinalAmtDue((parseFloat(comm) - upfront).toFixed(2));
    }
  }, [annualPackage, commissionRate, upfrontPaid]);

  // When commissionAmt is set manually and no rate, still compute finalAmt
  useEffect(() => {
    if (!commissionRate) {
      const comm    = parseFloat(commissionAmt) || 0;
      const upfront = parseFloat(upfrontPaid) || 0;
      setFinalAmtDue((comm - upfront).toFixed(2));
    }
  }, [commissionAmt, upfrontPaid]);

  // Filter candidates by search
  const filteredCandidates = useMemo(() =>
    candidates.filter(c =>
      !candidateSearch ||
      c.full_name.toLowerCase().includes(candidateSearch.toLowerCase())
    ).slice(0, 20),
    [candidates, candidateSearch]
  );

  const selectCandidate = (c: Candidate) => {
    setCandidateId(c.id);
    setCandidateName(c.full_name);
    setTechnology(c.technology || "");
    setCandidateSearch(c.full_name);
  };

  const addInstallment = () => {
    if (installments.length < 3) {
      setInstallments(prev => [...prev, { amount: "", condition: "" }]);
    }
  };

  const removeInstallment = (idx: number) => {
    setInstallments(prev => prev.filter((_, i) => i !== idx));
  };

  const updateInstallment = (idx: number, field: keyof Installment, value: string) => {
    setInstallments(prev => prev.map((inst, i) => i === idx ? { ...inst, [field]: value } : inst));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidateName.trim()) { toast({ title: "Candidate name is required", variant: "destructive" }); return; }
    if (!technology.trim())    { toast({ title: "Technology is required", variant: "destructive" }); return; }
    if (!offerPosition.trim()) { toast({ title: "Offer position is required", variant: "destructive" }); return; }
    if (!employerName.trim())  { toast({ title: "Employer name is required", variant: "destructive" }); return; }
    if (!offerDate)            { toast({ title: "Offer date is required", variant: "destructive" }); return; }
    if (!annualPackage)        { toast({ title: "Annual package is required", variant: "destructive" }); return; }
    if (!commissionAmt)        { toast({ title: "Commission amount is required", variant: "destructive" }); return; }
    if (!finalAmtDue)          { toast({ title: "Final amount due is required", variant: "destructive" }); return; }

    setLoading(true);
    try {
      const payload: Record<string, unknown> = {
        candidate_enrollment_id: candidateId || null,
        candidate_name: candidateName.trim(),
        technology: technology.trim(),
        offer_position: offerPosition.trim(),
        employer_name: employerName.trim(),
        job_location: jobLocation.trim() || null,
        employment_type: employmentType,
        offer_date: offerDate,
        joining_date: joiningDate || null,
        annual_package: parseFloat(annualPackage),
        upfront_paid: parseFloat(upfrontPaid) || 0,
        commission_rate: commissionRate ? parseFloat(commissionRate) : null,
        commission_amount: parseFloat(commissionAmt),
        final_amount_due: parseFloat(finalAmtDue),
        poc_recruiter_employee_id: pocRecruiter || null,
        application_recruiter_employee_id: appRecruiter || null,
        technical_support_employee_id: techSupport || null,
        notes: notes.trim() || null,
      };

      installments.forEach((inst, idx) => {
        const n = idx + 1;
        if (inst.amount) {
          payload[`installment_${n}_amount`]    = parseFloat(inst.amount);
          payload[`installment_${n}_condition`] = inst.condition || null;
        }
      });

      await api.post("/api/placement-orders", payload);
      toast({ title: "Placement offer created", description: `Compliance team has been notified.` });
      navigate("/placement-orders");
    } catch (err: any) {
      toast({ title: "Error creating offer", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const selectClass = "w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground";

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4 md:mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">New Placement Offer</h1>
          <p className="text-sm text-muted-foreground mt-1">Fill in the offer details — the compliance team will be notified automatically.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* ── Candidate ── */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-4 card-elevated">
          <h2 className="text-base font-semibold text-foreground">Candidate Details</h2>

          <div className="space-y-2">
            <Label>Candidate Name *</Label>
            <div className="relative">
              <Input
                placeholder="Type to search enrolled candidates…"
                value={candidateSearch}
                onChange={e => {
                  setCandidateSearch(e.target.value);
                  setCandidateName(e.target.value);
                  setCandidateId("");
                }}
              />
              {candidateSearch && !candidateId && filteredCandidates.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-lg z-10 max-h-48 overflow-y-auto">
                  {filteredCandidates.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCandidate(c)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors"
                    >
                      {c.full_name}
                      {c.technology && <span className="text-muted-foreground ml-2 text-xs">· {c.technology}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Technology *</Label>
              <Input value={technology} onChange={e => setTechnology(e.target.value)} placeholder="e.g. Java, Python, SAP" required />
            </div>
            <div className="space-y-2">
              <Label>Offer Position *</Label>
              <Input value={offerPosition} onChange={e => setOfferPosition(e.target.value)} placeholder="e.g. Senior Java Developer" required />
            </div>
          </div>
        </section>

        {/* ── Employer ── */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-4 card-elevated">
          <h2 className="text-base font-semibold text-foreground">Employer Details</h2>
          <div className="space-y-2">
            <Label>Employer / Company Name *</Label>
            <Input value={employerName} onChange={e => setEmployerName(e.target.value)} placeholder="Company name" required />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Job Location</Label>
              <Input value={jobLocation} onChange={e => setJobLocation(e.target.value)} placeholder="City, State" />
            </div>
            <div className="space-y-2">
              <Label>Employment Type</Label>
              <select value={employmentType} onChange={e => setEmploymentType(e.target.value)} className={selectClass}>
                <option value="full_time">Full Time</option>
                <option value="contract">Contract</option>
                <option value="part_time">Part Time</option>
                <option value="c2c">C2C</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Offer Date *</Label>
              <Input type="date" value={offerDate} onChange={e => setOfferDate(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label>Joining Date</Label>
              <Input type="date" value={joiningDate} onChange={e => setJoiningDate(e.target.value)} />
            </div>
          </div>
        </section>

        {/* ── Financials ── */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-4 card-elevated">
          <h2 className="text-base font-semibold text-foreground">Financial Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Annual Package ($) *</Label>
              <Input type="number" value={annualPackage} onChange={e => setAnnualPackage(e.target.value)} placeholder="e.g. 1200000" required />
            </div>
            <div className="space-y-2">
              <Label>Upfront Received ($)</Label>
              <Input type="number" value={upfrontPaid} onChange={e => setUpfrontPaid(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Commission Rate (%)</Label>
              <Input type="number" step="0.01" value={commissionRate} onChange={e => setCommissionRate(e.target.value)} placeholder="e.g. 8.33" />
            </div>
            <div className="space-y-2">
              <Label>Commission Amount ($) *</Label>
              <Input type="number" value={commissionAmt} onChange={e => setCommissionAmt(e.target.value)} placeholder="Auto-calculated or enter manually" required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Final Amount Due ($) *</Label>
              <Input type="number" value={finalAmtDue} onChange={e => setFinalAmtDue(e.target.value)} placeholder="Commission - Upfront" required />
              <p className="text-xs text-muted-foreground">Auto-calculated as Commission − Upfront Paid</p>
            </div>
          </div>
        </section>

        {/* ── Installments ── */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-4 card-elevated">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">Payment Installments</h2>
            {installments.length < 3 && (
              <Button type="button" variant="outline" size="sm" onClick={addInstallment} className="gap-1">
                <PlusCircle className="w-3.5 h-3.5" /> Add Installment
              </Button>
            )}
          </div>
          {installments.map((inst, idx) => (
            <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">Installment {idx + 1}</p>
                {installments.length > 1 && (
                  <button type="button" onClick={() => removeInstallment(idx)} className="text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Amount ($)</Label>
                  <Input
                    type="number"
                    value={inst.amount}
                    onChange={e => updateInstallment(idx, "amount", e.target.value)}
                    placeholder="Amount"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Condition / Trigger</Label>
                  <Input
                    value={inst.condition}
                    onChange={e => updateInstallment(idx, "condition", e.target.value)}
                    placeholder="e.g. After 90 days"
                  />
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* ── People Attribution ── */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-4 card-elevated">
          <h2 className="text-base font-semibold text-foreground">People Attribution</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "POC Recruiter (Marketing)", value: pocRecruiter, setter: setPocRecruiter },
              { label: "Application Recruiter (Sales)", value: appRecruiter, setter: setAppRecruiter },
              { label: "Technical Support", value: techSupport, setter: setTechSupport },
            ].map(f => (
              <div key={f.label} className="space-y-2">
                <Label>{f.label}</Label>
                <select value={f.value} onChange={e => f.setter(e.target.value)} className={selectClass}>
                  <option value="">— Not specified —</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.full_name} ({emp.employee_code})</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>

        {/* ── Notes ── */}
        <section className="bg-card border border-border rounded-lg p-6 space-y-3 card-elevated">
          <h2 className="text-base font-semibold text-foreground">Notes</h2>
          <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any additional notes…" rows={3} />
        </section>

        {/* Submit */}
        <div className="flex flex-col-reverse sm:flex-row gap-2 justify-end pt-4">
          <Button type="button" variant="outline" onClick={() => navigate("/placement-orders")} className="w-full sm:w-auto">Cancel</Button>
          <Button type="submit" disabled={loading} className="gap-2 w-full sm:w-auto">
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting…</> : "Submit Placement Offer"}
          </Button>
        </div>
      </form>
    </div>
  );
}
