import { api } from "@/lib/api.client";
import type { Employee, SalaryHistory, HRNotice } from "@/types/domain.types";

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getEmployees(filters?: {
  departmentId?: string;
  teamId?: string;
  isActive?: boolean;
}): Promise<Employee[]> {
  const params = new URLSearchParams();
  if (filters?.departmentId)      params.set('department_id', filters.departmentId);
  if (filters?.teamId)            params.set('team_id', filters.teamId);
  if (filters?.isActive !== undefined) params.set('is_active', filters.isActive ? '1' : '0');

  const query = params.toString() ? `?${params}` : '';
  const res = await api.get<Employee[]>(`/api/employees${query}`);
  return res.data ?? [];
}

export async function getEmployeeById(id: string): Promise<Employee | null> {
  const res = await api.get<Employee>(`/api/employees/${id}`);
  return res.data;
}

export async function getTeamMembers(teamId: string): Promise<Employee[]> {
  const res = await api.get<Employee[]>(`/api/employees?team_id=${teamId}&is_active=1`);
  return res.data ?? [];
}

export async function getSalaryHistory(employeeId: string): Promise<SalaryHistory[]> {
  const res = await api.get<SalaryHistory[]>(`/api/hr/salary-history/${employeeId}`);
  return res.data ?? [];
}

export async function getHRNotices(): Promise<HRNotice[]> {
  const res = await api.get<HRNotice[]>('/api/hr/notices');
  return res.data ?? [];
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function updateEmployee(id: string, data: Partial<Employee>): Promise<void> {
  await api.patch(`/api/employees/${id}`, data);
}

export async function deactivateEmployee(id: string): Promise<void> {
  await api.patch(`/api/employees/${id}`, { is_active: false });
}

export async function updateSalary(
  employeeId: string,
  newSalary: number,
  reason: string,
  _changedByEmployeeId: string,
): Promise<void> {
  await api.patch(`/api/employees/${employeeId}/salary`, { salary: newSalary, note: reason });
}

export async function createHRNotice(
  title: string,
  content: string,
  _createdByEmployeeId: string,
): Promise<HRNotice> {
  const res = await api.post<HRNotice>('/api/hr/notices', { title, content });
  return res.data;
}

export async function updateHRNotice(id: string, title: string, content: string): Promise<void> {
  await api.patch(`/api/hr/notices/${id}`, { title, content });
}

export async function deleteHRNotice(id: string): Promise<void> {
  await api.delete(`/api/hr/notices/${id}`);
}
