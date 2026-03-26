import { api } from "@/lib/api.client";
import type { AttendanceRecord, AttendanceBreak } from "@/types/domain.types";

export interface CheckInPayload {
  employeeId: string;
  lat?: number;
  lng?: number;
}

export interface AttendanceSummary {
  employee_id: string;
  full_name: string;
  employee_code: string;
  present: number;
  late: number;
  wfh: number;
  absent: number;
  half_day: number;
  total_hours: number;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTodayAttendance(_employeeId: string): Promise<AttendanceRecord | null> {
  // employeeId scoped by JWT on backend
  const res = await api.get<AttendanceRecord | null>('/api/attendance/today');
  return res.data;
}

export async function getMonthlyAttendance(
  employeeId: string,
  month: number,
  year: number,
): Promise<AttendanceRecord[]> {
  const params = new URLSearchParams({ employee_id: employeeId, month: String(month), year: String(year) });
  const res = await api.get<AttendanceRecord[]>(`/api/attendance/monthly?${params}`);
  return res.data ?? [];
}

export async function getBreaksForRecord(attendanceRecordId: string): Promise<AttendanceBreak[]> {
  // Breaks are embedded in the today response; here we return from a stored record
  const res = await api.get<AttendanceRecord & { breaks: AttendanceBreak[] }>(
    `/api/attendance/today`
  );
  if (res.data && 'breaks' in res.data) {
    return (res.data as AttendanceRecord & { breaks: AttendanceBreak[] }).breaks ?? [];
  }
  return [];
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function checkIn(payload: CheckInPayload): Promise<AttendanceRecord> {
  const res = await api.post<AttendanceRecord>('/api/attendance/check-in', {
    latitude:  payload.lat,
    longitude: payload.lng,
  });
  return res.data;
}

export async function checkOut(_recordId: string): Promise<void> {
  // recordId not needed — backend finds today's open record from JWT
  await api.post('/api/attendance/check-out', {});
}

export async function startBreak(
  _attendanceRecordId: string,
  breakType: 'short_break' | 'lunch',
  _breakNumber: number,
): Promise<AttendanceBreak> {
  const res = await api.post<AttendanceBreak>('/api/attendance/break/start', { break_type: breakType });
  return res.data;
}

export async function endBreak(_breakId: string): Promise<void> {
  await api.post('/api/attendance/break/end', {});
}
