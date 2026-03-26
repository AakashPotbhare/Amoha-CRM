import { api } from "@/lib/api.client";
import type { CandidateEnrollment, CandidatePipelineStage, PipelineStats } from "@/types/domain.types";

export interface CandidateFilters {
  pipelineStage?: CandidatePipelineStage;
  search?: string;
  enrolledByEmployeeId?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedCandidates {
  data: CandidateEnrollment[];
  total: number;
  page: number;
  pageSize: number;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getCandidates(filters: CandidateFilters = {}): Promise<PaginatedCandidates> {
  const { pipelineStage, search, enrolledByEmployeeId, page = 1, pageSize = 25 } = filters;

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', String(pageSize));
  if (pipelineStage)        params.set('stage', pipelineStage);
  if (search?.trim())       params.set('search', search.trim());
  if (enrolledByEmployeeId) params.set('enrolled_by', enrolledByEmployeeId);

  const res = await api.get<CandidateEnrollment[]>(`/api/candidates?${params}`);
  return {
    data:     res.data ?? [],
    total:    res.total ?? 0,
    page:     res.page  ?? page,
    pageSize: res.limit ?? pageSize,
  };
}

export async function getCandidateById(id: string): Promise<CandidateEnrollment | null> {
  const res = await api.get<CandidateEnrollment>(`/api/candidates/${id}`);
  return res.data;
}

export async function getPipelineStats(): Promise<PipelineStats> {
  const res = await api.get<PipelineStats>('/api/candidates/pipeline-stats');
  const stats = res.data;
  const total = Object.values(stats as Record<string, number>).reduce((a, b) => a + b, 0);
  return { ...stats, total } as PipelineStats;
}

export async function getThisMonthEnrollments(): Promise<number> {
  const now   = new Date();
  const month = now.getMonth() + 1;
  const year  = now.getFullYear();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end   = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  const params = new URLSearchParams({ stage: '' });
  // We do a count via the list endpoint filtered to this month's created_at
  // Backend doesn't have this filter yet, so use pipeline-stats response total for now
  // and fall back to a simple query
  const res = await api.get<CandidateEnrollment[]>(
    `/api/candidates?page=1&limit=1&date_from=${start}&date_to=${end}`
  );
  return res.total ?? 0;
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function enrollCandidate(
  data: Omit<CandidateEnrollment, 'id' | 'created_at' | 'updated_at' | 'pipeline_stage'>
): Promise<CandidateEnrollment> {
  const res = await api.post<CandidateEnrollment>('/api/candidates', data);
  return res.data;
}

export async function updatePipelineStage(id: string, stage: CandidatePipelineStage): Promise<void> {
  await api.patch(`/api/candidates/${id}/stage`, { stage });
}

export async function updateCandidate(id: string, data: Partial<CandidateEnrollment>): Promise<void> {
  await api.patch(`/api/candidates/${id}`, data);
}
