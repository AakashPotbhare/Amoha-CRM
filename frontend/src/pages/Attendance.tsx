import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api.client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MapPin, LogIn, LogOut, Home, AlertTriangle, CheckCircle, Coffee, Timer, CalendarDays } from "lucide-react";
import { differenceInMinutes, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, parseISO, startOfMonth, startOfWeek } from "date-fns";

interface OfficeLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  is_active: boolean;
}

interface ShiftSetting {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_period_minutes: number;
  required_hours: number;
  max_late_per_month: number;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  employee_id: string;
  check_in_time: string;
  check_out_time: string | null;
  is_wfh: boolean;
  is_late: boolean;
  attendance_status: string;
  total_hours: string | number | null;  // MySQL DECIMAL comes back as string
  date: string;
}

type CalendarStatus = "present" | "late" | "wfh" | "half_day" | "holiday" | "weekend" | "absent";

interface CalendarDayMeta {
  date: Date;
  status: CalendarStatus;
  label: string;
  note: string;
  totalHours: number | null;
}

interface AttendanceBreak {
  id: string;
  attendance_record_id: string;
  break_type: string;
  start_time: string;
  end_time: string | null;
}

// Break policy: break 1 = short, break 2 = lunch, break 3 = short
const BREAK_POLICY: { type: string; label: string; expectedMins: number }[] = [
  { type: "short_break", label: "Short Break 1", expectedMins: 15 },
  { type: "lunch",       label: "Lunch Break",   expectedMins: 45 },
  { type: "short_break", label: "Short Break 2", expectedMins: 15 },
];

const CALENDAR_STATUS_STYLES: Record<CalendarStatus, string> = {
  present: "border-emerald-200 bg-emerald-50 text-emerald-900",
  late: "border-rose-200 bg-rose-50 text-rose-900",
  wfh: "border-sky-200 bg-sky-50 text-sky-900",
  half_day: "border-amber-200 bg-amber-50 text-amber-900",
  holiday: "border-violet-200 bg-violet-50 text-violet-900",
  weekend: "border-slate-200 bg-slate-100 text-slate-700",
  absent: "border-red-200 bg-red-50 text-red-900",
};

