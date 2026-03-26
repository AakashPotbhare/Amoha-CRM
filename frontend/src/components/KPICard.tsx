import { TrendingUp, TrendingDown } from "lucide-react";
import { KPI } from "@/types/recruitment";

export default function KPICard({ kpi }: { kpi: KPI }) {
  return (
    <div className="bg-card rounded-lg border border-border p-5 animate-fade-in">
      <p className="text-sm font-medium text-muted-foreground">{kpi.label}</p>
      <div className="flex items-end justify-between mt-2">
        <p className="text-2xl font-bold text-card-foreground">{kpi.value}</p>
        <div
          className={`flex items-center gap-1 text-xs font-medium ${
            kpi.changeType === "increase" ? "text-success" : "text-destructive"
          }`}
        >
          {kpi.changeType === "increase" ? (
            <TrendingUp className="w-3 h-3" />
          ) : (
            <TrendingDown className="w-3 h-3" />
          )}
          <span>{kpi.change}%</span>
        </div>
      </div>
    </div>
  );
}
