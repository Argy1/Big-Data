"use client";

import { Skeleton } from "@/components/common/States";
import { fmtMillions, fmtNum, parseNaive } from "@/lib/format";
import { useSummary } from "@/lib/queries";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const short = (d: string) => {
  const x = parseNaive(d);
  return `${x.getDate()} ${MONTHS[x.getMonth()]} ${x.getFullYear()}`;
};

/** Four dataset facts from /api/analytics/summary (PLAN §2.4). */
export function StatCards() {
  const { data: s } = useSummary();
  const stats = s
    ? [
        { t: "Pembacaan sensor", v: fmtMillions(s.n_readings), d: `${s.n_sensors} sensor × tiap 5 menit` },
        { t: "Rentang data", v: `${s.n_days} hari`, d: `${short(s.first_date).replace(" 2017", "")} – ${short(s.last_date)}` },
        {
          t: "Pembacaan padat/macet",
          v: `${fmtNum(s.pct_congested_mean)}%`,
          d: `rata-rata harian (maks ${fmtNum(s.pct_congested_max)}%)`,
        },
        {
          t: "Master dataset",
          v: `${fmtNum(s.master_mb, 0)} MB`,
          d: s.raw_csv_mb ? `Parquet per bulan (CSV ${fmtNum(s.raw_csv_mb, 0)} MB)` : "Parquet per bulan",
        },
      ]
    : null;

  return (
    <section aria-label="Statistik dataset" className="flex flex-wrap gap-4">
      {(stats ?? Array.from({ length: 4 }, () => null)).map((x, i) => (
        <div key={x?.t ?? i} className="min-w-0 flex-[1_1_200px] rounded-panel border border-border bg-panel px-5 py-[18px] shadow-panel">
          {x ? (
            <>
              <div className="text-[13px] font-medium text-muted">{x.t}</div>
              <div className="mono mt-1.5 text-[30px] font-semibold tracking-[-0.03em]">{x.v}</div>
              <div className="mt-1 text-xs text-text-2">{x.d}</div>
            </>
          ) : (
            <Skeleton className="h-[86px]" />
          )}
        </div>
      ))}
    </section>
  );
}
