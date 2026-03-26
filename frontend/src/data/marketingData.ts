import {
  MarketingCandidate,
  Application,
  Interview,
  MarketingTL,
  MarketingRecruiter,
} from "@/types/marketing";

export const marketingTLs: MarketingTL[] = [
  { id: "tl1", name: "Anna Kim", candidateCount: 12 },
  { id: "tl2", name: "Raj Patel", candidateCount: 10 },
  { id: "tl3", name: "Maria Lopez", candidateCount: 11 },
];

export const marketingRecruiters: MarketingRecruiter[] = [
  { id: "r1", name: "Kevin Wu", tlId: "tl1", applicationsToday: 87, interviewsThisWeek: 3 },
  { id: "r2", name: "Jessica Tran", tlId: "tl1", applicationsToday: 95, interviewsThisWeek: 5 },
  { id: "r3", name: "Derek Moore", tlId: "tl2", applicationsToday: 72, interviewsThisWeek: 2 },
  { id: "r4", name: "Priya Sharma", tlId: "tl2", applicationsToday: 110, interviewsThisWeek: 4 },
  { id: "r5", name: "Carlos Reyes", tlId: "tl3", applicationsToday: 65, interviewsThisWeek: 6 },
  { id: "r6", name: "Tina Nguyen", tlId: "tl3", applicationsToday: 98, interviewsThisWeek: 3 },
];

export const marketingCandidates: MarketingCandidate[] = [
  { id: "mc1", name: "James Wilson", email: "james.w@email.com", phone: "+1 555-0101", tlAssigned: "Anna Kim", pocAssigned: "Kevin Wu", status: "active", welcomeEmailSent: true, formSent: true, formReceived: true, allocatedDate: "2026-03-01", notes: "Strong Java background" },
  { id: "mc2", name: "Sarah Johnson", email: "sarah.j@email.com", phone: "+1 555-0102", tlAssigned: "Raj Patel", pocAssigned: "Derek Moore", status: "active", welcomeEmailSent: true, formSent: true, formReceived: true, allocatedDate: "2026-03-02", notes: "Product management experience" },
  { id: "mc3", name: "Emily Rodriguez", email: "emily.r@email.com", phone: "+1 555-0104", tlAssigned: "Anna Kim", pocAssigned: "Jessica Tran", status: "allocated", welcomeEmailSent: false, formSent: false, formReceived: false, allocatedDate: "2026-03-07", notes: "New allocation from Ops Manager" },
  { id: "mc4", name: "Michael Brown", email: "michael.b@email.com", phone: "+1 555-0105", tlAssigned: "Maria Lopez", pocAssigned: "Carlos Reyes", status: "active", welcomeEmailSent: true, formSent: true, formReceived: true, allocatedDate: "2026-02-20", notes: "DevOps/Cloud focus" },
  { id: "mc5", name: "Amanda White", email: "amanda.w@email.com", phone: "+1 555-0108", tlAssigned: "Raj Patel", pocAssigned: "Priya Sharma", status: "on-hold", welcomeEmailSent: true, formSent: true, formReceived: true, allocatedDate: "2026-02-15", notes: "On hold — candidate no-show, compliance notified" },
  { id: "mc6", name: "Robert Taylor", email: "robert.t@email.com", phone: "+1 555-0107", tlAssigned: "Maria Lopez", pocAssigned: "Tina Nguyen", status: "placed", welcomeEmailSent: true, formSent: true, formReceived: true, allocatedDate: "2026-01-25", notes: "Placed at TechCorp on Feb 28" },
];

