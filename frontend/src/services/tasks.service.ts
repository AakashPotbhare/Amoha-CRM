import { api } from "@/lib/api.client";
import type { GeneralTask, TaskStatus, TaskPriority } from "@/types/domain.types";

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority: TaskPriority;
  dueDate?: string;
  assignedToEmployeeId?: string;
  createdByEmployeeId: string;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getTasksForEmployee(
  employeeId: string,
  _teamId: string,
  _departmentId: string,
): Promise<GeneralTask[]> {
  // Backend scopes automatically by JWT role; employee_id used for assigned_to filter
  const res = await api.get<GeneralTask[]>(`/api/tasks?assigned_to=${employeeId}`);
  return res.data ?? [];
}

export async function getTasksCreatedBy(employeeId: string): Promise<GeneralTask[]> {
  const res = await api.get<GeneralTask[]>(`/api/tasks?created_by=${employeeId}`);
  return res.data ?? [];
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createTask(input: CreateTaskInput): Promise<GeneralTask> {
  const res = await api.post<GeneralTask>('/api/tasks', {
    title:                    input.title,
    description:              input.description,
    priority:                 input.priority,
    due_date:                 input.dueDate,
    assigned_to_employee_id: input.assignedToEmployeeId,
  });
  return res.data;
}

export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
  await api.patch(`/api/tasks/${id}/status`, { status });
}
