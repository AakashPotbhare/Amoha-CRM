import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Users, Search, Edit2, KeyRound, History,
  IndianRupee, Download, Clock, CheckCircle,
  XCircle, Loader2, Shield, Eye, EyeOff, RefreshCw,
} from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import HRNoticeManager from "@/components/HRNoticeManager";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Dept   { id: string; name: string; slug: string; }
interface Team   { id: string; name: string; department_id: string; }

interface Employee {
  id: string;
  employee_code: string;
  full_name: string;
  email: string;
  phone: string | null;
  dob: string | null;
  designation: string | null;
  role: string;
  department_id: string;
  department_name: string;
  team_id: string;
  team_name: string;
  joining_date: string | null;
  is_active: boolean;
  base_salary: number | null;
  pf_percentage: number | null;
  professional_tax: number | null;
  created_at: string;
}

interface SalaryHistory {
  id: string;
  previous_salary: number;
  new_salary: number;
  effective_date: string;
  reason: string | null;
  changed_by_name: string | null;
  created_at: string;
}

interface PayrollRow {
  employee_id: string;
  employee_code: string;
  full_name: string;
  designation: string | null;
  department_name: string;
  team_name: string;
  base_salary: number;
  pf_percentage: number;
  professional_tax: number;
  total_days: number;
  present: number;
  half_day: number;
  late: number;
  absent: number;
  wfh: number;
  total_hours: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ALL_ROLES: { value: string; label: string; group: string }[] = [
  { value: "director",           label: "Director",            group: "Leadership" },
  { value: "ops_head",           label: "Operations Head",     group: "Leadership" },
  { value: "hr_head",            label: "HR Head",             group: "Leadership" },
  { value: "sales_head",         label: "Sales Head",          group: "Department Head" },
  { value: "technical_head",     label: "Technical Head",      group: "Department Head" },
  { value: "marketing_tl",       label: "Marketing Team Lead", group: "Department Head" },
  { value: "resume_head",        label: "Resume Head",         group: "Department Head" },
  { value: "compliance_officer", label: "Compliance Officer",  group: "Department Head" },
  { value: "assistant_tl",       label: "Assistant TL",        group: "Mid-Level" },
  { value: "senior_recruiter",   label: "Senior Recruiter",    group: "Mid-Level" },
  { value: "sales_executive",    label: "Sales Executive",     group: "Staff" },
  { value: "lead_generator",     label: "Lead Generator",      group: "Staff" },
  { value: "technical_executive",label: "Technical Executive", group: "Staff" },
  { value: "recruiter",          label: "Recruiter",           group: "Staff" },
  { value: "resume_builder",     label: "Resume Builder",      group: "Staff" },
];

const ROLE_MAP = Object.fromEntries(ALL_ROLES.map(r => [r.value, r.label]));

const DESIGNATIONS = [
  "Director", "Operations Head", "Head HR",
  "Sales Head", "Sales Team Lead",
  "Marketing Team Lead",
  "Technical Head", "Technical Team Lead",
  "Resume Head", "Resume Team Lead",
  "Compliance Officer",
  "Senior Recruiter", "Recruiter",
  "Sales Executive", "Lead Generator",
  "Technical Executive", "Resume Builder",
];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

const TL_ROLES = ["director","ops_head","hr_head","sales_head","technical_head","marketing_tl","resume_head","compliance_officer","assistant_tl"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function probationInfo(joiningDate: string | null) {
  if (!joiningDate) return null;
  const joined = parseISO(joiningDate);
  const probationEnd = addDays(joined, 90); // 3 months ≈ 90 days
  const today = new Date();
  const daysLeft = differenceInDays(probationEnd, today);
  return { inProbation: daysLeft > 0, daysLeft, probationEnd };
}

function fmtCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return `₹${Number(n).toLocaleString("en-IN")}`;
}

function netPay(row: PayrollRow) {
  const pf = Math.round((row.base_salary * row.pf_percentage) / 100);
  return Math.max(0, row.base_salary - pf - row.professional_tax);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HRDashboard() {
  const { employee } = useAuth();
  const { toast } = useToast();

  // Access guard
  const isHR = employee && (["hr_head","director","ops_head"] as string[]).includes(employee.role as string);

  // ── Data state ──────────────────────────────────────────────────────────────
  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [departments, setDepartments]     = useState<Dept[]>([]);
  const [teams, setTeams]                 = useState<Team[]>([]);
  const [loading, setLoading]             = useState(true);

  // ── Employee list filters ────────────────────────────────────────────────────
  const [search, setSearch]               = useState("");
  const [filterDept, setFilterDept]       = useState("all");
  const [filterStatus, setFilterStatus]   = useState("active");
  const [filterRole, setFilterRole]       = useState("all");

  // ── Add/Edit dialog ──────────────────────────────────────────────────────────
  const [dialogOpen, setDialogOpen]       = useState(false);
  const [editTarget, setEditTarget]       = useState<Employee | null>(null);
  const [saving, setSaving]               = useState(false);

  // Form fields
  const [fName, setFName]                 = useState("");
  const [fEmail, setFEmail]               = useState("");
  const [fPhone, setFPhone]               = useState("");
  const [fDob, setFDob]                   = useState("");
  const [fDesignation, setFDesignation]   = useState("");
  const [fRole, setFRole]                 = useState("recruiter");
  const [fDeptId, setFDeptId]             = useState("");
  const [fTeamId, setFTeamId]             = useState("");
  const [fJoining, setFJoining]           = useState(new Date().toISOString().slice(0, 10));
  const [fSalary, setFSalary]             = useState("");
  const [fPf, setFPf]                     = useState("12");
  const [fProfTax, setFProfTax]           = useState("200");
  const [fSalaryReason, setFSalaryReason] = useState("");
  const [fPassword, setFPassword]         = useState("Amoha@2026");
  const [showPass, setShowPass]           = useState(false);

  // ── Salary history dialog ────────────────────────────────────────────────────
  const [historyOpen, setHistoryOpen]     = useState(false);
  const [historyEmp, setHistoryEmp]       = useState<Employee | null>(null);
  const [history, setHistory]             = useState<SalaryHistory[]>([]);

  // ── Payroll tab ──────────────────────────────────────────────────────────────
  const [payMonth, setPayMonth]           = useState(new Date().getMonth() + 1);
  const [payYear, setPayYear]             = useState(new Date().getFullYear());
  const [payrollData, setPayrollData]     = useState<PayrollRow[]>([]);
  const [payLoading, setPayLoading]       = useState(false);
  const [payDept, setPayDept]             = useState("all");

  // ── Reset password dialog ────────────────────────────────────────────────────
  const [resetTarget, setResetTarget]     = useState<Employee | null>(null);
  const [resetPwd, setResetPwd]           = useState("Amoha@2026");
  const [resetting, setResetting]         = useState(false);

  // ── Load master data ────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [empRes, deptRes, teamRes] = await Promise.all([
      api.get<Employee[]>("/api/employees?is_active=all"),
      api.get<Dept[]>("/api/departments"),
      api.get<Team[]>("/api/teams"),
    ]);
    if (empRes.success && empRes.data)   setEmployees(empRes.data);
    if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
    if (teamRes.success && teamRes.data) setTeams(teamRes.data);
    setLoading(false);
  }, []);

  useEffect(() => { if (isHR) fetchAll(); }, [isHR, fetchAll]);

  // ── Payroll fetch ────────────────────────────────────────────────────────────
  const fetchPayroll = useCallback(async () => {
    setPayLoading(true);
    const deptQ = payDept !== "all" ? `&department_id=${payDept}` : "";
    const res = await api.get<PayrollRow[]>(`/api/attendance/report?month=${payMonth}&year=${payYear}${deptQ}`);
    if (res.success && res.data) setPayrollData(res.data);
    else setPayrollData([]);
    setPayLoading(false);
  }, [payMonth, payYear, payDept]);

  // ── Computed values ──────────────────────────────────────────────────────────
  const filteredTeams = useMemo(
    () => fDeptId ? teams.filter(t => t.department_id === fDeptId) : teams,
    [teams, fDeptId]
  );

  const tls = useMemo(
    () => employees.filter(e => TL_ROLES.includes(e.role) && e.is_active),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter(e => {
      const q = search.toLowerCase();
      const matchSearch =
        e.full_name.toLowerCase().includes(q) ||
        e.employee_code.toLowerCase().includes(q) ||
        (e.designation || "").toLowerCase().includes(q) ||
        (e.email || "").toLowerCase().includes(q);
      const matchStatus =
        filterStatus === "all"      ? true :
        filterStatus === "active"   ? e.is_active :
        filterStatus === "inactive" ? !e.is_active :
        filterStatus === "probation" ? (probationInfo(e.joining_date)?.inProbation ?? false) :
        true;
      const matchDept = filterDept === "all" || e.department_id === filterDept;
      const matchRole = filterRole === "all" || e.role === filterRole;
      return matchSearch && matchStatus && matchDept && matchRole;
    });
  }, [employees, search, filterStatus, filterDept, filterRole]);

  const stats = useMemo(() => ({
    total:     employees.length,
    active:    employees.filter(e => e.is_active).length,
    inactive:  employees.filter(e => !e.is_active).length,
    probation: employees.filter(e => probationInfo(e.joining_date)?.inProbation).length,
  }), [employees]);

  const probationEmployees = useMemo(() =>
    employees
      .filter(e => e.is_active && probationInfo(e.joining_date)?.inProbation)
      .map(e => ({ ...e, probInfo: probationInfo(e.joining_date)! }))
      .sort((a, b) => a.probInfo.daysLeft - b.probInfo.daysLeft),
    [employees]
  );

  // ── Form helpers ─────────────────────────────────────────────────────────────
  function resetForm() {
    setFName(""); setFEmail(""); setFPhone(""); setFDob(""); setFDesignation("");
    setFRole("recruiter"); setFDeptId(""); setFTeamId("");
    setFJoining(new Date().toISOString().slice(0, 10));
    setFSalary(""); setFPf("12"); setFProfTax("200"); setFSalaryReason(""); setFPassword("Amoha@2026");
    setEditTarget(null);
  }

  function openAdd() { resetForm(); setDialogOpen(true); }

  function openEdit(emp: Employee) {
    setEditTarget(emp);
    setFName(emp.full_name);
    setFEmail(emp.email);
    setFPhone(emp.phone || "");
    setFDob(emp.dob || "");
    setFDesignation(emp.designation || "");
    setFRole(emp.role);
    setFDeptId(emp.department_id);
    setFTeamId(emp.team_id);
    setFJoining(emp.joining_date || "");
    setFSalary(String(emp.base_salary ?? ""));
    setFPf(String(emp.pf_percentage ?? 12));
    setFProfTax(String(emp.professional_tax ?? 200));
    setFSalaryReason("");
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fName.trim() || !fEmail.trim() || !fDeptId) {
      toast({ title: "Required fields missing", description: "Full name, email, and department are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload: Record<string, any> = {
      full_name: fName.trim(),
      email: fEmail.trim(),
      phone: fPhone.trim() || null,
      dob: fDob || null,
      designation: fDesignation || null,
      role: fRole,
      department_id: fDeptId,
      team_id: fTeamId || undefined,
      joining_date: fJoining || null,
      base_salary: fSalary ? Number(fSalary) : null,
      pf_percentage: fPf ? Number(fPf) : 12,
      professional_tax: fProfTax ? Number(fProfTax) : 200,
    };

    try {
      if (editTarget) {
        // Check if salary changed — log history
        const salaryChanged =
          Number(fSalary || 0) !== Number(editTarget.base_salary || 0);

        await api.patch(`/api/employees/${editTarget.id}`, payload);

        if (salaryChanged && Number(fSalary) > 0) {
          await api.post(`/api/employees/${editTarget.id}/salary-history`, {
            previous_salary: Number(editTarget.base_salary || 0),
            new_salary: Number(fSalary),
            effective_date: new Date().toISOString().slice(0, 10),
            reason: fSalaryReason.trim() || null,
          }).catch(() => {});
        }
        toast({ title: "Employee updated successfully" });
      } else {
        payload.password = fPassword || "Amoha@2026";
        const res = await api.post<any>("/api/employees", payload);
        const code = res.data?.employee_code ?? "";
        const pwd  = res.data?.defaultPassword ?? fPassword;
        toast({
          title: "Employee added",
          description: `Code: ${code} · Default password: ${pwd}`,
        });
      }
      setDialogOpen(false);
      resetForm();
      fetchAll();
    } catch (err: any) {
      toast({ title: "Save failed", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(emp: Employee) {
    try {
      await api.patch(`/api/employees/${emp.id}`, { is_active: !emp.is_active });
      toast({ title: `Employee ${!emp.is_active ? "reactivated" : "deactivated"}` });
      fetchAll();
    } catch (err: any) {
      toast({ title: "Failed", description: err?.message, variant: "destructive" });
    }
  }

  async function openHistory(emp: Employee) {
    setHistoryEmp(emp);
    const res = await api.get<SalaryHistory[]>(`/api/employees/${emp.id}/salary-history`);
    setHistory(res.success && res.data ? res.data : []);
    setHistoryOpen(true);
  }

  async function handleResetPassword() {
    if (!resetTarget) return;
    setResetting(true);
    try {
      await api.post(`/api/employees/${resetTarget.id}/reset-password`, { password: resetPwd });
      toast({ title: "Password reset", description: `New password: ${resetPwd}` });
      setResetTarget(null);
    } catch (err: any) {
      toast({ title: "Reset failed", description: err?.message, variant: "destructive" });
    } finally {
      setResetting(false);
    }
  }

  function downloadPayrollCSV() {
    const headers = [
      "Code","Name","Designation","Department","Team",
      "Present","Half Day","Late","Absent","WFH","Total Hours",
      "Base Salary (₹)","PF %","PF Deduction (₹)","Prof Tax (₹)","Net Payable (₹)"
    ];
    const rows = payrollData.map(r => {
      const pf  = Math.round((r.base_salary * r.pf_percentage) / 100);
      const net = Math.max(0, r.base_salary - pf - r.professional_tax);
      return [
        r.employee_code, r.full_name, r.designation || "", r.department_name, r.team_name,
        r.present, r.half_day, r.late, r.absent, r.wfh, Number(r.total_hours).toFixed(1),
        r.base_salary, r.pf_percentage, pf, r.professional_tax, net,
      ];
    });
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Payroll_${MONTH_NAMES[payMonth - 1]}_${payYear}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: "Downloaded", description: `Payroll for ${MONTH_NAMES[payMonth - 1]} ${payYear}` });
  }

  // ── Access guard ─────────────────────────────────────────────────────────────
  if (!isHR) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] text-center">
        <Shield className="w-12 h-12 text-muted-foreground mb-4 opacity-40" />
        <h2 className="text-lg font-semibold text-foreground">Access Restricted</h2>
        <p className="text-sm text-muted-foreground mt-1">Only HR Head, Operations Head, and Director can access HR management.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">HR Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Employee records, payroll, probation monitoring · As of {format(new Date(), "dd MMM yyyy")}
          </p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <UserPlus className="w-4 h-4" /> Add Employee
        </Button>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Staff",     value: stats.total,     icon: Users,         color: "text-primary",    bg: "bg-primary/10" },
          { label: "Active",          value: stats.active,    icon: CheckCircle,   color: "text-success",    bg: "bg-success/10" },
          { label: "On Probation",    value: stats.probation, icon: Clock,         color: "text-warning",    bg: "bg-warning/10" },
          { label: "Inactive",        value: stats.inactive,  icon: XCircle,       color: "text-destructive",bg: "bg-destructive/10" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
            <div className={`${bg} rounded-md p-2`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tabs ── */}
      <Tabs defaultValue="team" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="team">Team Directory</TabsTrigger>
          <TabsTrigger value="payroll">Payroll Report</TabsTrigger>
          <TabsTrigger value="probation" className="relative">
            Probation
            {stats.probation > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-warning text-warning-foreground rounded-full">
                {stats.probation}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="notices">Notice Board</TabsTrigger>
        </TabsList>

        {/* ════════════════════════════════════════════════════
            TAB 1 — TEAM DIRECTORY
        ════════════════════════════════════════════════════ */}
        <TabsContent value="team" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search name, code, email, designation…"
                className="pl-9"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="probation">On Probation</option>
            </select>
            <select
              value={filterDept}
              onChange={e => setFilterDept(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <select
              value={filterRole}
              onChange={e => setFilterRole(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Roles</option>
              {ALL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <span className="text-xs text-muted-foreground ml-auto">{filteredEmployees.length} employees</span>
          </div>

          {/* Employee table */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Role / Dept</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contact</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Joining</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Salary</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground text-sm">
                        No employees match your filters.
                      </td>
                    </tr>
                  ) : filteredEmployees.map(emp => {
                    const prob = probationInfo(emp.joining_date);
                    return (
                      <tr key={emp.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        {/* Employee */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <span className="text-xs font-bold text-primary">{emp.full_name.charAt(0)}</span>
                            </div>
                            <div>
                              <p className="font-medium text-foreground leading-tight">{emp.full_name}</p>
                              <p className="text-xs text-muted-foreground">{emp.employee_code}</p>
                              {emp.designation && <p className="text-xs text-muted-foreground">{emp.designation}</p>}
                            </div>
                          </div>
                        </td>
                        {/* Role / Dept */}
                        <td className="px-4 py-3">
                          <p className="text-foreground">{ROLE_MAP[emp.role] || emp.role}</p>
                          <p className="text-xs text-muted-foreground">{emp.department_name} · {emp.team_name}</p>
                        </td>
                        {/* Contact */}
                        <td className="px-4 py-3">
                          <p className="text-foreground text-xs">{emp.email}</p>
                          {emp.phone && <p className="text-xs text-muted-foreground">{emp.phone}</p>}
                        </td>
                        {/* Joining */}
                        <td className="px-4 py-3">
                          {emp.joining_date ? (
                            <>
                              <p className="text-foreground">{format(parseISO(emp.joining_date), "dd MMM yyyy")}</p>
                              {prob?.inProbation && (
                                <p className="text-xs text-warning">Probation: {prob.daysLeft}d left</p>
                              )}
                            </>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        {/* Salary */}
                        <td className="px-4 py-3 text-right">
                          <p className="font-medium text-foreground">{fmtCurrency(emp.base_salary)}</p>
                          {emp.base_salary != null && (
                            <p className="text-xs text-muted-foreground">
                              PF {emp.pf_percentage ?? 12}% · PT ₹{emp.professional_tax ?? 200}
                            </p>
                          )}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${emp.is_active ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive"}`}>
                            {emp.is_active ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                            {emp.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => openEdit(emp)}
                              title="Edit employee"
                              className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => openHistory(emp)}
                              title="Salary history"
                              className="p-1.5 rounded-md hover:bg-info/10 text-muted-foreground hover:text-info transition-colors"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => { setResetTarget(emp); setResetPwd("Amoha@2026"); }}
                              title="Reset password"
                              className="p-1.5 rounded-md hover:bg-warning/10 text-muted-foreground hover:text-warning transition-colors"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => toggleActive(emp)}
                              title={emp.is_active ? "Deactivate" : "Reactivate"}
                              className={`p-1.5 rounded-md transition-colors text-muted-foreground ${emp.is_active ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-success/10 hover:text-success"}`}
                            >
                              {emp.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 2 — PAYROLL REPORT
        ════════════════════════════════════════════════════ */}
        <TabsContent value="payroll" className="space-y-4">
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={payMonth}
              onChange={e => setPayMonth(Number(e.target.value))}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select
              value={payYear}
              onChange={e => setPayYear(Number(e.target.value))}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={payDept}
              onChange={e => setPayDept(e.target.value)}
              className="border border-input rounded-md px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="all">All Departments</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={fetchPayroll} disabled={payLoading} className="gap-2">
              {payLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Generate
            </Button>
            {payrollData.length > 0 && (
              <Button variant="outline" size="sm" onClick={downloadPayrollCSV} className="gap-2 ml-auto">
                <Download className="w-4 h-4" /> Export CSV
              </Button>
            )}
          </div>

          {/* Payroll summary cards */}
          {payrollData.length > 0 && (() => {
            const totalBase = payrollData.reduce((s, r) => s + Number(r.base_salary), 0);
            const totalPf   = payrollData.reduce((s, r) => s + Math.round((r.base_salary * r.pf_percentage) / 100), 0);
            const totalNet  = payrollData.reduce((s, r) => s + netPay(r), 0);
            return (
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-card border border-border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Gross</p>
                  <p className="text-xl font-bold text-foreground">{fmtCurrency(totalBase)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total PF Deducted</p>
                  <p className="text-xl font-bold text-destructive">{fmtCurrency(totalPf)}</p>
                </div>
                <div className="bg-card border border-border rounded-lg p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Total Net Payable</p>
                  <p className="text-xl font-bold text-success">{fmtCurrency(totalNet)}</p>
                </div>
              </div>
            );
          })()}

          {/* Payroll table */}
          {payrollData.length === 0 && !payLoading ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
              Click "Generate" to load payroll data for {MONTH_NAMES[payMonth - 1]} {payYear}.
            </div>
          ) : payLoading ? (
            <div className="bg-card border border-border rounded-lg p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Employee</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">Present</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">½ Day</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">Late</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">Absent</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">WFH</th>
                      <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase">Hrs</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Base</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">PF</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Prof Tax</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Net Pay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollData.map(r => {
                      const pf  = Math.round((r.base_salary * r.pf_percentage) / 100);
                      const net = netPay(r);
                      return (
                        <tr key={r.employee_id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <p className="font-medium text-foreground">{r.full_name}</p>
                            <p className="text-xs text-muted-foreground">{r.employee_code} · {r.department_name}</p>
                          </td>
                          <td className="px-3 py-3 text-center text-success font-medium">{r.present}</td>
                          <td className="px-3 py-3 text-center text-info">{r.half_day}</td>
                          <td className="px-3 py-3 text-center text-warning">{r.late}</td>
                          <td className="px-3 py-3 text-center text-destructive">{r.absent}</td>
                          <td className="px-3 py-3 text-center text-muted-foreground">{r.wfh}</td>
                          <td className="px-3 py-3 text-center text-muted-foreground">{Number(r.total_hours).toFixed(1)}</td>
                          <td className="px-4 py-3 text-right text-foreground">{fmtCurrency(r.base_salary)}</td>
                          <td className="px-4 py-3 text-right text-destructive">-{fmtCurrency(pf)}</td>
                          <td className="px-4 py-3 text-right text-destructive">-{fmtCurrency(r.professional_tax)}</td>
                          <td className="px-4 py-3 text-right font-bold text-success">{fmtCurrency(net)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 3 — PROBATION WATCH
        ════════════════════════════════════════════════════ */}
        <TabsContent value="probation" className="space-y-4">
          {probationEmployees.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center">
              <CheckCircle className="w-8 h-8 text-success mx-auto mb-2 opacity-60" />
              <p className="text-muted-foreground">No employees currently on probation.</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {probationEmployees.length} employee{probationEmployees.length !== 1 ? "s" : ""} currently in their 90-day probation period.
                Sorted by days remaining.
              </p>
              {probationEmployees.map(emp => (
                <div key={emp.id} className={`bg-card border rounded-lg p-4 flex items-center gap-4 ${emp.probInfo.daysLeft <= 14 ? "border-warning/50 bg-warning/5" : "border-border"}`}>
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-primary">{emp.full_name.charAt(0)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{emp.full_name}
                      <span className="ml-2 text-xs text-muted-foreground">{emp.employee_code}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">{ROLE_MAP[emp.role] || emp.role} · {emp.department_name}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-medium text-foreground">
                      Joined: {emp.joining_date ? format(parseISO(emp.joining_date), "dd MMM yyyy") : "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Ends: {format(emp.probInfo.probationEnd, "dd MMM yyyy")}
                    </p>
                  </div>
                  <div className="shrink-0">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${emp.probInfo.daysLeft <= 14 ? "bg-warning/10 text-warning" : "bg-info/10 text-info"}`}>
                      <Clock className="w-3.5 h-3.5" />
                      {emp.probInfo.daysLeft}d left
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => openEdit(emp)}>
                    <Edit2 className="w-3.5 h-3.5 mr-1" /> Review
                  </Button>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 4 — NOTICE BOARD
        ════════════════════════════════════════════════════ */}
        <TabsContent value="notices">
          <HRNoticeManager />
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════
          ADD / EDIT EMPLOYEE DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editTarget ? `Edit — ${editTarget.full_name}` : "Add New Employee"}</DialogTitle>
            {editTarget && (
              <p className="text-xs text-muted-foreground">{editTarget.employee_code} · Joined {editTarget.joining_date ? format(parseISO(editTarget.joining_date), "dd MMM yyyy") : "—"}</p>
            )}
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Personal Details */}
            <section>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Personal Details</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Full Name *</Label>
                  <Input value={fName} onChange={e => setFName(e.target.value)} placeholder="Full legal name" />
                </div>
                <div><Label>Email *</Label>
                  <Input type="email" value={fEmail} onChange={e => setFEmail(e.target.value)} placeholder="email@company.com" />
                </div>
                <div><Label>Phone</Label>
                  <Input value={fPhone} onChange={e => setFPhone(e.target.value)} placeholder="+91 98765 43210" />
                </div>
                <div><Label>Date of Birth</Label>
                  <Input type="date" value={fDob} onChange={e => setFDob(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Role & Placement */}
            <section className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Role & Placement</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <div><Label>Designation</Label>
                  <Select value={fDesignation} onValueChange={setFDesignation}>
                    <SelectTrigger><SelectValue placeholder="Select designation" /></SelectTrigger>
                    <SelectContent>
                      {DESIGNATIONS.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>System Role</Label>
                  <Select value={fRole} onValueChange={setFRole}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ALL_ROLES.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Department *</Label>
                  <Select value={fDeptId} onValueChange={v => { setFDeptId(v); setFTeamId(""); }}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Team</Label>
                  <Select value={fTeamId} onValueChange={setFTeamId} disabled={!fDeptId}>
                    <SelectTrigger><SelectValue placeholder={fDeptId ? "Select team" : "Select dept first"} /></SelectTrigger>
                    <SelectContent>
                      {filteredTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Joining Date</Label>
                  <Input type="date" value={fJoining} onChange={e => setFJoining(e.target.value)} />
                </div>
              </div>
            </section>

            {/* Salary & Deductions */}
            <section className="border-t pt-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                <span className="flex items-center gap-1"><IndianRupee className="w-3.5 h-3.5" /> Salary & Deductions</span>
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <div><Label>Base Salary (₹/month)</Label>
                  <Input type="number" min="0" value={fSalary} onChange={e => setFSalary(e.target.value)} placeholder="e.g. 25000" />
                </div>
                <div><Label>PF % (default 12)</Label>
                  <Input type="number" min="0" max="100" step="0.5" value={fPf} onChange={e => setFPf(e.target.value)} />
                  {fSalary && fPf && (
                    <p className="text-xs text-muted-foreground mt-1">
                      = ₹{Math.round((Number(fSalary) * Number(fPf)) / 100).toLocaleString("en-IN")}/mo
                    </p>
                  )}
                </div>
                <div><Label>Professional Tax (₹/month)</Label>
                  <Input type="number" min="0" value={fProfTax} onChange={e => setFProfTax(e.target.value)} />
                </div>
              </div>
              {editTarget && (
                <div className="mt-3">
                  <Label>Reason for Salary Change <span className="text-muted-foreground font-normal">(if changed)</span></Label>
                  <Input value={fSalaryReason} onChange={e => setFSalaryReason(e.target.value)} placeholder="e.g. Annual increment, promotion…" />
                </div>
              )}
              {fSalary && fPf && fProfTax && (
                <div className="mt-3 bg-success/5 border border-success/20 rounded-md p-3 text-sm">
                  <span className="text-muted-foreground">Net payable: </span>
                  <span className="font-semibold text-success">
                    {fmtCurrency(Math.max(0, Number(fSalary) - Math.round((Number(fSalary) * Number(fPf)) / 100) - Number(fProfTax)))}
                    /month
                  </span>
                </div>
              )}
            </section>

            {/* Password (new employees only) */}
            {!editTarget && (
              <section className="border-t pt-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Login Password</p>
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    value={fPassword}
                    onChange={e => setFPassword(e.target.value)}
                    placeholder="Default: Amoha@2026"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Employee must change this on first login.</p>
              </section>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => { resetForm(); setDialogOpen(false); }}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editTarget ? "Save Changes" : "Create Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          SALARY HISTORY DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Salary History — {historyEmp?.full_name}</DialogTitle>
            <p className="text-xs text-muted-foreground">{historyEmp?.employee_code} · Current: {fmtCurrency(historyEmp?.base_salary)}/mo</p>
          </DialogHeader>
          {history.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">No salary change history found.</p>
          ) : (
            <div className="space-y-3 pt-2">
              {history.map(h => (
                <div key={h.id} className="border border-border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground">
                      {fmtCurrency(h.previous_salary)} → <span className="text-success">{fmtCurrency(h.new_salary)}</span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {h.effective_date ? format(parseISO(h.effective_date), "dd MMM yyyy") : "—"}
                    </span>
                  </div>
                  {h.reason && <p className="text-xs text-muted-foreground">Reason: {h.reason}</p>}
                  <p className="text-xs text-muted-foreground">
                    Changed by: {h.changed_by_name || "—"} · {format(parseISO(h.created_at), "dd MMM yyyy HH:mm")}
                  </p>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          RESET PASSWORD DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={!!resetTarget} onOpenChange={v => { if (!v) setResetTarget(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <p className="text-xs text-muted-foreground">{resetTarget?.full_name} · {resetTarget?.employee_code}</p>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>New Password</Label>
              <div className="relative mt-1">
                <Input
                  type={showPass ? "text" : "password"}
                  value={resetPwd}
                  onChange={e => setResetPwd(e.target.value)}
                  className="pr-10"
                />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Share this password with the employee securely. They should change it immediately after logging in.</p>
          </div>
          <div className="flex justify-end gap-3 pt-3">
            <Button variant="outline" onClick={() => setResetTarget(null)}>Cancel</Button>
            <Button onClick={handleResetPassword} disabled={resetting} variant="destructive">
              {resetting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <KeyRound className="w-4 h-4 mr-1" />}
              Reset Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
