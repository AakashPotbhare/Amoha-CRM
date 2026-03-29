import { useEffect, useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { BarChart3, Briefcase, CalendarDays, ChevronDown, ChevronUp, Clock3, Download, Loader2, Users, WrenchIcon } from "lucide-react";
import { exportToExcel, exportToPDF, attendanceColumns, formatAttendanceForExport } from "@/lib/exportUtils";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface AttendanceRow {
  employee_id: string;
  date: string;
  attendance_status: string;
  is_late: boolean;
  is_wfh: boolean;
  total_hours: number | null;
  employees: {
    full_name: string | null;
    employee_code: string | null;
  } | null;
}

interface EmployeeStat {
  employee_id: string;
  full_name: string;
  employee_code: string;
  present: number;
  half_day: number;
  late: number;
  wfh: number;
  holiday: number;
  absent: number;
  total_hours: number;
}

type DayStatus =
  | "present"
  | "late"
  | "wfh"
  | "half_day"
  | "holiday"
  | "weekend"
  | "absent";

interface CalendarDayMeta {
  date: Date;
  status: DayStatus;
  label: string;
  note: string;
  totalHours?: number | null;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const STATUS_STYLES: Record<DayStatus, string> = {
  present: "border-emerald-200 bg-emerald-50 text-emerald-900",
  late: "border-rose-200 bg-rose-50 text-rose-900",
  wfh: "border-sky-200 bg-sky-50 text-sky-900",
  half_day: "border-amber-200 bg-amber-50 text-amber-900",
  holiday: "border-violet-200 bg-violet-50 text-violet-900",
  weekend: "border-slate-200 bg-slate-100 text-slate-700",
  absent: "border-red-200 bg-red-50 text-red-900",
};

const STATUS_SHORT: Record<DayStatus, string> = {
  present: "PR",
  late: "LT",
  wfh: "WFH",
  half_day: "HD",
  holiday: "HO",
  weekend: "WE",
  absent: "AB",
};

const STATUS_LABELS: Record<DayStatus, string> = {
  present: "Present",
  late: "Late",
  wfh: "WFH",
  half_day: "Half Day",
  holiday: "Holiday",
  weekend: "Weekend",
  absent: "Absent",
};

function getDayMeta(date: Date, row?: AttendanceRow): CalendarDayMeta {
  if (!row) {
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    return {
      date,
      status: weekend ? "weekend" : "absent",
      label: weekend ? "Weekend" : "Absent",
      note: weekend ? "Weekly off" : "No attendance record found",
      totalHours: null,
    };
  }

  const rawStatus = row.attendance_status?.toLowerCase();
  if (rawStatus === "holiday" || rawStatus === "company_holiday") {
    return { date, status: "holiday", label: "Holiday", note: "Company holiday", totalHours: row.total_hours };
  }
  if (rawStatus === "half_day") {
    return {
      date,
      status: "half_day",
      label: row.is_late ? "Half Day + Late" : "Half Day",
      note: row.is_wfh ? "Worked from home for part of the day" : "Worked less than required hours",
      totalHours: row.total_hours,
    };
  }
  if (row.is_late) {
    return {
      date,
      status: "late",
      label: row.is_wfh ? "Late + WFH" : "Late",
      note: row.is_wfh ? "Checked in late while marked WFH" : "Checked in after grace period",
      totalHours: row.total_hours,
    };
  }
  if (row.is_wfh) {
    return { date, status: "wfh", label: "WFH", note: "Worked from home", totalHours: row.total_hours };
  }
  return { date, status: "present", label: "Present", note: "Marked present", totalHours: row.total_hours };
}

interface EmployeeOption { id: string; full_name: string; employee_code: string; }
interface AttendanceRecord { id: string; date: string; check_in_time: string | null; check_out_time: string | null; attendance_status: string; is_wfh: boolean; }

export default function AttendanceReport() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin override state
  const [adminOpen, setAdminOpen] = useState(false);
  const [allEmployees, setAllEmployees] = useState<EmployeeOption[]>([]);
  const [overrideSaving, setOverrideSaving] = useState(false);
  // Create manual entry form
  const [manualForm, setManualForm] = useState({ employee_id: "", date: "", check_in_time: "", check_out_time: "", attendance_status: "present", is_wfh: false, notes: "" });
  // Edit existing form
  const [editEmpId, setEditEmpId] = useState("");
  const [editDate, setEditDate] = useState("");
  const [foundRecord, setFoundRecord] = useState<AttendanceRecord | null>(null);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [editForm, setEditForm] = useState({ check_in_time: "", check_out_time: "", attendance_status: "present", is_wfh: false, notes: "" });

  const isAdmin = employee && (employee.role === "director" || employee.role === "ops_head" || employee.role === "team_lead");
  const isHRAdmin = employee && (employee.role === "director" || employee.role === "hr_head");

  useEffect(() => {
    void fetchReport();
  }, [month, year, employee]);

  useEffect(() => {
    if (isHRAdmin && adminOpen && allEmployees.length === 0) {
      api.get<{ data: EmployeeOption[] }>('/api/employees?is_active=1&limit=200')
        .then(r => setAllEmployees((r.data as unknown as { data: EmployeeOption[] })?.data ?? (r.data as unknown as EmployeeOption[]) ?? []))
        .catch(() => {});
    }
  }, [isHRAdmin, adminOpen]);

  const handleManualSubmit = async () => {
    if (!manualForm.employee_id || !manualForm.date) {
      toast({ title: "Missing fields", description: "Employee and date are required.", variant: "destructive" }); return;
    }
    setOverrideSaving(true);
    try {
      await api.post('/api/attendance/manual', manualForm);
      toast({ title: "Record created", description: `Attendance for ${manualForm.date} has been created.` });
      setManualForm({ employee_id: "", date: "", check_in_time: "", check_out_time: "", attendance_status: "present", is_wfh: false, notes: "" });
      void fetchReport();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to create record.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setOverrideSaving(false); }
  };

  const handleLoadRecord = async () => {
    if (!editEmpId || !editDate) { toast({ title: "Select employee and date", variant: "destructive" }); return; }
    setLoadingRecord(true); setFoundRecord(null);
    try {
      const d = new Date(editDate);
      const res = await api.get<AttendanceRow[]>(`/api/attendance/report?date_from=${editDate}&date_to=${editDate}`);
      const rows = (res.data as unknown as AttendanceRow[]) ?? [];
      const match = rows.find(r => r.employee_id === editEmpId);
      if (!match) { toast({ title: "No record found", description: "Use Create Manual Entry instead.", variant: "destructive" }); setLoadingRecord(false); return; }
      const rec = match as unknown as AttendanceRecord;
      setFoundRecord(rec);
      setEditForm({
        check_in_time: rec.check_in_time ? rec.check_in_time.slice(11, 16) : "",
        check_out_time: rec.check_out_time ? rec.check_out_time.slice(11, 16) : "",
        attendance_status: rec.attendance_status ?? "present",
        is_wfh: !!rec.is_wfh,
        notes: "",
      });
    } catch { toast({ title: "Error loading record", variant: "destructive" }); }
    setLoadingRecord(false);
  };

  const handleEditSubmit = async () => {
    if (!foundRecord) return;
    setOverrideSaving(true);
    try {
      await api.patch(`/api/attendance/${foundRecord.id}`, editForm);
      toast({ title: "Record updated", description: `Attendance for ${editDate} has been updated.` });
      setFoundRecord(null); setEditEmpId(""); setEditDate("");
      void fetchReport();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Failed to update record.";
      toast({ title: "Error", description: msg, variant: "destructive" });
    } finally { setOverrideSaving(false); }
  };

  const fetchReport = async () => {
    if (!employee) return;
    setLoading(true);

    try {
      const params = new URLSearchParams({
        date_from: `${year}-${String(month).padStart(2, "0")}-01`,
        date_to: `${month === 12 ? year + 1 : year}-${String(month === 12 ? 1 : month + 1).padStart(2, "0")}-01`,
      });
      if (!isAdmin) params.set("department_id", employee.department_id);

      const res = await api.get<AttendanceRow[]>(`/api/attendance/report?${params.toString()}`);
      const nextRecords = res.data ?? [];
      setRecords(nextRecords);

      const employeeIds = Array.from(new Set(nextRecords.map((row) => row.employee_id)));
      const fallbackEmployeeId = !isAdmin ? employee.id : employeeIds[0] ?? "";
      setSelectedEmployeeId((current) => {
        if (current && employeeIds.includes(current)) return current;
        return fallbackEmployeeId;
      });
    } catch {
      // ignore
    }
    setSelectedDate(null);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const grouped: Record<string, EmployeeStat> = {};
    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(monthStart);
    const now = new Date();
    const evaluationEnd =
      monthStart > now
        ? addDays(monthStart, -1)
        : isSameMonth(monthStart, now)
          ? now
          : monthEnd;
    const totalWorkdays = evaluationEnd < monthStart ? 0 : eachDayOfInterval({ start: monthStart, end: evaluationEnd }).filter((date) => {
      const day = date.getDay();
      return day !== 0 && day !== 6;
    }).length;

    for (const row of records) {
      const eid = row.employee_id;
      if (!grouped[eid]) {
        grouped[eid] = {
          employee_id: eid,
          full_name: row.employees?.full_name || "Unknown",
          employee_code: row.employees?.employee_code || "",
          present: 0,
          half_day: 0,
          late: 0,
          wfh: 0,
          holiday: 0,
          absent: 0,
          total_hours: 0,
        };
      }

      const normalizedStatus = row.attendance_status?.toLowerCase();
      if (normalizedStatus === "holiday" || normalizedStatus === "company_holiday") grouped[eid].holiday++;
      if (normalizedStatus === "present") grouped[eid].present++;
      if (normalizedStatus === "half_day") grouped[eid].half_day++;
      if (row.is_late) grouped[eid].late++;
      if (row.is_wfh) grouped[eid].wfh++;
      grouped[eid].total_hours += Number(row.total_hours || 0);
    }

    for (const stat of Object.values(grouped)) {
      const employeeRows = records.filter((row) => row.employee_id === stat.employee_id);
      const attendedDays = employeeRows.filter((row) => {
        const status = row.attendance_status?.toLowerCase();
        return status !== "holiday" && status !== "company_holiday";
      }).length;
      stat.absent = Math.max(totalWorkdays - stat.holiday - attendedDays, 0);
    }

    return Object.values(grouped).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [month, records, year]);

  const employeeOptions = useMemo(() => {
    return stats.map((stat) => ({
      employee_id: stat.employee_id,
      full_name: stat.full_name,
      employee_code: stat.employee_code,
    }));
  }, [stats]);

  useEffect(() => {
    if (!selectedEmployeeId && employeeOptions.length > 0) {
      setSelectedEmployeeId(employeeOptions[0].employee_id);
    }
  }, [employeeOptions, selectedEmployeeId]);

  const selectedEmployee = employeeOptions.find((option) => option.employee_id === selectedEmployeeId) ?? null;

  const selectedEmployeeRecords = useMemo(() => {
    const map = new Map<string, AttendanceRow>();
    for (const row of records) {
      if (row.employee_id === selectedEmployeeId) map.set(row.date, row);
    }
    return map;
  }, [records, selectedEmployeeId]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(new Date(year, month - 1, 1));
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) =>
      getDayMeta(date, selectedEmployeeRecords.get(format(date, "yyyy-MM-dd"))),
    );
  }, [month, selectedEmployeeRecords, year]);

  const focusedDay = useMemo(() => {
    if (selectedDate) {
      return calendarDays.find((day) => isSameDay(day.date, selectedDate)) ?? null;
    }
    return calendarDays.find((day) => isToday(day.date) && isSameMonth(day.date, new Date(year, month - 1, 1))) ?? null;
  }, [calendarDays, month, selectedDate, year]);

  const months = MONTHS;
  const weekHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground">Attendance Report</h1>
          <p className="text-sm text-muted-foreground">Monthly summary with an employee-wise attendance calendar</p>
        </div>
        {records.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportToExcel(formatAttendanceForExport(records as unknown as Record<string, unknown>[]), attendanceColumns, `Attendance_${year}_${String(month).padStart(2,"0")}`)}
            >
              <Download className="w-4 h-4" /> Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportToPDF(formatAttendanceForExport(records as unknown as Record<string, unknown>[]), attendanceColumns, `Attendance Report – ${year}/${String(month).padStart(2,"0")}`, `Attendance_${year}_${String(month).padStart(2,"0")}`)}
            >
              <Download className="w-4 h-4" /> PDF
            </Button>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger className="w-full sm:w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2025, 2026, 2027].map((value) => (
              <SelectItem key={value} value={String(value)}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedEmployeeId || undefined} onValueChange={setSelectedEmployeeId} disabled={employeeOptions.length === 0}>
          <SelectTrigger className="w-full sm:min-w-[240px] sm:w-auto">
            <SelectValue placeholder="Select employee" />
          </SelectTrigger>
          <SelectContent>
            {employeeOptions.map((option) => (
              <SelectItem key={option.employee_id} value={option.employee_id}>
                {option.full_name}{option.employee_code ? ` (${option.employee_code})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {stats.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> Employees
              </div>
              <p className="text-2xl font-bold">{stats.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" /> Present Days
              </div>
              <p className="text-2xl font-bold">{stats.reduce((sum, stat) => sum + stat.present, 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1 text-sm text-muted-foreground">Half Days</div>
              <p className="text-2xl font-bold text-amber-600">{stats.reduce((sum, stat) => sum + stat.half_day, 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1 text-sm text-muted-foreground">Late Arrivals</div>
              <p className="text-2xl font-bold text-rose-600">{stats.reduce((sum, stat) => sum + stat.late, 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4" /> Total Hours
              </div>
              <p className="text-2xl font-bold">{stats.reduce((sum, stat) => sum + Number(stat.total_hours), 0).toFixed(1)}h</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <BarChart3 className="h-4 w-4 text-primary" />
            {months[month - 1]} {year} — Per Employee
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-center">Present</TableHead>
                <TableHead className="text-center">Half Day</TableHead>
                <TableHead className="text-center">Late</TableHead>
                <TableHead className="text-center">Holiday</TableHead>
                <TableHead className="text-center">Absent</TableHead>
                <TableHead className="text-center">WFH</TableHead>
                <TableHead className="text-center">Total Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">Loading...</TableCell>
                </TableRow>
              ) : stats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">No records for this period</TableCell>
                </TableRow>
              ) : (
                stats.map((stat) => (
                  <TableRow
                    key={stat.employee_id}
                    className={cn("cursor-pointer", stat.employee_id === selectedEmployeeId && "bg-muted/50")}
                    onClick={() => setSelectedEmployeeId(stat.employee_id)}
                  >
                    <TableCell>
                      <p className="text-sm font-medium">{stat.full_name}</p>
                      <p className="text-[10px] text-muted-foreground">{stat.employee_code}</p>
                    </TableCell>
                    <TableCell className="text-center"><Badge className="bg-emerald-100 text-emerald-800">{stat.present}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-amber-100 text-amber-800">{stat.half_day}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-rose-100 text-rose-800">{stat.late}</Badge></TableCell>
                    <TableCell className="text-center"><Badge className="bg-violet-100 text-violet-800">{stat.holiday}</Badge></TableCell>
                    <TableCell className="text-center"><Badge variant="destructive">{stat.absent}</Badge></TableCell>
                    <TableCell className="text-center">{stat.wfh}</TableCell>
                    <TableCell className="text-center font-medium">{Number(stat.total_hours).toFixed(1)}h</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base">
                  {selectedEmployee ? `${selectedEmployee.full_name} Attendance Calendar` : "Attendance Calendar"}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Day-by-day status for {months[month - 1]} {year}
                </p>
              </div>
              {selectedEmployee?.employee_code && (
                <Badge variant="outline" className="text-xs">{selectedEmployee.employee_code}</Badge>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {(["present", "late", "half_day", "wfh", "holiday", "weekend", "absent"] as DayStatus[]).map((status) => (
                <div key={status} className={cn("flex items-center gap-2 rounded-full border px-3 py-1 text-xs", STATUS_STYLES[status])}>
                  <span className="font-semibold">{STATUS_SHORT[status]}</span>
                  <span>{STATUS_LABELS[status]}</span>
                </div>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="grid grid-cols-7 gap-1 md:gap-2 min-w-[320px]">
                {weekHeaders.map((day) => (
                  <div key={day} className="px-1 md:px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {day}
                  </div>
                ))}
                {calendarDays.map((day) => {
                  const inMonth = isSameMonth(day.date, new Date(year, month - 1, 1));
                  const selected = selectedDate ? isSameDay(day.date, selectedDate) : false;
                  return (
                    <button
                      key={day.date.toISOString()}
                      type="button"
                      onClick={() => setSelectedDate(day.date)}
                      className={cn(
                        "min-h-[56px] md:min-h-[92px] rounded-xl md:rounded-2xl border p-1 md:p-2 text-left transition-colors",
                        STATUS_STYLES[day.status],
                        !inMonth && "opacity-35",
                        selected && "ring-2 ring-primary ring-offset-2",
                        isToday(day.date) && inMonth && "shadow-[inset_0_0_0_1px_hsl(var(--primary))]",
                      )}
                    >
                      <div className="mb-1 md:mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold">{format(day.date, "d")}</span>
                        {isToday(day.date) && inMonth && <Badge variant="secondary" className="hidden sm:inline-flex px-1.5 py-0 text-[10px]">Today</Badge>}
                      </div>
                      <div className="space-y-0.5 md:space-y-1">
                        <p className="text-xs font-medium">{STATUS_SHORT[day.status]}</p>
                        <p className="hidden md:block line-clamp-2 text-[11px] leading-4">{day.label}</p>
                        {day.totalHours != null && <p className="hidden sm:block text-[10px] opacity-80">{day.totalHours.toFixed(1)}h</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4 text-primary" />
              Day Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {focusedDay ? (
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Selected date</p>
                  <p className="text-lg font-semibold">{format(focusedDay.date, "EEEE, dd MMM yyyy")}</p>
                </div>
                <Badge className={cn("border", STATUS_STYLES[focusedDay.status])}>{focusedDay.label}</Badge>
                <p className="text-sm text-muted-foreground">{focusedDay.note}</p>
                <div className="rounded-xl border bg-muted/30 p-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Status code</span>
                    <span className="font-semibold">{STATUS_SHORT[focusedDay.status]}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-muted-foreground">Worked hours</span>
                    <span className="font-semibold">{focusedDay.totalHours != null ? `${focusedDay.totalHours.toFixed(1)}h` : "—"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Choose a date in the calendar to inspect the attendance status.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Admin Override Panel (director / hr_head only) ── */}
      {isHRAdmin && (
        <Card className="border-amber-200 bg-amber-50/30">
          <CardHeader
            className="cursor-pointer select-none py-4"
            onClick={() => setAdminOpen(o => !o)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <WrenchIcon className="h-4 w-4 text-amber-600" />
                <CardTitle className="text-sm font-semibold text-amber-800">Admin: Correct Attendance Record</CardTitle>
                <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">HR Only</Badge>
              </div>
              {adminOpen ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
            </div>
          </CardHeader>

          {adminOpen && (
            <CardContent className="pt-0">
              <Tabs defaultValue="create">
                <TabsList className="mb-4">
                  <TabsTrigger value="create">Create Manual Entry</TabsTrigger>
                  <TabsTrigger value="edit">Edit Existing Record</TabsTrigger>
                </TabsList>

                {/* ── Tab A: Create Manual Entry ── */}
                <TabsContent value="create">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Employee *</Label>
                      <Select value={manualForm.employee_id} onValueChange={v => setManualForm(f => ({ ...f, employee_id: v }))}>
                        <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                        <SelectContent>
                          {allEmployees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date *</Label>
                      <Input type="date" max={new Date().toISOString().slice(0,10)} value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Check-in Time</Label>
                      <Input type="time" value={manualForm.check_in_time} onChange={e => setManualForm(f => ({ ...f, check_in_time: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Check-out Time</Label>
                      <Input type="time" value={manualForm.check_out_time} onChange={e => setManualForm(f => ({ ...f, check_out_time: e.target.value }))} />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <Select value={manualForm.attendance_status} onValueChange={v => setManualForm(f => ({ ...f, attendance_status: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="half_day">Half Day</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="wfh">WFH</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2 pt-6">
                      <input type="checkbox" id="manual-wfh" checked={manualForm.is_wfh} onChange={e => setManualForm(f => ({ ...f, is_wfh: e.target.checked }))} className="h-4 w-4 rounded border" />
                      <Label htmlFor="manual-wfh">Work From Home</Label>
                    </div>
                    <div className="space-y-1.5 col-span-full">
                      <Label>Notes (visible to employee)</Label>
                      <Textarea rows={2} placeholder="Reason for manual entry…" value={manualForm.notes} onChange={e => setManualForm(f => ({ ...f, notes: e.target.value }))} />
                    </div>
                    <div className="col-span-full flex justify-end">
                      <Button onClick={handleManualSubmit} disabled={overrideSaving} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
                        {overrideSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Record
                      </Button>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Tab B: Edit Existing Record ── */}
                <TabsContent value="edit">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Employee *</Label>
                      <Select value={editEmpId} onValueChange={v => { setEditEmpId(v); setFoundRecord(null); }}>
                        <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                        <SelectContent>
                          {allEmployees.map(e => (
                            <SelectItem key={e.id} value={e.id}>{e.full_name} ({e.employee_code})</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label>Date *</Label>
                      <Input type="date" max={new Date().toISOString().slice(0,10)} value={editDate} onChange={e => { setEditDate(e.target.value); setFoundRecord(null); }} />
                    </div>
                    <div className="col-span-full">
                      <Button variant="outline" onClick={handleLoadRecord} disabled={loadingRecord} className="w-full sm:w-auto">
                        {loadingRecord && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Load Record
                      </Button>
                    </div>

                    {foundRecord && (
                      <>
                        <div className="col-span-full">
                          <p className="text-xs text-emerald-700 font-medium bg-emerald-50 border border-emerald-200 rounded px-3 py-1.5">
                            ✓ Record found for {editDate}
                          </p>
                        </div>
                        <div className="space-y-1.5">
                          <Label>Check-in Time</Label>
                          <Input type="time" value={editForm.check_in_time} onChange={e => setEditForm(f => ({ ...f, check_in_time: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Check-out Time</Label>
                          <Input type="time" value={editForm.check_out_time} onChange={e => setEditForm(f => ({ ...f, check_out_time: e.target.value }))} />
                        </div>
                        <div className="space-y-1.5">
                          <Label>Status</Label>
                          <Select value={editForm.attendance_status} onValueChange={v => setEditForm(f => ({ ...f, attendance_status: v }))}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="absent">Absent</SelectItem>
                              <SelectItem value="half_day">Half Day</SelectItem>
                              <SelectItem value="late">Late</SelectItem>
                              <SelectItem value="wfh">WFH</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2 pt-6">
                          <input type="checkbox" id="edit-wfh" checked={editForm.is_wfh} onChange={e => setEditForm(f => ({ ...f, is_wfh: e.target.checked }))} className="h-4 w-4 rounded border" />
                          <Label htmlFor="edit-wfh">Work From Home</Label>
                        </div>
                        <div className="space-y-1.5 col-span-full">
                          <Label>Notes (visible to employee)</Label>
                          <Textarea rows={2} placeholder="Reason for correction…" value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} />
                        </div>
                        <div className="col-span-full flex justify-end">
                          <Button onClick={handleEditSubmit} disabled={overrideSaving} className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700">
                            {overrideSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Save Changes
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
