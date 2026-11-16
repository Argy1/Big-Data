"use client";

import { Panel } from "@/components/common/Panel";
import { ErrorState, Skeleton } from "@/components/common/States";
import { fmtNum } from "@/lib/format";
import { useModelMetrics } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ORDER = ["Persistence", "Profil historis", "Model B"];

/** "Seberapa bisa dipercaya? Uji Juni 2017" — test_metrics from model_b_config.json via the API (PLAN §2.3). */
export function PerfTable() {
  const q = useModelMetrics();
  const rows = (q.data?.model_b.test_metrics ?? [])
    .filter((m) => m.subset === "Semua")
    .sort((a, b) => a.horizon.localeCompare(b.horizon) || ORDER.indexOf(a.method) - ORDER.indexOf(b.method));
  const n = rows.find((r) => r.horizon === "1h")?.n;

  return (
    <Panel aria-label="Kinerja Model B" className="flex flex-col gap-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="m-0 text-[17px] font-bold">Seberapa bisa dipercaya? Uji Juni 2017</h2>
        <span className="text-[13px] text-muted">
          Data test tidak pernah dilihat saat training{n ? ` · ${fmtNum(n / 1000, 0)} ribu prediksi per horizon` : ""}
        </span>
      </div>
      {q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : !rows.length ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[13px]">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="py-2 pr-2 pb-2.5 font-semibold">Horizon</th>
                <th scope="col" className="p-2 font-semibold">Metode</th>
                <th scope="col" className="p-2 text-right font-semibold">MAE (km/jam)</th>
                <th scope="col" className="p-2 text-right font-semibold">Macro-F1 level</th>
                <th scope="col" className="p-2 text-right font-semibold">Recall macet</th>
                <th scope="col" className="py-2 pl-2 text-right font-semibold">Precision macet</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const hl = r.method === "Model B";
                return (
                  <tr key={`${r.horizon}-${r.method}`} className={cn("border-t border-border", hl && "bg-row-hl")}>
                    <td className="mono py-[11px] pr-2 text-text-2">{r.horizon === "1h" ? "1 jam" : "3 jam"}</td>
                    <td className={cn("px-2 py-[11px]", hl ? "font-bold" : "font-medium")}>{r.method}</td>
                    <td className="mono px-2 py-[11px] text-right">{fmtNum(r.mae_kmh, 2)}</td>
                    <td className="mono px-2 py-[11px] text-right">{fmtNum(r.macro_f1, 3)}</td>
                    <td className="mono px-2 py-[11px] text-right">{fmtNum(r.recall_congested, 3)}</td>
                    <td className="mono py-[11px] pl-2 text-right">{fmtNum(r.precision_congested, 3)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
