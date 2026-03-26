export type CandidateStatus = "new" | "screening" | "interview" | "offer" | "placed" | "rejected";

export type Department = "sales" | "resume" | "marketing" | "technical" | "compliance";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  position: string;
  company: string;
  status: CandidateStatus;
  department: Department;
  assignedTo: string;
  createdAt: string;
  updatedAt: string;
  notes: string;
}

export interface KPI {
  label: string;
  value: number | string;
  change: number;
  changeType: "increase" | "decrease";
}

export interface DepartmentStats {
  department: string;
  candidates: number;
  placed: number;
  active: number;
  performance: number;
}
