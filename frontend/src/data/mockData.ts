import { Candidate, DepartmentStats, KPI } from "@/types/recruitment";

export const mockCandidates: Candidate[] = [
  { id: "1", name: "James Wilson", email: "james.w@email.com", phone: "+1 555-0101", position: "Senior React Developer", company: "TechCorp Inc.", status: "interview", department: "technical", assignedTo: "Mike Chen", createdAt: "2026-03-01", updatedAt: "2026-03-06", notes: "Strong portfolio, 7 years experience" },
  { id: "2", name: "Sarah Johnson", email: "sarah.j@email.com", phone: "+1 555-0102", position: "Product Manager", company: "InnovateTech", status: "screening", department: "sales", assignedTo: "Lisa Park", createdAt: "2026-03-03", updatedAt: "2026-03-07", notes: "Referred by current client" },
  { id: "3", name: "David Lee", email: "david.l@email.com", phone: "+1 555-0103", position: "Data Analyst", company: "DataFlow Systems", status: "placed", department: "technical", assignedTo: "Mike Chen", createdAt: "2026-02-15", updatedAt: "2026-03-05", notes: "Successfully placed, starting March 15" },
  { id: "4", name: "Emily Rodriguez", email: "emily.r@email.com", phone: "+1 555-0104", position: "Marketing Director", company: "BrandWave", status: "new", department: "marketing", assignedTo: "Anna Kim", createdAt: "2026-03-07", updatedAt: "2026-03-07", notes: "New lead from LinkedIn campaign" },
  { id: "5", name: "Michael Brown", email: "michael.b@email.com", phone: "+1 555-0105", position: "DevOps Engineer", company: "CloudScale", status: "offer", department: "technical", assignedTo: "Tom Harris", createdAt: "2026-02-20", updatedAt: "2026-03-06", notes: "Offer extended, awaiting response" },
  { id: "6", name: "Jennifer Martinez", email: "jennifer.m@email.com", phone: "+1 555-0106", position: "Compliance Officer", company: "RegTech Corp", status: "screening", department: "compliance", assignedTo: "Sarah Wong", createdAt: "2026-03-04", updatedAt: "2026-03-07", notes: "Background check in progress" },
  { id: "7", name: "Robert Taylor", email: "robert.t@email.com", phone: "+1 555-0107", position: "Resume Writer", company: "CareerBuild", status: "interview", department: "resume", assignedTo: "Jake Foster", createdAt: "2026-02-28", updatedAt: "2026-03-06", notes: "Second round interview scheduled" },
  { id: "8", name: "Amanda White", email: "amanda.w@email.com", phone: "+1 555-0108", position: "Full Stack Developer", company: "WebForge", status: "new", department: "technical", assignedTo: "Mike Chen", createdAt: "2026-03-08", updatedAt: "2026-03-08", notes: "Just submitted application" },
  { id: "9", name: "Chris Anderson", email: "chris.a@email.com", phone: "+1 555-0109", position: "Sales Executive", company: "SalesForce Pro", status: "placed", department: "sales", assignedTo: "Lisa Park", createdAt: "2026-01-20", updatedAt: "2026-02-28", notes: "Placed successfully, excellent feedback" },
  { id: "10", name: "Patricia Davis", email: "patricia.d@email.com", phone: "+1 555-0110", position: "UI/UX Designer", company: "DesignHub", status: "offer", department: "marketing", assignedTo: "Anna Kim", createdAt: "2026-02-25", updatedAt: "2026-03-07", notes: "Offer accepted, onboarding next week" },
];

export const mockKPIs: KPI[] = [
  { label: "Total Candidates", value: 248, change: 12, changeType: "increase" },
  { label: "Active Pipeline", value: 67, change: 5, changeType: "increase" },
  { label: "Placed This Month", value: 14, change: 3, changeType: "increase" },
  { label: "Avg. Time to Place", value: "18 days", change: 2, changeType: "decrease" },
];

export const mockDepartmentStats: DepartmentStats[] = [
  { department: "Sales", candidates: 42, placed: 8, active: 15, performance: 87 },
  { department: "Resume", candidates: 38, placed: 5, active: 12, performance: 72 },
  { department: "Marketing", candidates: 55, placed: 10, active: 18, performance: 91 },
  { department: "Technical", candidates: 78, placed: 15, active: 25, performance: 95 },
  { department: "Compliance", candidates: 35, placed: 4, active: 10, performance: 68 },
];
