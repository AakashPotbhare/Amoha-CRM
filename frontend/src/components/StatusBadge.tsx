import { CandidateStatus } from "@/types/recruitment";
import { cn } from "@/lib/utils";

const statusConfig: Record<CandidateStatus, { label: string; className: string }> = {
  new: { label: "New", className: "bg-info/10 text-info" },
  screening: { label: "Screening", className: "bg-warning/10 text-warning" },
  interview: { label: "Interview", className: "bg-primary/10 text-primary" },
  offer: { label: "Offer", className: "bg-accent text-accent-foreground" },
  placed: { label: "Placed", className: "bg-success/10 text-success" },
  rejected: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
};

export default function StatusBadge({ status }: { status: CandidateStatus }) {
  const config = statusConfig[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className
      )}
    >
      {config.label}
    </span>
  );
}
