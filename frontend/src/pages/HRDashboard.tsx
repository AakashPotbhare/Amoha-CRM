import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  UserPlus, Users, Search, Edit2, KeyRound, History,
  IndianRupee, Download, Clock, CheckCircle,
  XCircle, Loader2, Shield, Eye, EyeOff, RefreshCw,
  Trash2, MapPin, Plus,
} from "lucide-react";
import { format, parseISO, differenceInDays, addDays } from "date-fns";
import HRNoticeManager from "@/components/HRNoticeManager";
import { exportToExcel, exportToPDF, payrollColumns, formatPayrollForExport } from "@/lib/exportUtils";

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

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_minutes: number;
  description: string | null;
}

interface OfficeLocation {
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
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
const ROLE_DEFAULT_DEPARTMENT: Record<string, string> = {
  director: "management",
  ops_head: "operations",
};

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

  // ── Shifts tab ───────────────────────────────────────────────────────────────
  const [shifts, setShifts]               = useState<Shift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);
  const [editingShift, setEditingShift]   = useState<Shift | null>(null);
  const [editShiftForm, setEditShiftForm] = useState({
    name: "", start_time: "", end_time: "", grace_minutes: 15, description: "",
  });
  const [shiftDialogOpen, setShiftDialogOpen]   = useState(false);
  const [deletingShift, setDeletingShift]       = useState<Shift | null>(null);
  const [savingShift, setSavingShift]           = useState(false);
  // Add-shift form
  const [addShiftOpen, setAddShiftOpen]         = useState(false);
  const [addShiftForm, setAddShiftForm]         = useState({
    name: "", start_time: "09:00", end_time: "18:00", grace_minutes: 15, description: "",
  });

  // ── Office Locations tab ─────────────────────────────────────────────────────
  const [locations, setLocations]                   = useState<OfficeLocation[]>([]);
  const [locationsLoading, setLocationsLoading]     = useState(false);
  const [editingLocation, setEditingLocation]       = useState<OfficeLocation | null>(null);
  const [editLocationForm, setEditLocationForm]     = useState({
    name: "", address: "", latitude: 0, longitude: 0, radius_meters: 100,
  });
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);
  const [deletingLocation, setDeletingLocation]     = useState<OfficeLocation | null>(null);
  const [savingLocation, setSavingLocation]         = useState(false);
  // Add-location form
  const [addLocationOpen, setAddLocationOpen]       = useState(false);
  const [addLocationForm, setAddLocationForm]       = useState({
    name: "", address: "", latitude: 0, longitude: 0, radius_meters: 100,
  });

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

  useEffect(() => {
    if (!dialogOpen) return;

    const forcedDeptSlug = ROLE_DEFAULT_DEPARTMENT[fRole];
    if (!forcedDeptSlug) return;

    const forcedDept = departments.find(d => d.slug === forcedDeptSlug);
    if (!forcedDept) return;

    const forcedTeam = teams.find(t => t.department_id === forcedDept.id);
    if (fDeptId !== forcedDept.id) {
      setFDeptId(forcedDept.id);
      setFTeamId(forcedTeam?.id || "");
      return;
    }

    if (!fTeamId || !teams.some(t => t.id === fTeamId && t.department_id === forcedDept.id)) {
      setFTeamId(forcedTeam?.id || "");
    }
  }, [dialogOpen, fRole, departments, teams, fDeptId, fTeamId]);

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

  // ── Shift fetch & handlers ───────────────────────────────────────────────────
  const fetchShifts = useCallback(async () => {
    setShiftsLoading(true);
    try {
      const res = await api.get<Shift[]>("/api/hr/shifts");
      if (res.success && res.data) setShifts(res.data);
    } catch { /* ignore */ } finally { setShiftsLoading(false); }
  }, []);

  function openEditShift(shift: Shift) {
    setEditingShift(shift);
    setEditShiftForm({
      name: shift.name,
      start_time: shift.start_time,
      end_time: shift.end_time,
      grace_minutes: shift.grace_minutes,
      description: shift.description || "",
    });
    setShiftDialogOpen(true);
  }

  async function handleSaveShift() {
    if (!editingShift) return;
    if (!editShiftForm.name.trim()) {
      toast({ title: "Shift name is required", variant: "destructive" }); return;
    }
    setSavingShift(true);
    try {
      await api.patch(`/api/hr/shifts/${editingShift.id}`, {
        name: editShiftForm.name.trim(),
        start_time: editShiftForm.start_time,
        end_time: editShiftForm.end_time,
        grace_minutes: Number(editShiftForm.grace_minutes),
        description: editShiftForm.description.trim() || null,
      });
      toast({ title: "Shift updated successfully" });
      setShiftDialogOpen(false);
      setEditingShift(null);
      fetchShifts();
    } catch (err: any) {
      toast({ title: "Failed to update shift", description: err?.message, variant: "destructive" });
    } finally { setSavingShift(false); }
  }

  async function handleDeleteShift() {
    if (!deletingShift) return;
    try {
      await api.delete(`/api/hr/shifts/${deletingShift.id}`);
      toast({ title: "Shift deleted" });
      setDeletingShift(null);
      fetchShifts();
    } catch (err: any) {
      toast({ title: "Failed to delete shift", description: err?.message, variant: "destructive" });
    }
  }

  async function handleAddShift() {
    if (!addShiftForm.name.trim()) {
      toast({ title: "Shift name is required", variant: "destructive" }); return;
    }
    setSavingShift(true);
    try {
      await api.post("/api/hr/shifts", {
        name: addShiftForm.name.trim(),
        start_time: addShiftForm.start_time,
        end_time: addShiftForm.end_time,
        grace_minutes: Number(addShiftForm.grace_minutes),
        description: addShiftForm.description.trim() || null,
      });
      toast({ title: "Shift created successfully" });
      setAddShiftOpen(false);
      setAddShiftForm({ name: "", start_time: "09:00", end_time: "18:00", grace_minutes: 15, description: "" });
      fetchShifts();
    } catch (err: any) {
      toast({ title: "Failed to create shift", description: err?.message, variant: "destructive" });
    } finally { setSavingShift(false); }
  }

  // ── Office Location fetch & handlers ─────────────────────────────────────────
  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true);
    try {
      const res = await api.get<OfficeLocation[]>("/api/hr/office-locations");
      if (res.success && res.data) setLocations(res.data);
    } catch { /* ignore */ } finally { setLocationsLoading(false); }
  }, []);

  function openEditLocation(loc: OfficeLocation) {
    setEditingLocation(loc);
    setEditLocationForm({
      name: loc.name,
      address: loc.address || "",
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius_meters: loc.radius_meters,
    });
    setLocationDialogOpen(true);
  }

  async function handleSaveLocation() {
    if (!editingLocation) return;
    if (!editLocationForm.name.trim()) {
      toast({ title: "Location name is required", variant: "destructive" }); return;
    }
    setSavingLocation(true);
    try {
      await api.patch(`/api/hr/office-locations/${editingLocation.id}`, {
        name: editLocationForm.name.trim(),
        address: editLocationForm.address.trim() || null,
        latitude: Number(editLocationForm.latitude),
        longitude: Number(editLocationForm.longitude),
        radius_meters: Number(editLocationForm.radius_meters),
      });
      toast({ title: "Office location updated successfully" });
      setLocationDialogOpen(false);
      setEditingLocation(null);
      fetchLocations();
    } catch (err: any) {
      toast({ title: "Failed to update location", description: err?.message, variant: "destructive" });
    } finally { setSavingLocation(false); }
  }

  async function handleDeleteLocation() {
    if (!deletingLocation) return;
    try {
      await api.delete(`/api/hr/office-locations/${deletingLocation.id}`);
      toast({ title: "Office location deleted" });
      setDeletingLocation(null);
      fetchLocations();
    } catch (err: any) {
      toast({ title: "Failed to delete location", description: err?.message, variant: "destructive" });
    }
  }

  async function handleAddLocation() {
    if (!addLocationForm.name.trim()) {
      toast({ title: "Location name is required", variant: "destructive" }); return;
    }
    setSavingLocation(true);
    try {
      await api.post("/api/hr/office-locations", {
        name: addLocationForm.name.trim(),
        address: addLocationForm.address.trim() || null,
        latitude: Number(addLocationForm.latitude),
        longitude: Number(addLocationForm.longitude),
        radius_meters: Number(addLocationForm.radius_meters),
      });
      toast({ title: "Office location created successfully" });
      setAddLocationOpen(false);
      setAddLocationForm({ name: "", address: "", latitude: 0, longitude: 0, radius_meters: 100 });
      fetchLocations();
    } catch (err: any) {
      toast({ title: "Failed to create location", description: err?.message, variant: "destructive" });
    } finally { setSavingLocation(false); }
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
    <div className="p-3 md:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">

      {/* ── Page header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">HR Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Employee records, payroll, probation monitoring · As of {format(new Date(), "dd MMM yyyy")}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button onClick={openAdd} className="gap-2 w-full sm:w-auto">
            <UserPlus className="w-4 h-4" /> Add Employee
          </Button>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
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
        <div className="overflow-x-auto pb-1">
          <TabsList className="flex w-max min-w-full h-auto gap-1">
            <TabsTrigger value="team" className="whitespace-nowrap px-3 text-sm">Team Directory</TabsTrigger>
            <TabsTrigger value="payroll" className="whitespace-nowrap px-3 text-sm">Payroll Report</TabsTrigger>
            <TabsTrigger value="probation" className="relative whitespace-nowrap px-3 text-sm">
              Probation
              {stats.probation > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-bold bg-warning text-warning-foreground rounded-full">
                  {stats.probation}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="notices" className="whitespace-nowrap px-3 text-sm">Notice Board</TabsTrigger>
            <TabsTrigger value="shifts" className="whitespace-nowrap px-3 text-sm" onClick={() => { if (!shifts.length) fetchShifts(); }}>Shifts</TabsTrigger>
            <TabsTrigger value="locations" className="whitespace-nowrap px-3 text-sm" onClick={() => { if (!locations.length) fetchLocations(); }}>Office Locations</TabsTrigger>
          </TabsList>
        </div>

        {/* ════════════════════════════════════════════════════
            TAB 1 — TEAM DIRECTORY
        ════════════════════════════════════════════════════ */}
        <TabsContent value="team" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
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
              <table className="w-full min-w-[900px] text-sm">
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
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center flex-wrap">
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
              <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:ml-auto">
                <Button variant="outline" size="sm" onClick={downloadPayrollCSV} className="gap-2">
                  <Download className="w-4 h-4" /> CSV
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToExcel(formatPayrollForExport(payrollData as unknown as Record<string, unknown>[]), payrollColumns, `Payroll_${MONTH_NAMES[payMonth - 1]}_${payYear}`)}>
                  <Download className="w-4 h-4" /> Excel
                </Button>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => exportToPDF(formatPayrollForExport(payrollData as unknown as Record<string, unknown>[]), payrollColumns, `Payroll Report – ${MONTH_NAMES[payMonth - 1]} ${payYear}`, `Payroll_${MONTH_NAMES[payMonth - 1]}_${payYear}`)}>
                  <Download className="w-4 h-4" /> PDF
                </Button>
              </div>
            )}
          </div>

          {/* Payroll summary cards */}
          {payrollData.length > 0 && (() => {
            const totalBase = payrollData.reduce((s, r) => s + Number(r.base_salary), 0);
            const totalPf   = payrollData.reduce((s, r) => s + Math.round((r.base_salary * r.pf_percentage) / 100), 0);
            const totalNet  = payrollData.reduce((s, r) => s + netPay(r), 0);
            return (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
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
                <table className="w-full min-w-[900px] text-sm">
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
                <div key={emp.id} className={`bg-card border rounded-lg p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 ${emp.probInfo.daysLeft <= 14 ? "border-warning/50 bg-warning/5" : "border-border"}`}>
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

        {/* ════════════════════════════════════════════════════
            TAB 5 — SHIFT MANAGEMENT
        ════════════════════════════════════════════════════ */}
        <TabsContent value="shifts" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Shift Management</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Define and manage work shifts for attendance tracking.</p>
            </div>
            {(employee?.role === "director" || employee?.role === "hr_head") && (
              <Button size="sm" className="gap-2 w-full sm:w-auto" onClick={() => setAddShiftOpen(true)}>
                <Plus className="w-4 h-4" /> Add Shift
              </Button>
            )}
          </div>

          {shiftsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : shifts.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
              No shifts configured yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shift Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Start Time</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">End Time</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Grace (mins)</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</th>
                      {(employee?.role === "director" || employee?.role === "hr_head") && (
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map(shift => (
                      <tr key={shift.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">{shift.name}</td>
                        <td className="px-4 py-3 text-foreground">{shift.start_time}</td>
                        <td className="px-4 py-3 text-foreground">{shift.end_time}</td>
                        <td className="px-4 py-3 text-foreground">{shift.grace_minutes}</td>
                        <td className="px-4 py-3 text-muted-foreground">{shift.description || "—"}</td>
                        {(employee?.role === "director" || employee?.role === "hr_head") && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditShift(shift)}
                                title="Edit shift"
                                className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingShift(shift)}
                                title="Delete shift"
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ════════════════════════════════════════════════════
            TAB 6 — OFFICE LOCATIONS
        ════════════════════════════════════════════════════ */}
        <TabsContent value="locations" className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Office Locations</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Geo-fenced locations used for attendance check-in validation.</p>
            </div>
            {(employee?.role === "director" || employee?.role === "hr_head") && (
              <Button size="sm" className="gap-2 w-full sm:w-auto" onClick={() => setAddLocationOpen(true)}>
                <Plus className="w-4 h-4" /> Add Location
              </Button>
            )}
          </div>

          {locationsLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : locations.length === 0 ? (
            <div className="bg-card border border-border rounded-lg p-8 text-center text-muted-foreground">
              No office locations configured yet.
            </div>
          ) : (
            <div className="bg-card border border-border rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Name</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Address</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Coordinates</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Radius (m)</th>
                      {(employee?.role === "director" || employee?.role === "hr_head") && (
                        <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {locations.map(loc => (
                      <tr key={loc.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium text-foreground">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            {loc.name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{loc.address || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs font-mono">
                          {loc.latitude.toFixed(6)}, {loc.longitude.toFixed(6)}
                        </td>
                        <td className="px-4 py-3 text-foreground">{loc.radius_meters}</td>
                        {(employee?.role === "director" || employee?.role === "hr_head") && (
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => openEditLocation(loc)}
                                title="Edit location"
                                className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingLocation(loc)}
                                title="Delete location"
                                className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ═══════════════════════════════════════════════
          ADD / EDIT EMPLOYEE DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); setDialogOpen(v); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
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
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto">
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
        <DialogContent className="w-[95vw] max-w-sm">
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

      {/* ═══════════════════════════════════════════════
          EDIT SHIFT DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={shiftDialogOpen} onOpenChange={v => { if (!v) { setShiftDialogOpen(false); setEditingShift(null); } }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Shift — {editingShift?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Shift Name *</Label>
              <Input
                value={editShiftForm.name}
                onChange={e => setEditShiftForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Morning Shift"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={editShiftForm.start_time}
                  onChange={e => setEditShiftForm(f => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={editShiftForm.end_time}
                  onChange={e => setEditShiftForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Grace Minutes</Label>
              <Input
                type="number"
                min="0"
                max="60"
                value={editShiftForm.grace_minutes}
                onChange={e => setEditShiftForm(f => ({ ...f, grace_minutes: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={editShiftForm.description}
                onChange={e => setEditShiftForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Any notes about this shift…"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => { setShiftDialogOpen(false); setEditingShift(null); }}>Cancel</Button>
            <Button onClick={handleSaveShift} disabled={savingShift}>
              {savingShift ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          ADD SHIFT DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={addShiftOpen} onOpenChange={v => { if (!v) setAddShiftOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Shift</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Shift Name *</Label>
              <Input
                value={addShiftForm.name}
                onChange={e => setAddShiftForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Morning Shift"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Start Time</Label>
                <Input
                  type="time"
                  value={addShiftForm.start_time}
                  onChange={e => setAddShiftForm(f => ({ ...f, start_time: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Time</Label>
                <Input
                  type="time"
                  value={addShiftForm.end_time}
                  onChange={e => setAddShiftForm(f => ({ ...f, end_time: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Grace Minutes</Label>
              <Input
                type="number"
                min="0"
                max="60"
                value={addShiftForm.grace_minutes}
                onChange={e => setAddShiftForm(f => ({ ...f, grace_minutes: Number(e.target.value) }))}
              />
            </div>
            <div>
              <Label>Description <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                value={addShiftForm.description}
                onChange={e => setAddShiftForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Any notes about this shift…"
                rows={3}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setAddShiftOpen(false)}>Cancel</Button>
            <Button onClick={handleAddShift} disabled={savingShift}>
              {savingShift ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Shift
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          DELETE SHIFT CONFIRMATION
      ═══════════════════════════════════════════════ */}
      <AlertDialog open={!!deletingShift} onOpenChange={v => { if (!v) setDeletingShift(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Shift?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this shift? Employees assigned to it may be affected.
              {deletingShift && <strong className="block mt-1">"{deletingShift.name}"</strong>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingShift(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteShift}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════════════════════════════════════
          EDIT OFFICE LOCATION DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={locationDialogOpen} onOpenChange={v => { if (!v) { setLocationDialogOpen(false); setEditingLocation(null); } }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Location — {editingLocation?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={editLocationForm.name}
                onChange={e => setEditLocationForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Head Office"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={editLocationForm.address}
                onChange={e => setEditLocationForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Full address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={editLocationForm.latitude}
                  onChange={e => setEditLocationForm(f => ({ ...f, latitude: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={editLocationForm.longitude}
                  onChange={e => setEditLocationForm(f => ({ ...f, longitude: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                min="10"
                value={editLocationForm.radius_meters}
                onChange={e => setEditLocationForm(f => ({ ...f, radius_meters: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => { setLocationDialogOpen(false); setEditingLocation(null); }}>Cancel</Button>
            <Button onClick={handleSaveLocation} disabled={savingLocation}>
              {savingLocation ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          ADD OFFICE LOCATION DIALOG
      ═══════════════════════════════════════════════ */}
      <Dialog open={addLocationOpen} onOpenChange={v => { if (!v) setAddLocationOpen(false); }}>
        <DialogContent className="w-[95vw] max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Office Location</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Name *</Label>
              <Input
                value={addLocationForm.name}
                onChange={e => setAddLocationForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Head Office"
              />
            </div>
            <div>
              <Label>Address</Label>
              <Input
                value={addLocationForm.address}
                onChange={e => setAddLocationForm(f => ({ ...f, address: e.target.value }))}
                placeholder="Full address"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label>Latitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={addLocationForm.latitude}
                  onChange={e => setAddLocationForm(f => ({ ...f, latitude: Number(e.target.value) }))}
                />
              </div>
              <div>
                <Label>Longitude</Label>
                <Input
                  type="number"
                  step="0.000001"
                  value={addLocationForm.longitude}
                  onChange={e => setAddLocationForm(f => ({ ...f, longitude: Number(e.target.value) }))}
                />
              </div>
            </div>
            <div>
              <Label>Radius (meters)</Label>
              <Input
                type="number"
                min="10"
                value={addLocationForm.radius_meters}
                onChange={e => setAddLocationForm(f => ({ ...f, radius_meters: Number(e.target.value) }))}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t mt-4">
            <Button variant="outline" onClick={() => setAddLocationOpen(false)}>Cancel</Button>
            <Button onClick={handleAddLocation} disabled={savingLocation}>
              {savingLocation ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Location
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════
          DELETE OFFICE LOCATION CONFIRMATION
      ═══════════════════════════════════════════════ */}
      <AlertDialog open={!!deletingLocation} onOpenChange={v => { if (!v) setDeletingLocation(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Office Location?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this office location? This will affect attendance check-in validation.
              {deletingLocation && <strong className="block mt-1">"{deletingLocation.name}"</strong>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingLocation(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteLocation}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
