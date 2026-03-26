export type ApplicationType = "long" | "short";

export type InterviewStatus = "scheduled" | "completed" | "cancelled" | "rescheduled" | "no-show";

export type CandidateMarketingStatus = 
  | "allocated" 
  | "cold-called" 
  | "form-sent" 
  | "active" 
  | "on-hold" 
  | "placed";

export const JOB_PORTALS = [
  "LinkedIn",
  "Indeed", 
  "Glassdoor",
  "ZipRecruiter",
  "Monster",
  "CareerBuilder",
  "Dice",
  "Wellfound",
  "Handshake",
  "Upwork",
] as const;

export type JobPortal = (typeof JOB_PORTALS)[number];

export interface MarketingCandidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  tlAssigned: string;
  pocAssigned: string;
  status: CandidateMarketingStatus;
  welcomeEmailSent: boolean;
  formSent: boolean;
  formReceived: boolean;
  allocatedDate: string;
  notes: string;
}

export interface Application {
  id: string;
  candidateId: string;
  candidateName: string;
  company: string;
  jobTitle: string;
  portal: JobPortal;
  type: ApplicationType;
  date: string;
  appliedBy: string;
  linkUrl: string;
}

export interface Interview {
  id: string;
  candidateId: string;
  candidateName: string;
  company: string;
  round: number;
  date: string;
  time: string;
  jobDescription: string;
  status: InterviewStatus;
  loggedBy: string;
  notes: string;
}

export interface MarketingTL {
  id: string;
  name: string;
  candidateCount: number;
}

export interface MarketingRecruiter {
  id: string;
  name: string;
  tlId: string;
  applicationsToday: number;
  interviewsThisWeek: number;
}
