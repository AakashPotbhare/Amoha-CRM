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
import { BarChart3, Briefcase, CalendarDays, Clock3, Users } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

export default function AttendanceReport() {
  const { employee } = useAuth();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);

  const isAdmin = employee && (employee.role === "director" || employee.role === "ops_head" || employee.role === "team_lead");

  useEffect(() => {
    void fetchReport();
  }, [month, year, employee]);

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
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Attendance Report</h1>
        <p className="text-sm text-muted-foreground">Monthly summary with an employee-wise attendance calendar</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={String(month)} onValueChange={(value) => setMonth(Number(value))}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((name, index) => (
              <SelectItem key={name} value={String(index + 1)}>{name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={String(year)} onValueChange={(value) => setYear(Number(value))}>
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[2025, 2026, 2027].map((value) => (
              <SelectItem key={value} value={String(value)}>{value}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={selectedEmployeeId || undefined} onValueChange={setSelectedEmployeeId} disabled={employeeOptions.length === 0}>
          <SelectTrigger className="min-w-[240px]">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
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
          <Table>
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
            <div className="grid grid-cols-7 gap-2">
              {weekHeaders.map((day) => (
                <div key={day} className="px-2 py-1 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
                      "min-h-[92px] rounded-2xl border p-2 text-left transition-colors",
                      STATUS_STYLES[day.status],
                      !inMonth && "opacity-35",
                      selected && "ring-2 ring-primary ring-offset-2",
                      isToday(day.date) && inMonth && "shadow-[inset_0_0_0_1px_hsl(var(--primary))]",
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold">{format(day.date, "d")}</span>
                      {isToday(day.date) && inMonth && <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Today</Badge>}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-medium">{STATUS_SHORT[day.status]}</p>
                      <p className="line-clamp-2 text-[11px] leading-4">{day.label}</p>
                      {day.totalHours != null && <p className="text-[10px] opacity-80">{day.totalHours.toFixed(1)}h</p>}
                    </div>
                  </button>
                );
              })}
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
    </div>
  );
}
