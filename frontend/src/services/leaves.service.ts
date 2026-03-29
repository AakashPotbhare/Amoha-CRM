import { api } from "@/lib/api.client";
import type { LeaveRequest, LeaveBalance, LeaveType } from "@/types/domain.types";

export interface LeaveRequestInput {
  employeeId: string;
  leaveType: LeaveType;
  fromDate: string;
  toDate: string;
  reason: string;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getMyLeaveRequests(_employeeId: string): Promise<LeaveRequest[]> {
  const res = await api.get<LeaveRequest[]>('/api/leaves');
  return res.data ?? [];
}

export async function getPendingForTL(_teamId: string): Promise<LeaveRequest[]> {
  const res = await api.get<LeaveRequest[]>('/api/leaves/pending-tl');
  return res.data ?? [];
}

export async function getPendingForManager(_departmentId: string): Promise<LeaveRequest[]> {
  const res = await api.get<LeaveRequest[]>('/api/leaves/pending-manager');
  return res.data ?? [];
}

export async function getAllPendingLeaves(): Promise<LeaveRequest[]> {
  const res = await api.get<LeaveRequest[]>('/api/leaves?status=pending');
  return res.data ?? [];
}

export async function getLeaveBalance(employeeId: string, year: number): Promise<LeaveBalance | null> {
  const res = await api.get<LeaveBalance[]>(`/api/hr/leave-balance/${employeeId}?year=${year}`);
  return res.data?.[0] ?? null;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function submitLeaveRequest(input: LeaveRequestInput): Promise<LeaveRequest> {
  const res = await api.post<LeaveRequest>('/api/leaves', {
    leave_type: input.leaveType,
    from_date:  input.fromDate,
    to_date:    input.toDate,
    reason:     input.reason.trim(),
  });
  return res.data;
}

export async function approveByTL(requestId: string, _tlEmployeeId: string): Promise<void> {
  await api.patch(`/api/leaves/${requestId}/approve-tl`, {});
}

export async function approveByManager(requestId: string, _managerEmployeeId: string): Promise<void> {
  await api.patch(`/api/leaves/${requestId}/approve-manager`, {});
}

export async function rejectLeave(requestId: string, reason?: string): Promise<void> {
  await api.patch(`/api/leaves/${requestId}/reject`, { reason });
}

export async function cancelLeave(requestId: string): Promise<void> {
  await api.patch(`/api/leaves/${requestId}/reject`, { reason: 'Cancelled by employee' });
}
