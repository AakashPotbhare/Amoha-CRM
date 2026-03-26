import { api } from "@/lib/api.client";
import type { SupportTask, SupportTaskType, TaskStatus, CallStatus, TaskComment } from "@/types/domain.types";

export interface SupportTaskFilters {
  departmentId?: string;
  assigneeId?: string;
  status?: TaskStatus;
  taskType?: SupportTaskType;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getSupportTasksByDepartment(departmentId: string): Promise<SupportTask[]> {
  const res = await api.get<SupportTask[]>(`/api/support-tasks?department_id=${departmentId}`);
  return res.data ?? [];
}

export async function getSupportTasksByAssignee(employeeId: string): Promise<SupportTask[]> {
  const res = await api.get<SupportTask[]>(`/api/support-tasks?assigned_to=${employeeId}`);
  return res.data ?? [];
}

export async function getSupportTaskComments(taskId: string): Promise<TaskComment[]> {
  const res = await api.get<SupportTask & { comments: TaskComment[] }>(`/api/support-tasks/${taskId}`);
  return res.data?.comments ?? [];
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createSupportTask(
  data: Omit<SupportTask, 'id' | 'created_at' | 'updated_at'>
): Promise<SupportTask> {
  const res = await api.post<SupportTask>('/api/support-tasks', data);
  return res.data;
}

export async function updateSupportTaskStatus(id: string, status: TaskStatus): Promise<void> {
  await api.patch(`/api/support-tasks/${id}/status`, { status });
}

export async function updateCallStatus(id: string, callStatus: CallStatus): Promise<void> {
  await api.patch(`/api/support-tasks/${id}/call-status`, { call_status: callStatus });
}

export async function reassignSupportTask(id: string, toEmployeeId: string): Promise<void> {
  await api.patch(`/api/support-tasks/${id}/reassign`, { assigned_to_employee_id: toEmployeeId });
}

export async function addComment(
  taskId: string,
  _employeeId: string,
  content: string
): Promise<TaskComment> {
  // employeeId is taken from the JWT on the backend; passing it here is kept for signature compat
  const res = await api.post<TaskComment>(`/api/support-tasks/${taskId}/comments`, { content });
  return res.data;
}