const CALENDAR_STATUS_SHORT: Record<CalendarStatus, string> = {
  present: "PR",
  late: "LT",
  wfh: "WFH",
  half_day: "HD",
  holiday: "HO",
  weekend: "WE",
  absent: "AB",
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function getCalendarDayMeta(date: Date, row?: AttendanceRecord): CalendarDayMeta {
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

  const normalizedStatus = row.attendance_status?.toLowerCase();
  if (normalizedStatus === "holiday" || normalizedStatus === "company_holiday") {
    return { date, status: "holiday", label: "Holiday", note: "Company holiday", totalHours: row.total_hours };
  }
  if (normalizedStatus === "half_day") {
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

function getDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function Attendance() {
  const { employee } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<OfficeLocation[]>([]);
  const [shift, setShift] = useState<ShiftSetting | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [todayBreaks, setTodayBreaks] = useState<AttendanceBreak[]>([]);
  const [history, setHistory] = useState<AttendanceRecord[]>([]);
  const [calendarRecords, setCalendarRecords] = useState<AttendanceRecord[]>([]);
  const [currentPos, setCurrentPos] = useState<{ lat: number; lng: number } | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lateCountThisMonth, setLateCountThisMonth] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth() + 1);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    if (!employee) return;

    try {
      const [todayRes, locRes, shiftsRes] = await Promise.all([
        api.get<any>("/api/attendance/today"),
        api.get<OfficeLocation[]>("/api/hr/office-locations"),
        api.get<ShiftSetting[]>("/api/hr/shifts"),
      ]);

      if (locRes.success && locRes.data) {
        setLocations(locRes.data.filter((loc: OfficeLocation) => loc.is_active));
      }
      if (shiftsRes.success && shiftsRes.data) {
        const active = shiftsRes.data.find((s: any) => s.is_active);
        setShift(active || null);
      }

      if (todayRes.success && todayRes.data) {
        setTodayRecord(todayRes.data.record ?? null);
        setTodayBreaks(todayRes.data.breaks ?? []);
      }

      // Fetch monthly history
      const now = new Date();
      const histRes = await api.get<AttendanceRecord[]>(
        `/api/attendance/monthly?employee_id=${employee.id}&month=${now.getMonth() + 1}&year=${now.getFullYear()}`
      );
      if (histRes.success && histRes.data) {
        setHistory(histRes.data);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        const lateCount = histRes.data.filter((r: AttendanceRecord) => r.is_late && r.date >= monthStart).length;
        setLateCountThisMonth(lateCount);
      }
    } catch (err: any) {
      console.error("fetchData error:", err);
    }
  }, [employee]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const fetchCalendarRecords = useCallback(async () => {
    if (!employee) return;
    try {
      const res = await api.get<AttendanceRecord[]>(
        `/api/attendance/monthly?employee_id=${employee.id}&month=${calendarMonth}&year=${calendarYear}`
      );
      setCalendarRecords(res.data ?? []);
      setSelectedCalendarDate(null);
    } catch {
      // ignore
    }
  }, [calendarMonth, calendarYear, employee]);

  useEffect(() => {
    void fetchCalendarRecords();
  }, [fetchCalendarRecords]);

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoError(null);
      },
      (err) => { setGeoError(`Location access denied: ${err.message}`); },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  useEffect(() => { requestLocation(); }, []);

  const getNearestOffice = (): { office: OfficeLocation; distance: number } | null => {
    if (!currentPos || locations.length === 0) return null;
    let nearest: { office: OfficeLocation; distance: number } | null = null;
    for (const loc of locations) {
      const dist = getDistanceMeters(currentPos.lat, currentPos.lng, loc.latitude, loc.longitude);
      if (!nearest || dist < nearest.distance) nearest = { office: loc, distance: dist };
    }
    return nearest;
  };

  const isWithinGeofence = (): { valid: boolean; office?: OfficeLocation; distance?: number } => {
    const nearest = getNearestOffice();
    if (!nearest) return { valid: false };
    return { valid: nearest.distance <= nearest.office.radius_meters, office: nearest.office, distance: nearest.distance };
  };

  const checkIsLate = (): boolean => {
    if (!shift) return false;
    const now = new Date();
    const [h, m] = shift.start_time.split(":").map(Number);
    const shiftStart = new Date(now);
    shiftStart.setHours(h, m, 0, 0);
    return now > new Date(shiftStart.getTime() + shift.grace_period_minutes * 60000);
  };

  const getAttendanceStatus = (isLate: boolean): string => {
    if (!isLate) return "present";
    if (lateCountThisMonth >= (shift?.max_late_per_month ?? 3)) return "half_day";
    return "present";
  };

  // Derived break state
  const activeBreak = todayBreaks.find((b) => b.end_time === null) ?? null;
  const completedBreaks = todayBreaks.filter((b) => b.end_time !== null);
  const nextBreakIndex = todayBreaks.length;
  const canStartBreak = !activeBreak && nextBreakIndex < BREAK_POLICY.length && !!todayRecord && !todayRecord.check_out_time;

  const totalBreakMins = completedBreaks.reduce((sum, b) => {
    if (!b.start_time || !b.end_time) return sum;
    return sum + differenceInMinutes(new Date(b.end_time), new Date(b.start_time));
  }, 0);

  const handleCheckIn = async (isWfh: boolean) => {
    if (!employee || !shift) return;
    setLoading(true);

    let locationId: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;

    if (!isWfh) {
      const geo = isWithinGeofence();
      if (!geo.valid) {
        toast({
          title: "Outside office geo-fence",
          description: `You are ${Math.round(geo.distance || 0)}m away from the nearest office. You must be within ${locations[0]?.radius_meters || 100}m to check in.`,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      locationId = geo.office!.id;
      lat = currentPos!.lat;
      lng = currentPos!.lng;
    }

    const isLate = checkIsLate();
    const status = getAttendanceStatus(isLate);

    try {
      await api.post("/api/attendance/check-in", {
        employee_id: employee.id,
        check_in_location_id: locationId,
        check_in_lat: lat,
        check_in_lng: lng,
        is_wfh: isWfh,
        is_late: isLate,
        attendance_status: status,
        shift_setting_id: shift.id,
      });
      toast({ title: isLate ? "Checked in (Late)" : "Checked in successfully", description: isWfh ? "WFH check-in recorded" : "Checked in at office" });
      fetchData();
    } catch (err: any) {
      toast({ title: "Check-in failed", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleBreakOut = async () => {
    if (!employee || !todayRecord || activeBreak || nextBreakIndex >= BREAK_POLICY.length) return;
    setLoading(true);

    const policy = BREAK_POLICY[nextBreakIndex];
    try {
      await api.post("/api/attendance/break/start", {
        break_type: policy.type,
      });
      toast({ title: `${policy.label} started`, description: `Expected duration: ${policy.expectedMins} mins` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Break start failed", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleBreakIn = async () => {
    if (!employee || !activeBreak) return;
    setLoading(true);

    const durationMins = differenceInMinutes(new Date(), new Date(activeBreak.start_time));

    try {
      await api.post("/api/attendance/break/end", {});
      toast({ title: "Break ended", description: `Duration: ${durationMins} mins` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Break end failed", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleReCheckIn = async () => {
    if (!employee || !todayRecord) return;
    setLoading(true);
    try {
      await api.post("/api/attendance/undo-checkout", {});
      toast({ title: "Re-checked in", description: "Checkout has been undone. Continue your day." });
      fetchData();
    } catch (err: any) {
      toast({ title: "Re-check-in failed", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const handleCheckOut = async () => {
    if (!employee || !todayRecord) return;
    setLoading(true);

    const now = new Date();
    const checkInTime = new Date(todayRecord.check_in_time);
    const rawHours = differenceInMinutes(now, checkInTime) / 60;
    const netHours = Math.max(0, rawHours - totalBreakMins / 60);

    const requiredHours = shift?.required_hours ?? 7;
    const status = netHours < requiredHours / 2
      ? "half_day"
      : todayRecord.attendance_status;

    try {
      await api.post("/api/attendance/check-out", {
        latitude: currentPos?.lat ?? null,
        longitude: currentPos?.lng ?? null,
        total_hours: parseFloat(netHours.toFixed(2)),
        attendance_status: status,
        is_late: todayRecord.is_late,
        is_wfh: todayRecord.is_wfh,
      });
      toast({ title: "Checked out", description: `Total: ${netHours.toFixed(1)}h (breaks: ${totalBreakMins}m)` });
      fetchData();
    } catch (err: any) {
      toast({ title: "Check-out failed", description: err.message, variant: "destructive" });
    }
    setLoading(false);
  };

  // Calendar grid
  const calendarDays = (() => {
    const monthStart = startOfMonth(new Date(calendarYear, calendarMonth - 1, 1));
    const monthEnd = endOfMonth(monthStart);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const recordMap = new Map<string, AttendanceRecord>();
    for (const r of calendarRecords) recordMap.set(r.date, r);
    return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) =>
      getCalendarDayMeta(date, recordMap.get(format(date, "yyyy-MM-dd")))
    );
  })();

  const focusedDay = selectedCalendarDate
    ? calendarDays.find((d) => isSameDay(d.date, selectedCalendarDate)) ?? null
    : calendarDays.find((d) => isToday(d.date) && isSameMonth(d.date, new Date(calendarYear, calendarMonth - 1, 1))) ?? null;

  const weekHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="p-3 md:p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-xl md:text-2xl font-bold text-foreground">Attendance</h1>

      {/* Geo status */}
      {geoError && (
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {geoError}
          <Button size="sm" variant="outline" onClick={requestLocation} className="ml-auto">
            Retry Location
          </Button>
        </div>
      )}
      {!geoError && currentPos && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 flex items-center gap-2 text-sm text-emerald-800">
          <MapPin className="w-4 h-4 shrink-0" />
          Location detected — {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
        </div>
      )}

      {/* Today's Check-in/out Panel */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" /> Today — {format(new Date(), "EEEE, dd MMM yyyy")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!todayRecord ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button onClick={() => handleCheckIn(false)} disabled={loading || !currentPos || !shift} className="gap-2 w-full sm:w-auto">
                <LogIn className="w-4 h-4" /> Check In (Office)
              </Button>
              <Button onClick={() => handleCheckIn(true)} disabled={loading || !shift} variant="outline" className="gap-2 w-full sm:w-auto">
                <Home className="w-4 h-4" /> Check In (WFH)
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <div>
                  <span className="text-xs text-muted-foreground block">Check In</span>
                  <span className="font-medium">{new Date(todayRecord.check_in_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Check Out</span>
                  <span className="font-medium">
                    {todayRecord.check_out_time
                      ? new Date(todayRecord.check_out_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                      : "—"}
                  </span>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Status</span>
                  <Badge className={todayRecord.attendance_status === "present" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                    {todayRecord.attendance_status.replace("_", " ")}
                    {todayRecord.is_late && " (Late)"}
                    {todayRecord.is_wfh && " · WFH"}
                  </Badge>
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">Breaks Taken</span>
                  <span className="font-medium">{completedBreaks.length} / {BREAK_POLICY.length} ({totalBreakMins}m)</span>
                </div>
              </div>

              {/* Break buttons */}
              {!todayRecord.check_out_time && (
                <div className="flex flex-wrap gap-2">
                  {activeBreak ? (
                    <Button size="sm" onClick={handleBreakIn} disabled={loading} variant="outline" className="gap-2">
                      <Timer className="w-4 h-4" /> End Break
                    </Button>
                  ) : canStartBreak ? (
                    <Button size="sm" onClick={handleBreakOut} disabled={loading} variant="outline" className="gap-2">
                      <Coffee className="w-4 h-4" /> {BREAK_POLICY[nextBreakIndex].label}
                    </Button>
                  ) : null}

                  <Button onClick={handleCheckOut} disabled={loading || !!activeBreak} className="gap-2">
                    <LogOut className="w-4 h-4" /> Check Out
                  </Button>
                </div>
              )}

              {todayRecord.check_out_time && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 text-sm text-emerald-700">
                    <CheckCircle className="w-4 h-4" />
                    Checked out · {todayRecord.total_hours != null ? Number(todayRecord.total_hours).toFixed(1) : '0.0'}h worked
                  </div>
                  <Button size="sm" variant="ghost" onClick={handleReCheckIn} disabled={loading} className="text-xs">
                    Undo checkout
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Attendance Calendar</CardTitle>
            <div className="flex gap-2">
              <Select value={String(calendarMonth)} onValueChange={(v) => setCalendarMonth(Number(v))}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={String(calendarYear)} onValueChange={(v) => setCalendarYear(Number(v))}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <div className="grid grid-cols-7 gap-1 min-w-[320px]">
              {weekHeaders.map((d) => (
                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
              ))}
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day.date, new Date(calendarYear, calendarMonth - 1, 1));
                const selected = selectedCalendarDate ? isSameDay(day.date, selectedCalendarDate) : false;
                const style = CALENDAR_STATUS_STYLES[day.status];
                return (
                  <button
                    key={day.date.toISOString()}
                    type="button"
                    onClick={() => setSelectedCalendarDate(day.date)}
                    className={cn(
                      "min-h-[56px] md:min-h-[72px] rounded-xl border p-1 md:p-1.5 text-left transition-colors",
                      style,
                      !inMonth && "opacity-30",
                      selected && "ring-2 ring-primary ring-offset-1",
                      isToday(day.date) && inMonth && "shadow-[inset_0_0_0_1px_hsl(var(--primary))]",
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold">{format(day.date, "d")}</span>
                      {isToday(day.date) && inMonth && <Badge variant="secondary" className="hidden sm:inline-flex px-1 py-0 text-[9px]">Today</Badge>}
                    </div>
                    <span className="text-xs font-medium">{CALENDAR_STATUS_SHORT[day.status]}</span>
                    {day.totalHours != null && <p className="hidden sm:block text-[10px] opacity-80">{Number(day.totalHours).toFixed(1)}h</p>}
                  </button>
                );
              })}
            </div>
          </div>

          {focusedDay && (
            <div className="mt-4 p-3 rounded-lg border border-border bg-muted/30 text-sm space-y-1">
              <p className="font-medium">{format(focusedDay.date, "EEEE, dd MMM yyyy")}</p>
              <Badge className={cn("border text-xs", CALENDAR_STATUS_STYLES[focusedDay.status])}>{focusedDay.label}</Badge>
              <p className="text-muted-foreground">{focusedDay.note}</p>
              {focusedDay.totalHours != null && <p>Worked: {Number(focusedDay.totalHours).toFixed(1)}h</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check In</TableHead>
                <TableHead>Check Out</TableHead>
                <TableHead>Hours</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">No records</TableCell>
                </TableRow>
              ) : (
                history.slice(0, 30).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.date}</TableCell>
                    <TableCell className="text-xs">
                      {new Date(r.check_in_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.check_out_time
                        ? new Date(r.check_out_time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                        : "—"}
                    </TableCell>
                    <TableCell>{r.total_hours ?? "—"}</TableCell>
                    <TableCell>
                      <Badge className={r.attendance_status === "present" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}>
                        {r.attendance_status.replace("_", " ")}
                      </Badge>
                      {r.is_late && <Badge variant="destructive" className="ml-1 text-[10px]">Late</Badge>}
                    </TableCell>
                    <TableCell className="text-xs">{r.is_wfh ? "WFH" : "Office"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
