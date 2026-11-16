import { cn } from "@/lib/utils";

import { Skeleton } from "./States";

/** Label 13/500 muted, number 38 mono/600, unit 14 muted, delta row (PLAN §10.2). */
export function KpiCard({
  label,
  value,
  unit,
  delta,
  tone = "default",
  valueClassName,
  loading,
}: {
  label: string;
  value: React.ReactNode;
  unit?: React.ReactNode;
  delta?: React.ReactNode;
  tone?: "default" | "alert";
  valueClassName?: string;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-[1_1_210px] flex-col gap-2.5 rounded-panel border p-5 shadow-panel",
        tone === "alert" ? "border-alert-line bg-alert-bg" : "border-border bg-panel",
      )}
    >
      <div className="text-[13px] font-medium text-muted">{label}</div>
      {loading ? (
        <Skeleton className="h-[46px] w-32" />
      ) : (
        <div className="flex items-baseline gap-2">
          <span className={cn("mono text-[38px] leading-[1.2] font-semibold tracking-[-0.03em]", valueClassName)}>{value}</span>
          {unit && <span className="text-sm text-muted">{unit}</span>}
        </div>
      )}
      <div className="flex min-h-5 flex-wrap items-center gap-2 text-[13px] text-text-2">{loading ? <Skeleton className="h-5 w-40" /> : delta}</div>
    </div>
  );
}

/** Small mono chip used in KPI delta rows ("−3,3", "27%", "▲ 28"). */
export function DeltaChip({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={cn("mono rounded-md px-2 py-0.5 text-xs font-semibold", className)}>{children}</span>;
}