export const marketingApplications: Application[] = [
  { id: "a1", candidateId: "mc1", candidateName: "James Wilson", company: "Google", jobTitle: "Senior Java Developer", portal: "LinkedIn", type: "long", date: "2026-03-08", appliedBy: "Kevin Wu", linkUrl: "https://linkedin.com/jobs/123" },
  { id: "a2", candidateId: "mc1", candidateName: "James Wilson", company: "Meta", jobTitle: "Backend Engineer", portal: "Indeed", type: "short", date: "2026-03-08", appliedBy: "Kevin Wu", linkUrl: "https://indeed.com/jobs/456" },
  { id: "a3", candidateId: "mc2", candidateName: "Sarah Johnson", company: "Amazon", jobTitle: "Product Manager II", portal: "Glassdoor", type: "long", date: "2026-03-08", appliedBy: "Derek Moore", linkUrl: "https://glassdoor.com/jobs/789" },
  { id: "a4", candidateId: "mc2", candidateName: "Sarah Johnson", company: "Stripe", jobTitle: "Senior PM", portal: "LinkedIn", type: "long", date: "2026-03-07", appliedBy: "Derek Moore", linkUrl: "https://linkedin.com/jobs/101" },
  { id: "a5", candidateId: "mc4", candidateName: "Michael Brown", company: "AWS", jobTitle: "DevOps Engineer", portal: "Dice", type: "long", date: "2026-03-08", appliedBy: "Carlos Reyes", linkUrl: "https://dice.com/jobs/202" },
  { id: "a6", candidateId: "mc4", candidateName: "Michael Brown", company: "Cloudflare", jobTitle: "SRE", portal: "ZipRecruiter", type: "short", date: "2026-03-08", appliedBy: "Carlos Reyes", linkUrl: "https://ziprecruiter.com/jobs/303" },
  { id: "a7", candidateId: "mc1", candidateName: "James Wilson", company: "Netflix", jobTitle: "Full Stack Engineer", portal: "Wellfound", type: "long", date: "2026-03-07", appliedBy: "Kevin Wu", linkUrl: "https://wellfound.com/jobs/404" },
  { id: "a8", candidateId: "mc2", candidateName: "Sarah Johnson", company: "Notion", jobTitle: "Product Lead", portal: "LinkedIn", type: "short", date: "2026-03-06", appliedBy: "Derek Moore", linkUrl: "" },
];

export const marketingInterviews: Interview[] = [
  { id: "i1", candidateId: "mc1", candidateName: "James Wilson", company: "Google", round: 1, date: "2026-03-10", time: "10:00 AM", jobDescription: "Senior Java Developer — Backend services, microservices architecture", status: "scheduled", loggedBy: "Kevin Wu", notes: "Phone screen with hiring manager" },
  { id: "i2", candidateId: "mc2", candidateName: "Sarah Johnson", company: "Stripe", round: 1, date: "2026-03-09", time: "2:00 PM", jobDescription: "Senior PM — Payment platform product strategy", status: "completed", loggedBy: "Derek Moore", notes: "Went well, awaiting round 2 schedule" },
  { id: "i3", candidateId: "mc2", candidateName: "Sarah Johnson", company: "Stripe", round: 2, date: "2026-03-12", time: "11:00 AM", jobDescription: "Senior PM — Payment platform product strategy", status: "scheduled", loggedBy: "Derek Moore", notes: "Case study presentation" },
  { id: "i4", candidateId: "mc4", candidateName: "Michael Brown", company: "AWS", round: 1, date: "2026-03-08", time: "3:30 PM", jobDescription: "DevOps Engineer — CI/CD, Terraform, Kubernetes", status: "completed", loggedBy: "Carlos Reyes", notes: "Technical phone screen passed" },
  { id: "i5", candidateId: "mc5", candidateName: "Amanda White", company: "Datadog", round: 1, date: "2026-03-05", time: "9:00 AM", jobDescription: "Frontend Engineer — React, TypeScript", status: "no-show", loggedBy: "Priya Sharma", notes: "Candidate no-show — profile on hold, compliance notified" },
  { id: "i6", candidateId: "mc4", candidateName: "Michael Brown", company: "AWS", round: 2, date: "2026-03-13", time: "1:00 PM", jobDescription: "DevOps Engineer — CI/CD, Terraform, Kubernetes", status: "scheduled", loggedBy: "Carlos Reyes", notes: "System design round" },
];
