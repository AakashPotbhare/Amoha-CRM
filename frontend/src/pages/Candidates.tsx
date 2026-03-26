import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api.client";

type CandidateRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  dob: string | null;
  visa_status: string | null;
  visa_expire_date: string | null;
  current_location_zip: string | null;
  current_domain: string | null;
  years_experience: string | null;
  highest_qualification: string | null;
  linkedin_email: string | null;
  marketing_email: string | null;
  arrived_in_usa: string | null;
  veteran_status: string | null;
  security_clearance: string | null;
  race_ethnicity: string | null;
  nearest_metro_area: string | null;
  native_country: string | null;
  total_certifications: string | null;
  availability_for_calls: string | null;
  availability_to_start: string | null;
  open_for_relocation: string | null;
  salary_expectations: string | null;
  pipeline_stage: string | null;
  created_at: string | null;
};

function toTitleCase(value: string | null) {
  if (!value) return "-";
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatDate(value: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleDateString();
}

const COL_HEADER = "px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap text-left";
const COL_CELL = "px-4 py-3 text-sm text-foreground align-top";

export default function Candidates() {
  const [search, setSearch] = useState("");
  const [candidates, setCandidates] = useState<CandidateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadCandidates() {
      setLoading(true);
      setError(null);

      const res = await api.get<CandidateRow[]>("/api/candidates");

      if (!isMounted) return;

      if (!res.success) {
        setError(res.error || "Failed to load candidates");
      } else {
        setCandidates(
          (res.data || []).map((c: any) => ({
            id: c.id,
            full_name: c.full_name,
            email: c.email ?? null,
            phone: c.phone ?? null,
            gender: c.gender ?? null,
            dob: c.dob ?? null,
            visa_status: c.visa_status ?? null,
            visa_expire_date: c.visa_expire_date ?? null,
            current_location_zip: c.current_location_zip ?? null,
            current_domain: c.current_domain ?? null,
            years_experience: c.years_experience ?? null,
            highest_qualification: c.highest_qualification ?? null,
            linkedin_email: c.linkedin_email ?? null,
            marketing_email: c.marketing_email ?? null,
            arrived_in_usa: c.arrived_in_usa ?? null,
            veteran_status: c.veteran_status ?? null,
            security_clearance: c.security_clearance ?? null,
            race_ethnicity: c.race_ethnicity ?? null,
            nearest_metro_area: c.nearest_metro_area ?? null,
            native_country: c.native_country ?? null,
            total_certifications: c.total_certifications ?? null,
            availability_for_calls: c.availability_for_calls ?? null,
            availability_to_start: c.availability_to_start ?? null,
            open_for_relocation: c.open_for_relocation ?? null,
            salary_expectations: c.salary_expectations ?? null,
            pipeline_stage: c.pipeline_stage ?? null,
            created_at: c.created_at ?? null,
          })),
        );
      }

      setLoading(false);
    }

    loadCandidates();
    return () => { isMounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return candidates;
    return candidates.filter((c) =>
      [
        c.full_name, c.email, c.phone, c.gender, c.visa_status,
        c.current_location_zip, c.current_domain, c.highest_qualification,
        c.years_experience, c.native_country, c.nearest_metro_area,
        c.salary_expectations, c.linkedin_email, c.marketing_email,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(term)),
    );
  }, [candidates, search]);

  return (
    <div className="p-6 lg:p-8 max-w-full space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Candidates</h1>
        <p className="text-sm text-muted-foreground mt-1">
          All enrolled candidates with their complete enrollment details.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search candidates..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="bg-card rounded-lg border border-border overflow-x-auto">
        <table className="w-full" style={{ minWidth: "2400px" }}>
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              {/* Personal Information */}
              <th className={COL_HEADER}>Pipeline Stage</th>
              <th className={COL_HEADER}>Full Name (As per ID)</th>
              <th className={COL_HEADER}>Contact Email</th>
              <th className={COL_HEADER}>Contact Number</th>
              <th className={COL_HEADER}>Gender</th>
              <th className={COL_HEADER}>Date of Birth</th>
              {/* Visa & Location */}
              <th className={COL_HEADER}>Visa Status</th>
              <th className={COL_HEADER}>Visa Expire Date</th>
              <th className={COL_HEADER}>Current Location (Zip)</th>
              <th className={COL_HEADER}>Current Domain</th>
              <th className={COL_HEADER}>Genuine Years of Experience</th>
              {/* Education */}
              <th className={COL_HEADER}>Highest Qualification</th>
              {/* LinkedIn & Marketing */}
              <th className={COL_HEADER}>LinkedIn Login Email</th>
              <th className={COL_HEADER}>Marketing Email ID</th>
              {/* General Questions */}
              <th className={COL_HEADER}>Arrived in USA</th>
              <th className={COL_HEADER}>Veteran Status</th>
              <th className={COL_HEADER}>Security Clearance</th>
              <th className={COL_HEADER}>Race / Ethnicity</th>
              <th className={COL_HEADER}>Nearest Metropolitan Area</th>
              <th className={COL_HEADER}>Native Country</th>
              <th className={COL_HEADER}>Total Certifications</th>
              <th className={COL_HEADER}>Availability for Recruiter Calls</th>
              <th className={COL_HEADER}>Availability to Start Work</th>
              <th className={COL_HEADER}>Open for Relocation</th>
              <th className={COL_HEADER}>Salary Expectations</th>
              <th className={COL_HEADER}>Enrolled On</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={26} className="px-5 py-10 text-center text-muted-foreground text-sm">
                  Loading candidates...
                </td>
              </tr>
            )}
            {!loading && error && (
              <tr>
                <td colSpan={26} className="px-5 py-10 text-center text-destructive text-sm">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && filtered.length === 0 && (
              <tr>
                <td colSpan={26} className="px-5 py-10 text-center text-muted-foreground text-sm">
                  No candidates found.
                </td>
              </tr>
            )}
            {!loading && !error && filtered.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/50 transition-colors">
                {/* Full Name */}
                <td className={COL_CELL}>
                  <span className="text-xs px-2 py-1 rounded-full bg-secondary text-foreground capitalize">
                    {c.pipeline_stage?.replace(/_/g, " ") ?? "enrolled"}
                  </span>
                </td>
                <td className={COL_CELL}>
                  <p className="font-medium text-foreground">{c.full_name}</p>
                </td>
                {/* Contact Email */}
                <td className={COL_CELL}>{c.email || "-"}</td>
                {/* Contact Number */}
                <td className={COL_CELL}>{c.phone || "-"}</td>
                {/* Gender */}
                <td className={COL_CELL}>{toTitleCase(c.gender)}</td>
                {/* Date of Birth */}
                <td className={COL_CELL}>{formatDate(c.dob)}</td>
                {/* Visa Status */}
                <td className={COL_CELL}>{c.visa_status || "-"}</td>
                {/* Visa Expire Date */}
                <td className={COL_CELL}>{formatDate(c.visa_expire_date)}</td>
                {/* Current Location */}
                <td className={COL_CELL} style={{ maxWidth: "200px" }}>{c.current_location_zip || "-"}</td>
                {/* Current Domain */}
                <td className={COL_CELL}>{c.current_domain || "-"}</td>
                {/* Years of Experience */}
                <td className={COL_CELL}>{c.years_experience || "-"}</td>
                {/* Highest Qualification */}
                <td className={COL_CELL}>{toTitleCase(c.highest_qualification)}</td>
                {/* LinkedIn Login Email */}
                <td className={COL_CELL}>{c.linkedin_email || "-"}</td>
                {/* Marketing Email ID */}
                <td className={COL_CELL}>{c.marketing_email || "-"}</td>
                {/* Arrived in USA */}
                <td className={COL_CELL}>{formatDate(c.arrived_in_usa)}</td>
                {/* Veteran Status */}
                <td className={COL_CELL}>{toTitleCase(c.veteran_status)}</td>
                {/* Security Clearance */}
                <td className={COL_CELL}>{toTitleCase(c.security_clearance)}</td>
                {/* Race / Ethnicity */}
                <td className={COL_CELL}>{c.race_ethnicity || "-"}</td>
                {/* Nearest Metropolitan Area */}
                <td className={COL_CELL}>{c.nearest_metro_area || "-"}</td>
                {/* Native Country */}
                <td className={COL_CELL}>{c.native_country || "-"}</td>
                {/* Total Certifications */}
                <td className={COL_CELL}>{c.total_certifications || "-"}</td>
                {/* Availability for Recruiter Calls */}
                <td className={COL_CELL}>{c.availability_for_calls || "-"}</td>
                {/* Availability to Start Work */}
                <td className={COL_CELL}>{c.availability_to_start || "-"}</td>
                {/* Open for Relocation */}
                <td className={COL_CELL}>{toTitleCase(c.open_for_relocation)}</td>
                {/* Salary Expectations */}
                <td className={COL_CELL}>{c.salary_expectations || "-"}</td>
                {/* Enrolled On */}
                <td className={COL_CELL}>{formatDate(c.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
